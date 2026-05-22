"""Iter-6 autonomous visual-iteration loop.

The user's iter-5 inspection showed: "the houses modeled don't look
remotely like the ones from the folders." The fix is to drive
visual parity directly — render the current model, compare to the
source PDF page, and have a subagent emit corrective kernel commands
until the model matches.

This script handles the deterministic parts:

  1. capture_model_views() — drive `view_capture_plan` +
     `pnpm reverse-bim:capture` against each iter-5 canonical model,
     producing plan-view + 3D PNGs.
  2. build_diff_prompts() — emit one visual-diff prompt per
     (house, level), pointing at the just-captured model screenshot
     + the canonical source page PNG. The orchestrator (me, the
     LLM) dispatches these via Agent() in its turn.
  3. apply_correction_commands() — read response files
     (visualDiffCorrection_v1) and apply kernel command lists.
  4. main() prints what's captured + what diffs are pending. The
     orchestrator dispatches, waits, then re-runs main() to apply.

Loop terminates when every (house, level) returns `converged: true`
or when the per-(house, level) retry budget is exhausted.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
API_BASE = "http://localhost:28500"
STATE_PATH = REPO_ROOT / "tmp" / "reverse-bim" / "iter-6-visual-state.json"
RESPONSES_ROOT = REPO_ROOT / "tmp" / "reverse-bim" / "iter-6-visual-diffs"

VISUAL_RETRY_BUDGET = 4


# Canonical source pages per (house, level). Used to pair model
# screenshots with the right source plan PNG.
SOURCE_PAGE_PNG: dict[str, dict[str, str]] = {
    "house-alpha": {
        "EG": "tmp/reverse-bim/house-alpha/source/rendered-pages/srcdoc-22993cc5012b/EG-1.png",
        "DG": "tmp/reverse-bim/house-alpha/source/rendered-pages/srcdoc-74bc75065121/DG-1.png",
    },
    "house-beta": {
        "KG": "tmp/reverse-bim/house-beta/source/rendered-pages/srcdoc-e73f05ce8e83/Grundrisse, Ansichten, Schnitt (1)-1.png",
        "EG": "tmp/reverse-bim/house-beta/source/rendered-pages/srcdoc-e73f05ce8e83/Grundrisse, Ansichten, Schnitt (1)-2.png",
        "DG": "tmp/reverse-bim/house-beta/source/rendered-pages/srcdoc-e73f05ce8e83/Grundrisse, Ansichten, Schnitt (1)-3.png",
    },
    "house-gamma": {
        "KG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402/Kannenofen-01.png",
        "EG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402/Kannenofen-02.png",
        "OG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402/Kannenofen-03.png",
        "DG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402/Kannenofen-04.png",
    },
}

# Per-house canonical frame description (kept in sync with
# scripts/testhouse_iter5_canonical_rebuild.py).
HOUSE_FRAME_DESC: dict[str, str] = {
    "house-alpha": (
        "East half of the 1956 Reinecke Doppelhaus. Building frame: "
        "origin at SW corner of east half. Party wall at x=0 (west "
        "edge of model); east outer wall at x=9935 mm; south facade "
        "at y=0; north facade at y=8100 mm. All commands you emit "
        "must use this frame."
    ),
    "house-beta": (
        "2007 detached single-family house. Building frame: origin "
        "at SW corner of EG perimeter. x∈[0, 9864] mm (east); "
        "y∈[0, 8984] mm (north). KG perimeter slightly smaller "
        "(9764 × 8984)."
    ),
    "house-gamma": (
        "1993 Doppelhaushälfte. Building frame: origin at SW corner. "
        "x∈[0, 18000] mm (east, the long axis); y∈[0, 8000] mm "
        "(north). Party wall along y=8000. SE chamfer goes "
        "(17045, 0) → (18000, 955). NOTE the source pages may render "
        "with their long axis vertical in image space — transform to "
        "the canonical frame before emitting commands."
    ),
}


def http_json(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read())
    except error.HTTPError as exc:
        return {"error": True, "status": exc.code, "body": exc.read().decode("utf-8", "replace")[:800]}


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"schemaVersion": "iter6VisualState_v1", "houses": {}}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def model_id_for(house: str) -> str | None:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / house / "iter-5-canonical-model.json"
    if not manifest.exists():
        return None
    return json.loads(manifest.read_text(encoding="utf-8")).get("modelId")


def capture_model_views(house: str) -> dict[str, str]:
    """Render plan_view per level + the 3D viewpoint and return
    {viewName: screenshotPath}."""
    model_id = model_id_for(house)
    if not model_id:
        return {}
    plan_path = REPO_ROOT / "tmp" / "reverse-bim" / house / "iter-6-view-capture-plan.json"
    out_dir = REPO_ROOT / "tmp" / "reverse-bim" / house / "iter-6-captures"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Build view-capture plan using the existing endpoint.
    views_resp = http_json("POST", f"/api/models/{model_id}/query/views", {})
    view_rows = (views_resp.get("data") or {}).get("views") or []
    plan_views = [v for v in view_rows if v.get("kind") == "plan_view"]
    viewpoints = [v for v in view_rows if v.get("kind") in {"viewpoint", "saved_view"}]
    required_ui = []
    for v in plan_views + viewpoints:
        required_ui.append({"viewId": v.get("id"), "name": v.get("name") or v.get("id")})
    plan = http_json(
        "POST",
        "/api/v3/reverse-bim/view-capture-plan",
        {
            "modelId": model_id,
            "baseUrl": "http://127.0.0.1:22000",
            "outputDir": str(out_dir),
            "requiredUiViews": required_ui,
            "requiredOverlayViews": [],
        },
    )
    plan_path.write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if (plan.get("summary") or {}).get("blockerCount", 0) > 0:
        return {}
    # Run Playwright capture.
    proc = subprocess.run(
        [
            "pnpm",
            "--filter",
            "@bim-ai/web",
            "reverse-bim:capture",
            "--plan",
            str(plan_path),
            "--out",
            str(out_dir),
            "--json",
        ],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=900,
    )
    if proc.returncode != 0:
        return {"_error": proc.stderr[-1000:]}
    manifest_path = out_dir / "reverse-bim-view-capture-manifest.json"
    if not manifest_path.exists():
        return {"_error": "no_manifest"}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for cap in manifest.get("captures") or []:
        if cap.get("status") != "captured":
            continue
        view_id = cap.get("viewId") or ""
        path = cap.get("path") or cap.get("screenshotPath")
        if path:
            out[view_id] = path
    return out


def level_for_plan_view_name(view_name: str) -> str | None:
    """The auto-authored plan views are named 'Plan — KG' / 'Plan — EG' / etc."""
    if not view_name:
        return None
    if "—" not in view_name:
        return None
    return view_name.split("—", 1)[1].strip()


def build_diff_prompt(
    *,
    house: str,
    level: str,
    iteration: int,
    model_screenshot: str,
    source_page: str,
    model_id: str,
) -> str:
    """Build the visual-diff prompt the orchestrator dispatches."""

    dispatch_id = f"{house}-iter6-{level.lower()}-pass-{iteration:02d}"
    response_path = RESPONSES_ROOT / f"{dispatch_id}.json"
    RESPONSES_ROOT.mkdir(parents=True, exist_ok=True)

    return f"""You are the iter-6 visual-diff corrector for testhouse `{house}`, level `{level}`.

