"""Source-level room topology requirements for reverse-BIM handoff packages."""

from __future__ import annotations

from typing import Any


def _point_key(point: dict[str, Any]) -> dict[str, float]:
    return {
        "xMm": float(point.get("xMm") or point.get("x") or 0),
        "yMm": float(point.get("yMm") or point.get("y") or 0),
    }


def _room_boundary_edges(fact: dict[str, Any]) -> list[dict[str, Any]]:
    value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
    explicit = value.get("boundaryEdges")
    if isinstance(explicit, list) and explicit:
        edges = []
        for idx, edge in enumerate(explicit):
            if not isinstance(edge, dict):
                continue
            backing_refs = [
                ref
                for ref in (
                    edge.get("backingWallRef"),
                    edge.get("roomSeparationRef"),
                    edge.get("hostWallRef"),
                )
                if ref
            ]
            edges.append(
                {
                    "edgeIndex": edge.get("edgeIndex", idx),
                    "fromMm": edge.get("fromMm") or edge.get("start"),
                    "toMm": edge.get("toMm") or edge.get("end"),
                    "backingRefs": backing_refs,
                    "status": "source_backed" if backing_refs else "needs_backing_ref",
                    "sourceFactId": fact.get("factId"),
                }
            )
        return edges

    boundary = value.get("boundaryMm")
    if not isinstance(boundary, list) or len(boundary) < 3:
        return []
    points = [_point_key(point) for point in boundary if isinstance(point, dict)]
    edges = []
    for idx, start in enumerate(points):
        end = points[(idx + 1) % len(points)]
        edges.append(
            {
                "edgeIndex": idx,
                "fromMm": start,
                "toMm": end,
                "backingRefs": [],
                "status": "needs_backing_ref",
                "sourceFactId": fact.get("factId"),
            }
        )
    return edges


def _room_access_refs(value: dict[str, Any]) -> list[str]:
    refs = []
    for key in ("accessRefs", "doorRefs", "openingRefs", "accessOpeningRefs"):
        raw = value.get(key)
        if isinstance(raw, list):
            refs.extend(str(item) for item in raw if item)
        elif raw:
            refs.append(str(raw))
    access = value.get("access") if isinstance(value.get("access"), dict) else {}
    for key in ("doorRef", "openingRef", "circulationRef"):
        if access.get(key):
            refs.append(str(access[key]))
    return sorted(set(refs))


def build_source_room_topology_report(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Describe source room topology completeness before MCP authoring."""

    room_fact_ids = {
        str(fact.get("factId"))
        for fact in facts
        if isinstance(fact, dict) and fact.get("kind") == "room" and fact.get("factId")
    }
    access_fact_ids = {
        str(fact.get("factId"))
        for fact in facts
        if isinstance(fact, dict)
        and fact.get("kind") in {"opening", "door", "window", "stair"}
        and fact.get("factId")
    }
    rooms = []
    for fact in facts:
        if not isinstance(fact, dict) or fact.get("kind") != "room":
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        if not isinstance(value.get("boundaryMm"), list) and not isinstance(value.get("boundaryEdges"), list):
            continue
        edges = _room_boundary_edges(fact)
        unbacked_edges = [edge for edge in edges if edge.get("status") != "source_backed"]
        access_refs = _room_access_refs(value)
        missing_access_refs = sorted(ref for ref in access_refs if ref not in access_fact_ids)
        adjacent_refs = _string_refs(value.get("adjacentRoomRefs") or value.get("adjacentRooms"))
        missing_adjacent_refs = sorted(ref for ref in adjacent_refs if ref not in room_fact_ids)
        rooms.append(
            {
                "roomFactId": fact.get("factId"),
                "levelId": value.get("levelId"),
                "name": value.get("name"),
                "areaM2": value.get("areaM2"),
                "boundaryEdgeCount": len(edges),
                "unbackedBoundaryEdgeCount": len(unbacked_edges),
                "accessRefs": access_refs,
                "accessStatus": "source_backed" if access_refs else "needs_access_fact",
                "missingAccessRefs": missing_access_refs,
                "adjacentRoomRefs": adjacent_refs,
                "missingAdjacentRoomRefs": missing_adjacent_refs,
                "edges": edges,
                "requiredBeforeMcp": _required_before_mcp(
                    unbacked_edges,
                    access_refs,
                    missing_access_refs,
                    missing_adjacent_refs,
                ),
                "provenance": fact.get("provenance"),
            }
        )

    return {
        "format": "reverseBimSourceRoomTopology_v1",
        "summary": {
            "roomCount": len(rooms),
            "roomsNeedingBackingCount": sum(
                1 for room in rooms if int(room.get("unbackedBoundaryEdgeCount") or 0) > 0
            ),
            "roomsNeedingAccessCount": sum(
                1 for room in rooms if room.get("accessStatus") == "needs_access_fact"
            ),
            "unbackedBoundaryEdgeCount": sum(
                int(room.get("unbackedBoundaryEdgeCount") or 0) for room in rooms
            ),
            "missingAccessRefCount": sum(len(room.get("missingAccessRefs") or []) for room in rooms),
            "missingAdjacentRoomRefCount": sum(
                len(room.get("missingAdjacentRoomRefs") or []) for room in rooms
            ),
        },
        "rooms": rooms,
    }


def _required_before_mcp(
    unbacked_edges: list[dict[str, Any]],
    access_refs: list[str],
    missing_access_refs: list[str],
    missing_adjacent_refs: list[str],
) -> list[dict[str, Any]]:
    requirements = []
    if unbacked_edges:
        requirements.append(
            {
                "code": "room_boundary_edges_need_backing",
                "message": "Every room boundary edge must reference a wall, partition, or room separation.",
                "acceptableTools": ["author.wall", "author.room_separation"],
            }
        )
    if not access_refs:
        requirements.append(
            {
                "code": "room_access_needs_source_fact",
                "message": "Room needs at least one source-backed door/opening/circulation access fact.",
                "acceptableTools": ["opening.door_on_wall", "opening.window_on_wall"],
            }
        )
    if missing_access_refs:
        requirements.append(
            {
                "code": "room_access_refs_missing_source_facts",
                "message": "Every room access reference must resolve to a source opening/door/window/stair fact.",
                "missingRefs": missing_access_refs,
                "acceptableTools": ["opening.door_on_wall", "opening.window_on_wall"],
            }
        )
    if missing_adjacent_refs:
        requirements.append(
            {
                "code": "room_adjacent_refs_missing_room_facts",
                "message": "Every adjacentRoomRef must resolve to a source-backed room/circulation fact.",
                "missingRefs": missing_adjacent_refs,
                "acceptableTools": ["author.room_outline", "author.room_separation"],
            }
        )
    return requirements


def _string_refs(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return sorted(set(str(item) for item in raw if item))
    if raw:
        return [str(raw)]
    return []
