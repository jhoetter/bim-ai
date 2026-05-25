from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai._io.log import get_logger
from bim_ai.advisor_profiling import AdvisorDiagnosticsProfiler
from bim_ai.constraints_core import Violation
from bim_ai.constructability_performance import advisor_incremental_diagnostic_eligibility_v1
from bim_ai.constructability_report import RECOMMENDATION_BY_RULE_ID, build_constructability_report
from bim_ai.document import Document
from bim_ai.elements import Element
from bim_ai.model_integrity import ModelIntegrityFinding, check_model_integrity_invariants
from bim_ai.model_integrity_hosting import (
    hosted_opening_integrity_violations,
    physical_support_context_violations,
)
from typing import Any
from pydantic import BaseModel, ConfigDict


class IntegrityPreflightResponse(BaseModel):
    """Response of `build_integrity_preflight_report`.

    Inlined here from the (now-deleted) `models/reverse_bim_responses.py`
    per Phase 6 of the bim-ai/bim-agent clean-separation tracker — bim-ai
    no longer ships a reverse_bim_responses module.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True, protected_namespaces=())

    format: str
    summary: dict[str, Any] | None = None
    findings: list[dict[str, Any]] | None = None


from bim_ai.transaction_safety import build_agent_remediation_proposal, canonical_payload_digest
from bim_ai.vertical_circulation_integrity import check_vertical_circulation_integrity

_logger = get_logger("bim_ai.integrity_preflight")

DEFAULT_PROFILE_COMPARISON_PROFILES = (
    "authoring_default",
    "construction_readiness",
    "fire",
    "accessibility",
    "structure",
    "mep",
    "exchange",
)


def build_integrity_preflight_report(
    doc_or_elements: Document | Mapping[str, Element],
    *,
    revision: str | int,
    model_id: str | None = None,
    changed_element_ids: Iterable[str] = (),
    actor_id: str = "agent",
    source_command_index: Mapping[str, list[Mapping[str, Any]]] | None = None,
) -> IntegrityPreflightResponse:
    elements = _elements(doc_or_elements)
    changed_ids = tuple(str(element_id) for element_id in changed_element_ids if element_id)
    _logger.info(
        "integrity_preflight.start",
        extra={
            "phase": "preflight",
            "model_id": model_id,
            "revision": str(revision),
            "element_count": len(elements),
            "changed_element_count": len(changed_ids),
        },
    )
    incremental_eligibility = advisor_incremental_diagnostic_eligibility_v1(
        dict(elements),
        changed_element_ids=changed_ids,
    )
    impacted_count = int(incremental_eligibility["impactedElementCount"])
    incremental_eligible = bool(incremental_eligibility["incrementalEligible"])
    profiler = AdvisorDiagnosticsProfiler(
        element_count=len(elements),
        changed_element_ids=changed_ids,
        incremental_eligibility=incremental_eligibility,
    )
    invariant_findings = profiler.measure(
        check_id="model_integrity.invariants",
        layer="model_integrity",
        run=lambda: check_model_integrity_invariants(dict(elements)),
        finding_count=len,
        impacted_element_count=impacted_count,
        incremental_eligible=incremental_eligible,
    )
    hosted_violations = profiler.measure(
        check_id="model_integrity.hosted_openings",
        layer="model_integrity",
        run=lambda: hosted_opening_integrity_violations(dict(elements)),
        finding_count=len,
        impacted_element_count=impacted_count,
        incremental_eligible=incremental_eligible,
    )
    support_violations = profiler.measure(
        check_id="model_integrity.physical_support_context",
        layer="model_integrity",
        run=lambda: physical_support_context_violations(dict(elements)),
        finding_count=len,
        impacted_element_count=impacted_count,
        incremental_eligible=incremental_eligible,
    )
    vertical_findings = profiler.measure(
        check_id="domain_integrity.vertical_circulation",
        layer="domain_integrity",
        run=lambda: check_vertical_circulation_integrity(dict(elements)),
        finding_count=len,
        impacted_element_count=impacted_count,
        incremental_eligible=incremental_eligible,
    )
    profiler.skip(
        check_id="constructability.profile_rules",
        layer="constructability",
        reason="integrity_preflight_is_profile_independent",
        incremental_eligible=incremental_eligible,
    )
    profiler.skip(
        check_id="sketch.methodology_acceptance",
        layer="sketch_methodology",
        reason="normal_integrity_preflight_excludes_subjective_sketch_checks",
        incremental_eligible=False,
    )

    findings = [
        *[_finding_from_integrity(row) for row in invariant_findings],
        *[_finding_from_violation(row) for row in hosted_violations],
        *[_finding_from_violation(row) for row in support_violations],
        *[_finding_from_domain(row) for row in vertical_findings],
    ]
    if source_command_index:
        findings = [_attach_source_commands(row, source_command_index) for row in findings]
    findings.sort(key=_finding_sort_key)
    severity_counts = Counter(str(row.get("severity") or "unknown") for row in findings)
    blocking_count = sum(
        1
        for row in findings
        if row.get("blocking") is True or str(row.get("severity") or "") == "error"
    )
    remediation = build_integrity_remediation_loop(
        revision=revision,
        findings=findings,
        actor_id=actor_id,
    )
    payload: dict[str, Any] = {
        "format": "integrityPreflightReport_v1",
        "modelId": model_id,
        "revision": revision,
        "profileIndependent": True,
        "profile": "model_integrity",
        "layers": ["model_integrity", "domain_integrity"],
        "normalAdvisorSketchChecksIncluded": False,
        "summary": {
            "findingCount": len(findings),
            "blockingFindingCount": blocking_count,
            "severityCounts": dict(sorted(severity_counts.items())),
            "fixableFindingCount": remediation["summary"]["fixableFindingCount"],
            "proposalCount": remediation["summary"]["proposalCount"],
        },
        "findings": findings,
        "remediation": remediation,
        "provenance": {
            "format": "integrityPreflightProvenance_v1",
            "sourceCommandLinkedFindingCount": sum(
                1 for finding in findings if finding.get("sourceCommands")
            ),
            "sourceCommandIndexedElementCount": len(source_command_index or {}),
        },
        "diagnostics": profiler.payload(),
    }
    payload["digestSha256"] = canonical_payload_digest(payload)
    return IntegrityPreflightResponse.model_validate(payload)


def build_integrity_remediation_loop(
    *,
    revision: str | int,
    findings: list[Mapping[str, Any]],
    actor_id: str = "agent",
) -> dict[str, Any]:
    proposals: list[dict[str, Any]] = []
    for finding in findings:
        commands = _commands_for_finding(finding)
        if not commands:
            continue
        proposal = build_agent_remediation_proposal(
            current_revision=int(revision) if isinstance(revision, int) else 0,
            findings=[finding],
            commands=commands,
            actor_identity={"actorKind": "agent", "actorId": actor_id},
            evidence_path="integrity-preflight.json",
        )
        proposal["proposalId"] = _proposal_id(finding)
        proposal["dryRunRoute"] = "/api/models/{model_id}/commands/bundle/dry-run"
        proposal["commitRoute"] = "/api/models/{model_id}/commands/bundle"
        proposal["recaptureEvidence"] = {
            "route": "/api/models/{model_id}/qa/integrity-preflight",
            "expectedFormat": "integrityPreflightReport_v1",
        }
        proposals.append(proposal)
    fixable_ids = sorted(
        {
            str(eid)
            for proposal in proposals
            for eid in proposal.get("affectedElementIds") or []
            if str(eid) != "unknown"
        }
    )
    return {
        "format": "integrityRemediationLoop_v1",
        "revision": revision,
        "workflow": [
            "list_findings",
            "propose_safe_correction_bundles",
            "dry_run_fixes",
            "commit_accepted_fixes",
            "recapture_integrity_preflight_evidence",
        ],
        "summary": {
            "findingCount": len(findings),
            "fixableFindingCount": len(proposals),
            "proposalCount": len(proposals),
            "fixableElementIds": fixable_ids,
        },
        "proposals": sorted(proposals, key=lambda row: str(row.get("proposalId") or "")),
        "commitPolicy": {
            "requiresAcceptedProposalIds": True,
            "requiresPassingDryRunEvidence": True,
            "defaultMode": "dry_run",
        },
    }


def build_source_command_index_from_transactions(
    transactions: Iterable[Mapping[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Map affected element ids to source authoring command references."""

    index: dict[str, list[dict[str, Any]]] = {}
    for tx_index, transaction in enumerate(transactions):
        metadata = _transaction_metadata(transaction)
        commands = transaction.get("appliedCommands") or transaction.get("forwardCommands") or []
        if not isinstance(commands, list):
            continue
        for command_index, command in enumerate(commands):
            if not isinstance(command, Mapping):
                continue
            source_command_id = _source_command_id(command, command_index)
            affected_ids = _affected_ids_for_command(command)
            if not source_command_id or not affected_ids:
                continue
            ref = {
                "sourceCommandId": source_command_id,
                "commandType": str(command.get("type") or "unknown"),
                "transactionId": str(transaction.get("id") or tx_index),
                "revisionAfter": transaction.get("revisionAfter") or metadata.get("revisionAfter"),
            }
            for key in ("sourceRecipeRow", "agentWave", "commit"):
                value = command.get(key) or metadata.get(key) or _nested(command, "agentTrace", key)
                if value:
                    ref[key] = str(value)
            for element_id in affected_ids:
                index.setdefault(element_id, [])
                if ref not in index[element_id]:
                    index[element_id].append(dict(ref, affectedElementId=element_id))
    return {
        element_id: sorted(rows, key=lambda row: str(row.get("sourceCommandId") or ""))
        for element_id, rows in sorted(index.items())
    }


