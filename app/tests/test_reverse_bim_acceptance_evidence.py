from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.reverse_bim_acceptance_evidence import (
    build_level_completeness_report,
    build_physical_topology_report,
    build_source_overlay_evidence_report,
    build_ui_evidence_report,
)
from bim_ai.reverse_bim_visual_capture import build_reverse_bim_view_capture_plan
from bim_ai.reverse_bim_visual_review import (
    build_reverse_bim_visual_review_requests,
    normalize_reverse_bim_visual_review_responses,
)
from bim_ai.routes_api import api_router


def test_level_completeness_blocks_empty_kg() -> None:
    report = build_level_completeness_report(
        required_levels=[
            {"levelId": "KG", "name": "KG"},
            {"levelId": "EG", "name": "EG"},
        ],
        model_summary={
            "levels": [
                {"id": "KG", "name": "KG"},
                {"id": "EG", "name": "EG"},
            ],
            "wallsByLevelId": {"EG": 8},
            "roomsByLevelId": {"EG": 5},
        },
    )

    assert report["ok"] is False
    assert report["summary"]["emptyRequiredLevelIds"] == ["KG"]


def test_physical_topology_blocks_unhosted_openings_and_stair_clash() -> None:
    report = build_physical_topology_report(
        room_boundary_edges={
            "data": {
                "boundaryEdges": {
                    "summary": {
                        "unbackedEdgeCount": 2,
                        "partialEdgeCount": 0,
                        "analyticalOnlyRoomCount": 1,
                    }
                }
            }
        },
        room_access_graph={"data": {"graph": {"inaccessibleRoomIds": []}}},
        openings=[{"id": "door-a"}],
        advisor={
            "data": {
                "findings": [
                    {
                        "ruleId": "stair_wall_hard_clash",
                        "severity": "warning",
                    }
                ]
            }
        },
    )

    assert report["ok"] is False
    assert report["summary"]["unbackedPhysicalRoomCount"] == 3
    assert report["summary"]["unhostedOpeningCount"] == 1
    assert report["summary"]["stairClashCount"] == 1


def test_source_overlay_and_ui_evidence_require_required_views() -> None:
    overlay = build_source_overlay_evidence_report(
        required_views=[
            {"viewId": "plan-eg", "kind": "floor_plan"},
            {"viewId": "section-a", "kind": "section"},
        ],
        overlay_results=[
            {
                "viewId": "plan-eg",
                "status": "passed",
                "maxDeviationMm": 12,
                "screenshotPath": "evidence/plan-eg.png",
            }
        ],
    )
    ui = build_ui_evidence_report(
        required_views=[{"viewId": "3d-overview", "kind": "3d"}],
        screenshots=[],
    )

    assert overlay["ok"] is False
    assert overlay["summary"]["missingRequiredViewCount"] == 1
    assert ui["ok"] is False
    assert ui["summary"]["missingScreenshotCount"] == 1


def test_ui_evidence_requires_visual_checklist_for_human_visible_failures() -> None:
    missing_checklist = build_ui_evidence_report(
        required_views=[{"viewId": "plan-eg", "kind": "floor_plan"}],
        screenshots=[
            {
                "viewId": "plan-eg",
                "status": "captured",
                "path": "evidence/ui/plan-eg.png",
            }
        ],
    )
    accepted = build_ui_evidence_report(
        required_views=[{"viewId": "plan-eg", "kind": "floor_plan"}],
        screenshots=[
            {
                "viewId": "plan-eg",
                "status": "captured",
                "path": "evidence/ui/plan-eg.png",
                "visualChecklist": {
                    "no_placeholder_or_rough_massing_visible": True,
                    "advisor_visible_state_not_showing_errors": True,
                    "floorplan_topology_matches_source": True,
                    "doors_windows_hosted_in_walls": True,
                    "required_level_not_empty": True,
                },
            }
        ],
    )
    failed = build_ui_evidence_report(
        required_views=[{"viewId": "stair-cutaway", "kind": "3d_cutaway"}],
        screenshots=[
            {
                "viewId": "stair-cutaway",
                "status": "captured",
                "path": "evidence/ui/stair-cutaway.png",
                "visualChecklist": {
                    "no_placeholder_or_rough_massing_visible": True,
                    "advisor_visible_state_not_showing_errors": True,
                    "stairs_openings_and_rooms_physically_coherent": False,
                    "no_assets_or_openings_on_stairs": True,
                },
            }
        ],
    )

    assert missing_checklist["ok"] is False
    assert missing_checklist["summary"]["missingVisualChecklistItemCount"] == 5
    assert accepted["ok"] is True
    assert failed["ok"] is False
    assert failed["summary"]["failedVisualChecklistItemCount"] == 1


