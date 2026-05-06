"""Deterministic QA checklist for agent command bundles — derivative, digest-excluded (WP-F01/F02/A02)."""

from __future__ import annotations

from typing import Any

ROW_ORDER = [
    "model_command_coverage",
    "validation_advisor_status",
    "plan_evidence_presence",
    "schedule_evidence_presence",
    "sheet_export_evidence_presence",
    "artifact_evidence_closure",
    "unresolved_blockers_summary",
]

ROW_LABELS: dict[str, str] = {
    "model_command_coverage": "Model command coverage",
    "validation_advisor_status": "Validation / advisor status",
    "plan_evidence_presence": "Plan evidence presence",
    "schedule_evidence_presence": "Schedule evidence presence",
    "sheet_export_evidence_presence": "Sheet / export evidence presence",
    "artifact_evidence_closure": "Artifact / evidence closure",
    "unresolved_blockers_summary": "Unresolved blockers",
}


def validate_checks_wire(violations: list[dict[str, Any]]) -> dict[str, Any]:
    """Match ``evidence_package`` validate.checks semantics from a violations list."""

    err_ct = sum(1 for x in violations if x.get("severity") == "error")
    block_ct = sum(1 for x in violations if x.get("blocking") is True)
    return {
        "violations": violations,
        "checks": {"errorViolationCount": err_ct, "blockingViolationCount": block_ct},
    }


