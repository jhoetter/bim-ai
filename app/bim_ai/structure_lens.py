"""Structure lens projections over the shared BIM model.

The Structure lens is a classification and handoff layer. It derives rows and
export geometry from existing architectural/structural elements without
forking a second structural model or performing code design.
"""

from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    BeamElem,
    ColumnElem,
    DoorElem,
    Element,
    FloorElem,
    GridLineElem,
    LevelElem,
    RailingElem,
    RoofElem,
    StairElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)
from bim_ai.opening_cut_primitives import hosted_opening_half_span_mm

STRUCTURAL_ROLES = {
    "load_bearing",
    "bearing_wall",
    "shear_wall",
    "slab",
    "beam",
    "column",
    "foundation",
    "brace",
}


def load_bearing_value(element: Element) -> bool | None:
    value = getattr(element, "load_bearing", None)
    return value if isinstance(value, bool) else None


def structural_role(element: Element) -> str:
    role = str(getattr(element, "structural_role", "") or "").strip()
    if role:
        return role
    if isinstance(element, WallElem):
        return "bearing_wall" if element.load_bearing is True else "unknown"
    if isinstance(element, FloorElem):
        return "slab"
    if isinstance(element, ColumnElem):
        return "column"
    if isinstance(element, BeamElem):
        return "beam"
    return "unknown"


def structural_material(element: Element) -> str:
    direct = str(getattr(element, "structural_material", "") or "").strip()
    if direct:
        return direct
    key = str(getattr(element, "structural_material_key", "") or "").strip()
    if key:
        return key
    return str(getattr(element, "material_key", "") or "").strip()


def analysis_status(element: Element) -> str:
    return str(getattr(element, "analysis_status", "") or "not_modeled")


def is_load_bearing_wall(element: Element | None) -> bool:
    if not isinstance(element, WallElem):
        return False
    return element.load_bearing is True or structural_role(element) in {
        "load_bearing",
        "bearing_wall",
        "shear_wall",
    }


def is_structural_element(element: Element) -> bool:
    if isinstance(element, (ColumnElem, BeamElem, GridLineElem, LevelElem)):
        return True
    if isinstance(element, WallElem):
        return is_load_bearing_wall(element)
    if isinstance(element, FloorElem):
        return structural_role(element) != "non_load_bearing"
    if isinstance(element, RoofElem):
        return element.load_bearing is True or structural_role(element) in STRUCTURAL_ROLES
    if isinstance(element, (StairElem, RailingElem)):
        return structural_role(element) in STRUCTURAL_ROLES
    return False


def structural_schedule_rows(doc: Document, category: str) -> list[dict[str, Any]]:
    cat = category.lower()
    if cat in {"structural_element", "structural_elements", "structure"}:
        return [_structural_row(doc, e) for e in doc.elements.values() if is_structural_element(e)]
    if cat == "column":
        return [_structural_row(doc, e) for e in doc.elements.values() if isinstance(e, ColumnElem)]
    if cat == "beam":
        return [_structural_row(doc, e) for e in doc.elements.values() if isinstance(e, BeamElem)]
    if cat in {"structural_wall", "structural_walls"}:
        return [
            _structural_row(doc, e)
            for e in doc.elements.values()
            if isinstance(e, WallElem) and is_load_bearing_wall(e)
        ]
    if cat == "foundation":
        return [
            _structural_row(doc, e)
            for e in doc.elements.values()
            if structural_role(e) == "foundation"
            or bool((getattr(e, "props", None) or {}).get("foundation"))
            or bool((getattr(e, "props", None) or {}).get("footing"))
        ]
    if cat in {"opening_load_bearing_wall", "opening_in_load_bearing_wall"}:
        return _load_bearing_opening_rows(doc)
    return []


def structure_analysis_export(doc: Document) -> dict[str, Any]:
    elements = [
        _structural_export_element(doc, e)
        for e in doc.elements.values()
        if is_structural_element(e)
    ]
    grids = [
        {
            "id": e.id,
            "label": e.label,
            "startMm": _xy(e.start),
            "endMm": _xy(e.end),
            "levelId": e.level_id,
        }
        for e in doc.elements.values()
        if isinstance(e, GridLineElem)
    ]
    levels = [
        {"id": e.id, "name": e.name, "elevationMm": e.elevation_mm}
        for e in doc.elements.values()
        if isinstance(e, LevelElem)
    ]
    return {
        "format": "structureAnalysisExport_v1",
        "calculationEngine": False,
        "disclaimer": (
            "Structure lens export provides classified BIM geometry for external analysis; "
            "it is not a certified structural calculation result."
        ),
        "elementCount": len(elements),
        "elements": elements,
        "grids": grids,
        "levels": levels,
    }


