from __future__ import annotations

import json
from collections import defaultdict
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.datum_levels import (
    expected_level_elevation_from_parent,
    level_datum_cycle_participant_level_ids,
    level_datum_topo_order_if_acyclic,
)
from bim_ai.document import Document
from bim_ai.elements import (
    AgentAssumptionElem,
    AgentDeviationElem,
    BcfElem,
    DimensionElem,
    DoorElem,
    Element,
    FamilyTypeElem,
    FloorElem,
    GridLineElem,
    LevelElem,
    PlanTagStyleElem,
    PlanViewElem,
    RoomColorSchemeElem,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    SlabOpeningElem,
    StairElem,
    ValidationRuleElem,
    ViewTemplateElem,
    WallElem,
    WindowElem,
)
from bim_ai.export_gltf import (
    EXPORT_GEOMETRY_KINDS,
    GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND,
    GLTF_KNOWN_EXTENSION_TOKENS,
    build_visual_export_manifest,
    exchange_parity_manifest_fields_from_document,
)
from bim_ai.export_ifc import (
    IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS,
    ifc_kernel_geometry_skip_counts,
    ifcopenshell_available,
    kernel_export_eligible,
    summarize_kernel_ifc_semantic_roundtrip,
)
from bim_ai.geometry import Poly, approx_overlap_area_mm2, sat_overlap, wall_corners
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload
from bim_ai.material_assembly_resolve import (
    material_assembly_manifest_evidence,
    material_catalog_audit_rows,
)
from bim_ai.plan_aa_room_separation import axis_aligned_room_separation_splits_rectangle
from bim_ai.room_color_scheme_override_evidence import scheme_override_advisory_violations_for_doc
from bim_ai.room_derivation import compute_room_boundary_derivation, detect_unbounded_rooms_v1
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
from bim_ai.section_on_sheet_integration_evidence_v1 import (
    section_cut_line_present,
    section_profile_token_from_primitives,
)
from bim_ai.section_projection_primitives import build_section_projection_primitives
from bim_ai.sheet_titleblock_revision_issue_v1 import (
    normalize_titleblock_revision_issue_v1,
    sheet_revision_issue_metadata_present,
)
from bim_ai.stair_plan_proxy import stair_schedule_row_extensions_v1

ROOM_PLAN_OVERLAP_THRESHOLD_MM2 = 50_000.0

# Sheet mm rectangle for schedule_sheet_viewport_missing upsertSheetViewports quick-fix (default ISO A0 canvas).
_SCHEDULE_VIEWPORT_AUTOPLACE_X_MM = 800.0
_SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM = 800.0
_SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM = 14_000.0
_SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM = 9000.0

# Degenerate viewport quick-fix clamps (deterministic replay).
_SHEET_VIEWPORT_MIN_SIDE_MM = 10.0
_SHEET_DEFAULT_TITLEBLOCK_SYMBOL = "A1"


class AdvisorBlockingClass(StrEnum):
    geometry = "geometry"
    exchange = "exchange"
    documentation = "documentation"
    schedule = "schedule"
    sheet = "sheet"
    evidence = "evidence"


class Violation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    rule_id: str = Field(alias="ruleId")
    severity: str
    message: str
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    blocking: bool = Field(default=False, alias="blocking")
    quick_fix_command: dict[str, Any] | None = Field(default=None, alias="quickFixCommand")
    discipline: str | None = Field(default=None, alias="discipline")
    blocking_class: str | None = Field(default=None, alias="blockingClass")


_RULE_DISCIPLINE: dict[str, str] = {
    "wall_overlap": "coordination",
    "window_overlaps_door": "coordination",
    "level_duplicate_elevation": "structure",
    "level_datum_parent_cycle": "structure",
    "level_datum_parent_offset_mismatch": "structure",
    "level_parent_unresolved": "structure",
    "datum_grid_reference_missing": "structure",
    "elevation_marker_view_unresolved": "structure",
    "section_level_reference_missing": "coordination",
    "wall_missing_level": "structure",
    "wall_zero_length": "structure",
    "wall_constraint_levels_inverted": "structure",
    "grid_zero_length": "architecture",
    "dimension_zero_length": "architecture",
    "dimension_bad_level": "structure",
    "room_outline_degenerate": "architecture",
    "room_programme_metadata_hint": "architecture",
    "room_finish_metadata_hint": "architecture",
    "room_target_area_mismatch": "architecture",
    "room_programme_inconsistent_within_level": "architecture",
    "room_outline_spans_axis_room_separation": "architecture",
    "room_overlap_plan": "architecture",
    "room_boundary_axis_closure_insufficient_segments": "architecture",
    "room_boundary_axis_segment_enum_cap": "architecture",
    "room_boundary_axis_segments_missing_orientation_mix": "architecture",
    "room_boundary_non_axis_segments_skipped": "architecture",
    "room_derived_interior_separation_ambiguous": "architecture",
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
    "stair_schedule_degenerate_run": "architecture",
    "stair_schedule_incomplete_riser_tread": "architecture",
    "stair_schedule_guardrail_placeholder_uncorrelated": "architecture",
    "ids_cleanroom_door_without_family_type": "agent",
    "ids_cleanroom_window_without_family_type": "agent",
    "ids_cleanroom_door_pressure_metadata_missing": "agent",
    "ids_cleanroom_family_type_unknown": "agent",
    "ids_cleanroom_cleanroom_class_missing": "agent",
    "ids_cleanroom_interlock_grade_missing": "agent",
    "ids_cleanroom_opening_finish_material_missing": "agent",
    "plan_view_sheet_viewport_crop_missing": "coordination",
    "plan_view_sheet_viewport_crop_inverted": "coordination",
    "plan_view_sheet_viewport_zero_extent": "coordination",
    "sheet_viewport_unknown_ref": "coordination",
    "schedule_orphan_sheet_ref": "coordination",
    "schedule_opening_identifier_missing": "coordination",
    "schedule_opening_orphan_host": "coordination",
    "schedule_opening_family_type_incomplete": "coordination",
    "schedule_opening_host_wall_type_incomplete": "coordination",
    "schedule_sheet_viewport_missing": "coordination",
    "schedule_sheet_export_parity_csv_diverges": "coordination",
    "schedule_sheet_export_parity_json_diverges": "coordination",
    "schedule_sheet_export_parity_listing_diverges": "coordination",
    "sheet_missing_titleblock": "coordination",
    "sheet_revision_issue_metadata_missing": "coordination",
    "sheet_viewport_zero_extent": "coordination",
    "exchange_manifest_ifc_gltf_slice_mismatch": "exchange",
    "exchange_ifc_unhandled_geometry_present": "exchange",
    "exchange_ifc_kernel_geometry_skip_summary": "exchange",
    "exchange_ifc_roundtrip_count_mismatch": "exchange",
    "exchange_ifc_roundtrip_programme_mismatch": "exchange",
    "exchange_ifc_ids_identity_pset_gap": "exchange",
    "exchange_ifc_ids_qto_gap": "exchange",
    "exchange_ifc_material_layer_readback_mismatch": "exchange",
    "exchange_ifc_import_preview_extraction_gaps": "exchange",
    "exchange_ifc_import_preview_unsupported_products": "exchange",
    "exchange_ifc_import_preview_ids_pointer_gap": "exchange",
    "exchange_ifc_import_preview_id_collision": "exchange",
    "exchange_ifc_manifest_authoritative_alignment_drift": "exchange",
    "exchange_ifc_manifest_unsupported_alignment_drift": "exchange",
    "exchange_ifc_manifest_ids_pointer_alignment_drift": "exchange",
    "exchange_ifc_qto_stair_gap": "exchange",
    "exchange_ifc_qto_room_gap": "exchange",
    "exchange_ifc_pset_floor_gap": "exchange",
    "exchange_ifc_pset_roof_gap": "exchange",
    "material_catalog_missing_layer_stack": "exchange",
    "material_catalog_stale_assembly_reference": "exchange",
    "material_catalog_missing_material": "exchange",
    "material_catalog_unsupported_layer_function": "exchange",
    "material_catalog_not_propagated": "exchange",
    "agent_brief_assumption_unresolved": "agent",
    "agent_brief_deviation_unacknowledged": "agent",
    "agent_brief_assumption_reference_broken": "agent",
    "plan_view_tag_style_fallback": "architecture",
    "plan_view_tag_style_ref_invalid": "architecture",
    "plan_view_tag_style_target_mismatch": "architecture",
    "plan_view_tag_style_override": "architecture",
    "plan_template_tag_style_ref_invalid": "architecture",
    "room_color_scheme_identity_missing": "architecture",
    "room_color_scheme_row_missing_label": "architecture",
    "room_color_scheme_row_invalid_fill_color": "architecture",
    "room_color_scheme_row_duplicate_override_key": "architecture",
    "section_on_sheet_cut_line_missing": "coordination",
    "section_on_sheet_profile_token_missing": "coordination",
    "section_on_sheet_revision_issue_unresolved": "coordination",
    "gltf_export_manifest_expected_extension_missing": "exchange",
    "gltf_export_manifest_extension_order_drift": "exchange",
    "prd_closeout_advisor_readiness_status_drift": "agent",
    "prd_closeout_section_missing_in_readiness": "agent",
    "prd_closeout_reason_code_drift": "agent",
    # New rules — wave-4 prompt-2
    "room_boundary_open": "architecture",
    # New rules — wave-4 prompt-7
    "schedule_not_placed_on_sheet": "coordination",
    "sheet_viewport_schedule_stale": "coordination",
    "schedule_field_registry_gap": "coordination",
}

