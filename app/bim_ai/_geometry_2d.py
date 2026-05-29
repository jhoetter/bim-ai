"""Reusable 2D computational geometry helpers (REF-CQ-05).

Pure axis-aligned (XY plane, millimetre units) primitives:

* :func:`intersect_axis_aligned_crop_boxes` — intersect two boxes encoded as
  ``(x0, y0, x1, y1)`` tuples, treating ``None`` as the universal set.
* :func:`point_in_crop_xy` — closed-interval point-in-box test (inclusive edges).
* :func:`segment_intersects_crop_xy` — Liang-Barsky segment vs. axis-aligned
  rectangle clipping test.
* :func:`poly_bbox_overlaps_crop` — conservative AABB-overlap filter for a
  polygon vs. a crop rectangle.

These helpers were extracted from ``plan_projection_wire.py`` to be reusable
across plan/section projection code paths without circular imports.

All helpers operate in millimetres and expect ``box = (x0, y0, x1, y1)`` with
``x0 <= x1`` and ``y0 <= y1``.
"""

from __future__ import annotations


def intersect_axis_aligned_crop_boxes(
    a: tuple[float, float, float, float] | None,
    b: tuple[float, float, float, float] | None,
) -> tuple[float, float, float, float] | None:
    """Intersect axis-aligned boxes (x0,y0,x1,y1). None behaves as universal set."""

    if a is None:
        return b
    if b is None:
        return a
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0 = max(ax0, bx0)
    iy0 = max(ay0, by0)
    ix1 = min(ax1, bx1)
    iy1 = min(ay1, by1)
    return (ix0, iy0, ix1, iy1)


def point_in_crop_xy(x: float, y: float, box: tuple[float, float, float, float]) -> bool:
    """Closed-interval (inclusive) point-in-axis-aligned-box test."""
    x0, y0, x1, y1 = box
    return x0 <= x <= x1 and y0 <= y <= y1


def segment_intersects_crop_xy(
    ax: float,
    ay: float,
    bx: float,
    by: float,
    box: tuple[float, float, float, float],
) -> bool:
    """Whether segment AB intersects the closed axis-aligned crop rectangle (inclusive edges)."""
    if point_in_crop_xy(ax, ay, box) or point_in_crop_xy(bx, by, box):
        return True
    x0, y0, x1, y1 = box
    dx = bx - ax
    dy = by - ay
    p = (-dx, dx, -dy, dy)
    q = (ax - x0, x1 - ax, ay - y0, y1 - ay)
    u1, u2 = 0.0, 1.0
    eps = 1e-12
    for i in range(4):
        pi, qi = p[i], q[i]
        if abs(pi) < eps:
            if qi < 0:
                return False
            continue
        r = qi / pi
        if pi < 0:
            if r > u2:
                return False
            u1 = max(u1, r)
        else:
            if r < u1:
                return False
            u2 = min(u2, r)
    return u1 <= u2 + eps


def poly_bbox_overlaps_crop(
    pts: list[tuple[float, float]], box: tuple[float, float, float, float]
) -> bool:
    """Conservative 2D filter: polygon AABB overlaps crop AABB."""
    if not pts:
        return False
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    px0, px1 = min(xs), max(xs)
    py0, py1 = min(ys), max(ys)
    x0, y0, x1, y1 = box
    return not (px1 < x0 or px0 > x1 or py1 < y0 or py0 > y1)
