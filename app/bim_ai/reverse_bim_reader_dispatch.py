"""Assignment-level reader dispatch for reverse-BIM folder-output packages."""

from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


OPEN_PROGRESS_STATUSES = {
    "waiting_for_reader",
    "response_invalid",
    "response_has_no_facts",
}


def build_reverse_bim_reader_dispatch_plan(
    *,
    output_dir: str | Path,
    include_completed: bool = False,
    limit: int | None = None,
) -> dict[str, Any]:
    """Build a deterministic plan for dispatching open reader assignments.

    This consumes an existing reverse-BIM folder-output package. It does not
    call any AI provider; it tells the caller exactly which assignment payloads
    must be sent to a multimodal reader command.
    """

    out_dir = Path(output_dir).expanduser().resolve()
    requests = _read_json(out_dir / "ai-reading" / "ai-visual-agent-requests.json")
    manifest = _read_json(out_dir / "ai-reading" / "reader-pass-manifest.json")
    prompts = _read_json(out_dir / "ai-reading" / "reader-assignment-prompts.json")
    progress = _read_json(out_dir / "ai-reading" / "reader-assignment-progress.json")

    request_by_id = {
        str(row.get("requestId") or ""): row
        for row in requests.get("requests") or []
        if isinstance(row, dict) and row.get("requestId")
    }
    prompt_by_assignment = {
        str(row.get("assignmentId") or ""): row
        for row in prompts.get("prompts") or []
        if isinstance(row, dict) and row.get("assignmentId")
    }
    progress_by_assignment = {
        str(row.get("assignmentId") or ""): row
        for row in progress.get("rows") or []
        if isinstance(row, dict) and row.get("assignmentId")
    }

    rows: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    for assignment in manifest.get("assignments") or []:
        if not isinstance(assignment, dict):
            continue
        assignment_id = str(assignment.get("assignmentId") or "")
        if not assignment_id:
            diagnostics.append(
                _diagnostic(
                    "reader_dispatch_assignment_id_missing",
                    "Reader assignment has no assignmentId.",
                    assignment=assignment,
                )
            )
            continue
        progress_row = progress_by_assignment.get(assignment_id, {})
        progress_status = str(progress_row.get("status") or assignment.get("status") or "")
        if not include_completed and progress_status not in OPEN_PROGRESS_STATUSES:
            continue
        request_id = str(assignment.get("requestId") or "")
        request = request_by_id.get(request_id)
        if not request:
            diagnostics.append(
                _diagnostic(
                    "reader_dispatch_request_missing",
                    "Reader assignment references a request that was not found.",
                    assignment=assignment,
                    requestId=request_id,
                )
            )
            continue
        prompt = prompt_by_assignment.get(assignment_id, {})
        response_path_hint = str(
            assignment.get("responsePathHint") or prompt.get("responsePathHint") or ""
        )
        response_path = (
            (out_dir / response_path_hint).resolve()
            if response_path_hint
            else out_dir
            / "ai-reading"
            / "responses"
            / str(assignment.get("readerPassId") or "reader-pass-01")
            / f"{_safe_stem(request_id)}.json"
        )
        rows.append(
            {
                "assignmentId": assignment_id,
                "readerPassId": assignment.get("readerPassId"),
                "workPackageId": assignment.get("workPackageId"),
                "requestId": request_id,
                "requestPartIndex": assignment.get("requestPartIndex"),
                "requestPartCount": assignment.get("requestPartCount"),
                "status": progress_status or "waiting_for_reader",
                "criticalConsensusPackage": assignment.get("criticalConsensusPackage"),
                "independentReaderRequired": assignment.get("independentReaderRequired"),
                "inputImageCount": assignment.get("inputImageCount", 0),
                "promptPath": prompt.get("promptPath"),
                "responsePathHint": response_path_hint,
                "responsePath": str(response_path),
                "responseExists": response_path.exists(),
                "request": _dispatch_request_payload(request, assignment, response_path_hint),
            }
        )
        if limit is not None and limit > 0 and len(rows) >= limit:
            break

    return {
        "ok": not diagnostics,
        "format": "reverseBimReaderDispatchPlan_v1",
        "outputDir": str(out_dir),
        "createdAt": datetime.now(UTC).isoformat(),
        "summary": {
            "assignmentCount": len(rows),
            "diagnosticCount": len(diagnostics),
            "responseExistsCount": sum(1 for row in rows if row.get("responseExists")),
            "criticalAssignmentCount": sum(1 for row in rows if row.get("criticalConsensusPackage")),
            "independentReaderAssignmentCount": sum(
                1 for row in rows if row.get("independentReaderRequired")
            ),
        },
        "assignments": rows,
        "diagnostics": diagnostics,
    }


