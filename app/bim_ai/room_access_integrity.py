from __future__ import annotations

import math
from collections import defaultdict, deque
from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass
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
    tracker_items: tuple[str, ...] = ()
    actionability: str = "review_required"

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["ruleId"] = payload.pop("rule_id")
        payload["elementIds"] = list(payload.pop("element_ids"))
        payload["trackerItems"] = list(payload.pop("tracker_items"))
        return {key: value for key, value in payload.items() if value is not None}


DEFAULT_REQUIRED_ROOM_SCHEDULE_FIELDS: tuple[str, ...] = (
    "name",
    "levelId",
    "programmeCode",
    "department",
    "functionLabel",
    "finishSet",
    "targetAreaM2",
    "number",
    "occupancyUse",
    "areaSource",
    "boundingStatus",
    "classification",
)

ACCESS_TOLERANCE_MM = 400.0
TOPOLOGY_TOLERANCE_MM = 400.0
TOPOLOGY_GAP_TOLERANCE_MM = 100.0
ROOM_CONTAINMENT_TOLERANCE_MM = 25.0


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
                tracker_items=("BIR-D04",),
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
    room_separations = by_kind.get("room_separation", {})

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
    open_adjacency = _room_separation_open_adjacency(rooms, room_polygons, room_separations)
    findings.extend(_room_boundary_openness_findings(room_separations))
    findings.extend(door_findings)
    findings.extend(_room_access_findings(rooms, door_evidence, open_adjacency))
    findings.extend(_egress_findings(rooms, doors, walls, door_evidence, stairs, open_adjacency))
    findings.extend(_stair_transition_findings(stairs, levels))
    findings.extend(_room_floor_topology_findings(rooms, room_polygons, floors, floor_polygons))
    findings.extend(_room_wall_topology_findings(rooms, room_polygons, walls, room_separations))
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
        "trackedItems": [
            "BIR-D01",
            "BIR-D02",
            "BIR-D03",
            "BIR-D04",
            "BIR-D05",
            "BIR-D06",
            "BIR-D07",
        ],
        "ok": counts.get("error", 0) == 0,
        "findingCount": len(findings),
        "countsBySeverity": dict(sorted(counts.items())),
        "findings": [finding.to_dict() for finding in findings],
    }


def room_access_graph_v1(
    subject: Any,
    *,
    room_ids: Iterable[str] | None = None,
) -> dict[str, Any]:
    elements = _elements_mapping(subject)
    if elements is None:
        return {
            "format": "roomAccessGraph_v1",
            "ok": False,
            "error": {"code": "invalid_subject", "message": "Model input has no elements."},
        }
    normalized = {
        str(_read(element, "id", default=map_id)): element
        for map_id, element in elements.items()
        if _read(element, "id", default=map_id)
    }
    by_kind = _by_kind(normalized)
    rooms = by_kind.get("room", {})
    walls = by_kind.get("wall", {})
    doors = by_kind.get("door", {})
    room_separations = by_kind.get("room_separation", {})
    selected = {str(room_id) for room_id in room_ids or []}
    room_polygons = {
        room_id: polygon
        for room_id, room in rooms.items()
        if (not selected or room_id in selected)
        and (polygon := _polygon(room, "outlineMm", "outline_mm"))
    }
    all_room_polygons = {
        room_id: polygon
        for room_id, room in rooms.items()
        if (polygon := _polygon(room, "outlineMm", "outline_mm"))
    }
    door_evidence, door_findings = _door_room_evidence(doors, walls, rooms, all_room_polygons)
    open_adjacency = _room_separation_open_adjacency(rooms, all_room_polygons, room_separations)
    graph: dict[str, set[str]] = {room_id: set() for room_id in room_polygons}
    room_to_doors: dict[str, list[str]] = defaultdict(list)
    for door_id, evidence in door_evidence.items():
        room_pair = [room_id for room_id in evidence["roomIds"] if room_id in graph]
        for room_id in room_pair:
            room_to_doors[room_id].append(door_id)
        for left in room_pair:
            for right in evidence["roomIds"]:
                if left != right:
                    graph[left].add(str(right))
    for left, rights in open_adjacency.items():
        if left not in graph:
            continue
        graph[left].update(str(right) for right in rights)
    findings = [finding.to_dict() for finding in check_room_access_integrity(normalized)]
    inaccessible = sorted(
        {
            element_id
            for finding in findings
            if finding.get("ruleId")
            in {"room_access_inaccessible_room", "room_without_door_access"}
            for element_id in finding.get("elementIds", [])
            if element_id in graph
        }
    )
    return {
        "format": "roomAccessGraph_v1",
        "ok": True,
        "rooms": [
            {
                "roomId": room_id,
                "levelId": _string(_read(rooms[room_id], "levelId", "level_id")),
                "doorIds": sorted(room_to_doors.get(room_id, [])),
                "adjacentRoomIds": sorted(graph[room_id]),
                "accessible": room_id not in inaccessible and bool(room_to_doors.get(room_id)),
            }
            for room_id in sorted(graph)
        ],
        "doors": [
            {
                "doorId": door_id,
                "levelId": evidence.get("levelId"),
                "roomIds": list(evidence.get("roomIds") or []),
                "midpointMm": {
                    "xMm": round(evidence["midpoint"][0], 3),
                    "yMm": round(evidence["midpoint"][1], 3),
                },
                "isExit": bool(evidence.get("isExit")),
            }
            for door_id, evidence in sorted(door_evidence.items())
        ],
        "inaccessibleRoomIds": inaccessible,
        "openAdjacency": {
            room_id: sorted(rights)
            for room_id, rights in sorted(open_adjacency.items())
            if not selected or room_id in selected
        },
        "findings": findings,
        "doorFindings": [finding.to_dict() for finding in door_findings],
    }


