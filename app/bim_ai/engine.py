from __future__ import annotations

import json
import uuid
from typing import Any, cast

from pydantic import TypeAdapter

from bim_ai.commands import (
    AssignOpeningFamilyCmd,
    AssignWallDatumConstraintsCmd,
    AttachWallTopToRoofCmd,
    Command,
    CreateBcfTopicCmd,
    CreateCalloutCmd,
    CreateDimensionCmd,
    CreateFloorCmd,
    CreateGridLineCmd,
    CreateIssueFromViolationCmd,
    CreateJoinGeometryCmd,
    CreateLevelCmd,
    CreatePlanRegionCmd,
    CreateRailingCmd,
    CreateRoofCmd,
    CreateRoomOutlineCmd,
    CreateRoomPolyCmd,
    CreateRoomRectangleCmd,
    CreateRoomSeparationCmd,
    CreateSectionCutCmd,
    CreateSlabOpeningCmd,
    CreateStairCmd,
    CreateWallChainCmd,
    CreateWallCmd,
    CreateWallTypeCmd,
    DeleteElementCmd,
    DeleteElementsCmd,
    ExtendFloorInsulationCmd,
    InsertDoorOnWallCmd,
    InsertWindowOnWallCmd,
    MoveGridLineEndpointsCmd,
    MoveLevelElevationCmd,
    MoveWallDeltaCmd,
    MoveWallEndpointsCmd,
    RestoreElementCmd,
    SaveViewpointCmd,
    UpdateElementPropertyCmd,
    UpdateOpeningCleanroomCmd,
    UpsertFamilyTypeCmd,
    UpsertPlanViewCmd,
    UpsertProjectSettingsCmd,
    UpsertRoomVolumeCmd,
    UpsertScheduleCmd,
    UpsertScheduleFiltersCmd,
    UpsertSheetCmd,
    UpsertSheetViewportsCmd,
    UpsertTagDefinitionCmd,
    UpsertValidationRuleCmd,
    UpsertViewTemplateCmd,
)
from bim_ai.constraints import Violation, evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    BcfElem,
    CalloutElem,
    DimensionElem,
    DoorElem,
    Element,
    FamilyTypeElem,
    FloorElem,
    GridLineElem,
    IssueElem,
    JoinGeometryElem,
    LevelElem,
    PlanDetailLevelPlan,
    PlanRegionElem,
    PlanViewElem,
    ProjectSettingsElem,
    RailingElem,
    RoofElem,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    SlabOpeningElem,
    StairElem,
    TagDefinitionElem,
    ValidationRuleElem,
    Vec2Mm,
    ViewpointElem,
    ViewTemplateElem,
    WallBasisLine,
    WallElem,
    WallTypeElem,
    WindowElem,
)

command_adapter = TypeAdapter(Command)
element_adapter = TypeAdapter(Element)


def new_id() -> str:
    return str(uuid.uuid4())


def _clamp_unit_interval(x: float | None, default: float = 1.0) -> float:
    if x is None:
        return default
    return max(0.0, min(1.0, float(x)))


def _plan_detail_default_medium(raw: str | None) -> PlanDetailLevelPlan:
    if raw == "coarse":
        return "coarse"
    if raw == "fine":
        return "fine"
    if raw == "medium":
        return "medium"
    return "medium"


def _optional_plan_detail_override(raw: str | None) -> PlanDetailLevelPlan | None:
    if raw is None:
        return None
    if raw not in {"coarse", "medium", "fine"}:
        raise ValueError("planDetailLevel must be coarse|medium|fine")
    return cast(PlanDetailLevelPlan, raw)


def _optional_room_fill_scale(raw: float | None) -> float | None:
    if raw is None:
        return None
    return max(0.0, min(1.0, float(raw)))


def _parse_plan_view_bool_override(raw: str) -> bool | None:
    s = raw.strip().lower()
    if s == "":
        return None
    if s in {"true", "1"}:
        return True
    if s in {"false", "0"}:
        return False
    raise ValueError(
        "planShowOpeningTags/planShowRoomLabels(plan_view): use true|false or empty string to inherit"
    )


def _parse_view_template_bool(raw: str) -> bool:
    s = raw.strip().lower()
    if s in {"true", "1"}:
        return True
    if s in {"false", "0"}:
        return False
    raise ValueError("planShowOpeningTags/planShowRoomLabels(view_template): must be true|false")


def _stripped_optional_str(val: str | None) -> str | None:
    if val is None:
        return None
    t = val.strip()
    return t or None


def _room_programme_field_updates(
    programme_code: str | None,
    department: str | None,
    function_label: str | None,
    finish_set: str | None,
) -> dict[str, str | None]:
    return {
        "programme_code": _stripped_optional_str(programme_code),
        "department": _stripped_optional_str(department),
        "function_label": _stripped_optional_str(function_label),
        "finish_set": _stripped_optional_str(finish_set),
    }


def coerce_command(data: dict[str, Any]) -> Command:
    return command_adapter.validate_python(data)


def _dump_elements(elements: dict[str, Element]) -> dict[str, Any]:
    return {k: v.model_dump(by_alias=True) for k, v in elements.items()}


def clone_document(doc: Document) -> Document:
    payload = {"revision": doc.revision, "elements": _dump_elements(doc.elements)}
    return Document.model_validate(payload)


def _wall_elevation_mm(els: dict[str, Element], level_id: str) -> float:
    lv = els.get(level_id)
    if isinstance(lv, LevelElem):
        return float(lv.elevation_mm)
    return 0.0


