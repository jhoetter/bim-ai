from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import Vec2Mm


class CreatePipeCmd(BaseModel):
    """MEP-01 - create a straight pipe segment."""

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
    flow_direction: Literal["supply", "return", "exhaust", "bidirectional", "none", "unknown"] = (
        Field(default="unknown", alias="flowDirection")
    )
    insulation: str | None = Field(default=None)
    service_level: str | None = Field(default=None, alias="serviceLevel")
    clearance_zone: dict[str, Any] | None = Field(default=None, alias="clearanceZone")
    maintain_access_zone: dict[str, Any] | None = Field(default=None, alias="maintainAccessZone")
    connectors: list[dict[str, Any]] = Field(default_factory=list)
    material_key: str | None = Field(default=None, alias="materialKey")
    colour: str | None = Field(default=None)


class CreateDuctCmd(BaseModel):
    """MEP-02 - create a straight duct segment."""

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
    flow_direction: Literal["supply", "return", "exhaust", "bidirectional", "none", "unknown"] = (
        Field(default="unknown", alias="flowDirection")
    )
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
    flow_direction: Literal["supply", "return", "exhaust", "bidirectional", "none", "unknown"] = (
        Field(default="supply", alias="flowDirection")
    )
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
    """MEP-03 - place a pipe legend in a view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPipeLegend"] = "createPipeLegend"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[dict] = Field(default_factory=list)
    title: str = Field(default="Pipe Legend")


class CreateDuctLegendCmd(BaseModel):
    """MEP-04 - place a duct legend in a view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createDuctLegend"] = "createDuctLegend"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[dict] = Field(default_factory=list)
    title: str = Field(default="Duct Legend")
