from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass
from typing import Any, Literal

StructureMepLiteSeverity = Literal["error", "warning", "info"]

CHECK_METADATA: dict[str, Any] = {
    "format": "structureMepLiteIntegrity_v1",
    "method": "deterministic_structure_lite_constructability_checks",
    "deterministic": True,
    "certification": "not_certified_structural_engineering",
    "engineeringDisclaimer": (
        "These are deterministic structure-lite and MEP-lite constructability "
        "integrity checks. They do not perform certified structural engineering, "
        "code compliance, sizing, load calculation, or life-safety review."
    ),
    "trackedItems": ["BIR-G01", "BIR-G02", "BIR-G03", "BIR-G04"],
}


@dataclass(frozen=True)
class StructureMepLiteFinding:
    ruleId: str
    code: str
    severity: StructureMepLiteSeverity
    priority: str
    discipline: str
    perspective: str
    elementIds: tuple[str, ...]
    recommendation: str
    message: str
    trackerItems: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["elementIds"] = list(self.elementIds)
        payload["trackerItems"] = list(self.trackerItems)
        return payload


def structure_mep_lite_integrity_report(subject: Any) -> dict[str, Any]:
    """Return a deterministic structure-lite/MEP-lite integrity report.

    The checks intentionally stop at concept-model coordination signals. They
    flag missing assumptions and handoff requirements, not engineered adequacy.
    """

    findings = check_structure_mep_lite_integrity(subject)
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.severity] = counts.get(finding.severity, 0) + 1
    return {
        **CHECK_METADATA,
        "ok": not findings,
        "findingCount": len(findings),
        "countsBySeverity": dict(sorted(counts.items())),
        "findings": [finding.to_dict() for finding in findings],
    }


def check_structure_mep_lite_integrity(subject: Any) -> list[StructureMepLiteFinding]:
    elements = _elements_mapping(subject)
    if elements is None:
        return [
            _finding(
                "structure_mep_lite_invalid_document_shape",
                "BIR-G01-SHAPE",
                "error",
                "P1",
                "coordination",
                "structure_mep_lite",
                (),
                "Pass a Document, an elements mapping, or a snapshot with an elements object.",
                "Structure/MEP lite integrity requires a resolvable elements mapping.",
            )
        ]

    indexed = _index(elements)
    findings: list[StructureMepLiteFinding] = []
    findings.extend(_load_bearing_flag_findings(indexed))
    findings.extend(_load_path_metadata_findings(indexed))
    findings.extend(_load_path_findings(indexed))
    findings.extend(_large_opening_findings(indexed))
    findings.extend(_mep_penetration_findings(indexed))
    findings.extend(_mep_opening_metadata_findings(indexed))
    findings.extend(_wet_room_service_stack_findings(indexed))
    findings.extend(_riser_shaft_equipment_access_findings(indexed))
    return sorted(
        findings,
        key=lambda finding: (
            finding.priority,
            finding.ruleId,
            list(finding.elementIds),
            finding.message,
        ),
    )


def _load_bearing_flag_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    for element_id, element in indexed.sorted_elements:
        kind = _kind(element)
        if kind not in {"wall", "column", "beam", "floor", "slab"}:
            continue
        if _load_bearing_value(element) is None and _structural_role(element) is None:
            findings.append(
                _finding(
                    "structure_lite_load_bearing_flag_missing",
                    "BIR-G01-LOAD-BEARING-FLAG",
                    "warning",
                    "P2",
                    "structure",
                    "structure_lite",
                    (element_id,),
                    "Declare loadBearing true/false or a structuralRole so downstream checks know whether this element participates in concept load paths.",
                    f"{kind} '{element_id}' does not declare load-bearing intent.",
                )
            )
    return findings


def _load_path_metadata_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    for element_id, element in indexed.sorted_elements:
        kind = _kind(element)
        if kind not in {"wall", "column", "beam"} or not _is_load_bearing(element):
            continue
        missing = []
        if not _string_field(element, "loadPathRole", "loadPathSegmentId", "structuralSystemId"):
            missing.append("load path role/segment")
        if not _string_field(element, "loadDirection", "loadCase", "loadCategory"):
            missing.append("load direction/category")
        if not missing:
            continue
        findings.append(
            _finding(
                "structure_lite_load_path_metadata_missing",
                "BIR-G02-LOAD-PATH-METADATA",
                "warning",
                "P2",
                "structure",
                "structure_lite",
                (element_id,),
                "Add authored loadPathRole/loadPathSegmentId and loadDirection/loadCategory metadata, or mark the element non-load-bearing.",
                f"Load-bearing {kind} '{element_id}' is missing {', '.join(missing)} metadata.",
            )
        )
    return findings


