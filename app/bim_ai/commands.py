from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import (
    CameraMm,
    ConstraintRefRow,
    ConstraintRule,
    CurtainPanelOverride,
    DormerPositionOnRoof,
    DormerRoofKind,
    DxfLineworkPrim,
    EvidenceRef,
    PlanCategoryGraphicRow,
    PlanTagBadgeStyle,
    PlanTagTarget,
    RoomColorSchemeRow,
    SiteContextObjectRow,
    StairLanding,
    StairRun,
    SweepPathPoint,
    SweepProfilePlane,
    SweepProfilePoint,
    Text3dFontFamily,
    Vec2Mm,
    Vec3Mm,
    WallRecessZone,
    WallTypeLayer,
)
from bim_ai.roof_geometry import RoofGeometryMode


class CreateLevelCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createLevel"] = "createLevel"
    id: str | None = None
    name: str = "Level"
    elevation_mm: float = Field(alias="elevationMm", default=0)
    datum_kind: str | None = Field(default=None, alias="datumKind")
    parent_level_id: str | None = Field(default=None, alias="parentLevelId")
    offset_from_parent_mm: float = Field(default=0, alias="offsetFromParentMm")
    # VIE-05: when True (default), the engine also creates a "<name> — Plan"
    # plan_view referencing the new level so the common flow needs no follow-up.
    also_create_plan_view: bool = Field(default=True, alias="alsoCreatePlanView")
    plan_view_id: str | None = Field(default=None, alias="planViewId")


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
    material_key: str | None = Field(default=None, alias="materialKey")
    is_curtain_wall: bool = Field(default=False, alias="isCurtainWall")


class MoveWallDeltaCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveWallDelta"] = "moveWallDelta"
    wall_id: str = Field(alias="wallId")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


class MoveWallEndpointsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveWallEndpoints"] = "moveWallEndpoints"
    wall_id: str = Field(alias="wallId")
    start: Vec2Mm
    end: Vec2Mm
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


class MoveBeamEndpointsCmd(BaseModel):
    """EDT-01 propagation — beam endpoints move command.

    Beams are not yet seeded into the Python store (see `elements.py` —
    no `BeamElem` defined), so the engine handler today rejects with a
    clear "not implemented" message. The command schema lives here so
    the TS grip provider can emit a stable shape that the engine slice
    can adopt without a TS rebuild.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveBeamEndpoints"] = "moveBeamEndpoints"
    beam_id: str = Field(alias="beamId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


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
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


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
    auto_generated: bool = Field(default=False, alias="autoGenerated")


class PlaceTagCmd(BaseModel):
    """PLN-01 / ANN-01 — view-local placed tag (room/door/window)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["placeTag"] = "placeTag"
    id: str | None = None
    host_element_id: str = Field(alias="hostElementId")
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    tag_definition_id: str | None = Field(default=None, alias="tagDefinitionId")
    text_override: str | None = Field(default=None, alias="textOverride")
    auto_generated: bool = Field(default=False, alias="autoGenerated")


class ClearAutoGeneratedAnnotationsCmd(BaseModel):
    """PLN-01 — remove all auto-generated dimensions and placed_tags hosted
    on the supplied plan_view (or globally when host_view_id is None)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["clearAutoGeneratedAnnotations"] = "clearAutoGeneratedAnnotations"
    host_view_id: str | None = Field(default=None, alias="hostViewId")
    scope: Literal["dimensions", "tags", "both"] = "both"


class CreateDetailLineCmd(BaseModel):
    """ANN-01 — view-local 2D polyline."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDetailLine"] = "createDetailLine"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    points_mm: list[Vec2Mm] = Field(alias="pointsMm")
    stroke_mm: float = Field(default=1.0, alias="strokeMm")
    colour: str = Field(default="#202020")
    style: Literal["solid", "dashed", "dotted"] = Field(default="solid")


class CreateDetailRegionCmd(BaseModel):
    """ANN-01 — view-local 2D filled region."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDetailRegion"] = "createDetailRegion"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    fill_colour: str = Field(default="#cccccc", alias="fillColour")
    fill_pattern: Literal["solid", "hatch_45", "hatch_90", "crosshatch", "dots"] = Field(
        default="solid", alias="fillPattern"
    )
    stroke_mm: float = Field(default=0.5, alias="strokeMm")
    stroke_colour: str = Field(default="#202020", alias="strokeColour")


class CreateTextNoteCmd(BaseModel):
    """ANN-01 — view-local text note."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createTextNote"] = "createTextNote"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    text: str
    font_size_mm: float = Field(alias="fontSizeMm")
    anchor: Literal["tl", "tc", "tr", "cl", "c", "cr", "bl", "bc", "br"] = Field(default="tl")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    colour: str = Field(default="#202020")


class DeleteElementCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteElement"] = "deleteElement"
    element_id: str = Field(alias="elementId")
    # VIE-07: caller may set this to bypass the pinned-element block.
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


