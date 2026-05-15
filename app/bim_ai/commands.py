from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from bim_ai.elements import (
    BalusterPattern,
    CameraMm,
    ClipRect,
    ConstraintRefRow,
    ConstraintRule,
    CurtainPanelOverride,
    DormerPositionOnRoof,
    DormerRoofKind,
    DxfLayerMeta,
    DxfLineworkPrim,
    EvidenceRef,
    HandrailSupport,
    LensMode,
    PhaseFilter,
    PlanCategoryGraphicRow,
    PlanTagBadgeStyle,
    PlanTagTarget,
    RoomColorSchemeRow,
    SiteContextObjectRow,
    StairLanding,
    StairRun,
    StairTreadLine,
    SweepPathPoint,
    SweepProfilePlane,
    SweepProfilePoint,
    Text3dFontFamily,
    Vec2Mm,
    Vec3Mm,
    WallCurve,
    WallLocationLine,
    WallRecessZone,
    WallStructuralRole,
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


class WallStackComponentCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    wall_type_id: str = Field(alias="wallTypeId")
    height_mm: float = Field(alias="heightMm", gt=0)


class CreateWallCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createWall"] = "createWall"
    id: str | None = None
    name: str = "Wall"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm
    wall_curve: WallCurve | None = Field(default=None, alias="wallCurve")
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    location_line: WallLocationLine = Field(default="wall-centerline", alias="locationLine")
    base_constraint_level_id: str | None = Field(default=None, alias="baseConstraintLevelId")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")
    insulation_extension_mm: float = Field(default=0, alias="insulationExtensionMm")
    material_key: str | None = Field(default=None, alias="materialKey")
    load_bearing: bool | None = Field(default=None, alias="loadBearing")
    structural_role: WallStructuralRole = Field(default="unknown", alias="structuralRole")
    analytical_participation: bool = Field(default=False, alias="analyticalParticipation")
    structural_material_key: str | None = Field(default=None, alias="structuralMaterialKey")
    structural_intent_confidence: float | None = Field(
        default=None, alias="structuralIntentConfidence", ge=0, le=1
    )
    is_curtain_wall: bool = Field(default=False, alias="isCurtainWall")
    stack_components: list[WallStackComponentCmd] = Field(
        default_factory=list, alias="stackComponents"
    )
    lean_mm: Vec2Mm | None = Field(default=None, alias="leanMm")
    taper_ratio: float | None = Field(default=None, alias="taperRatio")
    # TOP-V3-04: optional site host — wall base elevation follows the toposolid surface.
    site_host_id: str | None = Field(default=None, alias="siteHostId")


class SetWallStackCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallStack"] = "setWallStack"
    wall_id: str = Field(alias="wallId")
    components: list[WallStackComponentCmd] = Field(default_factory=list)


class SetWallLeanTaperCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallLeanTaper"] = "setWallLeanTaper"
    wall_id: str = Field(alias="wallId")
    lean_mm: Vec2Mm | None = Field(default=None, alias="leanMm")
    taper_ratio: float | None = Field(default=None, alias="taperRatio")


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
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    location_line: WallLocationLine = Field(default="wall-centerline", alias="locationLine")
    base_constraint_level_id: str | None = Field(default=None, alias="baseConstraintLevelId")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")
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
    anchor_a: dict[str, Any] | None = Field(default=None, alias="anchorA")
    anchor_b: dict[str, Any] | None = Field(default=None, alias="anchorB")
    state: Literal["linked", "partial", "unlinked"] | None = None
    ref_element_id_a: str | None = Field(default=None, alias="refElementIdA")
    ref_element_id_b: str | None = Field(default=None, alias="refElementIdB")
    tag_definition_id: str | None = Field(default=None, alias="tagDefinitionId")
    auto_generated: bool = Field(default=False, alias="autoGenerated")


class CreateAngularDimensionCmd(BaseModel):
    """ANN-04 — angular dimension between two rays from a shared vertex."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createAngularDimension"] = "createAngularDimension"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    vertex_mm: Vec2Mm = Field(alias="vertexMm")
    ray_a_mm: Vec2Mm = Field(alias="rayAMm")
    ray_b_mm: Vec2Mm = Field(alias="rayBMm")
    arc_radius_mm: float = Field(default=500.0, alias="arcRadiusMm")
    colour: str = Field(default="#202020")


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


class CreateAnnotationSymbolCmd(BaseModel):
    """ANN-05 — place a view-local annotation symbol (North Arrow, Stair Path, Centerline)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createAnnotationSymbol"] = "createAnnotationSymbol"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    symbol_type: Literal["north_arrow", "stair_up", "stair_down", "centerline"] = Field(
        alias="symbolType"
    )
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale: float = Field(default=1.0)
    colour: str = Field(default="#202020")


class CreateSpotElevationCmd(BaseModel):
    """ANN-02 — view-local spot elevation at a picked point."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSpotElevation"] = "createSpotElevation"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    elevation_mm: float = Field(alias="elevationMm")
    prefix: str = Field(default="")
    suffix: str = Field(default="")
    colour: str = Field(default="#202020")


class CreateSpotCoordinateCmd(BaseModel):
    """ANN-09 — view-local spot coordinate."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSpotCoordinate"] = "createSpotCoordinate"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    north_mm: float = Field(alias="northMm")
    east_mm: float = Field(alias="eastMm")
    colour: str = Field(default="#202020")


class CreateSpotSlopeCmd(BaseModel):
    """ANN-10 — view-local spot slope."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSpotSlope"] = "createSpotSlope"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    slope_pct: float = Field(alias="slopePct")
    slope_format: Literal["percent", "ratio", "degree"] = Field(
        default="percent", alias="slopeFormat"
    )
    colour: str = Field(default="#202020")


class CreateInsulationAnnotationCmd(BaseModel):
    """ANN-11 — view-local insulation annotation."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createInsulationAnnotation"] = "createInsulationAnnotation"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(default=200.0, alias="widthMm")
    colour: str = Field(default="#202020")


class CreateRadialDimensionCmd(BaseModel):
    """ANN-06 — radial dimension."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRadialDimension"] = "createRadialDimension"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    center_mm: Vec2Mm = Field(alias="centerMm")
    arc_point_mm: Vec2Mm = Field(alias="arcPointMm")
    colour: str = Field(default="#202020")


class CreateDiameterDimensionCmd(BaseModel):
    """ANN-07 — diameter dimension."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDiameterDimension"] = "createDiameterDimension"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    center_mm: Vec2Mm = Field(alias="centerMm")
    arc_point_mm: Vec2Mm = Field(alias="arcPointMm")
    colour: str = Field(default="#202020")


class CreateArcLengthDimensionCmd(BaseModel):
    """ANN-08 — arc length dimension."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createArcLengthDimension"] = "createArcLengthDimension"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    center_mm: Vec2Mm = Field(alias="centerMm")
    radius_mm: float = Field(alias="radiusMm")
    start_angle_deg: float = Field(alias="startAngleDeg")
    end_angle_deg: float = Field(alias="endAngleDeg")
    colour: str = Field(default="#202020")


class CreateMaterialTagCmd(BaseModel):
    """ANN-12 — place a material layer tag."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMaterialTag"] = "createMaterialTag"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    host_element_id: str = Field(alias="hostElementId")
    layer_index: int = Field(default=0, alias="layerIndex")
    position_mm: Vec2Mm = Field(alias="positionMm")
    text_override: str | None = Field(default=None, alias="textOverride")
    colour: str = Field(default="#202020")


class CreateMultiCategoryTagCmd(BaseModel):
    """ANN-13 — place a multi-category tag."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMultiCategoryTag"] = "createMultiCategoryTag"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    host_element_id: str = Field(alias="hostElementId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    parameter_name: str = Field(default="Type Mark", alias="parameterName")
    text_override: str | None = Field(default=None, alias="textOverride")
    colour: str = Field(default="#202020")


class CreateTreadNumberCmd(BaseModel):
    """ANN-14 — place tread number annotations on a stair."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createTreadNumber"] = "createTreadNumber"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    stair_element_id: str = Field(alias="stairElementId")
    start_number: int = Field(default=1, alias="startNumber")
    colour: str = Field(default="#202020")


class CreateKeynoteCmd(BaseModel):
    """ANN-15 — place a keynote annotation."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createKeynote"] = "createKeynote"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    keynote_key: str = Field(alias="keynoteKey")
    keynote_text: str = Field(default="", alias="keynoteText")
    target: Literal["element", "material", "user"] = Field(default="user")
    host_element_id: str | None = Field(default=None, alias="hostElementId")
    colour: str = Field(default="#202020")


class CreateSpanDirectionCmd(BaseModel):
    """ANN-16 — place a span direction arrow."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSpanDirection"] = "createSpanDirection"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    direction_deg: float = Field(default=0.0, alias="directionDeg")
    length_mm: float = Field(default=800.0, alias="lengthMm")
    colour: str = Field(default="#202020")


class CreateDetailComponentCmd(BaseModel):
    """ANN-17 — place a 2D detail component."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDetailComponent"] = "createDetailComponent"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    component_shape: Literal[
        "us_wide_flange_beam",
        "concrete_column_square",
        "concrete_column_round",
        "steel_angle",
        "steel_channel",
        "bolt",
        "weld_symbol",
        "break_line",
        "centerline_end",
    ] = Field(alias="componentShape")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale: float = Field(default=1.0)
    colour: str = Field(default="#202020")


class CreateRepeatingDetailCmd(BaseModel):
    """ANN-18 — create a repeating detail component pattern."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRepeatingDetail"] = "createRepeatingDetail"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    component_shape: Literal[
        "us_wide_flange_beam",
        "concrete_column_square",
        "concrete_column_round",
        "steel_angle",
        "steel_channel",
        "bolt",
        "weld_symbol",
        "break_line",
        "centerline_end",
    ] = Field(alias="componentShape")
    spacing_mm: float = Field(default=200.0, alias="spacingMm")
    colour: str = Field(default="#202020")


