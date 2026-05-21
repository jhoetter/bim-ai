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
        "level_completeness": {"summary": {"accepted": True, "emptyRequiredLevelCount": 0}},
        "physical_topology": {"summary": {"accepted": True, "blockingCount": 0}},
        "source_overlay": {
            "summary": {
                "accepted": True,
                "missingRequiredViewCount": 0,
                "failedViewCount": 0,
            }
        },
        "ui_evidence": {"summary": {"accepted": True, "missingScreenshotCount": 0}},
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


def test_final_acceptance_derives_counts_from_live_advisor_violations_shape() -> None:
    payload = _clean_inputs()
    payload["advisor"] = {
        "data": {
            "summary": {"elementTotal": 12},
            "violations": [
                {
                    "ruleId": "door_operation_clearance_conflict",
                    "severity": "warning",
                    "blocking": False,
                },
                {
                    "ruleId": "door_operation_clearance_conflict",
                    "severity": "warning",
                    "blocking": False,
                },
            ],
        }
    }

    report = build_final_acceptance_report("model-a", **payload)

    assert report["accepted"] is False
    advisor_gate = next(gate for gate in report["gates"] if gate["id"] == "advisor_clean")
    assert advisor_gate["summary"]["severityCounts"] == {"warning": 2}
    assert advisor_gate["summary"]["ruleCounts"] == {"door_operation_clearance_conflict": 2}
    assert advisor_gate["blockingReasons"] == ["2 blocking Advisor warnings remain"]


def test_final_acceptance_blocks_reviewed_warning_dispositions() -> None:
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

    assert report["accepted"] is False
    assert "advisor_clean" in report["summary"]["blockingGateIds"]
    assert report["summary"]["existingConditionToleranceCount"] == 0


def test_final_acceptance_allows_source_backed_existing_condition_tolerance() -> None:
    payload = _clean_inputs()
    payload["advisor"] = {
        "data": {"summary": {"severityCounts": {"error": 0, "warning": 1}}}
    }
    payload["finding_disposition"] = {
        "summary": {"accepted": True, "unresolvedBlockingCount": 0},
        "rows": [
            {
                "source": "advisor",
                "ruleId": "stair_riser_tread_comfort_failure",
                "severity": "warning",
                "disposition": "existing_nonconforming_tolerated",
                "blocking": False,
                "reason": "Existing stair dimensions are documented in the source plan.",
                "acceptedBy": "architect-review",
                "sourceFactIds": ["stair-source-1"],
            }
        ],
    }

    report = build_final_acceptance_report("model-a", **payload)

    assert report["accepted"] is True
    assert report["summary"]["existingConditionToleranceCount"] == 1
    assert report["summary"]["existingConditionToleranceCountsBySource"] == {"advisor": 1}
    assert report["existingConditionTolerances"]["rows"] == [
        {
            "id": None,
            "source": "advisor",
            "ruleId": "stair_riser_tread_comfort_failure",
            "severity": "warning",
            "disposition": "existing_nonconforming_tolerated",
            "elementIds": [],
            "sourceFactIds": ["stair-source-1"],
            "reason": "Existing stair dimensions are documented in the source plan.",
            "acceptedBy": "architect-review",
        }
    ]


def test_final_acceptance_allows_source_backed_existing_condition_alias() -> None:
    payload = _clean_inputs()
    payload["constructability"] = {
        "summary": {"severityCounts": {"error": 0, "warning": 1}}
    }
    payload["finding_disposition"] = {
        "summary": {"accepted": True, "unresolvedBlockingCount": 0},
        "rows": [
            {
                "source": "constructability",
                "ruleId": "wall_clearance_existing_condition",
                "severity": "warning",
                "disposition": "existing_nonconforming_source_backed",
                "blocking": False,
                "reason": "The close wall spacing is shown in the source floor plan.",
                "acceptedBy": "architect-review",
                "sourceFactIds": ["wall-fact-1", "wall-fact-2"],
            }
        ],
    }

    report = build_final_acceptance_report("model-a", **payload)

    assert report["accepted"] is True
    assert report["summary"]["existingConditionToleranceCount"] == 1
    assert report["existingConditionTolerances"]["rows"][0]["sourceFactIds"] == [
        "wall-fact-1",
        "wall-fact-2",
    ]


def test_final_acceptance_rejects_target_house_3_failure_shape() -> None:
    payload = _clean_inputs()
    payload["advisor"] = {
        "data": {"summary": {"severityCounts": {"error": 0, "warning": 18}}}
    }
    payload["constructability"] = {
        "summary": {"severityCounts": {"error": 0, "warning": 18}}
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
                "reason": "Source did not show swing direction.",
                "acceptedBy": "fixture",
            }
        ],
    }
    payload["level_completeness"] = {
        "summary": {
            "accepted": False,
            "emptyRequiredLevelCount": 1,
            "emptyRequiredLevelIds": ["KG"],
        }
    }
    payload["physical_topology"] = {
        "summary": {
            "accepted": False,
            "unbackedPhysicalRoomCount": 4,
            "stairClashCount": 1,
        }
    }
    payload["source_overlay"] = {
        "summary": {"accepted": False, "missingRequiredViewCount": 4}
    }
    payload["ui_evidence"] = {
        "summary": {"accepted": False, "missingScreenshotCount": 3}
    }

    report = build_final_acceptance_report("target-house-3", **payload)

    assert report["accepted"] is False
    assert report["summary"]["blockingGateIds"] == [
        "advisor_clean",
        "constructability_clean",
        "level_completeness",
        "physical_topology",
        "source_overlay_evidence",
        "ui_evidence",
    ]
