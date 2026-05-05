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
    "room": (
        "elementId",
        "name",
        "levelId",
        "level",
        "areaM2",
        "perimeterM",
        "targetAreaM2",
        "areaDeltaM2",
        "programmeCode",
        "department",
        "functionLabel",
        "finishSet",
        "familyTypeId",
    ),
    "door": (
        "elementId",
        "name",
        "wallId",
        "hostWallTypeId",
        "hostWallTypeDisplay",
        "levelId",
        "level",
        "widthMm",
        "hostHeightMm",
        "roughOpeningWidthMm",
        "roughOpeningHeightMm",
        "roughOpeningAreaM2",
        "familyTypeId",
        "familyTypeDisplay",
        "materialKey",
        "materialDisplay",
    ),
    "window": (
        "elementId",
        "name",
        "wallId",
        "hostWallTypeId",
        "hostWallTypeDisplay",
        "levelId",
        "level",
        "widthMm",
        "heightMm",
        "sillMm",
        "roughOpeningWidthMm",
        "roughOpeningHeightMm",
        "roughOpeningAreaM2",
        "openingAreaM2",
        "aspectRatio",
        "headHeightMm",
        "familyTypeId",
        "familyTypeDisplay",
        "materialKey",
        "materialDisplay",
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
        "roofTypeId",
        "assemblyTotalThicknessMm",
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
    "sheet": (
        "elementId",
        "name",
        "titleBlock",
        "viewportCount",
        "planViewNames",
        "familyTypeId",
    ),
    "plan_view": (
        "elementId",
        "name",
        "levelId",
        "level",
        "planPresentation",
        "discipline",
        "sheetId",
        "sheetName",
        "familyTypeId",
    ),
    "planview": (
        "elementId",
        "name",
        "levelId",
        "level",
        "planPresentation",
        "discipline",
        "sheetId",
        "sheetName",
        "familyTypeId",
    ),
    "section_cut": ("elementId", "name", "cropDepthMm", "familyTypeId"),
    "sectioncut": ("elementId", "name", "cropDepthMm", "familyTypeId"),
    "material_assembly": (
        "elementId",
        "name",
        "hostElementId",
        "hostKind",
        "assemblyTypeId",
        "assemblyTotalThicknessMm",
        "layerOffsetFromExteriorMm",
        "layerIndex",
        "layerFunction",
        "materialKey",
        "materialDisplay",
        "thicknessMm",
        "grossAreaM2",
        "grossVolumeM3",
        "levelId",
        "level",
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
        "targetAreaM2": {"label": "Target area (m²)", "role": "number"},
        "areaDeltaM2": {"label": "Area vs target (m²)", "role": "number"},
        "programmeCode": {"label": "Programme", "role": "text"},
        "department": {"label": "Department", "role": "text"},
        "functionLabel": {"label": "Function", "role": "text"},
        "finishSet": {"label": "Finish set", "role": "text"},
    },
    "door": {
        "hostWallTypeId": {"label": "Host wall type", "role": "identity"},
        "hostWallTypeDisplay": {"label": "Host wall type name", "role": "text"},
        "widthMm": {"label": "Width (mm)", "role": "integer"},
        "hostHeightMm": {"label": "Host height (mm)", "role": "integer"},
        "roughOpeningWidthMm": {"label": "Rough opening width (mm)", "role": "integer"},
        "roughOpeningHeightMm": {"label": "Rough opening height (mm)", "role": "integer"},
        "roughOpeningAreaM2": {"label": "Rough opening (m²)", "role": "number"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
        "familyTypeDisplay": {"label": "Type name", "role": "text"},
        "materialKey": {"label": "Finish / material", "role": "text"},
        "materialDisplay": {"label": "Material (catalog)", "role": "text"},
    },
    "window": {
        "hostWallTypeId": {"label": "Host wall type", "role": "identity"},
        "hostWallTypeDisplay": {"label": "Host wall type name", "role": "text"},
        "widthMm": {"label": "Width (mm)", "role": "integer"},
        "heightMm": {"label": "Height (mm)", "role": "integer"},
        "sillMm": {"label": "Sill (mm)", "role": "integer"},
        "roughOpeningWidthMm": {"label": "Rough opening width (mm)", "role": "integer"},
        "roughOpeningHeightMm": {"label": "Rough opening height (mm)", "role": "integer"},
        "roughOpeningAreaM2": {
            "label": "Rough opening (m²)",
            "role": "number",
            "help": "Wall opening area using width plus interior reveal (when set), times sash height.",
        },
        "openingAreaM2": {"label": "Glazing area (m²)", "role": "number"},
        "aspectRatio": {"label": "Aspect ratio (W/H)", "role": "number"},
        "headHeightMm": {"label": "Head height (mm)", "role": "number"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
        "familyTypeDisplay": {"label": "Type name", "role": "text"},
        "materialKey": {"label": "Finish / material", "role": "text"},
        "materialDisplay": {"label": "Material (catalog)", "role": "text"},
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
        "roofTypeId": {"label": "Roof type", "role": "identity"},
        "assemblyTotalThicknessMm": {"label": "Assembly thickness (mm)", "role": "number"},
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
        "planViewNames": {"label": "Plan views", "role": "text"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "plan_view": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "level": {"label": "Level", "role": "text"},
        "planPresentation": {"label": "Presentation", "role": "text"},
        "discipline": {"label": "Discipline", "role": "text"},
        "sheetId": {"label": "Sheet id", "role": "identity"},
        "sheetName": {"label": "Sheet name", "role": "text"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "planview": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "level": {"label": "Level", "role": "text"},
        "planPresentation": {"label": "Presentation", "role": "text"},
        "discipline": {"label": "Discipline", "role": "text"},
        "sheetId": {"label": "Sheet id", "role": "identity"},
        "sheetName": {"label": "Sheet name", "role": "text"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "section_cut": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "cropDepthMm": {"label": "Crop depth (mm)", "role": "number"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "sectioncut": {
        "elementId": {"label": "Element Id", "role": "id"},
        "name": {"label": "Name", "role": "text"},
        "cropDepthMm": {"label": "Crop depth (mm)", "role": "number"},
        "familyTypeId": {"label": "Family / type", "role": "identity"},
    },
    "material_assembly": {
        "elementId": {"label": "Assembly row id", "role": "id"},
        "hostElementId": {"label": "Host element", "role": "identity"},
        "hostKind": {"label": "Host kind", "role": "text"},
        "assemblyTypeId": {"label": "Assembly type", "role": "identity"},
        "assemblyTotalThicknessMm": {"label": "Assembly thickness (mm)", "role": "number"},
        "layerOffsetFromExteriorMm": {"label": "Layer offset from exterior (mm)", "role": "number"},
        "layerIndex": {"label": "Layer", "role": "integer"},
        "layerFunction": {"label": "Layer function", "role": "text"},
        "materialKey": {"label": "Material key", "role": "text"},
        "materialDisplay": {"label": "Material", "role": "text"},
        "thicknessMm": {"label": "Thickness (mm)", "role": "number"},
        "grossAreaM2": {"label": "Gross area (m²)", "role": "number"},
        "grossVolumeM3": {"label": "Gross volume (m³)", "role": "number"},
        "level": {"label": "Level", "role": "text"},
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
