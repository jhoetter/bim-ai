"""Portable plan display resolution + element counts (WP-C01/C02/C03 server slice)."""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any, Literal, cast

from bim_ai.document import Document
from bim_ai.elements import (
    DimensionElem,
    DoorElem,
    FloorElem,
    GridLineElem,
    LevelElem,
    PlanTagStyleElem,
    PlanViewElem,
    RoofElem,
    RoomColorSchemeElem,
    RoomColorSchemeRow,
    RoomElem,
    RoomSeparationElem,
    SectionCutElem,
    SlabOpeningElem,
    StairElem,
    ViewTemplateElem,
    WallElem,
    WindowElem,
)
from bim_ai.material_assembly_resolve import roof_surface_material_readout_v0
from bim_ai.opening_cut_primitives import (
    hosted_opening_t_span_normalized,
    slab_opening_documentation_row_v0,
    wall_plan_axis_aligned_xy,
    wall_plan_yaw_deg,
)
from bim_ai.plan_category_graphics import (
    ResolvedPlanCategoryGraphic,
    plan_category_graphic_hints_v0_payload,
    resolve_plan_category_graphics_for_pinned_view,
)
from bim_ai.roof_geometry import (
    RidgeAxisPlan,
    gable_pitched_rectangle_elevation_supported_v0,
    gable_rectangle_fascia_edge_plan_token_v0,
    gable_ridge_rise_mm,
    mass_box_roof_proxy_peak_z_mm,
    outer_rect_extent,
    roof_geometry_support_token_v0,
    roof_plan_geometry_readout_v0,
)
from bim_ai.roof_layered_prism_evidence_v1 import roof_layered_prism_payload_for_merge_v1
from bim_ai.room_derivation import (
    HEURISTIC_VERSION as ROOM_BOUNDARY_HEURISTIC_VERSION,
)
from bim_ai.room_derivation import (
    compute_room_boundary_derivation,
    footprint_outline_mm_rectangle,
    room_separation_plan_wire_row_fields_by_id,
    stable_footprint_id,
)
from bim_ai.section_projection_primitives import (
    _wall_vertical_span_mm,
    build_section_projection_primitives,
)
from bim_ai.stair_plan_proxy import (
    stair_documentation_diagnostics,
    stair_documentation_placeholders_v0,
    stair_plan_break_visibility_token,
    stair_plan_up_down_label,
    stair_riser_count_plan_proxy,
    stair_run_bearing_deg_ccw_from_plan_x,
    stair_schedule_row_extensions_v1,
    stair_tread_count_straight_plan_proxy,
)
from bim_ai.wall_join_evidence import collect_wall_corner_join_summary_v1
from bim_ai.wall_opening_cut_fidelity import (
    build_wall_opening_cut_fidelity_row,
    corner_join_rows_for_document,
)