def room_boundary_edges_report_v1(
    subject: Any,
    *,
    room_ids: Iterable[str] | None = None,
) -> dict[str, Any]:
    elements = _elements_mapping(subject)
    if elements is None:
        return {
            "format": "roomBoundaryEdgesReport_v1",
            "ok": False,
            "error": {"code": "invalid_subject", "message": "Model input has no elements."},
        }
    normalized = {
        str(_read(element, "id", default=map_id)): element
        for map_id, element in elements.items()
        if _read(element, "id", default=map_id)
    }
    by_kind = _by_kind(normalized)
    rooms = by_kind.get("room", {})
    walls = by_kind.get("wall", {})
    room_separations = by_kind.get("room_separation", {})
    selected = {str(room_id) for room_id in room_ids or []}
    room_polygons = {
        room_id: polygon
        for room_id, room in rooms.items()
        if (not selected or room_id in selected)
        and (polygon := _polygon(room, "outlineMm", "outline_mm"))
    }
    segments_by_level = _boundary_segments_by_level(walls, room_separations)
    room_rows: list[dict[str, Any]] = []
    for room_id, polygon in sorted(room_polygons.items()):
        level_id = _string(_read(rooms[room_id], "levelId", "level_id")) or ""
        segments = segments_by_level.get(level_id, [])
        edges: list[dict[str, Any]] = []
        for index, (edge_start, edge_end) in enumerate(
            zip(polygon, polygon[1:] + polygon[:1], strict=False), start=1
        ):
            support_refs = _edge_support_refs(edge_start, edge_end, segments)
            unsupported = _edge_uncovered_intervals(edge_start, edge_end, segments)
            if not unsupported:
                status = "backed"
            elif support_refs:
                status = "partial"
            else:
                status = "unbacked"
            edges.append(
                {
                    "edgeIndex": index,
                    "fromMm": {"xMm": edge_start[0], "yMm": edge_start[1]},
                    "toMm": {"xMm": edge_end[0], "yMm": edge_end[1]},
                    "status": status,
                    "supportRefs": support_refs,
                    "unsupportedIntervalsMm": [
                        {"startMm": round(start, 3), "endMm": round(end, 3)}
                        for start, end in unsupported
                    ],
                }
            )
        room_rows.append(
            {
                "roomId": room_id,
                "levelId": level_id,
                "edgeCount": len(edges),
                "unbackedEdgeCount": sum(1 for edge in edges if edge["status"] == "unbacked"),
                "partialEdgeCount": sum(1 for edge in edges if edge["status"] == "partial"),
                "edges": edges,
            }
        )
    return {
        "format": "roomBoundaryEdgesReport_v1",
        "ok": True,
        "rooms": room_rows,
        "summary": {
            "roomCount": len(room_rows),
            "unbackedEdgeCount": sum(row["unbackedEdgeCount"] for row in room_rows),
            "partialEdgeCount": sum(row["partialEdgeCount"] for row in room_rows),
        },
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
        if _is_helper_or_nonphysical(door) or _is_helper_or_nonphysical(wall):
            findings.append(
                _finding(
                    "room_access_door_host_not_real_boundary",
                    "BIR-D02-REAL-DOOR",
                    "error",
                    "P0",
                    "Door is hosted by helper/nonphysical access topology and cannot satisfy room access.",
                    (door_id, wall_id or ""),
                    "Host access on a real physical wall/opening boundary, or keep this element analytical and add a separate physical door.",
                    tracker_items=("BIR-D01", "BIR-D02"),
                    actionability="fixable_by_rehost_or_physical_door",
                    evidence={
                        "hostPhysicalRole": _physical_role(wall),
                        "doorPhysicalRole": _physical_role(door),
                    },
                )
            )
            continue
        midpoint = _door_midpoint(door, wall)
        level_id = _string(_read(wall, "levelId", "level_id"))
        candidate_room_ids = tuple(
            sorted(
                room_id
                for room_id in room_polygons
                if _string(_read(rooms[room_id], "levelId", "level_id")) == level_id
            )
        )
        geometric_rooms = _door_boundary_room_ids(
            wall,
            midpoint,
            candidate_room_ids,
            room_polygons,
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
                    tracker_items=("BIR-D01", "BIR-D02"),
                    actionability="fixable_by_rehost_or_remove_helper_link",
                    evidence={
                        "declaredRoomIds": list(declared_rooms),
                        "geometricRoomIds": list(geometric_rooms),
                    },
                )
            )
        if candidate_room_ids and not geometric_rooms:
            findings.append(
                _finding(
                    "room_access_door_not_on_room_boundary",
                    "BIR-D04-DOOR",
                    "error",
                    "P1",
                    "Door host wall is not evidenced on any room boundary at the opening location.",
                    (door_id, wall.id if hasattr(wall, "id") else wall_id or ""),
                    "Move the door to a wall segment that bounds the intended room path, or revise room outlines/walls so the opening is on the boundary.",
                    tracker_items=("BIR-D02",),
                    actionability="fixable_by_rehost_or_room_outline_revision",
                    evidence={
                        "candidateRoomIds": list(candidate_room_ids),
                        "midpoint": {"xMm": round(midpoint[0], 3), "yMm": round(midpoint[1], 3)},
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


def _room_boundary_openness_findings(
    room_separations: Mapping[str, Any],
) -> list[RoomAccessFinding]:
    findings: list[RoomAccessFinding] = []
    for separation_id, separation in sorted(room_separations.items()):
        props = _props(separation)
        if _is_helper_access_separator(separation):
            findings.append(
                _finding(
                    "room_access_fake_room_separation_access",
                    "BIR-D01-SEPARATION",
                    "error",
                    "P0",
                    "Room-separation line is being used as a fake physical access/opening boundary.",
                    (separation_id,),
                    "Use room separations only as analytical boundary evidence; model access with real hosted doors/openings on physical walls.",
                    tracker_items=("BIR-D01", "BIR-D02"),
                    actionability="fixable_by_real_door_or_analytical_flag",
                    evidence={
                        "props": dict(sorted((str(key), value) for key, value in props.items()))
                    },
                )
            )
    return findings


def _room_access_findings(
    rooms: Mapping[str, Any],
    door_evidence: Mapping[str, dict[str, Any]],
    open_adjacency: Mapping[str, set[str]],
) -> list[RoomAccessFinding]:
    room_to_doors: dict[str, list[str]] = defaultdict(list)
    for door_id, evidence in door_evidence.items():
        for room_id in evidence["roomIds"]:
            room_to_doors[room_id].append(door_id)

    findings: list[RoomAccessFinding] = []
    for room_id in sorted(rooms):
        if room_to_doors.get(room_id):
            continue
        if open_adjacency.get(room_id):
            findings.append(
                _finding(
                    "room_access_open_separator_only_access",
                    "BIR-D04-SEPARATION",
                    "warning",
                    "P2",
                    "Room has no door on its boundary and is only connected through analytical room-separation adjacency.",
                    (room_id, *sorted(open_adjacency.get(room_id, set()))),
                    "Keep this only for intentional open-plan space; otherwise add a physical door/opening on a valid room boundary.",
                    tracker_items=("BIR-D01", "BIR-D02"),
                    actionability="needs_author_intent_or_real_door",
                    evidence={"adjacentRoomIds": sorted(open_adjacency.get(room_id, set()))},
                )
            )
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
                tracker_items=("BIR-D02",),
                actionability="fixable_by_door_or_outline_revision",
            )
        )
    return findings


def _egress_findings(
    rooms: Mapping[str, Any],
    doors: Mapping[str, Any],
    walls: Mapping[str, Any],
    door_evidence: Mapping[str, dict[str, Any]],
    stairs: Mapping[str, Any],
    open_adjacency: Mapping[str, set[str]],
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
                        tracker_items=("BIR-D04",),
                        actionability="fixable_by_exit_classification",
                    )
                )
        for left in room_ids:
            for right in room_ids:
                if left != right:
                    graph[left].add(right)
    for left, right_rooms in open_adjacency.items():
        for right in right_rooms:
            graph[left].add(right)

    for stair_id, stair in sorted(stairs.items()):
        base_level = _string(_read(stair, "baseLevelId", "base_level_id"))
        top_level = _string(_read(stair, "topLevelId", "top_level_id"))
        base_rooms = _rooms_near_point(
            rooms,
            by_level.get(base_level or "", set()),
            stair,
            "runStartMm",
            "runStart",
        )
        top_rooms = _rooms_near_point(
            rooms,
            by_level.get(top_level or "", set()),
            stair,
            "runEndMm",
            "runEnd",
        )
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
                tracker_items=("BIR-D04",),
                actionability="fixable_by_landing_or_room_endpoint",
            )
        )

    reachable = _reachable(exit_rooms, graph)
    for room_id in sorted(rooms):
        if room_id in reachable:
            continue
        if not any(
            room_id in evidence["roomIds"] for evidence in door_evidence.values()
        ) and not open_adjacency.get(room_id):
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
                tracker_items=("BIR-D04",),
                actionability="fixable_by_egress_connection",
            )
        )
    return findings


