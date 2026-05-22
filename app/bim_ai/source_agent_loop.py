from __future__ import annotations

import hashlib
import json
import re
import subprocess
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bim_ai.source_ingestion import (
    AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE,
    AI_VISUAL_FACT_VALUE_REQUIREMENTS,
    build_ai_visual_trace_packet,
    build_ai_visual_trace_work_order,
    build_folder_manifest,
    classify_documents,
    extract_pdf_text,
    render_pdf_pages,
    validate_ai_visual_trace_completeness,
)

BASE_FACT_KEYS = {"factId", "kind", "value", "confidence", "status", "provenance"}
AI_VISUAL_CRITICAL_CONSENSUS_FACT_KINDS = {
    "building_scope",
    "level",
    "storey",
    "wall_line",
    "wall_chain",
    "wall_thickness",
    "room",
    "area",
    "opening",
    "door",
    "window",
    "stair",
    "slab_opening",
    "roof",
    "dormer",
    "terrain",
    "parcel_boundary",
}
TOP_LEVEL_VALUE_KEYS = {
    field
    for fields in AI_VISUAL_FACT_VALUE_REQUIREMENTS.values()
    for field in fields
} | {
    "areaM2",
    "accessRefs",
    "adjacentRoomRefs",
    "baseLevelId",
    "boundaryEdges",
    "boundaryMm",
    "boundaryPointsMm",
    "closed",
    "coordinatesMm",
    "description",
    "disposition",
    "elementScope",
    "end",
    "estimatedHeightMm",
    "estimatedWidthMm",
    "fromLevelId",
    "heightMm",
    "hostFloorRef",
    "hostRoofRef",
    "hostWallId",
    "hostWallRef",
    "issue",
    "layers",
    "layerStack",
    "levelName",
    "material",
    "materialLayers",
    "materialName",
    "assemblyName",
    "assemblyTotalThicknessMm",
    "constructionType",
    "name",
    "note",
    "observation",
    "openingKind",
    "openingType",
    "points",
    "position",
    "referenceLevel",
    "referenceLevelId",
    "runEndMm",
    "runStartMm",
    "runs",
    "scope",
    "scopeMask",
    "scopePolygon",
    "scopePolygonRef",
    "scopeBoundaryRef",
    "scopeBoundaryMm",
    "sourceAvailability",
    "start",
    "stepCount",
    "targetBoundaryRef",
    "targetScopeId",
    "targetScopePolygon",
    "thicknessMm",
    "totalThicknessMm",
    "toLevelId",
    "type",
    "wallRole",
    "wallType",
    "widthMm",
    "year",
    "contextScopeRefs",
}
OBSERVATION_ONLY_MODELABLE_KINDS = {
    "dormer",
    "opening",
    "roof",
    "roof_opening",
    "slab_opening",
    "stair",
}


def normalize_ai_visual_trace_reader_response(response: dict[str, Any]) -> dict[str, Any]:
    """Normalize multimodal reader output into MCP-feedable source facts.

    AI readers are allowed to be flexible. This boundary is deterministic: it
    moves misplaced scalar fields into ``value``, applies common geometry aliases,
    demotes current-condition prose about modelable objects to observations, and
    keeps findings so the agent knows what changed before MCP authoring.
    """

    if not isinstance(response, dict):
        return {
            "ok": False,
            "format": "sourceAiVisualTraceReaderResponseNormalization_v1",
            "summary": {"factCount": 0, "normalizedFactCount": 0, "errorCount": 1, "warningCount": 0},
            "findings": [
                {
                    "code": "ai_visual_reader_response_not_object",
                    "severity": "error",
                    "message": "Reader response must be a JSON object.",
                }
            ],
            "response": {"format": "sourceAiVisualTraceReaderResponse_v1", "facts": []},
        }

    facts = response.get("facts")
    if not isinstance(facts, list):
        facts = []
    package_id = str(response.get("workPackageId") or "")
    normalized_facts: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    for idx, fact in enumerate(facts):
        if not isinstance(fact, dict):
            findings.append(
                {
                    "code": "ai_visual_fact_not_object",
                    "severity": "error",
                    "index": idx,
                    "message": "Reader fact must be a JSON object.",
                }
            )
            continue
        normalized, fact_findings = _normalize_ai_visual_trace_fact(fact, package_id=package_id)
        normalized_facts.append(normalized)
        findings.extend(fact_findings)

    severity_counts = Counter(str(row.get("severity") or "warning") for row in findings)
    normalized_response = {
        **response,
        "format": response.get("format") or "sourceAiVisualTraceReaderResponse_v1",
        "facts": normalized_facts,
    }
    return {
        "ok": severity_counts.get("error", 0) == 0,
        "format": "sourceAiVisualTraceReaderResponseNormalization_v1",
        "workPackageId": response.get("workPackageId"),
        "summary": {
            "factCount": len(facts),
            "normalizedFactCount": len(normalized_facts),
            "errorCount": severity_counts.get("error", 0),
            "warningCount": severity_counts.get("warning", 0),
        },
        "findings": findings,
        "response": normalized_response,
    }


def normalize_ai_visual_trace_reader_responses(
    responses: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, Any]:
    """Normalize one response, a response list, or a package keyed response map."""

    rows = list(_responses_by_package(responses).values())
    normalized = [normalize_ai_visual_trace_reader_response(row) for row in rows]
    severity_counts = Counter()
    for row in normalized:
        for finding in row.get("findings") or []:
            if isinstance(finding, dict):
                severity_counts[str(finding.get("severity") or "warning")] += 1
    return {
        "ok": severity_counts.get("error", 0) == 0,
        "format": "sourceAiVisualTraceReaderResponsesNormalization_v1",
        "summary": {
            "responseCount": len(rows),
            "factCount": sum(int((row.get("summary") or {}).get("factCount") or 0) for row in normalized),
            "normalizedFactCount": sum(
                int((row.get("summary") or {}).get("normalizedFactCount") or 0)
                for row in normalized
            ),
            "errorCount": severity_counts.get("error", 0),
            "warningCount": severity_counts.get("warning", 0),
        },
        "responses": [row["response"] for row in normalized],
        "normalizations": normalized,
    }


