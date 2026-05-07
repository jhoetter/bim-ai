"""SKT-02 — Pick Walls helpers (offset + corner-trim).

Inside an open sketch session, Pick Walls converts a `WallElem` into a
`SketchLine`. Two offset modes are supported:

- ``centerline``: the line equals the wall's start→end axis.
- ``interior_face``: the line is offset by the wall's half-thickness toward
  the **interior** of the picked-walls cluster, matching Revit's
  "offset = -100 mm for slab over walls" pattern.

Auto-trim corners: when two picked walls share a corner (after offset their
endpoints land near each other), we trim each line to their proper segment-
segment intersection so the resulting loop closes cleanly without a stub.
"""

from __future__ import annotations

import math

from bim_ai.elements import Vec2Mm, WallElem
from bim_ai.sketch_session import (
    PickedWall,
    PickWallsOffsetMode,
    SketchLine,
    SketchSession,
)

# Maximum extension distance for an endpoint-to-intersection trim. Picked
# walls are ≤ a few hundred mm out of corner alignment after the half-thickness
# offset, so 1m of slack catches every realistic case while staying short
# enough to avoid trimming far-apart non-adjacent pairs.
_TRIM_EXTEND_LIMIT_MM = 1000.0


def _wall_centerline(wall: WallElem) -> tuple[tuple[float, float], tuple[float, float]]:
    return (
        (wall.start.x_mm, wall.start.y_mm),
        (wall.end.x_mm, wall.end.y_mm),
    )


def _normal(ax: float, ay: float, bx: float, by: float) -> tuple[float, float]:
    """Unit-length 2D normal (ccw-rotated direction)."""

    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy)
    if length == 0.0:
        return (0.0, 0.0)
    # Rotate (dx, dy) by +90° to get the left-hand normal.
    return (-dy / length, dx / length)


def _picked_walls_centroid(
    walls: list[WallElem],
) -> tuple[float, float] | None:
    """Centroid of the union of wall endpoints — used to pick the interior side."""

    if not walls:
        return None
    xs: list[float] = []
    ys: list[float] = []
    for w in walls:
        xs.extend((w.start.x_mm, w.end.x_mm))
        ys.extend((w.start.y_mm, w.end.y_mm))
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def derive_wall_sketch_line(
    wall: WallElem,
    offset_mode: PickWallsOffsetMode,
    interior_anchor: tuple[float, float] | None,
) -> SketchLine:
    """Convert a wall to a `SketchLine` using the configured offset mode.

    For ``interior_face``, the line shifts by half the wall's thickness toward
    `interior_anchor` (the centroid of all picked walls so far). When no
    interior anchor is known yet (first pick), we pick the half-thickness side
    arbitrarily; subsequent picks reverse direction if the anchor argues for it.
    """

    (ax, ay), (bx, by) = _wall_centerline(wall)
    if offset_mode == "centerline" or wall.thickness_mm <= 0:
        return SketchLine(
            from_mm=Vec2Mm(xMm=ax, yMm=ay),
            to_mm=Vec2Mm(xMm=bx, yMm=by),
        )

    nx, ny = _normal(ax, ay, bx, by)
    half_t = wall.thickness_mm / 2.0
    # If the interior anchor lies on the (-n) side of the wall, flip.
    if interior_anchor is not None:
        cx, cy = interior_anchor
        midx, midy = (ax + bx) / 2.0, (ay + by) / 2.0
        side = nx * (cx - midx) + ny * (cy - midy)
        if side < 0:
            nx, ny = -nx, -ny
    ox, oy = nx * half_t, ny * half_t
    return SketchLine(
        from_mm=Vec2Mm(xMm=ax + ox, yMm=ay + oy),
        to_mm=Vec2Mm(xMm=bx + ox, yMm=by + oy),
    )


def _segment_intersection(
    a0: tuple[float, float],
    a1: tuple[float, float],
    b0: tuple[float, float],
    b1: tuple[float, float],
) -> tuple[float, float] | None:
    """Infinite-line intersection of two segments. Returns None if parallel."""

    rx, ry = a1[0] - a0[0], a1[1] - a0[1]
    sx, sy = b1[0] - b0[0], b1[1] - b0[1]
    denom = rx * sy - ry * sx
    if abs(denom) < 1e-9:
        return None
    qpx, qpy = b0[0] - a0[0], b0[1] - a0[1]
    t = (qpx * sy - qpy * sx) / denom
    return (a0[0] + t * rx, a0[1] + t * ry)


