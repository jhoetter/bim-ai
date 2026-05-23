"""Stair, railing, baluster and handrail element models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from bim_ai.cmd.types import AgentTrace
from bim_ai.element_primitives import (
    DisciplineTag,
    StructuralAnalysisStatus,
    StructuralRole,
    Vec2Mm,
)

StairShape = Literal["straight", "l_shape", "u_shape", "spiral", "sketch"]


class StairTreadLine(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    from_mm: Vec2Mm = Field(alias="fromMm")
    to_mm: Vec2Mm = Field(alias="toMm")
    riser_height_mm: float | None = Field(default=None, alias="riserHeightMm")
    manual_override: bool = Field(default=False, alias="manualOverride")


class StairRun(BaseModel):
    """KRN-07: one flight in a multi-run stair.

    Straight runs use start_mm/end_mm. Curved runs (spiral, sketch) populate
    polyline_mm with ≥2 plan-coordinate points; renderers read polyline_mm when
    present and fall back to start/end otherwise.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(alias="widthMm", default=1000)
    riser_count: int = Field(alias="riserCount", default=8)
    polyline_mm: list[Vec2Mm] | None = Field(default=None, alias="polylineMm")


class StairLanding(BaseModel):
    """KRN-07: a flat polygon landing between two runs."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")


class StairElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["stair"] = "stair"
    id: str
    name: str = "Stair"
    base_level_id: str = Field(alias="baseLevelId")
    top_level_id: str = Field(alias="topLevelId")
    run_start: Vec2Mm = Field(alias="runStartMm")
    run_end: Vec2Mm = Field(alias="runEndMm")
    width_mm: float = Field(alias="widthMm", default=1000)
    riser_mm: float = Field(alias="riserMm", default=175)
    tread_mm: float = Field(alias="treadMm", default=275)
    # KRN-07 — multi-run support. Defaults preserve the legacy single-run shape.
    shape: StairShape = Field(default="straight")
    runs: list[StairRun] = Field(default_factory=list)
    landings: list[StairLanding] = Field(default_factory=list)
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    # KRN-07 closeout — spiral + sketch shape inputs.
    center_mm: Vec2Mm | None = Field(default=None, alias="centerMm")
    inner_radius_mm: float | None = Field(default=None, alias="innerRadiusMm")
    outer_radius_mm: float | None = Field(default=None, alias="outerRadiusMm")
    total_rotation_deg: float | None = Field(default=None, alias="totalRotationDeg")
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
    floating_tread_depth_mm: float | None = Field(default=None, alias="floatingTreadDepthMm", gt=0)
    floating_host_wall_id: str | None = Field(default=None, alias="floatingHostWallId")
    material_slots: dict[str, str | None] | None = Field(default=None, alias="materialSlots")
    structural_role: StructuralRole = Field(default="unknown", alias="structuralRole")
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)

    @model_validator(mode="after")
    def _validate_shape_specific_fields(self) -> StairElem:
        if self.authoring_mode == "by_sketch":
            if self.boundary_mm is None or len(self.boundary_mm) < 3:
                raise ValueError("by_sketch stair requires boundaryMm with ≥ 3 points")
            if self.tread_lines is None or len(self.tread_lines) < 1:
                raise ValueError("by_sketch stair requires treadLines with ≥ 1 entry")
            if self.total_rise_mm is None or self.total_rise_mm <= 0:
                raise ValueError("by_sketch stair requires totalRiseMm > 0")
        if self.sub_kind == "floating":
            if not self.floating_host_wall_id:
                raise ValueError("'floating' stair requires floatingHostWallId")
        if self.sub_kind == "monolithic" and self.floating_host_wall_id is not None:
            raise ValueError("'monolithic' stair must not set floatingHostWallId")
        if self.authoring_mode == "by_sketch":
            return self
        if self.shape == "spiral":
            missing = [
                name
                for name, value in (
                    ("centerMm", self.center_mm),
                    ("innerRadiusMm", self.inner_radius_mm),
                    ("outerRadiusMm", self.outer_radius_mm),
                    ("totalRotationDeg", self.total_rotation_deg),
                )
                if value is None
            ]
            if missing:
                raise ValueError(
                    f"spiral stair requires {', '.join(missing)}",
                )
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


class BalusterPattern(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    rule: Literal["regular", "glass_panel", "cable"]
    spacing_mm: float | None = Field(default=None, alias="spacingMm", gt=0)
    profile_family_id: str | None = Field(default=None, alias="profileFamilyId")

    @model_validator(mode="after")
    def _validate_regular_requires_spacing(self) -> BalusterPattern:
        if self.rule == "regular" and (self.spacing_mm is None or self.spacing_mm <= 0):
            raise ValueError("balusterPattern.rule='regular' requires spacingMm > 0")
        return self


class HandrailSupport(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    interval_mm: float = Field(alias="intervalMm", gt=0)
    bracket_family_id: str = Field(alias="bracketFamilyId")
    host_wall_id: str = Field(alias="hostWallId")


class RailingElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["railing"] = "railing"
    id: str
    name: str = "Railing"
    hosted_stair_id: str | None = Field(default=None, alias="hostedStairId")
    host_floor_id: str | None = Field(default=None, alias="hostFloorId")
    host_wall_id: str | None = Field(default=None, alias="hostWallId")
    host_edge_id: str | None = Field(default=None, alias="hostEdgeId")
    path_mm: list[Vec2Mm] = Field(alias="pathMm")
    guard_height_mm: float = Field(alias="guardHeightMm", default=1040)
    baluster_pattern: BalusterPattern | None = Field(default=None, alias="balusterPattern")
    handrail_supports: list[HandrailSupport] | None = Field(default=None, alias="handrailSupports")
    material_slots: dict[str, str | None] | None = Field(default=None, alias="materialSlots")
    structural_role: StructuralRole = Field(default="unknown", alias="structuralRole")
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    discipline: DisciplineTag | None = Field(default=None)
