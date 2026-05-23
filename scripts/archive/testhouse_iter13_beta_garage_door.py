"""Iter-13 carryover 2 — punch a garage door on the beta garage east face.

Iter-12 added 3 garage perimeter walls (north, east, south) sharing the
house east wall as the party wall. The iter-12 visual-diff subagent
flagged the absence of a garage door as the iter-12-introduced
regression — the garage now reads as "a hermetically sealed concrete
box".

Source elevation (page 5 OSTEN) shows the garage door on the east face
of the garage. We punch a 2400×2100 door at alongT≈0.5 on wall id
`iter12-beta-garage-wall-e`.

InsertDoorOnWallCmd only takes wallId/alongT/widthMm (the door sill is
at the level base — no height/sill field). The garage east wall sits on
lvl-eg with baseConstraintOffsetMm=-600, so the door auto-grounds to the
garage floor.

Run from repo root:  python3 scripts/testhouse_iter13_beta_garage_door.py
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

HOUSE = "beta"
MODEL_MANIFEST = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{HOUSE}" / "iter-5-canonical-model.json"

GARAGE_EAST_WALL_ID = "iter12-beta-garage-wall-e"
DOOR_ID = "iter13-beta-garage-door-east"


def already_authored(snapshot: dict[str, Any], elem_id: str) -> bool:
    elements = snapshot.get("elements") or {}
    return any(
        isinstance(e, dict) and e.get("id") == elem_id
        for e in elements.values()
    )


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)
    if already_authored(snapshot, DOOR_ID):
        print(f"=== {HOUSE} ===  garage door already authored — nothing to do.")
        return
    if not already_authored(snapshot, GARAGE_EAST_WALL_ID):
        print(f"=== {HOUSE} ===  cannot find garage east wall '{GARAGE_EAST_WALL_ID}' — aborting.")
        sys.exit(1)

    commands = [{
        "type": "insertDoorOnWall",
        "id": DOOR_ID,
        "name": "Garage door (east face) — iter13",
        "wallId": GARAGE_EAST_WALL_ID,
        "alongT": 0.5,
        "widthMm": 2400,
    }]
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
        "house": HOUSE, "modelId": model_id,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-13-{HOUSE}-garage-door-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"=== {HOUSE} ===  applied {applied}/{applied + failed}  rev={rev}  details={out_path.relative_to(REPO_ROOT)}")
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
