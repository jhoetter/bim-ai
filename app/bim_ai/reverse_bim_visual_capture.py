"""Deterministic view-capture work orders for reverse-BIM evidence."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any


def build_reverse_bim_view_capture_plan(
    *,
    model_id: str | None = None,
    required_ui_views: list[dict[str, Any]] | None = None,
    required_overlay_views: list[dict[str, Any]] | None = None,
    output_dir: str | None = None,
    base_url: str | None = None,
    run_id: str | None = None,
    viewport: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a browser/Playwright capture work order for required BIM views.

    This does not capture pixels by itself. It is the stable contract that tells
    a runtime agent or Playwright runner which live BIM views must be opened,
    what PNG path each capture must write, and which checklist items are needed
    before `reverse_bim.ui_evidence` and `reverse_bim.source_overlay_evidence`
    can pass.
    """

    ui_views = [row for row in required_ui_views or [] if isinstance(row, dict)]
    overlay_views = [row for row in required_overlay_views or [] if isinstance(row, dict)]
    blockers = []
    if not model_id:
        blockers.append(
            {
                "code": "capture_model_id_missing",
                "message": "A model id is required to capture live BIM UI evidence.",
            }
        )
    if not output_dir:
        blockers.append(
            {
                "code": "capture_output_dir_missing",
                "message": "An output directory is required for screenshot artifacts.",
            }
        )
    if not ui_views and not overlay_views:
        blockers.append(
            {
                "code": "capture_required_views_missing",
                "message": "No required UI or overlay views were supplied.",
            }
        )

    captures = []
    for view in ui_views:
        captures.append(
            _capture_row(
                view=view,
                model_id=model_id,
                output_dir=output_dir,
                base_url=base_url,
                run_id=run_id,
                evidence_kind="ui",
            )
        )
    for view in overlay_views:
        captures.append(
            _capture_row(
                view=view,
                model_id=model_id,
                output_dir=output_dir,
                base_url=base_url,
                run_id=run_id,
                evidence_kind="overlay",
            )
        )

    payload = {
        "ok": not blockers,
        "format": "reverseBimViewCapturePlan_v1",
        "summary": {
            "captureCount": len(captures),
            "uiCaptureCount": sum(1 for row in captures if row.get("evidenceKind") == "ui"),
            "overlayCaptureCount": sum(1 for row in captures if row.get("evidenceKind") == "overlay"),
            "blockerCount": len(blockers),
        },
        "modelId": model_id,
        "runId": run_id,
        "baseUrl": base_url or "http://127.0.0.1:2000",
        "viewport": {
            "width": int((viewport or {}).get("width") or 1920),
            "height": int((viewport or {}).get("height") or 1200),
            "deviceScaleFactor": float((viewport or {}).get("deviceScaleFactor") or 1),
        },
        "captures": captures,
        "blockers": blockers,
        "runnerContract": {
            "recommendedRunner": "Playwright",
            "modelMutationAllowed": False,
            "requiredOutput": [
                "PNG screenshot at capture.path",
                "status=captured or passed",
                "capturedAt timestamp",
                "current model revision/head if available",
                "completed visualChecklist for UI captures",
            ],
            "feeds": {
                "ui": "reverse_bim.ui_evidence",
                "overlay": "reverse_bim.source_overlay_evidence",
            },
        },
        "nextStep": (
            "Run the browser capture work order, then feed screenshots/overlays into evidence gates."
            if not blockers
            else "Resolve capture blockers before evidence collection."
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def _capture_row(
    *,
    view: dict[str, Any],
    model_id: str | None,
    output_dir: str | None,
    base_url: str | None,
    run_id: str | None,
    evidence_kind: str,
) -> dict[str, Any]:
    view_id = str(view.get("viewId") or view.get("id") or f"{evidence_kind}:unknown")
    capture_id = f"{evidence_kind}:{_slug(view_id)}"
    path = f"{(output_dir or 'reverse-bim-evidence').rstrip('/')}/{_slug(run_id or 'run')}/{_slug(capture_id)}.png"
    return {
        "captureId": capture_id,
        "evidenceKind": evidence_kind,
        "viewId": view_id,
        "viewKind": view.get("kind") or view.get("viewKind"),
        "levelId": view.get("levelId"),
        "sourcePageId": view.get("sourcePageId"),
        "sourceDocumentId": view.get("sourceDocumentId"),
        "coordinateFrameId": view.get("coordinateFrameId"),
        "renderedPagePath": view.get("renderedPagePath"),
        "toleranceMm": view.get("toleranceMm"),
        "path": path,
        "url": _view_url(
            base_url=base_url,
            model_id=model_id,
            view_id=view_id,
            evidence_kind=evidence_kind,
        ),
        "visualChecklistItems": view.get("visualChecklistItems") or [],
        "playwrightSteps": _playwright_steps(view, evidence_kind=evidence_kind),
        "evidenceRowTemplate": _evidence_row_template(view, evidence_kind=evidence_kind, path=path),
    }


def _view_url(
    *,
    base_url: str | None,
    model_id: str | None,
    view_id: str,
    evidence_kind: str,
) -> str:
    root = (base_url or "http://127.0.0.1:2000").rstrip("/")
    model = model_id or "{modelId}"
    return f"{root}/?modelId={model}&reverseBimView={view_id}&evidenceKind={evidence_kind}"


def _playwright_steps(view: dict[str, Any], *, evidence_kind: str) -> list[dict[str, Any]]:
    steps = [
        {"action": "open_url", "target": "url"},
        {"action": "wait_for_model_idle", "target": "jobs/status"},
    ]
    view_kind = str(view.get("kind") or "")
    if view_kind in {"floor_plan", "site_plan", "site"}:
        steps.append({"action": "activate_plan_or_site_view", "viewId": view.get("viewId")})
    elif view_kind in {"section", "elevation"}:
        steps.append({"action": "activate_section_or_elevation_view", "viewId": view.get("viewId")})
    else:
        steps.append({"action": "activate_3d_view", "viewId": view.get("viewId")})
    if evidence_kind == "overlay":
        steps.append({"action": "enable_source_underlay_or_overlay", "sourcePageId": view.get("sourcePageId")})
    steps.append({"action": "screenshot", "selector": "[data-evidence-capture-root], body"})
    return steps


def _evidence_row_template(
    view: dict[str, Any],
    *,
    evidence_kind: str,
    path: str,
) -> dict[str, Any]:
    base = {
        "viewId": view.get("viewId"),
        "kind": view.get("kind"),
        "status": "captured",
    }
    if evidence_kind == "ui":
        return {
            **base,
            "path": path,
            "visualChecklist": {
                str(item): False for item in view.get("visualChecklistItems") or []
            },
        }
    return {
        **base,
        "screenshotPath": path,
        "sourcePageId": view.get("sourcePageId"),
        "coordinateFrameId": view.get("coordinateFrameId"),
        "maxDeviationMm": None,
    }


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-").lower()
    return slug or "capture"


def _digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