## Building frame (CRITICAL — all coordinates must use this frame)

{HOUSE_FRAME_DESC[house]}

## Two images to compare

1. **Model screenshot** (the current BIM model's plan view as rendered by
   the dev viewer):
   `{model_screenshot}`

2. **Source plan PNG** (the canonical source-folder page for this level):
   `{source_page}`

Read BOTH with the Read tool — the tool displays them as images. Look at
where rooms are, where walls run, where doors and windows sit. Compare
the two visually.

## Your task

Emit a structured JSON document describing the architectural corrections
needed to bring the model into visual parity with the source. The
orchestrator will apply your commands directly to the live model.

Response shape (write to `{response_path}`):

```json
{{
  "format": "visualDiffCorrection_v1",
  "house": "{house}",
  "level": "{level}",
  "iteration": {iteration},
  "converged": <true if the model already matches the source within
                acceptable tolerance, false if corrections are needed>,
  "verdict": "<one paragraph plain-English summary>",
  "commands": [
    // ZERO OR MORE kernel commands, each ready to apply to
    // POST /api/models/{model_id}/bundles. Common shapes:

    {{ "type": "createRoomOutline", "name": "<label>",
       "levelId": "<lvl-kg|lvl-eg|lvl-og|lvl-dg|lvl-spitz>",
       "outlineMm": [{{"xMm": <N>, "yMm": <N>}}, ...],
       "targetAreaM2": <number> }}

    {{ "type": "createWallChain", "levelId": "<lvl-id>",
       "namePrefix": "iter6-partition-<slug>",
       "segments": [{{"start": {{"xMm": <N>, "yMm": <N>}},
                      "end":   {{"xMm": <N>, "yMm": <N>}},
                      "thicknessMm": 115, "heightMm": 2750}}] }}

    {{ "type": "insertWindowOnWall", "wallId": "<live wall id>",
       "alongT": <0..1 along the wall>,
       "widthMm": <N>, "heightMm": <N>, "sillHeightMm": <N> }}

    {{ "type": "insertDoorOnWall", "wallId": "<live wall id>",
       "alongT": <0..1>, "widthMm": <N> }}

    {{ "type": "deleteElement", "elementId": "<live element id>" }}
  ]
}}
```

