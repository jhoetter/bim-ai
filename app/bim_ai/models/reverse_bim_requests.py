"""Pydantic request bodies for ``routes_reverse_bim`` (BRT-01).

Each model corresponds to exactly one FastAPI handler in
``app/bim_ai/routes_reverse_bim.py`` and reflects every key the
handler used to extract via ``body.get(...)``. Two ground rules:

1. ``model_config = ConfigDict(extra="allow", populate_by_name=True)``
   on every model. ``extra="allow"`` preserves the previous
   ``dict[str, Any]`` semantics for callers that send undocumented
   fields. ``populate_by_name=True`` accepts both the snake_case
   field name and the camelCase alias.

2. Required-field validation stays in the handler as an explicit
   ``if not <field>: raise HTTPException(status_code=422, ...)``.
   Pydantic ``Field(..., required=True)`` would raise a
   ``ValidationError`` with a different envelope shape, which would
   break the existing tests that assert on ``detail`` strings.

Model names follow the route-handler name (sans the trailing
``_route``) in PascalCase, plus a ``Request`` suffix.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    """Base for every request model — preserves legacy dict semantics.

    ``protected_namespaces=()`` disables Pydantic v2's warning about
    field names that start with ``model_`` — several wire keys
    (``modelId``, ``modelSummary``, ``modelReadback``, ...) shadow
    that namespace and have to keep their snake_case attribute names.
    """

    model_config = ConfigDict(
        extra="allow", populate_by_name=True, protected_namespaces=()
    )


# ---------------------------------------------------------------------------
# Source ingestion pipeline
# ---------------------------------------------------------------------------


class SourceFolderManifestRequest(_Base):
    root_path: str | None = Field(default=None, alias="rootPath")
    path: str | None = None


class SourceClassifyDocumentsRequest(_Base):
    manifest: Any | None = None
    files: Any | None = None


class ReverseBimViewBundleRequest(_Base):
    """Generic body for the four reverse-BIM view-bundle routes.

    The handler forwards the full body wholesale to
    ``build_semantic_authoring_bundle``. Every operation-specific
    field (``name``, ``direction``, ``sourceDocumentId``, ``levelId``,
    ``lineStartMm``, ``viewElementId``, ...) is preserved via
    ``extra="allow"``.
    """


class SourceRerenderForLegibilityRequest(_Base):
    output_dir: str | None = Field(default=None, alias="outputDir")
    targets: Any | None = None
    dpi: int | float | None = None


class SourceClassifyPagesDispatchPlanRequest(_Base):
    ai_visual_trace_packet: Any | None = Field(default=None, alias="aiVisualTracePacket")
    packet: Any | None = None
    output_dir: str | None = Field(default=None, alias="outputDir")
    mode: str | None = None
    write_assignments: Any | None = Field(default=None, alias="writeAssignments")


class SourceClassifyPagesNormalizeRequest(_Base):
    output_dir: str | None = Field(default=None, alias="outputDir")
    ai_visual_trace_packet: Any | None = Field(default=None, alias="aiVisualTracePacket")
    packet: Any | None = None


class SourcePdfTextRequest(_Base):
    source_path: str | None = Field(default=None, alias="sourcePath")
    path: str | None = None
    max_pages: Any | None = Field(default=None, alias="maxPages")


class SourceRenderPdfRequest(_Base):
    source_path: str | None = Field(default=None, alias="sourcePath")
    path: str | None = None
    output_dir: str | None = Field(default=None, alias="outputDir")
    dpi: int | float | None = None
    first_page: Any | None = Field(default=None, alias="firstPage")
    last_page: Any | None = Field(default=None, alias="lastPage")


class SourceDetectScaleRequest(_Base):
    text: Any | None = None
    source_document_id: str | None = Field(default=None, alias="sourceDocumentId")


class SourceAiReadingPacketRequest(_Base):
    manifest: Any | None = None
    classifications: Any | None = None
    rendered_pages: Any | None = Field(default=None, alias="renderedPages")
    text_extractions: Any | None = Field(default=None, alias="textExtractions")


class SourceAiVisualTracePacketRequest(_Base):
    manifest: Any | None = None
    classifications: Any | None = None
    rendered_pages: Any | None = Field(default=None, alias="renderedPages")
    text_extractions: Any | None = Field(default=None, alias="textExtractions")


class SourceAiVisualTraceWorkOrderRequest(_Base):
    ai_visual_trace_packet: Any | None = Field(default=None, alias="aiVisualTracePacket")
    packet: Any | None = None
    project_goal: str | None = Field(default=None, alias="projectGoal")


class SourceAiVisualTraceAgentRequestsRequest(_Base):
    work_order: Any | None = Field(default=None, alias="workOrder")
    ai_visual_trace_work_order: Any | None = Field(
        default=None, alias="aiVisualTraceWorkOrder"
    )
    run_id: str | None = Field(default=None, alias="runId")
    max_native_text_chars: int | float | None = Field(
        default=None, alias="maxNativeTextChars"
    )


class SourceAiVisualTraceReaderPassManifestRequest(_Base):
    agent_requests: Any | None = Field(default=None, alias="agentRequests")
    ai_visual_trace_agent_requests: Any | None = Field(
        default=None, alias="aiVisualTraceAgentRequests"
    )
    requests: Any | None = None
    work_order: Any | None = Field(default=None, alias="workOrder")
    ai_visual_trace_work_order: Any | None = Field(
        default=None, alias="aiVisualTraceWorkOrder"
    )
    responses: Any | None = None
    reader_responses: Any | None = Field(default=None, alias="readerResponses")
    min_independent_readers_for_critical_facts: int | float | None = Field(
        default=None, alias="minIndependentReadersForCriticalFacts"
    )


class SourcePrepareAiVisualTraceRunRequest(_Base):
    root_path: str | None = Field(default=None, alias="rootPath")
    path: str | None = None
    output_dir: str | None = Field(default=None, alias="outputDir")
    run_id: str | None = Field(default=None, alias="runId")
    dpi: int | float | None = None
    max_pages_per_pdf: Any | None = Field(default=None, alias="maxPagesPerPdf")


class SourceAiVisualTraceAgentLoopRequest(_Base):
    work_order: Any | None = Field(default=None, alias="workOrder")
    ai_visual_trace_work_order: Any | None = Field(
        default=None, alias="aiVisualTraceWorkOrder"
    )
    responses: Any | None = None
    reader_responses: Any | None = Field(default=None, alias="readerResponses")
    run_id: str | None = Field(default=None, alias="runId")
    reader_command: Any | None = Field(default=None, alias="readerCommand")
    reader_timeout_seconds: int | float | None = Field(
        default=None, alias="readerTimeoutSeconds"
    )


class SourceNormalizeAiVisualTraceReaderResponsesRequest(_Base):
    responses: Any | None = None
    reader_responses: Any | None = Field(default=None, alias="readerResponses")


class SourceReaderConsensusRequest(_Base):
    responses: Any | None = None
    reader_responses: Any | None = Field(default=None, alias="readerResponses")
    min_independent_readers: int | float | None = Field(
        default=None, alias="minIndependentReaders"
    )
    reader_consensus_dispositions: Any | None = Field(
        default=None, alias="readerConsensusDispositions"
    )
    consensus_dispositions: Any | None = Field(
        default=None, alias="consensusDispositions"
    )


class SourceValidateAiFactsRequest(_Base):
    facts: Any | None = None


class SourceValidateAiVisualTraceCompletenessRequest(_Base):
    facts: Any | None = None
    required_kinds: Any | None = Field(default=None, alias="requiredKinds")
    required_fact_kinds: Any | None = Field(default=None, alias="requiredFactKinds")


class SourceExtractFactsRequest(_Base):
    classifications: Any | None = None
    text_extractions: Any | None = Field(default=None, alias="textExtractions")


# ---------------------------------------------------------------------------
# Reverse-BIM pipeline
# ---------------------------------------------------------------------------


class ReverseBimIrSeedRequest(_Base):
    source_manifest: Any | None = Field(default=None, alias="sourceManifest")
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    classifications: Any | None = None


class ReverseBimIrValidateRequest(_Base):
    ir: Any | None = None


class ReverseBimSourceCoverageRequest(_Base):
    facts: Any | None = None
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    fact_to_element_refs: Any | None = Field(default=None, alias="factToElementRefs")


class ReverseBimPlanAuthoringRequest(_Base):
    facts: Any | None = None
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    phase: str | None = None


class ReverseBimMcpReadinessRequest(_Base):
    facts: Any | None = None
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    phase: str | None = None


class ReverseBimSourceMaterialAssembliesRequest(_Base):
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")


class ReverseBimSourceBuildingScopeRequest(_Base):
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    building_scope_decisions: Any | None = Field(
        default=None, alias="buildingScopeDecisions"
    )
    scope_decisions: Any | None = Field(default=None, alias="scopeDecisions")
    target_scope_decisions: Any | None = Field(
        default=None, alias="targetScopeDecisions"
    )


class ReverseBimSourceLevelCompletenessRequest(_Base):
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")


class ReverseBimCoordinateFrameWorklistRequest(_Base):
    coordinate_frames: Any | None = Field(default=None, alias="coordinateFrames")
    frames: Any | None = None
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")


class ReverseBimCoordinateFrameAlignmentRequest(_Base):
    coordinate_frames: Any | None = Field(default=None, alias="coordinateFrames")
    frames: Any | None = None
    alignments: Any | None = None
    coordinate_frame_alignments: Any | None = Field(
        default=None, alias="coordinateFrameAlignments"
    )
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")


class ReverseBimDocumentAuthorityRequest(_Base):
    manifest: Any | None = None
    source_manifest: Any | None = Field(default=None, alias="sourceManifest")
    files: Any | None = None
    classifications: Any | None = None
    documents: Any | None = None
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    authority_hints: Any | None = Field(default=None, alias="authorityHints")
    document_authority_hints: Any | None = Field(
        default=None, alias="documentAuthorityHints"
    )


class ReverseBimFolderOutputRequest(_Base):
    root_path: str | None = Field(default=None, alias="rootPath")
    source_folder: str | None = Field(default=None, alias="sourceFolder")
    path: str | None = None
    output_dir: str | None = Field(default=None, alias="outputDir")
    reader_responses: Any | None = Field(default=None, alias="readerResponses")
    responses: Any | None = None
    reader_command: Any | None = Field(default=None, alias="readerCommand")
    reader_timeout_seconds: int | float | None = Field(
        default=None, alias="readerTimeoutSeconds"
    )
    reader_consensus_dispositions: Any | None = Field(
        default=None, alias="readerConsensusDispositions"
    )
    consensus_dispositions: Any | None = Field(
        default=None, alias="consensusDispositions"
    )
    building_scope_decisions: Any | None = Field(
        default=None, alias="buildingScopeDecisions"
    )
    scope_decisions: Any | None = Field(default=None, alias="scopeDecisions")
    target_scope_decisions: Any | None = Field(
        default=None, alias="targetScopeDecisions"
    )
    conflict_decisions: Any | None = Field(default=None, alias="conflictDecisions")
    source_conflict_decisions: Any | None = Field(
        default=None, alias="sourceConflictDecisions"
    )
    coordinate_frame_alignments: Any | None = Field(
        default=None, alias="coordinateFrameAlignments"
    )
    coordinate_frame_decisions: Any | None = Field(
        default=None, alias="coordinateFrameDecisions"
    )
    site_terrain_decisions: Any | None = Field(
        default=None, alias="siteTerrainDecisions"
    )
    site_topology_decisions: Any | None = Field(
        default=None, alias="siteTopologyDecisions"
    )
    run_id: str | None = Field(default=None, alias="runId")
    dpi: int | float | None = None
    max_pages_per_pdf: Any | None = Field(default=None, alias="maxPagesPerPdf")
    reset_output: Any | None = Field(default=None, alias="resetOutput")


class ReverseBimReaderDispatchPlanRequest(_Base):
    output_dir: str | None = Field(default=None, alias="outputDir")
    include_completed: Any | None = Field(default=None, alias="includeCompleted")
    limit: Any | None = None


class ReverseBimReaderDispatchExecuteRequest(_Base):
    output_dir: str | None = Field(default=None, alias="outputDir")
    reader_command: Any | None = Field(default=None, alias="readerCommand")
    include_completed: Any | None = Field(default=None, alias="includeCompleted")
    force: Any | None = None
    limit: Any | None = None
    reader_timeout_seconds: int | float | None = Field(
        default=None, alias="readerTimeoutSeconds"
    )


class ReverseBimPhasePacketRequest(_Base):
    phase_id: str | None = Field(default=None, alias="phaseId")
    start_revision: Any | None = Field(default=None, alias="startRevision")
    end_revision: Any | None = Field(default=None, alias="endRevision")
    source_fact_ids: Any | None = Field(default=None, alias="sourceFactIds")
    transactions: Any | None = None
    advisor: Any | None = None
    constructability: Any | None = None
    integrity_preflight: Any | None = Field(default=None, alias="integrityPreflight")
    evidence_package: Any | None = Field(default=None, alias="evidencePackage")
    finding_dispositions: Any | None = Field(default=None, alias="findingDispositions")


class ReverseBimPhaseRunRequest(_Base):
    phase_authoring_spec: Any | None = Field(default=None, alias="phaseAuthoringSpec")
    phase_spec: Any | None = Field(default=None, alias="phaseSpec")
    phase_packets: Any | None = Field(default=None, alias="phasePackets")
    packets: Any | None = None


class ReverseBimReadbackCompareRequest(_Base):
    expected_readback: Any | None = Field(default=None, alias="expectedReadback")
    expectations: Any | None = None
    model_readback: Any | None = Field(default=None, alias="modelReadback")
    readback: Any | None = None
    readback_evidence: Any | None = Field(default=None, alias="readbackEvidence")
    elements: Any | None = None
    query_elements: Any | None = Field(default=None, alias="queryElements")
    tolerance_defaults: Any | None = Field(default=None, alias="toleranceDefaults")


class ReverseBimSourceSpecRevisionRequest(_Base):
    findings: Any | None = None
    readback_comparison: Any | None = Field(default=None, alias="readbackComparison")
    source_overlay: Any | None = Field(default=None, alias="sourceOverlay")
    advisor: Any | None = None
    constructability: Any | None = None
    integrity: Any | None = None
    integrity_preflight: Any | None = Field(default=None, alias="integrityPreflight")
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")


class ReverseBimSourceRevisionLedgerRequest(_Base):
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    source_spec_revision: Any | None = Field(default=None, alias="sourceSpecRevision")
    existing_ledger: Any | None = Field(default=None, alias="existingLedger")
    phase_authoring_spec: Any | None = Field(default=None, alias="phaseAuthoringSpec")
    phase_spec: Any | None = Field(default=None, alias="phaseSpec")


class ReverseBimSourceRevisionLedgerPersistRequest(_Base):
    output_dir: str | None = Field(default=None, alias="outputDir")
    source_revision_ledger: Any | None = Field(
        default=None, alias="sourceRevisionLedger"
    )
    ledger: Any | None = None
    run_id: str | None = Field(default=None, alias="runId")


class ReverseBimHandoffRegenerationRequest(_Base):
    facts: Any | None = None
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    source_revision_ledger: Any | None = Field(
        default=None, alias="sourceRevisionLedger"
    )
    phase_authoring_spec: Any | None = Field(default=None, alias="phaseAuthoringSpec")
    phase_spec: Any | None = Field(default=None, alias="phaseSpec")


class ReverseBimHybridSliceRequest(_Base):
    phase: Any | None = None
    slice: Any | None = None
    mcp_readiness: Any | None = Field(default=None, alias="mcpReadiness")
    readback_comparison: Any | None = Field(default=None, alias="readbackComparison")
    phase_packet: Any | None = Field(default=None, alias="phasePacket")
    source_spec_revision: Any | None = Field(default=None, alias="sourceSpecRevision")
    source_overlay: Any | None = Field(default=None, alias="sourceOverlay")
    ui_evidence: Any | None = Field(default=None, alias="uiEvidence")
    evidence_requirements: Any | None = Field(default=None, alias="evidenceRequirements")
    view_capture_plan: Any | None = Field(default=None, alias="viewCapturePlan")


class ReverseBimHybridRunRequest(_Base):
    phase_authoring_spec: Any | None = Field(default=None, alias="phaseAuthoringSpec")
    phase_spec: Any | None = Field(default=None, alias="phaseSpec")
    phase_packets: Any | None = Field(default=None, alias="phasePackets")
    packets: Any | None = None
    slice_reports: Any | None = Field(default=None, alias="sliceReports")
    package_acceptance: Any | None = Field(default=None, alias="packageAcceptance")
    folder_output: Any | None = Field(default=None, alias="folderOutput")


class ReverseBimEvidenceRequirementsRequest(_Base):
    source_page_index: Any | None = Field(default=None, alias="sourcePageIndex")
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    facts: Any | None = None
    extracted_facts: Any | None = Field(default=None, alias="extractedFacts")
    phase_authoring_spec: Any | None = Field(default=None, alias="phaseAuthoringSpec")
    phase_spec: Any | None = Field(default=None, alias="phaseSpec")


class ReverseBimViewCapturePlanRequest(_Base):
    model_id: str | None = Field(default=None, alias="modelId")
    required_ui_views: Any | None = Field(default=None, alias="requiredUiViews")
    required_overlay_views: Any | None = Field(default=None, alias="requiredOverlayViews")
    evidence_requirements: Any | None = Field(default=None, alias="evidenceRequirements")
    output_dir: str | None = Field(default=None, alias="outputDir")
    base_url: str | None = Field(default=None, alias="baseUrl")
    run_id: str | None = Field(default=None, alias="runId")
    viewport: Any | None = None


class ReverseBimViewCaptureExecuteRequest(_Base):
    view_capture_plan: Any | None = Field(default=None, alias="viewCapturePlan")
    plan: Any | None = None
    plan_path: str | None = Field(default=None, alias="planPath")
    output_dir: str | None = Field(default=None, alias="outputDir")
    timeout_ms: int | float | None = Field(default=None, alias="timeoutMs")


class ReverseBimVisualReviewRequestsRequest(_Base):
    capture_run: Any | None = Field(default=None, alias="captureRun")
    source_context: Any | None = Field(default=None, alias="sourceContext")
    run_id: str | None = Field(default=None, alias="runId")


class ReverseBimVisualReviewNormalizeRequest(_Base):
    capture_run: Any | None = Field(default=None, alias="captureRun")
    visual_review_requests: Any | None = Field(default=None, alias="visualReviewRequests")
    responses: Any | None = None
    visual_review_responses: Any | None = Field(default=None, alias="visualReviewResponses")
    default_tolerance_mm: float | int | None = Field(
        default=None, alias="defaultToleranceMm"
    )


class ReverseBimLevelCompletenessRequest(_Base):
    source_facts: Any | None = Field(default=None, alias="sourceFacts")
    facts: Any | None = None
    model_summary: Any | None = Field(default=None, alias="modelSummary")
    required_levels: Any | None = Field(default=None, alias="requiredLevels")
    model_level_summaries: Any | None = Field(default=None, alias="modelLevelSummaries")
    min_physical_elements_per_required_level: int | float | None = Field(
        default=None, alias="minPhysicalElementsPerRequiredLevel"
    )


class ReverseBimPhysicalTopologyRequest(_Base):
    room_boundary_edges: Any | None = Field(default=None, alias="roomBoundaryEdges")
    room_access_graph: Any | None = Field(default=None, alias="roomAccessGraph")
    openings: Any | None = None
    stairs: Any | None = None
    advisor: Any | None = None


class ReverseBimSourceOverlayEvidenceRequest(_Base):
    required_views: Any | None = Field(default=None, alias="requiredViews")
    overlay_results: Any | None = Field(default=None, alias="overlayResults")
    default_tolerance_mm: float | int | None = Field(
        default=None, alias="defaultToleranceMm"
    )


class ReverseBimUiEvidenceRequest(_Base):
    required_views: Any | None = Field(default=None, alias="requiredViews")
    screenshots: Any | None = None
    require_visual_checklist: Any | None = Field(
        default=None, alias="requireVisualChecklist"
    )


class ReverseBimFinalAcceptanceRequest(_Base):
    model_id: str | None = Field(default=None, alias="modelId")
    advisor: Any | None = None
    constructability: Any | None = None
    integrity: Any | None = None
    integrity_preflight: Any | None = Field(default=None, alias="integrityPreflight")
    area_reconciliation: Any | None = Field(default=None, alias="areaReconciliation")
    coverage: Any | None = None
    source_coverage: Any | None = Field(default=None, alias="sourceCoverage")
    finding_disposition: Any | None = Field(default=None, alias="findingDisposition")
    finding_dispositions: Any | None = Field(default=None, alias="findingDispositions")
    room_access_graph: Any | None = Field(default=None, alias="roomAccessGraph")
    room_boundary_edges: Any | None = Field(default=None, alias="roomBoundaryEdges")
    room_topology_repair: Any | None = Field(default=None, alias="roomTopologyRepair")
    level_completeness: Any | None = Field(default=None, alias="levelCompleteness")
    physical_topology: Any | None = Field(default=None, alias="physicalTopology")
    source_overlay: Any | None = Field(default=None, alias="sourceOverlay")
    ui_evidence: Any | None = Field(default=None, alias="uiEvidence")


__all__ = [
    "ReverseBimCoordinateFrameAlignmentRequest",
    "ReverseBimCoordinateFrameWorklistRequest",
    "ReverseBimDocumentAuthorityRequest",
    "ReverseBimEvidenceRequirementsRequest",
    "ReverseBimFinalAcceptanceRequest",
    "ReverseBimFolderOutputRequest",
    "ReverseBimHandoffRegenerationRequest",
    "ReverseBimHybridRunRequest",
    "ReverseBimHybridSliceRequest",
    "ReverseBimIrSeedRequest",
    "ReverseBimIrValidateRequest",
    "ReverseBimLevelCompletenessRequest",
    "ReverseBimMcpReadinessRequest",
    "ReverseBimPhasePacketRequest",
    "ReverseBimPhaseRunRequest",
    "ReverseBimPhysicalTopologyRequest",
    "ReverseBimPlanAuthoringRequest",
    "ReverseBimReadbackCompareRequest",
    "ReverseBimReaderDispatchExecuteRequest",
    "ReverseBimReaderDispatchPlanRequest",
    "ReverseBimSourceBuildingScopeRequest",
    "ReverseBimSourceCoverageRequest",
    "ReverseBimSourceLevelCompletenessRequest",
    "ReverseBimSourceMaterialAssembliesRequest",
    "ReverseBimSourceOverlayEvidenceRequest",
    "ReverseBimSourceRevisionLedgerPersistRequest",
    "ReverseBimSourceRevisionLedgerRequest",
    "ReverseBimSourceSpecRevisionRequest",
    "ReverseBimUiEvidenceRequest",
    "ReverseBimViewBundleRequest",
    "ReverseBimViewCaptureExecuteRequest",
    "ReverseBimViewCapturePlanRequest",
    "ReverseBimVisualReviewNormalizeRequest",
    "ReverseBimVisualReviewRequestsRequest",
    "SourceAiReadingPacketRequest",
    "SourceAiVisualTraceAgentLoopRequest",
    "SourceAiVisualTraceAgentRequestsRequest",
    "SourceAiVisualTracePacketRequest",
    "SourceAiVisualTraceReaderPassManifestRequest",
    "SourceAiVisualTraceWorkOrderRequest",
    "SourceClassifyDocumentsRequest",
    "SourceClassifyPagesDispatchPlanRequest",
    "SourceClassifyPagesNormalizeRequest",
    "SourceDetectScaleRequest",
    "SourceExtractFactsRequest",
    "SourceFolderManifestRequest",
    "SourceNormalizeAiVisualTraceReaderResponsesRequest",
    "SourcePdfTextRequest",
    "SourcePrepareAiVisualTraceRunRequest",
    "SourceReaderConsensusRequest",
    "SourceRenderPdfRequest",
    "SourceRerenderForLegibilityRequest",
    "SourceValidateAiFactsRequest",
    "SourceValidateAiVisualTraceCompletenessRequest",
]