class CreateDetailGroupCmd(BaseModel):
    """ANN-19 — create a named group of detail elements."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDetailGroup"] = "createDetailGroup"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    name: str = Field(default="Group")
    member_ids: list[str] = Field(alias="memberIds")


class CreateColorFillLegendCmd(BaseModel):
    """ANN-20 — place a color fill legend in a view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createColorFillLegend"] = "createColorFillLegend"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    scheme_parameter: str = Field(default="Name", alias="schemeParameter")
    title: str = Field(default="Color Fill Legend")


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
    marker_group_id: str | None = Field(default=None, alias="markerGroupId")
    marker_slot: Literal["north", "south", "east", "west", "custom"] | None = Field(
        default=None, alias="markerSlot"
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


class PlaceRoomAtPointCmd(BaseModel):
    """Derive and place a room by clicking inside a closed wall enclosure."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["placeRoomAtPoint"] = "placeRoomAtPoint"
    id: str
    level_id: str = Field(alias="levelId")
    click_x_mm: float = Field(alias="clickXMm")
    click_y_mm: float = Field(alias="clickYMm")
    name: str = Field(default="Room")


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


class UpdateIssueStatusCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateIssueStatus"] = "updateIssueStatus"
    issue_id: str = Field(alias="issueId")
    status: Literal[
        "open",
        "in_progress",
        "reviewed",
        "resolved",
        "closed",
        "done",
        "not_an_issue",
        "new",
        "active",
        "approved",
        "suppressed",
    ]
    comment: str | None = None
    actor: str | None = None
    revision: str | int | None = None


class UpdateElementPropertyCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateElementProperty"] = "updateElementProperty"
    element_id: str = Field(alias="elementId")
    key: str
    value: str | bool | int | float | dict[str, Any] | list[Any] | None = ""
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
    plan_overlay_enabled: bool = Field(default=False, alias="planOverlayEnabled")
    plan_overlay_source_plan_view_id: str | None = Field(
        default=None, alias="planOverlaySourcePlanViewId"
    )
    plan_overlay_offset_mm: float | None = Field(default=None, alias="planOverlayOffsetMm")
    plan_overlay_opacity: float | None = Field(default=None, alias="planOverlayOpacity")
    plan_overlay_line_opacity: float | None = Field(default=None, alias="planOverlayLineOpacity")
    plan_overlay_fill_opacity: float | None = Field(default=None, alias="planOverlayFillOpacity")
    plan_overlay_annotations_visible: bool | None = Field(
        default=None, alias="planOverlayAnnotationsVisible"
    )
    plan_overlay_witness_lines_visible: bool | None = Field(
        default=None, alias="planOverlayWitnessLinesVisible"
    )


class UpsertProjectSettingsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertProjectSettings"] = "upsertProjectSettings"
    id: str = "project_settings"
    name: str | None = None
    project_number: str | None = Field(default=None, alias="projectNumber")
    client_name: str | None = Field(default=None, alias="clientName")
    project_address: str | None = Field(default=None, alias="projectAddress")
    project_status: str | None = Field(default=None, alias="projectStatus")
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
    shape: Literal["straight", "l_shape", "u_shape", "spiral", "sketch"] = Field(default="straight")
    runs: list[StairRun] = Field(default_factory=list)
    landings: list[StairLanding] = Field(default_factory=list)
    # KRN-07 closeout — spiral + sketch shape inputs.
    center_mm: Vec2Mm | None = Field(default=None, alias="centerMm")
    inner_radius_mm: float | None = Field(default=None, alias="innerRadiusMm")
    outer_radius_mm: float | None = Field(default=None, alias="outerRadiusMm")
    total_rotation_deg: float | None = Field(default=None, alias="totalRotationDeg")
    riser_count: int | None = Field(default=None, alias="riserCount")
    sketch_path_mm: list[Vec2Mm] | None = Field(default=None, alias="sketchPathMm")
    # KRN-V3-05 — by_sketch authoring mode fields.
    authoring_mode: Literal["by_component", "by_sketch"] = Field(
        default="by_component", alias="authoringMode"
    )
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    tread_lines: list[StairTreadLine] | None = Field(default=None, alias="treadLines")
    total_rise_mm: float | None = Field(default=None, alias="totalRiseMm")
    # KRN-V3-10 — monolithic / floating stair sub-kinds.
    sub_kind: Literal["standard", "monolithic", "floating"] = Field(
        default="standard", alias="subKind"
    )
    monolithic_material: str | None = Field(default=None, alias="monolithicMaterial")
    floating_tread_depth_mm: float | None = Field(default=None, alias="floatingTreadDepthMm")
    floating_host_wall_id: str | None = Field(default=None, alias="floatingHostWallId")

    @model_validator(mode="after")
    def _validate_shape_specific_fields(self) -> CreateStairCmd:
        if self.authoring_mode == "by_sketch":
            if self.boundary_mm is None or len(self.boundary_mm) < 3:
                raise ValueError("by_sketch stair requires boundaryMm with ≥ 3 points")
            if self.tread_lines is None or len(self.tread_lines) < 1:
                raise ValueError("by_sketch stair requires treadLines with ≥ 1 entry")
            if self.total_rise_mm is None or self.total_rise_mm <= 0:
                raise ValueError("by_sketch stair requires totalRiseMm > 0")
            return self
        if self.shape == "spiral":
            missing: list[str] = []
            if self.center_mm is None:
                missing.append("centerMm")
            if self.inner_radius_mm is None:
                missing.append("innerRadiusMm")
            if self.outer_radius_mm is None:
                missing.append("outerRadiusMm")
            if self.total_rotation_deg is None:
                missing.append("totalRotationDeg")
            if self.riser_count is None or self.riser_count < 1:
                missing.append("riserCount")
            if missing:
                raise ValueError(f"spiral stair requires {', '.join(missing)}")
            if (
                self.inner_radius_mm is not None
                and self.outer_radius_mm is not None
                and self.outer_radius_mm <= self.inner_radius_mm
            ):
                raise ValueError("spiral stair outerRadiusMm must exceed innerRadiusMm")
        elif self.shape == "sketch":
            if self.sketch_path_mm is None or len(self.sketch_path_mm) < 2:
                raise ValueError("sketch stair requires sketchPathMm with at least two points")
        return self


class SetStairSubKindCmd(BaseModel):
    """KRN-V3-10 — change the sub-kind on an existing stair."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setStairSubKind"] = "setStairSubKind"
    stair_id: str = Field(alias="stairId")
    sub_kind: Literal["standard", "monolithic", "floating"] = Field(alias="subKind")
    monolithic_material: str | None = Field(default=None, alias="monolithicMaterial")
    floating_tread_depth_mm: float | None = Field(default=None, alias="floatingTreadDepthMm")
    floating_host_wall_id: str | None = Field(default=None, alias="floatingHostWallId")


class UpdateStairTreadsCmd(BaseModel):
    """EDT-V3-09 — patch tread lines on a by_sketch stair (from drag-to-rebalance)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_stair_treads"] = "update_stair_treads"
    id: str
    tread_lines: list[dict] = Field(
        alias="treadLines"
    )  # [{fromMm, toMm, riserHeightMm?, manualOverride?}]


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
    baluster_pattern: BalusterPattern | None = Field(default=None, alias="balusterPattern")
    handrail_supports: list[HandrailSupport] | None = Field(default=None, alias="handrailSupports")


class SetRailingBalusterPatternCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setRailingBalusterPattern"] = "setRailingBalusterPattern"
    railing_id: str = Field(alias="railingId")
    baluster_pattern: BalusterPattern | None = Field(default=None, alias="balusterPattern")


class SetRailingHandrailSupportsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setRailingHandrailSupports"] = "setRailingHandrailSupports"
    railing_id: str = Field(alias="railingId")
    handrail_supports: list[HandrailSupport] = Field(default_factory=list, alias="handrailSupports")


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
    name: str | None = None
    family_id: str | None = Field(default=None, alias="familyId")
    discipline: Literal["door", "window", "generic"] = "generic"
    parameters: dict[str, Any] = Field(default_factory=dict)
    catalog_source: FamilyCatalogSourceCmd | None = Field(default=None, alias="catalogSource")


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


class UpdatePlanRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePlanRegion"] = "updatePlanRegion"
    id: str
    name: str | None = None
    outline_mm: list[Vec2Mm] | None = Field(default=None, alias="outlineMm")
    cut_plane_offset_mm: float | None = Field(default=None, alias="cutPlaneOffsetMm")


class DeletePlanRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deletePlanRegion"] = "deletePlanRegion"
    id: str


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
    filters: dict[str, Any] = Field(default_factory=dict)
    grouping: dict[str, Any] = Field(default_factory=dict)


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


AreaSchemeCmd = Literal["gross_building", "net", "rentable"]
PlanViewSubtypeCmd = Literal[
    "floor_plan",
    "area_plan",
    "lighting_plan",
    "power_plan",
    "coordination_plan",
]


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
    view_subdiscipline: str | None = Field(default=None, alias="viewSubdiscipline")
    plan_view_subtype: PlanViewSubtypeCmd | None = Field(default=None, alias="planViewSubtype")
    area_scheme: AreaSchemeCmd = Field(default="gross_building", alias="areaScheme")
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
    clipped: bool = False


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
    clipped: bool = False


class MoveSurveyPointCmd(BaseModel):
    """Move the survey point. Translates shared-coords output; geometry unchanged."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveSurveyPoint"] = "moveSurveyPoint"
    position_mm: Vec3Mm = Field(alias="positionMm")
    shared_elevation_mm: float | None = Field(default=None, alias="sharedElevationMm")


# --- SUN-V3-01: sun_settings commands -------------------------------------------


