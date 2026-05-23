"""Hybrid reverse-BIM authoring slice/run executors extracted from routes/api.py (BRT-24).

Exposes:

- ``POST /api/v3/models/{model_id}/reverse-bim/hybrid-slice-execute``
- ``POST /api/v3/models/{model_id}/reverse-bim/hybrid-run-execute``

These are the live wiring that joins reverse-BIM phase packets into
the standard ``apply_bundle_route`` (CMD-V3-01) so an MCP-driven
authoring slice can dry-run, optionally commit, then return a full
readback/constructability/integrity evidence bundle in a single hop.
"""

from __future__ import annotations

import re
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.constructability_report import build_constructability_report
from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.hub import Hub
from bim_ai.integrity_preflight import build_integrity_preflight_report
from bim_ai.model_summary import compute_model_summary
from bim_ai.models.api_requests import (
    ReverseBimHybridRunExecuteRequest,
    ReverseBimHybridSliceExecuteRequest,
)
from bim_ai.query_resolve import qa_advisor, query_elements
from bim_ai.reverse_bim import (
    build_mcp_authoring_readiness,
    build_reverse_bim_phase_packet,
)
from bim_ai.reverse_bim.evidence_requirements import build_reverse_bim_evidence_requirements
from bim_ai.reverse_bim.handoff_regeneration import build_reverse_bim_handoff_regeneration_plan
from bim_ai.reverse_bim.readback import build_reverse_bim_readback_comparison
from bim_ai.reverse_bim.source_revision_ledger import build_reverse_bim_source_revision_ledger
from bim_ai.reverse_bim.source_revision_persistence import (
    persist_reverse_bim_source_revision_ledger,
)
from bim_ai.reverse_bim.visual_capture import build_reverse_bim_view_capture_plan
from bim_ai.routes.bundles import CommandBundleRequest, apply_bundle_route
from bim_ai.routes.deps import get_hub, load_model_row
from bim_ai.services.hybrid_reverse_bim import (
    build_hybrid_reverse_bim_run_report,
    build_hybrid_reverse_bim_slice_report,
    build_source_spec_revision_report,
)
from bim_ai.versioning import commit_context

hybrid_reverse_bim_execute_router = APIRouter()


