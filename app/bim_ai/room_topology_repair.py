"""Room topology repair worklists for reverse-BIM handoff."""

from __future__ import annotations

from typing import Any


def _graph_payload(room_access_graph: dict[str, Any]) -> dict[str, Any]:
    data = room_access_graph.get("data")
    if isinstance(data, dict) and isinstance(data.get("graph"), dict):
        return data["graph"]
    return room_access_graph


def _edges_payload(room_boundary_edges: dict[str, Any]) -> dict[str, Any]:
    data = room_boundary_edges.get("data")
    if isinstance(data, dict) and isinstance(data.get("boundaryEdges"), dict):
        return data["boundaryEdges"]
    return room_boundary_edges


def build_room_topology_repair_worklist(
    model_id: str,
    room_access_graph: dict[str, Any],
    room_boundary_edges: dict[str, Any],
) -> dict[str, Any]:
    """Return deterministic candidate repairs for room topology/access failures."""

    graph = _graph_payload(room_access_graph)
    edges_report = _edges_payload(room_boundary_edges)
    actions: list[dict[str, Any]] = []
    for room in edges_report.get("rooms") or []:
        room_id = str(room.get("roomId") or "")
        level_id = room.get("levelId")
        for edge in room.get("edges") or []:
            if edge.get("status") == "backed":
                continue
            action_id = f"room-separation:{room_id}:edge-{edge.get('edgeIndex')}"
            actions.append(
                {
                    "id": action_id,
                    "kind": "author_room_separation",
                    "status": "candidate",
                    "roomId": room_id,
                    "reason": "Room boundary edge lacks wall or room-separation backing.",
                    "surface": "author.room_separation",
                    "payload": {
                        "id": action_id,
                        "name": f"Boundary backing for {room_id} edge {edge.get('edgeIndex')}",
                        "levelId": level_id,
                        "start": edge.get("fromMm"),
                        "end": edge.get("toMm"),
                    },
                    "sourceRequirement": (
                        "Only commit if the source plan confirms this is an analytical room boundary "
                        "or open separation; otherwise model the physical wall/door instead."
                    ),
                    "evidence": {
                        "edgeIndex": edge.get("edgeIndex"),
                        "unsupportedIntervalsMm": edge.get("unsupportedIntervalsMm") or [],
                    },
                }
            )

    for room_id in graph.get("inaccessibleRoomIds") or []:
        room = next(
            (item for item in graph.get("rooms") or [] if item.get("roomId") == room_id), {}
        )
        actions.append(
            {
                "id": f"room-access:{room_id}",
                "kind": "resolve_or_author_room_access",
                "status": "blocked_needs_source_fact",
                "roomId": room_id,
                "levelId": room.get("levelId"),
                "reason": "Room has no geometrically evidenced physical door/opening access.",
                "requiredSourceFields": [
                    "host wall or boundary edge",
                    "door/opening type",
                    "position on wall or source point",
                    "width and swing if visible",
                    "adjacent/circulation room",
                ],
                "candidateTools": [
                    "resolve.room_boundary_edges",
                    "query.room_access_graph",
                    "query.nearest_wall",
                    "opening.door_on_wall",
                    "opening.window_on_wall",
                ],
            }
        )

    counts: dict[str, int] = {}
    for action in actions:
        kind = str(action.get("kind"))
        counts[kind] = counts.get(kind, 0) + 1
    return {
        "format": "roomTopologyRepairWorklist_v1",
        "modelId": model_id,
        "summary": {
            "actionCount": len(actions),
            "kindCounts": counts,
            "candidateActionCount": sum(
                1 for action in actions if action.get("status") == "candidate"
            ),
            "blockedActionCount": sum(
                1 for action in actions if str(action.get("status") or "").startswith("blocked")
            ),
        },
        "actions": actions,
    }
