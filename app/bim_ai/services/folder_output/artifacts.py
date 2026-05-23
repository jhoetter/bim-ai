"""Phase 7: build artifact path map, write JSON + markdown files, return response."""

from __future__ import annotations

from typing import Any

from bim_ai._io.json_io import write_json as _write_json_shared
from bim_ai.models.reverse_bim_responses import FolderOutputResponse
from bim_ai.services.folder_output.acceptance import _readme
from bim_ai.services.folder_output.decisions import _building_scope_decision_payload
from bim_ai.services.folder_output.reader_pass import _reader_dispatch_markdown
from bim_ai.services.folder_output.state import FolderOutputPhaseState


def _phase_write_artifacts(
    state: FolderOutputPhaseState,
    *,
    reader_responses: list[dict[str, Any]] | dict[str, Any] | None,
    reader_consensus_dispositions: list[dict[str, Any]] | dict[str, Any] | None,
    building_scope_decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> FolderOutputResponse:
    """Phase 7: build the artifact path map, write all JSON + markdown files, return response."""
    del reader_responses  # absorbed via state; signature kept for symmetry/grep-ability
    out_dir = state.out_dir
    artifacts = {
        "runSummary": out_dir / "run-summary.json",
        "folderManifest": out_dir / "source" / "folder-manifest.json",
        "documentRegistry": out_dir / "source" / "document-registry.json",
        "documentClassification": out_dir / "source" / "document-classification.json",
        "renderedPages": out_dir / "source" / "rendered-pages.json",
        "pageClassificationDispatch": out_dir
        / "ai-reading"
        / "page-classifications"
        / "dispatch-plan.json",
        "pageClassificationResponses": out_dir
        / "ai-reading"
        / "page-classifications"
        / "responses-normalized.json",
        "pageClassificationApplication": out_dir
        / "ai-reading"
        / "page-classifications"
        / "application-report.json",
        "nativeTextExtractions": out_dir / "source" / "native-text-extractions.json",
        "sourcePageIndex": out_dir / "source" / "source-page-index.json",
        "aiVisualTracePacket": out_dir / "ai-reading" / "ai-visual-trace-packet.json",
        "aiVisualTraceWorkOrder": out_dir / "ai-reading" / "ai-visual-trace-work-order.json",
        "aiVisualAgentRequests": out_dir / "ai-reading" / "ai-visual-agent-requests.json",
        "readerPassManifest": out_dir / "ai-reading" / "reader-pass-manifest.json",
        "readerAssignmentProgress": out_dir / "ai-reading" / "reader-assignment-progress.json",
        "readerDispatchGuide": out_dir / "ai-reading" / "reader-dispatch.md",
        "readerAssignmentPrompts": out_dir / "ai-reading" / "reader-assignment-prompts.json",
        "readerResponsesRaw": out_dir / "ai-reading" / "reader-responses.raw.json",
        "readerResponseIndex": out_dir / "ai-reading" / "reader-response-index.json",
        "readerConsensus": out_dir / "ai-reading" / "reader-consensus.json",
        "readerResponsesNormalized": out_dir / "ai-reading" / "reader-responses.normalized.json",
        "agentLoopAccepted": out_dir / "ai-reading" / "agent-loop.accepted.json",
        "readerConsensusDispositions": out_dir
        / "ai-reading"
        / "reader-consensus-dispositions.json",
        "buildingScopeDecisions": out_dir / "understanding" / "building-scope-decisions.json",
        "repairRequestsOpen": out_dir / "ai-reading" / "repair-requests.open.json",
        "sourceRepairPlan": out_dir / "ai-reading" / "source-repair-plan.json",
        "sourceRepairPlanMarkdown": out_dir / "ai-reading" / "source-repair-plan.md",
        "coordinateFrames": out_dir / "understanding" / "coordinate-frames.json",
        "coordinateFrameWorklist": out_dir / "understanding" / "coordinate-frame-worklist.json",
        "sourceFactLedger": out_dir / "understanding" / "source-fact-ledger.json",
        "sourceBuildingScope": out_dir / "understanding" / "building-scope.json",
        "sourceLevelCompleteness": out_dir / "understanding" / "source-level-completeness.json",
        "roomTopology": out_dir / "understanding" / "room-topology.json",
        "sourceAreaConsistency": out_dir / "understanding" / "source-area-consistency.json",
        "sourceMaterialAssemblies": out_dir / "understanding" / "material-assemblies.json",
        "openingReconciliation": out_dir / "understanding" / "opening-reconciliation.json",
        "roofDormer": out_dir / "understanding" / "roof-dormer.json",
        "siteTerrain": out_dir / "understanding" / "site-terrain.json",
        "siteTerrainDecisionReport": out_dir
        / "understanding"
        / "site-terrain-decision-report.json",
        "conflictLedger": out_dir / "understanding" / "conflict-ledger.json",
        "conflictDispositionReport": out_dir / "understanding" / "conflict-disposition-report.json",
        "conflictDispositionWorklist": out_dir
        / "understanding"
        / "conflict-disposition-worklist.json",
        "existingBuildingIr": out_dir / "understanding" / "existing-building-ir.json",
        "existingBuildingIrValidation": out_dir
        / "understanding"
        / "existing-building-ir.validation.json",
        "sourceCoverageInitial": out_dir / "understanding" / "source-coverage.initial.json",
        "mcpReadiness": out_dir / "mcp-handoff" / "mcp-readiness.json",
        "authoringPlan": out_dir / "mcp-handoff" / "authoring-plan.json",
        "resolverWorklist": out_dir / "mcp-handoff" / "resolver-worklist.json",
        "phaseAuthoringSpec": out_dir / "mcp-handoff" / "phase-authoring-spec.json",
        "evidenceRequirements": out_dir / "mcp-handoff" / "evidence-requirements.json",
        "tolerancePolicy": out_dir / "mcp-handoff" / "tolerance-policy.json",
        "sourceCompletenessReport": out_dir / "validation" / "source-completeness-report.json",
        "coordinateFrameReport": out_dir / "validation" / "coordinate-frame-report.json",
        "siteTopologyReport": out_dir / "validation" / "site-topology-report.json",
        "packageAcceptanceReport": out_dir / "validation" / "package-acceptance-report.json",
        "sourceAnalysis": out_dir / "evidence" / "source-analysis.md",
        "readme": out_dir / "README.md",
    }
    payloads = {
        "runSummary": state.run_summary,
        "folderManifest": state.manifest,
        "documentRegistry": state.document_registry,
        "documentClassification": state.classifications,
        "renderedPages": state.rendered_pages,
        "pageClassificationDispatch": state.page_classification_dispatch,
        "pageClassificationResponses": state.page_classification_responses,
        "pageClassificationApplication": state.page_classification_application,
        "nativeTextExtractions": state.text_extractions,
        "sourcePageIndex": state.source_page_index,
        "aiVisualTracePacket": state.visual_packet,
        "aiVisualTraceWorkOrder": state.work_order,
        "aiVisualAgentRequests": state.requests,
        "readerPassManifest": state.reader_pass_manifest,
        "readerAssignmentProgress": state.reader_assignment_progress,
        "readerAssignmentPrompts": state.reader_assignment_prompts,
        "readerResponsesRaw": state.raw_responses,
        "readerResponseIndex": state.reader_response_index,
        "readerConsensus": state.reader_consensus,
        "readerResponsesNormalized": state.normalized,
        "agentLoopAccepted": state.loop,
        "readerConsensusDispositions": _reader_consensus_disposition_payload(
            reader_consensus_dispositions
        ),
        "buildingScopeDecisions": _building_scope_decision_payload(building_scope_decisions),
        "repairRequestsOpen": state.repair_requests_open,
        "sourceRepairPlan": state.source_repair_plan,
        "coordinateFrames": state.coordinate_frames,
        "coordinateFrameWorklist": state.coordinate_frame_worklist,
        "sourceFactLedger": state.fact_ledger,
        "sourceBuildingScope": state.source_building_scope,
        "sourceLevelCompleteness": state.source_level_completeness,
        "roomTopology": state.room_topology,
        "sourceAreaConsistency": state.source_area_consistency,
        "sourceMaterialAssemblies": state.source_material_assemblies,
        "openingReconciliation": state.opening_reconciliation,
        "roofDormer": state.roof_dormer,
        "siteTerrain": state.site_terrain,
        "siteTerrainDecisionReport": state.site_terrain_decision_report,
        "conflictLedger": state.conflicts,
        "conflictDispositionReport": state.conflict_disposition_report,
        "conflictDispositionWorklist": state.conflict_dispositions,
        "existingBuildingIr": state.ir,
        "existingBuildingIrValidation": state.ir_validation,
        "sourceCoverageInitial": state.coverage,
        "mcpReadiness": state.readiness,
        "authoringPlan": state.authoring_plan,
        "resolverWorklist": state.resolver_worklist,
        "phaseAuthoringSpec": state.phase_spec,
        "evidenceRequirements": state.evidence_requirements,
        "tolerancePolicy": state.tolerance_policy,
        "sourceCompletenessReport": state.source_completeness,
        "coordinateFrameReport": state.coordinate_frame_alignment_report,
        "siteTopologyReport": state.site_terrain,
        "packageAcceptanceReport": state.acceptance,
    }
    for key, payload in payloads.items():
        _write_json_shared(artifacts[key], payload)
    artifacts["sourceRepairPlanMarkdown"].write_text(
        _source_repair_plan_markdown(state.source_repair_plan),
        encoding="utf-8",
    )
    artifacts["sourceAnalysis"].write_text(
        _source_analysis_markdown(
            state.run_summary, state.source_completeness, state.readiness, state.conflicts
        ),
        encoding="utf-8",
    )
    artifacts["readerDispatchGuide"].write_text(
        _reader_dispatch_markdown(
            state.run_summary, state.reader_pass_manifest, state.reader_assignment_progress
        ),
        encoding="utf-8",
    )
    artifacts["readme"].write_text(_readme(state.run_summary, artifacts), encoding="utf-8")

    return FolderOutputResponse.model_validate(
        {
            "ok": state.acceptance.get("ok") is True,
            "format": "reverseBimFolderOutputPackage_v1",
            "packageState": state.run_summary["packageState"],
            "sourceFolder": str(state.source_root),
            "outputDir": str(state.out_dir),
            "summary": state.run_summary["summary"],
            "artifacts": {key: str(path) for key, path in artifacts.items()},
            "acceptance": state.acceptance,
            "nextStep": state.run_summary["nextAgentInstruction"],
        }
    )


def _reader_consensus_disposition_payload(
    dispositions: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, Any]:
    if dispositions is None:
        rows: list[dict[str, Any]] = []
    elif isinstance(dispositions, dict) and isinstance(dispositions.get("dispositions"), list):
        rows = [row for row in dispositions["dispositions"] if isinstance(row, dict)]
    elif isinstance(dispositions, dict):
        rows = [dispositions]
    elif isinstance(dispositions, list):
        rows = [row for row in dispositions if isinstance(row, dict)]
    else:
        rows = []
    return {
        "format": "reverseBimReaderConsensusDispositions_v1",
        "dispositionCount": len(rows),
        "dispositions": rows,
    }


def _source_repair_plan_markdown(plan: dict[str, Any]) -> str:
    summary = plan.get("summary") if isinstance(plan.get("summary"), dict) else {}
    lines = [
        "# Reverse-BIM Source Repair Plan",
        "",
        f"Package state: `{plan.get('packageState')}`",
        "",
        f"- Blocked steps: {summary.get('blockedStepCount', 0)}",
        f"- Open repair requests: {summary.get('openRepairRequestCount', 0)}",
        "",
        "Work these steps in order. Do not start MCP modeling while any blocked source-repair step remains.",
        "",
    ]
    for step in plan.get("steps") or []:
        if not isinstance(step, dict):
            continue
        lines.extend(
            [
                f"## {step.get('stepId')} {step.get('title')}",
                "",
                f"Status: `{step.get('status')}`",
                f"Blockers: {step.get('blockerCount', 0)}",
                "",
            ]
        )
        artifacts = step.get("artifacts") if isinstance(step.get("artifacts"), list) else []
        if artifacts:
            lines.append("Artifacts:")
            lines.extend(f"- `{artifact}`" for artifact in artifacts)
            lines.append("")
        instructions = (
            step.get("instructions") if isinstance(step.get("instructions"), list) else []
        )
        if instructions:
            lines.append("Instructions:")
            lines.extend(f"- {item}" for item in instructions)
            lines.append("")
        done = step.get("doneCriteria") if isinstance(step.get("doneCriteria"), list) else []
        if done:
            lines.append("Done criteria:")
            lines.extend(f"- {item}" for item in done)
            lines.append("")
    return "\n".join(lines)


def _source_analysis_markdown(
    run_summary: dict[str, Any],
    source_completeness: dict[str, Any],
    readiness: dict[str, Any],
    conflicts: dict[str, Any],
) -> str:
    summary = run_summary.get("summary") or {}
    readiness_summary = readiness.get("summary") or {}
    lines = [
        "# Reverse-BIM Source Analysis",
        "",
        f"Package state: `{run_summary.get('packageState')}`",
        "",
        "## Counts",
        "",
        f"- Source documents: {summary.get('sourceDocumentCount', 0)}",
        f"- Rendered pages: {summary.get('renderedPageCount', 0)}",
        f"- Accepted work packages: {summary.get('acceptedWorkPackageCount', 0)}",
        f"- Normalized facts: {summary.get('normalizedFactCount', 0)}",
        f"- MCP-ready facts: {readiness_summary.get('readyForMcpAuthoringCount', 0)}",
        f"- Resolver-needed facts: {readiness_summary.get('needsResolverCount', 0)}",
        f"- Source-refinement-needed facts: {readiness_summary.get('needsSourceRefinementCount', 0)}",
        f"- Open conflicts: {conflicts.get('openConflictCount', 0)}",
        "",
        "## Next Step",
        "",
        run_summary.get("nextAgentInstruction") or "Inspect package artifacts.",
        "",
        "## Blocked Work Packages",
        "",
    ]
    blockers = source_completeness.get("blockers") or []
    if not blockers:
        lines.append("- None")
    else:
        for blocker in blockers:
            lines.append(f"- `{blocker.get('workPackageId')}`: {blocker.get('status')}")
    lines.append("")
    return "\n".join(lines)
