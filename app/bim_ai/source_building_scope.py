"""Source-level building-scope checks for reverse-BIM handoff packages."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

TARGET_SCOPE_TYPES = {
    "whole_building",
    "whole_doppelhaus",
    "target_half",
    "target_unit",
    "selected_building",
    "selected_unit",
}
CONTEXT_SCOPE_TYPES = {"context_only"}
UNRESOLVED_SCOPE_TYPES = {"", "ambiguous", "unknown", "unresolved"}
SCOPE_MASK_TARGET_TYPES = {"target_half", "target_unit", "selected_unit"}
SCOPE_MASK_KEYS = (
    "scopeMask",
    "scopeMaskRef",
    "scopePolygon",
    "scopePolygonRef",
    "scopeBoundaryRef",
    "scopeBoundaryMm",
    "targetBoundaryRef",
    "targetScopePolygon",
)


def build_source_building_scope_report(
    facts: list[dict[str, Any]],
    *,
    scope_decisions: list[dict[str, Any]] | dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return source-scope blockers before MCP authoring.

    Existing-building digitization must know what source pages describe before
    geometry is authored. A Doppelhaus sheet, a target half, a neighboring half,
    and a context-only elevation can all be valid source evidence, but they
    produce different MCP authoring instructions.
    """

    scopes = []
    for fact in facts:
        if not isinstance(fact, dict) or fact.get("kind") != "building_scope":
            continue
        scopes.append(_scope_row(fact))

    decision_rows = _scope_decision_rows(scope_decisions)
    accepted_decision = _accepted_scope_decision(decision_rows)
    decision_source_fact_ids = (
        set(accepted_decision.get("sourceFactIds") or []) if accepted_decision else set()
    )
    decision_context_fact_ids = (
        set(accepted_decision.get("contextScopeFactIds") or []) if accepted_decision else set()
    )
    decision_scope_type = (
        str(accepted_decision.get("normalizedTargetScopeType") or "") if accepted_decision else ""
    )
    decision_mask_ref = _scope_decision_mask_ref(accepted_decision) if accepted_decision else None

    blockers: list[dict[str, Any]] = []
    if not scopes:
        if accepted_decision:
            if not accepted_decision.get("evidenceSummary"):
                blockers.append(
                    _decision_blocker("building_scope_decision_evidence_missing", accepted_decision)
                )
        else:
            blockers.append(
                {
                    "code": "building_scope_missing",
                    "severity": "error",
                    "message": "No building_scope source fact was returned for the folder.",
                    "sourceFactIds": [],
                }
            )

    for scope in scopes:
        missing = scope.get("missingFields") or []
        if missing:
            blockers.append(
                {
                    "code": "building_scope_required_fields_missing",
                    "severity": "error",
                    "sourceFactIds": [scope.get("factId")],
                    "missingFields": missing,
                    "message": "Building scope fact is missing required source fields.",
                }
            )
        if scope.get("scopeRole") == "unresolved" and not _scope_resolved_by_decision(
            scope,
            accepted_decision,
            decision_source_fact_ids,
            decision_context_fact_ids,
        ):
            blockers.append(
                {
                    "code": "building_scope_unresolved",
                    "severity": "error",
                    "sourceFactIds": [scope.get("factId")],
                    "scopeType": scope.get("scopeType"),
                    "message": "Building scope is ambiguous, unknown, or not one of the supported resolved scope types.",
                }
            )
        if (
            scope.get("scopeRole") == "target"
            and scope.get("scopeMaskRequired")
            and not scope.get("scopeMaskRef")
            and not (
                accepted_decision
                and decision_scope_type in SCOPE_MASK_TARGET_TYPES
                and decision_mask_ref
                and _scope_referenced_by_decision(scope, decision_source_fact_ids)
            )
        ):
            blockers.append(
                {
                    "code": "building_scope_mask_missing",
                    "severity": "error",
                    "sourceFactIds": [scope.get("factId")],
                    "scopeType": scope.get("normalizedScopeType"),
                    "message": "Target-half/unit building scope needs a source-backed scope mask, polygon, or boundary reference.",
                }
            )

    target_scopes = [scope for scope in scopes if scope.get("scopeRole") == "target"]
    if scopes and not target_scopes and not accepted_decision:
        blockers.append(
            {
                "code": "building_scope_target_missing",
                "severity": "error",
                "sourceFactIds": [scope.get("factId") for scope in scopes if scope.get("factId")],
                "message": "At least one source-backed target/modelled building scope is required.",
            }
        )

    target_type_counts = Counter(
        str(scope.get("normalizedScopeType") or "") for scope in target_scopes
    )
    target_types = sorted(scope_type for scope_type in target_type_counts if scope_type)
    if len(target_types) > 1 and not accepted_decision:
        blockers.append(
            {
                "code": "building_scope_target_type_conflict",
                "severity": "error",
                "sourceFactIds": [
                    scope.get("factId") for scope in target_scopes if scope.get("factId")
                ],
                "targetScopeTypes": target_types,
                "message": "Source facts disagree about whether the modeled target is a whole building, Doppelhaus, half, or unit.",
            }
        )

    target_half_directions = sorted(
        {
            str(scope.get("extentDirection"))
            for scope in target_scopes
            if scope.get("normalizedScopeType") == "target_half" and scope.get("extentDirection")
        }
    )
    decision_target_half_direction = (
        str(accepted_decision.get("targetHalfDirection") or "") if accepted_decision else ""
    )
    if decision_target_half_direction:
        target_half_directions = [decision_target_half_direction]
    if len(target_half_directions) > 1 and not accepted_decision:
        blockers.append(
            {
                "code": "building_scope_target_half_direction_conflict",
                "severity": "error",
                "sourceFactIds": [
                    scope.get("factId")
                    for scope in target_scopes
                    if scope.get("normalizedScopeType") == "target_half" and scope.get("factId")
                ],
                "directions": target_half_directions,
                "message": "Target-half source facts disagree about which half is modeled.",
            }
        )

    if accepted_decision:
        if decision_scope_type not in TARGET_SCOPE_TYPES:
            blockers.append(
                _decision_blocker("building_scope_decision_target_type_invalid", accepted_decision)
            )
        if not accepted_decision.get("evidenceSummary"):
            blockers.append(
                _decision_blocker("building_scope_decision_evidence_missing", accepted_decision)
            )
        if decision_scope_type in SCOPE_MASK_TARGET_TYPES and not decision_mask_ref:
            blockers.append(
                {
                    "code": "building_scope_decision_mask_missing",
                    "severity": "error",
                    "sourceFactIds": accepted_decision.get("sourceFactIds") or [],
                    "scopeType": decision_scope_type,
                    "message": "A target-half/unit scope decision needs a source-backed scope mask, polygon, or boundary reference.",
                }
            )

    resolved_target_scope_type = (
        decision_scope_type
        if accepted_decision and decision_scope_type in TARGET_SCOPE_TYPES
        else target_types[0]
        if len(target_types) == 1
        else None
    )
    actions = [_repair_action(blocker, scopes) for blocker in blockers]
    return {
        "format": "reverseBimSourceBuildingScopeReport_v1",
        "ok": not blockers,
        "summary": {
            "scopeFactCount": len(scopes),
            "targetScopeFactCount": len(target_scopes),
            "contextScopeFactCount": sum(
                1 for scope in scopes if scope.get("scopeRole") == "context"
            ),
            "unresolvedScopeFactCount": sum(
                1 for scope in scopes if scope.get("scopeRole") == "unresolved"
            ),
            "scopeDecisionCount": len(decision_rows),
            "acceptedScopeDecisionCount": 1 if accepted_decision else 0,
            "blockingCount": len(blockers),
            "resolvedTargetScopeType": resolved_target_scope_type,
            "targetHalfDirection": target_half_directions[0]
            if len(target_half_directions) == 1
            else None,
            "targetScopeTypes": [resolved_target_scope_type]
            if accepted_decision and resolved_target_scope_type
            else target_types,
            "decisionResolved": bool(accepted_decision and resolved_target_scope_type),
        },
        "scopes": scopes,
        "scopeDecisions": decision_rows,
        "acceptedScopeDecision": accepted_decision,
        "blockers": blockers,
        "actions": actions,
    }