class PinElementCmd(BaseModel):
    """VIE-07 — set pinned=True on an element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["pinElement"] = "pinElement"
    element_id: str = Field(alias="elementId")


class UnpinElementCmd(BaseModel):
    """VIE-07 — set pinned=False on an element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["unpinElement"] = "unpinElement"
    element_id: str = Field(alias="elementId")


class CreateElevationViewCmd(BaseModel):
    """VIE-03 — first-class elevation view (N/S/E/W) sibling to section_cut."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createElevationView"] = "createElevationView"
    id: str | None = None
    name: str = "Elevation"
    direction: Literal["north", "south", "east", "west", "custom"] = "north"
    custom_angle_deg: float | None = Field(default=None, alias="customAngleDeg")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    scale: float = 100.0
    plan_detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="planDetailLevel"
    )


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
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")


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
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")


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
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")


class DeleteElementsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteElements"] = "deleteElements"
    element_ids: list[str] = Field(alias="elementIds")


class MoveLevelElevationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveLevelElevation"] = "moveLevelElevation"
    level_id: str = Field(alias="levelId")
    elevation_mm: float = Field(alias="elevationMm")
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


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
    value: str | bool | int | float | None = ""
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


class SaveViewpointCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["saveViewpoint"] = "saveViewpoint"
    id: str | None = None
    name: str = "Viewpoint"
    camera: CameraMm
    mode: Literal["plan_2d", "orbit_3d", "plan_canvas"] = "orbit_3d"
    viewer_clip_cap_elev_mm: float | None = Field(default=None, alias="viewerClipCapElevMm")
    viewer_clip_floor_elev_mm: float | None = Field(default=None, alias="viewerClipFloorElevMm")
    hidden_semantic_kinds_3d: list[str] = Field(default_factory=list, alias="hiddenSemanticKinds3d")
    cutaway_style: Literal["none", "cap", "floor", "box"] | None = Field(
        default=None, alias="cutawayStyle"
    )


class UpsertProjectSettingsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertProjectSettings"] = "upsertProjectSettings"
    id: str = "bim-project-settings"
    length_unit: str = Field(alias="lengthUnit", default="millimeter")
    angular_unit_deg: str = Field(alias="angularUnitDeg", default="degree")
    display_locale: str = Field(alias="displayLocale", default="en-US")


class UpsertRoomColorSchemeCmd(BaseModel):
    """Replace authoritative programme / department scheme colours (singleton replay)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertRoomColorScheme"] = "upsertRoomColorScheme"
    id: str = "bim-room-color-scheme"
    scheme_rows: list[RoomColorSchemeRow] = Field(default_factory=list, alias="schemeRows")


class CreateWallTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createWallType"] = "createWallType"
    id: str | None = None
    name: str = "Wall type"
    layers: list[WallTypeLayer] = Field(default_factory=list)
    basis_line: str = Field(alias="basisLine", default="center")


class UpsertWallTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertWallType"] = "upsertWallType"
    id: str
    name: str = "Wall type"
    layers: list[WallTypeLayer] = Field(default_factory=list)
    basis_line: str = Field(alias="basisLine", default="center")


class UpsertFloorTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertFloorType"] = "upsertFloorType"
    id: str
    name: str = "Floor type"
    layers: list[WallTypeLayer] = Field(default_factory=list)


class UpsertRoofTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertRoofType"] = "upsertRoofType"
    id: str
    name: str = "Roof type"
    layers: list[WallTypeLayer] = Field(default_factory=list)


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
    floor_type_id: str | None = Field(default=None, alias="floorTypeId")
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
    roof_geometry_mode: RoofGeometryMode = Field(default="mass_box", alias="roofGeometryMode")
    ridge_offset_transverse_mm: float | None = Field(default=None, alias="ridgeOffsetTransverseMm")
    eave_height_left_mm: float | None = Field(default=None, alias="eaveHeightLeftMm")
    eave_height_right_mm: float | None = Field(default=None, alias="eaveHeightRightMm")
    roof_type_id: str | None = Field(default=None, alias="roofTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")


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
    # KRN-07 — multi-run support. Defaults preserve legacy single-run behavior.
    shape: Literal["straight", "l_shape", "u_shape", "spiral", "sketch"] = Field(
        default="straight"
    )
    runs: list[StairRun] = Field(default_factory=list)
    landings: list[StairLanding] = Field(default_factory=list)


class CreateSlabOpeningCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSlabOpening"] = "createSlabOpening"
    id: str | None = None
    name: str = "Opening"
    host_floor_id: str = Field(alias="hostFloorId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    is_shaft: bool = Field(default=False, alias="isShaft")


class CreateRoofOpeningCmd(BaseModel):
    """IFC-03: open a hole through a host roof element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoofOpening"] = "createRoofOpening"
    id: str | None = None
    name: str = "Roof opening"
    host_roof_id: str = Field(alias="hostRoofId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")


class CreateWallOpeningCmd(BaseModel):
    """KRN-04: frameless rectangular wall opening (CSG cut, no family)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createWallOpening"] = "createWallOpening"
    id: str | None = None
    name: str = "Wall opening"
    host_wall_id: str = Field(alias="hostWallId")
    along_t_start: float = Field(alias="alongTStart", ge=0, le=1)
    along_t_end: float = Field(alias="alongTEnd", ge=0, le=1)
    sill_height_mm: float = Field(alias="sillHeightMm", ge=0)
    head_height_mm: float = Field(alias="headHeightMm", ge=0)


class UpdateWallOpeningCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateWallOpening"] = "updateWallOpening"
    opening_id: str = Field(alias="openingId")
    along_t_start: float | None = Field(default=None, alias="alongTStart")
    along_t_end: float | None = Field(default=None, alias="alongTEnd")
    sill_height_mm: float | None = Field(default=None, alias="sillHeightMm")
    head_height_mm: float | None = Field(default=None, alias="headHeightMm")


class CreateBalconyCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createBalcony"] = "createBalcony"
    id: str | None = None
    name: str = "Balcony"
    wall_id: str = Field(alias="wallId")
    elevation_mm: float = Field(alias="elevationMm")
    projection_mm: float = Field(default=650, alias="projectionMm")
    slab_thickness_mm: float = Field(default=150, alias="slabThicknessMm")
    balustrade_height_mm: float = Field(default=1050, alias="balustradeHeightMm")


class CreateRailingCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRailing"] = "createRailing"
    id: str | None = None
    name: str = "Railing"
    hosted_stair_id: str | None = Field(default=None, alias="hostedStairId")
    path_mm: list[Vec2Mm] = Field(alias="pathMm")


class FamilyCatalogSourceCmd(BaseModel):
    """FAM-08 — provenance triple stored on a family_type loaded from a catalog."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    catalog_id: str = Field(alias="catalogId")
    family_id: str = Field(alias="familyId")
    version: str


class UpsertFamilyTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertFamilyType"] = "upsertFamilyType"
    id: str | None = None
    discipline: Literal["door", "window", "generic"] = "generic"
    parameters: dict[str, Any] = Field(default_factory=dict)
    catalog_source: FamilyCatalogSourceCmd | None = Field(
        default=None, alias="catalogSource"
    )


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
    plan_detail_level: str | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(
        default=None, alias="planRoomFillOpacityScale"
    )
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    default_plan_opening_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanOpeningTagStyleId"
    )
    default_plan_room_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanRoomTagStyleId"
    )
    plan_category_graphics: list[PlanCategoryGraphicRow] | None = Field(
        default=None,
        alias="planCategoryGraphics",
    )


class UpsertPlanViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertPlanViewTemplate"] = "upsertPlanViewTemplate"
    id: str | None = None
    name: str = "Plan view template"
    scale: str = Field(alias="scale", default="scale_100")
    disciplines_visible: list[str] = Field(default_factory=list, alias="disciplinesVisible")
    hidden_categories: list[str] = Field(default_factory=list, alias="hiddenCategories")
    plan_detail_level: str | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(
        default=None, alias="planRoomFillOpacityScale"
    )
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    default_plan_opening_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanOpeningTagStyleId"
    )
    default_plan_room_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanRoomTagStyleId"
    )
    plan_category_graphics: list[PlanCategoryGraphicRow] | None = Field(
        default=None,
        alias="planCategoryGraphics",
    )
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")


class ApplyPlanViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["applyPlanViewTemplate"] = "applyPlanViewTemplate"
    plan_view_id: str = Field(alias="planViewId")
    template_id: str = Field(alias="templateId")


class UpdatePlanViewCropCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePlanViewCrop"] = "updatePlanViewCrop"
    plan_view_id: str = Field(alias="planViewId")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")


class UpdatePlanViewRangeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePlanViewRange"] = "updatePlanViewRange"
    plan_view_id: str = Field(alias="planViewId")
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")


class UpsertPlanTagStyleCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertPlanTagStyle"] = "upsertPlanTagStyle"
    id: str | None = None
    name: str = "Plan tag style"
    tag_target: PlanTagTarget = Field(alias="tagTarget")
    label_fields: list[str] = Field(default_factory=list, alias="labelFields")
    text_size_pt: float = Field(default=10.0, alias="textSizePt", gt=0)
    leader_visible: bool = Field(default=True, alias="leaderVisible")
    badge_style: PlanTagBadgeStyle = Field(default="none", alias="badgeStyle")
    color_token: str = Field(default="default", alias="colorToken")
    sort_key: int = Field(default=0, alias="sortKey")


class UpsertSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSheet"] = "upsertSheet"
    id: str | None = None
    name: str = "Sheet"
    title_block: str | None = Field(default=None, alias="titleBlock")
    paper_width_mm: float | None = Field(default=None, alias="paperWidthMm")
    paper_height_mm: float | None = Field(default=None, alias="paperHeightMm")
    titleblock_parameters: dict[str, str] | None = Field(default=None, alias="titleblockParameters")


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
    grouping: dict[str, Any] | None = None


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
    plan_detail_level: str | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(
        default=None, alias="planRoomFillOpacityScale"
    )
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    plan_opening_tag_style_id: str | None = Field(default=None, alias="planOpeningTagStyleId")
    plan_room_tag_style_id: str | None = Field(default=None, alias="planRoomTagStyleId")
    plan_category_graphics: list[PlanCategoryGraphicRow] | None = Field(
        default=None,
        alias="planCategoryGraphics",
    )


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
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    plan_view_id: str | None = Field(default=None, alias="planViewId")
    section_cut_id: str | None = Field(default=None, alias="sectionCutId")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


class CreateAgentAssumptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createAgentAssumption"] = "createAgentAssumption"
    id: str | None = None
    statement: str
    source: Literal["manual", "bundle_dry_run", "evidence_summary"] = "manual"
    closure_status: Literal["open", "resolved", "accepted", "deferred"] = Field(
        default="resolved", alias="closureStatus"
    )
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")
    related_topic_id: str | None = Field(default=None, alias="relatedTopicId")


class CreateAgentDeviationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createAgentDeviation"] = "createAgentDeviation"
    id: str | None = None
    statement: str
    severity: Literal["info", "warning", "error"] = "warning"
    acknowledged: bool = True
    related_assumption_id: str | None = Field(default=None, alias="relatedAssumptionId")
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")


class UpsertValidationRuleCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertValidationRule"] = "upsertValidationRule"
    id: str | None = None
    name: str = "IDS"
    rule_json: dict[str, Any] = Field(alias="ruleJson", default_factory=dict)


class UpsertSiteCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSite"] = "upsertSite"
    id: str
    name: str = "Site"
    reference_level_id: str = Field(alias="referenceLevelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    pad_thickness_mm: float = Field(alias="padThicknessMm", default=80.0)
    base_offset_mm: float = Field(default=0.0, alias="baseOffsetMm")
    north_deg_cw_from_plan_x: float | None = Field(default=None, alias="northDegCwFromPlanX")
    uniform_setback_mm: float | None = Field(default=None, alias="uniformSetbackMm")
    context_objects: list[SiteContextObjectRow] = Field(
        default_factory=list, alias="contextObjects"
    )


class CreateText3dCmd(BaseModel):
    """FAM-06: extruded 3D letterforms placed in model space."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createText3d"] = "createText3d"
    id: str | None = None
    text: str
    font_family: Text3dFontFamily = Field(default="helvetiker", alias="fontFamily")
    font_size_mm: float = Field(default=200.0, alias="fontSizeMm", gt=0)
    depth_mm: float = Field(default=50.0, alias="depthMm", gt=0)
    position_mm: Vec3Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