def test_view_capture_plan_creates_ui_and_overlay_work_order() -> None:
    plan = build_reverse_bim_view_capture_plan(
        model_id="model-1",
        output_dir="tmp/reverse-bim/evidence",
        run_id="leo-run",
        required_ui_views=[
            {
                "viewId": "ui:plan:EG",
                "kind": "floor_plan",
                "visualChecklistItems": ["required_level_not_empty"],
            }
        ],
        required_overlay_views=[
            {
                "viewId": "overlay:eg-p1",
                "kind": "floor_plan",
                "sourcePageId": "eg-p1",
                "coordinateFrameId": "frame-eg",
            }
        ],
    )

    assert plan["ok"] is True
    assert plan["summary"]["captureCount"] == 2
    assert plan["captures"][0]["evidenceRowTemplate"]["visualChecklist"] == {
        "required_level_not_empty": False
    }
    assert plan["captures"][1]["evidenceRowTemplate"]["sourcePageId"] == "eg-p1"


def test_visual_review_normalizes_ai_screenshot_responses_into_evidence_rows() -> None:
    capture_run = {
        "format": "reverseBimViewCaptureRun_v1",
        "captures": [
            {
                "captureId": "ui:plan-eg",
                "evidenceKind": "ui",
                "viewId": "plan-eg",
                "viewKind": "floor_plan",
                "status": "captured",
                "path": "evidence/ui-plan-eg.png",
                "evidenceRowTemplate": {
                    "viewId": "plan-eg",
                    "kind": "floor_plan",
                    "visualChecklist": {
                        "required_level_not_empty": False,
                        "room_labels_match_source": False,
                    },
                },
            },
            {
                "captureId": "overlay:eg-p1",
                "evidenceKind": "overlay",
                "viewId": "overlay-eg-p1",
                "viewKind": "floor_plan",
                "sourcePageId": "eg-p1",
                "coordinateFrameId": "frame-eg",
                "status": "captured",
                "path": "evidence/overlay-eg-p1.png",
                "evidenceRowTemplate": {
                    "viewId": "overlay-eg-p1",
                    "kind": "floor_plan",
                    "sourcePageId": "eg-p1",
                    "coordinateFrameId": "frame-eg",
                    "toleranceMm": 40,
                },
            },
        ],
    }
    requests = build_reverse_bim_visual_review_requests(capture_run=capture_run)
    normalized = normalize_reverse_bim_visual_review_responses(
        capture_run=capture_run,
        visual_review_requests=requests,
        responses=[
            {
                "captureId": "ui:plan-eg",
                "verdict": "passed",
                "visualChecklist": {
                    "required_level_not_empty": True,
                    "room_labels_match_source": True,
                },
            },
            {
                "captureId": "overlay:eg-p1",
                "verdict": "passed",
                "maxDeviationMm": 12,
            },
        ],
    )

    assert requests["ok"] is True
    assert requests["summary"]["uiRequestCount"] == 1
    assert requests["summary"]["overlayRequestCount"] == 1
    assert normalized["ok"] is True
    assert normalized["uiEvidenceRows"][0]["visualChecklist"] == {
        "required_level_not_empty": True,
        "room_labels_match_source": True,
    }
    assert normalized["overlayEvidenceRows"][0]["maxDeviationMm"] == 12
    assert normalized["overlayEvidenceRows"][0]["status"] == "passed"


