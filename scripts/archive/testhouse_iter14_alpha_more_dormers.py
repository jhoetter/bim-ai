"""Iter-14 step 2 — emit 4 more Schleppgauben on alpha to reach the
source's 8 total (4 per slope).

Iter-13 emitted 4 dormers (2 per slope):
  Berg (across=+2200):  along=-7200, along=+2400
  Tal  (across=-2200):  along=-2400, along=+7200

Source `Ansichten.pdf` shows 4 per slope = 8 total. The missing positions
on each slope are the alternating set:
  Berg: along=-2400, along=+7200
  Tal:  along=-7200, along=+2400

Together with the iter-13 emissions, the resulting layout is 4 per slope
at the four equally-spaced positions {-7200, -2400, +2400, +7200} —
matching the source's regular bay rhythm.

Run from repo root:  python3 scripts/testhouse_iter14_alpha_more_dormers.py
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
HOST_ROOF_ID = "iter12-alpha-roof-doppelhaus"

WIDTH_MM = 1800.0
WALL_HEIGHT_MM = 1200.0
DEPTH_MM = 1800.0
PITCH_DEG = 20.0

MORE_DORMERS = [
    # (slug, alongRidgeMm, acrossRidgeMm, label)
    ("berg-c1",  -2400.0, +2200.0, "Berg (north) slope, center-west"),
    ("berg-c2",  +7200.0, +2200.0, "Berg (north) slope, east"),
    ("tal-c1",   -7200.0, -2200.0, "Tal (south) slope, west"),
    ("tal-c2",   +2400.0, -2200.0, "Tal (south) slope, center-east"),
]


def already_authored(snapshot: dict[str, Any], elem_id: str) -> bool:
    for e in (snapshot.get("elements") or {}).values():
        if isinstance(e, dict) and e.get("id") == elem_id:
            return True
    return False


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)

    commands: list[dict[str, Any]] = []
    for slug, along, across, label in MORE_DORMERS:
        elem_id = f"iter14-alpha-dormer-{slug}"
        if already_authored(snapshot, elem_id):
            continue
        commands.append({
            "type": "createDormer",
            "id": elem_id,
            "name": f"Schleppgaube — {label}",
            "hostRoofId": HOST_ROOF_ID,
            "positionOnRoof": {"alongRidgeMm": along, "acrossRidgeMm": across},
            "widthMm": WIDTH_MM,
            "wallHeightMm": WALL_HEIGHT_MM,
            "depthMm": DEPTH_MM,
            "dormerRoofKind": "shed",
            "dormerRoofPitchDeg": PITCH_DEG,
        })

    if not commands:
        print(f"=== {HOUSE} ===  iter-14 extra dormers already authored — nothing to do.")
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
        "house": HOUSE, "modelId": model_id, "hostRoofId": HOST_ROOF_ID,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-14-{HOUSE}-more-dormers-apply.json"
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
