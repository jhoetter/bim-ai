"""Architecture Lens API projection.

The Architecture Lens is a view over the shared BIM document, not a parallel
model. This module returns stable buckets that third-party tools can consume
without knowing anything about browser lens/dropdown state.
"""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document

ARCHITECTURE_GEOMETRY_KINDS = frozenset(
    {
        "wall",
        "floor",
        "roof",
        "ceiling",
        "door",
        "window",
        "wall_opening",
        "shaft",
        "stair",
        "railing",
        "grid_line",
        "reference_plane",
        "property_line",
        "level",
    }
)

ARCHITECTURE_TYPE_KINDS = frozenset(
    {
        "wall_type",
        "floor_type",
        "roof_type",
        "family_type",
        "material",
        "view_template",
    }
)

ARCHITECTURE_VIEW_KINDS = frozenset(
    {
        "plan_view",
        "section_cut",
        "elevation_view",
        "viewpoint",
    }
)


def _wire_element(element: Any) -> dict[str, Any]:
    return element.model_dump(by_alias=True, exclude_none=True)


def build_architecture_lens_query(doc: Document) -> dict[str, Any]:
    geometry: list[dict[str, Any]] = []
    types: list[dict[str, Any]] = []
    rooms: list[dict[str, Any]] = []
    areas: list[dict[str, Any]] = []
    views: list[dict[str, Any]] = []
    sheets: list[dict[str, Any]] = []
    schedules: list[dict[str, Any]] = []

    for element_id in sorted(doc.elements):
        element = doc.elements[element_id]
        kind = str(getattr(element, "kind", ""))
        payload = _wire_element(element)

        if kind == "room":
            rooms.append(payload)
        elif kind == "area":
            areas.append(payload)
        elif kind in ARCHITECTURE_GEOMETRY_KINDS:
            geometry.append(payload)
        elif kind in ARCHITECTURE_TYPE_KINDS:
            types.append(payload)
        elif kind in ARCHITECTURE_VIEW_KINDS:
            views.append(payload)
        elif kind == "sheet":
            sheets.append(payload)
        elif kind == "schedule":
            schedules.append(payload)

    buckets = {
        "geometry": geometry,
        "types": types,
        "rooms": rooms,
        "areas": areas,
        "views": views,
        "sheets": sheets,
        "schedules": schedules,
    }

    return {
        "lens": {
            "id": "architecture",
            "name": "Architecture",
            "germanName": "Architektur",
        },
        "revision": doc.revision,
        "counts": {name: len(rows) for name, rows in buckets.items()},
        **buckets,
    }
