from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai.advisor_policy_registry import (
    learning_corpus_contract_payload,
    profile_preset,
    profile_presets_payload,
    review_workflow_payload,
    rule_policy,
    rule_policy_payload,
    suppression_policy_decision,
)
from bim_ai.advisor_profiling import AdvisorDiagnosticsProfiler
from bim_ai.constraints import evaluate
from bim_ai.constraints_core import Violation
from bim_ai.constructability_clearance import (
    FURNITURE_WALL_CLEARANCE_RULE_ID,
    MAINTENANCE_CLEARANCE_RULE_ID,
    constructability_clearance_violations,
)
from bim_ai.constructability_geometry import (
    AABB,
    collect_physical_participants,
    collect_unsupported_physical_diagnostics,
    physical_participant_for_element,
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
from bim_ai.constructability_performance import (
    advisor_incremental_diagnostic_eligibility_v1,
)
from bim_ai.constructability_scope import (
    constructability_scope_descriptor,
    scope_constructability_elements,
)
from bim_ai.domain_integrity import check_domain_integrity_profiled
from bim_ai.elements import Element
from bim_ai.model_integrity import (
    ModelIntegrityFinding,
    check_model_integrity_invariants,
)
from bim_ai.model_integrity_hosting import hosted_opening_integrity_violations

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
        "structural_material_inconsistent_by_type",
        "structural_bays_missing_grids",
        "door_operation_clearance_conflict",
        "window_operation_clearance_conflict",
        "room_without_door_access",
        "room_without_egress_path",
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
        MAINTENANCE_CLEARANCE_RULE_ID,
        "roof_wall_coverage_gap",
        "roof_low_slope_without_drainage_metadata",
        "roof_opening_missing_host",
        "roof_opening_outside_host_footprint",
        "roof_opening_large_void_without_review",
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

NON_CONSTRUCTABILITY_DOMAIN_RULE_IDS = frozenset(
    {
        "room_access_open_separator_only_access",
    }
)

DOMAIN_INTEGRITY_CONSTRUCTABILITY_RULE_PREFIXES = (
    "code_profile_",
    "site_relationship_",
    "bir_f03_",
    "bir_f04_",
    "bir_f05_",
    "bir_f06_",
)

DOMAIN_INTEGRITY_CONSTRUCTABILITY_RULE_IDS = frozenset(
    {
        "room_access_fake_helper_access",
        "room_access_door_not_on_room_boundary",
        "room_access_room_outside_floor",
        "room_access_room_wall_topology_gap",
        "room_access_inaccessible_room",
        "room_access_unresolved_egress_path",
    }
)

MODEL_INTEGRITY_CONSTRUCTABILITY_RULE_IDS = frozenset(
    {
        "model_integrity_asset_placement_support_invalid",
        "model_integrity_asset_placement_floating",
        "model_integrity_asset_placement_circulation_overlap",
        "model_integrity_family_instance_host_constraint_violation",
    }
)

PRIORITY_RANK_BY_TOKEN = {
    "P0": 0,
    "P1": 10,
    "P2": 20,
    "P3": 30,
}

PRIORITY_BY_SEVERITY = {
    "error": "P0",
    "warning": "P1",
    "info": "P2",
}

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
    "structural_material_inconsistent_by_type": "Align structural material assignments for elements sharing the same type, or split the type when different materials are intentional.",
    "structural_bays_missing_grids": "Add structural grid lines for the repeated beam/column bay layout before coordination or external analysis handoff.",
    "door_operation_clearance_conflict": "Move nearby objects or adjust the door/opening so the operation zone stays clear.",
    "window_operation_clearance_conflict": "Move nearby objects or adjust the window/opening so operation and maintenance clearance stays clear.",
    "room_without_door_access": "Add a connected door opening or revise the room boundary so the room is accessible.",
    "room_without_egress_path": "Connect the room through doors to an exit door or mark an appropriate exit door.",
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
    MAINTENANCE_CLEARANCE_RULE_ID: "Move the obstruction outside the element's required maintenance/operation clearance.",
    "roof_wall_coverage_gap": "Revise the roof overhang/footprint or align the primary envelope wall under the roof coverage.",
    "roof_low_slope_without_drainage_metadata": "Add flat-roof drainage/taper metadata, increase the roof slope, or record engineering review approval.",
    "roof_opening_missing_host": "Attach the roof opening to a valid roof or remove the orphan opening.",
    "roof_opening_outside_host_footprint": "Move the roof opening fully inside the host roof footprint or revise the roof boundary.",
    "roof_opening_large_void_without_review": "Add curb/trimmer framing or structural review metadata for the large roof void.",
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
    changed_element_ids: Iterable[str] = (),
) -> dict[str, Any]:
    scoped_elements = scope_constructability_elements(
        elements,
        phase_filter=phase_filter,
        option_locks=option_locks,
        design_option_sets=design_option_sets,
    )
    changed_ids = tuple(str(element_id) for element_id in changed_element_ids if element_id)
    incremental_eligibility = advisor_incremental_diagnostic_eligibility_v1(
        scoped_elements,
        changed_element_ids=changed_ids,
    )
    impacted_count = int(incremental_eligibility["impactedElementCount"])
    incremental_eligible = bool(incremental_eligibility["incrementalEligible"])
    profiler = AdvisorDiagnosticsProfiler(
        element_count=len(scoped_elements),
        changed_element_ids=changed_ids,
        incremental_eligibility=incremental_eligibility,
    )
    violations = profiler.measure(
        check_id="advisor.evaluate_constructability_rules",
        layer="advisor",
        run=lambda: [
            v
            for v in evaluate(scoped_elements, constructability_profile=profile)
            if v.rule_id in CONSTRUCTABILITY_RULE_IDS
        ],
        impacted_element_count=impacted_count,
        incremental_eligible=incremental_eligible,
    )
    violations.extend(
        profiler.measure(
            check_id="constructability.clearance",
            layer="constructability",
            run=lambda: constructability_clearance_violations(scoped_elements, profile=profile),
            impacted_element_count=impacted_count,
            incremental_eligible=incremental_eligible,
        )
    )
    violations.extend(
        profiler.measure(
            check_id="constructability.metadata_requirements",
            layer="constructability",
            run=lambda: constructability_metadata_requirement_violations(
                scoped_elements,
                profile=profile,
            ),
            impacted_element_count=impacted_count,
            incremental_eligible=incremental_eligible,
        )
    )
    violations.extend(
        profiler.measure(
            check_id="model_integrity.constructability_errors",
            layer="model_integrity",
            run=lambda: _model_integrity_constructability_violations(scoped_elements),
            impacted_element_count=impacted_count,
            incremental_eligible=incremental_eligible,
        )
    )
    domain_findings = [
        finding
        for finding in check_domain_integrity_profiled(
            scoped_elements,
            profile=profile,
            profiler=profiler,
        )
        if str(finding.get("ruleId") or "") not in NON_CONSTRUCTABILITY_DOMAIN_RULE_IDS
        and _is_constructability_domain_finding(finding)
    ]
    all_findings = [
        *[_finding_dict(v, profile=profile) for v in violations],
        *domain_findings,
    ]
    participant_bboxes = _participant_bboxes(scoped_elements)
    all_findings = [
        _finding_with_actionability(finding, participant_bboxes=participant_bboxes, profile=profile)
        for finding in all_findings
    ]
    suppressions = _suppression_records(scoped_elements, revision=revision)
    active_findings: list[dict[str, Any]] = []
    suppressed_by_fingerprint: dict[str, dict[str, Any]] = {}
    invalid_suppressions: list[dict[str, Any]] = []
    for finding in all_findings:
        suppression = _matching_suppression(finding, suppressions)
        if suppression is None:
            active_findings.append(finding)
            continue
        decision = suppression_policy_decision(finding, suppression)
        if not decision["allowed"]:
            invalid_suppressions.append(
                {
                    "suppressionId": suppression.get("id"),
                    "ruleId": finding.get("ruleId"),
                    "elementIds": finding.get("elementIds") or [],
                    "reason": decision["reason"],
                    "missing": decision["missing"],
                    "policy": decision["policy"],
                }
            )
            active_findings.append(finding)
            continue
        fingerprint = fingerprint_violation(finding)
        suppressed_by_fingerprint[fingerprint] = {
            **suppression,
            "policy": decision["policy"],
        }

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

    groups = _root_cause_groups(active_findings)
    severity_counts = Counter(str(f.get("severity") or "unknown") for f in active_findings)
    rule_counts = Counter(str(f.get("ruleId") or "unknown") for f in active_findings)
    status_counts = Counter(str(i.get("status") or "unknown") for i in issues)

    return {
        "format": "constructabilityReport_v1",
        "revision": revision,
        "profile": profile,
        "profilePreset": profile_preset(profile),
        "availableProfilePresets": profile_presets_payload(),
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
            "priorityCounts": dict(
                sorted(
                    Counter(str(f.get("priority") or "unknown") for f in active_findings).items()
                )
            ),
            "ruleCounts": dict(sorted(rule_counts.items())),
            "statusCounts": dict(sorted(status_counts.items())),
            "rootCauseGroupCount": len(groups),
        },
        "findings": sorted(
            active_findings,
            key=lambda f: (
                int(f.get("priorityRank") or 99),
                _severity_sort_rank(str(f.get("severity") or "")),
                str(f.get("ruleId") or ""),
                tuple(str(eid) for eid in f.get("elementIds") or []),
            ),
        ),
        "rootCauseGroups": groups,
        "issues": sorted(
            issues,
            key=lambda i: (
                str(i.get("status") or ""),
                str(i.get("ruleId") or ""),
                str(i.get("pairKey") or ""),
                str(i.get("fingerprint") or ""),
            ),
        ),
        "suppressionAudit": {
            "schemaVersion": "advisor.suppression-audit.v1",
            "records": suppressions,
            "invalidRecords": invalid_suppressions,
        },
        "reviewWorkflow": review_workflow_payload(),
        "learningCorpus": learning_corpus_contract_payload(),
        "profiling": profiler.payload(),
    }


