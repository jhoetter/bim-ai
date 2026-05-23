"""Phase 5: build the existing-building IR + MCP authoring readiness/plan/spec."""

from __future__ import annotations

import json
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any

from bim_ai.reverse_bim import (
    build_existing_building_ir_seed,
    build_mcp_authoring_readiness,
    build_source_coverage_matrix,
    plan_mcp_authoring_actions,
    validate_existing_building_ir,
)
from bim_ai.services.folder_output._shared import PHASE_BY_FACT_KIND, PHASE_ORDER
from bim_ai.services.folder_output.state import FolderOutputPhaseState


def _phase_mcp_handoff(state: FolderOutputPhaseState) -> None:
    """Phase 5: build the existing-building IR + MCP authoring readiness/plan/spec."""
    ir = build_existing_building_ir_seed(
        source_manifest=state.manifest,
        source_facts={"facts": state.facts},
        classifications=state.classifications,
    )
    ir["coordinateFrames"] = state.coordinate_frames["coordinateFrames"]
    ir["conflicts"] = state.conflicts["conflicts"]
    state.ir = ir
    state.ir_validation = validate_existing_building_ir(ir)
    state.coverage = build_source_coverage_matrix(facts=state.facts)
    state.readiness = build_mcp_authoring_readiness(facts=state.facts, target_phase="folder-output")
    state.authoring_plan = plan_mcp_authoring_actions(
        facts=state.facts, target_phase="folder-output"
    )
    state.resolver_worklist = _build_resolver_worklist(state.readiness)
    state.phase_spec = _build_phase_authoring_spec(
        facts=state.facts,
        readiness=state.readiness,
        authoring_plan=state.authoring_plan,
        resolver_worklist=state.resolver_worklist,
        conflicts=state.conflicts,
    )


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
                    "expectedOutput": _expected_resolver_output(
                        str(requirement.get("resolver") or "")
                    ),
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
        phase_fact_ids[
            PHASE_BY_FACT_KIND.get(str(fact.get("kind") or ""), "P0-source-inventory")
        ].append(str(fact.get("factId") or ""))
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
        blocker_rows = [
            row
            for row in phase_rows
            if row.get("status")
            not in {"ready_for_mcp_authoring", "metadata_for_authoring", "reference_only"}
        ]
        status = "ready" if fact_ids and not blocker_rows else "partial" if fact_ids else "blocked"
        if phase_id in {"P14-validation", "P15-final-acceptance"} and conflicts.get(
            "openConflictCount"
        ):
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
    output_contract = (
        request.get("outputContract") if isinstance(request.get("outputContract"), dict) else {}
    )
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
        str(
            request.get("readerPrompt")
            or "Read the source pages and return structured source facts."
        ),
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
        matched = (
            ", ".join(str(value) for value in image.get("matchedClassifications") or []) or "-"
        )
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
    checks = [
        "advisor_findings_disposed",
        "constructability_findings_disposed",
        "integrity_findings_disposed",
    ]
    if "room" in phase_id:
        checks.append("room_areas_reconcile_to_source")
    if "opening" in phase_id:
        checks.append("all_openings_hosted_and_cut_hosts")
    if "stair" in phase_id:
        checks.append("stairs_have_required_slab_openings")
    if "terrain" in phase_id:
        checks.append("site_property_and_terrain_align_to_source")
    return checks
