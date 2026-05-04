from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import (
    DimensionElem,
    DoorElem,
    Element,
    FloorElem,
    GridLineElem,
    LevelElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    ValidationRuleElem,
    WallElem,
    WindowElem,
)
from bim_ai.geometry import approx_overlap_area_mm2, sat_overlap, wall_corners


class Violation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    rule_id: str = Field(alias="ruleId")
    severity: str
    message: str
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    blocking: bool = Field(default=False, alias="blocking")
    quick_fix_command: dict[str, Any] | None = Field(default=None, alias="quickFixCommand")
    discipline: str | None = Field(default=None, alias="discipline")


_RULE_DISCIPLINE: dict[str, str] = {
    "wall_overlap": "coordination",
    "window_overlaps_door": "coordination",
    "level_duplicate_elevation": "structure",
    "wall_missing_level": "structure",
    "wall_zero_length": "structure",
    "grid_zero_length": "architecture",
    "dimension_zero_length": "architecture",
    "dimension_bad_level": "structure",
    "room_no_door": "architecture",
    "door_off_wall": "architecture",
    "door_not_on_wall": "architecture",
    "window_off_wall": "architecture",
    "floor_missing_level": "structure",
    "floor_polygon_degenerate": "structure",
    "slab_opening_missing_floor": "structure",
    "slab_opening_polygon_degenerate": "structure",
    "stair_missing_levels": "architecture",
    "stair_geometry_unreasonable": "architecture",
    "stair_comfort_eu_proxy": "architecture",
    "ids_cleanroom_door_without_family_type": "agent",
}


def polygon_area_abs_mm2(poly: list[tuple[float, float]]) -> float:
    """Shoelace area (absolute), mm²."""
    n = len(poly)
    if n < 3:
        return 0.0
    a = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a / 2.0)


def annotate_violation_disciplines(violations: list[Violation]) -> list[Violation]:
    out: list[Violation] = []
    for v in violations:
        d = _RULE_DISCIPLINE.get(v.rule_id, "architecture")
        out.append(v.model_copy(update={"discipline": d}))
    return out


def _room_bbox(room: RoomElem) -> tuple[float, float, float, float]:
    xs = [p.x_mm for p in room.outline_mm]
    ys = [p.y_mm for p in room.outline_mm]
    return min(xs), max(xs), min(ys), max(ys)


def _wall_length_mm(wall: WallElem) -> float:
    dx = wall.end.x_mm - wall.start.x_mm
    dy = wall.end.y_mm - wall.start.y_mm
    return (dx * dx + dy * dy) ** 0.5


def _wall_unit_dir(wall: WallElem) -> tuple[float, float]:
    wl = _wall_length_mm(wall)

    if wl < 1e-6:
        return (0.0, 0.0)

    return ((wall.end.x_mm - wall.start.x_mm) / wl, (wall.end.y_mm - wall.start.y_mm) / wl)


