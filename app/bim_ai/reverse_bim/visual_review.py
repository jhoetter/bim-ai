"""AI visual review requests for reverse-BIM screenshot evidence."""

from __future__ import annotations

from typing import Any


def build_reverse_bim_visual_review_requests(
    *,
    capture_run: dict[str, Any] | None = None,
    source_context: dict[str, Any] | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    """Create provider-neutral multimodal review requests for captured BIM views."""

    capture_run = capture_run or {}
    captures = [
        row
        for row in capture_run.get("captures") or []
        if isinstance(row, dict) and row.get("status") == "captured"
    ]
    source_context = source_context or {}
    requests = []
    for capture in captures:
        kind = str(capture.get("evidenceKind") or "")
        if kind == "ui":
            requests.append(_ui_request(capture, source_context=source_context, run_id=run_id))
        elif kind == "overlay":
            requests.append(_overlay_request(capture, source_context=source_context, run_id=run_id))
    blockers = []
    if not captures:
        blockers.append(
            {
                "code": "visual_review_no_captured_screenshots",
                "message": "No captured screenshots are available for visual review.",
            }
        )
    return {
        "ok": not blockers,
        "format": "reverseBimVisualReviewRequests_v1",
        "runId": run_id or capture_run.get("runId"),
        "summary": {
            "requestCount": len(requests),
            "uiRequestCount": sum(1 for row in requests if row.get("reviewKind") == "ui_checklist"),
            "overlayRequestCount": sum(
                1 for row in requests if row.get("reviewKind") == "source_overlay_metric"
            ),
            "blockerCount": len(blockers),
        },
        "requests": requests,
        "blockers": blockers,
        "responseContract": {
            "format": "reverseBimVisualReviewResponse_v1",
            "required": ["requestId", "captureId", "verdict"],
            "uiChecklist": "Return visualChecklist values keyed by item id with true/false.",
            "overlayMetric": "Return maxDeviationMm and verdict=passed/failed/accepted.",
        },
        "nextStep": (
            "Dispatch each request to a multimodal AI reviewer, then normalize responses."
            if not blockers
            else "Capture screenshots before visual review."
        ),
    }


def normalize_reverse_bim_visual_review_responses(
    *,
    capture_run: dict[str, Any] | None = None,
    visual_review_requests: dict[str, Any] | None = None,
    responses: list[dict[str, Any]] | None = None,
    default_tolerance_mm: float = 50.0,
) -> dict[str, Any]:
    """Normalize AI visual review responses into strict evidence gate rows."""

    capture_run = capture_run or {}
    request_rows = [
        row for row in (visual_review_requests or {}).get("requests") or [] if isinstance(row, dict)
    ]
    captures_by_id = {
        str(row.get("captureId")): row
        for row in capture_run.get("captures") or []
        if isinstance(row, dict) and row.get("captureId")
    }
    responses_by_key = _response_index(responses or [])
    ui_rows = []
    overlay_rows = []
    findings = []
    for request in request_rows:
        capture_id = str(request.get("captureId") or "")
        capture = captures_by_id.get(capture_id)
        response = (
            responses_by_key.get(str(request.get("requestId") or ""))
            or responses_by_key.get(capture_id)
            or responses_by_key.get(str(request.get("viewId") or ""))
        )
        if not capture:
            findings.append(
                _finding(
                    "visual_review_capture_missing", request, "Captured screenshot row is missing."
                )
            )
            continue
        if not response:
            findings.append(
                _finding(
                    "visual_review_response_missing",
                    request,
                    "AI visual review response is missing.",
                )
            )
            if request.get("reviewKind") == "ui_checklist":
                ui_rows.append(_ui_row(capture, request, {}, status="captured"))
            elif request.get("reviewKind") == "source_overlay_metric":
                overlay_rows.append(
                    _overlay_row(capture, request, {}, default_tolerance_mm, status="captured")
                )
            continue
        if request.get("reviewKind") == "ui_checklist":
            row, row_findings = _normalize_ui_response(capture, request, response)
            ui_rows.append(row)
            findings.extend(row_findings)
        elif request.get("reviewKind") == "source_overlay_metric":
            row, row_findings = _normalize_overlay_response(
                capture,
                request,
                response,
                default_tolerance_mm,
            )
            overlay_rows.append(row)
            findings.extend(row_findings)
    blockers = [row for row in findings if row.get("severity") == "error"]
    return {
        "ok": not blockers,
        "format": "reverseBimVisualReviewNormalization_v1",
        "summary": {
            "requestCount": len(request_rows),
            "responseCount": len(responses or []),
            "uiEvidenceRowCount": len(ui_rows),
            "overlayEvidenceRowCount": len(overlay_rows),
            "findingCount": len(findings),
            "blockerCount": len(blockers),
        },
        "uiEvidenceRows": ui_rows,
        "overlayEvidenceRows": overlay_rows,
        "findings": findings,
        "nextStep": (
            "Feed uiEvidenceRows and overlayEvidenceRows into the strict evidence gates."
            if not blockers
            else "Repair missing/failed visual review responses before acceptance."
        ),
    }


def _ui_request(
    capture: dict[str, Any],
    *,
    source_context: dict[str, Any],
    run_id: str | None,
) -> dict[str, Any]:
    checklist = _visual_checklist_items(capture)
    return {
        "requestId": f"visual-review:{capture.get('captureId')}",
        "reviewKind": "ui_checklist",
        "runId": run_id,
        "captureId": capture.get("captureId"),
        "viewId": capture.get("viewId"),
        "viewKind": capture.get("viewKind"),
        "imagePaths": [capture.get("path")],
        "requiredChecklistItems": checklist,
        "sourceContext": _source_context_for_capture(capture, source_context),
        "instructions": [
            "Review the BIM UI screenshot visually.",
            "Mark every checklist item true only if it is plainly satisfied in the screenshot.",
            "Do not infer correctness from element counts; use visible plan/3D evidence.",
            "Return false for placeholder massing, empty required levels, incoherent stairs/openings, or visible Advisor errors.",
        ],
    }


def _overlay_request(
    capture: dict[str, Any],
    *,
    source_context: dict[str, Any],
    run_id: str | None,
) -> dict[str, Any]:
    tolerance = _template(capture).get("toleranceMm") or capture.get("toleranceMm")
    return {
        "requestId": f"visual-review:{capture.get('captureId')}",
        "reviewKind": "source_overlay_metric",
        "runId": run_id,
        "captureId": capture.get("captureId"),
        "viewId": capture.get("viewId"),
        "viewKind": capture.get("viewKind"),
        "sourcePageId": capture.get("sourcePageId"),
        "coordinateFrameId": capture.get("coordinateFrameId"),
        "imagePaths": [capture.get("path")],
        "sourceContext": _source_context_for_capture(capture, source_context),
        "toleranceMm": tolerance,
        "instructions": [
            "Compare the modeled view/overlay to the cited source page or source-equivalent view.",
            "Return maxDeviationMm for the largest visible source/model mismatch.",
            "Return failed if scale, rotation, level, wall topology, openings, stairs, roof, or site placement are visibly wrong.",
            "Do not treat a modern-code warning as an overlay failure when the source documents prove the existing condition.",
        ],
    }


def _normalize_ui_response(
    capture: dict[str, Any],
    request: dict[str, Any],
    response: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    checklist = _checklist_from_response(response)
    missing = [
        item for item in request.get("requiredChecklistItems") or [] if item not in checklist
    ]
    failed = [item for item, value in checklist.items() if value is False]
    findings = []
    for item in missing:
        findings.append(
            _finding(
                "visual_review_checklist_item_missing", request, f"Missing checklist item: {item}"
            )
        )
    for item in failed:
        findings.append(
            _finding(
                "visual_review_checklist_item_failed", request, f"Failed checklist item: {item}"
            )
        )
    status = "passed" if not missing and not failed and _verdict_ok(response) else "blocked"
    if not _verdict_ok(response):
        findings.append(
            _finding(
                "visual_review_verdict_failed", request, "AI visual review verdict is not passing."
            )
        )
    return _ui_row(capture, request, checklist, status=status), findings


def _normalize_overlay_response(
    capture: dict[str, Any],
    request: dict[str, Any],
    response: dict[str, Any],
    default_tolerance_mm: float,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    tolerance = float(
        response.get("toleranceMm") or request.get("toleranceMm") or default_tolerance_mm
    )
    max_deviation = response.get("maxDeviationMm")
    findings = []
    if not isinstance(max_deviation, int | float):
        findings.append(
            _finding("visual_review_overlay_metric_missing", request, "maxDeviationMm is required.")
        )
        status = "blocked"
    elif float(max_deviation) > tolerance:
        findings.append(
            _finding(
                "visual_review_overlay_deviation_exceeds_tolerance",
                request,
                f"Overlay deviation {max_deviation}mm exceeds tolerance {tolerance}mm.",
            )
        )
        status = "blocked"
    elif _verdict_ok(response):
        status = "passed"
    else:
        findings.append(
            _finding(
                "visual_review_verdict_failed", request, "AI visual review verdict is not passing."
            )
        )
        status = "blocked"
    return _overlay_row(capture, request, response, default_tolerance_mm, status=status), findings


def _ui_row(
    capture: dict[str, Any],
    request: dict[str, Any],
    checklist: dict[str, bool],
    *,
    status: str,
) -> dict[str, Any]:
    template = _template(capture)
    return {
        **{key: value for key, value in template.items() if key != "visualChecklist"},
        "viewId": template.get("viewId") or request.get("viewId") or capture.get("viewId"),
        "kind": template.get("kind") or request.get("viewKind") or capture.get("viewKind"),
        "status": status,
        "path": capture.get("path"),
        "screenshotPath": capture.get("path"),
        "captureId": capture.get("captureId"),
        "visualChecklist": checklist,
        "reviewStatus": "reviewed" if checklist else "pending_ai_visual_review",
    }


def _overlay_row(
    capture: dict[str, Any],
    request: dict[str, Any],
    response: dict[str, Any],
    default_tolerance_mm: float,
    *,
    status: str,
) -> dict[str, Any]:
    template = _template(capture)
    tolerance = response.get("toleranceMm") or request.get("toleranceMm") or default_tolerance_mm
    return {
        **template,
        "viewId": template.get("viewId") or request.get("viewId") or capture.get("viewId"),
        "kind": template.get("kind") or request.get("viewKind") or capture.get("viewKind"),
        "status": status,
        "screenshotPath": capture.get("path"),
        "evidencePath": capture.get("path"),
        "captureId": capture.get("captureId"),
        "sourcePageId": template.get("sourcePageId") or request.get("sourcePageId"),
        "coordinateFrameId": template.get("coordinateFrameId") or request.get("coordinateFrameId"),
        "maxDeviationMm": response.get("maxDeviationMm"),
        "toleranceMm": tolerance,
        "reviewStatus": "reviewed" if response else "pending_overlay_metric",
        "reviewNotes": response.get("notes") or response.get("rationale"),
    }


def _source_context_for_capture(
    capture: dict[str, Any],
    source_context: dict[str, Any],
) -> dict[str, Any]:
    source_pages = source_context.get("sourcePages") or source_context.get("source_pages") or []
    page_id = str(capture.get("sourcePageId") or "")
    for row in source_pages:
        if isinstance(row, dict) and str(row.get("sourcePageId") or row.get("id") or "") == page_id:
            return row
    return {}


def _response_index(responses: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for response in responses:
        if not isinstance(response, dict):
            continue
        for key in (
            response.get("requestId"),
            response.get("captureId"),
            response.get("viewId"),
        ):
            if key:
                index[str(key)] = response
    return index


def _checklist_from_response(response: dict[str, Any]) -> dict[str, bool]:
    raw = response.get("visualChecklist") or response.get("checklist") or {}
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key, value in raw.items():
        if value is True or str(value).lower() in {"true", "passed", "accepted", "ok"}:
            out[str(key)] = True
        elif value is False or str(value).lower() in {"false", "failed", "blocked", "no"}:
            out[str(key)] = False
    return out


def _visual_checklist_items(capture: dict[str, Any]) -> list[str]:
    raw = capture.get("visualChecklistItems")
    if isinstance(raw, list):
        return [str(row) for row in raw if str(row).strip()]
    checklist = _template(capture).get("visualChecklist")
    if isinstance(checklist, dict):
        return [str(key) for key in checklist]
    return []


def _template(capture: dict[str, Any]) -> dict[str, Any]:
    template = capture.get("evidenceRowTemplate")
    return template if isinstance(template, dict) else {}


def _verdict_ok(response: dict[str, Any]) -> bool:
    verdict = str(response.get("verdict") or response.get("status") or "").lower()
    return verdict in {"passed", "pass", "accepted", "ok", "true"}


def _finding(code: str, request: dict[str, Any], message: str) -> dict[str, Any]:
    return {
        "code": code,
        "severity": "error",
        "requestId": request.get("requestId"),
        "captureId": request.get("captureId"),
        "viewId": request.get("viewId"),
        "message": message,
    }