class MirrorAxis(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")


class MirrorElementsCmd(BaseModel):
    """FAM-07 — reflect elements across an axis, optionally keeping originals.

    `also_copy=True` keeps the originals and adds mirrored copies (Revit's
    "Mirror — Pick Axis" with Copy option). `also_copy=False` mirrors in
    place. `asymmetric_family_type_ids` lets the caller flag families that
    should produce a `mirror_asymmetric` advisory rather than mirror cleanly
    — the warnings are returned via :func:`mirror_advisories_for_command`.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["mirrorElements"] = "mirrorElements"
    element_ids: list[str] = Field(alias="elementIds")
    axis: MirrorAxis
    also_copy: bool = Field(default=True, alias="alsoCopy")
    asymmetric_family_type_ids: list[str] = Field(
        default_factory=list, alias="asymmetricFamilyTypeIds"
    )


class SetCurtainPanelOverrideCmd(BaseModel):
    """KRN-09 — install / remove a per-cell override on a curtain wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setCurtainPanelOverride"] = "setCurtainPanelOverride"
    wall_id: str = Field(alias="wallId")
    grid_cell_id: str = Field(alias="gridCellId")
    # `None` clears the override for the cell (revert to default glass).
    override: CurtainPanelOverride | None = None


# --- KRN-06: Origin element commands -------------------------------------


class CreateProjectBasePointCmd(BaseModel):
    """Create the (singleton) project base point. Rejects if one already exists."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createProjectBasePoint"] = "createProjectBasePoint"
    id: str | None = None
    position_mm: Vec3Mm = Field(alias="positionMm")
    angle_to_true_north_deg: float = Field(default=0.0, alias="angleToTrueNorthDeg")


class MoveProjectBasePointCmd(BaseModel):
    """Move the project base point. Translates rendering / shared coords; geometry unchanged."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveProjectBasePoint"] = "moveProjectBasePoint"
    position_mm: Vec3Mm = Field(alias="positionMm")


class RotateProjectBasePointCmd(BaseModel):
    """Rotate the project base point's true-north angle (degrees)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["rotateProjectBasePoint"] = "rotateProjectBasePoint"
    angle_to_true_north_deg: float = Field(alias="angleToTrueNorthDeg")


class CreateSurveyPointCmd(BaseModel):
    """Create the (singleton) survey point. Rejects if one already exists."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSurveyPoint"] = "createSurveyPoint"
    id: str | None = None
    position_mm: Vec3Mm = Field(alias="positionMm")
    shared_elevation_mm: float = Field(default=0.0, alias="sharedElevationMm")


