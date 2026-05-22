"""Reverse-BIM and source ingestion routes extracted from routes_api.

Routes mounted here cover the source ingestion pipeline (``/api/v3/source/*``)
and the reverse-BIM authoring pipeline (``/api/v3/reverse-bim/*``) plus a few
shared QA endpoints (``/api/v3/qa/*``) that share the same payload contracts.

The hybrid-slice-execute and hybrid-run-execute routes remain in
``routes_api.py`` for now because they depend on the bundle apply route. They
will move once the bundle apply path is split into its own module.

Per BRT-01 in ``spec/trackers/backend-rework-tracker.md``, every handler binds a
Pydantic model from ``bim_ai.models.reverse_bim_requests`` rather than an
untyped ``dict[str, Any]``. Validation that used to raise
``HTTPException(422, ...)`` after a ``body.get(...) is None`` check is
preserved verbatim — the models use ``Optional`` defaults so the legacy
error envelopes stay byte-equal.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from bim_ai.evidence.reverse_bim_acceptance_evidence import (
    build_level_completeness_report,
    build_physical_topology_report,
    build_source_overlay_evidence_report,
    build_ui_evidence_report,
)
from bim_ai.final_acceptance import build_final_acceptance_report
from bim_ai.folder_output import build_reverse_bim_folder_output
from bim_ai.hybrid_reverse_bim import (
    build_hybrid_reverse_bim_run_report,
    build_hybrid_reverse_bim_slice_report,
    build_source_spec_revision_report,
)
from bim_ai.models.reverse_bim_requests import (
    ReverseBimCoordinateFrameAlignmentRequest,
    ReverseBimCoordinateFrameWorklistRequest,
    ReverseBimDocumentAuthorityRequest,
    ReverseBimEvidenceRequirementsRequest,
    ReverseBimFinalAcceptanceRequest,
    ReverseBimFolderOutputRequest,
    ReverseBimHandoffRegenerationRequest,
    ReverseBimHybridRunRequest,
    ReverseBimHybridSliceRequest,
    ReverseBimIrSeedRequest,
    ReverseBimIrValidateRequest,
    ReverseBimLevelCompletenessRequest,
    ReverseBimMcpReadinessRequest,
    ReverseBimPhasePacketRequest,
    ReverseBimPhaseRunRequest,
    ReverseBimPhysicalTopologyRequest,
    ReverseBimPlanAuthoringRequest,
    ReverseBimReadbackCompareRequest,
    ReverseBimReaderDispatchExecuteRequest,
    ReverseBimReaderDispatchPlanRequest,
    ReverseBimSourceBuildingScopeRequest,
    ReverseBimSourceCoverageRequest,
    ReverseBimSourceLevelCompletenessRequest,
    ReverseBimSourceMaterialAssembliesRequest,
    ReverseBimSourceOverlayEvidenceRequest,
    ReverseBimSourceRevisionLedgerPersistRequest,
    ReverseBimSourceRevisionLedgerRequest,
    ReverseBimSourceSpecRevisionRequest,
    ReverseBimUiEvidenceRequest,
    ReverseBimViewBundleRequest,
    ReverseBimViewCaptureExecuteRequest,
    ReverseBimViewCapturePlanRequest,
    ReverseBimVisualReviewNormalizeRequest,
    ReverseBimVisualReviewRequestsRequest,
    SourceAiReadingPacketRequest,
    SourceAiVisualTraceAgentLoopRequest,
    SourceAiVisualTraceAgentRequestsRequest,
    SourceAiVisualTracePacketRequest,
    SourceAiVisualTraceReaderPassManifestRequest,
    SourceAiVisualTraceWorkOrderRequest,
    SourceClassifyDocumentsRequest,
    SourceClassifyPagesDispatchPlanRequest,
    SourceClassifyPagesNormalizeRequest,
    SourceDetectScaleRequest,
    SourceExtractFactsRequest,
    SourceFolderManifestRequest,
    SourceNormalizeAiVisualTraceReaderResponsesRequest,
    SourcePdfTextRequest,
    SourcePrepareAiVisualTraceRunRequest,
    SourceReaderConsensusRequest,
    SourceRenderPdfRequest,
    SourceRerenderForLegibilityRequest,
    SourceValidateAiFactsRequest,
    SourceValidateAiVisualTraceCompletenessRequest,
)
from bim_ai.models.reverse_bim_responses import (
    OperationResponse,
    ReverseBimViewBundleResponse,
)
from bim_ai.reverse_bim import (
    build_existing_building_ir_seed,
    build_mcp_authoring_readiness,
    build_reverse_bim_phase_packet,
    build_source_coverage_matrix,
    plan_mcp_authoring_actions,
    validate_existing_building_ir,
)
from bim_ai.reverse_bim_document_authority import (
    build_reverse_bim_document_authority_report,
)
from bim_ai.reverse_bim_evidence_requirements import (
    build_reverse_bim_evidence_requirements,
)
from bim_ai.reverse_bim_handoff_regeneration import (
    build_reverse_bim_handoff_regeneration_plan,
)
from bim_ai.reverse_bim_phase_runner import build_reverse_bim_phase_run_report
from bim_ai.reverse_bim_readback import build_reverse_bim_readback_comparison
from bim_ai.reverse_bim_reader_dispatch import (
    build_reverse_bim_reader_dispatch_plan,
    execute_reverse_bim_reader_dispatch,
)
from bim_ai.reverse_bim_source_revision_ledger import (
    build_reverse_bim_source_revision_ledger,
)
from bim_ai.reverse_bim_source_revision_persistence import (
    persist_reverse_bim_source_revision_ledger,
)
from bim_ai.reverse_bim_visual_capture import build_reverse_bim_view_capture_plan
from bim_ai.reverse_bim_visual_review import (
    build_reverse_bim_visual_review_requests,
    normalize_reverse_bim_visual_review_responses,
)
from bim_ai.semantic_authoring import (
    UnsupportedSemanticOperationError,
    build_semantic_authoring_bundle,
)
from bim_ai.source_agent_loop import (
    build_ai_visual_trace_agent_requests,
    build_ai_visual_trace_reader_pass_manifest,
    normalize_ai_visual_trace_reader_responses,
    prepare_ai_visual_trace_run_from_folder,
    run_ai_visual_trace_agent_loop,
)
from bim_ai.source_building_scope import build_source_building_scope_report
from bim_ai.source_coordinate_frames import (
    apply_coordinate_frame_alignments,
    build_coordinate_frame_alignment_worklist,
)
from bim_ai.source_ingestion import (
    build_ai_reading_packet,
    build_ai_visual_trace_packet,
    build_ai_visual_trace_work_order,
    build_folder_manifest,
    classify_documents,
    detect_scale_from_text,
    extract_pdf_text,
    extract_source_facts,
    render_pdf_pages,
    rerender_for_legibility,
    validate_ai_source_facts,
    validate_ai_visual_trace_completeness,
)
from bim_ai.source_level_completeness import build_source_level_completeness_report
from bim_ai.source_material_assemblies import build_source_material_assembly_report
from bim_ai.source_page_classification import (
    apply_page_classifications,
    build_page_classification_dispatch_plan,
    load_page_classification_responses,
)
from bim_ai.source_reader_consensus import build_source_reader_consensus_report

reverse_bim_router = APIRouter()


def _source_response(payload: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    if payload.get("ok") is not False:
        return payload
    return JSONResponse(status_code=int(payload.pop("status", 400)), content=payload)


# ---------------------------------------------------------------------------
# Source ingestion pipeline
# ---------------------------------------------------------------------------


@reverse_bim_router.post("/v3/source/folder-manifest", response_model=OperationResponse)
async def source_folder_manifest_route(body: SourceFolderManifestRequest) -> Any:
    root_path = body.root_path or body.path
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    return _source_response(build_folder_manifest(str(root_path)))


@reverse_bim_router.post("/v3/source/classify-documents", response_model=OperationResponse)
async def source_classify_documents_route(
    body: SourceClassifyDocumentsRequest,
) -> dict[str, Any]:
    manifest = body.manifest or body.files or body.model_dump(by_alias=True)
    return classify_documents(manifest)


def _reverse_bim_view_bundle(operation: str, body: ReverseBimViewBundleRequest) -> dict[str, Any]:
    payload = body.model_dump(by_alias=True)
    try:
        bundle = build_semantic_authoring_bundle(operation, payload)
    except UnsupportedSemanticOperationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "unsupported_semantic_operation",
                "operation": exc.operation,
                "message": exc.reason,
            },
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_semantic_payload", "message": str(exc)},
        ) from exc
    return bundle.model_dump(by_alias=True)


@reverse_bim_router.post(
    "/v3/reverse-bim/exterior-view-create", response_model=ReverseBimViewBundleResponse
)
async def reverse_bim_exterior_view_create_route(
    body: ReverseBimViewBundleRequest,
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_exterior_view", body)


@reverse_bim_router.post(
    "/v3/reverse-bim/detail-view-create", response_model=ReverseBimViewBundleResponse
)
async def reverse_bim_detail_view_create_route(
    body: ReverseBimViewBundleRequest,
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_detail_view", body)


@reverse_bim_router.post(
    "/v3/reverse-bim/section-view-create", response_model=ReverseBimViewBundleResponse
)
async def reverse_bim_section_view_create_route(
    body: ReverseBimViewBundleRequest,
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_section_view", body)


@reverse_bim_router.post(
    "/v3/reverse-bim/source-view-evidence-upsert", response_model=ReverseBimViewBundleResponse
)
async def reverse_bim_source_view_evidence_upsert_route(
    body: ReverseBimViewBundleRequest,
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_source_view_evidence", body)


@reverse_bim_router.post("/v3/source/rerender-for-legibility", response_model=OperationResponse)
async def source_rerender_for_legibility_route(
    body: SourceRerenderForLegibilityRequest,
) -> dict[str, Any]:
    output_dir = body.output_dir
    targets = body.targets
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(targets, list) or not targets:
        raise HTTPException(
            status_code=422,
            detail="targets must be a non-empty list of {sourceDocumentId, pages?, page?}",
        )
    return _source_response(
        rerender_for_legibility(
            output_dir=str(output_dir),
            targets=targets,
            dpi=int(body.dpi or 300),
        )
    )


@reverse_bim_router.post(
    "/v3/source/classify-pages/dispatch-plan", response_model=OperationResponse
)
async def source_classify_pages_dispatch_plan_route(
    body: SourceClassifyPagesDispatchPlanRequest,
) -> dict[str, Any]:
    packet = body.ai_visual_trace_packet or body.packet or {}
    output_dir = body.output_dir
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(packet, dict) or not packet.get("documents"):
        raise HTTPException(
            status_code=422,
            detail="aiVisualTracePacket with documents is required",
        )
    write_assignments_raw = body.write_assignments
    if write_assignments_raw is None:
        write_assignments = True
    else:
        write_assignments = bool(write_assignments_raw)
    return build_page_classification_dispatch_plan(
        visual_packet=packet,
        output_dir=str(output_dir),
        mode=str(body.mode or "auto"),
        write_assignments=write_assignments,
    )


@reverse_bim_router.post("/v3/source/classify-pages/normalize", response_model=OperationResponse)
async def source_classify_pages_normalize_route(
    body: SourceClassifyPagesNormalizeRequest,
) -> dict[str, Any]:
    output_dir = body.output_dir
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    normalized = load_page_classification_responses(str(output_dir))
    packet = body.ai_visual_trace_packet or body.packet
    if isinstance(packet, dict) and packet.get("documents"):
        application = apply_page_classifications(
            packet,
            responses=normalized.get("responses") or [],
        )
        normalized["application"] = application
        normalized["aiVisualTracePacket"] = packet
    return normalized


@reverse_bim_router.post("/v3/source/pdf-text", response_model=OperationResponse)
async def source_pdf_text_route(body: SourcePdfTextRequest) -> Any:
    source_path = body.source_path or body.path
    if not source_path:
        raise HTTPException(status_code=422, detail="sourcePath is required")
    return _source_response(extract_pdf_text(str(source_path), max_pages=body.max_pages))


@reverse_bim_router.post("/v3/source/render-pdf", response_model=OperationResponse)
async def source_render_pdf_route(body: SourceRenderPdfRequest) -> Any:
    source_path = body.source_path or body.path
    output_dir = body.output_dir or "tmp/pdfs/source-render"
    if not source_path:
        raise HTTPException(status_code=422, detail="sourcePath is required")
    return _source_response(
        render_pdf_pages(
            str(source_path),
            output_dir=str(output_dir),
            dpi=int(body.dpi or 240),
            first_page=body.first_page,
            last_page=body.last_page,
        )
    )


@reverse_bim_router.post("/v3/source/detect-scale", response_model=OperationResponse)
async def source_detect_scale_route(
    body: SourceDetectScaleRequest,
) -> dict[str, Any]:
    return detect_scale_from_text(
        str(body.text or ""),
        source_document_id=body.source_document_id,
    )


@reverse_bim_router.post("/v3/source/ai-reading-packet", response_model=OperationResponse)
async def source_ai_reading_packet_route(
    body: SourceAiReadingPacketRequest,
) -> dict[str, Any]:
    return build_ai_reading_packet(
        manifest=body.manifest or {},
        classifications=body.classifications,
        rendered_pages=body.rendered_pages or [],
        text_extractions=body.text_extractions or [],
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-packet", response_model=OperationResponse)
async def source_ai_visual_trace_packet_route(
    body: SourceAiVisualTracePacketRequest,
) -> dict[str, Any]:
    return build_ai_visual_trace_packet(
        manifest=body.manifest or {},
        classifications=body.classifications,
        rendered_pages=body.rendered_pages or [],
        text_extractions=body.text_extractions or [],
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-work-order", response_model=OperationResponse)
async def source_ai_visual_trace_work_order_route(
    body: SourceAiVisualTraceWorkOrderRequest,
) -> dict[str, Any]:
    packet = body.ai_visual_trace_packet or body.packet or body.model_dump(by_alias=True)
    return build_ai_visual_trace_work_order(
        ai_visual_trace_packet=packet,
        project_goal=body.project_goal,
    )


@reverse_bim_router.post(
    "/v3/source/ai-visual-trace-agent-requests", response_model=OperationResponse
)
async def source_ai_visual_trace_agent_requests_route(
    body: SourceAiVisualTraceAgentRequestsRequest,
) -> dict[str, Any]:
    work_order = (
        body.work_order or body.ai_visual_trace_work_order or body.model_dump(by_alias=True)
    )
    return build_ai_visual_trace_agent_requests(
        work_order=work_order,
        run_id=body.run_id,
        max_native_text_chars=int(body.max_native_text_chars or 0),
    )


@reverse_bim_router.post(
    "/v3/source/ai-visual-trace-reader-pass-manifest", response_model=OperationResponse
)
async def source_ai_visual_trace_reader_pass_manifest_route(
    body: SourceAiVisualTraceReaderPassManifestRequest,
) -> dict[str, Any]:
    agent_requests = (
        body.agent_requests or body.ai_visual_trace_agent_requests or body.requests or {}
    )
    work_order = body.work_order or body.ai_visual_trace_work_order or {}
    return build_ai_visual_trace_reader_pass_manifest(
        agent_requests=agent_requests,
        work_order=work_order,
        responses=body.responses or body.reader_responses,
        min_independent_readers_for_critical_facts=int(
            body.min_independent_readers_for_critical_facts or 2
        ),
    )


@reverse_bim_router.post("/v3/source/prepare-ai-visual-trace-run", response_model=OperationResponse)
async def source_prepare_ai_visual_trace_run_route(
    body: SourcePrepareAiVisualTraceRunRequest,
) -> Any:
    root_path = body.root_path or body.path
    output_dir = body.output_dir
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return _source_response(
        prepare_ai_visual_trace_run_from_folder(
            root_path=str(root_path),
            output_dir=str(output_dir),
            run_id=body.run_id,
            dpi=int(body.dpi or 240),
            max_pages_per_pdf=body.max_pages_per_pdf,
        )
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-agent-loop", response_model=OperationResponse)
async def source_ai_visual_trace_agent_loop_route(
    body: SourceAiVisualTraceAgentLoopRequest,
) -> dict[str, Any]:
    work_order = body.work_order or body.ai_visual_trace_work_order or {}
    return run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=body.responses or body.reader_responses,
        run_id=body.run_id,
        reader_command=body.reader_command,
        reader_timeout_seconds=int(body.reader_timeout_seconds or 300),
    )


@reverse_bim_router.post(
    "/v3/source/normalize-ai-visual-trace-reader-responses", response_model=OperationResponse
)
async def source_normalize_ai_visual_trace_reader_responses_route(
    body: SourceNormalizeAiVisualTraceReaderResponsesRequest,
) -> dict[str, Any]:
    return normalize_ai_visual_trace_reader_responses(
        body.responses or body.reader_responses or body.model_dump(by_alias=True)
    )


@reverse_bim_router.post("/v3/source/reader-consensus", response_model=OperationResponse)
async def source_reader_consensus_route(
    body: SourceReaderConsensusRequest,
) -> dict[str, Any]:
    return build_source_reader_consensus_report(
        body.responses or body.reader_responses or body.model_dump(by_alias=True),
        min_independent_readers=int(body.min_independent_readers or 2),
        consensus_dispositions=body.reader_consensus_dispositions or body.consensus_dispositions,
    )


@reverse_bim_router.post("/v3/source/validate-ai-facts", response_model=OperationResponse)
async def source_validate_ai_facts_route(
    body: SourceValidateAiFactsRequest,
) -> dict[str, Any]:
    return validate_ai_source_facts(body.facts or [])


@reverse_bim_router.post(
    "/v3/source/validate-ai-visual-trace-completeness", response_model=OperationResponse
)
async def source_validate_ai_visual_trace_completeness_route(
    body: SourceValidateAiVisualTraceCompletenessRequest,
) -> dict[str, Any]:
    return validate_ai_visual_trace_completeness(
        body.facts or [],
        required_kinds=body.required_kinds or body.required_fact_kinds,
    )


@reverse_bim_router.post("/v3/source/extract-facts", response_model=OperationResponse)
async def source_extract_facts_route(
    body: SourceExtractFactsRequest,
) -> dict[str, Any]:
    return extract_source_facts(
        body.classifications or body.model_dump(by_alias=True),
        text_extractions=body.text_extractions or [],
    )


# ---------------------------------------------------------------------------
# Reverse-BIM pipeline
# ---------------------------------------------------------------------------


@reverse_bim_router.post("/v3/reverse-bim/ir/seed", response_model=OperationResponse)
async def reverse_bim_ir_seed_route(
    body: ReverseBimIrSeedRequest,
) -> dict[str, Any]:
    return build_existing_building_ir_seed(
        source_manifest=body.source_manifest or {},
        source_facts=body.source_facts,
        classifications=body.classifications,
    )


@reverse_bim_router.post("/v3/reverse-bim/ir/validate")
async def reverse_bim_ir_validate_route(
    body: ReverseBimIrValidateRequest,
) -> dict[str, Any]:
    return validate_existing_building_ir(body.ir or body.model_dump(by_alias=True))


@reverse_bim_router.post("/v3/reverse-bim/source-coverage")
async def reverse_bim_source_coverage_route(
    body: ReverseBimSourceCoverageRequest,
) -> dict[str, Any]:
    facts = body.facts or body.extracted_facts or []
    return build_source_coverage_matrix(
        facts=facts,
        fact_to_element_refs=body.fact_to_element_refs or {},
    )


@reverse_bim_router.post("/v3/reverse-bim/plan-authoring")
async def reverse_bim_plan_authoring_route(
    body: ReverseBimPlanAuthoringRequest,
) -> dict[str, Any]:
    return plan_mcp_authoring_actions(
        facts=body.facts or body.extracted_facts or [],
        target_phase=body.phase,
    )


@reverse_bim_router.post("/v3/reverse-bim/mcp-readiness")
async def reverse_bim_mcp_readiness_route(
    body: ReverseBimMcpReadinessRequest,
) -> dict[str, Any]:
    return build_mcp_authoring_readiness(
        facts=body.facts or body.extracted_facts or [],
        target_phase=body.phase,
    )


@reverse_bim_router.post("/v3/reverse-bim/source-material-assemblies")
async def reverse_bim_source_material_assemblies_route(
    body: ReverseBimSourceMaterialAssembliesRequest,
) -> dict[str, Any]:
    return build_source_material_assembly_report(
        body.facts or body.source_facts or body.extracted_facts or []
    )


@reverse_bim_router.post("/v3/reverse-bim/source-building-scope")
async def reverse_bim_source_building_scope_route(
    body: ReverseBimSourceBuildingScopeRequest,
) -> dict[str, Any]:
    return build_source_building_scope_report(
        body.facts or body.source_facts or body.extracted_facts or [],
        scope_decisions=body.building_scope_decisions
        or body.scope_decisions
        or body.target_scope_decisions,
    )


@reverse_bim_router.post("/v3/reverse-bim/source-level-completeness")
async def reverse_bim_source_level_completeness_route(
    body: ReverseBimSourceLevelCompletenessRequest,
) -> dict[str, Any]:
    return build_source_level_completeness_report(
        body.facts or body.source_facts or body.extracted_facts or []
    )


@reverse_bim_router.post("/v3/reverse-bim/coordinate-frame-worklist")
async def reverse_bim_coordinate_frame_worklist_route(
    body: ReverseBimCoordinateFrameWorklistRequest,
) -> dict[str, Any]:
    coordinate_frames = body.coordinate_frames or body.frames or {}
    return build_coordinate_frame_alignment_worklist(
        coordinate_frames,
        facts=body.facts or body.source_facts or body.extracted_facts,
    )


@reverse_bim_router.post("/v3/reverse-bim/coordinate-frame-alignment")
async def reverse_bim_coordinate_frame_alignment_route(
    body: ReverseBimCoordinateFrameAlignmentRequest,
) -> dict[str, Any]:
    coordinate_frames = body.coordinate_frames or body.frames or {}
    return apply_coordinate_frame_alignments(
        coordinate_frames,
        body.alignments or body.coordinate_frame_alignments,
        facts=body.facts or body.source_facts or body.extracted_facts,
    )


@reverse_bim_router.post("/v3/reverse-bim/document-authority")
async def reverse_bim_document_authority_route(
    body: ReverseBimDocumentAuthorityRequest,
) -> dict[str, Any]:
    return build_reverse_bim_document_authority_report(
        manifest=body.manifest or body.source_manifest or body.files,
        classifications=body.classifications or body.documents,
        facts=body.facts or body.source_facts or body.extracted_facts,
        authority_hints=body.authority_hints or body.document_authority_hints,
    )


@reverse_bim_router.post("/v3/reverse-bim/folder-output")
async def reverse_bim_folder_output_route(
    body: ReverseBimFolderOutputRequest,
) -> Any:
    root_path = body.root_path or body.source_folder or body.path
    output_dir = body.output_dir
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return build_reverse_bim_folder_output(
        root_path=str(root_path),
        output_dir=str(output_dir),
        reader_responses=body.reader_responses or body.responses,
        reader_command=body.reader_command,
        reader_timeout_seconds=int(body.reader_timeout_seconds or 300),
        reader_consensus_dispositions=body.reader_consensus_dispositions
        or body.consensus_dispositions,
        building_scope_decisions=body.building_scope_decisions
        or body.scope_decisions
        or body.target_scope_decisions,
        conflict_decisions=body.conflict_decisions or body.source_conflict_decisions,
        coordinate_frame_alignments=body.coordinate_frame_alignments
        or body.coordinate_frame_decisions,
        site_terrain_decisions=body.site_terrain_decisions or body.site_topology_decisions,
        run_id=body.run_id,
        dpi=int(body.dpi or 240),
        max_pages_per_pdf=body.max_pages_per_pdf,
        reset_output=bool(body.reset_output or False),
    )


@reverse_bim_router.post("/v3/reverse-bim/reader-dispatch-plan")
async def reverse_bim_reader_dispatch_plan_route(
    body: ReverseBimReaderDispatchPlanRequest,
) -> dict[str, Any]:
    output_dir = body.output_dir
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return build_reverse_bim_reader_dispatch_plan(
        output_dir=str(output_dir),
        include_completed=bool(body.include_completed or False),
        limit=body.limit,
    )


@reverse_bim_router.post("/v3/reverse-bim/reader-dispatch-execute")
async def reverse_bim_reader_dispatch_execute_route(
    body: ReverseBimReaderDispatchExecuteRequest,
) -> dict[str, Any]:
    output_dir = body.output_dir
    reader_command = body.reader_command
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(reader_command, list) or not reader_command:
        raise HTTPException(status_code=422, detail="readerCommand must be a non-empty list")
    return execute_reverse_bim_reader_dispatch(
        output_dir=str(output_dir),
        reader_command=[str(item) for item in reader_command],
        include_completed=bool(body.include_completed or False),
        force=bool(body.force or False),
        limit=body.limit,
        timeout_seconds=int(body.reader_timeout_seconds or 300),
    )


@reverse_bim_router.post("/v3/reverse-bim/phase-packet")
async def reverse_bim_phase_packet_route(
    body: ReverseBimPhasePacketRequest,
) -> dict[str, Any]:
    return build_reverse_bim_phase_packet(
        phase_id=str(body.phase_id or "unknown"),
        start_revision=body.start_revision,
        end_revision=body.end_revision,
        source_fact_ids=body.source_fact_ids or [],
        transactions=body.transactions or [],
        advisor=body.advisor,
        constructability=body.constructability,
        integrity_preflight=body.integrity_preflight,
        evidence_package=body.evidence_package,
        finding_dispositions=body.finding_dispositions or [],
    )


@reverse_bim_router.post("/v3/reverse-bim/phase-run")
async def reverse_bim_phase_run_route(
    body: ReverseBimPhaseRunRequest,
) -> dict[str, Any]:
    return build_reverse_bim_phase_run_report(
        phase_authoring_spec=body.phase_authoring_spec
        or body.phase_spec
        or body.model_dump(by_alias=True),
        phase_packets=body.phase_packets or body.packets,
    )


@reverse_bim_router.post("/v3/reverse-bim/readback-compare")
async def reverse_bim_readback_compare_route(
    body: ReverseBimReadbackCompareRequest,
) -> dict[str, Any]:
    return build_reverse_bim_readback_comparison(
        expected_readback=body.expected_readback or body.expectations or [],
        model_readback=body.model_readback or body.readback or body.readback_evidence,
        elements=body.elements or body.query_elements,
        tolerance_defaults=body.tolerance_defaults,
    )


@reverse_bim_router.post("/v3/reverse-bim/source-spec-revision")
async def reverse_bim_source_spec_revision_route(
    body: ReverseBimSourceSpecRevisionRequest,
) -> dict[str, Any]:
    return build_source_spec_revision_report(
        findings=body.findings,
        readback_comparison=body.readback_comparison,
        source_overlay=body.source_overlay,
        advisor=body.advisor,
        constructability=body.constructability,
        integrity=body.integrity or body.integrity_preflight,
        facts=body.facts or body.source_facts or body.extracted_facts,
    )


@reverse_bim_router.post("/v3/reverse-bim/source-revision-ledger")
async def reverse_bim_source_revision_ledger_route(
    body: ReverseBimSourceRevisionLedgerRequest,
) -> dict[str, Any]:
    return build_reverse_bim_source_revision_ledger(
        facts=body.facts or body.source_facts or body.extracted_facts,
        source_spec_revision=body.source_spec_revision,
        existing_ledger=body.existing_ledger,
        phase_authoring_spec=body.phase_authoring_spec or body.phase_spec,
    )


@reverse_bim_router.post("/v3/reverse-bim/source-revision-ledger-persist")
async def reverse_bim_source_revision_ledger_persist_route(
    body: ReverseBimSourceRevisionLedgerPersistRequest,
) -> dict[str, Any]:
    output_dir = body.output_dir
    source_revision_ledger = body.source_revision_ledger or body.ledger
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(source_revision_ledger, dict):
        raise HTTPException(status_code=422, detail="sourceRevisionLedger is required")
    return persist_reverse_bim_source_revision_ledger(
        output_dir=output_dir,
        source_revision_ledger=source_revision_ledger,
        run_id=body.run_id,
    )


@reverse_bim_router.post("/v3/reverse-bim/handoff-regeneration")
async def reverse_bim_handoff_regeneration_route(
    body: ReverseBimHandoffRegenerationRequest,
) -> dict[str, Any]:
    return build_reverse_bim_handoff_regeneration_plan(
        facts=body.facts or body.source_facts or body.extracted_facts,
        source_revision_ledger=body.source_revision_ledger,
        phase_authoring_spec=body.phase_authoring_spec or body.phase_spec,
    )


@reverse_bim_router.post("/v3/reverse-bim/hybrid-slice")
async def reverse_bim_hybrid_slice_route(
    body: ReverseBimHybridSliceRequest,
) -> dict[str, Any]:
    return build_hybrid_reverse_bim_slice_report(
        phase=body.phase or body.slice or {},
        mcp_readiness=body.mcp_readiness,
        readback_comparison=body.readback_comparison,
        phase_packet=body.phase_packet,
        source_spec_revision=body.source_spec_revision,
        source_overlay=body.source_overlay,
        ui_evidence=body.ui_evidence,
        evidence_requirements=body.evidence_requirements,
        view_capture_plan=body.view_capture_plan,
    )


@reverse_bim_router.post("/v3/reverse-bim/hybrid-run")
async def reverse_bim_hybrid_run_route(
    body: ReverseBimHybridRunRequest,
) -> dict[str, Any]:
    return build_hybrid_reverse_bim_run_report(
        phase_authoring_spec=body.phase_authoring_spec
        or body.phase_spec
        or body.model_dump(by_alias=True),
        phase_packets=body.phase_packets or body.packets,
        slice_reports=body.slice_reports,
        package_acceptance=body.package_acceptance or body.folder_output,
    )


@reverse_bim_router.post("/v3/reverse-bim/evidence-requirements")
async def reverse_bim_evidence_requirements_route(
    body: ReverseBimEvidenceRequirementsRequest,
) -> dict[str, Any]:
    return build_reverse_bim_evidence_requirements(
        source_page_index=body.source_page_index,
        source_facts=body.source_facts or body.facts or body.extracted_facts,
        phase_authoring_spec=body.phase_authoring_spec or body.phase_spec,
    )


@reverse_bim_router.post("/v3/reverse-bim/view-capture-plan")
async def reverse_bim_view_capture_plan_route(
    body: ReverseBimViewCapturePlanRequest,
) -> dict[str, Any]:
    evidence_requirements = body.evidence_requirements or {}
    ev_required_ui_views: Any = None
    ev_required_overlay_views: Any = None
    if isinstance(evidence_requirements, dict):
        ev_required_ui_views = evidence_requirements.get(
            "requiredUiViews"
        ) or evidence_requirements.get("required_ui_views")
        ev_required_overlay_views = evidence_requirements.get(
            "requiredOverlayViews"
        ) or evidence_requirements.get("required_overlay_views")
    return build_reverse_bim_view_capture_plan(
        model_id=body.model_id,
        required_ui_views=body.required_ui_views or ev_required_ui_views,
        required_overlay_views=body.required_overlay_views or ev_required_overlay_views,
        output_dir=body.output_dir,
        base_url=body.base_url,
        run_id=body.run_id,
        viewport=body.viewport,
    )


@reverse_bim_router.post("/v3/reverse-bim/view-capture-execute")
async def reverse_bim_view_capture_execute_route(
    body: ReverseBimViewCaptureExecuteRequest,
) -> dict[str, Any]:
    plan = body.view_capture_plan or body.plan
    plan_path = body.plan_path
    output_dir = body.output_dir
    timeout_ms = int(body.timeout_ms or 30000)
    blockers = []
    if not plan_path and not isinstance(plan, dict):
        blockers.append(
            {
                "code": "capture_plan_missing",
                "message": "Provide planPath or an inline reverseBimViewCapturePlan_v1.",
            }
        )
    if isinstance(plan, dict) and plan.get("format") != "reverseBimViewCapturePlan_v1":
        blockers.append(
            {
                "code": "capture_plan_format_invalid",
                "message": "Expected reverseBimViewCapturePlan_v1.",
            }
        )
    captures = plan.get("captures") if isinstance(plan, dict) else []
    capture_count = len(captures) if isinstance(captures, list) else 0
    plan_arg = str(plan_path or "{write-inline-plan-to-json-first}")
    command = [
        "pnpm",
        "--filter",
        "@bim-ai/web",
        "reverse-bim:capture",
        "--",
        "--plan",
        plan_arg,
        "--timeout-ms",
        str(timeout_ms),
    ]
    if output_dir:
        command.extend(["--out", str(output_dir)])
    command.append("--json")
    return {
        "ok": not blockers,
        "format": "reverseBimViewCaptureExecutionRequest_v1",
        "summary": {
            "captureCount": capture_count,
            "blockerCount": len(blockers),
            "requiresBrowser": True,
            "mutatesModel": False,
        },
        "blockers": blockers,
        "command": command,
        "scriptPath": "packages/web/scripts/reverse-bim-view-capture-runner.mjs",
        "expectedManifest": (
            f"{str(output_dir).rstrip('/')}/reverse-bim-view-capture-manifest.json"
            if output_dir
            else "{runner-output-dir}/reverse-bim-view-capture-manifest.json"
        ),
        "runnerContract": {
            "inputFormat": "reverseBimViewCapturePlan_v1",
            "outputFormat": "reverseBimViewCaptureRun_v1",
            "feeds": {
                "uiEvidenceRows": "reverse_bim.ui_evidence.screenshots",
                "overlayEvidenceRows": "reverse_bim.source_overlay_evidence.overlayResults",
            },
            "reviewRequiredBeforeAcceptance": [
                "UI visual checklist rows must be reviewed from screenshots.",
                "Overlay rows need numeric source/model deviation metrics before pass.",
            ],
        },
        "nextStep": (
            "Run the command, then feed the generated manifest rows into UI/source-overlay evidence after review."
            if not blockers
            else "Provide a valid capture plan before running browser evidence."
        ),
    }


@reverse_bim_router.post("/v3/reverse-bim/visual-review-requests")
async def reverse_bim_visual_review_requests_route(
    body: ReverseBimVisualReviewRequestsRequest,
) -> dict[str, Any]:
    return build_reverse_bim_visual_review_requests(
        capture_run=body.capture_run,
        source_context=body.source_context,
        run_id=body.run_id,
    )


@reverse_bim_router.post("/v3/reverse-bim/visual-review-normalize")
async def reverse_bim_visual_review_normalize_route(
    body: ReverseBimVisualReviewNormalizeRequest,
) -> dict[str, Any]:
    return normalize_reverse_bim_visual_review_responses(
        capture_run=body.capture_run,
        visual_review_requests=body.visual_review_requests,
        responses=body.responses or body.visual_review_responses,
        default_tolerance_mm=float(body.default_tolerance_mm or 50.0),
    )


@reverse_bim_router.post("/v3/reverse-bim/level-completeness")
async def reverse_bim_level_completeness_route(
    body: ReverseBimLevelCompletenessRequest,
) -> dict[str, Any]:
    return build_level_completeness_report(
        source_facts=body.source_facts or body.facts,
        model_summary=body.model_summary,
        required_levels=body.required_levels,
        model_level_summaries=body.model_level_summaries,
        min_physical_elements_per_required_level=int(
            body.min_physical_elements_per_required_level or 1
        ),
    )


@reverse_bim_router.post("/v3/qa/level-completeness")
async def qa_level_completeness_route(
    body: ReverseBimLevelCompletenessRequest,
) -> dict[str, Any]:
    return await reverse_bim_level_completeness_route(body)


@reverse_bim_router.post("/v3/reverse-bim/physical-topology")
async def reverse_bim_physical_topology_route(
    body: ReverseBimPhysicalTopologyRequest,
) -> dict[str, Any]:
    return build_physical_topology_report(
        room_boundary_edges=body.room_boundary_edges,
        room_access_graph=body.room_access_graph,
        openings=body.openings,
        stairs=body.stairs,
        advisor=body.advisor,
    )


@reverse_bim_router.post("/v3/qa/physical-topology")
async def qa_physical_topology_route(
    body: ReverseBimPhysicalTopologyRequest,
) -> dict[str, Any]:
    return await reverse_bim_physical_topology_route(body)


@reverse_bim_router.post("/v3/reverse-bim/source-overlay-evidence")
async def reverse_bim_source_overlay_evidence_route(
    body: ReverseBimSourceOverlayEvidenceRequest,
) -> dict[str, Any]:
    return build_source_overlay_evidence_report(
        required_views=body.required_views,
        overlay_results=body.overlay_results,
        default_tolerance_mm=float(body.default_tolerance_mm or 50.0),
    )


@reverse_bim_router.post("/v3/qa/source-overlay-compare")
async def qa_source_overlay_compare_route(
    body: ReverseBimSourceOverlayEvidenceRequest,
) -> dict[str, Any]:
    return await reverse_bim_source_overlay_evidence_route(body)


@reverse_bim_router.post("/v3/reverse-bim/ui-evidence")
async def reverse_bim_ui_evidence_route(
    body: ReverseBimUiEvidenceRequest,
) -> dict[str, Any]:
    require_checklist_raw = body.require_visual_checklist
    if require_checklist_raw is None:
        require_checklist_raw = True
    require_checklist = (
        require_checklist_raw
        if isinstance(require_checklist_raw, bool)
        else str(require_checklist_raw).lower() not in {"0", "false", "no"}
    )
    return build_ui_evidence_report(
        required_views=body.required_views,
        screenshots=body.screenshots,
        require_visual_checklist=require_checklist,
    )


@reverse_bim_router.post("/v3/reverse-bim/final-acceptance")
async def reverse_bim_final_acceptance_route(
    body: ReverseBimFinalAcceptanceRequest,
) -> dict[str, Any]:
    return build_final_acceptance_report(
        str(body.model_id or "unknown-model"),
        advisor=body.advisor,
        constructability=body.constructability,
        integrity=body.integrity or body.integrity_preflight,
        area_reconciliation=body.area_reconciliation,
        coverage=body.coverage or body.source_coverage,
        finding_disposition=body.finding_disposition or body.finding_dispositions,
        room_access_graph=body.room_access_graph,
        room_boundary_edges=body.room_boundary_edges,
        room_topology_repair=body.room_topology_repair,
        level_completeness=body.level_completeness,
        physical_topology=body.physical_topology,
        source_overlay=body.source_overlay,
        ui_evidence=body.ui_evidence,
    )
