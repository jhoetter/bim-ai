from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass
import math
from typing import Any, Literal


RoomAccessSeverity = Literal["error", "warning", "info"]
RoomAccessPriority = Literal["P0", "P1", "P2", "P3"]


@dataclass(frozen=True)
class RoomAccessFinding:
    rule_id: str
    code: str
    severity: RoomAccessSeverity
    priority: RoomAccessPriority
    discipline: str
    perspective: str
    message: str
    element_ids: tuple[str, ...]
    recommendation: str
    evidence: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["ruleId"] = payload.pop("rule_id")
        payload["elementIds"] = list(payload.pop("element_ids"))
        return {key: value for key, value in payload.items() if value is not None}


DEFAULT_REQUIRED_ROOM_SCHEDULE_FIELDS: tuple[str, ...] = (
    "name",
    "levelId",
    "programmeCode",
    "department",
    "functionLabel",
    "finishSet",
)

ACCESS_TOLERANCE_MM = 250.0
TOPOLOGY_TOLERANCE_MM = 200.0


def check_room_access_integrity(
    subject: Any,
    *,
    profile: Mapping[str, Any] | None = None,
) -> list[RoomAccessFinding]:
    elements = _elements_mapping(subject)
    if elements is None:
        return [
            _finding(
                "room_access_invalid_subject",
                "BIR-D04-SHAPE",
                "error",
                "P1",
                "Model input must be a Document, element mapping, element list, or snapshot with elements.",
                (),
                "Pass an elements mapping/list or a snapshot with an elements field.",
            )
        ]

    normalized = {
        str(_read(element, "id", default=map_id)): element
        for map_id, element in elements.items()
        if _read(element, "id", default=map_id)
    }
    by_kind = _by_kind(normalized)
    rooms = by_kind.get("room", {})
    walls = by_kind.get("wall", {})
    floors = by_kind.get("floor", {})
    levels = by_kind.get("level", {})
    doors = by_kind.get("door", {})
    stairs = by_kind.get("stair", {})

    findings: list[RoomAccessFinding] = []
    room_polygons = {
        room_id: polygon
        for room_id, room in rooms.items()
        if (polygon := _polygon(room, "outlineMm", "outline_mm"))
    }
    floor_polygons = {
        floor_id: polygon
        for floor_id, floor in floors.items()
        if (polygon := _polygon(floor, "boundaryMm", "boundary_mm"))
    }

    door_evidence, door_findings = _door_room_evidence(doors, walls, rooms, room_polygons)
    findings.extend(door_findings)
    findings.extend(_room_access_findings(rooms, door_evidence))
    findings.extend(_egress_findings(rooms, doors, walls, door_evidence, stairs))
    findings.extend(_stair_transition_findings(stairs, levels))
    findings.extend(_room_floor_topology_findings(rooms, room_polygons, floors, floor_polygons))
    findings.extend(_room_wall_topology_findings(rooms, room_polygons, walls))
    findings.extend(_room_schedule_findings(rooms, profile))
    findings.extend(_profile_placeholder_findings(rooms, profile))

    return sorted(
        findings,
        key=lambda finding: (
            finding.priority,
            finding.severity,
            finding.rule_id,
            finding.element_ids,
            finding.code,
        ),
    )


def room_access_integrity_smoke_v1(
    subject: Any,
    *,
    profile: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    findings = check_room_access_integrity(subject, profile=profile)
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.severity] = counts.get(finding.severity, 0) + 1
    return {
        "format": "roomAccessIntegritySmoke_v1",
        "trackedItems": ["BIR-D04", "BIR-D05", "BIR-D06", "BIR-D07"],
        "ok": counts.get("error", 0) == 0,
        "findingCount": len(findings),
        "countsBySeverity": dict(sorted(counts.items())),
        "findings": [finding.to_dict() for finding in findings],
    }


