"""Typed semantic authoring helpers for agent-built command bundles.

This module deliberately stops at validated kernel command payloads. It does not
look up model state or call the database, so callers must provide explicit host
ids and geometry when an operation needs them.
"""

from __future__ import annotations

import math
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator, model_validator

from bim_ai.cmd.types import AssumptionEntry, CommandBundle
from bim_ai.commands import (
    Command,
    CreateBeamCmd,
    CreateCableTrayCmd,
    CreateColumnCmd,
    CreateConstraintCmd,
    CreateConstructionLogisticsCmd,
    CreateConstructionPackageCmd,
    CreateDuctCmd,
    CreateFixtureCmd,
    CreateFloorCmd,
    CreateMepEquipmentCmd,
    CreateMepOpeningRequestCmd,
    CreateMepTerminalCmd,
    CreatePipeCmd,
    CreateRailingCmd,
    CreateRoofCmd,
    CreateRoofOpeningCmd,
    CreateRoomOutlineCmd,
    CreateSavedViewCmd,
    CreateSlabOpeningCmd,
    CreateStairCmd,
    CreateWallChainCmd,
    CreateWallCmd,
    InsertDoorOnWallCmd,
    InsertWindowOnWallCmd,
    SaveViewpointCmd,
    UpdateColumnCmd,
    UpsertConstructionQaChecklistCmd,
    UpsertPlanViewCmd,
    UpsertSheetCmd,
    UpsertSheetViewportsCmd,
)

SemanticOperation = Literal[
    "wall",
    "wall_chain",
    "floor_from_boundary",
    "floor_from_wall_segments",
    "door_on_wall",
    "window_on_wall",
    "roof_opening",
    "roof_from_boundary",
    "roof_from_wall_segments",
    "room_outline",
    "stair_between_levels",
    "slab_opening",
    "shaft_opening",
    "railing",
    "structure_column",
    "structure_beam",
    "structure_column_update",
    "structure_constraint",
    "construction_package",
    "construction_logistics",
    "construction_qa_checklist",
    "save_3d_view",
    "plan_view",
    "sheet_with_viewports",
    "mep_pipe_route",
    "mep_duct_route",
    "mep_cable_tray",
    "mep_equipment",
    "mep_fixture",
    "mep_terminal",
    "mep_opening_request",
]

SUPPORTED_OPERATIONS: tuple[str, ...] = (
    "wall",
    "wall_chain",
    "floor_from_boundary",
    "floor_from_wall_segments",
    "door_on_wall",
    "window_on_wall",
    "roof_opening",
    "roof_from_boundary",
    "roof_from_wall_segments",
    "room_outline",
    "stair_between_levels",
    "slab_opening",
    "shaft_opening",
    "railing",
    "structure_column",
    "structure_beam",
    "structure_column_update",
    "structure_constraint",
    "construction_package",
    "construction_logistics",
    "construction_qa_checklist",
    "save_3d_view",
    "plan_view",
    "sheet_with_viewports",
    "mep_pipe_route",
    "mep_duct_route",
    "mep_cable_tray",
    "mep_equipment",
    "mep_fixture",
    "mep_terminal",
    "mep_opening_request",
)

UNSUPPORTED_M2_OPERATIONS: dict[str, str] = {
    "floor_from_wall_ids": "Requires model-state lookup of wall endpoints before createFloor.",
    "roof_from_wall_ids": "Requires model-state lookup of wall endpoints before createRoof.",
    "room_from_wall_enclosure": "placeRoomAtPoint exists but requires an existing closed model enclosure.",
    "stair_by_runs": "createStair has run fields, but this helper only covers clear straight stairs.",
    "sheet_auto_layout": "Viewport layout needs view extents/model context; explicit viewports are supported.",
    "save_3d_current_view": "Requires live viewer camera state; provide camera for saveViewpoint or baseViewId for create_saved_view.",
}

_COMMAND_ADAPTER: TypeAdapter[Command] = TypeAdapter(Command)


class SemanticAuthoringError(ValueError):
    """Base exception for semantic authoring helper failures."""


class UnsupportedSemanticOperationError(SemanticAuthoringError):
    """Raised when a requested semantic operation needs model context or unsupported logic."""

    def __init__(self, operation: str, reason: str | None = None) -> None:
        self.operation = operation
        self.reason = reason or UNSUPPORTED_M2_OPERATIONS.get(operation, "Unsupported operation.")
        super().__init__(f"{operation}: {self.reason}")