For `insertDoor/Window` you can either:
- supply `wallId` directly (if you've already queried it), OR
- emit `nearPointMm` instead of `wallId` like `{{"type": "insertWindowOnWall", "nearPointMm": [<x>, <y>], "levelId": "<lvl>", "alongT": <opt>, "widthMm": <N>, ...}}` — the apply step will resolve the host wall via `/query/nearest-wall`.

For deletes: read the live model with `query/elements` to see current
element ids. The orchestrator already loaded plenty of walls / rooms /
openings — be surgical. Only delete a misplaced element when you're
authoring a corrected replacement.

## Guidance

- If the model already looks right (rooms in the right places, walls
  forming the right enclosure, openings approximately on the correct
  facades), set `converged: true` and emit zero commands.
- If the source is more detailed than the model, emit the missing
  rooms / walls / openings.
- If the model has elements clearly placed wrong (room outside walls,
  opening on a non-existent wall), emit a delete + corrected create.
- Confidence is fine to be moderate; an opinionated correction is more
  useful than no correction.
- Coordinates absolutely must be in the canonical building frame
  above. Do not emit page-pixel or local-frame numbers.
- This is iteration {iteration} of {VISUAL_RETRY_BUDGET}. If this is
  iteration {VISUAL_RETRY_BUDGET} and the model still doesn't match,
  set `converged: false` and explain in `verdict` what would need a
  human pass.

After writing the JSON file, print a one-line summary: command count +
converged flag.
"""


def _level_by_view_id(house: str) -> dict[str, str]:
    """Resolve each view id (used as capture key) to a level name."""
    model_id = model_id_for(house)
    if not model_id:
        return {}
    views_resp = http_json("POST", f"/api/models/{model_id}/query/views", {})
    rows = (views_resp.get("data") or {}).get("views") or []
    elems = http_json("POST", f"/api/models/{model_id}/query/elements", {"kinds": ["level"]})
    levels = {
        str(e.get("id")): str(e.get("name") or "")
        for e in (elems.get("data") or {}).get("elements") or []
        if e.get("kind") == "level"
    }
    out: dict[str, str] = {}
    for v in rows:
        if v.get("kind") != "plan_view":
            continue
        lvl_name = levels.get(str(v.get("levelId")))
        if lvl_name:
            out[str(v.get("id"))] = lvl_name
    return out


def render_diff_prompts(state: dict[str, Any]) -> list[dict[str, Any]]:
    pending = []
    for house, levels in SOURCE_PAGE_PNG.items():
        h_state = state["houses"].setdefault(house, {"levels": {}})
        captures = h_state.get("latestCaptures") or {}
        # Map capture-key (view id) → level name via a fresh views query.
        view_id_to_level = _level_by_view_id(house)
        for level, src in levels.items():
            l_state = h_state["levels"].setdefault(
                level, {"iteration": 0, "converged": False}
            )
            if l_state.get("converged"):
                continue
            if l_state["iteration"] >= VISUAL_RETRY_BUDGET:
                continue
            # Find the model screenshot — match plan_view by level name.
            screenshot = None
            for view_id, path in captures.items():
                if view_id_to_level.get(view_id) == level:
                    screenshot = path
                    break
            if not screenshot:
                continue
            iteration = l_state["iteration"] + 1
            model_id = h_state.get("modelId") or model_id_for(house)
            prompt = build_diff_prompt(
                house=house,
                level=level,
                iteration=iteration,
                model_screenshot=screenshot,
                source_page=str(REPO_ROOT / src),
                model_id=model_id,
            )
            dispatch_id = f"{house}-iter6-{level.lower()}-pass-{iteration:02d}"
            prompt_path = REPO_ROOT / "tmp" / "reverse-bim" / "iter-6-prompts" / f"{dispatch_id}.txt"
            prompt_path.parent.mkdir(parents=True, exist_ok=True)
            prompt_path.write_text(prompt, encoding="utf-8")
            pending.append(
                {
                    "id": dispatch_id,
                    "house": house,
                    "level": level,
                    "iteration": iteration,
                    "promptPath": str(prompt_path),
                }
            )
    state["pendingDiffs"] = pending
    save_state(state)
    return pending


def apply_commands_for(house: str, response: dict[str, Any]) -> dict[str, Any]:
    model_id = model_id_for(house)
    if not model_id:
        return {"applied": 0, "errors": ["no_model_id"]}
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)
    applied = 0
    errors: list[str] = []
    for raw_cmd in response.get("commands") or []:
        cmd = dict(raw_cmd)
        # Resolve nearPointMm → wallId for opening commands if the
        # subagent didn't supply wallId directly.
        if cmd.get("type") in {"insertDoorOnWall", "insertWindowOnWall"} and not cmd.get("wallId"):
            near = cmd.pop("nearPointMm", None)
            level_id = cmd.pop("levelId", None)
            if isinstance(near, list) and len(near) >= 2:
                resp = http_json(
                    "POST",
                    f"/api/models/{model_id}/query/nearest-wall",
                    {
                        "nearPointMm": [float(near[0]), float(near[1])],
                        "levelId": level_id,
                    },
                )
                wall_block = (resp.get("data") or {}).get("wall") or {}
                placement = (resp.get("data") or {}).get("placement") or {}
                wall_id = wall_block.get("elementId")
                along_t = placement.get("t")
                if not wall_id:
                    errors.append(f"no_host_wall:{near}")
                    continue
                cmd["wallId"] = wall_id
                if "alongT" not in cmd and isinstance(along_t, (int, float)):
                    cmd["alongT"] = max(0.0, min(1.0, float(along_t)))
        bundle = {
            "mode": "commit",
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": [cmd],
                "assumptions": [
                    {
                        "key": f"iter6.{cmd.get('type','cmd')}.{applied}",
                        "value": str(cmd.get("name") or cmd.get("type", "cmd")),
                        "confidence": 0.7,
                        "source": "iter6_visual_loop",
                        "contestable": True,
                        "evidence": "visual_diff_correction_v1 response",
                    }
                ],
                "parentRevision": rev,
            },
        }
        resp = http_json("POST", f"/api/models/{model_id}/bundles", bundle)
        if resp.get("error") or not resp.get("applied"):
            errors.append(f"{cmd.get('type')}_failed:status={resp.get('status')}")
            continue
        new_rev = resp.get("newRevision")
        if new_rev:
            rev = int(new_rev)
        applied += 1
    return {"applied": applied, "errors": errors}


def ingest_responses(state: dict[str, Any]) -> dict[str, Any]:
    if not RESPONSES_ROOT.exists():
        return {"ingestedCount": 0}
    ingested = 0
    for path in sorted(RESPONSES_ROOT.glob("*.json")):
        try:
            response = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        dispatch_id = path.stem
        # Parse house/level/iteration out of dispatch id.
        parts = dispatch_id.split("-")
        try:
            house = "-".join(parts[:2])
            level = parts[3].upper() if parts[3] != "spitzboden" else "Spitzboden"
            iteration = int(parts[-1])
        except (IndexError, ValueError):
            continue
        l_state = state["houses"].setdefault(house, {"levels": {}})["levels"].setdefault(
            level, {"iteration": 0, "converged": False, "history": []}
        )
        # Skip already-applied iterations for this level.
        if any(h["iteration"] == iteration for h in l_state.get("history") or []):
            continue
        apply_result = apply_commands_for(house, response)
        history_entry = {
            "iteration": iteration,
            "converged": bool(response.get("converged")),
            "verdict": (response.get("verdict") or "")[:400],
            "commandCount": len(response.get("commands") or []),
            **apply_result,
        }
        l_state.setdefault("history", []).append(history_entry)
        l_state["iteration"] = max(l_state.get("iteration") or 0, iteration)
        l_state["converged"] = bool(response.get("converged")) and apply_result.get("applied", 0) >= 0
        ingested += 1
    save_state(state)
    return {"ingestedCount": ingested}


def main() -> None:
    state = load_state()
    state["houses"] = state.get("houses") or {}
    ingest_responses(state)
    # Capture fresh screenshots for any house that hasn't converged.
    for house in SOURCE_PAGE_PNG:
        h_state = state["houses"].setdefault(house, {"levels": {}})
        if all(
            (h_state["levels"].get(lvl) or {}).get("converged")
            for lvl in SOURCE_PAGE_PNG[house]
        ):
            continue
        captures = capture_model_views(house)
        h_state["modelId"] = model_id_for(house)
        h_state["latestCaptures"] = captures
    save_state(state)
    pending = render_diff_prompts(state)
    # Print structured summary.
    summary = {
        "pendingDiffCount": len(pending),
        "houses": {
            h: {
                "modelId": state["houses"][h].get("modelId"),
                "levels": {
                    lvl: {
                        "iteration": (state["houses"][h]["levels"].get(lvl) or {}).get("iteration", 0),
                        "converged": (state["houses"][h]["levels"].get(lvl) or {}).get("converged", False),
                    }
                    for lvl in SOURCE_PAGE_PNG[h]
                },
            }
            for h in SOURCE_PAGE_PNG
        },
        "pending": [{"id": p["id"], "promptPath": p["promptPath"]} for p in pending],
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
