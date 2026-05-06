from __future__ import annotations

import hashlib
import json
import uuid
from collections import Counter
from typing import Any, Literal, NamedTuple, cast

from pydantic import TypeAdapter

from bim_ai.commands import (
    ApplyPlanViewTemplateCmd,
    AssignOpeningFamilyCmd,
    AssignWallDatumConstraintsCmd,
    AttachWallTopToRoofCmd,
    Command,
    CreateAgentAssumptionCmd,
    CreateAgentDeviationCmd,
    CreateBalconyCmd,
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
    UpdatePlanViewCropCmd,
    UpdatePlanViewRangeCmd,
    UpsertFamilyTypeCmd,
    UpsertFloorTypeCmd,
    UpsertPlanTagStyleCmd,
    UpsertPlanViewCmd,
    UpsertPlanViewTemplateCmd,
    UpsertProjectSettingsCmd,
    UpsertRoofTypeCmd,
    UpsertRoomColorSchemeCmd,
    UpsertRoomVolumeCmd,
    UpsertScheduleCmd,
    UpsertScheduleFiltersCmd,
    UpsertSheetCmd,
    UpsertSheetViewportsCmd,
    UpsertSiteCmd,
    UpsertTagDefinitionCmd,
    UpsertValidationRuleCmd,
    UpsertViewTemplateCmd,
    UpsertWallTypeCmd,
)
from bim_ai.constraints import Violation, evaluate
from bim_ai.datum_levels import (
    expected_level_elevation_from_parent,
    propagate_dependent_level_elevations,
)
from bim_ai.document import Document
from bim_ai.elements import (
    AgentAssumptionElem,
    AgentDeviationElem,
    BalconyElem,
    BcfElem,
    CalloutElem,
    DimensionElem,
    DoorElem,
    Element,
    FamilyTypeElem,
    FloorElem,
    FloorTypeElem,
    GridLineElem,
    IssueElem,
    JoinGeometryElem,
    LevelElem,
    PlanCategoryGraphicRow,
    PlanDetailLevelPlan,
    PlanRegionElem,
    PlanTagStyleElem,
    PlanViewElem,
    ProjectSettingsElem,
    RailingElem,
    RoofElem,
    RoofTypeElem,
    RoomColorSchemeElem,
    RoomColorSchemeRow,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    SiteContextObjectRow,
    SiteElem,
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
from bim_ai.export_ifc import (
    AUTHORITATIVE_REPLAY_KIND_V0,
    KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
)
from bim_ai.plan_category_graphics import (
    normalize_plan_category_graphics_rows,
    parse_plan_category_graphics_property_json,
)
from bim_ai.roof_geometry import (
    RoofGeometryMode,
    assert_valid_gable_pitched_rectangle_footprint_mm,
)

_AUTHORITATIVE_REPLAY_V0_TYPES: frozenset[str] = frozenset(
    {
        "createLevel",
        "createFloor",
        "createWall",
        "createRoof",
        "createRoomOutline",
        "createStair",
        "insertDoorOnWall",
        "insertWindowOnWall",
        "createSlabOpening",
    }
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


_OPENING_LABEL_FIELD_ORDER = (
    "name",
    "programmeCode",
    "elementId",
    "widthMm",
    "heightMm",
    "sillHeightMm",
)
_ROOM_LABEL_FIELD_ORDER = (
    "name",
    "programmeCode",
    "elementId",
    "department",
    "functionLabel",
    "finishSet",
    "targetAreaM2",
)


def _normalize_plan_tag_label_fields(
    target: Literal["opening", "room"],
    fields: list[str],
) -> list[str]:
    allowed = _OPENING_LABEL_FIELD_ORDER if target == "opening" else _ROOM_LABEL_FIELD_ORDER
    allowed_set = frozenset(allowed)
    seen: set[str] = set()
    out: list[str] = []
    for f in fields:
        if f not in allowed_set or f in seen:
            continue
        seen.add(f)
        out.append(f)
    return out


def _validate_plan_tag_style_ref(
    els: dict[str, Element],
    ref: str | None,
    lane: Literal["opening", "room"],
) -> None:
    if not ref:
        return
    el = els.get(ref)
    if not isinstance(el, PlanTagStyleElem):
        raise ValueError("plan tag style ref must reference plan_tag_style")
    if el.tag_target != lane:
        raise ValueError(
            f"plan tag style targets '{el.tag_target}' but this slot expects '{lane}' elements"
        )


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
    target_area_m2: float | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "programme_code": _stripped_optional_str(programme_code),
        "department": _stripped_optional_str(department),
        "function_label": _stripped_optional_str(function_label),
        "finish_set": _stripped_optional_str(finish_set),
    }
    if target_area_m2 is not None:
        if target_area_m2 <= 0:
            raise ValueError("targetAreaM2 must be positive when set")
        out["target_area_m2"] = float(target_area_m2)
    return out


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
        b = _wall_elevation_mm(els, cmd.base_constraint_level_id) + cmd.base_constraint_offset_mm
        t = _wall_elevation_mm(els, cmd.top_constraint_level_id) + cmd.top_constraint_offset_mm
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
        b = _wall_elevation_mm(els, el.base_constraint_level_id) + el.base_constraint_offset_mm
        t = _wall_elevation_mm(els, el.top_constraint_level_id) + el.top_constraint_offset_mm
        nh = max(100.0, t - b)
        if abs(nh - el.height_mm) > 1e-3:
            els[wid] = el.model_copy(update={"height_mm": nh})


def _wall_thickness_from_type(
    els: dict[str, Element], wall_type_id: str | None, fallback: float
) -> float:
    if not wall_type_id:
        return fallback
    wt = els.get(wall_type_id)
    if not isinstance(wt, WallTypeElem) or not wt.layers:
        return fallback
    return float(sum(lyr.thickness_mm for lyr in wt.layers)) or fallback


def _floor_dims_from_type(
    els: dict[str, Element], floor_type_id: str | None
) -> tuple[float, float, float] | None:
    if not floor_type_id:
        return None
    ft = els.get(floor_type_id)
    if not isinstance(ft, FloorTypeElem) or not ft.layers:
        return None
    layers = ft.layers
    total = float(sum(lyr.thickness_mm for lyr in layers))
    structure = float(
        sum(lyr.thickness_mm for lyr in layers if lyr.layer_function in ("structure", "insulation"))
    )
    finish = float(sum(lyr.thickness_mm for lyr in layers if lyr.layer_function == "finish"))
    return (total, structure, finish)


def _propagate_wall_thickness_for_type(els: dict[str, Element], wall_type_id: str) -> None:
    wt = els.get(wall_type_id)
    if not isinstance(wt, WallTypeElem) or not wt.layers:
        return
    thick = float(sum(lyr.thickness_mm for lyr in wt.layers))
    for eid, el in list(els.items()):
        if isinstance(el, WallElem) and el.wall_type_id == wall_type_id:
            els[eid] = el.model_copy(update={"thickness_mm": thick})


def _propagate_floor_dims_for_type(els: dict[str, Element], floor_type_id: str) -> None:
    dims = _floor_dims_from_type(els, floor_type_id)
    if dims is None:
        return
    t_mm, s_mm, f_mm = dims
    for eid, el in list(els.items()):
        if isinstance(el, FloorElem) and el.floor_type_id == floor_type_id:
            els[eid] = el.model_copy(
                update={
                    "thickness_mm": t_mm,
                    "structure_thickness_mm": s_mm,
                    "finish_thickness_mm": f_mm,
                }
            )


def _canonical_room_scheme_rows(rows: list[RoomColorSchemeRow]) -> list[RoomColorSchemeRow]:
    keyed: dict[tuple[str, str], RoomColorSchemeRow] = {}
    for row in rows:
        prog = (row.programme_code or "").strip()
        dept = (row.department or "").strip()
        keyed[(prog.lower(), dept.lower())] = row
    out_keys = sorted(keyed.keys(), key=lambda x: (x[0], x[1]))
    return [keyed[k] for k in out_keys]


def _polygon_signed_area_xy_mm(pts: list[tuple[float, float]]) -> float:
    n = len(pts)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return 0.5 * s


def _site_boundary_turn_cross_products_xy_mm(pts: list[tuple[float, float]]) -> list[float]:
    """Cross of successive edge vectors at each vertex; strictly convex CCW ⇒ all > 0."""
    n = len(pts)
    out: list[float] = []
    for i in range(n):
        p0 = pts[(i - 1) % n]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        ax, ay = p1[0] - p0[0], p1[1] - p0[1]
        bx, by = p2[0] - p1[0], p2[1] - p1[1]
        out.append(ax * by - ay * bx)
    return out


def _canonical_site_boundary_mm(raw: list[Vec2Mm]) -> list[Vec2Mm]:
    """Dedupe consecutive points, enforce CCW, rotate lexicographically smallest vertex first."""

    tuples = [(round(float(p.x_mm), 6), round(float(p.y_mm), 6)) for p in raw]
    cleaned: list[tuple[float, float]] = []
    for t in tuples:
        if cleaned and cleaned[-1] == t:
            continue
        cleaned.append(t)
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1]:
        cleaned.pop()
    if len(cleaned) < 3:
        raise ValueError("site.boundaryMm requires ≥3 distinct vertices")
    idx_min = min(range(len(cleaned)), key=lambda i: (cleaned[i][0], cleaned[i][1]))
    rotated = cleaned[idx_min:] + cleaned[:idx_min]
    area = _polygon_signed_area_xy_mm(rotated)
    if area < 0:
        rotated = list(reversed(rotated))
        idx_min = min(range(len(rotated)), key=lambda i: (rotated[i][0], rotated[i][1]))
        rotated = rotated[idx_min:] + rotated[:idx_min]
        area = _polygon_signed_area_xy_mm(rotated)
    if area <= 0:
        raise ValueError("site.boundaryMm must form a non-degenerate CCW polygon")
    crosses = _site_boundary_turn_cross_products_xy_mm(rotated)
    if not all(c > 1e-9 for c in crosses):
        raise ValueError(
            "site.boundaryMm must be strictly convex CCW (no collinear or concave vertices)"
        )
    return [Vec2Mm(xMm=a[0], yMm=a[1]) for a in rotated]


