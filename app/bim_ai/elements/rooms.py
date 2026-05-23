"""Room, level, project settings, area and room color scheme element models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import (
    EnergyHeatingStatus,
    EnergyUsageProfile,
    Vec2Mm,
)

from ._shared import MonitorSourceSpec, RoomColorSchemeRow


class ProjectSettingsElem(BaseModel):
    """Singleton-style project datum (canonical units / locale metadata)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["project_settings"] = "project_settings"
    id: str
    name: str | None = None
    project_number: str | None = Field(default=None, alias="projectNumber")
    client_name: str | None = Field(default=None, alias="clientName")
    project_address: str | None = Field(default=None, alias="projectAddress")
    project_status: str | None = Field(default=None, alias="projectStatus")
    length_unit: str = Field(default="millimeter", alias="lengthUnit")
    angular_unit_deg: str = Field(default="degree", alias="angularUnitDeg")

    display_locale: str = Field(default="en-US", alias="displayLocale")
    room_area_computation_basis: str = Field(
        default="wall_finish",
        alias="roomAreaComputationBasis",
    )
    volume_computed_at: str = Field(
        default="finish_faces",
        alias="volumeComputedAt",
    )
    checkpoint_retention_limit: int = Field(
        default=20,
        ge=1,
        le=99,
        alias="checkpointRetentionLimit",
    )
    georeference: dict[str, float] | None = Field(default=None, alias="georeference")


class RoomColorSchemeElem(BaseModel):
    """Singleton document colour overrides for programme/department fills (replayable deltas)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["room_color_scheme"] = "room_color_scheme"
    id: str
    scheme_rows: list[RoomColorSchemeRow] = Field(default_factory=list, alias="schemeRows")


class LevelElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["level"] = "level"
    id: str
    name: str = "Untitled Level"
    elevation_mm: float = Field(default=0, alias="elevationMm")
    datum_kind: str | None = Field(default=None, alias="datumKind")
    parent_level_id: str | None = Field(default=None, alias="parentLevelId")
    offset_from_parent_mm: float = Field(default=0, alias="offsetFromParentMm")
    monitor_source: MonitorSourceSpec | None = Field(default=None, alias="monitorSource")
    pinned: bool = Field(default=False)


class RoomElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["room"] = "room"
    id: str
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")
    upper_limit_level_id: str | None = Field(default=None, alias="upperLimitLevelId")
    volume_ceiling_offset_mm: float | None = Field(default=None, alias="volumeCeilingOffsetMm")
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    programme_group: str | None = Field(default=None, alias="programmeGroup")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")
    ventilation_zone: str | None = Field(default=None, alias="ventilationZone")
    heating_cooling_zone: str | None = Field(default=None, alias="heatingCoolingZone")
    design_air_change_rate: float | None = Field(default=None, alias="designAirChangeRate", ge=0)
    fixture_equipment_loads: dict[str, Any] | None = Field(
        default=None, alias="fixtureEquipmentLoads"
    )
    electrical_load_summary: dict[str, Any] | None = Field(
        default=None, alias="electricalLoadSummary"
    )
    service_requirements: list[str] = Field(default_factory=list, alias="serviceRequirements")
    room_fill_override_hex: str | None = Field(default=None, alias="roomFillOverrideHex")
    room_fill_pattern_override: (
        Literal["solid", "hatch_45", "hatch_90", "crosshatch", "dots"] | None
    ) = Field(default=None, alias="roomFillPatternOverride")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    props: dict[str, Any] | None = Field(default=None)
    heating_status: EnergyHeatingStatus | None = Field(default=None, alias="heatingStatus")
    usage_profile: EnergyUsageProfile | None = Field(default=None, alias="usageProfile")
    setpoint_c: float | None = Field(default=None, alias="setpointC")
    air_change_rate: float | None = Field(default=None, alias="airChangeRate", ge=0)
    zone_id: str | None = Field(default=None, alias="zoneId")
    conditioned_volume_included: bool | None = Field(
        default=None, alias="conditionedVolumeIncluded"
    )


AreaRuleSet = Literal["gross", "net", "no_rules"]
AreaScheme = Literal["gross_building", "net", "rentable"]


class AreaElem(BaseModel):
    """KRN-08 — `area` element kind for legal/permit area calculations.

    Distinct from `room`: areas may include exterior porches and exclude
    interior shafts based on `ruleSet`. Authored via SKT-01 sketch session.
    `computedAreaSqMm` is recomputed by the engine after every command apply.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["area"] = "area"
    id: str
    name: str = "Area"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    rule_set: AreaRuleSet = Field(default="no_rules", alias="ruleSet")
    area_scheme: AreaScheme = Field(default="gross_building", alias="areaScheme")
    apply_area_rules: bool = Field(default=True, alias="applyAreaRules")
    computed_area_sq_mm: float | None = Field(default=None, alias="computedAreaSqMm")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