def agent_generated_bundle_qa_checklist_v1(
    *,
    brief_protocol: dict[str, Any],
    validate: dict[str, Any] | None,
    schedule_ids: list[dict[str, Any]] | None,
    export_links: dict[str, str] | None,
    deterministic_sheet_evidence: list[dict[str, Any]] | None,
    deterministic_plan_view_evidence: list[dict[str, Any]] | None,
    evidence_diff_ingest_fix_loop: dict[str, Any] | None,
    evidence_review_performance_gate: dict[str, Any] | None,
    evidence_ref_resolution: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build ordered checklist rows from protocol + evidence signals (no LLM)."""

    rows: list[dict[str, str]] = []

    proposed = brief_protocol.get("proposedCommandCount")
    cmd_count = int(proposed) if isinstance(proposed, int) else 0
    if cmd_count > 0:
        rows.append(
            {
                "id": "model_command_coverage",
                "label": ROW_LABELS["model_command_coverage"],
                "status": "pass",
                "detail": f"proposedCommandCount={cmd_count}",
            }
        )
    else:
        rows.append(
            {
                "id": "model_command_coverage",
                "label": ROW_LABELS["model_command_coverage"],
                "status": "fail",
                "detail": "No proposed commands in preview (proposedCommandCount=0).",
            }
        )

    brief_blockers_raw = brief_protocol.get("unresolvedBlockers")
    brief_blockers: list[str] = []
    if isinstance(brief_blockers_raw, list):
        brief_blockers = sorted(str(x) for x in brief_blockers_raw if isinstance(x, str) and x)

    if validate is None:
        rows.append(
            {
                "id": "validation_advisor_status",
                "label": ROW_LABELS["validation_advisor_status"],
                "status": "unknown",
                "detail": "validate payload not provided.",
            }
        )
    else:
        checks = validate.get("checks") if isinstance(validate.get("checks"), dict) else {}
        err_n = checks.get("errorViolationCount")
        blk_n = checks.get("blockingViolationCount")
        err_ct = int(err_n) if isinstance(err_n, int) else 0
        blk_ct = int(blk_n) if isinstance(blk_n, int) else 0
        if err_ct == 0 and blk_ct == 0 and len(brief_blockers) == 0:
            rows.append(
                {
                    "id": "validation_advisor_status",
                    "label": ROW_LABELS["validation_advisor_status"],
                    "status": "pass",
                    "detail": "No blocking or error violations; no brief unresolved blockers.",
                }
            )
        else:
            parts = []
            if err_ct:
                parts.append(f"errors={err_ct}")
            if blk_ct:
                parts.append(f"blocking={blk_ct}")
            if brief_blockers:
                parts.append(f"briefBlockers={','.join(brief_blockers)}")
            rows.append(
                {
                    "id": "validation_advisor_status",
                    "label": ROW_LABELS["validation_advisor_status"],
                    "status": "fail",
                    "detail": "; ".join(parts) if parts else "validation_advisor_status failed",
                }
            )

    if deterministic_plan_view_evidence is None:
        rows.append(
            {
                "id": "plan_evidence_presence",
                "label": ROW_LABELS["plan_evidence_presence"],
                "status": "unknown",
                "detail": "Fetch evidence-package JSON for deterministic plan evidence rows.",
            }
        )
    elif len(deterministic_plan_view_evidence) > 0:
        rows.append(
            {
                "id": "plan_evidence_presence",
                "label": ROW_LABELS["plan_evidence_presence"],
                "status": "pass",
                "detail": f"deterministicPlanViewEvidence rows={len(deterministic_plan_view_evidence)}",
            }
        )
    else:
        rows.append(
            {
                "id": "plan_evidence_presence",
                "label": ROW_LABELS["plan_evidence_presence"],
                "status": "fail",
                "detail": "No deterministic plan view evidence rows.",
            }
        )

    if schedule_ids is None:
        rows.append(
            {
                "id": "schedule_evidence_presence",
                "label": ROW_LABELS["schedule_evidence_presence"],
                "status": "unknown",
                "detail": "scheduleIds not provided.",
            }
        )
    elif len(schedule_ids) > 0:
        rows.append(
            {
                "id": "schedule_evidence_presence",
                "label": ROW_LABELS["schedule_evidence_presence"],
                "status": "pass",
                "detail": f"scheduleIds count={len(schedule_ids)}",
            }
        )
    else:
        rows.append(
            {
                "id": "schedule_evidence_presence",
                "label": ROW_LABELS["schedule_evidence_presence"],
                "status": "fail",
                "detail": "No schedules in model (scheduleIds empty).",
            }
        )

    if deterministic_sheet_evidence is None or export_links is None:
        rows.append(
            {
                "id": "sheet_export_evidence_presence",
                "label": ROW_LABELS["sheet_export_evidence_presence"],
                "status": "unknown",
                "detail": "Fetch evidence-package JSON for deterministic sheet evidence and export link map.",
            }
        )
    elif len(deterministic_sheet_evidence) > 0 and len(export_links) > 0:
        rows.append(
            {
                "id": "sheet_export_evidence_presence",
                "label": ROW_LABELS["sheet_export_evidence_presence"],
                "status": "pass",
                "detail": (
                    f"sheetEvidence rows={len(deterministic_sheet_evidence)}; "
                    f"exportLinks keys={len(export_links)}"
                ),
            }
        )
    else:
        miss: list[str] = []
        if len(deterministic_sheet_evidence) == 0:
            miss.append("no sheet evidence rows")
        if len(export_links) == 0:
            miss.append("export link map empty")
        rows.append(
            {
                "id": "sheet_export_evidence_presence",
                "label": ROW_LABELS["sheet_export_evidence_presence"],
                "status": "fail",
                "detail": "; ".join(miss),
            }
        )

    if evidence_diff_ingest_fix_loop is None and evidence_review_performance_gate is None:
        rows.append(
            {
                "id": "artifact_evidence_closure",
                "label": ROW_LABELS["artifact_evidence_closure"],
                "status": "unknown",
                "detail": "Fetch evidence-package JSON for fix-loop and performance gate.",
            }
        )
    else:
        gate_closed: bool | None = None
        fl_codes: list[str] = []
        if isinstance(evidence_review_performance_gate, dict):
            gate_closed = evidence_review_performance_gate.get("gateClosed") is True
        if isinstance(evidence_diff_ingest_fix_loop, dict):
            raw_codes = evidence_diff_ingest_fix_loop.get("blockerCodes")
            if isinstance(raw_codes, list):
                fl_codes = sorted(str(x) for x in raw_codes if isinstance(x, str))
            if gate_closed is None:
                gate_closed = evidence_diff_ingest_fix_loop.get("needsFixLoop") is not True

        if gate_closed is True:
            rows.append(
                {
                    "id": "artifact_evidence_closure",
                    "label": ROW_LABELS["artifact_evidence_closure"],
                    "status": "pass",
                    "detail": "Performance gate closed (no fix-loop blockers).",
                }
            )
        else:
            codes_s = ",".join(fl_codes) if fl_codes else "closure_not_met"
            rows.append(
                {
                    "id": "artifact_evidence_closure",
                    "label": ROW_LABELS["artifact_evidence_closure"],
                    "status": "fail",
                    "detail": f"fixLoop blockers: {codes_s}",
                }
            )

    fix_codes: list[str] = []
    if isinstance(evidence_diff_ingest_fix_loop, dict):
        raw_fc = evidence_diff_ingest_fix_loop.get("blockerCodes")
        if isinstance(raw_fc, list):
            fix_codes = [str(x) for x in raw_fc if isinstance(x, str)]

    union_set: set[str] = set(brief_blockers) | set(fix_codes)
    if (
        isinstance(evidence_ref_resolution, dict)
        and evidence_ref_resolution.get("hasUnresolvedEvidenceRefs") is True
    ):
        union_set.add("evidence_refs_unresolved")

    if len(union_set) == 0:
        rows.append(
            {
                "id": "unresolved_blockers_summary",
                "label": ROW_LABELS["unresolved_blockers_summary"],
                "status": "pass",
                "detail": "No aggregated blockers.",
            }
        )
    else:
        rows.append(
            {
                "id": "unresolved_blockers_summary",
                "label": ROW_LABELS["unresolved_blockers_summary"],
                "status": "fail",
                "detail": f"blockers={','.join(sorted(union_set))}",
            }
        )

    seen = [r["id"] for r in rows]
    if seen != ROW_ORDER:
        raise RuntimeError(f"checklist row order drift: got {seen} expected {ROW_ORDER}")

    return {
        "format": "agentGeneratedBundleQaChecklist_v1",
        "schemaVersion": 1,
        "semanticDigestExclusionNote": (
            "agentGeneratedBundleQaChecklist_v1 is derivative; excluded from semanticDigestSha256."
        ),
        "rows": rows,
    }