def _room_separation_open_adjacency(
    rooms: Mapping[str, Any],
    room_polygons: Mapping[str, list[tuple[float, float]]],
    room_separations: Mapping[str, Any],
) -> dict[str, set[str]]:
    separations_by_level: dict[str, list[tuple[tuple[float, float], tuple[float, float]]]] = (
        defaultdict(list)
    )
    for separation in room_separations.values():
        if _is_helper_access_separator(separation):
            continue
        start = _point(_read(separation, "start"))
        end = _point(_read(separation, "end"))
        level_id = _string(_read(separation, "levelId", "level_id"))
        if start and end and level_id:
            separations_by_level[level_id].append((start, end))

    adjacency: dict[str, set[str]] = defaultdict(set)
    room_ids = sorted(room_polygons)
    for index, left_id in enumerate(room_ids):
        left_level = _string(_read(rooms[left_id], "levelId", "level_id"))
        if not left_level:
            continue
        for right_id in room_ids[index + 1 :]:
            if _string(_read(rooms[right_id], "levelId", "level_id")) != left_level:
                continue
            if not _rooms_share_open_separator(
                room_polygons[left_id],
                room_polygons[right_id],
                separations_by_level.get(left_level, []),
            ):
                continue
            adjacency[left_id].add(right_id)
            adjacency[right_id].add(left_id)
    return adjacency


