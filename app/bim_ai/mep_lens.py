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
    SlabOpeningElem,
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


def _level_label(doc: Document, level_id: str | None) -> str:
    if not level_id:
        return ""
    level = doc.elements.get(level_id)
    return str(getattr(level, "name", None) or level_id)


def _linear_length_m(el: PipeElem | DuctElem | CableTrayElem) -> float:
    dx = float(el.end_mm.x_mm - el.start_mm.x_mm)
    dy = float(el.end_mm.y_mm - el.start_mm.y_mm)
    return round((dx * dx + dy * dy) ** 0.5 / 1000.0, 6)


def _base_service_row(doc: Document, el: Any) -> dict[str, Any]:
    level_id = str(getattr(el, "level_id", "") or "")
    return {
        "elementId": el.id,
        "name": getattr(el, "name", "") or el.id,
        "kind": getattr(el, "kind", ""),
        "levelId": level_id,
        "level": _level_label(doc, level_id),
        "systemType": str(getattr(el, "system_type", "") or ""),
        "systemName": str(getattr(el, "system_name", "") or ""),
        "serviceLevel": str(getattr(el, "service_level", "") or ""),
        "connectorCount": len(getattr(el, "connectors", []) or []),
        "clearanceZone": getattr(el, "clearance_zone", None) or "",
        "maintainAccessZone": getattr(el, "maintain_access_zone", None) or "",
    }


def build_mep_schedule_table(doc: Document, category: str) -> dict[str, Any]:
    cat = category.strip().lower()
    rows: list[dict[str, Any]] = []

    if cat == "pipe":
        for el in doc.elements.values():
            if not isinstance(el, PipeElem):
                continue
            row = _base_service_row(doc, el)
            row.update(
                {
                    "diameterMm": round(float(el.diameter_mm), 3),
                    "lengthM": _linear_length_m(el),
                    "flowDirection": el.flow_direction,
                    "insulation": el.insulation or "",
                    "materialKey": el.material_key or "",
                }
            )
            rows.append(row)
    elif cat == "duct":
        for el in doc.elements.values():
            if not isinstance(el, DuctElem):
                continue
            row = _base_service_row(doc, el)
            row.update(
                {
                    "widthMm": round(float(el.width_mm), 3),
                    "heightMm": round(float(el.height_mm), 3),
                    "shape": el.shape,
                    "lengthM": _linear_length_m(el),
                    "flowDirection": el.flow_direction,
                    "insulation": el.insulation or "",
                }
            )
            rows.append(row)
    elif cat in {"cable_tray", "cabletray"}:
        for el in doc.elements.values():
            if not isinstance(el, CableTrayElem):
                continue
            row = _base_service_row(doc, el)
            row.update(
                {
                    "widthMm": round(float(el.width_mm), 3),
                    "heightMm": round(float(el.height_mm), 3),
                    "lengthM": _linear_length_m(el),
                }
            )
            rows.append(row)
    elif cat == "equipment":
        for el in doc.elements.values():
            if not isinstance(el, MepEquipmentElem):
                continue
            row = _base_service_row(doc, el)
            row.update(
                {
                    "equipmentType": el.equipment_type or "",
                    "familyTypeId": el.family_type_id or "",
                    "electricalLoadW": el.electrical_load_w or 0,
                }
            )
            rows.append(row)
    elif cat == "fixture":
        for el in doc.elements.values():
            if not isinstance(el, FixtureElem):
                continue
            row = _base_service_row(doc, el)
            row.update(
                {
                    "fixtureType": el.fixture_type or "",
                    "roomId": el.room_id or "",
                    "electricalLoadW": el.electrical_load_w or 0,
                }
            )
            rows.append(row)
    elif cat in {"terminal", "diffuser"}:
        for el in doc.elements.values():
            if not isinstance(el, MepTerminalElem):
                continue
            if cat == "diffuser" and el.terminal_kind != "diffuser":
                continue
            row = _base_service_row(doc, el)
            row.update(
                {
                    "terminalKind": el.terminal_kind,
                    "roomId": el.room_id or "",
                    "flowDirection": el.flow_direction,
                }
            )
            rows.append(row)
    elif cat == "opening_request":
        for el in doc.elements.values():
            if not isinstance(el, MepOpeningRequestElem):
                continue
            rows.append(
                {
                    "elementId": el.id,
                    "name": el.name,
                    "hostElementId": el.host_element_id,
                    "levelId": el.level_id or "",
                    "level": _level_label(doc, el.level_id),
                    "requesterElementIds": ";".join(el.requester_element_ids),
                    "openingKind": el.opening_kind,
                    "status": el.status,
                    "widthMm": el.width_mm or "",
                    "heightMm": el.height_mm or "",
                    "diameterMm": el.diameter_mm or "",
                    "clearanceMm": el.clearance_mm,
                    "systemType": el.system_type,
                    "systemName": el.system_name or "",
                }
            )
    elif cat == "shaft":
        for el in doc.elements.values():
            if not isinstance(el, SlabOpeningElem) or not el.is_shaft:
                continue
            rows.append(
                {
                    "elementId": el.id,
                    "name": el.name,
                    "hostFloorId": el.host_floor_id,
                    "isShaft": el.is_shaft,
                    "boundaryPointCount": len(el.boundary_mm),
                }
            )
    elif cat == "electrical_load":
        for el in doc.elements.values():
            if isinstance(el, RoomElem) and el.electrical_load_summary:
                load = el.electrical_load_summary
                rows.append(
                    {
                        "elementId": el.id,
                        "name": el.name,
                        "kind": "room",
                        "levelId": el.level_id,
                        "level": _level_label(doc, el.level_id),
                        "electricalLoadSummary": load,
                    }
                )
            elif isinstance(el, (MepEquipmentElem, FixtureElem)) and el.electrical_load_w:
                rows.append(
                    {
                        "elementId": el.id,
                        "name": el.name,
                        "kind": el.kind,
                        "levelId": el.level_id,
                        "level": _level_label(doc, el.level_id),
                        "systemType": el.system_type,
                        "systemName": el.system_name or "",
                        "electricalLoadW": round(float(el.electrical_load_w), 3),
                    }
                )

    rows.sort(key=lambda r: str(r.get("elementId", "")))
    return {
        "category": cat,
        "totalRows": len(rows),
        "rows": rows,
    }


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
        "connectors": sorted(
            connectors, key=lambda r: (r.get("ownerElementId", ""), r.get("id", ""))
        ),
        "roomZones": room_zones,
        "openingRequests": [_dump(e) for e in opening_requests],
        "scheduleDefaults": list(MEP_REQUIRED_SCHEDULE_DEFAULTS),
        "scheduleTables": {
            spec["category"]: build_mep_schedule_table(doc, str(spec["category"]))
            for spec in MEP_REQUIRED_SCHEDULE_DEFAULTS
        },
        "viewDefaults": list(MEP_DEFAULT_VIEW_SPECS),
    }
