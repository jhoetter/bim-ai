from __future__ import annotations

from bim_ai.room_topology_repair import build_room_topology_repair_worklist


def test_room_topology_repair_worklist_emits_room_separations_and_access_blockers() -> None:
    graph = {
        "format": "roomAccessGraph_v1",
        "rooms": [
            {
                "roomId": "room-a",
                "levelId": "EG",
                "doorIds": [],
                "adjacentRoomIds": [],
                "accessible": False,
            }
        ],
        "inaccessibleRoomIds": ["room-a"],
    }
    boundary_edges = {
        "format": "roomBoundaryEdgesReport_v1",
        "rooms": [
            {
                "roomId": "room-a",
                "levelId": "EG",
                "edges": [
                    {
                        "edgeIndex": 1,
                        "fromMm": {"xMm": 0, "yMm": 0},
                        "toMm": {"xMm": 1000, "yMm": 0},
                        "status": "unbacked",
                        "supportRefs": [],
                        "unsupportedIntervalsMm": [{"startMm": 0, "endMm": 1000}],
                    }
                ],
            }
        ],
    }

    worklist = build_room_topology_repair_worklist("model-a", graph, boundary_edges)

    assert worklist["format"] == "roomTopologyRepairWorklist_v1"
    assert worklist["summary"] == {
        "actionCount": 2,
        "kindCounts": {
            "author_room_separation": 1,
            "resolve_or_author_room_access": 1,
        },
        "candidateActionCount": 1,
        "blockedActionCount": 1,
    }
    assert worklist["actions"][0]["surface"] == "author.room_separation"
    assert worklist["actions"][0]["payload"] == {
        "id": "room-separation:room-a:edge-1",
        "name": "Boundary backing for room-a edge 1",
        "levelId": "EG",
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 1000, "yMm": 0},
    }
    assert worklist["actions"][1]["status"] == "blocked_needs_source_fact"


def test_room_topology_repair_worklist_accepts_query_wrapped_payloads() -> None:
    graph = {
        "data": {
            "graph": {
                "format": "roomAccessGraph_v1",
                "rooms": [],
                "inaccessibleRoomIds": [],
            }
        }
    }
    boundary_edges = {
        "data": {
            "boundaryEdges": {
                "format": "roomBoundaryEdgesReport_v1",
                "rooms": [],
            }
        }
    }

    worklist = build_room_topology_repair_worklist("model-a", graph, boundary_edges)

    assert worklist["summary"]["actionCount"] == 0