def build_ai_visual_trace_agent_requests(
    *,
    work_order: dict[str, Any],
    run_id: str | None = None,
    max_native_text_chars: int = 0,
    max_images_per_request: int | None = 12,
) -> dict[str, Any]:
    """Build deterministic requests for multimodal AI/source-reader workers.

    The requests intentionally ask for source facts only. They are suitable for
    subagents, a vendor LLM, or a human review queue. This function does not call
    an LLM; it creates the contract that the agent loop later validates.
    """

    resolved_run_id = run_id or _stable_run_id(work_order)
    requests: list[dict[str, Any]] = []
    for wp in _work_packages(work_order):
        package_id = str(wp.get("id") or "")
        required_kinds = _blocking_required_kinds(wp)
        input_images = [
            {
                "sourceDocumentId": row.get("sourceDocumentId"),
                "relativePath": row.get("relativePath"),
                "classification": row.get("classification"),
                "classificationRoles": row.get("classificationRoles") or [],
                "pageClassificationRoles": row.get("pageClassificationRoles") or [],
                "matchedClassifications": row.get("matchedClassifications") or [],
                "page": row.get("page"),
                "renderedPagePath": row.get("renderedPagePath"),
            }
            for row in wp.get("inputs") or []
            if isinstance(row, dict)
        ]
        chunks = _chunk_rows(input_images, max_images_per_request)
        for part_index, image_chunk in enumerate(chunks, start=1):
            part_count = len(chunks)
            request_id = f"{resolved_run_id}:{package_id}"
            if part_count > 1:
                request_id = f"{request_id}:part-{part_index:02d}"
            requests.append(
                {
                    "requestId": request_id,
                    "workPackageId": package_id,
                    "requestPartIndex": part_index,
                    "requestPartCount": part_count,
                    "title": wp.get("title"),
                    "status": "ready" if wp.get("status") == "ready" else "missing_inputs",
                    "inputImages": image_chunk,
                    "readerPrompt": _reader_prompt(wp, required_kinds),
                    "outputContract": {
                        "format": "sourceAiVisualTraceReaderResponse_v1",
                        "workPackageId": package_id,
                        "factsOnly": True,
                        "modelMutationsAllowed": False,
                        "requiredFactFields": [
                            "factId",
                            "kind",
                            "value",
                            "confidence",
                            "provenance",
                        ],
                        "requiredProvenanceFields": ["sourceDocumentId", "page", "region"],
                        "method": "ai_document_read",
                        "blockingRequiredFactKinds": required_kinds,
                        "requiredValueFieldsByKind": wp.get("requiredValueFieldsByKind") or {},
                    },
                    "nativeTextBudgetChars": max_native_text_chars,
                    "responseMergePolicy": (
                        "Multiple responses with the same workPackageId are merged by concatenating facts before package validation."
                        if part_count > 1
                        else "Single response validates this work package."
                    ),
                }
            )

    return {
        "ok": True,
        "format": "sourceAiVisualTraceAgentRequests_v1",
        "runId": resolved_run_id,
        "createdAt": datetime.now(UTC).isoformat(),
        "sourceWorkOrderDigestSha256": work_order.get("digestSha256"),
        "workPackageCount": len(_work_packages(work_order)),
        "readerRequestCount": len(requests),
        "requests": requests,
        "acceptance": [
            "Each reader response must be JSON with format=sourceAiVisualTraceReaderResponse_v1.",
            "Readers return source facts only, never BIM commands or model mutations.",
            "Every fact must pass source.validate_ai_facts provenance/confidence checks.",
            "Every package must pass source.validate_ai_visual_trace_completeness with its blockingRequiredFactKinds.",
            "Failed packages produce repair prompts and remain needs_revision.",
        ],
    }


