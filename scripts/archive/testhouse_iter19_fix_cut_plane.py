"""Iter-19 — fix plan-view cut planes so KG captures aren't blank.

Iter-17 alpha subagent: `alpha-plan-kg-{crop,full}.png` are byte-identical
13 852-byte blank PNGs because the plan_view's default `cut_plane_offset_mm`
is -500 (BELOW the level), and KG sits at z=-2750, so the cut plane is at
z=-3250 — below the KG floor itself, showing nothing.

Standard architectural plan convention: cut plane is at +1200 mm above
floor (window-sill height) so walls + windows cut in section. Set
cutPlaneOffsetMm = +1200 on every plan_view across all 3 houses via
updateElementProperty.

Run from repo root:  python3 scripts/testhouse_iter19_fix_cut_plane.py
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
CUT_PLANE_OFFSET_MM = 1200.0


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
    cmds = [
        {"type": "updateElementProperty", "elementId": pv.get("id"),
         "key": "cutPlaneOffsetMm", "value": str(CUT_PLANE_OFFSET_MM)}
        for pv in plan_views
    ]
    if not cmds:
        return {"house": house, "applied": 0}

    normalized, _ = normalize_bundle(cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    applied = failed = 0
    per_command = []
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        if resp.get("applied"):
            rev = int(resp.get("newRevision") or rev + 1)
            applied += 1
            per_command.append({"i": i, "status": "applied"})
        else:
            failed += 1
            v = resp.get("violations") or resp.get("body") or []
            per_command.append({"i": i, "status": "failed", "v": v})
    return {"house": house, "applied": applied, "failed": failed, "rev": rev, "perCommand": per_command}


def main() -> None:
    for house in HOUSES:
        r = fix_house(house)
        print(f"=== {house} === applied {r.get('applied')}/{r.get('applied', 0) + r.get('failed', 0)} rev={r.get('rev','-')}")
        for entry in (r.get("perCommand") or [])[:3]:
            if entry["status"] != "applied":
                v = entry.get("v") or []
                if isinstance(v, list):
                    for vi in v[:1]:
                        print(f"  ✗ rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