class CreateSunSettingsCmd(BaseModel):
    """SUN-V3-01: create the project-level sun settings singleton.

    Rejects if one already exists (use UpdateSunSettings to modify).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSunSettings"] = "createSunSettings"
    id: str | None = None
    latitude_deg: float = Field(default=48.13, alias="latitudeDeg")
    longitude_deg: float = Field(default=11.58, alias="longitudeDeg")
    date_iso: str = Field(default="2026-06-21", alias="dateIso")
    time_of_day: dict = Field(
        default_factory=lambda: {"hours": 14, "minutes": 30}, alias="timeOfDay"
    )
    daylight_saving_strategy: Literal["auto", "on", "off"] = Field(
        default="auto", alias="daylightSavingStrategy"
    )


class UpdateSunSettingsCmd(BaseModel):
    """SUN-V3-01: update the project-level sun settings singleton.

    Partial update — only provided fields are changed.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateSunSettings"] = "updateSunSettings"
    latitude_deg: float | None = Field(default=None, alias="latitudeDeg")
    longitude_deg: float | None = Field(default=None, alias="longitudeDeg")
    date_iso: str | None = Field(default=None, alias="dateIso")
    time_of_day: dict | None = Field(default=None, alias="timeOfDay")
    daylight_saving_strategy: Literal["auto", "on", "off"] | None = Field(
        default=None, alias="daylightSavingStrategy"
    )


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
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] = Field(
        default="origin_to_origin", alias="originAlignmentMode"
    )
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
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] | None = (
        Field(default=None, alias="originAlignmentMode")
    )
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
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] = Field(
        default="origin_to_origin", alias="originAlignmentMode"
    )
    unit_override: str | int | None = Field(default=None, alias="unitOverride")
    unit_scale_to_mm: float | None = Field(default=None, alias="unitScaleToMm", gt=0)
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale_factor: float = Field(default=1.0, alias="scaleFactor", gt=0)
    linework: list[DxfLineworkPrim] = Field(default_factory=list)
    dxf_layers: list[DxfLayerMeta] = Field(default_factory=list, alias="dxfLayers")
    hidden_layer_names: list[str] = Field(default_factory=list, alias="hiddenLayerNames")
    pinned: bool = Field(default=False)
    source_path: str | None = Field(default=None, alias="sourcePath")
    cad_reference_type: Literal["linked", "embedded"] = Field(
        default="linked", alias="cadReferenceType"
    )
    source_metadata: dict[str, Any] = Field(default_factory=dict, alias="sourceMetadata")
    reload_status: Literal["not_reloaded", "ok", "source_missing", "parse_error", "embedded"] = (
        Field(default="not_reloaded", alias="reloadStatus")
    )
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    loaded: bool = Field(default=True)
    color_mode: Literal["black_white", "custom", "native"] | None = Field(
        default=None, alias="colorMode"
    )
    custom_color: str | None = Field(default=None, alias="customColor")
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)


class UpdateLinkDxfCmd(BaseModel):
    """FED-04 / F-017 / F-020: update display properties on a ``link_dxf`` element.

    All fields are optional; only supplied fields are applied. Allows the
    frontend ``ManageLinksDialog`` to persist per-link opacity and color-mode
    settings without re-uploading the full linework payload.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateLinkDxf"] = "updateLinkDxf"
    link_id: str = Field(alias="linkId")
    color_mode: Literal["black_white", "custom", "native"] | None = Field(
        default=None, alias="colorMode"
    )
    custom_color: str | None = Field(default=None, alias="customColor")
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)
    hidden_layer_names: list[str] | None = Field(default=None, alias="hiddenLayerNames")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] | None = (
        Field(default=None, alias="originAlignmentMode")
    )
    unit_override: str | int | None = Field(default=None, alias="unitOverride")
    unit_scale_to_mm: float | None = Field(default=None, alias="unitScaleToMm", gt=0)
    linework: list[DxfLineworkPrim] | None = Field(default=None)
    dxf_layers: list[DxfLayerMeta] | None = Field(default=None, alias="dxfLayers")
    source_path: str | None = Field(default=None, alias="sourcePath")
    cad_reference_type: Literal["linked", "embedded"] | None = Field(
        default=None, alias="cadReferenceType"
    )
    source_metadata: dict[str, Any] | None = Field(default=None, alias="sourceMetadata")
    reload_status: (
        Literal["not_reloaded", "ok", "source_missing", "parse_error", "embedded"] | None
    ) = Field(default=None, alias="reloadStatus")
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    reload_source: bool = Field(default=False, alias="reloadSource")
    loaded: bool | None = Field(default=None)


class CreateExternalLinkCmd(BaseModel):
    """F-024: create a generic IFC/PDF/image external-link row."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createExternalLink"] = "createExternalLink"
    id: str | None = None
    name: str = "External link"
    external_link_type: Literal["ifc", "pdf", "image"] = Field(alias="externalLinkType")
    source_path: str = Field(alias="sourcePath")
    source_name: str | None = Field(default=None, alias="sourceName")
    source_metadata: dict[str, Any] = Field(default_factory=dict, alias="sourceMetadata")
    reload_status: Literal["not_reloaded", "ok", "source_missing", "parse_error"] = Field(
        default="not_reloaded", alias="reloadStatus"
    )
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    loaded: bool = Field(default=True)
    hidden: bool = Field(default=False)
    pinned: bool = Field(default=False)
    origin_mm: Vec2Mm | None = Field(default=None, alias="originMm")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] = Field(
        default="origin_to_origin", alias="originAlignmentMode"
    )
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale_factor: float = Field(default=1.0, alias="scaleFactor", gt=0)
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)


class UpdateExternalLinkCmd(BaseModel):
    """F-024: update generic IFC/PDF/image external-link metadata and controls."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateExternalLink"] = "updateExternalLink"
    link_id: str = Field(alias="linkId")
    name: str | None = None
    source_path: str | None = Field(default=None, alias="sourcePath")
    source_name: str | None = Field(default=None, alias="sourceName")
    source_metadata: dict[str, Any] | None = Field(default=None, alias="sourceMetadata")
    reload_status: Literal["not_reloaded", "ok", "source_missing", "parse_error"] | None = Field(
        default=None, alias="reloadStatus"
    )
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    reload_source: bool = Field(default=False, alias="reloadSource")
    loaded: bool | None = Field(default=None)
    hidden: bool | None = Field(default=None)
    pinned: bool | None = Field(default=None)
    origin_mm: Vec2Mm | None = Field(default=None, alias="originMm")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] | None = (
        Field(default=None, alias="originAlignmentMode")
    )
    rotation_deg: float | None = Field(default=None, alias="rotationDeg")
    scale_factor: float | None = Field(default=None, alias="scaleFactor", gt=0)
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)


class DeleteExternalLinkCmd(BaseModel):
    """F-024: remove a generic IFC/PDF/image external-link row."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteExternalLink"] = "deleteExternalLink"
    link_id: str = Field(alias="linkId")


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
    authoring_mode: Literal["draw", "bearing_table"] = Field(default="draw", alias="authoringMode")
    bearing_table: dict[str, Any] | None = Field(default=None, alias="bearingTable")


class UpdatePropertyLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePropertyLine"] = "updatePropertyLine"
    property_line_id: str = Field(alias="propertyLineId")
    name: str | None = None
    start_mm: Vec2Mm | None = Field(default=None, alias="startMm")
    end_mm: Vec2Mm | None = Field(default=None, alias="endMm")
    setback_mm: float | None = Field(default=None, alias="setbackMm", ge=0)
    classification: PropertyLineClassificationCmd | None = None
    authoring_mode: Literal["draw", "bearing_table"] | None = Field(
        default=None, alias="authoringMode"
    )
    bearing_table: dict[str, Any] | None = Field(default=None, alias="bearingTable")


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


class CreateRoofJoinCmd(BaseModel):
    """KRN-V3-03 G11 — join two overlapping roofs into a watertight composite."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoofJoin"] = "createRoofJoin"
    id: str | None = None
    name: str = "Roof Join"
    primary_roof_id: str = Field(alias="primaryRoofId")
    secondary_roof_id: str = Field(alias="secondaryRoofId")
    seam_mode: Literal["clip_secondary_into_primary", "merge_at_ridge"] = Field(
        default="clip_secondary_into_primary", alias="seamMode"
    )


class CreateEdgeProfileRunCmd(BaseModel):
    """KRN-V3-03 G12 — attach a swept profile along a host element edge."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createEdgeProfileRun"] = "createEdgeProfileRun"
    id: str | None = None
    name: str = "Edge Profile Run"
    host_element_id: str = Field(alias="hostElementId")
    host_edge: Any = Field(alias="hostEdge")
    profile_family_id: str = Field(alias="profileFamilyId")
    offset_mm: Vec2Mm = Field(alias="offsetMm")
    miter_mode: Literal["auto", "manual"] = Field(default="auto", alias="miterMode")
    mode: Literal["sweep", "reveal"] = Field(default="sweep")


class SetEdgeProfileRunModeCmd(BaseModel):
    """KRN-V3-08 — toggle sweep / reveal mode on an existing edge profile run."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setEdgeProfileRunMode"] = "setEdgeProfileRunMode"
    run_id: str = Field(alias="runId")
    mode: Literal["sweep", "reveal"]


class CreateSoffitCmd(BaseModel):
    """KRN-V3-03 G13 — sketch a horizontal soffit panel under a roof eave."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSoffit"] = "createSoffit"
    id: str | None = None
    name: str = "Soffit"
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    host_roof_id: str | None = Field(default=None, alias="hostRoofId")
    thickness_mm: float = Field(alias="thicknessMm")
    z_mm: float | None = Field(default=None, alias="zMm")


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
    area_scheme: AreaSchemeCmd = Field(default="gross_building", alias="areaScheme")
    apply_area_rules: bool = Field(default=True, alias="applyAreaRules")


class UpdateAreaCmd(BaseModel):
    """KRN-08 — update an existing area's name, boundary, or ruleset."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateArea"] = "updateArea"
    area_id: str = Field(alias="areaId")
    name: str | None = None
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    rule_set: AreaRuleSetCmd | None = Field(default=None, alias="ruleSet")
    area_scheme: AreaSchemeCmd | None = Field(default=None, alias="areaScheme")


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
    void_boundaries_mm: list[list[Vec2Mm]] = Field(default_factory=list, alias="voidBoundariesMm")
    fill_color: str = Field(default="#ffffff", alias="fillColor")


# --- ANN-03: revision cloud --------------------------------------------------


class CreateRevisionCloudCmd(BaseModel):
    """ANN-03 — view-local revision cloud boundary."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRevisionCloud"] = "createRevisionCloud"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    colour: str = Field(default="#e05000")
    stroke_mm: float = Field(default=1.0, alias="strokeMm")


class UpdateMaskingRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateMaskingRegion"] = "updateMaskingRegion"
    masking_region_id: str = Field(alias="maskingRegionId")
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    void_boundaries_mm: list[list[Vec2Mm]] | None = Field(default=None, alias="voidBoundariesMm")
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
    """EDT-04 — translate a target element (wall, column, placed_asset) so its
    near endpoint/position snaps to the reference point along the closer axis."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["alignElementToReference"] = "alignElementToReference"
    target_element_id: str = Field(
        validation_alias=AliasChoices("targetElementId", "targetWallId"),
        serialization_alias="targetElementId",
    )
    reference_mm: Vec2Mm = Field(alias="referenceMm")


class TrimElementToReferenceCmd(BaseModel):
    """EDT-04 — extend or trim ``targetWallId`` so its ``endHint`` endpoint
    lies on the infinite line of ``referenceWallId``."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["trimElementToReference"] = "trimElementToReference"
    reference_wall_id: str = Field(alias="referenceWallId")
    target_wall_id: str = Field(alias="targetWallId")
    end_hint: Literal["start", "end"] = Field(alias="endHint")


class TrimExtendToCornerCmd(BaseModel):
    """Trim or extend two walls so their centerlines meet at a corner."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["trimExtendToCorner"] = "trimExtendToCorner"
    wall_id_a: str = Field(alias="wallIdA")
    wall_id_b: str = Field(alias="wallIdB")


WallJoinVariant = Literal["miter", "butt", "square"]


class SetWallJoinVariantCmd(BaseModel):
    """EDT-04 — record the join variant for the walls meeting at a corner."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallJoinVariant"] = "setWallJoinVariant"
    wall_ids: list[str] = Field(alias="wallIds")
    variant: WallJoinVariant


class SetWallJoinDisallowCmd(BaseModel):
    """F-040 — toggle the 'disallow join' flag for one endpoint of a wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallJoinDisallow"] = "setWallJoinDisallow"
    wall_id: str = Field(alias="wallId")
    endpoint: Literal["start", "end"] = "start"
    disallow: bool = True


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


class CreatePhaseCmd(BaseModel):
    """KRN-V3-01 — create a new project-level phase."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPhase"] = "createPhase"
    id: str | None = None
    name: str
    ord: int


class RenamePhaseCmd(BaseModel):
    """KRN-V3-01 — rename an existing phase."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["renamePhase"] = "renamePhase"
    phase_id: str = Field(alias="phaseId")
    name: str


class ReorderPhaseCmd(BaseModel):
    """KRN-V3-01 — change a phase's ordinal position."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reorderPhase"] = "reorderPhase"
    phase_id: str = Field(alias="phaseId")
    ord: int


class DeletePhaseCmd(BaseModel):
    """KRN-V3-01 — delete a phase, optionally retargeting its elements."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deletePhase"] = "deletePhase"
    phase_id: str = Field(alias="phaseId")
    retarget_to_phase_id: str | None = Field(default=None, alias="retargetToPhaseId")


class SetElementPhaseCmd(BaseModel):
    """KRN-V3-01 — set phase_created / phase_demolished on any phaseable element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setElementPhase"] = "setElementPhase"
    element_id: str = Field(alias="elementId")
    phase_created_id: str | None = Field(default=None, alias="phaseCreatedId")
    phase_demolished_id: str | None = Field(default=None, alias="phaseDemolishedId")
    clear_demolished: bool = Field(default=False, alias="clearDemolished")


class SetElementDisciplineCmd(BaseModel):
    """DSC-V3-01 — set discipline tag on one or more elements; undo + activity.

    Pass discipline=None (or null in JSON) to reset the element to its kind's
    DEFAULT_DISCIPLINE_BY_KIND value.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setElementDiscipline"] = "setElementDiscipline"
    element_ids: list[str] = Field(alias="elementIds")
    discipline: Literal["arch", "struct", "mep"] | None = "arch"


class SetViewPhaseCmd(BaseModel):
    """KRN-V3-01 — set the as-of phase for a plan view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setViewPhase"] = "setViewPhase"
    view_id: str = Field(alias="viewId")
    phase_id: str = Field(alias="phaseId")


class SetViewPhaseFilterCmd(BaseModel):
    """KRN-V3-01 — set the phase filter on a plan view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setViewPhaseFilter"] = "setViewPhaseFilter"
    view_id: str = Field(alias="viewId")
    phase_filter: PhaseFilter = Field(alias="phaseFilter")


class SetViewLensCmd(BaseModel):
    """DSC-V3-02 — set the discipline lens on a view.

    Elements not matching the lens render at 25% opacity (ghost).
    Does not mutate element discipline fields.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["set_view_lens"] = "set_view_lens"
    view_id: str = Field(alias="viewId")
    lens: LensMode


class ConstructionMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    actual_start: str | None = Field(default=None, alias="actualStart")
    actual_end: str | None = Field(default=None, alias="actualEnd")
    installation_sequence: int | None = Field(default=None, alias="installationSequence")
    dependencies: list[str] = Field(default_factory=list)
    progress_status: str | None = Field(default=None, alias="progressStatus")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")
    issue_ids: list[str] = Field(default_factory=list, alias="issueIds")
    punch_item_ids: list[str] = Field(default_factory=list, alias="punchItemIds")
    inspection_checklist: list[dict[str, Any]] = Field(
        default_factory=list, alias="inspectionChecklist"
    )


class SetElementConstructionCmd(BaseModel):
    """Construction lens — attach execution metadata without changing design intent."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setElementConstruction"] = "setElementConstruction"
    element_id: str = Field(alias="elementId")
    metadata: ConstructionMetadata
    phase_created_id: str | None = Field(default=None, alias="phaseCreatedId")
    phase_demolished_id: str | None = Field(default=None, alias="phaseDemolishedId")
    clear_demolished: bool = Field(default=False, alias="clearDemolished")


class CreateConstructionPackageCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createConstructionPackage"] = "createConstructionPackage"
    id: str | None = None
    name: str
    code: str | None = None
    phase_id: str | None = Field(default=None, alias="phaseId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    actual_start: str | None = Field(default=None, alias="actualStart")
    actual_end: str | None = Field(default=None, alias="actualEnd")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    dependencies: list[str] = Field(default_factory=list)


class CreateConstructionLogisticsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createConstructionLogistics"] = "createConstructionLogistics"
    id: str | None = None
    name: str
    logistics_kind: str = Field(alias="logisticsKind")
    boundary_mm: list[Vec2Mm] = Field(default_factory=list, alias="boundaryMm")
    path_mm: list[Vec2Mm] = Field(default_factory=list, alias="pathMm")
    phase_id: str | None = Field(default=None, alias="phaseId")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    progress_status: str = Field(default="not_started", alias="progressStatus")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")


class UpsertConstructionQaChecklistCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertConstructionQaChecklist"] = "upsertConstructionQaChecklist"
    id: str | None = None
    name: str
    target_element_ids: list[str] = Field(default_factory=list, alias="targetElementIds")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    phase_id: str | None = Field(default=None, alias="phaseId")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    progress_status: str = Field(default="not_started", alias="progressStatus")
    checklist: list[dict[str, Any]] = Field(default_factory=list)


class MoveElementCmd(BaseModel):
    """TKN-V3-01 — move a wall-hosted element (door/window) to a new tAlongHost position."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveElement"] = "moveElement"
    element_id: str = Field(alias="elementId")
    t_along_host: float = Field(alias="tAlongHost", ge=0.0, le=1.0)


class CreateOptionSetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createOptionSet"] = "createOptionSet"
    id: str
    name: str


class AddOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["addOption"] = "addOption"
    option_set_id: str = Field(alias="optionSetId")
    option_id: str = Field(alias="optionId")
    name: str
    is_primary: bool = Field(default=False, alias="isPrimary")


class RemoveOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["removeOption"] = "removeOption"
    option_set_id: str = Field(alias="optionSetId")
    option_id: str = Field(alias="optionId")


class SetPrimaryOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setPrimaryOption"] = "setPrimaryOption"
    option_set_id: str = Field(alias="optionSetId")
    option_id: str = Field(alias="optionId")


class AssignElementToOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["assignElementToOption"] = "assignElementToOption"
    element_id: str = Field(alias="elementId")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")


class SetViewOptionLockCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setViewOptionLock"] = "setViewOptionLock"
    view_id: str = Field(alias="viewId")
    option_set_id: str = Field(alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")


# --- VIE-V3-03: view template v3 commands ------------------------------------


class CreateViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateViewTemplate"] = "CreateViewTemplate"
    template_id: str = Field(alias="templateId")
    name: str
    scale: int | None = Field(default=None)
    detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="detailLevel"
    )
    element_overrides: list[dict] = Field(default_factory=list, alias="elementOverrides")
    phase: str | None = Field(default=None)
    phase_filter: str | None = Field(default=None, alias="phaseFilter")
    template_control_matrix: dict[str, Any] | None = Field(
        default=None, alias="templateControlMatrix"
    )


class UpdateViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateViewTemplate"] = "UpdateViewTemplate"
    template_id: str = Field(alias="templateId")
    name: str | None = Field(default=None)
    scale: int | None = Field(default=None)
    detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="detailLevel"
    )
    element_overrides: list[dict] | None = Field(default=None, alias="elementOverrides")
    phase: str | None = Field(default=None)
    phase_filter: str | None = Field(default=None, alias="phaseFilter")
    template_control_matrix: dict[str, Any] | None = Field(
        default=None, alias="templateControlMatrix"
    )


class ApplyViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["ApplyViewTemplate"] = "ApplyViewTemplate"
    view_id: str = Field(alias="viewId")
    template_id: str = Field(alias="templateId")


class UnbindViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UnbindViewTemplate"] = "UnbindViewTemplate"
    view_id: str = Field(alias="viewId")


class DeleteViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteViewTemplate"] = "DeleteViewTemplate"
    template_id: str = Field(alias="templateId")


class CreateSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateSheet"] = "CreateSheet"
    sheet_id: str = Field(alias="sheetId")
    name: str
    number: str
    size: Literal["A0", "A1", "A2", "A3"] = "A1"
    orientation: Literal["landscape", "portrait"] = "landscape"
    titleblock_type_id: str = Field(default="default-a1-titleblock", alias="titleblockTypeId")
    metadata: dict = Field(default_factory=dict)


class PlaceViewOnSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["PlaceViewOnSheet"] = "PlaceViewOnSheet"
    sheet_id: str = Field(alias="sheetId")
    view_id: str = Field(alias="viewId")
    min_xy: dict = Field(alias="minXY")
    size: dict
    scale: int | None = Field(default=None)


class MoveViewOnSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["MoveViewOnSheet"] = "MoveViewOnSheet"
    sheet_id: str = Field(alias="sheetId")
    view_id: str = Field(alias="viewId")
    min_xy: dict = Field(alias="minXY")


class RemoveViewFromSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["RemoveViewFromSheet"] = "RemoveViewFromSheet"
    sheet_id: str = Field(alias="sheetId")
    view_id: str = Field(alias="viewId")


class SetSheetTitleblockCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["SetSheetTitleblock"] = "SetSheetTitleblock"
    sheet_id: str = Field(alias="sheetId")
    titleblock_type_id: str = Field(alias="titleblockTypeId")


class UpdateSheetMetadataCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateSheetMetadata"] = "UpdateSheetMetadata"
    sheet_id: str = Field(alias="sheetId")
    metadata: dict


class CreateWindowLegendViewCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateWindowLegendView"] = "CreateWindowLegendView"
    legend_id: str = Field(alias="legendId")
    name: str
    scope: Literal["all", "sheet", "project"] = "project"
    sort_by: Literal["type", "width", "count"] = Field(default="type", alias="sortBy")
    parent_sheet_id: str | None = Field(default=None, alias="parentSheetId")


# ---------------------------------------------------------------------------
# VIE-V3-02 — Drafting view + callout + cut-profile + view-break commands
# ---------------------------------------------------------------------------


class CreateDraftingViewCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateDraftingView"] = "CreateDraftingView"
    view_id: str = Field(alias="viewId")
    name: str
    scale: int = 50


class CreateViewCalloutCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateCallout"] = "CreateCallout"
    callout_view_id: str = Field(alias="calloutViewId")
    parent_view_id: str = Field(alias="parentViewId")
    clip_rect: ClipRect = Field(alias="clipRect")
    name: str
    scale: int = 5


class SetElementOverrideCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["SetElementOverride"] = "SetElementOverride"
    view_id: str = Field(alias="viewId")
    category_or_id: str = Field(alias="categoryOrId")
    alternate_render: str = Field(alias="alternateRender")


class AddViewBreakCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["AddViewBreak"] = "AddViewBreak"
    view_id: str = Field(alias="viewId")
    axis_mm: float = Field(alias="axisMM")
    width_mm: float = Field(alias="widthMM")


class RemoveViewBreakCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["RemoveViewBreak"] = "RemoveViewBreak"
    view_id: str = Field(alias="viewId")
    axis_mm: float = Field(alias="axisMM")


class HideElementInViewCmd(BaseModel):
    """Hide a specific element in a named plan view (F-102 per-element hide)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["hideElementInView"] = "hideElementInView"
    plan_view_id: str = Field(alias="planViewId")
    element_id: str = Field(alias="elementId")


class UnhideElementInViewCmd(BaseModel):
    """Remove a specific element from the hidden-element list of a plan view (F-102)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["unhideElementInView"] = "unhideElementInView"
    plan_view_id: str = Field(alias="planViewId")
    element_id: str = Field(alias="elementId")


# ---------------------------------------------------------------------------
# TOP-V3-01 — Toposolid commands
# ---------------------------------------------------------------------------


class CreateToposolidCmd(BaseModel):
    """TOP-V3-01 — create a terrain solid from a closed boundary and height data."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateToposolid"] = "CreateToposolid"
    toposolid_id: str = Field(alias="toposolidId")
    name: str | None = None
    boundary_mm: list[dict] = Field(alias="boundaryMm")
    height_samples: list[dict] = Field(default_factory=list, alias="heightSamples")
    heightmap_grid_mm: dict | None = Field(default=None, alias="heightmapGridMm")
    thickness_mm: float = Field(default=1500.0, alias="thicknessMm")
    base_elevation_mm: float | None = Field(default=None, alias="baseElevationMm")
    default_material_key: str | None = Field(default=None, alias="defaultMaterialKey")


class UpdateToposolidCmd(BaseModel):
    """TOP-V3-01 — patch fields on an existing toposolid."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateToposolid"] = "UpdateToposolid"
    toposolid_id: str = Field(alias="toposolidId")
    name: str | None = None
    thickness_mm: float | None = Field(default=None, alias="thicknessMm")
    base_elevation_mm: float | None = Field(default=None, alias="baseElevationMm")
    default_material_key: str | None = Field(default=None, alias="defaultMaterialKey")
    pinned: bool | None = None


class DeleteToposolidCmd(BaseModel):
    """TOP-V3-01 — delete a toposolid; emits a warning if floors are hosted on it."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteToposolid"] = "DeleteToposolid"
    toposolid_id: str = Field(alias="toposolidId")


# ---------------------------------------------------------------------------
# TOP-V3-02 — Toposolid subdivision commands
# ---------------------------------------------------------------------------


class CreateToposolidSubdivisionCmd(BaseModel):
    """TOP-V3-02 — create a surface-finish region on an existing toposolid."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_toposolid_subdivision"] = "create_toposolid_subdivision"
    id: str
    host_toposolid_id: str = Field(alias="hostToposolidId")
    boundary_mm: list[dict] = Field(alias="boundaryMm")
    finish_category: str = Field(alias="finishCategory")
    material_key: str = Field(alias="materialKey")
    name: str | None = None


class UpdateToposolidSubdivisionCmd(BaseModel):
    """TOP-V3-02 — patch fields on an existing toposolid subdivision."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_toposolid_subdivision"] = "update_toposolid_subdivision"
    id: str
    boundary_mm: list[dict] | None = Field(default=None, alias="boundaryMm")
    finish_category: str | None = Field(default=None, alias="finishCategory")
    material_key: str | None = Field(default=None, alias="materialKey")
    name: str | None = None


class DeleteToposolidSubdivisionCmd(BaseModel):
    """TOP-V3-02 — remove a toposolid subdivision from the model."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_toposolid_subdivision"] = "delete_toposolid_subdivision"
    id: str


# ---------------------------------------------------------------------------
# TOP-V3-04 — Graded region commands
# ---------------------------------------------------------------------------


class CreateGradedRegionCmd(BaseModel):
    """TOP-V3-04 — create a graded region anchored to a toposolid.

    ``flat`` mode requires ``targetZMm``; ``slope`` mode requires both
    ``slopeAxisDeg`` and ``slopeDegPercent``.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateGradedRegion"] = "CreateGradedRegion"
    id: str | None = None
    host_toposolid_id: str = Field(alias="hostToposolidId")
    boundary_mm: list[dict] = Field(alias="boundaryMm")  # [{xMm, yMm}]
    target_mode: Literal["flat", "slope"] = Field("flat", alias="targetMode")
    target_z_mm: float | None = Field(None, alias="targetZMm")
    slope_axis_deg: float | None = Field(None, alias="slopeAxisDeg")
    slope_deg_percent: float | None = Field(None, alias="slopeDegPercent")


class UpdateGradedRegionCmd(BaseModel):
    """TOP-V3-04 — patch fields on an existing graded region."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateGradedRegion"] = "UpdateGradedRegion"
    id: str
    boundary_mm: list[dict] | None = Field(None, alias="boundaryMm")
    target_mode: Literal["flat", "slope"] | None = Field(None, alias="targetMode")
    target_z_mm: float | None = Field(None, alias="targetZMm")
    slope_axis_deg: float | None = Field(None, alias="slopeAxisDeg")
    slope_deg_percent: float | None = Field(None, alias="slopeDegPercent")


class DeleteGradedRegionCmd(BaseModel):
    """TOP-V3-04 — delete a graded region by id."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteGradedRegion"] = "DeleteGradedRegion"
    id: str


# ---------------------------------------------------------------------------
# TOP-V3-05 — Toposolid excavation relation commands
# ---------------------------------------------------------------------------


ToposolidExcavationCutMode = Literal["to_top_of_cutter", "to_bottom_of_cutter", "custom_depth"]


class CreateToposolidExcavationCmd(BaseModel):
    """TOP-V3-05 — declare that a floor/roof/toposolid excavates a host toposolid."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateToposolidExcavation"] = "CreateToposolidExcavation"
    id: str | None = None
    host_toposolid_id: str = Field(alias="hostToposolidId")
    cutter_element_id: str = Field(alias="cutterElementId")
    cut_mode: ToposolidExcavationCutMode = Field("to_bottom_of_cutter", alias="cutMode")
    offset_mm: float = Field(0.0, alias="offsetMm")
    custom_depth_mm: float | None = Field(None, alias="customDepthMm")
    estimated_volume_m3: float | None = Field(None, alias="estimatedVolumeM3")


class UpdateToposolidExcavationCmd(BaseModel):
    """TOP-V3-05 — patch a toposolid excavation relation."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateToposolidExcavation"] = "UpdateToposolidExcavation"
    id: str
    cut_mode: ToposolidExcavationCutMode | None = Field(None, alias="cutMode")
    offset_mm: float | None = Field(None, alias="offsetMm")
    custom_depth_mm: float | None = Field(None, alias="customDepthMm")
    estimated_volume_m3: float | None = Field(None, alias="estimatedVolumeM3")


class DeleteToposolidExcavationCmd(BaseModel):
    """TOP-V3-05 — delete a toposolid excavation relation."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteToposolidExcavation"] = "DeleteToposolidExcavation"
    id: str


# AST-V3-01 — Asset library commands
# ---------------------------------------------------------------------------