def _level_elevation_mm(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    return float(el.elevation_mm) if isinstance(el, LevelElem) else 0.0


_RANGE_EPS_MM = 1e-6


def _closed_z_intervals_overlap_mm(z0: float, z1: float, lo: float, hi: float) -> bool:
    a0, a1 = (z0, z1) if z0 <= z1 else (z1, z0)
    return not (a1 < lo - _RANGE_EPS_MM or a0 > hi + _RANGE_EPS_MM)


def _plan_view_range_authoring_incomplete(pv: PlanViewElem) -> bool:
    b = pv.view_range_bottom_mm
    t = pv.view_range_top_mm
    c = pv.cut_plane_offset_mm
    has_any = b is not None or t is not None or c is not None
    has_full = b is not None and t is not None
    return has_any and not has_full


def _resolve_plan_view_range_clip_mm(
    doc: Document, pv: PlanViewElem
) -> tuple[float, float, float] | None:
    b = pv.view_range_bottom_mm
    t = pv.view_range_top_mm
    if b is None or t is None:
        return None
    level_z = _level_elevation_mm(doc, pv.level_id)
    z_lo = level_z + float(b)
    z_hi = level_z + float(t)
    if z_lo > z_hi:
        z_lo, z_hi = z_hi, z_lo
    cut_off = pv.cut_plane_offset_mm
    cut_z = level_z + float(cut_off if cut_off is not None else 0.0)
    return (z_lo, z_hi, cut_z)


def _room_vertical_span_mm(doc: Document, rm: RoomElem) -> tuple[float, float]:
    """World Z span (mm) for room prism; aligns with ``export_ifc._vertical_span_m`` semantics."""

    floor_z = _level_elevation_mm(doc, rm.level_id)
    if rm.upper_limit_level_id:
        ceil_el = doc.elements.get(rm.upper_limit_level_id)
        ceiling_z = (
            float(ceil_el.elevation_mm) if isinstance(ceil_el, LevelElem) else floor_z + 2800.0
        )
    else:
        ceiling_z = floor_z + 2800.0
    offset = float(rm.volume_ceiling_offset_mm) if rm.volume_ceiling_offset_mm is not None else 0.0
    ceiling_z -= offset
    if ceiling_z < floor_z + 1000.0:
        ceiling_z = floor_z + 2200.0
    return floor_z, ceiling_z


def _floor_vertical_span_mm(doc: Document, fl: FloorElem) -> tuple[float, float]:
    z0 = _level_elevation_mm(doc, fl.level_id)
    z1 = z0 + float(fl.thickness_mm) + float(fl.insulation_extension_mm)
    return z0, z1


def _roof_vertical_span_mm(doc: Document, e: RoofElem) -> tuple[float, float]:
    zb = _level_elevation_mm(doc, e.reference_level_id)
    poly = [(float(p.x_mm), float(p.y_mm)) for p in e.footprint_mm]
    lvl_ok = isinstance(doc.elements.get(e.reference_level_id), LevelElem)
    slope = float(e.slope_deg or 25.0)
    if gable_pitched_rectangle_elevation_supported_v0(
        footprint_mm=poly,
        roof_geometry_mode=e.roof_geometry_mode,
        reference_level_resolves=lvl_ok,
        slope_deg=e.slope_deg,
    ):
        x0, x1, z0, z1 = outer_rect_extent(poly)
        span_x = float(x1 - x0)
        span_z = float(z1 - z0)
        rise_mm, _ridge_axis = gable_ridge_rise_mm(span_x, span_z, slope)
        return zb, zb + rise_mm
    z_mid = mass_box_roof_proxy_peak_z_mm(zb, e.slope_deg)
    return zb, z_mid


def _stair_vertical_span_mm(doc: Document, st: StairElem) -> tuple[float, float]:
    blv = doc.elements.get(st.base_level_id)
    tlv = doc.elements.get(st.top_level_id)
    if isinstance(blv, LevelElem) and isinstance(tlv, LevelElem):
        z0 = float(blv.elevation_mm)
        z1 = float(tlv.elevation_mm)
        if z1 < z0:
            z0, z1 = z1, z0
        return z0, z1
    z0 = _level_elevation_mm(doc, st.base_level_id)
    return z0, z0


def _roof_plan_wire_geometry_fields(doc: Document, e: RoofElem) -> dict[str, Any]:
    poly = [(float(p.x_mm), float(p.y_mm)) for p in e.footprint_mm]
    lvl_ok = isinstance(doc.elements.get(e.reference_level_id), LevelElem)
    support_tok = roof_geometry_support_token_v0(
        footprint_mm=poly,
        roof_geometry_mode=e.roof_geometry_mode,
        reference_level_resolves=lvl_ok,
        slope_deg=e.slope_deg,
    )
    slope = float(e.slope_deg or 25.0)
    zb = _level_elevation_mm(doc, e.reference_level_id)
    mode = e.roof_geometry_mode
    gable_ok = gable_pitched_rectangle_elevation_supported_v0(
        footprint_mm=poly,
        roof_geometry_mode=e.roof_geometry_mode,
        reference_level_resolves=lvl_ok,
        slope_deg=e.slope_deg,
    )
    base: dict[str, Any] = {
        "roofGeometryMode": mode,
        "slopeDeg": round(slope, 3),
        "overhangMm": round(float(e.overhang_mm), 3),
        "roofPlanGeometryReadout_v0": roof_plan_geometry_readout_v0(
            roof_geometry_mode=mode,
            roof_geometry_support_token=support_tok,
            gable_elevation_supported=gable_ok,
        ),
    }
    if support_tok is not None:
        base["roofGeometrySupportToken"] = support_tok
    if gable_ok:
        x0, x1, z0, z1 = outer_rect_extent(poly)
        span_x = float(x1 - x0)
        span_z = float(z1 - z0)
        rise_mm, ridge_axis = gable_ridge_rise_mm(span_x, span_z, slope)
        ridge_z = zb + rise_mm
        base.update(
            {
                "ridgeAxisPlan": ridge_axis,
                "planSpanXmMm": round(span_x, 3),
                "planSpanZmMm": round(span_z, 3),
                "ridgeRiseMm": round(rise_mm, 3),
                "ridgeZMm": round(ridge_z, 3),
                "eavePlateZMm": round(zb, 3),
                "proxyKind": "gablePitchedRectangleChord",
            }
        )
    else:
        z_mid = mass_box_roof_proxy_peak_z_mm(zb, e.slope_deg)
        base.update({"zMidMm": round(z_mid, 3), "proxyKind": "footprintChord"})
    return base


def _canon_hidden_category(label: str) -> str | None:
    raw = label.strip().lower()
    table = {
        "walls": "wall",
        "wall": "wall",
        "floors": "floor",
        "slabs": "floor",
        "slab": "floor",
        "floor": "floor",
        "roofs": "roof",
        "roof": "roof",
        "rooms": "room",
        "room": "room",
        "doors": "door",
        "door": "door",
        "windows": "window",
        "window": "window",
        "stairs": "stair",
        "stair": "stair",
        "grids": "grid_line",
        "grid": "grid_line",
        "gridlines": "grid_line",
        "grid_line": "grid_line",
        "grid-lines": "grid_line",
        "dimensions": "dimension",
        "dimension": "dimension",
        "room separation": "room_separation",
        "room separation line": "room_separation",
        "room separating": "room_separation",
        "room separators": "room_separation",
        "room separators line": "room_separation",
        "room_separation": "room_separation",
        "room_separator": "room_separation",
        "room-separation": "room_separation",
        "room-separations": "room_separation",
    }
    return table.get(raw)


_PLAN_DETAIL_LINE_WEIGHT_FACTOR: dict[str, float] = {
    "coarse": 0.88,
    "medium": 1.0,
    "fine": 1.14,
}


def _presentation_line_weight_base(presentation: str) -> float:
    if presentation == "opening_focus":
        return 1.18
    if presentation == "room_scheme":
        return 0.92
    return 1.0


def _plan_graphic_hints_for_pinned_view(doc: Document, pv: PlanViewElem) -> dict[str, Any]:
    tmpl: ViewTemplateElem | None = None
    if pv.view_template_id:
        te = doc.elements.get(pv.view_template_id)
        if isinstance(te, ViewTemplateElem):
            tmpl = te
    if pv.plan_detail_level is not None:
        detail = str(pv.plan_detail_level)
    else:
        td = tmpl.plan_detail_level if tmpl is not None else None
        detail = str(td) if td else "medium"
    if detail not in _PLAN_DETAIL_LINE_WEIGHT_FACTOR:
        detail = "medium"
    if pv.plan_room_fill_opacity_scale is not None:
        fill = float(pv.plan_room_fill_opacity_scale)
    elif tmpl is not None:
        fill = float(tmpl.plan_room_fill_opacity_scale)
    else:
        fill = 1.0
    fill = max(0.0, min(1.0, fill))
    pres_raw = getattr(pv, "plan_presentation", None) or "default"
    pres = pres_raw if pres_raw in {"opening_focus", "room_scheme"} else "default"
    lw = _presentation_line_weight_base(pres) * _PLAN_DETAIL_LINE_WEIGHT_FACTOR[detail]
    return {
        "detailLevel": detail,
        "lineWeightScale": round(float(lw), 4),
        "roomFillOpacityScale": round(float(fill), 4),
    }


def _plan_tag_label_trunc(label: str, max_len: int = 48) -> str:
    s = " ".join(label.replace("\n", " ").split())
    if not s:
        return ""
    if len(s) <= max_len:
        return s
    return s[: max(1, max_len - 3)] + "..."


def _opening_plan_tag_label(opening: DoorElem | WindowElem) -> str:
    name = _plan_tag_label_trunc((opening.name or "").strip())
    if name:
        return name
    kind = "D" if isinstance(opening, DoorElem) else "W"
    suf = opening.id[-4:] if len(opening.id) >= 4 else opening.id
    return f"{kind}-{suf}"


def _room_plan_tag_label(room: RoomElem) -> str:
    name_part = _plan_tag_label_trunc((room.name or "").strip())
    code = _plan_tag_label_trunc((room.programme_code or "").strip(), max_len=20)
    if name_part and code:
        combined = f"{name_part} ({code})"
        return _plan_tag_label_trunc(combined)
    if name_part:
        return name_part
    if code:
        return code
    suf = room.id[-4:] if len(room.id) >= 4 else room.id
    return f"R-{suf}"


BUILTIN_PLAN_TAG_OPENING_ID = "builtin-plan-tag-opening"
BUILTIN_PLAN_TAG_ROOM_ID = "builtin-plan-tag-room"
_OPENING_BUILTIN_LABEL_FIELDS = ["name", "elementId"]
_ROOM_BUILTIN_LABEL_FIELDS = ["name", "programmeCode", "elementId"]


@dataclass
class _ResolvedPlanTagStyleLane:
    style_id: str
    name: str
    source: Literal["plan_view", "view_template", "builtin"]
    warnings: list[dict[str, Any]]
    catalog: PlanTagStyleElem | None


def _warning_sort_key(w: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        str(w.get("code", "")),
        str(w.get("message", "")),
        str(w.get("ref", "")),
        str(w.get("lane", "")),
    )


def _resolve_plan_tag_style_lane(
    doc: Document,
    pv: PlanViewElem | None,
    lane: Literal["opening", "room"],
) -> _ResolvedPlanTagStyleLane:
    warnings: list[dict[str, Any]] = []
    ref: str | None = None
    source: Literal["plan_view", "view_template", "builtin"] = "builtin"
    if pv is not None:
        ref = pv.plan_opening_tag_style_id if lane == "opening" else pv.plan_room_tag_style_id
        if ref:
            source = "plan_view"
    tmpl: ViewTemplateElem | None = None
    if pv is not None and pv.view_template_id:
        te = doc.elements.get(pv.view_template_id)
        if isinstance(te, ViewTemplateElem):
            tmpl = te
    if not ref and tmpl is not None:
        ref = (
            tmpl.default_plan_opening_tag_style_id
            if lane == "opening"
            else tmpl.default_plan_room_tag_style_id
        )
        if ref:
            source = "view_template"
    if not ref:
        bid = BUILTIN_PLAN_TAG_OPENING_ID if lane == "opening" else BUILTIN_PLAN_TAG_ROOM_ID
        return _ResolvedPlanTagStyleLane(bid, "Builtin", "builtin", warnings, None)
    el = doc.elements.get(ref)
    if not isinstance(el, PlanTagStyleElem):
        warnings.append(
            {
                "code": "planTagStyleRefInvalid",
                "message": f"Plan tag style ref '{ref}' is missing or is not plan_tag_style; using builtin.",
                "ref": ref,
                "lane": lane,
            }
        )
        bid = BUILTIN_PLAN_TAG_OPENING_ID if lane == "opening" else BUILTIN_PLAN_TAG_ROOM_ID
        return _ResolvedPlanTagStyleLane(bid, "Builtin", "builtin", warnings, None)
    expected: Literal["opening", "room"] = lane
    if el.tag_target != expected:
        warnings.append(
            {
                "code": "planTagStyleTargetMismatch",
                "message": (
                    f"Plan tag style '{ref}' targets '{el.tag_target}' but assigned lane is '{lane}'; "
                    "using builtin."
                ),
                "ref": ref,
                "lane": lane,
            }
        )
        bid = BUILTIN_PLAN_TAG_OPENING_ID if lane == "opening" else BUILTIN_PLAN_TAG_ROOM_ID
        return _ResolvedPlanTagStyleLane(bid, "Builtin", "builtin", warnings, None)
    return _ResolvedPlanTagStyleLane(el.id, el.name, source, warnings, el)


def _plan_tag_style_hint_payload(
    res: _ResolvedPlanTagStyleLane, lane: Literal["opening", "room"]
) -> dict[str, Any]:
    warn_sorted = sorted(res.warnings, key=_warning_sort_key)
    if res.catalog is not None:
        e = res.catalog
        return {
            "resolvedStyleId": res.style_id,
            "resolvedStyleName": e.name,
            "source": res.source,
            "tagTarget": e.tag_target,
            "labelFields": list(e.label_fields),
            "textSizePt": round(float(e.text_size_pt), 4),
            "leaderVisible": bool(e.leader_visible),
            "badgeStyle": e.badge_style,
            "colorToken": str(e.color_token),
            "warnings": warn_sorted,
        }
    lf = _OPENING_BUILTIN_LABEL_FIELDS if lane == "opening" else _ROOM_BUILTIN_LABEL_FIELDS
    return {
        "resolvedStyleId": res.style_id,
        "resolvedStyleName": res.name,
        "source": res.source,
        "tagTarget": lane,
        "labelFields": list(lf),
        "textSizePt": 10.0,
        "leaderVisible": True,
        "badgeStyle": "none",
        "colorToken": "default",
        "warnings": warn_sorted,
    }


def _format_opening_tag_with_style(
    o: DoorElem | WindowElem, catalog: PlanTagStyleElem | None
) -> str:
    if catalog is None:
        return _opening_plan_tag_label(o)
    fields = catalog.label_fields
    if not fields:
        return _opening_plan_tag_label(o)
    parts: list[str] = []
    for f in fields:
        if f == "name":
            n = (o.name or "").strip()
            if n:
                parts.append(_plan_tag_label_trunc(n))
        elif f == "programmeCode":
            continue
        elif f == "elementId":
            parts.append(o.id)
        elif f == "widthMm":
            parts.append(str(round(float(o.width_mm), 3)))
        elif f == "heightMm":
            if isinstance(o, WindowElem):
                parts.append(str(round(float(o.height_mm), 3)))
        elif f == "sillHeightMm":
            if isinstance(o, WindowElem):
                parts.append(str(round(float(o.sill_height_mm), 3)))
    joined = " · ".join(x for x in parts if x)
    if not joined:
        return _opening_plan_tag_label(o)
    return _plan_tag_label_trunc(joined)


def _format_room_tag_with_style(room: RoomElem, catalog: PlanTagStyleElem | None) -> str:
    if catalog is None:
        return _room_plan_tag_label(room)
    fields = catalog.label_fields
    if not fields:
        return _room_plan_tag_label(room)
    parts: list[str] = []
    for f in fields:
        if f == "name":
            n = (room.name or "").strip()
            if n:
                parts.append(_plan_tag_label_trunc(n))
        elif f == "programmeCode":
            c = (room.programme_code or "").strip()
            if c:
                parts.append(_plan_tag_label_trunc(c, max_len=20))
        elif f == "elementId":
            parts.append(room.id)
        elif f == "department":
            d = (room.department or "").strip()
            if d:
                parts.append(_plan_tag_label_trunc(d, max_len=24))
        elif f == "functionLabel":
            fl = (room.function_label or "").strip()
            if fl:
                parts.append(_plan_tag_label_trunc(fl, max_len=24))
        elif f == "finishSet":
            fs = (room.finish_set or "").strip()
            if fs:
                parts.append(_plan_tag_label_trunc(fs, max_len=20))
        elif f == "targetAreaM2" and room.target_area_m2 is not None:
            parts.append(str(round(float(room.target_area_m2), 3)))
    joined = " · ".join(x for x in parts if x)
    if not joined:
        return _room_plan_tag_label(room)
    return _plan_tag_label_trunc(joined)


def _plan_annotation_hints_for_pinned_view(doc: Document, pv: PlanViewElem) -> dict[str, bool]:
    tmpl: ViewTemplateElem | None = None
    if pv.view_template_id:
        te = doc.elements.get(pv.view_template_id)
        if isinstance(te, ViewTemplateElem):
            tmpl = te
    if pv.plan_show_opening_tags is not None:
        opening_tags_visible = pv.plan_show_opening_tags
    else:
        opening_tags_visible = tmpl.plan_show_opening_tags if tmpl is not None else False
    if pv.plan_show_room_labels is not None:
        room_labels_visible = pv.plan_show_room_labels
    else:
        room_labels_visible = tmpl.plan_show_room_labels if tmpl is not None else False
    return {"openingTagsVisible": opening_tags_visible, "roomLabelsVisible": room_labels_visible}


def _plan_view_browser_hierarchy_v0(
    doc: Document,
    pv: PlanViewElem,
    cat_res: dict[str, ResolvedPlanCategoryGraphic] | None,
    res_open: _ResolvedPlanTagStyleLane | None,
    res_room: _ResolvedPlanTagStyleLane | None,
    plan_ann: dict[str, bool] | None,
) -> dict[str, Any]:
    """Deterministic project-browser hierarchy summary for a pinned plan view (WP-C01/C05).

    Documents the template/tag/category matrix state for evidence review.  Each entry
    includes the resolved *effective_source* so callers can determine which tier won.
    """
    tmpl: ViewTemplateElem | None = None
    if pv.view_template_id:
        te = doc.elements.get(pv.view_template_id)
        if isinstance(te, ViewTemplateElem):
            tmpl = te

    # Tag style summary
    def _tag_summary(lane_res: _ResolvedPlanTagStyleLane | None, lane: str) -> dict[str, Any]:
        if lane_res is None:
            return {
                "lane": lane,
                "resolvedStyleId": None,
                "effectiveSource": "builtin",
                "warnings": [],
            }
        return {
            "lane": lane,
            "resolvedStyleId": lane_res.style_id,
            "resolvedStyleName": lane_res.name,
            "effectiveSource": lane_res.source,
            "warnings": sorted(
                lane_res.warnings, key=lambda w: (str(w.get("code", "")), str(w.get("lane", "")))
            ),
        }

    # Category graphics source summary
    cat_source_counts: dict[str, int] = {"default": 0, "template": 0, "plan_view": 0}
    cat_rows: list[dict[str, Any]] = []
    if cat_res is not None:
        from bim_ai.plan_category_graphics import PLAN_CATEGORY_GRAPHIC_KEYS

        for key in PLAN_CATEGORY_GRAPHIC_KEYS:
            r = cat_res[key]
            # Report dominant source (plan_view > template > default)
            dominant = (
                r.line_weight_source if not r.line_weight_is_defaulted else r.line_pattern_source
            )
            if r.line_weight_is_defaulted and r.line_pattern_is_defaulted:
                dominant = "default"
            elif r.line_weight_source == "plan_view" or r.line_pattern_source == "plan_view":
                dominant = "plan_view"
            elif r.line_weight_source == "template" or r.line_pattern_source == "template":
                dominant = "template"
            else:
                dominant = "default"
            cat_source_counts[dominant] = cat_source_counts.get(dominant, 0) + 1
            cat_rows.append(
                {
                    "categoryKey": key,
                    "lineWeightSource": r.line_weight_source,
                    "linePatternSource": r.line_pattern_source,
                    "effectiveSource": dominant,
                    "lineWeightFactor": r.line_weight_factor,
                    "linePatternToken": r.line_pattern_token,
                }
            )

    annotation: dict[str, Any] = {}
    if plan_ann is not None:
        opening_vis = bool(plan_ann.get("openingTagsVisible"))
        room_vis = bool(plan_ann.get("roomLabelsVisible"))
        # Determine source for annotation flags
        opening_src = (
            "plan_view"
            if pv.plan_show_opening_tags is not None
            else ("view_template" if tmpl is not None else "default")
        )
        room_src = (
            "plan_view"
            if pv.plan_show_room_labels is not None
            else ("view_template" if tmpl is not None else "default")
        )
        annotation = {
            "openingTagsVisible": opening_vis,
            "openingTagsSource": opening_src,
            "roomLabelsVisible": room_vis,
            "roomLabelsSource": room_src,
        }

    tmpl_view_range: dict[str, Any] | None = None
    if tmpl is not None and (
        tmpl.view_range_bottom_mm is not None or tmpl.view_range_top_mm is not None
    ):
        tmpl_view_range = {
            "viewRangeBottomMm": tmpl.view_range_bottom_mm,
            "viewRangeTopMm": tmpl.view_range_top_mm,
        }

    return {
        "format": "planViewBrowserHierarchy_v0",
        "planViewId": pv.id,
        "planViewName": pv.name,
        "levelId": pv.level_id,
        "viewTemplateId": tmpl.id if tmpl else None,
        "viewTemplateName": tmpl.name if tmpl else None,
        "templateViewRange": tmpl_view_range,
        "storedCropMinMm": {"xMm": pv.crop_min_mm.x_mm, "yMm": pv.crop_min_mm.y_mm}
        if pv.crop_min_mm
        else None,
        "storedCropMaxMm": {"xMm": pv.crop_max_mm.x_mm, "yMm": pv.crop_max_mm.y_mm}
        if pv.crop_max_mm
        else None,
        "storedViewRangeBottomMm": pv.view_range_bottom_mm,
        "storedViewRangeTopMm": pv.view_range_top_mm,
        "discipline": pv.discipline,
        "viewSubdiscipline": pv.view_subdiscipline,
        "planViewSubtype": pv.plan_view_subtype,
        "areaScheme": pv.area_scheme,
        "tagStyles": [_tag_summary(res_open, "opening"), _tag_summary(res_room, "room")],
        "categoryGraphicsSourceCounts": cat_source_counts,
        "categoryGraphicsRows": cat_rows,
        "annotationHints": annotation,
    }


def planViewTemplateApplicationEvidence_v1(
    plan_view_id: str,
    before: dict[str, Any],
    after: dict[str, Any],
) -> dict[str, Any]:
    """Before/after property diff for applyPlanViewTemplate evidence (WP-C01)."""
    tracked_keys = (
        "viewTemplateId",
        "viewRangeBottomMm",
        "viewRangeTopMm",
        "categoriesHidden",
        "planCategoryGraphics",
        "planOpeningTagStyleId",
        "planRoomTagStyleId",
    )
    changed: dict[str, dict[str, Any]] = {}
    all_keys = set(tracked_keys)
    for k in all_keys:
        bv = before.get(k)
        av = after.get(k)
        if bv != av:
            changed[k] = {"before": bv, "after": av}
    return {
        "format": "planViewTemplateApplicationEvidence_v1",
        "planViewId": plan_view_id,
        "changedProperties": changed,
        "changedPropertyCount": len(changed),
    }


def _hosted_xy_mm_on_wall(opening: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx, sy = wall.start.x_mm, wall.start.y_mm
    dx = wall.end.x_mm - sx
    dy = wall.end.y_mm - sy
    length_mm = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    ux, uy = dx / length_mm, dy / length_mm
    return sx + ux * opening.along_t * length_mm, sy + uy * opening.along_t * length_mm


def _deterministic_scheme_color_hex(seed: str) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return f"#{digest[:6]}"


def _document_room_scheme_rows(doc: Document) -> list[RoomColorSchemeRow]:
    el = doc.elements.get("bim-room-color-scheme")
    if isinstance(el, RoomColorSchemeElem):
        return list(el.scheme_rows)
    return []


def _scheme_color_hex_for_room(room: RoomElem, scheme_rows: list[RoomColorSchemeRow]) -> str:
    """Programme overrides first, then department, then deterministic hashing."""

    room_prog = (room.programme_code or "").strip()
    room_dept = (room.department or "").strip()
    for row in scheme_rows:
        rp = (row.programme_code or "").strip()
        if rp and room_prog and rp == room_prog:
            return str(row.scheme_color_hex)
    for row in scheme_rows:
        rd = (row.department or "").strip()
        if rd and room_dept and rd == room_dept:
            return str(row.scheme_color_hex)
    seed_src = room_prog or room.id
    return _deterministic_scheme_color_hex(seed_src)


def _normalized_crop_box_xy_mm(pv: PlanViewElem | None) -> tuple[float, float, float, float] | None:
    """Axis-aligned crop from plan_view corners; None if either corner is missing."""
    if pv is None:
        return None
    mn, mx = pv.crop_min_mm, pv.crop_max_mm
    if mn is None or mx is None:
        return None
    x0, x1 = sorted((mn.x_mm, mx.x_mm))
    y0, y1 = sorted((mn.y_mm, mx.y_mm))
    return (x0, y0, x1, y1)


def _vp_dict_axis_xy(
    obj: Any, keys_x: tuple[str, ...], keys_y: tuple[str, ...]
) -> tuple[float | None, float | None]:
    """Read x,y from viewport crop corner dict ({xMm,yMm} aliases). Mirrors sheet_preview_svg."""

    if obj is None or not isinstance(obj, dict):
        return None, None
    d = obj

    def pick(keys: tuple[str, ...]) -> float | None:
        for key in keys:
            val = d.get(key)
            if val is None:
                continue
            num = float(val)
            if math.isfinite(num):
                return num
        return None

    return pick(keys_x), pick(keys_y)


def _sheet_viewport_crop_box_xy_mm(
    vp_row: dict[str, Any],
) -> tuple[tuple[float, float, float, float] | None, bool]:
    """Return (normalized sheet crop box, partial_corner_authored).

    partial_corner_authored is True when only one of cropMinMm/cropMaxMm is present (crop ignored).
    """

    mn_raw = vp_row.get("cropMinMm") or vp_row.get("crop_min_mm")
    mx_raw = vp_row.get("cropMaxMm") or vp_row.get("crop_max_mm")
    has_mn = mn_raw is not None
    has_mx = mx_raw is not None
    if has_mn ^ has_mx:
        return None, True
    if not has_mn:
        return None, False
    xmin, ymin = _vp_dict_axis_xy(mn_raw, ("xMm", "x_mm"), ("yMm", "y_mm"))
    xmax, ymax = _vp_dict_axis_xy(mx_raw, ("xMm", "x_mm"), ("yMm", "y_mm"))
    if None in (xmin, ymin, xmax, ymax):
        return None, True
    assert xmin is not None and ymin is not None and xmax is not None and ymax is not None
    x0, x1 = sorted((xmin, xmax))
    y0, y1 = sorted((ymin, ymax))
    return (x0, y0, x1, y1), False


def _intersect_axis_aligned_crop_boxes(
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


def _point_in_crop_xy(x: float, y: float, box: tuple[float, float, float, float]) -> bool:
    x0, y0, x1, y1 = box
    return x0 <= x <= x1 and y0 <= y <= y1


def _segment_intersects_crop_xy(
    ax: float,
    ay: float,
    bx: float,
    by: float,
    box: tuple[float, float, float, float],
) -> bool:
    """Whether segment AB intersects the closed axis-aligned crop rectangle (inclusive edges)."""
    if _point_in_crop_xy(ax, ay, box) or _point_in_crop_xy(bx, by, box):
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


def _poly_bbox_overlaps_crop(
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


def _derived_room_boundary_evidence_for_wire(
    doc: Document,
    *,
    active_level_id: str | None,
    effective_crop_mm: tuple[float, float, float, float] | None,
    room_boundary_bundle: dict[str, Any] | None = None,
    view_range_clip_mm: tuple[float, float, float] | None = None,
) -> list[dict[str, Any]]:
    """Authoritative vacant axis rectangles for plan inspection (deterministic; crop-filtered)."""
    if not active_level_id:
        return []
    if view_range_clip_mm is not None:
        lo, hi, _cut = view_range_clip_mm
        lvl_z = _level_elevation_mm(doc, active_level_id)
        if not _closed_z_intervals_overlap_mm(lvl_z, lvl_z, lo, hi):
            return []
    bundle = (
        room_boundary_bundle
        if room_boundary_bundle is not None
        else compute_room_boundary_derivation(doc)
    )
    out: list[dict[str, Any]] = []
    for c in bundle.get("axisAlignedRectangleCandidates") or []:
        if not isinstance(c, dict):
            continue
        if c.get("derivationAuthority") != "authoritative":
            continue
        if str(c.get("levelId") or "") != active_level_id:
            continue
        bbox = c.get("bboxMm")
        if not isinstance(bbox, dict):
            continue
        outline_pts = footprint_outline_mm_rectangle(bbox)
        pts = [(float(d["xMm"]), float(d["yMm"])) for d in outline_pts]
        if effective_crop_mm is not None and not _poly_bbox_overlaps_crop(pts, effective_crop_mm):
            continue
        fp_id = stable_footprint_id(c)
        outline_mm_xy = [
            [round(float(d["xMm"]), 3), round(float(d["yMm"]), 3)] for d in outline_pts
        ]
        out.append(
            {
                "format": "derivedRoomFootprintEvidenceRow_v0",
                "footprintId": fp_id,
                "levelId": active_level_id,
                "outlineMm": outline_mm_xy,
                "boundaryWallIds": sorted(c.get("wallIds") or []),
                "boundarySeparationIds": sorted(c.get("boundarySeparationIds") or []),
                "derivationAuthority": "authoritative",
                "approxAreaM2": c.get("approxAreaM2"),
            }
        )
    return sorted(out, key=lambda x: str(x.get("footprintId") or ""))


def _derived_room_boundary_diagnostics_for_wire(
    *,
    active_level_id: str | None,
    effective_crop_mm: tuple[float, float, float, float] | None,
    bundle: dict[str, Any],
    doc: Document | None = None,
    view_range_clip_mm: tuple[float, float, float] | None = None,
) -> dict[str, Any]:
    """Summarize authority mix and level diagnostics without changing primitives."""
    hv = str(bundle.get("heuristicVersion") or ROOM_BOUNDARY_HEURISTIC_VERSION)
    if not active_level_id:
        return {
            "format": "derivedRoomBoundaryDiagnostics_v0",
            "boundaryHeuristicVersion": hv,
            "activeLevelId": None,
            "authoritativeFootprintCountIntersectingCrop": 0,
            "previewHeuristicFootprintCountIntersectingCrop": 0,
            "levelDiagnosticCodes": [],
        }

    if view_range_clip_mm is not None and doc is not None:
        lo, hi, _cut = view_range_clip_mm
        lvl_z = _level_elevation_mm(doc, active_level_id)
        if not _closed_z_intervals_overlap_mm(lvl_z, lvl_z, lo, hi):
            return {
                "format": "derivedRoomBoundaryDiagnostics_v0",
                "boundaryHeuristicVersion": hv,
                "activeLevelId": active_level_id,
                "authoritativeFootprintCountIntersectingCrop": 0,
                "previewHeuristicFootprintCountIntersectingCrop": 0,
                "levelDiagnosticCodes": [],
            }

    auth_n = 0
    prev_n = 0
    for c in bundle.get("axisAlignedRectangleCandidates") or []:
        if not isinstance(c, dict):
            continue
        if str(c.get("levelId") or "") != active_level_id:
            continue
        bbox = c.get("bboxMm")
        if not isinstance(bbox, dict):
            continue
        outline_pts = footprint_outline_mm_rectangle(bbox)
        pts = [(float(d["xMm"]), float(d["yMm"])) for d in outline_pts]
        if effective_crop_mm is not None and not _poly_bbox_overlaps_crop(pts, effective_crop_mm):
            continue
        if c.get("derivationAuthority") == "authoritative":
            auth_n += 1
        else:
            prev_n += 1

    level_diag_codes = sorted(
        {
            str(d.get("code") or "")
            for d in bundle.get("diagnostics") or []
            if isinstance(d, dict)
            and str(d.get("levelId") or "") == active_level_id
            and str(d.get("code") or "")
        }
    )

    return {
        "format": "derivedRoomBoundaryDiagnostics_v0",
        "boundaryHeuristicVersion": hv,
        "activeLevelId": active_level_id,
        "authoritativeFootprintCountIntersectingCrop": auth_n,
        "previewHeuristicFootprintCountIntersectingCrop": prev_n,
        "levelDiagnosticCodes": level_diag_codes,
    }


def _build_plan_primitive_lists(
    doc: Document,
    *,
    level: str | None,
    hidden_semantic: set[str],
    pinned_pv_el: PlanViewElem | None,
    crop_box_mm: tuple[float, float, float, float] | None,
    scheme_rows: list[RoomColorSchemeRow],
    line_weight_hint: float = 1.0,
    opening_tags_visible: bool = False,
    room_labels_visible: bool = False,
    opening_tag_catalog: PlanTagStyleElem | None = None,
    room_tag_catalog: PlanTagStyleElem | None = None,
    category_resolved: dict[str, ResolvedPlanCategoryGraphic] | None = None,
    view_range_clip_mm: tuple[float, float, float] | None = None,
    room_sep_wire_fields: dict[str, dict[str, Any]] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """2D primitives for deterministic server-side plan previews."""

    warnings: list[dict[str, Any]] = []

    def span_in_vertical_range(z0: float, z1: float) -> bool:
        if view_range_clip_mm is None:
            return True
        lo, hi, _cut = view_range_clip_mm
        return _closed_z_intervals_overlap_mm(z0, z1, lo, hi)

    crop_box = crop_box_mm
    if pinned_pv_el is not None:
        cmn, cmx = pinned_pv_el.crop_min_mm, pinned_pv_el.crop_max_mm
        has_partial_crop = (cmn is not None) ^ (cmx is not None)
        if has_partial_crop:
            warnings.append(
                {
                    "code": "cropBoxNotApplied",
                    "message": "Plan viewport crop requires both cropMinMm and cropMaxMm; primitives are not cropped.",
                }
            )
        if _plan_view_range_authoring_incomplete(pinned_pv_el):
            warnings.append(
                {
                    "code": "viewRangeNotApplied",
                    "message": "Plan view range is incomplete (both viewRangeBottomMm and viewRangeTopMm are required for vertical filtering); vertical clip is not applied.",
                }
            )

    walls: list[dict[str, Any]] = []
    floors: list[dict[str, Any]] = []
    rooms: list[dict[str, Any]] = []
    doors: list[dict[str, Any]] = []
    windows: list[dict[str, Any]] = []
    stairs: list[dict[str, Any]] = []
    roofs: list[dict[str, Any]] = []
    grid_lines: list[dict[str, Any]] = []
    room_separations: list[dict[str, Any]] = []
    dimensions: list[dict[str, Any]] = []

    def cat_eff(key: str) -> tuple[float, str]:
        if category_resolved is None:
            if key == "room_separation":
                return (1.0, "dash_short")
            return (1.0, "solid")
        r = category_resolved[key]
        return (r.line_weight_factor, r.line_pattern_token)

    def lvl_ok(lv: str | None) -> bool:
        if not level:
            return True
        return lv == level if lv else False

    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]

        if isinstance(e, WallElem):
            if "wall" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            if crop_box is not None and not _segment_intersects_crop_xy(
                e.start.x_mm, e.start.y_mm, e.end.x_mm, e.end.y_mm, crop_box
            ):
                continue
            wz0, wz1 = _wall_vertical_span_mm(doc, e)
            if not span_in_vertical_range(wz0, wz1):
                continue
            w_wt, _w_pat = cat_eff("wall")
            walls.append(
                {
                    "id": e.id,
                    "levelId": e.level_id,
                    "startMm": {"x": round(e.start.x_mm, 3), "y": round(e.start.y_mm, 3)},
                    "endMm": {"x": round(e.end.x_mm, 3), "y": round(e.end.y_mm, 3)},
                    "thicknessMm": round(e.thickness_mm, 3),
                    "heightMm": round(e.height_mm, 3),
                    "lineWeightHint": round(float(line_weight_hint) * float(w_wt), 4),
                }
            )
        elif isinstance(e, FloorElem):
            if "floor" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            floor_pts = [(p.x_mm, p.y_mm) for p in e.boundary_mm]
            if crop_box is not None and not _poly_bbox_overlaps_crop(floor_pts, crop_box):
                continue
            fz0, fz1 = _floor_vertical_span_mm(doc, e)
            if not span_in_vertical_range(fz0, fz1):
                continue
            outlines = [[round(p.x_mm, 3), round(p.y_mm, 3)] for p in e.boundary_mm]
            f_wt, f_pat = cat_eff("floor")
            floors.append(
                {
                    "id": e.id,
                    "levelId": e.level_id,
                    "outlineMm": outlines,
                    "lineWeightHint": round(float(line_weight_hint) * float(f_wt), 4),
                    "linePatternToken": f_pat,
                    "planCategoryGraphicKey": "floor",
                    "planOutlineSemantics": "slab_level_outline",
                }
            )
        elif isinstance(e, RoomElem):
            if "room" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            room_pts = [(p.x_mm, p.y_mm) for p in e.outline_mm]
            if crop_box is not None and not _poly_bbox_overlaps_crop(room_pts, crop_box):
                continue
            rmz0, rmz1 = _room_vertical_span_mm(doc, e)
            if not span_in_vertical_range(rmz0, rmz1):
                continue
            outlines = [[round(p.x_mm, 3), round(p.y_mm, 3)] for p in e.outline_mm]
            row: dict[str, Any] = {
                "id": e.id,
                "levelId": e.level_id,
                "outlineMm": outlines,
                "schemeColorHex": _scheme_color_hex_for_room(e, scheme_rows),
            }
            if (e.room_fill_override_hex or "").strip():
                row["roomFillOverrideHex"] = (e.room_fill_override_hex or "").strip()
            if (e.programme_code or "").strip():
                row["programmeCode"] = (e.programme_code or "").strip()
            if (e.department or "").strip():
                row["department"] = (e.department or "").strip()
            if (e.function_label or "").strip():
                row["functionLabel"] = (e.function_label or "").strip()
            if room_labels_visible:
                row["planTagLabel"] = _format_room_tag_with_style(e, room_tag_catalog)
            rooms.append(row)
        elif isinstance(e, DoorElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            if "door" in hidden_semantic or "wall" in hidden_semantic or not lvl_ok(w.level_id):
                continue
            tspan = hosted_opening_t_span_normalized(e, w)
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            if crop_box is not None:
                opening_ok = _point_in_crop_xy(
                    cx_mm, cy_mm, crop_box
                ) or _segment_intersects_crop_xy(
                    w.start.x_mm, w.start.y_mm, w.end.x_mm, w.end.y_mm, crop_box
                )
                if not opening_ok:
                    continue
            dwz0, dwz1 = _wall_vertical_span_mm(doc, w)
            if not span_in_vertical_range(dwz0, dwz1):
                continue
            dout: dict[str, Any] = {
                "id": e.id,
                "wallId": e.wall_id,
                "levelId": w.level_id,
                "alongT": round(float(e.along_t), 6),
                "widthMm": round(e.width_mm, 3),
                "anchorMm": {"x": round(cx_mm, 3), "y": round(cy_mm, 3)},
                "openingTSpanNormalized": [round(float(tspan[0]), 6), round(float(tspan[1]), 6)]
                if tspan
                else None,
            }
            if not wall_plan_axis_aligned_xy(w):
                dout["wallYawDeg"] = wall_plan_yaw_deg(w)
            if opening_tags_visible:
                dout["planTagLabel"] = _format_opening_tag_with_style(e, opening_tag_catalog)
            doors.append(dout)
        elif isinstance(e, WindowElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            if "window" in hidden_semantic or "wall" in hidden_semantic or not lvl_ok(w.level_id):
                continue
            tspan = hosted_opening_t_span_normalized(e, w)
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            if crop_box is not None:
                opening_ok = _point_in_crop_xy(
                    cx_mm, cy_mm, crop_box
                ) or _segment_intersects_crop_xy(
                    w.start.x_mm, w.start.y_mm, w.end.x_mm, w.end.y_mm, crop_box
                )
                if not opening_ok:
                    continue
            wwz0, wwz1 = _wall_vertical_span_mm(doc, w)
            if not span_in_vertical_range(wwz0, wwz1):
                continue
            wrow: dict[str, Any] = {
                "id": e.id,
                "wallId": e.wall_id,
                "levelId": w.level_id,
                "alongT": round(float(e.along_t), 6),
                "widthMm": round(e.width_mm, 3),
                "sillHeightMm": round(e.sill_height_mm, 3),
                "heightMm": round(e.height_mm, 3),
                "anchorMm": {"x": round(cx_mm, 3), "y": round(cy_mm, 3)},
                "openingTSpanNormalized": [round(float(tspan[0]), 6), round(float(tspan[1]), 6)]
                if tspan
                else None,
            }
            if not wall_plan_axis_aligned_xy(w):
                wrow["wallYawDeg"] = wall_plan_yaw_deg(w)
            if opening_tags_visible:
                wrow["planTagLabel"] = _format_opening_tag_with_style(e, opening_tag_catalog)
            windows.append(wrow)
        elif isinstance(e, StairElem):
            if "stair" in hidden_semantic or not lvl_ok(e.base_level_id):
                continue
            if crop_box is not None and not _segment_intersects_crop_xy(
                e.run_start.x_mm,
                e.run_start.y_mm,
                e.run_end.x_mm,
                e.run_end.y_mm,
                crop_box,
            ):
                continue
            sz0, sz1 = _stair_vertical_span_mm(doc, e)
            if not span_in_vertical_range(sz0, sz1):
                continue
            run_len_mm = math.hypot(
                float(e.run_end.x_mm) - float(e.run_start.x_mm),
                float(e.run_end.y_mm) - float(e.run_start.y_mm),
            )
            rc_proxy = stair_riser_count_plan_proxy(doc, e, run_length_mm=run_len_mm)
            tc_proxy = stair_tread_count_straight_plan_proxy(rc_proxy)
            bearing = stair_run_bearing_deg_ccw_from_plan_x(
                float(e.run_start.x_mm),
                float(e.run_start.y_mm),
                float(e.run_end.x_mm),
                float(e.run_end.y_mm),
            )
            stair_row: dict[str, Any] = {
                "id": e.id,
                "baseLevelId": e.base_level_id,
                "topLevelId": e.top_level_id,
                "riserMm": round(float(e.riser_mm), 3),
                "treadMm": round(float(e.tread_mm), 3),
                "riserCountPlanProxy": rc_proxy,
                "treadCountPlanProxy": tc_proxy,
                "runBearingDegCcFromPlanX": bearing,
                "runStartMm": {
                    "x": round(e.run_start.x_mm, 3),
                    "y": round(e.run_start.y_mm, 3),
                },
                "runEndMm": {
                    "x": round(e.run_end.x_mm, 3),
                    "y": round(e.run_end.y_mm, 3),
                },
                "widthMm": round(e.width_mm, 3),
            }
            blv = doc.elements.get(e.base_level_id)
            tlv = doc.elements.get(e.top_level_id)
            if isinstance(blv, LevelElem):
                stair_row["baseLevelName"] = blv.name
            if isinstance(tlv, LevelElem):
                stair_row["topLevelName"] = tlv.name
            if isinstance(blv, LevelElem) and isinstance(tlv, LevelElem):
                z_lo = float(min(blv.elevation_mm, tlv.elevation_mm))
                z_hi = float(max(blv.elevation_mm, tlv.elevation_mm))
                rise_story = z_hi - z_lo
                stair_row["planUpDownLabel"] = stair_plan_up_down_label(
                    float(blv.elevation_mm),
                    float(tlv.elevation_mm),
                )
                if rise_story > 1e-3:
                    stair_row["storyRiseMm"] = round(rise_story, 3)
                    stair_row["totalRiseMm"] = round(rise_story, 3)
                    stair_row["midRunElevationMm"] = round(z_lo + rise_story * 0.5, 3)
                    if view_range_clip_mm is not None:
                        br = stair_plan_break_visibility_token(view_range_clip_mm, sz0, sz1)
                        if br is not None:
                            stair_row["stairPlanBreakVisibilityToken"] = br
            ud_lab = (
                stair_plan_up_down_label(float(blv.elevation_mm), float(tlv.elevation_mm))
                if isinstance(blv, LevelElem) and isinstance(tlv, LevelElem)
                else "—"
            )
            ph = stair_documentation_placeholders_v0(
                e,
                run_length_mm=run_len_mm,
                plan_up_down_label=ud_lab,
                riser_count_plan_proxy=rc_proxy,
                tread_count_plan_proxy=tc_proxy,
            )
            if ph is not None:
                stair_row["stairDocumentationPlaceholders_v0"] = ph
                stair_row["stairPlanSectionDocumentationLabel"] = ph[
                    "stairPlanSectionDocumentationLabel"
                ]
            diags = stair_documentation_diagnostics(
                doc,
                e,
                riser_count_plan_proxy=rc_proxy,
                run_length_mm=run_len_mm,
            )
            if diags:
                stair_row["stairDocumentationDiagnostics"] = diags
            _sx = stair_schedule_row_extensions_v1(doc, e)
            if ph is None:
                _sx = dict(_sx)
                _sx.pop("stairPlanSectionDocumentationLabel", None)
            stair_row.update(_sx)
            stairs.append(stair_row)
        elif isinstance(e, RoofElem):
            ref = getattr(e, "reference_level_id", "") or ""
            if "roof" in hidden_semantic or not lvl_ok(ref):
                continue
            fp_pts = [(p.x_mm, p.y_mm) for p in e.footprint_mm]
            if crop_box is not None and not _poly_bbox_overlaps_crop(fp_pts, crop_box):
                continue
            rfz0, rfz1 = _roof_vertical_span_mm(doc, e)
            if not span_in_vertical_range(rfz0, rfz1):
                continue
            fp = [[round(p.x_mm, 3), round(p.y_mm, 3)] for p in e.footprint_mm]
            r_wt, r_pat = cat_eff("roof")
            roof_row: dict[str, Any] = {
                "id": e.id,
                "referenceLevelId": ref,
                "footprintMm": fp,
                **_roof_plan_wire_geometry_fields(doc, e),
                **roof_surface_material_readout_v0(doc, e),
                "lineWeightHint": round(float(line_weight_hint) * float(r_wt), 4),
                "linePatternToken": r_pat,
                "planCategoryGraphicKey": "roof",
                "planOutlineSemantics": "roof_footprint_projection",
            }
            if e.roof_geometry_mode == "gable_pitched_rectangle" and roof_row.get("ridgeAxisPlan"):
                roof_row["roofFasciaEdgePlanToken"] = gable_rectangle_fascia_edge_plan_token_v0(
                    cast(RidgeAxisPlan, roof_row["ridgeAxisPlan"]),
                )
            roof_row.update(roof_layered_prism_payload_for_merge_v1(doc, e))
            roofs.append(roof_row)
        elif isinstance(e, GridLineElem):
            elv = getattr(e, "level_id", None)
            if "grid_line" in hidden_semantic or (level and elv is not None and elv != level):
                continue
            if crop_box is not None and not _segment_intersects_crop_xy(
                e.start.x_mm, e.start.y_mm, e.end.x_mm, e.end.y_mm, crop_box
            ):
                continue
            if view_range_clip_mm is not None and elv is not None:
                gz = _level_elevation_mm(doc, elv)
                lo, hi, _cu = view_range_clip_mm
                if not _closed_z_intervals_overlap_mm(gz, gz, lo, hi):
                    continue
            g_wt, g_pat = cat_eff("grid_line")
            grid_lines.append(
                {
                    "id": e.id,
                    "levelId": elv,
                    "startMm": {"x": round(e.start.x_mm, 3), "y": round(e.start.y_mm, 3)},
                    "endMm": {"x": round(e.end.x_mm, 3), "y": round(e.end.y_mm, 3)},
                    "linePatternToken": g_pat,
                    "lineWeightHint": round(float(line_weight_hint) * float(g_wt), 4),
                }
            )
        elif isinstance(e, RoomSeparationElem):
            if "room_separation" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            if crop_box is not None and not _segment_intersects_crop_xy(
                e.start.x_mm, e.start.y_mm, e.end.x_mm, e.end.y_mm, crop_box
            ):
                continue
            if view_range_clip_mm is not None:
                sepz = _level_elevation_mm(doc, e.level_id)
                lo, hi, _cu = view_range_clip_mm
                if not _closed_z_intervals_overlap_mm(sepz, sepz, lo, hi):
                    continue
            s_wt, s_pat = cat_eff("room_separation")
            row_rs: dict[str, Any] = {
                "id": e.id,
                "name": e.name,
                "levelId": e.level_id,
                "startMm": {"x": round(e.start.x_mm, 3), "y": round(e.start.y_mm, 3)},
                "endMm": {"x": round(e.end.x_mm, 3), "y": round(e.end.y_mm, 3)},
                "lengthMm": round(
                    math.hypot(e.end.x_mm - e.start.x_mm, e.end.y_mm - e.start.y_mm), 3
                ),
                "linePatternToken": s_pat,
                "lineWeightHint": round(float(line_weight_hint) * float(s_wt), 4),
            }
            xf = room_sep_wire_fields.get(e.id) if room_sep_wire_fields else None
            if xf:
                row_rs["axisAlignedBoundarySegmentEligible"] = xf[
                    "axisAlignedBoundarySegmentEligible"
                ]
                rsn = xf.get("axisBoundarySegmentExcludedReason")
                if rsn:
                    row_rs["axisBoundarySegmentExcludedReason"] = rsn
                row_rs["onAuthoritativeDerivedFootprintBoundary"] = xf[
                    "onAuthoritativeDerivedFootprintBoundary"
                ]
                row_rs["piercesDerivedRectangleInterior"] = xf["piercesDerivedRectangleInterior"]
            room_separations.append(row_rs)
        elif isinstance(e, DimensionElem):
            if "dimension" in hidden_semantic or not lvl_ok(e.level_id):
                continue
            if crop_box is not None and not _segment_intersects_crop_xy(
                e.a_mm.x_mm, e.a_mm.y_mm, e.b_mm.x_mm, e.b_mm.y_mm, crop_box
            ):
                continue
            if view_range_clip_mm is not None:
                dmz = _level_elevation_mm(doc, e.level_id)
                lo, hi, _cu = view_range_clip_mm
                if not _closed_z_intervals_overlap_mm(dmz, dmz, lo, hi):
                    continue
            dimensions.append(
                {
                    "id": e.id,
                    "levelId": e.level_id,
                    "aMm": {"x": round(e.a_mm.x_mm, 3), "y": round(e.a_mm.y_mm, 3)},
                    "bMm": {"x": round(e.b_mm.x_mm, 3), "y": round(e.b_mm.y_mm, 3)},
                    "offsetMm": {"x": round(e.offset_mm.x_mm, 3), "y": round(e.offset_mm.y_mm, 3)},
                }
            )

    primitives = {
        "format": "planProjectionPrimitives_v1",
        "walls": walls,
        "floors": floors,
        "rooms": rooms,
        "doors": doors,
        "windows": windows,
        "stairs": stairs,
        "roofs": roofs,
        "gridLines": grid_lines,
        "roomSeparations": room_separations,
        "dimensions": dimensions,
    }
    return primitives, warnings


def _room_color_legend_payload(
    doc: Document,
    *,
    level: str | None,
    hidden_semantic: set[str],
    scheme_rows: list[RoomColorSchemeRow],
    view_range_clip_mm: tuple[float, float, float] | None = None,
) -> list[dict[str, Any]]:
    if "room" in hidden_semantic:
        return []
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for e in doc.elements.values():
        if not isinstance(e, RoomElem):
            continue
        if level and e.level_id != level:
            continue
        if view_range_clip_mm is not None:
            lo, hi, _cut = view_range_clip_mm
            rz0, rz1 = _room_vertical_span_mm(doc, e)
            if not _closed_z_intervals_overlap_mm(rz0, rz1, lo, hi):
                continue
        label = (
            (e.programme_code or "").strip()
            or (e.department or "").strip()
            or (e.function_label or "").strip()
            or (e.name or "").strip()
            or e.id
        )
        hx = _scheme_color_hex_for_room(e, scheme_rows)
        key = (label, hx)
        if key in seen:
            continue
        seen.add(key)
        row: dict[str, Any] = {"label": label, "schemeColorHex": hx}
        if (e.programme_code or "").strip():
            row["programmeCode"] = (e.programme_code or "").strip()
        if (e.department or "").strip():
            row["department"] = (e.department or "").strip()
        if (e.function_label or "").strip():
            row["functionLabel"] = (e.function_label or "").strip()
        out.append(row)
    return sorted(out, key=lambda r: str(r.get("label", "")))


def _room_programme_legend_evidence_v0(
    legend: list[dict[str, Any]],
    *,
    scheme_override_row_count: int = 0,
) -> dict[str, Any]:
    """Stable digest correlating schedules, sheets, and clients; orthogonal to boundary preview."""

    canon = json.dumps(legend, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canon.encode("utf-8")).hexdigest()
    notes = (
        "Digest covers roomColorLegend rows from authored RoomElem programme metadata on the "
        "active plan level. Derived vacant footprints (derivedRoomBoundaryEvidence_v0) and "
        "heuristic boundary previews do not seed this digest."
    )
    if scheme_override_row_count > 0:
        notes += (
            " Replayable programme/department entries on bim-room-color-scheme may override "
            "schemeColorHex versus the trimmed programme/id hash fallback."
        )
    payload: dict[str, Any] = {
        "format": "roomProgrammeLegendEvidence_v0",
        "legendDigestSha256": digest,
        "rowCount": len(legend),
        "colorSeedPolicy": "trimmed_programme_code_or_else_element_id",
        "orthogonalTo": [
            "derivedRoomBoundaryEvidence_v0",
            "planProjectionPrimitives.roomOutlinesMm",
        ],
        "notes": notes,
    }
    if scheme_override_row_count > 0:
        payload["schemeOverridesSource"] = "bim-room-color-scheme"
        payload["schemeOverrideRowCount"] = int(scheme_override_row_count)
    return payload


def _counts_from_plan_primitives(prim: dict[str, Any]) -> tuple[int, dict[str, int]]:
    key_map = (
        ("walls", "wall"),
        ("floors", "floor"),
        ("rooms", "room"),
        ("doors", "door"),
        ("windows", "window"),
        ("stairs", "stair"),
        ("roofs", "roof"),
        ("gridLines", "grid_line"),
        ("roomSeparations", "room_separation"),
        ("dimensions", "dimension"),
    )
    counts: dict[str, int] = {}
    total = 0
    for pk, ck in key_map:
        n = len(prim.get(pk) or [])
        if n:
            counts[ck] = n
            total += n
    return total, dict(sorted(counts.items()))


def _slab_opening_documentation_rows_for_plan_view(
    doc: Document,
    *,
    level: str | None,
    hidden_semantic: set[str],
    crop_box_mm: tuple[float, float, float, float] | None,
    view_range_clip_mm: tuple[float, float, float] | None,
) -> list[dict[str, Any]]:
    """Slab void documentation rows for the active plan level and crop / view range."""

    def span_in_vertical_range(z0: float, z1: float) -> bool:
        if view_range_clip_mm is None:
            return True
        lo, hi, _cut = view_range_clip_mm
        return _closed_z_intervals_overlap_mm(z0, z1, lo, hi)

    def lvl_ok(lv: str | None) -> bool:
        if not level:
            return True
        return lv == level if lv else False

    out: list[dict[str, Any]] = []
    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, SlabOpeningElem)):
        sop = doc.elements[eid]
        assert isinstance(sop, SlabOpeningElem)
        host = doc.elements.get(sop.host_floor_id)
        if not isinstance(host, FloorElem):
            continue
        if "floor" in hidden_semantic or not lvl_ok(host.level_id):
            continue
        op_poly = [(float(p.x_mm), float(p.y_mm)) for p in sop.boundary_mm]
        if len(op_poly) < 3:
            continue
        if crop_box_mm is not None and not _poly_bbox_overlaps_crop(op_poly, crop_box_mm):
            continue
        fz0, fz1 = _floor_vertical_span_mm(doc, host)
        if not span_in_vertical_range(fz0, fz1):
            continue
        row = slab_opening_documentation_row_v0(doc, sop)
        if row is not None:
            out.append(row)
    return out


def _wall_corner_join_summary_for_plan_view(
    doc: Document,
    *,
    level: str | None,
    hidden_semantic: set[str],
    crop_box_mm: tuple[float, float, float, float] | None,
    view_range_clip_mm: tuple[float, float, float] | None,
) -> dict[str, Any] | None:
    """Corner/overlap join rows filtered like wall-opening cut-fidelity visibility gates."""

    full = collect_wall_corner_join_summary_v1(doc)
    if not full:
        return None
    raw_joins = full.get("joins")
    if not isinstance(raw_joins, list):
        return None

    def span_in_vertical_range(z0: float, z1: float) -> bool:
        if view_range_clip_mm is None:
            return True
        lo, hi, _cut = view_range_clip_mm
        return _closed_z_intervals_overlap_mm(z0, z1, lo, hi)

    def lvl_ok(lv: str | None) -> bool:
        if not level:
            return True
        return lv == level if lv else False

    def opening_visible(oid: str) -> bool:
        e = doc.elements.get(oid)
        if isinstance(e, DoorElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                return False
            if "door" in hidden_semantic or "wall" in hidden_semantic or not lvl_ok(w.level_id):
                return False
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            crop_box = crop_box_mm
            if crop_box is not None:
                opening_ok = _point_in_crop_xy(
                    cx_mm, cy_mm, crop_box
                ) or _segment_intersects_crop_xy(
                    w.start.x_mm, w.start.y_mm, w.end.x_mm, w.end.y_mm, crop_box
                )
                if not opening_ok:
                    return False
            dwz0, dwz1 = _wall_vertical_span_mm(doc, w)
            return span_in_vertical_range(dwz0, dwz1)
        if isinstance(e, WindowElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                return False
            if "window" in hidden_semantic or "wall" in hidden_semantic or not lvl_ok(w.level_id):
                return False
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            crop_box = crop_box_mm
            if crop_box is not None:
                opening_ok = _point_in_crop_xy(
                    cx_mm, cy_mm, crop_box
                ) or _segment_intersects_crop_xy(
                    w.start.x_mm, w.start.y_mm, w.end.x_mm, w.end.y_mm, crop_box
                )
                if not opening_ok:
                    return False
            wwz0, wwz1 = _wall_vertical_span_mm(doc, w)
            return span_in_vertical_range(wwz0, wwz1)
        return False

    out_joins: list[dict[str, Any]] = []
    for row in raw_joins:
        if not isinstance(row, dict):
            continue
        lvl_id = row.get("levelId")
        if level and str(lvl_id or "") != level:
            continue
        vm = row.get("vertexMm")
        if not isinstance(vm, dict):
            continue
        try:
            vx = float(vm["xMm"])
            vy = float(vm["yMm"])
        except (KeyError, TypeError, ValueError):
            continue
        if crop_box_mm is not None and not _point_in_crop_xy(vx, vy, crop_box_mm):
            continue
        oids = row.get("affectedOpeningIds")
        if not isinstance(oids, list):
            oids = []
        filtered = sorted(str(x) for x in oids if opening_visible(str(x)))
        new_row = dict(row)
        new_row["affectedOpeningIds"] = filtered
        out_joins.append(new_row)

    if not out_joins:
        return None
    return {"format": "wallCornerJoinSummary_v1", "joins": out_joins}


def _wall_opening_cut_fidelity_rows_for_plan_view(
    doc: Document,
    *,
    level: str | None,
    hidden_semantic: set[str],
    crop_box_mm: tuple[float, float, float, float] | None,
    view_range_clip_mm: tuple[float, float, float] | None,
) -> list[dict[str, Any]]:
    """Wall-hosted opening cut fidelity rows matching visible doors/windows on the active plan."""

    def span_in_vertical_range(z0: float, z1: float) -> bool:
        if view_range_clip_mm is None:
            return True
        lo, hi, _cut = view_range_clip_mm
        return _closed_z_intervals_overlap_mm(z0, z1, lo, hi)

    def lvl_ok(lv: str | None) -> bool:
        if not level:
            return True
        return lv == level if lv else False

    joins = corner_join_rows_for_document(doc)
    out: list[dict[str, Any]] = []

    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if isinstance(e, DoorElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            if "door" in hidden_semantic or "wall" in hidden_semantic or not lvl_ok(w.level_id):
                continue
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            crop_box = crop_box_mm
            if crop_box is not None:
                opening_ok = _point_in_crop_xy(
                    cx_mm, cy_mm, crop_box
                ) or _segment_intersects_crop_xy(
                    w.start.x_mm, w.start.y_mm, w.end.x_mm, w.end.y_mm, crop_box
                )
                if not opening_ok:
                    continue
            dwz0, dwz1 = _wall_vertical_span_mm(doc, w)
            if not span_in_vertical_range(dwz0, dwz1):
                continue
            out.append(build_wall_opening_cut_fidelity_row(doc, e, corner_joins=joins))
        elif isinstance(e, WindowElem):
            w = doc.elements.get(e.wall_id)
            if not isinstance(w, WallElem):
                continue
            if "window" in hidden_semantic or "wall" in hidden_semantic or not lvl_ok(w.level_id):
                continue
            cx_mm, cy_mm = _hosted_xy_mm_on_wall(e, w)
            crop_box = crop_box_mm
            if crop_box is not None:
                opening_ok = _point_in_crop_xy(
                    cx_mm, cy_mm, crop_box
                ) or _segment_intersects_crop_xy(
                    w.start.x_mm, w.start.y_mm, w.end.x_mm, w.end.y_mm, crop_box
                )
                if not opening_ok:
                    continue
            wwz0, wwz1 = _wall_vertical_span_mm(doc, w)
            if not span_in_vertical_range(wwz0, wwz1):
                continue
            out.append(build_wall_opening_cut_fidelity_row(doc, e, corner_joins=joins))

    out.sort(key=lambda r: (str(r["hostWallId"]), str(r["openingId"])))
    return out


def _grid_axis_bucket_token(dx: float, dy: float) -> str:
    if not math.isfinite(dx) or not math.isfinite(dy):
        return "D"
    adx = abs(dx)
    ady = abs(dy)
    if adx < 1e-9 and ady < 1e-9:
        return "D"
    if ady <= 1e-9 * max(1.0, adx):
        return "H"
    if adx <= 1e-9 * max(1.0, ady):
        return "V"
    ang = math.degrees(math.atan2(dy, dx)) % 180.0
    if ang < 15.0 or ang > 165.0:
        return "H"
    if 75.0 < ang < 105.0:
        return "V"
    return "D"


def _planar_segments_intersect_xy(
    ax: float,
    ay: float,
    bx: float,
    by: float,
    cx: float,
    cy: float,
    dx: float,
    dy: float,
) -> bool:
    """True when closed segments AB and CD share at least one point in the XY plane."""

    _eps = 1e-7

    def orient(px: float, py: float, qx: float, qy: float, rx: float, ry: float) -> float:
        return (qy - py) * (rx - qx) - (qx - px) * (ry - qy)

    def on_seg(px: float, py: float, qx: float, qy: float, rx: float, ry: float) -> bool:
        return (
            min(px, qx) - _eps <= rx <= max(px, qx) + _eps
            and min(py, qy) - _eps <= ry <= max(py, qy) + _eps
        )

    o1 = orient(ax, ay, bx, by, cx, cy)
    o2 = orient(ax, ay, bx, by, dx, dy)
    o3 = orient(cx, cy, dx, dy, ax, ay)
    o4 = orient(cx, cy, dx, dy, bx, by)

    def sgn(val: float) -> int:
        if val > _eps:
            return 1
        if val < -_eps:
            return -1
        return 0

    s1, s2, s3, s4 = sgn(o1), sgn(o2), sgn(o3), sgn(o4)

    if s1 != s2 and s3 != s4:
        return True
    if s1 == 0 and on_seg(ax, ay, bx, by, cx, cy):
        return True
    if s2 == 0 and on_seg(ax, ay, bx, by, dx, dy):
        return True
    if s3 == 0 and on_seg(cx, cy, dx, dy, ax, ay):
        return True
    if s4 == 0 and on_seg(cx, cy, dx, dy, bx, by):
        return True
    return False


def _plan_grid_datum_evidence_v0(
    doc: Document,
    *,
    level: str | None,
    hidden_semantic: set[str],
    associated_plan_view_id: str | None,
    active_level_id: str | None,
    crop_box_mm: tuple[float, float, float, float] | None,
    view_range_clip_mm: tuple[float, float, float] | None,
) -> dict[str, Any]:
    """Compact grid/datum digest; mirrors `_build_plan_primitive_lists` grid visibility filters."""

    rows: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, GridLineElem):
            continue
        elv = getattr(e, "level_id", None)
        if "grid_line" in hidden_semantic or (level and elv is not None and elv != level):
            continue
        if crop_box_mm is not None and not _segment_intersects_crop_xy(
            e.start.x_mm, e.start.y_mm, e.end.x_mm, e.end.y_mm, crop_box_mm
        ):
            continue
        if view_range_clip_mm is not None and elv is not None:
            gz = _level_elevation_mm(doc, elv)
            lo, hi, _cu = view_range_clip_mm
            if not _closed_z_intervals_overlap_mm(gz, gz, lo, hi):
                continue

        ddx = float(e.end.x_mm - e.start.x_mm)
        ddy = float(e.end.y_mm - e.start.y_mm)
        axis = _grid_axis_bucket_token(ddx, ddy)
        reference_ok = True
        reason_code: str | None = None
        if elv is not None:
            host = doc.elements.get(elv)
            if not isinstance(host, LevelElem):
                reference_ok = False
                reason_code = "datum_grid_reference_missing"

        row: dict[str, Any] = {
            "gridId": e.id,
            "levelId": elv,
            "axisToken": axis,
            "referenceOk": reference_ok,
        }
        if not reference_ok and reason_code is not None:
            row["reasonCode"] = reason_code
        rows.append(row)

    return {
        "format": "planGridDatumEvidence_v0",
        "associatedPlanViewId": associated_plan_view_id,
        "activeLevelId": active_level_id,
        "rows": rows,
    }


def _section_datum_elevation_evidence_v0(
    doc: Document,
    sec: SectionCutElem,
    prim: dict[str, Any],
    warnings: list[dict[str, Any]],
) -> dict[str, Any]:
    degenerate = any(str(w.get("code") or "") == "degenerateCutLine" for w in warnings)
    markers = prim.get("levelMarkers") or []
    out: dict[str, Any] = {
        "format": "sectionDatumElevationEvidence_v0",
        "levelMarkerCount": len(markers),
    }
    if degenerate:
        out["reasonCode"] = "degenerateCutLine"
        out["gridCrossingCount"] = None
        return out

    sx0 = float(sec.line_start_mm.x_mm)
    sy0 = float(sec.line_start_mm.y_mm)
    sx1 = float(sec.line_end_mm.x_mm)
    sy1 = float(sec.line_end_mm.y_mm)
    if not math.isfinite(sx0 + sy0 + sx1 + sy1) or math.hypot(sx1 - sx0, sy1 - sy0) < 1e-6:
        out["reasonCode"] = "degenerateCutLine"
        out["gridCrossingCount"] = None
        return out

    crossings = 0
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, GridLineElem):
            continue
        if _planar_segments_intersect_xy(
            sx0,
            sy0,
            sx1,
            sy1,
            float(e.start.x_mm),
            float(e.start.y_mm),
            float(e.end.x_mm),
            float(e.end.y_mm),
        ):
            crossings += 1
    out["gridCrossingCount"] = crossings
    return out


def resolve_plan_projection_wire(
    doc: Document,
    *,
    plan_view_id: str | None,
    fallback_level_id: str | None,
    global_plan_presentation: str = "default",
    sheet_viewport_row_for_crop: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Mirror `packages/web/src/plan/planProjection.ts` semantics for deterministic tests."""

    hidden_semantic: set[str] = set()
    active_level: str | None = fallback_level_id
    presentation = global_plan_presentation
    pinned_pv: str | None = None
    pinned_pv_elem: PlanViewElem | None = None

    if plan_view_id:
        pv_el = doc.elements.get(plan_view_id)
        if isinstance(pv_el, PlanViewElem):
            pinned_pv = plan_view_id
            pinned_pv_elem = pv_el
            active_level = pv_el.level_id
            for lab in pv_el.categories_hidden or ():
                k = _canon_hidden_category(str(lab))
                if k:
                    hidden_semantic.add(k)

            tmpl_id = pv_el.view_template_id
            if tmpl_id:
                tmpl = doc.elements.get(tmpl_id)
                if isinstance(tmpl, ViewTemplateElem):
                    for lab in tmpl.hidden_categories or ():
                        k = _canon_hidden_category(str(lab))
                        if k:
                            hidden_semantic.add(k)

            pres_raw = getattr(pv_el, "plan_presentation", None) or "default"
            if pres_raw in {"opening_focus", "room_scheme"}:
                presentation = str(pres_raw)
            else:
                presentation = "default"

    view_range_clip_mm: tuple[float, float, float] | None = None
    if pinned_pv_elem is not None:
        view_range_clip_mm = _resolve_plan_view_range_clip_mm(doc, pinned_pv_elem)

    def kind_visible(kind: str) -> bool:
        return kind not in hidden_semantic

    level = active_level

    counts: dict[str, int] = {}
    eligible = 0

    def bump(k: str) -> None:
        nonlocal eligible
        if not kind_visible(k):
            return
        eligible += 1
        counts[k] = counts.get(k, 0) + 1

    for e in doc.elements.values():
        ek = getattr(e, "kind", None)
        if ek == "wall" and isinstance(e, WallElem):
            if not level or e.level_id == level:
                bump("wall")
        elif ek == "floor" and isinstance(e, FloorElem):
            if not level or e.level_id == level:
                bump("floor")
        elif ek == "roof" and isinstance(e, RoofElem):
            ref = getattr(e, "reference_level_id", "") or ""
            if not level or ref == level:
                bump("roof")
        elif ek == "room" and isinstance(e, RoomElem):
            if not level or e.level_id == level:
                bump("room")
        elif ek == "door" and isinstance(e, DoorElem):
            w = doc.elements.get(e.wall_id)
            if isinstance(w, WallElem) and (not level or w.level_id == level):
                bump("door")
        elif ek == "window" and isinstance(e, WindowElem):
            w = doc.elements.get(e.wall_id)
            if isinstance(w, WallElem) and (not level or w.level_id == level):
                bump("window")
        elif ek == "stair" and isinstance(e, StairElem):
            if not level or e.base_level_id == level:
                bump("stair")
        elif ek == "grid_line" and isinstance(e, GridLineElem):
            elv = getattr(e, "level_id", None)
            if elv is None or not level or elv == level:
                bump("grid_line")
        elif ek == "room_separation" and isinstance(e, RoomSeparationElem):
            if not level or e.level_id == level:
                bump("room_separation")
        elif ek == "dimension" and isinstance(e, DimensionElem):
            if not level or e.level_id == level:
                bump("dimension")

    plan_graphic_hints: dict[str, Any] | None = None
    line_weight_scale = 1.0
    plan_ann: dict[str, bool] | None = None
    opening_vis = False
    room_lab_vis = False
    cat_res: dict[str, ResolvedPlanCategoryGraphic] | None = None
    if pinned_pv_elem is not None:
        plan_graphic_hints = _plan_graphic_hints_for_pinned_view(doc, pinned_pv_elem)
        line_weight_scale = float(plan_graphic_hints["lineWeightScale"])
        plan_ann = _plan_annotation_hints_for_pinned_view(doc, pinned_pv_elem)
        opening_vis = bool(plan_ann["openingTagsVisible"])
        room_lab_vis = bool(plan_ann["roomLabelsVisible"])
        cat_res = resolve_plan_category_graphics_for_pinned_view(doc, pinned_pv_elem)

    extra_prim_warn: list[dict[str, Any]] = []
    sheet_crop_box: tuple[float, float, float, float] | None = None
    if sheet_viewport_row_for_crop is not None:
        sbox, sheet_partial = _sheet_viewport_crop_box_xy_mm(sheet_viewport_row_for_crop)
        if sheet_partial:
            extra_prim_warn.append(
                {
                    "code": "sheetViewportCropNotApplied",
                    "message": "Sheet viewport crop requires both cropMinMm and cropMaxMm; sheet crop is ignored for primitives.",
                }
            )
        else:
            sheet_crop_box = sbox

    plan_crop_box = _normalized_crop_box_xy_mm(pinned_pv_elem)
    effective_crop = _intersect_axis_aligned_crop_boxes(plan_crop_box, sheet_crop_box)

    scheme_rows = _document_room_scheme_rows(doc)

    res_open: _ResolvedPlanTagStyleLane | None = None
    res_room: _ResolvedPlanTagStyleLane | None = None
    tag_warn_bucket: list[dict[str, Any]] = []
    opening_cat: PlanTagStyleElem | None = None
    room_cat: PlanTagStyleElem | None = None
    if pinned_pv_elem is not None:
        res_open = _resolve_plan_tag_style_lane(doc, pinned_pv_elem, "opening")
        res_room = _resolve_plan_tag_style_lane(doc, pinned_pv_elem, "room")
        tag_warn_bucket = list(res_open.warnings) + list(res_room.warnings)
        opening_cat = res_open.catalog
        room_cat = res_room.catalog

    room_boundary_bundle = compute_room_boundary_derivation(doc)
    sep_wire_fields = room_separation_plan_wire_row_fields_by_id(doc, room_boundary_bundle)

    prim, prim_warn = _build_plan_primitive_lists(
        doc,
        level=active_level,
        hidden_semantic=hidden_semantic,
        pinned_pv_el=pinned_pv_elem,
        crop_box_mm=effective_crop,
        scheme_rows=scheme_rows,
        line_weight_hint=line_weight_scale,
        opening_tags_visible=opening_vis,
        room_labels_visible=room_lab_vis,
        opening_tag_catalog=opening_cat,
        room_tag_catalog=room_cat,
        category_resolved=cat_res,
        view_range_clip_mm=view_range_clip_mm,
        room_sep_wire_fields=sep_wire_fields,
    )
    if view_range_clip_mm is not None:
        eligible, counts = _counts_from_plan_primitives(prim)
    all_warnings = sorted(
        list(extra_prim_warn) + list(prim_warn) + tag_warn_bucket,
        key=_warning_sort_key,
    )
    legend = _room_color_legend_payload(
        doc,
        level=active_level,
        hidden_semantic=hidden_semantic,
        scheme_rows=scheme_rows,
        view_range_clip_mm=view_range_clip_mm,
    )

    out_payload: dict[str, Any] = {
        "format": "planProjectionWire_v1",
        "planViewElementId": pinned_pv,
        "activeLevelId": active_level,
        "planPresentation": presentation,
        "hiddenSemanticKinds": sorted(hidden_semantic),
        "visibleElementEligibleCount": eligible,
        "countsByVisibleKind": dict(sorted(counts.items())),
        "warnings": all_warnings,
        "primitives": prim,
        "roomColorLegend": legend,
        "roomProgrammeLegendEvidence_v0": _room_programme_legend_evidence_v0(
            legend,
            scheme_override_row_count=len(scheme_rows),
        ),
        "derivedRoomBoundaryEvidence_v0": _derived_room_boundary_evidence_for_wire(
            doc,
            active_level_id=active_level,
            effective_crop_mm=effective_crop,
            room_boundary_bundle=room_boundary_bundle,
            view_range_clip_mm=view_range_clip_mm,
        ),
        "derivedRoomBoundaryDiagnostics_v0": _derived_room_boundary_diagnostics_for_wire(
            active_level_id=active_level,
            effective_crop_mm=effective_crop,
            bundle=room_boundary_bundle,
            doc=doc,
            view_range_clip_mm=view_range_clip_mm,
        ),
    }
    if view_range_clip_mm is not None and pinned_pv_elem is not None:
        z_lo, z_hi, cut_z = view_range_clip_mm
        out_payload["planViewRangeEvidence_v0"] = {
            "format": "planViewRangeEvidence_v0",
            "bottomZMm": round(float(z_lo), 3),
            "topZMm": round(float(z_hi), 3),
            "cutPlaneZMm": round(float(cut_z), 3),
            "associatedLevelId": pinned_pv_elem.level_id,
        }
    if plan_graphic_hints is not None:
        out_payload["planGraphicHints"] = plan_graphic_hints
    if cat_res is not None and pinned_pv_elem is not None:
        out_payload["planCategoryGraphicHints_v0"] = plan_category_graphic_hints_v0_payload(
            doc, pinned_pv=pinned_pv_elem, resolved=cat_res
        )
    if plan_ann is not None:
        out_payload["planAnnotationHints"] = plan_ann
    if pinned_pv_elem is not None and res_open is not None and res_room is not None:
        out_payload["planTagStyleHints"] = {
            "opening": _plan_tag_style_hint_payload(res_open, "opening"),
            "room": _plan_tag_style_hint_payload(res_room, "room"),
        }
    if pinned_pv_elem is not None:
        out_payload["planViewBrowserHierarchy_v0"] = _plan_view_browser_hierarchy_v0(
            doc,
            pinned_pv_elem,
            cat_res=cat_res,
            res_open=res_open,
            res_room=res_room,
            plan_ann=plan_ann,
        )

    slab_doc_rows = _slab_opening_documentation_rows_for_plan_view(
        doc,
        level=active_level,
        hidden_semantic=hidden_semantic,
        crop_box_mm=effective_crop,
        view_range_clip_mm=view_range_clip_mm,
    )
    out_payload["slabOpeningDocumentationEvidence_v0"] = {
        "format": "slabOpeningDocumentationEvidence_v0",
        "rows": slab_doc_rows,
    }
    fed_plan_rows = _wall_opening_cut_fidelity_rows_for_plan_view(
        doc,
        level=active_level,
        hidden_semantic=hidden_semantic,
        crop_box_mm=effective_crop,
        view_range_clip_mm=view_range_clip_mm,
    )
    out_payload["wallOpeningCutFidelityEvidence_v1"] = {
        "format": "wallOpeningCutFidelityEvidence_v1",
        "rows": fed_plan_rows,
    }
    wj_summary = _wall_corner_join_summary_for_plan_view(
        doc,
        level=active_level,
        hidden_semantic=hidden_semantic,
        crop_box_mm=effective_crop,
        view_range_clip_mm=view_range_clip_mm,
    )
    if wj_summary is not None:
        out_payload["wallCornerJoinSummary_v1"] = wj_summary
    out_payload["planGridDatumEvidence_v0"] = _plan_grid_datum_evidence_v0(
        doc,
        level=active_level,
        hidden_semantic=hidden_semantic,
        associated_plan_view_id=pinned_pv,
        active_level_id=active_level,
        crop_box_mm=effective_crop,
        view_range_clip_mm=view_range_clip_mm,
    )
    return out_payload


def plan_projection_wire_from_request(
    doc: Document,
    *,
    plan_view_id: str | None = None,
    fallback_level_id: str | None = None,
    global_plan_presentation: str = "default",
) -> dict[str, Any]:
    """HTTP-friendly entry for query wiring (WP-C01/C02)."""

    return resolve_plan_projection_wire(
        doc,
        plan_view_id=plan_view_id,
        fallback_level_id=fallback_level_id,
        global_plan_presentation=global_plan_presentation,
        sheet_viewport_row_for_crop=None,
    )


def section_cut_projection_wire(doc: Document, section_cut_id: str) -> dict[str, Any]:
    """Portable section display resolution / orthographic (u,z) primitives (WP-E04/C02)."""

    sec = doc.elements.get(section_cut_id)

    if not isinstance(sec, SectionCutElem):
        return {
            "format": "sectionProjectionWire_v1",
            "errors": [{"code": "not_found", "message": "section_cut id missing or wrong kind"}],
        }

    primitives, prim_warnings = build_section_projection_primitives(doc, sec)
    prim = primitives
    walls = prim.get("walls") or []
    floors = prim.get("floors") or []
    rooms = prim.get("rooms") or []
    doors = prim.get("doors") or []
    windows = prim.get("windows") or []
    stairs = prim.get("stairs") or []
    roofs = prim.get("roofs") or []
    counts: dict[str, int] = {
        "wall": len(walls),
        "floor": len(floors),
        "room": len(rooms),
        "door": len(doors),
        "window": len(windows),
        "stair": len(stairs),
        "roof": len(roofs),
    }

    return {
        "format": "sectionProjectionWire_v1",
        "sectionCutId": sec.id,
        "name": sec.name,
        "lineStartMm": sec.line_start_mm.model_dump(by_alias=True),
        "lineEndMm": sec.line_end_mm.model_dump(by_alias=True),
        "cropDepthMm": float(sec.crop_depth_mm),
        "warnings": prim_warnings,
        "primitives": prim,
        "countsByVisibleKind": dict(sorted(counts.items())),
        "elementCountRough": sum(1 for e in doc.elements.values() if isinstance(e, WallElem)),
        "sectionDatumElevationEvidence_v0": _section_datum_elevation_evidence_v0(
            doc, sec, prim, prim_warnings
        ),
    }
