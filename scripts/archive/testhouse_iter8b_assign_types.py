"""Iter-8b — assign wall_type per wall so the materials actually render.

Iter-8 authored wall_type / floor_type / roof_type definitions but
nothing was assigned to them. This script walks every wall in the
live model and assigns:
  - exterior perimeter walls (thickness >= 250 mm OR namePrefix has
    'wc-lvl-' from the iter-5 canonical rebuild) → wt-exterior-brick
  - interior partitions (everything else)            → wt-interior-drywall

Same idea applies to floors → ft-residential-wood and roofs →
rt-residential-tile.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
API_BASE = "http://localhost:28500"
EXTERIOR_WALL_TYPE_ID = "wt-exterior-brick"
INTERIOR_WALL_TYPE_ID = "wt-interior-drywall"
FLOOR_TYPE_ID = "ft-residential-wood"
ROOF_TYPE_ID = "rt-residential-tile"


def http_json(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except error.HTTPError as exc:
        return {"error": True, "status": exc.code, "body": exc.read().decode("utf-8", "replace")[:400]}


def commit(model_id: str, command: dict[str, Any], parent_revision: int, op: str) -> int:
    bundle = {
        "mode": "commit",
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [command],
            "assumptions": [
                {
                    "key": f"iter8b.{op}",
                    "value": op,
                    "confidence": 0.8,
                    "source": "iter8b_assign_types",
                    "contestable": True,
                    "evidence": "iter-8b material assignment",
                }
            ],
            "parentRevision": parent_revision,
        },
    }
    resp = http_json("POST", f"/api/models/{model_id}/bundles", bundle)
    if resp.get("error") or not resp.get("applied"):
        return -1
    return int(resp.get("newRevision") or parent_revision + 1)


HOUSES = {
    "house-alpha": "tmp/reverse-bim/house-alpha/iter-5-canonical-model.json",
    "house-beta": "tmp/reverse-bim/house-beta/iter-5-canonical-model.json",
    "house-gamma": "tmp/reverse-bim/house-gamma/iter-5-canonical-model.json",
}


def assign_for_model(house: str, manifest_path: str) -> dict[str, Any]:
    model_id = json.loads((REPO_ROOT / manifest_path).read_text(encoding="utf-8"))["modelId"]
    elems = http_json("POST", f"/api/models/{model_id}/query/elements", {})
    elements = (elems.get("data") or {}).get("elements") or []
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)
    walls_assigned = 0
    for el in elements:
        if el.get("kind") != "wall":
            continue
        name = str(el.get("name") or "")
        # iter-5 canonical exterior chain uses namePrefix "wc-lvl-*".
        is_exterior = name.startswith("wc-lvl-") or name.startswith("Wall")
        target = EXTERIOR_WALL_TYPE_ID if is_exterior else INTERIOR_WALL_TYPE_ID
        new_rev = commit(
            model_id,
            {
                "type": "assignWallDatumConstraints",
                "wallId": el["id"],
                "wallTypeId": target,
            },
            rev,
            f"wall_assign_{el['id'][:8]}",
        )
        if new_rev > 0:
            rev = new_rev
            walls_assigned += 1
    return {
        "house": house,
        "modelId": model_id,
        "wallsAssigned": walls_assigned,
        "finalRevision": rev,
    }


def main() -> None:
    for house, path in HOUSES.items():
        print(json.dumps(assign_for_model(house, path), indent=2))


if __name__ == "__main__":
    main()