def _scope_row(fact: dict[str, Any]) -> dict[str, Any]:
    value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
    scope_type = str(value.get("scopeType") or "").strip()
    modeled_extent = str(value.get("modeledExtent") or "").strip()
    evidence_summary = str(value.get("evidenceSummary") or "").strip()
    normalized_scope_type = _normalize_scope_type(scope_type, modeled_extent, evidence_summary)
    scope_mask_ref = _scope_mask_ref(value)
    return {
        "factId": fact.get("factId"),
        "scopeType": scope_type,
        "normalizedScopeType": normalized_scope_type,
        "scopeRole": _scope_role(normalized_scope_type),
        "modeledExtent": modeled_extent,
        "evidenceSummary": evidence_summary,
        "targetScopeId": value.get("targetScopeId"),
        "contextScopeRefs": value.get("contextScopeRefs") or [],
        "scopeMaskRequired": normalized_scope_type in SCOPE_MASK_TARGET_TYPES,
        "scopeMaskRef": scope_mask_ref,
        "scopeMaskStatus": "source_backed" if scope_mask_ref else "missing",
        "extentDirection": _extent_direction(" ".join([modeled_extent, evidence_summary])),
        "missingFields": [
            field
            for field, raw in (
                ("scopeType", scope_type),
                ("modeledExtent", modeled_extent),
                ("evidenceSummary", evidence_summary),
            )
            if not raw
        ],
        "status": fact.get("status"),
        "confidence": fact.get("confidence"),
        "provenance": fact.get("provenance"),
    }


