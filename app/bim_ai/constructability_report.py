from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai.constraints import evaluate
from bim_ai.constraints_core import Violation
from bim_ai.constructability_clearance import (
    FURNITURE_WALL_CLEARANCE_RULE_ID,
    constructability_clearance_violations,
)
from bim_ai.constructability_geometry import (
    collect_physical_participants,
    collect_unsupported_physical_diagnostics,
)
from bim_ai.constructability_issues import (
    ConstructabilityIssue,
    fingerprint_violation,
    reconcile_findings,
)
from bim_ai.constructability_metadata import (
    METADATA_REQUIREMENT_RULE_ID,
    constructability_metadata_requirement_violations,
)
from bim_ai.constructability_scope import (
    constructability_scope_descriptor,
    scope_constructability_elements,
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
        "floor_boundary_without_wall_support",
        "beam_without_support",
        "column_without_foundation_or_support",
        "door_operation_clearance_conflict",
        "window_operation_clearance_conflict",
        "room_without_door_access",
        "pipe_wall_penetration_without_opening",
        "duct_wall_penetration_without_opening",
        "pipe_floor_penetration_without_opening",
        "duct_floor_penetration_without_opening",
        "pipe_ceiling_penetration_without_opening",
        "duct_ceiling_penetration_without_opening",
        "stair_floor_penetration_without_slab_opening",
        "stair_headroom_clearance_conflict",
        "stair_landing_missing",
        "stair_guardrail_missing",
        "stair_guardrail_height_insufficient",
        FURNITURE_WALL_CLEARANCE_RULE_ID,
        "roof_wall_coverage_gap",
        "roof_low_slope_without_drainage_metadata",
        METADATA_REQUIREMENT_RULE_ID,
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
        "floor_boundary_without_wall_support",
        "column_without_foundation_or_support",
        "door_operation_clearance_conflict",
        "window_operation_clearance_conflict",
        "room_without_door_access",
        "pipe_wall_penetration_without_opening",
        "duct_wall_penetration_without_opening",
        "pipe_floor_penetration_without_opening",
        "duct_floor_penetration_without_opening",
        "pipe_ceiling_penetration_without_opening",
        "duct_ceiling_penetration_without_opening",
        "stair_floor_penetration_without_slab_opening",
        "stair_headroom_clearance_conflict",
        FURNITURE_WALL_CLEARANCE_RULE_ID,
        "roof_wall_coverage_gap",
        "roof_low_slope_without_drainage_metadata",
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
    "floor_boundary_without_wall_support": "Add perimeter wall/support geometry, revise the floor boundary, or clear the perimeter-support requirement metadata.",
    "beam_without_support": "Add, align, or explicitly link columns/load-bearing walls at the beam supports.",
    "column_without_foundation_or_support": "Add a foundation, lower column, slab, or other modeled support below the column.",
    "door_operation_clearance_conflict": "Move nearby objects or adjust the door/opening so the operation zone stays clear.",
    "window_operation_clearance_conflict": "Move nearby objects or adjust the window/opening so operation and maintenance clearance stays clear.",
    "room_without_door_access": "Add a connected door opening or revise the room boundary so the room is accessible.",
    "pipe_wall_penetration_without_opening": "Add a sleeve/opening or reroute the pipe where it crosses the wall.",
    "duct_wall_penetration_without_opening": "Add a sleeve/opening or reroute the duct where it crosses the wall.",
    "pipe_floor_penetration_without_opening": "Add a slab sleeve/shaft opening or reroute the pipe where it crosses the floor.",
    "duct_floor_penetration_without_opening": "Add a slab sleeve/shaft opening or reroute the duct where it crosses the floor.",
    "pipe_ceiling_penetration_without_opening": "Add a ceiling route opening/plenum condition or reroute the pipe.",
    "duct_ceiling_penetration_without_opening": "Add a ceiling route opening/plenum condition or reroute the duct.",
    "stair_floor_penetration_without_slab_opening": "Add a stair shaft/slab opening or revise the stair and upper floor layout.",
    "stair_headroom_clearance_conflict": "Raise or trim the overhead element, revise the stair run, or document an approved headroom exception.",
    "stair_landing_missing": "Add the missing intermediate landing polygon or revise the stair run/rise.",
    "stair_guardrail_missing": "Add a hosted railing/guardrail for the stair or document an approved exception.",
    "stair_guardrail_height_insufficient": "Raise the hosted guardrail height or use an approved railing type.",
    FURNITURE_WALL_CLEARANCE_RULE_ID: "Move the object farther from the wall or record an approved clearance exception for the active profile.",
    "roof_wall_coverage_gap": "Revise the roof overhang/footprint or align the primary envelope wall under the roof coverage.",
    "roof_low_slope_without_drainage_metadata": "Add flat-roof drainage/taper metadata, increase the roof slope, or record engineering review approval.",
    METADATA_REQUIREMENT_RULE_ID: "Add the missing IDS-like property data or choose a less strict constructability profile.",
}


