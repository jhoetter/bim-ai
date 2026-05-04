from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import CameraMm, Vec2Mm, WallTypeLayer


class CreateLevelCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createLevel"] = "createLevel"
    id: str | None = None
    name: str = "Level"
    elevation_mm: float = Field(alias="elevationMm", default=0)
    datum_kind: str | None = Field(default=None, alias="datumKind")
    parent_level_id: str | None = Field(default=None, alias="parentLevelId")
    offset_from_parent_mm: float = Field(default=0, alias="offsetFromParentMm")


class CreateWallCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createWall"] = "createWall"
    id: str | None = None
    name: str = "Wall"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    base_constraint_level_id: str | None = Field(default=None, alias="baseConstraintLevelId")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")
    insulation_extension_mm: float = Field(default=0, alias="insulationExtensionMm")

class MoveWallDeltaCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveWallDelta"] = "moveWallDelta"
    wall_id: str = Field(alias="wallId")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")


class MoveWallEndpointsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveWallEndpoints"] = "moveWallEndpoints"
    wall_id: str = Field(alias="wallId")
    start: Vec2Mm
    end: Vec2Mm


class InsertDoorOnWallCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["insertDoorOnWall"] = "insertDoorOnWall"
    id: str | None = None
    name: str = "Door"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=900)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")


class InsertWindowOnWallCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["insertWindowOnWall"] = "insertWindowOnWall"
    id: str | None = None
    name: str = "Window"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=1200)
    sill_height_mm: float = Field(alias="sillHeightMm", default=900)
    height_mm: float = Field(alias="heightMm", default=1500)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")

class WallChainSegment(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str | None = None
    start: Vec2Mm
    end: Vec2Mm
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)


class CreateWallChainCmd(BaseModel):
    """Atomically creates multiple contiguous wall segments."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createWallChain"] = "createWallChain"
    level_id: str = Field(alias="levelId")
    name_prefix: str = Field(alias="namePrefix", default="Wall")
    segments: list[WallChainSegment] = Field(default_factory=list)


class CreateGridLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createGridLine"] = "createGridLine"
    id: str | None = None
    name: str = "Grid"
    start: Vec2Mm
    end: Vec2Mm
    label: str = ""
    level_id: str | None = Field(default=None, alias="levelId")


class MoveGridLineEndpointsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveGridLineEndpoints"] = "moveGridLineEndpoints"
    grid_line_id: str = Field(alias="gridLineId")
    start: Vec2Mm
    end: Vec2Mm


class CreateDimensionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDimension"] = "createDimension"
    id: str | None = None
    name: str = "Dimension"
    level_id: str = Field(alias="levelId")
    a_mm: Vec2Mm = Field(alias="aMm")
    b_mm: Vec2Mm = Field(alias="bMm")
    offset_mm: Vec2Mm = Field(alias="offsetMm")
    ref_element_id_a: str | None = Field(default=None, alias="refElementIdA")
    ref_element_id_b: str | None = Field(default=None, alias="refElementIdB")
    tag_definition_id: str | None = Field(default=None, alias="tagDefinitionId")

class DeleteElementCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteElement"] = "deleteElement"
    element_id: str = Field(alias="elementId")


class RestoreElementCmd(BaseModel):
    """Replays a persisted element snapshot (primarily undo / internal)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["restoreElement"] = "restoreElement"
    element: dict


class CreateRoomOutlineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomOutline"] = "createRoomOutline"
    id: str | None = None
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")


class CreateRoomRectangleCmd(BaseModel):
    """Axis-aligned rectangle: four perimeter walls plus room outline (single undo unit)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomRectangle"] = "createRoomRectangle"
    id: str | None = Field(default=None, alias="roomId")
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    origin: Vec2Mm
    width_mm: float = Field(alias="widthMm")
    depth_mm: float = Field(alias="depthMm")
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_name_prefix: str = Field(alias="wallNamePrefix", default="Wall")


class CreateRoomPolyCmd(BaseModel):
    """Closed polygon from vertices → perimeter walls + room (single undo unit)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomPoly"] = "createRoomPoly"
    id: str | None = Field(default=None, alias="roomId")
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    vertices_mm: list[Vec2Mm] = Field(alias="verticesMm")
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_name_prefix: str = Field(alias="wallNamePrefix", default="Wall")


class DeleteElementsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteElements"] = "deleteElements"
    element_ids: list[str] = Field(alias="elementIds")


class MoveLevelElevationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveLevelElevation"] = "moveLevelElevation"
    level_id: str = Field(alias="levelId")
    elevation_mm: float = Field(alias="elevationMm")


class CreateIssueFromViolationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createIssueFromViolation"] = "createIssueFromViolation"
    title: str
    violation_rule_id: str = Field(alias="violationRuleId")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    viewpoint_id: str | None = Field(default=None, alias="viewpointId")


class UpdateElementPropertyCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateElementProperty"] = "updateElementProperty"
    element_id: str = Field(alias="elementId")
    key: str
    value: str


class SaveViewpointCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["saveViewpoint"] = "saveViewpoint"
    id: str | None = None
    name: str = "Viewpoint"
    camera: CameraMm
    mode: Literal["plan_2d", "orbit_3d", "plan_canvas"] = "orbit_3d"


class UpsertProjectSettingsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertProjectSettings"] = "upsertProjectSettings"
    id: str = "bim-project-settings"
    length_unit: str = Field(alias="lengthUnit", default="millimeter")
    angular_unit_deg: str = Field(alias="angularUnitDeg", default="degree")
    display_locale: str = Field(alias="displayLocale", default="en-US")


class CreateWallTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createWallType"] = "createWallType"
    id: str | None = None
    name: str = "Wall type"
    layers: list[WallTypeLayer] = Field(default_factory=list)
    basis_line: str = Field(alias="basisLine", default="center")


class AssignWallDatumConstraintsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["assignWallDatumConstraints"] = "assignWallDatumConstraints"
    wall_id: str = Field(alias="wallId")
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    base_constraint_level_id: str | None = Field(default=None, alias="baseConstraintLevelId")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")


class CreateFloorCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createFloor"] = "createFloor"
    id: str | None = None
    name: str = "Floor"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    thickness_mm: float = Field(alias="thicknessMm", default=220)
    structure_thickness_mm: float = Field(alias="structureThicknessMm", default=140)
    finish_thickness_mm: float = Field(alias="finishThicknessMm", default=0)
    room_bounded: bool = Field(default=False, alias="roomBounded")


class CreateRoofCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoof"] = "createRoof"
    id: str | None = None
    name: str = "Roof"
    reference_level_id: str = Field(alias="referenceLevelId")
    footprint_mm: list[Vec2Mm] = Field(alias="footprintMm")
    overhang_mm: float = Field(alias="overhangMm", default=400)
    slope_deg: float | None = Field(default=25, alias="slopeDeg")


class ExtendFloorInsulationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["extendFloorInsulation"] = "extendFloorInsulation"
    floor_id: str = Field(alias="floorId")
    insulation_extension_mm: float = Field(alias="insulationExtensionMm")


class AttachWallTopToRoofCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["attachWallTopToRoof"] = "attachWallTopToRoof"
    wall_id: str = Field(alias="wallId")
    roof_id: str = Field(alias="roofId")


class CreateStairCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createStair"] = "createStair"
    id: str | None = None
    name: str = "Stair"
    base_level_id: str = Field(alias="baseLevelId")
    top_level_id: str = Field(alias="topLevelId")
    run_start_mm: Vec2Mm = Field(alias="runStartMm")
    run_end_mm: Vec2Mm = Field(alias="runEndMm")
    width_mm: float = Field(alias="widthMm", default=1000)
    riser_mm: float = Field(alias="riserMm", default=175)
    tread_mm: float = Field(alias="treadMm", default=275)


class CreateSlabOpeningCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSlabOpening"] = "createSlabOpening"
    id: str | None = None
    name: str = "Opening"
    host_floor_id: str = Field(alias="hostFloorId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    is_shaft: bool = Field(default=False, alias="isShaft")


class CreateRailingCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRailing"] = "createRailing"
    id: str | None = None
    name: str = "Railing"
    hosted_stair_id: str | None = Field(default=None, alias="hostedStairId")
    path_mm: list[Vec2Mm] = Field(alias="pathMm")


class UpsertFamilyTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertFamilyType"] = "upsertFamilyType"
    id: str | None = None
    discipline: Literal["door", "window", "generic"] = "generic"
    parameters: dict[str, Any] = Field(default_factory=dict)


class AssignOpeningFamilyCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["assignOpeningFamily"] = "assignOpeningFamily"
    opening_id: str = Field(alias="openingId")
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    cut_depth_mm: float | None = Field(default=None, alias="cutDepthMm")
    reveal_interior_mm: float | None = Field(default=None, alias="revealInteriorMm")


class UpdateOpeningCleanroomCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateOpeningCleanroom"] = "updateOpeningCleanroom"
    opening_id: str = Field(alias="openingId")
    interlock_grade: str | None = Field(default=None, alias="interlockGrade")
    seal_rebate_mm: float | None = Field(default=None, alias="sealRebateMm")
    lod_plan: str | None = Field(default=None, alias="lodPlan")


class CreateRoomSeparationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomSeparation"] = "createRoomSeparation"
    id: str | None = None
    name: str = "Separation"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm


class CreatePlanRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPlanRegion"] = "createPlanRegion"
    id: str | None = None
    name: str = "Region"
    level_id: str = Field(alias="levelId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")
    cut_plane_offset_mm: float = Field(alias="cutPlaneOffsetMm", default=-500)


class UpsertTagDefinitionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertTagDefinition"] = "upsertTagDefinition"
    id: str | None = None
    name: str = "Tag"
    tag_kind: str = Field(alias="tagKind", default="custom")
    discipline: str = Field(default="architecture")


class CreateJoinGeometryCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createJoinGeometry"] = "createJoinGeometry"
    id: str | None = None
    joined_element_ids: list[str] = Field(alias="joinedElementIds")
    notes: str = ""


class CreateSectionCutCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSectionCut"] = "createSectionCut"
    id: str | None = None
    name: str = "Section"
    line_start_mm: Vec2Mm = Field(alias="lineStartMm")
    line_end_mm: Vec2Mm = Field(alias="lineEndMm")
    crop_depth_mm: float = Field(alias="cropDepthMm", default=8500)


class UpsertViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertViewTemplate"] = "upsertViewTemplate"
    id: str | None = None
    name: str = "Template"
    scale: str = Field(alias="scale", default="scale_100")
    disciplines_visible: list[str] = Field(default_factory=list, alias="disciplinesVisible")
    hidden_categories: list[str] = Field(default_factory=list, alias="hiddenCategories")


class UpsertSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSheet"] = "upsertSheet"
    id: str | None = None
    name: str = "Sheet"
    title_block: str | None = Field(default=None, alias="titleBlock")


class UpsertSheetViewportsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSheetViewports"] = "upsertSheetViewports"
    sheet_id: str = Field(alias="sheetId")
    viewports_mm: list[dict[str, Any]] = Field(alias="viewportsMm", default_factory=list)


class UpsertScheduleCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSchedule"] = "upsertSchedule"
    id: str | None = None
    name: str = "Schedule"
    sheet_id: str | None = Field(default=None, alias="sheetId")


class UpsertScheduleFiltersCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertScheduleFilters"] = "upsertScheduleFilters"
    schedule_id: str = Field(alias="scheduleId")
    filters: dict[str, Any]


class UpsertRoomVolumeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertRoomVolume"] = "upsertRoomVolume"
    room_id: str = Field(alias="roomId")
    upper_limit_level_id: str | None = Field(default=None, alias="upperLimitLevelId")
    volume_ceiling_offset_mm: float | None = Field(default=None, alias="volumeCeilingOffsetMm")


class UpsertPlanViewCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertPlanView"] = "upsertPlanView"
    id: str | None = None
    name: str = "Plan view"
    level_id: str = Field(alias="levelId")
    view_template_id: str | None = Field(default=None, alias="viewTemplateId")
    plan_presentation: Literal["default", "opening_focus", "room_scheme"] = Field(
        default="default",
        alias="planPresentation",
    )
    underlay_level_id: str | None = Field(default=None, alias="underlayLevelId")
    discipline: str = "architecture"
    phase_id: str | None = Field(default=None, alias="phaseId")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")
    cut_plane_offset_mm: float | None = Field(default=None, alias="cutPlaneOffsetMm")
    categories_hidden: list[str] = Field(default_factory=list, alias="categoriesHidden")


class CreateCalloutCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createCallout"] = "createCallout"
    id: str | None = None
    name: str = "Callout"
    parent_sheet_id: str = Field(alias="parentSheetId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")


class CreateBcfTopicCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createBcfTopic"] = "createBcfTopic"
    id: str | None = None
    title: str
    viewpoint_ref: str | None = Field(default=None, alias="viewpointRef")


class UpsertValidationRuleCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertValidationRule"] = "upsertValidationRule"
    id: str | None = None
    name: str = "IDS"
    rule_json: dict[str, Any] = Field(alias="ruleJson", default_factory=dict)


Command = Annotated[
    CreateLevelCmd
    | CreateWallCmd
    | MoveWallDeltaCmd
    | MoveWallEndpointsCmd
    | InsertDoorOnWallCmd
    | InsertWindowOnWallCmd
    | CreateWallChainCmd
    | CreateGridLineCmd
    | MoveGridLineEndpointsCmd
    | CreateDimensionCmd
    | DeleteElementCmd
    | DeleteElementsCmd
    | RestoreElementCmd
    | CreateRoomOutlineCmd
    | CreateRoomRectangleCmd
    | CreateRoomPolyCmd
    | MoveLevelElevationCmd
    | CreateIssueFromViolationCmd
    | UpdateElementPropertyCmd
    | SaveViewpointCmd
    | UpsertProjectSettingsCmd
    | CreateWallTypeCmd
    | AssignWallDatumConstraintsCmd
    | CreateFloorCmd
    | CreateRoofCmd
    | ExtendFloorInsulationCmd
    | AttachWallTopToRoofCmd
    | CreateStairCmd
    | CreateSlabOpeningCmd
    | CreateRailingCmd
    | UpsertFamilyTypeCmd
    | AssignOpeningFamilyCmd
    | UpdateOpeningCleanroomCmd
    | CreateRoomSeparationCmd
    | CreatePlanRegionCmd
    | UpsertTagDefinitionCmd
    | CreateJoinGeometryCmd
    | CreateSectionCutCmd
    | UpsertViewTemplateCmd
    | UpsertSheetCmd
    | UpsertSheetViewportsCmd
    | UpsertScheduleCmd
    | UpsertScheduleFiltersCmd
    | UpsertRoomVolumeCmd
    | UpsertPlanViewCmd
    | CreateCalloutCmd
    | CreateBcfTopicCmd
    | UpsertValidationRuleCmd,
    Field(discriminator="type"),
]
