from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.reverse_bim_acceptance_evidence import (
    build_level_completeness_report,
    build_physical_topology_report,
    build_source_overlay_evidence_report,
    build_ui_evidence_report,
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

    assert alias_resp.status_code == 200
    assert alias_resp.json()["summary"]["accepted"] is True