def _load_path_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    for element_id, element in indexed.sorted_elements:
        kind = _kind(element)
        if kind not in {"wall", "column", "beam"} or not _is_load_bearing(element):
            continue
        if _has_transfer_assumption(element):
            continue
        support_ids = _ids_from_fields(element, "supportedByIds", "supportIds", "stackedSupportIds")
        missing_support_ids = [support_id for support_id in support_ids if support_id not in indexed.elements]
        if missing_support_ids:
            findings.append(
                _finding(
                    "structure_lite_support_reference_unresolved",
                    "BIR-G02-SUPPORT-REFERENCE",
                    "warning",
                    "P1",
                    "structure",
                    "structure_lite",
                    (element_id,),
                    "Resolve support references to real structural elements or replace them with a transferAssumptionId.",
                    (
                        f"Load-bearing {kind} '{element_id}' references missing supports: "
                        f"{', '.join(sorted(missing_support_ids))}."
                    ),
                )
            )
        if kind == "beam":
            support_ids = _ids_from_fields(
                element, "supportedByIds", "supportIds", "startColumnId", "endColumnId"
            )
            resolved = [sid for sid in support_ids if sid in indexed.elements]
            if len(set(resolved)) < 2:
                findings.append(
                    _finding(
                        "structure_lite_beam_supports_missing",
                        "BIR-G02-BEAM-SUPPORTS",
                        "warning",
                        "P1",
                        "structure",
                        "structure_lite",
                        _with_existing_refs((element_id,), support_ids, indexed),
                        "Add start/end support references, supportedByIds, or an explicit transferAssumptionId for concept coordination.",
                        f"Load-bearing beam '{element_id}' does not resolve two concept supports.",
                    )
                )
            continue

        if _is_lowest_structural_level(element, indexed):
            continue
        if not _has_stacked_support_below(element, indexed):
            findings.append(
                _finding(
                    "structure_lite_load_path_missing",
                    "BIR-G02-LOAD-PATH",
                    "warning",
                    "P1",
                    "structure",
                    "structure_lite",
                    (element_id,),
                    "Stack the supporting wall/column below, add supportedByIds, or record a transferAssumptionId for engineering follow-up.",
                    f"Load-bearing {kind} '{element_id}' has no stacked support below and no transfer assumption.",
                )
            )
    return findings


def _large_opening_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    for element_id, element in indexed.sorted_elements:
        if _kind(element) not in {"wall_opening", "slab_opening", "roof_opening", "void_cut"}:
            continue
        if not _is_large_opening(element):
            continue
        if _coordinated_opening(element):
            continue
        host_ids = _ids_from_fields(element, "hostElementId", "hostWallId", "hostFloorId", "hostRoofId")
        findings.append(
            _finding(
                "structure_lite_large_opening_uncoordinated",
                "BIR-G02-LARGE-OPENING",
                "warning",
                "P1",
                "coordination",
                "structure_lite",
                _with_existing_refs((element_id,), host_ids, indexed),
                "Coordinate large openings with structural review metadata, lintel/header intent, or a transferAssumptionId.",
                f"Large opening '{element_id}' lacks structural coordination metadata.",
            )
        )
    return findings


def _mep_penetration_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    for element_id, element in indexed.sorted_elements:
        if _kind(element) not in {"pipe", "duct", "cable_tray", "mep_route", "mep_route_placeholder"}:
            continue
        crossed_ids = _ids_from_fields(
            element,
            "passesThroughElementIds",
            "crossesElementIds",
            "intersectsElementIds",
            "penetratesElementIds",
        )
        crossed_hosts = [
            crossed_id
            for crossed_id in crossed_ids
            if _kind(indexed.elements.get(crossed_id)) in {"wall", "floor", "slab", "ceiling", "roof"}
        ]
        if not crossed_hosts:
            continue
        opening_ids = _opening_ids(element)
        if opening_ids and _openings_cover_hosts(opening_ids, crossed_hosts, indexed):
            continue
        if not opening_ids and _has_penetration_status_coordination(element):
            continue
        findings.append(
            _finding(
                "mep_lite_route_penetration_opening_missing",
                "BIR-G03-MEP-PENETRATION",
                "warning",
                "P1",
                "mep",
                "mep_lite",
                tuple([element_id, *sorted(crossed_hosts), *sorted(opening_ids)]),
                "Add resolved openingRequestId/openingIds/sleeveIds for each crossed host or mark penetrationStatus as coordinated before routing through walls, slabs, roofs, or ceilings.",
                f"MEP route '{element_id}' crosses host elements without resolved penetration/opening metadata.",
            )
        )
    return findings


