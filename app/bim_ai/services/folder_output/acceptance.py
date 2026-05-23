"""Phase 6: build the package-acceptance report, run-summary, and repair plan."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bim_ai.reverse_bim.evidence_requirements import build_reverse_bim_evidence_requirements
from bim_ai.services.folder_output.facts import (
    _build_document_registry,
    _build_source_page_index,
)
from bim_ai.services.folder_output.mcp_handoff import (
    _build_tolerance_policy,
    _write_reader_assignment_prompts,
)
from bim_ai.services.folder_output.repair import (
    _build_open_repair_requests,
    _build_source_repair_plan,
)
from bim_ai.services.folder_output.state import FolderOutputPhaseState
from bim_ai.services.source_ingestion import AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE


def _phase_acceptance(state: FolderOutputPhaseState) -> None:
    """Phase 6: build the package-acceptance report and run-summary."""
    state.source_completeness = _build_source_completeness_report(
        work_order=state.work_order, loop=state.loop
    )
    state.acceptance = _build_package_acceptance_report(
        raw_responses=state.raw_responses,
        loop=state.loop,
        readiness=state.readiness,
        conflicts=state.conflicts,
        source_completeness=state.source_completeness,
        room_topology=state.room_topology,
        source_level_completeness=state.source_level_completeness,
        source_area_consistency=state.source_area_consistency,
        coordinate_frame_alignment_report=state.coordinate_frame_alignment_report,
        site_terrain=state.site_terrain,
        roof_dormer=state.roof_dormer,
        source_material_assemblies=state.source_material_assemblies,
        reader_consensus=state.reader_consensus,
        source_building_scope=state.source_building_scope,
    )
    state.run_summary = _build_run_summary(
        source_folder=state.source_root,
        output_dir=state.out_dir,
        manifest=state.manifest,
        rendered_pages=state.rendered_pages,
        work_order=state.work_order,
        loop=state.loop,
        normalized=state.normalized,
        readiness=state.readiness,
        conflicts=state.conflicts,
        acceptance=state.acceptance,
        raw_responses=state.raw_responses,
        agent_requests=state.requests,
        reader_pass_manifest=state.reader_pass_manifest,
        reader_assignment_progress=state.reader_assignment_progress,
    )
    state.document_registry = _build_document_registry(state.manifest, state.classifications)
    state.source_page_index = _build_source_page_index(
        rendered_pages=state.rendered_pages,
        classifications=state.classifications,
        text_extractions=state.text_extractions,
        coordinate_frames=state.coordinate_frames,
    )
    state.evidence_requirements = build_reverse_bim_evidence_requirements(
        source_page_index=state.source_page_index,
        source_facts=state.facts,
        phase_authoring_spec=state.phase_spec,
    )
    state.tolerance_policy = _build_tolerance_policy()
    state.reader_assignment_prompts = _write_reader_assignment_prompts(
        output_dir=state.out_dir / "ai-reading" / "assignments",
        agent_requests=state.requests,
        reader_pass_manifest=state.reader_pass_manifest,
    )
    state.run_summary["summary"]["readerAssignmentPromptCount"] = (
        state.reader_assignment_prompts.get("promptCount", 0)
    )
    state.run_summary["summary"]["pageClassificationAssignmentCount"] = (
        state.page_classification_dispatch.get("assignmentCount", 0)
    )
    state.run_summary["summary"]["pageClassificationResponseCount"] = (
        state.page_classification_responses.get("responseCount", 0)
    )
    state.run_summary["summary"]["pageClassificationAppliedPageCount"] = (
        state.page_classification_application.get("appliedPageCount", 0)
    )
    state.repair_requests_open = {
        "format": "reverseBimOpenRepairRequests_v1",
        "requests": _build_open_repair_requests(
            loop=state.loop,
            source_building_scope=state.source_building_scope,
            source_level_completeness=state.source_level_completeness,
            room_topology=state.room_topology,
            source_area_consistency=state.source_area_consistency,
            site_terrain=state.site_terrain,
            roof_dormer=state.roof_dormer,
            source_material_assemblies=state.source_material_assemblies,
            reader_consensus=state.reader_consensus,
        ),
    }
    state.source_repair_plan = _build_source_repair_plan(
        run_summary=state.run_summary,
        acceptance=state.acceptance,
        reader_assignment_progress=state.reader_assignment_progress,
        repair_requests_open=state.repair_requests_open,
        coordinate_frame_worklist=state.coordinate_frame_worklist,
    )


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
        required = list(
            wp.get("blockingRequiredFactKinds")
            or AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE.get(package_id, [])
        )
        counts = (
            result.get("factCountsByKind")
            if isinstance(result.get("factCountsByKind"), dict)
            else {}
        )
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
    blockers = [
        row for row in rows if row["status"] != "accepted" or row["missingRequiredFactKinds"]
    ]
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
    source_building_scope_blocker_count = int(
        source_building_scope_summary.get("blockingCount") or 0
    )
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
    room_topology_summary = (
        room_topology.get("summary") if isinstance(room_topology.get("summary"), dict) else {}
    )
    rooms_needing_backing = int(room_topology_summary.get("roomsNeedingBackingCount") or 0)
    rooms_needing_access = int(room_topology_summary.get("roomsNeedingAccessCount") or 0)
    missing_access_ref_count = int(room_topology_summary.get("missingAccessRefCount") or 0)
    missing_adjacent_ref_count = int(room_topology_summary.get("missingAdjacentRoomRefCount") or 0)
    if (
        rooms_needing_backing
        or rooms_needing_access
        or missing_access_ref_count
        or missing_adjacent_ref_count
    ):
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
    site_terrain_summary = (
        site_terrain.get("summary") if isinstance(site_terrain.get("summary"), dict) else {}
    )
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
        reader_consensus.get("summary") if isinstance(reader_consensus.get("summary"), dict) else {}
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
        "packageState": _package_state(
            raw_responses=raw_responses, loop=loop, readiness=readiness, findings=findings
        ),
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
        if isinstance(reader_pass_manifest, dict)
        and isinstance(reader_pass_manifest.get("summary"), dict)
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
            "renderedPageCount": sum(
                len(row.get("pages") or []) for row in rendered_pages if isinstance(row, dict)
            ),
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
            "invalidReaderAssignmentCount": reader_progress_summary.get(
                "invalidResponseAssignmentCount", 0
            ),
            "noFactReaderAssignmentCount": reader_progress_summary.get(
                "noFactResponseAssignmentCount", 0
            ),
            "readerAssignmentWithFactsCount": reader_progress_summary.get(
                "assignmentWithFactsCount", 0
            ),
            "readerResponseCount": (raw_responses or {}).get("responseCount", 0),
            "readerResponseFileCount": (raw_responses or {}).get("responseFileCount", 0),
            "readerResponseFileScannedCount": (raw_responses or {}).get(
                "scannedResponseFileCount", 0
            ),
            "readerResponseFileErrorCount": (raw_responses or {}).get("responseFileErrorCount", 0),
            "acceptedWorkPackageCount": (loop.get("summary") or {}).get("acceptedPackageCount", 0),
            "normalizedFactCount": (normalized.get("summary") or {}).get("normalizedFactCount", 0),
            "mcpReadyFactCount": (readiness.get("summary") or {}).get(
                "readyForMcpAuthoringCount", 0
            ),
            "resolverNeededFactCount": (readiness.get("summary") or {}).get(
                "needsResolverCount", 0
            ),
            "sourceRefinementNeededFactCount": (readiness.get("summary") or {}).get(
                "needsSourceRefinementCount", 0
            ),
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