def _canonical_site_context_rows(rows: list[SiteContextObjectRow]) -> list[SiteContextObjectRow]:
    by_id = {r.id: r for r in rows}
    if len(by_id) != len(rows):
        raise ValueError("site.contextObjects must have unique ids")
    return [by_id[k] for k in sorted(by_id.keys())]


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
            parent_el = els[parent] if parent is not None else None
            elev_mm = (
                expected_level_elevation_from_parent(parent_el, cmd.offset_from_parent_mm)
                if isinstance(parent_el, LevelElem)
                else float(cmd.elevation_mm)
            )
            els[eid] = LevelElem(
                kind="level",
                id=eid,
                name=cmd.name,
                elevation_mm=elev_mm,
                datum_kind=cmd.datum_kind,
                parent_level_id=parent,
                offset_from_parent_mm=cmd.offset_from_parent_mm,
            )
            propagate_dependent_level_elevations(els)
            # VIE-05: optionally create a companion "<name> — Plan" plan view in
            # the same step so the common path (level then plan) is one action.
            if cmd.also_create_plan_view:
                pv_id = cmd.plan_view_id or new_id()
                if pv_id in els:
                    raise ValueError(f"duplicate element id '{pv_id}'")
                els[pv_id] = PlanViewElem(
                    kind="plan_view",
                    id=pv_id,
                    name=f"{cmd.name} — Plan",
                    level_id=eid,
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
                material_key=cmd.material_key,
                is_curtain_wall=cmd.is_curtain_wall,
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
                    cmd.target_area_m2,
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
                    cmd.target_area_m2,
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
                    cmd.target_area_m2,
                ),
            )

        case MoveLevelElevationCmd():
            lvl = els.get(cmd.level_id)
            if not isinstance(lvl, LevelElem):
                raise ValueError("moveLevelElevation.levelId must reference an existing Level")
            els[cmd.level_id] = lvl.model_copy(update={"elevation_mm": cmd.elevation_mm})
            propagate_dependent_level_elevations(els)
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
                        "viewTemplateId | cropMinMm | cropMaxMm | viewRangeBottomMm | viewRangeTopMm | "
                        "cutPlaneOffsetMm | discipline | phaseId | planDetailLevel | planRoomFillOpacityScale | "
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
                elif cmd.key == "name" and hasattr(el, "name"):
                    els[cmd.element_id] = el.model_copy(update={"name": cmd.value})
                else:
                    raise ValueError(
                        "viewpoint updates: key=viewerClipCapElevMm | viewerClipFloorElevMm | "
                        "hiddenSemanticKinds3d | cutawayStyle | name"
                    )
            elif isinstance(el, WallElem):

                def _str_val(v: object) -> str:
                    return str(v).strip() if v is not None else ""

                if cmd.key == "materialKey":
                    els[cmd.element_id] = el.model_copy(
                        update={"material_key": _str_val(cmd.value) or None}
                    )
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
                        "wall updates: key=materialKey | isCurtainWall | roofAttachmentId | wallTypeId | heightMm | thicknessMm | name"
                    )
            elif isinstance(el, (DoorElem, WindowElem)):
                raw_v = str(cmd.value).strip() if cmd.value is not None else ""
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
            else:
                raise ValueError(
                    "Only updateElementProperty key=name | label(grid) | title(issue) | "
                    "programmeCode(room) | department(room) | programmeGroup(room) | functionLabel(room) | finishSet(room) | "
                    "targetAreaM2(room) | "
                    "planPresentation(plan_view) | categoriesHidden(plan_view JSON array) | "
                    "underlayLevelId(plan_view) | viewTemplateId(plan_view) | "
                    "cropMinMm(plan_view JSON object) | cropMaxMm(plan_view JSON object) | "
                    "viewRangeBottomMm(plan_view) | viewRangeTopMm(plan_view) | cutPlaneOffsetMm(plan_view) | "
                    "discipline(plan_view) | phaseId(plan_view) | "
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
                    "isCurtainWall(wall) | roofAttachmentId(wall) | wallTypeId(wall) | "
                    "heightMm(wall) | thicknessMm(wall) | "
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

        case CreateFloorCmd():
            fid = cmd.id or new_id()
            if fid in els:
                raise ValueError(f"duplicate element id '{fid}'")
            if cmd.level_id not in els or not isinstance(els[cmd.level_id], LevelElem):
                raise ValueError("createFloor.levelId must reference an existing Level")
            if len(cmd.boundary_mm) < 3:
                raise ValueError("createFloor.boundaryMm requires ≥3 vertices")
            dims = _floor_dims_from_type(els, cmd.floor_type_id)
            if dims is not None:
                t_mm, s_mm, f_mm = dims
            else:
                t_mm, s_mm, f_mm = (
                    cmd.thickness_mm,
                    cmd.structure_thickness_mm,
                    cmd.finish_thickness_mm,
                )
            els[fid] = FloorElem(
                kind="floor",
                id=fid,
                name=cmd.name,
                level_id=cmd.level_id,
                boundary_mm=cmd.boundary_mm,
                thickness_mm=t_mm,
                structure_thickness_mm=s_mm,
                finish_thickness_mm=f_mm,
                floor_type_id=cmd.floor_type_id,
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
            rtid = cmd.roof_type_id
            if rtid is not None:
                rtid = str(rtid).strip() or None
                if rtid is not None:
                    rt_el = els.get(rtid)
                    if not isinstance(rt_el, RoofTypeElem):
                        raise ValueError(
                            "createRoof.roofTypeId must reference an existing roof_type"
                        )
            if cmd.roof_geometry_mode in ("gable_pitched_rectangle", "asymmetric_gable"):
                assert_valid_gable_pitched_rectangle_footprint_mm(
                    [(p.x_mm, p.y_mm) for p in cmd.footprint_mm]
                )
            els[rid] = RoofElem(
                kind="roof",
                id=rid,
                name=cmd.name,
                reference_level_id=cmd.reference_level_id,
                footprint_mm=cmd.footprint_mm,
                overhang_mm=cmd.overhang_mm,
                slope_deg=cmd.slope_deg,
                roof_geometry_mode=cmd.roof_geometry_mode,
                ridge_offset_transverse_mm=cmd.ridge_offset_transverse_mm,
                eave_height_left_mm=cmd.eave_height_left_mm,
                eave_height_right_mm=cmd.eave_height_right_mm,
                roof_type_id=rtid,
                material_key=cmd.material_key,
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

        case CreateBalconyCmd():
            bid = cmd.id or new_id()
            if bid in els:
                raise ValueError(f"duplicate element id '{bid}'")
            if cmd.wall_id not in els or not isinstance(els[cmd.wall_id], WallElem):
                raise ValueError("createBalcony.wallId must reference an existing wall")
            els[bid] = BalconyElem(
                kind="balcony",
                id=bid,
                name=cmd.name,
                wall_id=cmd.wall_id,
                elevation_mm=cmd.elevation_mm,
                projection_mm=cmd.projection_mm,
                slab_thickness_mm=cmd.slab_thickness_mm,
                balustrade_height_mm=cmd.balustrade_height_mm,
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
                cmd.tag_kind
                if cmd.tag_kind in {"room", "sill", "slab_finish", "custom"}
                else "custom"
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
            prior_tmpl = els.get(vt) if isinstance(els.get(vt), ViewTemplateElem) else None
            d_open = cmd.default_plan_opening_tag_style_id
            if (
                prior_tmpl is not None
                and "default_plan_opening_tag_style_id" not in cmd.model_fields_set
            ):
                d_open = prior_tmpl.default_plan_opening_tag_style_id
            if d_open is not None:
                _validate_plan_tag_style_ref(els, d_open, "opening")
            d_room = cmd.default_plan_room_tag_style_id
            if (
                prior_tmpl is not None
                and "default_plan_room_tag_style_id" not in cmd.model_fields_set
            ):
                d_room = prior_tmpl.default_plan_room_tag_style_id
            if d_room is not None:
                _validate_plan_tag_style_ref(els, d_room, "room")
            scale = (
                cmd.scale if cmd.scale in {"scale_50", "scale_100", "scale_200"} else "scale_100"
            )
            pdl = _plan_detail_default_medium(cmd.plan_detail_level)
            pfo = _clamp_unit_interval(cmd.plan_room_fill_opacity_scale, 1.0)
            pcg_t: list[PlanCategoryGraphicRow] = []
            if "plan_category_graphics" in cmd.model_fields_set:
                pcg_t = normalize_plan_category_graphics_rows(cmd.plan_category_graphics or [])
            elif prior_tmpl is not None:
                pcg_t = list(prior_tmpl.plan_category_graphics)
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
                default_plan_opening_tag_style_id=d_open,
                default_plan_room_tag_style_id=d_room,
                plan_category_graphics=pcg_t,
            )

        case UpsertPlanViewTemplateCmd():
            vt = cmd.id or new_id()
            prior_tmpl = els.get(vt) if isinstance(els.get(vt), ViewTemplateElem) else None
            d_open = cmd.default_plan_opening_tag_style_id
            if (
                prior_tmpl is not None
                and "default_plan_opening_tag_style_id" not in cmd.model_fields_set
            ):
                d_open = prior_tmpl.default_plan_opening_tag_style_id
            if d_open is not None:
                _validate_plan_tag_style_ref(els, d_open, "opening")
            d_room = cmd.default_plan_room_tag_style_id
            if (
                prior_tmpl is not None
                and "default_plan_room_tag_style_id" not in cmd.model_fields_set
            ):
                d_room = prior_tmpl.default_plan_room_tag_style_id
            if d_room is not None:
                _validate_plan_tag_style_ref(els, d_room, "room")
            scale = (
                cmd.scale if cmd.scale in {"scale_50", "scale_100", "scale_200"} else "scale_100"
            )
            pdl = _plan_detail_default_medium(cmd.plan_detail_level)
            pfo = _clamp_unit_interval(cmd.plan_room_fill_opacity_scale, 1.0)
            pcg_t: list[PlanCategoryGraphicRow] = []
            if "plan_category_graphics" in cmd.model_fields_set:
                pcg_t = normalize_plan_category_graphics_rows(cmd.plan_category_graphics or [])
            elif prior_tmpl is not None:
                pcg_t = list(prior_tmpl.plan_category_graphics)
            vrb: float | None = cmd.view_range_bottom_mm
            if prior_tmpl is not None and "view_range_bottom_mm" not in cmd.model_fields_set:
                vrb = prior_tmpl.view_range_bottom_mm
            vrt: float | None = cmd.view_range_top_mm
            if prior_tmpl is not None and "view_range_top_mm" not in cmd.model_fields_set:
                vrt = prior_tmpl.view_range_top_mm
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
                default_plan_opening_tag_style_id=d_open,
                default_plan_room_tag_style_id=d_room,
                plan_category_graphics=pcg_t,
                view_range_bottom_mm=vrb,
                view_range_top_mm=vrt,
            )

        case ApplyPlanViewTemplateCmd():
            pv_el = els.get(cmd.plan_view_id)
            if not isinstance(pv_el, PlanViewElem):
                raise ValueError("applyPlanViewTemplate.planViewId must reference plan_view")
            tmpl_el = els.get(cmd.template_id)
            if not isinstance(tmpl_el, ViewTemplateElem):
                raise ValueError("applyPlanViewTemplate.templateId must reference view_template")
            update: dict[str, Any] = {
                "view_template_id": cmd.template_id,
                "crop_min_mm": None,
                "crop_max_mm": None,
                "view_range_bottom_mm": tmpl_el.view_range_bottom_mm,
                "view_range_top_mm": tmpl_el.view_range_top_mm,
                "categories_hidden": list(tmpl_el.hidden_categories),
                "plan_category_graphics": list(tmpl_el.plan_category_graphics),
            }
            if tmpl_el.default_plan_opening_tag_style_id is not None:
                update["plan_opening_tag_style_id"] = tmpl_el.default_plan_opening_tag_style_id
            if tmpl_el.default_plan_room_tag_style_id is not None:
                update["plan_room_tag_style_id"] = tmpl_el.default_plan_room_tag_style_id
            els[cmd.plan_view_id] = pv_el.model_copy(update=update)

        case UpdatePlanViewCropCmd():
            pv_el = els.get(cmd.plan_view_id)
            if not isinstance(pv_el, PlanViewElem):
                raise ValueError("updatePlanViewCrop.planViewId must reference plan_view")
            els[cmd.plan_view_id] = pv_el.model_copy(
                update={
                    "crop_min_mm": cmd.crop_min_mm,
                    "crop_max_mm": cmd.crop_max_mm,
                }
            )

        case UpdatePlanViewRangeCmd():
            pv_el = els.get(cmd.plan_view_id)
            if not isinstance(pv_el, PlanViewElem):
                raise ValueError("updatePlanViewRange.planViewId must reference plan_view")
            els[cmd.plan_view_id] = pv_el.model_copy(
                update={
                    "view_range_bottom_mm": cmd.view_range_bottom_mm,
                    "view_range_top_mm": cmd.view_range_top_mm,
                }
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
            pres = (
                cmd.plan_presentation
                if cmd.plan_presentation
                in {
                    "default",
                    "opening_focus",
                    "room_scheme",
                }
                else "default"
            )
            pdl_override = _optional_plan_detail_override(cmd.plan_detail_level)
            pfo_override = _optional_room_fill_scale(cmd.plan_room_fill_opacity_scale)
            prior_pv = els.get(pvid) if isinstance(els.get(pvid), PlanViewElem) else None
            open_style = cmd.plan_opening_tag_style_id
            if prior_pv is not None and "plan_opening_tag_style_id" not in cmd.model_fields_set:
                open_style = prior_pv.plan_opening_tag_style_id
            if open_style is not None:
                _validate_plan_tag_style_ref(els, open_style, "opening")
            room_style = cmd.plan_room_tag_style_id
            if prior_pv is not None and "plan_room_tag_style_id" not in cmd.model_fields_set:
                room_style = prior_pv.plan_room_tag_style_id
            if room_style is not None:
                _validate_plan_tag_style_ref(els, room_style, "room")
            pcg_pv: list[PlanCategoryGraphicRow] = []
            if "plan_category_graphics" in cmd.model_fields_set:
                pcg_pv = normalize_plan_category_graphics_rows(cmd.plan_category_graphics or [])
            elif prior_pv is not None:
                pcg_pv = list(prior_pv.plan_category_graphics)
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
                plan_opening_tag_style_id=open_style,
                plan_room_tag_style_id=room_style,
                plan_category_graphics=pcg_pv,
            )

        case UpsertPlanTagStyleCmd():
            sid = cmd.id or new_id()
            prior = els.get(sid)
            if prior is not None and not isinstance(prior, PlanTagStyleElem):
                raise ValueError(
                    "upsertPlanTagStyle.id must reference plan_tag_style when element exists"
                )
            tt = cmd.tag_target
            if tt not in ("opening", "room"):
                raise ValueError("upsertPlanTagStyle.tagTarget must be opening|room")
            lf = _normalize_plan_tag_label_fields(tt, list(cmd.label_fields or []))
            els[sid] = PlanTagStyleElem(
                kind="plan_tag_style",
                id=sid,
                name=cmd.name,
                tag_target=tt,
                label_fields=lf,
                text_size_pt=float(cmd.text_size_pt),
                leader_visible=bool(cmd.leader_visible),
                badge_style=cmd.badge_style,
                color_token=str(cmd.color_token or "default"),
                sort_key=int(cmd.sort_key),
            )

        case CreateCalloutCmd():
            cid = cmd.id or new_id()
            if cid in els:
                raise ValueError(f"duplicate element id '{cid}'")
            if cmd.parent_sheet_id not in els or not isinstance(
                els[cmd.parent_sheet_id], SheetElem
            ):
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
            pv = cmd.plan_view_id
            if pv is not None:
                pvel = els.get(pv)
                if not isinstance(pvel, PlanViewElem):
                    raise ValueError("createBcfTopic.planViewId must reference plan_view")
            sc = cmd.section_cut_id
            if sc is not None:
                scel = els.get(sc)
                if not isinstance(scel, SectionCutElem):
                    raise ValueError("createBcfTopic.sectionCutId must reference section_cut")
            refs_sorted = sorted(
                cmd.evidence_refs,
                key=lambda r: (
                    r.kind,
                    r.sheet_id or "",
                    r.viewpoint_id or "",
                    r.plan_view_id or "",
                    r.section_cut_id or "",
                    r.png_basename or "",
                ),
            )
            els[bid] = BcfElem(
                kind="bcf",
                id=bid,
                title=cmd.title,
                viewpoint_ref=cmd.viewpoint_ref,
                element_ids=sorted(cmd.element_ids),
                plan_view_id=pv,
                section_cut_id=sc,
                evidence_refs=refs_sorted,
            )

        case CreateAgentAssumptionCmd():
            aid = cmd.id or new_id()
            if aid in els:
                raise ValueError(f"duplicate element id '{aid}'")
            els[aid] = AgentAssumptionElem(
                kind="agent_assumption",
                id=aid,
                statement=cmd.statement,
                source=cmd.source,
                closure_status=cmd.closure_status,
                related_element_ids=sorted(cmd.related_element_ids),
                related_topic_id=cmd.related_topic_id,
            )

        case CreateAgentDeviationCmd():
            did = cmd.id or new_id()
            if did in els:
                raise ValueError(f"duplicate element id '{did}'")
            els[did] = AgentDeviationElem(
                kind="agent_deviation",
                id=did,
                statement=cmd.statement,
                severity=cmd.severity,
                acknowledged=cmd.acknowledged,
                related_assumption_id=cmd.related_assumption_id,
                related_element_ids=sorted(cmd.related_element_ids),
            )

        case UpsertSiteCmd():
            sid = cmd.id
            prev_el = els.get(sid)
            if prev_el is not None and not isinstance(prev_el, SiteElem):
                raise ValueError("upsertSite.id must reference site when element exists")
            lid = cmd.reference_level_id
            if lid not in els or not isinstance(els[lid], LevelElem):
                raise ValueError("upsertSite.referenceLevelId must reference an existing Level")
            if cmd.pad_thickness_mm <= 0:
                raise ValueError("upsertSite.padThicknessMm must be > 0")
            boundary = _canonical_site_boundary_mm(list(cmd.boundary_mm))
            ctx = _canonical_site_context_rows(list(cmd.context_objects))
            us = cmd.uniform_setback_mm
            if us is not None and float(us) < 0:
                raise ValueError("upsertSite.uniformSetbackMm must be ≥ 0 when set")
            north = cmd.north_deg_cw_from_plan_x
            els[sid] = SiteElem(
                kind="site",
                id=sid,
                name=cmd.name,
                reference_level_id=lid,
                boundary_mm=boundary,
                pad_thickness_mm=float(cmd.pad_thickness_mm),
                base_offset_mm=float(cmd.base_offset_mm),
                north_deg_cw_from_plan_x=float(north) if north is not None else None,
                uniform_setback_mm=float(us) if us is not None else None,
                context_objects=ctx,
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


REPLAY_DIAGNOSTICS_BUDGET_MS_LOCAL = 350
REPLAY_DIAGNOSTICS_BUDGET_MS_CI = 1000
REPLAY_LARGE_BUNDLE_WARN_COMMAND_COUNT = 5000

AGENT_LARGE_BUNDLE_ADVISORY_TEXT_V1 = (
    "Large command bundles raise validation latency; sanity-check merges of agent-authored payloads "
    "before pushing to shared revisions."
)


def replay_performance_budget_v1(
    *,
    command_count: int,
    hist_counter: Counter[str],
    first_blocking_command_index: int | None = None,
) -> dict[str, Any]:
    """Deterministic scan summary aligned with diagnostics perf ceilings (WP-P01 / WP-X01); no wall-clock fields."""

    histogram = [
        {"commandType": ctype, "count": cnt}
        for ctype, cnt in sorted(hist_counter.items(), key=lambda x: x[0])
    ]
    distinct = len(hist_counter)
    large_warn = command_count >= REPLAY_LARGE_BUNDLE_WARN_COMMAND_COUNT
    warnings = ["large_command_bundle"] if large_warn else []

    out: dict[str, Any] = {
        "format": "replayPerformanceBudget_v1",
        "commandCount": command_count,
        "commandTypeHistogram": histogram,
        "distinctCommandTypeCount": distinct,
        "declaredDiagnosticsBudgetMsLocal": REPLAY_DIAGNOSTICS_BUDGET_MS_LOCAL,
        "declaredDiagnosticsBudgetMsCi": REPLAY_DIAGNOSTICS_BUDGET_MS_CI,
        "largeBundleWarningThreshold": REPLAY_LARGE_BUNDLE_WARN_COMMAND_COUNT,
        "largeBundleWarn": large_warn,
        "warningCodes": warnings,
        "agentBundleAdvisory": AGENT_LARGE_BUNDLE_ADVISORY_TEXT_V1 if large_warn else "",
    }
    if first_blocking_command_index is not None:
        out["firstBlockingCommandIndex"] = first_blocking_command_index
    return out


def bundle_replay_diagnostics(cmds_raw: list[dict[str, Any]]) -> dict[str, Any]:
    """Stable ordering metadata for collaboration + replay surfaces (WP-X01 / WP-P02)."""

    types_in_order: list[str] = []
    hist_counter: Counter[str] = Counter()
    for c in cmds_raw:
        if not isinstance(c, dict):
            types_in_order.append("?")
            hist_counter["?"] += 1
            continue
        t = c.get("type")
        label = str(t) if t is not None else "?"
        types_in_order.append(label)
        hist_counter[label] += 1

    cc = len(cmds_raw)
    return {
        "commandCount": cc,
        "commandTypesInOrder": types_in_order,
        "replayPerformanceBudget_v1": replay_performance_budget_v1(
            command_count=cc,
            hist_counter=hist_counter,
            first_blocking_command_index=None,
        ),
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


def blocking_violation_rule_ids_at_prefix(
    doc: Document, cmds: list[Command], idx: int
) -> list[str]:
    """Sorted unique rule ids from blocking/error violations after cmds[0..idx] inclusive."""

    cand = clone_document(doc)
    for i in range(idx + 1):
        apply_inplace(cand, cmds[i])
    violations = evaluate(cand.elements)
    blocking = [v for v in violations if v.blocking or v.severity == "error"]
    return sorted({v.rule_id for v in blocking})


def blocking_violation_element_ids_at_prefix(
    doc: Document, cmds: list[Command], idx: int
) -> list[str]:
    """Sorted unique element ids from blocking/error violations after cmds[0..idx] inclusive."""

    cand = clone_document(doc)
    for i in range(idx + 1):
        apply_inplace(cand, cmds[i])
    violations = evaluate(cand.elements)
    blocking = [v for v in violations if v.blocking or v.severity == "error"]
    ids: set[str] = set()
    for v in blocking:
        ids.update(v.element_ids)
    return sorted(ids)


def _authoritative_replay_v0_declared_id(cmd: dict[str, Any]) -> str | None:
    cid = cmd.get("id")
    if isinstance(cid, str) and cid.strip():
        return cid.strip()
    return None


class AuthoritativePreflightFailure(NamedTuple):
    """First-step structured failure from authoritative replay merge preflight."""

    first_conflicting_step_index: int
    reason_code: str
    conflicting_declared_ids: tuple[str, ...]
    conflicting_existing_element_ids: tuple[str, ...]
    missing_reference_hints: tuple[dict[str, Any], ...]


def _sorted_missing_reference_hints(hints: list[dict[str, Any]]) -> tuple[dict[str, Any], ...]:
    def sort_key(h: dict[str, Any]) -> tuple[int, str, str]:
        si = h.get("stepIndex")
        step = int(si) if isinstance(si, int) and si >= 0 else -1
        rk = str(h.get("referenceKey", ""))
        rid = str(h.get("referenceId", ""))
        return step, rk, rid

    return tuple(sorted(hints, key=sort_key))


def authoritative_replay_v0_preflight_detail(
    doc: Document, cmds_raw: list[dict[str, Any]]
) -> AuthoritativePreflightFailure | None:
    """Walk authoritative replay commands in order; return first merge failure with ids/refs."""

    declared: set[str] = set()
    known_levels: set[str] = {eid for eid, el in doc.elements.items() if isinstance(el, LevelElem)}
    known_floors: set[str] = {eid for eid, el in doc.elements.items() if isinstance(el, FloorElem)}
    known_walls: set[str] = {eid for eid, el in doc.elements.items() if isinstance(el, WallElem)}

    for i, cmd in enumerate(cmds_raw):
        t = cmd.get("type")
        if t == "createLevel":
            pid = cmd.get("parentLevelId")
            if isinstance(pid, str) and pid.strip():
                ps = pid.strip()
                if ps not in known_levels:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": "parentLevelId", "referenceId": ps}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)
                known_levels.add(eid)

        elif t == "createFloor":
            lid = cmd.get("levelId")
            if not isinstance(lid, str) or not lid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ""}]
                    ),
                )
            ls = lid.strip()
            if ls not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ls}]
                    ),
                )
            ftid_raw = cmd.get("floorTypeId")
            if isinstance(ftid_raw, str) and ftid_raw.strip():
                fts = ftid_raw.strip()
                ft_el = doc.elements.get(fts)
                if not isinstance(ft_el, FloorTypeElem):
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": "floorTypeId", "referenceId": fts}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)
                known_floors.add(eid)

        elif t == "createWall":
            lid = cmd.get("levelId")
            if not isinstance(lid, str) or not lid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ""}]
                    ),
                )
            ls = lid.strip()
            if ls not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ls}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)
                known_walls.add(eid)

        elif t == "createRoof":
            rlid = cmd.get("referenceLevelId")
            if not isinstance(rlid, str) or not rlid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "referenceLevelId", "referenceId": ""}]
                    ),
                )
            rs = rlid.strip()
            if rs not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "referenceLevelId", "referenceId": rs}]
                    ),
                )
            rtid_raw = cmd.get("roofTypeId")
            if isinstance(rtid_raw, str) and rtid_raw.strip():
                rts = rtid_raw.strip()
                rt_el = doc.elements.get(rts)
                if not isinstance(rt_el, RoofTypeElem):
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": "roofTypeId", "referenceId": rts}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t == "createRoomOutline":
            lid = cmd.get("levelId")
            if not isinstance(lid, str) or not lid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ""}]
                    ),
                )
            ls = lid.strip()
            if ls not in known_levels:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "levelId", "referenceId": ls}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t == "createSlabOpening":
            hid = cmd.get("hostFloorId")
            if not isinstance(hid, str) or not hid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "hostFloorId", "referenceId": ""}]
                    ),
                )
            hs = hid.strip()
            if hs not in known_floors:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "hostFloorId", "referenceId": hs}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t == "createStair":
            for lid_key in ("baseLevelId", "topLevelId"):
                lid = cmd.get(lid_key)
                if not isinstance(lid, str) or not lid.strip():
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": lid_key, "referenceId": ""}]
                        ),
                    )
                ls = lid.strip()
                if ls not in known_levels:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_reference_unresolved",
                        (),
                        (),
                        _sorted_missing_reference_hints(
                            [{"stepIndex": i, "referenceKey": lid_key, "referenceId": ls}]
                        ),
                    )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        elif t in {"insertDoorOnWall", "insertWindowOnWall"}:
            wid = cmd.get("wallId")
            if not isinstance(wid, str) or not wid.strip():
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "wallId", "referenceId": ""}]
                    ),
                )
            ws = wid.strip()
            if ws not in known_walls:
                return AuthoritativePreflightFailure(
                    i,
                    "merge_reference_unresolved",
                    (),
                    (),
                    _sorted_missing_reference_hints(
                        [{"stepIndex": i, "referenceKey": "wallId", "referenceId": ws}]
                    ),
                )
            eid = _authoritative_replay_v0_declared_id(cmd)
            if eid is not None:
                if eid in doc.elements:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (eid,),
                        (),
                    )
                if eid in declared:
                    return AuthoritativePreflightFailure(
                        i,
                        "merge_id_collision",
                        (eid,),
                        (),
                        (),
                    )
                declared.add(eid)

        else:
            return AuthoritativePreflightFailure(
                i,
                "invalid_command",
                (),
                (),
                (),
            )

    return None