def test_visual_review_blocks_missing_or_failed_ai_responses() -> None:
    capture_run = {
        "captures": [
            {
                "captureId": "ui:plan-eg",
                "evidenceKind": "ui",
                "viewId": "plan-eg",
                "viewKind": "floor_plan",
                "status": "captured",
                "path": "evidence/ui-plan-eg.png",
                "evidenceRowTemplate": {
                    "visualChecklist": {"required_level_not_empty": False}
                },
            }
        ]
    }
    requests = build_reverse_bim_visual_review_requests(capture_run=capture_run)
    missing = normalize_reverse_bim_visual_review_responses(
        capture_run=capture_run,
        visual_review_requests=requests,
        responses=[],
    )
    failed = normalize_reverse_bim_visual_review_responses(
        capture_run=capture_run,
        visual_review_requests=requests,
        responses=[
            {
                "captureId": "ui:plan-eg",
                "verdict": "failed",
                "visualChecklist": {"required_level_not_empty": False},
            }
        ],
    )

    assert missing["ok"] is False
    assert missing["findings"][0]["code"] == "visual_review_response_missing"
    assert failed["ok"] is False
    assert failed["uiEvidenceRows"][0]["status"] == "blocked"


def test_acceptance_evidence_routes() -> None:
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    resp = client.post(
        "/api/v3/reverse-bim/level-completeness",
        json={
            "requiredLevels": [{"levelId": "EG"}],
            "modelSummary": {
                "levels": [{"id": "EG", "name": "EG"}],
                "wallsByLevelId": {"EG": 3},
                "roomsByLevelId": {"EG": 2},
            },
        },
    )

    assert resp.status_code == 200
    assert resp.json()["summary"]["accepted"] is True

    alias_resp = client.post(
        "/api/v3/qa/physical-topology",
        json={"roomBoundaryEdges": {"data": {"boundaryEdges": {"summary": {}}}}},
    )
    capture_resp = client.post(
        "/api/v3/reverse-bim/view-capture-plan",
        json={
            "modelId": "model-1",
            "outputDir": "tmp/evidence",
            "evidenceRequirements": {
                "requiredUiViews": [{"viewId": "ui:3d:overview", "kind": "3d"}]
            },
        },
    )
    execute_resp = client.post(
        "/api/v3/reverse-bim/view-capture-execute",
        json={
            "planPath": "tmp/evidence/view-capture-plan.json",
            "outputDir": "tmp/evidence",
        },
    )
    visual_requests_resp = client.post(
        "/api/v3/reverse-bim/visual-review-requests",
        json={
            "captureRun": {
                "captures": [
                    {
                        "captureId": "ui:3d",
                        "evidenceKind": "ui",
                        "viewId": "ui:3d:overview",
                        "viewKind": "3d",
                        "status": "captured",
                        "path": "tmp/evidence/ui-3d.png",
                    }
                ]
            }
        },
    )
    visual_normalize_resp = client.post(
        "/api/v3/reverse-bim/visual-review-normalize",
        json={
            "captureRun": {
                "captures": [
                    {
                        "captureId": "ui:3d",
                        "evidenceKind": "ui",
                        "viewId": "ui:3d:overview",
                        "viewKind": "3d",
                        "status": "captured",
                        "path": "tmp/evidence/ui-3d.png",
                    }
                ]
            },
            "visualReviewRequests": visual_requests_resp.json(),
            "responses": [{"captureId": "ui:3d", "verdict": "passed"}],
        },
    )

    assert alias_resp.status_code == 200
    assert alias_resp.json()["summary"]["accepted"] is True
    assert capture_resp.status_code == 200
    assert capture_resp.json()["format"] == "reverseBimViewCapturePlan_v1"
    assert execute_resp.status_code == 200
    assert execute_resp.json()["format"] == "reverseBimViewCaptureExecutionRequest_v1"
    assert visual_requests_resp.status_code == 200
    assert visual_requests_resp.json()["format"] == "reverseBimVisualReviewRequests_v1"
    assert visual_normalize_resp.status_code == 200
    assert (
        visual_normalize_resp.json()["format"]
        == "reverseBimVisualReviewNormalization_v1"
    )
