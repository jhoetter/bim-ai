"""Deterministic acceptance gate readout for agent briefs — derivative, digest-excluded (WP-F01/F02/A02/A04)."""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import AgentAssumptionElem, AgentDeviationElem

FORMAT = "agentBriefAcceptanceReadout_v1"
SCHEMA_VERSION = 1

DEFAULT_VALIDATION_COMMAND_LABELS_V1: tuple[str, ...] = (
    "pytest_agent_brief_command_protocol",
    "vitest_agent_brief_command_protocol",
)

AFFECTED_WORKPACKAGES_V1: tuple[str, ...] = ("WP-F01", "WP-A02", "WP-A04", "WP-F02", "WP-V01")

ALLOWED_FAILURE_REASON_CODES: frozenset[str] = frozenset(
    {
        "no_failure",
        "unresolved_assumption",
        "unacknowledged_deviation",
        "missing_validation_command",
        "missing_tracker_touchpoint",
        "missing_evidence_artifact_expectation",
        "protocol_command_missing_or_malformed",
    }
)

GATE_ORDER: tuple[str, ...] = (
    "assumptions_linked_resolved",
    "deviations_acknowledged",
    "validation_commands_present",
    "tracker_rows_touched",
    "evidence_artifacts_expected",
    "failure_reason_codes",
)

_GATE_LABELS: dict[str, str] = {
    "assumptions_linked_resolved": "Assumptions linked and resolved",
    "deviations_acknowledged": "Deviations acknowledged",
    "validation_commands_present": "Validation commands present",
    "tracker_rows_touched": "Tracker rows touched",
    "evidence_artifacts_expected": "Evidence artifacts expected",
    "failure_reason_codes": "Failure reason codes",
}

_ASSUMPTION_VIOL_RULE_IDS = frozenset(
    {"agent_brief_assumption_unresolved", "agent_brief_assumption_reference_broken"}
)
_DEVIATION_VIOL_RULE_IDS = frozenset({"agent_brief_deviation_unacknowledged"})


def _viol_rule_ids(validation_violations: list[dict[str, Any]]) -> set[str]:
    out: set[str] = set()
    for raw in validation_violations:
        if not isinstance(raw, dict):
            continue
        rid = raw.get("ruleId")
        if isinstance(rid, str) and rid:
            out.add(rid)
    return out


def _missing_assumption_refs(brief_protocol: dict[str, Any]) -> list[dict[str, str]]:
    raw = brief_protocol.get("missingAssumptionReferences")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for row in raw:
        if (
            isinstance(row, dict)
            and isinstance(row.get("deviationId"), str)
            and isinstance(row.get("relatedAssumptionId"), str)
        ):
            out.append(
                {"deviationId": row["deviationId"], "relatedAssumptionId": row["relatedAssumptionId"]}
            )
    out.sort(key=lambda x: (x["deviationId"], x["relatedAssumptionId"]))
    return out


def _malformed_command_count(brief_protocol: dict[str, Any]) -> int:
    hist = brief_protocol.get("commandTypeHistogram")
    if not isinstance(hist, dict):
        return 0
    v = hist.get("?")
    return int(v) if isinstance(v, int) else 0


def _expected_artifact_ids(manifest: dict[str, Any]) -> list[str]:
    raw = manifest.get("expectedArtifacts")
    if not isinstance(raw, list):
        return []
    ids: list[str] = []
    for row in raw:
        if isinstance(row, dict):
            i = row.get("id")
            if isinstance(i, str) and i:
                ids.append(i)
    return sorted(set(ids))


