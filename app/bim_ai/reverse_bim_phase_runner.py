"""Phase-run enforcement for MCP-first reverse-BIM authoring."""

from __future__ import annotations

from typing import Any


def build_reverse_bim_phase_run_report(
    *,
    phase_authoring_spec: dict[str, Any],
    phase_packets: list[dict[str, Any]] | dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Check that reverse-BIM phases advance only through accepted packets."""

    packet_by_phase = _packets_by_phase(phase_packets)
    phase_rows = []
    first_blocked_phase_id: str | None = None
    previous_blocked = False
    for phase in _phase_rows(phase_authoring_spec):
        phase_id = str(phase.get("phaseId") or "")
        packet = packet_by_phase.get(phase_id)
        source_fact_ids = [str(item) for item in phase.get("sourceFactIds") or [] if item]
        expected_readback = [
            row for row in phase.get("expectedReadback") or [] if isinstance(row, dict)
        ]
        has_modeling_work = bool(
            source_fact_ids
            or phase.get("authoringActions")
            or phase.get("resolverItems")
            or phase_id in {"P14-validation", "P15-final-acceptance"}
        )
        blockers = []
        if previous_blocked and has_modeling_work:
            blockers.append(
                {
                    "code": "phase_previous_phase_blocked",
                    "severity": "error",
                    "message": "A prior source-bearing phase is not accepted; this phase cannot proceed.",
                }
            )
        if has_modeling_work and packet is None:
            blockers.append(
                {
                    "code": "phase_packet_missing",
                    "severity": "error",
                    "message": "Source-bearing phase has no reverse_bim.phase_packet evidence.",
                }
            )
        if packet is not None and packet.get("acceptedForNextPhase") is not True:
            blockers.append(
                {
                    "code": "phase_packet_not_accepted",
                    "severity": "error",
                    "message": "Phase packet exists but is not accepted for next phase.",
                    "packetSummary": packet.get("summary"),
                }
            )
        if packet is not None:
            missing_source_fact_ids = sorted(set(source_fact_ids) - set(packet.get("sourceFactIds") or []))
            if missing_source_fact_ids:
                blockers.append(
                    {
                        "code": "phase_packet_missing_source_facts",
                        "severity": "error",
                        "missingSourceFactIds": missing_source_fact_ids,
                        "message": "Phase packet does not account for all source facts assigned to the phase.",
                    }
                )
            readback_rows = _packet_readback_rows(packet)
            if expected_readback:
                missing_expectation_ids = _missing_readback_expectation_ids(
                    expected_readback,
                    readback_rows,
                )
                if missing_expectation_ids:
                    blockers.append(
                        {
                            "code": "phase_packet_missing_readback_expectations",
                            "severity": "error",
                            "missingExpectationIds": missing_expectation_ids,
                            "message": "Phase packet lacks query/readback evidence for expected authored elements.",
                        }
                    )
                failed_readback_rows = [
                    row
                    for row in readback_rows
                    if str(row.get("status") or row.get("readbackStatus") or "") not in _ACCEPTED_READBACK_STATUSES
                ]
                if failed_readback_rows:
                    blockers.append(
                        {
                            "code": "phase_packet_failed_readback_expectations",
                            "severity": "error",
                            "failedReadbackCount": len(failed_readback_rows),
                            "message": "One or more query/readback evidence rows are not accepted.",
                        }
                    )
        status = "accepted" if has_modeling_work and not blockers and packet is not None else "empty"
        if blockers:
            status = "blocked"
        elif has_modeling_work and packet is None:
            status = "blocked"
        phase_rows.append(
            {
                "phaseId": phase_id,
                "specStatus": phase.get("status"),
                "status": status,
                "hasModelingWork": has_modeling_work,
                "packetPresent": packet is not None,
                "acceptedForNextPhase": bool(packet and packet.get("acceptedForNextPhase") is True),
                "sourceFactIds": source_fact_ids,
                "expectedReadbackCount": len(expected_readback),
                "readbackEvidenceCount": len(_packet_readback_rows(packet)) if packet else 0,
                "requiredQaAfter": phase.get("requiredQaAfter") or [],
                "acceptanceChecks": phase.get("acceptanceChecks") or [],
                "blockers": blockers,
            }
        )
        if blockers and first_blocked_phase_id is None:
            first_blocked_phase_id = phase_id
        previous_blocked = previous_blocked or bool(blockers)

    blocked_count = sum(1 for row in phase_rows if row.get("status") == "blocked")
    accepted_count = sum(1 for row in phase_rows if row.get("status") == "accepted")
    missing_packet_count = sum(
        1 for row in phase_rows if row.get("hasModelingWork") and not row.get("packetPresent")
    )
    missing_readback_count = sum(
        1
        for row in phase_rows
        for blocker in row.get("blockers") or []
        if blocker.get("code") == "phase_packet_missing_readback_expectations"
    )
    return {
        "ok": blocked_count == 0,
        "format": "reverseBimPhaseRunReport_v1",
        "summary": {
            "phaseCount": len(phase_rows),
            "acceptedPhaseCount": accepted_count,
            "blockedPhaseCount": blocked_count,
            "missingPacketCount": missing_packet_count,
            "missingReadbackExpectationPhaseCount": missing_readback_count,
            "firstBlockedPhaseId": first_blocked_phase_id,
        },
        "phases": phase_rows,
        "nextStep": (
            "All source-bearing phases have accepted packets."
            if blocked_count == 0
            else f"Create or repair the phase packet for {first_blocked_phase_id} before continuing."
        ),
    }


_ACCEPTED_READBACK_STATUSES = {"accepted", "matched", "passed", "ok"}


def _packet_readback_rows(packet: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(packet, dict):
        return []
    candidates = [
        packet.get("readback"),
        packet.get("modelReadback"),
        packet.get("readbackEvidence"),
    ]
    evidence = packet.get("evidencePackage") if isinstance(packet.get("evidencePackage"), dict) else {}
    candidates.extend(
        [
            evidence.get("readback"),
            evidence.get("modelReadback"),
            evidence.get("readbackEvidence"),
            evidence.get("readbackExpectations"),
        ]
    )
    rows: list[dict[str, Any]] = []
    for candidate in candidates:
        if isinstance(candidate, list):
            rows.extend(row for row in candidate if isinstance(row, dict))
        elif isinstance(candidate, dict) and isinstance(candidate.get("rows"), list):
            rows.extend(row for row in candidate["rows"] if isinstance(row, dict))
    return rows


def _missing_readback_expectation_ids(
    expected_readback: list[dict[str, Any]],
    readback_rows: list[dict[str, Any]],
) -> list[str]:
    present = set()
    for row in readback_rows:
        for key in ("expectationId", "expectedReadbackId", "sourceFactId"):
            if row.get(key):
                present.add(str(row[key]))
    missing = []
    for expectation in expected_readback:
        expectation_id = str(expectation.get("expectationId") or "")
        source_fact_id = str(expectation.get("sourceFactId") or "")
        if expectation_id not in present and source_fact_id not in present:
            missing.append(expectation_id or source_fact_id)
    return sorted(item for item in missing if item)


def _phase_rows(phase_authoring_spec: dict[str, Any]) -> list[dict[str, Any]]:
    phases = phase_authoring_spec.get("phases") if isinstance(phase_authoring_spec, dict) else []
    return [phase for phase in phases or [] if isinstance(phase, dict)]


def _packets_by_phase(phase_packets: list[dict[str, Any]] | dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if phase_packets is None:
        return {}
    rows: list[dict[str, Any]]
    if isinstance(phase_packets, dict) and isinstance(phase_packets.get("phasePackets"), list):
        rows = [row for row in phase_packets["phasePackets"] if isinstance(row, dict)]
    elif isinstance(phase_packets, dict):
        rows = [
            {**value, "phaseId": key}
            for key, value in phase_packets.items()
            if isinstance(value, dict)
        ]
    else:
        rows = [row for row in phase_packets if isinstance(row, dict)]
    return {str(row.get("phaseId") or ""): row for row in rows if row.get("phaseId")}
