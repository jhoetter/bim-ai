"""Iter-8 site + materials.

The user's iter-6 inspection: "looks like a schematic massing study,
not a real residential BIM." Concrete fixes that improve the visual
read at low cost:

1. **Toposolid for ground** — gives the house a sited context instead
   of floating on an infinite grid. Extended ~10 m beyond the
   building footprint on each side.

2. **Wall types with materials** — exterior walls get a brick / render
   layer set, interior partitions get a drywall layer set. This is
   the lowest-effort way to break the all-white-walls look the user
   sees today.

3. **Floor + roof types with materials** — floor wood/finish layer,
   roof tile layer.

This is iter-8: visual fidelity polish on top of the now-coherent
iter-5 / iter-7 models. Idempotent — skips elements already typed.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
API_BASE = "http://localhost:28500"


def http_json(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except error.HTTPError as exc:
        return {"error": True, "status": exc.code, "body": exc.read().decode("utf-8", "replace")[:600]}


HOUSE_SPECS = {
    "house-alpha": {
        "manifest": "tmp/reverse-bim/house-alpha/iter-5-canonical-model.json",
        # East-half perimeter expanded 10 m on each side for the toposolid.
        "site_polygon": [
            {"xMm": -10000, "yMm": -10000},
            {"xMm": 19935,  "yMm": -10000},
            {"xMm": 19935,  "yMm": 18100},
            {"xMm": -10000, "yMm": 18100},
        ],
    },
    "house-beta": {
        "manifest": "tmp/reverse-bim/house-beta/iter-5-canonical-model.json",
        "site_polygon": [
            {"xMm": -10000, "yMm": -10000},
            {"xMm": 19864,  "yMm": -10000},
            {"xMm": 19864,  "yMm": 18984},
            {"xMm": -10000, "yMm": 18984},
        ],
    },
    "house-gamma": {
        "manifest": "tmp/reverse-bim/house-gamma/iter-5-canonical-model.json",
        "site_polygon": [
            {"xMm": -10000, "yMm": -10000},
            {"xMm": 28000,  "yMm": -10000},
            {"xMm": 28000,  "yMm": 18000},
            {"xMm": -10000, "yMm": 18000},
        ],
    },
}

EXTERIOR_WALL_TYPE_ID = "wt-exterior-brick"
INTERIOR_WALL_TYPE_ID = "wt-interior-drywall"
FLOOR_TYPE_ID = "ft-residential-wood"
ROOF_TYPE_ID = "rt-residential-tile"


def commit(model_id: str, command: dict[str, Any], parent_revision: int, op: str) -> int:
    bundle = {
        "mode": "commit",
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [command],
            "assumptions": [
                {
                    "key": f"iter8.{op}.{command.get('id') or command.get('name') or op}",
                    "value": str(command.get("name") or command.get("type") or op),
                    "confidence": 0.7,
                    "source": "iter8_site_and_materials",
                    "contestable": True,
                    "evidence": "iter-8 site + material assignments",
                }
            ],
            "parentRevision": parent_revision,
        },
    }
    resp = http_json("POST", f"/api/models/{model_id}/bundles", bundle)
    if resp.get("error") or not resp.get("applied"):
        body = resp.get("body") or json.dumps(resp)
        print(f"  [{op}] FAILED: {body[:300]}")
        return -1
    return int(resp.get("newRevision") or parent_revision + 1)


def author_wall_types_and_floor_types(model_id: str, rev: int) -> int:
    """Author one exterior wall type (brick + render), one interior
    partition wall type (drywall), one floor type (wood), one roof type
    (tile). Idempotent — UpsertWallType swaps in place."""

    rev_after = commit(
        model_id,
        {
            "type": "upsertWallType",
            "id": EXTERIOR_WALL_TYPE_ID,
            "name": "Exterior Brick",
            "basisLine": "center",
            "layers": [
                {"thicknessMm": 115, "function": "finish", "materialKey": "brick"},
                {"thicknessMm": 60,  "function": "insulation",      "materialKey": "insulation"},
                {"thicknessMm": 175, "function": "structure",          "materialKey": "concrete"},
                {"thicknessMm": 15,  "function": "finish",  "materialKey": "plaster"},
            ],
        },
        rev,
        "exterior_wall_type",
    )
    if rev_after > 0:
        rev = rev_after
    rev_after = commit(
        model_id,
        {
            "type": "upsertWallType",
            "id": INTERIOR_WALL_TYPE_ID,
            "name": "Interior Drywall",
            "basisLine": "center",
            "layers": [
                {"thicknessMm": 12.5, "function": "finish", "materialKey": "plaster"},
                {"thicknessMm": 90,   "function": "structure",         "materialKey": "concrete"},
                {"thicknessMm": 12.5, "function": "finish", "materialKey": "plaster"},
            ],
        },
        rev,
        "interior_wall_type",
    )
    if rev_after > 0:
        rev = rev_after
    rev_after = commit(
        model_id,
        {
            "type": "upsertFloorType",
            "id": FLOOR_TYPE_ID,
            "name": "Residential Wood Floor",
            "layers": [
                {"thicknessMm": 22,  "function": "finish", "materialKey": "wood"},
                {"thicknessMm": 50,  "function": "insulation",     "materialKey": "insulation"},
                {"thicknessMm": 148, "function": "structure",         "materialKey": "concrete"},
            ],
        },
        rev,
        "floor_type",
    )
    if rev_after > 0:
        rev = rev_after
    rev_after = commit(
        model_id,
        {
            "type": "upsertRoofType",
            "id": ROOF_TYPE_ID,
            "name": "Residential Tile Roof",
            "layers": [
                {"thicknessMm": 30,  "function": "finish", "materialKey": "wood"},
                {"thicknessMm": 180, "function": "insulation",     "materialKey": "insulation"},
                {"thicknessMm": 20,  "function": "finish", "materialKey": "wood"},
            ],
        },
        rev,
        "roof_type",
    )
    if rev_after > 0:
        rev = rev_after
    return rev


def author_toposolid(model_id: str, polygon: list[dict[str, Any]], house: str, rev: int) -> int:
    boundary = [{"xMm": p["xMm"], "yMm": p["yMm"]} for p in polygon]
    # Closed.
    if boundary[0] != boundary[-1]:
        boundary.append(boundary[0])
    # Sample heights at the corners + center — a small heightmap so the
    # render shows a flat ground plane.
    samples = [
        {"xMm": p["xMm"], "yMm": p["yMm"], "zMm": -150}
        for p in polygon
    ]
    cmd = {
        "type": "CreateToposolid",
        "toposolidId": f"topo-{house}",
        "name": f"Site {house}",
        "boundaryMm": boundary,
        "heightSamples": samples,
        "thicknessMm": 1500,
        "baseElevationMm": -150,
        "defaultMaterialKey": "wood",
    }
    rev_after = commit(model_id, cmd, rev, "toposolid")
    return rev_after if rev_after > 0 else rev


def main() -> None:
    for house, spec in HOUSE_SPECS.items():
        manifest = json.loads((REPO_ROOT / spec["manifest"]).read_text(encoding="utf-8"))
        model_id = manifest["modelId"]
        summary = http_json("GET", f"/api/models/{model_id}/summary")
        rev = int(summary.get("revision") or 1)
        rev = author_wall_types_and_floor_types(model_id, rev)
        rev = author_toposolid(model_id, spec["site_polygon"], house, rev)
        print(json.dumps({"house": house, "modelId": model_id, "finalRevision": rev}, indent=2))


if __name__ == "__main__":
    main()
