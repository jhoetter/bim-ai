"""Iter-14 step 4a — emit a per-house wall manifest grouped by facade.

The window-rhythm subagent needs to know which wall id corresponds to which
facade so it can emit `insertWindowOnWall` commands with correct wallId
references. This script queries the live snapshot per house and groups
walls by canonical facade (north / east / south / west) + level.

Output: tmp/reverse-bim/iter-14-{house}-wall-manifest.json with shape:

  {
    "house": "alpha",
    "modelId": "...",
    "facades": {
      "north": {"lvl-eg": [{"wallId": ..., "start": ..., "end": ..., "length_mm": ...}, ...], "lvl-dg": [...], ...},
      "east":  {...},
      "south": {...},
      "west":  {...}
    }
  }

Run from repo root:  python3 scripts/testhouse_iter14_wall_manifest.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from testhouse_iter10_apply import query_snapshot  # noqa: E402

HOUSES = ("alpha", "beta", "gamma")


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def classify_facade(start: dict[str, Any], end: dict[str, Any], house_bbox: tuple[float, float, float, float]) -> str | None:
    """Return 'north' | 'east' | 'south' | 'west' | None for a wall segment
    based on its axis-alignment + position within the building's bbox."""
    sx, sy = float(start.get("xMm", 0)), float(start.get("yMm", 0))
    tx, ty = float(end.get("xMm", 0)), float(end.get("yMm", 0))
    xmin, xmax, ymin, ymax = house_bbox
    # tolerance for "on the edge" classification
    tol = 100.0
    if abs(sx - tx) < tol:
        # vertical wall (constant x) — east or west
        x = sx
        if abs(x - xmax) < tol:
            return "east"
        if abs(x - xmin) < tol:
            return "west"
        return None
    if abs(sy - ty) < tol:
        # horizontal wall (constant y) — north or south
        y = sy
        if abs(y - ymax) < tol:
            return "north"
        if abs(y - ymin) < tol:
            return "south"
        return None
    return None  # diagonal (chamfer)


def main_house_bbox(elements: dict[str, Any]) -> tuple[float, float, float, float]:
    """AABB of the MAIN building only — walls in the smallest spatially-coherent
    cluster. For iter-14 we'll just use the union of all walls on lvl-eg of
    the main building (which excludes the gamma carport/Praxis extensions
    that were authored with allowDetached and may have different positions)."""
    # Use union of all walls — caller filters per-house.
    xs: list[float] = []
    ys: list[float] = []
    for e in elements.values():
        if not isinstance(e, dict) or e.get("kind") != "wall":
            continue
        s = e.get("start") or {}; t = e.get("end") or {}
        xs.append(float(s.get("xMm", 0))); xs.append(float(t.get("xMm", 0)))
        ys.append(float(s.get("yMm", 0))); ys.append(float(t.get("yMm", 0)))
    if not xs:
        return (0, 0, 0, 0)
    return min(xs), max(xs), min(ys), max(ys)


def build_manifest(house: str) -> dict[str, Any]:
    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)
    elements = snapshot.get("elements") or {}

    bbox = main_house_bbox(elements)
    facades: dict[str, dict[str, list[dict[str, Any]]]] = {
        "north": {}, "east": {}, "south": {}, "west": {}
    }
    unclassified: list[dict[str, Any]] = []
    for e in elements.values():
        if not isinstance(e, dict) or e.get("kind") != "wall":
            continue
        s = e.get("start") or {}; t = e.get("end") or {}
        sx, sy = float(s.get("xMm", 0)), float(s.get("yMm", 0))
        tx, ty = float(t.get("xMm", 0)), float(t.get("yMm", 0))
        facade = classify_facade(s, t, bbox)
        level = str(e.get("levelId"))
        info = {
            "wallId": e.get("id"),
            "name": e.get("name"),
            "levelId": level,
            "start": {"xMm": sx, "yMm": sy},
            "end": {"xMm": tx, "yMm": ty},
            "length_mm": round(((tx - sx) ** 2 + (ty - sy) ** 2) ** 0.5, 1),
            "heightMm": e.get("heightMm"),
            "thicknessMm": e.get("thicknessMm"),
            "wallTypeId": e.get("wallTypeId"),
            "authoringIntent": e.get("agentTrace", {}).get("authoringIntent") if isinstance(e.get("agentTrace"), dict) else None,
        }
        if facade is None:
            unclassified.append(info)
            continue
        facades[facade].setdefault(level, []).append(info)

    return {
        "house": house,
        "modelId": model_id,
        "bbox": {"xmin": bbox[0], "xmax": bbox[1], "ymin": bbox[2], "ymax": bbox[3]},
        "facades": facades,
        "unclassified": unclassified,
    }


def main() -> None:
    for house in HOUSES:
        manifest = build_manifest(house)
        out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-14-{house}-wall-manifest.json"
        out_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        n_total = sum(
            len(walls) for level_dict in manifest["facades"].values() for walls in level_dict.values()
        )
        print(f"=== {house} ===  facade walls: {n_total}  unclassified: {len(manifest['unclassified'])}  out={out_path.relative_to(REPO_ROOT)}")
        for facade, level_dict in manifest["facades"].items():
            counts = {lvl: len(walls) for lvl, walls in level_dict.items()}
            print(f"    {facade:6}: {counts}")


if __name__ == "__main__":
    main()
