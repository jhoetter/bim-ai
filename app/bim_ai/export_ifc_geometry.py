"""Geometry helpers shared by the IFC kernel exporter."""

from __future__ import annotations

import math

import numpy as np

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, WallElem


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def polygon_area_m2_xy_mm(poly_mm: list[tuple[float, float]]) -> float:
    n = len(poly_mm)
    if n < 3:
        return 0.0
    area_twice_mm2 = 0.0
    for i in range(n):
        x1, y1 = poly_mm[i]
        x2, y2 = poly_mm[(i + 1) % n]
        area_twice_mm2 += x1 * y2 - x2 * y1
    return abs(area_twice_mm2 / 2.0) / 1e6


def polygon_perimeter_m_xy_mm(poly_mm: list[tuple[float, float]]) -> float:
    n = len(poly_mm)
    if n < 2:
        return 0.0
    perimeter_mm = 0.0
    for i in range(n):
        x1, y1 = poly_mm[i]
        x2, y2 = poly_mm[(i + 1) % n]
        perimeter_mm += math.hypot(x2 - x1, y2 - y1)
    return perimeter_mm / 1000.0


def level_elevation_m(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    return el.elevation_mm / 1000.0 if isinstance(el, LevelElem) else 0.0


def wall_local_to_world_m(wall: WallElem, elevation_m: float) -> tuple[np.ndarray, float]:
    """4x4 homogeneous transform + wall length matching `create_2pt_wall` placement."""

    p1_ = np.array([wall.start.x_mm / 1000.0, wall.start.y_mm / 1000.0], dtype=float)
    p2_ = np.array([wall.end.x_mm / 1000.0, wall.end.y_mm / 1000.0], dtype=float)

    dv = p2_ - p1_
    ln = float(np.linalg.norm(dv))
    length_m = ln if ln >= 1e-9 else 1e-6
    vx, vy = (dv / ln).tolist() if ln >= 1e-9 else (1.0, 0.0)

    mat = np.array(
        [
            [vx, -vy, 0.0, p1_[0]],
            [vy, vx, 0.0, p1_[1]],
            [0.0, 0.0, 1.0, elevation_m],
            [0.0, 0.0, 0.0, 1.0],
        ],
        dtype=float,
    )
    return mat, length_m


def xz_bounds_mm(poly_mm: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in poly_mm]
    zs = [p[1] for p in poly_mm]
    mn_x, mx_x = min(xs), max(xs)
    mn_z, mx_z = min(zs), max(zs)
    span_x = max(mx_x - mn_x, 1.0)
    span_z = max(mx_z - mn_z, 1.0)
    cx = (mn_x + mx_x) / 2.0
    cz = (mn_z + mx_z) / 2.0
    return cx, cz, span_x, span_z


def room_outline_mm(rm: RoomElem) -> list[tuple[float, float]]:
    return [(p.x_mm, p.y_mm) for p in rm.outline_mm]


def room_vertical_span_m(doc: Document, rm: RoomElem, floor_elev_m: float) -> tuple[float, float]:
    """Return (base_z, ceiling_z) world elevation for the crude room prism."""

    if rm.upper_limit_level_id:
        ceil_el = doc.elements.get(rm.upper_limit_level_id)
        ceiling_z = (
            ceil_el.elevation_mm / 1000.0 if isinstance(ceil_el, LevelElem) else floor_elev_m + 2.8
        )
    else:
        ceiling_z = floor_elev_m + 2.8
    offset = (
        rm.volume_ceiling_offset_mm / 1000.0 if rm.volume_ceiling_offset_mm is not None else 0.0
    )
    ceiling_z -= offset
    if ceiling_z < floor_elev_m + 1.0:
        ceiling_z = floor_elev_m + 2.2
    return floor_elev_m, ceiling_z