def _resolve_wall_height_mm(cmd: CreateWallCmd, els: dict[str, Element]) -> float:
    if cmd.base_constraint_level_id and cmd.top_constraint_level_id:
        b = (
            _wall_elevation_mm(els, cmd.base_constraint_level_id)
            + cmd.base_constraint_offset_mm
        )
        t = (
            _wall_elevation_mm(els, cmd.top_constraint_level_id)
            + cmd.top_constraint_offset_mm
        )
        return max(100.0, t - b)
    return cmd.height_mm


def _basis_line(val: str) -> WallBasisLine:
    choices: tuple[WallBasisLine, ...] = ("center", "face_interior", "face_exterior")
    lowered = val.strip().lower()
    if lowered in choices:
        return cast(WallBasisLine, lowered)
    return "center"


def _recompute_constrained_wall_heights(els: dict[str, Element]) -> None:
    for wid, el in list(els.items()):
        if not isinstance(el, WallElem):
            continue
        if not (el.base_constraint_level_id and el.top_constraint_level_id):
            continue
        b = (
            _wall_elevation_mm(els, el.base_constraint_level_id)
            + el.base_constraint_offset_mm
        )
        t = (
            _wall_elevation_mm(els, el.top_constraint_level_id)
            + el.top_constraint_offset_mm
        )
        nh = max(100.0, t - b)
        if abs(nh - el.height_mm) > 1e-3:
            els[wid] = el.model_copy(update={"height_mm": nh})


def _wall_thickness_from_type(els: dict[str, Element], wall_type_id: str | None, fallback: float) -> float:
    if not wall_type_id:
        return fallback
    wt = els.get(wall_type_id)
    if not isinstance(wt, WallTypeElem) or not wt.layers:
        return fallback
    return float(sum(lyr.thickness_mm for lyr in wt.layers)) or fallback


