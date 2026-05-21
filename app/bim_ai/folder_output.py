from __future__ import annotations

import hashlib
import json
import re
import shutil
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bim_ai.reverse_bim import (
    build_existing_building_ir_seed,
    build_mcp_authoring_readiness,
    build_source_coverage_matrix,
    plan_mcp_authoring_actions,
    validate_existing_building_ir,
)
from bim_ai.reverse_bim_evidence_requirements import build_reverse_bim_evidence_requirements
from bim_ai.source_agent_loop import (
    build_ai_visual_trace_agent_requests,
    build_ai_visual_trace_reader_pass_manifest,
    normalize_ai_visual_trace_reader_response,
    normalize_ai_visual_trace_reader_responses,
    run_ai_visual_trace_agent_loop,
)
from bim_ai.source_area_consistency import build_source_area_consistency_report
from bim_ai.source_building_scope import build_source_building_scope_report
from bim_ai.source_conflicts import (
    apply_source_conflict_dispositions,
    build_source_conflict_disposition_worklist,
)
from bim_ai.source_coordinate_frames import (
    apply_coordinate_frame_alignments,
    build_coordinate_frame_alignment_worklist,
)
from bim_ai.source_ingestion import (
    AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE,
    build_ai_visual_trace_packet,
    build_ai_visual_trace_work_order,
    build_folder_manifest,
    classify_documents,
    detect_scale_from_text,
    extract_pdf_text,
    render_pdf_pages,
)
from bim_ai.source_level_completeness import build_source_level_completeness_report
from bim_ai.source_material_assemblies import build_source_material_assembly_report
from bim_ai.source_openings import build_source_opening_reconciliation
from bim_ai.source_reader_consensus import build_source_reader_consensus_report
from bim_ai.source_roof_dormer import build_source_roof_dormer_report
from bim_ai.source_room_topology import build_source_room_topology_report
from bim_ai.source_site_terrain import (
    apply_source_site_terrain_decisions,
    build_source_site_terrain_report,
)

PHASE_BY_FACT_KIND = {
    "building_scope": "P0-source-inventory",
    "level": "P2-levels",
    "storey": "P2-levels",
    "wall_line": "P4-floor-plan-topology",
    "wall_chain": "P4-floor-plan-topology",
    "wall_thickness": "P3-structural-shell",
    "floor_boundary": "P3-structural-shell",
    "room": "P6-rooms-and-area-reconciliation",
    "area": "P6-rooms-and-area-reconciliation",
    "volume": "P13-documentation-schedules",
    "opening": "P7-openings",
    "door": "P7-openings",
    "window": "P7-openings",
    "stair": "P8-stairs-vertical-circulation",
    "slab_opening": "P8-stairs-vertical-circulation",
    "roof": "P9-roof-dormers",
    "dormer": "P9-roof-dormers",
    "roof_opening": "P9-roof-dormers",
    "basement": "P10-basement-cellar",
    "drainage": "P10-basement-cellar",
    "terrain": "P11-terrain-parcel-topology",
    "parcel_boundary": "P11-terrain-parcel-topology",
    "site_context": "P11-terrain-parcel-topology",
    "material": "P12-materials-history",
    "construction_history": "P12-materials-history",
    "photo_observation": "P12-materials-history",
    "conflict": "P0-source-inventory",
}

PHASE_ORDER = [
    "P0-source-inventory",
    "P1-scale-site-setup",
    "P2-levels",
    "P3-structural-shell",
    "P4-floor-plan-topology",
    "P5-interior-partitions",
    "P6-rooms-and-area-reconciliation",
    "P7-openings",
    "P8-stairs-vertical-circulation",
    "P9-roof-dormers",
    "P10-basement-cellar",
    "P11-terrain-parcel-topology",
    "P12-materials-history",
    "P13-documentation-schedules",
    "P14-validation",
    "P15-final-acceptance",
]


def build_reverse_bim_folder_output(
    *,
    root_path: str | Path,
    output_dir: str | Path,
    reader_responses: list[dict[str, Any]] | dict[str, Any] | None = None,
    reader_command: list[str] | None = None,
    reader_timeout_seconds: int = 300,
    reader_consensus_dispositions: list[dict[str, Any]] | dict[str, Any] | None = None,
    building_scope_decisions: list[dict[str, Any]] | dict[str, Any] | None = None,
    conflict_decisions: list[dict[str, Any]] | dict[str, Any] | None = None,
    coordinate_frame_alignments: list[dict[str, Any]] | dict[str, Any] | None = None,
    site_terrain_decisions: list[dict[str, Any]] | dict[str, Any] | None = None,
    run_id: str | None = None,
    dpi: int = 200,
    max_pages_per_pdf: int | None = None,
    reset_output: bool = False,
) -> dict[str, Any]:
    """Create the folder-output handoff package for reverse-BIM.

    The output is intentionally useful even when no reader responses exist: it
    packages the source folder and writes the exact AI-reader work still needed.
    When responses are supplied, it normalizes them, validates completeness,
    builds MCP-readiness, and writes the modeling handoff artifacts.
    """

    source_root = Path(root_path).expanduser().resolve()
    out_dir = Path(output_dir).expanduser().resolve()
    if reset_output and out_dir.exists():
        shutil.rmtree(out_dir)
    _ensure_tree(out_dir)

    forbidden_source_reason = _forbidden_source_root_reason(source_root)
    if forbidden_source_reason:
        result = {
            "ok": False,
            "format": "reverseBimFolderOutputPackage_v1",
            "packageState": "source_rejected",
            "sourceFolder": str(source_root),
            "outputDir": str(out_dir),
            "summary": {
                "sourceDocumentCount": 0,
                "renderedPageCount": 0,
                "workPackageCount": 0,
                "openBlockerCount": 1,
            },
            "acceptance": {
                "ok": False,
                "format": "reverseBimFolderOutputAcceptanceReport_v1",
                "packageState": "source_rejected",
                "summary": {"errorCount": 1, "warningCount": 0},
                "findings": [
                    {
                        "code": "folder_output_generated_source_rejected",
                        "severity": "error",
                        "message": forbidden_source_reason,
                    }
                ],
            },
            "nextStep": "Use the original source-document folder, not seed-artifacts or generated reverse-BIM outputs.",
        }
        _write_json(out_dir / "run-summary.json", result)
        _write_json(out_dir / "validation" / "package-acceptance-report.json", result["acceptance"])
        return result

    manifest = build_folder_manifest(source_root)
    if manifest.get("ok") is False:
        _write_json(out_dir / "run-summary.json", manifest)
        return manifest

    rendered_pages, text_extractions = _render_and_extract(
        manifest=manifest,
        output_dir=out_dir / "source" / "rendered-pages",
        dpi=dpi,
        max_pages_per_pdf=max_pages_per_pdf,
    )
    classifications = classify_documents(manifest, text_extractions=text_extractions)
    visual_packet = build_ai_visual_trace_packet(
        manifest=manifest,
        classifications=classifications,
        rendered_pages=rendered_pages,
        text_extractions=text_extractions,
    )
    work_order = build_ai_visual_trace_work_order(ai_visual_trace_packet=visual_packet)
    requests = build_ai_visual_trace_agent_requests(
        work_order=work_order,
        run_id=run_id,
    )

    discovered_reader_response_payload = (
        _empty_reader_response_file_payload()
        if reader_responses is not None
        else _load_reader_response_files(out_dir)
    )
    discovered_reader_responses = discovered_reader_response_payload.get("responses") or []
    discovered_reader_response_diagnostics = discovered_reader_response_payload.get("diagnostics") or []
    raw_responses = _reader_response_payload(
        reader_responses if reader_responses is not None else discovered_reader_responses
    )
    raw_response_source = "provided" if reader_responses is not None else "response_files"
    raw_response_file_count = int(discovered_reader_response_payload.get("responseFileCount") or 0)
    scanned_response_file_count = int(discovered_reader_response_payload.get("scannedResponseFileCount") or 0)
    raw_response_file_error_count = int(discovered_reader_response_payload.get("responseFileErrorCount") or 0)
    raw_responses["source"] = raw_response_source
    raw_responses["responseFileCount"] = raw_response_file_count
    raw_responses["scannedResponseFileCount"] = scanned_response_file_count
    raw_responses["responseFileErrorCount"] = raw_response_file_error_count
    raw_responses["diagnostics"] = discovered_reader_response_diagnostics
    loop = run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=raw_responses.get("responses") or [],
        run_id=requests.get("runId"),
        reader_command=reader_command,
        reader_timeout_seconds=reader_timeout_seconds,
    )
    raw_response_source = _raw_reader_response_source(
        reader_responses_provided=reader_responses is not None,
        discovered_response_count=len(discovered_reader_responses or []),
        loop_response_count=len(loop.get("readerResponses") or []),
        reader_command_used=bool(reader_command),
    )
    raw_responses = _reader_response_payload(loop.get("readerResponses") or raw_responses.get("responses") or [])
    raw_responses["source"] = raw_response_source
    raw_responses["responseFileCount"] = raw_response_file_count
    raw_responses["scannedResponseFileCount"] = scanned_response_file_count
    raw_responses["responseFileErrorCount"] = raw_response_file_error_count
    raw_responses["diagnostics"] = discovered_reader_response_diagnostics
    reader_pass_manifest = build_ai_visual_trace_reader_pass_manifest(
        agent_requests=requests,
        work_order=work_order,
        responses=raw_responses.get("responses") or [],
    )
    reader_assignment_progress = _build_reader_assignment_progress(
        reader_pass_manifest=reader_pass_manifest,
        raw_responses=raw_responses,
    )
    reader_consensus = build_source_reader_consensus_report(
        raw_responses,
        consensus_dispositions=reader_consensus_dispositions,
    )
    normalized = normalize_ai_visual_trace_reader_responses(raw_responses)
    reader_response_index = _build_reader_response_index(raw_responses, loop)
    facts = _facts_for_handoff(loop=loop, normalized=normalized)
    source_building_scope = build_source_building_scope_report(
        facts,
        scope_decisions=building_scope_decisions,
    )
    source_level_completeness = build_source_level_completeness_report(facts)
    room_topology = build_source_room_topology_report(facts)
    source_area_consistency = build_source_area_consistency_report(facts)
    opening_reconciliation = build_source_opening_reconciliation(facts)
    roof_dormer = build_source_roof_dormer_report(facts)
    site_terrain_decision_report = apply_source_site_terrain_decisions(
        build_source_site_terrain_report(facts),
        site_terrain_decisions,
    )
    site_terrain = site_terrain_decision_report["siteTerrainReport"]
    facts = _apply_site_terrain_decisions_to_facts(facts, site_terrain)
    conflicts = _build_conflict_ledger(facts, loop=loop)
    conflict_disposition_report = apply_source_conflict_dispositions(
        conflicts,
        conflict_decisions,
    )
    conflicts = conflict_disposition_report["conflictLedger"]
    facts = _apply_conflict_dispositions_to_facts(facts, conflicts)
    source_material_assemblies = build_source_material_assembly_report(facts)
    fact_ledger = _build_source_fact_ledger(facts)
    conflict_dispositions = build_source_conflict_disposition_worklist(conflicts)
    coordinate_frames = _build_coordinate_frames(
        rendered_pages=rendered_pages,
        classifications=classifications,
        text_extractions=text_extractions,
    )
    coordinate_frame_alignment_report = apply_coordinate_frame_alignments(
        coordinate_frames,
        coordinate_frame_alignments,
        facts=facts,
    )
    coordinate_frames = coordinate_frame_alignment_report["coordinateFrames"]
    coordinate_frame_worklist = build_coordinate_frame_alignment_worklist(
        coordinate_frames,
        facts=facts,
    )
    ir = build_existing_building_ir_seed(
        source_manifest=manifest,
        source_facts={"facts": facts},
        classifications=classifications,
    )
    ir["coordinateFrames"] = coordinate_frames["coordinateFrames"]
    ir["conflicts"] = conflicts["conflicts"]
    ir_validation = validate_existing_building_ir(ir)
    coverage = build_source_coverage_matrix(facts=facts)
    readiness = build_mcp_authoring_readiness(facts=facts, target_phase="folder-output")
    authoring_plan = plan_mcp_authoring_actions(facts=facts, target_phase="folder-output")
    resolver_worklist = _build_resolver_worklist(readiness)
    phase_spec = _build_phase_authoring_spec(
        facts=facts,
        readiness=readiness,
        authoring_plan=authoring_plan,
        resolver_worklist=resolver_worklist,
        conflicts=conflicts,
    )
    source_completeness = _build_source_completeness_report(work_order=work_order, loop=loop)
    acceptance = _build_package_acceptance_report(
        raw_responses=raw_responses,
        loop=loop,
        readiness=readiness,
        conflicts=conflicts,
        source_completeness=source_completeness,
        room_topology=room_topology,
        source_level_completeness=source_level_completeness,
        source_area_consistency=source_area_consistency,
        coordinate_frame_alignment_report=coordinate_frame_alignment_report,
        site_terrain=site_terrain,
        roof_dormer=roof_dormer,
        source_material_assemblies=source_material_assemblies,
        reader_consensus=reader_consensus,
        source_building_scope=source_building_scope,
    )
    run_summary = _build_run_summary(
        source_folder=source_root,
        output_dir=out_dir,
        manifest=manifest,
        rendered_pages=rendered_pages,
        work_order=work_order,
        loop=loop,
        normalized=normalized,
        readiness=readiness,
        conflicts=conflicts,
        acceptance=acceptance,
        raw_responses=raw_responses,
        agent_requests=requests,
        reader_pass_manifest=reader_pass_manifest,
        reader_assignment_progress=reader_assignment_progress,
    )
    document_registry = _build_document_registry(manifest, classifications)
    source_page_index = _build_source_page_index(
        rendered_pages=rendered_pages,
        classifications=classifications,
        text_extractions=text_extractions,
        coordinate_frames=coordinate_frames,
    )
    evidence_requirements = build_reverse_bim_evidence_requirements(
        source_page_index=source_page_index,
        source_facts=facts,
        phase_authoring_spec=phase_spec,
    )
    tolerance_policy = _build_tolerance_policy()
    reader_assignment_prompts = _write_reader_assignment_prompts(
        output_dir=out_dir / "ai-reading" / "assignments",
        agent_requests=requests,
        reader_pass_manifest=reader_pass_manifest,
    )
    run_summary["summary"]["readerAssignmentPromptCount"] = reader_assignment_prompts.get("promptCount", 0)
    repair_requests_open = {
        "format": "reverseBimOpenRepairRequests_v1",
        "requests": _build_open_repair_requests(
            loop=loop,
            source_building_scope=source_building_scope,
            source_level_completeness=source_level_completeness,
            room_topology=room_topology,
            source_area_consistency=source_area_consistency,
            site_terrain=site_terrain,
            roof_dormer=roof_dormer,
            source_material_assemblies=source_material_assemblies,
            reader_consensus=reader_consensus,
        ),
    }
    source_repair_plan = _build_source_repair_plan(
        run_summary=run_summary,
        acceptance=acceptance,
        reader_assignment_progress=reader_assignment_progress,
        repair_requests_open=repair_requests_open,
        coordinate_frame_worklist=coordinate_frame_worklist,
    )

    artifacts = {
        "runSummary": out_dir / "run-summary.json",
        "folderManifest": out_dir / "source" / "folder-manifest.json",
        "documentRegistry": out_dir / "source" / "document-registry.json",
        "documentClassification": out_dir / "source" / "document-classification.json",
        "renderedPages": out_dir / "source" / "rendered-pages.json",
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
        "readerConsensusDispositions": out_dir / "ai-reading" / "reader-consensus-dispositions.json",
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
        "siteTerrainDecisionReport": out_dir / "understanding" / "site-terrain-decision-report.json",
        "conflictLedger": out_dir / "understanding" / "conflict-ledger.json",
        "conflictDispositionReport": out_dir / "understanding" / "conflict-disposition-report.json",
        "conflictDispositionWorklist": out_dir / "understanding" / "conflict-disposition-worklist.json",
        "existingBuildingIr": out_dir / "understanding" / "existing-building-ir.json",
        "existingBuildingIrValidation": out_dir / "understanding" / "existing-building-ir.validation.json",
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
        "runSummary": run_summary,
        "folderManifest": manifest,
        "documentRegistry": document_registry,
        "documentClassification": classifications,
        "renderedPages": rendered_pages,
        "nativeTextExtractions": text_extractions,
        "sourcePageIndex": source_page_index,
        "aiVisualTracePacket": visual_packet,
        "aiVisualTraceWorkOrder": work_order,
        "aiVisualAgentRequests": requests,
        "readerPassManifest": reader_pass_manifest,
        "readerAssignmentProgress": reader_assignment_progress,
        "readerAssignmentPrompts": reader_assignment_prompts,
        "readerResponsesRaw": raw_responses,
        "readerResponseIndex": reader_response_index,
        "readerConsensus": reader_consensus,
        "readerResponsesNormalized": normalized,
        "agentLoopAccepted": loop,
        "readerConsensusDispositions": _reader_consensus_disposition_payload(
            reader_consensus_dispositions
        ),
        "buildingScopeDecisions": _building_scope_decision_payload(building_scope_decisions),
        "repairRequestsOpen": repair_requests_open,
        "sourceRepairPlan": source_repair_plan,
        "coordinateFrames": coordinate_frames,
        "coordinateFrameWorklist": coordinate_frame_worklist,
        "sourceFactLedger": fact_ledger,
        "sourceBuildingScope": source_building_scope,
        "sourceLevelCompleteness": source_level_completeness,
        "roomTopology": room_topology,
        "sourceAreaConsistency": source_area_consistency,
        "sourceMaterialAssemblies": source_material_assemblies,
        "openingReconciliation": opening_reconciliation,
        "roofDormer": roof_dormer,
        "siteTerrain": site_terrain,
        "siteTerrainDecisionReport": site_terrain_decision_report,
        "conflictLedger": conflicts,
        "conflictDispositionReport": conflict_disposition_report,
        "conflictDispositionWorklist": conflict_dispositions,
        "existingBuildingIr": ir,
        "existingBuildingIrValidation": ir_validation,
        "sourceCoverageInitial": coverage,
        "mcpReadiness": readiness,
        "authoringPlan": authoring_plan,
        "resolverWorklist": resolver_worklist,
        "phaseAuthoringSpec": phase_spec,
        "evidenceRequirements": evidence_requirements,
        "tolerancePolicy": tolerance_policy,
        "sourceCompletenessReport": source_completeness,
        "coordinateFrameReport": coordinate_frame_alignment_report,
        "siteTopologyReport": site_terrain,
        "packageAcceptanceReport": acceptance,
    }
    for key, payload in payloads.items():
        _write_json(artifacts[key], payload)
    artifacts["sourceRepairPlanMarkdown"].write_text(
        _source_repair_plan_markdown(source_repair_plan),
        encoding="utf-8",
    )
    artifacts["sourceAnalysis"].write_text(
        _source_analysis_markdown(run_summary, source_completeness, readiness, conflicts),
        encoding="utf-8",
    )
    artifacts["readerDispatchGuide"].write_text(
        _reader_dispatch_markdown(run_summary, reader_pass_manifest, reader_assignment_progress),
        encoding="utf-8",
    )
    artifacts["readme"].write_text(_readme(run_summary, artifacts), encoding="utf-8")

    return {
        "ok": acceptance.get("ok") is True,
        "format": "reverseBimFolderOutputPackage_v1",
        "packageState": run_summary["packageState"],
        "sourceFolder": str(source_root),
        "outputDir": str(out_dir),
        "summary": run_summary["summary"],
        "artifacts": {key: str(path) for key, path in artifacts.items()},
        "acceptance": acceptance,
        "nextStep": run_summary["nextAgentInstruction"],
    }