def _rooms_share_open_separator(
    left: list[tuple[float, float]],
    right: list[tuple[float, float]],
    separations: list[tuple[tuple[float, float], tuple[float, float]]],
) -> bool:
    for left_segment in _polygon_segments(left):
        for right_segment in _polygon_segments(right):
            overlap = _axis_aligned_overlap_segment(left_segment, right_segment)
            if overlap is None:
                continue
            midpoint = (
                (overlap[0][0] + overlap[1][0]) / 2.0,
                (overlap[0][1] + overlap[1][1]) / 2.0,
            )
            if any(
                _point_segment_distance_mm(midpoint, sep_start, sep_end) <= TOPOLOGY_TOLERANCE_MM
                for sep_start, sep_end in separations
            ):
                return True
    return False


def _polygon_segments(
    polygon: list[tuple[float, float]],
) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    return list(zip(polygon, polygon[1:] + polygon[:1], strict=False))


def _axis_aligned_overlap_segment(
    left: tuple[tuple[float, float], tuple[float, float]],
    right: tuple[tuple[float, float], tuple[float, float]],
) -> tuple[tuple[float, float], tuple[float, float]] | None:
    (ax, ay), (bx, by) = left
    (cx, cy), (dx, dy) = right
    left_vertical = abs(ax - bx) <= TOPOLOGY_TOLERANCE_MM
    right_vertical = abs(cx - dx) <= TOPOLOGY_TOLERANCE_MM
    left_horizontal = abs(ay - by) <= TOPOLOGY_TOLERANCE_MM
    right_horizontal = abs(cy - dy) <= TOPOLOGY_TOLERANCE_MM
    if left_vertical and right_vertical and abs(ax - cx) <= TOPOLOGY_TOLERANCE_MM:
        start = max(min(ay, by), min(cy, dy))
        end = min(max(ay, by), max(cy, dy))
        if end - start >= ACCESS_TOLERANCE_MM:
            x = (ax + cx) / 2.0
            return ((x, start), (x, end))
    if left_horizontal and right_horizontal and abs(ay - cy) <= TOPOLOGY_TOLERANCE_MM:
        start = max(min(ax, bx), min(cx, dx))
        end = min(max(ax, bx), max(cx, dx))
        if end - start >= ACCESS_TOLERANCE_MM:
            y = (ay + cy) / 2.0
            return ((start, y), (end, y))
    return None


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
                    tracker_items=("BIR-D04",),
                    actionability="fixable_by_reference_update",
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
                    tracker_items=("BIR-D04",),
                    actionability="fixable_by_level_transition_update",
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
            if floor_polygons:
                findings.append(
                    _finding(
                        "room_containment_missing_level_floor",
                        "BIR-D03-FLOOR",
                        "error",
                        "P0",
                        "Room has no floor boundary on its own level/storey.",
                        (room_id,),
                        "Create a floor/slab boundary on the room level or move the room to the correct level.",
                        tracker_items=("BIR-D03",),
                        actionability="fixable_by_level_floor_or_room_level",
                    )
                )
            continue
        containment_finding = _room_floor_containment_finding(
            room_id,
            room,
            polygon,
            candidate_floor_ids,
            floor_polygons,
        )
        if containment_finding is not None:
            findings.append(containment_finding)
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
                tracker_items=("BIR-D03",),
                actionability="fixable_by_room_or_floor_boundary",
            )
        )
    return findings


def _room_floor_containment_finding(
    room_id: str,
    room: Any,
    polygon: list[tuple[float, float]],
    candidate_floor_ids: list[str],
    floor_polygons: Mapping[str, list[tuple[float, float]]],
) -> RoomAccessFinding | None:
    valid_floor_ids = [floor_id for floor_id in candidate_floor_ids if floor_id in floor_polygons]
    if not valid_floor_ids:
        return None

    samples = _polygon_containment_samples(polygon)
    if not samples:
        return None

    outside_samples = [
        point
        for point in samples
        if not any(
            _point_in_or_near_polygon(
                point,
                floor_polygons[floor_id],
                ROOM_CONTAINMENT_TOLERANCE_MM,
            )
            for floor_id in valid_floor_ids
        )
    ]
    if not outside_samples:
        return None

    contained_count = len(samples) - len(outside_samples)
    if contained_count == 0:
        return _finding(
            "room_containment_detached_island",
            "BIR-D03-DETACHED",
            "error",
            "P0",
            "Room outline is detached from every floor boundary on its level.",
            (room_id, *candidate_floor_ids),
            "Move the room onto the level floor plate or create an explicit floor/envelope for the detached area.",
            tracker_items=("BIR-D03",),
            actionability="fixable_by_move_or_add_floor",
            evidence={
                "sampleCount": len(samples),
                "outsideSampleCount": len(outside_samples),
                "floorIds": candidate_floor_ids,
            },
        )

    if _room_has_intentional_floor_extension(room):
        return None

    return _finding(
        "room_containment_outside_floor_slab",
        "BIR-D03-SLAB",
        "error",
        "P0",
        "Room outline overlaps outside the level floor slab without explicit extension intent.",
        (room_id, *candidate_floor_ids),
        "Revise the room outline to stay within the floor plate, add the missing slab/envelope, or mark the exterior/loggia/terrace extension intent explicitly.",
        tracker_items=("BIR-D03",),
        actionability="fixable_by_outline_slab_or_extension_intent",
        evidence={
            "sampleCount": len(samples),
            "outsideSampleCount": len(outside_samples),
            "floorIds": candidate_floor_ids,
        },
    )