_RULE_BLOCKING_CLASS: dict[str, str] = {
    # geometry
    "wall_overlap": "geometry",
    "window_overlaps_door": "geometry",
    "wall_zero_length": "geometry",
    "wall_missing_level": "geometry",
    "wall_constraint_levels_inverted": "geometry",
    "grid_zero_length": "geometry",
    "door_off_wall": "geometry",
    "door_not_on_wall": "geometry",
    "window_off_wall": "geometry",
    "floor_missing_level": "geometry",
    "floor_polygon_degenerate": "geometry",
    "slab_opening_missing_floor": "geometry",
    "slab_opening_polygon_degenerate": "geometry",
    "room_outline_degenerate": "geometry",
    "room_overlap_plan": "geometry",
    "stair_geometry_unreasonable": "geometry",
    "stair_missing_levels": "geometry",
    "stair_comfort_eu_proxy": "geometry",
    "room_boundary_open": "geometry",
    # documentation
    "level_duplicate_elevation": "documentation",
    "level_datum_parent_cycle": "documentation",
    "level_datum_parent_offset_mismatch": "documentation",
    "level_parent_unresolved": "documentation",
    "datum_grid_reference_missing": "documentation",
    "elevation_marker_view_unresolved": "documentation",
    "section_level_reference_missing": "documentation",
    "dimension_zero_length": "documentation",
    "dimension_bad_level": "documentation",
    "room_programme_metadata_hint": "documentation",
    "room_finish_metadata_hint": "documentation",
    "room_target_area_mismatch": "documentation",
    "room_programme_inconsistent_within_level": "documentation",
    "room_outline_spans_axis_room_separation": "documentation",
    "room_boundary_axis_closure_insufficient_segments": "documentation",
    "room_boundary_axis_segment_enum_cap": "documentation",
    "room_boundary_axis_segments_missing_orientation_mix": "documentation",
    "room_boundary_non_axis_segments_skipped": "documentation",
    "room_derived_interior_separation_ambiguous": "documentation",
    "stair_schedule_degenerate_run": "documentation",
    "stair_schedule_incomplete_riser_tread": "documentation",
    "stair_schedule_guardrail_placeholder_uncorrelated": "documentation",
    "ids_cleanroom_door_without_family_type": "documentation",
    "ids_cleanroom_window_without_family_type": "documentation",
    "ids_cleanroom_door_pressure_metadata_missing": "documentation",
    "ids_cleanroom_family_type_unknown": "documentation",
    "ids_cleanroom_cleanroom_class_missing": "documentation",
    "ids_cleanroom_interlock_grade_missing": "documentation",
    "ids_cleanroom_opening_finish_material_missing": "documentation",
    "plan_view_tag_style_fallback": "documentation",
    "plan_view_tag_style_ref_invalid": "documentation",
    "plan_view_tag_style_target_mismatch": "documentation",
    "plan_view_tag_style_override": "documentation",
    "plan_template_tag_style_ref_invalid": "documentation",
    "room_color_scheme_identity_missing": "documentation",
    "room_color_scheme_row_missing_label": "documentation",
    "room_color_scheme_row_invalid_fill_color": "documentation",
    "room_color_scheme_row_duplicate_override_key": "documentation",
    # schedule
    "schedule_opening_identifier_missing": "schedule",
    "schedule_opening_orphan_host": "schedule",
    "schedule_opening_family_type_incomplete": "schedule",
    "schedule_opening_host_wall_type_incomplete": "schedule",
    "schedule_orphan_sheet_ref": "schedule",
    "schedule_sheet_viewport_missing": "schedule",
    "schedule_sheet_export_parity_csv_diverges": "schedule",
    "schedule_sheet_export_parity_json_diverges": "schedule",
    "schedule_sheet_export_parity_listing_diverges": "schedule",
    "schedule_not_placed_on_sheet": "schedule",
    "sheet_viewport_schedule_stale": "schedule",
    "schedule_field_registry_gap": "schedule",
    # sheet
    "plan_view_sheet_viewport_crop_missing": "sheet",
    "plan_view_sheet_viewport_crop_inverted": "sheet",
    "plan_view_sheet_viewport_zero_extent": "sheet",
    "sheet_viewport_unknown_ref": "sheet",
    "sheet_missing_titleblock": "sheet",
    "sheet_revision_issue_metadata_missing": "sheet",
    "sheet_viewport_zero_extent": "sheet",
    "section_on_sheet_cut_line_missing": "sheet",
    "section_on_sheet_profile_token_missing": "sheet",
    "section_on_sheet_revision_issue_unresolved": "sheet",
    # exchange
    "exchange_manifest_ifc_gltf_slice_mismatch": "exchange",
    "exchange_ifc_unhandled_geometry_present": "exchange",
    "exchange_ifc_kernel_geometry_skip_summary": "exchange",
    "exchange_ifc_roundtrip_count_mismatch": "exchange",
    "exchange_ifc_roundtrip_programme_mismatch": "exchange",
    "exchange_ifc_ids_identity_pset_gap": "exchange",
    "exchange_ifc_ids_qto_gap": "exchange",
    "exchange_ifc_material_layer_readback_mismatch": "exchange",
    "exchange_ifc_import_preview_extraction_gaps": "exchange",
    "exchange_ifc_import_preview_unsupported_products": "exchange",
    "exchange_ifc_import_preview_ids_pointer_gap": "exchange",
    "exchange_ifc_import_preview_id_collision": "exchange",
    "exchange_ifc_manifest_authoritative_alignment_drift": "exchange",
    "exchange_ifc_manifest_unsupported_alignment_drift": "exchange",
    "exchange_ifc_manifest_ids_pointer_alignment_drift": "exchange",
    "material_catalog_missing_layer_stack": "exchange",
    "material_catalog_stale_assembly_reference": "exchange",
    "material_catalog_missing_material": "exchange",
    "material_catalog_unsupported_layer_function": "exchange",
    "material_catalog_not_propagated": "exchange",
    "gltf_export_manifest_expected_extension_missing": "exchange",
    "gltf_export_manifest_extension_order_drift": "exchange",
    "exchange_ifc_qto_stair_gap": "exchange",
    "exchange_ifc_qto_room_gap": "exchange",
    "exchange_ifc_pset_floor_gap": "exchange",
    "exchange_ifc_pset_roof_gap": "exchange",
    # evidence
    "agent_brief_assumption_unresolved": "evidence",
    "agent_brief_deviation_unacknowledged": "evidence",
    "agent_brief_assumption_reference_broken": "evidence",
    "prd_closeout_advisor_readiness_status_drift": "evidence",
    "prd_closeout_section_missing_in_readiness": "evidence",
    "prd_closeout_reason_code_drift": "evidence",
}