def _mep_opening_metadata_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    for element_id, element in indexed.sorted_elements:
        kind = _kind(element)
        if kind not in {
            "mep_opening_request",
            "sleeve",
            "penetration",
            "wall_opening",
            "slab_opening",
            "floor_opening",
            "ceiling_opening",
            "roof_opening",
        }:
            continue
        if kind in {
            "wall_opening",
            "slab_opening",
            "floor_opening",
            "ceiling_opening",
            "roof_opening",
        } and not _is_mep_opening(element):
            continue
        host_ids = _host_ids(element)
        route_ids = _ids_from_fields(element, "routeId", "routeIds", "mepRouteId", "servedElementIds")
        missing = []
        if not any(host_id in indexed.elements for host_id in host_ids):
            missing.append("host element")
        if not route_ids and not _string_field(element, "systemId", "mepSystemId", "serviceType"):
            missing.append("MEP route/system")
        if _number_field(element, "diameterMm", "widthMm", "heightMm", "sleeveDiameterMm") is None:
            missing.append("opening/sleeve size")
        if not missing:
            continue
        findings.append(
            _finding(
                "mep_lite_opening_request_metadata_missing",
                "BIR-G03-OPENING-METADATA",
                "warning",
                "P1",
                "mep",
                "mep_lite",
                _with_existing_refs((element_id,), [*host_ids, *route_ids], indexed),
                "Add host, route/system, and sleeve/opening size metadata so penetrations can be coordinated deterministically.",
                f"MEP penetration/opening '{element_id}' is missing {', '.join(missing)} metadata.",
            )
        )
    return findings


def _wet_room_service_stack_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    wet_rooms = [(eid, elem) for eid, elem in indexed.sorted_elements if _is_wet_room(elem)]
    wet_by_stack: dict[str, list[tuple[str, Any]]] = {}
    for element_id, element in wet_rooms:
        stack_id = _string_field(element, "serviceStackId", "wetStackId", "stackId")
        if stack_id:
            wet_by_stack.setdefault(stack_id, []).append((element_id, element))

    for element_id, element in wet_rooms:
        if not _ids_from_fields(element, "servedByRiserId", "servedByRiserIds", "serviceZoneId", "shaftId"):
            findings.append(
                _finding(
                    "mep_lite_wet_room_unserved",
                    "BIR-G04-WET-ROOM-SERVICE",
                    "warning",
                    "P2",
                    "mep",
                    "mep_lite",
                    (element_id,),
                    "Assign a serviceZoneId, shaftId, or servedByRiserId so wet-room services have a concept route.",
                    f"Wet room '{element_id}' is not tied to a riser, shaft, or service zone.",
                )
            )
        if _is_lowest_level(element, indexed):
            continue
        if _has_lower_wet_room_in_stack(element, wet_by_stack, indexed):
            continue
        findings.append(
            _finding(
                "mep_lite_wet_room_unstacked",
                "BIR-G04-WET-ROOM-STACK",
                "warning",
                "P2",
                "mep",
                "mep_lite",
                (element_id,),
                "Stack wet rooms by serviceStackId/wetStackId or record a service route assumption for the offset.",
                f"Wet room '{element_id}' is not stacked over a lower wet room in the same service stack.",
            )
        )
    return findings


