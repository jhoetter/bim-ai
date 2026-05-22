"""Reverse-BIM and source ingestion routes extracted from routes_api.

Routes mounted here cover the source ingestion pipeline (``/api/v3/source/*``)
and the reverse-BIM authoring pipeline (``/api/v3/reverse-bim/*``) plus a few
shared QA endpoints (``/api/v3/qa/*``) that share the same payload contracts.

The hybrid-slice-execute and hybrid-run-execute routes remain in
``routes_api.py`` for now because they depend on the bundle apply route. They
will move once the bundle apply path is split into its own module.
"""

from __future__ import annotations

# ruff: noqa: B008
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from bim_ai.final_acceptance import build_final_acceptance_report
from bim_ai.folder_output import build_reverse_bim_folder_output
from bim_ai.hybrid_reverse_bim import (
    build_hybrid_reverse_bim_run_report,
    build_hybrid_reverse_bim_slice_report,
    build_source_spec_revision_report,
)
from bim_ai.reverse_bim import (
    build_existing_building_ir_seed,
    build_mcp_authoring_readiness,
    build_reverse_bim_phase_packet,
    build_source_coverage_matrix,
    plan_mcp_authoring_actions,
    validate_existing_building_ir,
)
from bim_ai.reverse_bim_acceptance_evidence import (
    build_level_completeness_report,
    build_physical_topology_report,
    build_source_overlay_evidence_report,
    build_ui_evidence_report,
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
from bim_ai.semantic_authoring import (
    UnsupportedSemanticOperationError,
    build_semantic_authoring_bundle,
)
from bim_ai.reverse_bim_visual_review import (
    build_reverse_bim_visual_review_requests,
    normalize_reverse_bim_visual_review_responses,
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
    validate_ai_source_facts,
    validate_ai_visual_trace_completeness,
)
from bim_ai.source_page_classification import (
    apply_page_classifications,
    build_page_classification_dispatch_plan,
    load_page_classification_responses,
)
from bim_ai.source_level_completeness import build_source_level_completeness_report
from bim_ai.source_material_assemblies import build_source_material_assembly_report
from bim_ai.source_reader_consensus import build_source_reader_consensus_report

reverse_bim_router = APIRouter()


def _source_response(payload: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    if payload.get("ok") is not False:
        return payload
    return JSONResponse(status_code=int(payload.pop("status", 400)), content=payload)


# ---------------------------------------------------------------------------
# Source ingestion pipeline
# ---------------------------------------------------------------------------


@reverse_bim_router.post("/v3/source/folder-manifest")
async def source_folder_manifest_route(body: dict[str, Any] = Body(default_factory=dict)) -> Any:
    root_path = body.get("rootPath") or body.get("path")
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    return _source_response(build_folder_manifest(str(root_path)))


@reverse_bim_router.post("/v3/source/classify-documents")
async def source_classify_documents_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    manifest = body.get("manifest") or body.get("files") or body
    return classify_documents(manifest)


def _reverse_bim_view_bundle(operation: str, body: dict[str, Any]) -> dict[str, Any]:
    try:
        bundle = build_semantic_authoring_bundle(operation, body)
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


@reverse_bim_router.post("/v3/reverse-bim/exterior-view-create")
async def reverse_bim_exterior_view_create_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_exterior_view", body)


@reverse_bim_router.post("/v3/reverse-bim/detail-view-create")
async def reverse_bim_detail_view_create_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_detail_view", body)


@reverse_bim_router.post("/v3/reverse-bim/section-view-create")
async def reverse_bim_section_view_create_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_section_view", body)


@reverse_bim_router.post("/v3/reverse-bim/source-view-evidence-upsert")
async def reverse_bim_source_view_evidence_upsert_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return _reverse_bim_view_bundle("reverse_bim_source_view_evidence", body)


@reverse_bim_router.post("/v3/source/classify-pages/dispatch-plan")
async def source_classify_pages_dispatch_plan_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    packet = body.get("aiVisualTracePacket") or body.get("packet") or {}
    output_dir = body.get("outputDir")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(packet, dict) or not packet.get("documents"):
        raise HTTPException(
            status_code=422,
            detail="aiVisualTracePacket with documents is required",
        )
    return build_page_classification_dispatch_plan(
        visual_packet=packet,
        output_dir=str(output_dir),
        mode=str(body.get("mode") or "auto"),
        write_assignments=bool(body.get("writeAssignments", True)),
    )


@reverse_bim_router.post("/v3/source/classify-pages/normalize")
async def source_classify_pages_normalize_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    output_dir = body.get("outputDir")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    normalized = load_page_classification_responses(str(output_dir))
    packet = body.get("aiVisualTracePacket") or body.get("packet")
    if isinstance(packet, dict) and packet.get("documents"):
        application = apply_page_classifications(
            packet,
            responses=normalized.get("responses") or [],
        )
        normalized["application"] = application
        normalized["aiVisualTracePacket"] = packet
    return normalized


@reverse_bim_router.post("/v3/source/pdf-text")
async def source_pdf_text_route(body: dict[str, Any] = Body(default_factory=dict)) -> Any:
    source_path = body.get("sourcePath") or body.get("path")
    if not source_path:
        raise HTTPException(status_code=422, detail="sourcePath is required")
    return _source_response(
        extract_pdf_text(str(source_path), max_pages=body.get("maxPages"))
    )


@reverse_bim_router.post("/v3/source/render-pdf")
async def source_render_pdf_route(body: dict[str, Any] = Body(default_factory=dict)) -> Any:
    source_path = body.get("sourcePath") or body.get("path")
    output_dir = body.get("outputDir") or "tmp/pdfs/source-render"
    if not source_path:
        raise HTTPException(status_code=422, detail="sourcePath is required")
    return _source_response(
        render_pdf_pages(
            str(source_path),
            output_dir=str(output_dir),
            dpi=int(body.get("dpi") or 200),
            first_page=body.get("firstPage"),
            last_page=body.get("lastPage"),
        )
    )


@reverse_bim_router.post("/v3/source/detect-scale")
async def source_detect_scale_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return detect_scale_from_text(
        str(body.get("text") or ""),
        source_document_id=body.get("sourceDocumentId"),
    )


@reverse_bim_router.post("/v3/source/ai-reading-packet")
async def source_ai_reading_packet_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_ai_reading_packet(
        manifest=body.get("manifest") or {},
        classifications=body.get("classifications"),
        rendered_pages=body.get("renderedPages") or [],
        text_extractions=body.get("textExtractions") or [],
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-packet")
async def source_ai_visual_trace_packet_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_ai_visual_trace_packet(
        manifest=body.get("manifest") or {},
        classifications=body.get("classifications"),
        rendered_pages=body.get("renderedPages") or [],
        text_extractions=body.get("textExtractions") or [],
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-work-order")
async def source_ai_visual_trace_work_order_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    packet = body.get("aiVisualTracePacket") or body.get("packet") or body
    return build_ai_visual_trace_work_order(
        ai_visual_trace_packet=packet,
        project_goal=body.get("projectGoal"),
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-agent-requests")
async def source_ai_visual_trace_agent_requests_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    work_order = body.get("workOrder") or body.get("aiVisualTraceWorkOrder") or body
    return build_ai_visual_trace_agent_requests(
        work_order=work_order,
        run_id=body.get("runId"),
        max_native_text_chars=int(body.get("maxNativeTextChars") or 0),
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-reader-pass-manifest")
async def source_ai_visual_trace_reader_pass_manifest_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    agent_requests = (
        body.get("agentRequests")
        or body.get("aiVisualTraceAgentRequests")
        or body.get("requests")
        or {}
    )
    work_order = body.get("workOrder") or body.get("aiVisualTraceWorkOrder") or {}
    return build_ai_visual_trace_reader_pass_manifest(
        agent_requests=agent_requests,
        work_order=work_order,
        responses=body.get("responses") or body.get("readerResponses"),
        min_independent_readers_for_critical_facts=int(
            body.get("minIndependentReadersForCriticalFacts") or 2
        ),
    )


@reverse_bim_router.post("/v3/source/prepare-ai-visual-trace-run")
async def source_prepare_ai_visual_trace_run_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> Any:
    root_path = body.get("rootPath") or body.get("path")
    output_dir = body.get("outputDir")
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return _source_response(
        prepare_ai_visual_trace_run_from_folder(
            root_path=str(root_path),
            output_dir=str(output_dir),
            run_id=body.get("runId"),
            dpi=int(body.get("dpi") or 200),
            max_pages_per_pdf=body.get("maxPagesPerPdf"),
        )
    )


@reverse_bim_router.post("/v3/source/ai-visual-trace-agent-loop")
async def source_ai_visual_trace_agent_loop_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    work_order = body.get("workOrder") or body.get("aiVisualTraceWorkOrder") or {}
    return run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=body.get("responses") or body.get("readerResponses"),
        run_id=body.get("runId"),
        reader_command=body.get("readerCommand"),
        reader_timeout_seconds=int(body.get("readerTimeoutSeconds") or 300),
    )


@reverse_bim_router.post("/v3/source/normalize-ai-visual-trace-reader-responses")
async def source_normalize_ai_visual_trace_reader_responses_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return normalize_ai_visual_trace_reader_responses(
        body.get("responses") or body.get("readerResponses") or body
    )


@reverse_bim_router.post("/v3/source/reader-consensus")
async def source_reader_consensus_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_reader_consensus_report(
        body.get("responses") or body.get("readerResponses") or body,
        min_independent_readers=int(body.get("minIndependentReaders") or 2)
        if isinstance(body, dict)
        else 2,
        consensus_dispositions=body.get("readerConsensusDispositions")
        or body.get("consensusDispositions"),
    )


@reverse_bim_router.post("/v3/source/validate-ai-facts")
async def source_validate_ai_facts_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return validate_ai_source_facts(body.get("facts") or [])


@reverse_bim_router.post("/v3/source/validate-ai-visual-trace-completeness")
async def source_validate_ai_visual_trace_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return validate_ai_visual_trace_completeness(
        body.get("facts") or [],
        required_kinds=body.get("requiredKinds") or body.get("requiredFactKinds"),
    )


@reverse_bim_router.post("/v3/source/extract-facts")
async def source_extract_facts_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return extract_source_facts(
        body.get("classifications") or body,
        text_extractions=body.get("textExtractions") or [],
    )


# ---------------------------------------------------------------------------
# Reverse-BIM pipeline
# ---------------------------------------------------------------------------


@reverse_bim_router.post("/v3/reverse-bim/ir/seed")
async def reverse_bim_ir_seed_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_existing_building_ir_seed(
        source_manifest=body.get("sourceManifest") or {},
        source_facts=body.get("sourceFacts"),
        classifications=body.get("classifications"),
    )


@reverse_bim_router.post("/v3/reverse-bim/ir/validate")
async def reverse_bim_ir_validate_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return validate_existing_building_ir(body.get("ir") or body)


@reverse_bim_router.post("/v3/reverse-bim/source-coverage")
async def reverse_bim_source_coverage_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    facts = body.get("facts") or body.get("extractedFacts") or []
    return build_source_coverage_matrix(
        facts=facts,
        fact_to_element_refs=body.get("factToElementRefs") or {},
    )


@reverse_bim_router.post("/v3/reverse-bim/plan-authoring")
async def reverse_bim_plan_authoring_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return plan_mcp_authoring_actions(
        facts=body.get("facts") or body.get("extractedFacts") or [],
        target_phase=body.get("phase"),
    )


@reverse_bim_router.post("/v3/reverse-bim/mcp-readiness")
async def reverse_bim_mcp_readiness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_mcp_authoring_readiness(
        facts=body.get("facts") or body.get("extractedFacts") or [],
        target_phase=body.get("phase"),
    )


@reverse_bim_router.post("/v3/reverse-bim/source-material-assemblies")
async def reverse_bim_source_material_assemblies_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_material_assembly_report(
        body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts") or []
    )


@reverse_bim_router.post("/v3/reverse-bim/source-building-scope")
async def reverse_bim_source_building_scope_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_building_scope_report(
        body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts") or [],
        scope_decisions=body.get("buildingScopeDecisions")
        or body.get("scopeDecisions")
        or body.get("targetScopeDecisions"),
    )


@reverse_bim_router.post("/v3/reverse-bim/source-level-completeness")
async def reverse_bim_source_level_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_level_completeness_report(
        body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts") or []
    )


@reverse_bim_router.post("/v3/reverse-bim/coordinate-frame-worklist")
async def reverse_bim_coordinate_frame_worklist_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    coordinate_frames = (
        body.get("coordinateFrames")
        or body.get("coordinate_frames")
        or body.get("frames")
        or {}
    )
    return build_coordinate_frame_alignment_worklist(
        coordinate_frames,
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
    )


@reverse_bim_router.post("/v3/reverse-bim/coordinate-frame-alignment")
async def reverse_bim_coordinate_frame_alignment_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    coordinate_frames = (
        body.get("coordinateFrames")
        or body.get("coordinate_frames")
        or body.get("frames")
        or {}
    )
    return apply_coordinate_frame_alignments(
        coordinate_frames,
        body.get("alignments") or body.get("coordinateFrameAlignments"),
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
    )


@reverse_bim_router.post("/v3/reverse-bim/document-authority")
async def reverse_bim_document_authority_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_document_authority_report(
        manifest=body.get("manifest") or body.get("sourceManifest") or body.get("files"),
        classifications=body.get("classifications") or body.get("documents"),
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
        authority_hints=body.get("authorityHints") or body.get("documentAuthorityHints"),
    )


@reverse_bim_router.post("/v3/reverse-bim/folder-output")
async def reverse_bim_folder_output_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> Any:
    root_path = body.get("rootPath") or body.get("sourceFolder") or body.get("path")
    output_dir = body.get("outputDir")
    if not root_path:
        raise HTTPException(status_code=422, detail="rootPath is required")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return build_reverse_bim_folder_output(
        root_path=str(root_path),
        output_dir=str(output_dir),
        reader_responses=body.get("readerResponses") or body.get("responses"),
        reader_command=body.get("readerCommand"),
        reader_timeout_seconds=int(body.get("readerTimeoutSeconds") or 300),
        reader_consensus_dispositions=body.get("readerConsensusDispositions")
        or body.get("consensusDispositions"),
        building_scope_decisions=body.get("buildingScopeDecisions")
        or body.get("scopeDecisions")
        or body.get("targetScopeDecisions"),
        conflict_decisions=body.get("conflictDecisions") or body.get("sourceConflictDecisions"),
        coordinate_frame_alignments=body.get("coordinateFrameAlignments")
        or body.get("coordinateFrameDecisions"),
        site_terrain_decisions=body.get("siteTerrainDecisions") or body.get("siteTopologyDecisions"),
        run_id=body.get("runId"),
        dpi=int(body.get("dpi") or 200),
        max_pages_per_pdf=body.get("maxPagesPerPdf"),
        reset_output=bool(body.get("resetOutput") or False),
    )


@reverse_bim_router.post("/v3/reverse-bim/reader-dispatch-plan")
async def reverse_bim_reader_dispatch_plan_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    output_dir = body.get("outputDir")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    return build_reverse_bim_reader_dispatch_plan(
        output_dir=str(output_dir),
        include_completed=bool(body.get("includeCompleted") or False),
        limit=body.get("limit"),
    )


@reverse_bim_router.post("/v3/reverse-bim/reader-dispatch-execute")
async def reverse_bim_reader_dispatch_execute_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    output_dir = body.get("outputDir")
    reader_command = body.get("readerCommand")
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(reader_command, list) or not reader_command:
        raise HTTPException(status_code=422, detail="readerCommand must be a non-empty list")
    return execute_reverse_bim_reader_dispatch(
        output_dir=str(output_dir),
        reader_command=[str(item) for item in reader_command],
        include_completed=bool(body.get("includeCompleted") or False),
        force=bool(body.get("force") or False),
        limit=body.get("limit"),
        timeout_seconds=int(body.get("readerTimeoutSeconds") or 300),
    )


@reverse_bim_router.post("/v3/reverse-bim/phase-packet")
async def reverse_bim_phase_packet_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_phase_packet(
        phase_id=str(body.get("phaseId") or "unknown"),
        start_revision=body.get("startRevision"),
        end_revision=body.get("endRevision"),
        source_fact_ids=body.get("sourceFactIds") or [],
        transactions=body.get("transactions") or [],
        advisor=body.get("advisor"),
        constructability=body.get("constructability"),
        integrity_preflight=body.get("integrityPreflight"),
        evidence_package=body.get("evidencePackage"),
        finding_dispositions=body.get("findingDispositions") or [],
    )


@reverse_bim_router.post("/v3/reverse-bim/phase-run")
async def reverse_bim_phase_run_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_phase_run_report(
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec") or body,
        phase_packets=body.get("phasePackets") or body.get("packets"),
    )


@reverse_bim_router.post("/v3/reverse-bim/readback-compare")
async def reverse_bim_readback_compare_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_readback_comparison(
        expected_readback=body.get("expectedReadback")
        or body.get("expected_readback")
        or body.get("expectations")
        or [],
        model_readback=body.get("modelReadback")
        or body.get("model_readback")
        or body.get("readback")
        or body.get("readbackEvidence"),
        elements=body.get("elements") or body.get("queryElements") or body.get("query_elements"),
        tolerance_defaults=body.get("toleranceDefaults") or body.get("tolerance_defaults"),
    )


@reverse_bim_router.post("/v3/reverse-bim/source-spec-revision")
async def reverse_bim_source_spec_revision_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_spec_revision_report(
        findings=body.get("findings"),
        readback_comparison=body.get("readbackComparison") or body.get("readback_comparison"),
        source_overlay=body.get("sourceOverlay") or body.get("source_overlay"),
        advisor=body.get("advisor"),
        constructability=body.get("constructability"),
        integrity=body.get("integrity") or body.get("integrityPreflight"),
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
    )


@reverse_bim_router.post("/v3/reverse-bim/source-revision-ledger")
async def reverse_bim_source_revision_ledger_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_source_revision_ledger(
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
        source_spec_revision=body.get("sourceSpecRevision") or body.get("source_spec_revision"),
        existing_ledger=body.get("existingLedger") or body.get("existing_ledger"),
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec"),
    )


@reverse_bim_router.post("/v3/reverse-bim/source-revision-ledger-persist")
async def reverse_bim_source_revision_ledger_persist_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    output_dir = body.get("outputDir") or body.get("output_dir")
    source_revision_ledger = (
        body.get("sourceRevisionLedger")
        or body.get("source_revision_ledger")
        or body.get("ledger")
    )
    if not output_dir:
        raise HTTPException(status_code=422, detail="outputDir is required")
    if not isinstance(source_revision_ledger, dict):
        raise HTTPException(status_code=422, detail="sourceRevisionLedger is required")
    return persist_reverse_bim_source_revision_ledger(
        output_dir=output_dir,
        source_revision_ledger=source_revision_ledger,
        run_id=body.get("runId") or body.get("run_id"),
    )


@reverse_bim_router.post("/v3/reverse-bim/handoff-regeneration")
async def reverse_bim_handoff_regeneration_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_handoff_regeneration_plan(
        facts=body.get("facts") or body.get("sourceFacts") or body.get("extractedFacts"),
        source_revision_ledger=body.get("sourceRevisionLedger")
        or body.get("source_revision_ledger"),
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec"),
    )


@reverse_bim_router.post("/v3/reverse-bim/hybrid-slice")
async def reverse_bim_hybrid_slice_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_hybrid_reverse_bim_slice_report(
        phase=body.get("phase") or body.get("slice") or {},
        mcp_readiness=body.get("mcpReadiness") or body.get("mcp_readiness"),
        readback_comparison=body.get("readbackComparison") or body.get("readback_comparison"),
        phase_packet=body.get("phasePacket") or body.get("phase_packet"),
        source_spec_revision=body.get("sourceSpecRevision") or body.get("source_spec_revision"),
        source_overlay=body.get("sourceOverlay") or body.get("source_overlay"),
        ui_evidence=body.get("uiEvidence") or body.get("ui_evidence"),
        evidence_requirements=body.get("evidenceRequirements") or body.get("evidence_requirements"),
        view_capture_plan=body.get("viewCapturePlan") or body.get("view_capture_plan"),
    )


@reverse_bim_router.post("/v3/reverse-bim/hybrid-run")
async def reverse_bim_hybrid_run_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_hybrid_reverse_bim_run_report(
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec") or body,
        phase_packets=body.get("phasePackets") or body.get("packets"),
        slice_reports=body.get("sliceReports") or body.get("slice_reports"),
        package_acceptance=body.get("packageAcceptance")
        or body.get("package_acceptance")
        or body.get("folderOutput"),
    )


@reverse_bim_router.post("/v3/reverse-bim/evidence-requirements")
async def reverse_bim_evidence_requirements_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_evidence_requirements(
        source_page_index=body.get("sourcePageIndex") or body.get("source_page_index"),
        source_facts=body.get("sourceFacts") or body.get("facts") or body.get("extractedFacts"),
        phase_authoring_spec=body.get("phaseAuthoringSpec") or body.get("phaseSpec"),
    )


@reverse_bim_router.post("/v3/reverse-bim/view-capture-plan")
async def reverse_bim_view_capture_plan_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    evidence_requirements = (
        body.get("evidenceRequirements")
        or body.get("evidence_requirements")
        or {}
    )
    return build_reverse_bim_view_capture_plan(
        model_id=body.get("modelId") or body.get("model_id"),
        required_ui_views=body.get("requiredUiViews")
        or body.get("required_ui_views")
        or evidence_requirements.get("requiredUiViews")
        or evidence_requirements.get("required_ui_views"),
        required_overlay_views=body.get("requiredOverlayViews")
        or body.get("required_overlay_views")
        or evidence_requirements.get("requiredOverlayViews")
        or evidence_requirements.get("required_overlay_views"),
        output_dir=body.get("outputDir") or body.get("output_dir"),
        base_url=body.get("baseUrl") or body.get("base_url"),
        run_id=body.get("runId") or body.get("run_id"),
        viewport=body.get("viewport"),
    )


@reverse_bim_router.post("/v3/reverse-bim/view-capture-execute")
async def reverse_bim_view_capture_execute_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    plan = body.get("viewCapturePlan") or body.get("view_capture_plan") or body.get("plan")
    plan_path = body.get("planPath") or body.get("plan_path")
    output_dir = body.get("outputDir") or body.get("output_dir")
    timeout_ms = int(body.get("timeoutMs") or body.get("timeout_ms") or 30000)
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
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_reverse_bim_visual_review_requests(
        capture_run=body.get("captureRun") or body.get("capture_run"),
        source_context=body.get("sourceContext") or body.get("source_context"),
        run_id=body.get("runId") or body.get("run_id"),
    )


@reverse_bim_router.post("/v3/reverse-bim/visual-review-normalize")
async def reverse_bim_visual_review_normalize_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return normalize_reverse_bim_visual_review_responses(
        capture_run=body.get("captureRun") or body.get("capture_run"),
        visual_review_requests=body.get("visualReviewRequests")
        or body.get("visual_review_requests"),
        responses=body.get("responses") or body.get("visualReviewResponses"),
        default_tolerance_mm=float(body.get("defaultToleranceMm") or 50.0),
    )


@reverse_bim_router.post("/v3/reverse-bim/level-completeness")
async def reverse_bim_level_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_level_completeness_report(
        source_facts=body.get("sourceFacts") or body.get("facts"),
        model_summary=body.get("modelSummary") or body.get("model_summary"),
        required_levels=body.get("requiredLevels") or body.get("required_levels"),
        model_level_summaries=body.get("modelLevelSummaries")
        or body.get("model_level_summaries"),
        min_physical_elements_per_required_level=int(
            body.get("minPhysicalElementsPerRequiredLevel")
            or body.get("min_physical_elements_per_required_level")
            or 1
        ),
    )


@reverse_bim_router.post("/v3/qa/level-completeness")
async def qa_level_completeness_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return await reverse_bim_level_completeness_route(body)


@reverse_bim_router.post("/v3/reverse-bim/physical-topology")
async def reverse_bim_physical_topology_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_physical_topology_report(
        room_boundary_edges=body.get("roomBoundaryEdges") or body.get("room_boundary_edges"),
        room_access_graph=body.get("roomAccessGraph") or body.get("room_access_graph"),
        openings=body.get("openings"),
        stairs=body.get("stairs"),
        advisor=body.get("advisor"),
    )


@reverse_bim_router.post("/v3/qa/physical-topology")
async def qa_physical_topology_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return await reverse_bim_physical_topology_route(body)


@reverse_bim_router.post("/v3/reverse-bim/source-overlay-evidence")
async def reverse_bim_source_overlay_evidence_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_source_overlay_evidence_report(
        required_views=body.get("requiredViews") or body.get("required_views"),
        overlay_results=body.get("overlayResults") or body.get("overlay_results"),
        default_tolerance_mm=float(body.get("defaultToleranceMm") or 50.0),
    )


@reverse_bim_router.post("/v3/qa/source-overlay-compare")
async def qa_source_overlay_compare_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return await reverse_bim_source_overlay_evidence_route(body)


@reverse_bim_router.post("/v3/reverse-bim/ui-evidence")
async def reverse_bim_ui_evidence_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    require_checklist_raw = body.get("requireVisualChecklist", True)
    require_checklist = (
        require_checklist_raw
        if isinstance(require_checklist_raw, bool)
        else str(require_checklist_raw).lower() not in {"0", "false", "no"}
    )
    return build_ui_evidence_report(
        required_views=body.get("requiredViews") or body.get("required_views"),
        screenshots=body.get("screenshots"),
        require_visual_checklist=require_checklist,
    )


@reverse_bim_router.post("/v3/reverse-bim/final-acceptance")
async def reverse_bim_final_acceptance_route(
    body: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    return build_final_acceptance_report(
        str(body.get("modelId") or body.get("model_id") or "unknown-model"),
        advisor=body.get("advisor"),
        constructability=body.get("constructability"),
        integrity=body.get("integrity") or body.get("integrityPreflight"),
        area_reconciliation=body.get("areaReconciliation") or body.get("area_reconciliation"),
        coverage=body.get("coverage") or body.get("sourceCoverage"),
        finding_disposition=body.get("findingDisposition")
        or body.get("finding_disposition")
        or body.get("findingDispositions"),
        room_access_graph=body.get("roomAccessGraph") or body.get("room_access_graph"),
        room_boundary_edges=body.get("roomBoundaryEdges") or body.get("room_boundary_edges"),
        room_topology_repair=body.get("roomTopologyRepair") or body.get("room_topology_repair"),
        level_completeness=body.get("levelCompleteness") or body.get("level_completeness"),
        physical_topology=body.get("physicalTopology") or body.get("physical_topology"),
        source_overlay=body.get("sourceOverlay") or body.get("source_overlay"),
        ui_evidence=body.get("uiEvidence") or body.get("ui_evidence"),
    )