@hybrid_reverse_bim_execute_router.post(
    "/v3/models/{model_id}/reverse-bim/hybrid-slice-execute"
)
async def reverse_bim_hybrid_slice_execute_route(
    model_id: UUID,
    body: ReverseBimHybridSliceExecuteRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
    token: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """Run one hybrid reverse-BIM authoring slice through the live bundle route."""

    body_dict: dict[str, Any] = body.model_dump(by_alias=True)
    phase = body_dict.get("phase") if isinstance(body_dict.get("phase"), dict) else {}
    phase_id = str(phase.get("phaseId") or phase.get("id") or body_dict.get("phaseId") or "unknown")
    source_facts = (
        body_dict.get("facts")
        or body_dict.get("sourceFacts")
        or body_dict.get("extractedFacts")
        or []
    )
    mcp_readiness = body_dict.get("mcpReadiness") or body_dict.get("mcp_readiness")
    if not isinstance(mcp_readiness, dict) and isinstance(source_facts, list):
        mcp_readiness = build_mcp_authoring_readiness(
            facts=source_facts,
            target_phase=phase_id,
        )
    if not isinstance(mcp_readiness, dict):
        mcp_readiness = {"ok": True, "summary": {"blockerCount": 0}, "rows": []}

    expected_readback = _hybrid_expected_readback(body_dict, phase)
    source_fact_ids = _hybrid_source_fact_ids(body_dict, phase, expected_readback)
    if int((mcp_readiness.get("summary") or {}).get("blockerCount") or 0) and not body_dict.get(
        "forceDryRunWithBlockers"
    ):
        slice_report = build_hybrid_reverse_bim_slice_report(
            phase={"phaseId": phase_id},
            mcp_readiness=mcp_readiness,
        )
        return {
            "ok": False,
            "format": "hybridReverseBimSliceExecution_v1",
            "modelId": str(model_id),
            "phaseId": phase_id,
            "executionState": "source_blocked",
            "mcpReadiness": mcp_readiness,
            "sliceReport": slice_report,
            "nextStep": slice_report.get("nextStep"),
        }

    bundle_payload = body_dict.get("bundle") or body_dict.get("commandBundle")
    if not isinstance(bundle_payload, dict):
        raise HTTPException(status_code=422, detail="bundle or commandBundle is required")

    user_id = str(body_dict.get("userId") or body_dict.get("user_id") or "local-dev")
    submitter = str(body_dict.get("submitter") or "agent")
    actor_kind = body_dict.get("actorKind") or body_dict.get("actor_kind") or "agent"
    client_op_id = body_dict.get("clientOpId") or body_dict.get("client_op_id")
    dry_run_request = _hybrid_bundle_request(
        bundle_payload=bundle_payload,
        mode="dry_run",
        user_id=user_id,
        submitter=submitter,
        actor_kind=actor_kind,
        client_op_id=client_op_id,
    )
    dry_run_result = await apply_bundle_route(
        model_id,
        dry_run_request,
        session=session,
        hub=hub,
        token=token,
    )
    dry_run_evidence = (
        dry_run_result.get("dryRunEvidence") if isinstance(dry_run_result, dict) else None
    )
    commit_requested = bool(body_dict.get("commit") or body_dict.get("mode") == "commit")
    commit_result: dict[str, Any] | None = None
    if (
        commit_requested
        and isinstance(dry_run_evidence, dict)
        and dry_run_evidence.get("ok") is True
    ):
        commit_request = _hybrid_bundle_request(
            bundle_payload=bundle_payload,
            mode="commit",
            user_id=user_id,
            submitter=submitter,
            actor_kind=actor_kind,
            client_op_id=client_op_id,
            dry_run_evidence=dry_run_evidence,
        )
        slice_ctx = _hybrid_slice_commit_context(
            body_dict=body_dict,
            phase=phase,
            phase_id=phase_id,
            source_fact_ids=source_fact_ids,
            user_id=user_id,
            submitter=submitter,
        )
        slice_summary = f"hybrid slice: phase={phase_id}"
        async with commit_context(
            session,
            model_id=model_id,
            summary=slice_summary,
            context=slice_ctx,
        ):
            commit_result = await apply_bundle_route(
                model_id,
                commit_request,
                session=session,
                hub=hub,
                token=token,
            )

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    changed_ids = _hybrid_changed_ids(commit_result or dry_run_result)
    query_request = {
        "filter": {"ids": changed_ids} if changed_ids else {},
        "limit": 500,
    }
    query_result = query_elements(
        str(model_id),
        doc,
        query_request,
        include=["geometrySummary", "hostRefs", "raw"],
    )
    queried_elements = (query_result.get("data") or {}).get("elements") or []
    readback_comparison = build_reverse_bim_readback_comparison(
        expected_readback=expected_readback,
        model_readback=body_dict.get("modelReadback") or body_dict.get("readback"),
        elements=queried_elements,
        tolerance_defaults=body_dict.get("toleranceDefaults")
        or body_dict.get("tolerance_defaults"),
    )
    advisor = qa_advisor(
        str(model_id),
        doc,
        {"profile": body_dict.get("advisorProfile") or "authoring_default", "limit": 500},
    )
    constructability = {
        "modelId": str(model_id),
        **build_constructability_report(
            doc.elements,
            revision=doc.revision,
            profile=str(body_dict.get("constructabilityProfile") or "authoring_default"),
            changed_element_ids=changed_ids,
            design_option_sets=doc.design_option_sets,
        ),
    }
    integrity = build_integrity_preflight_report(
        doc,
        revision=doc.revision,
        model_id=str(model_id),
        changed_element_ids=changed_ids,
    )
    source_spec_revision = build_source_spec_revision_report(
        readback_comparison=readback_comparison,
        source_overlay=body_dict.get("sourceOverlay") or body_dict.get("source_overlay"),
        advisor=advisor,
        constructability=constructability,
        integrity=integrity,
        facts=source_facts if isinstance(source_facts, list) else [],
    )
    source_revision_ledger = build_reverse_bim_source_revision_ledger(
        facts=source_facts if isinstance(source_facts, list) else [],
        source_spec_revision=source_spec_revision,
        existing_ledger=body_dict.get("sourceRevisionLedger")
        or body_dict.get("source_revision_ledger"),
        phase_authoring_spec=body_dict.get("phaseAuthoringSpec") or body_dict.get("phaseSpec"),
    )
    source_revision_ledger_persistence = None
    output_dir = body_dict.get("outputDir") or body_dict.get("output_dir")
    if output_dir:
        source_revision_ledger_persistence = persist_reverse_bim_source_revision_ledger(
            output_dir=output_dir,
            source_revision_ledger=source_revision_ledger,
            run_id=body_dict.get("runId") or body_dict.get("run_id") or phase_id,
        )
    evidence_package = {
        "modelSummary": compute_model_summary(doc),
        "queryElements": query_result,
        "readbackComparison": readback_comparison,
        "sourceSpecRevision": source_spec_revision,
        "sourceRevisionLedger": source_revision_ledger,
        "sourceRevisionLedgerPersistence": source_revision_ledger_persistence,
    }
    phase_packet = build_reverse_bim_phase_packet(
        phase_id=phase_id,
        start_revision=(
            bundle_payload.get("parentRevision") if isinstance(bundle_payload, dict) else None
        ),
        end_revision=doc.revision if commit_result else None,
        source_fact_ids=source_fact_ids,
        transactions=[
            {"mode": "dry_run", "result": dry_run_result},
            *([{"mode": "commit", "result": commit_result}] if commit_result else []),
        ],
        advisor=advisor,
        constructability=constructability,
        integrity_preflight=integrity,
        evidence_package=evidence_package,
        finding_dispositions=body_dict.get("findingDispositions") or [],
    )
    evidence_requirements = body_dict.get("evidenceRequirements") or body_dict.get(
        "evidence_requirements"
    )
    if not isinstance(evidence_requirements, dict) and (
        body_dict.get("sourcePageIndex")
        or body_dict.get("source_page_index")
        or body_dict.get("requireVisualEvidence")
        or body_dict.get("require_visual_evidence")
    ):
        evidence_requirements = build_reverse_bim_evidence_requirements(
            source_page_index=body_dict.get("sourcePageIndex")
            or body_dict.get("source_page_index"),
            source_facts=source_facts if isinstance(source_facts, list) else [],
            phase_authoring_spec=body_dict.get("phaseAuthoringSpec") or body_dict.get("phaseSpec"),
        )
    view_capture_plan = body_dict.get("viewCapturePlan") or body_dict.get("view_capture_plan")
    if not isinstance(view_capture_plan, dict) and isinstance(evidence_requirements, dict):
        required_evidence_count = int(
            (evidence_requirements.get("summary") or {}).get("requiredEvidenceCount") or 0
        )
        capture_output_dir = (
            body_dict.get("viewCaptureOutputDir")
            or body_dict.get("view_capture_output_dir")
            or body_dict.get("outputDir")
            or body_dict.get("output_dir")
        )
        if required_evidence_count and capture_output_dir:
            view_capture_plan = build_reverse_bim_view_capture_plan(
                model_id=str(model_id),
                required_ui_views=evidence_requirements.get("requiredUiViews")
                or evidence_requirements.get("required_ui_views"),
                required_overlay_views=evidence_requirements.get("requiredOverlayViews")
                or evidence_requirements.get("required_overlay_views"),
                output_dir=str(capture_output_dir),
                base_url=body_dict.get("viewCaptureBaseUrl")
                or body_dict.get("view_capture_base_url")
                or body_dict.get("baseUrl")
                or body_dict.get("base_url"),
                run_id=body_dict.get("runId") or body_dict.get("run_id") or phase_id,
                viewport=body_dict.get("captureViewport") or body_dict.get("viewport"),
            )
    source_overlay = body_dict.get("sourceOverlay") or body_dict.get("source_overlay")
    ui_evidence = body_dict.get("uiEvidence") or body_dict.get("ui_evidence")
    slice_report = build_hybrid_reverse_bim_slice_report(
        phase={"phaseId": phase_id},
        mcp_readiness=mcp_readiness,
        readback_comparison=readback_comparison,
        phase_packet=phase_packet if commit_result else None,
        source_spec_revision=source_spec_revision,
        source_overlay=source_overlay,
        ui_evidence=ui_evidence,
        evidence_requirements=evidence_requirements
        if isinstance(evidence_requirements, dict)
        else None,
        view_capture_plan=view_capture_plan if isinstance(view_capture_plan, dict) else None,
    )
    execution_state = (
        "accepted"
        if slice_report.get("ok")
        else "commit_blocked"
        if commit_requested and not commit_result
        else "committed_with_blockers"
        if commit_result
        else "dry_run_passed"
        if dry_run_evidence and dry_run_evidence.get("ok")
        else "dry_run_blocked"
    )
    return {
        "ok": bool(slice_report.get("ok")),
        "format": "hybridReverseBimSliceExecution_v1",
        "modelId": str(model_id),
        "phaseId": phase_id,
        "executionState": execution_state,
        "dryRunResult": dry_run_result,
        "commitResult": commit_result,
        "changedElementIds": changed_ids,
        "mcpReadiness": mcp_readiness,
        "readbackComparison": readback_comparison,
        "advisor": advisor,
        "constructability": constructability,
        "integrityPreflight": integrity,
        "sourceSpecRevision": source_spec_revision,
        "sourceRevisionLedger": source_revision_ledger,
        "sourceRevisionLedgerPersistence": source_revision_ledger_persistence,
        "evidenceRequirements": evidence_requirements,
        "viewCapturePlan": view_capture_plan,
        "phasePacket": phase_packet,
        "sliceReport": slice_report,
        "nextStep": slice_report.get("nextStep"),
    }


@hybrid_reverse_bim_execute_router.post(
    "/v3/models/{model_id}/reverse-bim/hybrid-run-execute"
)
async def reverse_bim_hybrid_run_execute_route(
    model_id: UUID,
    body: ReverseBimHybridRunExecuteRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    hub: Annotated[Hub, Depends(get_hub)],
    token: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """Execute an ordered list of reverse-BIM slices and stop on blockers."""

    body_dict: dict[str, Any] = body.model_dump(by_alias=True)
    slices = [row for row in body_dict.get("slices") or [] if isinstance(row, dict)]
    if not slices:
        raise HTTPException(status_code=422, detail="slices must contain at least one slice body")
    continue_on_blockers = bool(
        body_dict.get("continueOnBlockers") or body_dict.get("continue_on_blockers")
    )
    common_keys = {
        "facts",
        "sourceFacts",
        "extractedFacts",
        "phaseAuthoringSpec",
        "phaseSpec",
        "sourceRevisionLedger",
        "source_revision_ledger",
        "findingDispositions",
        "sourceOverlay",
        "source_overlay",
        "uiEvidence",
        "ui_evidence",
        "evidenceRequirements",
        "evidence_requirements",
        "sourcePageIndex",
        "source_page_index",
        "viewCapturePlan",
        "view_capture_plan",
        "viewCaptureOutputDir",
        "view_capture_output_dir",
        "viewCaptureBaseUrl",
        "view_capture_base_url",
        "captureViewport",
        "requireVisualEvidence",
        "require_visual_evidence",
        "outputDir",
        "output_dir",
        "runId",
        "run_id",
    }
    common = {key: body_dict[key] for key in common_keys if key in body_dict}
    results = []
    stopped = False
    for slice_body in slices:
        merged_body = {**common, **slice_body}
        result = await reverse_bim_hybrid_slice_execute_route(
            model_id,
            ReverseBimHybridSliceExecuteRequest.model_validate(merged_body),
            session=session,
            hub=hub,
            token=token,
        )
        results.append(result)
        if result.get("ok") is not True and not continue_on_blockers:
            stopped = True
            break

    phase_packets = [
        row.get("phasePacket") for row in results if isinstance(row.get("phasePacket"), dict)
    ]
    slice_reports = [
        row.get("sliceReport") for row in results if isinstance(row.get("sliceReport"), dict)
    ]
    run_report = build_hybrid_reverse_bim_run_report(
        phase_authoring_spec=body_dict.get("phaseAuthoringSpec")
        or body_dict.get("phaseSpec")
        or {},
        phase_packets=phase_packets,
        slice_reports=slice_reports,
        package_acceptance=body_dict.get("packageAcceptance") or body_dict.get("folderOutput"),
    )
    latest_source_revision_ledger = None
    for row in reversed(results):
        if isinstance(row.get("sourceRevisionLedger"), dict):
            latest_source_revision_ledger = row.get("sourceRevisionLedger")
            break
    handoff_regeneration = None
    if latest_source_revision_ledger:
        handoff_regeneration = build_reverse_bim_handoff_regeneration_plan(
            facts=body_dict.get("facts")
            or body_dict.get("sourceFacts")
            or body_dict.get("extractedFacts"),
            source_revision_ledger=latest_source_revision_ledger,
            phase_authoring_spec=body_dict.get("phaseAuthoringSpec") or body_dict.get("phaseSpec"),
        )
    return {
        "ok": bool(run_report.get("ok")) and not stopped,
        "format": "hybridReverseBimRunExecution_v1",
        "modelId": str(model_id),
        "summary": {
            "requestedSliceCount": len(slices),
            "executedSliceCount": len(results),
            "stoppedOnBlocker": stopped,
            "acceptedSliceCount": sum(1 for row in results if row.get("ok") is True),
        },
        "sliceExecutions": results,
        "latestSourceRevisionLedger": latest_source_revision_ledger,
        "handoffRegeneration": handoff_regeneration,
        "runReport": run_report,
        "nextStep": (
            "All requested slices executed and accepted."
            if run_report.get("ok") and not stopped
            else "Repair the first blocked slice using handoffRegeneration/readerRepairRequests when present, then rerun from that slice."
        ),
    }


def _hybrid_bundle_request(
    *,
    bundle_payload: dict[str, Any],
    mode: str,
    user_id: str,
    submitter: str,
    actor_kind: str,
    client_op_id: Any = None,
    dry_run_evidence: dict[str, Any] | None = None,
) -> Any:
    try:
        return CommandBundleRequest.model_validate(
            {
                "bundle": bundle_payload,
                "mode": mode,
                "userId": user_id,
                "submitter": submitter,
                "actorKind": actor_kind,
                "clientOpId": client_op_id,
                "dryRunEvidence": dry_run_evidence,
            }
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def _hybrid_expected_readback(
    body_dict: dict[str, Any], phase: dict[str, Any]
) -> list[dict[str, Any]]:
    direct = (
        body_dict.get("expectedReadback")
        or body_dict.get("expected_readback")
        or phase.get("expectedReadback")
        or phase.get("expected_readback")
    )
    if isinstance(direct, list):
        return [row for row in direct if isinstance(row, dict)]
    rows = []
    for action in phase.get("authoringActions") or []:
        if not isinstance(action, dict):
            continue
        expected = action.get("expectedReadback")
        if isinstance(expected, dict):
            rows.append(expected)
        elif isinstance(expected, list):
            rows.extend(row for row in expected if isinstance(row, dict))
    return rows


def _hybrid_source_fact_ids(
    body_dict: dict[str, Any],
    phase: dict[str, Any],
    expected_readback: list[dict[str, Any]],
) -> list[str]:
    ids = []
    for value in (
        body_dict.get("sourceFactIds"),
        body_dict.get("source_fact_ids"),
        phase.get("sourceFactIds"),
        phase.get("source_fact_ids"),
    ):
        if isinstance(value, list):
            ids.extend(str(item) for item in value if item)
    for row in expected_readback:
        value = row.get("sourceFactId") or row.get("factId")
        if value:
            ids.append(str(value))
    return sorted(set(ids))


_ITERATION_PATH_RE = re.compile(r"(?:^|/)iter[-_]?(\d+[a-z]?)(?:[-_/]|$)", re.IGNORECASE)
_HOUSE_PATH_RE = re.compile(r"(?:^|/)house[-_/]([a-z0-9]+)(?:[-_/]|$)", re.IGNORECASE)


def _infer_iteration_label(*candidates: Any) -> str | None:
    for value in candidates:
        if not isinstance(value, str):
            continue
        match = _ITERATION_PATH_RE.search(value)
        if match:
            return f"iter-{match.group(1).lower()}"
    return None


def _infer_house_name(*candidates: Any) -> str | None:
    for value in candidates:
        if not isinstance(value, str):
            continue
        match = _HOUSE_PATH_RE.search(value)
        if match:
            return match.group(1).lower()
    return None


def _hybrid_slice_commit_context(
    *,
    body_dict: dict[str, Any],
    phase: dict[str, Any],
    phase_id: str,
    source_fact_ids: list[str],
    user_id: str,
    submitter: str,
) -> dict[str, Any]:
    """Build the agent-context payload for a hybrid-slice commit.

    See spec/model-time-travel-tracker.md "Commit Semantics" for the
    conventional fields. Missing fields are tolerated by the inspector.
    """

    slice_id = (
        body_dict.get("sliceId")
        or body_dict.get("slice_id")
        or phase.get("sliceId")
        or phase.get("slice_id")
    )
    output_dir = body_dict.get("outputDir") or body_dict.get("output_dir")
    iteration_label = (
        body_dict.get("iterationLabel")
        or body_dict.get("iteration_label")
        or phase.get("iterationLabel")
        or phase.get("iteration_label")
        or _infer_iteration_label(output_dir)
    )
    house_name = (
        body_dict.get("houseName")
        or body_dict.get("house_name")
        or phase.get("houseName")
        or phase.get("house_name")
        or _infer_house_name(output_dir)
    )
    session_id = (
        body_dict.get("sessionId")
        or body_dict.get("session_id")
        or body_dict.get("clientOpId")
        or body_dict.get("client_op_id")
    )
    return {
        "source": "mcp_slice",
        "phaseId": phase_id,
        "sliceId": str(slice_id) if slice_id else None,
        "iterationLabel": str(iteration_label) if iteration_label else None,
        "houseName": str(house_name) if house_name else None,
        "outputDir": str(output_dir) if output_dir else None,
        "sessionId": str(session_id) if session_id else None,
        "submitter": submitter,
        "userId": user_id,
        "factIds": list(source_fact_ids),
        "methodologyVersion": "2026-05-22",
        "commandSchemaVersion": "2026-05-22",
    }


def _hybrid_changed_ids(result: dict[str, Any] | None) -> list[str]:
    if not isinstance(result, dict):
        return []
    candidates = [
        result.get("changedIds"),
        result.get("changedElementIds"),
        (result.get("transactionMetadata") or {}).get("changedIds")
        if isinstance(result.get("transactionMetadata"), dict)
        else None,
    ]
    ids = []
    for candidate in candidates:
        if isinstance(candidate, list):
            ids.extend(str(item) for item in candidate if item)
    return sorted(set(ids))
