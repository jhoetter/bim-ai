"""Iter-12 step 3 — gamma typology rewrites.

Gamma is a "Doppelhaushälfte" with a "Wohn- und Praxisgebäude mit Carport"
(per the iter-12 title-block parser output and the iter-1 fact ledger). Yet
the iter-10 model is a freestanding solo volume — no Praxis cross-wing, no
carport, no party-wall annotation. This was the single biggest visual gap
named by the iter-11 subagent.

This script emits three sub-bundles to close the typology gap:

  (a) Praxis cross-wing — south-projecting bay at the east half of the
      south facade, single story (lvl-eg), 3 walls (south, east-return,
      west-return) + a perpendicular cross-gable roof (ridge along +y).

  (b) Carport — open-sided lean-to abutting the west gable, 2 walls
      (north + south edges only, leaving east and west open as required
      by a carport's pass-through use) + a flat slab roof.

  (c) Party-wall stub — 1 createWall projecting east of the east gable
      at mid-height, marking the planned neighboring construction
      indicated by the "GEPLANTE NACHBARLICHE BEBAUUNG" label on the
      gamma source plans.

All wall commands use `allowDetached: true` to bypass the
`physical_wall_outside_envelope` check (the iter-5 floors only cover the
main 18000×8000 building, so any new wall beyond that envelope must opt
out of the envelope rule — the same trick that landed alpha + beta in
this iter).

`createMassBox` is NOT a kernel command (per iter-10 methodology #2 —
the rewriter coerced it to `createDormer` in iter-9). We use `createWall`
+ `createRoof` to assemble actual volumes for the Praxis wing and the
carport instead.

Run from repo root:  python3 scripts/testhouse_iter12_gamma_typology.py
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

# Gamma footprint per iter-5 canonical-rebuild: 0..18000 × 0..8000 with
# SE chamfer at (17045, 8000) — see the rebuild script for the polygon.
BUILD_X_MAX = 18000.0
BUILD_Y_MAX = 8000.0
WALL_TYPE_ID = "wt-exterior-brick"
THICKNESS_MM = 300.0
STORY_HEIGHT_MM = 2800.0

# Praxis wing — south-projecting bay at east half of south facade.
WING_X_MIN = 12000.0
WING_X_MAX = 16000.0
WING_Y_MIN = -3000.0   # projects 3 m south of main facade (y=0)
WING_Y_MAX = 0.0
WING_LEVEL = "lvl-eg"

# Carport — west of west gable, open east/west, walls on north + south edges.
CARPORT_X_MIN = -4000.0
CARPORT_X_MAX = 0.0
CARPORT_Y_MIN = 2500.0
CARPORT_Y_MAX = 5500.0
CARPORT_HEIGHT_MM = 2700.0
CARPORT_LEVEL = "lvl-eg"

# Party-wall stub — projects east of the east gable to indicate the
# adjoining Doppelhaushälfte that the source plans call "GEPLANTE
# NACHBARLICHE BEBAUUNG".
PARTY_WALL_X_FROM = 18000.0
PARTY_WALL_X_TO = 18800.0
PARTY_WALL_Y_MIN = 2000.0
PARTY_WALL_Y_MAX = 6000.0
PARTY_WALL_HEIGHT_MM = 5500.0  # spans EG + OG so it's visible from far


def build_praxis_wing() -> list[dict[str, Any]]:
    """3 walls forming the south-projecting U + 1 perpendicular cross-gable roof."""
    cmds: list[dict[str, Any]] = []
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
    for side, start, end in edges:
        cmds.append({
            "type": "createWall",
            "id": f"iter12-gamma-praxis-{side}",
            "name": f"iter12-gamma-praxis-{side}",
            "levelId": WING_LEVEL,
            "start": start,
            "end": end,
            "thicknessMm": THICKNESS_MM,
            "heightMm": STORY_HEIGHT_MM,
            "wallTypeId": WALL_TYPE_ID,
            "allowDetached": True,
            "authoringIntent": "praxis-cross-wing-iter12",
        })
    cmds.append({
        "type": "createRoof",
        "id": "iter12-gamma-praxis-roof",
        "name": "Praxis cross-gable roof (iter12)",
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
    """2 walls (north + south edges) + a flat roof slab via createRoof.
    East + west sides intentionally left open — that's what makes it a carport.
    """
    cmds: list[dict[str, Any]] = []
    edges = [
        ("north",
         {"xMm": CARPORT_X_MIN, "yMm": CARPORT_Y_MAX},
         {"xMm": CARPORT_X_MAX, "yMm": CARPORT_Y_MAX}),
        ("south",
         {"xMm": CARPORT_X_MIN, "yMm": CARPORT_Y_MIN},
         {"xMm": CARPORT_X_MAX, "yMm": CARPORT_Y_MIN}),
    ]
    for side, start, end in edges:
        cmds.append({
            "type": "createWall",
            "id": f"iter12-gamma-carport-{side}",
            "name": f"iter12-gamma-carport-{side}",
            "levelId": CARPORT_LEVEL,
            "start": start,
            "end": end,
            "thicknessMm": 200.0,
            "heightMm": CARPORT_HEIGHT_MM,
            "wallTypeId": WALL_TYPE_ID,
            "allowDetached": True,
            "authoringIntent": "carport-frame-iter12",
        })
    cmds.append({
        "type": "createRoof",
        "id": "iter12-gamma-carport-roof",
        "name": "Carport flat roof (iter12)",
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


def build_party_wall_stub() -> list[dict[str, Any]]:
    """Single freestanding wall just east of the east gable, indicating
    the planned neighboring construction."""
    return [{
        "type": "createWall",
        "id": "iter12-gamma-party-wall-stub",
        "name": "iter12-gamma-party-wall-stub",
        "levelId": "lvl-eg",
        "start": {"xMm": PARTY_WALL_X_TO, "yMm": PARTY_WALL_Y_MIN},
        "end":   {"xMm": PARTY_WALL_X_TO, "yMm": PARTY_WALL_Y_MAX},
        "thicknessMm": 300.0,
        "heightMm": PARTY_WALL_HEIGHT_MM,
        "wallTypeId": WALL_TYPE_ID,
        "allowDetached": True,
        "authoringIntent": "party-wall-stub-iter12",
    }, {
        # A short connector from the existing east gable to the stub,
        # so the stub doesn't float disconnected.
        "type": "createWall",
        "id": "iter12-gamma-party-wall-tie",
        "name": "iter12-gamma-party-wall-tie",
        "levelId": "lvl-eg",
        "start": {"xMm": PARTY_WALL_X_FROM, "yMm": (PARTY_WALL_Y_MIN + PARTY_WALL_Y_MAX) / 2},
        "end":   {"xMm": PARTY_WALL_X_TO,   "yMm": (PARTY_WALL_Y_MIN + PARTY_WALL_Y_MAX) / 2},
        "thicknessMm": 200.0,
        "heightMm": PARTY_WALL_HEIGHT_MM,
        "wallTypeId": WALL_TYPE_ID,
        "allowDetached": True,
        "authoringIntent": "party-wall-tie-iter12",
    }]


def already_authored(snapshot: dict[str, Any], id_prefix: str) -> bool:
    for e in (snapshot.get("elements") or {}).values():
        if isinstance(e, dict) and str(e.get("id", "")).startswith(id_prefix):
            return True
    return False


def build_bundle(snapshot: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    plan: dict[str, Any] = {"subBundles": []}
    cmds: list[dict[str, Any]] = []
    if not already_authored(snapshot, "iter12-gamma-praxis"):
        cmds.extend(build_praxis_wing())
        plan["subBundles"].append("praxis_wing")
    if not already_authored(snapshot, "iter12-gamma-carport"):
        cmds.extend(build_carport())
        plan["subBundles"].append("carport")
    if not already_authored(snapshot, "iter12-gamma-party-wall"):
        cmds.extend(build_party_wall_stub())
        plan["subBundles"].append("party_wall")
    return cmds, plan


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)
    commands, plan = build_bundle(snapshot)

    if not commands:
        print(f"=== {HOUSE} ===  all iter-12 elements already authored — nothing to do.")
        return

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
        "plan": plan,
        "appliedCount": applied,
        "failedCount": failed,
        "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
        "commandsEmitted": [{"i": i, "type": c.get("type"), "name": c.get("name")} for i, c in enumerate(commands)],
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-12-{HOUSE}-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        f"=== {HOUSE} ===\n"
        f"  subBundles:    {plan['subBundles']}\n"
        f"  applied:       {applied}\n"
        f"  failed:        {failed}\n"
        f"  finalRevision: {rev}\n"
        f"  details:       {out_path.relative_to(REPO_ROOT)}",
        flush=True,
    )
    for entry in per_command:
        marker = "✓" if entry["status"] == "applied" else "✗"
        print(f"  [{entry['i']}] {marker} {entry['type']:<18} -> {entry['status']}")
        if entry["status"] != "applied":
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list):
                for vi in v[:3]:
                    print(f"      sev={vi.get('severity')} rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
