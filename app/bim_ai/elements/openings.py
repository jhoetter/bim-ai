"""Door and window opening element models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.cmd.types import AgentTrace
from bim_ai.element_primitives import (
    DisciplineTag,
    ThermalClassificationSource,
    ThermalEnvelopeClassification,
    Vec2Mm,
)

from ._shared import CircularityProperties

DoorOperationType = Literal[
    "swing_single",
    "swing_double",
    "sliding_single",
    "sliding_double",
    "bi_fold",
    "pocket",
    "pivot",
    "automatic_double",
]

DoorSlidingTrackSide = Literal["wall_face", "in_pocket"]


class DoorElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["door"] = "door"
    id: str
    name: str = "Door"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=900)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")
    material_slots: dict[str, str | None] | None = Field(default=None, alias="materialSlots")
    host_cut_depth_mm: float | None = Field(default=None, alias="hostCutDepthMm")
    reveal_interior_mm: float | None = Field(default=None, alias="revealInteriorMm")
    interlock_grade: str | None = Field(default=None, alias="interlockGrade")
    lod_plan: Literal["simple", "detailed"] | None = Field(default=None, alias="lodPlan")
    operation_type: DoorOperationType | None = Field(default=None, alias="operationType")
    sliding_track_side: DoorSlidingTrackSide | None = Field(default=None, alias="slidingTrackSide")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)
    circularity: CircularityProperties | None = None
    props: dict[str, Any] | None = Field(default=None)
    thermal_classification: ThermalEnvelopeClassification | None = Field(
        default=None, alias="thermalClassification"
    )
    thermal_classification_source: ThermalClassificationSource | None = Field(
        default=None, alias="thermalClassificationSource"
    )
    u_value: float | None = Field(default=None, alias="uValue", gt=0)
    g_value: float | None = Field(default=None, alias="gValue", ge=0, le=1)
    frame_fraction: float | None = Field(default=None, alias="frameFraction", ge=0, le=1)
    air_tightness_class: str | None = Field(default=None, alias="airTightnessClass")
    installation_thermal_bridge_note: str | None = Field(
        default=None, alias="installationThermalBridgeNote"
    )
    shading_device: str | None = Field(default=None, alias="shadingDevice")
    annual_shading_factor_estimate: float | None = Field(
        default=None, alias="annualShadingFactorEstimate", ge=0, le=1
    )


WindowOutlineKind = Literal[
    "rectangle",
    "arched_top",
    "gable_trapezoid",
    "circle",
    "octagon",
    "custom",
]


class WindowElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["window"] = "window"
    id: str
    name: str = "Window"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=1200)
    sill_height_mm: float = Field(alias="sillHeightMm", default=900)
    height_mm: float = Field(alias="heightMm", default=1500)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")
    material_slots: dict[str, str | None] | None = Field(default=None, alias="materialSlots")
    host_cut_depth_mm: float | None = Field(default=None, alias="hostCutDepthMm")
    reveal_interior_mm: float | None = Field(default=None, alias="revealInteriorMm")
    interlock_grade: str | None = Field(default=None, alias="interlockGrade")
    seal_rebate_mm: float | None = Field(default=None, alias="sealRebateMm")
    lod_plan: Literal["simple", "detailed"] | None = Field(default=None, alias="lodPlan")
    outline_kind: WindowOutlineKind | None = Field(default=None, alias="outlineKind")
    outline_mm: list[Vec2Mm] | None = Field(default=None, alias="outlineMm")
    attached_roof_id: str | None = Field(default=None, alias="attachedRoofId")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)
    thermal_classification: ThermalEnvelopeClassification | None = Field(
        default=None, alias="thermalClassification"
    )
    thermal_classification_source: ThermalClassificationSource | None = Field(
        default=None, alias="thermalClassificationSource"
    )
    u_value: float | None = Field(default=None, alias="uValue", gt=0)
    g_value: float | None = Field(default=None, alias="gValue", ge=0, le=1)
    frame_fraction: float | None = Field(default=None, alias="frameFraction", ge=0, le=1)
    air_tightness_class: str | None = Field(default=None, alias="airTightnessClass")
    installation_thermal_bridge_note: str | None = Field(
        default=None, alias="installationThermalBridgeNote"
    )
    shading_device: str | None = Field(default=None, alias="shadingDevice")
    annual_shading_factor_estimate: float | None = Field(
        default=None, alias="annualShadingFactorEstimate", ge=0, le=1
    )