class Point2(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")

    @field_validator("x_mm", "y_mm")
    @classmethod
    def _finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("point coordinates must be finite")
        return value

    def wire(self) -> dict[str, float]:
        return self.model_dump(by_alias=True)


MepSystemType = Literal[
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

MepFlowDirection = Literal["supply", "return", "exhaust", "bidirectional", "none", "unknown"]


class WallSegmentInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    start: Point2
    end: Point2
    thickness_mm: float = Field(default=200, alias="thicknessMm", gt=0)
    height_mm: float = Field(default=2800, alias="heightMm", gt=0)

    @model_validator(mode="after")
    def _not_degenerate(self) -> WallSegmentInput:
        if _same_point(self.start, self.end):
            raise ValueError("wall segment start and end must differ")
        return self


class WallPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Wall"
    level_id: str = Field(alias="levelId", min_length=1)
    start: Point2
    end: Point2
    thickness_mm: float = Field(default=200, alias="thicknessMm", gt=0)
    height_mm: float = Field(default=2800, alias="heightMm", gt=0)
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    location_line: str = Field(default="wall-centerline", alias="locationLine")
    base_constraint_level_id: str | None = Field(default=None, alias="baseConstraintLevelId")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")
    material_key: str | None = Field(default=None, alias="materialKey")
    load_bearing: bool | None = Field(default=None, alias="loadBearing")
    structural_role: str = Field(default="unknown", alias="structuralRole")
    analytical_participation: bool = Field(default=False, alias="analyticalParticipation")

    @model_validator(mode="after")
    def _not_degenerate(self) -> WallPayload:
        if _same_point(self.start, self.end):
            raise ValueError("wall start and end must differ")
        return self


class SemanticBundle(BaseModel):
    """Reusable dry-run/commit-ready command bundle payload."""

    model_config = ConfigDict(populate_by_name=True)

    operation: str
    commands: list[dict[str, Any]]
    todo: list[dict[str, str]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def command_bundle_payload(
        self,
        *,
        parent_revision: int,
        assumptions: list[dict[str, Any] | AssumptionEntry] | None = None,
        target_option_id: str | None = None,
        mode: Literal["dry_run", "commit"] = "dry_run",
    ) -> dict[str, Any]:
        """Return CMD-v3 payload accepted by POST /api/models/{id}/bundles."""

        assumption_rows = assumptions or [
            {
                "key": f"semantic_authoring.{self.operation}",
                "value": True,
                "confidence": 1.0,
                "source": "semantic_authoring_helper",
                "contestable": False,
            }
        ]
        bundle = CommandBundle(
            commands=self.commands,
            assumptions=assumption_rows,
            parentRevision=parent_revision,
            targetOptionId=target_option_id,
        )
        return {"bundle": bundle.model_dump(by_alias=True, exclude_none=True), "mode": mode}

    def legacy_command_bundle_payload(self) -> dict[str, Any]:
        """Return raw command bundle body accepted by /commands/bundle or /dry-run."""

        return {"commands": self.commands}


class WallChainPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    level_id: str = Field(alias="levelId", min_length=1)
    points: list[Point2] = Field(min_length=2)
    closed: bool = False
    name_prefix: str = Field(default="Wall", alias="namePrefix")
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    thickness_mm: float = Field(default=200, alias="thicknessMm", gt=0)
    height_mm: float = Field(default=2800, alias="heightMm", gt=0)


class BoundaryPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str
    level_id: str = Field(alias="levelId", min_length=1)
    boundary_mm: list[Point2] = Field(alias="boundaryMm", min_length=3)


class FloorFromBoundaryPayload(BoundaryPayload):
    name: str = "Floor"
    thickness_mm: float = Field(default=220, alias="thicknessMm", gt=0)
    structure_thickness_mm: float = Field(default=140, alias="structureThicknessMm", ge=0)
    finish_thickness_mm: float = Field(default=0, alias="finishThicknessMm", ge=0)
    floor_type_id: str | None = Field(default=None, alias="floorTypeId")
    room_bounded: bool = Field(default=False, alias="roomBounded")

    @model_validator(mode="after")
    def _valid_floor_boundary(self) -> FloorFromBoundaryPayload:
        if getattr(self, "wall_segments", None):
            return self
        self.boundary_mm = _normalize_polygon(self.boundary_mm)
        return self


class FloorFromWallSegmentsPayload(FloorFromBoundaryPayload):
    boundary_mm: list[Point2] = Field(default_factory=list, alias="boundaryMm")
    wall_segments: list[WallSegmentInput] = Field(alias="wallSegments", min_length=3)

    @model_validator(mode="after")
    def _derive_boundary(self) -> FloorFromWallSegmentsPayload:
        self.boundary_mm = _polygon_from_wall_segments(self.wall_segments)
        return self


class RoofFromBoundaryPayload(BoundaryPayload):
    name: str = "Roof"
    reference_level_id: str = Field(alias="referenceLevelId", min_length=1)
    level_id: str = Field(default="", exclude=True)
    overhang_mm: float = Field(default=400, alias="overhangMm", ge=0)
    slope_deg: float | None = Field(default=25, alias="slopeDeg")
    roof_geometry_mode: str = Field(default="mass_box", alias="roofGeometryMode")
    roof_type_id: str | None = Field(default=None, alias="roofTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")

    @model_validator(mode="after")
    def _valid_roof_boundary(self) -> RoofFromBoundaryPayload:
        if getattr(self, "wall_segments", None):
            return self
        self.boundary_mm = _normalize_polygon(self.boundary_mm)
        return self


class RoofFromWallSegmentsPayload(RoofFromBoundaryPayload):
    boundary_mm: list[Point2] = Field(default_factory=list, alias="boundaryMm")
    wall_segments: list[WallSegmentInput] = Field(alias="wallSegments", min_length=3)

    @model_validator(mode="after")
    def _derive_boundary(self) -> RoofFromWallSegmentsPayload:
        self.boundary_mm = _polygon_from_wall_segments(self.wall_segments)
        return self


class OpeningPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str
    wall_id: str = Field(alias="wallId", min_length=1)
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", gt=0)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")


class DoorOnWallPayload(OpeningPayload):
    name: str = "Door"
    width_mm: float = Field(default=900, alias="widthMm", gt=0)


class WindowOnWallPayload(OpeningPayload):
    name: str = "Window"
    width_mm: float = Field(default=1200, alias="widthMm", gt=0)
    sill_height_mm: float = Field(default=900, alias="sillHeightMm", ge=0)
    height_mm: float = Field(default=1500, alias="heightMm", gt=0)


class RoofOpeningPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Roof opening"
    host_roof_id: str = Field(alias="hostRoofId", min_length=1)
    boundary_mm: list[Point2] = Field(alias="boundaryMm", min_length=3)

    @model_validator(mode="after")
    def _valid_boundary(self) -> RoofOpeningPayload:
        self.boundary_mm = _normalize_polygon(self.boundary_mm)
        return self


class RoomOutlinePayload(BoundaryPayload):
    name: str = "Room"
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = None
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2", gt=0)

    @model_validator(mode="after")
    def _valid_room_boundary(self) -> RoomOutlinePayload:
        self.boundary_mm = _normalize_polygon(self.boundary_mm)
        return self


class StairBetweenLevelsPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Stair"
    base_level_id: str = Field(alias="baseLevelId", min_length=1)
    top_level_id: str = Field(alias="topLevelId", min_length=1)
    run_start_mm: Point2 = Field(alias="runStartMm")
    run_end_mm: Point2 = Field(alias="runEndMm")
    width_mm: float = Field(default=1000, alias="widthMm", gt=0)
    riser_mm: float = Field(default=175, alias="riserMm", gt=0)
    tread_mm: float = Field(default=275, alias="treadMm", gt=0)

    @model_validator(mode="after")
    def _valid_stair(self) -> StairBetweenLevelsPayload:
        if self.base_level_id == self.top_level_id:
            raise ValueError("stair requires distinct baseLevelId and topLevelId")
        if _same_point(self.run_start_mm, self.run_end_mm):
            raise ValueError("stair runStartMm and runEndMm must differ")
        return self


class SlabOpeningPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Slab opening"
    host_floor_id: str = Field(alias="hostFloorId", min_length=1)
    boundary_mm: list[Point2] = Field(alias="boundaryMm", min_length=3)
    is_shaft: bool = Field(default=False, alias="isShaft")

    @model_validator(mode="after")
    def _valid_boundary(self) -> SlabOpeningPayload:
        self.boundary_mm = _normalize_polygon(self.boundary_mm)
        return self


class ShaftOpeningPayload(SlabOpeningPayload):
    name: str = "Shaft opening"
    is_shaft: bool = Field(default=True, alias="isShaft")

    @model_validator(mode="after")
    def _force_shaft_marker(self) -> ShaftOpeningPayload:
        self.is_shaft = True
        return self


class RailingPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Railing"
    hosted_stair_id: str | None = Field(default=None, alias="hostedStairId")
    path_mm: list[Point2] = Field(alias="pathMm", min_length=2)
    baluster_pattern: dict[str, Any] | None = Field(default=None, alias="balusterPattern")
    handrail_supports: list[dict[str, Any]] | None = Field(default=None, alias="handrailSupports")

    @model_validator(mode="after")
    def _valid_path(self) -> RailingPayload:
        for index in range(len(self.path_mm) - 1):
            if _same_point(self.path_mm[index], self.path_mm[index + 1]):
                raise ValueError("railing pathMm contains a zero-length segment")
        return self


class StructureColumnPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Column"
    level_id: str = Field(alias="levelId", min_length=1)
    position_mm: Point2 = Field(alias="positionMm")
    b_mm: float = Field(default=300, alias="bMm", gt=0)
    h_mm: float = Field(default=300, alias="hMm", gt=0)
    height_mm: float = Field(default=2800, alias="heightMm", gt=0)
    rotation_deg: float = Field(default=0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


class StructureColumnUpdatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str = Field(min_length=1)
    b_mm: float | None = Field(default=None, alias="bMm", gt=0)
    h_mm: float | None = Field(default=None, alias="hMm", gt=0)

    @model_validator(mode="after")
    def _has_update(self) -> StructureColumnUpdatePayload:
        if self.b_mm is None and self.h_mm is None:
            raise ValueError("structure_column_update requires bMm or hMm")
        return self


class StructureBeamPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Beam"
    level_id: str = Field(alias="levelId", min_length=1)
    start_mm: Point2 = Field(alias="startMm")
    end_mm: Point2 = Field(alias="endMm")
    width_mm: float = Field(default=200, alias="widthMm", gt=0)
    height_mm: float = Field(default=400, alias="heightMm", gt=0)
    material_key: str | None = Field(default=None, alias="materialKey")

    @model_validator(mode="after")
    def _not_degenerate(self) -> StructureBeamPayload:
        if _same_point(self.start_mm, self.end_mm):
            raise ValueError("beam startMm and endMm must differ")
        return self


class StructureConstraintPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = ""
    rule: Literal["equal_distance", "equal_length", "parallel", "perpendicular", "collinear"]
    refs_a: list[dict[str, Any]] = Field(alias="refsA", min_length=1)
    refs_b: list[dict[str, Any]] = Field(alias="refsB", min_length=1)
    locked_value_mm: float | None = Field(default=None, alias="lockedValueMm")
    severity: Literal["warning", "error"] = "error"


class ConstructionPackagePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = Field(min_length=1)
    code: str | None = None
    phase_id: str | None = Field(default=None, alias="phaseId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    actual_start: str | None = Field(default=None, alias="actualStart")
    actual_end: str | None = Field(default=None, alias="actualEnd")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    dependencies: list[str] = Field(default_factory=list)


class ConstructionLogisticsPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = Field(min_length=1)
    logistics_kind: str = Field(alias="logisticsKind", min_length=1)
    boundary_mm: list[Point2] = Field(default_factory=list, alias="boundaryMm")
    path_mm: list[Point2] = Field(default_factory=list, alias="pathMm")
    phase_id: str | None = Field(default=None, alias="phaseId")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    progress_status: str = Field(default="not_started", alias="progressStatus")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")

    @model_validator(mode="after")
    def _has_geometry(self) -> ConstructionLogisticsPayload:
        if len(self.boundary_mm) < 3 and len(self.path_mm) < 2:
            raise ValueError("construction_logistics requires boundaryMm or pathMm")
        if self.boundary_mm:
            self.boundary_mm = _normalize_polygon(self.boundary_mm)
        for index in range(len(self.path_mm) - 1):
            if _same_point(self.path_mm[index], self.path_mm[index + 1]):
                raise ValueError("construction_logistics pathMm contains a zero-length segment")
        return self


class ConstructionQaChecklistPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = Field(min_length=1)
    target_element_ids: list[str] = Field(default_factory=list, alias="targetElementIds")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    phase_id: str | None = Field(default=None, alias="phaseId")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    progress_status: str = Field(default="not_started", alias="progressStatus")
    checklist: list[dict[str, Any]] = Field(default_factory=list)


class MepRoutePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str | None = None
    level_id: str = Field(alias="levelId", min_length=1)
    start_mm: Point2 = Field(alias="startMm")
    end_mm: Point2 = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    system_type: str = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    flow_direction: MepFlowDirection = Field(default="unknown", alias="flowDirection")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[dict[str, Any]] = Field(default_factory=list)
    colour: str | None = Field(default=None)

    @model_validator(mode="after")
    def _not_degenerate(self) -> MepRoutePayload:
        if _same_point(self.start_mm, self.end_mm):
            raise ValueError("MEP route startMm and endMm must differ")
        return self


class MepPipeRoutePayload(MepRoutePayload):
    diameter_mm: float = Field(default=25.0, alias="diameterMm", gt=0)
    insulation: str | None = None
    material_key: str | None = Field(default=None, alias="materialKey")


class MepDuctRoutePayload(MepRoutePayload):
    width_mm: float = Field(default=300.0, alias="widthMm", gt=0)
    height_mm: float = Field(default=200.0, alias="heightMm", gt=0)
    shape: Literal["rectangular", "round", "oval"] = "rectangular"
    insulation: str | None = None


class MepCableTrayPayload(MepRoutePayload):
    name: str | None = "Cable tray"
    system_type: MepSystemType = Field(default="electrical", alias="systemType")
    width_mm: float = Field(default=200.0, alias="widthMm", gt=0)
    height_mm: float = Field(default=60.0, alias="heightMm", gt=0)


class MepPlacedPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str
    level_id: str = Field(alias="levelId", min_length=1)
    position_mm: Point2 = Field(alias="positionMm")
    system_type: MepSystemType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    connectors: list[dict[str, Any]] = Field(default_factory=list)


class MepEquipmentPayload(MepPlacedPayload):
    name: str = "MEP Equipment"
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    equipment_type: str | None = Field(default=None, alias="equipmentType")
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    electrical_load_w: float | None = Field(default=None, alias="electricalLoadW", ge=0)


class MepFixturePayload(MepPlacedPayload):
    name: str = "Fixture"
    room_id: str | None = Field(default=None, alias="roomId")
    fixture_type: str | None = Field(default=None, alias="fixtureType")
    system_type: MepSystemType = Field(default="domestic_water", alias="systemType")
    electrical_load_w: float | None = Field(default=None, alias="electricalLoadW", ge=0)


class MepTerminalPayload(MepPlacedPayload):
    name: str = "MEP Terminal"
    terminal_kind: Literal["diffuser", "terminal", "sprinkler", "device"] = Field(
        default="terminal", alias="terminalKind"
    )
    room_id: str | None = Field(default=None, alias="roomId")
    system_type: MepSystemType = Field(default="hvac_supply", alias="systemType")
    flow_direction: MepFlowDirection = Field(default="supply", alias="flowDirection")
    service_level: str | None = Field(default=None, alias="serviceLevel")


class MepOpeningRequestPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "MEP opening request"
    host_element_id: str = Field(alias="hostElementId", min_length=1)
    level_id: str | None = Field(default=None, alias="levelId")
    requester_element_ids: list[str] = Field(default_factory=list, alias="requesterElementIds")
    opening_kind: Literal["wall", "slab", "roof", "shaft"] = Field(
        default="wall", alias="openingKind"
    )
    position_mm: Point2 | None = Field(default=None, alias="positionMm")
    width_mm: float | None = Field(default=None, alias="widthMm", gt=0)
    height_mm: float | None = Field(default=None, alias="heightMm", gt=0)
    diameter_mm: float | None = Field(default=None, alias="diameterMm", gt=0)
    clearance_mm: float = Field(default=50.0, alias="clearanceMm", ge=0)
    system_type: MepSystemType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")


class PlanViewPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Plan view"
    level_id: str = Field(alias="levelId", min_length=1)
    discipline: str = "architecture"
    plan_view_subtype: str | None = Field(default=None, alias="planViewSubtype")


class Save3dViewPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Viewpoint"
    camera: dict[str, Any] | None = None
    base_view_id: str | None = Field(default=None, alias="baseViewId")
    camera_state: dict[str, Any] | None = Field(default=None, alias="cameraState")
    visibility_overrides: dict[str, Any] | None = Field(default=None, alias="visibilityOverrides")
    detail_level: str | None = Field(default=None, alias="detailLevel")
    mode: Literal["plan_2d", "orbit_3d", "plan_canvas"] = "orbit_3d"
    viewer_clip_cap_elev_mm: float | None = Field(default=None, alias="viewerClipCapElevMm")
    viewer_clip_floor_elev_mm: float | None = Field(default=None, alias="viewerClipFloorElevMm")
    hidden_semantic_kinds_3d: list[str] = Field(default_factory=list, alias="hiddenSemanticKinds3d")
    cutaway_style: Literal["none", "cap", "floor", "box"] | None = Field(
        default=None, alias="cutawayStyle"
    )

    @model_validator(mode="after")
    def _has_supported_source(self) -> Save3dViewPayload:
        if self.base_view_id:
            if not self.id:
                raise ValueError("save_3d_view create_saved_view mode requires id")
            return self
        if self.camera:
            return self
        raise ValueError(
            "save_3d_view requires camera for saveViewpoint or baseViewId for create_saved_view"
        )


class ViewportPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    viewport_id: str = Field(alias="viewportId", min_length=1)
    view_ref: str = Field(alias="viewRef", min_length=1)
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    width_mm: float = Field(alias="widthMm", gt=0)
    height_mm: float = Field(alias="heightMm", gt=0)

    @field_validator("x_mm", "y_mm", "width_mm", "height_mm")
    @classmethod
    def _finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("viewport dimensions must be finite")
        return value


class SheetWithViewportsPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    name: str = "Sheet"
    title_block: str | None = Field(default=None, alias="titleBlock")
    paper_width_mm: float | None = Field(default=None, alias="paperWidthMm", gt=0)
    paper_height_mm: float | None = Field(default=None, alias="paperHeightMm", gt=0)
    titleblock_parameters: dict[str, str] | None = Field(default=None, alias="titleblockParameters")
    viewports_mm: list[ViewportPayload] = Field(default_factory=list, alias="viewportsMm")


def build_semantic_authoring_bundle(
    operation: SemanticOperation | str, payload: dict[str, Any] | BaseModel
) -> SemanticBundle:
    """Dispatch an agent-friendly payload to validated kernel command dicts."""

    if operation not in SUPPORTED_OPERATIONS:
        raise UnsupportedSemanticOperationError(str(operation))
    data = payload.model_dump(by_alias=True) if isinstance(payload, BaseModel) else payload
    if operation == "wall":
        return wall_bundle(WallPayload.model_validate(data))
    if operation == "wall_chain":
        return wall_chain_bundle(WallChainPayload.model_validate(data))
    if operation == "floor_from_boundary":
        return floor_from_boundary_bundle(FloorFromBoundaryPayload.model_validate(data))
    if operation == "floor_from_wall_segments":
        return floor_from_boundary_bundle(FloorFromWallSegmentsPayload.model_validate(data))
    if operation == "door_on_wall":
        return door_on_wall_bundle(DoorOnWallPayload.model_validate(data))
    if operation == "window_on_wall":
        return window_on_wall_bundle(WindowOnWallPayload.model_validate(data))
    if operation == "roof_opening":
        return roof_opening_bundle(RoofOpeningPayload.model_validate(data))
    if operation == "roof_from_boundary":
        return roof_from_boundary_bundle(RoofFromBoundaryPayload.model_validate(data))
    if operation == "roof_from_wall_segments":
        return roof_from_boundary_bundle(RoofFromWallSegmentsPayload.model_validate(data))
    if operation == "room_outline":
        return room_outline_bundle(RoomOutlinePayload.model_validate(data))
    if operation == "stair_between_levels":
        return stair_between_levels_bundle(StairBetweenLevelsPayload.model_validate(data))
    if operation == "slab_opening":
        return slab_opening_bundle(SlabOpeningPayload.model_validate(data))
    if operation == "shaft_opening":
        return slab_opening_bundle(
            ShaftOpeningPayload.model_validate(data), operation="shaft_opening"
        )
    if operation == "railing":
        return railing_bundle(RailingPayload.model_validate(data))
    if operation == "structure_column":
        return structure_column_bundle(StructureColumnPayload.model_validate(data))
    if operation == "structure_beam":
        return structure_beam_bundle(StructureBeamPayload.model_validate(data))
    if operation == "structure_column_update":
        return structure_column_update_bundle(StructureColumnUpdatePayload.model_validate(data))
    if operation == "structure_constraint":
        return structure_constraint_bundle(StructureConstraintPayload.model_validate(data))
    if operation == "construction_package":
        return construction_package_bundle(ConstructionPackagePayload.model_validate(data))
    if operation == "construction_logistics":
        return construction_logistics_bundle(ConstructionLogisticsPayload.model_validate(data))
    if operation == "construction_qa_checklist":
        return construction_qa_checklist_bundle(ConstructionQaChecklistPayload.model_validate(data))
    if operation == "save_3d_view":
        return save_3d_view_bundle(Save3dViewPayload.model_validate(data))
    if operation == "plan_view":
        return plan_view_bundle(PlanViewPayload.model_validate(data))
    if operation == "sheet_with_viewports":
        return sheet_with_viewports_bundle(SheetWithViewportsPayload.model_validate(data))
    if operation == "mep_pipe_route":
        return mep_pipe_route_bundle(MepPipeRoutePayload.model_validate(data))
    if operation == "mep_duct_route":
        return mep_duct_route_bundle(MepDuctRoutePayload.model_validate(data))
    if operation == "mep_cable_tray":
        return mep_cable_tray_bundle(MepCableTrayPayload.model_validate(data))
    if operation == "mep_equipment":
        return mep_equipment_bundle(MepEquipmentPayload.model_validate(data))
    if operation == "mep_fixture":
        return mep_fixture_bundle(MepFixturePayload.model_validate(data))
    if operation == "mep_terminal":
        return mep_terminal_bundle(MepTerminalPayload.model_validate(data))
    if operation == "mep_opening_request":
        return mep_opening_request_bundle(MepOpeningRequestPayload.model_validate(data))
    raise UnsupportedSemanticOperationError(str(operation))


def unsupported_semantic_operation(operation: str) -> None:
    raise UnsupportedSemanticOperationError(operation)


def wall_bundle(payload: WallPayload) -> SemanticBundle:
    command = CreateWallCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        start=payload.start.wire(),
        end=payload.end.wire(),
        thicknessMm=payload.thickness_mm,
        heightMm=payload.height_mm,
        wallTypeId=payload.wall_type_id,
        locationLine=payload.location_line,
        baseConstraintLevelId=payload.base_constraint_level_id,
        topConstraintLevelId=payload.top_constraint_level_id,
        baseConstraintOffsetMm=payload.base_constraint_offset_mm,
        topConstraintOffsetMm=payload.top_constraint_offset_mm,
        materialKey=payload.material_key,
        loadBearing=payload.load_bearing,
        structuralRole=payload.structural_role,
        analyticalParticipation=payload.analytical_participation,
    )
    return _bundle("wall", [command])


def wall_chain_bundle(payload: WallChainPayload) -> SemanticBundle:
    points = list(payload.points)
    if payload.closed and not _same_point(points[0], points[-1]):
        points.append(points[0])
    segments = []
    for index in range(len(points) - 1):
        start = points[index]
        end = points[index + 1]
        if _same_point(start, end):
            raise SemanticAuthoringError("wall chain contains a zero-length segment")
        segments.append(
            {
                "start": start.wire(),
                "end": end.wire(),
                "thicknessMm": payload.thickness_mm,
                "heightMm": payload.height_mm,
            }
        )
    command = CreateWallChainCmd(
        levelId=payload.level_id,
        namePrefix=payload.name_prefix,
        wallTypeId=payload.wall_type_id,
        segments=segments,
    )
    return _bundle("wall_chain", [command])


def floor_from_boundary_bundle(payload: FloorFromBoundaryPayload) -> SemanticBundle:
    command = CreateFloorCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        boundaryMm=[p.wire() for p in payload.boundary_mm],
        thicknessMm=payload.thickness_mm,
        structureThicknessMm=payload.structure_thickness_mm,
        finishThicknessMm=payload.finish_thickness_mm,
        floorTypeId=payload.floor_type_id,
        roomBounded=payload.room_bounded,
    )
    return _bundle("floor_from_boundary", [command])


def door_on_wall_bundle(payload: DoorOnWallPayload) -> SemanticBundle:
    command = InsertDoorOnWallCmd(
        id=payload.id,
        name=payload.name,
        wallId=payload.wall_id,
        alongT=payload.along_t,
        widthMm=payload.width_mm,
        familyTypeId=payload.family_type_id,
    )
    return _bundle("door_on_wall", [command])


def window_on_wall_bundle(payload: WindowOnWallPayload) -> SemanticBundle:
    command = InsertWindowOnWallCmd(
        id=payload.id,
        name=payload.name,
        wallId=payload.wall_id,
        alongT=payload.along_t,
        widthMm=payload.width_mm,
        sillHeightMm=payload.sill_height_mm,
        heightMm=payload.height_mm,
        familyTypeId=payload.family_type_id,
    )
    return _bundle("window_on_wall", [command])


def roof_opening_bundle(payload: RoofOpeningPayload) -> SemanticBundle:
    command = CreateRoofOpeningCmd(
        id=payload.id,
        name=payload.name,
        hostRoofId=payload.host_roof_id,
        boundaryMm=[p.wire() for p in payload.boundary_mm],
    )
    return _bundle("roof_opening", [command])


def roof_from_boundary_bundle(payload: RoofFromBoundaryPayload) -> SemanticBundle:
    command = CreateRoofCmd(
        id=payload.id,
        name=payload.name,
        referenceLevelId=payload.reference_level_id,
        footprintMm=[p.wire() for p in payload.boundary_mm],
        overhangMm=payload.overhang_mm,
        slopeDeg=payload.slope_deg,
        roofGeometryMode=payload.roof_geometry_mode,
        roofTypeId=payload.roof_type_id,
        materialKey=payload.material_key,
    )
    return _bundle("roof_from_boundary", [command])


def room_outline_bundle(payload: RoomOutlinePayload) -> SemanticBundle:
    command = CreateRoomOutlineCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        outlineMm=[p.wire() for p in payload.boundary_mm],
        programmeCode=payload.programme_code,
        department=payload.department,
        functionLabel=payload.function_label,
        finishSet=payload.finish_set,
        targetAreaM2=payload.target_area_m2,
    )
    return _bundle("room_outline", [command])


def stair_between_levels_bundle(payload: StairBetweenLevelsPayload) -> SemanticBundle:
    command = CreateStairCmd(
        id=payload.id,
        name=payload.name,
        baseLevelId=payload.base_level_id,
        topLevelId=payload.top_level_id,
        runStartMm=payload.run_start_mm.wire(),
        runEndMm=payload.run_end_mm.wire(),
        widthMm=payload.width_mm,
        riserMm=payload.riser_mm,
        treadMm=payload.tread_mm,
    )
    return _bundle("stair_between_levels", [command])


def slab_opening_bundle(
    payload: SlabOpeningPayload, *, operation: str = "slab_opening"
) -> SemanticBundle:
    command = CreateSlabOpeningCmd(
        id=payload.id,
        name=payload.name,
        hostFloorId=payload.host_floor_id,
        boundaryMm=[p.wire() for p in payload.boundary_mm],
        isShaft=payload.is_shaft,
    )
    return _bundle(operation, [command])


def railing_bundle(payload: RailingPayload) -> SemanticBundle:
    command = CreateRailingCmd(
        id=payload.id,
        name=payload.name,
        hostedStairId=payload.hosted_stair_id,
        pathMm=[p.wire() for p in payload.path_mm],
        balusterPattern=payload.baluster_pattern,
        handrailSupports=payload.handrail_supports,
    )
    return _bundle("railing", [command])


def structure_column_bundle(payload: StructureColumnPayload) -> SemanticBundle:
    command = CreateColumnCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        positionMm=payload.position_mm.wire(),
        bMm=payload.b_mm,
        hMm=payload.h_mm,
        heightMm=payload.height_mm,
        rotationDeg=payload.rotation_deg,
        materialKey=payload.material_key,
    )
    return _bundle("structure_column", [command])