def build_multi_profile_comparison(
    elements: Mapping[str, Element],
    *,
    revision: str | int,
    profiles: Iterable[str] = DEFAULT_PROFILE_COMPARISON_PROFILES,
    changed_element_ids: Iterable[str] = (),
) -> dict[str, Any]:
    requested_profiles = _dedupe_profiles(profiles)
    reports = [
        build_constructability_report(
            dict(elements),
            revision=revision,
            profile=profile,
            changed_element_ids=changed_element_ids,
        )
        for profile in requested_profiles
    ]
    baseline_rule_ids = _rule_ids(reports[0]) if reports else set()
    rows = []
    rule_matrix: dict[str, dict[str, int]] = {}
    for report in reports:
        profile = str(report.get("profile") or "")
        rule_ids = _rule_ids(report)
        severity_counts = dict(report.get("summary", {}).get("severityCounts") or {})
        rows.append(
            {
                "profile": profile,
                "findingCount": int(report.get("summary", {}).get("findingCount") or 0),
                "issueCount": int(report.get("summary", {}).get("issueCount") or 0),
                "severityCounts": severity_counts,
                "ruleIds": sorted(rule_ids),
                "addedRuleIdsVsBaseline": sorted(rule_ids - baseline_rule_ids),
                "missingRuleIdsVsBaseline": sorted(baseline_rule_ids - rule_ids),
                "diagnostics": report.get("profiling"),
            }
        )
        for finding in report.get("findings") or []:
            rule_id = str(finding.get("ruleId") or "unknown")
            rule_matrix.setdefault(rule_id, {})
            rule_matrix[rule_id][profile] = rule_matrix[rule_id].get(profile, 0) + 1
    payload = {
        "format": "advisorMultiProfileComparison_v1",
        "revision": revision,
        "profiles": requested_profiles,
        "baselineProfile": requested_profiles[0] if requested_profiles else None,
        "rows": rows,
        "ruleMatrix": [
            {"ruleId": rule_id, "countsByProfile": dict(sorted(counts.items()))}
            for rule_id, counts in sorted(rule_matrix.items())
        ],
        "summary": {
            "profileCount": len(rows),
            "profilesWithErrors": [
                row["profile"] for row in rows if int(row["severityCounts"].get("error") or 0) > 0
            ],
        },
    }
    payload["digestSha256"] = canonical_payload_digest(payload)
    return payload


