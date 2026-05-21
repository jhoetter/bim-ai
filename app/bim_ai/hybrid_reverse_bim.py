"""Hybrid reverse-BIM orchestration reports.

These helpers are deterministic planning/evidence surfaces. They do not call an
LLM and they do not mutate BIM state. The runtime agent still performs MCP
authoring, but these reports tell it when a slice can proceed, when the model
needs repair, and when modeling evidence must reopen the source specification.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from typing import Any

from bim_ai.reverse_bim_phase_runner import build_reverse_bim_phase_run_report


SOURCE_REVISION_CLASSIFICATIONS = {
    "source_fact_misread",
    "source_fact_underconstrained",
    "coordinate_frame_wrong",
}

MODEL_REPAIR_CLASSIFICATIONS = {
    "mcp_payload_wrong",
    "model_authoring_error",
    "missing_evidence",
}


def build_source_spec_revision_report(
    *,
    findings: list[dict[str, Any]] | None = None,
    readback_comparison: dict[str, Any] | None = None,
    source_overlay: dict[str, Any] | None = None,
    advisor: dict[str, Any] | None = None,
    constructability: dict[str, Any] | None = None,
    integrity: dict[str, Any] | None = None,
    facts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Classify modeling feedback into source revision vs model repair work."""

    fact_index = {
        str(row.get("factId") or ""): row
        for row in facts or []
        if isinstance(row, dict) and row.get("factId")
    }
    evidence_rows: list[dict[str, Any]] = []
    evidence_rows.extend(_readback_findings(readback_comparison))
    evidence_rows.extend(_overlay_findings(source_overlay))
    evidence_rows.extend(_checker_findings(advisor, source="advisor"))
    evidence_rows.extend(_checker_findings(constructability, source="constructability"))
    evidence_rows.extend(_checker_findings(integrity, source="integrity_preflight"))
    evidence_rows.extend(row for row in findings or [] if isinstance(row, dict))

    actions = []
    for row in evidence_rows:
        action = _revision_action(row, fact_index=fact_index)
        actions.append(action)

    classification_counts = Counter(str(row.get("classification")) for row in actions)
    source_revision_actions = [
        row for row in actions if row.get("classification") in SOURCE_REVISION_CLASSIFICATIONS
    ]
    model_repair_actions = [
        row for row in actions if row.get("classification") in MODEL_REPAIR_CLASSIFICATIONS
    ]
    tool_gap_actions = [row for row in actions if row.get("classification") == "tool_gap"]
    existing_condition_actions = [
        row for row in actions if row.get("classification") == "existing_condition"
    ]
    payload = {
        "ok": not source_revision_actions and not tool_gap_actions,
        "format": "reverseBimSourceSpecRevisionReport_v1",
        "summary": {
            "evidenceFindingCount": len(evidence_rows),
            "actionCount": len(actions),
            "sourceRevisionActionCount": len(source_revision_actions),
            "modelRepairActionCount": len(model_repair_actions),
            "toolGapActionCount": len(tool_gap_actions),
            "existingConditionCandidateCount": len(existing_condition_actions),
            "classificationCounts": dict(sorted(classification_counts.items())),
            "reopenedSourceFactIds": sorted(
                {
                    fact_id
                    for row in source_revision_actions
                    for fact_id in row.get("sourceFactIds") or []
                }
            ),
        },
        "actions": actions,
        "nextStep": _revision_next_step(
            source_revision_actions=source_revision_actions,
            model_repair_actions=model_repair_actions,
            tool_gap_actions=tool_gap_actions,
            existing_condition_actions=existing_condition_actions,
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def build_hybrid_reverse_bim_slice_report(
    *,
    phase: dict[str, Any] | None = None,
    mcp_readiness: dict[str, Any] | None = None,
    readback_comparison: dict[str, Any] | None = None,
    phase_packet: dict[str, Any] | None = None,
    source_spec_revision: dict[str, Any] | None = None,
    source_overlay: dict[str, Any] | None = None,
    ui_evidence: dict[str, Any] | None = None,
    evidence_requirements: dict[str, Any] | None = None,
    view_capture_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the current hybrid state for one modeling slice."""

    phase = phase or {}
    blockers: list[dict[str, Any]] = []
    state = "mcp_ready"
    readiness_summary = _summary(mcp_readiness)
    if int(readiness_summary.get("blockerCount") or 0):
        state = "source_blocked"
        blockers.append(
            {
                "code": "slice_mcp_readiness_blocked",
                "message": "Source facts are not MCP-ready for this slice.",
                "summary": readiness_summary,
            }
        )

    revision_summary = _summary(source_spec_revision)
    if int(revision_summary.get("sourceRevisionActionCount") or 0):
        state = "source_revision_required"
        blockers.append(
            {
                "code": "slice_source_spec_revision_required",
                "message": "Modeling evidence contradicted or weakened source facts.",
                "summary": revision_summary,
            }
        )
    elif int(revision_summary.get("toolGapActionCount") or 0):
        state = "tool_gap_blocked"
        blockers.append(
            {
                "code": "slice_tool_gap_blocked",
                "message": "A required model/source operation has no tool contract.",
                "summary": revision_summary,
            }
        )

    readback_summary = _summary(readback_comparison)
    if readback_comparison and readback_comparison.get("ok") is not True:
        if state == "mcp_ready":
            state = "readback_blocked"
        blockers.append(
            {
                "code": "slice_readback_blocked",
                "message": "Live model readback does not match expected source-derived authoring.",
                "summary": readback_summary,
            }
        )

    if phase_packet and phase_packet.get("acceptedForNextPhase") is not True:
        if state == "mcp_ready":
            state = "qa_blocked"
        blockers.append(
            {
                "code": "slice_phase_packet_not_accepted",
                "message": "Phase packet is present but not accepted.",
                "summary": _summary(phase_packet),
            }
        )
    elif phase_packet and state == "mcp_ready":
        state = "accepted"

    for evidence_name, evidence_payload in (
        ("source_overlay", source_overlay),
        ("ui_evidence", ui_evidence),
    ):
        if evidence_payload and evidence_payload.get("ok") is not True:
            if state in {"mcp_ready", "accepted"}:
                state = "visual_blocked"
            blockers.append(
                {
                    "code": f"slice_{evidence_name}_blocked",
                    "message": f"{evidence_name} evidence is missing or failed.",
                    "summary": _summary(evidence_payload),
                }
            )

    required_overlay_count = len((evidence_requirements or {}).get("requiredOverlayViews") or [])
    required_ui_count = len((evidence_requirements or {}).get("requiredUiViews") or [])
    if required_overlay_count and not isinstance(source_overlay, dict):
        if state in {"mcp_ready", "accepted"}:
            state = "visual_blocked"
        blockers.append(
            {
                "code": "slice_source_overlay_evidence_missing",
                "message": "Source-equivalent overlay evidence is required before accepting this slice.",
                "summary": {"requiredOverlayViewCount": required_overlay_count},
            }
        )
    if required_ui_count and not isinstance(ui_evidence, dict):
        if state in {"mcp_ready", "accepted"}:
            state = "visual_blocked"
        blockers.append(
            {
                "code": "slice_ui_evidence_missing",
                "message": "Live UI screenshot evidence is required before accepting this slice.",
                "summary": {"requiredUiViewCount": required_ui_count},
            }
        )
    view_capture_summary = _summary(view_capture_plan)
    if view_capture_plan and view_capture_plan.get("ok") is not True:
        if state in {"mcp_ready", "accepted"}:
            state = "visual_blocked"
        blockers.append(
            {
                "code": "slice_view_capture_plan_blocked",
                "message": "View capture plan has blockers, so required visual evidence cannot be collected.",
                "summary": view_capture_summary,
            }
        )

    payload = {
        "ok": state == "accepted",
        "format": "hybridReverseBimSliceReport_v1",
        "phaseId": str(phase.get("phaseId") or phase.get("id") or "unknown"),
        "state": state,
        "summary": {
            "blockerCount": len(blockers),
            "hasPhasePacket": bool(phase_packet),
            "phaseAccepted": bool(phase_packet and phase_packet.get("acceptedForNextPhase") is True),
            "mcpReadinessBlockerCount": int(readiness_summary.get("blockerCount") or 0),
            "sourceRevisionActionCount": int(revision_summary.get("sourceRevisionActionCount") or 0),
            "readbackBlockedCount": int(readback_summary.get("blockedCount") or 0),
            "requiredOverlayViewCount": required_overlay_count,
            "requiredUiViewCount": required_ui_count,
            "viewCapturePlanBlockerCount": int(view_capture_summary.get("blockerCount") or 0),
        },
        "blockers": blockers,
        "nextStep": _slice_next_step(state),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def build_hybrid_reverse_bim_run_report(
    *,
    phase_authoring_spec: dict[str, Any],
    phase_packets: list[dict[str, Any]] | dict[str, Any] | None = None,
    slice_reports: list[dict[str, Any]] | None = None,
    package_acceptance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Aggregate source package, phase-run, and slice state for the runtime agent."""

    phase_run = build_reverse_bim_phase_run_report(
        phase_authoring_spec=phase_authoring_spec,
        phase_packets=phase_packets,
    )
    slices = [row for row in slice_reports or [] if isinstance(row, dict)]
    slice_state_counts = Counter(str(row.get("state") or "unknown") for row in slices)
    package_summary = _summary(package_acceptance)
    package_state = str(
        (package_acceptance or {}).get("packageState")
        or package_summary.get("packageState")
        or "unknown"
    )
    package_blocks_modeling = package_state in {
        "source_packaging_ready",
        "source_understanding_blocked",
    }
    blocking_slice_count = sum(1 for row in slices if row.get("ok") is not True)
    payload = {
        "ok": phase_run.get("ok") is True and not blocking_slice_count and not package_blocks_modeling,
        "format": "hybridReverseBimRunReport_v1",
        "summary": {
            "packageState": package_state,
            "packageBlocksModeling": package_blocks_modeling,
            "phaseRunAccepted": bool(phase_run.get("ok")),
            "sliceCount": len(slices),
            "blockingSliceCount": blocking_slice_count,
            "sliceStateCounts": dict(sorted(slice_state_counts.items())),
            "firstBlockedPhaseId": _summary(phase_run).get("firstBlockedPhaseId"),
        },
        "phaseRun": phase_run,
        "slices": slices,
        "nextStep": _run_next_step(
            package_blocks_modeling=package_blocks_modeling,
            phase_run=phase_run,
            blocking_slice_count=blocking_slice_count,
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def _revision_action(row: dict[str, Any], *, fact_index: dict[str, dict[str, Any]]) -> dict[str, Any]:
    classification = _classify_finding(row)
    source_fact_ids = _source_fact_ids(row)
    source_facts = [fact_index[fact_id] for fact_id in source_fact_ids if fact_id in fact_index]
    return {
        "findingId": row.get("findingId") or row.get("id") or row.get("ruleId") or row.get("code"),
        "source": row.get("source") or "modeling_feedback",
        "severity": row.get("severity") or "warning",
        "classification": classification,
        "sourceFactIds": source_fact_ids,
        "affectedElementIds": _affected_element_ids(row),
        "action": _action_for_classification(classification),
        "reason": _reason_for_classification(classification, row),
        "sourceFacts": source_facts,
        "rawFinding": row,
    }


def _classify_finding(row: dict[str, Any]) -> str:
    code = str(row.get("code") or row.get("ruleId") or row.get("status") or "").lower()
    source = str(row.get("source") or "").lower()
    if "tool_gap" in code or "missing_mcp_tool" in code:
        return "tool_gap"
    if "overlay" in source or "overlay" in code or "deviation" in code:
        if "coordinate" in code or "scale" in code or "origin" in code:
            return "coordinate_frame_wrong"
        return "source_fact_misread"
    if "readback_expected_element_missing" in code or "kind_mismatch" in code:
        return "mcp_payload_wrong"
    if "readback_geometry_mismatch" in code or "geometry_mismatch" in code:
        return "source_fact_misread"
    if "underconstrained" in code or "source_refinement" in code or "conflict" in code:
        return "source_fact_underconstrained"
    if str(row.get("disposition") or "") in {
        "existing_nonconforming_tolerated",
        "existing_nonconforming_source_backed",
    }:
        return "existing_condition"
    if any(token in code for token in ("host", "clash", "collision", "floating", "unhosted")):
        return "model_authoring_error"
    if "missing" in code and "evidence" in code:
        return "missing_evidence"
    return "model_authoring_error"


def _action_for_classification(classification: str) -> str:
    mapping = {
        "source_fact_misread": "reopen_source_fact_and_request_reader_repair",
        "source_fact_underconstrained": "request_focused_source_reader_pass",
        "coordinate_frame_wrong": "repair_source_coordinate_frame",
        "mcp_payload_wrong": "regenerate_mcp_payload_or_run_resolver",
        "model_authoring_error": "fix_live_model_then_rerun_qa",
        "missing_evidence": "capture_required_evidence",
        "tool_gap": "implement_or_record_missing_tool_contract",
        "existing_condition": "record_source_backed_existing_condition_tolerance",
    }
    return mapping.get(classification, "review_required")


def _reason_for_classification(classification: str, row: dict[str, Any]) -> str:
    if row.get("message"):
        return str(row["message"])
    if classification in SOURCE_REVISION_CLASSIFICATIONS:
        return "Modeling evidence indicates the source specification is wrong or incomplete."
    if classification == "existing_condition":
        return "Finding may reflect a documented existing condition rather than an authoring error."
    return "Finding must be repaired before slice acceptance."


def _readback_findings(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for row in _rows(report):
        if row.get("blocking"):
            rows.append({**row, "source": "readback_comparison"})
    return rows


def _overlay_findings(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for row in (report or {}).get("views") or []:
        if isinstance(row, dict) and row.get("blockingReasons"):
            rows.append(
                {
                    **row,
                    "source": "source_overlay",
                    "code": "source_overlay_deviation_or_missing",
                    "message": "; ".join(str(item) for item in row.get("blockingReasons") or []),
                }
            )
    return rows


def _checker_findings(report: dict[str, Any] | None, *, source: str) -> list[dict[str, Any]]:
    if not isinstance(report, dict):
        return []
    data = report.get("data") if isinstance(report.get("data"), dict) else {}
    candidates = [
        report.get("findings"),
        report.get("violations"),
        data.get("findings"),
        data.get("violations"),
    ]
    rows = []
    for candidate in candidates:
        if isinstance(candidate, list):
            rows.extend({**row, "source": source} for row in candidate if isinstance(row, dict))
            break
    return rows


def _source_fact_ids(row: dict[str, Any]) -> list[str]:
    candidates = [
        row.get("sourceFactIds"),
        row.get("sourceFacts"),
        row.get("evidenceFactIds"),
        row.get("sourceFactId"),
    ]
    actual = row.get("actual") if isinstance(row.get("actual"), dict) else {}
    candidates.extend([actual.get("sourceFactIds"), actual.get("sourceFactId")])
    ids: list[str] = []
    for candidate in candidates:
        if isinstance(candidate, list):
            ids.extend(str(item) for item in candidate if item)
        elif candidate:
            ids.append(str(candidate))
    return sorted(set(ids))


def _affected_element_ids(row: dict[str, Any]) -> list[str]:
    candidates = [row.get("elementIds"), row.get("affectedElementIds"), row.get("elementId")]
    actual = row.get("actual") if isinstance(row.get("actual"), dict) else {}
    candidates.append(actual.get("elementIds"))
    ids: list[str] = []
    for candidate in candidates:
        if isinstance(candidate, list):
            ids.extend(str(item) for item in candidate if item)
        elif candidate:
            ids.append(str(candidate))
    return sorted(set(ids))


def _rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(report, dict):
        return []
    return [row for row in report.get("rows") or [] if isinstance(row, dict)]


def _summary(report: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(report, dict):
        return {}
    summary = report.get("summary")
    return summary if isinstance(summary, dict) else {}


def _revision_next_step(
    *,
    source_revision_actions: list[dict[str, Any]],
    model_repair_actions: list[dict[str, Any]],
    tool_gap_actions: list[dict[str, Any]],
    existing_condition_actions: list[dict[str, Any]],
) -> str:
    if source_revision_actions:
        return "Reopen affected source facts, rerun focused AI-reader repair, regenerate MCP handoff rows, then rerun the slice."
    if tool_gap_actions:
        return "Implement or explicitly record missing MCP tool contracts before continuing."
    if model_repair_actions:
        return "Repair the live model or MCP payload, then rerun readback and QA."
    if existing_condition_actions:
        return "Complete source-backed existing-condition dispositions before acceptance."
    return "No source-spec revision is required."


def _slice_next_step(state: str) -> str:
    mapping = {
        "accepted": "Proceed to the next slice.",
        "source_blocked": "Repair source facts or conflict dispositions before MCP authoring.",
        "source_revision_required": "Reopen the source specification and rerun only the impacted slice.",
        "tool_gap_blocked": "Implement the missing tool contract or record an explicit gap.",
        "readback_blocked": "Repair MCP payload/model output and rerun readback.",
        "qa_blocked": "Fix or source-back every QA finding before proceeding.",
        "visual_blocked": "Capture/repair source-equivalent view evidence before proceeding.",
        "mcp_ready": "Dry-run and commit MCP actions, then gather readback and QA evidence.",
    }
    return mapping.get(state, "Review slice state.")


def _run_next_step(
    *,
    package_blocks_modeling: bool,
    phase_run: dict[str, Any],
    blocking_slice_count: int,
) -> str:
    if package_blocks_modeling:
        return "Repair global source preflight/source specification before live modeling."
    if phase_run.get("ok") is not True:
        return str(phase_run.get("nextStep") or "Repair blocked phase packets.")
    if blocking_slice_count:
        return "Repair blocked slice reports before final acceptance."
    return "Hybrid run evidence is accepted; proceed to final acceptance/export gates."


def _digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