def _authoritative_replay_v0_preflight(doc: Document, cmds_raw: list[dict[str, Any]]) -> str | None:
    """Return a failure outcome code before ``try_commit_bundle``, or ``None`` if safe to attempt."""

    detail = authoritative_replay_v0_preflight_detail(doc, cmds_raw)
    return detail.reason_code if detail is not None else None


def bundle_commands_are_authoritative_replay_v0_only(cmds_raw: list[dict[str, Any]]) -> bool:
    """True when every command dict uses only authoritativeReplay_v0 command types."""

    for cmd in cmds_raw:
        if not isinstance(cmd, dict):
            return False
        t = cmd.get("type")
        if not isinstance(t, str) or t not in _AUTHORITATIVE_REPLAY_V0_TYPES:
            return False
    return True


def _canonicalize_json_for_digest(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _canonicalize_json_for_digest(obj[k]) for k in sorted(obj)}
    if isinstance(obj, list):
        canon = [_canonicalize_json_for_digest(x) for x in obj]
        canon.sort(key=lambda x: json.dumps(x, sort_keys=True, separators=(",", ":")))
        return canon
    return obj


def _merge_preflight_guidance(reason_code: str) -> tuple[str, str, str]:
    rc = reason_code
    if rc == "ok":
        return (
            "safe_retry_unchanged",
            "No merge blocking detected for this bundle snapshot.",
            "Proceed with apply when operational gates pass.",
        )
    if rc == "merge_reference_unresolved":
        return (
            "safe_after_dependency_refresh",
            "Refresh level/host/type references in the source model or IFC sketch, then replay.",
            "Regenerate authoritative replay commands after resolving reference ids against the target document.",
        )
    if rc == "merge_id_collision":
        return (
            "requires_manual_resolution",
            "Rename declared element ids in the bundle or remove conflicting elements on the server before merge.",
            "Emit replacement commands with non-colliding ids mapped to the target document.",
        )
    if rc == "invalid_command":
        return (
            "requires_agent_replacement_bundle",
            "Inspect bundle command schema and types; remove unsupported commands from authoritative replay.",
            "Replace bundle with a schema-valid authoritativeReplay_v0 command list.",
        )
    if rc == "constraint_error":
        return (
            "requires_manual_resolution",
            "Resolve blocking constraints at the indicated step (geometry, levels, hosts) before replay.",
            "Trim or rewrite commands after the blocking prefix using Advisor violations.",
        )
    return (
        "requires_agent_replacement_bundle",
        "Fix sketch availability and schema version before replay.",
        "Provide a valid authoritativeReplay_v0 sketch payload.",
    )


