from __future__ import annotations

# ruff: noqa: F401,I001

from bim_ai.constraints_core import (
    _MATERIAL_CATALOG_AUDIT_MESSAGES,
    _MATERIAL_CATALOG_AUDIT_RULE_IDS,
    _RULE_BLOCKING_CLASS,
    _RULE_DISCIPLINE,
    _SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
    _SHEET_DEFAULT_TITLEBLOCK_SYMBOL,
    _SHEET_VIEWPORT_MIN_SIDE_MM,
    AdvisorBlockingClass,
    Violation,
    annotate_violation_blocking_classes,
    annotate_violation_disciplines,
)
from bim_ai.constraints_geometry import (
    clip_convex_against_convex,
    ear_clip_triangulate,
    polygon_bbox,
    polygon_overlap_area_mm2,
    polygon_signed_area,
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

_viewport_dimension_mm = viewport_dimension_mm
_repair_sheet_viewport_extents_inplace_rows = repair_sheet_viewport_extents_inplace_rows
_sheet_viewport_zero_extent_labels = sheet_viewport_zero_extent_labels

_polygon_signed_area = polygon_signed_area
_polygon_bbox = polygon_bbox
_ear_clip_triangulate = ear_clip_triangulate
_clip_convex_against_convex = clip_convex_against_convex
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
from bim_ai.constraints_evaluation import (  # noqa: E402,F401
    _plan_on_sheet_advisory_violations,
    _toposolid_pierce_check_violations,
    _validate_hosted_opening,
    evaluate,
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