def execute_reverse_bim_reader_dispatch(
    *,
    output_dir: str | Path,
    reader_command: list[str],
    include_completed: bool = False,
    force: bool = False,
    limit: int | None = None,
    timeout_seconds: int = 300,
) -> dict[str, Any]:
    """Execute open reader assignments and write response JSON files."""

    plan = build_reverse_bim_reader_dispatch_plan(
        output_dir=output_dir,
        include_completed=include_completed,
        limit=limit,
    )
    rows: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = list(plan.get("diagnostics") or [])
    for assignment in plan.get("assignments") or []:
        if not isinstance(assignment, dict):
            continue
        response_path = Path(str(assignment.get("responsePath") or ""))
        if response_path.exists() and not force:
            rows.append(
                {
                    "assignmentId": assignment.get("assignmentId"),
                    "status": "skipped_existing_response",
                    "responsePath": str(response_path),
                }
            )
            continue
        response, diagnostic = _call_reader_command(
            reader_command,
            assignment.get("request") if isinstance(assignment.get("request"), dict) else {},
            timeout_seconds=timeout_seconds,
        )
        if diagnostic:
            diagnostic = {
                **diagnostic,
                "assignmentId": assignment.get("assignmentId"),
                "requestId": assignment.get("requestId"),
                "readerPassId": assignment.get("readerPassId"),
                "workPackageId": assignment.get("workPackageId"),
            }
            diagnostics.append(diagnostic)
            rows.append(
                {
                    "assignmentId": assignment.get("assignmentId"),
                    "status": "failed",
                    "diagnostic": diagnostic,
                }
            )
            continue
        response_payload = _response_with_assignment_defaults(response or {}, assignment)
        response_path.parent.mkdir(parents=True, exist_ok=True)
        response_path.write_text(
            json.dumps(response_payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        rows.append(
            {
                "assignmentId": assignment.get("assignmentId"),
                "status": "written",
                "responsePath": str(response_path),
                "responseDigestSha256": _sha256_json(response_payload),
                "factCount": len(
                    [fact for fact in response_payload.get("facts") or [] if isinstance(fact, dict)]
                ),
            }
        )

    status_counts: dict[str, int] = {}
    for row in rows:
        status = str(row.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    return {
        "ok": not diagnostics,
        "format": "reverseBimReaderDispatchRun_v1",
        "outputDir": plan.get("outputDir"),
        "createdAt": datetime.now(UTC).isoformat(),
        "planSummary": plan.get("summary"),
        "summary": {
            "assignmentCount": len(rows),
            "writtenResponseCount": status_counts.get("written", 0),
            "skippedExistingResponseCount": status_counts.get("skipped_existing_response", 0),
            "failedAssignmentCount": status_counts.get("failed", 0),
            "diagnosticCount": len(diagnostics),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "rows": rows,
        "diagnostics": diagnostics,
        "nextStep": (
            "Rerun reverse_bim.folder_output with reset_output=false to load reader responses."
            if not diagnostics
            else "Fix reader dispatch diagnostics before rerunning folder-output."
        ),
    }


def _dispatch_request_payload(
    request: dict[str, Any],
    assignment: dict[str, Any],
    response_path_hint: str,
) -> dict[str, Any]:
    return {
        **request,
        "assignmentId": assignment.get("assignmentId"),
        "readerPassId": assignment.get("readerPassId"),
        "responsePathHint": response_path_hint,
        "independentReaderRequired": assignment.get("independentReaderRequired"),
        "criticalConsensusPackage": assignment.get("criticalConsensusPackage"),
    }


def _response_with_assignment_defaults(response: dict[str, Any], assignment: dict[str, Any]) -> dict[str, Any]:
    payload = {
        **response,
        "format": response.get("format") or "sourceAiVisualTraceReaderResponse_v1",
        "assignmentId": response.get("assignmentId") or assignment.get("assignmentId"),
        "readerPassId": response.get("readerPassId") or assignment.get("readerPassId"),
        "requestId": response.get("requestId") or assignment.get("requestId"),
        "workPackageId": (
            response.get("workPackageId")
            or response.get("workPackage")
            or assignment.get("workPackageId")
        ),
        "responsePathHint": response.get("responsePathHint") or assignment.get("responsePathHint"),
    }
    if not isinstance(payload.get("facts"), list):
        payload["facts"] = []
    return payload


def _call_reader_command(
    command: list[str],
    request: dict[str, Any],
    *,
    timeout_seconds: int,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not command:
        return None, _diagnostic("reader_dispatch_command_empty", "Reader command is empty.")
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
        return None, _diagnostic("reader_dispatch_command_not_found", str(exc))
    except subprocess.TimeoutExpired as exc:
        return None, _diagnostic("reader_dispatch_command_timeout", str(exc))
    if proc.returncode != 0:
        return None, _diagnostic(
            "reader_dispatch_command_failed",
            "Reader command exited with non-zero status.",
            returnCode=proc.returncode,
            stderr=proc.stderr.strip()[:2000],
        )
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        return None, _diagnostic(
            "reader_dispatch_command_invalid_json",
            str(exc),
            stdoutExcerpt=proc.stdout[:2000],
        )
    if not isinstance(payload, dict):
        return None, _diagnostic(
            "reader_dispatch_command_non_object",
            "Reader command must return one JSON object.",
        )
    return payload, None


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _diagnostic(code: str, message: str, **extra: Any) -> dict[str, Any]:
    return {"code": code, "severity": "error", "message": message, **extra}


def _sha256_json(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _safe_stem(value: str) -> str:
    stem = "".join(char if char.isalnum() or char in "._-" else "-" for char in value).strip("-")
    return stem[:120] or "reader-response"