def structure_column_update_bundle(payload: StructureColumnUpdatePayload) -> SemanticBundle:
    command = UpdateColumnCmd(id=payload.id, bMm=payload.b_mm, hMm=payload.h_mm)
    return _bundle("structure_column_update", [command])


def structure_beam_bundle(payload: StructureBeamPayload) -> SemanticBundle:
    command = CreateBeamCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        startMm=payload.start_mm.wire(),
        endMm=payload.end_mm.wire(),
        widthMm=payload.width_mm,
        heightMm=payload.height_mm,
        materialKey=payload.material_key,
    )
    return _bundle("structure_beam", [command])


def structure_constraint_bundle(payload: StructureConstraintPayload) -> SemanticBundle:
    command = CreateConstraintCmd(
        id=payload.id,
        name=payload.name,
        rule=payload.rule,
        refsA=payload.refs_a,
        refsB=payload.refs_b,
        lockedValueMm=payload.locked_value_mm,
        severity=payload.severity,
    )
    return _bundle("structure_constraint", [command])


def construction_package_bundle(payload: ConstructionPackagePayload) -> SemanticBundle:
    command = CreateConstructionPackageCmd(
        id=payload.id,
        name=payload.name,
        code=payload.code,
        phaseId=payload.phase_id,
        plannedStart=payload.planned_start,
        plannedEnd=payload.planned_end,
        actualStart=payload.actual_start,
        actualEnd=payload.actual_end,
        responsibleCompany=payload.responsible_company,
        dependencies=payload.dependencies,
    )
    return _bundle("construction_package", [command])