def build_ai_visual_trace_reader_pass_manifest(
    *,
    agent_requests: dict[str, Any],
    work_order: dict[str, Any],
    responses: list[dict[str, Any]] | dict[str, Any] | None = None,
    min_independent_readers_for_critical_facts: int = 2,
) -> dict[str, Any]:
    """Build the dispatch/checklist manifest for multimodal source readers.

    The manifest is intentionally provider-neutral. It describes which request
    chunks must be answered by a first reader pass, which chunks need another
    independent pass for consensus, and what response metadata must come back
    before reverse-BIM modeling may start.
    """

    request_rows = [
        row
        for row in agent_requests.get("requests") or []
        if isinstance(row, dict)
    ]
    work_packages = {str(row.get("id") or ""): row for row in _work_packages(work_order)}
    response_rows = _reader_response_rows(responses)
    response_keys = _response_keys(response_rows)
    critical_package_ids = {
        package_id
        for package_id, work_package in work_packages.items()
        if set(_blocking_required_kinds(work_package)) & AI_VISUAL_CRITICAL_CONSENSUS_FACT_KINDS
    }

    assignments: list[dict[str, Any]] = []
    for request in request_rows:
        package_id = str(request.get("workPackageId") or "")
        pass_ids = ["reader-pass-01"]
        if package_id in critical_package_ids and min_independent_readers_for_critical_facts > 1:
            pass_ids.extend(
                f"reader-pass-{index:02d}"
                for index in range(2, min_independent_readers_for_critical_facts + 1)
            )
        for reader_pass_id in pass_ids:
            request_id = str(request.get("requestId") or "")
            if request.get("status") != "ready":
                status = "missing_inputs"
            else:
                status = (
                    "response_received"
                    if _assignment_has_response(
                        response_keys,
                        request_id,
                        package_id,
                        reader_pass_id,
                        allow_package_fallback=int(request.get("requestPartCount") or 1) <= 1,
                    )
                    else "waiting_for_reader"
                )
            assignments.append(
                {
                    "assignmentId": f"{reader_pass_id}:{request_id}",
                    "readerPassId": reader_pass_id,
                    "requestId": request_id,
                    "workPackageId": package_id,
                    "requestPartIndex": request.get("requestPartIndex"),
                    "requestPartCount": request.get("requestPartCount"),
                    "status": status,
                    "independentReaderRequired": reader_pass_id != "reader-pass-01",
                    "criticalConsensusPackage": package_id in critical_package_ids,
                    "inputImageCount": len(request.get("inputImages") or []),
                    "matchedClassifications": sorted(
                        {
                            label
                            for image in request.get("inputImages") or []
                            if isinstance(image, dict)
                            for label in image.get("matchedClassifications") or []
                        }
                    ),
                    "responsePathHint": (
                        f"ai-reading/responses/{reader_pass_id}/"
                        f"{_safe_response_file_stem(request_id)}.json"
                    ),
                    "requiredResponseFields": [
                        "format",
                        "workPackageId",
                        "facts",
                        "readerId or agentId or readerPassId/provider/model/responseId",
                    ],
                }
            )

    assignment_counts = Counter(str(row.get("status") or "unknown") for row in assignments)
    return {
        "ok": assignment_counts.get("waiting_for_reader", 0) == 0,
        "format": "sourceAiVisualTraceReaderPassManifest_v1",
        "runId": agent_requests.get("runId"),
        "createdAt": datetime.now(UTC).isoformat(),
        "sourceWorkOrderDigestSha256": agent_requests.get("sourceWorkOrderDigestSha256"),
        "readerPassPolicy": {
            "firstPass": "Every ready request chunk must be read visually and returned as source facts.",
            "criticalFactConsensus": (
                "Work packages with critical geometry/site facts require independent reader responses "
                "or an explicit deterministic cross-check disposition before MCP authoring."
            ),
            "minimumIndependentReadersForCriticalFacts": min_independent_readers_for_critical_facts,
            "criticalFactKinds": sorted(AI_VISUAL_CRITICAL_CONSENSUS_FACT_KINDS),
            "criticalWorkPackageIds": sorted(critical_package_ids),
            "responseMergePolicy": "Chunk responses with the same workPackageId are merged before validation; reader identity is still required for consensus.",
        },
        "summary": {
            "baseRequestCount": len(request_rows),
            "assignmentCount": len(assignments),
            "waitingAssignmentCount": assignment_counts.get("waiting_for_reader", 0),
            "receivedAssignmentCount": assignment_counts.get("response_received", 0),
            "missingInputAssignmentCount": assignment_counts.get("missing_inputs", 0),
            "criticalWorkPackageCount": len(critical_package_ids),
            "responseCount": len(response_rows),
        },
        "assignments": assignments,
        "nextStep": (
            "All reader assignments have responses; normalize, validate, and run reader consensus."
            if assignment_counts.get("waiting_for_reader", 0) == 0
            else "Dispatch open assignments to multimodal readers; do not author BIM yet."
        ),
    }