def _elements(doc_or_elements: Document | Mapping[str, Element]) -> Mapping[str, Element]:
    if isinstance(doc_or_elements, Document):
        return doc_or_elements.elements
    return doc_or_elements


def _finding_from_integrity(finding: ModelIntegrityFinding) -> dict[str, Any]:
    data = finding.to_dict()
    data["blocking"] = finding.severity == "error"
    data["discipline"] = "coordination"
    data["blockingClass"] = "model_integrity"
    data["recommendation"] = RECOMMENDATION_BY_RULE_ID.get(
        finding.rule_id,
        _default_recommendation(finding.rule_id),
    )
    data["fixHints"] = _fix_hints_for_rule(data)
    return data


def _finding_from_violation(violation: Violation) -> dict[str, Any]:
    data = violation.model_dump(by_alias=True, exclude_none=True)
    data["recommendation"] = RECOMMENDATION_BY_RULE_ID.get(
        violation.rule_id,
        _default_recommendation(violation.rule_id),
    )
    data["fixHints"] = _fix_hints_for_rule(data)
    return data


def _finding_from_domain(finding: Mapping[str, Any]) -> dict[str, Any]:
    data = dict(finding)
    data["ruleId"] = str(data.get("ruleId") or data.get("rule_id") or "domain_integrity")
    if "element_ids" in data and "elementIds" not in data:
        data["elementIds"] = list(data.pop("element_ids"))
    data["blocking"] = data.get("blocking") is True or str(data.get("severity") or "") == "error"
    data["blockingClass"] = "domain_integrity"
    data["fixHints"] = _fix_hints_for_rule(data)
    return data