def _door_room_evidence(
    doors: Mapping[str, Any],
    walls: Mapping[str, Any],
    rooms: Mapping[str, Any],
    room_polygons: Mapping[str, list[tuple[float, float]]],
) -> tuple[dict[str, dict[str, Any]], list[RoomAccessFinding]]:
    evidence: dict[str, dict[str, Any]] = {}
    findings: list[RoomAccessFinding] = []
    for door_id, door in sorted(doors.items()):
        wall_id = _string(_read(door, "wallId", "wall_id"))
        wall = walls.get(wall_id or "")
        if wall is None:
            continue
        midpoint = _door_midpoint(door, wall)
        level_id = _string(_read(wall, "levelId", "level_id"))
        geometric_rooms = tuple(
            sorted(
                room_id
                for room_id, polygon in room_polygons.items()
                if _string(_read(rooms[room_id], "levelId", "level_id")) == level_id
                and _point_in_or_near_polygon(midpoint, polygon, ACCESS_TOLERANCE_MM)
            )
        )
        declared_rooms = tuple(sorted(_declared_door_rooms(door)))
        if declared_rooms and set(declared_rooms) - set(geometric_rooms):
            findings.append(
                _finding(
                    "room_access_fake_helper_access",
                    "BIR-D04-HELPER",
                    "error",
                    "P1",
                    "Door declares room access that is not supported by its host-wall midpoint geometry.",
                    (door_id, *declared_rooms),
                    "Remove helper-only room links or move/create the door so its opening is evidenced by adjacent room geometry.",
                    evidence={
                        "declaredRoomIds": list(declared_rooms),
                        "geometricRoomIds": list(geometric_rooms),
                    },
                )
            )
        evidence[door_id] = {
            "roomIds": geometric_rooms,
            "levelId": level_id,
            "midpoint": midpoint,
            "isExit": _is_exterior_exit_door(door, wall),
        }
    return evidence, findings


def _room_access_findings(
    rooms: Mapping[str, Any],
    door_evidence: Mapping[str, dict[str, Any]],
) -> list[RoomAccessFinding]:
    room_to_doors: dict[str, list[str]] = defaultdict(list)
    for door_id, evidence in door_evidence.items():
        for room_id in evidence["roomIds"]:
            room_to_doors[room_id].append(door_id)

    findings: list[RoomAccessFinding] = []
    for room_id in sorted(rooms):
        if room_to_doors.get(room_id):
            continue
        findings.append(
            _finding(
                "room_access_inaccessible_room",
                "BIR-D04-ACCESS",
                "error",
                "P1",
                "Room has no geometrically evidenced door access.",
                (room_id,),
                "Add a door on the room boundary or revise the room outline so an existing door is shared with the room.",
            )
        )
    return findings