def _riser_shaft_equipment_access_findings(indexed: _IndexedElements) -> list[StructureMepLiteFinding]:
    findings: list[StructureMepLiteFinding] = []
    for element_id, element in indexed.sorted_elements:
        kind = _kind(element)
        if kind in {"riser", "shaft", "service_zone", "equipment_zone", "mep_equipment"}:
            if not _has_service_access(element):
                findings.append(
                    _finding(
                        "mep_lite_service_access_missing",
                        "BIR-G04-SERVICE-ACCESS",
                        "warning",
                        "P2",
                        "mep",
                        "mep_lite",
                        (element_id,),
                        "Add accessPanelIds, maintenanceAccess, accessClearanceMm, or accessSide metadata for service review.",
                        f"Service element '{element_id}' lacks maintenance/access metadata.",
                    )
                )
        if kind != "mep_route_placeholder":
            continue
        endpoint_ids = _ids_from_fields(element, "routedFromId", "routedToId", "terminalIds")
        if not endpoint_ids:
            findings.append(
                _finding(
                    "mep_lite_route_placeholder_unresolved",
                    "BIR-G04-ROUTE-PLACEHOLDER",
                    "warning",
                    "P3",
                    "mep",
                    "mep_lite",
                    (element_id,),
                    "Connect the route placeholder to routedFromId/routedToId or terminalIds before handoff.",
                    f"MEP route placeholder '{element_id}' is not tied to endpoints.",
                )
            )
            continue
        missing_endpoint_ids = [
            endpoint_id for endpoint_id in endpoint_ids if endpoint_id not in indexed.elements
        ]
        if missing_endpoint_ids:
            findings.append(
                _finding(
                    "mep_lite_route_placeholder_endpoint_unresolved",
                    "BIR-G04-ROUTE-ENDPOINT",
                    "warning",
                    "P2",
                    "mep",
                    "mep_lite",
                    (element_id, *missing_endpoint_ids),
                    "Resolve route placeholder endpoints to real rooms, risers, shafts, equipment, or terminals before handoff.",
                    (
                        f"MEP route placeholder '{element_id}' references missing endpoints: "
                        f"{', '.join(sorted(missing_endpoint_ids))}."
                    ),
                )
            )
    return findings


@dataclass(frozen=True)
class _IndexedElements:
    elements: Mapping[str, Any]
    sorted_elements: tuple[tuple[str, Any], ...]
    level_order: dict[str, int]


def _index(elements: Mapping[str, Any]) -> _IndexedElements:
    sorted_elements = tuple(
        sorted(
            ((str(_read(element, "id", default=map_id)), element) for map_id, element in elements.items()),
            key=lambda item: item[0],
        )
    )
    levels = [
        (
            str(_read(element, "id", default=element_id)),
            _number_field(element, "elevationMm", "elevation", "zMm", default=0.0),
        )
        for element_id, element in sorted_elements
        if _kind(element) == "level"
    ]
    level_order = {level_id: idx for idx, (level_id, _) in enumerate(sorted(levels, key=lambda item: (item[1], item[0])))}
    return _IndexedElements(
        elements={element_id: element for element_id, element in sorted_elements},
        sorted_elements=sorted_elements,
        level_order=level_order,
    )


def _elements_mapping(subject: Any) -> Mapping[str, Any] | None:
    if hasattr(subject, "elements"):
        elements = subject.elements
        return elements if isinstance(elements, Mapping) else None
    if isinstance(subject, Mapping):
        if "elements" in subject:
            elements = subject.get("elements")
            return elements if isinstance(elements, Mapping) else None
        return subject
    return None


def _finding(
    rule_id: str,
    code: str,
    severity: StructureMepLiteSeverity,
    priority: str,
    discipline: str,
    perspective: str,
    element_ids: Iterable[str],
    recommendation: str,
    message: str,
) -> StructureMepLiteFinding:
    return StructureMepLiteFinding(
        ruleId=rule_id,
        code=code,
        severity=severity,
        priority=priority,
        discipline=discipline,
        perspective=perspective,
        elementIds=tuple(dict.fromkeys(str(eid) for eid in element_ids if eid)),
        recommendation=recommendation,
        message=message,
        trackerItems=_tracker_items_for_code(code),
    )


def _kind(element: Any) -> str:
    return str(_read(element, "kind", default="") or "")


def _is_load_bearing(element: Any) -> bool:
    explicit = _load_bearing_value(element)
    if explicit is not None:
        return explicit
    return _structural_role(element) in {"load_bearing", "primary", "secondary", "gravity", "lateral"}


def _load_bearing_value(element: Any) -> bool | None:
    value = _read_deep(element, "loadBearing", "isLoadBearing", "bearing")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.lower()
        if lowered in {"true", "yes", "1", "load_bearing", "bearing"}:
            return True
        if lowered in {"false", "no", "0", "non_load_bearing", "partition"}:
            return False
    return None