class MoveSurveyPointCmd(BaseModel):
    """Move the survey point. Translates shared-coords output; geometry unchanged."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveSurveyPoint"] = "moveSurveyPoint"
    position_mm: Vec3Mm = Field(alias="positionMm")
    shared_elevation_mm: float | None = Field(default=None, alias="sharedElevationMm")


# --- FED-01: link_model commands ---------------------------------------------------


class CreateLinkModelCmd(BaseModel):
    """FED-01: insert a ``link_model`` element pointing at another bim-ai model.

    Engine-level validation rejects empty ``sourceModelId`` and self-reference
    (``sourceModelId`` matching this link's own id). Existence in DB and
    circular-link BFS are validated by the route handler that has DB access.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createLinkModel"] = "createLinkModel"
    id: str | None = None
    name: str = "Linked model"
    source_model_id: str = Field(alias="sourceModelId")
    source_model_revision: int | None = Field(default=None, alias="sourceModelRevision")
    position_mm: Vec3Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    origin_alignment_mode: Literal[
        "origin_to_origin", "project_origin", "shared_coords"
    ] = Field(default="origin_to_origin", alias="originAlignmentMode")
    visibility_mode: Literal["host_view", "linked_view"] = Field(
        default="host_view", alias="visibilityMode"
    )
    hidden: bool = Field(default=False)
    pinned: bool = Field(default=False)


class UpdateLinkModelCmd(BaseModel):
    """FED-01: update position / rotation / hidden / pinned on a ``link_model``."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateLinkModel"] = "updateLinkModel"
    link_id: str = Field(alias="linkId")
    name: str | None = None
    position_mm: Vec3Mm | None = Field(default=None, alias="positionMm")
    rotation_deg: float | None = Field(default=None, alias="rotationDeg")
    hidden: bool | None = None
    pinned: bool | None = None
    source_model_revision: int | None = Field(default=None, alias="sourceModelRevision")
    origin_alignment_mode: Literal[
        "origin_to_origin", "project_origin", "shared_coords"
    ] | None = Field(default=None, alias="originAlignmentMode")
    visibility_mode: Literal["host_view", "linked_view"] | None = Field(
        default=None, alias="visibilityMode"
    )


class DeleteLinkModelCmd(BaseModel):
    """FED-01: remove a ``link_model``. The source model is untouched."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteLinkModel"] = "deleteLinkModel"
    link_id: str = Field(alias="linkId")


class CreateLinkDxfCmd(BaseModel):
    """FED-04: create a ``link_dxf`` element from parsed DXF linework.

    Mirrors :class:`bim_ai.elements.LinkDxfElem` minus ``kind`` plus an
    optional ``id`` (the engine assigns one when omitted). The route
    handler runs ``parse_dxf_to_linework`` then dispatches this command
    through ``try_commit_bundle`` so the import is undoable.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createLinkDxf"] = "createLinkDxf"
    id: str | None = None
    name: str = "DXF Underlay"
    level_id: str = Field(alias="levelId")
    origin_mm: Vec2Mm = Field(alias="originMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale_factor: float = Field(default=1.0, alias="scaleFactor", gt=0)
    linework: list[DxfLineworkPrim] = Field(default_factory=list)
    pinned: bool = Field(default=False)


# --- FED-02: selection_set + clash_test commands ----------------------------------


class SelectionSetRuleCmd(BaseModel):
    """FED-02: a single filter rule passed in a ``selection_set`` upsert.

    See ``SelectionSetRuleSpec`` in ``elements.py`` for field semantics.
    ``link_scope`` accepts ``'host'``, ``'all_links'``, or
    ``{ 'specificLinkId': '<link-id>' }``.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    field: Literal["category", "level", "typeName"]
    operator: Literal["equals", "contains"]
    value: str
    link_scope: str | dict[str, str] | None = Field(default=None, alias="linkScope")


class UpsertSelectionSetCmd(BaseModel):
    """FED-02: create or replace a ``selection_set`` element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSelectionSet"] = "upsertSelectionSet"
    id: str | None = None
    name: str = "Selection Set"
    filter_rules: list[SelectionSetRuleCmd] = Field(default_factory=list, alias="filterRules")


class UpsertClashTestCmd(BaseModel):
    """FED-02: create or replace a ``clash_test`` element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertClashTest"] = "upsertClashTest"
    id: str | None = None
    name: str = "Clash Test"
    set_a_ids: list[str] = Field(default_factory=list, alias="setAIds")
    set_b_ids: list[str] = Field(default_factory=list, alias="setBIds")
    tolerance_mm: float = Field(default=0.0, alias="toleranceMm")


class RunClashTestCmd(BaseModel):
    """FED-02: run a ``clash_test`` and persist the results onto the element.

    The engine resolves each referenced selection set across its rules'
    ``link_scope`` (host, all linked models, or one specific link), transforms
    linked AABBs by the link's positionMm + rotationDeg, and computes
    pair-wise clashes within ``tolerance_mm``. Results carry a ``link_chain``
    identifying each element's source link (empty for host).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["runClashTest"] = "runClashTest"
    clash_test_id: str = Field(alias="clashTestId")


# --- FED-03: cross-link Copy/Monitor commands -------------------------------


class BumpMonitoredRevisionsCmd(BaseModel):
    """FED-03: walk every monitored element and re-evaluate drift.

    For each element carrying ``monitor_source``, the engine looks up the
    source element (through ``link_id`` for cross-link monitors, else
    intra-host), compares the monitored fields, and writes ``drifted`` +
    ``drifted_fields`` back onto the host element. Drifted elements then
    surface as ``monitored_source_drift`` advisories.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["bumpMonitoredRevisions"] = "bumpMonitoredRevisions"


