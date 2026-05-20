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
    "scopePolygon",
    "scopePolygonRef",
    "scopeBoundaryRef",
    "scopeBoundaryMm",
    "targetBoundaryRef",
    "targetScopePolygon",
)


def build_source_building_scope_report(facts: list[dict[str, Any]]) -> dict[str, Any]:
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

    blockers: list[dict[str, Any]] = []
    if not scopes:
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
        if scope.get("scopeRole") == "unresolved":
            blockers.append(
                {
                    "code": "building_scope_unresolved",
                    "severity": "error",
                    "sourceFactIds": [scope.get("factId")],
                    "scopeType": scope.get("scopeType"),
                    "message": "Building scope is ambiguous, unknown, or not one of the supported resolved scope types.",
                }
            )
        if scope.get("scopeRole") == "target" and scope.get("scopeMaskRequired") and not scope.get("scopeMaskRef"):
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
    if scopes and not target_scopes:
        blockers.append(
            {
                "code": "building_scope_target_missing",
                "severity": "error",
                "sourceFactIds": [scope.get("factId") for scope in scopes if scope.get("factId")],
                "message": "At least one source-backed target/modelled building scope is required.",
            }
        )

    target_type_counts = Counter(str(scope.get("normalizedScopeType") or "") for scope in target_scopes)
    target_types = sorted(scope_type for scope_type in target_type_counts if scope_type)
    if len(target_types) > 1:
        blockers.append(
            {
                "code": "building_scope_target_type_conflict",
                "severity": "error",
                "sourceFactIds": [scope.get("factId") for scope in target_scopes if scope.get("factId")],
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
    if len(target_half_directions) > 1:
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

    actions = [_repair_action(blocker, scopes) for blocker in blockers]
    return {
        "format": "reverseBimSourceBuildingScopeReport_v1",
        "ok": not blockers,
        "summary": {
            "scopeFactCount": len(scopes),
            "targetScopeFactCount": len(target_scopes),
            "contextScopeFactCount": sum(1 for scope in scopes if scope.get("scopeRole") == "context"),
            "unresolvedScopeFactCount": sum(1 for scope in scopes if scope.get("scopeRole") == "unresolved"),
            "blockingCount": len(blockers),
            "resolvedTargetScopeType": target_types[0] if len(target_types) == 1 else None,
            "targetHalfDirection": target_half_directions[0] if len(target_half_directions) == 1 else None,
            "targetScopeTypes": target_types,
        },
        "scopes": scopes,
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
    lowered = value.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", " ", lowered).strip()