def _repair_action(blocker: dict[str, Any], scopes: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": f"building-scope:{blocker.get('code')}",
        "kind": "building_scope_repair",
        "status": "blocked_needs_source_scope",
        "sourceFactIds": blocker.get("sourceFactIds") or [],
        "blockingCode": blocker.get("code"),
        "requiredSourceFields": [
            "scopeType: whole_building, whole_doppelhaus, target_half, target_unit, selected_building, selected_unit, context_only, or ambiguous",
            "modeledExtent: exact target extent, e.g. whole Doppelhaus, left/right half, unit, or context-only neighbor",
            "evidenceSummary: title block, plan labels, party-wall/mirror evidence, address/parcel references, and page refs",
            "targetScopeId plus contextScopeRefs when a source page contains both target and adjoining/context geometry",
            "scopeMask/scopePolygonRef/scopeBoundaryRef for target-half or unit scopes",
        ],
        "findingsToFix": [blocker],
        "sourcePrompt": (
            "Re-read title blocks, floor plans, sections, elevations, and site/legal documents. "
            "Decide exactly what the BIM authoring target is: whole building, whole Doppelhaus, "
            "one target half, one unit, selected building, or context-only neighboring geometry. "
            "Return source-backed building_scope facts and mark neighboring/adjoining geometry as context-only."
        ),
        "existingScopeFacts": scopes,
    }


def _scope_decision_rows(
    scope_decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if scope_decisions is None:
        raw_rows: list[dict[str, Any]] = []
    elif isinstance(scope_decisions, dict) and isinstance(scope_decisions.get("decisions"), list):
        raw_rows = [row for row in scope_decisions["decisions"] if isinstance(row, dict)]
    elif isinstance(scope_decisions, dict) and isinstance(
        scope_decisions.get("scopeDecisions"), list
    ):
        raw_rows = [row for row in scope_decisions["scopeDecisions"] if isinstance(row, dict)]
    elif isinstance(scope_decisions, dict):
        raw_rows = [scope_decisions]
    elif isinstance(scope_decisions, list):
        raw_rows = [row for row in scope_decisions if isinstance(row, dict)]
    else:
        raw_rows = []

    rows = []
    for index, row in enumerate(raw_rows, start=1):
        target_scope_type = str(row.get("targetScopeType") or row.get("scopeType") or "").strip()
        modeled_extent = str(row.get("modeledExtent") or row.get("targetExtent") or "").strip()
        evidence_summary = str(row.get("evidenceSummary") or row.get("reason") or "").strip()
        normalized_target_scope_type = _normalize_scope_type(
            target_scope_type, modeled_extent, evidence_summary
        )
        target_half_direction = str(
            row.get("targetHalfDirection") or row.get("extentDirection") or ""
        ).strip() or _extent_direction(" ".join([modeled_extent, evidence_summary]))
        rows.append(
            {
                "decisionId": row.get("decisionId")
                or row.get("id")
                or f"building-scope-decision-{index:03d}",
                "status": str(row.get("status") or row.get("decisionStatus") or "accepted"),
                "targetScopeType": target_scope_type,
                "normalizedTargetScopeType": normalized_target_scope_type,
                "modeledExtent": modeled_extent,
                "evidenceSummary": evidence_summary,
                "sourceFactIds": _string_list(
                    row.get("sourceFactIds") or row.get("appliesToFactIds")
                ),
                "contextScopeFactIds": _string_list(
                    row.get("contextScopeFactIds") or row.get("contextFactIds")
                ),
                "targetScopeId": row.get("targetScopeId"),
                "scopeMaskRef": _scope_decision_mask_ref(row),
                "targetHalfDirection": target_half_direction,
                "acceptedBy": row.get("acceptedBy"),
                "provenance": row.get("provenance") or row.get("sourceEvidence"),
            }
        )
    return rows


def _accepted_scope_decision(decision_rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    accepted_statuses = {
        "accepted",
        "resolved",
        "source_backed",
        "source-backed",
        "tolerated_existing_condition",
    }
    for row in decision_rows:
        if str(row.get("status") or "").casefold() in accepted_statuses:
            return row
    return None


def _scope_resolved_by_decision(
    scope: dict[str, Any],
    decision: dict[str, Any] | None,
    decision_source_fact_ids: set[str],
    decision_context_fact_ids: set[str],
) -> bool:
    if not decision:
        return False
    fact_id = str(scope.get("factId") or "")
    return fact_id in decision_source_fact_ids or fact_id in decision_context_fact_ids


def _scope_referenced_by_decision(
    scope: dict[str, Any], decision_source_fact_ids: set[str]
) -> bool:
    fact_id = str(scope.get("factId") or "")
    return not decision_source_fact_ids or fact_id in decision_source_fact_ids


def _decision_blocker(code: str, decision: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": code,
        "severity": "error",
        "decisionId": decision.get("decisionId"),
        "sourceFactIds": decision.get("sourceFactIds") or [],
        "message": "Building-scope decision is incomplete or invalid for source-backed authoring.",
    }


def _scope_decision_mask_ref(value: dict[str, Any] | None) -> Any:
    if not isinstance(value, dict):
        return None
    return _scope_mask_ref(value)


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item or "").strip()]
    if str(value or "").strip():
        return [str(value)]
    return []