def _polygon_containment_samples(
    polygon: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    if len(polygon) < 3:
        return []
    samples = list(polygon)
    samples.extend(
        ((start[0] + end[0]) / 2.0, (start[1] + end[1]) / 2.0)
        for start, end in _polygon_segments(polygon)
    )
    samples.append(_centroid(polygon))
    return samples


def _room_has_intentional_floor_extension(room: Any) -> bool:
    props = _props(room)
    if _truthy_prop(
        props,
        "allowOutsideFloor",
        "intentionalFloorExtension",
        "extendsBeyondFloor",
        "allowDetached",
    ):
        return True
    for field in (
        "containmentIntent",
        "roomContainmentIntent",
        "floorExtensionIntent",
        "exteriorSpaceType",
        "spaceType",
    ):
        value = _read(room, field, _snake(field))
        if isinstance(value, str) and value.strip().lower() in {
            "intentional_extension",
            "intentional_level_extension",
            "exterior_extension",
            "loggia",
            "terrace",
            "roof_terrace",
            "balcony",
        }:
            return True
    return False


def _room_wall_topology_findings(
    rooms: Mapping[str, Any],
    room_polygons: Mapping[str, list[tuple[float, float]]],
    walls: Mapping[str, Any],
    room_separations: Mapping[str, Any],
) -> list[RoomAccessFinding]:
    walls_by_level: dict[str, dict[str, Any]] = defaultdict(dict)
    for wall_id, wall in walls.items():
        level_id = _string(_read(wall, "levelId", "level_id")) or ""
        walls_by_level[level_id][wall_id] = wall
    boundary_segments_by_level = _boundary_segments_by_level(walls, room_separations)

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
                    tracker_items=("BIR-D01", "BIR-D05"),
                    actionability="fixable_by_room_outline",
                )
            )
            continue
        level_id = _string(_read(room, "levelId", "level_id")) or ""
        segments = boundary_segments_by_level.get(level_id, [])
        unsupported_edges = 0
        for edge_start, edge_end in zip(polygon, polygon[1:] + polygon[:1], strict=False):
            if _edge_uncovered_intervals(edge_start, edge_end, segments):
                unsupported_edges += 1
        if unsupported_edges:
            findings.append(
                _finding(
                    "room_access_room_wall_topology_gap",
                    "BIR-D06-WALL",
                    "warning",
                    "P2",
                    "Room boundary has edges without nearby wall or room-separation topology on the same level.",
                    (room_id,),
                    "Add bounding walls or explicit room-separation lines, or revise the room outline to match built topology.",
                    tracker_items=("BIR-D01", "BIR-D05"),
                    actionability="fixable_by_boundary_topology",
                    evidence={"unsupportedEdgeCount": unsupported_edges},
                )
            )
        findings.extend(
            _wall_boundary_role_findings_for_room(
                room_id,
                polygon,
                rooms,
                room_polygons,
                walls_by_level.get(level_id, {}),
            )
        )
    return findings


def _wall_boundary_role_findings_for_room(
    room_id: str,
    polygon: list[tuple[float, float]],
    rooms: Mapping[str, Any],
    room_polygons: Mapping[str, list[tuple[float, float]]],
    walls: Mapping[str, Any],
) -> list[RoomAccessFinding]:
    findings: list[RoomAccessFinding] = []
    room_level = _string(_read(rooms[room_id], "levelId", "level_id")) or ""
    wall_roles = _boundary_wall_roles(room_id, polygon, room_level, rooms, room_polygons, walls)
    for wall_id, expected_role in sorted(wall_roles.items()):
        wall = walls[wall_id]
        declared_role = _wall_boundary_role(wall)
        if declared_role is None:
            continue
        if declared_role == expected_role:
            continue
        findings.append(
            _finding(
                "room_access_wall_boundary_role_conflict",
                "BIR-D05-WALL-ROLE",
                "warning",
                "P1",
                "Wall boundary role conflicts with deterministic room adjacency.",
                (room_id, wall_id),
                "Update the wall role/classification or revise room outlines so interior, exterior, corridor, and shaft boundaries are explicit.",
                tracker_items=("BIR-D05",),
                actionability="fixable_by_wall_role_or_room_topology",
                evidence={"declaredRole": declared_role, "expectedRole": expected_role},
            )
        )
    return findings


def _door_boundary_room_ids(
    host_wall: Any,
    midpoint: tuple[float, float],
    candidate_room_ids: tuple[str, ...],
    room_polygons: Mapping[str, list[tuple[float, float]]],
) -> tuple[str, ...]:
    host_start = _point(_read(host_wall, "start"))
    host_end = _point(_read(host_wall, "end"))
    if host_start is None or host_end is None:
        return ()

    room_ids: list[str] = []
    for room_id in candidate_room_ids:
        polygon = room_polygons.get(room_id) or []
        for edge_start, edge_end in _polygon_segments(polygon):
            if _point_segment_distance_mm(midpoint, edge_start, edge_end) > ACCESS_TOLERANCE_MM:
                continue
            coverage = _segment_axis_coverage(
                edge_start,
                edge_end,
                host_start,
                host_end,
                TOPOLOGY_TOLERANCE_MM,
            )
            if coverage is None:
                continue
            projected_midpoint = _project_point_onto_segment_axis(midpoint, edge_start, edge_end)
            if projected_midpoint is None:
                continue
            if (
                coverage[0] - ACCESS_TOLERANCE_MM
                <= projected_midpoint
                <= coverage[1] + ACCESS_TOLERANCE_MM
            ):
                room_ids.append(room_id)
                break
    return tuple(sorted(dict.fromkeys(room_ids)))


