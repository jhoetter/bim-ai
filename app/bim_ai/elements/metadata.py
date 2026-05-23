"""Project-metadata element models that don't fit a single geometric family:
phase, property definitions, selection sets, clash tests, energy-lens handoff
artifacts, etc."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import (
    EnergyHeatingStatus,
    RenovationScenarioStatus,
    ThermalBridgeMarkerType,
    Vec3Mm,
)


class PhaseElem(BaseModel):
    """KRN-V3-01 — project-level phasing primitive.

    Default chain: Existing (ord=0) → Demolition (ord=1) → New (ord=2).
    ``ord`` governs display order and element classification: phase_created.ord ==
    view.phase.ord → new; < view.phase.ord → existing or demolition.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["phase"] = "phase"
    id: str
    name: str
    ord: int = 0


class PropertyDefinitionElem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["property_definition"] = "property_definition"
    id: str
    key: str
    label: str
    prop_kind: Literal["mm", "m2", "currency", "enum", "string", "bool", "date"] = Field(
        alias="propKind"
    )
    enum_values: list[str] | None = Field(default=None, alias="enumValues")
    default_value: Any | None = Field(default=None, alias="defaultValue")
    applies_to: list[str] = Field(alias="appliesTo")
    show_in_schedule: bool = Field(default=True, alias="showInSchedule")


class SelectionSetRuleSpec(BaseModel):
    """FED-02: a single rule in a selection set's filter list.

    ``link_scope`` controls which models the rule resolves against:

    * ``'host'`` (default) — only host elements match.
    * ``'all_links'`` — every ``link_model`` element is walked; matching source
      elements are included with their AABBs transformed by the link's
      ``positionMm`` + ``rotationDeg``.
    * ``{ 'specificLinkId': '<link-id>' }`` — restrict matches to a single
      link.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    field: Literal["category", "level", "typeName"]
    operator: Literal["equals", "contains"]
    value: str
    link_scope: str | dict[str, str] | None = Field(default=None, alias="linkScope")


class SelectionSetElem(BaseModel):
    """FED-02: a named filter that resolves to a list of element ids.

    Stored in the model so it can be referenced by clash tests and (later)
    schedules. The element itself is non-graphical.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["selection_set"] = "selection_set"
    id: str
    name: str = "Selection Set"
    filter_rules: list[SelectionSetRuleSpec] = Field(default_factory=list, alias="filterRules")


class ClashResultSpec(BaseModel):
    """FED-02: a single pair-wise clash between two resolved elements.

    ``link_chain_a`` / ``link_chain_b`` are empty arrays for host elements
    and ``[link_id]`` for elements pulled from a linked model. Multi-hop
    transitive links are deferred (FED-01's expander is single-hop only).
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    element_id_a: str = Field(alias="elementIdA")
    element_id_b: str = Field(alias="elementIdB")
    distance_mm: float = Field(alias="distanceMm")
    link_chain_a: list[str] = Field(default_factory=list, alias="linkChainA")
    link_chain_b: list[str] = Field(default_factory=list, alias="linkChainB")


class ClashTestElem(BaseModel):
    """FED-02: a pair of selection sets that the engine clash-tests on demand.

    ``set_a_ids`` / ``set_b_ids`` are lists of ``selection_set`` element ids
    (multiple sets are unioned). Clash detection is run by the
    ``RunClashTest`` command which writes its findings into ``results``.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["clash_test"] = "clash_test"
    id: str
    name: str = "Clash Test"
    set_a_ids: list[str] = Field(default_factory=list, alias="setAIds")
    set_b_ids: list[str] = Field(default_factory=list, alias="setBIds")
    tolerance_mm: float = Field(default=0.0, alias="toleranceMm")
    results: list[ClashResultSpec] | None = None


# ---------------------------------------------------------------------------
# ENE-V1 — Energy Lens handoff elements
# ---------------------------------------------------------------------------


class ThermalBridgeMarkerElem(BaseModel):
    """Energy Lens marker for thermal bridge review and specialist handoff."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["thermal_bridge_marker"] = "thermal_bridge_marker"
    id: str
    name: str | None = None
    marker_type: ThermalBridgeMarkerType = Field(alias="markerType")
    location_mm: Vec3Mm = Field(alias="locationMm")
    host_element_ids: list[str] = Field(default_factory=list, alias="hostElementIds")
    description: str | None = None
    suggested_mitigation: str | None = Field(default=None, alias="suggestedMitigation")
    handoff_note: str | None = Field(default=None, alias="handoffNote")
    psi_value_reference: str | None = Field(default=None, alias="psiValueReference")


class RenovationMeasurePackage(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    name: str
    notes: str | None = None
    cost_placeholder: float | None = Field(default=None, alias="costPlaceholder")


class RenovationScenarioElem(BaseModel):
    """Energy Lens branch/layer metadata for as-is and renovation variants."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["renovation_scenario"] = "renovation_scenario"
    id: str
    name: str
    scenario_status: RenovationScenarioStatus = Field(alias="scenarioStatus")
    base_scenario_id: str | None = Field(default=None, alias="baseScenarioId")
    type_layer_overrides: dict[str, Any] = Field(default_factory=dict, alias="typeLayerOverrides")
    opening_type_overrides: dict[str, Any] = Field(
        default_factory=dict, alias="openingTypeOverrides"
    )
    heating_status_overrides: dict[str, EnergyHeatingStatus] = Field(
        default_factory=dict, alias="heatingStatusOverrides"
    )
    systems_notes: str | None = Field(default=None, alias="systemsNotes")
    measure_packages: list[RenovationMeasurePackage] = Field(
        default_factory=list, alias="measurePackages"
    )


class BuildingServicesHandoffElem(BaseModel):
    """Non-simulation building-services metadata prepared for energy tools."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["building_services_handoff"] = "building_services_handoff"
    id: str
    name: str = "Building services handoff"
    scenario_id: str | None = Field(default=None, alias="scenarioId")
    services: dict[str, Any] = Field(default_factory=dict)
    handoff_note: str | None = Field(default=None, alias="handoffNote")
