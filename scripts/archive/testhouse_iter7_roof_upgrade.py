"""Iter-7 roof upgrade.

The iter-5 canonical rebuild authored every roof as `mass_box`, which
renders as an ugly flat-top extrusion. Beta and alpha have rectangular
(axis-aligned) footprints, so they can use `gable_pitched_rectangle`
directly. Gamma has a SE chamfer (pentagon) so stays on mass_box for now.

This script:
  1. Deletes the existing mass_box roof on the iter-5 canonical models for
     beta and alpha.
  2. Authors a new createRoof with roofGeometryMode='gable_pitched_rectangle'
     and the per-house pitch (alpha 48°, beta 30°).

The result is a real-looking pitched gable roof in the 3D view.
"""

from __future__ import annotations

import json
import sys
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
        return {"error": True, "status": exc.code, "body": exc.read().decode("utf-8", "replace")[:800]}


HOUSE_SPECS = {
    "house-alpha": {
        "modelManifest": "tmp/reverse-bim/house-alpha/iter-5-canonical-model.json",
        "referenceLevel": "lvl-dg",
        # East half: 0 → 9935 mm × 0 → 8100 mm, axis-aligned rectangle.
        "footprint": [
            {"xMm": 0,    "yMm": 0},
            {"xMm": 9935, "yMm": 0},
            {"xMm": 9935, "yMm": 8100},
            {"xMm": 0,    "yMm": 8100},
        ],
        "slopeDeg": 48.0,
        "overhangMm": 500,
        "eaveHeightLeftMm": 5000,
        "eaveHeightRightMm": 5000,
    },
    "house-beta": {
        "modelManifest": "tmp/reverse-bim/house-beta/iter-5-canonical-model.json",
        "referenceLevel": "lvl-dg",
        # 9864 × 8984 axis-aligned rectangle.
        "footprint": [
            {"xMm": 0,    "yMm": 0},
            {"xMm": 9864, "yMm": 0},
            {"xMm": 9864, "yMm": 8984},
            {"xMm": 0,    "yMm": 8984},
        ],
        "slopeDeg": 30.0,
        "overhangMm": 600,
        "eaveHeightLeftMm": 1250,
        "eaveHeightRightMm": 1250,
    },
}


def commit(model_id: str, command: dict[str, Any], parent_revision: int, op: str) -> int:
    bundle = {
        "mode": "commit",
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [command],
            "assumptions": [
                {
                    "key": f"iter7.{op}.{command.get('id') or command.get('name') or op}",
                    "value": str(command.get("name") or command.get("type") or op),
                    "confidence": 0.85,
                    "source": "iter7_roof_upgrade",
                    "contestable": True,
                    "evidence": (
                        "Real pitched gable roof replacing the iter-5 mass_box "
                        "placeholder; per-house pitch + eave heights from "
                        "iter-1 roof facts."
                    ),
                }
            ],
            "parentRevision": parent_revision,
        },
    }
    resp = http_json("POST", f"/api/models/{model_id}/bundles", bundle)
    if resp.get("error") or not resp.get("applied"):
        raise RuntimeError(
            f"{op} commit failed: status={resp.get('status')} body={resp.get('body','')[:400]}"
        )
    return int(resp.get("newRevision") or parent_revision + 1)


def upgrade_roof(house: str, spec: dict[str, Any]) -> dict[str, Any]:
    manifest_path = REPO_ROOT / spec["modelManifest"]
    model_id = json.loads(manifest_path.read_text(encoding="utf-8"))["modelId"]
    elems = http_json("POST", f"/api/models/{model_id}/query/elements", {})
    existing_roofs = [
        e for e in (elems.get("data") or {}).get("elements") or []
        if e.get("kind") == "roof"
    ]
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)
    # Delete existing roofs.
    for roof in existing_roofs:
        rev = commit(
            model_id,
            {"type": "deleteElement", "elementId": str(roof.get("id"))},
            rev,
            "delete_old_roof",
        )
    # Create gable roof.
    rev = commit(
        model_id,
        {
            "type": "createRoof",
            "name": f"Gable Roof {house}",
            "referenceLevelId": spec["referenceLevel"],
            "footprintMm": spec["footprint"],
            "overhangMm": spec["overhangMm"],
            "slopeDeg": spec["slopeDeg"],
            "roofGeometryMode": "gable_pitched_rectangle",
            "eaveHeightLeftMm": spec["eaveHeightLeftMm"],
            "eaveHeightRightMm": spec["eaveHeightRightMm"],
        },
        rev,
        "create_gable_roof",
    )
    return {"house": house, "deletedRoofs": len(existing_roofs), "newRevision": rev}


def main() -> None:
    for house, spec in HOUSE_SPECS.items():
        result = upgrade_roof(house, spec)
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