def _normalize_scope_type(scope_type: str, modeled_extent: str, evidence_summary: str) -> str:
    text = _norm(" ".join([scope_type, modeled_extent, evidence_summary]))
    explicit = _norm(scope_type)
    aliases = {
        "whole building": "whole_building",
        "complete building": "whole_building",
        "entire building": "whole_building",
        "selected building": "selected_building",
        "target building": "selected_building",
        "whole doppelhaus": "whole_doppelhaus",
        "full doppelhaus": "whole_doppelhaus",
        "complete doppelhaus": "whole_doppelhaus",
        "both halves": "whole_doppelhaus",
        "beide haelften": "whole_doppelhaus",
        "beide halften": "whole_doppelhaus",
        "target half": "target_half",
        "one half": "target_half",
        "single half": "target_half",
        "doppelhaus half": "target_half",
        "doppelhaushaelfte": "target_half",
        "doppelhaushalfte": "target_half",
        "haushalfte": "target_half",
        "haushaelfte": "target_half",
        "target unit": "target_unit",
        "selected unit": "selected_unit",
        "single house": "selected_building",
        "single building": "selected_building",
        "one complete house": "selected_building",
        "one complete building": "selected_building",
        "dwelling unit": "target_unit",
        "wohneinheit": "target_unit",
        "wohnung": "target_unit",
        "context only": "context_only",
        "neighbouring context": "context_only",
        "neighboring context": "context_only",
        "adjoining context": "context_only",
        "ambiguous": "ambiguous",
        "unknown": "unknown",
        "unresolved": "unresolved",
    }
    for key, value in aliases.items():
        if explicit == _norm(key):
            return value
    if explicit in TARGET_SCOPE_TYPES | CONTEXT_SCOPE_TYPES | UNRESOLVED_SCOPE_TYPES:
        return explicit
    for key, value in aliases.items():
        if _norm(key) in text:
            return value
    if any(token in text for token in ("ambiguous", "unknown", "unresolved", "unklar")):
        return "ambiguous"
    if any(token in text for token in ("context", "nachbar", "adjoining", "neighbour", "neighbor")):
        return "context_only"
    return explicit


def _scope_role(normalized_scope_type: str) -> str:
    if normalized_scope_type in TARGET_SCOPE_TYPES:
        return "target"
    if normalized_scope_type in CONTEXT_SCOPE_TYPES:
        return "context"
    return "unresolved"


def _scope_mask_ref(value: dict[str, Any]) -> Any:
    for key in SCOPE_MASK_KEYS:
        raw = value.get(key)
        if raw not in (None, "", [], {}):
            return raw
    return None


def _extent_direction(text: str) -> str | None:
    normalized = _norm(text)
    candidates = [
        ("left", ("left", "links", "west half", "westliche")),
        ("right", ("right", "rechts", "east half", "oestliche", "ostliche")),
        ("north", ("north", "nord", "northern", "noerdliche", "nordliche")),
        ("south", ("south", "sued", "sud", "southern", "suedliche", "sudliche")),
    ]
    for direction, tokens in candidates:
        if any(_norm(token) in normalized for token in tokens):
            return direction
    return None


def _norm(value: str) -> str:
    lowered = (
        value.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    )
    return re.sub(r"[^a-z0-9]+", " ", lowered).strip()
