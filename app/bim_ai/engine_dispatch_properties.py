# ruff: noqa: I001

from pydantic import TypeAdapter

from bim_ai.engine import (
    AssignWallDatumConstraintsCmd,
    AreaElem,
    CreateWallTypeCmd,
    DoorElem,
    FloorTypeElem,
    GridLineElem,
    IssueElem,
    LevelElem,
    LinkDxfElem,
    MaterialFaceOverride,
    PlanDetailLevelPlan,
    PlanViewElem,
    PlacedAssetElem,
    ProjectSettingsElem,
    RailingElem,
    RoofElem,
    RoofGeometryMode,
    RoofTypeElem,
    RoomColorSchemeElem,
    RoomElem,
    SaveViewpointCmd,
    ScheduleElem,
    SheetElem,
    StairElem,
    UpdateElementPropertyCmd,
    UpsertFloorTypeCmd,
    UpsertProjectSettingsCmd,
    UpsertRoofTypeCmd,
    UpsertRoomColorSchemeCmd,
    UpsertWallTypeCmd,
    Vec2Mm,
    ViewTemplateElem,
    ViewpointElem,
    WallElem,
    WallTypeElem,
    WindowElem,
    _basis_line,
    _canonical_room_scheme_rows,
    _parse_plan_view_bool_override,
    _parse_view_template_bool,
    _propagate_floor_dims_for_type,
    _propagate_wall_thickness_for_type,
    _recompute_constrained_wall_heights,
    _validate_plan_tag_style_ref,
    _wall_thickness_from_type,
    assert_valid_gable_pitched_rectangle_footprint_mm,
    cast,
    json,
    new_id,
    parse_plan_category_graphics_property_json,
)
from bim_ai.elements import ProjectBasePointElem, SurveyPointElem, Vec3Mm


def _material_slots_val(v: object) -> dict[str, str | None] | None:
    if v in (None, ""):
        return None
    if not isinstance(v, dict):
        raise ValueError("materialSlots must be a JSON object or empty")
    out: dict[str, str | None] = {}
    for raw_key, raw_value in v.items():
        key = str(raw_key).strip()
        if not key:
            continue
        out[key] = str(raw_value).strip() if raw_value is not None else None
    return out


ARCHITECTURE_ROOM_PROP_KEYS = {
    "roomFunction",
    "finishSetId",
    "designIntent",
    "documentationStatus",
    "occupancyNotes",
    "roomBounding",
}


def _parse_structural_bool(value: object) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    raw = str(value).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise ValueError("loadBearing must be true, false, or empty")


