"""Iter-18 — extend alpha floors to the full doppelhaus footprint.

Iter-17 alpha west-half stair was rejected `physical_stair_without_floor_landings`
because the iter-5 floors only span 0..9935 (east half). Extending floors
to -9935..+9935 × 0..8100 unblocks the west-half stair and gives the
doppelhaus a continuous slab.

Approach: delete + recreate floors with the full footprint + allowDetached
flag in case the floor extends past some pre-existing wall envelope.

Run from repo root:  python3 scripts/testhouse_iter18_alpha_floors.py
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

FULL_FOOTPRINT = [
    {"xMm": -9935.0, "yMm": 0.0},
    {"xMm":  9935.0, "yMm": 0.0},
    {"xMm":  9935.0, "yMm": 8100.0},
    {"xMm": -9935.0, "yMm": 8100.0},
]


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def main() -> None:
    model_id = model_id_for(HOUSE)
    snapshot = query_snapshot(model_id)
    floors = [
        e for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") == "floor"
    ]
    print(f"alpha floors before: {len(floors)}")

    cmds: list[dict[str, Any]] = []
    new_ids: dict[str, str] = {}
    for f in floors:
        old_id = f.get("id")
        level = f.get("levelId")
        new_id = f"iter18-alpha-floor-{level.replace('lvl-', '')}"
        new_ids[old_id] = new_id
        cmds.append({"type": "deleteElement", "elementId": old_id})
        cmds.append({
            "type": "createFloor",
            "id": new_id,
            "name": f"Floor {level} (iter18 full doppelhaus)",
            "levelId": level,
            "boundaryMm": FULL_FOOTPRINT,
            "thicknessMm": float(f.get("thicknessMm", 220)),
            "structureThicknessMm": float(f.get("structureThicknessMm", 140)),
            "finishThicknessMm": float(f.get("finishThicknessMm", 0)),
            "floorTypeId": f.get("floorTypeId"),
            "allowDetached": True,
            "physicalRole": f.get("physicalRole") or "slab",
        })

    if not cmds:
        print("no floors to extend")
        return

    normalized, records = normalize_bundle(cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type"), "id": cmd.get("id") or cmd.get("elementId")}
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

    result = {
        "house": HOUSE, "modelId": model_id,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "perCommand": per_command,
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-18-{HOUSE}-floors-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"=== {HOUSE} floors === applied {applied}/{applied + failed}  rev={rev}")
    for entry in per_command[:10]:
        marker = "✓" if entry["status"] == "applied" else "✗"
        print(f"  [{entry['i']}] {marker} {entry['type']} {entry.get('id','?')[:40]} -> {entry['status']}")
        if entry["status"] != "applied":
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list):
                err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                for vi in err[:1]:
                    print(f"      rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