def construction_logistics_bundle(payload: ConstructionLogisticsPayload) -> SemanticBundle:
    command = CreateConstructionLogisticsCmd(
        id=payload.id,
        name=payload.name,
        logisticsKind=payload.logistics_kind,
        boundaryMm=[p.wire() for p in payload.boundary_mm],
        pathMm=[p.wire() for p in payload.path_mm],
        phaseId=payload.phase_id,
        constructionPackageId=payload.construction_package_id,
        plannedStart=payload.planned_start,
        plannedEnd=payload.planned_end,
        progressStatus=payload.progress_status,
        responsibleCompany=payload.responsible_company,
    )
    return _bundle("construction_logistics", [command])


def construction_qa_checklist_bundle(payload: ConstructionQaChecklistPayload) -> SemanticBundle:
    command = UpsertConstructionQaChecklistCmd(
        id=payload.id,
        name=payload.name,
        targetElementIds=payload.target_element_ids,
        constructionPackageId=payload.construction_package_id,
        phaseId=payload.phase_id,
        responsibleCompany=payload.responsible_company,
        progressStatus=payload.progress_status,
        checklist=payload.checklist,
    )
    return _bundle("construction_qa_checklist", [command])


def mep_pipe_route_bundle(payload: MepPipeRoutePayload) -> SemanticBundle:
    command = CreatePipeCmd(
        id=payload.id,
        levelId=payload.level_id,
        startMm=payload.start_mm.wire(),
        endMm=payload.end_mm.wire(),
        elevationMm=payload.elevation_mm,
        diameterMm=payload.diameter_mm,
        systemType=payload.system_type,
        systemName=payload.system_name,
        flowDirection=payload.flow_direction,
        insulation=payload.insulation,
        serviceLevel=payload.service_level,
        clearanceZone=payload.clearance_zone,
        maintainAccessZone=payload.maintain_access_zone,
        connectors=payload.connectors,
        materialKey=payload.material_key,
        colour=payload.colour,
    )
    return _bundle("mep_pipe_route", [command])


