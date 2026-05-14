from __future__ import annotations

import math

from bim_ai.elements import DoorElem, RoomElem, WallElem, WindowElem

Point2 = tuple[float, float]
Interval = tuple[float, float]

ROOM_UNENCLOSED_PARALLEL_TOL_RAD = math.radians(4.0)
ROOM_UNENCLOSED_GAP_TOL_MM = 50.0
ROOM_UNENCLOSED_SEPARATION_PERP_TOL_MM = 150.0


def room_bbox(room: RoomElem) -> tuple[float, float, float, float]:
    xs = [p.x_mm for p in room.outline_mm]
    ys = [p.y_mm for p in room.outline_mm]
    return min(xs), max(xs), min(ys), max(ys)


def segment_axis_coverage(
    edge_start: Point2,
    edge_end: Point2,
    seg_start: Point2,
    seg_end: Point2,
    perp_tol_mm: float,
    angle_tol_rad: float = ROOM_UNENCLOSED_PARALLEL_TOL_RAD,
) -> Interval | None:
    """Project a segment onto a nearby, near-parallel polygon edge axis."""

    dx = edge_end[0] - edge_start[0]
    dy = edge_end[1] - edge_start[1]
    edge_len = math.hypot(dx, dy)
    if edge_len < 1.0:
        return None
    ux, uy = dx / edge_len, dy / edge_len
    nx, ny = -uy, ux

    sdx = seg_end[0] - seg_start[0]
    sdy = seg_end[1] - seg_start[1]
    seg_len = math.hypot(sdx, sdy)
    if seg_len < 1.0:
        return None

    sin_angle = abs(ux * sdy - uy * sdx) / seg_len
    if sin_angle > math.sin(angle_tol_rad):
        return None

    qa_x = seg_start[0] - edge_start[0]
    qa_y = seg_start[1] - edge_start[1]
    qb_x = seg_end[0] - edge_start[0]
    qb_y = seg_end[1] - edge_start[1]
    if abs(qa_x * nx + qa_y * ny) > perp_tol_mm:
        return None
    if abs(qb_x * nx + qb_y * ny) > perp_tol_mm:
        return None

    t_a = qa_x * ux + qa_y * uy
    t_b = qb_x * ux + qb_y * uy
    t0 = max(0.0, min(t_a, t_b))
    t1 = min(edge_len, max(t_a, t_b))
    if t1 - t0 < 1.0:
        return None
    return (t0, t1)


def interval_union_uncovered(
    intervals: list[Interval],
    target_len: float,
    allowed_gap_mm: float = ROOM_UNENCLOSED_GAP_TOL_MM,
) -> list[Interval]:
    """Return uncovered sub-intervals of [0, target_len] after merging intervals."""

    if target_len <= 0:
        return []
    merged: list[list[float]] = []
    for s, e in sorted(intervals):
        s = max(0.0, s)
        e = min(target_len, e)
        if e <= s:
            continue
        if merged and s <= merged[-1][1] + allowed_gap_mm:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])

    uncovered: list[Interval] = []
    cursor = 0.0
    for s, e in merged:
        if s > cursor + allowed_gap_mm:
            uncovered.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < target_len - allowed_gap_mm:
        uncovered.append((cursor, target_len))
    return uncovered


def wall_length_mm(wall: WallElem) -> float:
    dx = wall.end.x_mm - wall.start.x_mm
    dy = wall.end.y_mm - wall.start.y_mm
    return (dx * dx + dy * dy) ** 0.5


def wall_unit_dir(wall: WallElem) -> Point2:
    wl = wall_length_mm(wall)
    if wl < 1e-6:
        return (0.0, 0.0)
    return ((wall.end.x_mm - wall.start.x_mm) / wl, (wall.end.y_mm - wall.start.y_mm) / wl)


