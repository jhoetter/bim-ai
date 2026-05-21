"""Evidence view requirements for reverse-BIM source/model acceptance."""

from __future__ import annotations

from typing import Any

OVERLAY_CLASSIFICATIONS = {"floor_plan", "section", "elevation", "site_plan"}


def build_reverse_bim_evidence_requirements(
    *,
    source_page_index: dict[str, Any] | None = None,
    source_facts: list[dict[str, Any]] | None = None,
    phase_authoring_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Derive required source overlays and UI screenshot views."""

    overlay_views = _overlay_views(source_page_index or {})
    ui_views = _ui_views(source_facts or [], phase_authoring_spec or {})
    return {
        "format": "reverseBimEvidenceRequirements_v1",
        "summary": {
            "overlayViewCount": len(overlay_views),
            "uiViewCount": len(ui_views),
            "requiredEvidenceCount": len(overlay_views) + len(ui_views),
        },
        "requiredOverlayViews": overlay_views,
        "requiredUiViews": ui_views,
        "usage": {
            "sourceOverlayRoute": "reverse_bim.source_overlay_evidence",
            "uiEvidenceRoute": "reverse_bim.ui_evidence",
            "finalAcceptanceInputs": ["sourceOverlay", "uiEvidence"],
        },
    }


def _overlay_views(source_page_index: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for page in source_page_index.get("pages") or []:
        if not isinstance(page, dict):
            continue
        source_page_id = str(page.get("sourcePageId") or "")
        if not source_page_id:
            continue
        classifications = _page_overlay_classifications(page)
        for classification in classifications:
            rows.append(
                {
                    "viewId": (
                        f"overlay:{source_page_id}"
                        if len(classifications) == 1
                        else f"overlay:{source_page_id}:{classification}"
                    ),
                    "kind": classification,
                    "sourcePageId": source_page_id,
                    "sourceDocumentId": page.get("sourceDocumentId"),
                    "page": page.get("page"),
                    "coordinateFrameId": page.get("coordinateFrameId"),
                    "renderedPagePath": page.get("renderedPagePath"),
                    "toleranceMm": _overlay_tolerance(classification),
                    "requiredBeforeFinalAcceptance": True,
                    "reason": _overlay_reason(classification),
                    "sourceRoles": classifications,
                    "primarySourceRole": classifications[0],
                }
            )
    return rows


def _page_overlay_classifications(page: dict[str, Any]) -> list[str]:
    labels: list[str] = []

    def add(label: Any) -> None:
        value = str(label or "").strip()
        if value in OVERLAY_CLASSIFICATIONS and value not in labels:
            labels.append(value)

    add(page.get("classification"))
    for label in page.get("matchedClassifications") or []:
        add(label)
    for role in page.get("classificationRoles") or []:
        if isinstance(role, dict):
            add(role.get("classification"))
        else:
            add(role)
    return labels


def _ui_views(source_facts: list[dict[str, Any]], phase_authoring_spec: dict[str, Any]) -> list[dict[str, Any]]:
    levels = _level_ids(source_facts)
    rows = [
        {
            "viewId": f"ui:plan:{level_id}",
            "kind": "floor_plan",
            "levelId": level_id,
            "requiredBeforeFinalAcceptance": True,
            "visualChecklistItems": [
                "no_placeholder_or_rough_massing_visible",
                "advisor_visible_state_not_showing_errors",
                "floorplan_topology_matches_source",
                "doors_windows_hosted_in_walls",
                "required_level_not_empty",
            ],
        }
        for level_id in levels
    ]
    phase_ids = {
        str(phase.get("phaseId") or "")
        for phase in phase_authoring_spec.get("phases") or []
        if isinstance(phase, dict) and phase.get("sourceFactIds")
    }
    rows.extend(
        [
            {
                "viewId": "ui:3d:overview",
                "kind": "3d",
                "requiredBeforeFinalAcceptance": True,
                "visualChecklistItems": [
                    "no_placeholder_or_rough_massing_visible",
                    "advisor_visible_state_not_showing_errors",
                    "roof_dormers_openings_physically_coherent",
                    "site_and_topology_visible_and_aligned",
                ],
            },
            {
                "viewId": "ui:3d:cutaway-stairs",
                "kind": "3d_cutaway",
                "requiredBeforeFinalAcceptance": True,
                "visualChecklistItems": [
                    "no_placeholder_or_rough_massing_visible",
                    "advisor_visible_state_not_showing_errors",
                    "stairs_openings_and_rooms_physically_coherent",
                    "no_assets_or_openings_on_stairs",
                ],
            },
        ]
    )
    if "P9-roof-dormers" in phase_ids:
        rows.append(
            {
                "viewId": "ui:elevation:roof-dormers",
                "kind": "elevation",
                "requiredBeforeFinalAcceptance": True,
                "visualChecklistItems": [
                    "no_placeholder_or_rough_massing_visible",
                    "advisor_visible_state_not_showing_errors",
                    "openings_roof_dormers_match_elevation",
                ],
            }
        )
    if "P11-terrain-parcel-topology" in phase_ids:
        rows.append(
            {
                "viewId": "ui:site:placement",
                "kind": "site",
                "requiredBeforeFinalAcceptance": True,
                "visualChecklistItems": [
                    "no_placeholder_or_rough_massing_visible",
                    "advisor_visible_state_not_showing_errors",
                    "house_centered_on_source_site",
                ],
            }
        )
    return rows


def _level_ids(source_facts: list[dict[str, Any]]) -> list[str]:
    out = []
    for fact in source_facts:
        if not isinstance(fact, dict) or str(fact.get("kind") or "") not in {"level", "storey", "basement"}:
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        level_id = str(value.get("levelId") or value.get("name") or fact.get("factId") or "").strip()
        if level_id and level_id not in out:
            out.append(level_id)
    return out


def _overlay_tolerance(classification: str) -> float:
    if classification == "floor_plan":
        return 35.0
    if classification in {"section", "elevation"}:
        return 50.0
    if classification == "site_plan":
        return 150.0
    return 50.0


def _overlay_reason(classification: str) -> str:
    return {
        "floor_plan": "Floor plan topology must match source wall, room, stair, and opening geometry.",
        "section": "Levels, slab openings, roof heights, and vertical circulation must align to source section.",
        "elevation": "Facade openings, roof, dormers, and visible heights must align to source elevation.",
        "site_plan": "House placement, parcel, topology, and terrain context must align to source site plan.",
    }.get(classification, "Required reverse-BIM source/model comparison.")