def trim_corners(lines: list[SketchLine]) -> list[SketchLine]:
    """Snap each pair of nearly-adjacent line endpoints to their line-line crossing.

    For every (i, j) pair we compute the infinite-line intersection. If the
    intersection lies within ``_TRIM_EXTEND_LIMIT_MM`` of one endpoint of i AND
    one endpoint of j, those two endpoints are snapped to the intersection.
    Parallel pairs (no intersection) are skipped.

    O(n²) over picked walls; n is hand-picked input (≤ tens of walls).
    """

    if len(lines) < 2:
        return lines
    pts: list[list[Vec2Mm]] = [[ln.from_mm.model_copy(), ln.to_mm.model_copy()] for ln in lines]

    def _closer_endpoint(p_pts: list[Vec2Mm], target: tuple[float, float]) -> tuple[int, float]:
        d0 = math.hypot(p_pts[0].x_mm - target[0], p_pts[0].y_mm - target[1])
        d1 = math.hypot(p_pts[1].x_mm - target[0], p_pts[1].y_mm - target[1])
        return (0, d0) if d0 <= d1 else (1, d1)

    n = len(lines)
    for i in range(n):
        for j in range(i + 1, n):
            a0 = (pts[i][0].x_mm, pts[i][0].y_mm)
            a1 = (pts[i][1].x_mm, pts[i][1].y_mm)
            b0 = (pts[j][0].x_mm, pts[j][0].y_mm)
            b1 = (pts[j][1].x_mm, pts[j][1].y_mm)
            cross = _segment_intersection(a0, a1, b0, b1)
            if cross is None:
                continue
            ei_idx, ei_dist = _closer_endpoint(pts[i], cross)
            ej_idx, ej_dist = _closer_endpoint(pts[j], cross)
            if ei_dist > _TRIM_EXTEND_LIMIT_MM or ej_dist > _TRIM_EXTEND_LIMIT_MM:
                continue
            cx, cy = cross
            pts[i][ei_idx] = Vec2Mm(xMm=cx, yMm=cy)
            pts[j][ej_idx] = Vec2Mm(xMm=cx, yMm=cy)
    return [SketchLine(from_mm=p[0], to_mm=p[1]) for p in pts]


def rebuild_picked_walls_lines(
    session: SketchSession,
    walls_by_id: dict[str, WallElem],
) -> tuple[list[SketchLine], list[PickedWall]]:
    """Recompute every picked wall's contribution to `session.lines`.

    Preserves freehand lines (lines whose index is not referenced by any
    `PickedWall`) and re-emits picked-wall lines using the current
    `pick_walls_offset_mode`. Trims corners after re-emission.

    Returns `(new_lines, new_picked_walls)` with `line_index` re-pinned to the
    rebuilt list.
    """

    picked_indices = {p.line_index for p in session.picked_walls}
    freehand: list[SketchLine] = [
        ln for i, ln in enumerate(session.lines) if i not in picked_indices
    ]
    picked_walls_existing = [walls_by_id[p.wall_id] for p in session.picked_walls if p.wall_id in walls_by_id]
    anchor = _picked_walls_centroid(picked_walls_existing)
    new_picked_lines: list[SketchLine] = []
    new_picked: list[PickedWall] = []
    for p in session.picked_walls:
        wall = walls_by_id.get(p.wall_id)
        if wall is None:
            continue
        new_picked_lines.append(
            derive_wall_sketch_line(wall, session.pick_walls_offset_mode, anchor)
        )
        new_picked.append(p)

    new_picked_lines = trim_corners(new_picked_lines)
    new_lines = [*freehand, *new_picked_lines]
    # Re-pin line_index to the new positions (picked lines come after freehand).
    for offset, p in enumerate(new_picked):
        new_picked[offset] = PickedWall(wall_id=p.wall_id, line_index=len(freehand) + offset)
    return new_lines, new_picked