def _boundary_wall_roles(
    room_id: str,
    polygon: list[tuple[float, float]],
    room_level: str,
    rooms: Mapping[str, Any],
    room_polygons: Mapping[str, list[tuple[float, float]]],
    walls: Mapping[str, Any],
) -> dict[str, str]:
    roles: dict[str, str] = {}
    peer_room_ids = tuple(
        sorted(
            peer_id
            for peer_id in room_polygons
            if peer_id != room_id
            and _string(_read(rooms[peer_id], "levelId", "level_id")) == room_level
        )
    )
    for wall_id, wall in walls.items():
        start = _point(_read(wall, "start"))
        end = _point(_read(wall, "end"))
        if start is None or end is None:
            continue
        matching_edges = [
            (edge_start, edge_end)
            for edge_start, edge_end in _polygon_segments(polygon)
            if _segment_axis_coverage(
                edge_start,
                edge_end,
                start,
                end,
                TOPOLOGY_TOLERANCE_MM,
            )
            is not None
        ]
        if not matching_edges:
            continue
        adjacent_peer_ids = tuple(
            peer_id
            for peer_id in peer_room_ids
            if _rooms_share_wall_edge(matching_edges, room_polygons[peer_id])
        )
        roles[wall_id] = _expected_wall_role_from_rooms(
            room_id,
            adjacent_peer_ids,
            rooms,
        )
    return roles


def _expected_wall_role_from_rooms(
    room_id: str,
    adjacent_peer_ids: tuple[str, ...],
    rooms: Mapping[str, Any],
) -> str:
    if not adjacent_peer_ids:
        return "exterior"
    semantic_room_ids = (room_id, *adjacent_peer_ids)
    if any(
        _room_semantic_role(rooms[semantic_room_id]) == "shaft"
        for semantic_room_id in semantic_room_ids
    ):
        return "shaft"
    if any(
        _room_semantic_role(rooms[semantic_room_id]) == "corridor"
        for semantic_room_id in semantic_room_ids
    ):
        return "corridor"
    return "interior"


def _room_semantic_role(room: Any) -> str | None:
    props = _props(room)
    if _truthy_prop(
        props,
        "shaftRoom",
        "serviceShaft",
        "riserRoom",
        "isShaft",
    ):
        return "shaft"
    if _truthy_prop(
        props,
        "corridorRoom",
        "circulationRoom",
        "primaryCirculation",
        "isCorridor",
    ):
        return "corridor"

    tokens = _semantic_tokens(
        _read(room, "name"),
        _read_schedule_field(room, "programmeCode"),
        _read_schedule_field(room, "department"),
        _read_schedule_field(room, "functionLabel"),
        _read_schedule_field(room, "occupancyUse"),
        _read_schedule_field(room, "classification"),
    )
    if tokens & {"shaft", "riser", "service_shaft", "serviceshaft"}:
        return "shaft"
    if tokens & {"corridor", "circulation", "hallway", "hall", "route"}:
        return "corridor"
    return None


def _semantic_tokens(*values: Any) -> set[str]:
    tokens: set[str] = set()
    for value in values:
        if isinstance(value, Mapping):
            tokens.update(_semantic_tokens(*value.values()))
            continue
        if isinstance(value, Iterable) and not isinstance(value, (str, bytes, Mapping)):
            tokens.update(_semantic_tokens(*value))
            continue
        if value is None:
            continue
        normalized = str(value).strip().lower().replace("-", "_").replace("/", " ")
        if not normalized:
            continue
        tokens.add(normalized.replace(" ", "_"))
        tokens.update(part for part in normalized.replace("_", " ").split() if part)
    return tokens


def _rooms_share_wall_edge(
    matching_edges: list[tuple[tuple[float, float], tuple[float, float]]],
    peer_polygon: list[tuple[float, float]],
) -> bool:
    for edge in matching_edges:
        for peer_edge in _polygon_segments(peer_polygon):
            overlap = _axis_aligned_overlap_segment(edge, peer_edge)
            if overlap is None:
                continue
            if (
                math.hypot(overlap[1][0] - overlap[0][0], overlap[1][1] - overlap[0][1])
                >= ACCESS_TOLERANCE_MM
            ):
                return True
    return False


def _wall_bounds_polygon(wall: Any, polygon: list[tuple[float, float]]) -> bool:
    start = _point(_read(wall, "start"))
    end = _point(_read(wall, "end"))
    if start is None or end is None:
        return False
    return any(
        _segment_axis_coverage(
            edge_start,
            edge_end,
            start,
            end,
            TOPOLOGY_TOLERANCE_MM,
        )
        is not None
        for edge_start, edge_end in _polygon_segments(polygon)
    )


def _wall_role_flag(wall: Any, role: str) -> bool:
    props = _props(wall)
    normalized_role = role.lower()
    for key in ("roomBoundaryRole", "boundaryRole", "wallRole", "role"):
        value = _read(wall, key, _snake(key))
        if isinstance(value, str) and value.strip().lower() == normalized_role:
            return True
    if _truthy_prop(props, f"{role}Wall", f"is{role.title()}"):
        return True
    return False


