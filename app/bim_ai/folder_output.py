from __future__ import annotations

import hashlib
import json
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

    classifications = classify_documents(manifest)
    rendered_pages, text_extractions = _render_and_extract(
        manifest=manifest,
        output_dir=out_dir / "source" / "rendered-pages",
        dpi=dpi,
        max_pages_per_pdf=max_pages_per_pdf,
    )
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

    raw_responses = _reader_response_payload(reader_responses)
    loop = run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=raw_responses.get("responses") or [],
        run_id=requests.get("runId"),
        reader_command=reader_command,
        reader_timeout_seconds=reader_timeout_seconds,
    )
    raw_responses = _reader_response_payload(loop.get("readerResponses") or raw_responses.get("responses") or [])
    reader_consensus = build_source_reader_consensus_report(raw_responses)
    normalized = normalize_ai_visual_trace_reader_responses(raw_responses)
    reader_response_index = _build_reader_response_index(raw_responses, loop)
    facts = _facts_for_handoff(loop=loop, normalized=normalized)
    source_building_scope = build_source_building_scope_report(facts)
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
        "readerResponsesRaw": out_dir / "ai-reading" / "reader-responses.raw.json",
        "readerResponseIndex": out_dir / "ai-reading" / "reader-response-index.json",
        "readerConsensus": out_dir / "ai-reading" / "reader-consensus.json",
        "readerResponsesNormalized": out_dir / "ai-reading" / "reader-responses.normalized.json",
        "agentLoopAccepted": out_dir / "ai-reading" / "agent-loop.accepted.json",
        "repairRequestsOpen": out_dir / "ai-reading" / "repair-requests.open.json",
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
        "readerResponsesRaw": raw_responses,
        "readerResponseIndex": reader_response_index,
        "readerConsensus": reader_consensus,
        "readerResponsesNormalized": normalized,
        "agentLoopAccepted": loop,
        "repairRequestsOpen": {
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
        },
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
    artifacts["sourceAnalysis"].write_text(
        _source_analysis_markdown(run_summary, source_completeness, readiness, conflicts),
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
                "format": response.get("format"),
                "readerId": response.get("readerId") or response.get("agentId"),
                "provider": response.get("provider"),
                "model": response.get("model") or response.get("modelId"),
                "capturedAt": response.get("capturedAt") or response.get("createdAt"),
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
                    "renderedPagePath": page.get("path"),
                    "widthPx": image.get("widthPx"),
                    "heightPx": image.get("heightPx"),
                    "dpi": render.get("dpi"),
                    "sha256": page.get("sha256"),
                    "nativeTextAvailable": bool(str(text_page.get("text") or "").strip()),
                    "coordinateFrameId": frame_by_page.get(source_page_id),
                    "modelingUse": _modeling_use_for_classification(str(cls.get("classification") or "unknown")),
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
        classification = str(cls.get("classification") or "unknown")
        if classification not in {"floor_plan", "section", "elevation", "site_plan", "drainage_doc"}:
            continue
        for page in render.get("pages") or []:
            if not isinstance(page, dict):
                continue
            page_num = int(page.get("page") or 0)
            source_page_id = f"{cls.get('sourceDocumentId') or source_path}:p{page_num}"
            scale = scale_by_path.get((source_path, page_num)) or {}
            frames.append(
                {
                    "coordinateFrameId": f"frame-{cls.get('sourceDocumentId')}-p{page_num}",
                    "sourcePageId": source_page_id,
                    "sourceDocumentId": cls.get("sourceDocumentId"),
                    "page": page_num,
                    "classification": classification,
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
) -> dict[str, Any]:
    package_state = str(acceptance.get("packageState") or "source_understanding_blocked")
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
            "- `mcp-handoff/phase-authoring-spec.json`",
            "- `mcp-handoff/mcp-readiness.json`",
            "",
            run_summary.get("nextAgentInstruction") or "",
            "",
        ]
    )
