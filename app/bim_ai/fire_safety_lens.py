"""Fire Safety Lens schedule/readout projections.

The lens reads fire-protection metadata from shared model elements via ``props``.
It intentionally does not create a parallel fire-only space model.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    CeilingElem,
    DoorElem,
    DuctElem,
    FloorElem,
    PipeElem,
    RoofOpeningElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WallOpeningElem,
)
from bim_ai.room_derivation import detect_unbounded_rooms_v1

FIRE_SAFETY_SCHEDULE_CATEGORIES: frozenset[str] = frozenset(
    {
        "fire_compartment",
        "rated_element",
        "fire_door",
        "escape_route",
        "firestop_penetration",
        "smoke_control_equipment",
    }
)


def _props(elem: Any) -> dict[str, Any]:
    raw = getattr(elem, "props", None)
    return raw if isinstance(raw, dict) else {}


def _first(props: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        value = props.get(key)
        if value is not None and value != "":
            return value
    return default


def _str_prop(props: dict[str, Any], *keys: str) -> str:
    value = _first(props, *keys)
    return str(value).strip() if value is not None else ""


def _bool_or_empty(value: Any) -> bool | str:
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().lower() in {"true", "yes", "1"}:
        return True
    if isinstance(value, str) and value.strip().lower() in {"false", "no", "0"}:
        return False
    return ""


def _float_or_empty(value: Any) -> float | str:
    try:
        if value is None or value == "":
            return ""
        return round(float(value), 3)
    except (TypeError, ValueError):
        return ""


def _polygon_area_m2(points: list[Any]) -> float:
    if len(points) < 3:
        return 0.0
    acc = 0.0
    for idx, point in enumerate(points):
        nxt = points[(idx + 1) % len(points)]
        acc += float(point.x_mm) * float(nxt.y_mm) - float(nxt.x_mm) * float(point.y_mm)
    return abs(acc) / 2_000_000.0


def _level_labels(doc: Document) -> dict[str, str]:
    return {
        e.id: e.name
        for e in doc.elements.values()
        if getattr(e, "kind", None) == "level" and getattr(e, "name", None)
    }


def _host_level_id(doc: Document, elem: Any) -> str:
    if hasattr(elem, "level_id"):
        return str(getattr(elem, "level_id") or "")
    if isinstance(elem, DoorElem):
        host = doc.elements.get(elem.wall_id)
        return str(getattr(host, "level_id", "") or "")
    if isinstance(elem, WallOpeningElem):
        host = doc.elements.get(elem.host_wall_id)
        return str(getattr(host, "level_id", "") or "")
    if isinstance(elem, SlabOpeningElem):
        host = doc.elements.get(elem.host_floor_id)
        return str(getattr(host, "level_id", "") or "")
    return ""


def _fire_compartment_rows(doc: Document) -> list[dict[str, Any]]:
    level_labels = _level_labels(doc)
    unbounded = frozenset(detect_unbounded_rooms_v1(doc))
    buckets: dict[str, list[RoomElem]] = defaultdict(list)
    for elem in doc.elements.values():
        if not isinstance(elem, RoomElem):
            continue
        cid = _str_prop(_props(elem), "fireCompartmentId", "fire_compartment_id")
        if cid:
            buckets[cid].append(elem)

    rows: list[dict[str, Any]] = []
    for compartment_id in sorted(buckets):
        rooms = sorted(buckets[compartment_id], key=lambda r: r.id)
        area_m2 = 0.0
        volume_m3 = 0.0
        names: list[str] = []
        levels: set[str] = set()
        smoke_ids: set[str] = set()
        requirement = ""
        closure_states: set[str] = set()
        for room in rooms:
            props = _props(room)
            area = _polygon_area_m2(room.outline_mm)
            area_m2 += area
            volume_value = _float_or_empty(_first(props, "volumeM3", "fireCompartmentVolumeM3"))
            if isinstance(volume_value, float):
                volume_m3 += volume_value
            names.append(room.name)
            levels.add(level_labels.get(room.level_id, room.level_id))
            smoke_id = _str_prop(props, "smokeCompartmentId", "smoke_compartment_id")
            if smoke_id:
                smoke_ids.add(smoke_id)
            requirement = requirement or _str_prop(
                props,
                "fireResistanceRequirement",
                "fireResistanceRating",
                "fireRating",
            )
            closure_states.add(
                _str_prop(props, "boundaryClosureStatus", "closureStatus")
                or ("open" if room.id in unbounded else "unchecked")
            )
        status = "open" if "open" in closure_states else "closed"
        if closure_states == {"unchecked"}:
            status = "unchecked"
        rows.append(
            {
                "elementId": f"fire-compartment:{compartment_id}",
                "compartmentId": compartment_id,
                "name": _str_prop(_props(rooms[0]), "fireCompartmentName") or compartment_id,
                "level": "; ".join(sorted(levels)),
                "roomCount": len(rooms),
                "roomNames": "; ".join(names),
                "areaM2": round(area_m2, 3),
                "volumeM3": round(volume_m3, 3) if volume_m3 else "",
                "fireResistanceRequirement": requirement,
                "smokeCompartmentIds": "; ".join(sorted(smoke_ids)),
                "boundaryClosureStatus": status,
                "areaCheckStatus": _str_prop(_props(rooms[0]), "areaCheckStatus"),
                "volumeCheckStatus": _str_prop(_props(rooms[0]), "volumeCheckStatus"),
                "reviewStatus": _str_prop(_props(rooms[0]), "reviewStatus", "approvalStatus"),
            }
        )
    return rows


def _rated_element_rows(doc: Document, *, doors_only: bool = False) -> list[dict[str, Any]]:
    level_labels = _level_labels(doc)
    rated_types = (DoorElem,) if doors_only else (WallElem, FloorElem, CeilingElem, DoorElem)
    rows: list[dict[str, Any]] = []
    for elem in sorted(doc.elements.values(), key=lambda e: e.id):
        if not isinstance(elem, rated_types):
            continue
        props = _props(elem)
        fire_rating = _str_prop(
            props,
            "fireResistanceRating",
            "fireRating",
            "doorFireRating",
            "shaftEnclosureRating",
        )
        smoke_rating = _str_prop(props, "smokeControlRating", "doorSmokeControlRating")
        self_closing = _bool_or_empty(_first(props, "selfClosingRequired", "doorSelfClosing"))
        if not any([fire_rating, smoke_rating, self_closing is True, doors_only]):
            continue
        level_id = _host_level_id(doc, elem)
        rows.append(
            {
                "elementId": elem.id,
                "name": getattr(elem, "name", elem.id),
                "category": getattr(elem, "kind", ""),
                "levelId": level_id,
                "level": level_labels.get(level_id, level_id),
                "hostElementId": getattr(elem, "wall_id", "") or "",
                "fireRating": fire_rating,
                "smokeControlRating": smoke_rating,
                "selfClosingRequired": self_closing,
                "shaftEnclosureRating": _str_prop(props, "shaftEnclosureRating"),
                "penetrationFirestopStatus": _str_prop(props, "penetrationFirestopStatus"),
                "reviewStatus": _str_prop(props, "reviewStatus", "approvalStatus"),
            }
        )
    return rows


def _escape_route_rows(doc: Document) -> list[dict[str, Any]]:
    level_labels = _level_labels(doc)
    rows: list[dict[str, Any]] = []
    for elem in sorted(doc.elements.values(), key=lambda e: e.id):
        if not isinstance(elem, (RoomElem, DoorElem, StairElem)):
            continue
        props = _props(elem)
        route_id = _str_prop(props, "escapeRouteId", "egressRouteId")
        if not route_id and _first(props, "travelDistanceM", "exitWidthMm") == "":
            continue
        level_id = _host_level_id(doc, elem)
        rows.append(
            {
                "elementId": elem.id,
                "routeId": route_id,
                "name": getattr(elem, "name", elem.id),
                "category": getattr(elem, "kind", ""),
                "levelId": level_id,
                "level": level_labels.get(level_id, level_id),
                "travelDistanceM": _float_or_empty(_first(props, "travelDistanceM")),
                "exitWidthMm": _float_or_empty(_first(props, "exitWidthMm")),
                "doorSwingCompliant": _bool_or_empty(_first(props, "doorSwingCompliant")),
                "stairClassification": _str_prop(props, "stairClassification"),
                "corridorClassification": _str_prop(props, "corridorClassification"),
                "assemblyPointNote": _str_prop(props, "assemblyPointNote"),
                "reviewStatus": _str_prop(props, "reviewStatus", "approvalStatus"),
            }
        )
    return rows


def _penetration_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for elem in sorted(doc.elements.values(), key=lambda e: e.id):
        if not isinstance(elem, (WallOpeningElem, SlabOpeningElem, RoofOpeningElem, PipeElem, DuctElem)):
            continue
        props = _props(elem)
        status = _str_prop(props, "firestopStatus", "penetrationStatus")
        if not status and not _str_prop(props, "ratedAssemblyId", "ratedWallId"):
            continue
        rows.append(
            {
                "elementId": elem.id,
                "name": getattr(elem, "name", elem.id),
                "category": getattr(elem, "kind", ""),
                "hostElementId": _str_prop(props, "hostElementId")
                or getattr(elem, "host_wall_id", "")
                or getattr(elem, "host_floor_id", ""),
                "ratedAssemblyId": _str_prop(props, "ratedAssemblyId", "ratedWallId"),
                "firestopStatus": status,
                "approvalStatus": _str_prop(props, "approvalStatus", "reviewStatus"),
                "responsibleTrade": _str_prop(props, "responsibleTrade"),
                "inspectionEvidence": _str_prop(props, "inspectionEvidence", "inspectionEvidenceRef"),
            }
        )
    return rows


def _smoke_control_equipment_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for elem in sorted(doc.elements.values(), key=lambda e: e.id):
        props = _props(elem)
        if not _bool_or_empty(_first(props, "smokeControlEquipment")) and not _str_prop(
            props, "smokeControlRating", "smokeControlStatus"
        ):
            continue
        rows.append(
            {
                "elementId": elem.id,
                "name": getattr(elem, "name", elem.id),
                "category": getattr(elem, "kind", ""),
                "equipmentType": _str_prop(props, "equipmentType", "smokeControlEquipmentType"),
                "systemId": _str_prop(props, "systemId", "smokeControlSystemId"),
                "controlZone": _str_prop(props, "controlZone", "smokeControlZone"),
                "smokeControlRating": _str_prop(props, "smokeControlRating"),
                "status": _str_prop(props, "smokeControlStatus", "reviewStatus"),
                "inspectionEvidence": _str_prop(props, "inspectionEvidence", "inspectionEvidenceRef"),
            }
        )
    return rows


def derive_fire_safety_schedule_rows(doc: Document, category: str) -> list[dict[str, Any]]:
    cat = category.lower().strip()
    if cat == "fire_compartment":
        return _fire_compartment_rows(doc)
    if cat == "rated_element":
        return _rated_element_rows(doc)
    if cat == "fire_door":
        return _rated_element_rows(doc, doors_only=True)
    if cat == "escape_route":
        return _escape_route_rows(doc)
    if cat == "firestop_penetration":
        return _penetration_rows(doc)
    if cat == "smoke_control_equipment":
        return _smoke_control_equipment_rows(doc)
    return []


def fire_safety_lens_review_status(doc: Document) -> dict[str, Any]:
    """Auditable API/readout payload for external fire-review tools."""

    schedules = {
        category: derive_fire_safety_schedule_rows(doc, category)
        for category in sorted(FIRE_SAFETY_SCHEDULE_CATEGORIES)
    }
    return {
        "format": "fireSafetyLensReviewStatus_v1",
        "lensId": "fire-safety",
        "germanName": "Brandschutz",
        "nonGoals": [
            "no_jurisdictional_fire_code_approval",
            "no_legally_binding_occupant_load_or_egress_approval_without_ruleset",
            "no_duplicate_fire_only_rooms",
        ],
        "counts": {category: len(rows) for category, rows in schedules.items()},
        "schedules": schedules,
    }
