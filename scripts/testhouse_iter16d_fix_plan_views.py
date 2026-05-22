"""Iter-16d — fix plan-view rendering to make iter-16 rooms visible.

All 3 iter-16 scoring subagents independently flagged the SAME bug: rooms
were authored cleanly into the model (alpha 36, beta 17, gamma 32) but
don't appear in plan-view captures because:

  1. `planShowRoomLabels` is False by default → room name labels don't
     render in plan view.

This script flips planShowRoomLabels=True for every plan_view across
all 3 houses, via `updateElementProperty`.

Run from repo root:  python3 scripts/testhouse_iter16d_fix_plan_views.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from testhouse_command_normalize import normalize_bundle  # noqa: E402
from testhouse_iter10_apply import commit_one, http_json, query_snapshot  # noqa: E402

HOUSES = ("alpha", "beta", "gamma")


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def fix_house(house: str) -> dict[str, Any]:
    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)

    plan_views = [
        e for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") == "plan_view"
    ]
    cmds: list[dict[str, Any]] = []
    for pv in plan_views:
        cmds.append({
            "type": "updateElementProperty",
            "elementId": pv.get("id"),
            "key": "planShowRoomLabels",
            "value": "true",
        })

    if not cmds:
        return {"house": house, "applied": 0, "note": "no plan views"}

    normalized, _ = normalize_bundle(cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    applied = failed = 0
    per_command = []
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type")}
        if resp.get("error"):
            entry["status"] = "http_error"; entry["body"] = resp.get("body"); failed += 1
        elif resp.get("applied"):
            rev = int(resp.get("newRevision") or rev + 1)
            entry["status"] = "applied"; applied += 1
        else:
            entry["status"] = "rejected"
            entry["violations"] = resp.get("violations") or resp.get("result", {}).get("violations")
            failed += 1
        per_command.append(entry)
    return {"house": house, "applied": applied, "failed": failed, "rev": rev, "perCommand": per_command}


def main() -> None:
    for house in HOUSES:
        r = fix_house(house)
        print(f"=== {house} === applied {r.get('applied')}/{r.get('applied', 0) + r.get('failed', 0)} rev={r.get('rev','-')}")
        for entry in (r.get("perCommand") or []):
            if entry["status"] != "applied":
                v = entry.get("violations") or entry.get("body") or []
                if isinstance(v, list):
                    err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                    for vi in err[:1]:
                        print(f"  ✗ rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