def mep_duct_route_bundle(payload: MepDuctRoutePayload) -> SemanticBundle:
    command = CreateDuctCmd(
        id=payload.id,
        levelId=payload.level_id,
        startMm=payload.start_mm.wire(),
        endMm=payload.end_mm.wire(),
        elevationMm=payload.elevation_mm,
        widthMm=payload.width_mm,
        heightMm=payload.height_mm,
        shape=payload.shape,
        systemType=payload.system_type,
        systemName=payload.system_name,
        flowDirection=payload.flow_direction,
        insulation=payload.insulation,
        serviceLevel=payload.service_level,
        clearanceZone=payload.clearance_zone,
        maintainAccessZone=payload.maintain_access_zone,
        connectors=payload.connectors,
        colour=payload.colour,
    )
    return _bundle("mep_duct_route", [command])


def mep_cable_tray_bundle(payload: MepCableTrayPayload) -> SemanticBundle:
    command = CreateCableTrayCmd(
        id=payload.id,
        name=payload.name or "Cable tray",
        levelId=payload.level_id,
        startMm=payload.start_mm.wire(),
        endMm=payload.end_mm.wire(),
        elevationMm=payload.elevation_mm,
        widthMm=payload.width_mm,
        heightMm=payload.height_mm,
        systemType=payload.system_type,
        systemName=payload.system_name,
        serviceLevel=payload.service_level,
        clearanceZone=payload.clearance_zone,
        maintainAccessZone=payload.maintain_access_zone,
        connectors=payload.connectors,
        colour=payload.colour,
    )
    return _bundle("mep_cable_tray", [command])


