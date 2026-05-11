from __future__ import annotations

import json
import math
from collections import defaultdict
from typing import Any, Literal

from bim_ai.constraints_core import (
    _MATERIAL_CATALOG_AUDIT_MESSAGES,
    _MATERIAL_CATALOG_AUDIT_RULE_IDS,
    _SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
    _SHEET_DEFAULT_TITLEBLOCK_SYMBOL,
    Violation,
    annotate_violation_blocking_classes,
    annotate_violation_disciplines,
)
from bim_ai.constraints_geometry import (
    polygon_area_abs_mm2,
    polygon_overlap_area_mm2,
)
from bim_ai.constraints_sheet_viewports import (
    repair_sheet_viewport_extents_inplace_rows,
    sheet_viewport_zero_extent_labels,
    viewport_dimension_mm,
)
from bim_ai.constraints_wall_geometry import (
    ROOM_UNENCLOSED_GAP_TOL_MM,
    ROOM_UNENCLOSED_PARALLEL_TOL_RAD,
    ROOM_UNENCLOSED_SEPARATION_PERP_TOL_MM,
    distance_point_segment_mm,
    hosted_t_bounds,
    interval_union_uncovered,
    intervals_overlap,
    min_endpoint_tip_clearance_between,
    opening_plan_midpoint,
    opening_t_interval_on_wall,
    room_bbox,
    segment_axis_coverage,
    wall_corner_or_t_overlap_exempt,
    wall_endpoints_rounded,
    wall_length_mm,
    wall_unit_dir,
)
from bim_ai.constructability_advisories import constructability_advisory_violations
from bim_ai.constructability_scope import scope_constructability_elements
from bim_ai.datum_levels import (
    expected_level_elevation_from_parent,
    level_datum_cycle_participant_level_ids,
    level_datum_topo_order_if_acyclic,
)
from bim_ai.document import Document
from bim_ai.elements import (
    BcfElem,
    DimensionElem,
    DoorElem,
    Element,
    FamilyTypeElem,
    FloorElem,
    GridLineElem,
    LevelElem,
    PlanViewElem,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    SlabOpeningElem,
    StairElem,
    ToposolidElem,
    ValidationRuleElem,
    WallElem,
    WindowElem,
)
from bim_ai.geometry import Poly, approx_overlap_area_mm2, sat_overlap, wall_corners
from bim_ai.material_assembly_resolve import (
    material_catalog_audit_rows,
)
from bim_ai.plan_aa_room_separation import axis_aligned_room_separation_splits_rectangle
from bim_ai.room_derivation import compute_room_boundary_derivation
from bim_ai.room_finish_schedule import peer_finish_set_by_level
from bim_ai.schedule_sheet_export_parity import (
    ADV_CSV_DIVERGES as _PARITY_ADV_CSV_DIVERGES,
)
from bim_ai.schedule_sheet_export_parity import (
    ADV_JSON_DIVERGES as _PARITY_ADV_JSON_DIVERGES,
)
from bim_ai.schedule_sheet_export_parity import (
    ADV_LISTING_DIVERGES as _PARITY_ADV_LISTING_DIVERGES,
)
from bim_ai.schedule_sheet_export_parity import (
    PARITY_CSV_DIVERGES as _PARITY_CSV_DIVERGES,
)
from bim_ai.schedule_sheet_export_parity import (
    PARITY_JSON_DIVERGES as _PARITY_JSON_DIVERGES,
)
from bim_ai.schedule_sheet_export_parity import (
    PARITY_LISTING_DIVERGES as _PARITY_LISTING_DIVERGES,
)
from bim_ai.schedule_sheet_export_parity import (
    collect_schedule_sheet_export_parity_rows_for_doc,
)
from bim_ai.sheet_titleblock_revision_issue_v1 import (
    normalize_titleblock_revision_issue_v1,
    sheet_revision_issue_metadata_present,
)
from bim_ai.stair_plan_proxy import stair_schedule_row_extensions_v1

ROOM_PLAN_OVERLAP_THRESHOLD_MM2 = 50_000.0


_viewport_dimension_mm = viewport_dimension_mm
_repair_sheet_viewport_extents_inplace_rows = repair_sheet_viewport_extents_inplace_rows
_sheet_viewport_zero_extent_labels = sheet_viewport_zero_extent_labels
_polygon_overlap_area_mm2 = polygon_overlap_area_mm2


