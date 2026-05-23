"""Phase 6 helpers: open-repair-request list and source-repair-plan."""

from __future__ import annotations

from collections import Counter
from typing import Any


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
        if not isinstance(action, dict) or not str(action.get("status") or "").startswith(
            "blocked"
        ):
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
        if not isinstance(action, dict) or not str(action.get("status") or "").startswith(
            "blocked"
        ):
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
        if not isinstance(action, dict) or not str(action.get("status") or "").startswith(
            "blocked"
        ):
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
        if (
            not isinstance(scope, dict)
            or scope.get("status") != "blocked_needs_source_or_disposition"
        ):
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
        row for row in reader_assignment_progress.get("rows") or [] if isinstance(row, dict)
    ]
    repair_requests = [
        row for row in repair_requests_open.get("requests") or [] if isinstance(row, dict)
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
        work_package_ids=[
            "wp-dimensional-floorplans",
            "wp-sections-elevations-roof",
            "wp-site-parcel-terrain",
            "wp-area-volume-schedules",
        ],
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
        artifacts=[
            "understanding/coordinate-frame-worklist.json",
            "understanding/coordinate-frames.json",
        ],
        instructions=[
            "For each plan/section/elevation/site frame, identify source control points and model coordinates.",
            "Do not author wall or site geometry from a page until its frame is aligned or explicitly source-limited.",
        ],
        done_criteria=["validation/coordinate-frame-report.json has no blocking alignments"],
        details={
            "classificationCounts": (coordinate_frame_worklist.get("summary") or {}).get(
                "classificationCounts"
            )
        },
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
        artifacts=[
            "understanding/source-area-consistency.json",
            "ai-reading/repair-requests.open.json",
        ],
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