def _wall_boundary_role(wall: Any) -> str | None:
    role_aliases = {
        "interior": "interior",
        "internal": "interior",
        "partition": "interior",
        "exterior": "exterior",
        "external": "exterior",
        "envelope": "exterior",
        "corridor": "corridor",
        "circulation": "corridor",
        "shaft": "shaft",
        "riser": "shaft",
    }
    for key in ("roomBoundaryRole", "boundaryRole", "wallRole", "role"):
        value = _read(wall, key, _snake(key))
        if isinstance(value, str):
            normalized = role_aliases.get(value.strip().lower())
            if normalized:
                return normalized
    if _truthy_prop(_props(wall), "corridorWall"):
        return "corridor"
    if _truthy_prop(_props(wall), "shaftWall"):
        return "shaft"
    if _truthy_prop(_props(wall), "exterior", "isExternal", "primaryEnvelope"):
        return "exterior"
    if _truthy_prop(_props(wall), "interior", "internal", "partition"):
        return "interior"
    return None


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
        missing = tuple(field for field in required if _blank(_read_schedule_field(room, field)))
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
                tracker_items=("BIR-D06",),
                actionability="fixable_by_room_bim_metadata",
                evidence={"missingFields": list(missing)},
            )
        )
    return findings


def _read_schedule_field(room: Any, field: str) -> Any:
    candidates = (field, _snake(field))
    props = _props(room)
    room_bim_intent = props.get("roomBimIntent")
    sources: list[Mapping[str, Any]] = []
    if isinstance(room, Mapping):
        sources.append(room)
    sources.append(props)
    if isinstance(room_bim_intent, Mapping):
        sources.append(room_bim_intent)

    for name in candidates:
        for source in sources:
            if name in source and not _blank(source[name]):
                return source[name]
        if hasattr(room, name):
            value = getattr(room, name)
            if not _blank(value):
                return value
    return None


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
            missing = tuple(
                field for field in occupancy_fields if _blank(_read(room, field, _snake(field)))
            )
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
                        tracker_items=("BIR-D07",),
                        actionability="fixable_by_profile_metadata",
                        evidence={"missingFields": list(missing)},
                    )
                )
        if profile.get("requireAccessibility"):
            missing = tuple(
                field for field in accessibility_fields if _blank(_read(room, field, _snake(field)))
            )
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
                        tracker_items=("BIR-D07",),
                        actionability="fixable_by_profile_metadata",
                        evidence={"missingFields": list(missing)},
                    )
                )
    return findings


def _elements_mapping(subject: Any) -> dict[str, Any] | None:
    if hasattr(subject, "elements"):
        raw = subject.elements
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
    tracker_items: tuple[str, ...] = (),
    actionability: str = "review_required",
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
        tracker_items=tracker_items,
        actionability=actionability,
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
    room_bim_intent = props.get("roomBimIntent")
    if isinstance(room_bim_intent, Mapping):
        for name in names:
            if name in room_bim_intent:
                return room_bim_intent[name]
    return default


def _props(element: Any) -> dict[str, Any]:
    raw = None
    if isinstance(element, Mapping):
        raw = element.get("props")
    elif hasattr(element, "props"):
        raw = element.props
    return dict(raw) if isinstance(raw, Mapping) else {}


def _physical_role(element: Any) -> str | None:
    value = _read(element, "physicalRole", "physical_role", "modelRole", "authoringRole")
    return str(value).strip().lower() if value is not None and str(value).strip() else None


def _is_helper_or_nonphysical(element: Any) -> bool:
    role = _physical_role(element)
    if role in {"helper", "analysis", "analytical", "nonphysical", "non_physical"}:
        return True
    props = _props(element)
    if _truthy_prop(
        props,
        "accessProxy",
        "helper",
        "roomGraphHelper",
        "analysisOnly",
        "nonphysical",
        "nonPhysical",
    ):
        return True
    raw_role = _read(element, "role")
    return isinstance(raw_role, str) and raw_role.strip().lower() in {
        "access_proxy",
        "helper",
        "room_graph",
        "analysis",
        "analytical",
        "nonphysical",
    }


def _is_helper_access_separator(separation: Any) -> bool:
    props = _props(separation)
    if _physical_role(separation) in {"physical", "architectural", "model"}:
        return True
    if _truthy_prop(
        props,
        "accessProxy",
        "roomGraphHelper",
        "doorProxy",
        "fakeDoor",
        "syntheticDoor",
        "openingProxy",
        "accessOpening",
        "showInSchedule",
        "visible",
        "rendered",
        "renderable",
        "export",
        "exported",
    ):
        return True
    for key in ("connectsRoomIds", "connectedRoomIds", "roomIds"):
        value = props.get(key)
        if isinstance(value, str) and value.strip():
            return True
        if isinstance(value, Iterable) and not isinstance(value, (str, bytes, Mapping)):
            return bool(list(value))
    return False


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


def _edge_uncovered_intervals(
    edge_start: tuple[float, float],
    edge_end: tuple[float, float],
    segments: list[tuple[str, str, tuple[float, float], tuple[float, float]]],
) -> list[tuple[float, float]]:
    edge_length = math.hypot(edge_end[0] - edge_start[0], edge_end[1] - edge_start[1])
    if edge_length < 1.0:
        return []

    intervals: list[tuple[float, float]] = []
    for _segment_id, _segment_kind, segment_start, segment_end in segments:
        coverage = _segment_axis_coverage(
            edge_start,
            edge_end,
            segment_start,
            segment_end,
            TOPOLOGY_TOLERANCE_MM,
        )
        if coverage is not None:
            intervals.append(coverage)
    return _interval_union_uncovered(intervals, edge_length)


