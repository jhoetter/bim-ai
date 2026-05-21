"""Source-spec revision ledger for hybrid reverse-BIM repair loops."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from typing import Any


SOURCE_REOPEN_CLASSIFICATIONS = {
    "source_fact_misread",
    "source_fact_underconstrained",
    "coordinate_frame_wrong",
}


def build_reverse_bim_source_revision_ledger(
    *,
    facts: list[dict[str, Any]] | None = None,
    source_spec_revision: dict[str, Any] | None = None,
    existing_ledger: dict[str, Any] | list[dict[str, Any]] | None = None,
    phase_authoring_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a deterministic worklist for source/model repair actions."""

    actions = [
        row
        for row in (source_spec_revision or {}).get("actions", [])
        if isinstance(row, dict)
    ]
    prior_entries = _prior_entries(existing_ledger)
    entries = [*prior_entries]
    existing_ids = {str(row.get("ledgerEntryId") or "") for row in prior_entries}
    for action in actions:
        entry = _ledger_entry(action, phase_authoring_spec=phase_authoring_spec or {})
        if entry["ledgerEntryId"] not in existing_ids:
            entries.append(entry)
            existing_ids.add(entry["ledgerEntryId"])

    fact_updates = _fact_updates(facts or [], entries)
    open_entries = [row for row in entries if row.get("status") in {"open", "blocked"}]
    classification_counts = Counter(str(row.get("classification")) for row in entries)
    payload = {
        "ok": not any(row.get("blocking") for row in open_entries),
        "format": "reverseBimSourceRevisionLedger_v1",
        "summary": {
            "entryCount": len(entries),
            "openEntryCount": len(open_entries),
            "blockingEntryCount": sum(1 for row in open_entries if row.get("blocking")),
            "reopenedFactCount": len(
                {
                    fact_id
                    for row in entries
                    if row.get("classification") in SOURCE_REOPEN_CLASSIFICATIONS
                    for fact_id in row.get("sourceFactIds") or []
                }
            ),
            "affectedPhaseIds": sorted(
                {
                    phase_id
                    for row in entries
                    for phase_id in row.get("affectedPhaseIds") or []
                    if phase_id
                }
            ),
            "classificationCounts": dict(sorted(classification_counts.items())),
        },
        "entries": entries,
        "factUpdates": fact_updates,
        "nextStep": (
            "Resolve open source/model repair entries and rerun only affected slices."
            if open_entries
            else "No open source-spec revision entries remain."
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def _ledger_entry(action: dict[str, Any], *, phase_authoring_spec: dict[str, Any]) -> dict[str, Any]:
    classification = str(action.get("classification") or "model_authoring_error")
    source_fact_ids = _string_list(action.get("sourceFactIds"))
    affected_phase_ids = _affected_phase_ids(source_fact_ids, phase_authoring_spec)
    entry_seed = {
        "findingId": action.get("findingId"),
        "classification": classification,
        "sourceFactIds": source_fact_ids,
        "affectedElementIds": _string_list(action.get("affectedElementIds")),
    }
    return {
        "ledgerEntryId": "rev-" + _digest(entry_seed)[:12],
        "status": "open",
        "blocking": classification != "existing_condition",
        "findingId": action.get("findingId"),
        "source": action.get("source"),
        "severity": action.get("severity"),
        "classification": classification,
        "action": action.get("action") or _default_action(classification),
        "reason": action.get("reason"),
        "sourceFactIds": source_fact_ids,
        "affectedElementIds": _string_list(action.get("affectedElementIds")),
        "affectedPhaseIds": affected_phase_ids,
        "requiredResolution": _required_resolution(classification),
        "rawAction": action,
    }


def _fact_updates(facts: list[dict[str, Any]], entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    reopen_by_fact: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        if entry.get("classification") not in SOURCE_REOPEN_CLASSIFICATIONS:
            continue
        for fact_id in entry.get("sourceFactIds") or []:
            reopen_by_fact.setdefault(str(fact_id), []).append(entry)

    updates = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        fact_id = str(fact.get("factId") or fact.get("sourceFactId") or "")
        linked = reopen_by_fact.get(fact_id, [])
        if not linked:
            continue
        updates.append(
            {
                "factId": fact_id,
                "previousStatus": fact.get("status"),
                "nextStatus": "reopened",
                "revisionStatus": "needs_source_repair",
                "linkedLedgerEntryIds": [row.get("ledgerEntryId") for row in linked],
                "requiredReaderRepair": True,
            }
        )
    return updates


def _affected_phase_ids(source_fact_ids: list[str], phase_authoring_spec: dict[str, Any]) -> list[str]:
    wanted = set(source_fact_ids)
    out = []
    for phase in phase_authoring_spec.get("phases") or []:
        if not isinstance(phase, dict):
            continue
        phase_facts = {str(item) for item in phase.get("sourceFactIds") or []}
        action_facts = {
            str(action.get("factId") or action.get("sourceFactId") or "")
            for action in phase.get("authoringActions") or []
            if isinstance(action, dict)
        }
        if wanted & (phase_facts | action_facts):
            phase_id = str(phase.get("phaseId") or phase.get("id") or "")
            if phase_id:
                out.append(phase_id)
    return sorted(set(out))


def _required_resolution(classification: str) -> str:
    mapping = {
        "source_fact_misread": "focused_ai_reader_repair_with_provenance",
        "source_fact_underconstrained": "additional_source_fact_or_explicit_unavailable_disposition",
        "coordinate_frame_wrong": "coordinate_frame_alignment_repair",
        "mcp_payload_wrong": "regenerate_mcp_handoff_payload",
        "model_authoring_error": "repair_live_model_and_rerun_qa",
        "missing_evidence": "capture_missing_evidence",
        "tool_gap": "implement_tool_contract_or_record_accepted_gap",
        "existing_condition": "complete_source_backed_existing_condition_disposition",
    }
    return mapping.get(classification, "review_required")


def _default_action(classification: str) -> str:
    return {
        "source_fact_misread": "reopen_source_fact_and_request_reader_repair",
        "source_fact_underconstrained": "request_focused_source_reader_pass",
        "coordinate_frame_wrong": "repair_source_coordinate_frame",
        "mcp_payload_wrong": "regenerate_mcp_payload_or_run_resolver",
        "model_authoring_error": "fix_live_model_then_rerun_qa",
        "missing_evidence": "capture_required_evidence",
        "tool_gap": "implement_or_record_missing_tool_contract",
        "existing_condition": "record_source_backed_existing_condition_tolerance",
    }.get(classification, "review_required")


def _prior_entries(value: dict[str, Any] | list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if isinstance(value, dict):
        rows = value.get("entries") or value.get("rows") or []
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return []


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if value:
        return [str(value)]
    return []


def _digest(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