class ReconcileMonitoredElementCmd(BaseModel):
    """FED-03: resolve drift on a single monitored element.

    ``mode`` is either ``'accept_source'`` (overwrite host fields with the
    current source values; clears ``drifted``) or ``'keep_host'`` (bump
    ``source_revision_at_copy`` to the source's current revision and clear
    ``drifted`` without touching host fields).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reconcileMonitoredElement"] = "reconcileMonitoredElement"
    element_id: str = Field(alias="elementId")
    mode: Literal["accept_source", "keep_host"]


# ---------- KRN-05: project-scope reference planes ----------


class CreateReferencePlaneCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createReferencePlane"] = "createReferencePlane"
    id: str | None = None
    name: str = ""
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    is_work_plane: bool = Field(default=False, alias="isWorkPlane")


class UpdateReferencePlaneCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateReferencePlane"] = "updateReferencePlane"
    reference_plane_id: str = Field(alias="referencePlaneId")
    name: str | None = None
    start_mm: Vec2Mm | None = Field(default=None, alias="startMm")
    end_mm: Vec2Mm | None = Field(default=None, alias="endMm")
    is_work_plane: bool | None = Field(default=None, alias="isWorkPlane")


class DeleteReferencePlaneCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteReferencePlane"] = "deleteReferencePlane"
    reference_plane_id: str = Field(alias="referencePlaneId")


# ---------- KRN-01: property lines ----------

PropertyLineClassificationCmd = Literal["street", "rear", "side", "other"]


class CreatePropertyLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPropertyLine"] = "createPropertyLine"
    id: str | None = None
    name: str = ""
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    setback_mm: float | None = Field(default=None, alias="setbackMm", ge=0)
    classification: PropertyLineClassificationCmd | None = None


class UpdatePropertyLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePropertyLine"] = "updatePropertyLine"
    property_line_id: str = Field(alias="propertyLineId")
    name: str | None = None
    start_mm: Vec2Mm | None = Field(default=None, alias="startMm")
    end_mm: Vec2Mm | None = Field(default=None, alias="endMm")
    setback_mm: float | None = Field(default=None, alias="setbackMm", ge=0)
    classification: PropertyLineClassificationCmd | None = None


class DeletePropertyLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deletePropertyLine"] = "deletePropertyLine"
    property_line_id: str = Field(alias="propertyLineId")


class CreateSweepCmd(BaseModel):
    """KRN-15 — author a project-level swept solid."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSweep"] = "createSweep"
    id: str | None = None
    name: str = "Sweep"
    level_id: str = Field(alias="levelId")
    path_mm: list[SweepPathPoint] = Field(alias="pathMm")
    profile_mm: list[SweepProfilePoint] = Field(alias="profileMm")
    profile_plane: SweepProfilePlane = Field(default="work_plane", alias="profilePlane")
    material_key: str | None = Field(default=None, alias="materialKey")


class CreateDormerCmd(BaseModel):
    """KRN-14 — author a dormer that cuts the host roof."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDormer"] = "createDormer"
    id: str | None = None
    name: str = "Dormer"
    host_roof_id: str = Field(alias="hostRoofId")
    position_on_roof: DormerPositionOnRoof = Field(alias="positionOnRoof")
    width_mm: float = Field(alias="widthMm", gt=0)
    wall_height_mm: float = Field(alias="wallHeightMm", gt=0)
    depth_mm: float = Field(alias="depthMm", gt=0)
    dormer_roof_kind: DormerRoofKind = Field(default="flat", alias="dormerRoofKind")
    dormer_roof_pitch_deg: float | None = Field(default=None, alias="dormerRoofPitchDeg")
    ridge_height_mm: float | None = Field(default=None, alias="ridgeHeightMm")
    wall_material_key: str | None = Field(default=None, alias="wallMaterialKey")
    roof_material_key: str | None = Field(default=None, alias="roofMaterialKey")
    has_floor_opening: bool = Field(default=False, alias="hasFloorOpening")


class SetWallRecessZonesCmd(BaseModel):
    """KRN-16 — replace the recess-zone list on an existing wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallRecessZones"] = "setWallRecessZones"
    wall_id: str = Field(alias="wallId")
    recess_zones: list[WallRecessZone] = Field(default_factory=list, alias="recessZones")


# --- KRN-08: area element ----------------------------------------------------

AreaRuleSetCmd = Literal["gross", "net", "no_rules"]