def distance_point_segment_mm(
    px: float,
    py: float,
    sax: float,
    say: float,
    ebx: float,
    eby: float,
) -> float:
    lax, lay = ebx - sax, eby - say
    l2 = lax * lax + lay * lay
    if l2 < 1e-8:
        return ((px - sax) ** 2 + (py - say) ** 2) ** 0.5
    t = ((px - sax) * lax + (py - say) * lay) / l2
    if t <= 0:
        return ((px - sax) ** 2 + (py - say) ** 2) ** 0.5
    if t >= 1:
        return ((px - ebx) ** 2 + (py - eby) ** 2) ** 0.5
    qx, qy = sax + t * lax, say + t * lay
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5


def min_endpoint_tip_clearance_between(a: WallElem, b: WallElem) -> float:
    a_pts = [(a.start.x_mm, a.start.y_mm), (a.end.x_mm, a.end.y_mm)]
    b_pts = [(b.start.x_mm, b.start.y_mm), (b.end.x_mm, b.end.y_mm)]
    bx0, by0 = b.start.x_mm, b.start.y_mm
    bx1, by1 = b.end.x_mm, b.end.y_mm
    ax0, ay0 = a.start.x_mm, a.start.y_mm
    ax1, ay1 = a.end.x_mm, a.end.y_mm

    direct = min(distance_point_segment_mm(px, py, bx0, by0, bx1, by1) for px, py in a_pts)
    rev = min(distance_point_segment_mm(px, py, ax0, ay0, ax1, ay1) for px, py in b_pts)

    return min(direct, rev)


def wall_endpoints_rounded(wall: WallElem, eps_mm: float = 1.0) -> set[Point2]:
    return {
        (round(wall.start.x_mm / eps_mm) * eps_mm, round(wall.start.y_mm / eps_mm) * eps_mm),
        (round(wall.end.x_mm / eps_mm) * eps_mm, round(wall.end.y_mm / eps_mm) * eps_mm),
    }


def wall_corner_or_t_overlap_exempt(a: WallElem, b: WallElem, eps_mm: float = 1.0) -> bool:
    """Corner mitres and planar T-connections overlap materially but are modeled as joints."""

    if a.level_id != b.level_id:
        return False
    da = wall_unit_dir(a)
    db = wall_unit_dir(b)

    if abs(da[0]) < 1e-9 and abs(da[1]) < 1e-9:
        return False
    if abs(db[0]) < 1e-9 and abs(db[1]) < 1e-9:
        return False

    pts_a = wall_endpoints_rounded(a, eps_mm)
    pts_b = wall_endpoints_rounded(b, eps_mm)
    if len(pts_a & pts_b) == 1:
        return True

    # T-joins can overlap because wall bodies have thickness. Parallel or
    # near-parallel walls with tip clearance are still real overlaps, not joins.
    if abs(da[0] * db[0] + da[1] * db[1]) > 0.985:
        return False

    tip_lim = max(a.thickness_mm, b.thickness_mm) * 1.8 + 150
    return min_endpoint_tip_clearance_between(a, b) <= tip_lim


def opening_plan_midpoint(opening: DoorElem | WindowElem, wall: WallElem) -> Point2:
    sx, sy = wall.start.x_mm, wall.start.y_mm
    ex, ey = wall.end.x_mm, wall.end.y_mm
    t = opening.along_t
    return sx + (ex - sx) * t, sy + (ey - sy) * t


def hosted_t_bounds(host: WallElem, width_mm: float) -> Interval | None:
    wl = wall_length_mm(host)
    if wl < 10:
        return None
    half = width_mm / 2
    usable_t0 = half / wl
    usable_t1 = 1 - half / wl
    if usable_t1 < usable_t0 + 1e-6:
        return None
    return usable_t0, usable_t1


def opening_t_interval_on_wall(opening: DoorElem | WindowElem, wall: WallElem) -> Interval | None:
    wl = wall_length_mm(wall)
    bounds = hosted_t_bounds(wall, opening.width_mm)
    if bounds is None or wl < 10:
        return None
    at = opening.along_t
    half = opening.width_mm / 2 / wl
    return at - half, at + half


def intervals_overlap(a0: float, a1: float, b0: float, b1: float, eps: float = 1e-3) -> bool:
    return not (a1 < b0 - eps or b1 < a0 - eps)
