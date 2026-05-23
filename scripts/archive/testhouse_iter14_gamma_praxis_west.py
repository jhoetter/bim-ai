"""Iter-14 step 3 — move gamma Praxis cross-wing from eastern-leaning to
the WESTERN half + deepen for 5 clinical rooms + TERRASSE.

Iter-13 upsized the Praxis from 4×3 m to 8×3 m but kept x=8000..16000
(slightly east of center). Source EG plan page 2 places Praxis on the
WESTERN half of the building (x ≈ 0..9000). Subagent flagged this as
methodology gap #20 (re-grounding only ran on MOVED elements, not on
carry-forward positions).

Iter-14 fix:
  - Delete iter-13 Praxis walls (3 of them) + roof.
  - Re-emit at x=0..8000 (western half per source), y=-5000..0 (5 m deep
    to host 5 clinical rooms + TERRASSE per source). 4 walls this time
    (the eastern return is no longer at the building edge because the
    wing doesn't run to the east gable — closed rectangle).
  - Re-emit the perpendicular cross-gable roof at the new footprint.

The 4-wall closed rectangle vs iter-13's 3-wall U-shape: when the wing
abuts the main building, the main building's south wall (at y=0) acts
as the wing's north wall — 3 walls suffice. When the wing's east edge
is also inside the building (x=8000 is inside the 0..18000 main
footprint), the east edge doesn't share an existing wall, so it needs
its own. Same on the west edge if x=0 aligns with the main building's
west gable — that DOES share. So 3 walls: south, east-return, (west
shared with main). But we need to verify the alignment.

Decision: keep 3-wall U-shape with the EAST return at the new x=8000
and the WEST gable shared with the main building's west wall at x=0.

Run from repo root:  python3 scripts/testhouse_iter14_gamma_praxis_west.py
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

HOUSE = "gamma"
MODEL_MANIFEST = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{HOUSE}" / "iter-5-canonical-model.json"

WALL_TYPE_ID = "wt-exterior-brick"
THICKNESS_MM = 300.0
STORY_HEIGHT_MM = 2800.0

# New Praxis position — western half, deeper
WING_X_MIN = 0.0
WING_X_MAX = 8000.0
WING_Y_MIN = -5000.0
WING_Y_MAX = 0.0
WING_LEVEL = "lvl-eg"

ITER13_PRAXIS_IDS = [
    "iter13-gamma-praxis-roof",
    "iter13-gamma-praxis-south",
    "iter13-gamma-praxis-east_return",
    "iter13-gamma-praxis-west_return",
]


def existing_ids(snapshot: dict[str, Any]) -> set[str]:
    return {e.get("id") for e in (snapshot.get("elements") or {}).values() if isinstance(e, dict)}


def build_praxis_west() -> list[dict[str, Any]]:
    edges = [
        # West return — shared with main building's west wall at x=0; we still
        # emit it explicitly so the Praxis envelope is closed at the new SW corner.
        ("west_return",
         {"xMm": WING_X_MIN, "yMm": WING_Y_MAX},
         {"xMm": WING_X_MIN, "yMm": WING_Y_MIN}),
        ("south",
         {"xMm": WING_X_MIN, "yMm": WING_Y_MIN},
         {"xMm": WING_X_MAX, "yMm": WING_Y_MIN}),
        ("east_return",
         {"xMm": WING_X_MAX, "yMm": WING_Y_MIN},
         {"xMm": WING_X_MAX, "yMm": WING_Y_MAX}),
    ]
    cmds: list[dict[str, Any]] = []
    for side, start, end in edges:
        cmds.append({
            "type": "createWall",
            "id": f"iter14-gamma-praxis-{side}",
            "name": f"iter14-gamma-praxis-{side}",
            "levelId": WING_LEVEL,
            "start": start,
            "end": end,
            "thicknessMm": THICKNESS_MM,
            "heightMm": STORY_HEIGHT_MM,
            "wallTypeId": WALL_TYPE_ID,
            "allowDetached": True,
            "authoringIntent": "praxis-cross-wing-west-iter14",
        })
    cmds.append({
        "type": "createRoof",
        "id": "iter14-gamma-praxis-roof",
        "name": "Praxis cross-gable roof (iter14 — west half, 8×5m)",
        "referenceLevelId": WING_LEVEL,
        "footprintMm": [
            {"xMm": WING_X_MIN, "yMm": WING_Y_MIN},
            {"xMm": WING_X_MAX, "yMm": WING_Y_MIN},
            {"xMm": WING_X_MAX, "yMm": WING_Y_MAX},
            {"xMm": WING_X_MIN, "yMm": WING_Y_MAX},
        ],
        "overhangMm": 400.0,
        "slopeDeg": 45.0,
        "roofGeometryMode": "gable_pitched_rectangle",
    })
    return cmds


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)
    existing = existing_ids(snapshot)

    cmds: list[dict[str, Any]] = []
    plan: dict[str, Any] = {"deleted": [], "added": []}

    for eid in ITER13_PRAXIS_IDS:
        if eid in existing:
            cmds.append({"type": "deleteElement", "elementId": eid})
            plan["deleted"].append(eid)

    if "iter14-gamma-praxis-roof" not in existing:
        cmds.extend(build_praxis_west())
        plan["added"].append("praxis_west_8x5m")

    if not cmds:
        print(f"=== {HOUSE} ===  iter-14 Praxis already in place — nothing to do.")
        return

    normalized, records = normalize_bundle(cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type")}
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
        "house": HOUSE, "modelId": model_id, "plan": plan,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-14-{HOUSE}-praxis-west-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"=== {HOUSE} ===  applied {applied}/{applied + failed}  rev={rev}  details={out_path.relative_to(REPO_ROOT)}")
    print(f"  deleted: {plan['deleted']}")
    print(f"  added:   {plan['added']}")
    for entry in per_command:
        marker = "✓" if entry["status"] == "applied" else "✗"
        print(f"  [{entry['i']}] {marker} {entry['type']} -> {entry['status']}")
        if entry["status"] != "applied":
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list):
                for vi in v[:3]:
                    print(f"      sev={vi.get('severity')} rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