_MATERIAL_CATALOG_AUDIT_RULE_IDS: dict[str, str] = {
    "missing_layer_stack": "material_catalog_missing_layer_stack",
    "stale_reference": "material_catalog_stale_assembly_reference",
    "missing_material": "material_catalog_missing_material",
    "unsupported_function": "material_catalog_unsupported_layer_function",
    "not_propagated": "material_catalog_not_propagated",
}

_MATERIAL_CATALOG_AUDIT_MESSAGES: dict[str, str] = {
    "missing_layer_stack": (
        "Host has no usable typed layered assembly (missing assembly type id or empty type layer stack)."
    ),
    "stale_reference": "Assembly type id does not resolve to a layered type element in the document.",
    "missing_material": "Typed layer stack exists but one or more layers lack a catalog materialKey.",
    "unsupported_function": "Layer uses a wall-layer function token outside the kernel catalog slice.",
    "not_propagated": (
        "Typed layer stack thickness does not match instance/cut thickness within epsilon "
        "(see material_assembly_resolve layered assembly cut metrics)."
    ),
}


def _viewport_dimension_mm(vp: dict[str, Any], camel_key: str, snake_key: str) -> float | None:
    raw = vp.get(camel_key)
    if raw is None:
        raw = vp.get(snake_key)
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            return None
        try:
            return float(stripped)
        except ValueError:
            return None
    return None


def _repair_sheet_viewport_extents_inplace_rows(
    rows: list[Any],
) -> tuple[list[Any], bool]:
    """Clone viewport rows; clamp invalid or non-positive width/heightMm dict entries."""

    repaired: list[Any] = []
    changed = False
    for vp in rows:
        if not isinstance(vp, dict):
            repaired.append(vp)
            continue
        out = dict(vp)
        w = _viewport_dimension_mm(out, "widthMm", "width_mm")
        h = _viewport_dimension_mm(out, "heightMm", "height_mm")
        if w is None or w <= 0:
            out["widthMm"] = _SHEET_VIEWPORT_MIN_SIDE_MM
            changed = True
        if h is None or h <= 0:
            out["heightMm"] = _SHEET_VIEWPORT_MIN_SIDE_MM
            changed = True
        repaired.append(out)
    return repaired, changed


def _sheet_viewport_zero_extent_labels(rows: list[Any]) -> list[str]:
    labels: list[str] = []
    for idx, vp in enumerate(rows):
        if not isinstance(vp, dict):
            continue
        w = _viewport_dimension_mm(vp, "widthMm", "width_mm")
        h = _viewport_dimension_mm(vp, "heightMm", "height_mm")
        bad = ((w is None) or (w <= 0)) or ((h is None) or (h <= 0))
        if not bad:
            continue
        vid = vp.get("viewportId") or vp.get("viewport_id")
        if isinstance(vid, str) and vid.strip():
            labels.append(vid.strip())
        else:
            labels.append(f"idx={idx}")
    labels.sort()
    return labels


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


def annotate_violation_blocking_classes(violations: list[Violation]) -> list[Violation]:
    out: list[Violation] = []
    for v in violations:
        bc = _RULE_BLOCKING_CLASS.get(v.rule_id, AdvisorBlockingClass.documentation.value)
        out.append(v.model_copy(update={"blocking_class": bc}))
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


