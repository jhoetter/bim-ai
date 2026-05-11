from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai.constraints import evaluate
from bim_ai.constraints_core import Violation
from bim_ai.constructability_issues import ConstructabilityIssue, reconcile_findings
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
        "beam_without_support",
        "column_without_foundation_or_support",
        "door_operation_clearance_conflict",
        "pipe_wall_penetration_without_opening",
        "duct_wall_penetration_without_opening",
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
    "beam_without_support": "Add, align, or explicitly link columns/load-bearing walls at the beam supports.",
    "column_without_foundation_or_support": "Add a foundation, lower column, slab, or other modeled support below the column.",
    "door_operation_clearance_conflict": "Move nearby objects or adjust the door/opening so the operation zone stays clear.",
    "pipe_wall_penetration_without_opening": "Add a sleeve/opening or reroute the pipe where it crosses the wall.",
    "duct_wall_penetration_without_opening": "Add a sleeve/opening or reroute the duct where it crosses the wall.",
}


def build_constructability_report(
    elements: dict[str, Element],
    *,
    revision: str | int,
    previous_issues: Iterable[ConstructabilityIssue | Mapping[str, Any]] = (),
) -> dict[str, Any]:
    violations = [v for v in evaluate(elements) if v.rule_id in CONSTRUCTABILITY_RULE_IDS]
    findings = [_finding_dict(v) for v in violations]
    issues = reconcile_findings(previous_issues, findings, revision=revision)

    severity_counts = Counter(str(f.get("severity") or "unknown") for f in findings)
    rule_counts = Counter(str(f.get("ruleId") or "unknown") for f in findings)
    status_counts = Counter(str(i.get("status") or "unknown") for i in issues)

    return {
        "format": "constructabilityReport_v1",
        "revision": revision,
        "profile": "authoring_default",
        "summary": {
            "findingCount": len(findings),
            "issueCount": len(issues),
            "severityCounts": dict(sorted(severity_counts.items())),
            "ruleCounts": dict(sorted(rule_counts.items())),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "findings": sorted(
            findings,
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


def _finding_dict(violation: Violation) -> dict[str, Any]:
    data = violation.model_dump(by_alias=True)
    data["recommendation"] = RECOMMENDATION_BY_RULE_ID.get(
        violation.rule_id,
        "Inspect the affected elements and resolve the constructability condition.",
    )
    return data