def _fix_hints_for_rule(finding: Mapping[str, Any]) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []
    quick_fix = finding.get("quickFixCommand")
    if isinstance(quick_fix, Mapping):
        hints.append(
            {
                "kind": "quick_fix_command",
                "safety": "review_required",
                "command": dict(quick_fix),
            }
        )
    rule_id = str(finding.get("ruleId") or "")
    if "missing_host" in rule_id or "helper_host" in rule_id:
        hints.append({"kind": "rehost_or_delete", "safety": "needs_user_intent"})
    elif "outside_usable_span" in rule_id:
        hints.append({"kind": "resize_or_reposition_opening", "safety": "review_required"})
    elif "physical_access_proxy_leakage" in rule_id:
        hints.append({"kind": "convert_to_analysis_or_delete_helper", "safety": "review_required"})
    elif "unresolved_reference" in rule_id:
        hints.append({"kind": "resolve_reference_or_remove_element", "safety": "needs_user_intent"})
    return hints


def _commands_for_finding(finding: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    commands = []
    quick_fix = finding.get("quickFixCommand")
    if isinstance(quick_fix, Mapping):
        commands.append(dict(quick_fix))
    for hint in finding.get("fixHints") or []:
        command = hint.get("command") if isinstance(hint, Mapping) else None
        if isinstance(command, Mapping) and command not in commands:
            commands.append(dict(command))
    return commands


def _attach_source_commands(
    finding: Mapping[str, Any],
    source_command_index: Mapping[str, list[Mapping[str, Any]]],
) -> dict[str, Any]:
    out = dict(finding)
    refs: list[dict[str, Any]] = []
    for element_id in out.get("elementIds") or out.get("affectedElementIds") or []:
        for ref in source_command_index.get(str(element_id), []):
            row = dict(ref)
            if row not in refs:
                refs.append(row)
    refs.sort(
        key=lambda row: (
            str(row.get("affectedElementId") or ""),
            str(row.get("sourceCommandId") or ""),
            str(row.get("transactionId") or ""),
        )
    )
    if refs:
        out["sourceCommands"] = refs
        out["sourceCommandIds"] = sorted({str(ref["sourceCommandId"]) for ref in refs})
    return out


def _transaction_metadata(transaction: Mapping[str, Any]) -> Mapping[str, Any]:
    metadata = transaction.get("transactionMetadata")
    return metadata if isinstance(metadata, Mapping) else {}


def _source_command_id(command: Mapping[str, Any], command_index: int) -> str:
    value = command.get("sourceCommandId") or command.get("commandId")
    if value is None:
        value = _nested(command, "agentTrace", "sourceCommandId")
    if value is None:
        value = _nested(command, "agentTrace", "commandId")
    if value is None:
        value = command.get("id")
    return str(value or f"command[{command_index}]")


def _affected_ids_for_command(command: Mapping[str, Any]) -> list[str]:
    ids: set[str] = set()
    for key in (
        "id",
        "elementId",
        "hostWallId",
        "wallId",
        "levelId",
        "assetId",
        "familyTypeId",
        "roomId",
    ):
        value = command.get(key)
        if isinstance(value, str) and value:
            ids.add(value)
    for key in ("elementIds", "affectedElementIds", "ids"):
        raw = command.get(key)
        if isinstance(raw, list):
            ids.update(str(value) for value in raw if value)
    return sorted(ids)


def _nested(row: Mapping[str, Any], outer: str, inner: str) -> Any:
    value = row.get(outer)
    if isinstance(value, Mapping):
        return value.get(inner)
    return None


def _proposal_id(finding: Mapping[str, Any]) -> str:
    rule_id = str(finding.get("ruleId") or "finding")
    element_ids = "-".join(str(eid) for eid in finding.get("elementIds") or ["model"])
    digest = canonical_payload_digest({"ruleId": rule_id, "elementIds": element_ids})[:12]
    return f"integrity-fix-{rule_id}-{digest}"


def _finding_sort_key(finding: Mapping[str, Any]) -> tuple[int, str, tuple[str, ...], str]:
    return (
        {"error": 0, "warning": 1, "info": 2}.get(str(finding.get("severity") or ""), 9),
        str(finding.get("ruleId") or ""),
        tuple(str(eid) for eid in finding.get("elementIds") or []),
        str(finding.get("message") or ""),
    )


def _default_recommendation(rule_id: str) -> str:
    if rule_id.startswith("hosted_opening_"):
        return "Fix the hosted opening relationship, semantic cut, or host geometry before commit."
    if rule_id.startswith("model_integrity_"):
        return "Correct the referenced BIM element, role, host, type, or schema metadata."
    return "Inspect and resolve the deterministic model integrity condition."


def _dedupe_profiles(profiles: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for profile in profiles:
        value = str(profile).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _rule_ids(report: Mapping[str, Any]) -> set[str]:
    return {str(row.get("ruleId") or "unknown") for row in report.get("findings") or []}
