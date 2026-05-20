from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import DisciplineTag, Vec2Mm, Vec3Mm

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
FlowDirection = Literal["supply", "return", "exhaust", "bidirectional", "none", "unknown"]


class MepConnectorSpec(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    system_type: MepSystemType = Field(default="other", alias="systemType")
    flow_direction: FlowDirection = Field(default="unknown", alias="flowDirection")
    diameter_mm: float | None = Field(default=None, alias="diameterMm", gt=0)
    width_mm: float | None = Field(default=None, alias="widthMm", gt=0)
    height_mm: float | None = Field(default=None, alias="heightMm", gt=0)
    position_mm: Vec3Mm | None = Field(default=None, alias="positionMm")
    connected_to: str | None = Field(default=None, alias="connectedTo")


PipeSystemType = Literal[
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
]


class PipeElem(BaseModel):
    """MEP-01 - straight pipe segment between two points."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["pipe"] = "pipe"
    id: str
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    diameter_mm: float = Field(default=25.0, alias="diameterMm", gt=0)
    system_type: PipeSystemType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    flow_direction: FlowDirection = Field(default="unknown", alias="flowDirection")
    insulation: str | None = Field(default=None)
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[MepConnectorSpec] = Field(default_factory=list)
    material_key: str | None = Field(default=None, alias="materialKey")
    colour: str | None = Field(default=None)
    discipline: DisciplineTag | None = Field(default="mep")
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


DuctSystemType = Literal[
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
]
DuctShape = Literal["rectangular", "round", "oval"]


class DuctElem(BaseModel):
    """MEP-02 - straight duct segment between two points."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["duct"] = "duct"
    id: str
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    width_mm: float = Field(default=300.0, alias="widthMm", gt=0)
    height_mm: float = Field(default=200.0, alias="heightMm", gt=0)
    shape: DuctShape = Field(default="rectangular")
    system_type: DuctSystemType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    flow_direction: FlowDirection = Field(default="unknown", alias="flowDirection")
    insulation: str | None = Field(default=None)
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[MepConnectorSpec] = Field(default_factory=list)
    colour: str | None = Field(default=None)
    discipline: DisciplineTag | None = Field(default="mep")
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


class CableTrayElem(BaseModel):
    """MEP - cable tray / conduit run segment."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["cable_tray"] = "cable_tray"
    id: str
    name: str = "Cable tray"
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    width_mm: float = Field(default=200.0, alias="widthMm", gt=0)
    height_mm: float = Field(default=60.0, alias="heightMm", gt=0)
    system_type: MepSystemType = Field(default="electrical", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[MepConnectorSpec] = Field(default_factory=list)
    colour: str | None = Field(default=None)
    discipline: DisciplineTag | None = Field(default="mep")
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


class MepEquipmentElem(BaseModel):
    """MEP - system equipment with connectors and access metadata."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["mep_equipment"] = "mep_equipment"
    id: str
    name: str = "MEP Equipment"
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    equipment_type: str | None = Field(default=None, alias="equipmentType")
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    system_type: MepSystemType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[MepConnectorSpec] = Field(default_factory=list)
    electrical_load_w: float | None = Field(default=None, alias="electricalLoadW", ge=0)
    discipline: DisciplineTag | None = Field(default="mep")
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


class FixtureElem(BaseModel):
    """MEP - plumbing/electrical/fire fixture hosted by room or level."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["fixture"] = "fixture"
    id: str
    name: str = "Fixture"
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    room_id: str | None = Field(default=None, alias="roomId")
    fixture_type: str | None = Field(default=None, alias="fixtureType")
    system_type: MepSystemType = Field(default="domestic_water", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    connectors: list[MepConnectorSpec] = Field(default_factory=list)
    electrical_load_w: float | None = Field(default=None, alias="electricalLoadW", ge=0)
    discipline: DisciplineTag | None = Field(default="mep")
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


class MepTerminalElem(BaseModel):
    """MEP - diffuser, air terminal, or service terminal."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["mep_terminal"] = "mep_terminal"
    id: str
    name: str = "MEP Terminal"
    terminal_kind: Literal["diffuser", "terminal", "sprinkler", "device"] = Field(
        default="terminal", alias="terminalKind"
    )
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    room_id: str | None = Field(default=None, alias="roomId")
    system_type: MepSystemType = Field(default="hvac_supply", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    flow_direction: FlowDirection = Field(default="supply", alias="flowDirection")
    service_level: str | None = Field(default=None, alias="serviceLevel")
    connectors: list[MepConnectorSpec] = Field(default_factory=list)
    discipline: DisciplineTag | None = Field(default="mep")
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


class MepOpeningRequestElem(BaseModel):
    """Traceable MEP penetration request against architecture/structure hosts."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["mep_opening_request"] = "mep_opening_request"
    id: str
    name: str = "MEP opening request"
    host_element_id: str = Field(alias="hostElementId")
    level_id: str | None = Field(default=None, alias="levelId")
    requester_element_ids: list[str] = Field(default_factory=list, alias="requesterElementIds")
    opening_kind: Literal["wall", "slab", "roof", "shaft"] = Field(
        default="wall", alias="openingKind"
    )
    status: Literal["requested", "approved", "rejected", "installed"] = "requested"
    position_mm: Vec2Mm | None = Field(default=None, alias="positionMm")
    width_mm: float | None = Field(default=None, alias="widthMm", gt=0)
    height_mm: float | None = Field(default=None, alias="heightMm", gt=0)
    diameter_mm: float | None = Field(default=None, alias="diameterMm", gt=0)
    clearance_mm: float = Field(default=50.0, alias="clearanceMm", ge=0)
    system_type: MepSystemType = Field(default="other", alias="systemType")
    system_name: str | None = Field(default=None, alias="systemName")
    approval_note: str | None = Field(default=None, alias="approvalNote")
    discipline: DisciplineTag | None = Field(default="mep")
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


class PipeLegendEntrySpec(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    system_type: str = Field(alias="systemType")
    label: str
    colour: str


class PipeLegendElem(BaseModel):
    """MEP-03 - view-local pipe legend annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["pipe_legend"] = "pipe_legend"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[PipeLegendEntrySpec] = Field(default_factory=list)
    title: str = Field(default="Pipe Legend")


class DuctLegendEntrySpec(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    system_type: str = Field(alias="systemType")
    label: str
    colour: str


class DuctLegendElem(BaseModel):
    """MEP-04 - view-local duct legend annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["duct_legend"] = "duct_legend"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[DuctLegendEntrySpec] = Field(default_factory=list)
    title: str = Field(default="Duct Legend")