def build_constructability_report(
    elements: dict[str, Element],
    *,
    revision: str | int,
    profile: str = "authoring_default",
    phase_filter: str = "all",
    option_locks: Mapping[str, str] | None = None,
    design_option_sets: Iterable[Any] = (),
    previous_issues: Iterable[ConstructabilityIssue | Mapping[str, Any]] = (),
) -> dict[str, Any]:
    scoped_elements = scope_constructability_elements(
        elements,
        phase_filter=phase_filter,
        option_locks=option_locks,
        design_option_sets=design_option_sets,
    )
    violations = [
        v
        for v in evaluate(scoped_elements, constructability_profile=profile)
        if v.rule_id in CONSTRUCTABILITY_RULE_IDS
    ]
    violations.extend(constructability_clearance_violations(scoped_elements, profile=profile))
    violations.extend(
        constructability_metadata_requirement_violations(scoped_elements, profile=profile)
    )
    all_findings = [_finding_dict(v, profile=profile) for v in violations]
    suppressions = _suppression_records(scoped_elements, revision=revision)
    active_findings: list[dict[str, Any]] = []
    suppressed_by_fingerprint: dict[str, dict[str, Any]] = {}
    for finding in all_findings:
        suppression = _matching_suppression(finding, suppressions)
        if suppression is None:
            active_findings.append(finding)
            continue
        fingerprint = fingerprint_violation(finding)
        suppressed_by_fingerprint[fingerprint] = suppression

    issues = reconcile_findings(
        [*_persisted_issue_records(scoped_elements), *previous_issues],
        all_findings,
        revision=revision,
    )
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
        "scope": constructability_scope_descriptor(
            phase_filter=phase_filter,
            option_locks=option_locks,
            design_option_sets=design_option_sets,
        ),
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


def build_constructability_summary_v1(
    elements: dict[str, Element],
    *,
    revision: str | int,
    profile: str = "construction_readiness",
    phase_filter: str = "all",
    option_locks: Mapping[str, str] | None = None,
    design_option_sets: Iterable[Any] = (),
    previous_issues: Iterable[ConstructabilityIssue | Mapping[str, Any]] = (),
) -> dict[str, Any]:
    scoped_elements = scope_constructability_elements(
        elements,
        phase_filter=phase_filter,
        option_locks=option_locks,
        design_option_sets=design_option_sets,
    )
    report = build_constructability_report(
        elements,
        revision=revision,
        profile=profile,
        phase_filter=phase_filter,
        option_locks=option_locks,
        design_option_sets=design_option_sets,
        previous_issues=previous_issues,
    )
    participants = collect_physical_participants(scoped_elements)
    unsupported = collect_unsupported_physical_diagnostics(scoped_elements)
    open_issues = [
        issue
        for issue in report["issues"]
        if issue.get("status") not in {"resolved", "suppressed", "not_an_issue"}
    ]
    open_error_issues = [
        issue for issue in open_issues if str(issue.get("severity") or "") == "error"
    ]
    return {
        "format": "constructabilitySummary_v1",
        "profileId": report["profile"],
        "modelRevision": revision,
        "scope": report["scope"],
        "counts": {
            "info": int(report["summary"]["severityCounts"].get("info") or 0),
            "warning": int(report["summary"]["severityCounts"].get("warning") or 0),
            "error": int(report["summary"]["severityCounts"].get("error") or 0),
            "blocker": int(report["summary"]["severityCounts"].get("blocker") or 0),
            "suppressed": int(report["summary"]["statusCounts"].get("suppressed") or 0),
            "resolved": int(report["summary"]["statusCounts"].get("resolved") or 0),
        },
        "coverage": {
            "physicalElements": len(participants) + len(unsupported),
            "proxySupported": len(participants),
            "proxyUnsupported": len(unsupported),
        },
        "openIssueIds": [str(issue.get("fingerprint")) for issue in open_issues],
        "openErrorIssueIds": [str(issue.get("fingerprint")) for issue in open_error_issues],
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


def _persisted_issue_records(elements: dict[str, Element]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for element in elements.values():
        if getattr(element, "kind", None) != "constructability_issue":
            continue
        records.append(element.model_dump(by_alias=True, exclude={"kind", "id"}))
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
