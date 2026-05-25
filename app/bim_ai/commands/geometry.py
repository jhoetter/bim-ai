"""Geometry-domain command models.

Walls, levels, floors, roofs, slabs, openings, stairs, railings, balconies,
grid lines, wall types, sweeps/dormers/edge profiles/soffits, curtain panels.

BRT-22 split — these classes used to live in ``app/bim_ai/commands.py``. The
wire format (``Command`` discriminator + JSON aliases) is unchanged.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from bim_ai.elements import (
    BalusterPattern,
    CurtainPanelOverride,
    DormerPositionOnRoof,
    DormerRoofKind,
    HandrailSupport,
    StairLanding,
    StairRun,
    StairTreadLine,
    SweepPathPoint,
    SweepProfilePlane,
    SweepProfilePoint,
    Vec2Mm,
    WallCurve,
    WallLocationLine,
    WallRecessZone,
    WallStructuralRole,
    WallTypeLayer,
)
from bim_ai.roof_geometry import MonoPitchHighEdge, RoofGeometryMode


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
    allow_detached: bool = Field(default=False, alias="allowDetached")
    authoring_intent: str | None = Field(default=None, alias="authoringIntent")
    physical_role: str | None = Field(default=None, alias="physicalRole")
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


class MoveLevelElevationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveLevelElevation"] = "moveLevelElevation"
    level_id: str = Field(alias="levelId")
    elevation_mm: float = Field(alias="elevationMm")
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


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
    # MF-12 (nightshift): 'up' (default) extrudes above level; 'down'
    # places slab top AT level so the level plane is the finished floor.
    slab_extrude_direction: Literal["up", "down"] = Field(
        default="up", alias="slabExtrudeDirection"
    )
    floor_type_id: str | None = Field(default=None, alias="floorTypeId")
    room_bounded: bool = Field(default=False, alias="roomBounded")
    allow_detached: bool = Field(default=False, alias="allowDetached")
    authoring_intent: str | None = Field(default=None, alias="authoringIntent")
    physical_role: str | None = Field(default=None, alias="physicalRole")
    props: dict[str, Any] | None = Field(default=None)


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
    # ISSUE-53: compass quadrant of the high (ridge) edge for `mono_pitch`
    # (Pultdach) roofs. None → derive from the longer footprint span.
    mono_pitch_high_edge: MonoPitchHighEdge | None = Field(
        default=None, alias="monoPitchHighEdge"
    )
    # ISSUE-105: fraction of the gable rise replaced by a hip cap for
    # `half_gable` (Krüppelwalmdach). 0..1; 0 ≡ full gable, 1 ≡ full hip.
    # Ignored for non-half_gable modes.
    half_hip_height_fraction: float | None = Field(
        default=None, alias="halfHipHeightFraction"
    )
    roof_type_id: str | None = Field(default=None, alias="roofTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")
    # NS-2026-05-24: explicit ridge orientation override. Engine default
    # heuristic is `ridge_along_x = span_x >= span_y` (longer footprint
    # axis carries the ridge). For Doppelhaus halves and other rectangles
    # where the source elevations contradict the heuristic, set this to
    # force ridge orientation independent of footprint proportions.
    ridge_along_x: bool | None = Field(default=None, alias="ridgeAlongX")

    @field_validator("roof_geometry_mode", mode="before")
    @classmethod
    def _normalize_roof_geometry_mode(cls, value: Any) -> Any:
        if value == "gable":
            return "gable_pitched_rectangle"
        # ISSUE-53: accept common aliases for the Pultdach mode so authoring
        # callers don't have to know the kernel literal verbatim.
        if value in ("mono_slope", "shed", "pultdach", "lean_to"):
            return "mono_pitch"
        # ISSUE-105: aliases for the Krüppelwalmdach (half-hipped) mode.
        if value in (
            "kruppelwalm",
            "krueppelwalm",
            "kruppelwalmdach",
            "krueppelwalmdach",
            "half_hipped",
            "halfhipped",
            "jerkin_head",
            "clipped_gable",
        ):
            return "half_gable"
        return value


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


class AttachWallTopCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["attachWallTop"] = "attachWallTop"
    wall_id: str = Field(alias="wallId")
    target_id: str = Field(alias="targetId")
    target_kind: str = Field(alias="targetKind", default="roof")
    host_face: str = Field(alias="hostFace", default="bottom")


class DetachWallTopCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["detachWallTop"] = "detachWallTop"
    wall_id: str = Field(alias="wallId")


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
    allow_detached: bool = Field(default=False, alias="allowDetached")
    props: dict[str, Any] | None = Field(default=None)

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
    host_floor_id: str | None = Field(default=None, alias="hostFloorId")
    host_wall_id: str | None = Field(default=None, alias="hostWallId")
    host_edge_id: str | None = Field(default=None, alias="hostEdgeId")
    path_mm: list[Vec2Mm] = Field(alias="pathMm")
    guard_height_mm: float = Field(default=1040, alias="guardHeightMm", gt=0)
    baluster_pattern: BalusterPattern | None = Field(default=None, alias="balusterPattern")
    handrail_supports: list[HandrailSupport] | None = Field(default=None, alias="handrailSupports")
    material_slots: dict[str, str | None] | None = Field(default=None, alias="materialSlots")


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


class SetCurtainPanelOverrideCmd(BaseModel):
    """KRN-09 — install / remove a per-cell override on a curtain wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setCurtainPanelOverride"] = "setCurtainPanelOverride"
    wall_id: str = Field(alias="wallId")
    grid_cell_id: str = Field(alias="gridCellId")
    # `None` clears the override for the cell (revert to default glass).
    override: CurtainPanelOverride | None = None


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


class UpdateWallCmd(BaseModel):
    """EDT-V3-06 — patch a wall's length or thickness from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateWall"] = "updateWall"
    id: str
    length_mm: float | None = Field(default=None, alias="lengthMm", gt=0)
    thickness_mm: float | None = Field(default=None, alias="thicknessMm", gt=0)
    # TOP-V3-04: optional site host binding update.
    site_host_id: str | None = Field(default=None, alias="siteHostId")