def _egress_findings(
    rooms: Mapping[str, Any],
    doors: Mapping[str, Any],
    walls: Mapping[str, Any],
    door_evidence: Mapping[str, dict[str, Any]],
    stairs: Mapping[str, Any],
) -> list[RoomAccessFinding]:
    by_level: dict[str, set[str]] = defaultdict(set)
    graph: dict[str, set[str]] = defaultdict(set)
    exit_rooms: set[str] = set()
    findings: list[RoomAccessFinding] = []

    for room_id, room in rooms.items():
        by_level[_string(_read(room, "levelId", "level_id")) or ""].add(room_id)

    for door_id, evidence in sorted(door_evidence.items()):
        room_ids = tuple(evidence["roomIds"])
        if evidence["isExit"]:
            exit_rooms.update(room_ids)
            door = doors[door_id]
            wall = walls.get(_string(_read(door, "wallId", "wall_id")) or "")
            if wall is not None and not _truthy_prop(
                _props(door) | _props(wall),
                "exteriorDoor",
                "exterior",
                "isExternal",
                "primaryEnvelope",
            ):
                findings.append(
                    _finding(
                        "room_access_exit_classification_implicit",
                        "BIR-D04-EXIT",
                        "warning",
                        "P2",
                        "Exit door is marked as an exit but lacks explicit exterior/envelope classification.",
                        (door_id, _string(_read(door, "wallId", "wall_id")) or ""),
                        "Classify the exit door or its host wall as exterior/envelope so egress is not inferred from a bare exit flag.",
                    )
                )
        for left in room_ids:
            for right in room_ids:
                if left != right:
                    graph[left].add(right)

    for stair_id, stair in sorted(stairs.items()):
        base_level = _string(_read(stair, "baseLevelId", "base_level_id"))
        top_level = _string(_read(stair, "topLevelId", "top_level_id"))
        base_rooms = _rooms_near_point(rooms, by_level.get(base_level or "", set()), stair, "runStartMm")
        top_rooms = _rooms_near_point(rooms, by_level.get(top_level or "", set()), stair, "runEndMm")
        for base_room in base_rooms:
            for top_room in top_rooms:
                graph[base_room].add(top_room)
                graph[top_room].add(base_room)
        if base_rooms and top_rooms:
            continue
        findings.append(
            _finding(
                "room_access_stair_room_transition_unresolved",
                "BIR-D05-STAIR",
                "warning",
                "P2",
                "Stair changes levels but is not geometrically tied to rooms at both ends.",
                (stair_id,),
                "Place the stair endpoints within accessible rooms or add landing/room relationship evidence.",
            )
        )

    reachable = _reachable(exit_rooms, graph)
    for room_id in sorted(rooms):
        if room_id in reachable:
            continue
        if not any(room_id in evidence["roomIds"] for evidence in door_evidence.values()):
            continue
        findings.append(
            _finding(
                "room_access_unresolved_egress_path",
                "BIR-D05-EGRESS",
                "error",
                "P1",
                "Room has door access but no traversable path to an exterior exit.",
                (room_id,),
                "Connect this room through door or stair transitions to a classified exterior exit.",
            )
        )
    return findings


def _stair_transition_findings(
    stairs: Mapping[str, Any],
    levels: Mapping[str, Any],
) -> list[RoomAccessFinding]:
    findings: list[RoomAccessFinding] = []
    for stair_id, stair in sorted(stairs.items()):
        base_level = _string(_read(stair, "baseLevelId", "base_level_id"))
        top_level = _string(_read(stair, "topLevelId", "top_level_id"))
        missing = tuple(level for level in (base_level, top_level) if level and level not in levels)
        if missing:
            findings.append(
                _finding(
                    "room_access_stair_level_reference_unresolved",
                    "BIR-D05-LEVEL",
                    "error",
                    "P1",
                    "Stair references a missing base or top level.",
                    (stair_id, *missing),
                    "Create the referenced levels or update the stair base/top level ids.",
                )
            )
        if base_level and top_level and base_level == top_level:
            findings.append(
                _finding(
                    "room_access_stair_has_no_level_transition",
                    "BIR-D05-LEVEL",
                    "warning",
                    "P2",
                    "Stair base and top levels are identical.",
                    (stair_id, base_level),
                    "Set distinct base/top levels or replace the stair with a same-level circulation element.",
                )
            )
    return findings


def _room_floor_topology_findings(
    rooms: Mapping[str, Any],
    room_polygons: Mapping[str, list[tuple[float, float]]],
    floors: Mapping[str, Any],
    floor_polygons: Mapping[str, list[tuple[float, float]]],
) -> list[RoomAccessFinding]:
    floor_ids_by_level: dict[str, list[str]] = defaultdict(list)
    for floor_id, floor in floors.items():
        floor_ids_by_level[_string(_read(floor, "levelId", "level_id")) or ""].append(floor_id)

    findings: list[RoomAccessFinding] = []
    for room_id, room in sorted(rooms.items()):
        polygon = room_polygons.get(room_id)
        if not polygon:
            continue
        level_id = _string(_read(room, "levelId", "level_id")) or ""
        candidate_floor_ids = sorted(floor_ids_by_level.get(level_id, []))
        if not candidate_floor_ids:
            continue
        centroid = _centroid(polygon)
        if any(
            _point_in_or_near_polygon(centroid, floor_polygons[floor_id], TOPOLOGY_TOLERANCE_MM)
            for floor_id in candidate_floor_ids
            if floor_id in floor_polygons
        ):
            continue
        findings.append(
            _finding(
                "room_access_room_outside_floor",
                "BIR-D06-FLOOR",
                "error",
                "P1",
                "Room centroid is outside all floor boundaries on its level.",
                (room_id, *candidate_floor_ids),
                "Move the room outline onto the level floor plate or create the missing floor boundary.",
            )
        )
    return findings


