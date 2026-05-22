"""Iter-13 carryover 4 — re-fit the per-house default 3D viewpoint to
the post-iter-12 bounding box.

The iter-5 canonical-rebuild authored each house's default 3D viewpoint
on the iter-5 (smaller) footprint. After iter-12's expansions (alpha
doppelhaus -9935..+9935, gamma carport east + Praxis wing south), the
default 3D camera's target+position no longer frame the building. The
iter-12 scoring subagents flagged this as methodology gap #18.

This script computes a new (position, target) per house from the live
snapshot's wall extents, then emits saveViewpoint with the existing
viewpoint id so the kernel updates in place rather than creating a new
viewpoint.

Camera-positioning heuristic (orbit_3d):

  target = bounding-box center (x, y, half-height)
  position = target + (1.5 × bbox_max_dim) along the SE+up diagonal
  up = (0, 0, 1)

That's the camera placement Revit uses for "Zoom to Fit" on a fresh model;
gives a 30°-ish vertical FOV at typical viewport sizes.

Run from repo root:  python3 scripts/testhouse_iter13_viewport_refit.py
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

HOUSES = ("alpha", "beta", "gamma")


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def find_viewpoint(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    for e in (snapshot.get("elements") or {}).values():
        if isinstance(e, dict) and e.get("kind") == "viewpoint":
            return e
    return None


def compute_bbox(snapshot: dict[str, Any]) -> tuple[float, float, float, float, float, float]:
    """Union AABB of all walls + roofs. Returns (xmin,xmax,ymin,ymax,zmin,zmax)."""
    xs: list[float] = []
    ys: list[float] = []
    zs_lo: list[float] = []
    zs_hi: list[float] = []
    levels_by_id: dict[str, float] = {}
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict):
            continue
        if e.get("kind") == "level":
            levels_by_id[str(e.get("id"))] = float(e.get("elevationMm") or 0)

    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict):
            continue
        k = e.get("kind")
        if k == "wall":
            for p in (e.get("start"), e.get("end")):
                if isinstance(p, dict):
                    xs.append(float(p.get("xMm", 0)))
                    ys.append(float(p.get("yMm", 0)))
            level_z = levels_by_id.get(str(e.get("levelId")), 0)
            base_z = level_z + float(e.get("baseConstraintOffsetMm") or 0)
            top_z = base_z + float(e.get("heightMm") or 2800)
            zs_lo.append(base_z)
            zs_hi.append(top_z)
        elif k == "roof":
            for p in (e.get("footprintMm") or []):
                xs.append(float(p.get("xMm", 0)))
                ys.append(float(p.get("yMm", 0)))
            ref_z = levels_by_id.get(str(e.get("referenceLevelId")), 0)
            zs_lo.append(ref_z)
            slope = float(e.get("slopeDeg") or 30)
            # rough ridge-height estimate from footprint short-axis
            footprint = e.get("footprintMm") or []
            if footprint:
                fxs = [float(p.get("xMm", 0)) for p in footprint]
                fys = [float(p.get("yMm", 0)) for p in footprint]
                short = min(max(fxs) - min(fxs), max(fys) - min(fys))
                zs_hi.append(ref_z + short / 2 * math.tan(math.radians(slope)))
            else:
                zs_hi.append(ref_z + 3000)

    if not xs:
        return (0, 1, 0, 1, 0, 1)
    return min(xs), max(xs), min(ys), max(ys), min(zs_lo), max(zs_hi)


def compute_camera(bbox: tuple[float, float, float, float, float, float]) -> dict[str, Any]:
    xmin, xmax, ymin, ymax, zmin, zmax = bbox
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2
    cz = (zmin + zmax) / 2
    dx, dy, dz = xmax - xmin, ymax - ymin, zmax - zmin
    radius = 1.4 * math.sqrt(dx * dx + dy * dy + dz * dz)
    # SE + up orbit: positive x, negative y, positive z relative to target
    offset_unit = (1.0, -1.3, 0.7)
    norm = math.sqrt(sum(c * c for c in offset_unit))
    px = cx + radius * offset_unit[0] / norm
    py = cy + radius * offset_unit[1] / norm
    pz = cz + radius * offset_unit[2] / norm
    return {
        "position": {"xMm": round(px, 1), "yMm": round(py, 1), "zMm": round(pz, 1)},
        "target":   {"xMm": round(cx, 1), "yMm": round(cy, 1), "zMm": round(cz, 1)},
        "up":       {"xMm": 0.0, "yMm": 0.0, "zMm": 1.0},
    }


def refit_house(house: str) -> dict[str, Any]:
    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)
    vp = find_viewpoint(snapshot)
    if vp is None:
        return {"house": house, "error": "no viewpoint found"}
    bbox = compute_bbox(snapshot)
    camera = compute_camera(bbox)

    # saveViewpoint with an existing id tries to CREATE a new element,
    # not update — so delete the old viewpoint first, then save the new one
    # with the same id (preserves any external references like default-view).
    cmds = [
        {"type": "deleteElement", "elementId": vp.get("id")},
        {
            "type": "saveViewpoint",
            "id": vp.get("id"),
            "name": vp.get("name") or "Default 3D",
            "camera": camera,
            "mode": "orbit_3d",
        },
    ]
    normalized, records = normalize_bundle(cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)
    last_resp: dict[str, Any] = {}
    statuses: list[str] = []
    for nc in normalized:
        resp = commit_one(model_id, nc, rev)
        if resp.get("applied"):
            rev = int(resp.get("newRevision") or rev + 1)
            statuses.append("applied")
        elif resp.get("error"):
            statuses.append("http_error")
        else:
            statuses.append("rejected")
        last_resp = resp
    status = "applied" if all(s == "applied" for s in statuses) else statuses[-1]
    resp = last_resp
    return {
        "house": house,
        "modelId": model_id,
        "viewpointId": vp.get("id"),
        "bboxBefore": vp.get("camera"),
        "bboxNew": {"xmin": bbox[0], "xmax": bbox[1], "ymin": bbox[2], "ymax": bbox[3], "zmin": bbox[4], "zmax": bbox[5]},
        "cameraNew": camera,
        "status": status,
        "violations": resp.get("violations") if status != "applied" else None,
        "body": resp.get("body") if resp.get("error") else None,
        "normalizations": [asdict(r) for r in records],
        "newRevision": resp.get("newRevision"),
    }


def main() -> None:
    overall: dict[str, Any] = {}
    for house in HOUSES:
        result = refit_house(house)
        overall[house] = {
            "status": result.get("status"),
            "bboxX": (result.get("bboxNew") or {}).get("xmin", "?"),
            "viewpointId": result.get("viewpointId"),
        }
        bbox = result.get("bboxNew") or {}
        print(
            f"=== {house} ===\n"
            f"  viewpointId:  {result.get('viewpointId')}\n"
            f"  bbox:         x=[{bbox.get('xmin','?')},{bbox.get('xmax','?')}] "
            f"y=[{bbox.get('ymin','?')},{bbox.get('ymax','?')}] "
            f"z=[{bbox.get('zmin','?')},{bbox.get('zmax','?')}]\n"
            f"  cameraNew:    {result.get('cameraNew')}\n"
            f"  status:       {result.get('status')}\n",
            flush=True,
        )
        if result.get("status") != "applied":
            print(f"  violations: {json.dumps(result.get('violations') or result.get('body') or 'n/a')[:300]}")
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / "iter-13-viewport-refit-apply.json"
    out_path.write_text(json.dumps(overall, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