def _ensure_tree(out_dir: Path) -> None:
    for relative in (
        "source/rendered-pages",
        "ai-reading",
        "understanding",
        "mcp-handoff",
        "validation",
        "evidence/source-thumbnails",
        "evidence/page-crops",
    ):
        (out_dir / relative).mkdir(parents=True, exist_ok=True)


def _forbidden_source_root_reason(source_root: Path) -> str | None:
    parts = set(source_root.parts)
    if "seed-artifacts" in parts:
        return (
            "Reverse-BIM source ingestion refuses seed-artifacts paths. "
            "Generated seed bundles are export/inspection artifacts, not source truth."
        )
    for parent in source_root.parents:
        if parent.name.startswith("reverse-bim-") and source_root.name.startswith("target-house-"):
            return (
                "Reverse-BIM source ingestion refuses generated target-house outputs. "
                "Use the original source-document folder for a fresh run."
            )
    return None


def _render_and_extract(
    *,
    manifest: dict[str, Any],
    output_dir: Path,
    dpi: int,
    max_pages_per_pdf: int | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rendered_pages: list[dict[str, Any]] = []
    text_extractions: list[dict[str, Any]] = []
    for file_row in manifest.get("files") or []:
        if not isinstance(file_row, dict) or file_row.get("kind") != "pdf":
            continue
        source_path = str(file_row.get("absolutePath") or "")
        source_doc_id = str(file_row.get("sourceDocumentId") or "source")
        render = render_pdf_pages(
            source_path,
            output_dir=output_dir / source_doc_id,
            dpi=dpi,
            first_page=1 if max_pages_per_pdf else None,
            last_page=max_pages_per_pdf,
        )
        rendered_pages.append(render)
        text_extractions.append(extract_pdf_text(source_path, max_pages=max_pages_per_pdf))
    return rendered_pages, text_extractions


def _reader_response_payload(
    reader_responses: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, Any]:
    if reader_responses is None:
        rows: list[dict[str, Any]] = []
    elif isinstance(reader_responses, dict) and isinstance(reader_responses.get("responses"), list):
        rows = [row for row in reader_responses["responses"] if isinstance(row, dict)]
    elif isinstance(reader_responses, dict):
        rows = [
            {**value, "workPackageId": key}
            for key, value in reader_responses.items()
            if isinstance(value, dict)
        ]
    else:
        rows = [row for row in reader_responses if isinstance(row, dict)]
    return {
        "format": "sourceAiVisualTraceReaderResponsesRaw_v1",
        "responseCount": len(rows),
        "responsesDigestSha256": _sha256_json(rows),
        "responses": rows,
    }


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


def _building_scope_decision_payload(
    decisions: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, Any]:
    if decisions is None:
        rows: list[dict[str, Any]] = []
    elif isinstance(decisions, dict) and isinstance(decisions.get("decisions"), list):
        rows = [row for row in decisions["decisions"] if isinstance(row, dict)]
    elif isinstance(decisions, dict) and isinstance(decisions.get("scopeDecisions"), list):
        rows = [row for row in decisions["scopeDecisions"] if isinstance(row, dict)]
    elif isinstance(decisions, dict):
        rows = [decisions]
    elif isinstance(decisions, list):
        rows = [row for row in decisions if isinstance(row, dict)]
    else:
        rows = []
    return {
        "format": "reverseBimBuildingScopeDecisions_v1",
        "decisionCount": len(rows),
        "decisions": rows,
    }


def _empty_reader_response_file_payload() -> dict[str, Any]:
    return {
        "responses": [],
        "diagnostics": [],
        "responseFileCount": 0,
        "scannedResponseFileCount": 0,
        "responseFileErrorCount": 0,
    }


def _raw_reader_response_source(
    *,
    reader_responses_provided: bool,
    discovered_response_count: int,
    loop_response_count: int,
    reader_command_used: bool,
) -> str:
    if reader_responses_provided:
        return "provided"
    if reader_command_used and loop_response_count:
        if discovered_response_count:
            return "response_files+reader_command"
        return "reader_command"
    return "response_files"


def _load_reader_response_files(out_dir: Path) -> dict[str, Any]:
    response_root = out_dir / "ai-reading" / "responses"
    if not response_root.exists():
        return _empty_reader_response_file_payload()
    assignments_by_response_path = _reader_assignments_by_response_path(out_dir)
    rows: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    scanned_file_count = 0
    response_file_count = 0
    response_files = sorted(
        [
            path
            for pattern in ("*.json", "*.md")
            for path in response_root.rglob(pattern)
        ]
    )
    for path in response_files:
        scanned_file_count += 1
        path_label = _reader_response_path_label(path=path, output_dir=out_dir)
        assignment = assignments_by_response_path.get(path_label)
        try:
            text = path.read_text(encoding="utf-8")
            payload = _parse_reader_response_file_payload(text, path=path)
        except json.JSONDecodeError as exc:
            diagnostics.append(
                {
                    "code": "reader_response_file_invalid_json",
                    "severity": "error",
                    "path": path_label,
                    "message": f"Reader response file is not valid JSON: {exc.msg}.",
                    "line": exc.lineno,
                    "column": exc.colno,
                }
            )
            continue
        except Exception as exc:
            diagnostics.append(
                {
                    "code": "reader_response_file_read_failed",
                    "severity": "error",
                    "path": path_label,
                    "message": f"Reader response file could not be read: {exc}.",
                }
            )
            continue
        if payload is None:
            response_file_count += 1
            rows.append(
                _reader_response_file_defaults(
                    {
                        "format": "sourceAiVisualTraceReaderResponse_v1",
                        "facts": [],
                        "readerNotes": text,
                        "responseSource": "markdown_notes_only",
                    },
                    assignment=assignment,
                    path=path,
                )
            )
            diagnostics.append(
                {
                    "code": "reader_response_markdown_notes_only",
                    "severity": "warning",
                    "path": path_label,
                    "message": (
                        "Markdown reader response had no JSON source-fact block. "
                        "Notes were preserved, but MCP handoff still requires structured facts."
                    ),
                }
            )
            continue
        if isinstance(payload, dict) and isinstance(payload.get("responses"), list):
            response_file_count += 1
            for row in payload["responses"]:
                if isinstance(row, dict):
                    rows.append(
                        _reader_response_file_defaults(row, assignment=assignment, path=path)
                    )
                else:
                    diagnostics.append(
                        {
                            "code": "reader_response_file_invalid_response_row",
                            "severity": "error",
                            "path": path_label,
                            "message": "Reader response bundle contains a non-object response row.",
                        }
                    )
            continue
        if isinstance(payload, dict):
            response_file_count += 1
            rows.append(_reader_response_file_defaults(payload, assignment=assignment, path=path))
            continue
        diagnostics.append(
            {
                "code": "reader_response_file_invalid_container",
                "severity": "error",
                "path": path_label,
                "message": "Reader response file must contain an object or an object with a responses array.",
            }
        )
    return {
        "responses": rows,
        "diagnostics": diagnostics,
        "responseFileCount": response_file_count,
        "scannedResponseFileCount": scanned_file_count,
        "responseFileErrorCount": sum(1 for row in diagnostics if row.get("severity") == "error"),
    }


def _reader_assignments_by_response_path(out_dir: Path) -> dict[str, dict[str, Any]]:
    manifest_path = out_dir / "ai-reading" / "reader-pass-manifest.json"
    if not manifest_path.exists():
        return {}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    out: dict[str, dict[str, Any]] = {}
    for assignment in manifest.get("assignments") or []:
        if not isinstance(assignment, dict):
            continue
        hint = str(assignment.get("responsePathHint") or "")
        if hint:
            out[hint] = assignment
            if hint.endswith(".json"):
                out[f"{hint[:-5]}.md"] = assignment
    return out


def _parse_reader_response_file_payload(text: str, *, path: Path) -> Any:
    if path.suffix.lower() == ".md":
        return _json_payload_from_markdown(text)
    return json.loads(text)


def _json_payload_from_markdown(text: str) -> Any:
    fence_pattern = re.compile(r"```(?:json|source-facts|sourcefacts)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)
    for match in fence_pattern.finditer(text):
        candidate = match.group(1).strip()
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    stripped = text.strip()
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return None
    return None


def _reader_response_file_defaults(
    payload: dict[str, Any],
    *,
    assignment: dict[str, Any] | None,
    path: Path,
) -> dict[str, Any]:
    assignment = assignment or {}
    return {
        **payload,
        "format": payload.get("format") or "sourceAiVisualTraceReaderResponse_v1",
        "assignmentId": payload.get("assignmentId") or assignment.get("assignmentId"),
        "readerPassId": payload.get("readerPassId") or assignment.get("readerPassId"),
        "requestId": payload.get("requestId") or assignment.get("requestId"),
        "requestPartIndex": payload.get("requestPartIndex") or assignment.get("requestPartIndex"),
        "requestPartCount": payload.get("requestPartCount") or assignment.get("requestPartCount"),
        "workPackageId": (
            payload.get("workPackageId")
            or payload.get("workPackage")
            or assignment.get("workPackageId")
        ),
        "responsePathHint": payload.get("responsePathHint") or assignment.get("responsePathHint"),
        "responsePath": str(path),
    }


def _reader_response_path_label(*, path: Path, output_dir: Path) -> str:
    try:
        return str(path.relative_to(output_dir))
    except ValueError:
        return str(path)


def _build_reader_assignment_progress(
    *,
    reader_pass_manifest: dict[str, Any],
    raw_responses: dict[str, Any],
) -> dict[str, Any]:
    assignments = [
        row
        for row in reader_pass_manifest.get("assignments") or []
        if isinstance(row, dict)
    ]
    responses = [
        row
        for row in raw_responses.get("responses") or []
        if isinstance(row, dict)
    ]
    assignment_group_counts = Counter(
        (
            str(row.get("workPackageId") or ""),
            str(row.get("readerPassId") or "reader-pass-01"),
        )
        for row in assignments
    )
    rows = []
    for assignment in assignments:
        if assignment.get("status") == "missing_inputs":
            rows.append(
                {
                    "assignmentId": assignment.get("assignmentId"),
                    "readerPassId": assignment.get("readerPassId"),
                    "workPackageId": assignment.get("workPackageId"),
                    "requestId": assignment.get("requestId"),
                    "status": "missing_inputs",
                    "responsePathHint": assignment.get("responsePathHint"),
                    "factCount": 0,
                    "normalizedFactCount": 0,
                    "normalizationErrorCount": 0,
                    "normalizationWarningCount": 0,
                    "normalizationFindings": [],
                }
            )
            continue
        response = _response_for_assignment(
            assignment,
            responses,
            assignment_group_counts=assignment_group_counts,
        )
        if response is None:
            rows.append(
                {
                    "assignmentId": assignment.get("assignmentId"),
                    "readerPassId": assignment.get("readerPassId"),
                    "workPackageId": assignment.get("workPackageId"),
                    "requestId": assignment.get("requestId"),
                    "status": "waiting_for_reader",
                    "responsePathHint": assignment.get("responsePathHint"),
                    "finding": {
                        "code": "reader_assignment_response_missing",
                        "severity": "error",
                        "message": "No response matched this reader assignment.",
                    },
                }
            )
            continue
        normalization = normalize_ai_visual_trace_reader_response(response)
        norm_summary = normalization.get("summary") if isinstance(normalization.get("summary"), dict) else {}
        normalized_count = int(norm_summary.get("normalizedFactCount") or 0)
        error_count = int(norm_summary.get("errorCount") or 0)
        if error_count:
            status = "response_invalid"
        elif normalized_count == 0:
            status = "response_has_no_facts"
        else:
            status = "response_has_facts"
        rows.append(
            {
                "assignmentId": assignment.get("assignmentId"),
                "readerPassId": assignment.get("readerPassId"),
                "workPackageId": assignment.get("workPackageId"),
                "requestId": assignment.get("requestId"),
                "status": status,
                "responsePathHint": assignment.get("responsePathHint"),
                "responsePath": response.get("responsePath"),
                "factCount": int(norm_summary.get("factCount") or 0),
                "normalizedFactCount": normalized_count,
                "normalizationErrorCount": error_count,
                "normalizationWarningCount": int(norm_summary.get("warningCount") or 0),
                "normalizationFindings": normalization.get("findings") or [],
            }
        )
    status_counts = Counter(str(row.get("status") or "unknown") for row in rows)
    return {
        "format": "sourceAiVisualTraceReaderAssignmentProgress_v1",
        "ok": status_counts.get("waiting_for_reader", 0) == 0
        and status_counts.get("response_invalid", 0) == 0,
        "source": raw_responses.get("source"),
        "summary": {
            "assignmentCount": len(rows),
            "waitingAssignmentCount": status_counts.get("waiting_for_reader", 0),
            "invalidResponseAssignmentCount": status_counts.get("response_invalid", 0),
            "noFactResponseAssignmentCount": status_counts.get("response_has_no_facts", 0),
            "assignmentWithFactsCount": status_counts.get("response_has_facts", 0),
            "missingInputAssignmentCount": status_counts.get("missing_inputs", 0),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "rows": rows,
    }


def _response_for_assignment(
    assignment: dict[str, Any],
    responses: list[dict[str, Any]],
    *,
    assignment_group_counts: Counter[tuple[str, str]],
) -> dict[str, Any] | None:
    request_id = str(assignment.get("requestId") or "")
    package_id = str(assignment.get("workPackageId") or "")
    reader_pass_id = str(assignment.get("readerPassId") or "reader-pass-01")
    for response in responses:
        if (
            str(response.get("requestId") or "") == request_id
            and str(response.get("workPackageId") or response.get("workPackage") or response.get("id") or "") == package_id
            and str(response.get("readerPassId") or reader_pass_id) == reader_pass_id
        ):
            return response
    for response in responses:
        if (
            str(response.get("requestId") or "") == request_id
            and str(response.get("workPackageId") or response.get("workPackage") or response.get("id") or "") == package_id
            and not response.get("readerPassId")
            and reader_pass_id == "reader-pass-01"
        ):
            return response
    if assignment_group_counts[(package_id, reader_pass_id)] == 1:
        for response in responses:
            response_package = str(response.get("workPackageId") or response.get("workPackage") or response.get("id") or "")
            response_pass = str(response.get("readerPassId") or reader_pass_id)
            if response_package == package_id and response_pass == reader_pass_id:
                return response
    return None


def _build_reader_response_index(
    raw_responses: dict[str, Any],
    loop: dict[str, Any],
) -> dict[str, Any]:
    package_results = {
        str(row.get("workPackageId") or ""): row
        for row in loop.get("packageResults") or []
        if isinstance(row, dict)
    }
    rows = []
    for idx, response in enumerate(raw_responses.get("responses") or []):
        if not isinstance(response, dict):
            continue
        package_id = str(response.get("workPackageId") or response.get("workPackage") or response.get("id") or "")
        facts = [fact for fact in response.get("facts") or [] if isinstance(fact, dict)]
        package_result = package_results.get(package_id, {})
        rows.append(
            {
                "responseId": response.get("responseId") or f"reader-response-{idx + 1:03d}",
                "responseIndex": idx,
                "workPackageId": package_id or None,
                "requestId": response.get("requestId"),
                "assignmentId": response.get("assignmentId"),
                "readerPassId": response.get("readerPassId"),
                "format": response.get("format"),
                "readerId": response.get("readerId") or response.get("agentId"),
                "provider": response.get("provider"),
                "model": response.get("model") or response.get("modelId"),
                "capturedAt": response.get("capturedAt") or response.get("createdAt"),
                "responsePath": response.get("responsePath"),
                "responsePathHint": response.get("responsePathHint"),
                "responseDigestSha256": _sha256_json(response),
                "factCount": len(facts),
                "factCountsByKind": dict(sorted(Counter(str(fact.get("kind") or "") for fact in facts).items())),
                "status": package_result.get("status") or "unmatched",
                "normalizationErrorCount": (
                    (package_result.get("normalization") or {}).get("summary") or {}
                ).get("errorCount"),
                "normalizationWarningCount": (
                    (package_result.get("normalization") or {}).get("summary") or {}
                ).get("warningCount"),
                "findingCount": len(package_result.get("findings") or []),
            }
        )
    status_counts = dict(sorted(Counter(str(row.get("status") or "unknown") for row in rows).items()))
    return {
        "format": "sourceAiVisualTraceReaderResponseIndex_v1",
        "rawResponsesDigestSha256": raw_responses.get("responsesDigestSha256"),
        "responseCount": len(rows),
        "statusCounts": status_counts,
        "rows": rows,
    }


def _sha256_json(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _facts_for_handoff(*, loop: dict[str, Any], normalized: dict[str, Any]) -> list[dict[str, Any]]:
    facts = loop.get("allReturnedFacts")
    if isinstance(facts, list):
        return [fact for fact in facts if isinstance(fact, dict)]
    out: list[dict[str, Any]] = []
    for response in normalized.get("responses") or []:
        if isinstance(response, dict):
            out.extend(fact for fact in response.get("facts") or [] if isinstance(fact, dict))
    return out


def _build_document_registry(
    manifest: dict[str, Any],
    classifications: dict[str, Any],
) -> dict[str, Any]:
    class_by_id = {
        str(row.get("sourceDocumentId")): row
        for row in classifications.get("documents") or []
        if isinstance(row, dict)
    }
    documents = []
    for row in manifest.get("files") or []:
        if not isinstance(row, dict):
            continue
        cls = class_by_id.get(str(row.get("sourceDocumentId")), {})
        classification = str(cls.get("classification") or "unknown")
        documents.append(
            {
                "sourceDocumentId": row.get("sourceDocumentId"),
                "relativePath": row.get("relativePath"),
                "absolutePath": row.get("absolutePath"),
                "sha256": row.get("sha256"),
                "kind": row.get("kind"),
                "pageCount": ((row.get("pdf") or {}).get("pageCount") if isinstance(row.get("pdf"), dict) else None),
                "classification": classification,
                "classificationConfidence": cls.get("confidence", 0),
                "classificationRoles": cls.get("classificationRoles") or [],
                "secondaryClassifications": cls.get("secondaryClassifications") or [],
                "roleInModeling": _role_for_classification(classification),
                "status": "unknown_needs_review" if classification == "unknown" else "accepted_for_modeling",
                "method": cls.get("method"),
            }
        )
    return {
        "format": "reverseBimSourceDocumentRegistry_v1",
        "documentCount": len(documents),
        "documents": documents,
    }


def _build_source_page_index(
    *,
    rendered_pages: list[dict[str, Any]],
    classifications: dict[str, Any],
    text_extractions: list[dict[str, Any]],
    coordinate_frames: dict[str, Any],
) -> dict[str, Any]:
    class_by_path = {
        str(row.get("sourcePath")): row
        for row in classifications.get("documents") or []
        if isinstance(row, dict)
    }
    text_by_path_page = {}
    for extraction in text_extractions:
        if not isinstance(extraction, dict):
            continue
        for page in extraction.get("pages") or []:
            if isinstance(page, dict):
                text_by_path_page[(str(extraction.get("sourcePath")), int(page.get("page") or 0))] = page
    frame_by_page = {
        str(frame.get("sourcePageId")): frame.get("coordinateFrameId")
        for frame in coordinate_frames.get("coordinateFrames") or []
        if isinstance(frame, dict)
    }
    rows = []
    for render in rendered_pages:
        if not isinstance(render, dict):
            continue
        source_path = str(render.get("sourcePath") or "")
        cls = class_by_path.get(source_path, {})
        for page in render.get("pages") or []:
            if not isinstance(page, dict):
                continue
            page_num = int(page.get("page") or 0)
            source_page_id = f"{cls.get('sourceDocumentId') or source_path}:p{page_num}"
            image = page.get("image") if isinstance(page.get("image"), dict) else {}
            text_page = text_by_path_page.get((source_path, page_num), {})
            rows.append(
                {
                    "sourcePageId": source_page_id,
                    "sourceDocumentId": cls.get("sourceDocumentId"),
                    "page": page_num,
                    "classification": cls.get("classification") or "unknown",
                    "classificationRoles": cls.get("classificationRoles") or [],
                    "matchedClassifications": [
                        role.get("classification")
                        for role in cls.get("classificationRoles") or []
                        if isinstance(role, dict) and role.get("classification")
                    ],
                    "renderedPagePath": page.get("path"),
                    "widthPx": image.get("widthPx"),
                    "heightPx": image.get("heightPx"),
                    "dpi": render.get("dpi"),
                    "sha256": page.get("sha256"),
                    "nativeTextAvailable": bool(str(text_page.get("text") or "").strip()),
                    "coordinateFrameId": frame_by_page.get(source_page_id),
                    "modelingUse": _modeling_use_for_classification(str(cls.get("classification") or "unknown")),
                    "modelingUses": sorted(
                        {
                            _modeling_use_for_classification(label)
                            for label in _classification_labels(cls)
                            if _modeling_use_for_classification(label) != "ignored_with_reason"
                        }
                    ),
                }
            )
    return {
        "format": "reverseBimSourcePageIndex_v1",
        "sourcePageCount": len(rows),
        "pages": rows,
    }


def _build_coordinate_frames(
    *,
    rendered_pages: list[dict[str, Any]],
    classifications: dict[str, Any],
    text_extractions: list[dict[str, Any]],
) -> dict[str, Any]:
    class_by_path = {
        str(row.get("sourcePath")): row
        for row in classifications.get("documents") or []
        if isinstance(row, dict)
    }
    scale_by_path = _scale_candidates_by_path(text_extractions)
    frames = []
    for render in rendered_pages:
        source_path = str(render.get("sourcePath") or "")
        cls = class_by_path.get(source_path, {})
        primary_classification = str(cls.get("classification") or "unknown")
        frame_classification_set = {"floor_plan", "section", "elevation", "site_plan", "drainage_doc"}
        frame_classifications = (
            sorted(_classification_labels(cls) & frame_classification_set)
            if primary_classification in frame_classification_set
            else []
        )
        if not frame_classifications:
            continue
        for page in render.get("pages") or []:
            if not isinstance(page, dict):
                continue
            page_num = int(page.get("page") or 0)
            source_page_id = f"{cls.get('sourceDocumentId') or source_path}:p{page_num}"
            scale = scale_by_path.get((source_path, page_num)) or {}
            for classification in frame_classifications:
                suffix = "" if len(frame_classifications) == 1 else f"-{classification}"
                frames.append(
                    {
                        "coordinateFrameId": f"frame-{cls.get('sourceDocumentId')}-p{page_num}{suffix}",
                        "sourcePageId": source_page_id,
                        "sourceDocumentId": cls.get("sourceDocumentId"),
                        "page": page_num,
                        "classification": classification,
                        "classificationRoles": cls.get("classificationRoles") or [],
                        "status": "candidate_needs_alignment",
                        "scale": scale.get("scale") or ("1:100" if classification in {"floor_plan", "section", "elevation", "drainage_doc"} else None),
                        "mmPerPaperUnit": scale.get("mmPerPaperUnit"),
                        "originPx": None,
                        "rotationDeg": 0,
                        "modelOriginMm": None,
                        "levelOrSiteAssociation": _level_or_site_association(classification, source_path),
                        "confidence": 0.5 if scale else 0.35,
                        "notes": [
                            "Generated as a candidate frame. A modeling-ready run must align origin/rotation and confirm scale before geometry authoring."
                        ],
                    }
                )
    return {
        "format": "reverseBimCoordinateFrames_v1",
        "coordinateFrameCount": len(frames),
        "coordinateFrames": frames,
    }


def _scale_candidates_by_path(text_extractions: list[dict[str, Any]]) -> dict[tuple[str, int], dict[str, Any]]:
    out: dict[tuple[str, int], dict[str, Any]] = {}
    for extraction in text_extractions:
        if not isinstance(extraction, dict):
            continue
        source_path = str(extraction.get("sourcePath") or "")
        for page in extraction.get("pages") or []:
            if not isinstance(page, dict):
                continue
            detection = detect_scale_from_text(str(page.get("text") or ""))
            candidates = detection.get("candidates") if isinstance(detection.get("candidates"), list) else []
            if candidates:
                out[(source_path, int(page.get("page") or 0))] = candidates[0]
    return out


def _build_source_fact_ledger(facts: list[dict[str, Any]]) -> dict[str, Any]:
    rows = []
    for fact in facts:
        kind = str(fact.get("kind") or "")
        rows.append(
            {
                **fact,
                "status": _canonical_fact_status(str(fact.get("status") or "candidate")),
                "scope": fact.get("scope") or "source_package",
                "modelingPhase": PHASE_BY_FACT_KIND.get(kind, "P0-source-inventory"),
                "conflictIds": fact.get("conflictIds") or ([] if kind != "conflict" else [str(fact.get("factId") or "")]),
                "notes": fact.get("notes") or [],
            }
        )
    return {
        "format": "reverseBimSourceFactLedger_v1",
        "factCount": len(rows),
        "factCountsByKind": dict(sorted(Counter(str(row.get("kind") or "") for row in rows).items())),
        "facts": rows,
    }


def _apply_conflict_dispositions_to_facts(
    facts: list[dict[str, Any]],
    conflicts: dict[str, Any],
) -> list[dict[str, Any]]:
    dispositions_by_fact_id: dict[str, dict[str, Any]] = {}
    for conflict in conflicts.get("conflicts") or []:
        if not isinstance(conflict, dict) or conflict.get("status") != "resolved":
            continue
        disposition = conflict.get("disposition") if isinstance(conflict.get("disposition"), dict) else {}
        for fact_id in conflict.get("sourceFactIds") or []:
            if fact_id:
                dispositions_by_fact_id[str(fact_id)] = {
                    "conflictId": conflict.get("conflictId"),
                    **disposition,
                }
    if not dispositions_by_fact_id:
        return facts
    out = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        disposition = dispositions_by_fact_id.get(str(fact.get("factId") or ""))
        if not disposition:
            out.append(fact)
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        out.append(
            {
                **fact,
                "status": "resolved",
                "value": {
                    **value,
                    "disposition": disposition,
                },
            }
        )
    return out


def _apply_site_terrain_decisions_to_facts(
    facts: list[dict[str, Any]],
    site_terrain: dict[str, Any],
) -> list[dict[str, Any]]:
    dispositions_by_fact_id: dict[str, dict[str, Any]] = {}
    for action in site_terrain.get("actions") or []:
        if not isinstance(action, dict) or action.get("status") != "resolved_with_decision":
            continue
        fact_id = action.get("factId")
        disposition = action.get("disposition") if isinstance(action.get("disposition"), dict) else {}
        if fact_id and disposition:
            dispositions_by_fact_id[str(fact_id)] = {
                "actionId": action.get("id"),
                "actionKind": action.get("kind"),
                **disposition,
            }
    if not dispositions_by_fact_id:
        return facts
    out = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        disposition = dispositions_by_fact_id.get(str(fact.get("factId") or ""))
        if not disposition:
            out.append(fact)
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        out.append(
            {
                **fact,
                "status": "resolved",
                "value": {
                    **value,
                    "disposition": disposition,
                },
            }
        )
    return out


def _build_conflict_ledger(
    facts: list[dict[str, Any]],
    *,
    loop: dict[str, Any],
) -> dict[str, Any]:
    conflicts = []
    for fact in facts:
        if not isinstance(fact, dict) or fact.get("kind") != "conflict":
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        conflicts.append(
            {
                "conflictId": fact.get("factId"),
                "topic": value.get("topic") or "unspecified source conflict",
                "severity": "blocker",
                "candidates": value.get("candidates") or [],
                "recommendedDisposition": value.get("recommendedDisposition") or "ask_user",
                "status": "open",
                "sourceFactIds": [fact.get("factId")],
                "provenance": fact.get("provenance"),
            }
        )
    for repair in loop.get("repairRequests") or []:
        if not isinstance(repair, dict):
            continue
        conflicts.append(
            {
                "conflictId": f"repair-{repair.get('workPackageId')}",
                "topic": f"Work package requires source repair: {repair.get('workPackageId')}",
                "severity": "blocker",
                "candidates": [],
                "recommendedDisposition": "repair_ai_reader_response",
                "status": "open",
                "sourceFactIds": [],
                "findings": repair.get("findingsToFix") or [],
            }
        )
    return {
        "format": "reverseBimConflictLedger_v1",
        "conflictCount": len(conflicts),
        "openConflictCount": sum(1 for row in conflicts if row.get("status") == "open"),
        "conflicts": conflicts,
    }


def _build_resolver_worklist(readiness: dict[str, Any]) -> dict[str, Any]:
    items = []
    for row in readiness.get("rows") or []:
        if not isinstance(row, dict):
            continue
        for idx, requirement in enumerate(row.get("requiredBeforeMcp") or []):
            if not isinstance(requirement, dict) or not requirement.get("resolver"):
                continue
            items.append(
                {
                    "resolverId": f"resolver-{row.get('factId')}-{idx + 1}",
                    "factId": row.get("factId"),
                    "kind": row.get("kind"),
                    "resolver": requirement.get("resolver"),
                    "reason": requirement.get("reason"),
                    "input": {
                        "sourceFactId": row.get("factId"),
                        "mcpInputDraft": row.get("mcpInputDraft") or {},
                    },
                    "expectedOutput": _expected_resolver_output(str(requirement.get("resolver") or "")),
                    "onAmbiguous": "block_and_add_conflict",
                }
            )
    return {
        "format": "reverseBimResolverWorklist_v1",
        "itemCount": len(items),
        "items": items,
    }


def _build_phase_authoring_spec(
    *,
    facts: list[dict[str, Any]],
    readiness: dict[str, Any],
    authoring_plan: dict[str, Any],
    resolver_worklist: dict[str, Any],
    conflicts: dict[str, Any],
) -> dict[str, Any]:
    phase_fact_ids: dict[str, list[str]] = defaultdict(list)
    for fact in facts:
        phase_fact_ids[PHASE_BY_FACT_KIND.get(str(fact.get("kind") or ""), "P0-source-inventory")].append(
            str(fact.get("factId") or "")
        )
    actions_by_phase: dict[str, list[dict[str, Any]]] = defaultdict(list)
    readback_by_phase: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for action in authoring_plan.get("actions") or []:
        if not isinstance(action, dict):
            continue
        fact_id = str(action.get("factId") or "")
        fact = next((row for row in facts if str(row.get("factId") or "") == fact_id), {})
        phase = PHASE_BY_FACT_KIND.get(str(fact.get("kind") or ""), "P0-source-inventory")
        actions_by_phase[phase].append(action)
        if isinstance(action.get("expectedReadback"), dict):
            readback_by_phase[phase].append(action["expectedReadback"])
    resolvers_by_phase: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in resolver_worklist.get("items") or []:
        if not isinstance(item, dict):
            continue
        fact_id = str(item.get("factId") or "")
        fact = next((row for row in facts if str(row.get("factId") or "") == fact_id), {})
        phase = PHASE_BY_FACT_KIND.get(str(fact.get("kind") or ""), "P0-source-inventory")
        resolvers_by_phase[phase].append(item)
    readiness_by_fact = {
        str(row.get("factId") or ""): row
        for row in readiness.get("rows") or []
        if isinstance(row, dict)
    }
    phases = []
    for phase_id in PHASE_ORDER:
        fact_ids = phase_fact_ids.get(phase_id, [])
        phase_rows = [readiness_by_fact[fid] for fid in fact_ids if fid in readiness_by_fact]
        blocker_rows = [row for row in phase_rows if row.get("status") not in {"ready_for_mcp_authoring", "metadata_for_authoring", "reference_only"}]
        status = "ready" if fact_ids and not blocker_rows else "partial" if fact_ids else "blocked"
        if phase_id in {"P14-validation", "P15-final-acceptance"} and conflicts.get("openConflictCount"):
            status = "blocked"
        expected_readback = readback_by_phase.get(phase_id, [])
        phases.append(
            {
                "phaseId": phase_id,
                "status": status,
                "sourceFactIds": fact_ids,
                "authoringActions": actions_by_phase.get(phase_id, []),
                "resolverItems": resolvers_by_phase.get(phase_id, []),
                "requiredQueriesBefore": ["model.summary", "query.levels", "query.types"],
                "requiredQueriesAfter": _required_queries_after_for_phase(expected_readback),
                "expectedReadback": expected_readback,
                "requiredQaAfter": ["qa.advisor", "qa.constructability", "qa.integrity_preflight"],
                "acceptanceChecks": _acceptance_checks_for_phase(phase_id),
                "blockers": blocker_rows,
            }
        )
    return {
        "format": "reverseBimPhaseAuthoringSpec_v1",
        "modelingTarget": {
            "scope": "target_building",
            "scopeDecisionFactId": "scope-decision-required",
            "unitSystem": "millimeters",
            "coordinateFrameId": "model-frame-required",
        },
        "phases": phases,
    }


def _build_source_completeness_report(
    *,
    work_order: dict[str, Any],
    loop: dict[str, Any],
) -> dict[str, Any]:
    results_by_package = {
        str(row.get("workPackageId")): row
        for row in loop.get("packageResults") or []
        if isinstance(row, dict)
    }
    rows = []
    for wp in work_order.get("workPackages") or []:
        if not isinstance(wp, dict):
            continue
        package_id = str(wp.get("id") or "")
        result = results_by_package.get(package_id, {})
        required = list(wp.get("blockingRequiredFactKinds") or AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE.get(package_id, []))
        counts = result.get("factCountsByKind") if isinstance(result.get("factCountsByKind"), dict) else {}
        missing = [kind for kind in required if int(counts.get(kind) or 0) == 0]
        rows.append(
            {
                "workPackageId": package_id,
                "title": wp.get("title"),
                "status": result.get("status") or "waiting_for_ai_reader",
                "requiredFactKinds": required,
                "factCountsByKind": counts,
                "missingRequiredFactKinds": missing,
                "findings": result.get("findings") or [],
            }
        )
    blockers = [row for row in rows if row["status"] != "accepted" or row["missingRequiredFactKinds"]]
    return {
        "ok": not blockers,
        "format": "reverseBimSourceCompletenessReport_v1",
        "summary": {
            "workPackageCount": len(rows),
            "blockedWorkPackageCount": len(blockers),
            "acceptedWorkPackageCount": sum(1 for row in rows if row["status"] == "accepted"),
        },
        "workPackages": rows,
        "blockers": blockers,
    }


def _build_open_repair_requests(
    *,
    loop: dict[str, Any],
    room_topology: dict[str, Any],
    source_building_scope: dict[str, Any] | None = None,
    source_level_completeness: dict[str, Any] | None = None,
    source_area_consistency: dict[str, Any] | None = None,
    site_terrain: dict[str, Any] | None = None,
    roof_dormer: dict[str, Any] | None = None,
    source_material_assemblies: dict[str, Any] | None = None,
    reader_consensus: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    requests = [row for row in loop.get("repairRequests") or [] if isinstance(row, dict)]
    source_building_scope = source_building_scope or {}
    for action in source_building_scope.get("actions") or []:
        if not isinstance(action, dict) or not str(action.get("status") or "").startswith("blocked"):
            continue
        requests.append(
            {
                "repairRequestId": f"building-scope-{action.get('blockingCode') or action.get('id')}",
                "kind": action.get("kind") or "building_scope_repair",
                "workPackageId": "wp-dimensional-floorplans",
                "sourceFactIds": action.get("sourceFactIds") or [],
                "status": "open",
                "requiredFields": action.get("requiredSourceFields") or [],
                "findingsToFix": action.get("findingsToFix") or [],
                "sourcePrompt": action.get("sourcePrompt"),
            }
        )
    source_level_completeness = source_level_completeness or {}
    for level in source_level_completeness.get("blockers") or []:
        if not isinstance(level, dict):
            continue
        requests.append(
            {
                "repairRequestId": f"source-level-{level.get('levelId') or level.get('status')}",
                "kind": "source_level_completeness_repair",
                "workPackageId": "wp-dimensional-floorplans",
                "sourceFactId": level.get("sourceFactId"),
                "levelId": level.get("levelId"),
                "status": "open",
                "requiredFields": [
                    "physical wall chains or floor boundary facts for the level",
                    "room boundary facts for all visible rooms on the level",
                    "opening/stair/slab-opening facts where visible",
                    "explicit source disposition if the level has no physical modeled content",
                ],
                "findingsToFix": level.get("blockingReasons") or [],
                "sourcePrompt": (
                    "Re-read the floor plan, basement/cellar documents, sections, and area schedule "
                    "for this level. Return physical wall/room/floor/opening/stair facts for the level, "
                    "or explicitly state with provenance that the source contains no modeled content."
                ),
                "provenance": level.get("provenance"),
            }
        )
    for room in room_topology.get("rooms") or []:
        if not isinstance(room, dict) or not room.get("requiredBeforeMcp"):
            continue
        requests.append(
            {
                "repairRequestId": f"room-topology-{room.get('roomFactId')}",
                "kind": "room_topology_source_repair",
                "workPackageId": "wp-dimensional-floorplans",
                "sourceFactId": room.get("roomFactId"),
                "levelId": room.get("levelId"),
                "roomName": room.get("name"),
                "status": "open",
                "requiredFields": [
                    "one backing wall, partition, or room separation reference per boundary edge",
                    "door/opening/circulation access refs with host wall or boundary edge",
                    "adjacent room or circulation target for each access",
                    "source-page region/provenance for every access and backing decision",
                ],
                "findingsToFix": room.get("requiredBeforeMcp") or [],
                "sourcePrompt": (
                    "Re-read the floor plan visually for this room. Return boundaryEdges with "
                    "backingWallRef or roomSeparationRef, plus doorRefs/openingRefs/access data. "
                    "Do not infer hidden doors or walls; mark unavailable if not visible."
                ),
                "provenance": room.get("provenance"),
            }
        )
    source_area_consistency = source_area_consistency or {}
    for blocker in source_area_consistency.get("blockers") or []:
        if not isinstance(blocker, dict):
            continue
        requests.append(
            {
                "repairRequestId": f"source-area-{blocker.get('factId') or blocker.get('code')}",
                "kind": "source_area_consistency_repair",
                "workPackageId": "wp-area-volume-schedules",
                "sourceFactId": blocker.get("factId"),
                "status": "open",
                "requiredFields": [
                    "all visible room area rows for the affected level",
                    "modelable room boundary facts for every area row that represents a room",
                    "explicit area basis/disposition when source schedule totals cannot equal room labels",
                    "source-page region/provenance for every repaired area fact",
                ],
                "findingsToFix": [blocker],
                "sourcePrompt": (
                    "Re-read the area calculation and corresponding floor plan visually. "
                    "Return every room area row and every visible room label for this level, "
                    "then state whether the level subtotal equals the modeled room set. "
                    "Do not invent missing rooms; mark missing or conflicting source evidence explicitly."
                ),
            }
        )
    site_terrain = site_terrain or {}
    for action in site_terrain.get("actions") or []:
        if not isinstance(action, dict) or not str(action.get("status") or "").startswith("blocked"):
            continue
        requests.append(
            {
                "repairRequestId": f"site-terrain-{action.get('id')}",
                "kind": action.get("kind"),
                "workPackageId": "wp-site-parcel-terrain",
                "sourceFactId": action.get("factId"),
                "status": "open",
                "requiredFields": action.get("requiredSourceFields") or [],
                "missingFields": action.get("missingFields") or [],
                "findingsToFix": [
                    {
                        "code": action.get("kind"),
                        "message": "Site, parcel, terrain, or building-placement source data is not modeling-ready.",
                    }
                ],
                "sourcePrompt": action.get("sourcePrompt"),
                "provenance": action.get("provenance"),
            }
        )
    roof_dormer = roof_dormer or {}
    for action in roof_dormer.get("actions") or []:
        if not isinstance(action, dict) or not str(action.get("status") or "").startswith("blocked"):
            continue
        requests.append(
            {
                "repairRequestId": f"roof-dormer-{action.get('id')}",
                "kind": action.get("kind"),
                "workPackageId": "wp-sections-elevations-roof",
                "sourceFactId": action.get("factId"),
                "status": "open",
                "requiredFields": action.get("requiredSourceFields") or [],
                "missingFields": action.get("missingFields") or [],
                "findingsToFix": [
                    {
                        "code": action.get("kind"),
                        "message": "Roof, dormer, or roof-opening source geometry is not modeling-ready.",
                    }
                ],
                "sourcePrompt": action.get("sourcePrompt"),
                "provenance": action.get("provenance"),
            }
        )
    source_material_assemblies = source_material_assemblies or {}
    for scope in source_material_assemblies.get("assemblyScopes") or []:
        if not isinstance(scope, dict) or scope.get("status") != "blocked_needs_source_or_disposition":
            continue
        requests.append(
            {
                "repairRequestId": f"source-material-{scope.get('scopeKey')}",
                "kind": "source_material_assembly_repair",
                "workPackageId": "wp-current-condition",
                "sourceFactIds": scope.get("sourceFactIds") or [],
                "modelableFactIds": scope.get("modelableFactIds") or [],
                "status": "open",
                "requiredFields": [
                    "material.elementScope matching the wall/floor/roof source fact id or scope label",
                    "material.materialName and construction/assembly name when visible",
                    "material.layerStack/layers with thicknessMm per layer when available",
                    "wall_thickness.thicknessMm for wall scopes",
                    "explicit disposition.decision=tolerate_unavailable with reason when sources lack layer details",
                    "source-page region/provenance for every material or unavailable-source decision",
                ],
                "findingsToFix": scope.get("requiredBeforeMcp") or [],
                "sourcePrompt": (
                    "Re-read construction descriptions, energy documents, plans, sections, and photos for this "
                    "wall/floor/roof scope. Return material facts that reference the exact elementScope, "
                    "including layerStack where the source gives it. If the source folder does not contain "
                    "the layer stack, return a material fact with disposition.decision=tolerate_unavailable "
                    "and a concrete source-backed reason instead of guessing."
                ),
                "provenance": scope.get("provenance") or [],
            }
        )
    reader_consensus = reader_consensus or {}
    for blocker in reader_consensus.get("blockers") or []:
        if not isinstance(blocker, dict):
            continue
        requests.append(
            {
                "repairRequestId": f"reader-consensus-{blocker.get('code')}-{blocker.get('workPackageId') or blocker.get('matchKey')}",
                "kind": "reader_consensus_repair",
                "workPackageId": blocker.get("workPackageId"),
                "status": "open",
                "requiredFields": [
                    "a second independent reader response for each critical work package",
                    "or a deterministic cross-check/disposition that explains why one reader pass is sufficient",
                    "reconciled critical fact values when readers disagree",
                ],
                "findingsToFix": [blocker],
                "sourcePrompt": (
                    "Dispatch another independent multimodal reader for the affected work package, "
                    "then reconcile any disagreed critical facts explicitly before MCP authoring."
                ),
            }
        )
    return requests


def _build_source_repair_plan(
    *,
    run_summary: dict[str, Any],
    acceptance: dict[str, Any],
    reader_assignment_progress: dict[str, Any],
    repair_requests_open: dict[str, Any],
    coordinate_frame_worklist: dict[str, Any],
) -> dict[str, Any]:
    """Prioritize source-understanding repair before MCP authoring.

    The raw repair request list can be intentionally granular. This plan is the
    compact handoff a future agent should follow before trying to model.
    """

    acceptance_summary = (
        acceptance.get("summary") if isinstance(acceptance.get("summary"), dict) else {}
    )
    progress_rows = [
        row
        for row in reader_assignment_progress.get("rows") or []
        if isinstance(row, dict)
    ]
    repair_requests = [
        row
        for row in repair_requests_open.get("requests") or []
        if isinstance(row, dict)
    ]
    request_counts_by_kind = Counter(
        str(row.get("kind") or row.get("workPackageId") or "source_package_repair")
        for row in repair_requests
    )
    waiting_assignments = [
        row
        for row in progress_rows
        if row.get("status") in {"waiting_for_reader", "response_invalid", "response_has_no_facts"}
    ]
    steps: list[dict[str, Any]] = []

    def add_step(
        step_id: str,
        *,
        title: str,
        blocker_count: int,
        work_package_ids: list[str] | None = None,
        artifacts: list[str] | None = None,
        instructions: list[str] | None = None,
        done_criteria: list[str] | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        steps.append(
            {
                "stepId": step_id,
                "title": title,
                "status": "blocked" if blocker_count else "not_needed",
                "blockerCount": blocker_count,
                "workPackageIds": sorted(set(work_package_ids or [])),
                "artifacts": artifacts or [],
                "instructions": instructions or [],
                "doneCriteria": done_criteria or [],
                "details": details or {},
            }
        )

    add_step(
        "SRP-001-reader-assignment-coverage",
        title="Finish or repair reader assignments before modeling",
        blocker_count=len(waiting_assignments),
        work_package_ids=[
            str(row.get("workPackageId") or "")
            for row in waiting_assignments
            if row.get("workPackageId")
        ],
        artifacts=[
            "ai-reading/reader-assignment-progress.json",
            "ai-reading/reader-dispatch.md",
            "ai-reading/assignments/**",
            "ai-reading/responses/**",
        ],
        instructions=[
            "Dispatch each waiting assignment to a multimodal subagent or optional command adapter.",
            "Markdown responses are acceptable only when they include a fenced JSON source-fact block.",
            "Rerun folder-output with reset_output=false after responses are written.",
        ],
        done_criteria=[
            "readerAssignmentProgress.summary.waitingAssignmentCount == 0",
            "invalidResponseAssignmentCount == 0",
            "noFactResponseAssignmentCount == 0 for required packages",
        ],
        details={"assignments": waiting_assignments},
    )
    add_step(
        "SRP-002-reader-consensus",
        title="Resolve critical reader consensus conflicts",
        blocker_count=int(acceptance_summary.get("readerConsensusBlockerCount") or 0),
        work_package_ids=["wp-dimensional-floorplans", "wp-sections-elevations-roof", "wp-site-parcel-terrain", "wp-area-volume-schedules"],
        artifacts=["ai-reading/reader-consensus.json", "ai-reading/repair-requests.open.json"],
        instructions=[
            "Compare conflicting critical fact groups across independent reader passes.",
            "Either add a focused independent reader response or record a deterministic source-backed disposition.",
        ],
        done_criteria=["readerConsensus.summary.blockingCount == 0"],
    )
    add_step(
        "SRP-003-coordinate-frames",
        title="Align source pages into model coordinates",
        blocker_count=int(acceptance_summary.get("coordinateFrameAlignmentBlockerCount") or 0),
        artifacts=["understanding/coordinate-frame-worklist.json", "understanding/coordinate-frames.json"],
        instructions=[
            "For each plan/section/elevation/site frame, identify source control points and model coordinates.",
            "Do not author wall or site geometry from a page until its frame is aligned or explicitly source-limited.",
        ],
        done_criteria=["validation/coordinate-frame-report.json has no blocking alignments"],
        details={"classificationCounts": (coordinate_frame_worklist.get("summary") or {}).get("classificationCounts")},
    )
    add_step(
        "SRP-004-level-and-floorplan-physics",
        title="Repair physical level, wall, room, and access facts",
        blocker_count=(
            int(acceptance_summary.get("emptySourceLevelCount") or 0)
            + int(acceptance_summary.get("missingSourceLevelFacts") or 0)
            + int(acceptance_summary.get("missingRoomAccessRefCount") or 0)
            + int(acceptance_summary.get("missingAdjacentRoomRefCount") or 0)
        ),
        work_package_ids=["wp-dimensional-floorplans"],
        artifacts=[
            "understanding/source-level-completeness.json",
            "understanding/room-topology.json",
            "ai-reading/repair-requests.open.json",
        ],
        instructions=[
            "Re-read floor plans for real walls, partitions, room boundaries, openings, stairs, and access/adjacency.",
            "Do not let analytical room labels substitute for physical topology.",
        ],
        done_criteria=[
            "source-level-completeness.summary.blockingCount == 0",
            "room-topology has no missing access or adjacency refs",
        ],
    )
    add_step(
        "SRP-005-area-schedule-reconciliation",
        title="Reconcile room/area schedule facts with plan topology",
        blocker_count=int(acceptance_summary.get("sourceAreaConsistencyBlockerCount") or 0),
        work_package_ids=["wp-area-volume-schedules", "wp-dimensional-floorplans"],
        artifacts=["understanding/source-area-consistency.json", "ai-reading/repair-requests.open.json"],
        instructions=[
            "Bind each area schedule row to a room/source boundary or mark it context/reference-only.",
            "Record area basis and source-limited dispositions; do not invent missing room geometry.",
        ],
        done_criteria=["source-area-consistency.summary.blockingCount == 0"],
    )
    add_step(
        "SRP-006-roof-site-materials",
        title="Repair roof, site/terrain, and material assembly readiness",
        blocker_count=(
            int(acceptance_summary.get("roofDormerBlockerCount") or 0)
            + int(acceptance_summary.get("siteTerrainBlockerCount") or 0)
            + int(acceptance_summary.get("sourceMaterialAssemblyBlockerCount") or 0)
        ),
        work_package_ids=[
            "wp-sections-elevations-roof",
            "wp-site-parcel-terrain",
            "wp-current-condition",
        ],
        artifacts=[
            "understanding/roof-dormer.json",
            "understanding/site-terrain.json",
            "understanding/material-assemblies.json",
        ],
        instructions=[
            "Use elevations/sections for roof and dormer geometry.",
            "Use site/parcel pages for property and placement; source-limit terrain only when numeric evidence is unavailable.",
            "Use construction/energy/current-condition documents for material layers or explicit unavailable-source dispositions.",
        ],
        done_criteria=[
            "roof-dormer.summary.blockedActionCount == 0",
            "site-terrain.summary.blockedActionCount == 0",
            "material-assemblies.summary.blockedAssemblyCount == 0",
        ],
    )
    add_step(
        "SRP-007-mcp-handoff-readiness",
        title="Regenerate MCP handoff only after source blockers clear",
        blocker_count=int(acceptance_summary.get("hardMcpReadinessBlockerCount") or 0),
        artifacts=["mcp-handoff/mcp-readiness.json", "mcp-handoff/phase-authoring-spec.json"],
        instructions=[
            "Rerun folder-output after source repairs.",
            "Proceed to MCP dry-run/commit only for facts marked ready or resolver-ready.",
        ],
        done_criteria=[
            "validation/package-acceptance-report.json has no source-understanding errors",
            "mcp-handoff/phase-authoring-spec.json contains ready slices",
        ],
    )

    blocked_steps = [step for step in steps if step["status"] == "blocked"]
    return {
        "ok": not blocked_steps,
        "format": "reverseBimSourceRepairPlan_v1",
        "packageState": run_summary.get("packageState"),
        "summary": {
            "stepCount": len(steps),
            "blockedStepCount": len(blocked_steps),
            "openRepairRequestCount": len(repair_requests),
            "repairRequestCountsByKind": dict(sorted(request_counts_by_kind.items())),
        },
        "steps": steps,
        "nextStep": (
            "Resolve blocked source-repair steps in order, then rerun folder-output with reset_output=false."
            if blocked_steps
            else "Source repair plan is clear; proceed to MCP handoff readiness."
        ),
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
        instructions = step.get("instructions") if isinstance(step.get("instructions"), list) else []
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


def _build_package_acceptance_report(
    *,
    raw_responses: dict[str, Any],
    loop: dict[str, Any],
    readiness: dict[str, Any],
    conflicts: dict[str, Any],
    source_completeness: dict[str, Any],
    room_topology: dict[str, Any],
    source_area_consistency: dict[str, Any],
    coordinate_frame_alignment_report: dict[str, Any],
    site_terrain: dict[str, Any] | None = None,
    roof_dormer: dict[str, Any] | None = None,
    source_material_assemblies: dict[str, Any] | None = None,
    reader_consensus: dict[str, Any] | None = None,
    source_level_completeness: dict[str, Any] | None = None,
    source_building_scope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    findings = []
    response_file_error_count = int(raw_responses.get("responseFileErrorCount") or 0)
    if response_file_error_count > 0:
        findings.append(
            {
                "code": "folder_output_reader_response_files_invalid",
                "severity": "error",
                "message": (
                    f"{response_file_error_count} AI-reader response file error(s) were found. "
                    "Fix or remove malformed response files before source-understanding acceptance."
                ),
            }
        )
    if int(raw_responses.get("responseCount") or 0) == 0:
        findings.append(
            {
                "code": "folder_output_reader_responses_missing",
                "severity": "error",
                "message": "No AI-reader responses were supplied; package is source-packaged but not source-understood.",
            }
        )
    if not source_completeness.get("ok"):
        findings.append(
            {
                "code": "folder_output_source_completeness_blocked",
                "severity": "error",
                "message": "One or more source-reading work packages are incomplete.",
            }
        )
    hard_mcp_blocker_count = _hard_mcp_readiness_blocker_count(readiness)
    if hard_mcp_blocker_count > 0:
        findings.append(
            {
                "code": "folder_output_mcp_readiness_blocked",
                "severity": "error",
                "message": (
                    "One or more facts require source refinement, conflict disposition, "
                    "or missing MCP tools before authoring."
                ),
            }
        )
    if int(conflicts.get("openConflictCount") or 0) > 0:
        findings.append(
            {
                "code": "folder_output_conflicts_open",
                "severity": "error",
                "message": "Open source conflicts remain.",
            }
        )
    source_building_scope = source_building_scope or {}
    source_building_scope_summary = (
        source_building_scope.get("summary")
        if isinstance(source_building_scope.get("summary"), dict)
        else {}
    )
    source_building_scope_blocker_count = int(source_building_scope_summary.get("blockingCount") or 0)
    if source_building_scope_blocker_count:
        findings.append(
            {
                "code": "folder_output_building_scope_unresolved",
                "severity": "error",
                "message": (
                    f"{source_building_scope_blocker_count} building-scope blocker(s) remain. "
                    "Resolve target/context scope before MCP authoring so the model is not built as the wrong house."
                ),
            }
        )
    source_level_completeness = source_level_completeness or {}
    source_level_summary = (
        source_level_completeness.get("summary")
        if isinstance(source_level_completeness.get("summary"), dict)
        else {}
    )
    empty_source_level_count = int(source_level_summary.get("emptySourceLevelCount") or 0)
    missing_source_level_facts = int(source_level_summary.get("missingSourceLevelFacts") or 0)
    if empty_source_level_count or missing_source_level_facts:
        findings.append(
            {
                "code": "folder_output_source_levels_incomplete",
                "severity": "error",
                "message": (
                    f"{empty_source_level_count} source-required level(s) lack physical source facts; "
                    f"missing source level fact set={missing_source_level_facts}."
                ),
            }
        )
    room_topology_summary = room_topology.get("summary") if isinstance(room_topology.get("summary"), dict) else {}
    rooms_needing_backing = int(room_topology_summary.get("roomsNeedingBackingCount") or 0)
    rooms_needing_access = int(room_topology_summary.get("roomsNeedingAccessCount") or 0)
    missing_access_ref_count = int(room_topology_summary.get("missingAccessRefCount") or 0)
    missing_adjacent_ref_count = int(room_topology_summary.get("missingAdjacentRoomRefCount") or 0)
    if rooms_needing_backing or rooms_needing_access or missing_access_ref_count or missing_adjacent_ref_count:
        findings.append(
            {
                "code": "folder_output_room_topology_incomplete",
                "severity": "error",
                "message": (
                    f"{rooms_needing_backing} room(s) need boundary backing and "
                    f"{rooms_needing_access} room(s) need access facts; "
                    f"{missing_access_ref_count} access ref(s) and "
                    f"{missing_adjacent_ref_count} adjacent room ref(s) are unresolved."
                ),
            }
        )
    source_area_summary = (
        source_area_consistency.get("summary")
        if isinstance(source_area_consistency.get("summary"), dict)
        else {}
    )
    source_area_blocker_count = int(source_area_summary.get("blockingCount") or 0)
    if source_area_blocker_count:
        findings.append(
            {
                "code": "folder_output_source_area_inconsistent",
                "severity": "error",
                "message": (
                    f"{source_area_blocker_count} source area consistency check(s) are blocked. "
                    "Repair room area rows, level totals, or explicit area-basis dispositions before MCP room authoring."
                ),
            }
        )
    coordinate_frame_summary = (
        coordinate_frame_alignment_report.get("summary")
        if isinstance(coordinate_frame_alignment_report.get("summary"), dict)
        else {}
    )
    blocking_alignment_count = int(coordinate_frame_summary.get("blockingAlignmentCount") or 0)
    if blocking_alignment_count:
        findings.append(
            {
                "code": "folder_output_coordinate_frames_need_alignment",
                "severity": "error",
                "message": (
                    f"{blocking_alignment_count} geometry coordinate frame(s) need alignment "
                    "before geometry authoring."
                ),
            }
        )
    site_terrain = site_terrain or {}
    site_terrain_summary = site_terrain.get("summary") if isinstance(site_terrain.get("summary"), dict) else {}
    site_terrain_blocker_count = int(site_terrain_summary.get("blockedActionCount") or 0)
    if site_terrain_blocker_count:
        findings.append(
            {
                "code": "folder_output_site_terrain_incomplete",
                "severity": "error",
                "message": (
                    f"{site_terrain_blocker_count} site/parcel/terrain source action(s) need repair, "
                    "alignment, or explicit tolerance before site/topology authoring."
                ),
            }
        )
    roof_dormer = roof_dormer or {}
    roof_dormer_summary = (
        roof_dormer.get("summary") if isinstance(roof_dormer.get("summary"), dict) else {}
    )
    roof_dormer_blocker_count = int(roof_dormer_summary.get("blockedActionCount") or 0)
    if roof_dormer_blocker_count:
        findings.append(
            {
                "code": "folder_output_roof_dormer_incomplete",
                "severity": "error",
                "message": (
                    f"{roof_dormer_blocker_count} roof/dormer/opening source action(s) need "
                    "precise source geometry, section/elevation alignment, or explicit tolerance "
                    "before roof authoring."
                ),
            }
        )
    source_material_assemblies = source_material_assemblies or {}
    source_material_summary = (
        source_material_assemblies.get("summary")
        if isinstance(source_material_assemblies.get("summary"), dict)
        else {}
    )
    source_material_blocker_count = int(source_material_summary.get("blockedAssemblyCount") or 0)
    if source_material_blocker_count:
        findings.append(
            {
                "code": "folder_output_material_assemblies_incomplete",
                "severity": "error",
                "message": (
                    f"{source_material_blocker_count} wall/floor/roof material assembly scope(s) "
                    "need source-backed material/layer facts or an explicit source-unavailable disposition."
                ),
            }
        )
    reader_consensus = reader_consensus or {}
    reader_consensus_summary = (
        reader_consensus.get("summary")
        if isinstance(reader_consensus.get("summary"), dict)
        else {}
    )
    reader_consensus_blocker_count = int(reader_consensus_summary.get("blockingCount") or 0)
    if reader_consensus_blocker_count:
        findings.append(
            {
                "code": "folder_output_reader_consensus_blocked",
                "severity": "error",
                "message": (
                    f"{reader_consensus_blocker_count} reader consensus blocker(s) remain. "
                    "Critical source facts need independent agreement or explicit deterministic disposition."
                ),
            }
        )
    error_count = sum(1 for row in findings if row.get("severity") == "error")
    return {
        "ok": error_count == 0,
        "format": "reverseBimFolderOutputAcceptanceReport_v1",
        "packageState": _package_state(raw_responses=raw_responses, loop=loop, readiness=readiness, findings=findings),
        "summary": {
            "errorCount": error_count,
            "warningCount": len(findings) - error_count,
            "openConflictCount": conflicts.get("openConflictCount", 0),
            "mcpReadinessBlockerCount": (readiness.get("summary") or {}).get("blockerCount", 0),
            "hardMcpReadinessBlockerCount": hard_mcp_blocker_count,
            "buildingScopeBlockerCount": source_building_scope_blocker_count,
            "targetScopeFactCount": source_building_scope_summary.get("targetScopeFactCount", 0),
            "contextScopeFactCount": source_building_scope_summary.get("contextScopeFactCount", 0),
            "resolvedTargetScopeType": source_building_scope_summary.get("resolvedTargetScopeType"),
            "emptySourceLevelCount": empty_source_level_count,
            "missingSourceLevelFacts": missing_source_level_facts,
            "roomsNeedingBoundaryBackingCount": rooms_needing_backing,
            "roomsNeedingAccessFactCount": rooms_needing_access,
            "missingRoomAccessRefCount": missing_access_ref_count,
            "missingAdjacentRoomRefCount": missing_adjacent_ref_count,
            "sourceAreaConsistencyBlockerCount": source_area_blocker_count,
            "coordinateFrameAlignmentBlockerCount": blocking_alignment_count,
            "siteTerrainBlockerCount": site_terrain_blocker_count,
            "roofDormerBlockerCount": roof_dormer_blocker_count,
            "sourceMaterialAssemblyBlockerCount": source_material_blocker_count,
            "readerConsensusBlockerCount": reader_consensus_blocker_count,
            "readerResponseCount": raw_responses.get("responseCount", 0),
            "readerResponseFileCount": raw_responses.get("responseFileCount", 0),
            "readerResponseFileErrorCount": raw_responses.get("responseFileErrorCount", 0),
        },
        "findings": findings,
    }


def _build_run_summary(
    *,
    source_folder: Path,
    output_dir: Path,
    manifest: dict[str, Any],
    rendered_pages: list[dict[str, Any]],
    work_order: dict[str, Any],
    loop: dict[str, Any],
    normalized: dict[str, Any],
    readiness: dict[str, Any],
    conflicts: dict[str, Any],
    acceptance: dict[str, Any],
    raw_responses: dict[str, Any] | None = None,
    agent_requests: dict[str, Any] | None = None,
    reader_pass_manifest: dict[str, Any] | None = None,
    reader_assignment_progress: dict[str, Any] | None = None,
) -> dict[str, Any]:
    package_state = str(acceptance.get("packageState") or "source_understanding_blocked")
    reader_assignment_summary = (
        reader_pass_manifest.get("summary")
        if isinstance(reader_pass_manifest, dict) and isinstance(reader_pass_manifest.get("summary"), dict)
        else {}
    )
    reader_progress_summary = (
        reader_assignment_progress.get("summary")
        if isinstance(reader_assignment_progress, dict)
        and isinstance(reader_assignment_progress.get("summary"), dict)
        else {}
    )
    return {
        "format": "reverseBimFolderOutputRunSummary_v1",
        "sourceFolder": str(source_folder),
        "outputDir": str(output_dir),
        "createdAt": datetime.now(UTC).isoformat(),
        "packageState": package_state,
        "sourceManifestDigestSha256": manifest.get("manifestDigestSha256"),
        "summary": {
            "sourceDocumentCount": manifest.get("fileCount", 0),
            "renderedPageCount": sum(len(row.get("pages") or []) for row in rendered_pages if isinstance(row, dict)),
            "workPackageCount": len(work_order.get("workPackages") or []),
            "readerRequestCount": (
                (agent_requests or {}).get("readerRequestCount")
                or len((agent_requests or {}).get("requests") or [])
            ),
            "readerAssignmentCount": reader_assignment_summary.get("assignmentCount", 0),
            "openReaderAssignmentCount": reader_progress_summary.get(
                "waitingAssignmentCount",
                reader_assignment_summary.get("waitingAssignmentCount", 0),
            ),
            "invalidReaderAssignmentCount": reader_progress_summary.get("invalidResponseAssignmentCount", 0),
            "noFactReaderAssignmentCount": reader_progress_summary.get("noFactResponseAssignmentCount", 0),
            "readerAssignmentWithFactsCount": reader_progress_summary.get("assignmentWithFactsCount", 0),
            "readerResponseCount": (raw_responses or {}).get("responseCount", 0),
            "readerResponseFileCount": (raw_responses or {}).get("responseFileCount", 0),
            "readerResponseFileScannedCount": (raw_responses or {}).get("scannedResponseFileCount", 0),
            "readerResponseFileErrorCount": (raw_responses or {}).get("responseFileErrorCount", 0),
            "acceptedWorkPackageCount": (loop.get("summary") or {}).get("acceptedPackageCount", 0),
            "normalizedFactCount": (normalized.get("summary") or {}).get("normalizedFactCount", 0),
            "mcpReadyFactCount": (readiness.get("summary") or {}).get("readyForMcpAuthoringCount", 0),
            "resolverNeededFactCount": (readiness.get("summary") or {}).get("needsResolverCount", 0),
            "sourceRefinementNeededFactCount": (readiness.get("summary") or {}).get("needsSourceRefinementCount", 0),
            "openConflictCount": conflicts.get("openConflictCount", 0),
            "openBlockerCount": len(acceptance.get("findings") or []),
        },
        "nextAgentInstruction": _next_agent_instruction(package_state),
    }


def _package_state(
    *,
    raw_responses: dict[str, Any],
    loop: dict[str, Any],
    readiness: dict[str, Any],
    findings: list[dict[str, Any]],
) -> str:
    if int(raw_responses.get("responseCount") or 0) == 0:
        return "source_packaging_ready"
    loop_summary = loop.get("summary") if isinstance(loop.get("summary"), dict) else {}
    if loop_summary.get("waitingPackageCount") or loop_summary.get("needsRevisionPackageCount"):
        return "source_understanding_blocked"
    if _hard_mcp_readiness_blocker_count(readiness) > 0:
        return "mcp_handoff_partial"
    if any(row.get("severity") == "error" for row in findings):
        return "source_understanding_blocked"
    return "mcp_handoff_ready"


def _hard_mcp_readiness_blocker_count(readiness: dict[str, Any]) -> int:
    summary = readiness.get("summary") if isinstance(readiness.get("summary"), dict) else {}
    return (
        int(summary.get("needsSourceRefinementCount") or 0)
        + int(summary.get("needsResolverAndSourceRefinementCount") or 0)
        + int(summary.get("sourceConflictCount") or 0)
        + int(summary.get("missingMcpToolCount") or 0)
    )


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _role_for_classification(classification: str) -> str:
    return {
        "floor_plan": "primary_geometry",
        "section": "section_elevation_check",
        "elevation": "section_elevation_check",
        "site_plan": "site_parcel",
        "area_calculation": "area_reconciliation",
        "drainage_doc": "context_and_basement_services",
        "energy_doc": "materials_history",
        "photo": "photo_current_condition",
        "legal_admin": "legal_context",
        "construction_description": "materials_history",
    }.get(classification, "review_required")


def _modeling_use_for_classification(classification: str) -> str:
    return {
        "floor_plan": "primary_geometry",
        "section": "section_elevation_check",
        "elevation": "section_elevation_check",
        "site_plan": "site_parcel",
        "area_calculation": "area_reconciliation",
        "drainage_doc": "secondary_geometry_check",
        "energy_doc": "materials_history",
        "photo": "photo_current_condition",
        "legal_admin": "legal_context",
        "construction_description": "materials_history",
    }.get(classification, "ignored_with_reason")


def _classification_labels(row: dict[str, Any]) -> set[str]:
    labels = {str(row.get("classification") or "unknown")}
    for role in row.get("classificationRoles") or []:
        if isinstance(role, dict) and role.get("classification"):
            labels.add(str(role["classification"]))
    for label in row.get("secondaryClassifications") or []:
        if label:
            labels.add(str(label))
    return labels


def _level_or_site_association(classification: str, source_path: str) -> str:
    lower = source_path.lower()
    if classification == "site_plan":
        return "site"
    if "eg" in lower or "erdgeschoss" in lower:
        return "EG"
    if "dg" in lower or "dachgeschoss" in lower:
        return "DG"
    if "keller" in lower or "entw" in lower:
        return "KG"
    return "unknown"


def _canonical_fact_status(status: str) -> str:
    if status in {"observed", "extracted", "observed_with_uncertainty", "inferred", "uncertain"}:
        return "candidate"
    if status in {"open_uncertainty", "conflict"}:
        return "conflicting"
    if status in {"accepted", "candidate", "conflicting", "deferred", "rejected", "superseded", "modeled"}:
        return status
    return "candidate"


def _expected_resolver_output(resolver: str) -> list[str]:
    if "wall" in resolver:
        return ["wallId", "alongT", "confidence", "candidates"]
    if "roof" in resolver:
        return ["hostRoofId", "hostPlane", "confidence", "candidates"]
    if "level" in resolver:
        return ["levelId", "confidence", "candidates"]
    return ["resolvedValue", "confidence", "candidates"]


def _required_queries_after_for_phase(expected_readback: list[dict[str, Any]]) -> list[str]:
    queries = {"model.summary"}
    for expectation in expected_readback:
        if not isinstance(expectation, dict):
            continue
        for query in expectation.get("querySurfaces") or []:
            if query:
                queries.add(str(query))
    return sorted(queries)


def _acceptance_checks_for_phase(phase_id: str) -> list[str]:
    checks = ["advisor_findings_disposed", "constructability_findings_disposed", "integrity_findings_disposed"]
    if "room" in phase_id:
        checks.append("room_areas_reconcile_to_source")
    if "opening" in phase_id:
        checks.append("all_openings_hosted_and_cut_hosts")
    if "stair" in phase_id:
        checks.append("stairs_have_required_slab_openings")
    if "terrain" in phase_id:
        checks.append("site_property_and_terrain_align_to_source")
    return checks


def _build_tolerance_policy() -> dict[str, Any]:
    return {
        "format": "reverseBimTolerancePolicy_v1",
        "rules": [
            {
                "id": "no_unresolved_errors",
                "severity": "error",
                "policy": "Final acceptance may not contain unresolved Advisor, constructability, integrity, or source-comparison errors.",
            },
            {
                "id": "source_limited_terrain",
                "severity": "warning",
                "policy": "Terrain may be reference-only when sources lack numeric contours/spot heights; do not invent toposolid points.",
            },
            {
                "id": "source_limited_openings",
                "severity": "error",
                "policy": "Doors/windows require host and normalized placement before authoring.",
            },
        ],
    }


def _next_agent_instruction(package_state: str) -> str:
    if package_state == "source_packaging_ready":
        return "Dispatch ai-reading/ai-visual-agent-requests.json to multimodal readers before modeling."
    if package_state == "source_understanding_blocked":
        return "Resolve ai-reading/repair-requests.open.json and validation/source-completeness-report.json before modeling blocked facts."
    if package_state == "mcp_handoff_partial":
        return "Use mcp-handoff/resolver-worklist.json and mcp-handoff/phase-authoring-spec.json; model only ready facts."
    if package_state == "mcp_handoff_ready":
        return "Use mcp-handoff/phase-authoring-spec.json to author through MCP dry-run/commit/query/QA phase gates."
    return "Inspect validation/package-acceptance-report.json."


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


def _write_reader_assignment_prompts(
    *,
    output_dir: Path,
    agent_requests: dict[str, Any],
    reader_pass_manifest: dict[str, Any],
) -> dict[str, Any]:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    requests_by_id = {
        str(row.get("requestId") or ""): row
        for row in agent_requests.get("requests") or []
        if isinstance(row, dict) and row.get("requestId")
    }
    prompts = []
    for assignment in reader_pass_manifest.get("assignments") or []:
        if not isinstance(assignment, dict):
            continue
        request_id = str(assignment.get("requestId") or "")
        request = requests_by_id.get(request_id, {})
        reader_pass_id = str(assignment.get("readerPassId") or "reader-pass-01")
        prompt_path = output_dir / reader_pass_id / f"{_safe_prompt_stem(request_id)}.md"
        prompt_path.parent.mkdir(parents=True, exist_ok=True)
        prompt_path.write_text(
            _reader_assignment_prompt_markdown(assignment, request),
            encoding="utf-8",
        )
        prompts.append(
            {
                "assignmentId": assignment.get("assignmentId"),
                "readerPassId": reader_pass_id,
                "workPackageId": assignment.get("workPackageId"),
                "requestId": request_id,
                "status": assignment.get("status"),
                "promptPath": str(prompt_path),
                "responsePathHint": assignment.get("responsePathHint"),
                "inputImageCount": assignment.get("inputImageCount", 0),
            }
        )
    return {
        "format": "sourceAiVisualTraceReaderAssignmentPrompts_v1",
        "runId": agent_requests.get("runId"),
        "promptCount": len(prompts),
        "prompts": prompts,
    }


def _reader_assignment_prompt_markdown(
    assignment: dict[str, Any],
    request: dict[str, Any],
) -> str:
    output_contract = request.get("outputContract") if isinstance(request.get("outputContract"), dict) else {}
    required_fields = output_contract.get("requiredValueFieldsByKind") or {}
    blocking_kinds = output_contract.get("blockingRequiredFactKinds") or []
    lines = [
        "# Reverse-BIM Reader Assignment",
        "",
        f"Assignment: `{assignment.get('assignmentId')}`",
        f"Reader pass: `{assignment.get('readerPassId')}`",
        f"Work package: `{assignment.get('workPackageId')}`",
        f"Request: `{assignment.get('requestId')}`",
        f"Request part: {assignment.get('requestPartIndex')}/{assignment.get('requestPartCount')}",
        f"Status: `{assignment.get('status')}`",
        "",
        "Do not author BIM and do not emit model commands.",
        "",
        (
            "Preferred mode is multimodal AI/subagent reading: inspect the rendered page images visually, "
            "write down what the documents actually say, then include one structured source-fact JSON block. "
            "A vendor API command is optional and is not the methodology."
        ),
        "",
        "## Write Response To",
        "",
        f"`{assignment.get('responsePathHint')}`",
        "",
        "## Reader Task",
        "",
        str(request.get("readerPrompt") or "Read the source pages and return structured source facts."),
        "",
        "## Required Fact Kinds",
        "",
    ]
    if blocking_kinds:
        lines.extend(f"- `{kind}`" for kind in blocking_kinds)
    else:
        lines.append("- None")
    lines.extend(
        [
            "",
            "## Required Value Fields",
            "",
            "```json",
            json.dumps(required_fields, indent=2, ensure_ascii=False),
            "```",
            "",
            "## Source Images",
            "",
            "| Source document | Page | Matched roles | Rendered page path |",
            "| --- | ---: | --- | --- |",
        ]
    )
    for image in request.get("inputImages") or []:
        if not isinstance(image, dict):
            continue
        matched = ", ".join(str(value) for value in image.get("matchedClassifications") or []) or "-"
        lines.append(
            "| "
            f"`{image.get('relativePath')}` | "
            f"{image.get('page')} | "
            f"{matched} | "
            f"`{image.get('renderedPagePath')}` |"
        )
    lines.extend(
        [
            "",
            "## Response Skeleton",
            "",
            "You may write a Markdown response for a subagent handoff. If you do, include this JSON object in one fenced `json` block. The folder-output loader also accepts a plain `.json` response file.",
            "",
            "```json",
            json.dumps(
                {
                    "format": "sourceAiVisualTraceReaderResponse_v1",
                    "readerPassId": assignment.get("readerPassId"),
                    "requestId": assignment.get("requestId"),
                    "workPackageId": assignment.get("workPackageId"),
                    "facts": [
                        {
                            "factId": "stable-id",
                            "kind": "room",
                            "value": {},
                            "confidence": 0.0,
                            "status": "candidate",
                            "provenance": {
                                "sourceDocumentId": "from source image row",
                                "page": 1,
                                "region": "visible source region",
                                "method": "ai_document_read",
                                "renderedPagePath": "from source image row",
                            },
                        }
                    ],
                },
                indent=2,
                ensure_ascii=False,
            ),
            "```",
            "",
            "If a required fact is not visible in these pages, write the observation in notes and return a `conflict` or source-unavailable disposition with provenance instead of guessing.",
            "",
        ]
    )
    return "\n".join(lines)


def _safe_prompt_stem(value: str) -> str:
    stem = "".join(char if char.isalnum() or char in "._-" else "-" for char in value).strip("-")
    return stem[:120] or "reader-assignment"


def _reader_dispatch_markdown(
    run_summary: dict[str, Any],
    reader_pass_manifest: dict[str, Any],
    reader_assignment_progress: dict[str, Any] | None = None,
) -> str:
    summary = reader_pass_manifest.get("summary") or {}
    progress_summary = (
        reader_assignment_progress.get("summary")
        if isinstance(reader_assignment_progress, dict)
        and isinstance(reader_assignment_progress.get("summary"), dict)
        else {}
    )
    policy = reader_pass_manifest.get("readerPassPolicy") or {}
    assignments = [
        row
        for row in reader_pass_manifest.get("assignments") or []
        if isinstance(row, dict)
    ]
    open_assignments = [
        row for row in assignments if row.get("status") != "response_received"
    ]
    lines = [
        "# Reverse-BIM Reader Dispatch",
        "",
        f"Package state: `{run_summary.get('packageState')}`",
        "",
        "Do not author BIM from this folder-output until the reader assignments below have source-fact responses.",
        "Use multimodal AI/subagent reading as the default. API reader commands are optional adapters for automation, not the core reverse-BIM methodology.",
        "",
        "## Required Files",
        "",
        "- Read: `ai-reading/reader-pass-manifest.json`",
        "- Read: `ai-reading/ai-visual-agent-requests.json`",
        "- Prefer the self-contained prompts under `ai-reading/assignments/**`.",
        "- Write responses under the hinted `ai-reading/responses/<reader-pass-id>/...json` paths, or use `.md` with a fenced JSON source-fact block, or provide the same objects to the source agent loop.",
        "",
        "## Summary",
        "",
        f"- Base request chunks: {summary.get('baseRequestCount', 0)}",
        f"- Reader assignments: {summary.get('assignmentCount', 0)}",
        f"- Open assignments: {progress_summary.get('waitingAssignmentCount', summary.get('waitingAssignmentCount', 0))}",
        f"- Invalid responses: {progress_summary.get('invalidResponseAssignmentCount', 0)}",
        f"- Responses with no facts: {progress_summary.get('noFactResponseAssignmentCount', 0)}",
        f"- Critical work packages needing consensus: {summary.get('criticalWorkPackageCount', 0)}",
        f"- Minimum independent readers for critical facts: {policy.get('minimumIndependentReadersForCriticalFacts', 2)}",
        "",
        "## Response Contract",
        "",
        "Each reader must produce real source understanding plus a structured source-fact block. A response may be a JSON file or Markdown containing one fenced JSON object with:",
        "",
        "- `format: sourceAiVisualTraceReaderResponse_v1`",
        "- `workPackageId` matching the assignment",
        "- `requestId` when responding to a chunked assignment",
        "- `readerPassId` or another independent reader identity",
        "- `facts[]` only; no BIM commands and no model mutations",
        "- each fact must include `factId`, `kind`, `value`, `confidence`, and `provenance`",
        "",
        "Markdown without a JSON source-fact block is preserved as reader notes, but it cannot advance MCP handoff until a consolidator turns it into structured facts.",
        "",
        "## Open Assignments",
        "",
        "| Reader pass | Work package | Request part | Images | Matched roles | Response path hint |",
        "| --- | --- | --- | ---: | --- | --- |",
    ]
    for row in open_assignments:
        part = f"{row.get('requestPartIndex')}/{row.get('requestPartCount')}"
        matched = ", ".join(str(value) for value in row.get("matchedClassifications") or []) or "-"
        lines.append(
            "| "
            f"`{row.get('readerPassId')}` | "
            f"`{row.get('workPackageId')}` | "
            f"{part} | "
            f"{row.get('inputImageCount', 0)} | "
            f"{matched} | "
            f"`{row.get('responsePathHint')}` |"
        )
    if not open_assignments:
        lines.append("| - | - | - | 0 | - | - |")
    lines.extend(
        [
            "",
            "## After Reading",
            "",
            "1. Collect all reader responses.",
            "2. Rerun `source.ai_visual_trace_agent_loop` or regenerate the folder-output with the responses.",
            "3. Resolve `ai-reading/repair-requests.open.json` until all required packages are accepted.",
            "4. Continue to MCP handoff only after source completeness, reader consensus, and MCP readiness allow it.",
            "",
        ]
    )
    return "\n".join(lines)


def _readme(run_summary: dict[str, Any], artifacts: dict[str, Path]) -> str:
    return "\n".join(
        [
            "# Reverse-BIM Folder Output",
            "",
            f"Package state: `{run_summary.get('packageState')}`",
            "",
            "Start here:",
            "",
            "- `run-summary.json`",
            "- `validation/package-acceptance-report.json`",
            "- `ai-reading/source-repair-plan.md`",
            "- `mcp-handoff/phase-authoring-spec.json`",
            "- `mcp-handoff/mcp-readiness.json`",
            "",
            run_summary.get("nextAgentInstruction") or "",
            "",
        ]
    )