def _room_wall_topology_findings(
    rooms: Mapping[str, Any],
    room_polygons: Mapping[str, list[tuple[float, float]]],
    walls: Mapping[str, Any],
) -> list[RoomAccessFinding]:
    wall_segments_by_level: dict[str, list[tuple[str, tuple[float, float], tuple[float, float]]]] = (
        defaultdict(list)
    )
    for wall_id, wall in walls.items():
        start = _point(_read(wall, "start"))
        end = _point(_read(wall, "end"))
        if start and end:
            wall_segments_by_level[_string(_read(wall, "levelId", "level_id")) or ""].append(
                (wall_id, start, end)
            )

    findings: list[RoomAccessFinding] = []
    for room_id, room in sorted(rooms.items()):
        polygon = room_polygons.get(room_id)
        if not polygon or len(polygon) < 3:
            findings.append(
                _finding(
                    "room_access_room_boundary_invalid",
                    "BIR-D06-ROOM",
                    "error",
                    "P1",
                    "Room does not have a valid closed outline.",
                    (room_id,),
                    "Provide at least three finite outline points for the room.",
                )
            )
            continue
        level_id = _string(_read(room, "levelId", "level_id")) or ""
        segments = wall_segments_by_level.get(level_id, [])
        unsupported_edges = 0
        for edge_start, edge_end in zip(polygon, polygon[1:] + polygon[:1], strict=False):
            midpoint = ((edge_start[0] + edge_end[0]) / 2.0, (edge_start[1] + edge_end[1]) / 2.0)
            if not any(
                _point_segment_distance_mm(midpoint, wall_start, wall_end) <= TOPOLOGY_TOLERANCE_MM
                for _wall_id, wall_start, wall_end in segments
            ):
                unsupported_edges += 1
        if unsupported_edges:
            findings.append(
                _finding(
                    "room_access_room_wall_topology_gap",
                    "BIR-D06-WALL",
                    "warning",
                    "P2",
                    "Room boundary has edges without nearby wall topology on the same level.",
                    (room_id,),
                    "Add bounding walls/room-separation evidence or revise the room outline to match built topology.",
                    evidence={"unsupportedEdgeCount": unsupported_edges},
                )
            )
    return findings


def _room_schedule_findings(
    rooms: Mapping[str, Any],
    profile: Mapping[str, Any] | None,
) -> list[RoomAccessFinding]:
    required = tuple(
        profile.get("requiredRoomScheduleFields", DEFAULT_REQUIRED_ROOM_SCHEDULE_FIELDS)
        if profile
        else DEFAULT_REQUIRED_ROOM_SCHEDULE_FIELDS
    )
    findings: list[RoomAccessFinding] = []
    for room_id, room in sorted(rooms.items()):
        missing = tuple(field for field in required if _blank(_read(room, field, _snake(field))))
        if not missing:
            continue
        findings.append(
            _finding(
                "room_access_missing_room_schedule_fields",
                "BIR-D07-SCHEDULE",
                "warning",
                "P2",
                "Room is missing fields required for deterministic room schedule integrity.",
                (room_id,),
                "Populate required room schedule fields or relax the active room access integrity profile.",
                evidence={"missingFields": list(missing)},
            )
        )
    return findings


