"""Iter-13 carryover 1 — re-emit 4 Schleppgauben (shed dormers) on the
iter-12 alpha doppelhaus roof.

Iter-12 deleted the iter-9 dormers when it replaced the roof, because the
old hostRoofId pointed at the now-deleted iter-9 roof. The iter-12 plan
deferred the re-emit to iter-13. This script lands that — 4 dormers on
the new roof, 2 per slope, distributed along the 19.87 m ridge.

Positions (roof-local coordinates per iter-10 methodology #5 — the
`_recenter_bundle_dormer_positions` pre-flight only shifts if it detects
world-frame, so values clustered near 0 stay local):

  alongRidgeMm ∈ {-7200, -2400, +2400, +7200}  (4 equally-spaced along x)
  acrossRidgeMm = +2200 for Berg-slope (north), -2200 for Tal-slope (south)

Iter-9 used widthMm=1800, wallHeightMm=1200, depthMm=1800 (per the
iter-9 corrector emission for alpha that successfully landed). We re-use
those numbers.

Run from repo root:  python3 scripts/testhouse_iter13_alpha_dormers.py
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
PITCH_DEG = 20.0  # Schleppgaube shallow shed pitch

DORMERS = [
    # (slug, alongRidgeMm, acrossRidgeMm, slope_name)
    ("berg-w", -7200.0, +2200.0, "Berg (north) slope, west"),
    ("berg-e", +2400.0, +2200.0, "Berg (north) slope, east"),
    ("tal-w",  -2400.0, -2200.0, "Tal (south) slope, west"),
    ("tal-e",  +7200.0, -2200.0, "Tal (south) slope, east"),
]


def already_have_iter13_dormers(snapshot: dict[str, Any]) -> bool:
    for e in (snapshot.get("elements") or {}).values():
        if isinstance(e, dict) and str(e.get("id", "")).startswith("iter13-alpha-dormer-"):
            return True
    return False


def build_dormer(slug: str, along: float, across: float, label: str) -> dict[str, Any]:
    return {
        "type": "createDormer",
        "id": f"iter13-alpha-dormer-{slug}",
        "name": f"Schleppgaube — {label}",
        "hostRoofId": HOST_ROOF_ID,
        "positionOnRoof": {
            "alongRidgeMm": along,
            "acrossRidgeMm": across,
        },
        "widthMm": WIDTH_MM,
        "wallHeightMm": WALL_HEIGHT_MM,
        "depthMm": DEPTH_MM,
        "dormerRoofKind": "shed",
        "dormerRoofPitchDeg": PITCH_DEG,
    }


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)
    if already_have_iter13_dormers(snapshot):
        print(f"=== {HOUSE} ===  iter-13 dormers already authored — nothing to do.")
        return

    commands = [build_dormer(*d) for d in DORMERS]
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
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-13-{HOUSE}-dormers-apply.json"
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
