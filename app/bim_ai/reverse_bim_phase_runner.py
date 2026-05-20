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
    return {
        "ok": blocked_count == 0,
        "format": "reverseBimPhaseRunReport_v1",
        "summary": {
            "phaseCount": len(phase_rows),
            "acceptedPhaseCount": accepted_count,
            "blockedPhaseCount": blocked_count,
            "missingPacketCount": missing_packet_count,
            "firstBlockedPhaseId": first_blocked_phase_id,
        },
        "phases": phase_rows,
        "nextStep": (
            "All source-bearing phases have accepted packets."
            if blocked_count == 0
            else f"Create or repair the phase packet for {first_blocked_phase_id} before continuing."
        ),
    }


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
