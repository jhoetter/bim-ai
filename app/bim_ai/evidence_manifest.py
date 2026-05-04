"""Structured evidence-package manifest (Revit parity Phase A operational tracker)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from bim_ai.document import Document
from bim_ai.elements import PlanViewElem


def export_link_map(model_id: UUID) -> dict[str, str]:
    mid = str(model_id)
    base = f"/api/models/{mid}"
    return {
        "snapshot": f"{base}/snapshot",
        "summary": f"{base}/summary",
        "validate": f"{base}/validate",
        "evidencePackage": f"{base}/evidence-package",
        "commandLog": f"{base}/command-log",
        "gltfManifest": f"{base}/exports/gltf-manifest",
        "ifcManifest": f"{base}/exports/ifc-manifest",
        "ifcEmptySkeleton": f"{base}/exports/ifc-empty-skeleton.ifc",
        "bcfTopicsJsonExport": f"{base}/exports/bcf-topics-json",
        "bcfTopicsJsonImport": f"{base}/imports/bcf-topics-json",
        "sheetPreviewSvg": f"{base}/exports/sheet-preview.svg",
        "sheetPreviewPdf": f"{base}/exports/sheet-preview.pdf",
    }


def expected_screenshot_captures(plan_view_ids: list[str]) -> list[dict[str, Any]]:
    """Human/CI checklist: correlate Playwright snapshots with layouts (not enforced server-side)."""
    base = [
        {
            "id": "coord_sheet",
            "workspaceLayoutPreset": "coordination",
            "recommendedTestIds": ["sheet-canvas", "schedule-panel"],
            "screenshotBaseline": "coordination-sheet.png",
            "note": "Sheet canvas + schedules rail",
        },
        {
            "id": "coord_schedules",
            "workspaceLayoutPreset": "coordination",
            "recommendedTestIds": ["schedule-panel"],
            "screenshotBaseline": "coordination-schedules.png",
        },
        {
            "id": "schedules_focus",
            "workspaceLayoutPreset": "schedules_focus",
            "recommendedTestIds": ["schedule-panel", "plan-canvas"],
            "screenshotBaseline": "schedules-focus.png",
            "note": "Docked schedule beside plan",
        },
        {
            "id": "split_plan_3d",
            "workspaceLayoutPreset": "split_plan_3d",
            "recommendedTestIds": ["plan-canvas", "orbit-3d-viewport"],
            "note": "WebGL-heavy; PNG optional, visibility required in CI",
        },
        {
            "id": "split_plan_section",
            "workspaceLayoutPreset": "split_plan_section",
            "recommendedTestIds": ["plan-canvas"],
        },
    ]
    for pv in plan_view_ids:
        base.append(
            {
                "id": f"activate_plan_view_{pv}",
                "workspaceLayoutPreset": "split_plan_3d",
                "planViewElementId": pv,
                "recommendedTestIds": ["plan-canvas"],
                "note": "Activate named plan_view in Project browser before capture",
            }
        )
    return base


def plan_view_wire_index(doc: Document) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in doc.elements.values():
        if isinstance(e, PlanViewElem):
            cmap_min = e.crop_min_mm.model_dump(by_alias=True) if e.crop_min_mm else None
            cmap_max = e.crop_max_mm.model_dump(by_alias=True) if e.crop_max_mm else None
            out.append(
                {
                    "id": e.id,
                    "name": e.name,
                    "levelId": e.level_id,
                    "planPresentation": e.plan_presentation,
                    "viewTemplateId": e.view_template_id,
                    "underlayLevelId": e.underlay_level_id,
                    "discipline": e.discipline,
                    "phaseId": e.phase_id,
                    "cropMinMm": cmap_min,
                    "cropMaxMm": cmap_max,
                    "viewRangeBottomMm": e.view_range_bottom_mm,
                    "viewRangeTopMm": e.view_range_top_mm,
                    "cutPlaneOffsetMm": e.cut_plane_offset_mm,
                    "categoriesHidden": list(e.categories_hidden or []),
                }
            )

    return sorted(out, key=lambda x: x["id"])