class CreateAreaCmd(BaseModel):
    """KRN-08 — author an `area` polygon for legal/permit area calculations."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createArea"] = "createArea"
    id: str | None = None
    name: str = "Area"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    rule_set: AreaRuleSetCmd = Field(default="no_rules", alias="ruleSet")


class UpdateAreaCmd(BaseModel):
    """KRN-08 — update an existing area's name, boundary, or ruleset."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateArea"] = "updateArea"
    area_id: str = Field(alias="areaId")
    name: str | None = None
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    rule_set: AreaRuleSetCmd | None = Field(default=None, alias="ruleSet")


class DeleteAreaCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteArea"] = "deleteArea"
    area_id: str = Field(alias="areaId")


# --- KRN-10: masking region --------------------------------------------------


class CreateMaskingRegionCmd(BaseModel):
    """KRN-10 — author a view-local masking region polygon."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMaskingRegion"] = "createMaskingRegion"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    fill_color: str = Field(default="#ffffff", alias="fillColor")


class UpdateMaskingRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateMaskingRegion"] = "updateMaskingRegion"
    masking_region_id: str = Field(alias="maskingRegionId")
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    fill_color: str | None = Field(default=None, alias="fillColor")


class DeleteMaskingRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteMaskingRegion"] = "deleteMaskingRegion"
    masking_region_id: str = Field(alias="maskingRegionId")


# ---- EDT-04: Plan-canvas Modify tools (Split / Align / Trim / Wall-Join) ----


class SplitWallAtCmd(BaseModel):
    """EDT-04 — split a wall at a normalised position alongT into two walls.

    The original wall is replaced by two new walls that share the split
    point. Hosted openings are *not* migrated by this command (the canvas
    side of the SD tool stays out of opening reassignment for v1); the
    along-T parameter and any door/window remain anchored to whichever
    of the two resulting walls now hosts the opening.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["splitWallAt"] = "splitWallAt"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", gt=0, lt=1)


class AlignElementToReferenceCmd(BaseModel):
    """EDT-04 — translate a target wall so its near endpoint snaps to the
    reference point along the closer principal axis."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["alignElementToReference"] = "alignElementToReference"
    target_wall_id: str = Field(alias="targetWallId")
    reference_mm: Vec2Mm = Field(alias="referenceMm")


class TrimElementToReferenceCmd(BaseModel):
    """EDT-04 — extend or trim ``targetWallId`` so its ``endHint`` endpoint
    lies on the infinite line of ``referenceWallId``."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["trimElementToReference"] = "trimElementToReference"
    reference_wall_id: str = Field(alias="referenceWallId")
    target_wall_id: str = Field(alias="targetWallId")
    end_hint: Literal["start", "end"] = Field(alias="endHint")


WallJoinVariant = Literal["miter", "butt", "square"]


class SetWallJoinVariantCmd(BaseModel):
    """EDT-04 — record the join variant for the walls meeting at a corner."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallJoinVariant"] = "setWallJoinVariant"
    wall_ids: list[str] = Field(alias="wallIds")
    variant: WallJoinVariant


# ---- EDT-04: Single-/two-click placement create commands ----


class CreateColumnCmd(BaseModel):
    """EDT-04 — single-click structural-column placement."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createColumn"] = "createColumn"
    id: str | None = None
    name: str = "Column"
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    b_mm: float = Field(alias="bMm", default=300, gt=0)
    h_mm: float = Field(alias="hMm", default=300, gt=0)
    height_mm: float = Field(alias="heightMm", default=2800, gt=0)
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


class CreateBeamCmd(BaseModel):
    """EDT-04 — two-click structural-beam placement."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createBeam"] = "createBeam"
    id: str | None = None
    name: str = "Beam"
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(alias="widthMm", default=200, gt=0)
    height_mm: float = Field(alias="heightMm", default=400, gt=0)
    material_key: str | None = Field(default=None, alias="materialKey")


class CreateCeilingCmd(BaseModel):
    """EDT-04 — sketch-polygon ceiling placement on a level."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createCeiling"] = "createCeiling"
    id: str | None = None
    name: str = "Ceiling"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    height_offset_mm: float = Field(alias="heightOffsetMm", default=2700)
    thickness_mm: float = Field(alias="thicknessMm", default=20, gt=0)
    ceiling_type_id: str | None = Field(default=None, alias="ceilingTypeId")


class CreateMassCmd(BaseModel):
    """SKT-01 — in-place generic mass authored from a sketch session."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMass"] = "createMass"
    id: str | None = None
    name: str = "Mass"
    level_id: str = Field(alias="levelId")
    footprint_mm: list[Vec2Mm] = Field(alias="footprintMm")
    height_mm: float = Field(default=3000, alias="heightMm", gt=0)
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


class MaterializeMassToWallsCmd(BaseModel):
    """SKB-02 — auto-extract walls + floor + roof-stub from a `mass` element.

    The engine emits one wall per footprint segment, one floor matching the
    footprint at level base, and one flat roof at level base + heightMm,
    promotes phase to ``'skeleton'`` on emitted elements, and deletes the
    source mass. Each emitted element carries an ``AgentDeviationElem`` back
    to the source mass id so the materialise step is auditable.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["materializeMassToWalls"] = "materializeMassToWalls"
    mass_id: str = Field(alias="massId")