def _model_integrity_constructability_violations(elements: dict[str, Element]) -> list[Violation]:
    violations = [
        _integrity_finding_to_violation(finding)
        for finding in check_model_integrity_invariants(elements)
        if finding.severity == "error"
        and finding.rule_id in MODEL_INTEGRITY_CONSTRUCTABILITY_RULE_IDS
    ]
    violations.extend(hosted_opening_integrity_violations(elements))
    return violations


def _is_constructability_domain_finding(finding: Mapping[str, Any]) -> bool:
    rule_id = str(finding.get("ruleId") or "")
    if rule_id in DOMAIN_INTEGRITY_CONSTRUCTABILITY_RULE_IDS:
        return True
    return rule_id.startswith(DOMAIN_INTEGRITY_CONSTRUCTABILITY_RULE_PREFIXES)


def _integrity_finding_to_violation(finding: ModelIntegrityFinding) -> Violation:
    return Violation(
        rule_id=finding.rule_id,
        severity=finding.severity,
        message=finding.message,
        element_ids=list(finding.element_ids),
        blocking=finding.severity == "error",
        discipline="coordination",
        blocking_class="model_integrity",
    )


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
    if (
        profile == "construction_readiness"
        and violation.rule_id in CONSTRUCTION_READINESS_ERROR_RULE_IDS
    ):
        data["severity"] = "error"
        data["blocking"] = True
    data["recommendation"] = RECOMMENDATION_BY_RULE_ID.get(
        violation.rule_id,
        "Inspect the affected elements and resolve the constructability condition.",
    )
    data["profile"] = profile
    policy = rule_policy_payload(violation.rule_id)
    data.update(
        {
            "title": policy["title"],
            "layerOwner": policy["layerOwner"],
            "suppressibility": policy["suppressibility"],
            "tolerancePolicy": policy["tolerancePolicy"],
            "profileMembership": policy["profileMembership"],
            "audienceText": policy["audienceText"],
            "rulePolicy": policy,
        }
    )
    return data


