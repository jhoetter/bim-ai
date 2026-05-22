from __future__ import annotations

from bim_ai.services.folder_output import _build_open_repair_requests, _build_package_acceptance_report
from bim_ai.source_room_topology import build_source_room_topology_report


def test_source_room_topology_derives_required_edge_and_access_repairs() -> None:
    facts = [
        {
            "factId": "room-a",
            "kind": "room",
            "value": {
                "levelId": "EG",
                "name": "Room A",
                "areaM2": 12.3,
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            },
        }
    ]

    report = build_source_room_topology_report(facts)

    assert report["summary"] == {
        "roomCount": 1,
        "roomsNeedingBackingCount": 1,
        "roomsNeedingAccessCount": 1,
        "unbackedBoundaryEdgeCount": 4,
        "missingAccessRefCount": 0,
        "missingAdjacentRoomRefCount": 0,
    }
    assert report["rooms"][0]["requiredBeforeMcp"] == [
        {
            "code": "room_boundary_edges_need_backing",
            "message": "Every room boundary edge must reference a wall, partition, or room separation.",
            "acceptableTools": ["author.wall", "author.room_separation"],
        },
        {
            "code": "room_access_needs_source_fact",
            "message": "Room needs at least one source-backed door/opening/circulation access fact.",
            "acceptableTools": ["opening.door_on_wall", "opening.window_on_wall"],
        },
    ]


def test_source_room_topology_accepts_explicit_backing_and_access_refs() -> None:
    facts = [
        {"factId": "door-a", "kind": "opening", "value": {"openingKind": "door"}},
        {
            "factId": "room-a",
            "kind": "room",
            "value": {
                "levelId": "EG",
                "name": "Room A",
                "accessRefs": ["door-a"],
                "boundaryEdges": [
                    {
                        "fromMm": {"xMm": 0, "yMm": 0},
                        "toMm": {"xMm": 3000, "yMm": 0},
                        "backingWallRef": "wall-a",
                    }
                ],
            },
        }
    ]

    report = build_source_room_topology_report(facts)

    assert report["summary"]["roomsNeedingBackingCount"] == 0
    assert report["summary"]["roomsNeedingAccessCount"] == 0
    assert report["rooms"][0]["edges"][0]["status"] == "source_backed"
    assert report["rooms"][0]["requiredBeforeMcp"] == []


def test_source_room_topology_blocks_missing_access_and_adjacent_refs() -> None:
    facts = [
        {
            "factId": "room-a",
            "kind": "room",
            "value": {
                "levelId": "EG",
                "name": "Room A",
                "accessRefs": ["door-missing"],
                "adjacentRoomRefs": ["room-flur-missing"],
                "boundaryEdges": [
                    {
                        "fromMm": {"xMm": 0, "yMm": 0},
                        "toMm": {"xMm": 3000, "yMm": 0},
                        "backingWallRef": "wall-a",
                    }
                ],
            },
        }
    ]

    report = build_source_room_topology_report(facts)

    assert report["summary"]["missingAccessRefCount"] == 1
    assert report["summary"]["missingAdjacentRoomRefCount"] == 1
    codes = [row["code"] for row in report["rooms"][0]["requiredBeforeMcp"]]
    assert codes == [
        "room_access_refs_missing_source_facts",
        "room_adjacent_refs_missing_room_facts",
    ]


def test_open_repair_requests_include_room_topology_reader_repairs() -> None:
    room_topology = {
        "rooms": [
            {
                "roomFactId": "room-a",
                "levelId": "EG",
                "name": "Room A",
                "requiredBeforeMcp": [{"code": "room_access_needs_source_fact"}],
                "provenance": {"sourceDocumentId": "doc-a"},
            }
        ]
    }

    requests = _build_open_repair_requests(
        loop={"repairRequests": [{"repairRequestId": "existing"}]},
        room_topology=room_topology,
    )

    assert [request["repairRequestId"] for request in requests] == [
        "existing",
        "room-topology-room-a",
    ]
    assert requests[1]["kind"] == "room_topology_source_repair"
    assert requests[1]["workPackageId"] == "wp-dimensional-floorplans"


def test_package_acceptance_blocks_incomplete_source_room_topology() -> None:
    report = _build_package_acceptance_report(
        raw_responses={"responseCount": 1},
        loop={"summary": {"acceptedPackageCount": 1}},
        readiness={"summary": {"blockerCount": 0}},
        conflicts={"openConflictCount": 0},
        source_completeness={"ok": True},
        room_topology={
            "summary": {
                "roomsNeedingBackingCount": 2,
                "roomsNeedingAccessCount": 1,
                "missingAccessRefCount": 0,
                "missingAdjacentRoomRefCount": 0,
            }
        },
        source_area_consistency={"summary": {"blockingCount": 0}},
        coordinate_frame_alignment_report={"summary": {"blockingAlignmentCount": 0}},
    )

    assert report["ok"] is False
    assert report["packageState"] == "source_understanding_blocked"
    assert report["summary"]["roomsNeedingBoundaryBackingCount"] == 2
    assert report["summary"]["roomsNeedingAccessFactCount"] == 1
    assert report["summary"]["missingRoomAccessRefCount"] == 0
    assert report["summary"]["missingAdjacentRoomRefCount"] == 0
    assert report["findings"][0]["code"] == "folder_output_room_topology_incomplete"


def test_package_acceptance_allows_resolver_only_mcp_readiness() -> None:
    report = _build_package_acceptance_report(
        raw_responses={"responseCount": 1},
        loop={"summary": {"acceptedPackageCount": 1}},
        readiness={"summary": {"blockerCount": 4, "needsResolverCount": 4}},
        conflicts={"openConflictCount": 0},
        source_completeness={"ok": True},
        room_topology={
            "summary": {
                "roomsNeedingBackingCount": 0,
                "roomsNeedingAccessCount": 0,
                "missingAccessRefCount": 0,
                "missingAdjacentRoomRefCount": 0,
            }
        },
        source_area_consistency={"summary": {"blockingCount": 0}},
        coordinate_frame_alignment_report={"summary": {"blockingAlignmentCount": 0}},
    )

    assert report["ok"] is True
    assert report["packageState"] == "mcp_handoff_ready"
    assert report["summary"]["mcpReadinessBlockerCount"] == 4
    assert report["summary"]["hardMcpReadinessBlockerCount"] == 0