def _structural_row(doc: Document, element: Element) -> dict[str, Any]:
    row: dict[str, Any] = {
        "elementId": element.id,
        "name": str(getattr(element, "name", element.id) or element.id),
        "category": element.kind,
        "loadBearing": _load_bearing_label(load_bearing_value(element)),
        "structuralRole": structural_role(element),
        "structuralMaterial": structural_material(element),
        "analysisStatus": analysis_status(element),
        "fireResistanceRating": str(getattr(element, "fire_resistance_rating", "") or ""),
        "levelId": _level_id(element),
        "level": _level_name(doc, _level_id(element)),
        "discipline": str(getattr(element, "discipline", "") or ""),
    }
    if isinstance(element, WallElem):
        row.update(
            {"wallTypeId": element.wall_type_id or "", "heightMm": round(element.height_mm, 3)}
        )
    elif isinstance(element, FloorElem):
        row.update(
            {
                "floorTypeId": element.floor_type_id or "",
                "thicknessMm": round(element.thickness_mm, 3),
            }
        )
    elif isinstance(element, RoofElem):
        row.update(
            {
                "roofTypeId": element.roof_type_id or "",
                "referenceLevelId": element.reference_level_id,
            }
        )
    elif isinstance(element, ColumnElem):
        row.update(
            {
                "bMm": round(element.b_mm, 3),
                "hMm": round(element.h_mm, 3),
                "heightMm": round(element.height_mm, 3),
            }
        )
    elif isinstance(element, BeamElem):
        row.update({"widthMm": round(element.width_mm, 3), "heightMm": round(element.height_mm, 3)})
    return row


def _load_bearing_opening_rows(doc: Document) -> list[dict[str, Any]]:
    walls_by_id = {e.id: e for e in doc.elements.values() if isinstance(e, WallElem)}
    rows: list[dict[str, Any]] = []
    for element in doc.elements.values():
        wall_id = _opening_wall_id(element)
        wall = walls_by_id.get(wall_id or "")
        if wall is None or not is_load_bearing_wall(wall):
            continue
        width = _opening_width_mm(element, wall)
        rows.append(
            {
                "elementId": element.id,
                "name": str(getattr(element, "name", element.id) or element.id),
                "category": element.kind,
                "wallId": wall.id,
                "wallName": wall.name,
                "levelId": wall.level_id,
                "level": _level_name(doc, wall.level_id),
                "openingWidthMm": round(width or 0.0, 3),
                "hostLoadBearing": "true",
                "reviewStatus": _opening_review_status(element),
            }
        )
    return rows


def _structural_export_element(doc: Document, element: Element) -> dict[str, Any]:
    return {
        **_structural_row(doc, element),
        "geometry": _geometry(element),
    }


def _geometry(element: Element) -> dict[str, Any]:
    if isinstance(element, WallElem):
        return {
            "kind": "wall_axis",
            "startMm": _xy(element.start),
            "endMm": _xy(element.end),
            "thicknessMm": element.thickness_mm,
            "heightMm": element.height_mm,
        }
    if isinstance(element, FloorElem):
        return {
            "kind": "polygon",
            "boundaryMm": [_xy(p) for p in element.boundary_mm],
            "thicknessMm": element.thickness_mm,
        }
    if isinstance(element, RoofElem):
        return {"kind": "polygon", "boundaryMm": [_xy(p) for p in element.footprint_mm]}
    if isinstance(element, ColumnElem):
        return {
            "kind": "column",
            "positionMm": _xy(element.position_mm),
            "bMm": element.b_mm,
            "hMm": element.h_mm,
            "heightMm": element.height_mm,
        }
    if isinstance(element, BeamElem):
        return {
            "kind": "beam_axis",
            "startMm": _xy(element.start_mm),
            "endMm": _xy(element.end_mm),
            "widthMm": element.width_mm,
            "heightMm": element.height_mm,
        }
    return {"kind": element.kind}


def _xy(point: Any) -> dict[str, float]:
    return {"xMm": float(point.x_mm), "yMm": float(point.y_mm)}


def _level_id(element: Element) -> str:
    return str(
        getattr(element, "level_id", None)
        or getattr(element, "reference_level_id", None)
        or getattr(element, "base_level_id", None)
        or ""
    )


def _level_name(doc: Document, level_id: str) -> str:
    level = doc.elements.get(level_id)
    return level.name if isinstance(level, LevelElem) else level_id


def _load_bearing_label(value: bool | None) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    return "unknown"


def _opening_wall_id(element: Element) -> str | None:
    if isinstance(element, (DoorElem, WindowElem)):
        return element.wall_id
    if isinstance(element, WallOpeningElem):
        return element.host_wall_id
    return None


def _opening_width_mm(element: Element, wall: WallElem) -> float | None:
    if isinstance(element, (DoorElem, WindowElem)):
        return 2.0 * hosted_opening_half_span_mm(element)
    if isinstance(element, WallOpeningElem):
        dx = wall.end.x_mm - wall.start.x_mm
        dy = wall.end.y_mm - wall.start.y_mm
        return ((dx * dx + dy * dy) ** 0.5) * (element.along_t_end - element.along_t_start)
    return None


def _opening_review_status(element: Element) -> str:
    props = getattr(element, "props", None) or {}
    if any(props.get(k) for k in ("lintelId", "headerId", "structuralReviewApproved")):
        return "resolved"
    return "needs_review"