def _append_schedule_opening_qa_violations(
    wall_map: dict[str, WallElem],
    doors: list[DoorElem],
    windows: list[WindowElem],
    viols: list[Violation],
) -> None:
    """Deterministic schedule/documentation advisories for door and window rows (WP-V01 / WP-D01)."""

    def _opening_kind_label(op: DoorElem | WindowElem) -> Literal["door", "window"]:
        return "door" if isinstance(op, DoorElem) else "window"

    def _one(opening: DoorElem | WindowElem) -> None:
        kind = _opening_kind_label(opening)
        label = "Door" if kind == "door" else "Window"

        if not (opening.name or "").strip():
            viols.append(
                Violation(
                    rule_id="schedule_opening_identifier_missing",
                    severity="warning",
                    message=f"{label} has no mark/name for schedule identification.",
                    element_ids=[opening.id],
                )
            )

        fid = getattr(opening, "family_type_id", None)
        if fid is None or (isinstance(fid, str) and not fid.strip()):
            viols.append(
                Violation(
                    rule_id="schedule_opening_family_type_incomplete",
                    severity="warning",
                    message=f"{label} is missing familyTypeId (type schedule columns are incomplete).",
                    element_ids=[opening.id],
                )
            )

        host = wall_map.get(opening.wall_id)
        if host is None:
            return
        wt = host.wall_type_id
        if wt is None or (isinstance(wt, str) and not wt.strip()):
            viols.append(
                Violation(
                    rule_id="schedule_opening_host_wall_type_incomplete",
                    severity="warning",
                    message="Host wall has no wallTypeId (hostWallType schedule columns cannot resolve).",
                    element_ids=sorted({opening.id, host.id}),
                )
            )

    for d in sorted(doors, key=lambda x: x.id):
        _one(d)
    for w in sorted(windows, key=lambda x: x.id):
        _one(w)


def _validation_rules_any_cleanroom_ids(val_rules: list[ValidationRuleElem]) -> bool:
    keys = (
        "enforceCleanroomDoorFamilyTypes",
        "enforceCleanroomWindowFamilyTypes",
        "enforceCleanroomFamilyTypeLinkage",
        "enforceCleanroomCleanroomClass",
        "enforceCleanroomInterlockGrade",
        "enforceCleanroomOpeningFinishMaterial",
        "enforceCleanroomDoorPressureRating",
    )
    for v in val_rules:
        rj = getattr(v, "rule_json", None)
        if not isinstance(rj, dict):
            continue
        if any(bool(rj.get(k)) for k in keys):
            return True
    return False


def _elements_have_room_programme_metadata(elements: dict[str, Element]) -> bool:
    for el in elements.values():
        if not isinstance(el, RoomElem):
            continue
        for attr in ("programme_code", "department", "function_label", "finish_set"):
            raw = getattr(el, attr, None)
            if isinstance(raw, str) and raw.strip():
                return True
    return False


def _ids_authoritative_replay_map_pointer_suffix(summary: dict[str, Any]) -> str:
    cs = summary.get("commandSketch")
    if not isinstance(cs, dict):
        return ""
    auth = cs.get("authoritativeReplay_v0")
    if not isinstance(auth, dict) or auth.get("available") is not True:
        return ""
    ids_map = auth.get("idsAuthoritativeReplayMap_v0")
    if not isinstance(ids_map, dict):
        return ""
    spaces = ids_map.get("spaces")
    roofs = ids_map.get("roofs")
    floors = ids_map.get("floors")
    n_space = len(spaces) if isinstance(spaces, list) else 0
    n_roof = len(roofs) if isinstance(roofs, list) else 0
    n_floor = len(floors) if isinstance(floors, list) else 0
    return (
        " IDS linkage evidence: "
        f"{n_space} IfcSpace row(s), {n_roof} IfcRoof row(s), {n_floor} IfcSlab typed-floor row(s) under "
        "summarize_kernel_ifc_semantic_roundtrip."
        "commandSketch.authoritativeReplay_v0.idsAuthoritativeReplayMap_v0."
    )


def _agent_brief_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    """Deterministic agent-brief closure hints (discipline=agent); advisory severities."""

    assumption_ids = {eid for eid, el in elements.items() if isinstance(el, AgentAssumptionElem)}
    out: list[Violation] = []
    for _eid, el in sorted(elements.items(), key=lambda x: x[0]):
        if isinstance(el, AgentAssumptionElem) and el.closure_status == "open":
            out.append(
                Violation(
                    rule_id="agent_brief_assumption_unresolved",
                    severity="warning",
                    message="Agent assumption has closureStatus=open; resolve, accept, or defer.",
                    element_ids=[el.id],
                )
            )
        elif isinstance(el, AgentDeviationElem):
            if not el.acknowledged:
                out.append(
                    Violation(
                        rule_id="agent_brief_deviation_unacknowledged",
                        severity="warning",
                        message="Agent deviation is not acknowledged.",
                        element_ids=[el.id],
                    )
                )
            rid = el.related_assumption_id
            if rid is not None and rid.strip() and rid not in assumption_ids:
                out.append(
                    Violation(
                        rule_id="agent_brief_assumption_reference_broken",
                        severity="warning",
                        message=f"Deviation references missing assumption id {rid!r}.",
                        element_ids=[el.id],
                    )
                )
    return out


