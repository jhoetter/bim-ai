"""MEP/TGA lens projections for API consumers."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    CableTrayElem,
    DuctElem,
    FixtureElem,
    MepEquipmentElem,
    MepOpeningRequestElem,
    MepTerminalElem,
    PipeElem,
    RoomElem,
)


MEP_REQUIRED_SCHEDULE_DEFAULTS: tuple[dict[str, Any], ...] = (
    {"id": "mep-equipment-schedule", "name": "MEP Equipment Schedule", "category": "equipment"},
    {"id": "mep-duct-schedule", "name": "Duct Schedule", "category": "duct"},
    {"id": "mep-pipe-schedule", "name": "Pipe Schedule", "category": "pipe"},
    {"id": "mep-fixture-schedule", "name": "Fixture Schedule", "category": "fixture"},
    {
        "id": "mep-opening-request-schedule",
        "name": "Opening Request Schedule",
        "category": "opening_request",
    },
    {"id": "mep-shaft-schedule", "name": "Shaft Schedule", "category": "shaft"},
    {
        "id": "mep-electrical-load-schedule",
        "name": "Electrical Load Schedule",
        "category": "electrical_load",
    },
)


MEP_DEFAULT_VIEW_SPECS: tuple[dict[str, Any], ...] = (
    {"name": "MEP Floor Plan - HVAC Supply", "viewType": "plan", "systemType": "hvac_supply"},
    {"name": "MEP Floor Plan - HVAC Return", "viewType": "plan", "systemType": "hvac_return"},
    {"name": "MEP Floor Plan - Plumbing", "viewType": "plan", "systemType": "domestic_water"},
    {"name": "MEP Floor Plan - Electrical", "viewType": "plan", "systemType": "electrical"},
    {"name": "Reflected Ceiling MEP Overlay", "viewType": "plan", "overlay": "reflected_ceiling"},
    {"name": "Shaft and Riser Diagram", "viewType": "diagram", "focus": "shaft_riser"},
    {"name": "3D System Isolation", "viewType": "3d", "focus": "system_isolation"},
    {"name": "Coordination Section", "viewType": "section", "focus": "coordination"},
)


def _dump(el: Any) -> dict[str, Any]:
    return el.model_dump(by_alias=True, exclude_none=True)


def build_mep_lens_payload(doc: Document) -> dict[str, Any]:
    services = [
        e
        for e in doc.elements.values()
        if isinstance(e, (PipeElem, DuctElem, CableTrayElem, MepTerminalElem))
    ]
    equipment = [e for e in doc.elements.values() if isinstance(e, MepEquipmentElem)]
    fixtures = [e for e in doc.elements.values() if isinstance(e, FixtureElem)]
    opening_requests = [e for e in doc.elements.values() if isinstance(e, MepOpeningRequestElem)]

    system_names = sorted(
        {
            str(getattr(e, "system_name", "") or "").strip()
            for e in [*services, *equipment, *fixtures]
            if str(getattr(e, "system_name", "") or "").strip()
        }
    )
    system_types = sorted(
        {
            str(getattr(e, "system_type", "") or "").strip()
            for e in [*services, *equipment, *fixtures, *opening_requests]
            if str(getattr(e, "system_type", "") or "").strip()
        }
    )

    connectors: list[dict[str, Any]] = []
    for owner in [*services, *equipment, *fixtures]:
        for conn in getattr(owner, "connectors", []) or []:
            row = conn.model_dump(by_alias=True, exclude_none=True)
            row["ownerElementId"] = owner.id
            connectors.append(row)

    room_zones: list[dict[str, Any]] = []
    for room in doc.elements.values():
        if not isinstance(room, RoomElem):
            continue
        if not any(
            [
                room.ventilation_zone,
                room.heating_cooling_zone,
                room.design_air_change_rate is not None,
                room.fixture_equipment_loads,
                room.electrical_load_summary,
                room.service_requirements,
            ]
        ):
            continue
        room_zones.append(
            {
                "roomId": room.id,
                "name": room.name,
                "levelId": room.level_id,
                "ventilationZone": room.ventilation_zone,
                "heatingCoolingZone": room.heating_cooling_zone,
                "designAirChangeRate": room.design_air_change_rate,
                "fixtureEquipmentLoads": room.fixture_equipment_loads,
                "electricalLoadSummary": room.electrical_load_summary,
                "serviceRequirements": room.service_requirements,
            }
        )

    return {
        "format": "mepLens_v1",
        "lensId": "mep",
        "germanName": "TGA / Technische Gebaeudeausruestung",
        "systems": [{"systemName": name} for name in system_names],
        "systemTypes": system_types,
        "services": [_dump(e) for e in services],
        "equipment": [_dump(e) for e in equipment],
        "fixtures": [_dump(e) for e in fixtures],
        "connectors": sorted(connectors, key=lambda r: (r.get("ownerElementId", ""), r.get("id", ""))),
        "roomZones": room_zones,
        "openingRequests": [_dump(e) for e in opening_requests],
        "scheduleDefaults": list(MEP_REQUIRED_SCHEDULE_DEFAULTS),
        "viewDefaults": list(MEP_DEFAULT_VIEW_SPECS),
    }
