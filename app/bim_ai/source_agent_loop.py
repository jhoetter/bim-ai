from __future__ import annotations

import hashlib
import json
import re
import subprocess
from collections import Counter
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
    "sourceAvailability",
    "start",
    "stepCount",
    "thicknessMm",
    "totalThicknessMm",
    "toLevelId",
    "type",
    "wallRole",
    "wallType",
    "widthMm",
    "year",
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
        requests.append(
            {
                "requestId": f"{resolved_run_id}:{package_id}",
                "workPackageId": package_id,
                "title": wp.get("title"),
                "status": "ready" if wp.get("status") == "ready" else "missing_inputs",
                "inputImages": [
                    {
                        "sourceDocumentId": row.get("sourceDocumentId"),
                        "relativePath": row.get("relativePath"),
                        "classification": row.get("classification"),
                        "page": row.get("page"),
                        "renderedPagePath": row.get("renderedPagePath"),
                    }
                    for row in wp.get("inputs") or []
                    if isinstance(row, dict)
                ],
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
            }
        )

    return {
        "ok": True,
        "format": "sourceAiVisualTraceAgentRequests_v1",
        "runId": resolved_run_id,
        "createdAt": datetime.now(UTC).isoformat(),
        "sourceWorkOrderDigestSha256": work_order.get("digestSha256"),
        "workPackageCount": len(requests),
        "requests": requests,
        "acceptance": [
            "Each reader response must be JSON with format=sourceAiVisualTraceReaderResponse_v1.",
            "Readers return source facts only, never BIM commands or model mutations.",
            "Every fact must pass source.validate_ai_facts provenance/confidence checks.",
            "Every package must pass source.validate_ai_visual_trace_completeness with its blockingRequiredFactKinds.",
            "Failed packages produce repair prompts and remain needs_revision.",
        ],
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
    responses_by_package = _responses_by_package(responses)
    reader_requests = build_ai_visual_trace_agent_requests(
        work_order=work_order,
        run_id=resolved_run_id,
    )
    requests_by_package = {
        str(row.get("workPackageId")): row
        for row in reader_requests.get("requests", [])
        if isinstance(row, dict)
    }
    package_results: list[dict[str, Any]] = []
    accepted_facts: list[dict[str, Any]] = []
    all_facts: list[dict[str, Any]] = []
    repair_requests: list[dict[str, Any]] = []
    dispatch_diagnostics: list[dict[str, Any]] = []
    reader_responses_used: list[dict[str, Any]] = []

    for wp in _work_packages(work_order):
        package_id = str(wp.get("id") or "")
        required_kinds = _blocking_required_kinds(wp)
        response = responses_by_package.get(package_id)
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
            if reader_command:
                response, diagnostic = _call_reader_command(
                    reader_command,
                    requests_by_package.get(package_id, {}),
                    timeout_seconds=reader_timeout_seconds,
                )
                if diagnostic:
                    dispatch_diagnostics.append({"workPackageId": package_id, **diagnostic})
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
    dpi: int = 200,
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
    classifications = classify_documents(manifest)

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

    packet = build_ai_visual_trace_packet(
        manifest=manifest,
        classifications=classifications,
        rendered_pages=rendered_pages,
        text_extractions=text_extractions,
    )
    work_order = build_ai_visual_trace_work_order(ai_visual_trace_packet=packet)
    requests = build_ai_visual_trace_agent_requests(work_order=work_order, run_id=run_id)
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
    if responses is None:
        return {}
    rows: list[dict[str, Any]]
    if isinstance(responses, dict):
        if isinstance(responses.get("responses"), list):
            rows = [row for row in responses["responses"] if isinstance(row, dict)]
        else:
            rows = [
                {**value, "workPackageId": key}
                for key, value in responses.items()
                if isinstance(value, dict)
            ]
    elif isinstance(responses, list):
        rows = [row for row in responses if isinstance(row, dict)]
    else:
        rows = []
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        package_id = str(row.get("workPackageId") or row.get("workPackage") or row.get("id") or "")
        if package_id:
            out[package_id] = row
    return out


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
        "Return JSON only. Do not emit BIM commands. Do not mutate the model.",
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
    return {
        "workPackageId": work_package.get("id"),
        "title": work_package.get("title"),
        "status": "repair_required",
        "inputImages": work_package.get("inputs") or [],
        "requiredKinds": required_kinds,
        "findingsToFix": findings,
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