def mep_equipment_bundle(payload: MepEquipmentPayload) -> SemanticBundle:
    command = CreateMepEquipmentCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        positionMm=payload.position_mm.wire(),
        elevationMm=payload.elevation_mm,
        equipmentType=payload.equipment_type,
        familyTypeId=payload.family_type_id,
        systemType=payload.system_type,
        systemName=payload.system_name,
        serviceLevel=payload.service_level,
        clearanceZone=payload.clearance_zone,
        maintainAccessZone=payload.maintain_access_zone,
        connectors=payload.connectors,
        electricalLoadW=payload.electrical_load_w,
    )
    return _bundle("mep_equipment", [command])


def mep_fixture_bundle(payload: MepFixturePayload) -> SemanticBundle:
    command = CreateFixtureCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        positionMm=payload.position_mm.wire(),
        roomId=payload.room_id,
        fixtureType=payload.fixture_type,
        systemType=payload.system_type,
        systemName=payload.system_name,
        connectors=payload.connectors,
        electricalLoadW=payload.electrical_load_w,
    )
    return _bundle("mep_fixture", [command])


def mep_terminal_bundle(payload: MepTerminalPayload) -> SemanticBundle:
    command = CreateMepTerminalCmd(
        id=payload.id,
        name=payload.name,
        terminalKind=payload.terminal_kind,
        levelId=payload.level_id,
        positionMm=payload.position_mm.wire(),
        roomId=payload.room_id,
        systemType=payload.system_type,
        systemName=payload.system_name,
        flowDirection=payload.flow_direction,
        serviceLevel=payload.service_level,
        connectors=payload.connectors,
    )
    return _bundle("mep_terminal", [command])


