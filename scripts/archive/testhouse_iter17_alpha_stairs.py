"""Iter-17 — author alpha stairs from the fact-ledger stair facts.

Alpha has 4 stair facts:
  - alpha-eg-stair (EG → DG, full west-half stair)
  - p02-stair-eg-dg-left (EG → DG, west half — same stair as above; the
    ledger has duplicate readers; we emit one)
  - p02-stair-eg-dg-right (EG → DG, east half)
  - (plus a 4th — likely KG → EG)

The east-half stair mirrors the west-half stair across the party wall
at x=0 (iter-12 doppelhaus convention).

CreateStairCmd schema: baseLevelId, topLevelId, runStartMm, runEndMm,
widthMm, riserMm, treadMm, shape.

We also mirror for iter-12's west half (negate x of run endpoints).

Run from repo root:  python3 scripts/testhouse_iter17_alpha_stairs.py
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

LEVEL_REMAP = {
    "alpha-level-kg": "lvl-kg",
    "alpha-level-eg": "lvl-eg",
    "alpha-level-dg": "lvl-dg",
    "KG": "lvl-kg",
    "EG": "lvl-eg",
    "DG": "lvl-dg",
}


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def main() -> None:
    model_id = model_id_for(HOUSE)
    snapshot = query_snapshot(model_id)
    existing_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict)
    }

    ledger = json.loads(
        (REPO_ROOT / "tmp/reverse-bim/house-alpha/understanding/source-fact-ledger.json")
        .read_text(encoding="utf-8")
    )
    stair_facts = [f for f in ledger.get("facts", []) if f.get("kind") == "stair"]

    cmds: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for f in stair_facts:
        v = f.get("value") or {}
        base = LEVEL_REMAP.get(v.get("baseLevelId") or v.get("fromLevelId"))
        top = LEVEL_REMAP.get(v.get("topLevelId") or v.get("toLevelId"))
        runs = v.get("runs") or []
        if not isinstance(runs, list):
            continue
        if not (base and top and runs):
            continue
        for r in runs:
            start = r.get("startPosition") or {}
            end = r.get("endPosition") or {}
            sx = start.get("xMm", start.get("x_mm"))
            sy = start.get("yMm", start.get("y_mm"))
            ex = end.get("xMm", end.get("x_mm"))
            ey = end.get("yMm", end.get("y_mm"))
            if None in (sx, sy, ex, ey):
                continue
            key = (base, top, f"{sx},{sy}->{ex},{ey}")
            if key in seen:
                continue
            seen.add(key)
            # East-half emission (use ledger coords as-is)
            east_id = f"iter17-alpha-stair-east-{base[-2:]}-{top[-2:]}-{int(sx)}-{int(sy)}"
            if east_id not in existing_ids:
                cmds.append({
                    "type": "createStair",
                    "id": east_id,
                    "name": f"Stair {base}→{top} east half",
                    "baseLevelId": base,
                    "topLevelId": top,
                    "runStartMm": {"xMm": float(sx), "yMm": float(sy)},
                    "runEndMm": {"xMm": float(ex), "yMm": float(ey)},
                    "widthMm": float(r.get("widthMm", 900)),
                    "riserMm": float(r.get("riserMm", 193)),
                    "treadMm": float(r.get("treadMm", 240)),
                    "shape": "straight",
                })
            # West-half mirror
            west_id = f"iter17-alpha-stair-west-{base[-2:]}-{top[-2:]}-{int(sx)}-{int(sy)}"
            if west_id not in existing_ids:
                cmds.append({
                    "type": "createStair",
                    "id": west_id,
                    "name": f"Stair {base}→{top} west half",
                    "baseLevelId": base,
                    "topLevelId": top,
                    "runStartMm": {"xMm": -float(sx), "yMm": float(sy)},
                    "runEndMm": {"xMm": -float(ex), "yMm": float(ey)},
                    "widthMm": float(r.get("widthMm", 900)),
                    "riserMm": float(r.get("riserMm", 193)),
                    "treadMm": float(r.get("treadMm", 240)),
                    "shape": "straight",
                })

    if not cmds:
        print("no stair commands to emit")
        return

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

    result = {
        "house": HOUSE, "modelId": model_id,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-17-{HOUSE}-stairs-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"=== {HOUSE} stairs === applied {applied}/{applied + failed}  rev={rev}")
    for entry in per_command:
        marker = "✓" if entry["status"] == "applied" else "✗"
        print(f"  [{entry['i']}] {marker} {entry['id'][:50]} -> {entry['status']}")
        if entry["status"] != "applied":
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list):
                err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                for vi in err[:1]:
                    print(f"      rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
