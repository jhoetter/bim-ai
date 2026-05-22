"""Iter-10 — re-apply iter-9 corrector JSONs through the normalizer.

Pipeline:
  1. Load each iter-9 corrector JSON.
  2. Query the live model and build an element-id remap so saved corrector
     commands that reference long-dead UUIDs (from a prior DB state) point at
     the freshly-rebuilt equivalents. Per-house remap rules below.
  3. Normalize every command (casing, alias remap, derived fields) via
     testhouse_command_normalize.normalize_bundle.
  4. For each command: POST as a 1-command bundle (mode=commit) so a single
     failure does not abort the rest.
  5. Write iter-10-{house}-apply.json with: applied count, normalizations,
     remaps, per-command result, violations.

The normalizer + remap records are the methodology output — they tell the
orchestrator what schema + reference affordances need to be embedded in
future subagent prompts so iter-N JSONs survive DB rebuilds.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from testhouse_command_normalize import (  # noqa: E402
    NormalizationRecord,
    format_records,
    normalize_bundle,
)

API_BASE = "http://localhost:28500"

HOUSES = {
    "house-alpha": (
        "tmp/reverse-bim/house-alpha/iter-5-canonical-model.json",
        "tmp/reverse-bim/iter-9-alpha-corrector.json",
    ),
    "house-beta": (
        "tmp/reverse-bim/house-beta/iter-5-canonical-model.json",
        "tmp/reverse-bim/iter-9-beta-corrector.json",
    ),
    "house-gamma": (
        "tmp/reverse-bim/house-gamma/iter-5-canonical-model.json",
        "tmp/reverse-bim/iter-9-gamma-corrector.json",
    ),
}


def query_snapshot(model_id: str) -> dict[str, Any]:
    """Fetch the full snapshot for element-id resolution."""
    return http_json("GET", f"/api/models/{model_id}/snapshot")


def build_id_remap(house: str, snapshot: dict[str, Any]) -> dict[str, str]:
    """Per-house remap of iter-9 saved UUIDs → live UUIDs.

    The mapping is keyed by the OLD UUID literal that appears in the saved
    corrector JSON. We resolve each by a domain rule (e.g. 'the single roof on
    house-X', 'the south EG outer wall'). When the iter-9 corrector cited a
    stable string id (e.g. 'topo-house-beta'), it survives the rebuild and
    needs no remap.

    Keep this table small and explicit — it documents exactly which UUIDs the
    saved correctors couldn't carry across a DB rebuild, which is the
    methodology learning we want to highlight.
    """
    elements = snapshot.get("elements") or {}
    remap: dict[str, str] = {}

    def single_kind(kind: str) -> str | None:
        matches = [
            e.get("id") for e in elements.values()
            if isinstance(e, dict) and e.get("kind") == kind and e.get("id")
        ]
        return matches[0] if len(matches) == 1 else None

    def find_wall(level: str, predicate) -> str | None:
        for e in elements.values():
            if not isinstance(e, dict) or e.get("kind") != "wall":
                continue
            if e.get("levelId") != level:
                continue
            s, t = e.get("start") or {}, e.get("end") or {}
            if predicate(s, t):
                return e.get("id")
        return None

    if house == "house-alpha":
        roof = single_kind("roof")
        if roof:
            remap["13e9a109-1117-4971-83c6-ce4663ab71f5"] = roof  # delete-old-roof
    elif house == "house-beta":
        roof = single_kind("roof")
        if roof:
            remap["c080a708-c3fb-4515-a371-a06596c5df14"] = roof
        south_eg = find_wall(
            "lvl-eg",
            lambda s, t: s.get("yMm") == 0 and t.get("yMm") == 0,
        )
        if south_eg:
            remap["a5b9da34-de51-40fb-b96b-2bf721c97470"] = south_eg
    elif house == "house-gamma":
        roof = single_kind("roof")
        if roof:
            remap["18a91f86-df6c-46fd-b7cf-e8f37705daea"] = roof

    return remap


# Fields in saved iter-9 commands that hold element-id references and may
# need remapping after a fresh rebuild.
ID_REF_FIELDS = ("elementId", "wallId", "hostRoofId", "hostToposolidId", "toposolidId")


def remap_command(cmd: dict[str, Any], remap: dict[str, str]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Walk the command and substitute any field value present in the remap table."""
    new = dict(cmd)
    changes: list[dict[str, str]] = []
    for field in ID_REF_FIELDS:
        old = new.get(field)
        if isinstance(old, str) and old in remap:
            new[field] = remap[old]
            changes.append({"field": field, "from": old, "to": remap[old]})
    return new, changes


def http_json(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(body_text)
        except json.JSONDecodeError:
            parsed = {"raw": body_text[:500]}
        return {"error": True, "status": exc.code, "body": parsed}


def commit_one(model_id: str, cmd: dict[str, Any], rev: int) -> dict[str, Any]:
    op = cmd.get("type", "?")
    cmd_id = cmd.get("id") or cmd.get("toposolidId") or cmd.get("elementId") or op
    bundle = {
        "mode": "commit",
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [cmd],
            "assumptions": [
                {
                    "key": f"iter10.{op}.{cmd_id}",
                    "value": str(cmd.get("name") or op),
                    "confidence": 0.7,
                    "source": "iter10_normalized_corrector",
                    "contestable": True,
                    "evidence": "iter-10 re-application of iter-9 deep-corrector after schema normalization",
                }
            ],
            "parentRevision": rev,
        },
    }
    return http_json("POST", f"/api/models/{model_id}/bundles", bundle)


def _detect_axis_frame(values: list[float], half_extent: float) -> str:
    """Return 'world' or 'local' from a population of axis values.

    World-coordinate populations are characterised by: (a) all values
    non-negative, AND (b) the population spans roughly the full [0, 2*half]
    extent (i.e. some value is > half_extent OR the mean is closer to
    half_extent than to zero). Local-coordinate populations include
    negatives or cluster around zero.

    Returns 'unknown' if there's not enough signal (single non-zero value
    that doesn't overflow).
    """
    if not values:
        return "unknown"
    if any(v < 0 for v in values):
        return "local"
    if any(v > half_extent for v in values):
        return "world"
    if len(values) >= 2:
        mean = sum(values) / len(values)
        if abs(mean - half_extent) < abs(mean):
            return "world"
        return "local"
    # Single non-negative value within [0, half] — ambiguous. Default to
    # local (no shift) to avoid breaking models that were correctly emitted.
    return "unknown"


def _recenter_bundle_dormer_positions(
    commands: list[dict[str, Any]],
    future_roof: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Bundle-level recenter — detect world-vs-local frame per axis from the
    full population of dormer positions in the bundle, then apply the shift
    only where the population evidence says 'world'.

    Why per-bundle (not per-command): a single (alongRidgeMm=5500) on a
    0..18000 roof is ambiguous in isolation — could be world or local. But
    when you see (5500, 12500, 5500, 12500) all positive with one over
    half_extent, the population is clearly world coords. Conversely
    (-2000, -2000, +2000, +2000) has negatives → local coords. This rule
    is the only one I trust to be both correct and silent.

    Logged inside `rewrite_command` via the bundle_context.
    """
    if not future_roof:
        return [dict(c) for c in commands]
    footprint = future_roof.get("footprintMm") or []
    if not footprint:
        return [dict(c) for c in commands]
    xs = [float(p.get("xMm", 0)) for p in footprint]
    ys = [float(p.get("yMm", 0)) for p in footprint]
    span_x = max(xs) - min(xs)
    span_y = max(ys) - min(ys)
    ridge_along_x = span_x >= span_y
    half_along = (span_x if ridge_along_x else span_y) / 2.0
    half_across = (span_y if ridge_along_x else span_x) / 2.0

    along_values: list[float] = []
    across_values: list[float] = []
    dormer_indices: list[int] = []
    for i, c in enumerate(commands):
        if c.get("type") != "createDormer":
            continue
        if str(c.get("hostRoofId")) != str(future_roof.get("id")):
            continue
        pos = c.get("positionOnRoof") or {}
        along_values.append(float(pos.get("alongRidgeMm", 0)))
        across_values.append(float(pos.get("acrossRidgeMm", 0)))
        dormer_indices.append(i)

    along_frame = _detect_axis_frame(along_values, half_along)
    across_frame = _detect_axis_frame(across_values, half_across)

    out = [dict(c) for c in commands]
    for i in dormer_indices:
        pos = dict(out[i].get("positionOnRoof") or {})
        if along_frame == "world":
            pos["alongRidgeMm"] = float(pos.get("alongRidgeMm", 0)) - half_along
        if across_frame == "world":
            pos["acrossRidgeMm"] = float(pos.get("acrossRidgeMm", 0)) - half_across
        out[i]["positionOnRoof"] = pos
        out[i]["_recenterApplied"] = {
            "alongFrame": along_frame,
            "acrossFrame": across_frame,
        }
    return out


def rewrite_command(
    cmd: dict[str, Any],
    snapshot: dict[str, Any],
    bundle_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Rewrite hallucinated command shapes into kernel-supported equivalents.

    Two cases the iter-9 deep-correctors got wrong:

    * ``createMassBox`` with dormer-intent payload — not a real kernel command;
      rewrite as ``createDormer`` (kind=shed) hosted on the model's single roof.
    * ``createWindow`` with ``hostWallSelector`` — not a real kernel command;
      rewrite as ``insertWindowOnWall`` with the wallId resolved from the
      selector (facade + approxAtMm + levelId) against the live snapshot.

    Returns ``(new_cmd, rewrite_log_entry_or_None)``.
    """
    elements = snapshot.get("elements") or {}
    ctype = cmd.get("type", "")

    if ctype == "createMassBox":
        name = (cmd.get("name") or "").lower()
        if any(token in name for token in ("dormer", "schleppgaube", "gaube")):
            origin = cmd.get("originMm") or {}
            size = cmd.get("sizeMm") or {}
            # Prefer a roof that the SAME bundle is about to create; fall back
            # to the live snapshot's roof. This avoids hosting on an
            # about-to-be-deleted roof.
            bundle_roof = (bundle_context or {}).get("future_roof")
            host_roof_id: str | None = None
            host_roof_footprint: list[dict[str, float]] = []
            if bundle_roof:
                host_roof_id = bundle_roof.get("id")
                host_roof_footprint = list(bundle_roof.get("footprintMm") or [])
            else:
                roofs = [e for e in elements.values() if isinstance(e, dict) and e.get("kind") == "roof"]
                if roofs:
                    host_roof_id = roofs[0].get("id")
            if not host_roof_id:
                return cmd, None

            mid_x = float(origin.get("xMm", 0)) + float(size.get("xMm", 0)) / 2.0
            mid_y = float(origin.get("yMm", 0)) + float(size.get("yMm", 0)) / 2.0

            # Compute roof centroid in world coords from the bundle's footprint
            # if available, else from the live snapshot's wall extent.
            if host_roof_footprint:
                xs = [float(p.get("xMm", 0)) for p in host_roof_footprint]
                ys = [float(p.get("yMm", 0)) for p in host_roof_footprint]
                roof_mid_x = (min(xs) + max(xs)) / 2.0
                roof_mid_y = (min(ys) + max(ys)) / 2.0
            else:
                wall_y_max = 0.0
                wall_x_max = 0.0
                for e in elements.values():
                    if not isinstance(e, dict) or e.get("kind") != "wall":
                        continue
                    s = e.get("start") or {}; t = e.get("end") or {}
                    wall_x_max = max(wall_x_max, float(s.get("xMm", 0)), float(t.get("xMm", 0)))
                    wall_y_max = max(wall_y_max, float(s.get("yMm", 0)), float(t.get("yMm", 0)))
                roof_mid_x = wall_x_max / 2.0
                roof_mid_y = wall_y_max / 2.0

            # Drop materialKey: subagent-invented stylized names (e.g.
            # 'render_white') are rarely in the catalog and would crash the
            # whole dormer creation. Materials are layered on later.
            new_cmd = {
                "type": "createDormer",
                "id": cmd.get("id"),
                "name": cmd.get("name"),
                "hostRoofId": host_roof_id,
                "positionOnRoof": {
                    "alongRidgeMm": mid_x - roof_mid_x,
                    "acrossRidgeMm": mid_y - roof_mid_y,
                },
                "widthMm": float(size.get("xMm", 1)),
                "wallHeightMm": float(size.get("zMm", 1)),
                "depthMm": float(size.get("yMm", 1)),
                "dormerRoofKind": "shed",
            }
            return new_cmd, {
                "from": ctype,
                "to": "createDormer",
                "reason": "Schleppgaube intent → kernel-native dormer (hosted on bundle's new roof, position recentered to roof-local, materialKey dropped)",
            }

    if ctype == "createDormer":
        # Bundle-level recenter already ran before rewrite (see
        # _recenter_bundle_dormer_positions); this branch just surfaces
        # what was decided so it shows up in the rewrite log.
        applied = cmd.get("_recenterApplied")
        if applied:
            new_cmd = dict(cmd)
            new_cmd.pop("_recenterApplied", None)
            shifted_along = applied.get("alongFrame") == "world"
            shifted_across = applied.get("acrossFrame") == "world"
            if shifted_along or shifted_across:
                axes = ", ".join(
                    f"{axis}={applied[axis + 'Frame']}"
                    for axis in ("along", "across")
                )
                return new_cmd, {
                    "from": ctype,
                    "to": ctype,
                    "reason": f"recenter positionOnRoof (per-axis frame: {axes})",
                }
            # No shift but still strip the internal marker.
            return new_cmd, None

    if ctype == "createWindow":
        selector = cmd.get("hostWallSelector") or {}
        approx = selector.get("approxAtMm") or {}
        level_id = cmd.get("levelId")
        facade = selector.get("facade")
        if not facade or not level_id:
            return cmd, None

        target_wall = None
        for e in elements.values():
            if not isinstance(e, dict) or e.get("kind") != "wall":
                continue
            if e.get("levelId") != level_id:
                continue
            s = e.get("start") or {}; t = e.get("end") or {}
            sx, sy = float(s.get("xMm", 0)), float(s.get("yMm", 0))
            tx, ty = float(t.get("xMm", 0)), float(t.get("yMm", 0))
            if facade == "east" and sx == tx and sx >= float(approx.get("xMm", 0)) - 1:
                target_wall = e
                break
            if facade == "west" and sx == tx and sx <= float(approx.get("xMm", 0)) + 1:
                target_wall = e
                break
            if facade == "north" and sy == ty and sy >= float(approx.get("yMm", 0)) - 1:
                target_wall = e
                break
            if facade == "south" and sy == ty and sy <= float(approx.get("yMm", 0)) + 1:
                target_wall = e
                break
        if not target_wall:
            return cmd, None

        # Compute alongT from approxAtMm position along the wall vector.
        s = target_wall.get("start") or {}; t = target_wall.get("end") or {}
        sx, sy = float(s.get("xMm", 0)), float(s.get("yMm", 0))
        tx, ty = float(t.get("xMm", 0)), float(t.get("yMm", 0))
        if facade in ("east", "west"):
            wall_len = abs(ty - sy)
            along = (float(approx.get("yMm", 0)) - sy) / wall_len if wall_len else 0.5
        else:
            wall_len = abs(tx - sx)
            along = (float(approx.get("xMm", 0)) - sx) / wall_len if wall_len else 0.5
        along = max(0.05, min(0.95, abs(along)))

        new_cmd = {
            "type": "insertWindowOnWall",
            "id": cmd.get("id"),
            "name": cmd.get("name"),
            "wallId": target_wall.get("id"),
            "alongT": along,
            "widthMm": cmd.get("widthMm"),
            "heightMm": cmd.get("heightMm"),
            "sillHeightMm": cmd.get("sillMm") or cmd.get("sillHeightMm") or 800,
        }
        return new_cmd, {
            "from": ctype,
            "to": "insertWindowOnWall",
            "reason": f"hostWallSelector(facade={facade}) → wallId resolved against live snapshot",
        }

    return cmd, None


def apply_house(house: str, model_manifest: str, corrector_path: str) -> dict[str, Any]:
    model_id = json.loads((REPO_ROOT / model_manifest).read_text(encoding="utf-8"))["modelId"]
    corrector = json.loads((REPO_ROOT / corrector_path).read_text(encoding="utf-8"))
    raw_commands: list[dict[str, Any]] = list(corrector.get("commands") or [])

    # Step 1: build the id-remap from the live snapshot.
    snapshot = query_snapshot(model_id)
    remap = build_id_remap(house, snapshot)

    # Step 2: remap UUID refs in every command.
    remapped: list[dict[str, Any]] = []
    remap_log: list[dict[str, Any]] = []
    for i, cmd in enumerate(raw_commands):
        new_cmd, changes = remap_command(cmd, remap)
        remapped.append(new_cmd)
        if changes:
            remap_log.append({"i": i, "type": cmd.get("type"), "changes": changes})

    # Step 3: rewrite hallucinated command shapes (createMassBox → createDormer, etc.)
    # First pass: locate any createRoof in the bundle so dormer rewrites can
    # host on it and convert positions into roof-local coordinates.
    future_roof: dict[str, Any] | None = None
    for cmd in remapped:
        if cmd.get("type") == "createRoof":
            future_roof = {"id": cmd.get("id"), "footprintMm": cmd.get("footprintMm")}
            break
    bundle_context = {"future_roof": future_roof} if future_roof else {}

    # Step 3a: bundle-level dormer-position frame detection + recenter.
    # Annotates each dormer with `_recenterApplied`; rewrite_command logs it.
    pre_rewrite = _recenter_bundle_dormer_positions(remapped, future_roof)

    rewritten: list[dict[str, Any]] = []
    rewrite_log: list[dict[str, Any]] = []
    for i, cmd in enumerate(pre_rewrite):
        new_cmd, rewrite = rewrite_command(cmd, snapshot, bundle_context)
        rewritten.append(new_cmd)
        if rewrite is not None:
            rewrite_log.append({"i": i, **rewrite})

    # Step 4: normalize (casing, alias, derived fields).
    normalized, records = normalize_bundle(rewritten)

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

    return {
        "house": house,
        "modelId": model_id,
        "appliedCount": applied,
        "failedCount": failed,
        "finalRevision": rev,
        "remap": remap,
        "remapLog": remap_log,
        "rewriteLog": rewrite_log,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }


def main() -> None:
    out_dir = REPO_ROOT / "tmp" / "reverse-bim"
    overall: dict[str, Any] = {}
    for house, (manifest, corrector) in HOUSES.items():
        print(f"=== {house} ===", flush=True)
        result = apply_house(house, manifest, corrector)
        out_path = out_dir / f"iter-10-{house.split('-', 1)[1]}-apply.json"
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        overall[house] = {
            "applied": result["appliedCount"],
            "failed": result["failedCount"],
            "normalizations": len(result["normalizations"]),
            "remaps": len(result["remapLog"]),
            "outPath": str(out_path.relative_to(REPO_ROOT)),
        }
        # Compact terminal output
        recs = [NormalizationRecord(**rec) for rec in result["normalizations"]]
        print(
            f"  remaps:         {len(result['remapLog'])}\n"
            f"  normalizations: {len(recs)}\n"
            f"  applied:        {result['appliedCount']}\n"
            f"  failed:         {result['failedCount']}\n"
            f"  finalRevision:  {result['finalRevision']}\n"
            f"  details:        {out_path.relative_to(REPO_ROOT)}",
            flush=True,
        )
        if result["remapLog"]:
            print("  remap log:")
            for r in result["remapLog"]:
                for ch in r["changes"]:
                    print(f"    [{r['i']}] {r['type']}.{ch['field']}: {ch['from'][:8]}.. → {ch['to'][:8]}..")
        if result["rewriteLog"]:
            print("  rewrite log:")
            for r in result["rewriteLog"]:
                print(f"    [{r['i']}] {r['from']} → {r['to']}: {r['reason']}")
        if recs:
            print("  normalizer log:")
            print(format_records(recs))
    print(json.dumps({"summary": overall}, indent=2))


if __name__ == "__main__":
    main()
