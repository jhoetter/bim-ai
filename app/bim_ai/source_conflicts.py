"""Source conflict disposition worklists for reverse-BIM folder output."""

from __future__ import annotations

from typing import Any

DISPOSITION_ACTIONS = {
    "ask_user",
    "choose_candidate",
    "merge_candidates",
    "source_repair_required",
    "mark_context_only",
    "metadata_only",
    "tolerate_unavailable",
}


def _recommended_action(conflict: dict[str, Any]) -> str:
    text = str(conflict.get("recommendedDisposition") or "").lower()
    if "ask_user" in text or "ask user" in text or "confirm" in text:
        return "ask_user"
    if "context only" in text:
        return "mark_context_only"
    if "metadata" in text or "reference" in text:
        return "metadata_only"
    if "higher-resolution" in text or "higher resolution" in text or "request" in text:
        return "source_repair_required"
    if "tolerate" in text or "unavailable" in text:
        return "tolerate_unavailable"
    if "merge" in text or "combine" in text:
        return "merge_candidates"
    if text.startswith("use ") or " use " in text:
        return "choose_candidate"
    return "ask_user"


def build_source_conflict_disposition_worklist(conflict_ledger: dict[str, Any]) -> dict[str, Any]:
    """Return the decisions needed before source conflicts may enter authoring."""

    actions = []
    for conflict in conflict_ledger.get("conflicts") or []:
        if not isinstance(conflict, dict) or conflict.get("status") != "open":
            continue
        action = _recommended_action(conflict)
        actions.append(
            {
                "id": f"source-conflict:{conflict.get('conflictId')}",
                "kind": "source_conflict_disposition",
                "status": "blocked_needs_decision",
                "conflictId": conflict.get("conflictId"),
                "topic": conflict.get("topic"),
                "severity": conflict.get("severity") or "blocker",
                "recommendedAction": action,
                "allowedActions": sorted(DISPOSITION_ACTIONS),
                "candidates": conflict.get("candidates") or [],
                "recommendedDisposition": conflict.get("recommendedDisposition"),
                "requiredDecisionFields": _required_decision_fields(action),
                "sourceFactIds": conflict.get("sourceFactIds") or [],
                "provenance": conflict.get("provenance"),
            }
        )

    counts: dict[str, int] = {}
    for item in actions:
        action = str(item.get("recommendedAction") or "ask_user")
        counts[action] = counts.get(action, 0) + 1
    return {
        "format": "reverseBimSourceConflictDispositionWorklist_v1",
        "summary": {
            "actionCount": len(actions),
            "blockedDecisionCount": sum(
                1 for item in actions if str(item.get("status") or "").startswith("blocked")
            ),
            "recommendedActionCounts": counts,
        },
        "actions": actions,
    }


def apply_source_conflict_dispositions(
    conflict_ledger: dict[str, Any],
    decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, Any]:
    """Apply structured conflict decisions and return an updated ledger plus report."""

    decision_rows = _decision_rows(decisions)
    decisions_by_conflict = {
        str(row.get("conflictId")): row
        for row in decision_rows
        if isinstance(row, dict) and row.get("conflictId")
    }
    conflicts = []
    disposition_rows = []
    for conflict in conflict_ledger.get("conflicts") or []:
        if not isinstance(conflict, dict):
            continue
        conflict_id = str(conflict.get("conflictId") or "")
        decision = decisions_by_conflict.get(conflict_id)
        if not decision:
            conflicts.append(conflict)
            disposition_rows.append(
                {
                    "conflictId": conflict_id,
                    "status": "unresolved",
                    "missingDecision": True,
                }
            )
            continue
        validation = _validate_decision(decision)
        if validation:
            conflicts.append(conflict)
            disposition_rows.append(
                {
                    "conflictId": conflict_id,
                    "status": "invalid_decision",
                    "errors": validation,
                    "decision": decision,
                }
            )
            continue
        resolved_conflict = {
            **conflict,
            "status": "resolved",
            "disposition": {
                key: value
                for key, value in decision.items()
                if key not in {"conflictId", "status"}
            },
        }
        conflicts.append(resolved_conflict)
        disposition_rows.append(
            {
                "conflictId": conflict_id,
                "status": "resolved",
                "decision": decision.get("decision"),
            }
        )

    open_count = sum(1 for row in conflicts if row.get("status") == "open")
    invalid_count = sum(1 for row in disposition_rows if row.get("status") == "invalid_decision")
    updated_ledger = {
        **conflict_ledger,
        "conflictCount": len(conflicts),
        "openConflictCount": open_count,
        "conflicts": conflicts,
    }
    return {
        "format": "reverseBimSourceConflictDispositionReport_v1",
        "accepted": open_count == 0 and invalid_count == 0,
        "summary": {
            "conflictCount": len(conflicts),
            "resolvedConflictCount": sum(1 for row in disposition_rows if row.get("status") == "resolved"),
            "openConflictCount": open_count,
            "invalidDecisionCount": invalid_count,
            "missingDecisionCount": sum(1 for row in disposition_rows if row.get("missingDecision")),
        },
        "conflictLedger": updated_ledger,
        "dispositions": disposition_rows,
    }


def _required_decision_fields(action: str) -> list[str]:
    common = ["decision", "reason", "decidedBy", "sourceRefs"]
    if action == "choose_candidate":
        return [*common, "chosenCandidate", "supersededCandidates"]
    if action == "merge_candidates":
        return [*common, "mergedValue", "mergedFromCandidates"]
    if action == "source_repair_required":
        return [*common, "requestedSourcePackage", "requiredReaderFields"]
    if action == "mark_context_only":
        return [*common, "contextScope", "excludedFromModelingPhases"]
    if action == "metadata_only":
        return [*common, "metadataTarget", "excludedGeometryKinds"]
    if action == "tolerate_unavailable":
        return [*common, "toleranceReason", "acceptanceImpact"]
    return [*common, "question"]


def _decision_rows(decisions: list[dict[str, Any]] | dict[str, Any] | None) -> list[dict[str, Any]]:
    if decisions is None:
        return []
    if isinstance(decisions, dict) and isinstance(decisions.get("decisions"), list):
        return [row for row in decisions["decisions"] if isinstance(row, dict)]
    if isinstance(decisions, dict):
        return [
            {**value, "conflictId": key}
            for key, value in decisions.items()
            if isinstance(value, dict)
        ]
    return [row for row in decisions if isinstance(row, dict)]


def _validate_decision(decision: dict[str, Any]) -> list[str]:
    errors = []
    action = str(decision.get("decision") or "")
    if action not in DISPOSITION_ACTIONS:
        errors.append(f"decision must be one of {sorted(DISPOSITION_ACTIONS)}")
        return errors
    for field in _required_decision_fields(action):
        if not decision.get(field):
            errors.append(f"missing required field: {field}")
    return errors
