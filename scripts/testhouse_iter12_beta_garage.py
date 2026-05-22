"""Iter-12 step 4 — beta garage 3-wall rewrite.

The iter-9 beta corrector authored 4 garage walls as a closed rectangle,
but iter-10 rejected the wallChain because the western segment overlapped
the existing house east wall (`wall_overlap`), AND the chain dispatcher
doesn't propagate `allowDetached` to the resulting WallElem so the kernel's
`physical_wall_outside_envelope` error fired too.

The garage slab + flat roof DID apply in iter-9 (perCommand[5]+[6]), so the
visual gap is: garage reads as a low parapet (slab + flat top, no vertical
walls in between). The iter-11 subagent named this as the largest beta gap.

This script closes the gap by emitting 3 individual `createWall` commands
(skipping `garage-wall-w` since the house east wall at x=9864 already
serves as the party wall) with `allowDetached: true` — same kernel-flag
trick that landed the alpha doppelhaus west-half walls.

Run from repo root:  python3 scripts/testhouse_iter12_beta_garage.py
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

# Beta's house east wall is at x=9864 (per iter-5 canonical-rebuild).
# Garage footprint from iter-9 corrector: x=9864..14600, y=2000..8000.
HOUSE_EAST_X_MM = 9864.0
GARAGE_EAST_X_MM = 14600.0
GARAGE_Y_MIN_MM = 2000.0
GARAGE_Y_MAX_MM = 8000.0
GARAGE_LEVEL = "lvl-eg"

WALL_THICKNESS_MM = 250.0
WALL_HEIGHT_MM = 2700.0       # per iter-12 handoff (vs iter-9's 2400)
WALL_BASE_OFFSET_MM = -600.0  # garage floor at GH 843.20 = -600 below EG ±0.00
WALL_TYPE_ID = "wt-exterior-brick"


def build_garage_walls() -> list[dict[str, Any]]:
    """3-segment U-shape (north, east, south) abutting the existing house
    east wall at x=HOUSE_EAST_X_MM. Skips the iter-9 'garage-wall-w' which
    overlapped the house east wall."""
    edges = [
        ("n", {"xMm": HOUSE_EAST_X_MM,   "yMm": GARAGE_Y_MAX_MM},
              {"xMm": GARAGE_EAST_X_MM,  "yMm": GARAGE_Y_MAX_MM}),
        ("e", {"xMm": GARAGE_EAST_X_MM,  "yMm": GARAGE_Y_MAX_MM},
              {"xMm": GARAGE_EAST_X_MM,  "yMm": GARAGE_Y_MIN_MM}),
        ("s", {"xMm": GARAGE_EAST_X_MM,  "yMm": GARAGE_Y_MIN_MM},
              {"xMm": HOUSE_EAST_X_MM,   "yMm": GARAGE_Y_MIN_MM}),
    ]
    out: list[dict[str, Any]] = []
    for side, start, end in edges:
        out.append({
            "type": "createWall",
            "id": f"iter12-beta-garage-wall-{side}",
            "name": f"iter12-beta-garage-wall-{side}",
            "levelId": GARAGE_LEVEL,
            "start": start,
            "end": end,
            "thicknessMm": WALL_THICKNESS_MM,
            "heightMm": WALL_HEIGHT_MM,
            "wallTypeId": WALL_TYPE_ID,
            "baseConstraintLevelId": GARAGE_LEVEL,
            "topConstraintLevelId": GARAGE_LEVEL,
            "baseConstraintOffsetMm": WALL_BASE_OFFSET_MM,
            "topConstraintOffsetMm": WALL_BASE_OFFSET_MM + WALL_HEIGHT_MM,
            "allowDetached": True,
            "authoringIntent": "garage-detached-volume-iter12",
        })
    return out


def garage_walls_present(snapshot: dict[str, Any]) -> bool:
    """True if at least one wall on lvl-eg has any endpoint with x > HOUSE_EAST_X_MM
    (= a garage-zone wall has been authored already)."""
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict) or e.get("kind") != "wall":
            continue
        if e.get("levelId") != GARAGE_LEVEL:
            continue
        s = e.get("start") or {}
        t = e.get("end") or {}
        if float(s.get("xMm", 0)) > HOUSE_EAST_X_MM + 1 or float(t.get("xMm", 0)) > HOUSE_EAST_X_MM + 1:
            return True
    return False


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)

    if garage_walls_present(snapshot):
        print(f"=== {HOUSE} ===  garage walls already present — nothing to do.")
        return

    commands = build_garage_walls()
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