def _profile_placeholder_findings(
    rooms: Mapping[str, Any],
    profile: Mapping[str, Any] | None,
) -> list[RoomAccessFinding]:
    if not profile:
        return []
    findings: list[RoomAccessFinding] = []
    occupancy_fields = tuple(profile.get("requiredOccupancyFields", ()))
    accessibility_fields = tuple(profile.get("requiredAccessibilityFields", ()))
    for room_id, room in sorted(rooms.items()):
        if profile.get("requireOccupancy"):
            missing = tuple(field for field in occupancy_fields if _blank(_read(room, field, _snake(field))))
            if missing:
                findings.append(
                    _finding(
                        "room_access_occupancy_profile_placeholder",
                        "BIR-D07-OCC",
                        "info",
                        "P3",
                        "Active profile requests occupancy checks, but required occupancy metadata is incomplete.",
                        (room_id,),
                        "Populate occupancy metadata; this placeholder does not assert code compliance.",
                        evidence={"missingFields": list(missing)},
                    )
                )
        if profile.get("requireAccessibility"):
            missing = tuple(field for field in accessibility_fields if _blank(_read(room, field, _snake(field))))
            if missing:
                findings.append(
                    _finding(
                        "room_access_accessibility_profile_placeholder",
                        "BIR-D07-ACC",
                        "info",
                        "P3",
                        "Active profile requests accessibility checks, but required accessibility metadata is incomplete.",
                        (room_id,),
                        "Populate accessibility metadata; this placeholder does not assert code compliance.",
                        evidence={"missingFields": list(missing)},
                    )
                )
    return findings


def _elements_mapping(subject: Any) -> dict[str, Any] | None:
    if hasattr(subject, "elements"):
        raw = getattr(subject, "elements")
        return dict(raw) if isinstance(raw, Mapping) else None
    if isinstance(subject, Mapping):
        if "elements" in subject:
            raw = subject.get("elements")
            return dict(raw) if isinstance(raw, Mapping) else None
        if all(_looks_like_element(item) for item in subject.values()):
            return dict(subject)
    if isinstance(subject, Iterable) and not isinstance(subject, (str, bytes, Mapping)):
        result: dict[str, Any] = {}
        for index, element in enumerate(subject):
            element_id = _read(element, "id", default=f"element-{index}")
            result[str(element_id)] = element
        return result
    return None


def _looks_like_element(value: Any) -> bool:
    return (
        isinstance(value, Mapping)
        or _read(value, "kind") is not None
        or _read(value, "id") is not None
    )


def _by_kind(elements: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    by_kind: dict[str, dict[str, Any]] = defaultdict(dict)
    for element_id, element in elements.items():
        kind = _string(_read(element, "kind"))
        if kind:
            by_kind[kind][element_id] = element
    return by_kind


def _finding(
    rule_id: str,
    code: str,
    severity: RoomAccessSeverity,
    priority: RoomAccessPriority,
    message: str,
    element_ids: tuple[str, ...],
    recommendation: str,
    *,
    evidence: dict[str, Any] | None = None,
) -> RoomAccessFinding:
    return RoomAccessFinding(
        rule_id=rule_id,
        code=code,
        severity=severity,
        priority=priority,
        discipline="architecture",
        perspective="room_access_egress_topology",
        message=message,
        element_ids=tuple(element_id for element_id in element_ids if element_id),
        recommendation=recommendation,
        evidence=evidence,
    )


def _read(element: Any, *names: str, default: Any = None) -> Any:
    for name in names:
        if isinstance(element, Mapping) and name in element:
            return element[name]
        if hasattr(element, name):
            return getattr(element, name)
    props = _props(element)
    for name in names:
        if name in props:
            return props[name]
    return default


def _props(element: Any) -> dict[str, Any]:
    raw = None
    if isinstance(element, Mapping):
        raw = element.get("props")
    elif hasattr(element, "props"):
        raw = getattr(element, "props")
    return dict(raw) if isinstance(raw, Mapping) else {}


def _string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, dict, set)):
        return len(value) == 0
    return False


def _snake(value: str) -> str:
    chars: list[str] = []
    for char in value:
        if char.isupper():
            chars.append("_")
            chars.append(char.lower())
        else:
            chars.append(char)
    return "".join(chars).lstrip("_")


def _point(value: Any) -> tuple[float, float] | None:
    if value is None:
        return None
    x = _read(value, "xMm", "x_mm")
    y = _read(value, "yMm", "y_mm")
    if x is None or y is None:
        return None
    try:
        point = (float(x), float(y))
    except (TypeError, ValueError):
        return None
    return point if all(math.isfinite(axis) for axis in point) else None


