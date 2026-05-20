from __future__ import annotations

from bim_ai.reverse_bim_phase_runner import build_reverse_bim_phase_run_report


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
