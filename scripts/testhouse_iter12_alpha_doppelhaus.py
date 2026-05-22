"""Iter-12 step 2 — expand alpha from "east half only" to full Zweifamilien-
Doppelwohnhaus by mirroring the perimeter walls + roof across the party-wall
axis at x=0.

Source-of-truth references:

  - Title-block parser (iter-12 step 1) emits building_class=
    'zweifamilien_doppelhaus' for alpha. See
    `tmp/reverse-bim/house-alpha/building-class.json`.

  - The iter-5 canonical-rebuild script declared alpha as "east half only,
    party wall at x=0 (west), east outer at x=9935", with the 1956 ENTWURF
    title block confirming the full Doppelhaus is ~19.87 m wide × 8.10 m deep.

What this script does:

  1. Query the live alpha snapshot.
  2. Locate the iter-9-emitted main roof (single `kind=roof` entity) so we
     can delete + recreate it spanning the full Doppelhaus footprint.
  3. Build a 5-command bundle:
       a. deleteElement      — drop existing east-only roof
       b. createRoof         — full Doppelhaus footprint, ridge along +x,
                                slope 48°, overhang 800 mm (matches iter-9
                                slope + bumps overhang to the value the
                                iter-11 subagent reports show is needed)
       c–e. createWallChain  — one chain per level (kg/eg/dg) emitting the
                                3-segment U-shape of the west-half perimeter,
                                excluding the party wall (x=0) which already
                                exists from iter-5
  4. Run through the iter-10 pre-flight pipeline (normalize, commit) so the
     methodology trace appears under tmp/reverse-bim/iter-12-alpha-apply.json
     in the same shape as iter-10 output.

Run from repo root:  python3 scripts/testhouse_iter12_alpha_doppelhaus.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from testhouse_command_normalize import normalize_bundle  # noqa: E402
from testhouse_iter10_apply import commit_one, http_json, query_snapshot  # noqa: E402

HOUSE = "alpha"
MODEL_MANIFEST = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{HOUSE}" / "iter-5-canonical-model.json"

# Per iter-5 canonical-rebuild: east half is x=0..9935 × y=0..8100 with party
# wall at x=0 and 365 mm exterior brick. Mirror across x=0 → west half is
# x=-9935..0 × y=0..8100.
HALF_WIDTH_MM = 9935.0
DEPTH_MM = 8100.0
WALL_THICKNESS_MM = 365.0
WALL_HEIGHT_MM = 2750.0
WALL_TYPE_ID = "wt-exterior-brick"

LEVELS = ("lvl-kg", "lvl-eg", "lvl-dg")
ROOF_REF_LEVEL = "lvl-dg"
ROOF_SLOPE_DEG = 48.0
ROOF_OVERHANG_MM = 800.0


def build_west_half_walls(level_id: str) -> list[dict[str, Any]]:
    """3 individual createWall commands forming the west-half perimeter
    (north edge → west gable → south edge), with allowDetached=True so
    the kernel doesn't reject them for being outside the iter-5 floor
    envelope (the floors will get extended in iter-13).

    `createWallChain` was the obvious shape but it doesn't propagate
    ``allowDetached`` to the resulting walls (see
    `engine_dispatch_core.py:263` — the chain dispatcher writes WallElem
    without copying allow_detached from segments). Individual createWall
    commands do carry the flag through to the wall's props.
    """
    edges = [
        ("north", {"xMm": 0.0, "yMm": 0.0},
                  {"xMm": -HALF_WIDTH_MM, "yMm": 0.0}),
        ("gable", {"xMm": -HALF_WIDTH_MM, "yMm": 0.0},
                  {"xMm": -HALF_WIDTH_MM, "yMm": DEPTH_MM}),
        ("south", {"xMm": -HALF_WIDTH_MM, "yMm": DEPTH_MM},
                  {"xMm": 0.0, "yMm": DEPTH_MM}),
    ]
    cmds: list[dict[str, Any]] = []
    for side, start, end in edges:
        cmds.append({
            "type": "createWall",
            "id": f"iter12-alpha-west-{level_id}-{side}",
            "name": f"iter12-alpha-west-{level_id}-{side}",
            "levelId": level_id,
            "start": start,
            "end": end,
            "thicknessMm": WALL_THICKNESS_MM,
            "heightMm": WALL_HEIGHT_MM,
            "wallTypeId": WALL_TYPE_ID,
            "allowDetached": True,
            "authoringIntent": "doppelhaus-west-half-iter12",
        })
    return cmds


def build_full_doppelhaus_roof() -> dict[str, Any]:
    """Single gable roof spanning the full Doppelhaus footprint, ridge along x."""
    return {
        "type": "createRoof",
        "id": "iter12-alpha-roof-doppelhaus",
        "name": "Gable Roof house-alpha (iter12 — full Doppelhaus, overhang 800, pitch 48)",
        "referenceLevelId": ROOF_REF_LEVEL,
        "footprintMm": [
            {"xMm": -HALF_WIDTH_MM, "yMm": 0.0},
            {"xMm":  HALF_WIDTH_MM, "yMm": 0.0},
            {"xMm":  HALF_WIDTH_MM, "yMm": DEPTH_MM},
            {"xMm": -HALF_WIDTH_MM, "yMm": DEPTH_MM},
        ],
        "overhangMm": ROOF_OVERHANG_MM,
        "slopeDeg": ROOF_SLOPE_DEG,
        "roofGeometryMode": "gable_pitched_rectangle",
    }


DOPPELHAUS_ROOF_ID = "iter12-alpha-roof-doppelhaus"


def find_roofs(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    elements = snapshot.get("elements") or {}
    return [e for e in elements.values() if isinstance(e, dict) and e.get("kind") == "roof"]


def find_dormers(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    elements = snapshot.get("elements") or {}
    return [e for e in elements.values() if isinstance(e, dict) and e.get("kind") == "dormer"]


def west_half_walls_present(snapshot: dict[str, Any], level_id: str) -> bool:
    """True if at least one exterior wall on `level_id` already has any
    endpoint with xMm < 0 — i.e. the west-half chain has been emitted."""
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict) or e.get("kind") != "wall":
            continue
        if e.get("levelId") != level_id:
            continue
        s = e.get("start") or {}
        t = e.get("end") or {}
        if float(s.get("xMm", 0)) < 0 or float(t.get("xMm", 0)) < 0:
            return True
    return False


def build_bundle(snapshot: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Idempotent — only emits the commands that haven't yet taken effect.

    Step order matters: orphaned dormers (hostRoofId pointing at a deleted
    roof) must be removed before any subsequent createWallChain, otherwise
    the kernel's per-bundle validation pass blocks the chain with a
    `constructability_proxy_unsupported` warning on the orphaned dormer.
    """
    cmds: list[dict[str, Any]] = []
    plan: dict[str, Any] = {}

    # 1. Delete iter-9 dormers if they're still around (they'll be re-emitted
    #    in iter-13 on the new doppelhaus roof — their old positionOnRoof
    #    no longer maps cleanly across the wider footprint).
    dormers = find_dormers(snapshot)
    plan["dormersFound"] = [d.get("id") for d in dormers]
    for d in dormers:
        cmds.append({"type": "deleteElement", "elementId": d.get("id")})

    # 2. Roof — if no iter-12 doppelhaus roof yet, delete current roof(s)
    #    and create the doppelhaus roof.
    roofs = find_roofs(snapshot)
    have_doppelhaus_roof = any(r.get("id") == DOPPELHAUS_ROOF_ID for r in roofs)
    plan["roofIdsBefore"] = [r.get("id") for r in roofs]
    if not have_doppelhaus_roof:
        for r in roofs:
            cmds.append({"type": "deleteElement", "elementId": r.get("id")})
        cmds.append(build_full_doppelhaus_roof())

    # 3. West-half walls — emit per level only if absent.
    plan["levelsNeedingWestHalf"] = []
    for level_id in LEVELS:
        if not west_half_walls_present(snapshot, level_id):
            plan["levelsNeedingWestHalf"].append(level_id)
            cmds.extend(build_west_half_walls(level_id))

    return cmds, plan


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)
    commands, plan_meta = build_bundle(snapshot)

    # Per iter-10 pipeline: normalize (casing, alias, derived fields).
    normalized, records = normalize_bundle(commands)

    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = 0
    failed = 0
    for i, cmd in enumerate(normalized):
        op = cmd.get("type", "?")
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": op}
        if resp.get("error"):
            entry["status"] = "http_error"
            entry["http_status"] = resp.get("status")
            entry["body"] = resp.get("body")
            failed += 1
        elif resp.get("applied"):
            new_rev = int(resp.get("newRevision") or rev + 1)
            entry["status"] = "applied"
            entry["newRevision"] = new_rev
            rev = new_rev
            applied += 1
        else:
            entry["status"] = "rejected"
            entry["violations"] = resp.get("violations") or resp.get("result", {}).get("violations")
            failed += 1
        per_command.append(entry)

    result = {
        "house": HOUSE,
        "modelId": model_id,
        "plan": plan_meta,
        "appliedCount": applied,
        "failedCount": failed,
        "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
        "commandsEmitted": [{"i": i, "type": c.get("type"), "name": c.get("name") or c.get("namePrefix")} for i, c in enumerate(commands)],
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-12-{HOUSE}-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        f"=== {HOUSE} ===\n"
        f"  existingRoofId: {plan_meta.get('existingRoofId')}\n"
        f"  normalizations: {len(records)}\n"
        f"  applied:        {applied}\n"
        f"  failed:         {failed}\n"
        f"  finalRevision:  {rev}\n"
        f"  details:        {out_path.relative_to(REPO_ROOT)}",
        flush=True,
    )
    for entry in per_command:
        status = entry["status"]
        marker = "✓" if status == "applied" else "✗"
        print(f"  [{entry['i']}] {marker} {entry['type']:<22} -> {status}")
        if status != "applied":
            print(f"      {json.dumps(entry.get('body') or entry.get('violations'))[:240]}")


if __name__ == "__main__":
    main()