def _polygon(element: Any, *fields: str) -> list[tuple[float, float]]:
    raw = _read(element, *fields, default=[])
    if not isinstance(raw, Iterable) or isinstance(raw, (str, bytes, Mapping)):
        return []
    points = [_point(point) for point in raw]
    return [point for point in points if point is not None]


def _door_midpoint(door: Any, wall: Any) -> tuple[float, float]:
    start = _point(_read(wall, "start")) or (0.0, 0.0)
    end = _point(_read(wall, "end")) or start
    try:
        along_t = float(_read(door, "alongT", "along_t", default=0.5))
    except (TypeError, ValueError):
        along_t = 0.5
    t = max(0.0, min(1.0, along_t))
    return (start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t)


def _declared_door_rooms(door: Any) -> set[str]:
    props = _props(door)
    raw = (
        _read(door, "roomIds", "room_ids")
        or props.get("roomIds")
        or props.get("connectsRoomIds")
        or props.get("connectedRoomIds")
    )
    if isinstance(raw, str):
        return {item.strip() for item in raw.split(",") if item.strip()}
    if isinstance(raw, Iterable):
        return {str(item).strip() for item in raw if str(item).strip()}
    return set()


def _is_exterior_exit_door(door: Any, wall: Any) -> bool:
    return _truthy_prop(
        _props(door) | _props(wall),
        "egressDoor",
        "exitDoor",
        "requiredExit",
        "exteriorDoor",
        "primaryEnvelope",
        "isExternal",
        "exterior",
    )


def _truthy_prop(props: Mapping[str, Any], *keys: str) -> bool:
    normalized = {_normalize_key(str(key)): value for key, value in props.items()}
    for key in keys:
        value = normalized.get(_normalize_key(key))
        if isinstance(value, str):
            if value.strip().lower() in {"true", "yes", "1", "required", "external", "exterior"}:
                return True
            continue
        if bool(value):
            return True
    return False


def _normalize_key(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _point_in_or_near_polygon(
    point: tuple[float, float],
    polygon: list[tuple[float, float]],
    tolerance_mm: float,
) -> bool:
    if _point_in_polygon(point, polygon):
        return True
    return any(
        _point_segment_distance_mm(point, start, end) <= tolerance_mm
        for start, end in zip(polygon, polygon[1:] + polygon[:1], strict=False)
    )


def _point_in_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    x, y = point
    inside = False
    previous = len(polygon) - 1
    for index, current_point in enumerate(polygon):
        xi, yi = current_point
        xj, yj = polygon[previous]
        denom = yj - yi
        if abs(denom) < 1e-9:
            denom = 1e-9
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / denom + xi:
            inside = not inside
        previous = index
    return inside


def _point_segment_distance_mm(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx = bx - ax
    dy = by - ay
    length_sq = dx * dx + dy * dy
    if length_sq <= 1e-9:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _centroid(polygon: list[tuple[float, float]]) -> tuple[float, float]:
    if not polygon:
        return (0.0, 0.0)
    return (
        sum(point[0] for point in polygon) / len(polygon),
        sum(point[1] for point in polygon) / len(polygon),
    )


def _reachable(start: set[str], graph: Mapping[str, set[str]]) -> set[str]:
    reached = set(start)
    pending: deque[str] = deque(sorted(start))
    while pending:
        room_id = pending.popleft()
        for next_room_id in sorted(graph.get(room_id, set())):
            if next_room_id in reached:
                continue
            reached.add(next_room_id)
            pending.append(next_room_id)
    return reached


def _rooms_near_point(
    rooms: Mapping[str, Any],
    candidate_room_ids: set[str],
    element: Any,
    field: str,
) -> set[str]:
    point = _point(_read(element, field, _snake(field)))
    if point is None:
        return set()
    matches: set[str] = set()
    for room_id in candidate_room_ids:
        polygon = _polygon(rooms[room_id], "outlineMm", "outline_mm")
        if polygon and _point_in_or_near_polygon(point, polygon, ACCESS_TOLERANCE_MM):
            matches.add(room_id)
    return matches