class CreateVoidCutCmd(BaseModel):
    """SKT-01 — subtractive boolean marker against a host element.

    The element is a marker only (`VoidCutElem`); the actual CSG geometry is
    handled at render time. An `AgentDeviationElem` is co-authored by the
    engine handler so the deviation against the host is traceable.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createVoidCut"] = "createVoidCut"
    id: str | None = None
    host_element_id: str = Field(alias="hostElementId")
    profile_mm: list[Vec2Mm] = Field(alias="profileMm")
    depth_mm: float = Field(alias="depthMm", gt=0)


class CreateConstraintCmd(BaseModel):
    """EDT-02 — author a geometric constraint between element groups.

    The padlock UI on a temp-dimension authors `equal_distance` between
    two walls; other rules are accepted shapes for forward compatibility
    but currently pass-through in the evaluator.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createConstraint"] = "createConstraint"
    id: str | None = None
    name: str = ""
    rule: ConstraintRule
    refs_a: list[ConstraintRefRow] = Field(alias="refsA")
    refs_b: list[ConstraintRefRow] = Field(alias="refsB")
    locked_value_mm: float | None = Field(default=None, alias="lockedValueMm")
    severity: Literal["warning", "error"] = "error"


Command = Annotated[
    CreateLevelCmd
    | CreateWallCmd
    | MoveWallDeltaCmd
    | MoveWallEndpointsCmd
    | MoveBeamEndpointsCmd
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
    | UpsertRoomColorSchemeCmd
    | CreateWallTypeCmd
    | UpsertWallTypeCmd
    | UpsertFloorTypeCmd
    | UpsertRoofTypeCmd
    | AssignWallDatumConstraintsCmd
    | CreateFloorCmd
    | CreateRoofCmd
    | ExtendFloorInsulationCmd
    | AttachWallTopToRoofCmd
    | CreateStairCmd
    | CreateSlabOpeningCmd
    | CreateRoofOpeningCmd
    | CreateWallOpeningCmd
    | UpdateWallOpeningCmd
    | CreateRailingCmd
    | CreateBalconyCmd
    | UpsertFamilyTypeCmd
    | AssignOpeningFamilyCmd
    | UpdateOpeningCleanroomCmd
    | CreateRoomSeparationCmd
    | CreatePlanRegionCmd
    | UpsertTagDefinitionCmd
    | CreateJoinGeometryCmd
    | CreateSectionCutCmd
    | UpsertViewTemplateCmd
    | UpsertPlanViewTemplateCmd
    | ApplyPlanViewTemplateCmd
    | UpdatePlanViewCropCmd
    | UpdatePlanViewRangeCmd
    | UpsertSheetCmd
    | UpsertSheetViewportsCmd
    | UpsertScheduleCmd
    | UpsertScheduleFiltersCmd
    | UpsertRoomVolumeCmd
    | UpsertPlanTagStyleCmd
    | UpsertPlanViewCmd
    | CreateCalloutCmd
    | CreateBcfTopicCmd
    | CreateAgentAssumptionCmd
    | CreateAgentDeviationCmd
    | UpsertValidationRuleCmd
    | UpsertSiteCmd
    | CreateText3dCmd
    | MirrorElementsCmd
    | PinElementCmd
    | UnpinElementCmd
    | SetCurtainPanelOverrideCmd
    | CreateProjectBasePointCmd
    | MoveProjectBasePointCmd
    | RotateProjectBasePointCmd
    | CreateSurveyPointCmd
    | MoveSurveyPointCmd
    | CreateElevationViewCmd
    | CreateLinkModelCmd
    | UpdateLinkModelCmd
    | DeleteLinkModelCmd
    | CreateLinkDxfCmd
    | UpsertSelectionSetCmd
    | UpsertClashTestCmd
    | RunClashTestCmd
    | BumpMonitoredRevisionsCmd
    | ReconcileMonitoredElementCmd
    | PlaceTagCmd
    | ClearAutoGeneratedAnnotationsCmd
    | CreateDetailLineCmd
    | CreateDetailRegionCmd
    | CreateTextNoteCmd
    | CreateReferencePlaneCmd
    | UpdateReferencePlaneCmd
    | DeleteReferencePlaneCmd
    | CreatePropertyLineCmd
    | UpdatePropertyLineCmd
    | DeletePropertyLineCmd
    | CreateSweepCmd
    | CreateDormerCmd
    | SetWallRecessZonesCmd
    | CreateAreaCmd
    | UpdateAreaCmd
    | DeleteAreaCmd
    | CreateMaskingRegionCmd
    | UpdateMaskingRegionCmd
    | DeleteMaskingRegionCmd
    | SplitWallAtCmd
    | AlignElementToReferenceCmd
    | TrimElementToReferenceCmd
    | SetWallJoinVariantCmd
    | CreateColumnCmd
    | CreateBeamCmd
    | CreateCeilingCmd
    | CreateMassCmd
    | MaterializeMassToWallsCmd
    | CreateVoidCutCmd
    | CreateConstraintCmd,
    Field(discriminator="type"),
]
