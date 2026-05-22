from __future__ import annotations

from bim_ai.reverse_bim.phase_runner import build_reverse_bim_phase_run_report


def _spec() -> dict:
    return {
        "format": "reverseBimPhaseAuthoringSpec_v1",
        "phases": [
            {
                "phaseId": "P2-levels",
                "status": "ready",
                "sourceFactIds": ["level-eg"],
                "authoringActions": [{"factId": "level-eg"}],
                "requiredQaAfter": ["qa.advisor"],
                "acceptanceChecks": ["advisor_findings_disposed"],
            },
            {
                "phaseId": "P7-openings",
                "status": "ready",
                "sourceFactIds": ["door-eg"],
                "authoringActions": [{"factId": "door-eg"}],
                "requiredQaAfter": ["qa.advisor"],
                "acceptanceChecks": ["all_openings_hosted_and_cut_hosts"],
            },
        ],
    }


def test_phase_run_blocks_missing_source_bearing_phase_packets() -> None:
    report = build_reverse_bim_phase_run_report(phase_authoring_spec=_spec(), phase_packets=[])

    assert report["ok"] is False
    assert report["summary"]["missingPacketCount"] == 2
    assert report["summary"]["firstBlockedPhaseId"] == "P2-levels"
    assert report["phases"][0]["blockers"][0]["code"] == "phase_packet_missing"


def test_phase_run_accepts_sequential_accepted_packets() -> None:
    report = build_reverse_bim_phase_run_report(
        phase_authoring_spec=_spec(),
        phase_packets=[
            {
                "format": "reverseBimPhasePacket_v1",
                "phaseId": "P2-levels",
                "acceptedForNextPhase": True,
                "sourceFactIds": ["level-eg"],
                "summary": {"packetErrorCount": 0},
            },
            {
                "format": "reverseBimPhasePacket_v1",
                "phaseId": "P7-openings",
                "acceptedForNextPhase": True,
                "sourceFactIds": ["door-eg"],
                "summary": {"packetErrorCount": 0},
            },
        ],
    )

    assert report["ok"] is True
    assert report["summary"]["acceptedPhaseCount"] == 2
    assert {row["status"] for row in report["phases"]} == {"accepted"}


def test_phase_run_blocks_skipped_or_incomplete_packets() -> None:
    report = build_reverse_bim_phase_run_report(
        phase_authoring_spec=_spec(),
        phase_packets=[
            {
                "format": "reverseBimPhasePacket_v1",
                "phaseId": "P2-levels",
                "acceptedForNextPhase": False,
                "sourceFactIds": ["level-eg"],
                "summary": {"blockingWarningCount": 1},
            },
            {
                "format": "reverseBimPhasePacket_v1",
                "phaseId": "P7-openings",
                "acceptedForNextPhase": True,
                "sourceFactIds": [],
                "summary": {"packetErrorCount": 0},
            },
        ],
    )

    assert report["ok"] is False
    assert report["phases"][0]["blockers"][0]["code"] == "phase_packet_not_accepted"
    later_codes = {row["code"] for row in report["phases"][1]["blockers"]}
    assert "phase_previous_phase_blocked" in later_codes
    assert "phase_packet_missing_source_facts" in later_codes


def test_phase_run_requires_expected_readback_evidence() -> None:
    spec = {
        "format": "reverseBimPhaseAuthoringSpec_v1",
        "phases": [
            {
                "phaseId": "P4-floor-plan-topology",
                "sourceFactIds": ["wall-1"],
                "authoringActions": [{"factId": "wall-1"}],
                "expectedReadback": [
                    {
                        "expectationId": "readback:wall-1",
                        "sourceFactId": "wall-1",
                        "expected": {"elementKind": "wall", "elementCount": {"min": 1, "max": 1}},
                    }
                ],
            }
        ],
    }
    missing = build_reverse_bim_phase_run_report(
        phase_authoring_spec=spec,
        phase_packets=[
            {
                "phaseId": "P4-floor-plan-topology",
                "acceptedForNextPhase": True,
                "sourceFactIds": ["wall-1"],
            }
        ],
    )
    accepted = build_reverse_bim_phase_run_report(
        phase_authoring_spec=spec,
        phase_packets=[
            {
                "phaseId": "P4-floor-plan-topology",
                "acceptedForNextPhase": True,
                "sourceFactIds": ["wall-1"],
                "evidencePackage": {
                    "readback": [
                        {
                            "expectationId": "readback:wall-1",
                            "sourceFactId": "wall-1",
                            "status": "matched",
                        }
                    ]
                },
            }
        ],
    )

    assert missing["ok"] is False
    assert missing["summary"]["missingReadbackExpectationPhaseCount"] == 1
    assert missing["phases"][0]["blockers"][0]["code"] == "phase_packet_missing_readback_expectations"
    assert accepted["ok"] is True
    assert accepted["phases"][0]["readbackEvidenceCount"] == 1


def test_phase_run_accepts_readback_comparison_report_rows() -> None:
    spec = {
        "format": "reverseBimPhaseAuthoringSpec_v1",
        "phases": [
            {
                "phaseId": "S2-EG",
                "sourceFactIds": ["wall-1"],
                "authoringActions": [{"factId": "wall-1"}],
                "expectedReadback": [
                    {"expectationId": "readback:wall-1", "sourceFactId": "wall-1"}
                ],
            }
        ],
    }

    report = build_reverse_bim_phase_run_report(
        phase_authoring_spec=spec,
        phase_packets=[
            {
                "phaseId": "S2-EG",
                "acceptedForNextPhase": True,
                "sourceFactIds": ["wall-1"],
                "evidencePackage": {
                    "readbackComparison": {
                        "rows": [
                            {
                                "expectationId": "readback:wall-1",
                                "sourceFactId": "wall-1",
                                "status": "matched",
                            }
                        ]
                    }
                },
            }
        ],
    )

    assert report["ok"] is True
    assert report["phases"][0]["readbackEvidenceCount"] == 1