def _participant_bboxes(elements: dict[str, Element]) -> dict[str, AABB]:
    bboxes: dict[str, AABB] = {}
    for element_id, element in elements.items():
        participant = physical_participant_for_element(element, elements)
        if participant is not None:
            bboxes[str(element_id)] = participant.aabb
    return bboxes


def _finding_with_actionability(
    finding: Mapping[str, Any],
    *,
    participant_bboxes: Mapping[str, AABB],
    profile: str,
) -> dict[str, Any]:
    data = dict(finding)
    data.setdefault("profile", profile)
    _apply_rule_policy_fields(data)
    priority = _priority_for_finding(data)
    priority_policy = _priority_policy(priority, data)
    priority_rank = int(priority_policy["rank"])
    data["priority"] = priority
    data["priorityRank"] = priority_rank
    data["priorityPolicy"] = priority_policy

    viewpoint = _viewpoint_action_for_finding(data, participant_bboxes)
    if viewpoint is None:
        data["actionability"] = {
            "priority": priority,
            "priorityRank": priority_rank,
            "primaryAction": "inspect_elements",
            "safeCommandHints": [],
        }
        return data

    safe_command_hint = {
        "label": "Save focused review viewpoint",
        "safety": "context_only",
        "command": viewpoint["command"],
    }
    data["viewpointRef"] = viewpoint["viewpointId"]
    data["evidenceRefs"] = [{"kind": "viewpoint", "viewpointId": viewpoint["viewpointId"]}]
    data["safeCommandHints"] = [safe_command_hint]
    data["actionability"] = {
        "priority": priority,
        "priorityRank": priority_rank,
        "primaryAction": "save_review_viewpoint",
        "viewpointRef": viewpoint["viewpointId"],
        "evidenceRefs": data["evidenceRefs"],
        "safeCommandHints": [safe_command_hint],
    }
    return data


