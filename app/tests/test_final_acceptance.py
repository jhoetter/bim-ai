from __future__ import annotations

from bim_ai.final_acceptance import build_final_acceptance_report


def _clean_inputs() -> dict:
    return {
        "advisor": {"data": {"summary": {"severityCounts": {"error": 0, "warning": 0}}}},
        "constructability": {"summary": {"severityCounts": {"error": 0, "warning": 0}}},
        "integrity": {"summary": {"blockingFindingCount": 0}},
        "area_reconciliation": {"summary": {"accepted": True, "blockingCount": 0}},
        "coverage": {"modeledFactCount": 3, "unmodeledBlockingFactIds": []},
        "finding_disposition": {"summary": {"accepted": True, "unresolvedBlockingCount": 0}},
        "room_access_graph": {"data": {"graph": {"inaccessibleRoomIds": []}}},
        "room_boundary_edges": {
            "data": {
                "boundaryEdges": {
                    "summary": {
                        "unbackedEdgeCount": 0,
                        "partialEdgeCount": 0,
                    }
                }
            }
        },
        "room_topology_repair": {"summary": {"blockedActionCount": 0}},
    }


def test_final_acceptance_passes_clean_model() -> None:
    report = build_final_acceptance_report("model-a", **_clean_inputs())

    assert report["accepted"] is True
    assert report["summary"]["blockingGateIds"] == []
    assert all(gate["passed"] for gate in report["gates"])


def test_final_acceptance_blocks_partial_reverse_bim_model() -> None:
    payload = _clean_inputs()
    payload["advisor"] = {
        "data": {"summary": {"severityCounts": {"error": 1, "warning": 2}}}
    }
    payload["coverage"] = {
        "modeledFactCount": 2,
        "unmodeledBlockingFactIds": ["source-a"],
    }
    payload["room_access_graph"] = {
        "data": {"graph": {"inaccessibleRoomIds": ["room-a"]}}
    }
    payload["room_boundary_edges"] = {
        "data": {
            "boundaryEdges": {
                "summary": {
                    "unbackedEdgeCount": 3,
                    "partialEdgeCount": 0,
                }
            }
        }
    }

    report = build_final_acceptance_report("model-a", **payload)

    assert report["accepted"] is False
    assert report["summary"]["blockingGateIds"] == [
        "advisor_clean",
        "source_coverage_complete",
        "room_topology_complete",
    ]
    room_gate = next(gate for gate in report["gates"] if gate["id"] == "room_topology_complete")
    assert room_gate["blockingReasons"] == [
        "1 inaccessible rooms remain",
        "3 unbacked room boundary edges remain",
    ]


def test_final_acceptance_allows_reviewed_warning_and_source_dispositions() -> None:
    payload = _clean_inputs()
    payload["advisor"] = {
        "data": {"summary": {"severityCounts": {"error": 0, "warning": 1}}}
    }
    payload["constructability"] = {"summary": {"severityCounts": {"error": 0, "warning": 1}}}
    payload["coverage"] = {
        "modeledFactCount": 2,
        "unmodeledBlockingFactIds": ["source-a"],
    }
    payload["finding_disposition"] = {
        "summary": {"accepted": True, "unresolvedBlockingCount": 0},
        "rows": [
            {
                "source": "advisor",
                "ruleId": "door_operation_clearance_conflict",
                "severity": "warning",
                "disposition": "tolerated_source_lacks_swing_direction",
                "blocking": False,
            },
            {
                "source": "source_coverage",
                "factId": "source-a",
                "disposition": "duplicate_reconciled",
                "blocking": False,
            },
        ],
    }

    report = build_final_acceptance_report("model-a", **payload)

    assert report["accepted"] is True
