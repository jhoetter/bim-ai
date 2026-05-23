"""Iter-14 step 1a — author 4 cardinal-direction 3D viewpoints per house
for the orthographic-style elevation capture pipeline (methodology #13 fix,
Path A).

The web workspace already honors `?activeViewpoint=<id>` (see
`packages/web/src/workspace/Workspace.tsx:1491` — added in iter-11 alongside
`?activeElevationView`). We just need stable per-direction viewpoint
elements so the capture script can deep-link into each cardinal view.

Each viewpoint is an orbit_3d camera positioned far on one cardinal axis
looking at the building center. We use a long camera-to-target distance
(2.5 × bounding-box diagonal) so the perspective distortion is small —
the rendered image is visually equivalent to an orthographic projection
for the purpose of facade scoring.

Stable viewpoint ids:
  - `view-3d-ortho-north`
  - `view-3d-ortho-east`
  - `view-3d-ortho-south`
  - `view-3d-ortho-west`

Idempotent: re-runs delete existing then re-emit.

Run from repo root:  python3 scripts/testhouse_iter14_author_ortho_viewpoints.py
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from testhouse_command_normalize import normalize_bundle  # noqa: E402
from testhouse_iter10_apply import commit_one, http_json, query_snapshot  # noqa: E402
from testhouse_iter13_viewport_refit import compute_bbox  # noqa: E402

HOUSES = ("alpha", "beta", "gamma")

DIRECTIONS = {
    # offset_unit: (x, y, z) direction from building center to camera position
    # (looking back toward the building, with z=0.05 for slight tilt)
    "north": ( 0.0,  1.0, 0.05),  # camera north of building, looking south
    "east":  ( 1.0,  0.0, 0.05),
    "south": ( 0.0, -1.0, 0.05),
    "west":  (-1.0,  0.0, 0.05),
}


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def compute_ortho_camera(
    bbox: tuple[float, float, float, float, float, float],
    offset_unit: tuple[float, float, float],
) -> dict[str, Any]:
    xmin, xmax, ymin, ymax, zmin, zmax = bbox
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2
    cz = (zmin + zmax) / 2
    dx, dy, dz = xmax - xmin, ymax - ymin, zmax - zmin
    diag = math.sqrt(dx * dx + dy * dy + dz * dz)
    # 2.5 × diag → narrow FOV, almost-orthographic perspective at typical viewport size
    radius = 2.5 * diag
    norm = math.sqrt(sum(c * c for c in offset_unit))
    px = cx + radius * offset_unit[0] / norm
    py = cy + radius * offset_unit[1] / norm
    pz = cz + radius * offset_unit[2] / norm
    return {
        "position": {"xMm": round(px, 1), "yMm": round(py, 1), "zMm": round(pz, 1)},
        "target":   {"xMm": round(cx, 1), "yMm": round(cy, 1), "zMm": round(cz, 1)},
        "up":       {"xMm": 0.0, "yMm": 0.0, "zMm": 1.0},
    }


def existing_viewpoint_ids(snapshot: dict[str, Any]) -> set[str]:
    return {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") == "viewpoint"
    }


def author_house(house: str) -> dict[str, Any]:
    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)
    bbox = compute_bbox(snapshot)

    existing = existing_viewpoint_ids(snapshot)
    cmds: list[dict[str, Any]] = []
    for direction, offset in DIRECTIONS.items():
        vp_id = f"view-3d-ortho-{direction}"
        # Delete existing if present, then re-emit (saveViewpoint with existing
        # id triggers `duplicate element id` — same workaround as the iter-13
        # viewport refit).
        if vp_id in existing:
            cmds.append({"type": "deleteElement", "elementId": vp_id})
        cmds.append({
            "type": "saveViewpoint",
            "id": vp_id,
            "name": f"3D ortho — {direction}",
            "camera": compute_ortho_camera(bbox, offset),
            "mode": "orbit_3d",
        })

    if not cmds:
        return {"house": house, "appliedCount": 0, "skipped": True}

    normalized, records = normalize_bundle(cmds)
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

    return {
        "house": house, "modelId": model_id, "bbox": bbox,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }


def main() -> None:
    overall: dict[str, Any] = {}
    for house in HOUSES:
        result = author_house(house)
        overall[house] = {
            "applied": result.get("appliedCount"),
            "failed": result.get("failedCount"),
            "rev": result.get("finalRevision"),
        }
        print(
            f"=== {house} ===  applied {result.get('appliedCount')}/{result.get('appliedCount', 0) + result.get('failedCount', 0)}  rev={result.get('finalRevision')}",
            flush=True,
        )
        for entry in result.get("perCommand") or []:
            marker = "✓" if entry["status"] == "applied" else "✗"
            print(f"  [{entry['i']}] {marker} {entry['type']} -> {entry['status']}")
            if entry["status"] != "applied":
                v = entry.get("violations") or entry.get("body") or []
                if isinstance(v, list):
                    for vi in v[:2]:
                        print(f"      sev={vi.get('severity')} rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / "iter-14-ortho-viewpoints-apply.json"
    out_path.write_text(json.dumps(overall, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