def _structural_role(element: Any) -> str | None:
    value = _read_deep(element, "structuralRole", "structureRole")
    return str(value).lower() if value not in (None, "") else None


def _has_transfer_assumption(element: Any) -> bool:
    return bool(_read_deep(element, "transferAssumptionId", "transferBeamId", "transferAssumption"))


def _has_stacked_support_below(element: Any, indexed: _IndexedElements) -> bool:
    support_ids = _ids_from_fields(element, "supportedByIds", "supportIds", "stackedSupportIds")
    if any(sid in indexed.elements for sid in support_ids):
        return True

    level_id = _level_id(element)
    order = indexed.level_order.get(level_id or "")
    if order is None or order <= 0:
        return True
    kind = _kind(element)
    for _, candidate in indexed.sorted_elements:
        if _kind(candidate) != kind or not _is_load_bearing(candidate):
            continue
        candidate_order = indexed.level_order.get(_level_id(candidate) or "")
        if candidate_order == order - 1 and _same_stack_position(element, candidate):
            return True
    return False


def _same_stack_position(a: Any, b: Any) -> bool:
    for field in ("gridId", "axisId", "stackId", "structuralStackId"):
        av = _read_deep(a, field)
        bv = _read_deep(b, field)
        if av not in (None, "") and av == bv:
            return True
    ax = _number_field(a, "xMm", "centerX")
    ay = _number_field(a, "yMm", "centerY")
    bx = _number_field(b, "xMm", "centerX")
    by = _number_field(b, "yMm", "centerY")
    return None not in (ax, ay, bx, by) and abs(ax - bx) <= 250 and abs(ay - by) <= 250


def _is_lowest_structural_level(element: Any, indexed: _IndexedElements) -> bool:
    order = indexed.level_order.get(_level_id(element) or "")
    return order is None or order == 0


def _is_large_opening(element: Any) -> bool:
    width = _number_field(element, "widthMm", "width")
    height = _number_field(element, "heightMm", "height")
    diameter = _number_field(element, "diameterMm", "diameter")
    area = _number_field(element, "areaMm2", "area")
    max_dimension = max(v for v in (width, height, diameter) if v is not None) if any(v is not None for v in (width, height, diameter)) else 0
    if _kind(element) == "wall_opening":
        return (width or diameter or 0) >= 1200 or (
            (width or 0) >= 1000 and (height or 0) >= 2400
        )
    return max_dimension >= 1000 or (area or 0) >= 1_000_000


def _coordinated_opening(element: Any) -> bool:
    return bool(
        _read_deep(
            element,
            "structuralReviewId",
            "coordinationStatus",
            "coordinatedWith",
            "lintelId",
            "headerId",
            "transferAssumptionId",
        )
    )


def _has_penetration_coordination(element: Any) -> bool:
    if _ids_from_fields(element, "openingRequestId", "openingRequestIds", "openingId", "openingIds"):
        return True
    status = _string_field(element, "penetrationStatus", "coordinationStatus")
    return status in {"coordinated", "approved", "reviewed"}


def _opening_ids(element: Any) -> list[str]:
    return _ids_from_fields(
        element,
        "openingRequestId",
        "openingRequestIds",
        "openingId",
        "openingIds",
        "sleeveId",
        "sleeveIds",
    )


def _has_penetration_status_coordination(element: Any) -> bool:
    status = _string_field(element, "penetrationStatus", "coordinationStatus")
    return status in {"coordinated", "approved", "reviewed"}


def _openings_cover_hosts(
    opening_ids: Iterable[str], host_ids: Iterable[str], indexed: _IndexedElements
) -> bool:
    remaining_hosts = set(host_ids)
    for opening_id in opening_ids:
        opening = indexed.elements.get(opening_id)
        if opening is None:
            return False
        opening_hosts = set(_host_ids(opening))
        if not opening_hosts:
            return False
        remaining_hosts.difference_update(opening_hosts)
    return not remaining_hosts


def _host_ids(element: Any) -> list[str]:
    return _ids_from_fields(
        element,
        "hostElementId",
        "hostWallId",
        "hostFloorId",
        "hostSlabId",
        "hostCeilingId",
        "hostRoofId",
    )