def mep_opening_request_bundle(payload: MepOpeningRequestPayload) -> SemanticBundle:
    command = CreateMepOpeningRequestCmd(
        id=payload.id,
        name=payload.name,
        hostElementId=payload.host_element_id,
        levelId=payload.level_id,
        requesterElementIds=payload.requester_element_ids,
        openingKind=payload.opening_kind,
        positionMm=payload.position_mm.wire() if payload.position_mm else None,
        widthMm=payload.width_mm,
        heightMm=payload.height_mm,
        diameterMm=payload.diameter_mm,
        clearanceMm=payload.clearance_mm,
        systemType=payload.system_type,
        systemName=payload.system_name,
    )
    return _bundle("mep_opening_request", [command])


def plan_view_bundle(payload: PlanViewPayload) -> SemanticBundle:
    command = UpsertPlanViewCmd(
        id=payload.id,
        name=payload.name,
        levelId=payload.level_id,
        discipline=payload.discipline,
        planViewSubtype=payload.plan_view_subtype,
    )
    return _bundle("plan_view", [command])


def save_3d_view_bundle(payload: Save3dViewPayload) -> SemanticBundle:
    if payload.base_view_id:
        command = CreateSavedViewCmd(
            id=payload.id or "",
            name=payload.name,
            baseViewId=payload.base_view_id,
            cameraState=payload.camera_state or payload.camera,
            visibilityOverrides=payload.visibility_overrides,
            detailLevel=payload.detail_level,
        )
        return _bundle("save_3d_view", [command])
    command = SaveViewpointCmd(
        id=payload.id,
        name=payload.name,
        camera=payload.camera,
        mode=payload.mode,
        viewerClipCapElevMm=payload.viewer_clip_cap_elev_mm,
        viewerClipFloorElevMm=payload.viewer_clip_floor_elev_mm,
        hiddenSemanticKinds3d=payload.hidden_semantic_kinds_3d,
        cutawayStyle=payload.cutaway_style,
    )
    return _bundle("save_3d_view", [command])