class IndexAssetCmd(BaseModel):
    """Index a new asset into the project's searchable library."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["IndexAsset"] = "IndexAsset"
    id: str | None = None
    asset_kind: Literal["family_instance", "block_2d", "kit", "decal", "profile"] = Field(
        alias="assetKind", default="block_2d"
    )
    name: str
    tags: list[str] = Field(default_factory=list)
    category: Literal[
        "furniture", "kitchen", "bathroom", "door", "window", "decal", "profile", "casework"
    ]
    discipline_tags: list[Literal["arch", "struct", "mep"]] = Field(
        default_factory=list, alias="disciplineTags"
    )
    thumbnail_kind: Literal["schematic_plan", "rendered_3d"] = Field(
        default="schematic_plan", alias="thumbnailKind"
    )
    thumbnail_width_mm: float | None = Field(default=None, alias="thumbnailWidthMm")
    thumbnail_height_mm: float | None = Field(default=None, alias="thumbnailHeightMm")
    plan_symbol_kind: (
        Literal[
            "bed",
            "wardrobe",
            "lamp",
            "rug",
            "fridge",
            "oven",
            "sink",
            "counter",
            "sofa",
            "table",
            "chair",
            "toilet",
            "bath",
            "shower",
            "bathroom_layout",
            "generic",
        ]
        | None
    ) = Field(default=None, alias="planSymbolKind")
    render_proxy_kind: (
        Literal[
            "bed",
            "wardrobe",
            "lamp",
            "rug",
            "fridge",
            "oven",
            "sink",
            "counter",
            "sofa",
            "table",
            "chair",
            "toilet",
            "bath",
            "shower",
            "bathroom_layout",
            "generic",
        ]
        | None
    ) = Field(default=None, alias="renderProxyKind")
    param_schema: list[dict[str, Any]] | None = Field(default=None, alias="paramSchema")
    published_from_org_id: str | None = Field(default=None, alias="publishedFromOrgId")
    description: str | None = None


class PlaceAssetCmd(BaseModel):
    """Place an asset instance at a position on the canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["PlaceAsset"] = "PlaceAsset"
    id: str | None = None
    name: str | None = None
    asset_id: str = Field(alias="assetId")
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    param_values: dict[str, Any] = Field(default_factory=dict, alias="paramValues")
    host_element_id: str | None = Field(default=None, alias="hostElementId")


class PlaceFamilyInstanceCmd(BaseModel):
    """Place an instance of a project-loaded family_type."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["placeFamilyInstance"] = "placeFamilyInstance"
    id: str | None = None
    name: str | None = None
    family_type_id: str = Field(alias="familyTypeId")
    level_id: str | None = Field(default=None, alias="levelId")
    host_view_id: str | None = Field(default=None, alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    param_values: dict[str, Any] = Field(default_factory=dict, alias="paramValues")
    host_element_id: str | None = Field(default=None, alias="hostElementId")
    host_along_t: float | None = Field(default=None, alias="hostAlongT", ge=0, le=1)


class MoveAssetDeltaCmd(BaseModel):
    """Move a placed_asset element by a positional delta."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveAssetDelta"] = "moveAssetDelta"
    element_id: str = Field(alias="elementId")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")


class MoveColumnDeltaCmd(BaseModel):
    """Move a column element by a delta in X and Y."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveColumnDelta"] = "moveColumnDelta"
    element_id: str = Field(alias="elementId")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")


class MoveElementsDeltaCmd(BaseModel):
    """Move multiple elements by (dxMm, dyMm). Supports walls, columns, placed_assets."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveElementsDelta"] = "moveElementsDelta"
    element_ids: list[str] = Field(alias="elementIds")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")


class RotateElementsCmd(BaseModel):
    """Rotate one or more elements around a center point by a given angle."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["rotateElements"] = "rotateElements"
    element_ids: list[str] = Field(alias="elementIds")
    center_x_mm: float = Field(alias="centerXMm")
    center_y_mm: float = Field(alias="centerYMm")
    angle_deg: float = Field(alias="angleDeg")


class SetToolPrefCmd(BaseModel):
    """CHR-V3-08: Store a sticky tool-modifier preference for the session.

    ``tool`` is the authoring tool name (e.g. "wall", "door", "window").
    ``pref_key`` is the modifier name (e.g. "alignment", "swingSide", "multipleMode").
    ``pref_value`` is the serialised value (always a string; booleans as "true"/"false").
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setToolPref"] = "setToolPref"
    tool: str
    pref_key: str = Field(alias="prefKey")
    pref_value: str = Field(alias="prefValue")


# ---------------------------------------------------------------------------
# EDT-V3-06 — Helper dimension update commands (minimal patch commands)
# ---------------------------------------------------------------------------


class UpdateWallCmd(BaseModel):
    """EDT-V3-06 — patch a wall's length or thickness from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateWall"] = "updateWall"
    id: str
    length_mm: float | None = Field(default=None, alias="lengthMm", gt=0)
    thickness_mm: float | None = Field(default=None, alias="thicknessMm", gt=0)
    # TOP-V3-04: optional site host binding update.
    site_host_id: str | None = Field(default=None, alias="siteHostId")


class UpdateDoorCmd(BaseModel):
    """EDT-V3-06 — patch a door's width from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateDoor"] = "updateDoor"
    id: str
    width_mm: float | None = Field(default=None, alias="widthMm", gt=0)


class UpdateWindowCmd(BaseModel):
    """EDT-V3-06 — patch a window's dimensions from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateWindow"] = "updateWindow"
    id: str
    width_mm: float | None = Field(default=None, alias="widthMm", gt=0)
    sill_height_mm: float | None = Field(default=None, alias="sillHeightMm", ge=0)
    height_mm: float | None = Field(default=None, alias="heightMm", gt=0)


class UpdateColumnCmd(BaseModel):
    """EDT-V3-06 — patch a column's cross-section from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateColumn"] = "updateColumn"
    id: str
    b_mm: float | None = Field(default=None, alias="bMm", gt=0)
    h_mm: float | None = Field(default=None, alias="hMm", gt=0)


# ---------------------------------------------------------------------------
# MAT-V3-01 — Material PBR map slots + Decals
# ---------------------------------------------------------------------------


class UpdateMaterialPbrCmd(BaseModel):
    """MAT-V3-01 — set PBR map slots on a material element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_material_pbr"] = "update_material_pbr"
    id: str
    name: str | None = None
    albedo_color: str | None = Field(default=None, alias="albedoColor")
    albedo_map_id: str | None = Field(default=None, alias="albedoMapId")
    normal_map_id: str | None = Field(default=None, alias="normalMapId")
    roughness_map_id: str | None = Field(default=None, alias="roughnessMapId")
    metallic_map_id: str | None = Field(default=None, alias="metallicMapId")
    height_map_id: str | None = Field(default=None, alias="heightMapId")
    uv_scale_mm: dict | None = Field(default=None, alias="uvScaleMm")
    uv_rotation_deg: float | None = Field(default=None, alias="uvRotationDeg")
    hatch_pattern_id: str | None = Field(default=None, alias="hatchPatternId")


class CreateDecalCmd(BaseModel):
    """MAT-V3-01 — create a decal element hosted on a parent surface."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_decal"] = "create_decal"
    id: str | None = None
    parent_element_id: str = Field(alias="parentElementId")
    parent_surface: Literal["front", "back", "top", "left", "right", "bottom"] = Field(
        alias="parentSurface"
    )
    image_asset_id: str = Field(alias="imageAssetId")
    uv_rect: dict = Field(alias="uvRect")
    opacity: float = 1.0


# ---------------------------------------------------------------------------
# IMG-V3-01 — Image trace command
# ---------------------------------------------------------------------------


class TraceImageCmd(BaseModel):
    """IMG-V3-01 — read-only CV trace; does not mutate the kernel.

    Dispatched via engine.handle_trace_image_cmd(), not apply_inplace().
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["TraceImage"] = "TraceImage"
    image_b64: str = Field(alias="imageB64")
    archetype_hint: str | None = Field(default=None, alias="archetypeHint")
    brief_text: str | None = Field(default=None, alias="briefText")
    assumptions: list = Field(default_factory=list)


# ---------------------------------------------------------------------------
# SCH-V3-01 — Custom-properties + schedule view commands
# ---------------------------------------------------------------------------


class CreatePropertyDefinitionCmd(BaseModel):
    """SCH-V3-01 — define a custom property schema entry."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_property_definition"] = "create_property_definition"
    id: str
    key: str
    label: str
    prop_kind: str = Field(alias="propKind")
    enum_values: list[str] | None = Field(default=None, alias="enumValues")
    default_value: Any | None = Field(default=None, alias="defaultValue")
    applies_to: list[str] = Field(alias="appliesTo")
    show_in_schedule: bool = Field(default=True, alias="showInSchedule")


class SetElementPropCmd(BaseModel):
    """SCH-V3-01 — set a custom property value on any element that carries props."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["set_element_prop"] = "set_element_prop"
    element_id: str = Field(alias="elementId")
    key: str
    value: Any


class CreateScheduleViewCmd(BaseModel):
    """SCH-V3-01 — create a filterable schedule view element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_schedule_view"] = "create_schedule_view"
    id: str
    name: str
    category: str
    columns: list[dict] = Field(default_factory=list)
    filter_expr: str | None = Field(default=None, alias="filterExpr")
    sort_key: str | None = Field(default=None, alias="sortKey")
    sort_dir: Literal["asc", "desc"] | None = Field(default=None, alias="sortDir")


# ---------------------------------------------------------------------------
# ANN-V3-01 — Detail-region drawing-mode authoring
# ---------------------------------------------------------------------------


class DrawDetailRegionCmd(BaseModel):
    """ANN-V3-01 — draw a polyline or closed hatch region on a view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_detail_region"] = "create_detail_region"
    id: str
    view_id: str = Field(alias="viewId")
    vertices: list[dict]
    closed: bool = False
    hatch_id: str | None = Field(default=None, alias="hatchId")
    lineweight_override: float | None = Field(default=None, alias="lineweightOverride")
    phase_created: str | None = Field(default=None, alias="phaseCreated")


class UpdateDetailRegionCmd(BaseModel):
    """ANN-V3-01 — patch vertices, closed flag, or hatch on a detail_region."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_detail_region"] = "update_detail_region"
    id: str
    vertices: list[dict] | None = None
    closed: bool | None = None
    hatch_id: str | None = Field(default=None, alias="hatchId")
    lineweight_override: float | None = Field(default=None, alias="lineweightOverride")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")


# ---------------------------------------------------------------------------
# AST-V3-04 — Parametric kitchen kit commands
# ---------------------------------------------------------------------------


class PlaceKitCmd(BaseModel):
    """AST-V3-04 — place a parametric kitchen kit on a wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["place_kit"] = "place_kit"
    id: str
    kit_id: Literal["kitchen_modular"] = Field(alias="kitId", default="kitchen_modular")
    host_wall_id: str = Field(alias="hostWallId")
    start_mm: float = Field(alias="startMm")
    end_mm: float = Field(alias="endMm")
    components: list[dict] = Field(default_factory=list)
    countertop_depth_mm: float = Field(default=600.0, alias="countertopDepthMm")
    countertop_thickness_mm: float = Field(default=40.0, alias="countertopThicknessMm")
    countertop_material_id: str | None = Field(default=None, alias="countertopMaterialId")


class UpdateKitComponentCmd(BaseModel):
    """AST-V3-04 — patch a single component in a placed kitchen kit."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_kit_component"] = "update_kit_component"
    id: str
    component_index: int = Field(alias="componentIndex")
    width_mm: float | None = Field(default=None, alias="widthMm")
    door_style: str | None = Field(default=None, alias="doorStyle")
    material_id: str | None = Field(default=None, alias="materialId")