def _apply_rule_policy_fields(data: dict[str, Any]) -> None:
    rule_id = str(data.get("ruleId") or data.get("rule_id") or "")
    policy = rule_policy_payload(rule_id)
    data.setdefault("title", policy["title"])
    data.setdefault("layerOwner", policy["layerOwner"])
    data.setdefault("suppressibility", policy["suppressibility"])
    data.setdefault("tolerancePolicy", policy["tolerancePolicy"])
    data.setdefault("profileMembership", policy["profileMembership"])
    data.setdefault("audienceText", policy["audienceText"])
    data.setdefault("rulePolicy", policy)


def _priority_for_finding(finding: Mapping[str, Any]) -> str:
    explicit = str(finding.get("priority") or "").strip().upper()
    if explicit in PRIORITY_RANK_BY_TOKEN:
        return explicit
    severity = str(finding.get("severity") or "warning")
    return PRIORITY_BY_SEVERITY.get(severity, "P1")


def _priority_rank(priority: str, finding: Mapping[str, Any]) -> int:
    return int(_priority_policy(priority, finding)["rank"])


def _priority_policy(priority: str, finding: Mapping[str, Any]) -> dict[str, Any]:
    base = PRIORITY_RANK_BY_TOKEN.get(priority, PRIORITY_RANK_BY_TOKEN["P1"])
    severity_rank = _severity_sort_rank(str(finding.get("severity") or ""))
    blocking_class = str(finding.get("blockingClass") or "")
    blocking_class_bias = {
        "model_integrity": 0,
        "geometry": 1,
        "domain_integrity": 2,
        "metadata": 3,
    }.get(blocking_class, 4)
    policy = rule_policy(str(finding.get("ruleId") or ""))
    active_profile = str(finding.get("profile") or "")
    profile_relevance_rank = 0 if active_profile in policy.profile_membership else 4
    rank = (
        base * 100
        + severity_rank * 20
        + policy.dependency_rank * 3
        + policy.visible_impact_rank * 2
        + profile_relevance_rank
        + blocking_class_bias
    )
    return {
        "rank": rank,
        "severityRank": severity_rank,
        "blockingClassRank": blocking_class_bias,
        "dependencyRank": policy.dependency_rank,
        "visibleImpactRank": policy.visible_impact_rank,
        "profileRelevanceRank": profile_relevance_rank,
        "profileId": active_profile or None,
    }


def _severity_sort_rank(severity: str) -> int:
    return {"error": 0, "warning": 1, "info": 2}.get(severity, 9)


