"""Stable schedule column ordering + UI metadata hooks (WP-D01–D04).

Server keeps schedule rows keyed by camelCase identifiers; CSV and API consumers can follow
``columns`` order (registry first, then any extra keys sorted).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

ColumnMeta = dict[str, Any]

# Preferred column order per derived category (stable field keys).
SCHEDULE_COLUMN_ORDER: dict[str, tuple[str, ...]] = {
    "room": ("elementId", "name", "levelId", "level", "areaM2", "perimeterM", "familyTypeId"),
    "door": ("elementId", "name", "wallId", "levelId", "level", "widthMm", "familyTypeId", "familyTypeDisplay"),
    "window": (
        "elementId",
        "name",
        "wallId",
        "levelId",
        "level",
        "widthMm",
        "heightMm",
        "sillMm",
        "familyTypeId",
        "familyTypeDisplay",
    ),
    "floor": (
        "elementId",
        "name",
        "levelId",
        "level",
        "thicknessMm",
        "areaM2",
        "perimeterM",
        "familyTypeId",
    ),
    "roof": (
        "elementId",
        "name",
        "referenceLevelId",
        "referenceLevel",
        "overhangMm",
        "slopeDeg",
        "footprintAreaM2",
        "footprintPerimeterM",
        "familyTypeId",
    ),
    "stair": (
        "elementId",
        "name",
        "baseLevelId",
        "topLevelId",
        "baseLevel",
        "topLevel",
        "riseMm",
        "runMm",
        "widthMm",
        "familyTypeId",
    ),
    "sheet": ("elementId", "name", "titleBlock", "viewportCount", "familyTypeId"),
    "plan_view": (
        "elementId",
        "name",
        "levelId",
        "level",
        "planPresentation",
        "discipline",
        "familyTypeId",
    ),
    "planview": (
        "elementId",
        "name",
        "levelId",
        "level",
        "planPresentation",
        "discipline",
        "familyTypeId",
    ),
}

SCHEDULE_COLUMN_METADATA: dict[str, dict[str, ColumnMeta]] = {
    "room": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "level": {"label": "Level", "role": "text"},
        "areaM2": {"label": "Area (m²)", "role": "number"},
        "perimeterM": {"label": "Perimeter (m)", "role": "number"},
    },
    "door": {
        "widthMm": {"label": "Width (mm)", "role": "integer"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
        "familyTypeDisplay": {"label": "Type name", "role": "text"},
    },
    "window": {
        "widthMm": {"label": "Width (mm)", "role": "integer"},
        "heightMm": {"label": "Height (mm)", "role": "integer"},
        "sillMm": {"label": "Sill (mm)", "role": "integer"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
        "familyTypeDisplay": {"label": "Type name", "role": "text"},
    },
    "floor": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "level": {"label": "Level", "role": "text"},
        "thicknessMm": {"label": "Thickness (mm)", "role": "number"},
        "areaM2": {"label": "Area (m²)", "role": "number"},
        "perimeterM": {"label": "Perimeter (m)", "role": "number"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "roof": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "referenceLevel": {"label": "Ref. level", "role": "text"},
        "overhangMm": {"label": "Overhang (mm)", "role": "number"},
        "slopeDeg": {"label": "Slope (°)", "role": "number"},
        "footprintAreaM2": {"label": "Footprint (m²)", "role": "number"},
        "footprintPerimeterM": {"label": "Footprint perimeter (m)", "role": "number"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "stair": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "baseLevel": {"label": "Base level", "role": "text"},
        "topLevel": {"label": "Top level", "role": "text"},
        "riseMm": {"label": "Rise (mm)", "role": "number"},
        "runMm": {"label": "Run (mm)", "role": "number"},
        "widthMm": {"label": "Width (mm)", "role": "number"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "sheet": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "titleBlock": {"label": "Title block", "role": "text"},
        "viewportCount": {"label": "Viewports", "role": "integer"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "plan_view": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "level": {"label": "Level", "role": "text"},
        "planPresentation": {"label": "Presentation", "role": "text"},
        "discipline": {"label": "Discipline", "role": "text"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "planview": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "level": {"label": "Level", "role": "text"},
        "planPresentation": {"label": "Presentation", "role": "text"},
        "discipline": {"label": "Discipline", "role": "text"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
}


def stable_column_keys(category: str, observed_keys: Iterable[str]) -> list[str]:
    """Return registry order first; append unrecognized keys deterministically."""

    cat = category.lower().strip()
    pref = SCHEDULE_COLUMN_ORDER.get(cat, ())
    seen: set[str] = set(pref)
    out: list[str] = []

    for k in pref:
        if k in observed_keys:
            out.append(k)
    extras = sorted(k for k in observed_keys if k not in seen)
    out.extend(extras)

    return out


def column_metadata_bundle(category: str) -> dict[str, Any]:
    """UI metadata for known fields (omit unknown extras — clients fall back to field key)."""

    cat = category.lower().strip()
    cols = SCHEDULE_COLUMN_METADATA.get(cat)
    return {
        "category": cat,
        "fields": cols or {},
    }
