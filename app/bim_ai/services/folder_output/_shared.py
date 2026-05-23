"""Cross-phase helpers shared by multiple folder-output phase modules.

These helpers are intentionally kept in a tiny module so phase modules can
import them without creating circular import edges through ``__init__.py``.
"""

from __future__ import annotations

from typing import Any

PHASE_BY_FACT_KIND = {
    "building_scope": "P0-source-inventory",
    "level": "P2-levels",
    "storey": "P2-levels",
    "wall_line": "P4-floor-plan-topology",
    "wall_chain": "P4-floor-plan-topology",
    "wall_thickness": "P3-structural-shell",
    "floor_boundary": "P3-structural-shell",
    "room": "P6-rooms-and-area-reconciliation",
    "area": "P6-rooms-and-area-reconciliation",
    "volume": "P13-documentation-schedules",
    "opening": "P7-openings",
    "door": "P7-openings",
    "window": "P7-openings",
    "stair": "P8-stairs-vertical-circulation",
    "slab_opening": "P8-stairs-vertical-circulation",
    "roof": "P9-roof-dormers",
    "dormer": "P9-roof-dormers",
    "roof_opening": "P9-roof-dormers",
    "basement": "P10-basement-cellar",
    "drainage": "P10-basement-cellar",
    "terrain": "P11-terrain-parcel-topology",
    "parcel_boundary": "P11-terrain-parcel-topology",
    "site_context": "P11-terrain-parcel-topology",
    "material": "P12-materials-history",
    "construction_history": "P12-materials-history",
    "photo_observation": "P12-materials-history",
    "conflict": "P0-source-inventory",
}

PHASE_ORDER = [
    "P0-source-inventory",
    "P1-scale-site-setup",
    "P2-levels",
    "P3-structural-shell",
    "P4-floor-plan-topology",
    "P5-interior-partitions",
    "P6-rooms-and-area-reconciliation",
    "P7-openings",
    "P8-stairs-vertical-circulation",
    "P9-roof-dormers",
    "P10-basement-cellar",
    "P11-terrain-parcel-topology",
    "P12-materials-history",
    "P13-documentation-schedules",
    "P14-validation",
    "P15-final-acceptance",
]


def _role_for_classification(classification: str) -> str:
    return {
        "floor_plan": "primary_geometry",
        "section": "section_elevation_check",
        "elevation": "section_elevation_check",
        "site_plan": "site_parcel",
        "area_calculation": "area_reconciliation",
        "drainage_doc": "context_and_basement_services",
        "energy_doc": "materials_history",
        "photo": "photo_current_condition",
        "legal_admin": "legal_context",
        "construction_description": "materials_history",
    }.get(classification, "review_required")


def _modeling_use_for_classification(classification: str) -> str:
    return {
        "floor_plan": "primary_geometry",
        "section": "section_elevation_check",
        "elevation": "section_elevation_check",
        "site_plan": "site_parcel",
        "area_calculation": "area_reconciliation",
        "drainage_doc": "secondary_geometry_check",
        "energy_doc": "materials_history",
        "photo": "photo_current_condition",
        "legal_admin": "legal_context",
        "construction_description": "materials_history",
    }.get(classification, "ignored_with_reason")


def _classification_labels(row: dict[str, Any]) -> set[str]:
    labels = {str(row.get("classification") or "unknown")}
    for role in row.get("classificationRoles") or []:
        if isinstance(role, dict) and role.get("classification"):
            labels.add(str(role["classification"]))
    for label in row.get("secondaryClassifications") or []:
        if label:
            labels.add(str(label))
    return labels