def agent_brief_acceptance_readout_v1(
    *,
    doc: Document,
    brief_protocol: dict[str, Any],
    qa_checklist: dict[str, Any] | None,
    artifact_upload_manifest: dict[str, Any] | None,
    validation_violations: list[dict[str, Any]],
    validation_command_labels: list[str] | None = None,
) -> dict[str, Any]:
    """Build ordered acceptance rows from protocol, model closure fields, and evidence hints."""

    viol_ids = _viol_rule_ids(validation_violations)
    missing_refs = _missing_assumption_refs(brief_protocol)
    assumption_ids = sorted(
        e.id for e in doc.elements.values() if isinstance(e, AgentAssumptionElem)
    )
    deviation_ids = sorted(e.id for e in doc.elements.values() if isinstance(e, AgentDeviationElem))
    open_assumption_ids = sorted(
        e.id
        for e in doc.elements.values()
        if isinstance(e, AgentAssumptionElem) and e.closure_status == "open"
    )
    unacked_deviation_ids = sorted(
        e.id for e in doc.elements.values() if isinstance(e, AgentDeviationElem) and not e.acknowledged
    )

    source_brief = brief_protocol.get("sourceBrief")
    brief_kind: str | None = None
    if isinstance(source_brief, dict):
        bk = source_brief.get("briefKind")
        brief_kind = bk if isinstance(bk, str) else None

    if validation_command_labels is not None:
        labels = sorted(validation_command_labels)
    else:
        labels = list(DEFAULT_VALIDATION_COMMAND_LABELS_V1)

    rows: list[dict[str, Any]] = []

    assumption_fail = (
        bool(missing_refs)
        or bool(open_assumption_ids)
        or bool(viol_ids & _ASSUMPTION_VIOL_RULE_IDS)
    )
    if assumption_fail:
        action = (
            "Resolve missing assumption links or close assumptions (resolved/accepted/deferred)."
            if missing_refs or open_assumption_ids
            else "Fix advisor violations for assumption linkage."
        )
        rows.append(
            {
                "gateId": "assumptions_linked_resolved",
                "label": _GATE_LABELS["assumptions_linked_resolved"],
                "status": "fail",
                "failureReasonCode": "unresolved_assumption",
                "requiredAction": action,
                "sourceCommandIds": sorted(set(assumption_ids) | {m["deviationId"] for m in missing_refs}),
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )
    else:
        has_scope = bool(assumption_ids) or bool(deviation_ids)
        st = "not_applicable" if not has_scope else "pass"
        rows.append(
            {
                "gateId": "assumptions_linked_resolved",
                "label": _GATE_LABELS["assumptions_linked_resolved"],
                "status": st,
                "failureReasonCode": "no_failure",
                "requiredAction": "",
                "sourceCommandIds": assumption_ids,
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )

    dev_fail = bool(unacked_deviation_ids) or bool(viol_ids & _DEVIATION_VIOL_RULE_IDS)
    if dev_fail:
        rows.append(
            {
                "gateId": "deviations_acknowledged",
                "label": _GATE_LABELS["deviations_acknowledged"],
                "status": "fail",
                "failureReasonCode": "unacknowledged_deviation",
                "requiredAction": "Set deviation acknowledged or remove pending deviations.",
                "sourceCommandIds": unacked_deviation_ids or deviation_ids,
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )
    else:
        has_dev = bool(deviation_ids)
        rows.append(
            {
                "gateId": "deviations_acknowledged",
                "label": _GATE_LABELS["deviations_acknowledged"],
                "status": "not_applicable" if not has_dev else "pass",
                "failureReasonCode": "no_failure",
                "requiredAction": "",
                "sourceCommandIds": deviation_ids,
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )

    malformed_n = _malformed_command_count(brief_protocol)
    if not labels:
        rows.append(
            {
                "gateId": "validation_commands_present",
                "label": _GATE_LABELS["validation_commands_present"],
                "status": "fail",
                "failureReasonCode": "missing_validation_command",
                "requiredAction": "Declare backend and web validation command labels for the brief.",
                "sourceCommandIds": [],
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )
    elif malformed_n > 0:
        rows.append(
            {
                "gateId": "validation_commands_present",
                "label": _GATE_LABELS["validation_commands_present"],
                "status": "warn",
                "failureReasonCode": "protocol_command_missing_or_malformed",
                "requiredAction": "Remove malformed or untyped commands from the bundle preview.",
                "sourceCommandIds": [],
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": labels,
            }
        )
    else:
        checklist_warn = False
        if isinstance(qa_checklist, dict):
            for r in qa_checklist.get("rows") or []:
                if not isinstance(r, dict):
                    continue
                if r.get("id") == "validation_advisor_status" and r.get("status") == "fail":
                    checklist_warn = True
                    break
        st = "warn" if checklist_warn else "pass"
        code = "no_failure" if st == "pass" else "missing_validation_command"
        action = "" if st == "pass" else "Clear validation advisor errors before shipping the brief."
        rows.append(
            {
                "gateId": "validation_commands_present",
                "label": _GATE_LABELS["validation_commands_present"],
                "status": st,
                "failureReasonCode": code,
                "requiredAction": action,
                "sourceCommandIds": [],
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": labels,
            }
        )

    if brief_kind is None or (isinstance(brief_kind, str) and brief_kind.strip() == ""):
        rows.append(
            {
                "gateId": "tracker_rows_touched",
                "label": _GATE_LABELS["tracker_rows_touched"],
                "status": "fail",
                "failureReasonCode": "missing_tracker_touchpoint",
                "requiredAction": "Link the brief to a BCF topic or open issue in the model.",
                "sourceCommandIds": [],
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )
    else:
        rows.append(
            {
                "gateId": "tracker_rows_touched",
                "label": _GATE_LABELS["tracker_rows_touched"],
                "status": "pass",
                "failureReasonCode": "no_failure",
                "requiredAction": "",
                "sourceCommandIds": [],
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )

    if artifact_upload_manifest is None:
        rows.append(
            {
                "gateId": "evidence_artifacts_expected",
                "label": _GATE_LABELS["evidence_artifacts_expected"],
                "status": "not_applicable",
                "failureReasonCode": "no_failure",
                "requiredAction": "Fetch GET …/evidence-package for deterministic expectedArtifacts.",
                "sourceCommandIds": [],
                "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                "expectedEvidenceArtifacts": [],
                "validationCommandLabels": [],
            }
        )
    else:
        art_ids = _expected_artifact_ids(artifact_upload_manifest)
        if not art_ids:
            rows.append(
                {
                    "gateId": "evidence_artifacts_expected",
                    "label": _GATE_LABELS["evidence_artifacts_expected"],
                    "status": "fail",
                    "failureReasonCode": "missing_evidence_artifact_expectation",
                    "requiredAction": "Ensure artifact upload manifest lists expected artifact ids.",
                    "sourceCommandIds": [],
                    "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                    "expectedEvidenceArtifacts": [],
                    "validationCommandLabels": [],
                }
            )
        else:
            rows.append(
                {
                    "gateId": "evidence_artifacts_expected",
                    "label": _GATE_LABELS["evidence_artifacts_expected"],
                    "status": "pass",
                    "failureReasonCode": "no_failure",
                    "requiredAction": "",
                    "sourceCommandIds": [],
                    "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
                    "expectedEvidenceArtifacts": art_ids,
                    "validationCommandLabels": [],
                }
            )

    meta_ok = True
    meta_action = ""
    for r in rows:
        st = str(r.get("status") or "")
        code = str(r.get("failureReasonCode") or "")
        if st == "pass" or st == "not_applicable":
            if code != "no_failure":
                meta_ok = False
                meta_action = "Pass and not_applicable rows must use failureReasonCode=no_failure."
                break
        else:
            if code == "no_failure" or code not in ALLOWED_FAILURE_REASON_CODES:
                meta_ok = False
                meta_action = "Non-pass rows must use a bounded failureReasonCode."
                break

    rows.append(
        {
            "gateId": "failure_reason_codes",
            "label": _GATE_LABELS["failure_reason_codes"],
            "status": "pass" if meta_ok else "fail",
            "failureReasonCode": "no_failure" if meta_ok else "protocol_command_missing_or_malformed",
            "requiredAction": meta_action,
            "sourceCommandIds": [],
            "affectedWorkpackages": list(AFFECTED_WORKPACKAGES_V1),
            "expectedEvidenceArtifacts": [],
            "validationCommandLabels": [],
        }
    )

    seen = tuple(str(r["gateId"]) for r in rows)
    if seen != GATE_ORDER:
        raise RuntimeError(f"acceptance gate order drift: got {seen} expected {GATE_ORDER}")

    return {
        "format": FORMAT,
        "schemaVersion": SCHEMA_VERSION,
        "semanticDigestExclusionNote": (
            "agentBriefAcceptanceReadout_v1 is derivative; excluded from semanticDigestSha256."
        ),
        "rows": rows,
    }