def try_apply_properties_command(doc, cmd, *, source_provider=None) -> bool:
    els = doc.elements
    match cmd:
        case UpdateElementPropertyCmd():
            el = els.get(cmd.element_id)
            if el is None:
                raise ValueError("updateElementProperty.elementId unknown")
            if isinstance(el, IssueElem):
                if cmd.key != "title":
                    raise ValueError("Issues only support updateElementProperty.key=title (v2)")
                els[cmd.element_id] = el.model_copy(update={"title": cmd.value})
            elif cmd.key == "loadBearing" and hasattr(el, "load_bearing"):
                els[cmd.element_id] = el.model_copy(
                    update={"load_bearing": _parse_structural_bool(cmd.value)}
                )
            elif cmd.key == "structuralRole" and hasattr(el, "structural_role"):
                role = str(cmd.value or "").strip()
                if role not in {
                    "unknown",
                    "load_bearing",
                    "non_load_bearing",
                    "bearing_wall",
                    "shear_wall",
                    "slab",
                    "beam",
                    "column",
                    "foundation",
                    "brace",
                }:
                    raise ValueError(
                        "structuralRole must be unknown|load_bearing|non_load_bearing|bearing_wall|shear_wall|slab|beam|column|foundation|brace"
                    )
                els[cmd.element_id] = el.model_copy(update={"structural_role": role})
            elif cmd.key == "structuralMaterial" and hasattr(el, "structural_material"):
                material = str(cmd.value or "").strip() or None
                if material not in {
                    None,
                    "concrete",
                    "steel",
                    "timber",
                    "masonry",
                    "composite",
                    "other",
                }:
                    raise ValueError(
                        "structuralMaterial must be concrete|steel|timber|masonry|composite|other or empty"
                    )
                els[cmd.element_id] = el.model_copy(update={"structural_material": material})
            elif cmd.key == "analysisStatus" and hasattr(el, "analysis_status"):
                status = str(cmd.value or "").strip() or "not_modeled"
                if status not in {"not_modeled", "ready_for_export", "needs_review"}:
                    raise ValueError(
                        "analysisStatus must be not_modeled|ready_for_export|needs_review"
                    )
                els[cmd.element_id] = el.model_copy(update={"analysis_status": status})
            elif cmd.key == "fireResistanceRating" and hasattr(el, "fire_resistance_rating"):
                rating = str(cmd.value or "").strip() or None
                els[cmd.element_id] = el.model_copy(update={"fire_resistance_rating": rating})
            elif cmd.key == "name" and hasattr(el, "name"):
                els[cmd.element_id] = el.model_copy(update={"name": cmd.value})
            elif cmd.key == "programmeCode" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"programme_code": cmd.value})
            elif cmd.key == "department" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"department": cmd.value})
            elif cmd.key == "programmeGroup" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"programme_group": cmd.value})
            elif cmd.key == "functionLabel" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"function_label": cmd.value})
            elif cmd.key == "finishSet" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"finish_set": cmd.value})
            elif cmd.key == "targetAreaM2" and isinstance(el, RoomElem):
                raw_t = cmd.value.strip()
                if not raw_t:
                    els[cmd.element_id] = el.model_copy(update={"target_area_m2": None})
                else:
                    try:
                        tv = float(raw_t)
                    except ValueError as exc:
                        raise ValueError("targetAreaM2 must be a number or empty to clear") from exc
                    if tv <= 0:
                        raise ValueError("targetAreaM2 must be positive when set")
                    els[cmd.element_id] = el.model_copy(update={"target_area_m2": tv})
            elif cmd.key == "roomFillOverrideHex" and isinstance(el, RoomElem):
                raw_hex = cmd.value.strip()
                if raw_hex == "":
                    els[cmd.element_id] = el.model_copy(update={"room_fill_override_hex": None})
                elif (
                    len(raw_hex) == 7
                    and raw_hex.startswith("#")
                    and all(c in "0123456789abcdefABCDEF" for c in raw_hex[1:])
                ):
                    els[cmd.element_id] = el.model_copy(
                        update={"room_fill_override_hex": raw_hex.lower()}
                    )
                else:
                    raise ValueError("roomFillOverrideHex must be #RRGGBB or empty to clear")
            elif cmd.key == "roomFillPatternOverride" and isinstance(el, RoomElem):
                raw_pattern = cmd.value.strip()
                if raw_pattern == "":
                    els[cmd.element_id] = el.model_copy(update={"room_fill_pattern_override": None})
                elif raw_pattern in {"solid", "hatch_45", "hatch_90", "crosshatch", "dots"}:
                    els[cmd.element_id] = el.model_copy(
                        update={"room_fill_pattern_override": raw_pattern}
                    )
                else:
                    raise ValueError(
                        "roomFillPatternOverride must be solid|hatch_45|hatch_90|crosshatch|dots or empty to clear"
                    )
            elif cmd.key in ARCHITECTURE_ROOM_PROP_KEYS and isinstance(el, RoomElem):
                raw_prop = cmd.value.strip()
                props = dict(el.props or {})
                if raw_prop:
                    props[cmd.key] = raw_prop
                else:
                    props.pop(cmd.key, None)
                els[cmd.element_id] = el.model_copy(update={"props": props or None})
            elif cmd.key == "label" and isinstance(el, GridLineElem):
                els[cmd.element_id] = el.model_copy(update={"label": cmd.value})
            elif isinstance(el, PlanViewElem):
                raw = cmd.value.strip()
                if cmd.key == "planPresentation":
                    pres = raw if raw in {"default", "opening_focus", "room_scheme"} else "default"
                    els[cmd.element_id] = el.model_copy(update={"plan_presentation": pres})
                elif cmd.key == "planViewSubtype":
                    if raw == "":
                        els[cmd.element_id] = el.model_copy(update={"plan_view_subtype": None})
                    elif raw not in {
                        "floor_plan",
                        "area_plan",
                        "lighting_plan",
                        "power_plan",
                        "coordination_plan",
                    }:
                        raise ValueError(
                            "planViewSubtype must be floor_plan|area_plan|lighting_plan|power_plan|coordination_plan or empty"
                        )
                    else:
                        els[cmd.element_id] = el.model_copy(update={"plan_view_subtype": raw})
                elif cmd.key == "areaScheme":
                    if raw not in {"gross_building", "net", "rentable"}:
                        raise ValueError("areaScheme must be gross_building|net|rentable")
                    els[cmd.element_id] = el.model_copy(update={"area_scheme": raw})
                elif cmd.key == "categoriesHidden":
                    hx: list[str] = []
                    if raw:
                        try:
                            parsed = json.loads(raw)
                            if isinstance(parsed, list):
                                hx = [str(x) for x in parsed if isinstance(x, str)]
                        except json.JSONDecodeError as exc:
                            raise ValueError(
                                "categoriesHidden must be a JSON array of strings"
                            ) from exc
                    els[cmd.element_id] = el.model_copy(update={"categories_hidden": hx})
                elif cmd.key == "underlayLevelId":
                    lv = raw or None
                    if lv is not None and lv not in els:
                        raise ValueError("underlayLevelId references unknown Level")
                    els[cmd.element_id] = el.model_copy(update={"underlay_level_id": lv})
                elif cmd.key == "viewTemplateId":
                    vt = raw or None
                    if vt is not None:
                        vt_el = els.get(vt)
                        if not isinstance(vt_el, ViewTemplateElem):
                            raise ValueError("viewTemplateId must reference view_template")
                    els[cmd.element_id] = el.model_copy(update={"view_template_id": vt})
                elif cmd.key == "cropMinMm":
                    if not raw:
                        els[cmd.element_id] = el.model_copy(update={"crop_min_mm": None})
                    else:
                        try:
                            parsed = json.loads(raw)
                        except json.JSONDecodeError as exc:
                            raise ValueError(
                                "cropMinMm must be JSON object {xMm,yMm} or empty"
                            ) from exc
                        if not isinstance(parsed, dict):
                            raise ValueError("cropMinMm must be a JSON object")
                        els[cmd.element_id] = el.model_copy(
                            update={"crop_min_mm": Vec2Mm.model_validate(parsed)}
                        )
                elif cmd.key == "cropMaxMm":
                    if not raw:
                        els[cmd.element_id] = el.model_copy(update={"crop_max_mm": None})
                    else:
                        try:
                            parsed = json.loads(raw)
                        except json.JSONDecodeError as exc:
                            raise ValueError(
                                "cropMaxMm must be JSON object {xMm,yMm} or empty"
                            ) from exc
                        if not isinstance(parsed, dict):
                            raise ValueError("cropMaxMm must be a JSON object")
                        els[cmd.element_id] = el.model_copy(
                            update={"crop_max_mm": Vec2Mm.model_validate(parsed)}
                        )
                elif cmd.key == "cropEnabled":
                    if raw == "":
                        els[cmd.element_id] = el.model_copy(update={"crop_enabled": None})
                    else:
                        v = _parse_plan_view_bool_override(cmd.value)
                        els[cmd.element_id] = el.model_copy(update={"crop_enabled": v})
                elif cmd.key == "cropRegionVisible":
                    if raw == "":
                        els[cmd.element_id] = el.model_copy(update={"crop_region_visible": None})
                    else:
                        v = _parse_plan_view_bool_override(cmd.value)
                        els[cmd.element_id] = el.model_copy(update={"crop_region_visible": v})
                elif cmd.key == "viewRangeBottomMm":
                    vrb: float | None = None
                    if raw != "":
                        vrb = float(raw)
                    els[cmd.element_id] = el.model_copy(update={"view_range_bottom_mm": vrb})
                elif cmd.key == "viewRangeTopMm":
                    vrt: float | None = None
                    if raw != "":
                        vrt = float(raw)
                    els[cmd.element_id] = el.model_copy(update={"view_range_top_mm": vrt})
                elif cmd.key == "cutPlaneOffsetMm":
                    cpo: float | None = None
                    if raw != "":
                        cpo = float(raw)
                    els[cmd.element_id] = el.model_copy(update={"cut_plane_offset_mm": cpo})
                elif cmd.key == "discipline":
                    els[cmd.element_id] = el.model_copy(
                        update={"discipline": raw if raw else "architecture"}
                    )
                elif cmd.key == "viewSubdiscipline":
                    els[cmd.element_id] = el.model_copy(update={"view_subdiscipline": raw or None})
                elif cmd.key == "phaseId":
                    els[cmd.element_id] = el.model_copy(update={"phase_id": raw or None})
                elif cmd.key == "planDetailLevel":
                    if raw == "":
                        els[cmd.element_id] = el.model_copy(update={"plan_detail_level": None})
                    elif raw not in {"coarse", "medium", "fine"}:
                        raise ValueError("planDetailLevel must be coarse|medium|fine or empty")
                    else:
                        els[cmd.element_id] = el.model_copy(update={"plan_detail_level": raw})
                elif cmd.key == "planRoomFillOpacityScale":
                    if raw == "":
                        els[cmd.element_id] = el.model_copy(
                            update={"plan_room_fill_opacity_scale": None}
                        )
                    else:
                        v = max(0.0, min(1.0, float(raw)))
                        els[cmd.element_id] = el.model_copy(
                            update={"plan_room_fill_opacity_scale": v}
                        )
                elif cmd.key == "planShowOpeningTags":
                    v = _parse_plan_view_bool_override(cmd.value)
                    els[cmd.element_id] = el.model_copy(update={"plan_show_opening_tags": v})
                elif cmd.key == "planShowRoomLabels":
                    v = _parse_plan_view_bool_override(cmd.value)
                    els[cmd.element_id] = el.model_copy(update={"plan_show_room_labels": v})
                elif cmd.key == "planOpeningTagStyleId":
                    if raw == "":
                        els[cmd.element_id] = el.model_copy(
                            update={"plan_opening_tag_style_id": None}
                        )
                    else:
                        _validate_plan_tag_style_ref(els, raw, "opening")
                        els[cmd.element_id] = el.model_copy(
                            update={"plan_opening_tag_style_id": raw}
                        )
                elif cmd.key == "planRoomTagStyleId":
                    if raw == "":
                        els[cmd.element_id] = el.model_copy(update={"plan_room_tag_style_id": None})
                    else:
                        _validate_plan_tag_style_ref(els, raw, "room")
                        els[cmd.element_id] = el.model_copy(update={"plan_room_tag_style_id": raw})
                elif cmd.key == "planCategoryGraphics":
                    pcg = parse_plan_category_graphics_property_json(cmd.value)
                    els[cmd.element_id] = el.model_copy(update={"plan_category_graphics": pcg})
                else:
                    raise ValueError(
                        "plan_view updates: key=planPresentation | categoriesHidden | underlayLevelId | "
                        "viewTemplateId | cropMinMm | cropMaxMm | cropEnabled | cropRegionVisible | "
                        "viewRangeBottomMm | viewRangeTopMm | "
                        "cutPlaneOffsetMm | discipline | viewSubdiscipline | planViewSubtype | "
                        "areaScheme | phaseId | planDetailLevel | planRoomFillOpacityScale | "
                        "planShowOpeningTags | planShowRoomLabels | planOpeningTagStyleId | planRoomTagStyleId | "
                        "planCategoryGraphics | name"
                    )
            elif isinstance(el, ViewTemplateElem):
                raw_vt = cmd.value.strip()
                if cmd.key == "planShowOpeningTags":
                    els[cmd.element_id] = el.model_copy(
                        update={"plan_show_opening_tags": _parse_view_template_bool(cmd.value)}
                    )
                elif cmd.key == "planShowRoomLabels":
                    els[cmd.element_id] = el.model_copy(
                        update={"plan_show_room_labels": _parse_view_template_bool(cmd.value)}
                    )
                elif cmd.key == "planDetailLevel":
                    if raw_vt == "":
                        els[cmd.element_id] = el.model_copy(update={"plan_detail_level": None})
                    elif raw_vt not in {"coarse", "medium", "fine"}:
                        raise ValueError("planDetailLevel must be coarse|medium|fine or empty")
                    else:
                        els[cmd.element_id] = el.model_copy(
                            update={"plan_detail_level": cast(PlanDetailLevelPlan, raw_vt)}
                        )
                elif cmd.key == "planRoomFillOpacityScale":
                    if raw_vt == "":
                        els[cmd.element_id] = el.model_copy(
                            update={"plan_room_fill_opacity_scale": 1.0}
                        )
                    else:
                        vscale = max(0.0, min(1.0, float(raw_vt)))
                        els[cmd.element_id] = el.model_copy(
                            update={"plan_room_fill_opacity_scale": vscale}
                        )
                elif cmd.key == "defaultPlanOpeningTagStyleId":
                    if raw_vt == "":
                        els[cmd.element_id] = el.model_copy(
                            update={"default_plan_opening_tag_style_id": None}
                        )
                    else:
                        _validate_plan_tag_style_ref(els, raw_vt, "opening")
                        els[cmd.element_id] = el.model_copy(
                            update={"default_plan_opening_tag_style_id": raw_vt}
                        )
                elif cmd.key == "defaultPlanRoomTagStyleId":
                    if raw_vt == "":
                        els[cmd.element_id] = el.model_copy(
                            update={"default_plan_room_tag_style_id": None}
                        )
                    else:
                        _validate_plan_tag_style_ref(els, raw_vt, "room")
                        els[cmd.element_id] = el.model_copy(
                            update={"default_plan_room_tag_style_id": raw_vt}
                        )
                elif cmd.key == "planCategoryGraphics":
                    pcg_vt = parse_plan_category_graphics_property_json(cmd.value)
                    els[cmd.element_id] = el.model_copy(update={"plan_category_graphics": pcg_vt})
                else:
                    raise ValueError(
                        "view_template updates: key=planDetailLevel | planRoomFillOpacityScale | "
                        "planShowOpeningTags | planShowRoomLabels | defaultPlanOpeningTagStyleId | "
                        "defaultPlanRoomTagStyleId | planCategoryGraphics | name"
                    )
            elif isinstance(el, ViewpointElem):
                raw = cmd.value.strip()
                if cmd.key == "viewerClipCapElevMm":
                    cap: float | None = None
                    if raw != "":
                        cap = float(raw)
                        if not (cap >= 0):
                            raise ValueError("viewerClipCapElevMm must be non-negative")
                    els[cmd.element_id] = el.model_copy(update={"viewer_clip_cap_elev_mm": cap})
                elif cmd.key == "viewerClipFloorElevMm":
                    floor_v: float | None = None
                    if raw != "":
                        floor_v = float(raw)
                        if not (floor_v >= 0):
                            raise ValueError("viewerClipFloorElevMm must be non-negative")
                    els[cmd.element_id] = el.model_copy(
                        update={"viewer_clip_floor_elev_mm": floor_v}
                    )
                elif cmd.key == "hiddenSemanticKinds3d":
                    hid: list[str] = []
                    if raw:
                        try:
                            parsed = json.loads(raw)
                            if isinstance(parsed, list):
                                hid = [str(x) for x in parsed if isinstance(x, str)]
                        except json.JSONDecodeError as exc:
                            raise ValueError(
                                "hiddenSemanticKinds3d must be a JSON array of strings"
                            ) from exc
                    els[cmd.element_id] = el.model_copy(update={"hidden_semantic_kinds_3d": hid})
                elif cmd.key == "cutawayStyle":
                    raw_cut = cmd.value.strip()
                    cut_v: str | None = None
                    if raw_cut != "":
                        if raw_cut not in ("none", "cap", "floor", "box"):
                            raise ValueError(
                                "cutawayStyle must be empty (inherit) or none|cap|floor|box"
                            )
                        cut_v = raw_cut
                    els[cmd.element_id] = el.model_copy(update={"cutaway_style": cut_v})
                elif cmd.key == "planOverlayEnabled":
                    raw_bool = cmd.value.strip().lower()
                    if raw_bool not in ("true", "false"):
                        raise ValueError("planOverlayEnabled must be true|false")
                    els[cmd.element_id] = el.model_copy(
                        update={"plan_overlay_enabled": raw_bool == "true"}
                    )
                elif cmd.key == "planOverlaySourcePlanViewId":
                    raw_plan = cmd.value.strip()
                    if raw_plan and not isinstance(els.get(raw_plan), PlanViewElem):
                        raise ValueError("planOverlaySourcePlanViewId must reference a plan_view")
                    els[cmd.element_id] = el.model_copy(
                        update={"plan_overlay_source_plan_view_id": raw_plan or None}
                    )
                elif cmd.key == "planOverlayOffsetMm":
                    overlay_offset: float | None = None
                    if raw != "":
                        overlay_offset = float(raw)
                        if not (overlay_offset >= 0):
                            raise ValueError("planOverlayOffsetMm must be non-negative")
                    els[cmd.element_id] = el.model_copy(
                        update={"plan_overlay_offset_mm": overlay_offset}
                    )
                elif cmd.key in (
                    "planOverlayOpacity",
                    "planOverlayLineOpacity",
                    "planOverlayFillOpacity",
                ):
                    opacity: float | None = None
                    if raw != "":
                        opacity = float(raw)
                        if not (0 <= opacity <= 1):
                            raise ValueError(f"{cmd.key} must be between 0 and 1")
                    field = {
                        "planOverlayOpacity": "plan_overlay_opacity",
                        "planOverlayLineOpacity": "plan_overlay_line_opacity",
                        "planOverlayFillOpacity": "plan_overlay_fill_opacity",
                    }[cmd.key]
                    els[cmd.element_id] = el.model_copy(update={field: opacity})
                elif cmd.key in (
                    "planOverlayAnnotationsVisible",
                    "planOverlayWitnessLinesVisible",
                ):
                    raw_bool = cmd.value.strip().lower()
                    visible: bool | None = None
                    if raw_bool != "":
                        if raw_bool not in ("true", "false"):
                            raise ValueError(f"{cmd.key} must be true|false or empty")
                        visible = raw_bool == "true"
                    field = {
                        "planOverlayAnnotationsVisible": "plan_overlay_annotations_visible",
                        "planOverlayWitnessLinesVisible": "plan_overlay_witness_lines_visible",
                    }[cmd.key]
                    els[cmd.element_id] = el.model_copy(update={field: visible})
                elif cmd.key == "name" and hasattr(el, "name"):
                    els[cmd.element_id] = el.model_copy(update={"name": cmd.value})
                else:
                    raise ValueError(
                        "viewpoint updates: key=viewerClipCapElevMm | viewerClipFloorElevMm | "
                        "hiddenSemanticKinds3d | cutawayStyle | planOverlayEnabled | "
                        "planOverlaySourcePlanViewId | planOverlayOffsetMm | planOverlayOpacity | "
                        "planOverlayLineOpacity | planOverlayFillOpacity | "
                        "planOverlayAnnotationsVisible | planOverlayWitnessLinesVisible | name"
                    )
            elif isinstance(el, WallElem):

                def _str_val(v: object) -> str:
                    return str(v).strip() if v is not None else ""

                if cmd.key == "materialKey":
                    els[cmd.element_id] = el.model_copy(
                        update={"material_key": _str_val(cmd.value) or None}
                    )
                elif cmd.key == "faceMaterialOverrides":
                    if cmd.value in (None, ""):
                        els[cmd.element_id] = el.model_copy(
                            update={"face_material_overrides": None}
                        )
                    elif isinstance(cmd.value, list):
                        overrides = TypeAdapter(list[MaterialFaceOverride]).validate_python(
                            cmd.value
                        )
                        els[cmd.element_id] = el.model_copy(
                            update={"face_material_overrides": overrides}
                        )
                    else:
                        raise ValueError("faceMaterialOverrides must be a JSON array or empty")
                elif cmd.key == "isCurtainWall":
                    if isinstance(cmd.value, bool):
                        cw = cmd.value
                    else:
                        cw = _str_val(cmd.value).lower() in ("true", "1", "yes")
                    els[cmd.element_id] = el.model_copy(update={"is_curtain_wall": cw})
                elif cmd.key == "roofAttachmentId":
                    rid = _str_val(cmd.value) or None
                    if rid is not None and rid not in els:
                        raise ValueError("roofAttachmentId must reference an existing element")
                    els[cmd.element_id] = el.model_copy(update={"roof_attachment_id": rid})
                elif cmd.key == "wallTypeId":
                    wt = _str_val(cmd.value) or None
                    if wt is not None and not isinstance(els.get(wt), WallTypeElem):
                        raise ValueError("wallTypeId must reference an existing wall_type")
                    els[cmd.element_id] = el.model_copy(update={"wall_type_id": wt})
                elif cmd.key == "heightMm":
                    els[cmd.element_id] = el.model_copy(
                        update={"height_mm": float(_str_val(cmd.value))}
                    )
                elif cmd.key == "thicknessMm":
                    els[cmd.element_id] = el.model_copy(
                        update={"thickness_mm": float(_str_val(cmd.value))}
                    )
                elif cmd.key == "name":
                    els[cmd.element_id] = el.model_copy(update={"name": _str_val(cmd.value)})
                else:
                    raise ValueError(
                        "wall updates: key=materialKey | faceMaterialOverrides | isCurtainWall | roofAttachmentId | wallTypeId | heightMm | thicknessMm | name"
                    )
            elif isinstance(el, (DoorElem, WindowElem)):
                raw_v = str(cmd.value).strip() if cmd.value is not None else ""
                if cmd.key == "familyTypeId":
                    els[cmd.element_id] = el.model_copy(update={"family_type_id": raw_v or None})
                elif cmd.key == "materialKey":
                    els[cmd.element_id] = el.model_copy(update={"material_key": raw_v or None})
                elif cmd.key == "materialSlots":
                    els[cmd.element_id] = el.model_copy(
                        update={"material_slots": _material_slots_val(cmd.value)}
                    )
                elif cmd.key == "operationType" and isinstance(el, DoorElem):
                    if not raw_v:
                        els[cmd.element_id] = el.model_copy(update={"operation_type": None})
                    elif raw_v in (
                        "swing_single",
                        "swing_double",
                        "sliding_single",
                        "sliding_double",
                        "bi_fold",
                        "pocket",
                        "pivot",
                        "automatic_double",
                    ):
                        els[cmd.element_id] = el.model_copy(update={"operation_type": raw_v})
                    else:
                        raise ValueError(
                            "operationType must be one of swing_single | swing_double | sliding_single | sliding_double | bi_fold | pocket | pivot | automatic_double"
                        )
                elif cmd.key == "slidingTrackSide" and isinstance(el, DoorElem):
                    if not raw_v:
                        els[cmd.element_id] = el.model_copy(update={"sliding_track_side": None})
                    elif raw_v in ("wall_face", "in_pocket"):
                        els[cmd.element_id] = el.model_copy(update={"sliding_track_side": raw_v})
                    else:
                        raise ValueError("slidingTrackSide must be wall_face | in_pocket")
                elif cmd.key == "outlineKind" and isinstance(el, WindowElem):
                    if not raw_v:
                        els[cmd.element_id] = el.model_copy(update={"outline_kind": None})
                    elif raw_v in (
                        "rectangle",
                        "arched_top",
                        "gable_trapezoid",
                        "circle",
                        "octagon",
                        "custom",
                    ):
                        els[cmd.element_id] = el.model_copy(update={"outline_kind": raw_v})
                    else:
                        raise ValueError(
                            "outlineKind must be one of rectangle | arched_top | gable_trapezoid | circle | octagon | custom"
                        )
                elif cmd.key == "attachedRoofId" and isinstance(el, WindowElem):
                    if not raw_v:
                        els[cmd.element_id] = el.model_copy(update={"attached_roof_id": None})
                    else:
                        target = els.get(raw_v)
                        if target is None:
                            raise ValueError("attachedRoofId must reference an existing element")
                        if not isinstance(target, RoofElem):
                            raise ValueError("attachedRoofId must reference a roof element")
                        els[cmd.element_id] = el.model_copy(update={"attached_roof_id": raw_v})
                elif isinstance(el, DoorElem):
                    raise ValueError(
                        "door updates: key=familyTypeId | materialKey | materialSlots | operationType | slidingTrackSide | name"
                    )
                else:
                    raise ValueError(
                        "window updates: key=familyTypeId | materialKey | materialSlots | outlineKind | attachedRoofId | name"
                    )
            elif isinstance(el, StairElem):
                if cmd.key == "materialSlots":
                    els[cmd.element_id] = el.model_copy(
                        update={"material_slots": _material_slots_val(cmd.value)}
                    )
                else:
                    raise ValueError("stair updates: key=materialSlots")
            elif isinstance(el, RailingElem):
                if cmd.key == "materialSlots":
                    els[cmd.element_id] = el.model_copy(
                        update={"material_slots": _material_slots_val(cmd.value)}
                    )
                else:
                    raise ValueError("railing updates: key=materialSlots")
            elif isinstance(el, ScheduleElem):
                raw_s = cmd.value.strip()
                if cmd.key == "sheetId":
                    if not raw_s:
                        els[cmd.element_id] = el.model_copy(update={"sheet_id": None})
                    else:
                        sh_tgt = els.get(raw_s)
                        if not isinstance(sh_tgt, SheetElem):
                            raise ValueError("sheetId must reference an existing sheet element")
                        els[cmd.element_id] = el.model_copy(update={"sheet_id": raw_s})
                else:
                    raise ValueError("schedule updates: key=sheetId | name")
            elif isinstance(el, SheetElem):
                raw_sh = cmd.value.strip()
                if cmd.key == "titleBlock":
                    els[cmd.element_id] = el.model_copy(update={"title_block": raw_sh or None})
                elif cmd.key == "titleblockParametersPatch":
                    try:
                        patch_obj = json.loads(cmd.value)
                    except json.JSONDecodeError as exc:
                        raise ValueError(
                            "titleblockParametersPatch must be a JSON object string"
                        ) from exc
                    if not isinstance(patch_obj, dict):
                        raise ValueError("titleblockParametersPatch must decode to an object")
                    merged = dict(el.titleblock_parameters or {})
                    for pk, pv in patch_obj.items():
                        key_s = str(pk)
                        if isinstance(pv, str):
                            vv = pv.strip()
                            if vv:
                                merged[key_s] = vv
                            else:
                                merged.pop(key_s, None)
                        elif pv is None:
                            merged.pop(key_s, None)
                        else:
                            merged[key_s] = str(pv)
                    els[cmd.element_id] = el.model_copy(update={"titleblock_parameters": merged})
                else:
                    raise ValueError(
                        "sheet updates: key=titleBlock | titleblockParametersPatch | name"
                    )
            elif isinstance(el, RoofElem):
                raw_r = cmd.value.strip()
                if cmd.key == "roofTypeId":
                    rtid = raw_r or None
                    if rtid is not None:
                        rt_el = els.get(rtid)
                        if not isinstance(rt_el, RoofTypeElem):
                            raise ValueError("roofTypeId must reference an existing roof_type")
                    els[cmd.element_id] = el.model_copy(update={"roof_type_id": rtid})
                elif cmd.key == "roofGeometryMode":
                    mode_s = raw_r
                    if mode_s not in ("mass_box", "gable_pitched_rectangle"):
                        raise ValueError(
                            "roofGeometryMode must be mass_box|gable_pitched_rectangle"
                        )
                    mode = cast(RoofGeometryMode, mode_s)
                    if mode == "gable_pitched_rectangle":
                        assert_valid_gable_pitched_rectangle_footprint_mm(
                            [(p.x_mm, p.y_mm) for p in el.footprint_mm]
                        )
                    els[cmd.element_id] = el.model_copy(update={"roof_geometry_mode": mode})
                else:
                    raise ValueError("roof updates: key=roofTypeId | roofGeometryMode | name")
            elif cmd.key == "discipline" and hasattr(el, "discipline"):
                d = cmd.value.strip() if isinstance(cmd.value, str) else ""
                if d not in {"arch", "struct", "mep", ""}:
                    raise ValueError("discipline must be arch|struct|mep or empty")
                els[cmd.element_id] = el.model_copy(update={"discipline": d if d else None})
                els[cmd.element_id] = el.model_copy(update={"discipline": d if d else None})
            elif cmd.key == "positionMm" and isinstance(
                el, (ProjectBasePointElem, SurveyPointElem)
            ):
                raw_pos = cmd.value
                if not isinstance(raw_pos, dict):
                    raise ValueError("positionMm for coordinate points must be an object")
                els[cmd.element_id] = el.model_copy(
                    update={
                        "position_mm": Vec3Mm(
                            xMm=float(raw_pos.get("xMm", raw_pos.get("x_mm", 0))),
                            yMm=float(raw_pos.get("yMm", raw_pos.get("y_mm", 0))),
                            zMm=float(raw_pos.get("zMm", raw_pos.get("z_mm", 0))),
                        )
                    }
                )
            elif cmd.key == "clipped" and isinstance(el, (ProjectBasePointElem, SurveyPointElem)):
                raw_clipped = cmd.value
                clipped = (
                    raw_clipped
                    if isinstance(raw_clipped, bool)
                    else str(raw_clipped).strip().lower() in {"1", "true", "yes", "on"}
                )
                els[cmd.element_id] = el.model_copy(update={"clipped": clipped})
            elif cmd.key == "levelId" and isinstance(el, LinkDxfElem):
                next_level_id = str(cmd.value or "").strip()
                if next_level_id not in els or not isinstance(els[next_level_id], LevelElem):
                    raise ValueError("link_dxf levelId must reference an existing Level")
                els[cmd.element_id] = el.model_copy(update={"level_id": next_level_id})
            elif cmd.key == "paramValues" and isinstance(el, PlacedAssetElem):
                raw_param_values = cmd.value
                if raw_param_values in (None, ""):
                    parsed_param_values = {}
                elif isinstance(raw_param_values, str):
                    try:
                        parsed = json.loads(raw_param_values)
                    except json.JSONDecodeError as exc:
                        raise ValueError("paramValues must be a JSON object") from exc
                    if not isinstance(parsed, dict):
                        raise ValueError("paramValues must be a JSON object")
                    parsed_param_values = dict(parsed)
                elif isinstance(raw_param_values, dict):
                    parsed_param_values = dict(raw_param_values)
                else:
                    raise ValueError("paramValues must be a JSON object")
                els[cmd.element_id] = el.model_copy(update={"param_values": parsed_param_values})
            elif cmd.key == "areaScheme" and isinstance(el, AreaElem):
                raw_area_scheme = str(cmd.value or "").strip()
                if raw_area_scheme not in {"gross_building", "net", "rentable"}:
                    raise ValueError("areaScheme must be gross_building|net|rentable")
                els[cmd.element_id] = el.model_copy(update={"area_scheme": raw_area_scheme})
            elif cmd.key == "checkpointRetentionLimit" and isinstance(el, ProjectSettingsElem):
                raw_checkpoint_limit = str(cmd.value or "").strip()
                try:
                    checkpoint_limit = int(raw_checkpoint_limit)
                except ValueError as exc:
                    raise ValueError("checkpointRetentionLimit must be an integer 1..99") from exc
                if checkpoint_limit < 1 or checkpoint_limit > 99:
                    raise ValueError("checkpointRetentionLimit must be an integer 1..99")
                els[cmd.element_id] = el.model_copy(
                    update={"checkpoint_retention_limit": checkpoint_limit}
                )
            elif isinstance(el, ProjectSettingsElem) and cmd.key in {
                "lengthUnit",
                "angularUnitDeg",
                "displayLocale",
                "projectNumber",
                "clientName",
                "projectAddress",
                "projectStatus",
                "volumeComputedAt",
                "roomAreaComputationBasis",
            }:
                value = str(cmd.value or "").strip()
                if cmd.key == "volumeComputedAt":
                    if value not in {"finish_faces", "core_faces"}:
                        raise ValueError("volumeComputedAt must be finish_faces|core_faces")
                    els[cmd.element_id] = el.model_copy(update={"volume_computed_at": value})
                elif cmd.key == "roomAreaComputationBasis":
                    if value not in {
                        "wall_finish",
                        "wall_centerline",
                        "wall_core_layer",
                        "wall_core_center",
                    }:
                        raise ValueError(
                            "roomAreaComputationBasis must be wall_finish|wall_centerline|wall_core_layer|wall_core_center"
                        )
                    els[cmd.element_id] = el.model_copy(
                        update={"room_area_computation_basis": value}
                    )
                else:
                    key_map = {
                        "lengthUnit": "length_unit",
                        "angularUnitDeg": "angular_unit_deg",
                        "displayLocale": "display_locale",
                        "projectNumber": "project_number",
                        "clientName": "client_name",
                        "projectAddress": "project_address",
                        "projectStatus": "project_status",
                    }
                    els[cmd.element_id] = el.model_copy(update={key_map[cmd.key]: value or None})
            else:
                raise ValueError(
                    "Only updateElementProperty key=name | label(grid) | title(issue) | "
                    "programmeCode(room) | department(room) | programmeGroup(room) | functionLabel(room) | finishSet(room) | "
                    "targetAreaM2(room) | "
                    "planPresentation(plan_view) | categoriesHidden(plan_view JSON array) | "
                    "underlayLevelId(plan_view) | viewTemplateId(plan_view) | "
                    "cropMinMm(plan_view JSON object) | cropMaxMm(plan_view JSON object) | "
                    "viewRangeBottomMm(plan_view) | viewRangeTopMm(plan_view) | cutPlaneOffsetMm(plan_view) | "
                    "discipline(plan_view) | viewSubdiscipline(plan_view) | "
                    "planViewSubtype(plan_view) | areaScheme(plan_view|area) | phaseId(plan_view) | "
                    "planDetailLevel(plan_view coarse|medium|fine or empty) | "
                    "planRoomFillOpacityScale(plan_view float 0..1 or empty) | "
                    "planDetailLevel(view_template coarse|medium|fine or empty) | "
                    "planRoomFillOpacityScale(view_template float 0..1 or empty resets default 1.0) | "
                    "planShowOpeningTags(plan_view true|false or empty inherit; view_template true|false only) | "
                    "planShowRoomLabels(plan_view true|false or empty inherit; view_template true|false only) | "
                    "planOpeningTagStyleId(plan_view plan_tag_style id or empty inherit) | "
                    "planRoomTagStyleId(plan_view plan_tag_style id or empty inherit) | "
                    "defaultPlanOpeningTagStyleId(view_template plan_tag_style id or empty clear) | "
                    "defaultPlanRoomTagStyleId(view_template plan_tag_style id or empty clear) | "
                    "planCategoryGraphics(plan_view|view_template JSON array) | "
                    "viewerClipCapElevMm(viewpoint) | viewerClipFloorElevMm(viewpoint) | "
                    "hiddenSemanticKinds3d(viewpoint JSON array) | cutawayStyle(viewpoint) | "
                    "familyTypeId(door/window) | materialKey(door/window|wall) | "
                    "loadBearing/structuralRole/structuralMaterial/analysisStatus/fireResistanceRating(structural elements) | "
                    "isCurtainWall(wall) | roofAttachmentId(wall) | wallTypeId(wall) | "
                    "heightMm(wall) | thicknessMm(wall) | "
                    "paramValues(placed_asset JSON object) | "
                    "checkpointRetentionLimit(project_settings integer 1..99) | "
                    "lengthUnit/angularUnitDeg/displayLocale/project info(project_settings) | "
                    "volumeComputedAt/roomAreaComputationBasis(project_settings) | "
                    "roofTypeId(roof) | roofGeometryMode(roof) | "
                    "sheetId(schedule) | titleBlock(sheet) | titleblockParametersPatch(sheet JSON object) supported in v2"
                )

        case SaveViewpointCmd():
            vid = cmd.id or new_id()
            if vid in els:
                raise ValueError(f"duplicate element id '{vid}'")
            els[vid] = ViewpointElem(
                kind="viewpoint",
                id=vid,
                name=cmd.name,
                camera=cmd.camera,
                mode=cmd.mode,
                viewer_clip_cap_elev_mm=cmd.viewer_clip_cap_elev_mm,
                viewer_clip_floor_elev_mm=cmd.viewer_clip_floor_elev_mm,
                hidden_semantic_kinds_3d=list(cmd.hidden_semantic_kinds_3d or []),
                cutaway_style=cmd.cutaway_style,
                plan_overlay_enabled=cmd.plan_overlay_enabled,
                plan_overlay_source_plan_view_id=cmd.plan_overlay_source_plan_view_id,
                plan_overlay_offset_mm=cmd.plan_overlay_offset_mm,
                plan_overlay_opacity=cmd.plan_overlay_opacity,
                plan_overlay_line_opacity=cmd.plan_overlay_line_opacity,
                plan_overlay_fill_opacity=cmd.plan_overlay_fill_opacity,
                plan_overlay_annotations_visible=cmd.plan_overlay_annotations_visible,
                plan_overlay_witness_lines_visible=cmd.plan_overlay_witness_lines_visible,
            )

        case UpsertProjectSettingsCmd():
            sid = cmd.id
            els[sid] = ProjectSettingsElem(
                kind="project_settings",
                id=sid,
                name=cmd.name,
                project_number=cmd.project_number,
                client_name=cmd.client_name,
                project_address=cmd.project_address,
                project_status=cmd.project_status,
                length_unit=cmd.length_unit,
                angular_unit_deg=cmd.angular_unit_deg,
                display_locale=cmd.display_locale,
            )

        case UpsertRoomColorSchemeCmd():
            sid = cmd.id
            prev_el = els.get(sid)
            if prev_el is not None and not isinstance(prev_el, RoomColorSchemeElem):
                raise ValueError(
                    "upsertRoomColorScheme.id must reference room_color_scheme when element exists"
                )
            canon_rows = _canonical_room_scheme_rows(list(cmd.scheme_rows))
            els[sid] = RoomColorSchemeElem(kind="room_color_scheme", id=sid, scheme_rows=canon_rows)

        case CreateWallTypeCmd():
            tid = cmd.id or new_id()
            if tid in els:
                raise ValueError(f"duplicate element id '{tid}'")
            els[tid] = WallTypeElem(
                kind="wall_type",
                id=tid,
                name=cmd.name,
                layers=list(cmd.layers),
                basis_line=_basis_line(cmd.basis_line),
            )

        case UpsertWallTypeCmd():
            prev = els.get(cmd.id)
            if prev is not None and not isinstance(prev, WallTypeElem):
                raise ValueError("upsertWallType.id must reference wall_type when element exists")
            els[cmd.id] = WallTypeElem(
                kind="wall_type",
                id=cmd.id,
                name=cmd.name,
                layers=list(cmd.layers),
                basis_line=_basis_line(cmd.basis_line),
            )
            _propagate_wall_thickness_for_type(els, cmd.id)

        case UpsertFloorTypeCmd():
            prev = els.get(cmd.id)
            if prev is not None and not isinstance(prev, FloorTypeElem):
                raise ValueError("upsertFloorType.id must reference floor_type when element exists")
            els[cmd.id] = FloorTypeElem(
                kind="floor_type",
                id=cmd.id,
                name=cmd.name,
                layers=list(cmd.layers),
            )
            _propagate_floor_dims_for_type(els, cmd.id)

        case UpsertRoofTypeCmd():
            prev = els.get(cmd.id)
            if prev is not None and not isinstance(prev, RoofTypeElem):
                raise ValueError("upsertRoofType.id must reference roof_type when element exists")
            els[cmd.id] = RoofTypeElem(
                kind="roof_type",
                id=cmd.id,
                name=cmd.name,
                layers=list(cmd.layers),
            )

        case AssignWallDatumConstraintsCmd():
            w = els.get(cmd.wall_id)
            if not isinstance(w, WallElem):
                raise ValueError("assignWallDatumConstraints.wallId must reference a Wall")
            upd = w.model_copy(
                update={
                    "wall_type_id": cmd.wall_type_id
                    if cmd.wall_type_id is not None
                    else w.wall_type_id,
                    "base_constraint_level_id": cmd.base_constraint_level_id
                    if cmd.base_constraint_level_id is not None
                    else w.base_constraint_level_id,
                    "top_constraint_level_id": cmd.top_constraint_level_id
                    if cmd.top_constraint_level_id is not None
                    else w.top_constraint_level_id,
                    "base_constraint_offset_mm": cmd.base_constraint_offset_mm,
                    "top_constraint_offset_mm": cmd.top_constraint_offset_mm,
                }
            )
            thick = _wall_thickness_from_type(els, upd.wall_type_id, upd.thickness_mm)
            upd = upd.model_copy(update={"thickness_mm": thick})
            els[cmd.wall_id] = upd
            _recompute_constrained_wall_heights(els)
        case _:
            return False
    return True
