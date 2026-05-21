"""Regenerate bounded MCP handoff work after reverse-BIM repair findings."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from typing import Any

from bim_ai.reverse_bim import build_mcp_authoring_readiness, plan_mcp_authoring_actions


SOURCE_REPAIR_CLASSIFICATIONS = {
    "source_fact_misread",
    "source_fact_underconstrained",
    "coordinate_frame_wrong",
}

REGENERATE_CLASSIFICATIONS = {
    "mcp_payload_wrong",
    "model_authoring_error",
    "missing_evidence",
}


def build_reverse_bim_handoff_regeneration_plan(
    *,
    facts: list[dict[str, Any]] | None = None,
    source_revision_ledger: dict[str, Any] | list[dict[str, Any]] | None = None,
    phase_authoring_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a bounded MCP handoff rerun plan from open repair ledger entries."""

    fact_index = {
        str(row.get("factId") or ""): row
        for row in facts or []
        if isinstance(row, dict) and row.get("factId")
    }
    entries = _ledger_entries(source_revision_ledger)
    source_repair_fact_ids = _fact_ids_for(entries, SOURCE_REPAIR_CLASSIFICATIONS)
    regenerate_fact_ids = _fact_ids_for(entries, REGENERATE_CLASSIFICATIONS)
    tool_gap_fact_ids = _fact_ids_for(entries, {"tool_gap"})
    affected_phase_ids = _affected_phase_ids(entries, phase_authoring_spec or {})
    phase_plans = []
    for phase in _affected_phases(affected_phase_ids, phase_authoring_spec or {}, fact_index):
        phase_fact_ids = _phase_fact_ids(phase)
        phase_facts = [fact_index[fact_id] for fact_id in phase_fact_ids if fact_id in fact_index]
        blocked_source = sorted(set(phase_fact_ids) & source_repair_fact_ids)
        tool_gaps = sorted(set(phase_fact_ids) & tool_gap_fact_ids)
        regenerable = sorted((set(phase_fact_ids) & regenerate_fact_ids) - source_repair_fact_ids)
        authoring_plan = plan_mcp_authoring_actions(
            facts=[fact for fact in phase_facts if str(fact.get("factId") or "") not in blocked_source],
            target_phase=str(phase.get("phaseId") or phase.get("id") or "unknown"),
        )
        readiness = build_mcp_authoring_readiness(
            facts=[fact for fact in phase_facts if str(fact.get("factId") or "") not in blocked_source],
            target_phase=str(phase.get("phaseId") or phase.get("id") or "unknown"),
        )
        status = _phase_status(
            blocked_source=blocked_source,
            tool_gaps=tool_gaps,
            readiness=readiness,
        )
        phase_plans.append(
            {
                "phaseId": str(phase.get("phaseId") or phase.get("id") or "unknown"),
                "status": status,
                "sourceFactIds": phase_fact_ids,
                "sourceRepairFactIds": blocked_source,
                "toolGapFactIds": tool_gaps,
                "regenerableFactIds": regenerable,
                "authoringPlan": authoring_plan,
                "mcpReadiness": readiness,
                "expectedReadback": _expected_readback(authoring_plan),
                "nextStep": _phase_next_step(status),
            }
        )

    status_counts = Counter(str(row.get("status")) for row in phase_plans)
    blocking_count = sum(
        1
        for row in phase_plans
        if row.get("status")
        in {"source_repair_required", "tool_gap_blocked", "mcp_readiness_blocked"}
    )
    payload = {
        "ok": blocking_count == 0,
        "format": "reverseBimHandoffRegenerationPlan_v1",
        "summary": {
            "ledgerEntryCount": len(entries),
            "phasePlanCount": len(phase_plans),
            "blockingPhaseCount": blocking_count,
            "sourceRepairFactCount": len(source_repair_fact_ids),
            "regenerableFactCount": len(regenerate_fact_ids),
            "toolGapFactCount": len(tool_gap_fact_ids),
            "statusCounts": dict(sorted(status_counts.items())),
            "affectedPhaseIds": [row.get("phaseId") for row in phase_plans],
        },
        "phasePlans": phase_plans,
        "readerRepairRequests": _reader_repair_requests(entries, fact_index),
        "nextStep": (
            "Regenerate MCP handoff rows for ready phases, then rerun those slices."
            if blocking_count == 0
            else "Resolve source repair/tool-gap/readiness blockers before rerunning affected slices."
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def _ledger_entries(value: dict[str, Any] | list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if isinstance(value, dict):
        rows = value.get("entries") or value.get("rows") or []
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return []


def _fact_ids_for(entries: list[dict[str, Any]], classifications: set[str]) -> set[str]:
    out = set()
    for entry in entries:
        if str(entry.get("classification") or "") not in classifications:
            continue
        out.update(str(item) for item in entry.get("sourceFactIds") or [] if item)
    return out


def _affected_phase_ids(
    entries: list[dict[str, Any]],
    phase_authoring_spec: dict[str, Any],
) -> list[str]:
    ids = []
    for entry in entries:
        ids.extend(str(item) for item in entry.get("affectedPhaseIds") or [] if item)
    if ids:
        return sorted(set(ids))
    fact_ids = {str(item) for entry in entries for item in entry.get("sourceFactIds") or [] if item}
    out = []
    for phase in phase_authoring_spec.get("phases") or []:
        if fact_ids & set(_phase_fact_ids(phase)):
            out.append(str(phase.get("phaseId") or phase.get("id") or "unknown"))
    return sorted(set(out))


def _affected_phases(
    phase_ids: list[str],
    phase_authoring_spec: dict[str, Any],
    fact_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    phases = [
        phase
        for phase in phase_authoring_spec.get("phases") or []
        if isinstance(phase, dict) and str(phase.get("phaseId") or phase.get("id") or "") in phase_ids
    ]
    if phases:
        return phases
    return [
        {
            "phaseId": "repair-affected-facts",
            "sourceFactIds": sorted(fact_index),
        }
    ] if fact_index else []


def _phase_fact_ids(phase: dict[str, Any]) -> list[str]:
    ids = [str(item) for item in phase.get("sourceFactIds") or [] if item]
    for action in phase.get("authoringActions") or []:
        if isinstance(action, dict):
            value = action.get("factId") or action.get("sourceFactId")
            if value:
                ids.append(str(value))
    return sorted(set(ids))


def _phase_status(
    *,
    blocked_source: list[str],
    tool_gaps: list[str],
    readiness: dict[str, Any],
) -> str:
    if blocked_source:
        return "source_repair_required"
    if tool_gaps:
        return "tool_gap_blocked"
    if int((readiness.get("summary") or {}).get("blockerCount") or 0):
        return "mcp_readiness_blocked"
    return "handoff_regeneration_ready"


def _phase_next_step(status: str) -> str:
    return {
        "source_repair_required": "Run focused AI-reader/source repair for reopened facts first.",
        "tool_gap_blocked": "Implement or explicitly record missing MCP tool contracts.",
        "mcp_readiness_blocked": "Run required resolvers or repair incomplete source fields.",
        "handoff_regeneration_ready": "Use regenerated authoringPlan/expectedReadback to rerun this slice.",
    }.get(status, "Review regeneration status.")


def _expected_readback(authoring_plan: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for action in authoring_plan.get("actions") or []:
        if isinstance(action, dict) and isinstance(action.get("expectedReadback"), dict):
            rows.append(action["expectedReadback"])
    return rows


def _reader_repair_requests(
    entries: list[dict[str, Any]],
    fact_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = []
    for entry in entries:
        if str(entry.get("classification") or "") not in SOURCE_REPAIR_CLASSIFICATIONS:
            continue
        for fact_id in entry.get("sourceFactIds") or []:
            fact = fact_index.get(str(fact_id), {})
            rows.append(
                {
                    "requestId": f"reader-repair:{entry.get('ledgerEntryId')}:{fact_id}",
                    "factId": str(fact_id),
                    "reason": entry.get("reason"),
                    "requiredResolution": entry.get("requiredResolution"),
                    "provenance": fact.get("provenance"),
                    "currentFact": fact,
                }
            )
    return rows


def _digest(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
