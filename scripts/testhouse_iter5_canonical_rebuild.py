"""Iter-5 canonical rebuild for testhouses alpha / beta / gamma.

The iter-3 + iter-4 convergence loop authored content but each subagent
used its own coordinate-frame convention. The result was a model that
passed the methodology's per-gate procedural checks while being
geometrically incoherent (alpha walls covering both Doppelhaus halves
but rooms placed only in one half-local frame; gamma upper storeys
rotated 90° relative to KG; gamma roof on the 2×6 m Spitzboden loft
instead of the 18×8 m building envelope).

This script rebuilds each house from scratch in ONE canonical
building frame per house, then re-emits plan views + a default 3D
viewpoint.

Canonical frames:

  house-alpha — east-half only. Origin SW of east half. Party wall at
                x=0 (west); east outer at x=9935 (east). y∈[0,8100].
                Levels KG/EG/DG (KG source_unavailable so authored
                from above-grade footprint).

  house-beta  — origin SW. x∈[0,9864], y∈[0,8984] for EG and DG; KG
                slightly smaller (9764 × 8984). Levels KG/EG/DG.

  house-gamma — canonical KG frame: 18000 × 8000 mm, long axis E-W.
                OG/DG/Spitzboden walls TRANSPOSED from their iter-3
                readings (which had long axis N-S) so all levels share
                the building's KG footprint orientation. Spitzboden
                attic loft authored as the enclosed area inside the
                roof, not the building envelope.

Rooms and openings authored in iter-3/iter-4 are NOT carried over —
they were placed in inconsistent local frames; iter-5 work would need
to normalise them before applying. They will be re-dispatched in a
future numeric reader pass with an explicit "use the building frame"
prompt.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
API_BASE = "http://localhost:28500"
SEED_PROJECT_ID = "892ee9f7-307c-5e40-a838-3bc64b5f5f92"


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


HOUSE_SPECS: dict[str, dict[str, Any]] = {
    "house-alpha": {
        "slug": "iter5-house-alpha",
        # East half of the 1956 Reinecke Doppelhaus.
        # Party wall at x=0 (west); east outer at x=9935 (east).
        "levels": [
            ("lvl-kg", "KG", -2750.0),
            ("lvl-eg", "EG", 0.0),
            ("lvl-dg", "DG", 2750.0),
        ],
        # Exterior perimeter of the east half (rectangle).
        "perimeter": [
            {"xMm": 0,    "yMm": 0},
            {"xMm": 9935, "yMm": 0},
            {"xMm": 9935, "yMm": 8100},
            {"xMm": 0,    "yMm": 8100},
        ],
        "wall_thickness": 365.0,
        "wall_height": 2750.0,
        # KG is source_unavailable for measurements; reuse EG perimeter
        # at the methodologically-documented "above-grade extrapolation"
        # disposition (the basement walls of a doppelhaus follow the
        # above-grade footprint).
        "kg_inherits_eg_perimeter": True,
        "roof": {
            "referenceLevel": "lvl-dg",
            "slopeDeg": 48.0,
            "overhangMm": 500,
            "eaveHeightLeftMm": 5000,
            "eaveHeightRightMm": 5000,
        },
    },
    "house-beta": {
        "slug": "iter5-house-beta",
        "levels": [
            ("lvl-kg", "KG", -2750.0),
            ("lvl-eg", "EG", 0.0),
            ("lvl-dg", "DG", 2750.0),
        ],
        # The r2 reader produced numerics — use the EG perimeter as the
        # canonical building frame; KG/DG variations within ±100 mm.
        "perimeter": [
            {"xMm": 0,    "yMm": 0},
            {"xMm": 9864, "yMm": 0},
            {"xMm": 9864, "yMm": 8984},
            {"xMm": 0,    "yMm": 8984},
        ],
        "wall_thickness": 317.0,
        "wall_height": 2750.0,
        "kg_inherits_eg_perimeter": False,
        "kg_perimeter": [
            {"xMm": 0,    "yMm": 0},
            {"xMm": 9764, "yMm": 0},
            {"xMm": 9764, "yMm": 8984},
            {"xMm": 0,    "yMm": 8984},
        ],
        "roof": {
            "referenceLevel": "lvl-dg",
            "slopeDeg": 30.0,
            "overhangMm": 600,
            "eaveHeightLeftMm": 1250,
            "eaveHeightRightMm": 1250,
        },
    },
    "house-gamma": {
        "slug": "iter5-house-gamma",
        # KG reader gave 18000 × 8000 mm (long axis E-W). OG/DG readers
        # came in rotated 90° — we override with the KG frame for all
        # above-grade levels. Spitzboden inset is the enclosed attic
        # loft (1985 × 6185), positioned roughly centered in the
        # building footprint.
        "levels": [
            ("lvl-kg",    "KG",         -2470.0),
            ("lvl-eg",    "EG",          0.0),
            ("lvl-og",    "OG",          2800.0),
            ("lvl-dg",    "DG",          5600.0),
            ("lvl-spitz", "Spitzboden",  8400.0),
        ],
        # Canonical building footprint: 18000 × 8000 with SE chamfer.
        "perimeter": [
            {"xMm": 0,     "yMm": 0},
            {"xMm": 18000, "yMm": 0},
            {"xMm": 18000, "yMm": 7045},
            {"xMm": 17045, "yMm": 8000},  # SE chamfer 1.35 m
            {"xMm": 0,     "yMm": 8000},
        ],
        "wall_thickness": 300.0,
        "wall_height": 2800.0,
        "kg_inherits_eg_perimeter": False,
        # Spitzboden attic loft — small enclosed area centered in
        # building, NOT the full footprint.
        "spitzboden_perimeter": [
            {"xMm": 8000,  "yMm": 1000},
            {"xMm": 9985,  "yMm": 1000},
            {"xMm": 9985,  "yMm": 7185},
            {"xMm": 8000,  "yMm": 7185},
        ],
        "roof": {
            "referenceLevel": "lvl-dg",  # Roof sits on top of DG, capping the building.
            "slopeDeg": 45.0,
            "overhangMm": 400,
            "eaveHeightLeftMm": 1000,
            "eaveHeightRightMm": 1000,
        },
    },
}


def ensure_model(slug: str) -> str:
    body = http_json("POST", f"/api/projects/{SEED_PROJECT_ID}/models", {"slug": slug})
    if body.get("error"):
        boot = http_json("GET", "/api/bootstrap")
        for proj in boot.get("projects", []):
            if str(proj.get("id")) != SEED_PROJECT_ID:
                continue
            for m in proj.get("models", []):
                if m.get("slug") == slug:
                    return str(m.get("id"))
        raise RuntimeError(f"could not resolve {slug}: {body}")
    return str(body["id"])


def commit(model_id: str, command: dict[str, Any], parent_revision: int, op: str) -> int:
    bundle = {
        "mode": "commit",
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [command],
            "assumptions": [
                {
                    "key": f"iter5.{op}.{command.get('id') or command.get('name') or op}",
                    "value": str(command.get("name") or command.get("id") or op),
                    "confidence": 0.85,
                    "source": "iter5_canonical_rebuild",
                    "contestable": True,
                    "evidence": (
                        "Authored in canonical per-house building frame "
                        "by scripts/testhouse_iter5_canonical_rebuild.py. "
                        "See spec/testhouse-hybrid-reverse-bim-tracker.md."
                    ),
                }
            ],
            "parentRevision": parent_revision,
        },
    }
    resp = http_json("POST", f"/api/models/{model_id}/bundles", bundle)
    if resp.get("error") or not resp.get("applied"):
        raise RuntimeError(
            f"commit failed for {op}: status={resp.get('status')} "
            f"body={resp.get('body','')[:400]}"
        )
    return int(resp.get("newRevision") or parent_revision + 1)


def polygon_to_segments(points: list[dict[str, float]], thickness: float, height: float) -> list[dict[str, Any]]:
    seq = list(points)
    if seq[0] != seq[-1]:
        seq.append(seq[0])
    return [
        {
            "start": seq[i],
            "end": seq[i + 1],
            "thicknessMm": thickness,
            "heightMm": height,
        }
        for i in range(len(seq) - 1)
    ]


def author_house(house: str, spec: dict[str, Any]) -> dict[str, Any]:
    model_id = ensure_model(spec["slug"])
    print(f"{house}: modelId={model_id}")

    rev = 1
    counts = {"level": 0, "wall_chain": 0, "floor": 0, "roof": 0, "plan_view": 0, "viewpoint": 0}

    # 1. Levels.
    for lvl_id, name, elevation in spec["levels"]:
        rev = commit(
            model_id,
            {
                "type": "createLevel",
                "id": lvl_id,
                "name": name,
                "elevationMm": elevation,
                "alsoCreatePlanView": False,
            },
            rev,
            f"level.{lvl_id}",
        )
        counts["level"] += 1

    # 2. Walls per level + floor per level + roof.
    perimeter = spec["perimeter"]
    spitz_perimeter = spec.get("spitzboden_perimeter")
    kg_perimeter = spec.get("kg_perimeter") or (
        perimeter if spec["kg_inherits_eg_perimeter"] else None
    )
    for lvl_id, name, _ in spec["levels"]:
        if lvl_id == "lvl-kg":
            polygon = kg_perimeter
        elif lvl_id == "lvl-spitz" and spitz_perimeter is not None:
            polygon = spitz_perimeter
        else:
            polygon = perimeter
        if polygon is None:
            continue
        segments = polygon_to_segments(
            polygon, spec["wall_thickness"], spec["wall_height"]
        )
        rev = commit(
            model_id,
            {
                "type": "createWallChain",
                "levelId": lvl_id,
                "namePrefix": f"wc-{lvl_id}",
                "segments": segments,
            },
            rev,
            f"wallchain.{lvl_id}",
        )
        counts["wall_chain"] += 1
        # Floor on the same level.
        boundary = list(polygon)
        if boundary[0] != boundary[-1]:
            boundary.append(boundary[0])
        rev = commit(
            model_id,
            {
                "type": "createFloor",
                "name": f"Floor {name}",
                "levelId": lvl_id,
                "boundaryMm": boundary,
                "thicknessMm": 220.0,
                "allowDetached": True,
            },
            rev,
            f"floor.{lvl_id}",
        )
        counts["floor"] += 1

    # 3. Roof.
    roof_spec = spec["roof"]
    rev = commit(
        model_id,
        {
            "type": "createRoof",
            "name": f"Roof {house}",
            "referenceLevelId": roof_spec["referenceLevel"],
            "footprintMm": perimeter,  # roof always uses the building footprint
            "overhangMm": roof_spec["overhangMm"],
            "slopeDeg": roof_spec["slopeDeg"],
            "roofGeometryMode": "mass_box",
            "eaveHeightLeftMm": roof_spec["eaveHeightLeftMm"],
            "eaveHeightRightMm": roof_spec["eaveHeightRightMm"],
        },
        rev,
        "roof",
    )
    counts["roof"] += 1

    # 4. Plan view per level.
    for lvl_id, name, _ in spec["levels"]:
        rev = commit(
            model_id,
            {
                "type": "upsertPlanView",
                "name": f"Plan — {name}",
                "levelId": lvl_id,
                "discipline": "architecture",
                "planPresentation": "default",
            },
            rev,
            f"plan.{lvl_id}",
        )
        counts["plan_view"] += 1

    # 5. Default 3D viewpoint — orbit camera framing the whole building.
    # Compute building bbox to size the camera distance.
    xs = [p["xMm"] for p in perimeter]
    ys = [p["yMm"] for p in perimeter]
    cx = (max(xs) + min(xs)) / 2
    cy = (max(ys) + min(ys)) / 2
    extent = max(max(xs) - min(xs), max(ys) - min(ys))
    cam_d = extent * 2.0
    rev = commit(
        model_id,
        {
            "type": "saveViewpoint",
            "name": "Default 3D",
            "mode": "orbit_3d",
            "camera": {
                "position": {"xMm": cx + cam_d * 0.8, "yMm": cy - cam_d, "zMm": cam_d * 0.6},
                "target": {"xMm": cx, "yMm": cy, "zMm": 3000},
                "up": {"xMm": 0, "yMm": 0, "zMm": 1},
            },
        },
        rev,
        "viewpoint",
    )
    counts["viewpoint"] += 1

    # 6. Source-view evidence pills for the new sections + elevations
    # are out of scope for the canonical rebuild; the old iter-2
    # source_view_evidence rows still exist on the iter-2 models
    # (5099e6cf / 3da52fe0 / eeca577f).

    (REPO_ROOT / "tmp" / "reverse-bim" / house / "iter-5-canonical-model.json").write_text(
        json.dumps(
            {"house": house, "modelId": model_id, "slug": spec["slug"], "counts": counts},
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    return {"house": house, "modelId": model_id, "counts": counts}


def main() -> None:
    for house, spec in HOUSE_SPECS.items():
        summary = author_house(house, spec)
        print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