_room_bbox = room_bbox
_ROOM_UNENCLOSED_PARALLEL_TOL_RAD = ROOM_UNENCLOSED_PARALLEL_TOL_RAD
_ROOM_UNENCLOSED_GAP_TOL_MM = ROOM_UNENCLOSED_GAP_TOL_MM
_ROOM_UNENCLOSED_SEPARATION_PERP_TOL_MM = ROOM_UNENCLOSED_SEPARATION_PERP_TOL_MM
_segment_axis_coverage = segment_axis_coverage
_interval_union_uncovered = interval_union_uncovered
_wall_length_mm = wall_length_mm
_wall_unit_dir = wall_unit_dir
_distance_point_segment_mm = distance_point_segment_mm
_min_endpoint_tip_clearance_between = min_endpoint_tip_clearance_between
_wall_endpoints_rounded = wall_endpoints_rounded
_wall_corner_or_t_overlap_exempt = wall_corner_or_t_overlap_exempt
_opening_plan_midpoint = opening_plan_midpoint
_hosted_t_bounds = hosted_t_bounds
_opening_t_interval_on_wall = opening_t_interval_on_wall
_intervals_overlap = intervals_overlap


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
        viols.append(
            Violation(
                rule_id="schedule_opening_orphan_host",
                severity="info",
                message=(
                    "Hosted opening references a missing wall host (schedule rows cannot resolve wallId)."
                ),
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


from bim_ai.constraints_advisories import (  # noqa: E402,F401
    _agent_brief_advisory_violations,
    _append_schedule_opening_qa_violations,
    _elements_have_room_programme_metadata,
    _exchange_advisory_violations,
    _gltf_manifest_closure_advisory_violations,
    _ids_authoritative_replay_map_pointer_suffix,
    _plan_view_tag_style_advisor_violations,
    _validation_rules_any_cleanroom_ids,
)


def evaluate(
    elements: dict[str, Element],
    *,
    constructability_profile: str = "authoring_default",
    phase_filter: str = "all",
    option_locks: dict[str, str] | None = None,
    design_option_sets: list[Any] | None = None,
) -> list[Violation]:
    walls: list[WallElem] = []
    doors: list[DoorElem] = []
    windows: list[WindowElem] = []
    rooms: list[RoomElem] = []
    grids: list[GridLineElem] = []
    dims: list[DimensionElem] = []
    room_separations: list[RoomSeparationElem] = []
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
        elif isinstance(el, RoomSeparationElem):
            room_separations.append(el)
        elif isinstance(el, LevelElem):
            levels.append(el)

    lvl_by_id = {lv.id for lv in levels}
    lev_elem_by_id = {lv.id: lv for lv in levels}

    datum_cycle_levels = level_datum_cycle_participant_level_ids(elements)
    if datum_cycle_levels:
        viols.append(
            Violation(
                rule_id="level_datum_parent_cycle",
                severity="error",
                message=(
                    "Level datum parent pointers form a cycle among levels; "
                    "dependent offsets cannot propagate deterministically."
                ),
                element_ids=list(datum_cycle_levels),
            )
        )

    for lv in sorted(levels, key=lambda x: x.id):
        pid = lv.parent_level_id
        if pid is None or not str(pid).strip():
            continue
        parent_el = elements.get(pid)
        if parent_el is None or not isinstance(parent_el, LevelElem):
            viols.append(
                Violation(
                    rule_id="level_parent_unresolved",
                    severity="error",
                    message="Level parentLevelId does not resolve to a level element.",
                    element_ids=sorted({lv.id, pid}),
                )
            )

    for e in elements.values():
        if isinstance(e, PlanViewElem):
            plid = e.level_id
            if plid and str(plid).strip() and plid not in lvl_by_id:
                viols.append(
                    Violation(
                        rule_id="elevation_marker_view_unresolved",
                        severity="error",
                        message="Plan view references unknown level.",
                        element_ids=[e.id],
                    )
                )
        if isinstance(e, BcfElem):
            sid = e.section_cut_id
            if sid and str(sid).strip():
                tgt = elements.get(sid)
                if not isinstance(tgt, SectionCutElem):
                    viols.append(
                        Violation(
                            rule_id="section_level_reference_missing",
                            severity="error",
                            message="BCF issue references unknown section cut.",
                            element_ids=sorted({e.id, sid}),
                        )
                    )

    if level_datum_topo_order_if_acyclic(elements) is not None:
        for lv in sorted(levels, key=lambda x: x.id):
            pid = lv.parent_level_id
            if pid is None:
                continue
            parent_lv = lev_elem_by_id.get(pid)
            if parent_lv is None:
                continue
            exp_mm = expected_level_elevation_from_parent(parent_lv, lv.offset_from_parent_mm)
            if abs(lv.elevation_mm - exp_mm) >= 1.0:
                viols.append(
                    Violation(
                        rule_id="level_datum_parent_offset_mismatch",
                        severity="warning",
                        message=(
                            "Level elevationMm differs from parent level datum plus offsetFromParentMm."
                        ),
                        element_ids=sorted({lv.id, pid}),
                    )
                )

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

        bid = wall.base_constraint_level_id
        tid = wall.top_constraint_level_id
        if bid and tid:
            bl = lev_elem_by_id.get(bid)
            tl = lev_elem_by_id.get(tid)
            if isinstance(bl, LevelElem) and isinstance(tl, LevelElem):
                b_z = float(bl.elevation_mm) + wall.base_constraint_offset_mm
                t_z = float(tl.elevation_mm) + wall.top_constraint_offset_mm
                if b_z >= t_z - 1e-6:
                    viols.append(
                        Violation(
                            rule_id="wall_constraint_levels_inverted",
                            severity="warning",
                            message=(
                                "Wall base constraint Z is not below top constraint Z; "
                                "vertical extent from level datums is inconsistent."
                            ),
                            element_ids=sorted({wall.id, bid, tid}),
                        )
                    )

    overlap_tol_mm2 = 120.0
    for lw in walls_by_level.values():
        n = len(lw)
        # Pre-compute AABBs to quickly skip non-overlapping pairs without expensive SAT.
        bboxes: list[tuple[float, float, float, float]] = []
        for w in lw:
            half_t = w.thickness_mm / 2
            bboxes.append(
                (
                    min(w.start.x_mm, w.end.x_mm) - half_t,
                    min(w.start.y_mm, w.end.y_mm) - half_t,
                    max(w.start.x_mm, w.end.x_mm) + half_t,
                    max(w.start.y_mm, w.end.y_mm) + half_t,
                )
            )
        for i in range(n):
            ax0, ay0, ax1, ay1 = bboxes[i]
            for j in range(i + 1, n):
                bx0, by0, bx1, by1 = bboxes[j]
                if ax1 < bx0 or bx1 < ax0 or ay1 < by0 or by1 < ay0:
                    continue
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

    _append_schedule_opening_qa_violations(wall_map, doors, windows, viols)

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
        glid = g.level_id
        if glid is not None and str(glid).strip() and str(glid) not in lvl_by_id:
            viols.append(
                Violation(
                    rule_id="datum_grid_reference_missing",
                    severity="error",
                    message="Grid line references unknown level for datum association.",
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

    finish_set_donor_by_level = peer_finish_set_by_level(rooms)

    for room in rooms:
        pts = [(p.x_mm, p.y_mm) for p in room.outline_mm]
        if len(pts) < 3:
            viols.append(
                Violation(
                    rule_id="room_outline_degenerate",
                    severity="warning",
                    message="Room outline has fewer than three corners (cannot compute usable area).",
                    element_ids=[room.id],
                )
            )
            continue

        area_mm2 = polygon_area_abs_mm2(pts)
        if area_mm2 < 1_000:
            viols.append(
                Violation(
                    rule_id="room_outline_degenerate",
                    severity="warning",
                    message="Room outline has negligible plan area (< ~1 m²).",
                    element_ids=[room.id],
                )
            )
        else:
            pc = (room.programme_code or "").strip()
            dept = (room.department or "").strip()
            if not pc and not dept:
                viols.append(
                    Violation(
                        rule_id="room_programme_metadata_hint",
                        severity="info",
                        message="Room lacks programmeCode and department; documentation schedules/color correlation are weaker.",
                        element_ids=[room.id],
                    )
                )
            fs = (room.finish_set or "").strip()
            if (pc or dept) and not fs:
                peer_finish = finish_set_donor_by_level.get(room.level_id)
                finish_qfix: dict[str, Any] | None = None
                if peer_finish and peer_finish.strip():
                    finish_qfix = {
                        "type": "updateElementProperty",
                        "elementId": room.id,
                        "key": "finishSet",
                        "value": peer_finish,
                    }
                viols.append(
                    Violation(
                        rule_id="room_finish_metadata_hint",
                        severity="info",
                        message=(
                            "Room has programme or department metadata but finishSet is blank; "
                            "finish schedules may be incomplete."
                        ),
                        element_ids=[room.id],
                        quick_fix_command=finish_qfix,
                    )
                )

        tgt = room.target_area_m2
        if tgt is not None:
            actual_m2 = area_mm2 / 1_000_000.0
            tv = float(tgt)
            if abs(actual_m2 - tv) > max(0.25, 0.05 * tv):
                viols.append(
                    Violation(
                        rule_id="room_target_area_mismatch",
                        severity="info",
                        message=(
                            f"Room outline area ({actual_m2:.3f} m²) differs from targetAreaM2 ({tv:.3f} m²) "
                            "beyond the advisory tolerance."
                        ),
                        element_ids=[room.id],
                    )
                )

    seps_by_level: dict[str, list[RoomSeparationElem]] = defaultdict(list)
    for sep in room_separations:
        if sep.level_id not in lvl_by_id:
            continue
        seps_by_level[sep.level_id].append(sep)

    for room in rooms:
        if len(room.outline_mm) < 3:
            continue
        xmin, xmax, ymin, ymax = _room_bbox(room)
        if xmax <= xmin or ymax <= ymin:
            continue
        for sep in seps_by_level.get(room.level_id, ()):
            if axis_aligned_room_separation_splits_rectangle(
                sep.start.x_mm,
                sep.start.y_mm,
                sep.end.x_mm,
                sep.end.y_mm,
                xmin,
                xmax,
                ymin,
                ymax,
            ):
                viols.append(
                    Violation(
                        rule_id="room_outline_spans_axis_room_separation",
                        severity="info",
                        message=(
                            "Room axis-aligned bbox is crossed by an axis-aligned room separation "
                            "inside the footprint; consider splitting into two RoomElem outlines "
                            "or relocating the separator."
                        ),
                        element_ids=sorted({room.id, sep.id}),
                    )
                )

    doc_snap = Document(elements=dict(elements))
    rb = compute_room_boundary_derivation(doc_snap)
    for d in rb.get("diagnostics") or []:
        if not isinstance(d, dict):
            continue
        code = str(d.get("code") or "")
        if code == "axis_segments_insufficient_for_closure":
            viols.append(
                Violation(
                    rule_id="room_boundary_axis_closure_insufficient_segments",
                    severity="info",
                    message=str(
                        d.get("message")
                        or "Insufficient orthogonal wall/separator segments to close an axis-aligned rectangle."
                    ),
                    element_ids=sorted(d.get("elementIds") or []),
                )
            )
            continue
        if code == "axis_boundary_segment_enum_cap":
            viols.append(
                Violation(
                    rule_id="room_boundary_axis_segment_enum_cap",
                    severity="info",
                    message=str(
                        d.get("message")
                        or "Orthogonal boundary segment count exceeds the axis-aligned rectangle enumeration cap."
                    ),
                    element_ids=sorted(d.get("elementIds") or []),
                )
            )
            continue
        if code == "axis_segments_missing_orientation_mix":
            viols.append(
                Violation(
                    rule_id="room_boundary_axis_segments_missing_orientation_mix",
                    severity="info",
                    message=str(
                        d.get("message")
                        or "Orthogonal segments lack both horizontal and vertical orientations for rectangle closure."
                    ),
                    element_ids=sorted(d.get("elementIds") or []),
                )
            )
            continue
        if code == "non_axis_boundary_segments_skipped":
            viols.append(
                Violation(
                    rule_id="room_boundary_non_axis_segments_skipped",
                    severity="info",
                    message=str(
                        d.get("message")
                        or "Non-axis-aligned walls or room separations are excluded from axis-aligned derivation."
                    ),
                    element_ids=sorted(d.get("elementIds") or []),
                )
            )
            continue
        if code == "ambiguous_interior_separation":
            eids: set[str] = set()
            for k in ("separationIds", "wallIds"):
                for x in d.get(k) or []:
                    eids.add(str(x))
            for x in d.get("boundarySeparationIds") or []:
                eids.add(str(x))
            viols.append(
                Violation(
                    rule_id="room_derived_interior_separation_ambiguous",
                    severity="warning",
                    message=(
                        "Derived rectangle interior is split by a room separation; "
                        "authoritative vacant footprint is ambiguous."
                    ),
                    element_ids=sorted(eids),
                )
            )
            continue

    rooms_by_level: dict[str, list[RoomElem]] = defaultdict(list)
    for room in rooms:
        rooms_by_level[room.level_id].append(room)

    for _lvl, mates in rooms_by_level.items():
        peers_meta = [
            rr for rr in mates if (rr.programme_code or "").strip() or (rr.department or "").strip()
        ]
        if not peers_meta:
            continue
        ref_peer = sorted(peers_meta, key=lambda rr: rr.id)[0]
        ref_pc = (ref_peer.programme_code or "").strip()
        for r in mates:
            if (r.programme_code or "").strip() or (r.department or "").strip():
                continue
            qfix: dict[str, Any] | None = None
            if ref_pc:
                qfix = {
                    "type": "updateElementProperty",
                    "elementId": r.id,
                    "key": "programmeCode",
                    "value": ref_pc,
                }
            viols.append(
                Violation(
                    rule_id="room_programme_inconsistent_within_level",
                    severity="warning",
                    message=(
                        "Another room on this level has programme metadata but this room is blank; "
                        "colour fills, legends, and room schedules may disagree until programme is aligned."
                    ),
                    element_ids=[r.id],
                    quick_fix_command=qfix,
                )
            )

    for _lid, rlist in rooms_by_level.items():
        for i in range(len(rlist)):
            for j in range(i + 1, len(rlist)):
                ri, rj = rlist[i], rlist[j]
                pi = [(p.x_mm, p.y_mm) for p in ri.outline_mm]
                pj = [(p.x_mm, p.y_mm) for p in rj.outline_mm]
                if len(pi) < 3 or len(pj) < 3:
                    continue
                pa = Poly(tuple(pi))
                pb = Poly(tuple(pj))
                if not sat_overlap(pa, pb):
                    continue
                approx_a = approx_overlap_area_mm2(pa, pb, spacing_mm=200.0)
                if approx_a >= ROOM_PLAN_OVERLAP_THRESHOLD_MM2:
                    approx_m2 = approx_a / 1_000_000.0
                    severity = "error" if approx_a >= 2_000_000.0 else "warning"
                    viols.append(
                        Violation(
                            rule_id="room_overlap_plan",
                            severity=severity,
                            message=(
                                "Room outlines on the same level overlap materially in plan "
                                f"(approx {approx_m2:.2f} m² overlap by sampling)."
                            ),
                            element_ids=sorted({ri.id, rj.id}),
                        )
                    )

    # VAL-01: room_unenclosed — wall-graph closure check.
    # For each room polygon edge, verify continuous coverage by walls or
    # room-separation lines on the same level. Distinct from room_no_door
    # (centroid heuristic): catches rooms whose boundary has true gaps.
    if rooms:
        walls_by_lvl: dict[str, list[tuple[tuple[float, float], tuple[float, float], float]]] = (
            defaultdict(list)
        )
        for w in walls:
            walls_by_lvl[w.level_id].append(
                (
                    (w.start.x_mm, w.start.y_mm),
                    (w.end.x_mm, w.end.y_mm),
                    max(50.0, float(w.thickness_mm)),
                )
            )
        seps_by_lvl: dict[str, list[tuple[tuple[float, float], tuple[float, float]]]] = defaultdict(
            list
        )
        for sep in room_separations:
            seps_by_lvl[sep.level_id].append(
                ((sep.start.x_mm, sep.start.y_mm), (sep.end.x_mm, sep.end.y_mm))
            )

        for room in rooms:
            outline = [(p.x_mm, p.y_mm) for p in room.outline_mm]
            if len(outline) < 3:
                continue
            wall_segs = walls_by_lvl.get(room.level_id, [])
            sep_segs = seps_by_lvl.get(room.level_id, [])
            if not wall_segs and not sep_segs:
                viols.append(
                    Violation(
                        rule_id="room_unenclosed",
                        severity="warning",
                        message=(
                            "Room has no walls or room-separation lines on its level; "
                            "boundary is not enclosed."
                        ),
                        element_ids=[room.id],
                    )
                )
                continue

            uncovered_edges: list[int] = []
            n_edges = len(outline)
            for i in range(n_edges):
                p1 = outline[i]
                p2 = outline[(i + 1) % n_edges]
                edge_len = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                if edge_len < 1.0:
                    continue
                intervals: list[tuple[float, float]] = []
                for seg_a, seg_b, thk in wall_segs:
                    perp_tol = max(thk / 2.0 + 50.0, 150.0)
                    iv = _segment_axis_coverage(p1, p2, seg_a, seg_b, perp_tol)
                    if iv is not None:
                        intervals.append(iv)
                for seg_a, seg_b in sep_segs:
                    iv = _segment_axis_coverage(
                        p1, p2, seg_a, seg_b, _ROOM_UNENCLOSED_SEPARATION_PERP_TOL_MM
                    )
                    if iv is not None:
                        intervals.append(iv)
                uncovered = _interval_union_uncovered(intervals, edge_len)
                if uncovered:
                    uncovered_edges.append(i)

            if uncovered_edges:
                viols.append(
                    Violation(
                        rule_id="room_unenclosed",
                        severity="warning",
                        message=(
                            f"Room boundary has {len(uncovered_edges)} edge(s) without a "
                            f"backing wall or room-separation line on the same level "
                            f"(uncovered edge indices: {uncovered_edges})."
                        ),
                        element_ids=[room.id],
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

    # SKT-04 — floor / slab overlap warning
    floors_by_level: dict[str, list[FloorElem]] = defaultdict(list)
    for fl in floors:
        if fl.level_id in lvl_by_id and len(fl.boundary_mm) >= 3:
            floors_by_level[fl.level_id].append(fl)
    for level_floors in floors_by_level.values():
        n = len(level_floors)
        for i in range(n):
            poly_a = [(p.x_mm, p.y_mm) for p in level_floors[i].boundary_mm]
            for j in range(i + 1, n):
                poly_b = [(p.x_mm, p.y_mm) for p in level_floors[j].boundary_mm]
                area_mm2 = _polygon_overlap_area_mm2(poly_a, poly_b)
                if area_mm2 > 1.0:
                    a_id = level_floors[i].id
                    b_id = level_floors[j].id
                    viols.append(
                        Violation(
                            rule_id="floor_overlap",
                            severity="warning",
                            message=(
                                f"Floors '{a_id}' and '{b_id}' overlap on the same level "
                                f"(≈{area_mm2 / 1_000_000.0:.2f} m²)."
                            ),
                            element_ids=sorted([a_id, b_id]),
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

    stair_adv_doc = Document(revision=1, elements=dict(elements))

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

        sx = stair_schedule_row_extensions_v1(stair_adv_doc, st)
        st_stat = str(sx.get("stairQuantityDerivationStatus") or "")
        if st_stat == "degenerate_run":
            viols.append(
                Violation(
                    rule_id="stair_schedule_degenerate_run",
                    severity="warning",
                    message="Stair run length is degenerate; schedule run and guardrail readback are unreliable.",
                    element_ids=[st.id],
                )
            )
            viols.append(
                Violation(
                    rule_id="stair_schedule_guardrail_placeholder_uncorrelated",
                    severity="info",
                    message="Guardrail placeholder readback is unavailable without a stable stair run segment.",
                    element_ids=[st.id],
                )
            )
        elif st_stat == "incomplete_riser_tread":
            viols.append(
                Violation(
                    rule_id="stair_schedule_incomplete_riser_tread",
                    severity="warning",
                    message="Stair riser/tread sizing or riser count is unusable for schedule quantity readback.",
                    element_ids=[st.id],
                )
            )

    doc_audit = Document(revision=1, elements=dict(elements))
    for audit_row in material_catalog_audit_rows(doc_audit):
        stat = str(audit_row.get("catalogStatus") or "")
        rule_id = _MATERIAL_CATALOG_AUDIT_RULE_IDS.get(stat)
        if rule_id is None:
            continue
        viols.append(
            Violation(
                rule_id=rule_id,
                severity="info",
                message=_MATERIAL_CATALOG_AUDIT_MESSAGES.get(stat, "Material catalog audit issue."),
                element_ids=[str(audit_row["hostElementId"])],
                discipline="exchange",
            )
        )

    val_rules = [vr for vr in elements.values() if isinstance(vr, ValidationRuleElem)]
    enforce_clean_door = any(
        bool(v.rule_json.get("enforceCleanroomDoorFamilyTypes"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )
    enforce_clean_win = any(
        bool(v.rule_json.get("enforceCleanroomWindowFamilyTypes"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )
    if enforce_clean_door:
        for d in doors:
            ft = (getattr(d, "family_type_id", None) or "").strip()
            if not ft:
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_door_without_family_type",
                        severity="warning",
                        message="Door instance missing required family/type reference for IDS/cleanroom rules.",
                        element_ids=[d.id],
                    )
                )

    if enforce_clean_win:
        for el in elements.values():
            if not isinstance(el, WindowElem):
                continue
            ft = (getattr(el, "family_type_id", None) or "").strip()
            if not ft:
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_window_without_family_type",
                        severity="warning",
                        message=(
                            "Window instance missing required family/type reference for IDS/cleanroom rules."
                        ),
                        element_ids=[el.id],
                    )
                )

    enforce_family_link = any(
        bool(v.rule_json.get("enforceCleanroomFamilyTypeLinkage"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )

    def _opening_family_ft_entries() -> list[tuple[str, str, Literal["door", "window"]]]:
        out: list[tuple[str, str, Literal["door", "window"]]] = []
        for d in doors:
            fid = (getattr(d, "family_type_id", None) or "").strip()
            if fid:
                out.append((d.id, fid, "door"))
        for el in elements.values():
            if isinstance(el, WindowElem):
                wid = (getattr(el, "family_type_id", None) or "").strip()
                if wid:
                    out.append((el.id, wid, "window"))
        return out

    if enforce_family_link:
        for el_id, ftid, _kind in _opening_family_ft_entries():
            tgt = elements.get(ftid)
            if not isinstance(tgt, FamilyTypeElem):
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_family_type_unknown",
                        severity="warning",
                        message="Opening references unknown family/type id — IDS metadata cannot be audited.",
                        element_ids=[el_id],
                    )
                )

    def _ftype_param_nonempty(ft_el: FamilyTypeElem, keys: tuple[str, ...]) -> bool:
        p = ft_el.parameters or {}
        if any(isinstance(p.get(k), (int, float)) and p.get(k) != 0 for k in keys):
            return True
        return any(isinstance(p.get(k), str) and str(p.get(k)).strip() for k in keys)

    enforce_clean_class = any(
        bool(v.rule_json.get("enforceCleanroomCleanroomClass"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )
    if enforce_clean_class:
        cr_keys = ("CleanroomClass", "cleanroomClass", "CR_CLASS", "cleanroom_grade")
        for el_id, ftid, kind in _opening_family_ft_entries():
            tgt = elements.get(ftid)
            if not isinstance(tgt, FamilyTypeElem):
                continue
            if not _ftype_param_nonempty(tgt, cr_keys):
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_cleanroom_class_missing",
                        severity="warning",
                        message=(
                            "IDS expects cleanroom classification metadata on the referenced "
                            f"opening family/type ({kind})."
                        ),
                        element_ids=[el_id],
                    )
                )

    enforce_interlock = any(
        bool(v.rule_json.get("enforceCleanroomInterlockGrade"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )
    if enforce_interlock:
        lk_keys = ("InterlockGrade", "interlockGrade", "CleanroomInterlock")
        for d in doors:
            fid = (getattr(d, "family_type_id", None) or "").strip()
            if not fid:
                continue
            tgt = elements.get(fid)
            if not isinstance(tgt, FamilyTypeElem):
                continue
            if not _ftype_param_nonempty(tgt, lk_keys):
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_interlock_grade_missing",
                        severity="warning",
                        message="IDS expects interlock-grade metadata on the referenced door family/type.",
                        element_ids=[d.id],
                    )
                )

    enforce_finish_mat = any(
        bool(v.rule_json.get("enforceCleanroomOpeningFinishMaterial"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )
    if enforce_finish_mat:
        fm_keys = ("Finish", "finish", "Material", "material", "SurfaceFinish", "surface_finish")
        for el_id, ftid, kind in _opening_family_ft_entries():
            tgt = elements.get(ftid)
            if not isinstance(tgt, FamilyTypeElem):
                continue
            if not _ftype_param_nonempty(tgt, fm_keys):
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_opening_finish_material_missing",
                        severity="warning",
                        message=(
                            "IDS expects finish/material metadata on the referenced "
                            f"opening family/type ({kind})."
                        ),
                        element_ids=[el_id],
                    )
                )

    enforce_door_pressure = any(
        bool(v.rule_json.get("enforceCleanroomDoorPressureRating"))
        if isinstance(getattr(v, "rule_json", None), dict)
        else False
        for v in val_rules
    )

    if enforce_door_pressure:

        def _ftype_has_pressure_rating(ft_el: FamilyTypeElem) -> bool:
            p = ft_el.parameters or {}
            for key in (
                "pressureRating",
                "pressure_rating",
                "PressureClass",
                "cleanroomPressureClass",
            ):
                val = p.get(key)
                if isinstance(val, str) and val.strip():
                    return True
                if isinstance(val, (int, float)) and val != 0:
                    return True
            return False

        for d in doors:
            ftid = (getattr(d, "family_type_id", None) or "").strip()
            if not ftid:
                continue
            ft_tgt = elements.get(ftid)

            if not isinstance(ft_tgt, FamilyTypeElem):
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_door_pressure_metadata_missing",
                        severity="warning",
                        message="Door references unknown family/type — cannot evaluate cleanroom pressure metadata.",
                        element_ids=[d.id],
                    )
                )
                continue

            if not _ftype_has_pressure_rating(ft_tgt):
                viols.append(
                    Violation(
                        rule_id="ids_cleanroom_door_pressure_metadata_missing",
                        severity="warning",
                        message="Cleanroom IDS requires pressure-class metadata on the door family/type parameters.",
                        element_ids=[d.id],
                    )
                )

    for sc_el in elements.values():
        if not isinstance(sc_el, ScheduleElem):
            continue
        sheet_link = (sc_el.sheet_id or "").strip()
        if not sheet_link:
            continue
        sheet_tgt = elements.get(sheet_link)
        if not isinstance(sheet_tgt, SheetElem):
            viols.append(
                Violation(
                    rule_id="schedule_orphan_sheet_ref",
                    severity="warning",
                    message=(
                        "Schedule sheetId points to a missing id or an element that is not a sheet; "
                        f"documentation linkage is broken ({sheet_link!r})."
                    ),
                    element_ids=[sc_el.id],
                    quick_fix_command={
                        "type": "updateElementProperty",
                        "elementId": sc_el.id,
                        "key": "sheetId",
                        "value": "",
                    },
                )
            )
            continue

        expected_ref = f"schedule:{sc_el.id}"
        placed = False
        for vp in sheet_tgt.viewports_mm or []:
            if not isinstance(vp, dict):
                continue
            vr = vp.get("viewRef") or vp.get("view_ref")
            if not isinstance(vr, str) or ":" not in vr:
                continue
            kind_raw, ref_raw = vr.split(":", 1)
            if kind_raw.strip().lower() == "schedule" and ref_raw.strip() == sc_el.id:
                placed = True
                break

        if not placed:
            rows = list(sheet_tgt.viewports_mm or [])
            new_vp: dict[str, Any] = {
                "viewportId": f"vp-autoplace-schedule-{sc_el.id}",
                "label": sc_el.name or "Schedule",
                "viewRef": expected_ref,
                "xMm": _SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
                "yMm": _SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
                "widthMm": _SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
                "heightMm": _SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
            }
            viols.append(
                Violation(
                    rule_id="schedule_sheet_viewport_missing",
                    severity="warning",
                    message=(
                        f"Schedule is linked to sheet {sheet_link!r} but that sheet has no viewport "
                        f"with viewRef {expected_ref!r}."
                    ),
                    element_ids=[sc_el.id],
                    quick_fix_command={
                        "type": "upsertSheetViewports",
                        "sheetId": sheet_tgt.id,
                        "viewportsMm": rows + [new_vp],
                    },
                )
            )

    # schedule_not_placed_on_sheet: schedule exists but has no sheetId at all
    for sc_el in sorted(elements.values(), key=lambda x: x.id):
        if not isinstance(sc_el, ScheduleElem):
            continue
        if (sc_el.sheet_id or "").strip():
            continue  # has a sheetId — handled by orphan/viewport rules
        sheets_available = sorted(
            (e for e in elements.values() if isinstance(e, SheetElem)),
            key=lambda s: s.id,
        )
        qfix_unplaced: dict[str, Any] | None = None
        if sheets_available:
            first_sh = sheets_available[0]
            existing_vps = list(first_sh.viewports_mm or [])
            new_vp_unplaced: dict[str, Any] = {
                "viewportId": f"vp-autoplace-schedule-{sc_el.id}",
                "label": sc_el.name or "Schedule",
                "viewRef": f"schedule:{sc_el.id}",
                "xMm": _SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
                "yMm": _SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
                "widthMm": _SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
                "heightMm": _SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
            }
            qfix_unplaced = {
                "type": "upsertSheetViewports",
                "sheetId": first_sh.id,
                "viewportsMm": existing_vps + [new_vp_unplaced],
            }
        viols.append(
            Violation(
                rule_id="schedule_not_placed_on_sheet",
                severity="warning",
                message=(
                    f"Schedule {sc_el.id!r} exists but is not placed on any sheet "
                    "(sheetId is empty; assign sheetId to enable documentation linkage)."
                ),
                element_ids=[sc_el.id],
                quick_fix_command=qfix_unplaced,
            )
        )

    # sheet_viewport_schedule_stale: viewport rowCount cache disagrees with derived rows
    for sh_stale in sorted(
        (e for e in elements.values() if isinstance(e, SheetElem)), key=lambda s: s.id
    ):
        for vp_stale in sh_stale.viewports_mm or []:
            if not isinstance(vp_stale, dict):
                continue
            vr_stale = vp_stale.get("viewRef") or vp_stale.get("view_ref")
            if not isinstance(vr_stale, str) or not vr_stale.startswith("schedule:"):
                continue
            sc_id_stale = vr_stale.split(":", 1)[1].strip()
            cached_rc = vp_stale.get("rowCount")
            if cached_rc is None:
                continue  # no cached count — rule is silent
            try:
                cached_rc_int = int(cached_rc)
            except (TypeError, ValueError):
                continue
            sc_tgt_stale = elements.get(sc_id_stale)
            if not isinstance(sc_tgt_stale, ScheduleElem):
                continue
            try:
                from bim_ai.schedule_derivation import derive_schedule_table as _derive_tbl

                _stale_doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
                tbl_stale = _derive_tbl(_stale_doc, sc_id_stale)
                derived_rc = int(tbl_stale.get("totalRows") or 0)
            except Exception:
                continue
            if derived_rc != cached_rc_int:
                updated_vps_stale = [
                    {**v, "rowCount": derived_rc}
                    if (isinstance(v, dict) and (v.get("viewRef") or v.get("view_ref")) == vr_stale)
                    else v
                    for v in (sh_stale.viewports_mm or [])
                ]
                viols.append(
                    Violation(
                        rule_id="sheet_viewport_schedule_stale",
                        severity="warning",
                        message=(
                            f"Schedule viewport for {sc_id_stale!r} on sheet {sh_stale.id!r} has "
                            f"cached rowCount={cached_rc_int} but current derivation yields "
                            f"{derived_rc} rows; re-derive the schedule to refresh."
                        ),
                        element_ids=[sh_stale.id, sc_id_stale],
                        quick_fix_command={
                            "type": "upsertSheetViewports",
                            "sheetId": sh_stale.id,
                            "viewportsMm": updated_vps_stale,
                        },
                    )
                )

    # schedule_field_registry_gap: schedule category has no registered column order
    for sc_gap in sorted(elements.values(), key=lambda x: x.id):
        if not isinstance(sc_gap, ScheduleElem):
            continue
        filt_gap = dict(sc_gap.filters or {})
        cat_gap = str(filt_gap.get("category") or filt_gap.get("Category") or "").strip().lower()
        if not cat_gap:
            continue
        from bim_ai.schedule_field_registry import SCHEDULE_COLUMN_ORDER as _SCO

        if cat_gap not in _SCO:
            viols.append(
                Violation(
                    rule_id="schedule_field_registry_gap",
                    severity="info",
                    message=(
                        f"Schedule {sc_gap.id!r} uses category {cat_gap!r} which has no registered "
                        "column order in SCHEDULE_COLUMN_ORDER; custom field ordering may be inconsistent."
                    ),
                    element_ids=[sc_gap.id],
                )
            )

    parity_doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
    parity_rows = collect_schedule_sheet_export_parity_rows_for_doc(parity_doc)
    parity_token_to_rule = {
        _PARITY_CSV_DIVERGES: _PARITY_ADV_CSV_DIVERGES,
        _PARITY_JSON_DIVERGES: _PARITY_ADV_JSON_DIVERGES,
        _PARITY_LISTING_DIVERGES: _PARITY_ADV_LISTING_DIVERGES,
    }
    parity_token_messages = {
        _PARITY_CSV_DIVERGES: "CSV row count diverges from JSON …/table totalRows",
        _PARITY_JSON_DIVERGES: "JSON …/table totalRows diverges from derived leaf row count",
        _PARITY_LISTING_DIVERGES: "Sheet listing rows= diverges from JSON …/table totalRows",
    }
    for parity_row in parity_rows:
        token = str(parity_row.get("crossFormatParityToken") or "")
        rule = parity_token_to_rule.get(token)
        if not rule:
            continue
        sched_id = str(parity_row.get("scheduleId") or "")
        sheet_id_val = str(parity_row.get("sheetId") or "")
        viewport_id_val = str(parity_row.get("viewportId") or "")
        eids = [eid for eid in (sched_id, sheet_id_val) if eid]
        viols.append(
            Violation(
                rule_id=rule,
                severity="warning",
                message=(
                    f"{parity_token_messages[token]} — "
                    f"scheduleId={sched_id!r} sheetId={sheet_id_val!r} viewportId={viewport_id_val!r} "
                    f"csv={parity_row.get('csvRowCount')} json={parity_row.get('jsonRowCount')} "
                    f"listing={parity_row.get('svgListingRowCount')}."
                ),
                element_ids=eids,
            )
        )

    sheets_ordered = sorted(
        (el for el in elements.values() if isinstance(el, SheetElem)),
        key=lambda s: s.id,
    )
    for sh_el in sheets_ordered:
        rows_raw = list(sh_el.viewports_mm or [])

        if rows_raw and not (sh_el.title_block or "").strip():
            viols.append(
                Violation(
                    rule_id="sheet_missing_titleblock",
                    severity="warning",
                    message=(
                        "Sheet carries viewports but has no title block symbol; drawing border metadata is ambiguous."
                    ),
                    element_ids=[sh_el.id],
                    quick_fix_command={
                        "type": "updateElementProperty",
                        "elementId": sh_el.id,
                        "key": "titleBlock",
                        "value": _SHEET_DEFAULT_TITLEBLOCK_SYMBOL,
                    },
                )
            )

        tb_norm = normalize_titleblock_revision_issue_v1(sh_el.titleblock_parameters)
        if (
            rows_raw
            and (sh_el.title_block or "").strip()
            and not sheet_revision_issue_metadata_present(tb_norm)
        ):
            viols.append(
                Violation(
                    rule_id="sheet_revision_issue_metadata_missing",
                    severity="warning",
                    message=(
                        "Sheet has a title block and viewports but titleblock revision/issue metadata is incomplete: "
                        "set revisionId and/or revision code (revisionCode or legacy revision) in "
                        "titleblockParameters."
                    ),
                    element_ids=[sh_el.id],
                    quick_fix_command={
                        "type": "updateElementProperty",
                        "elementId": sh_el.id,
                        "key": "titleblockParametersPatch",
                        "value": json.dumps(
                            {"revisionId": "TBR-REV", "revisionCode": "A"}, sort_keys=True
                        ),
                    },
                )
            )

        extent_labels = _sheet_viewport_zero_extent_labels(rows_raw)
        if extent_labels:
            repaired_vps, _ = _repair_sheet_viewport_extents_inplace_rows(rows_raw)
            viols.append(
                Violation(
                    rule_id="sheet_viewport_zero_extent",
                    severity="warning",
                    message=(
                        "Sheet viewport(s) missing or non-positive extent (widthMm/heightMm): "
                        + ", ".join(extent_labels)
                        + "."
                    ),
                    element_ids=[sh_el.id],
                    quick_fix_command={
                        "type": "upsertSheetViewports",
                        "sheetId": sh_el.id,
                        "viewportsMm": repaired_vps,
                    },
                )
            )

        for vp in sh_el.viewports_mm or []:
            if not isinstance(vp, dict):
                continue
            vr = vp.get("viewRef") or vp.get("view_ref")
            if not isinstance(vr, str) or ":" not in vr:
                continue
            kind_raw, ref_raw = vr.split(":", 1)
            kind = kind_raw.strip().lower()
            tgt = ref_raw.strip()
            if not tgt:
                continue
            targ_el = elements.get(tgt)
            ok_kind = False
            if kind == "plan":
                ok_kind = isinstance(targ_el, (PlanViewElem, LevelElem))
            elif kind == "schedule":
                ok_kind = isinstance(targ_el, ScheduleElem)
            elif kind in {"section", "sec"}:
                ok_kind = isinstance(targ_el, SectionCutElem)

            if not ok_kind:
                rows = sh_el.viewports_mm or []
                new_vps = [v for v in rows if v is not vp]
                viols.append(
                    Violation(
                        rule_id="sheet_viewport_unknown_ref",
                        severity="warning",
                        message=f"Sheet viewport refers to unresolved semantic reference ({vr}).",
                        element_ids=[sh_el.id],
                        quick_fix_command={
                            "type": "upsertSheetViewports",
                            "sheetId": sh_el.id,
                            "viewportsMm": new_vps,
                        },
                    )
                )

            if ok_kind and kind == "plan" and isinstance(targ_el, PlanViewElem):
                _plan_on_sheet_advisory_violations(viols, sh_el, vp, targ_el)

    viols.extend(_agent_brief_advisory_violations(elements))
    viols.extend(_exchange_advisory_violations(elements))
    viols.extend(_gltf_manifest_closure_advisory_violations(elements))
    viols.extend(_plan_view_tag_style_advisor_violations(elements))
    viols.extend(_room_color_scheme_advisory_violations(elements))
    viols.extend(_section_on_sheet_advisory_violations(elements))
    viols.extend(_room_boundary_open_violations(elements))
    viols.extend(_monitored_source_drift_advisory_violations(elements))
    viols.extend(_dormer_overflow_advisory_violations(elements))
    viols.extend(_toposolid_pierce_check_violations(elements))
    constructability_elements = scope_constructability_elements(
        elements,
        phase_filter=phase_filter,
        option_locks=option_locks,
        design_option_sets=design_option_sets or (),
    )
    viols.extend(
        constructability_advisory_violations(
            constructability_elements,
            profile=constructability_profile,
        )
    )
    viols.sort(key=lambda v: (v.rule_id, tuple(sorted(v.element_ids)), v.severity))
    annotated = annotate_violation_disciplines(viols)
    return annotate_violation_blocking_classes(annotated)


def _toposolid_pierce_check_violations(elements: dict[str, Element]) -> list[Violation]:
    """TOP-V3-01 — warn when a floor footprint overlaps a toposolid and no slab opening exists.

    A FloorElem whose plan boundary overlaps a ToposolidElem boundary is likely
    piercing the terrain. The advisory is suppressed when any SlabOpeningElem
    hosted on that floor is present (indicating a deliberate cut-through).
    """
    toposolids = [el for el in elements.values() if isinstance(el, ToposolidElem)]
    floors = [el for el in elements.values() if isinstance(el, FloorElem)]
    if not toposolids or not floors:
        return []

    # Collect floors that have at least one slab opening (suppressed floors).
    floors_with_openings: set[str] = set()
    for el in elements.values():
        if isinstance(el, SlabOpeningElem):
            floors_with_openings.add(el.host_floor_id)

    out: list[Violation] = []
    for topo in toposolids:
        topo_poly = [(p.x_mm, p.y_mm) for p in topo.boundary_mm]
        if len(topo_poly) < 3:
            continue
        for floor in floors:
            if floor.id in floors_with_openings:
                continue
            floor_poly = [(p.x_mm, p.y_mm) for p in floor.boundary_mm]
            if len(floor_poly) < 3:
                continue
            overlap = _polygon_overlap_area_mm2(topo_poly, floor_poly)
            if overlap <= 1.0:
                continue
            out.append(
                Violation(
                    rule_id="toposolid_pierce_check",
                    severity="warning",
                    message=(
                        f"Floor '{floor.id}' footprint overlaps toposolid '{topo.id}' "
                        f"(≈{overlap / 1_000_000.0:.2f} m²). "
                        "Add a SlabOpening to suppress this advisory."
                    ),
                    element_ids=sorted([floor.id, topo.id]),
                    blocking=False,
                )
            )
    return out


def _plan_on_sheet_advisory_violations(
    viols: list[Violation],
    sh_el: SheetElem,
    vp: dict[str, Any],
    pv_el: PlanViewElem,
) -> None:
    """Append plan-on-sheet advisory violations for crop agreement between plan view and sheet viewport."""
    vp_id = str(vp.get("viewportId") or vp.get("viewport_id") or "")
    eids = [x for x in [sh_el.id, vp_id, pv_el.id] if x]

    w = _viewport_dimension_mm(vp, "widthMm", "width_mm")
    h = _viewport_dimension_mm(vp, "heightMm", "height_mm")
    zero_extent = (w is None or w <= 0) or (h is None or h <= 0)
    if zero_extent:
        viols.append(
            Violation(
                rule_id="plan_view_sheet_viewport_zero_extent",
                severity="warning",
                message=(
                    f"Plan view {pv_el.id!r} sheet viewport {vp_id!r} on sheet {sh_el.id!r} "
                    "has zero or missing extent (widthMm/heightMm); plan crop cannot be resolved."
                ),
                element_ids=eids,
            )
        )
        return

    cmn, cmx = pv_el.crop_min_mm, pv_el.crop_max_mm
    if cmn is None or cmx is None:
        viols.append(
            Violation(
                rule_id="plan_view_sheet_viewport_crop_missing",
                severity="info",
                message=(
                    f"Plan view {pv_el.id!r} placed on sheet {sh_el.id!r} viewport {vp_id!r} "
                    "has no crop box (cropMinMm/cropMaxMm absent); the plan-on-sheet boundary is unconstrained."
                ),
                element_ids=eids,
            )
        )
        return

    if cmn.x_mm > cmx.x_mm or cmn.y_mm > cmx.y_mm:
        viols.append(
            Violation(
                rule_id="plan_view_sheet_viewport_crop_inverted",
                severity="warning",
                message=(
                    f"Plan view {pv_el.id!r} on sheet {sh_el.id!r} viewport {vp_id!r} "
                    "has inverted crop corners (cropMinMm coordinates exceed cropMaxMm coordinates); "
                    "the crop box is degenerate."
                ),
                element_ids=eids,
            )
        )


from bim_ai.constraints_tail_advisories import (  # noqa: E402,F401
    _dormer_overflow_advisory_violations,
    _dormer_overflow_footprint_vertices,
    _dormer_overflow_point_in_polygon,
    _monitored_source_drift_advisory_violations,
    _room_boundary_open_violations,
    _room_color_scheme_advisory_violations,
    _section_on_sheet_advisory_violations,
    advisorBlockingClassSummary_v1,
    fix_schedule_sheet_placement,
    fix_sheet_viewport_refresh,
)
