"""Iter-15b — re-emit the main gable roofs with materialKey baked in.

`updateElementProperty` on a roof only supports roofTypeId | roofGeometryMode
| overhangSemantics | name (see engine_dispatch_properties.py:877). To
change materialKey + slopeDeg + overhangMm we must delete + re-emit the
roof. For houses with dormers hosted on the roof (alpha + gamma), we
capture the dormer params first, delete dormers + roof, re-emit roof
with materialKey, then re-emit the dormers on the new roof.

Material chosen: `roof_tile_terracotta` (base #7d3424 — dark red, matches
the "Frankfurter Pfanne" clay-tile read source PDFs show on alpha + gamma;
matches the brown that iter-12 alpha already used inadvertently).

Idempotency: keyed on a stable suffix per house. If the iter-15 roof is
already present (id ends with `-iter15-tiled`), the script skips.

Run from repo root:  python3 scripts/testhouse_iter15b_roof_material.py
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

ROOF_MATERIAL_KEY = "roof_tile_terracotta"

# Per-house: (old roof id, new roof id, slopeDeg, overhangMm, referenceLevelId, geometry, ridge axis hint via footprint)
HOUSES_ROOF = {
    "alpha": {
        "old_id": "iter12-alpha-roof-doppelhaus",
        "new_id": "iter15-alpha-roof-tiled",
        "slope_deg": 48.0,
        "overhang_mm": 800.0,
        "ref_level": "lvl-dg",
        "geometry": "gable_pitched_rectangle",
        # footprint matches iter-12 doppelhaus: -9935..+9935 × 0..8100
        "footprint": [
            {"xMm": -9935.0, "yMm": 0.0},
            {"xMm":  9935.0, "yMm": 0.0},
            {"xMm":  9935.0, "yMm": 8100.0},
            {"xMm": -9935.0, "yMm": 8100.0},
        ],
    },
    "beta": {
        "old_id": "roof-house-beta-v9",
        "new_id": "iter15-beta-roof-tiled",
        "slope_deg": 42.0,  # bumped from iter-9's 35° per iter-14 subagent
        "overhang_mm": 500.0,  # bumped from iter-9's 800 to match source rake
        "ref_level": "lvl-dg",
        "geometry": "gable_pitched_rectangle",
        "footprint": [
            {"xMm": 0.0,    "yMm": 0.0},
            {"xMm": 9864.0, "yMm": 0.0},
            {"xMm": 9864.0, "yMm": 8984.0},
            {"xMm": 0.0,    "yMm": 8984.0},
        ],
    },
    "gamma": {
        "old_id": "iter9-gamma-roof-main",
        "new_id": "iter15-gamma-roof-tiled",
        "slope_deg": 45.0,
        "overhang_mm": 400.0,
        "ref_level": "lvl-dg",
        "geometry": "gable_pitched_rectangle",
        # gamma footprint (chamfered — but createRoof on the chamfered
        # polygon may reject under gable_pitched_rectangle; fall back to
        # the bounding rectangle here, matching iter-9's authored shape).
        "footprint": [
            {"xMm": 0.0,     "yMm": 0.0},
            {"xMm": 18000.0, "yMm": 0.0},
            {"xMm": 18000.0, "yMm": 8000.0},
            {"xMm": 0.0,     "yMm": 8000.0},
        ],
    },
}


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def find_element(snapshot: dict[str, Any], element_id: str) -> dict[str, Any] | None:
    for e in (snapshot.get("elements") or {}).values():
        if isinstance(e, dict) and e.get("id") == element_id:
            return e
    return None


def collect_dormers_on(snapshot: dict[str, Any], roof_id: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict) or e.get("kind") != "dormer":
            continue
        if str(e.get("hostRoofId")) != roof_id:
            continue
        out.append(e)
    return out


def dormer_to_cmd(dormer: dict[str, Any], new_host_roof_id: str) -> dict[str, Any]:
    pos = dormer.get("positionOnRoof") or {}
    cmd = {
        "type": "createDormer",
        "id": dormer.get("id"),
        "name": dormer.get("name"),
        "hostRoofId": new_host_roof_id,
        "positionOnRoof": {
            "alongRidgeMm": float(pos.get("alongRidgeMm", 0)),
            "acrossRidgeMm": float(pos.get("acrossRidgeMm", 0)),
        },
        "widthMm": float(dormer.get("widthMm", 1800)),
        "wallHeightMm": float(dormer.get("wallHeightMm", 1200)),
        "depthMm": float(dormer.get("depthMm", 1800)),
        "dormerRoofKind": dormer.get("dormerRoofKind") or "shed",
    }
    if dormer.get("dormerRoofPitchDeg") is not None:
        cmd["dormerRoofPitchDeg"] = float(dormer.get("dormerRoofPitchDeg"))
    if dormer.get("ridgeHeightMm") is not None:
        cmd["ridgeHeightMm"] = float(dormer.get("ridgeHeightMm"))
    return cmd


def replace_house_roof(house: str) -> dict[str, Any]:
    spec = HOUSES_ROOF[house]
    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)

    if find_element(snapshot, spec["new_id"]):
        return {"house": house, "skipped": "already replaced"}

    old_roof = find_element(snapshot, spec["old_id"])
    dormers: list[dict[str, Any]] = []
    cmds: list[dict[str, Any]] = []

    if old_roof:
        dormers = collect_dormers_on(snapshot, spec["old_id"])
        # 1. Delete dormers
        for d in dormers:
            cmds.append({"type": "deleteElement", "elementId": d.get("id")})
        # 2. Delete roof
        cmds.append({"type": "deleteElement", "elementId": spec["old_id"]})

    # 3. Create new roof with material baked in
    cmds.append({
        "type": "createRoof",
        "id": spec["new_id"],
        "name": f"Gable roof house-{house} (iter15 tiled, slope {int(spec['slope_deg'])}°, overhang {int(spec['overhang_mm'])} mm)",
        "referenceLevelId": spec["ref_level"],
        "footprintMm": spec["footprint"],
        "overhangMm": spec["overhang_mm"],
        "slopeDeg": spec["slope_deg"],
        "roofGeometryMode": spec["geometry"],
        "materialKey": ROOF_MATERIAL_KEY,
    })

    # 4. Re-emit dormers (with new ids prefixed iter15- so re-runs are idempotent)
    for d in dormers:
        dcmd = dormer_to_cmd(d, spec["new_id"])
        old_id = dcmd["id"]
        new_id = f"iter15-{house}-dormer-{old_id.split('-')[-1] if '-' in old_id else old_id}"
        # Avoid collision: append unique suffix if needed.
        suffix = 1
        while find_element(snapshot, new_id):
            new_id = f"iter15-{house}-dormer-{suffix}-{old_id.split('-')[-1] if '-' in old_id else old_id}"
            suffix += 1
        dcmd["id"] = new_id
        cmds.append(dcmd)

    normalized, records = normalize_bundle(cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type"), "id": cmd.get("id")}
        if resp.get("error"):
            entry["status"] = "http_error"; entry["body"] = resp.get("body"); failed += 1
        elif resp.get("applied"):
            rev = int(resp.get("newRevision") or rev + 1)
            entry["status"] = "applied"; entry["newRevision"] = rev; applied += 1
        else:
            entry["status"] = "rejected"
            entry["violations"] = resp.get("violations") or resp.get("result", {}).get("violations")
            failed += 1
        per_command.append(entry)

    return {
        "house": house, "modelId": model_id,
        "dormersPreserved": len(dormers),
        "applied": applied, "failed": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }


def main() -> None:
    overall: dict[str, Any] = {}
    for house in HOUSES_ROOF:
        result = replace_house_roof(house)
        overall[house] = {k: v for k, v in result.items() if k != "perCommand"}
        print(
            f"=== {house} ===\n"
            f"  dormers preserved: {result.get('dormersPreserved', '?')}\n"
            f"  applied:           {result.get('applied')}\n"
            f"  failed:            {result.get('failed')}\n"
            f"  rev:               {result.get('finalRevision')}"
        )
        for entry in (result.get("perCommand") or []):
            if entry["status"] != "applied":
                v = entry.get("violations") or entry.get("body") or []
                if isinstance(v, list):
                    err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                    for vi in err[:1]:
                        print(f"    ✗ [{entry['i']}] {entry.get('type')} id={entry.get('id','?')[:36]} rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / "iter-15b-roof-material-apply.json"
    out_path.write_text(json.dumps(overall, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