def command_bundle_merge_preflight_v1(
    *,
    doc: Document,
    cmds_raw: list[dict[str, Any]],
    authoritative_failure: AuthoritativePreflightFailure | None,
    outcome_code: str,
    violations: list[Violation],
    replay_diag: dict[str, Any],
) -> dict[str, Any]:
    """Stable merge preflight evidence object for bundle 409 / dry-run (camelCase JSON)."""

    _ = violations

    first_idx: int | None
    decl_ids: list[str]
    exist_ids: list[str]
    missing: list[dict[str, Any]]

    if authoritative_failure is not None:
        reason_code = authoritative_failure.reason_code
        first_idx = authoritative_failure.first_conflicting_step_index
        decl_ids = sorted(authoritative_failure.conflicting_declared_ids)
        exist_ids = sorted(authoritative_failure.conflicting_existing_element_ids)
        missing = list(authoritative_failure.missing_reference_hints)
    elif outcome_code == "constraint_error":
        reason_code = "constraint_error"
        idx_raw = replay_diag.get("firstBlockingCommandIndex")
        cmds_coerced: list[Command] | None = None
        if isinstance(idx_raw, int) and idx_raw >= 0:
            first_idx = idx_raw
        else:
            try:
                cmds_coerced = [coerce_command(c) for c in cmds_raw]
            except Exception:
                cmds_coerced = []
            first_idx = (
                first_blocking_command_index_after_prefixes(doc, cmds_coerced)
                if cmds_coerced
                else None
            )
        decl_ids = []
        cmds_for_elems = cmds_coerced
        if cmds_for_elems is None:
            try:
                cmds_for_elems = [coerce_command(c) for c in cmds_raw]
            except Exception:
                cmds_for_elems = []
        exist_ids = (
            blocking_violation_element_ids_at_prefix(doc, cmds_for_elems, first_idx)
            if first_idx is not None and cmds_for_elems
            else []
        )
        missing = []
    elif outcome_code == "ok":
        reason_code = "ok"
        first_idx = None
        decl_ids = []
        exist_ids = []
        missing = []
    else:
        reason_code = outcome_code
        first_idx = None
        decl_ids = []
        exist_ids = []
        missing = []

    cls, manual, agent_act = _merge_preflight_guidance(reason_code)

    core: dict[str, Any] = {
        "format": "commandBundleMergePreflight_v1",
        "reasonCode": reason_code,
        "conflictingDeclaredIds": decl_ids,
        "conflictingExistingElementIds": exist_ids,
        "missingReferenceHints": _canonicalize_json_for_digest(missing),
        "safeRetryClassification": cls,
        "suggestedManualAction": manual,
        "suggestedAgentAction": agent_act,
    }
    if first_idx is not None:
        core["firstConflictingStepIndex"] = first_idx
    elif reason_code == "ok":
        core["firstConflictingStepIndex"] = None

    blob = json.dumps(_canonicalize_json_for_digest(core), sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(blob.encode()).hexdigest()
    return {**core, "evidenceDigestSha256": digest}


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
        rule_ids = blocking_violation_rule_ids_at_prefix(doc, cmds, idx)
        budget_raw = base.get("replayPerformanceBudget_v1")
        budget_merged = (
            {**budget_raw, "firstBlockingCommandIndex": idx}
            if isinstance(budget_raw, dict)
            else budget_raw
        )
        return {
            **base,
            "firstBlockingCommandIndex": idx,
            "blockingViolationRuleIds": rule_ids,
            "replayPerformanceBudget_v1": budget_merged,
        }
    return base


def try_apply_kernel_ifc_authoritative_replay_v0(
    doc: Document,
    sketch: dict[str, Any],
) -> tuple[bool, Document | None, list[dict[str, Any]], list[Violation], str]:
    """Apply ``authoritativeReplay_v0`` commands via ``try_commit_bundle`` (additive merge).

    OpenBIM slice: ``createLevel`` / ``createFloor`` / ``createWall`` / ``createRoof`` / ``createStair`` /
    ``createRoomOutline`` / ``insertDoorOnWall`` / ``insertWindowOnWall`` /
    ``createSlabOpening`` payloads from
    ``build_kernel_ifc_authoritative_replay_sketch_v0``. Runs preflight for id collisions and
    unresolved references vs the current document plus preceding commands in the bundle. Returns raw
    command dicts that were validated (third tuple element).
    """

    if sketch.get("available") is not True:
        return False, None, [], [], "sketch_unavailable"

    if sketch.get("replayKind") != AUTHORITATIVE_REPLAY_KIND_V0:
        return False, None, [], [], "invalid_sketch"

    try:
        ver = int(sketch["schemaVersion"])
    except (KeyError, TypeError, ValueError):
        return False, None, [], [], "invalid_sketch"
    if ver != KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION:
        return False, None, [], [], "invalid_sketch"

    raw_cmds = sketch.get("commands")
    if not isinstance(raw_cmds, list):
        return False, None, [], [], "invalid_command"

    cmds_raw: list[dict[str, Any]] = []
    for item in raw_cmds:
        if not isinstance(item, dict):
            return False, None, [], [], "invalid_command"
        t = item.get("type")
        if not isinstance(t, str) or t not in _AUTHORITATIVE_REPLAY_V0_TYPES:
            return False, None, [], [], "invalid_command"
        cmds_raw.append(item)

    pre = _authoritative_replay_v0_preflight(doc, cmds_raw)
    if pre is not None:
        return False, None, cmds_raw, [], pre

    ok, new_doc, _cmds, violations, code = try_commit_bundle(doc, cmds_raw)
    if not ok:
        return False, None, cmds_raw, violations, code
    return True, new_doc, cmds_raw, violations, code


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
