from __future__ import annotations

from bim_ai.reverse_bim_evidence_requirements import build_reverse_bim_evidence_requirements


def test_evidence_requirements_derives_overlay_and_ui_views() -> None:
    report = build_reverse_bim_evidence_requirements(
        source_page_index={
            "pages": [
                {
                    "sourcePageId": "src-plan:p1",
                    "sourceDocumentId": "src-plan",
                    "page": 1,
                    "classification": "floor_plan",
                    "coordinateFrameId": "frame-plan",
                    "renderedPagePath": "rendered/plan.png",
                },
                {
                    "sourcePageId": "src-photo:p1",
                    "sourceDocumentId": "src-photo",
                    "page": 1,
                    "classification": "photo",
                },
                {
                    "sourcePageId": "src-admin:p2",
                    "sourceDocumentId": "src-admin",
                    "page": 2,
                    "classification": "legal_admin",
                    "matchedClassifications": ["site_plan", "elevation"],
                    "classificationRoles": [{"classification": "calculation"}],
                    "renderedPagePath": "rendered/admin-p2.png",
                },
            ]
        },
        source_facts=[
            {
                "factId": "level-kg",
                "kind": "level",
                "value": {"levelId": "KG", "name": "KG"},
            },
            {
                "factId": "level-eg",
                "kind": "level",
                "value": {"levelId": "EG", "name": "EG"},
            },
        ],
        phase_authoring_spec={
            "phases": [
                {"phaseId": "P9-roof-dormers", "sourceFactIds": ["roof"]},
                {"phaseId": "P11-terrain-parcel-topology", "sourceFactIds": ["site"]},
            ]
        },
    )

    assert report["format"] == "reverseBimEvidenceRequirements_v1"
    assert report["summary"]["overlayViewCount"] == 3
    assert report["requiredOverlayViews"][0]["viewId"] == "overlay:src-plan:p1"
    multi_role_view_ids = {row["viewId"] for row in report["requiredOverlayViews"]}
    assert "overlay:src-admin:p2:site_plan" in multi_role_view_ids
    assert "overlay:src-admin:p2:elevation" in multi_role_view_ids
    site_overlay = next(
        row for row in report["requiredOverlayViews"] if row["viewId"] == "overlay:src-admin:p2:site_plan"
    )
    assert site_overlay["sourceRoles"] == ["site_plan", "elevation"]
    ui_view_ids = {row["viewId"] for row in report["requiredUiViews"]}
    assert {"ui:plan:KG", "ui:plan:EG", "ui:3d:overview", "ui:elevation:roof-dormers", "ui:site:placement"} <= ui_view_ids
    plan_kg = next(row for row in report["requiredUiViews"] if row["viewId"] == "ui:plan:KG")
    assert "required_level_not_empty" in plan_kg["visualChecklistItems"]
