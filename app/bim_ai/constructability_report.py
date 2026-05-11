from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai.constraints import evaluate
from bim_ai.constraints_core import Violation
from bim_ai.constructability_issues import (
    ConstructabilityIssue,
    fingerprint_violation,
    reconcile_findings,
)
from bim_ai.elements import Element

CONSTRUCTABILITY_RULE_IDS = frozenset(
    {
        "physical_hard_clash",
        "physical_duplicate_geometry",
        "furniture_wall_hard_clash",
        "stair_wall_hard_clash",
        "constructability_proxy_unsupported",
        "wall_load_bearing_unknown_primary_envelope",
        "large_opening_in_load_bearing_wall_unresolved",
        "load_bearing_wall_removed_without_transfer",
        "stacked_load_path_discontinuity",
        "floor_span_without_support_metadata",
        "beam_without_support",
        "column_without_foundation_or_support",
        "door_operation_clearance_conflict",
        "pipe_wall_penetration_without_opening",
        "duct_wall_penetration_without_opening",
        "pipe_floor_penetration_without_opening",
        "duct_floor_penetration_without_opening",
        "pipe_ceiling_penetration_without_opening",
        "duct_ceiling_penetration_without_opening",
        "stair_floor_penetration_without_slab_opening",
        "roof_wall_coverage_gap",
    }
)

CONSTRUCTION_READINESS_ERROR_RULE_IDS = frozenset(
    {
        "physical_hard_clash",
        "furniture_wall_hard_clash",
        "stair_wall_hard_clash",
        "large_opening_in_load_bearing_wall_unresolved",
        "load_bearing_wall_removed_without_transfer",
        "stacked_load_path_discontinuity",
        "beam_without_support",
        "column_without_foundation_or_support",
        "door_operation_clearance_conflict",
        "pipe_wall_penetration_without_opening",
        "duct_wall_penetration_without_opening",
        "pipe_floor_penetration_without_opening",
        "duct_floor_penetration_without_opening",
        "pipe_ceiling_penetration_without_opening",
        "duct_ceiling_penetration_without_opening",
        "stair_floor_penetration_without_slab_opening",
        "roof_wall_coverage_gap",
    }
)

RECOMMENDATION_BY_RULE_ID = {
    "physical_hard_clash": "Inspect the affected elements in 3D and move, trim, reroute, or add an intentional opening/support condition.",
    "physical_duplicate_geometry": "Delete the duplicate element or offset intentionally repeated instances so they no longer share the same physical proxy.",
    "furniture_wall_hard_clash": "Move the placed object clear of the wall, host it intentionally, or model a recess/opening.",
    "stair_wall_hard_clash": "Revise the stair run, landing, shaft/opening, or wall layout so stair geometry is unobstructed.",
    "constructability_proxy_unsupported": "Add enough typed geometry or size parameters for this physical element to produce a collision proxy.",
    "wall_load_bearing_unknown_primary_envelope": "Classify the wall load-bearing intent before relying on structural constructability checks.",
    "large_opening_in_load_bearing_wall_unresolved": "Add lintel/header/support metadata or structural review approval for the opening.",
    "load_bearing_wall_removed_without_transfer": "Add transfer beam/temporary works metadata, structural review approval, or revise the demolition intent.",
    "stacked_load_path_discontinuity": "Add a modeled load-bearing wall, column, beam/transfer condition, or revise the upper wall load-bearing intent.",
    "floor_span_without_support_metadata": "Add floor structural system/support metadata, beam grid intent, or engineering review approval for the long span.",
    "beam_without_support": "Add, align, or explicitly link columns/load-bearing walls at the beam supports.",
    "column_without_foundation_or_support": "Add a foundation, lower column, slab, or other modeled support below the column.",
    "door_operation_clearance_conflict": "Move nearby objects or adjust the door/opening so the operation zone stays clear.",
    "pipe_wall_penetration_without_opening": "Add a sleeve/opening or reroute the pipe where it crosses the wall.",
    "duct_wall_penetration_without_opening": "Add a sleeve/opening or reroute the duct where it crosses the wall.",
    "pipe_floor_penetration_without_opening": "Add a slab sleeve/shaft opening or reroute the pipe where it crosses the floor.",
    "duct_floor_penetration_without_opening": "Add a slab sleeve/shaft opening or reroute the duct where it crosses the floor.",
    "pipe_ceiling_penetration_without_opening": "Add a ceiling route opening/plenum condition or reroute the pipe.",
    "duct_ceiling_penetration_without_opening": "Add a ceiling route opening/plenum condition or reroute the duct.",
    "stair_floor_penetration_without_slab_opening": "Add a stair shaft/slab opening or revise the stair and upper floor layout.",
    "roof_wall_coverage_gap": "Revise the roof overhang/footprint or align the primary envelope wall under the roof coverage.",
}


