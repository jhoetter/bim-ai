"""Iter-13 carryover 3 — re-ground iter-12 gamma additions against source.

The iter-12 gamma typology script placed three sub-bundles based on the
iter-11 written recommendation; the iter-12 scoring subagent flagged two
of them as on the WRONG side per source:

  - Source EG page 2 labels CARPORT + ABSTELLRAUM at the EAST end of
    the building. iter-12 placed the carport on the west.
  - Source plans pp.1-5 annotate "GEPLANTE NACHBARLICHE BEBAUUNG" along
    the NORTH long facade (y > 8000). iter-12 placed the party-wall
    stub on the east gable.
  - The Praxis cross-wing was authored at 4 m × 3 m (token bay) but
    source shows ~half-of-EG with five clinical rooms, so iter-13 upsizes
    to 8 m × 3 m.

This script deletes the misplaced iter-12 elements and re-emits them
at the source-correct positions. New element ids use the `iter13-`
prefix so re-runs are idempotent.

Methodology #16 (corrector patches must re-ground against source each
iteration, not consume the previous written recommendation) — this
script is the first explicit acknowledgement of that gap.

Run from repo root:  python3 scripts/testhouse_iter13_gamma_reposition.py
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

# CARPORT — east end per source EG page 2.
CARPORT_X_MIN = 18000.0
CARPORT_X_MAX = 22000.0
CARPORT_Y_MIN = 2500.0
CARPORT_Y_MAX = 5500.0
CARPORT_HEIGHT_MM = 2700.0
CARPORT_LEVEL = "lvl-eg"

# PARTY WALL — north long facade per "GEPLANTE NACHBARLICHE BEBAUUNG"
# annotation on plans pp.1-5. Source plans show the neighboring construction
# along the entire long axis; we represent that with a long wall 500 mm
# north of the existing north facade (which is at y=8000).
PARTY_WALL_Y = 8500.0
PARTY_WALL_X_MIN = 0.0
PARTY_WALL_X_MAX = 18000.0
PARTY_WALL_HEIGHT_MM = 5500.0  # spans EG + OG so it's visible from far

# PRAXIS WING — upsized from 4×3 to 8×3 (source ~half-of-EG with 5 clinical rooms).
WING_X_MIN = 8000.0
WING_X_MAX = 16000.0
WING_Y_MIN = -3000.0
WING_Y_MAX = 0.0
WING_LEVEL = "lvl-eg"


ITER12_IDS_TO_DELETE = [
    "iter12-gamma-praxis-roof",
    "iter12-gamma-carport-roof",
    "iter12-gamma-praxis-south",
    "iter12-gamma-praxis-east_return",
    "iter12-gamma-praxis-west_return",
    "iter12-gamma-carport-north",
    "iter12-gamma-carport-south",
    "iter12-gamma-party-wall-stub",
    "iter12-gamma-party-wall-tie",
]


def build_praxis_wing() -> list[dict[str, Any]]:
    edges = [
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
            "id": f"iter13-gamma-praxis-{side}",
            "name": f"iter13-gamma-praxis-{side}",
            "levelId": WING_LEVEL,
            "start": start,
            "end": end,
            "thicknessMm": THICKNESS_MM,
            "heightMm": STORY_HEIGHT_MM,
            "wallTypeId": WALL_TYPE_ID,
            "allowDetached": True,
            "authoringIntent": "praxis-cross-wing-iter13-upsized",
        })
    cmds.append({
        "type": "createRoof",
        "id": "iter13-gamma-praxis-roof",
        "name": "Praxis cross-gable roof (iter13 — upsized)",
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


def build_carport() -> list[dict[str, Any]]:
    """East end, 2 walls + flat roof, open east/west."""
    edges = [
        ("north",
         {"xMm": CARPORT_X_MIN, "yMm": CARPORT_Y_MAX},
         {"xMm": CARPORT_X_MAX, "yMm": CARPORT_Y_MAX}),
        ("south",
         {"xMm": CARPORT_X_MIN, "yMm": CARPORT_Y_MIN},
         {"xMm": CARPORT_X_MAX, "yMm": CARPORT_Y_MIN}),
    ]
    cmds: list[dict[str, Any]] = []
    for side, start, end in edges:
        cmds.append({
            "type": "createWall",
            "id": f"iter13-gamma-carport-{side}",
            "name": f"iter13-gamma-carport-{side}",
            "levelId": CARPORT_LEVEL,
            "start": start,
            "end": end,
            "thicknessMm": 200.0,
            "heightMm": CARPORT_HEIGHT_MM,
            "wallTypeId": WALL_TYPE_ID,
            "allowDetached": True,
            "authoringIntent": "carport-east-iter13",
        })
    cmds.append({
        "type": "createRoof",
        "id": "iter13-gamma-carport-roof",
        "name": "Carport flat roof (iter13 — east end)",
        "referenceLevelId": CARPORT_LEVEL,
        "footprintMm": [
            {"xMm": CARPORT_X_MIN, "yMm": CARPORT_Y_MIN},
            {"xMm": CARPORT_X_MAX, "yMm": CARPORT_Y_MIN},
            {"xMm": CARPORT_X_MAX, "yMm": CARPORT_Y_MAX},
            {"xMm": CARPORT_X_MIN, "yMm": CARPORT_Y_MAX},
        ],
        "overhangMm": 300.0,
        "slopeDeg": 2.0,
        "roofGeometryMode": "mass_box",
    })
    return cmds


def build_north_party_wall() -> list[dict[str, Any]]:
    """Long wall on the north long facade, 500 mm offset from the building's
    north edge, to indicate the planned neighbouring construction."""
    return [{
        "type": "createWall",
        "id": "iter13-gamma-party-wall-north",
        "name": "iter13-gamma-party-wall-north",
        "levelId": "lvl-eg",
        "start": {"xMm": PARTY_WALL_X_MIN, "yMm": PARTY_WALL_Y},
        "end":   {"xMm": PARTY_WALL_X_MAX, "yMm": PARTY_WALL_Y},
        "thicknessMm": 300.0,
        "heightMm": PARTY_WALL_HEIGHT_MM,
        "wallTypeId": WALL_TYPE_ID,
        "allowDetached": True,
        "authoringIntent": "geplante-nachbarliche-bebauung-iter13",
    }]


def build_bundle(snapshot: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    elements = snapshot.get("elements") or {}
    existing_ids = {e.get("id") for e in elements.values() if isinstance(e, dict)}

    cmds: list[dict[str, Any]] = []
    plan: dict[str, Any] = {"deleted": [], "added": []}

    # 1. Delete iter-12 misplaced elements.
    for eid in ITER12_IDS_TO_DELETE:
        if eid in existing_ids:
            cmds.append({"type": "deleteElement", "elementId": eid})
            plan["deleted"].append(eid)

    # 2. Re-emit at source-correct positions.
    if "iter13-gamma-praxis-roof" not in existing_ids:
        cmds.extend(build_praxis_wing())
        plan["added"].append("praxis_wing_upsized")
    if "iter13-gamma-carport-roof" not in existing_ids:
        cmds.extend(build_carport())
        plan["added"].append("carport_east")
    if "iter13-gamma-party-wall-north" not in existing_ids:
        cmds.extend(build_north_party_wall())
        plan["added"].append("party_wall_north")

    return cmds, plan


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)
    commands, plan = build_bundle(snapshot)
    if not commands:
        print(f"=== {HOUSE} ===  nothing to do — iter-13 elements already authored.")
        return

    normalized, records = normalize_bundle(commands)
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
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-13-{HOUSE}-reposition-apply.json"
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