def sheet_with_viewports_bundle(payload: SheetWithViewportsPayload) -> SemanticBundle:
    commands: list[BaseModel] = [
        UpsertSheetCmd(
            id=payload.id,
            name=payload.name,
            titleBlock=payload.title_block,
            paperWidthMm=payload.paper_width_mm,
            paperHeightMm=payload.paper_height_mm,
            titleblockParameters=payload.titleblock_parameters,
        )
    ]
    if payload.id and payload.viewports_mm:
        commands.append(
            UpsertSheetViewportsCmd(
                sheetId=payload.id,
                viewportsMm=[v.model_dump(by_alias=True) for v in payload.viewports_mm],
            )
        )
    elif payload.viewports_mm:
        raise SemanticAuthoringError(
            "sheet_with_viewports requires id when viewportsMm are provided"
        )
    return _bundle("sheet_with_viewports", commands)


def _bundle(operation: str, commands: list[BaseModel]) -> SemanticBundle:
    raw = [c.model_dump(by_alias=True, exclude_none=True) for c in commands]
    validated = [
        _COMMAND_ADAPTER.validate_python(command).model_dump(by_alias=True, exclude_none=True)
        for command in raw
    ]
    return SemanticBundle(
        operation=operation,
        commands=validated,
        metadata={
            "format": "semanticAuthoringBundle_v1",
            "kernelCommandTypes": [str(c["type"]) for c in validated],
        },
    )


def _normalize_polygon(points: list[Point2]) -> list[Point2]:
    normalized = list(points)
    if len(normalized) >= 2 and _same_point(normalized[0], normalized[-1]):
        normalized = normalized[:-1]
    if len(normalized) < 3:
        raise ValueError("boundary requires at least three unique points")
    unique = {(p.x_mm, p.y_mm) for p in normalized}
    if len(unique) < 3:
        raise ValueError("boundary requires at least three unique points")
    return normalized


def _polygon_from_wall_segments(segments: list[WallSegmentInput]) -> list[Point2]:
    points = [segments[0].start]
    cursor = segments[0].end
    for segment in segments[1:]:
        if not _same_point(cursor, segment.start):
            raise ValueError("wallSegments must be ordered and contiguous")
        points.append(segment.start)
        cursor = segment.end
    if not _same_point(cursor, points[0]):
        raise ValueError("wallSegments must form a closed loop")
    return _normalize_polygon(points)


def _same_point(a: Point2, b: Point2, tolerance: float = 0.001) -> bool:
    return abs(a.x_mm - b.x_mm) <= tolerance and abs(a.y_mm - b.y_mm) <= tolerance