def run_ai_visual_trace_agent_loop(
    *,
    work_order: dict[str, Any],
    responses: list[dict[str, Any]] | dict[str, Any] | None = None,
    run_id: str | None = None,
    max_repair_findings: int = 20,
    reader_command: list[str] | None = None,
    reader_timeout_seconds: int = 300,
) -> dict[str, Any]:
    """Validate multimodal AI-reader responses and create repair work."""

    resolved_run_id = run_id or _stable_run_id(work_order, responses or {})
    input_response_rows = _reader_response_rows(responses)
    responses_by_package = _merge_reader_response_rows(input_response_rows)
    response_rows_by_package = _response_rows_by_package(input_response_rows)
    reader_requests = build_ai_visual_trace_agent_requests(
        work_order=work_order,
        run_id=resolved_run_id,
    )
    request_by_id = {
        str(row.get("requestId") or ""): row
        for row in reader_requests.get("requests", [])
        if isinstance(row, dict) and row.get("requestId")
    }
    assignments_by_package: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if reader_command:
        dispatch_manifest = build_ai_visual_trace_reader_pass_manifest(
            agent_requests=reader_requests,
            work_order=work_order,
            responses=input_response_rows,
        )
        for assignment in dispatch_manifest.get("assignments") or []:
            if (
                isinstance(assignment, dict)
                and assignment.get("status") == "waiting_for_reader"
                and assignment.get("workPackageId")
            ):
                assignments_by_package[str(assignment.get("workPackageId"))].append(assignment)
    package_results: list[dict[str, Any]] = []
    accepted_facts: list[dict[str, Any]] = []
    all_facts: list[dict[str, Any]] = []
    repair_requests: list[dict[str, Any]] = []
    dispatch_diagnostics: list[dict[str, Any]] = []
    reader_responses_used: list[dict[str, Any]] = []
    merged_reader_responses_used: list[dict[str, Any]] = []

    for wp in _work_packages(work_order):
        package_id = str(wp.get("id") or "")
        required_kinds = _blocking_required_kinds(wp)
        response = responses_by_package.get(package_id)
        response_rows_for_package = response_rows_by_package.get(package_id, [])
        if reader_command:
            dispatched_responses = []
            for assignment in assignments_by_package.get(package_id, []):
                request = request_by_id.get(str(assignment.get("requestId") or ""))
                if not request:
                    dispatch_diagnostics.append(
                        {
                            "workPackageId": package_id,
                            "requestId": assignment.get("requestId"),
                            "assignmentId": assignment.get("assignmentId"),
                            "readerPassId": assignment.get("readerPassId"),
                            "code": "ai_visual_reader_assignment_request_missing",
                            "severity": "error",
                            "message": "Reader assignment references a request that was not found.",
                        }
                    )
                    continue
                dispatch_request = {
                    **request,
                    "assignmentId": assignment.get("assignmentId"),
                    "readerPassId": assignment.get("readerPassId"),
                    "responsePathHint": assignment.get("responsePathHint"),
                    "independentReaderRequired": assignment.get("independentReaderRequired"),
                    "criticalConsensusPackage": assignment.get("criticalConsensusPackage"),
                }
                dispatched_response, diagnostic = _call_reader_command(
                    reader_command,
                    dispatch_request,
                    timeout_seconds=reader_timeout_seconds,
                )
                if diagnostic:
                    dispatch_diagnostics.append(
                        {
                            "workPackageId": package_id,
                            "requestId": request.get("requestId"),
                            "assignmentId": assignment.get("assignmentId"),
                            "readerPassId": assignment.get("readerPassId"),
                            **diagnostic,
                        }
                    )
                if isinstance(dispatched_response, dict):
                    dispatched_responses.append(
                        _reader_response_with_request_metadata(
                            dispatched_response,
                            request,
                            assignment=assignment,
                        )
                    )
            if dispatched_responses:
                response_rows_for_package = [*response_rows_for_package, *dispatched_responses]
                response = _merge_reader_response_rows(response_rows_for_package).get(package_id)
        if wp.get("status") != "ready":
            result = {
                "workPackageId": package_id,
                "status": "missing_inputs",
                "requiredKinds": required_kinds,
                "factCount": 0,
                "summary": {"errorCount": 1, "warningCount": 0},
                "findings": [
                    {
                        "code": "ai_visual_work_package_inputs_missing",
                        "severity": "error",
                        "message": "Work package has no rendered input pages.",
                    }
                ],
            }
            package_results.append(result)
            repair_requests.append(_repair_request(wp, required_kinds, result["findings"]))
            continue
        if response is None:
            result = {
                "workPackageId": package_id,
                "status": "waiting_for_ai_reader",
                "requiredKinds": required_kinds,
                "factCount": 0,
                "summary": {"errorCount": 1, "warningCount": 0},
                "findings": [
                    {
                        "code": "ai_visual_reader_response_missing",
                        "severity": "error",
                        "message": "No multimodal reader response was supplied for this work package.",
                    }
                ],
            }
            package_results.append(result)
            repair_requests.append(_repair_request(wp, required_kinds, result["findings"]))
            continue

        if isinstance(response, dict):
            response = {
                **response,
                "format": response.get("format") or "sourceAiVisualTraceReaderResponse_v1",
                "workPackageId": response.get("workPackageId") or package_id,
            }
            merged_reader_responses_used.append(response)
            if response_rows_for_package:
                reader_responses_used.extend(
                    _reader_response_with_defaults(row, package_id=package_id)
                    for row in response_rows_for_package
                    if isinstance(row, dict)
                )
            else:
                reader_responses_used.append(response)

        normalization = normalize_ai_visual_trace_reader_response(response)
        normalized_response = normalization.get("response") if isinstance(normalization.get("response"), dict) else response
        facts = normalized_response.get("facts") if isinstance(normalized_response, dict) else []
        if not isinstance(facts, list):
            facts = []
        validation = validate_ai_visual_trace_completeness(
            [fact for fact in facts if isinstance(fact, dict)],
            required_kinds=required_kinds,
            required_value_fields_by_kind=wp.get("requiredValueFieldsByKind")
            if isinstance(wp.get("requiredValueFieldsByKind"), dict)
            else None,
        )
        validation_findings = list(validation.get("findings") or [])
        normalization_findings = list(normalization.get("findings") or [])
        combined_findings = normalization_findings + validation_findings
        combined_severity_counts = Counter(
            str(row.get("severity") or "warning")
            for row in combined_findings
            if isinstance(row, dict)
        )
        package_facts = validation.get("facts") if isinstance(validation.get("facts"), list) else []
        all_facts.extend(package_facts)
        status = (
            "accepted"
            if validation.get("ok") and normalization.get("ok")
            else "needs_revision"
        )
        result = {
            "workPackageId": package_id,
            "status": status,
            "readerResponseFormat": normalized_response.get("format"),
            "requiredKinds": required_kinds,
            "factCount": len(package_facts),
            "summary": {
                **(validation.get("summary") or {}),
                "normalizationErrorCount": int((normalization.get("summary") or {}).get("errorCount") or 0),
                "normalizationWarningCount": int((normalization.get("summary") or {}).get("warningCount") or 0),
                "errorCount": combined_severity_counts.get("error", 0),
                "warningCount": combined_severity_counts.get("warning", 0),
            },
            "findings": combined_findings,
            "normalization": {
                "format": normalization.get("format"),
                "summary": normalization.get("summary"),
                "findings": normalization_findings,
            },
            "factCountsByKind": (validation.get("summary") or {}).get("factCountsByKind", {}),
        }
        package_results.append(result)
        if status == "accepted":
            accepted_facts.extend(package_facts)
        else:
            repair_requests.append(
                _repair_request(
                    wp,
                    required_kinds,
                    list(result["findings"])[:max_repair_findings],
                    previous_response=response,
                )
            )

    status_counts = Counter(str(row.get("status")) for row in package_results)
    finding_counts = Counter()
    for row in package_results:
        for finding in row.get("findings") or []:
            if isinstance(finding, dict):
                finding_counts[str(finding.get("severity") or "warning")] += 1
    accepted = (
        bool(package_results)
        and status_counts.get("accepted", 0) == len(package_results)
        and finding_counts.get("error", 0) == 0
    )
    return {
        "ok": accepted,
        "format": "sourceAiVisualTraceAgentLoopRun_v1",
        "runId": resolved_run_id,
        "createdAt": datetime.now(UTC).isoformat(),
        "status": "accepted" if accepted else "blocked",
        "sourceWorkOrderDigestSha256": work_order.get("digestSha256"),
        "summary": {
            "workPackageCount": len(package_results),
            "acceptedPackageCount": status_counts.get("accepted", 0),
            "needsRevisionPackageCount": status_counts.get("needs_revision", 0),
            "waitingPackageCount": status_counts.get("waiting_for_ai_reader", 0),
            "missingInputPackageCount": status_counts.get("missing_inputs", 0),
            "acceptedFactCount": len(accepted_facts),
            "allReturnedFactCount": len(all_facts),
            "errorCount": finding_counts.get("error", 0),
            "warningCount": finding_counts.get("warning", 0),
            "packageStatuses": dict(sorted(status_counts.items())),
        },
        "packageResults": package_results,
        "readerResponses": reader_responses_used,
        "mergedReaderResponses": merged_reader_responses_used,
        "acceptedFacts": accepted_facts,
        "allReturnedFacts": all_facts,
        "repairRequests": repair_requests,
        "dispatchDiagnostics": dispatch_diagnostics,
        "nextStep": (
            "Build ExistingBuildingIR and reverse_bim.plan_authoring from acceptedFacts."
            if accepted
            else "Send repairRequests back to multimodal readers; do not author BIM yet."
        ),
    }


