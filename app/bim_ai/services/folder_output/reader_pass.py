"""Phase 2: load/normalize reader responses, run the agent loop, build consensus."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from bim_ai._io.digest import sha256_json
from bim_ai.services.folder_output.state import FolderOutputPhaseState
from bim_ai.services.source_agent_loop import (
    build_ai_visual_trace_reader_pass_manifest,
    normalize_ai_visual_trace_reader_response,
    normalize_ai_visual_trace_reader_responses,
    run_ai_visual_trace_agent_loop,
)
from bim_ai.source_reader_consensus import build_source_reader_consensus_report


def _phase_reader_pass(
    state: FolderOutputPhaseState,
    *,
    reader_responses: list[dict[str, Any]] | dict[str, Any] | None,
    reader_command: list[str] | None,
    reader_timeout_seconds: int,
    reader_consensus_dispositions: list[dict[str, Any]] | dict[str, Any] | None,
) -> None:
    """Phase 2: load/normalize reader responses, run the agent loop, build consensus."""
    discovered_payload = (
        _empty_reader_response_file_payload()
        if reader_responses is not None
        else _load_reader_response_files(state.out_dir)
    )
    discovered_reader_responses = discovered_payload.get("responses") or []
    state.discovered_reader_response_diagnostics = discovered_payload.get("diagnostics") or []
    state.raw_response_file_count = int(discovered_payload.get("responseFileCount") or 0)
    state.scanned_response_file_count = int(discovered_payload.get("scannedResponseFileCount") or 0)
    state.raw_response_file_error_count = int(discovered_payload.get("responseFileErrorCount") or 0)

    raw_responses = _reader_response_payload(
        reader_responses if reader_responses is not None else discovered_reader_responses
    )
    raw_response_source = "provided" if reader_responses is not None else "response_files"
    raw_responses["source"] = raw_response_source
    raw_responses["responseFileCount"] = state.raw_response_file_count
    raw_responses["scannedResponseFileCount"] = state.scanned_response_file_count
    raw_responses["responseFileErrorCount"] = state.raw_response_file_error_count
    raw_responses["diagnostics"] = state.discovered_reader_response_diagnostics

    state.loop = run_ai_visual_trace_agent_loop(
        work_order=state.work_order,
        responses=raw_responses.get("responses") or [],
        run_id=state.requests.get("runId"),
        reader_command=reader_command,
        reader_timeout_seconds=reader_timeout_seconds,
    )
    raw_response_source = _raw_reader_response_source(
        reader_responses_provided=reader_responses is not None,
        discovered_response_count=len(discovered_reader_responses or []),
        loop_response_count=len(state.loop.get("readerResponses") or []),
        reader_command_used=bool(reader_command),
    )
    raw_responses = _reader_response_payload(
        state.loop.get("readerResponses") or raw_responses.get("responses") or []
    )
    raw_responses["source"] = raw_response_source
    raw_responses["responseFileCount"] = state.raw_response_file_count
    raw_responses["scannedResponseFileCount"] = state.scanned_response_file_count
    raw_responses["responseFileErrorCount"] = state.raw_response_file_error_count
    raw_responses["diagnostics"] = state.discovered_reader_response_diagnostics
    state.raw_responses = raw_responses

    state.reader_pass_manifest = build_ai_visual_trace_reader_pass_manifest(
        agent_requests=state.requests,
        work_order=state.work_order,
        responses=state.raw_responses.get("responses") or [],
    )
    state.reader_assignment_progress = _build_reader_assignment_progress(
        reader_pass_manifest=state.reader_pass_manifest,
        raw_responses=state.raw_responses,
    )
    state.reader_consensus = build_source_reader_consensus_report(
        state.raw_responses,
        consensus_dispositions=reader_consensus_dispositions,
    )
    state.normalized = normalize_ai_visual_trace_reader_responses(state.raw_responses)
    state.reader_response_index = _build_reader_response_index(state.raw_responses, state.loop)


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
        "responsesDigestSha256": sha256_json(rows, ensure_ascii=False),
        "responses": rows,
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
        [path for pattern in ("*.json", "*.md") for path in response_root.rglob(pattern)]
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
    fence_pattern = re.compile(
        r"```(?:json|source-facts|sourcefacts)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE
    )
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
        row for row in reader_pass_manifest.get("assignments") or [] if isinstance(row, dict)
    ]
    responses = [row for row in raw_responses.get("responses") or [] if isinstance(row, dict)]
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
        norm_summary = (
            normalization.get("summary") if isinstance(normalization.get("summary"), dict) else {}
        )
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
            and str(
                response.get("workPackageId")
                or response.get("workPackage")
                or response.get("id")
                or ""
            )
            == package_id
            and str(response.get("readerPassId") or reader_pass_id) == reader_pass_id
        ):
            return response
    for response in responses:
        if (
            str(response.get("requestId") or "") == request_id
            and str(
                response.get("workPackageId")
                or response.get("workPackage")
                or response.get("id")
                or ""
            )
            == package_id
            and not response.get("readerPassId")
            and reader_pass_id == "reader-pass-01"
        ):
            return response
    if assignment_group_counts[(package_id, reader_pass_id)] == 1:
        for response in responses:
            response_package = str(
                response.get("workPackageId")
                or response.get("workPackage")
                or response.get("id")
                or ""
            )
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
        package_id = str(
            response.get("workPackageId") or response.get("workPackage") or response.get("id") or ""
        )
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
                "responseDigestSha256": sha256_json(response, ensure_ascii=False),
                "factCount": len(facts),
                "factCountsByKind": dict(
                    sorted(Counter(str(fact.get("kind") or "") for fact in facts).items())
                ),
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
    status_counts = dict(
        sorted(Counter(str(row.get("status") or "unknown") for row in rows).items())
    )
    return {
        "format": "sourceAiVisualTraceReaderResponseIndex_v1",
        "rawResponsesDigestSha256": raw_responses.get("responsesDigestSha256"),
        "responseCount": len(rows),
        "statusCounts": status_counts,
        "rows": rows,
    }


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
        row for row in reader_pass_manifest.get("assignments") or [] if isinstance(row, dict)
    ]
    open_assignments = [row for row in assignments if row.get("status") != "response_received"]
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