def build_constructability_report(
    elements: dict[str, Element],
    *,
    revision: str | int,
    profile: str = "authoring_default",
    previous_issues: Iterable[ConstructabilityIssue | Mapping[str, Any]] = (),
) -> dict[str, Any]:
    violations = [v for v in evaluate(elements) if v.rule_id in CONSTRUCTABILITY_RULE_IDS]
    all_findings = [_finding_dict(v, profile=profile) for v in violations]
    suppressions = _suppression_records(elements, revision=revision)
    active_findings: list[dict[str, Any]] = []
    suppressed_by_fingerprint: dict[str, dict[str, Any]] = {}
    for finding in all_findings:
        suppression = _matching_suppression(finding, suppressions)
        if suppression is None:
            active_findings.append(finding)
            continue
        fingerprint = fingerprint_violation(finding)
        suppressed_by_fingerprint[fingerprint] = suppression

    issues = reconcile_findings(previous_issues, all_findings, revision=revision)
    for issue in issues:
        suppression = suppressed_by_fingerprint.get(str(issue.get("fingerprint") or ""))
        if suppression is None:
            continue
        issue["status"] = "suppressed"
        issue["suppression"] = suppression

    severity_counts = Counter(str(f.get("severity") or "unknown") for f in active_findings)
    rule_counts = Counter(str(f.get("ruleId") or "unknown") for f in active_findings)
    status_counts = Counter(str(i.get("status") or "unknown") for i in issues)

    return {
        "format": "constructabilityReport_v1",
        "revision": revision,
        "profile": profile,
        "summary": {
            "findingCount": len(active_findings),
            "issueCount": len(issues),
            "suppressedFindingCount": len(suppressed_by_fingerprint),
            "severityCounts": dict(sorted(severity_counts.items())),
            "ruleCounts": dict(sorted(rule_counts.items())),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "findings": sorted(
            active_findings,
            key=lambda f: (
                str(f.get("ruleId") or ""),
                tuple(str(eid) for eid in f.get("elementIds") or []),
                str(f.get("severity") or ""),
            ),
        ),
        "issues": sorted(
            issues,
            key=lambda i: (
                str(i.get("status") or ""),
                str(i.get("ruleId") or ""),
                str(i.get("pairKey") or ""),
                str(i.get("fingerprint") or ""),
            ),
        ),
    }


def _finding_dict(violation: Violation, *, profile: str) -> dict[str, Any]:
    data = violation.model_dump(by_alias=True)
    if profile == "construction_readiness" and violation.rule_id in CONSTRUCTION_READINESS_ERROR_RULE_IDS:
        data["severity"] = "error"
        data["blocking"] = True
    data["recommendation"] = RECOMMENDATION_BY_RULE_ID.get(
        violation.rule_id,
        "Inspect the affected elements and resolve the constructability condition.",
    )
    return data


def _suppression_records(
    elements: dict[str, Element],
    *,
    revision: str | int,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for element in elements.values():
        if getattr(element, "kind", None) != "constructability_suppression":
            continue
        if getattr(element, "active", True) is not True:
            continue
        expires_revision = getattr(element, "expires_revision", None)
        if isinstance(revision, int) and isinstance(expires_revision, int):
            if revision > expires_revision:
                continue
        records.append(
            {
                "id": str(element.id),
                "ruleId": getattr(element, "rule_id", None),
                "elementIds": sorted(str(eid) for eid in getattr(element, "element_ids", [])),
                "reason": str(element.reason),
                "expiresRevision": expires_revision,
            }
        )
    records.sort(
        key=lambda record: (
            str(record.get("ruleId") or ""),
            tuple(record.get("elementIds") or []),
            str(record.get("id") or ""),
        )
    )
    return records


def _matching_suppression(
    finding: Mapping[str, Any],
    suppressions: list[dict[str, Any]],
) -> dict[str, Any] | None:
    finding_rule = str(finding.get("ruleId") or "")
    finding_elements = {str(eid) for eid in finding.get("elementIds") or []}
    for suppression in suppressions:
        suppressed_rule = suppression.get("ruleId")
        if suppressed_rule and str(suppressed_rule) != finding_rule:
            continue
        suppressed_elements = {str(eid) for eid in suppression.get("elementIds") or []}
        if suppressed_elements and not suppressed_elements.issubset(finding_elements):
            continue
        return suppression
    return None