def _distance_point_segment_mm(
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


def _min_endpoint_tip_clearance_between(a: WallElem, b: WallElem) -> float:
    a_pts = [(a.start.x_mm, a.start.y_mm), (a.end.x_mm, a.end.y_mm)]
    b_pts = [(b.start.x_mm, b.start.y_mm), (b.end.x_mm, b.end.y_mm)]
    bx0, by0 = b.start.x_mm, b.start.y_mm
    bx1, by1 = b.end.x_mm, b.end.y_mm
    ax0, ay0 = a.start.x_mm, a.start.y_mm

    ax1, ay1 = a.end.x_mm, a.end.y_mm

    direct = min(_distance_point_segment_mm(px, py, bx0, by0, bx1, by1) for px, py in a_pts)
    rev = min(_distance_point_segment_mm(px, py, ax0, ay0, ax1, ay1) for px, py in b_pts)

    return min(direct, rev)


def _wall_endpoints_rounded(wall: WallElem, eps_mm: float = 1.0) -> set[tuple[float, float]]:
    return {
        (round(wall.start.x_mm / eps_mm) * eps_mm, round(wall.start.y_mm / eps_mm) * eps_mm),
        (round(wall.end.x_mm / eps_mm) * eps_mm, round(wall.end.y_mm / eps_mm) * eps_mm),
    }


def _wall_corner_or_t_overlap_exempt(a: WallElem, b: WallElem, eps_mm: float = 1.0) -> bool:
    """Corner mitres + planar T‑connections: thickness geometry overlaps materially but is modeled as joint."""
    if a.level_id != b.level_id:
        return False
    da = _wall_unit_dir(a)
    db = _wall_unit_dir(b)

    if abs(da[0]) < 1e-9 and abs(da[1]) < 1e-9:
        return False

    if abs(db[0]) < 1e-9 and abs(db[1]) < 1e-9:
        return False

    if abs(da[0] * db[0] + da[1] * db[1]) > 0.05:
        return False

    pts_a = _wall_endpoints_rounded(a, eps_mm)

    pts_b = _wall_endpoints_rounded(b, eps_mm)

    if len(pts_a & pts_b) == 1:
        return True

    tip_lim = max(a.thickness_mm, b.thickness_mm) * 1.8 + 150

    return _min_endpoint_tip_clearance_between(a, b) <= tip_lim


def _opening_plan_midpoint(opening: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx, sy = wall.start.x_mm, wall.start.y_mm
    ex, ey = wall.end.x_mm, wall.end.y_mm
    t = opening.along_t
    return sx + (ex - sx) * t, sy + (ey - sy) * t


def _hosted_t_bounds(host: WallElem, width_mm: float) -> tuple[float, float] | None:
    wl = _wall_length_mm(host)
    if wl < 10:
        return None
    half = width_mm / 2
    usable_t0 = half / wl
    usable_t1 = 1 - half / wl
    if usable_t1 < usable_t0 + 1e-6:
        return None
    return usable_t0, usable_t1


def _opening_t_interval_on_wall(
    opening: DoorElem | WindowElem, wall: WallElem
) -> tuple[float, float] | None:
    wl = _wall_length_mm(wall)
    b = _hosted_t_bounds(wall, opening.width_mm)
    if b is None or wl < 10:
        return None
    at = opening.along_t
    half = opening.width_mm / 2 / wl
    return at - half, at + half


def _intervals_overlap(a0: float, a1: float, b0: float, b1: float, eps: float = 1e-3) -> bool:
    return not (a1 < b0 - eps or b1 < a0 - eps)


def _validate_hosted_opening(
    opening: DoorElem | WindowElem,
    wall_map: dict[str, WallElem],
    *,
    is_door: bool,
    viols: list[Violation],
) -> None:
    host = wall_map.get(opening.wall_id)
    rule = "door_off_wall" if is_door else "window_off_wall"
    unk_rule = "door_not_on_wall" if is_door else "window_off_wall"

    if host is None:
        viols.append(
            Violation(
                rule_id=unk_rule,
                severity="error",
                message="Opening references unknown wall.",
                element_ids=[opening.id],
            )
        )
        return

    wl = _wall_length_mm(host)
    if wl < 10:
        viols.append(
            Violation(
                rule_id=rule,
                severity="error",
                message="Host wall invalid for hosted geometry.",
                element_ids=[opening.id, host.id],
            )
        )
        return

    if opening.width_mm <= 0 or opening.width_mm > wl:
        viols.append(
            Violation(
                rule_id=rule,
                severity="error",
                message="Opening width exceeds usable wall segment length.",
                element_ids=[opening.id, host.id],
            )
        )

    b = _hosted_t_bounds(host, opening.width_mm)
    if b is None:
        viols.append(
            Violation(
                rule_id=rule,
                severity="error",
                message="Opening cannot fit on host wall segment.",
                element_ids=[opening.id, host.id],
            )
        )
        return
    usable_t0, usable_t1 = b

    EPS = 1e-3
    at = opening.along_t
    if isinstance(opening, DoorElem):
        if at <= EPS or at >= 1 - EPS:
            viols.append(
                Violation(
                    rule_id="door_off_wall",
                    severity="warning",
                    message="Door is close to wall endpoint (ambiguous hosting).",
                    element_ids=[opening.id, host.id],
                )
            )

    if not (usable_t0 < at < usable_t1):
        viols.append(
            Violation(
                rule_id=rule,
                severity="error",
                message="Opening extents fall outside wall segment extents.",
                element_ids=[opening.id, host.id],
            )
        )


def evaluate(elements: dict[str, Element]) -> list[Violation]:
    walls: list[WallElem] = []
    doors: list[DoorElem] = []
    windows: list[WindowElem] = []
    rooms: list[RoomElem] = []
    grids: list[GridLineElem] = []
    dims: list[DimensionElem] = []
    levels: list[LevelElem] = []

    viols: list[Violation] = []

    for el in elements.values():
        if isinstance(el, WallElem):
            walls.append(el)
        elif isinstance(el, DoorElem):
            doors.append(el)
        elif isinstance(el, WindowElem):
            windows.append(el)
        elif isinstance(el, RoomElem):
            rooms.append(el)
        elif isinstance(el, GridLineElem):
            grids.append(el)
        elif isinstance(el, DimensionElem):
            dims.append(el)
        elif isinstance(el, LevelElem):
            levels.append(el)

    lvl_by_id = {lv.id for lv in levels}
    lev_pairs = [
        (levels[i], levels[j]) for i in range(len(levels)) for j in range(i + 1, len(levels))
    ]
    for lv, other in lev_pairs:
        if abs(lv.elevation_mm - other.elevation_mm) < 1.0:
            viols.append(
                Violation(
                    rule_id="level_duplicate_elevation",
                    severity="warning",
                    message="Levels have nearly identical elevations (coordinate discipline).",
                    element_ids=sorted({lv.id, other.id}),
                )
            )

    walls_by_level: dict[str, list[WallElem]] = {}
    for wall in walls:
        walls_by_level.setdefault(wall.level_id, []).append(wall)

        if wall.level_id not in lvl_by_id:
            viols.append(
                Violation(
                    rule_id="wall_missing_level",
                    severity="error",
                    message="Wall references unknown level.",
                    element_ids=[wall.id],
                )
            )

        if _wall_length_mm(wall) < 5:
            viols.append(
                Violation(
                    rule_id="wall_zero_length",
                    severity="error",
                    message="Wall length is degenerate (< 5 mm).",
                    element_ids=[wall.id],
                )
            )

    overlap_tol_mm2 = 120.0
    for lw in walls_by_level.values():
        n = len(lw)
        for i in range(n):
            for j in range(i + 1, n):
                a = lw[i]
                b = lw[j]
                pa = wall_corners(
                    (a.start.x_mm, a.start.y_mm),
                    (a.end.x_mm, a.end.y_mm),
                    a.thickness_mm,
                )
                pb = wall_corners(
                    (b.start.x_mm, b.start.y_mm),
                    (b.end.x_mm, b.end.y_mm),
                    b.thickness_mm,
                )
                if not sat_overlap(pa, pb):
                    continue
                # Skip mitre/T junction clashes where centerlines touch at a single elbow.
                if _wall_corner_or_t_overlap_exempt(a, b):
                    continue
                area = approx_overlap_area_mm2(pa, pb)
                if area <= overlap_tol_mm2:
                    continue
                viols.append(
                    Violation(
                        rule_id="wall_overlap",
                        severity="error",
                        message="Wall bodies overlap materially in plan.",
                        element_ids=sorted({a.id, b.id}),
                    )
                )

    wall_map: dict[str, WallElem] = {w.id: w for w in walls}

    for door in doors:
        _validate_hosted_opening(door, wall_map, is_door=True, viols=viols)
    for win in windows:
        _validate_hosted_opening(win, wall_map, is_door=False, viols=viols)

    # overlap along walls for any hosted openings sharing a wall segment
    for wid, wall in wall_map.items():
        op_items: list[DoorElem | WindowElem] = [
            *[d for d in doors if d.wall_id == wid],
            *[w for w in windows if w.wall_id == wid],
        ]
        intervals: list[tuple[float, float, str]] = []
        for op in op_items:
            tup = _opening_t_interval_on_wall(op, wall)
            if tup is None:
                continue
            lo, hi = tup
            intervals.append((lo, hi, op.id))
        ln = len(intervals)
        for i in range(ln):
            lo_i, hi_i, idi = intervals[i]
            for j in range(i + 1, ln):
                lo_j, hi_j, idj = intervals[j]
                if _intervals_overlap(lo_i, hi_i, lo_j, hi_j):
                    viols.append(
                        Violation(
                            rule_id="window_overlaps_door",
                            severity="error",
                            message="Hosted openings materially overlap along the wall segment.",
                            element_ids=sorted({idi, idj, wid}),
                        )
                    )

    for g in grids:
        gx = g.end.x_mm - g.start.x_mm
        gy = g.end.y_mm - g.start.y_mm
        if (gx * gx + gy * gy) ** 0.5 < 5:
            viols.append(
                Violation(
                    rule_id="grid_zero_length",
                    severity="error",
                    message="Grid line is degenerate (< 5 mm).",
                    element_ids=[g.id],
                )
            )

    for d in dims:
        dx = d.b_mm.x_mm - d.a_mm.x_mm
        dy = d.b_mm.y_mm - d.a_mm.y_mm
        if (dx * dx + dy * dy) ** 0.5 < 5:
            viols.append(
                Violation(
                    rule_id="dimension_zero_length",
                    severity="error",
                    message="Dimension span is degenerate (< 5 mm).",
                    element_ids=[d.id],
                )
            )

        if d.level_id not in lvl_by_id:
            viols.append(
                Violation(
                    rule_id="dimension_bad_level",
                    severity="warning",
                    message="Dimension references unknown level.",
                    element_ids=[d.id],
                )
            )

    if len(doors) == 0 and len(windows) == 0 and len(rooms) > 0:
        for room in rooms:
            viols.append(
                Violation(
                    rule_id="room_no_door",
                    severity="warning",
                    message="Model contains rooms without doors or windows.",
                    element_ids=[room.id],
                )
            )

    elif (len(doors) > 0 or len(windows) > 0) and len(rooms) > 0:
        access_points: list[tuple[float, float]] = []
        for d in doors:
            host = wall_map.get(d.wall_id)
            if host:
                access_points.append(_opening_plan_midpoint(d, host))
        for w in windows:
            host = wall_map.get(w.wall_id)
            if host:
                access_points.append(_opening_plan_midpoint(w, host))

        max_dist_mm = 3500.0
        if access_points:
            for room in rooms:
                xmin, xmax, ymin, ymax = _room_bbox(room)
                cx = (xmin + xmax) / 2
                cy = (ymin + ymax) / 2
                if not any(
                    ((cx - px) ** 2 + (cy - py) ** 2) ** 0.5 <= max_dist_mm
                    for (px, py) in access_points
                ):
                    viols.append(
                        Violation(
                            rule_id="room_no_door",
                            severity="warning",
                            message="Room centroid is far from any door/window (coordination heuristic).",
                            element_ids=[room.id],
                        )
                    )

    floors = [el for el in elements.values() if isinstance(el, FloorElem)]
    for fl in floors:
        if fl.level_id not in lvl_by_id:
            viols.append(
                Violation(
                    rule_id="floor_missing_level",
                    severity="error",
                    message="Floor references unknown level.",
                    element_ids=[fl.id],
                )
            )
        pts = [(p.x_mm, p.y_mm) for p in fl.boundary_mm]
        if polygon_area_abs_mm2(pts) < 10_000.0:
            viols.append(
                Violation(
                    rule_id="floor_polygon_degenerate",
                    severity="warning",
                    message="Floor boundary has negligible plan area.",
                    element_ids=[fl.id],
                )
            )

    for op in elements.values():
        if not isinstance(op, SlabOpeningElem):
            continue
        host = elements.get(op.host_floor_id)
        if not isinstance(host, FloorElem):
            viols.append(
                Violation(
                    rule_id="slab_opening_missing_floor",
                    severity="error",
                    message="Slab opening references missing floor.",
                    element_ids=[op.id],
                )
            )
        ob = [(p.x_mm, p.y_mm) for p in op.boundary_mm]
        if polygon_area_abs_mm2(ob) < 2500.0:
            viols.append(
                Violation(
                    rule_id="slab_opening_polygon_degenerate",
                    severity="warning",
                    message="Slab opening boundary is negligible.",
                    element_ids=[op.id],
                )
            )

    for st in elements.values():
        if not isinstance(st, StairElem):
            continue
        for lid in (st.base_level_id, st.top_level_id):
            if lid not in lvl_by_id:
                viols.append(
                    Violation(
                        rule_id="stair_missing_levels",
                        severity="error",
                        message="Stair references unknown level.",
                        element_ids=[st.id],
                    )
                )
        bl = elements.get(st.base_level_id)
        tl = elements.get(st.top_level_id)
        if isinstance(bl, LevelElem) and isinstance(tl, LevelElem):
            rise = abs(tl.elevation_mm - bl.elevation_mm)
            if st.riser_mm > 0:
                estimate = rise / st.riser_mm
                if rise > 500 and estimate < 2:
                    viols.append(
                        Violation(
                            rule_id="stair_geometry_unreasonable",
                            severity="warning",
                            message="Stair rise vs riser sizing looks impossible for modeled levels.",
                            element_ids=[st.id],
                        )
                    )

            tread = st.tread_mm
            rise_step = st.riser_mm
            if (
                rise_step > 190.1
                or (tread > 0 and tread + 1e-6 < 259.99)
                or (rise_step < 155 and rise > 2000)
            ):
                viols.append(
                    Violation(
                        rule_id="stair_comfort_eu_proxy",
                        severity="info",
                        message=(
                            "Stair tread/riser differs from documented EU residential comfort proxy "
                            "(≥ 260 mm tread depth, ≤ 190 mm riser)."
                        ),
                        element_ids=[st.id],
                    )
                )

    val_rules = [vr for vr in elements.values() if isinstance(vr, ValidationRuleElem)]
    enforce_clean = any(
        bool(v.rule_json.get("enforceCleanroomDoorFamilyTypes"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )
    if enforce_clean:
        for d in doors:
            if d.family_type_id is None:
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_door_without_family_type",
                        severity="warning",
                        message="Door instance missing required family/type reference for IDS/cleanroom rules.",
                        element_ids=[d.id],
                    )
                )

    return annotate_violation_disciplines(viols)