def _boundary_segments_by_level(
    walls: Mapping[str, Any],
    room_separations: Mapping[str, Any],
) -> dict[str, list[tuple[str, str, tuple[float, float], tuple[float, float]]]]:
    segments_by_level: dict[
        str, list[tuple[str, str, tuple[float, float], tuple[float, float]]]
    ] = defaultdict(list)
    for wall_id, wall in walls.items():
        start = _point(_read(wall, "start"))
        end = _point(_read(wall, "end"))
        if start and end:
            level_id = _string(_read(wall, "levelId", "level_id")) or ""
            segments_by_level[level_id].append((wall_id, "wall", start, end))
    for separation_id, separation in room_separations.items():
        start = _point(_read(separation, "start"))
        end = _point(_read(separation, "end"))
        if start and end:
            level_id = _string(_read(separation, "levelId", "level_id")) or ""
            segments_by_level[level_id].append((separation_id, "room_separation", start, end))
    return segments_by_level


def _edge_support_refs(
    edge_start: tuple[float, float],
    edge_end: tuple[float, float],
    segments: list[tuple[str, str, tuple[float, float], tuple[float, float]]],
) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for segment_id, segment_kind, segment_start, segment_end in segments:
        coverage = _segment_axis_coverage(
            edge_start,
            edge_end,
            segment_start,
            segment_end,
            TOPOLOGY_TOLERANCE_MM,
        )
        if coverage is not None:
            refs.append(
                {
                    "elementId": segment_id,
                    "kind": segment_kind,
                    "coverageStartMm": round(coverage[0], 3),
                    "coverageEndMm": round(coverage[1], 3),
                }
            )
    return sorted(refs, key=lambda ref: (ref["coverageStartMm"], ref["elementId"]))


def _segment_axis_coverage(
    edge_start: tuple[float, float],
    edge_end: tuple[float, float],
    segment_start: tuple[float, float],
    segment_end: tuple[float, float],
    perpendicular_tolerance_mm: float,
) -> tuple[float, float] | None:
    edge_length = math.hypot(edge_end[0] - edge_start[0], edge_end[1] - edge_start[1])
    if edge_length < 1.0:
        return None

    if (
        _point_to_infinite_line_distance_mm(segment_start, edge_start, edge_end)
        > perpendicular_tolerance_mm
        or _point_to_infinite_line_distance_mm(segment_end, edge_start, edge_end)
        > perpendicular_tolerance_mm
    ):
        return None

    a = _project_point_onto_segment_axis(segment_start, edge_start, edge_end)
    b = _project_point_onto_segment_axis(segment_end, edge_start, edge_end)
    if a is None or b is None:
        return None
    start = max(0.0, min(a, b))
    end = min(edge_length, max(a, b))
    if end - start < 1.0:
        return None
    return (start, end)


def _project_point_onto_segment_axis(
    point: tuple[float, float],
    segment_start: tuple[float, float],
    segment_end: tuple[float, float],
) -> float | None:
    ax, ay = segment_start
    bx, by = segment_end
    length = math.hypot(bx - ax, by - ay)
    if length < 1.0:
        return None
    ux = (bx - ax) / length
    uy = (by - ay) / length
    return (point[0] - ax) * ux + (point[1] - ay) * uy


def _point_to_infinite_line_distance_mm(
    point: tuple[float, float],
    line_start: tuple[float, float],
    line_end: tuple[float, float],
) -> float:
    ax, ay = line_start
    bx, by = line_end
    length = math.hypot(bx - ax, by - ay)
    if length < 1.0:
        return math.hypot(point[0] - ax, point[1] - ay)
    return abs((point[0] - ax) * (by - ay) - (point[1] - ay) * (bx - ax)) / length


def _interval_union_uncovered(
    intervals: list[tuple[float, float]],
    length: float,
) -> list[tuple[float, float]]:
    if length <= 0:
        return []
    if not intervals:
        return [(0.0, length)]

    merged: list[tuple[float, float]] = []
    for start, end in sorted((max(0.0, a), min(length, b)) for a, b in intervals):
        if end - start < 1.0:
            continue
        if not merged or start > merged[-1][1] + TOPOLOGY_GAP_TOLERANCE_MM:
            merged.append((start, end))
            continue
        merged[-1] = (merged[-1][0], max(merged[-1][1], end))

    uncovered: list[tuple[float, float]] = []
    cursor = 0.0
    for start, end in merged:
        if start > cursor + TOPOLOGY_GAP_TOLERANCE_MM:
            uncovered.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < length - TOPOLOGY_GAP_TOLERANCE_MM:
        uncovered.append((cursor, length))
    return uncovered


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
    *fields: str,
) -> set[str]:
    point = None
    for field in fields:
        point = _point(_read(element, field, _snake(field)))
        if point is not None:
            break
    if point is None:
        return set()
    matches: set[str] = set()
    for room_id in candidate_room_ids:
        polygon = _polygon(rooms[room_id], "outlineMm", "outline_mm")
        if polygon and _point_in_or_near_polygon(point, polygon, ACCESS_TOLERANCE_MM):
            matches.add(room_id)
    return matches