def apply_inplace(doc: Document, cmd: Command) -> None:
    els = doc.elements
    match cmd:
        case CreateLevelCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"duplicate element id '{eid}'")
            parent = cmd.parent_level_id
            if parent is not None and parent not in els:
                raise ValueError("createLevel.parentLevelId must reference an existing Level")
            if parent is not None and not isinstance(els[parent], LevelElem):
                raise ValueError("createLevel.parentLevelId must reference a Level")
            els[eid] = LevelElem(
                kind="level",
                id=eid,
                name=cmd.name,
                elevation_mm=cmd.elevation_mm,
                datum_kind=cmd.datum_kind,
                parent_level_id=parent,
                offset_from_parent_mm=cmd.offset_from_parent_mm,
            )

        case CreateWallCmd():
            eid = cmd.id or new_id()
            if eid in els:
                raise ValueError(f"duplicate element id '{eid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createWall.levelId must reference an existing Level")
            h_mm = _resolve_wall_height_mm(cmd, els)
            thick = _wall_thickness_from_type(els, cmd.wall_type_id, cmd.thickness_mm)
            els[eid] = WallElem(
                kind="wall",
                id=eid,
                name=cmd.name,
                level_id=cmd.level_id,
                start=cmd.start,
                end=cmd.end,
                thickness_mm=thick,
                height_mm=h_mm,
                wall_type_id=cmd.wall_type_id,
                base_constraint_level_id=cmd.base_constraint_level_id,
                top_constraint_level_id=cmd.top_constraint_level_id,
                base_constraint_offset_mm=cmd.base_constraint_offset_mm,
                top_constraint_offset_mm=cmd.top_constraint_offset_mm,
                insulation_extension_mm=cmd.insulation_extension_mm,
            )

        case MoveWallDeltaCmd():
            w = els.get(cmd.wall_id)
            if not isinstance(w, WallElem):
                raise ValueError("move_wall_delta.wallId must reference a Wall")
            sx = w.start.model_copy(
                update={"x_mm": w.start.x_mm + cmd.dx_mm, "y_mm": w.start.y_mm + cmd.dy_mm}
            )
            sy = w.end.model_copy(
                update={"x_mm": w.end.x_mm + cmd.dx_mm, "y_mm": w.end.y_mm + cmd.dy_mm}
            )
            els[cmd.wall_id] = w.model_copy(update={"start": sx, "end": sy})

        case MoveWallEndpointsCmd():
            w = els.get(cmd.wall_id)
            if not isinstance(w, WallElem):
                raise ValueError("move_wall_endpoints.wallId must reference a Wall")
            els[cmd.wall_id] = w.model_copy(update={"start": cmd.start, "end": cmd.end})

        case InsertDoorOnWallCmd():
            did = cmd.id or new_id()
            if did in els:
                raise ValueError(f"duplicate element id '{did}'")
            host = els.get(cmd.wall_id)
            if not isinstance(host, WallElem):
                raise ValueError("insert_door_on_wall.wallId must reference a Wall")
            els[did] = DoorElem(
                kind="door",
                id=did,
                name=cmd.name,
                wall_id=cmd.wall_id,
                along_t=cmd.along_t,
                width_mm=cmd.width_mm,
                family_type_id=cmd.family_type_id,
            )

        case InsertWindowOnWallCmd():
            wid_cmd = cmd.id or new_id()
            if wid_cmd in els:
                raise ValueError(f"duplicate element id '{wid_cmd}'")
            host = els.get(cmd.wall_id)
            if not isinstance(host, WallElem):
                raise ValueError("insertWindowOnWall.wallId must reference a Wall")
            els[wid_cmd] = WindowElem(
                kind="window",
                id=wid_cmd,
                name=cmd.name,
                wall_id=cmd.wall_id,
                along_t=cmd.along_t,
                width_mm=cmd.width_mm,
                sill_height_mm=cmd.sill_height_mm,
                height_mm=cmd.height_mm,
                family_type_id=cmd.family_type_id,
            )

        case CreateWallChainCmd():
            if not cmd.segments:
                raise ValueError("createWallChain.segments requires at least one segment")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createWallChain.levelId must reference an existing Level")
            for idx, seg in enumerate(cmd.segments):
                eid = seg.id or new_id()
                if eid in els:
                    raise ValueError(f"duplicate segment id '{eid}'")
                name = cmd.name_prefix if len(cmd.segments) == 1 else f"{cmd.name_prefix}-{idx + 1}"
                els[eid] = WallElem(
                    kind="wall",
                    id=eid,
                    name=name,
                    level_id=cmd.level_id,
                    start=seg.start,
                    end=seg.end,
                    thickness_mm=seg.thickness_mm,
                    height_mm=seg.height_mm,
                )

        case CreateGridLineCmd():
            gid = cmd.id or new_id()
            if gid in els:
                raise ValueError(f"duplicate element id '{gid}'")
            if cmd.level_id is not None:
                lvl = els.get(cmd.level_id)
                if lvl is not None and not isinstance(lvl, LevelElem):
                    raise ValueError("createGridLine.levelId must reference a Level")
            els[gid] = GridLineElem(
                kind="grid_line",
                id=gid,
                name=cmd.name,
                start=cmd.start,
                end=cmd.end,
                label=cmd.label,
                level_id=cmd.level_id,
            )

        case MoveGridLineEndpointsCmd():
            g = els.get(cmd.grid_line_id)
            if not isinstance(g, GridLineElem):
                raise ValueError("moveGridLineEndpoints.gridLineId must reference grid_line")
            els[cmd.grid_line_id] = g.model_copy(update={"start": cmd.start, "end": cmd.end})

        case CreateDimensionCmd():
            did = cmd.id or new_id()
            if did in els:
                raise ValueError(f"duplicate element id '{did}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createDimension.levelId must reference an existing Level")
            els[did] = DimensionElem(
                kind="dimension",
                id=did,
                name=cmd.name,
                level_id=cmd.level_id,
                a_mm=cmd.a_mm,
                b_mm=cmd.b_mm,
                offset_mm=cmd.offset_mm,
                ref_element_id_a=cmd.ref_element_id_a,
                ref_element_id_b=cmd.ref_element_id_b,
                tag_definition_id=cmd.tag_definition_id,
            )

        case DeleteElementCmd():
            if cmd.element_id not in els:
                raise ValueError("deleteElement.elementId unknown")
            del els[cmd.element_id]

        case DeleteElementsCmd():
            missing = [eid for eid in cmd.element_ids if eid not in els]
            if missing:
                raise ValueError(f"deleteElements: unknown ids {sorted(missing)}")
            for eid in cmd.element_ids:
                del els[eid]

        case RestoreElementCmd():
            el = element_adapter.validate_python(cmd.element)
            els[el.id] = el

        case CreateRoomOutlineCmd():
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate element id '{rid}'")
            if len(cmd.outline_mm) < 3:
                raise ValueError("Room outline requires at least 3 vertices")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("create_room_outline.levelId must reference an existing Level")
            els[rid] = RoomElem(
                kind="room",
                id=rid,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=cmd.outline_mm,
                **_room_programme_field_updates(
                    cmd.programme_code,
                    cmd.department,
                    cmd.function_label,
                    cmd.finish_set,
                ),
            )

        case CreateRoomRectangleCmd():
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createRoomRectangle.levelId must reference an existing Level")
            w_mm, d_mm = cmd.width_mm, cmd.depth_mm
            if w_mm < 100 or d_mm < 100:
                raise ValueError("createRoomRectangle: widthMm and depthMm must be ≥ 100")
            ox, oy = cmd.origin.x_mm, cmd.origin.y_mm
            corners = (
                Vec2Mm(x_mm=ox, y_mm=oy),
                Vec2Mm(x_mm=ox + w_mm, y_mm=oy),
                Vec2Mm(x_mm=ox + w_mm, y_mm=oy + d_mm),
                Vec2Mm(x_mm=ox, y_mm=oy + d_mm),
            )
            pairs = ((0, 1), (1, 2), (2, 3), (3, 0))
            for ia, ib in pairs:
                wid = new_id()
                if wid in els:
                    raise ValueError(f"collision allocating wall id '{wid}'")
                a, b = corners[ia], corners[ib]
                els[wid] = WallElem(
                    kind="wall",
                    id=wid,
                    name=cmd.wall_name_prefix,
                    level_id=cmd.level_id,
                    start=a,
                    end=b,
                    thickness_mm=cmd.thickness_mm,
                    height_mm=cmd.height_mm,
                )
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate room id '{rid}'")
            els[rid] = RoomElem(
                kind="room",
                id=rid,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=list(corners),
                **_room_programme_field_updates(
                    cmd.programme_code,
                    cmd.department,
                    cmd.function_label,
                    cmd.finish_set,
                ),
            )

        case CreateRoomPolyCmd():
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createRoomPoly.levelId must reference an existing Level")
            verts = [Vec2Mm(x_mm=v.x_mm, y_mm=v.y_mm) for v in cmd.vertices_mm]
            if (
                len(verts) >= 2
                and abs(verts[0].x_mm - verts[-1].x_mm) < 1e-3
                and abs(verts[0].y_mm - verts[-1].y_mm) < 1e-3
            ):
                verts = verts[:-1]
            if len(verts) < 3:
                raise ValueError("createRoomPoly.verticesMm requires at least 3 unique corners")
            n = len(verts)
            for i in range(n):
                wid = new_id()
                if wid in els:
                    raise ValueError(f"collision allocating wall id '{wid}'")
                a, b = verts[i], verts[(i + 1) % n]
                nm = cmd.wall_name_prefix if n == 1 else f"{cmd.wall_name_prefix}-{i + 1}"
                els[wid] = WallElem(
                    kind="wall",
                    id=wid,
                    name=nm,
                    level_id=cmd.level_id,
                    start=a,
                    end=b,
                    thickness_mm=cmd.thickness_mm,
                    height_mm=cmd.height_mm,
                )
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate room id '{rid}'")
            els[rid] = RoomElem(
                kind="room",
                id=rid,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=verts,
                **_room_programme_field_updates(
                    cmd.programme_code,
                    cmd.department,
                    cmd.function_label,
                    cmd.finish_set,
                ),
            )

        case MoveLevelElevationCmd():
            lvl = els.get(cmd.level_id)
            if not isinstance(lvl, LevelElem):
                raise ValueError("moveLevelElevation.levelId must reference an existing Level")
            els[cmd.level_id] = lvl.model_copy(update={"elevation_mm": cmd.elevation_mm})
            _recompute_constrained_wall_heights(els)

        case CreateIssueFromViolationCmd():
            iid = new_id()
            els[iid] = IssueElem(
                kind="issue",
                id=iid,
                title=cmd.title,
                status="open",
                element_ids=cmd.element_ids,
                viewpoint_id=cmd.viewpoint_id,
            )

        case UpdateElementPropertyCmd():
            el = els.get(cmd.element_id)
            if el is None:
                raise ValueError("updateElementProperty.elementId unknown")
            if isinstance(el, IssueElem):
                if cmd.key != "title":
                    raise ValueError("Issues only support updateElementProperty.key=title (v2)")
                els[cmd.element_id] = el.model_copy(update={"title": cmd.value})
            elif cmd.key == "name" and hasattr(el, "name"):
                els[cmd.element_id] = el.model_copy(update={"name": cmd.value})
            elif cmd.key == "programmeCode" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"programme_code": cmd.value})
            elif cmd.key == "department" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"department": cmd.value})
            elif cmd.key == "functionLabel" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"function_label": cmd.value})
            elif cmd.key == "finishSet" and isinstance(el, RoomElem):
                els[cmd.element_id] = el.model_copy(update={"finish_set": cmd.value})
            elif cmd.key == "label" and isinstance(el, GridLineElem):
                els[cmd.element_id] = el.model_copy(update={"label": cmd.value})
            elif isinstance(el, PlanViewElem):
                raw = cmd.value.strip()
                if cmd.key == "planPresentation":
                    pres = raw if raw in {"default", "opening_focus", "room_scheme"} else "default"
                    els[cmd.element_id] = el.model_copy(update={"plan_presentation": pres})
                elif cmd.key == "categoriesHidden":
                    hx: list[str] = []
                    if raw:
                        try:
                            parsed = json.loads(raw)
                            if isinstance(parsed, list):
                                hx = [str(x) for x in parsed if isinstance(x, str)]
                        except json.JSONDecodeError as exc:
                            raise ValueError("categoriesHidden must be a JSON array of strings") from exc
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
                            raise ValueError("cropMinMm must be JSON object {xMm,yMm} or empty") from exc
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
                            raise ValueError("cropMaxMm must be JSON object {xMm,yMm} or empty") from exc
                        if not isinstance(parsed, dict):
                            raise ValueError("cropMaxMm must be a JSON object")
                        els[cmd.element_id] = el.model_copy(
                            update={"crop_max_mm": Vec2Mm.model_validate(parsed)}
                        )
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
                        els[cmd.element_id] = el.model_copy(update={"plan_room_fill_opacity_scale": None})
                    else:
                        v = max(0.0, min(1.0, float(raw)))
                        els[cmd.element_id] = el.model_copy(update={"plan_room_fill_opacity_scale": v})
                elif cmd.key == "planShowOpeningTags":
                    v = _parse_plan_view_bool_override(cmd.value)
                    els[cmd.element_id] = el.model_copy(update={"plan_show_opening_tags": v})
                elif cmd.key == "planShowRoomLabels":
                    v = _parse_plan_view_bool_override(cmd.value)
                    els[cmd.element_id] = el.model_copy(update={"plan_show_room_labels": v})
                else:
                    raise ValueError(
                        "plan_view updates: key=planPresentation | categoriesHidden | underlayLevelId | "
                        "viewTemplateId | cropMinMm | cropMaxMm | viewRangeBottomMm | viewRangeTopMm | "
                        "cutPlaneOffsetMm | discipline | phaseId | planDetailLevel | planRoomFillOpacityScale | "
                        "planShowOpeningTags | planShowRoomLabels | name"
                    )
            elif isinstance(el, ViewTemplateElem):
                if cmd.key == "planShowOpeningTags":
                    els[cmd.element_id] = el.model_copy(
                        update={"plan_show_opening_tags": _parse_view_template_bool(cmd.value)}
                    )
                elif cmd.key == "planShowRoomLabels":
                    els[cmd.element_id] = el.model_copy(
                        update={"plan_show_room_labels": _parse_view_template_bool(cmd.value)}
                    )
                else:
                    raise ValueError(
                        "view_template updates: key=planShowOpeningTags | planShowRoomLabels | name"
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
                    els[cmd.element_id] = el.model_copy(update={"viewer_clip_floor_elev_mm": floor_v})
                elif cmd.key == "hiddenSemanticKinds3d":
                    hid: list[str] = []
                    if raw:
                        try:
                            parsed = json.loads(raw)
                            if isinstance(parsed, list):
                                hid = [str(x) for x in parsed if isinstance(x, str)]
                        except json.JSONDecodeError as exc:
                            raise ValueError("hiddenSemanticKinds3d must be a JSON array of strings") from exc
                    els[cmd.element_id] = el.model_copy(update={"hidden_semantic_kinds_3d": hid})
                elif cmd.key == "name" and hasattr(el, "name"):
                    els[cmd.element_id] = el.model_copy(update={"name": cmd.value})
                else:
                    raise ValueError(
                        "viewpoint updates: key=viewerClipCapElevMm | viewerClipFloorElevMm | "
                        "hiddenSemanticKinds3d | name"
                    )
            elif isinstance(el, (DoorElem, WindowElem)):
                raw_v = cmd.value.strip()
                if cmd.key == "familyTypeId":
                    els[cmd.element_id] = el.model_copy(update={"family_type_id": raw_v or None})
                elif cmd.key == "materialKey":
                    els[cmd.element_id] = el.model_copy(update={"material_key": raw_v or None})
                else:
                    raise ValueError("door/window updates: key=familyTypeId | materialKey | name")
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
            else:
                raise ValueError(
                    "Only updateElementProperty key=name | label(grid) | title(issue) | "
                    "programmeCode(room) | department(room) | functionLabel(room) | finishSet(room) | "
                    "planPresentation(plan_view) | categoriesHidden(plan_view JSON array) | "
                    "underlayLevelId(plan_view) | viewTemplateId(plan_view) | "
                    "cropMinMm(plan_view JSON object) | cropMaxMm(plan_view JSON object) | "
                    "viewRangeBottomMm(plan_view) | viewRangeTopMm(plan_view) | cutPlaneOffsetMm(plan_view) | "
                    "discipline(plan_view) | phaseId(plan_view) | "
                    "planDetailLevel(plan_view coarse|medium|fine or empty) | "
                    "planRoomFillOpacityScale(plan_view float 0..1 or empty) | "
                    "planShowOpeningTags(plan_view true|false or empty inherit; view_template true|false only) | "
                    "planShowRoomLabels(plan_view true|false or empty inherit; view_template true|false only) | "
                    "viewerClipCapElevMm(viewpoint) | viewerClipFloorElevMm(viewpoint) | "
                    "hiddenSemanticKinds3d(viewpoint JSON array) | "
                    "familyTypeId(door/window) | materialKey(door/window) | "
                    "sheetId(schedule) supported in v2"
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
            )

        case UpsertProjectSettingsCmd():
            sid = cmd.id
            els[sid] = ProjectSettingsElem(
                kind="project_settings",
                id=sid,
                length_unit=cmd.length_unit,
                angular_unit_deg=cmd.angular_unit_deg,
                display_locale=cmd.display_locale,
            )

        case CreateWallTypeCmd():
            tid = cmd.id or new_id()
            if tid in els:
                raise ValueError(f"duplicate element id '{tid}'")
            els[tid] = WallTypeElem(
                kind="wall_type",
                id=tid,
                name=cmd.name,
                layers=list(cmd.layers),
                basisLine=_basis_line(cmd.basis_line),
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

        case CreateFloorCmd():
            fid = cmd.id or new_id()
            if fid in els:
                raise ValueError(f"duplicate element id '{fid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createFloor.levelId must reference an existing Level")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createFloor.boundaryMm requires ≥3 vertices")
            els[fid] = FloorElem(
                kind="floor",
                id=fid,
                name=cmd.name,
                level_id=cmd.level_id,
                boundary_mm=cmd.boundary_mm,
                thickness_mm=cmd.thickness_mm,
                structure_thickness_mm=cmd.structure_thickness_mm,
                finish_thickness_mm=cmd.finish_thickness_mm,
                room_bounded=cmd.room_bounded,
            )

        case CreateRoofCmd():
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate element id '{rid}'")
            if cmd.reference_level_id not in els or not isinstance(
                els[cmd.reference_level_id], LevelElem
            ):
                raise ValueError("createRoof.referenceLevelId must reference an existing Level")
            if len(cmd.footprint_mm) < 3:
                raise ValueError("createRoof.footprintMm requires ≥3 vertices")
            els[rid] = RoofElem(
                kind="roof",
                id=rid,
                name=cmd.name,
                reference_level_id=cmd.reference_level_id,
                footprint_mm=cmd.footprint_mm,
                overhang_mm=cmd.overhang_mm,
                slope_deg=cmd.slope_deg,
            )

        case ExtendFloorInsulationCmd():
            fl = els.get(cmd.floor_id)
            if not isinstance(fl, FloorElem):
                raise ValueError("extendFloorInsulation.floorId must reference a floor")
            els[cmd.floor_id] = fl.model_copy(
                update={"insulation_extension_mm": cmd.insulation_extension_mm}
            )

        case AttachWallTopToRoofCmd():
            w = els.get(cmd.wall_id)
            r = els.get(cmd.roof_id)
            if not isinstance(w, WallElem):
                raise ValueError("attachWallTopToRoof.wallId must reference a Wall")
            if not isinstance(r, RoofElem):
                raise ValueError("attachWallTopToRoof.roofId must reference a Roof")
            els[cmd.wall_id] = w.model_copy(update={"roof_attachment_id": cmd.roof_id})

        case CreateStairCmd():
            sid = cmd.id or new_id()
            if sid in els:
                raise ValueError(f"duplicate element id '{sid}'")
            for lid in (cmd.base_level_id, cmd.top_level_id):
                if lid not in els or not isinstance(els[lid], LevelElem):
                    raise ValueError("createStair base/top level must reference existing Level")
            els[sid] = StairElem(
                kind="stair",
                id=sid,
                name=cmd.name,
                base_level_id=cmd.base_level_id,
                top_level_id=cmd.top_level_id,
                run_start=cmd.run_start_mm,
                run_end=cmd.run_end_mm,
                width_mm=cmd.width_mm,
                riser_mm=cmd.riser_mm,
                tread_mm=cmd.tread_mm,
            )

        case CreateSlabOpeningCmd():
            oid = cmd.id or new_id()
            if oid in els:
                raise ValueError(f"duplicate element id '{oid}'")
            host = els.get(cmd.host_floor_id)
            if not isinstance(host, FloorElem):
                raise ValueError("createSlabOpening.hostFloorId must reference a floor")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createSlabOpening.boundaryMm requires ≥3 vertices")
            els[oid] = SlabOpeningElem(
                kind="slab_opening",
                id=oid,
                name=cmd.name,
                host_floor_id=cmd.host_floor_id,
                boundary_mm=cmd.boundary_mm,
                is_shaft=cmd.is_shaft,
            )

        case CreateRailingCmd():
            rid = cmd.id or new_id()
            if rid in els:
                raise ValueError(f"duplicate element id '{rid}'")
            if cmd.hosted_stair_id and cmd.hosted_stair_id not in els:
                raise ValueError("createRailing.hostedStairId unknown")
            if len(cmd.path_mm) < 2:
                raise ValueError("createRailing.pathMm requires ≥2 points")
            els[rid] = RailingElem(
                kind="railing",
                id=rid,
                name=cmd.name,
                hosted_stair_id=cmd.hosted_stair_id,
                path_mm=cmd.path_mm,
            )

        case UpsertFamilyTypeCmd():
            fid = cmd.id or new_id()
            els[fid] = FamilyTypeElem(
                kind="family_type",
                id=fid,
                discipline=cmd.discipline,
                parameters=dict(cmd.parameters),
            )

        case AssignOpeningFamilyCmd():
            op = els.get(cmd.opening_id)
            if not isinstance(op, (DoorElem, WindowElem)):
                raise ValueError("assignOpeningFamily.openingId must reference door or window")
            extra: dict[str, Any] = {"family_type_id": cmd.family_type_id}
            if cmd.cut_depth_mm is not None:
                extra["host_cut_depth_mm"] = cmd.cut_depth_mm
            if cmd.reveal_interior_mm is not None:
                extra["reveal_interior_mm"] = cmd.reveal_interior_mm
            els[cmd.opening_id] = op.model_copy(update=extra)

        case UpdateOpeningCleanroomCmd():
            op = els.get(cmd.opening_id)
            if not isinstance(op, (DoorElem, WindowElem)):
                raise ValueError("updateOpeningCleanroom.openingId must reference door or window")
            extra: dict[str, Any] = {}
            if cmd.interlock_grade is not None:
                extra["interlock_grade"] = cmd.interlock_grade
            if cmd.seal_rebate_mm is not None:
                extra["seal_rebate_mm"] = cmd.seal_rebate_mm
            if cmd.lod_plan is not None and cmd.lod_plan in {"simple", "detailed"}:
                extra["lod_plan"] = cmd.lod_plan
            els[cmd.opening_id] = op.model_copy(update=extra)

        case CreateRoomSeparationCmd():
            rsid = cmd.id or new_id()
            if rsid in els:
                raise ValueError(f"duplicate element id '{rsid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createRoomSeparation.levelId must reference Level")
            els[rsid] = RoomSeparationElem(
                kind="room_separation",
                id=rsid,
                name=cmd.name,
                level_id=cmd.level_id,
                start=cmd.start,
                end=cmd.end,
            )

        case CreatePlanRegionCmd():
            pid = cmd.id or new_id()
            if pid in els:
                raise ValueError(f"duplicate element id '{pid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createPlanRegion.levelId must reference Level")
            if len(cmd.outline_mm) < 3:
                raise ValueError("createPlanRegion outline requires ≥3 vertices")
            els[pid] = PlanRegionElem(
                kind="plan_region",
                id=pid,
                name=cmd.name,
                level_id=cmd.level_id,
                outline_mm=cmd.outline_mm,
                cut_plane_offset_mm=cmd.cut_plane_offset_mm,
            )

        case UpsertTagDefinitionCmd():
            tid_cmd = cmd.id or new_id()
            tag_kind_literal = (
                cmd.tag_kind if cmd.tag_kind in {"room", "sill", "slab_finish", "custom"} else "custom"
            )
            els[tid_cmd] = TagDefinitionElem(
                kind="tag_definition",
                id=tid_cmd,
                name=cmd.name,
                tag_kind=tag_kind_literal,  # type: ignore[arg-type]
                discipline=cmd.discipline,
            )

        case CreateJoinGeometryCmd():
            jid = cmd.id or new_id()
            if jid in els:
                raise ValueError(f"duplicate element id '{jid}'")
            for jid_ref in cmd.joined_element_ids:
                if jid_ref not in els:
                    raise ValueError(f"join_geometry joinedElementIds unknown '{jid_ref}'")
            els[jid] = JoinGeometryElem(
                kind="join_geometry",
                id=jid,
                joined_element_ids=cmd.joined_element_ids,
                notes=cmd.notes,
            )

        case CreateSectionCutCmd():
            scid = cmd.id or new_id()
            if scid in els:
                raise ValueError(f"duplicate element id '{scid}'")
            els[scid] = SectionCutElem(
                kind="section_cut",
                id=scid,
                name=cmd.name,
                line_start_mm=cmd.line_start_mm,
                line_end_mm=cmd.line_end_mm,
                crop_depth_mm=cmd.crop_depth_mm,
            )

        case UpsertViewTemplateCmd():
            vt = cmd.id or new_id()
            scale = cmd.scale if cmd.scale in {"scale_50", "scale_100", "scale_200"} else "scale_100"
            pdl = _plan_detail_default_medium(cmd.plan_detail_level)
            pfo = _clamp_unit_interval(cmd.plan_room_fill_opacity_scale, 1.0)
            els[vt] = ViewTemplateElem(
                kind="view_template",
                id=vt,
                name=cmd.name,
                scale=scale,
                disciplines_visible=list(cmd.disciplines_visible or []),
                hidden_categories=list(cmd.hidden_categories or []),
                plan_detail_level=pdl,
                plan_room_fill_opacity_scale=pfo,
                plan_show_opening_tags=cmd.plan_show_opening_tags is True,
                plan_show_room_labels=cmd.plan_show_room_labels is True,
            )

        case UpsertSheetCmd():
            sh = cmd.id or new_id()
            prior = els.get(sh)
            viewports: list[dict[str, Any]] = []
            if isinstance(prior, SheetElem):
                viewports = list(prior.viewports_mm)
            els[sh] = SheetElem(
                kind="sheet",
                id=sh,
                name=cmd.name,
                title_block=cmd.title_block,
                viewports_mm=viewports,
                paper_width_mm=float(cmd.paper_width_mm)
                if cmd.paper_width_mm is not None
                else (prior.paper_width_mm if isinstance(prior, SheetElem) else 42_000),
                paper_height_mm=float(cmd.paper_height_mm)
                if cmd.paper_height_mm is not None
                else (prior.paper_height_mm if isinstance(prior, SheetElem) else 29_700),
                titleblock_parameters=dict(cmd.titleblock_parameters or {})
                if cmd.titleblock_parameters is not None
                else (dict(prior.titleblock_parameters) if isinstance(prior, SheetElem) else {}),
            )

        case UpsertSheetViewportsCmd():
            sh_el = els.get(cmd.sheet_id)
            if not isinstance(sh_el, SheetElem):
                raise ValueError("upsertSheetViewports.sheetId must reference Sheet")
            els[cmd.sheet_id] = sh_el.model_copy(update={"viewports_mm": list(cmd.viewports_mm)})

        case UpsertScheduleCmd():
            sc = cmd.id or new_id()
            els[sc] = ScheduleElem(
                kind="schedule",
                id=sc,
                name=cmd.name,
                sheet_id=cmd.sheet_id,
            )

        case UpsertScheduleFiltersCmd():
            sc_el = els.get(cmd.schedule_id)
            if not isinstance(sc_el, ScheduleElem):
                raise ValueError("upsertScheduleFilters.scheduleId must reference schedule")
            merged = dict(sc_el.filters)
            merged.update(cmd.filters)
            gnext = dict(sc_el.grouping or {})
            if cmd.grouping:
                gnext.update(cmd.grouping)
            els[cmd.schedule_id] = sc_el.model_copy(update={"filters": merged, "grouping": gnext})

        case UpsertRoomVolumeCmd():
            r = els.get(cmd.room_id)
            if not isinstance(r, RoomElem):
                raise ValueError("upsertRoomVolume.roomId must reference Room")
            els[cmd.room_id] = r.model_copy(
                update={
                    "upper_limit_level_id": cmd.upper_limit_level_id,
                    "volume_ceiling_offset_mm": cmd.volume_ceiling_offset_mm,
                }
            )

        case UpsertPlanViewCmd():
            pvid = cmd.id or new_id()
            lvl = els.get(cmd.level_id)
            if not isinstance(lvl, LevelElem):
                raise ValueError("upsertPlanView.levelId must reference Level")
            vt_id = cmd.view_template_id
            if vt_id is not None:
                vt_el = els.get(vt_id)
                if not isinstance(vt_el, ViewTemplateElem):
                    raise ValueError("upsertPlanView.viewTemplateId must reference view_template")
            uli = cmd.underlay_level_id
            if uli is not None and uli not in els:
                raise ValueError(f"upsertPlanView underlay unknown level '{uli}'")
            pres = cmd.plan_presentation if cmd.plan_presentation in {
                "default",
                "opening_focus",
                "room_scheme",
            } else "default"
            pdl_override = _optional_plan_detail_override(cmd.plan_detail_level)
            pfo_override = _optional_room_fill_scale(cmd.plan_room_fill_opacity_scale)
            els[pvid] = PlanViewElem(
                kind="plan_view",
                id=pvid,
                name=cmd.name,
                level_id=cmd.level_id,
                view_template_id=cmd.view_template_id,
                plan_presentation=pres,
                underlay_level_id=cmd.underlay_level_id,
                discipline=cmd.discipline or "architecture",
                phase_id=cmd.phase_id,
                crop_min_mm=cmd.crop_min_mm,
                crop_max_mm=cmd.crop_max_mm,
                view_range_bottom_mm=cmd.view_range_bottom_mm,
                view_range_top_mm=cmd.view_range_top_mm,
                cut_plane_offset_mm=cmd.cut_plane_offset_mm,
                categories_hidden=list(cmd.categories_hidden or []),
                plan_detail_level=pdl_override,
                plan_room_fill_opacity_scale=pfo_override,
                plan_show_opening_tags=cmd.plan_show_opening_tags,
                plan_show_room_labels=cmd.plan_show_room_labels,
            )

        case CreateCalloutCmd():
            cid = cmd.id or new_id()
            if cid in els:
                raise ValueError(f"duplicate element id '{cid}'")
            if cmd.parent_sheet_id not in els or not isinstance(els[cmd.parent_sheet_id], SheetElem):
                raise ValueError("createCallout.parentSheetId must reference Sheet")
            if len(cmd.outline_mm) < 3:
                raise ValueError("createCallout outline requires ≥3 vertices")
            els[cid] = CalloutElem(
                kind="callout",
                id=cid,
                name=cmd.name,
                parent_sheet_id=cmd.parent_sheet_id,
                outline_mm=cmd.outline_mm,
            )

        case CreateBcfTopicCmd():
            bid = cmd.id or new_id()
            if bid in els:
                raise ValueError(f"duplicate element id '{bid}'")
            els[bid] = BcfElem(
                kind="bcf",
                id=bid,
                title=cmd.title,
                viewpoint_ref=cmd.viewpoint_ref,
            )

        case UpsertValidationRuleCmd():
            vid = cmd.id or new_id()
            els[vid] = ValidationRuleElem(
                kind="validation_rule",
                id=vid,
                name=cmd.name,
                rule_json=dict(cmd.rule_json),
            )


def diff_undo_cmds(prev_doc: Document, next_doc: Document) -> list[dict[str, Any]]:
    cmds: list[dict[str, Any]] = []

    prev_ids = set(prev_doc.elements.keys())
    next_ids = set(next_doc.elements.keys())

    delete_ids = sorted(next_ids - prev_ids)
    for nid in delete_ids:
        cmds.append({"type": "deleteElement", "elementId": nid})

    for pid in sorted(prev_ids.union(next_ids)):
        pv = prev_doc.elements.get(pid)
        nx = next_doc.elements.get(pid)
        if nx != pv and pv is not None:
            cmds.append({"type": "restoreElement", "element": pv.model_dump(by_alias=True)})
    return cmds


def compute_delta_wire(prev_doc: Document, next_doc: Document) -> dict[str, Any]:
    removed_ids = sorted(prev_doc.elements.keys() - next_doc.elements.keys())
    elements_patch: dict[str, Any] = {}
    next_ids_all = next_doc.elements.keys()
    prev_ids_all = prev_doc.elements.keys()
    union = sorted(set(next_ids_all) | set(prev_ids_all))
    for eid in union:
        p = prev_doc.elements.get(eid)
        n = next_doc.elements.get(eid)
        if n is None:
            continue
        if n != p:
            elements_patch[eid] = n.model_dump(by_alias=True)

    return {
        "revision": next_doc.revision,
        "removedIds": removed_ids,
        "elements": elements_patch,
        "violations": [v.model_dump(by_alias=True) for v in evaluate(next_doc.elements)],
    }


def bundle_replay_diagnostics(cmds_raw: list[dict[str, Any]]) -> dict[str, Any]:
    """Stable ordering metadata for collaboration + replay surfaces (WP-X01 / WP-P02)."""

    types_in_order: list[str] = []
    for c in cmds_raw:
        if not isinstance(c, dict):
            types_in_order.append("?")
            continue
        t = c.get("type")
        types_in_order.append(str(t) if t is not None else "?")
    return {
        "commandCount": len(cmds_raw),
        "commandTypesInOrder": types_in_order,
    }


def first_blocking_command_index_after_prefixes(doc: Document, cmds: list[Command]) -> int | None:
    """First apply index (0-based) where accumulated model hits a blocking/error violation."""

    cand = clone_document(doc)
    for i, cmd in enumerate(cmds):
        apply_inplace(cand, cmd)
        violations = evaluate(cand.elements)
        blocking = [v for v in violations if v.blocking or v.severity == "error"]
        if blocking:
            return i
    return None


def replay_bundle_diagnostics_for_outcome(
    doc: Document,
    cmds_raw: list[dict[str, Any]],
    *,
    outcome_code: str,
) -> dict[str, Any]:
    """Augment ordering metadata after a bundle try; adds conflict index on constraint failures."""

    base = bundle_replay_diagnostics(cmds_raw)
    if outcome_code != "constraint_error":
        return base
    try:
        cmds = [coerce_command(c) for c in cmds_raw]
    except Exception:
        return base
    idx = first_blocking_command_index_after_prefixes(doc, cmds)
    if idx is not None:
        return {**base, "firstBlockingCommandIndex": idx}
    return base


def try_commit_bundle(
    doc: Document,
    cmds_raw: list[dict[str, Any]],
) -> tuple[bool, Document | None, list[Command], list[Violation], str]:
    cmds: list[Command] = [coerce_command(c) for c in cmds_raw]
    cand = clone_document(doc)
    for cmd in cmds:
        apply_inplace(cand, cmd)

    violations = evaluate(cand.elements)

    blocking = [v for v in violations if v.blocking or v.severity == "error"]
    if blocking:
        return False, None, cmds, violations, "constraint_error"

    cand.revision = doc.revision + 1

    return True, cand, cmds, violations, "ok"


def try_commit(
    doc: Document, cmd_raw: dict[str, Any]
) -> tuple[bool, Document | None, Command, list[Violation], str]:
    cmds = coerce_command(cmd_raw)
    cand = clone_document(doc)
    apply_inplace(cand, cmds)

    violations = evaluate(cand.elements)

    blocking = [v for v in violations if v.blocking or v.severity == "error"]
    if blocking:
        return False, None, cmds, violations, "constraint_error"

    cand.revision = doc.revision + 1

    return True, cand, cmds, violations, "ok"