def _exchange_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    out: list[Violation] = []
    try:
        doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
    except Exception:
        return []

    parity_keys = (
        "elementCount",
        "countsByKind",
        "exportedGeometryKinds",
        "unsupportedDocumentKindsDetailed",
    )

    try:
        ifc_row = build_ifc_exchange_manifest_payload(doc)
        gltf_ext = build_visual_export_manifest(doc)["extensions"]["BIM_AI_exportManifest_v0"]
    except Exception:
        # Exchange advisories must not mask primary constraint errors, for example
        # zero-length walls that exporter libraries cannot serialize.
        return out

    ifc_slice = {k: ifc_row[k] for k in parity_keys if k in ifc_row}

    gltf_slice = {k: gltf_ext[k] for k in parity_keys if k in gltf_ext}

    if json.dumps(ifc_slice, sort_keys=True) != json.dumps(gltf_slice, sort_keys=True):
        out.append(
            Violation(
                rule_id="exchange_manifest_ifc_gltf_slice_mismatch",
                severity="warning",
                message="IFC exchange manifest parity slice differs from glTF export manifest (investigate exporter drift).",
                element_ids=[],
            )
        )

    parity = exchange_parity_manifest_fields_from_document(doc)

    cbk = parity.get("countsByKind") or {}

    missing: list[str] = []

    for k in sorted(EXPORT_GEOMETRY_KINDS):
        if cbk.get(k, 0) > 0 and k not in IFC_EXCHANGE_EMITTABLE_GEOMETRY_KINDS:
            missing.append(f"{k}:{cbk[k]}")

    if missing:
        out.append(
            Violation(
                rule_id="exchange_ifc_unhandled_geometry_present",
                severity="info",
                message=(
                    "IFC kernel exporter does not emit physical products for some present geometry kinds: "
                    + ", ".join(missing)
                    + "."
                ),
                element_ids=[],
            )
        )

    skip_map = ifc_kernel_geometry_skip_counts(doc)
    if kernel_export_eligible(doc) and any(skip_map.values()):
        parts = [f"{k}:{v}" for k, v in sorted(skip_map.items()) if v]
        out.append(
            Violation(
                rule_id="exchange_ifc_kernel_geometry_skip_summary",
                severity="info",
                message=(
                    "IFC kernel export skips some instances (see ifcKernelGeometrySkippedCounts on "
                    "ifc-manifest / evidence slice): " + ", ".join(parts) + "."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    val_rules = [vr for vr in elements.values() if isinstance(vr, ValidationRuleElem)]
    gate_roundtrip = (
        ifcopenshell_available()
        and kernel_export_eligible(doc)
        and (
            any(skip_map.values())
            or _elements_have_room_programme_metadata(elements)
            or _validation_rules_any_cleanroom_ids(val_rules)
        )
    )
    if gate_roundtrip:
        summary = summarize_kernel_ifc_semantic_roundtrip(doc)
        ids_ptr = _ids_authoritative_replay_map_pointer_suffix(summary)
        rtc = summary.get("roundtripChecks")
        if isinstance(rtc, dict):
            if not rtc.get("allProductCountsMatch", True):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_roundtrip_count_mismatch",
                        severity="warning",
                        message=(
                            "Exported IFC product counts differ from kernel-expected emits "
                            "(summarize_kernel_ifc_semantic_roundtrip.roundtripChecks.productCounts)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            if not rtc.get("allProgrammeFieldsMatch", True):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_roundtrip_programme_mismatch",
                        severity="info",
                        message=(
                            "IFC read-back programme field counts differ from emit-able room programme metadata "
                            "(summarize_kernel_ifc_semantic_roundtrip.roundtripChecks.programmeFields)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            if _validation_rules_any_cleanroom_ids(val_rules) and not rtc.get(
                "allIdentityReferencesMatch", True
            ):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_ids_identity_pset_gap",
                        severity="info",
                        message=(
                            "Cleanroom IDS validation is active but IFC read-back shows incomplete "
                            "Pset_*Common Reference coverage on some emitted products." + ids_ptr
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            if _validation_rules_any_cleanroom_ids(val_rules) and not rtc.get(
                "allQtoLinksMatch", True
            ):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_ids_qto_gap",
                        severity="info",
                        message=(
                            "Cleanroom IDS validation is active but IFC read-back shows incomplete "
                            "Qto_* base-quantity linkage on some emitted products "
                            "(summarize_kernel_ifc_semantic_roundtrip.roundtripChecks.qtoCoverage)."
                            + ids_ptr
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )
            mlr = rtc.get("materialLayerReadback")
            if (
                isinstance(mlr, dict)
                and not mlr.get("allMatched", True)
                and material_assembly_manifest_evidence(doc) is not None
            ):
                out.append(
                    Violation(
                        rule_id="exchange_ifc_material_layer_readback_mismatch",
                        severity="info",
                        message=(
                            "IFC layer stack read-back does not align with documented material assemblies "
                            "for some kernel emits (inspect_kernel_ifc_semantics.materialLayerSetReadback_v0; "
                            "ifc_manifest_v0.ifcMaterialLayerSetReadbackEvidence_v0)." + ids_ptr
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

    if ifcopenshell_available() and kernel_export_eligible(doc):
        # ifc_row is already computed above; reuse cached values instead of re-exporting.
        preview = ifc_row.get("ifcImportPreview_v0") or {}
        merge_map = ifc_row.get("ifcUnsupportedMergeMap_v0") or {}

        if preview.get("available"):
            unresolved_count = int(preview.get("unresolvedReferenceCount") or 0)
            if unresolved_count > 0:
                out.append(
                    Violation(
                        rule_id="exchange_ifc_import_preview_extraction_gaps",
                        severity="info",
                        message=(
                            f"IFC import preview detected {unresolved_count} extraction gap(s) "
                            "(unresolved product references or unreadable geometry; see "
                            "ifc_manifest_v0.ifcImportPreview_v0.unresolvedReferences)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

            unsupported_classes = dict(merge_map.get("unsupportedIfcProductsByClass") or {})
            unsupported_total = sum(unsupported_classes.values())
            if unsupported_total > 0:
                class_summary = ", ".join(
                    f"{cls}:{n}" for cls, n in sorted(unsupported_classes.items())
                )
                out.append(
                    Violation(
                        rule_id="exchange_ifc_import_preview_unsupported_products",
                        severity="info",
                        message=(
                            f"IFC import preview found {unsupported_total} product(s) outside the kernel "
                            "replay slice (not replay targets): "
                            + class_summary
                            + " (ifc_manifest_v0.ifcUnsupportedMergeMap_v0.unsupportedIfcProductsByClass)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

            ids_cov = preview.get("idsPointerCoverage") or {}
            if ids_cov.get("available"):
                spaces_cov = ids_cov.get("spaces") or {}
                floors_cov = ids_cov.get("floors") or {}
                space_rows = int(spaces_cov.get("rows") or 0)
                space_qto = int(spaces_cov.get("withQtoSpaceBaseQuantitiesLinked") or 0)
                floor_rows = int(floors_cov.get("rows") or 0)
                floor_qto = int(floors_cov.get("withQtoSlabBaseQuantitiesLinked") or 0)
                ids_gap = (space_rows > 0 and space_qto < space_rows) or (
                    floor_rows > 0 and floor_qto < floor_rows
                )
                if ids_gap and _validation_rules_any_cleanroom_ids(val_rules):
                    out.append(
                        Violation(
                            rule_id="exchange_ifc_import_preview_ids_pointer_gap",
                            severity="info",
                            message=(
                                "Cleanroom IDS validation is active but IFC import preview shows incomplete "
                                "Qto_* linkage for some authoritative replay rows "
                                "(ifc_manifest_v0.ifcImportPreview_v0.idsPointerCoverage)."
                            ),
                            element_ids=[],
                            discipline="exchange",
                        )
                    )

            id_collision_classes = dict(preview.get("idCollisionClasses") or {})
            if id_collision_classes:
                collision_summary = ", ".join(
                    f"{kind}:{count}" for kind, count in sorted(id_collision_classes.items())
                )
                out.append(
                    Violation(
                        rule_id="exchange_ifc_import_preview_id_collision",
                        severity="warning",
                        message=(
                            "IFC import preview detected duplicate replay IDs within the STEP file "
                            f"({collision_summary}). Resolve duplicate Pset_*Common.Reference values "
                            "before applying the authoritative replay "
                            "(ifc_manifest_v0.ifcImportPreview_v0.idCollisionClasses)."
                        ),
                        element_ids=[],
                        discipline="exchange",
                    )
                )

    # Cross-manifest closure alignment advisory rules — surface manifest drift.
    closure = ifc_row.get("ifcExchangeManifestClosure_v0") or {}

    auth_token = str(closure.get("authoritativeProductsAlignmentToken") or "")
    if auth_token and auth_token not in ("aligned", "unavailable_offline", ""):
        out.append(
            Violation(
                rule_id="exchange_ifc_manifest_authoritative_alignment_drift",
                severity="warning",
                message=(
                    f"IFC exchange manifest closure: authoritative product alignment drifted "
                    f"({auth_token}). The IDS replay map coverage does not match the import "
                    "preview's authoritativeProducts slice "
                    "(ifcExchangeManifestClosure_v0.authoritativeProductsAlignmentToken)."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    unsupported_token = str(closure.get("unsupportedClassAlignmentToken") or "")
    if unsupported_token and unsupported_token not in ("aligned", "unavailable_offline", ""):
        out.append(
            Violation(
                rule_id="exchange_ifc_manifest_unsupported_alignment_drift",
                severity="warning",
                message=(
                    f"IFC exchange manifest closure: unsupported class alignment drifted "
                    f"({unsupported_token}). The unsupported product class sets in the import "
                    "preview and merge map disagree "
                    "(ifcExchangeManifestClosure_v0.unsupportedClassAlignmentToken)."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    ids_token = str(closure.get("idsPointerCoverageAlignmentToken") or "")
    if ids_token and ids_token not in ("aligned", "unavailable_offline", ""):
        out.append(
            Violation(
                rule_id="exchange_ifc_manifest_ids_pointer_alignment_drift",
                severity="info",
                message=(
                    f"IFC exchange manifest closure: IDS pointer coverage drifted "
                    f"({ids_token}). Some authoritative product rows lack complete QTO/identity "
                    "IDS linkage across the manifest surfaces "
                    "(ifcExchangeManifestClosure_v0.idsPointerCoverageAlignmentToken)."
                ),
                element_ids=[],
                discipline="exchange",
            )
        )

    # IDS adviser: per-product-kind QTO and Pset gap rules derived from coverage evidence rows.
    ps_cov = ifc_row.get("ifcPropertySetCoverageEvidence_v0") or {}
    if isinstance(ps_cov, dict) and ps_cov.get("available"):
        cov_rows = list(ps_cov.get("rows") or [])

        _qto_missing_token = "missing_qto_link"
        _pset_critical_tokens = {
            "missing_Pset_Reference",
            "site_reference_join_mismatch",
            "reference_not_in_document",
        }

        stair_qto_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "stair"
            and str(r.get("idsGapReasonToken") or "") == _qto_missing_token
        )
        if stair_qto_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_qto_stair_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {stair_qto_gaps} stair product(s) missing "
                        "Qto_StairBaseQuantities linkage "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=stair, missing_qto_link)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

        room_qto_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "room"
            and str(r.get("idsGapReasonToken") or "") == _qto_missing_token
        )
        if room_qto_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_qto_room_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {room_qto_gaps} room/space product(s) missing "
                        "Qto_SpaceBaseQuantities linkage "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=room, missing_qto_link)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

        floor_pset_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "floor"
            and str(r.get("idsGapReasonToken") or "") in _pset_critical_tokens
        )
        if floor_pset_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_pset_floor_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {floor_pset_gaps} floor/slab product(s) with incomplete "
                        "Pset_SlabCommon identity fields "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=floor)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

        roof_pset_gaps = sum(
            1
            for r in cov_rows
            if str(r.get("kernelKind") or "") == "roof"
            and str(r.get("idsGapReasonToken") or "") in _pset_critical_tokens
        )
        if roof_pset_gaps > 0:
            out.append(
                Violation(
                    rule_id="exchange_ifc_pset_roof_gap",
                    severity="info",
                    message=(
                        f"IFC coverage evidence: {roof_pset_gaps} roof product(s) with incomplete "
                        "Pset_RoofCommon identity fields "
                        "(ifcPropertySetCoverageEvidence_v0 rows with kernelKind=roof)."
                    ),
                    element_ids=[],
                    discipline="exchange",
                )
            )

    return out


def _gltf_manifest_closure_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    """Advisory violations derived from gltfExportManifestClosure_v1 presence matrix."""
    out: list[Violation] = []
    try:
        doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
    except Exception:
        return []
    try:
        gltf_ext = build_visual_export_manifest(doc)["extensions"]["BIM_AI_exportManifest_v0"]
    except Exception:
        return []

    closure = gltf_ext.get("gltfExportManifestClosure_v1")
    if not isinstance(closure, dict):
        return out

    counts_by_kind: dict[str, int] = gltf_ext.get("countsByKind") or {}

    for entry in closure.get("extensionPresenceMatrix") or []:
        token = entry.get("token", "")
        if entry.get("status") == "skipped_ineligible":
            eligible_kind = GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND.get(token)
            if eligible_kind and counts_by_kind.get(eligible_kind, 0) > 0:
                skip_code = entry.get("skipReasonCode") or "unknown"
                out.append(
                    Violation(
                        rule_id="gltf_export_manifest_expected_extension_missing",
                        severity="info",
                        message=(
                            f"glTF export manifest: extension {token!r} not emitted "
                            f"but eligible element kind {eligible_kind!r} is present "
                            f"(skipReasonCode={skip_code!r})."
                        ),
                        element_ids=[],
                    )
                )

    emitted_tokens: list[str] = closure.get("extensionTokens") or []
    emitted_set = set(emitted_tokens)
    canonical_order = [t for t in GLTF_KNOWN_EXTENSION_TOKENS if t in emitted_set]
    if emitted_tokens != canonical_order:
        out.append(
            Violation(
                rule_id="gltf_export_manifest_extension_order_drift",
                severity="warning",
                message=(
                    "glTF export manifest: extension token order in closure differs from canonical. "
                    f"Emitted order: {emitted_tokens!r}. "
                    f"Canonical order: {canonical_order!r}."
                ),
                element_ids=[],
            )
        )

    return out


def _plan_view_tag_style_advisor_violations(elements: dict[str, Element]) -> list[Violation]:
    """Advisor rules for plan tag style matrix gaps (WP-C01/C02/V01).

    Emits violations when:
    - A plan view or template holds a tag-style ref that is missing or has the wrong tagTarget.
    - A plan view has opening tags / room labels active but both plan and template lack an explicit
      style (pure builtin fallback — advisory, not blocking).
    - A plan view explicitly overrides the tag style set by its template (informational).
    """
    out: list[Violation] = []

    plan_views = [e for e in elements.values() if isinstance(e, PlanViewElem)]
    view_templates = {e.id: e for e in elements.values() if isinstance(e, ViewTemplateElem)}

    def _resolve_tmpl(pv: PlanViewElem) -> ViewTemplateElem | None:
        if pv.view_template_id:
            return view_templates.get(pv.view_template_id)
        return None

    def _tag_style_elem(ref: str | None) -> PlanTagStyleElem | None:
        if not ref:
            return None
        el = elements.get(ref)
        return el if isinstance(el, PlanTagStyleElem) else None

    def _ref_missing_or_wrong(ref: str | None, expected_target: str) -> str | None:
        if not ref:
            return None
        el = elements.get(ref)
        if el is None:
            return "missing"
        if not isinstance(el, PlanTagStyleElem):
            return "wrong_kind"
        if el.tag_target != expected_target:
            return "wrong_target"
        return None

    # View template refs
    for tmpl in view_templates.values():
        for lane, ref in (
            ("opening", tmpl.default_plan_opening_tag_style_id),
            ("room", tmpl.default_plan_room_tag_style_id),
        ):
            reason = _ref_missing_or_wrong(ref, lane)
            if reason == "wrong_target":
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_target_mismatch",
                        severity="warning",
                        message=(
                            f"View template '{tmpl.name}' default{lane.capitalize()}TagStyleId "
                            f"'{ref}' targets the wrong tag lane; effective style falls back to builtin."
                        ),
                        element_ids=[tmpl.id],
                    )
                )
            elif reason in ("missing", "wrong_kind"):
                out.append(
                    Violation(
                        rule_id="plan_template_tag_style_ref_invalid",
                        severity="warning",
                        message=(
                            f"View template '{tmpl.name}' default{lane.capitalize()}TagStyleId "
                            f"'{ref}' does not resolve to a plan_tag_style element ({reason}); "
                            "effective style falls back to builtin."
                        ),
                        element_ids=[tmpl.id],
                    )
                )

    # Plan view refs and matrix advisory
    for pv in sorted(plan_views, key=lambda x: x.id):
        tmpl = _resolve_tmpl(pv)

        for lane, pv_ref, tmpl_default_ref in (
            (
                "opening",
                pv.plan_opening_tag_style_id,
                tmpl.default_plan_opening_tag_style_id if tmpl else None,
            ),
            (
                "room",
                pv.plan_room_tag_style_id,
                tmpl.default_plan_room_tag_style_id if tmpl else None,
            ),
        ):
            # Plan-view explicit ref that is invalid
            reason = _ref_missing_or_wrong(pv_ref, lane)
            if reason == "wrong_target":
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_target_mismatch",
                        severity="warning",
                        message=(
                            f"Plan view '{pv.name}' plan{lane.capitalize()}TagStyleId "
                            f"'{pv_ref}' targets the wrong tag lane; effective style falls back to builtin."
                        ),
                        element_ids=[pv.id],
                    )
                )
            elif reason in ("missing", "wrong_kind"):
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_ref_invalid",
                        severity="warning",
                        message=(
                            f"Plan view '{pv.name}' plan{lane.capitalize()}TagStyleId "
                            f"'{pv_ref}' does not resolve to a plan_tag_style element ({reason}); "
                            "effective style falls back to builtin."
                        ),
                        element_ids=[pv.id],
                    )
                )

            # Advisory: plan view overrides template default tag style with a different valid style
            if (
                pv_ref
                and tmpl_default_ref
                and pv_ref != tmpl_default_ref
                and reason is None
                and _ref_missing_or_wrong(tmpl_default_ref, lane) is None
            ):
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_override",
                        severity="info",
                        message=(
                            f"Plan view '{pv.name}' overrides its template's default "
                            f"{lane} tag style (template: '{tmpl_default_ref}', "
                            f"plan override: '{pv_ref}')."
                        ),
                        element_ids=[pv.id],
                    )
                )

        # Advisory: tags active but purely falling back to builtin (no style configured anywhere)
        opening_tags_on = (
            pv.plan_show_opening_tags
            if pv.plan_show_opening_tags is not None
            else (tmpl.plan_show_opening_tags if tmpl else False)
        )
        room_labels_on = (
            pv.plan_show_room_labels
            if pv.plan_show_room_labels is not None
            else (tmpl.plan_show_room_labels if tmpl else False)
        )

        for lane, tags_on, pv_ref_attr, tmpl_ref_attr in (
            (
                "opening",
                opening_tags_on,
                pv.plan_opening_tag_style_id,
                tmpl.default_plan_opening_tag_style_id if tmpl else None,
            ),
            (
                "room",
                room_labels_on,
                pv.plan_room_tag_style_id,
                tmpl.default_plan_room_tag_style_id if tmpl else None,
            ),
        ):
            if not tags_on:
                continue
            has_valid_pv_ref = (
                bool(pv_ref_attr) and _ref_missing_or_wrong(pv_ref_attr, lane) is None
            )
            has_valid_tmpl_ref = (
                bool(tmpl_ref_attr) and _ref_missing_or_wrong(tmpl_ref_attr, lane) is None
            )
            if not has_valid_pv_ref and not has_valid_tmpl_ref:
                out.append(
                    Violation(
                        rule_id="plan_view_tag_style_fallback",
                        severity="info",
                        message=(
                            f"Plan view '{pv.name}' has {lane} tags visible but no custom tag style "
                            "is configured on the plan view or its template; the builtin fallback "
                            "style is active. Assign a plan_tag_style for consistent labelling."
                        ),
                        element_ids=[pv.id],
                    )
                )

    out.sort(key=lambda v: (v.rule_id, tuple(sorted(v.element_ids)), v.severity))
    return out


def evaluate(elements: dict[str, Element]) -> list[Violation]:
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
    viols.sort(key=lambda v: (v.rule_id, tuple(sorted(v.element_ids)), v.severity))
    annotated = annotate_violation_disciplines(viols)
    return annotate_violation_blocking_classes(annotated)


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


def _room_color_scheme_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    scheme_elem: RoomColorSchemeElem | None = None
    for el in elements.values():
        if isinstance(el, RoomColorSchemeElem):
            scheme_elem = el
            break
    has_rooms = any(isinstance(el, RoomElem) for el in elements.values())
    if not has_rooms:
        return []
    raw_findings = scheme_override_advisory_violations_for_doc(scheme_elem)
    out: list[Violation] = []
    for f in raw_findings:
        code = str(f.get("code") or "")
        severity_raw = str(f.get("severity") or "info")
        severity: Literal["error", "warning", "info"] = (
            severity_raw if severity_raw in {"error", "warning", "info"} else "info"
        )
        eids = [scheme_elem.id] if scheme_elem is not None else []
        out.append(
            Violation(
                rule_id=code,
                severity=severity,
                message=str(f.get("message") or code),
                element_ids=eids,
            )
        )
    return out


def _section_on_sheet_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    """Advisory rules for section/elevation viewports placed on sheets (WP-E03/E05/V01)."""
    out: list[Violation] = []
    sheets = sorted(
        (el for el in elements.values() if isinstance(el, SheetElem)),
        key=lambda s: s.id,
    )
    for sh in sheets:
        tb_norm = normalize_titleblock_revision_issue_v1(sh.titleblock_parameters)
        rev_iss_present = sheet_revision_issue_metadata_present(tb_norm)

        for vp in list(sh.viewports_mm or []):
            if not isinstance(vp, dict):
                continue
            vr = vp.get("viewRef") or vp.get("view_ref")
            if not isinstance(vr, str) or ":" not in vr:
                continue
            kind_raw, ref_raw = vr.split(":", 1)
            kind = kind_raw.strip().lower()
            if kind not in {"section", "sec"}:
                continue
            sec_id = ref_raw.strip()
            if not sec_id:
                continue
            el = elements.get(sec_id)
            if not isinstance(el, SectionCutElem):
                continue
            vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip() or sec_id

            if not section_cut_line_present(el):
                out.append(
                    Violation(
                        rule_id="section_on_sheet_cut_line_missing",
                        severity="warning",
                        message=(
                            f"Section viewport '{vid}' on sheet '{sh.id}' references section cut "
                            f"'{sec_id}' whose cut line endpoints coincide; no cut-line digest can "
                            "be produced for the section-on-sheet integration evidence."
                        ),
                        element_ids=[sh.id, sec_id],
                    )
                )

            _doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
            prim, _ = build_section_projection_primitives(_doc, el)
            token = section_profile_token_from_primitives(prim)
            if token == "noGeometry_v1":
                out.append(
                    Violation(
                        rule_id="section_on_sheet_profile_token_missing",
                        severity="info",
                        message=(
                            f"Section viewport '{vid}' on sheet '{sh.id}' references section cut "
                            f"'{sec_id}' with no resolvable profile token (no roof witness, geometry "
                            "extent, or level markers found)."
                        ),
                        element_ids=[sh.id, sec_id],
                    )
                )

            if not rev_iss_present:
                out.append(
                    Violation(
                        rule_id="section_on_sheet_revision_issue_unresolved",
                        severity="info",
                        message=(
                            f"Section viewport '{vid}' on sheet '{sh.id}' references section cut "
                            f"'{sec_id}' but the sheet titleblock revision/issue cross-reference is "
                            "empty (revisionId and revisionCode are both absent)."
                        ),
                        element_ids=[sh.id, sec_id],
                    )
                )
    return out


def advisorBlockingClassSummary_v1(doc: Document) -> dict[str, Any]:
    """Per-class violation counts at each severity for a document."""
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    counts: dict[str, dict[str, int]] = {
        cls.value: {"error": 0, "warning": 0, "info": 0} for cls in AdvisorBlockingClass
    }
    for v in viols:
        bc = _RULE_BLOCKING_CLASS.get(v.rule_id, AdvisorBlockingClass.documentation.value)
        sev = v.severity
        if bc in counts and sev in counts[bc]:
            counts[bc][sev] += 1
    return {
        "format": "advisorBlockingClassSummary_v1",
        "perClass": counts,
        "totalViolations": len(viols),
    }


def fix_schedule_sheet_placement(doc: Document) -> dict[str, Any]:
    """Quick-fix: assign unplaced schedules to the first available sheet and add viewports.

    Returns quickFixResult_v1 with {applied, skipped, reason}.
    """
    from bim_ai.engine import try_commit_bundle

    schedules = sorted(
        (e for e in doc.elements.values() if isinstance(e, ScheduleElem)),
        key=lambda s: s.id,
    )
    sheets = sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)),
        key=lambda s: s.id,
    )
    unplaced = [s for s in schedules if not (s.sheet_id or "").strip()]

    if not unplaced:
        return {"applied": False, "skipped": True, "reason": "no_unplaced_schedules"}
    if not sheets:
        return {"applied": False, "skipped": True, "reason": "no_sheets_available"}

    target_sheet = sheets[0]
    new_vps = list(target_sheet.viewports_mm or [])
    for sch in unplaced:
        new_vps.append(
            {
                "viewportId": f"vp-autoplace-schedule-{sch.id}",
                "label": sch.name or "Schedule",
                "viewRef": f"schedule:{sch.id}",
                "xMm": _SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
                "yMm": _SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
                "widthMm": _SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
                "heightMm": _SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
            }
        )

    commands: list[dict[str, Any]] = [
        {
            "type": "upsertSheetViewports",
            "sheetId": target_sheet.id,
            "viewportsMm": new_vps,
        }
    ]
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(doc, commands)
    return {
        "applied": ok,
        "skipped": not ok,
        "reason": f"placed_{len(unplaced)}_on_{target_sheet.id}" if ok else f"commit_failed:{code}",
    }


def fix_sheet_viewport_refresh(doc: Document) -> dict[str, Any]:
    """Quick-fix: update stale schedule viewport rowCounts to match current derivation.

    Returns quickFixResult_v1 with {applied, skipped, reason}.
    """
    from bim_ai.engine import try_commit_bundle
    from bim_ai.schedule_derivation import derive_schedule_table

    stale_count = 0
    commands: list[dict[str, Any]] = []

    for sh_el in sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)), key=lambda s: s.id
    ):
        needs_update = False
        updated_vps: list[Any] = []
        for vp in sh_el.viewports_mm or []:
            if not isinstance(vp, dict):
                updated_vps.append(vp)
                continue
            vr = vp.get("viewRef") or vp.get("view_ref")
            cached_rc = vp.get("rowCount")
            if isinstance(vr, str) and vr.startswith("schedule:") and cached_rc is not None:
                sc_id = vr.split(":", 1)[1].strip()
                try:
                    cached_int = int(cached_rc)
                    tbl = derive_schedule_table(doc, sc_id)
                    derived_rc = int(tbl.get("totalRows") or 0)
                    if derived_rc != cached_int:
                        updated_vps.append({**vp, "rowCount": derived_rc})
                        needs_update = True
                        stale_count += 1
                        continue
                except (ValueError, TypeError, AttributeError):
                    pass
            updated_vps.append(vp)
        if needs_update:
            commands.append(
                {
                    "type": "upsertSheetViewports",
                    "sheetId": sh_el.id,
                    "viewportsMm": updated_vps,
                }
            )

    if not commands:
        return {"applied": False, "skipped": True, "reason": "no_stale_viewports"}

    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(doc, commands)
    return {
        "applied": ok,
        "skipped": not ok,
        "reason": f"refreshed_{stale_count}_viewport(s)" if ok else f"commit_failed:{code}",
    }


def _room_boundary_open_violations(elements: dict[str, Element]) -> list[Violation]:
    doc_snap = Document(revision=0, elements=dict(elements))
    unbounded_ids = detect_unbounded_rooms_v1(doc_snap)
    out: list[Violation] = []
    for rid in unbounded_ids:
        el = elements.get(rid)
        name = el.name if hasattr(el, "name") else rid
        out.append(
            Violation(
                rule_id="room_boundary_open",
                severity="warning",
                message=(
                    f"Room '{name}' ({rid}) has an open boundary — "
                    "it is not fully enclosed by axis-aligned walls or room separations."
                ),
                element_ids=[rid],
            )
        )
    return out