def _is_mep_opening(element: Any) -> bool:
    return bool(
        _read_deep(element, "mepSystemId", "serviceType", "routeId", "mepRouteId", "openingRequestId")
    ) or _string_field(element, "openingPurpose", "purpose") in {"mep", "pipe", "duct", "service"}


def _is_wet_room(element: Any) -> bool:
    if _kind(element) not in {"room", "space", "zone"}:
        return False
    if _read_deep(element, "wetRoom", "isWetRoom") is True:
        return True
    category = _string_field(element, "category", "roomType", "spaceType", "program")
    return category in {"bathroom", "wc", "toilet", "kitchen", "laundry", "wet_room", "wetroom", "plant"}


def _is_lowest_level(element: Any, indexed: _IndexedElements) -> bool:
    order = indexed.level_order.get(_level_id(element) or "")
    return order is None or order == 0


def _has_lower_wet_room_in_stack(
    element: Any,
    wet_by_stack: Mapping[str, list[tuple[str, Any]]],
    indexed: _IndexedElements,
) -> bool:
    stack_id = _string_field(element, "serviceStackId", "wetStackId", "stackId")
    if not stack_id:
        return bool(_read_deep(element, "offsetServiceRouteAssumptionId", "serviceRouteAssumptionId"))
    order = indexed.level_order.get(_level_id(element) or "")
    if order is None:
        return True
    for _, candidate in wet_by_stack.get(stack_id, []):
        candidate_order = indexed.level_order.get(_level_id(candidate) or "")
        if candidate_order is not None and candidate_order < order:
            return True
    return False


def _has_service_access(element: Any) -> bool:
    if _ids_from_fields(element, "accessPanelId", "accessPanelIds", "accessDoorId", "accessDoorIds"):
        return True
    if _number_field(element, "accessClearanceMm", "maintenanceClearanceMm", default=0.0) > 0:
        return True
    return bool(_read_deep(element, "maintenanceAccess", "accessSide", "serviceAccess"))


def _with_existing_refs(base: Iterable[str], refs: Iterable[str], indexed: _IndexedElements) -> tuple[str, ...]:
    return tuple([*base, *(ref for ref in sorted(set(refs)) if ref in indexed.elements)])


def _ids_from_fields(element: Any, *fields: str) -> list[str]:
    ids: list[str] = []
    for field in fields:
        value = _read_deep(element, field)
        if value in (None, ""):
            continue
        if isinstance(value, str):
            ids.append(value)
        elif isinstance(value, Iterable) and not isinstance(value, Mapping):
            ids.extend(str(item) for item in value if item not in (None, ""))
        else:
            ids.append(str(value))
    return ids


def _level_id(element: Any) -> str | None:
    value = _read(element, "levelId") or _read(element, "baseLevelId") or _read(element, "referenceLevelId")
    return str(value) if value not in (None, "") else None


def _string_field(element: Any, *fields: str) -> str | None:
    for field in fields:
        value = _read_deep(element, field)
        if value not in (None, ""):
            return str(value).lower()
    return None


def _number_field(element: Any, *fields: str, default: float | None = None) -> float | None:
    for field in fields:
        value = _read_deep(element, field)
        if value in (None, ""):
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return default


def _read_deep(element: Any, *fields: str, default: Any = None) -> Any:
    for field in fields:
        value = _read(element, field)
        if value not in (None, ""):
            return value
    for container_field in ("props", "metadata", "parameters"):
        container = _read(element, container_field)
        if isinstance(container, Mapping):
            for field in fields:
                value = _read(container, field)
                if value not in (None, ""):
                    return value
    return default


def _read(element: Any, field: str, default: Any = None) -> Any:
    if element is None:
        return default
    names = (field, _snake_case(field))
    if isinstance(element, Mapping):
        for name in names:
            if name in element:
                return element[name]
        return default
    for name in names:
        if hasattr(element, name):
            return getattr(element, name)
    return default


def _snake_case(name: str) -> str:
    out = []
    for idx, char in enumerate(name):
        if char.isupper() and idx:
            out.append("_")
        out.append(char.lower())
    return "".join(out)


def _tracker_items_for_code(code: str) -> tuple[str, ...]:
    parts = str(code).split("-")
    if len(parts) >= 2 and parts[0] == "BIR":
        return (f"{parts[0]}-{parts[1]}",)
    return ()