def _viewpoint_action_for_finding(
    finding: Mapping[str, Any],
    participant_bboxes: Mapping[str, AABB],
) -> dict[str, Any] | None:
    element_ids = [str(eid) for eid in finding.get("elementIds") or []]
    bbox = _union_bbox(
        [participant_bboxes[eid] for eid in element_ids if eid in participant_bboxes]
    )
    if bbox is None:
        return None

    fingerprint = fingerprint_violation(finding)
    viewpoint_id = f"vp-constructability-{fingerprint[:16]}"
    title = _title_for_finding(finding)
    center = {
        "xMm": (bbox.min_x + bbox.max_x) / 2.0,
        "yMm": (bbox.min_y + bbox.max_y) / 2.0,
        "zMm": (bbox.min_z + bbox.max_z) / 2.0,
    }
    span = max(bbox.width_mm, bbox.depth_mm, bbox.height_mm, 1000.0)
    camera = {
        "position": {
            "xMm": center["xMm"] + span,
            "yMm": center["yMm"] - span,
            "zMm": center["zMm"] + span * 0.75,
        },
        "target": center,
        "up": {"xMm": 0.0, "yMm": 0.0, "zMm": 1.0},
    }
    return {
        "viewpointId": viewpoint_id,
        "command": {
            "type": "saveViewpoint",
            "id": viewpoint_id,
            "name": title,
            "mode": "orbit_3d",
            "camera": camera,
            "cutawayStyle": "box",
        },
    }


def _union_bbox(boxes: list[AABB]) -> AABB | None:
    if not boxes:
        return None
    return AABB(
        min(box.min_x for box in boxes),
        min(box.min_y for box in boxes),
        min(box.min_z for box in boxes),
        max(box.max_x for box in boxes),
        max(box.max_y for box in boxes),
        max(box.max_z for box in boxes),
    )


def _title_for_finding(finding: Mapping[str, Any]) -> str:
    rule_id = str(finding.get("ruleId") or "constructability_issue")
    return f"Review: {rule_id.replace('_', ' ').title()}"


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
                "owner": getattr(element, "owner", None),
                "evidenceRefs": [
                    ref.model_dump(by_alias=True, exclude_none=True)
                    for ref in getattr(element, "evidence_refs", [])
                ],
                "reviewClassification": getattr(element, "review_classification", None),
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


def _root_cause_groups(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    for finding in findings:
        group_id = _root_cause_group_id(finding)
        finding["rootCauseGroupId"] = group_id
        finding["rootCauseGroup"] = {
            "id": group_id,
            "family": rule_policy(str(finding.get("ruleId") or "")).root_cause_family,
        }
        buckets.setdefault(group_id, []).append(finding)

    groups: list[dict[str, Any]] = []
    for group_id, rows in buckets.items():
        rows_sorted = sorted(
            rows,
            key=lambda row: (
                int(row.get("priorityRank") or 99),
                _severity_sort_rank(str(row.get("severity") or "")),
                str(row.get("ruleId") or ""),
            ),
        )
        primary = rows_sorted[0]
        element_ids = sorted(
            {str(element_id) for row in rows for element_id in row.get("elementIds") or []}
        )
        severity = min(
            (str(row.get("severity") or "") for row in rows),
            key=_severity_sort_rank,
            default="warning",
        )
        family = rule_policy(str(primary.get("ruleId") or "")).root_cause_family
        groups.append(
            {
                "id": group_id,
                "family": family,
                "primaryRuleId": primary.get("ruleId"),
                "severity": severity,
                "priority": primary.get("priority"),
                "priorityRank": primary.get("priorityRank"),
                "findingCount": len(rows),
                "elementIds": element_ids,
                "findingRefs": [
                    {
                        "ruleId": row.get("ruleId"),
                        "elementIds": row.get("elementIds") or [],
                    }
                    for row in rows_sorted
                ],
                "rootCauseSummary": _root_cause_summary(family, element_ids),
            }
        )
    return sorted(
        groups,
        key=lambda group: (
            int(group.get("priorityRank") or 99),
            str(group.get("family") or ""),
            str(group.get("id") or ""),
        ),
    )


def _root_cause_group_id(finding: Mapping[str, Any]) -> str:
    policy = rule_policy(str(finding.get("ruleId") or ""))
    element_ids = sorted(str(eid) for eid in finding.get("elementIds") or [])
    if policy.root_cause_family in {
        "physical_coordination",
        "duplicate_geometry",
        "mep_penetration",
        "clearance",
    }:
        element_key = "::".join(element_ids)
    elif element_ids:
        element_key = element_ids[0]
    else:
        element_key = str(finding.get("ruleId") or "unknown")
    return f"{policy.root_cause_family}:{element_key}"


def _root_cause_summary(family: str, element_ids: list[str]) -> str:
    label = family.replace("_", " ")
    if not element_ids:
        return f"{label} finding without element target"
    return f"{label} affecting {', '.join(element_ids[:4])}"