def prepare_ai_visual_trace_run_from_folder(
    *,
    root_path: str | Path,
    output_dir: str | Path,
    run_id: str | None = None,
    dpi: int = 240,
    max_pages_per_pdf: int | None = None,
) -> dict[str, Any]:
    """Prepare the full folder-to-multimodal-reader run scaffold."""

    out_dir = Path(output_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    rendered_dir = out_dir / "rendered-pages"
    rendered_dir.mkdir(parents=True, exist_ok=True)

    manifest = build_folder_manifest(root_path)
    if manifest.get("ok") is False:
        return manifest
    rendered_pages: list[dict[str, Any]] = []
    text_extractions: list[dict[str, Any]] = []
    for file_row in manifest.get("files", []):
        if not isinstance(file_row, dict) or file_row.get("kind") != "pdf":
            continue
        source_path = str(file_row.get("absolutePath") or "")
        source_doc_id = str(file_row.get("sourceDocumentId") or "source")
        pdf_output_dir = rendered_dir / _slug(source_doc_id)
        render = render_pdf_pages(
            source_path,
            output_dir=pdf_output_dir,
            dpi=dpi,
            first_page=1 if max_pages_per_pdf else None,
            last_page=max_pages_per_pdf,
        )
        rendered_pages.append(render)
        text_extractions.append(extract_pdf_text(source_path, max_pages=max_pages_per_pdf))
    classifications = classify_documents(manifest, text_extractions=text_extractions)

    packet = build_ai_visual_trace_packet(
        manifest=manifest,
        classifications=classifications,
        rendered_pages=rendered_pages,
        text_extractions=text_extractions,
    )
    work_order = build_ai_visual_trace_work_order(ai_visual_trace_packet=packet)
    requests = build_ai_visual_trace_agent_requests(work_order=work_order, run_id=run_id)
    reader_pass_manifest = build_ai_visual_trace_reader_pass_manifest(
        agent_requests=requests,
        work_order=work_order,
        responses=[],
    )
    initial_loop = run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=[],
        run_id=requests["runId"],
    )

    artifacts = {
        "manifest": out_dir / "source-manifest.json",
        "classifications": out_dir / "source-classifications.json",
        "renderedPages": out_dir / "source-rendered-pages.json",
        "textExtractions": out_dir / "source-text-extractions.json",
        "aiVisualTracePacket": out_dir / "source-ai-visual-trace-packet.json",
        "aiVisualTraceWorkOrder": out_dir / "source-ai-visual-trace-work-order.json",
        "aiVisualTraceAgentRequests": out_dir / "source-ai-visual-agent-requests.json",
        "readerPassManifest": out_dir / "source-reader-pass-manifest.json",
        "initialAgentLoop": out_dir / "source-ai-visual-agent-loop.initial.json",
    }
    payloads = {
        "manifest": manifest,
        "classifications": classifications,
        "renderedPages": rendered_pages,
        "textExtractions": text_extractions,
        "aiVisualTracePacket": packet,
        "aiVisualTraceWorkOrder": work_order,
        "aiVisualTraceAgentRequests": requests,
        "readerPassManifest": reader_pass_manifest,
        "initialAgentLoop": initial_loop,
    }
    for key, path in artifacts.items():
        path.write_text(json.dumps(payloads[key], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    return {
        "ok": True,
        "format": "sourceAiVisualTracePreparedRun_v1",
        "runId": requests["runId"],
        "rootPath": manifest.get("rootPath"),
        "outputDir": str(out_dir),
        "summary": {
            "fileCount": manifest.get("fileCount", 0),
            "documentCount": classifications.get("documentCount", 0),
            "renderedPdfCount": len(rendered_pages),
            "renderedPageCount": sum(len(row.get("pages") or []) for row in rendered_pages),
            "workPackageCount": work_order.get("documentCount") and len(work_order.get("workPackages") or []),
            "readerRequestCount": len(requests.get("requests") or []),
            "initialLoopStatus": initial_loop.get("status"),
        },
        "artifacts": {key: str(path) for key, path in artifacts.items()},
        "nextStep": "Dispatch source-ai-visual-agent-requests.json to multimodal readers, then rerun source.ai_visual_trace_agent_loop with their responses.",
    }


def _normalize_ai_visual_trace_fact(
    fact: dict[str, Any],
    *,
    package_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    fact_id = str(fact.get("factId") or f"ai-srcfact-{hashlib.sha1(json.dumps(fact, sort_keys=True, default=str).encode()).hexdigest()[:10]}")
    kind = str(fact.get("kind") or "").strip()
    raw_value = fact.get("value")
    value: dict[str, Any]
    if isinstance(raw_value, dict):
        value = dict(raw_value)
    elif raw_value is None:
        value = {}
    else:
        value = _scalar_value_for_kind(kind, raw_value)
        findings.append(
            {
                "code": "ai_visual_fact_scalar_value_normalized",
                "severity": "warning",
                "factId": fact_id,
                "kind": kind,
                "message": "Scalar fact value was converted to a structured value object.",
            }
        )

    moved_fields: list[str] = []
    for key in sorted(TOP_LEVEL_VALUE_KEYS):
        if key in fact and key not in value:
            value[key] = fact[key]
            moved_fields.append(key)
    if moved_fields:
        findings.append(
            {
                "code": "ai_visual_fact_top_level_value_fields_moved",
                "severity": "warning",
                "factId": fact_id,
                "kind": kind,
                "fields": moved_fields,
            }
        )

    original_kind = kind
    kind, value, demoted = _demote_observation_only_current_condition_fact(
        kind,
        value,
        package_id=package_id,
    )
    if demoted:
        findings.append(
            {
                "code": "ai_visual_modelable_fact_demoted_to_observation",
                "severity": "warning",
                "factId": fact_id,
                "fromKind": original_kind,
                "toKind": kind,
                "message": "Current-condition prose did not contain MCP-authorable geometry and was preserved as an observation.",
            }
        )

    value, alias_notes = _apply_value_aliases(kind, value, fact_id=fact_id)
    for note in alias_notes:
        findings.append(
            {
                "code": "ai_visual_fact_value_alias_applied",
                "severity": "warning",
                "factId": fact_id,
                "kind": kind,
                **note,
            }
        )

    normalized = {
        key: fact[key]
        for key in BASE_FACT_KEYS
        if key in fact and key not in {"kind", "value"}
    }
    normalized.setdefault("factId", fact_id)
    normalized["kind"] = kind
    normalized["value"] = value
    normalized.setdefault("confidence", fact.get("confidence"))
    if "status" in fact:
        normalized["status"] = fact["status"]
    if "provenance" in fact:
        normalized["provenance"] = fact["provenance"]
    normalized["normalization"] = {
        "source": "source.normalize_ai_visual_trace_reader_response",
        "rawKind": original_kind,
        "rawValueType": type(raw_value).__name__,
        "changed": bool(moved_fields or alias_notes or demoted or not isinstance(raw_value, dict)),
    }
    return normalized, findings


def _scalar_value_for_kind(kind: str, raw_value: Any) -> dict[str, Any]:
    text = str(raw_value).strip()
    if kind == "material":
        return {"materialName": text, "elementScope": "unknown/general"}
    if kind == "construction_history":
        value: dict[str, Any] = {"event": text}
        year = _first_year(text)
        if year is not None:
            value["year"] = year
        return value
    if kind == "conflict":
        return {
            "topic": text or "unspecified source conflict",
            "candidates": [text] if text else [],
            "recommendedDisposition": "ask_user",
        }
    if kind == "photo_observation":
        return {"observation": text, "elementScope": "unknown/general"}
    return {"observation": text}


def _demote_observation_only_current_condition_fact(
    kind: str,
    value: dict[str, Any],
    *,
    package_id: str,
) -> tuple[str, dict[str, Any], bool]:
    if package_id != "wp-current-condition" or kind not in OBSERVATION_ONLY_MODELABLE_KINDS:
        return kind, value, False
    required = AI_VISUAL_FACT_VALUE_REQUIREMENTS.get(kind, [])
    present_required = [field for field in required if _path_present(value, field)]
    has_text = any(str(value.get(key) or "").strip() for key in ("observation", "description", "note"))
    if present_required or not has_text:
        return kind, value, False
    observation = str(value.get("observation") or value.get("description") or value.get("note") or "").strip()
    return (
        "photo_observation",
        {
            "observation": observation,
            "elementScope": str(value.get("elementScope") or kind),
            "originalKind": kind,
        },
        True,
    )


def _apply_value_aliases(
    kind: str,
    value: dict[str, Any],
    *,
    fact_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    out = dict(value)
    notes: list[dict[str, Any]] = []

    def alias(source: str, target: str) -> None:
        if source in out and target not in out:
            out[target] = out[source]
            notes.append({"from": source, "to": target})

    alias("boundaryPointsMm", "boundaryMm")
    alias("coordinatesMm", "points")
    alias("hostWallId", "wallId")
    alias("wallType", "appliesTo")
    alias("estimatedWidthMm", "widthMm")
    alias("estimatedHeightMm", "heightMm")
    alias("fromLevelId", "baseLevelId")
    alias("toLevelId", "topLevelId")
    alias("referenceLevel", "referenceLevelId")

    if kind in {"room", "floor_boundary", "roof"}:
        alias("points", "boundaryMm")
        alias("boundary", "boundaryMm")
        if "boundaryMm" in out and "boundaryRef" not in out:
            out["boundaryRef"] = f"{fact_id}:boundary"
            notes.append({"from": "boundaryMm", "to": "boundaryRef"})
    if kind in {"slab_opening", "parcel_boundary"}:
        alias("points", "boundary")
        alias("boundaryMm", "boundary")
    if kind in {"opening", "door", "window"}:
        alias("openingType", "openingKind")
        alias("sourcePositionMm", "position")
        position = out.get("position")
        if isinstance(position, dict) and "alongT" in position and "alongT" not in out:
            out["alongT"] = position["alongT"]
            notes.append({"from": "position.alongT", "to": "alongT"})
        elif isinstance(position, list | tuple) and len(position) >= 2 and "sourcePositionMm" not in out:
            out["sourcePositionMm"] = {"xMm": position[0], "yMm": position[1]}
            notes.append({"from": "position[0:2]", "to": "sourcePositionMm"})
    if kind == "wall_line":
        points = out.get("points")
        if isinstance(points, list) and len(points) >= 2:
            if "start" not in out and isinstance(points[0], dict):
                out["start"] = points[0]
                notes.append({"from": "points[0]", "to": "start"})
            if "end" not in out and isinstance(points[1], dict):
                out["end"] = points[1]
                notes.append({"from": "points[1]", "to": "end"})
    if kind == "stair":
        runs = out.get("runs")
        if isinstance(runs, list) and runs and isinstance(runs[0], dict):
            first = runs[0]
            last = runs[-1] if isinstance(runs[-1], dict) else first
            if "runStartMm" not in out:
                for key in ("startMm", "start", "from"):
                    if key in first:
                        out["runStartMm"] = first[key]
                        notes.append({"from": f"runs[0].{key}", "to": "runStartMm"})
                        break
            if "runEndMm" not in out:
                for key in ("endMm", "end", "to"):
                    if key in last:
                        out["runEndMm"] = last[key]
                        notes.append({"from": f"runs[-1].{key}", "to": "runEndMm"})
                        break
    if kind == "material" and "materialName" not in out and "material" in out:
        out["materialName"] = out["material"]
        notes.append({"from": "material", "to": "materialName"})
    if kind == "construction_history" and "year" not in out:
        year = _first_year(str(out.get("event") or out.get("description") or out.get("note") or ""))
        if year is not None:
            out["year"] = year
            notes.append({"from": "event", "to": "year"})
    if kind == "conflict":
        if "topic" not in out:
            out["topic"] = out.get("issue") or out.get("description") or "unspecified source conflict"
            notes.append({"from": "issue/description", "to": "topic"})
        if "candidates" not in out:
            candidates = out.get("affectedFacts") or out.get("options") or out.get("description")
            out["candidates"] = candidates if isinstance(candidates, list) else [candidates]
            notes.append({"from": "affectedFacts/options/description", "to": "candidates"})
        if "recommendedDisposition" not in out:
            out["recommendedDisposition"] = out.get("disposition") or "ask_user"
            notes.append({"from": "disposition/default", "to": "recommendedDisposition"})
    if kind == "terrain":
        out.setdefault("method", "source_document_read")
        out.setdefault("confidenceNote", out.get("note") or out.get("description") or "No numeric terrain evidence supplied.")
    return out, notes


def _first_year(text: str) -> int | None:
    match = re.search(r"\b(18\d{2}|19\d{2}|20\d{2})\b", text)
    return int(match.group(1)) if match else None


def _path_present(value: dict[str, Any], path: str) -> bool:
    current: Any = value
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]
    return current not in (None, "", [], {})


def _work_packages(work_order: dict[str, Any]) -> list[dict[str, Any]]:
    return [wp for wp in work_order.get("workPackages", []) if isinstance(wp, dict)]


def _blocking_required_kinds(work_package: dict[str, Any]) -> list[str]:
    explicit = work_package.get("blockingRequiredFactKinds")
    if isinstance(explicit, list):
        return [str(kind) for kind in explicit if str(kind)]
    package_id = str(work_package.get("id") or "")
    return list(AI_VISUAL_BLOCKING_FACT_KINDS_BY_PACKAGE.get(package_id, []))


def _responses_by_package(
    responses: list[dict[str, Any]] | dict[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    return _merge_reader_response_rows(_reader_response_rows(responses))


def _response_rows_by_package(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        package_id = str(row.get("workPackageId") or row.get("workPackage") or row.get("id") or "")
        if package_id:
            out[package_id].append(row)
    return out


def _reader_response_with_defaults(row: dict[str, Any], *, package_id: str) -> dict[str, Any]:
    return {
        **row,
        "format": row.get("format") or "sourceAiVisualTraceReaderResponse_v1",
        "workPackageId": row.get("workPackageId") or row.get("workPackage") or row.get("id") or package_id,
    }


def _reader_response_with_request_metadata(
    row: dict[str, Any],
    request: dict[str, Any],
    *,
    assignment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    out = _reader_response_with_defaults(row, package_id=str(request.get("workPackageId") or ""))
    for key in ("requestId", "requestPartIndex", "requestPartCount"):
        if key not in out or out.get(key) in (None, ""):
            out[key] = request.get(key)
    assignment = assignment or {}
    for key in ("assignmentId", "readerPassId", "responsePathHint"):
        if key not in out or out.get(key) in (None, ""):
            out[key] = assignment.get(key)
    return out


def _reader_response_rows(
    responses: list[dict[str, Any]] | dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if responses is None:
        return []
    if isinstance(responses, dict):
        if isinstance(responses.get("responses"), list):
            return [row for row in responses["responses"] if isinstance(row, dict)]
        return [
            {**value, "workPackageId": key}
            for key, value in responses.items()
            if isinstance(value, dict)
        ]
    if isinstance(responses, list):
        return [row for row in responses if isinstance(row, dict)]
    return []


def _response_keys(rows: list[dict[str, Any]]) -> set[tuple[str, str, str]]:
    keys: set[tuple[str, str, str]] = set()
    for row in rows:
        package_id = str(row.get("workPackageId") or row.get("workPackage") or row.get("id") or "")
        request_id = str(row.get("requestId") or "")
        reader_pass_id = str(row.get("readerPassId") or "")
        if package_id or request_id:
            keys.add((request_id, package_id, reader_pass_id))
        for part in row.get("responseParts") or []:
            if not isinstance(part, dict):
                continue
            keys.add(
                (
                    str(part.get("requestId") or request_id),
                    package_id,
                    reader_pass_id,
                )
            )
    return keys


def _assignment_has_response(
    keys: set[tuple[str, str, str]],
    request_id: str,
    package_id: str,
    reader_pass_id: str,
    *,
    allow_package_fallback: bool = True,
) -> bool:
    if (request_id, package_id, reader_pass_id) in keys:
        return True
    if reader_pass_id == "reader-pass-01" and (request_id, package_id, "") in keys:
        return True
    if not allow_package_fallback:
        return False
    if ("", package_id, reader_pass_id) in keys:
        return True
    if reader_pass_id == "reader-pass-01" and ("", package_id, "") in keys:
        return True
    return False


def _safe_response_file_stem(value: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return stem[:120] or "reader-response"


def _merge_reader_response_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Merge reader response rows into one envelope per work-package id.

    TH-X-F009 — a single "global" or "rescue" reader can satisfy multiple work
    packages by declaring ``additionalWorkPackageIds: [str]`` on its response
    envelope. The row is then merged into every listed package id in addition
    to its primary ``workPackageId``. The fan-out copies the same fact list
    into each receiving package; package validation downstream selects only
    facts whose ``kind`` matches that package's blocking required kinds, so
    cross-pollution is not a concern.
    """

    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        primary_id = str(row.get("workPackageId") or row.get("workPackage") or row.get("id") or "")
        additional_ids = [
            str(pid)
            for pid in row.get("additionalWorkPackageIds") or []
            if isinstance(pid, str) and pid and pid != primary_id
        ]
        if not primary_id and not additional_ids:
            continue
        targets = ([primary_id] if primary_id else []) + additional_ids
        facts = [fact for fact in row.get("facts") or [] if isinstance(fact, dict)]
        part = {
            "requestId": row.get("requestId"),
            "requestPartIndex": row.get("requestPartIndex"),
            "requestPartCount": row.get("requestPartCount"),
            "factCount": len(facts),
        }
        part_has_metadata = any(
            part.get(key) is not None for key in ("requestId", "requestPartIndex", "requestPartCount")
        )
        for index, target_id in enumerate(targets):
            existing = out.get(target_id)
            target_part = (
                part
                if index == 0
                else {**part, "fanoutFromWorkPackageId": primary_id}
            )
            if existing is None:
                merged = {
                    **row,
                    "format": row.get("format") or "sourceAiVisualTraceReaderResponse_v1",
                    "workPackageId": target_id,
                    "facts": list(facts),
                }
                if target_id != primary_id and primary_id:
                    merged["fanoutFromWorkPackageId"] = primary_id
                if part_has_metadata:
                    merged["responseParts"] = [target_part]
                out[target_id] = merged
                continue
            existing["facts"] = [*(existing.get("facts") or []), *facts]
            if part_has_metadata:
                existing["responseParts"] = [
                    *(existing.get("responseParts") or []),
                    target_part,
                ]
            if target_id != primary_id and primary_id:
                fanouts = set(existing.get("fanoutFromWorkPackageIds") or [])
                if existing.get("fanoutFromWorkPackageId") and existing.get(
                    "fanoutFromWorkPackageId"
                ) != primary_id:
                    fanouts.add(str(existing["fanoutFromWorkPackageId"]))
                fanouts.add(primary_id)
                existing["fanoutFromWorkPackageIds"] = sorted(fanouts)
    return out


def _chunk_rows(rows: list[dict[str, Any]], max_rows: int | None) -> list[list[dict[str, Any]]]:
    if not rows:
        return [[]]
    if max_rows is None or max_rows <= 0 or len(rows) <= max_rows:
        return [rows]
    return [rows[index : index + max_rows] for index in range(0, len(rows), max_rows)]


def _call_reader_command(
    command: list[str],
    request: dict[str, Any],
    *,
    timeout_seconds: int,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not command:
        return None, {"code": "ai_visual_reader_command_empty", "severity": "error"}
    try:
        proc = subprocess.run(
            command,
            input=json.dumps(request, ensure_ascii=False),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        return None, {
            "code": "ai_visual_reader_command_not_found",
            "severity": "error",
            "message": str(exc),
        }
    except subprocess.TimeoutExpired as exc:
        return None, {
            "code": "ai_visual_reader_command_timeout",
            "severity": "error",
            "message": str(exc),
        }
    if proc.returncode != 0:
        return None, {
            "code": "ai_visual_reader_command_failed",
            "severity": "error",
            "returnCode": proc.returncode,
            "stderr": proc.stderr.strip()[:2000],
        }
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        return None, {
            "code": "ai_visual_reader_command_invalid_json",
            "severity": "error",
            "message": str(exc),
            "stdoutExcerpt": proc.stdout[:2000],
        }
    if not isinstance(payload, dict):
        return None, {
            "code": "ai_visual_reader_command_non_object",
            "severity": "error",
        }
    return payload, None


def _reader_prompt(work_package: dict[str, Any], required_kinds: list[str]) -> str:
    lines = [
        "You are reading existing-building source documents as a careful BIM technician.",
        "Do not emit BIM commands and do not mutate the model.",
        (
            "Return source understanding with a structured source-fact object. "
            "If your environment is a subagent or human-readable note flow, write concise notes first, "
            "but include one fenced JSON object that follows the response shape below."
        ),
        f"Work package: {work_package.get('title') or work_package.get('id')}",
        f"Task: {work_package.get('readerTask') or ''}",
        "Use rendered page images as the primary evidence. Native text is supplemental only.",
        "Do not invent hidden facts. Mark uncertainty and conflicts explicitly.",
        f"Blocking required fact kinds: {', '.join(required_kinds) if required_kinds else '(none)'}",
        "Required value fields by kind:",
        json.dumps(work_package.get("requiredValueFieldsByKind") or {}, indent=2, ensure_ascii=False),
        "Checklist:",
    ]
    for item in work_package.get("extractionChecklist") or []:
        lines.append(f"- {item}")
    lines.extend(
        [
            "Response shape:",
            json.dumps(
                {
                    "format": "sourceAiVisualTraceReaderResponse_v1",
                    "workPackageId": work_package.get("id"),
                    "facts": [
                        {
                            "factId": "ai-srcfact-example",
                            "kind": "room",
                            "value": {},
                            "confidence": 0.0,
                            "status": "candidate",
                            "provenance": {
                                "sourceDocumentId": "srcdoc-...",
                                "page": 1,
                                "region": "visible source region or bbox",
                                "method": "ai_document_read",
                                "renderedPagePath": "path/to/page.png",
                            },
                        }
                    ],
                },
                indent=2,
                ensure_ascii=False,
            ),
        ]
    )
    return "\n".join(lines)


def _repair_request(
    work_package: dict[str, Any],
    required_kinds: list[str],
    findings: list[dict[str, Any]],
    *,
    previous_response: dict[str, Any] | None = None,
) -> dict[str, Any]:
    package_id = str(work_package.get("id") or "unknown-work-package")
    finding_codes = [
        str(row.get("code") or "finding")
        for row in findings
        if isinstance(row, dict)
    ]
    primary_code = finding_codes[0] if finding_codes else "source_reader_repair"
    return {
        "repairRequestId": f"reader-package-{package_id}-{_safe_response_file_stem(primary_code)}",
        "kind": "reader_package_repair",
        "workPackageId": package_id,
        "title": work_package.get("title"),
        "status": "repair_required",
        "inputImages": work_package.get("inputs") or [],
        "requiredKinds": required_kinds,
        "findingsToFix": findings,
        "findingCodes": finding_codes,
        "readerPrompt": _reader_prompt(work_package, required_kinds),
        "previousFactCount": len(previous_response.get("facts") or []) if previous_response else 0,
        "instructions": [
            "Return a complete replacement response for this work package.",
            "Fix every listed finding with source-provenance facts or explicit conflict/deferred facts.",
            "Do not remove valid previous facts unless they were wrong; mark superseded conflicts explicitly.",
        ],
    }


def _stable_run_id(*parts: Any) -> str:
    blob = json.dumps(parts, sort_keys=True, default=str, ensure_ascii=False)
    return "ai-visual-run-" + hashlib.sha1(blob.encode()).hexdigest()[:12]


def _slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return slug or "source"