# ---------------------------------------------------------------------------
# IMP-V3-01 — Image-as-underlay commands
# ---------------------------------------------------------------------------

_ALLOWED_IMAGE_PREFIXES = (
    "data:image/png",
    "data:image/jpeg",
    "data:application/pdf",
)

_MAX_SRC_BYTES = 50 * 1024 * 1024  # 50 MB


class ImportImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — import a raster or PDF file as a plan-canvas underlay."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["import_image_underlay"] = "import_image_underlay"
    id: str | None = None
    src: str
    rect_mm: dict = Field(alias="rectMm")
    rotation_deg: float = Field(0.0, alias="rotationDeg")
    opacity: float = 0.4
    locked_scale: bool = Field(False, alias="lockedScale")


class MoveImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — reposition an image underlay (preserves width/height)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["move_image_underlay"] = "move_image_underlay"
    id: str
    rect_mm: dict = Field(alias="rectMm")


class ScaleImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — resize an image underlay's width/height."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["scale_image_underlay"] = "scale_image_underlay"
    id: str
    width_mm: float = Field(alias="widthMm")
    height_mm: float = Field(alias="heightMm")


class RotateImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — rotate an image underlay."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["rotate_image_underlay"] = "rotate_image_underlay"
    id: str
    rotation_deg: float = Field(alias="rotationDeg")


class DeleteImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — remove an image underlay from the model."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_image_underlay"] = "delete_image_underlay"
    id: str


# ---------------------------------------------------------------------------
# CON-V3-02 — Concept seed handoff contract (T6 → T9)
# ---------------------------------------------------------------------------


class CreateConceptSeedCmd(BaseModel):
    """CON-V3-02 — create a concept seed in draft state."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_concept_seed"] = "create_concept_seed"
    id: str
    model_id: str = Field(alias="modelId")
    source_underlay_id: str | None = Field(default=None, alias="sourceUnderlayId")
    envelope_tokens: list[dict] = Field(default_factory=list, alias="envelopeTokens")
    kernel_element_drafts: list[dict] = Field(default_factory=list, alias="kernelElementDrafts")
    assumptions_log: list[dict] = Field(default_factory=list, alias="assumptionsLog")


class CommitConceptSeedCmd(BaseModel):
    """CON-V3-02 — transitions a ConceptSeedElem from draft → committed."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["commit_concept_seed"] = "commit_concept_seed"
    id: str
    envelope_tokens: list[dict] | None = Field(default=None, alias="envelopeTokens")
    kernel_element_drafts: list[dict] | None = Field(default=None, alias="kernelElementDrafts")
    assumptions_log: list[dict] | None = Field(default=None, alias="assumptionsLog")


class ConsumeConceptSeedCmd(BaseModel):
    """CON-V3-02 — T9 marks a seed as consumed after ingesting it."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["consume_concept_seed"] = "consume_concept_seed"
    id: str


# ---------------------------------------------------------------------------
# OUT-V3-02 — Presentation canvas, frames, saved views
# ---------------------------------------------------------------------------


class CreatePresentationCanvasCmd(BaseModel):
    """OUT-V3-02 — create a named presentation canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_presentation_canvas"] = "create_presentation_canvas"
    id: str
    name: str


class UpdatePresentationCanvasCmd(BaseModel):
    """OUT-V3-02 — rename a presentation canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_presentation_canvas"] = "update_presentation_canvas"
    id: str
    name: str | None = None


class CreateFrameCmd(BaseModel):
    """OUT-V3-02 — add a frame (slide crop) on a presentation canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_frame"] = "create_frame"
    id: str
    presentation_canvas_id: str = Field(alias="presentationCanvasId")
    view_id: str = Field(alias="viewId")
    position_mm: dict = Field(alias="positionMm")  # {xMm, yMm}
    size_mm: dict = Field(alias="sizeMm")  # {widthMm, heightMm}
    caption: str | None = None
    brand_template_id: str | None = Field(default=None, alias="brandTemplateId")
    sort_order: int = Field(0, alias="sortOrder")


class UpdateFrameCmd(BaseModel):
    """OUT-V3-02 — update caption, position, size, or sort order of a frame."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_frame"] = "update_frame"
    id: str
    caption: str | None = None
    position_mm: dict | None = Field(default=None, alias="positionMm")
    size_mm: dict | None = Field(default=None, alias="sizeMm")
    sort_order: int | None = Field(default=None, alias="sortOrder")


class DeleteFrameCmd(BaseModel):
    """OUT-V3-02 — delete a frame from a canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_frame"] = "delete_frame"
    id: str


class ReorderFrameCmd(BaseModel):
    """OUT-V3-02 — move a frame to a new sort position; re-normalises all frames on the canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reorder_frame"] = "reorder_frame"
    id: str
    new_sort_order: int = Field(alias="newSortOrder")


class CreateSavedViewCmd(BaseModel):
    """OUT-V3-02 — save a camera + visibility snapshot on a base view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_saved_view"] = "create_saved_view"
    id: str
    base_view_id: str = Field(alias="baseViewId")
    name: str
    camera_state: dict | None = Field(default=None, alias="cameraState")
    visibility_overrides: dict | None = Field(default=None, alias="visibilityOverrides")
    detail_level: str | None = Field(default=None, alias="detailLevel")


class UpdateSavedViewCmd(BaseModel):
    """OUT-V3-02 — patch a saved view's name, camera, visibility or thumbnail."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_saved_view"] = "update_saved_view"
    id: str
    name: str | None = None
    camera_state: dict | None = Field(default=None, alias="cameraState")
    visibility_overrides: dict | None = Field(default=None, alias="visibilityOverrides")
    detail_level: str | None = Field(default=None, alias="detailLevel")
    thumbnail_data_uri: str | None = Field(default=None, alias="thumbnailDataUri")


class DeleteSavedViewCmd(BaseModel):
    """OUT-V3-02 — delete a saved view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_saved_view"] = "delete_saved_view"
    id: str


# ---------------------------------------------------------------------------
# OUT-V3-03 — BrandTemplate commands
# ---------------------------------------------------------------------------


class CreateBrandTemplateCmd(BaseModel):
    """OUT-V3-03 — create a brand template for Layer-C CSS overrides."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_brand_template"] = "create_brand_template"
    id: str
    name: str
    accent_hex: str = Field(alias="accentHex")
    accent_foreground_hex: str = Field(alias="accentForegroundHex")
    typeface: str = "Inter"
    logo_mark_svg_uri: str | None = Field(default=None, alias="logoMarkSvgUri")
    css_override_snippet: str | None = Field(default=None, alias="cssOverrideSnippet")


class UpdateBrandTemplateCmd(BaseModel):
    """OUT-V3-03 — patch fields on an existing brand template."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_brand_template"] = "update_brand_template"
    id: str
    name: str | None = None
    accent_hex: str | None = Field(default=None, alias="accentHex")
    accent_foreground_hex: str | None = Field(default=None, alias="accentForegroundHex")
    typeface: str | None = None
    logo_mark_svg_uri: str | None = Field(default=None, alias="logoMarkSvgUri")
    css_override_snippet: str | None = Field(default=None, alias="cssOverrideSnippet")


class DeleteBrandTemplateCmd(BaseModel):
    """OUT-V3-03 — delete a brand template."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_brand_template"] = "delete_brand_template"
    id: str


class ReorderViewCmd(BaseModel):
    """CHR-V3-07 — move a viewpoint or saved_view to a new sort position."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reorder_view"] = "reorder_view"
    view_id: str = Field(alias="viewId")
    new_sort_order: int = Field(alias="newSortOrder")


# ---------------------------------------------------------------------------
# MEP commands — pipe, duct, pipe legend, duct legend (MEP-01..04)
# ---------------------------------------------------------------------------


class CreatePipeCmd(BaseModel):
    """MEP-01 — create a straight pipe segment."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPipe"] = "createPipe"
    id: str | None = None
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    diameter_mm: float = Field(default=25.0, alias="diameterMm")
    system_type: Literal[
        "hvac_supply",
        "hvac_return",
        "heating",
        "cooling",
        "domestic_water",
        "wastewater",
        "electrical",
        "data",
        "domestic_cold_water",
        "domestic_hot_water",
        "sanitary",
        "storm_drainage",
        "fire_protection",
        "chilled_water",
        "condenser_water",
        "heating_hot_water",
        "other",
    ] = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    flow_direction: Literal[
        "supply", "return", "exhaust", "bidirectional", "none", "unknown"
    ] = Field(default="unknown", alias="flowDirection")
    insulation: str | None = Field(default=None)
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[dict[str, Any]] = Field(default_factory=list)
    material_key: str | None = Field(default=None, alias="materialKey")
    colour: str | None = Field(default=None)


class CreateDuctCmd(BaseModel):
    """MEP-02 — create a straight duct segment."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDuct"] = "createDuct"
    id: str | None = None
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    width_mm: float = Field(default=300.0, alias="widthMm")
    height_mm: float = Field(default=200.0, alias="heightMm")
    shape: Literal["rectangular", "round", "oval"] = Field(default="rectangular")
    system_type: Literal[
        "hvac_supply",
        "hvac_return",
        "heating",
        "cooling",
        "fire_protection",
        "supply_air",
        "return_air",
        "exhaust_air",
        "outside_air",
        "other_air",
        "other",
    ] = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    flow_direction: Literal[
        "supply", "return", "exhaust", "bidirectional", "none", "unknown"
    ] = Field(default="unknown", alias="flowDirection")
    insulation: str | None = Field(default=None)
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[dict[str, Any]] = Field(default_factory=list)
    colour: str | None = Field(default=None)


MepSystemCmdType = Literal[
    "hvac_supply",
    "hvac_return",
    "heating",
    "cooling",
    "domestic_water",
    "wastewater",
    "electrical",
    "data",
    "fire_protection",
    "other",
]


class CreateCableTrayCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createCableTray"] = "createCableTray"
    id: str | None = None
    name: str = "Cable tray"
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    width_mm: float = Field(default=200.0, alias="widthMm")
    height_mm: float = Field(default=60.0, alias="heightMm")
    system_type: MepSystemCmdType = Field(default="electrical", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[dict[str, Any]] = Field(default_factory=list)
    colour: str | None = Field(default=None)


class CreateMepEquipmentCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMepEquipment"] = "createMepEquipment"
    id: str | None = None
    name: str = "MEP Equipment"
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    equipment_type: str | None = Field(default=None, alias="equipmentType")
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    system_type: MepSystemCmdType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[dict[str, Any]] = Field(default_factory=list)
    electrical_load_w: float | None = Field(default=None, alias="electricalLoadW")


class CreateFixtureCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createFixture"] = "createFixture"
    id: str | None = None
    name: str = "Fixture"
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    room_id: str | None = Field(default=None, alias="roomId")
    fixture_type: str | None = Field(default=None, alias="fixtureType")
    system_type: MepSystemCmdType = Field(default="domestic_water", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    connectors: list[dict[str, Any]] = Field(default_factory=list)
    electrical_load_w: float | None = Field(default=None, alias="electricalLoadW")


class CreateMepTerminalCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMepTerminal"] = "createMepTerminal"
    id: str | None = None
    name: str = "MEP Terminal"
    terminal_kind: Literal["diffuser", "terminal", "sprinkler", "device"] = Field(
        default="terminal", alias="terminalKind"
    )
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    room_id: str | None = Field(default=None, alias="roomId")
    system_type: MepSystemCmdType = Field(default="hvac_supply", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    flow_direction: Literal[
        "supply", "return", "exhaust", "bidirectional", "none", "unknown"
    ] = Field(default="supply", alias="flowDirection")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    connectors: list[dict[str, Any]] = Field(default_factory=list)


class CreateMepOpeningRequestCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMepOpeningRequest"] = "createMepOpeningRequest"
    id: str | None = None
    name: str = "MEP opening request"
    host_element_id: str = Field(alias="hostElementId")
    level_id: str | None = Field(default=None, alias="levelId")
    requester_element_ids: list[str] = Field(default_factory=list, alias="requesterElementIds")
    opening_kind: Literal["wall", "slab", "roof", "shaft"] = Field(
        default="wall", alias="openingKind"
    )
    position_mm: Vec2Mm | None = Field(default=None, alias="positionMm")
    width_mm: float | None = Field(default=None, alias="widthMm")
    height_mm: float | None = Field(default=None, alias="heightMm")
    diameter_mm: float | None = Field(default=None, alias="diameterMm")
    clearance_mm: float = Field(default=50.0, alias="clearanceMm")
    system_type: MepSystemCmdType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")


class CreatePipeLegendCmd(BaseModel):
    """MEP-03 — place a pipe legend in a view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPipeLegend"] = "createPipeLegend"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[dict] = Field(default_factory=list)
    title: str = Field(default="Pipe Legend")


class CreateDuctLegendCmd(BaseModel):
    """MEP-04 — place a duct legend in a view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDuctLegend"] = "createDuctLegend"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[dict] = Field(default_factory=list)
    title: str = Field(default="Duct Legend")


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
    | CreateAngularDimensionCmd
    | DeleteElementCmd
    | DeleteElementsCmd
    | RestoreElementCmd
    | CreateRoomOutlineCmd
    | CreateRoomRectangleCmd
    | CreateRoomPolyCmd
    | PlaceRoomAtPointCmd
    | MoveLevelElevationCmd
    | CreateIssueFromViolationCmd
    | UpdateIssueStatusCmd
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
    | SetStairSubKindCmd
    | UpdateStairTreadsCmd
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
    | UpdatePlanRegionCmd
    | DeletePlanRegionCmd
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
    | UpdateLinkDxfCmd
    | CreateExternalLinkCmd
    | UpdateExternalLinkCmd
    | DeleteExternalLinkCmd
    | UpsertSelectionSetCmd
    | UpsertClashTestCmd
    | RunClashTestCmd
    | BumpMonitoredRevisionsCmd
    | ReconcileMonitoredElementCmd
    | PlaceTagCmd
    | ClearAutoGeneratedAnnotationsCmd
    | CreateDetailLineCmd
    | CreateDetailRegionCmd
    | CreateSpotElevationCmd
    | CreateSpotCoordinateCmd
    | CreateSpotSlopeCmd
    | CreateInsulationAnnotationCmd
    | CreateRadialDimensionCmd
    | CreateDiameterDimensionCmd
    | CreateArcLengthDimensionCmd
    | CreateMaterialTagCmd
    | CreateMultiCategoryTagCmd
    | CreateTreadNumberCmd
    | CreateKeynoteCmd
    | CreateSpanDirectionCmd
    | CreateDetailComponentCmd
    | CreateRepeatingDetailCmd
    | CreateDetailGroupCmd
    | CreateColorFillLegendCmd
    | CreateTextNoteCmd
    | CreateReferencePlaneCmd
    | UpdateReferencePlaneCmd
    | DeleteReferencePlaneCmd
    | CreatePropertyLineCmd
    | UpdatePropertyLineCmd
    | DeletePropertyLineCmd
    | CreateSweepCmd
    | CreateDormerCmd
    | CreateRoofJoinCmd
    | CreateEdgeProfileRunCmd
    | SetEdgeProfileRunModeCmd
    | CreateSoffitCmd
    | SetWallRecessZonesCmd
    | CreateAnnotationSymbolCmd
    | CreateAreaCmd
    | UpdateAreaCmd
    | DeleteAreaCmd
    | CreateMaskingRegionCmd
    | UpdateMaskingRegionCmd
    | DeleteMaskingRegionCmd
    | CreateRevisionCloudCmd
    | SplitWallAtCmd
    | AlignElementToReferenceCmd
    | TrimElementToReferenceCmd
    | TrimExtendToCornerCmd
    | SetWallJoinVariantCmd
    | SetWallJoinDisallowCmd
    | CreateColumnCmd
    | CreateBeamCmd
    | CreateCeilingCmd
    | CreateMassCmd
    | MaterializeMassToWallsCmd
    | CreateVoidCutCmd
    | CreateConstraintCmd
    | CreatePhaseCmd
    | RenamePhaseCmd
    | ReorderPhaseCmd
    | DeletePhaseCmd
    | SetElementPhaseCmd
    | SetElementDisciplineCmd
    | SetViewPhaseCmd
    | SetViewPhaseFilterCmd
    | SetViewLensCmd
    | SetElementConstructionCmd
    | CreateConstructionPackageCmd
    | CreateConstructionLogisticsCmd
    | UpsertConstructionQaChecklistCmd
    | CreateSunSettingsCmd
    | UpdateSunSettingsCmd
    | MoveElementCmd
    | SetWallStackCmd
    | SetWallLeanTaperCmd
    | SetRailingBalusterPatternCmd
    | SetRailingHandrailSupportsCmd
    | CreateOptionSetCmd
    | AddOptionCmd
    | RemoveOptionCmd
    | SetPrimaryOptionCmd
    | AssignElementToOptionCmd
    | SetViewOptionLockCmd
    | CreateSheetCmd
    | PlaceViewOnSheetCmd
    | MoveViewOnSheetCmd
    | RemoveViewFromSheetCmd
    | SetSheetTitleblockCmd
    | UpdateSheetMetadataCmd
    | CreateWindowLegendViewCmd
    | CreateDraftingViewCmd
    | CreateViewCalloutCmd
    | SetElementOverrideCmd
    | AddViewBreakCmd
    | RemoveViewBreakCmd
    | HideElementInViewCmd
    | UnhideElementInViewCmd
    | CreateViewTemplateCmd
    | UpdateViewTemplateCmd
    | ApplyViewTemplateCmd
    | UnbindViewTemplateCmd
    | DeleteViewTemplateCmd
    | CreateToposolidCmd
    | UpdateToposolidCmd
    | DeleteToposolidCmd
    | CreateToposolidSubdivisionCmd
    | UpdateToposolidSubdivisionCmd
    | DeleteToposolidSubdivisionCmd
    | CreateGradedRegionCmd
    | UpdateGradedRegionCmd
    | DeleteGradedRegionCmd
    | CreateToposolidExcavationCmd
    | UpdateToposolidExcavationCmd
    | DeleteToposolidExcavationCmd
    | IndexAssetCmd
    | PlaceAssetCmd
    | PlaceFamilyInstanceCmd
    | MoveAssetDeltaCmd
    | MoveColumnDeltaCmd
    | MoveElementsDeltaCmd
    | RotateElementsCmd
    | SetToolPrefCmd
    | TraceImageCmd
    | UpdateWallCmd
    | UpdateDoorCmd
    | UpdateWindowCmd
    | UpdateColumnCmd
    | UpdateMaterialPbrCmd
    | CreateDecalCmd
    | CreatePropertyDefinitionCmd
    | SetElementPropCmd
    | CreateScheduleViewCmd
    | DrawDetailRegionCmd
    | UpdateDetailRegionCmd
    | PlaceKitCmd
    | UpdateKitComponentCmd
    | ImportImageUnderlayCmd
    | MoveImageUnderlayCmd
    | ScaleImageUnderlayCmd
    | RotateImageUnderlayCmd
    | DeleteImageUnderlayCmd
    | CreateConceptSeedCmd
    | CommitConceptSeedCmd
    | ConsumeConceptSeedCmd
    | CreatePresentationCanvasCmd
    | UpdatePresentationCanvasCmd
    | CreateFrameCmd
    | UpdateFrameCmd
    | DeleteFrameCmd
    | ReorderFrameCmd
    | CreateSavedViewCmd
    | UpdateSavedViewCmd
    | DeleteSavedViewCmd
    | CreateBrandTemplateCmd
    | UpdateBrandTemplateCmd
    | DeleteBrandTemplateCmd
    | ReorderViewCmd
    | CreatePipeCmd
    | CreateDuctCmd
    | CreateCableTrayCmd
    | CreateMepEquipmentCmd
    | CreateFixtureCmd
    | CreateMepTerminalCmd
    | CreateMepOpeningRequestCmd
    | CreatePipeLegendCmd
    | CreateDuctLegendCmd,
    Field(discriminator="type"),
]
