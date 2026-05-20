"""Read-only query/resolve projections for MCP/UI parity.

The functions here intentionally return compact, typed-ish wire dictionaries
instead of exposing raw engine internals as the primary contract.
"""

from __future__ import annotations

import hashlib
import math
from collections import Counter
from typing import Any

from bim_ai.constraints_wall_geometry import hosted_t_bounds
from bim_ai.constructability_report import build_constructability_report
from bim_ai.document import Document
from bim_ai.elements import (
    DormerElem,
    ElevationViewElem,
    FamilyTypeElem,
    FloorElem,
    FloorTypeElem,
    LevelElem,
    MaterialElem,
    PlanViewElem,
    RoofElem,
    RoofOpeningElem,
    RoofTypeElem,
    RoomElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    Vec2Mm,
    ViewpointElem,
    ViewTemplateElem,
    WallElem,
    WallOpeningElem,
    WallTypeElem,
)
from bim_ai.room_access_integrity import room_access_graph_v1, room_boundary_edges_report_v1

SUPPORTED_ELEMENT_INCLUDES = {"geometrySummary", "hostRefs", "scheduleSummary", "raw"}
SUPPORTED_LEVEL_INCLUDES = {"planViews", "constraints"}
SUPPORTED_TYPE_INCLUDES = {"parameters", "materials"}
SUPPORTED_VIEW_INCLUDES = {"crop", "placements", "templates"}
SUPPORTED_HOST_INCLUDES = {"hostFaces", "normalizedPosition"}
SUPPORTED_LOOP_INCLUDES = {"area", "segments", "sourceElementIds"}


def success_envelope(
    model_id: str,
    doc: Document,
    data: dict[str, Any],
    *,
    warnings: list[dict[str, Any]] | None = None,
    next_cursor: str | None = None,
) -> dict[str, Any]:
    return {
        "ok": True,
        "modelId": model_id,
        "revision": doc.revision,
        "data": data,
        "warnings": warnings or [],
        "nextCursor": next_cursor,
    }


def error_envelope(
    code: str,
    message: str,
    *,
    status: int,
    details: dict[str, Any] | None = None,
    retryable: bool = False,
) -> dict[str, Any]:
    return {
        "ok": False,
        "status": status,
        "error": {
            "code": code,
            "message": message,
            "retryable": retryable,
            "details": details or {},
        },
    }


def _invalid_include(include: list[str] | None, supported: set[str]) -> dict[str, Any] | None:
    unknown = sorted(set(include or []) - supported)
    if not unknown:
        return None
    return error_envelope(
        "invalid_request",
        f"Unsupported include value(s): {', '.join(unknown)}.",
        status=400,
        details={"unsupportedIncludes": unknown, "supportedIncludes": sorted(supported)},
    )


def _pt2(pt: Vec2Mm) -> list[float]:
    return [pt.x_mm, pt.y_mm]


def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _wall_len(wall: WallElem) -> float:
    return _distance((wall.start.x_mm, wall.start.y_mm), (wall.end.x_mm, wall.end.y_mm))


def _project_to_segment(
    point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]
) -> tuple[float, float, float, float]:
    vx = end[0] - start[0]
    vy = end[1] - start[1]
    length_sq = vx * vx + vy * vy
    if length_sq <= 0:
        return 0.0, start[0], start[1], _distance(point, start)
    t = max(0.0, min(1.0, ((point[0] - start[0]) * vx + (point[1] - start[1]) * vy) / length_sq))
    px = start[0] + t * vx
    py = start[1] + t * vy
    return t, px, py, _distance(point, (px, py))


def _polygon_area(points: list[list[float]]) -> float:
    if len(points) < 3:
        return 0.0
    area = 0.0
    for idx, pt in enumerate(points):
        nxt = points[(idx + 1) % len(points)]
        area += pt[0] * nxt[1] - nxt[0] * pt[1]
    return area / 2.0


def _bbox_from_points(
    points: list[list[float]], z_min: float = 0.0, z_max: float = 0.0
) -> list[float]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return [min(xs), min(ys), z_min, max(xs), max(ys), z_max]


def _bbox_intersects(a: list[float], b: list[float]) -> bool:
    return not (
        a[3] < b[0] or a[0] > b[3] or a[4] < b[1] or a[1] > b[4] or a[5] < b[2] or a[2] > b[5]
    )


def _bbox_contains(outer: list[float], inner: list[float]) -> bool:
    return all(
        (
            outer[0] <= inner[0],
            outer[1] <= inner[1],
            outer[2] <= inner[2],
            outer[3] >= inner[3],
            outer[4] >= inner[4],
            outer[5] >= inner[5],
        )
    )


def _bbox_intersects_xy(a: list[float], b: list[float]) -> bool:
    return not (a[3] < b[0] or a[0] > b[3] or a[4] < b[1] or a[1] > b[4])


def _bbox_xy_overlap_area(a: list[float], b: list[float]) -> float:
    width = max(0.0, min(a[3], b[3]) - max(a[0], b[0]))
    height = max(0.0, min(a[4], b[4]) - max(a[1], b[1]))
    return width * height


def _element_level_id(doc: Document, element: Any) -> str | None:
    own_level = (
        getattr(element, "level_id", None)
        or getattr(element, "reference_level_id", None)
        or getattr(element, "base_level_id", None)
    )
    if own_level is not None:
        return own_level
    host = _host_wall_for_element(doc, element)
    return host.level_id if host is not None else None


def _element_type_id(element: Any) -> str | None:
    return (
        getattr(element, "wall_type_id", None)
        or getattr(element, "floor_type_id", None)
        or getattr(element, "roof_type_id", None)
        or getattr(element, "family_type_id", None)
    )


def element_bbox_mm(doc: Document, element: Any) -> list[float] | None:
    if isinstance(element, WallElem):
        z0 = _level_elevation(doc, element.level_id)
        half = element.thickness_mm / 2.0
        return _expand_bbox_xy(half)(
            _bbox_from_points([_pt2(element.start), _pt2(element.end)], z0, z0 + element.height_mm)
        )
    if isinstance(element, FloorElem):
        z0 = _level_elevation(doc, element.level_id)
        return _bbox_from_points(
            [_pt2(p) for p in element.boundary_mm], z0, z0 + element.thickness_mm
        )
    if isinstance(element, RoofElem):
        z0 = _level_elevation(doc, element.reference_level_id)
        return _bbox_from_points([_pt2(p) for p in element.footprint_mm], z0, z0 + 1000.0)
    if isinstance(element, RoomElem):
        z0 = _level_elevation(doc, element.level_id)
        return _bbox_from_points([_pt2(p) for p in element.outline_mm], z0, z0 + 3000.0)
    host = _host_wall_for_element(doc, element)
    if host is not None:
        t = getattr(element, "along_t", None)
        if t is None and isinstance(element, WallOpeningElem):
            t = (element.along_t_start + element.along_t_end) / 2.0
        if isinstance(t, int | float):
            sx, sy = host.start.x_mm, host.start.y_mm
            ex, ey = host.end.x_mm, host.end.y_mm
            x = sx + (ex - sx) * float(t)
            y = sy + (ey - sy) * float(t)
            width = getattr(element, "width_mm", None) or host.thickness_mm
            height = getattr(element, "height_mm", None) or host.height_mm
            sill = getattr(element, "sill_height_mm", None) or 0.0
            z0 = _level_elevation(doc, host.level_id) + sill
            length = max(_wall_len(host), 1.0)
            ux = (ex - sx) / length
            uy = (ey - sy) / length
            nx = -uy
            ny = ux
            corners = []
            for along in (-float(width) / 2.0, float(width) / 2.0):
                for across in (-host.thickness_mm / 2.0, host.thickness_mm / 2.0):
                    corners.append([x + ux * along + nx * across, y + uy * along + ny * across])
            return _bbox_from_points(corners, z0, z0 + float(height))
    if hasattr(element, "position_mm"):
        pos = element.position_mm
        return [pos.x_mm, pos.y_mm, 0.0, pos.x_mm, pos.y_mm, 0.0]
    return None


def _expand_bbox_xy(amount: float):
    def _expand(bbox: list[float]) -> list[float]:
        return [
            bbox[0] - amount,
            bbox[1] - amount,
            bbox[2],
            bbox[3] + amount,
            bbox[4] + amount,
            bbox[5],
        ]

    return _expand


def _level_elevation(doc: Document, level_id: str | None) -> float:
    level = doc.elements.get(level_id or "")
    return level.elevation_mm if isinstance(level, LevelElem) else 0.0


def _host_wall_for_element(doc: Document, element: Any) -> WallElem | None:
    wall_id = (
        getattr(element, "wall_id", None)
        or getattr(element, "host_wall_id", None)
        or getattr(element, "host_element_id", None)
    )
    wall = doc.elements.get(wall_id or "")
    return wall if isinstance(wall, WallElem) else None


def _host_refs(doc: Document, element: Any) -> list[dict[str, Any]]:
    wall = _host_wall_for_element(doc, element)
    if wall is None:
        return []
    return [{"elementId": wall.id, "kind": "wall", "relationship": "host"}]


def geometry_summary(doc: Document, element: Any) -> dict[str, Any] | None:
    if isinstance(element, WallElem):
        summary: dict[str, Any] = {
            "representation": "line_extrusion",
            "startMm": _pt2(element.start),
            "endMm": _pt2(element.end),
            "heightMm": element.height_mm,
            "thicknessMm": element.thickness_mm,
        }
        if element.wall_curve is not None:
            summary["curve"] = element.wall_curve.model_dump(by_alias=True, exclude_none=True)
            summary["warnings"] = [{"code": "curved_wall_summary_limited"}]
        return summary
    if isinstance(element, FloorElem):
        return {
            "representation": "horizontal_boundary",
            "boundaryMm": [_pt2(p) for p in element.boundary_mm],
            "thicknessMm": element.thickness_mm,
            "areaMm2": abs(_polygon_area([_pt2(p) for p in element.boundary_mm])),
        }
    if isinstance(element, RoofElem):
        return {
            "representation": "roof_footprint",
            "footprintMm": [_pt2(p) for p in element.footprint_mm],
            "slopeDeg": element.slope_deg,
            "overhangMm": element.overhang_mm,
        }
    if isinstance(element, RoomElem):
        return {
            "representation": "room_outline",
            "boundaryMm": [_pt2(p) for p in element.outline_mm],
            "areaMm2": abs(_polygon_area([_pt2(p) for p in element.outline_mm])),
        }
    wall = _host_wall_for_element(doc, element)
    if wall is not None:
        return {
            "representation": "hosted_opening",
            "hostElementId": wall.id,
            "hostKind": "wall",
            "alongT": getattr(element, "along_t", None),
            "widthMm": getattr(element, "width_mm", None),
            "heightMm": getattr(element, "height_mm", None),
            "sillHeightMm": getattr(element, "sill_height_mm", None),
        }
    return None


def _wire_element_summary(
    doc: Document, element: Any, include: list[str] | None = None
) -> dict[str, Any]:
    include_set = set(include or [])
    out: dict[str, Any] = {
        "id": element.id,
        "kind": str(getattr(element, "kind", "")),
        "name": getattr(element, "name", None),
    }
    if (level_id := _element_level_id(doc, element)) is not None:
        out["levelId"] = level_id
    if (type_id := _element_type_id(element)) is not None:
        out["typeId"] = type_id
    if (bbox := element_bbox_mm(doc, element)) is not None:
        out["bboxMm"] = bbox
    if "geometrySummary" in include_set:
        out["geometrySummary"] = geometry_summary(doc, element)
    if "hostRefs" in include_set:
        out["hostRefs"] = _host_refs(doc, element)
    if "raw" in include_set:
        out["raw"] = element.model_dump(by_alias=True, exclude_none=True)
    return {k: v for k, v in out.items() if v is not None}


def model_summary_resource(model_id: str, doc: Document) -> dict[str, Any]:
    counts = Counter(str(getattr(e, "kind", "")) for e in doc.elements.values())
    levels = query_levels(model_id, doc, include=[]).get("data", {}).get("levels", [])
    views = query_views(model_id, doc, {"filter": {}}, include=[]).get("data", {}).get("views", [])
    defaults = {
        "levelId": levels[0]["id"] if levels else None,
        "planViewId": next((v["id"] for v in views if v["kind"] == "plan_view"), None),
        "wallTypeId": next(
            (e.id for e in doc.elements.values() if isinstance(e, WallTypeElem)), None
        ),
        "floorTypeId": next(
            (e.id for e in doc.elements.values() if isinstance(e, FloorTypeElem)), None
        ),
        "roofTypeId": next(
            (e.id for e in doc.elements.values() if isinstance(e, RoofTypeElem)), None
        ),
    }
    bboxes = [bbox for e in doc.elements.values() if (bbox := element_bbox_mm(doc, e)) is not None]
    extents = None
    if bboxes:
        extents = {
            "bboxMm": [
                min(b[0] for b in bboxes),
                min(b[1] for b in bboxes),
                min(b[2] for b in bboxes),
                max(b[3] for b in bboxes),
                max(b[4] for b in bboxes),
                max(b[5] for b in bboxes),
            ]
        }
    return {
        "modelId": model_id,
        "revision": doc.revision,
        "name": "Model",
        "counts": {
            "elements": len(doc.elements),
            "walls": counts.get("wall", 0),
            "floors": counts.get("floor", 0),
            "roofs": counts.get("roof", 0),
            "doors": counts.get("door", 0),
            "windows": counts.get("window", 0),
            "levels": counts.get("level", 0),
            "views": sum(
                counts.get(k, 0)
                for k in ("plan_view", "viewpoint", "section_cut", "elevation_view")
            ),
            "sheets": counts.get("sheet", 0),
            "schedules": counts.get("schedule", 0),
            "advisorFindings": counts.get("issue", 0) + counts.get("constructability_issue", 0),
        },
        "defaults": {k: v for k, v in defaults.items() if v is not None},
        "extents": extents,
        "recentRevision": {"revision": doc.revision},
    }


def query_elements(
    model_id: str, doc: Document, request: dict[str, Any], include: list[str] | None = None
) -> dict[str, Any]:
    if err := _invalid_include(include, SUPPORTED_ELEMENT_INCLUDES):
        return err
    filt = request.get("filter") or {}
    if "createdBy" in filt:
        return error_envelope(
            "unsupported_filter",
            "createdBy is not indexed in current model documents.",
            status=400,
            details={"filter": "createdBy", "todo": "Persist commit author on element provenance."},
        )
    limit = min(int(request.get("limit") or 100), 500)
    ids = set(filt.get("ids") or [])
    kinds = set(filt.get("kinds") or [])
    level_ids = set(filt.get("levelIds") or [])
    type_ids = set(filt.get("typeIds") or [])
    text = str(filt.get("text") or "").casefold()
    props = filt.get("properties") or {}
    bbox_intersects = filt.get("bboxIntersectsMm")
    bbox_contains = filt.get("bboxContainsMm")
    rows: list[dict[str, Any]] = []
    for element_id in sorted(doc.elements):
        element = doc.elements[element_id]
        if ids and element.id not in ids:
            continue
        if kinds and str(getattr(element, "kind", "")) not in kinds:
            continue
        if level_ids and _element_level_id(doc, element) not in level_ids:
            continue
        if type_ids and _element_type_id(element) not in type_ids:
            continue
        if text:
            raw = element.model_dump(by_alias=True, exclude_none=True)
            haystack = (
                f"{getattr(element, 'id', '')} {getattr(element, 'name', '')} {raw}".casefold()
            )
            if text not in haystack:
                continue
        if props:
            raw = element.model_dump(by_alias=True, exclude_none=True)
            if any(raw.get(key) != val for key, val in props.items()):
                continue
        bbox = element_bbox_mm(doc, element)
        if bbox_intersects is not None and (
            bbox is None or not _bbox_intersects(bbox, bbox_intersects)
        ):
            continue
        if bbox_contains is not None and (bbox is None or not _bbox_contains(bbox_contains, bbox)):
            continue
        rows.append(_wire_element_summary(doc, element, include))
    return success_envelope(model_id, doc, {"elements": rows[:limit]}, next_cursor=None)


def query_levels(model_id: str, doc: Document, include: list[str] | None = None) -> dict[str, Any]:
    if err := _invalid_include(include, SUPPORTED_LEVEL_INCLUDES):
        return err
    include_set = set(include or [])
    plan_views_by_level: dict[str, list[str]] = {}
    for e in doc.elements.values():
        if isinstance(e, PlanViewElem):
            plan_views_by_level.setdefault(e.level_id, []).append(e.id)
    levels: list[dict[str, Any]] = []
    for level in sorted(
        (e for e in doc.elements.values() if isinstance(e, LevelElem)),
        key=lambda x: (x.elevation_mm, x.id),
    ):
        row: dict[str, Any] = {
            "id": level.id,
            "name": level.name,
            "elevationMm": level.elevation_mm,
            "isDefault": not levels,
        }
        if "planViews" in include_set:
            row["planViewIds"] = sorted(plan_views_by_level.get(level.id, []))
        if "constraints" in include_set:
            row["constraints"] = {"defaultWallHeightMm": 3000}
        levels.append(row)
    return success_envelope(model_id, doc, {"levels": levels})


def _type_category(element: Any) -> str | None:
    if isinstance(element, WallTypeElem):
        return "wall"
    if isinstance(element, FloorTypeElem):
        return "floor"
    if isinstance(element, RoofTypeElem):
        return "roof"
    if isinstance(element, FamilyTypeElem):
        return element.discipline
    if isinstance(element, MaterialElem):
        return "material"
    if isinstance(element, ViewTemplateElem):
        return "view_template"
    return None


def _type_parameters(element: Any) -> dict[str, Any]:
    if isinstance(element, WallTypeElem | FloorTypeElem | RoofTypeElem):
        thickness = sum(layer.thickness_mm for layer in element.layers)
        return {
            "thicknessMm": thickness,
            "layers": [layer.model_dump(by_alias=True) for layer in element.layers],
        }
    if isinstance(element, FamilyTypeElem):
        return dict(element.parameters)
    if isinstance(element, ViewTemplateElem | MaterialElem):
        return element.model_dump(by_alias=True, exclude_none=True)
    return {}


def query_types(
    model_id: str, doc: Document, request: dict[str, Any], include: list[str] | None = None
) -> dict[str, Any]:
    if err := _invalid_include(include, SUPPORTED_TYPE_INCLUDES):
        return err
    filt = request.get("filter") or {}
    if "parameters" in filt:
        return error_envelope(
            "unsupported_filter",
            "Parameter range filters are not implemented for query.types in M2-A.",
            status=400,
            details={
                "filter": "parameters",
                "todo": "Add typed parameter index per type category.",
            },
        )
    categories = set(filt.get("categories") or [])
    kinds = set(filt.get("kinds") or [])
    text = str(filt.get("text") or "").casefold()
    include_set = set(include or [])
    rows: list[dict[str, Any]] = []
    type_classes = (
        WallTypeElem,
        FloorTypeElem,
        RoofTypeElem,
        FamilyTypeElem,
        MaterialElem,
        ViewTemplateElem,
    )
    for element in sorted(doc.elements.values(), key=lambda e: e.id):
        if not isinstance(element, type_classes):
            continue
        kind = str(getattr(element, "kind", ""))
        category = _type_category(element)
        if kinds and kind not in kinds:
            continue
        if categories and category not in categories:
            continue
        if text and text not in f"{element.id} {getattr(element, 'name', '')}".casefold():
            continue
        row = {
            "id": element.id,
            "kind": kind,
            "category": category,
            "name": getattr(element, "name", ""),
        }
        params = _type_parameters(element)
        if "parameters" in include_set:
            row["parameters"] = params
        if "materials" in include_set:
            material_ids = [
                layer.get("materialKey") or layer.get("materialId")
                for layer in params.get("layers", [])
                if layer.get("materialKey") or layer.get("materialId")
            ]
            row["materialIds"] = material_ids
        rows.append(row)
    return success_envelope(model_id, doc, {"types": rows})


def query_views(
    model_id: str, doc: Document, request: dict[str, Any], include: list[str] | None = None
) -> dict[str, Any]:
    if err := _invalid_include(include, SUPPORTED_VIEW_INCLUDES):
        return err
    filt = request.get("filter") or {}
    kinds = set(filt.get("kinds") or [])
    level_ids = set(filt.get("levelIds") or [])
    text = str(filt.get("text") or "").casefold()
    rows: list[dict[str, Any]] = []
    view_classes = (
        PlanViewElem,
        ViewpointElem,
        SectionCutElem,
        ElevationViewElem,
        SheetElem,
        ScheduleElem,
        ViewTemplateElem,
    )
    for element in sorted(doc.elements.values(), key=lambda e: e.id):
        if not isinstance(element, view_classes):
            continue
        kind = str(getattr(element, "kind", ""))
        level_id = getattr(element, "level_id", None)
        if kinds and kind not in kinds:
            continue
        if level_ids and level_id not in level_ids:
            continue
        if text and text not in f"{element.id} {getattr(element, 'name', '')}".casefold():
            continue
        row = {"id": element.id, "kind": kind, "name": getattr(element, "name", "")}
        if level_id is not None:
            row["levelId"] = level_id
        if isinstance(element, PlanViewElem):
            row["scale"] = element.scale
            row["templateId"] = element.template_id or element.view_template_id
            if element.crop_min_mm and element.crop_max_mm:
                row["cropBBoxMm"] = [
                    element.crop_min_mm.x_mm,
                    element.crop_min_mm.y_mm,
                    element.crop_max_mm.x_mm,
                    element.crop_max_mm.y_mm,
                ]
        if isinstance(element, SheetElem):
            row["placements"] = [p.model_dump(by_alias=True) for p in element.view_placements]
        if isinstance(element, ScheduleElem):
            row["category"] = element.category
            row["sheetId"] = element.sheet_id
        rows.append({k: v for k, v in row.items() if v is not None})
    return success_envelope(model_id, doc, {"views": rows})


def _host_candidate(
    doc: Document,
    wall: WallElem,
    point: list[float],
    max_distance: float,
    *,
    opening_width_mm: float | None = None,
    endpoint_clearance_mm: float = 0.0,
    require_opening_fit: bool = False,
    adjust_opening_to_fit: bool = False,
    max_adjustment_mm: float | None = None,
) -> dict[str, Any] | None:
    start = (wall.start.x_mm, wall.start.y_mm)
    end = (wall.end.x_mm, wall.end.y_mm)
    t, px, py, distance = _project_to_segment((point[0], point[1]), start, end)
    if distance > max_distance:
        return None
    length = _wall_len(wall)
    nx = 0.0 if length <= 0 else -(end[1] - start[1]) / length
    ny = 0.0 if length <= 0 else (end[0] - start[0]) / length
    score = max(0.0, 1.0 - distance / max(max_distance, 1.0))
    opening_fit = None
    authoring_position = None
    if opening_width_mm is not None:
        bounds = hosted_t_bounds(wall, opening_width_mm)
        fits = False
        adjusted_t = t
        source_shift_mm = 0.0
        if bounds is not None:
            clearance_t = max(0.0, endpoint_clearance_mm) / max(length, 1.0)
            usable_t0 = bounds[0] + clearance_t
            usable_t1 = bounds[1] - clearance_t
            if usable_t1 <= usable_t0:
                bounds = None
            else:
                bounds = (usable_t0, usable_t1)
        if bounds is not None:
            usable_t0, usable_t1 = bounds
            fits = usable_t0 < t < usable_t1
            if not fits and adjust_opening_to_fit:
                adjusted_t = max(usable_t0 + 1e-4, min(usable_t1 - 1e-4, t))
                source_shift_mm = abs(adjusted_t - t) * length
                if max_adjustment_mm is not None and source_shift_mm > max_adjustment_mm:
                    adjusted_t = t
                    source_shift_mm = 0.0
            ax = start[0] + (end[0] - start[0]) * adjusted_t
            ay = start[1] + (end[1] - start[1]) * adjusted_t
            authoring_position = {
                "t": round(adjusted_t, 6),
                "distanceAlongMm": round(adjusted_t * length, 4),
                "pointMm": [round(ax, 4), round(ay, 4), point[2] if len(point) > 2 else 0],
            }
        opening_fit = {
            "requestedWidthMm": opening_width_mm,
            "fitsAtSourceProjection": fits,
            "usableT": [round(bounds[0], 6), round(bounds[1], 6)] if bounds else None,
            "sourceShiftMm": round(source_shift_mm, 4),
            "adjusted": bool(authoring_position and abs(authoring_position["t"] - t) > 1e-6),
        }
        if require_opening_fit and not (fits or (adjust_opening_to_fit and authoring_position)):
            return None
        if source_shift_mm:
            score *= max(0.1, 1.0 - source_shift_mm / max(max_adjustment_mm or max(opening_width_mm, 1.0), 1.0))
    return {
        "elementId": wall.id,
        "kind": "wall",
        "score": round(score, 4),
        "distanceMm": round(distance, 4),
        "normalMm": [round(nx, 6), round(ny, 6), 0],
        "position": {
            "t": round(t, 6),
            "distanceAlongMm": round(t * length, 4),
            "pointMm": [round(px, 4), round(py, 4), point[2] if len(point) > 2 else 0],
        },
        "authoringPosition": authoring_position,
        "openingFit": opening_fit,
        "validFor": ["door", "window", "wall_opening", "family_instance"],
    }


def query_hosts(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    if err := _invalid_include(request.get("include"), SUPPORTED_HOST_INCLUDES):
        return err
    if request.get("hostKind", "wall") != "wall":
        return error_envelope(
            "unsupported_filter", "Only wall hosts are supported in M2-A.", status=400
        )
    point = request.get("nearPointMm")
    if not isinstance(point, list) or len(point) < 2:
        return error_envelope("invalid_request", "nearPointMm must be [x,y,z?].", status=400)
    level_id = request.get("levelId")
    max_distance = float(request.get("maxDistanceMm") or 500)
    opening_width = _optional_float(request.get("openingWidthMm") or request.get("widthMm"))
    endpoint_clearance = _optional_float(request.get("endpointClearanceMm")) or 0.0
    require_opening_fit = bool(request.get("requireOpeningFit"))
    adjust_opening_to_fit = bool(request.get("adjustOpeningToFit"))
    max_adjustment = _optional_float(request.get("maxAdjustmentMm"))
    candidates = []
    for wall in sorted(
        (e for e in doc.elements.values() if isinstance(e, WallElem)), key=lambda w: w.id
    ):
        if level_id and wall.level_id != level_id:
            continue
        if wall.wall_curve is not None:
            continue
        if candidate := _host_candidate(
            doc,
            wall,
            point,
            max_distance,
            opening_width_mm=opening_width,
            endpoint_clearance_mm=endpoint_clearance,
            require_opening_fit=require_opening_fit,
            adjust_opening_to_fit=adjust_opening_to_fit,
            max_adjustment_mm=max_adjustment,
        ):
            candidates.append(candidate)
    candidates.sort(key=lambda c: (c["distanceMm"], c["elementId"]))
    return success_envelope(model_id, doc, {"hosts": candidates})


def query_nearest_wall(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    """Return the closest straight wall using the existing host proximity resolver."""

    hosts_req = dict(request)
    hosts_req["hostKind"] = "wall"
    if "nearPointMm" not in hosts_req and "pointMm" in hosts_req:
        hosts_req["nearPointMm"] = hosts_req["pointMm"]
    result = query_hosts(model_id, doc, hosts_req)
    if not result.get("ok"):
        return result
    hosts = result["data"]["hosts"]
    if not hosts:
        return error_envelope("not_found", "No wall found within maxDistanceMm.", status=404)
    nearest = hosts[0]
    return success_envelope(
        model_id,
        doc,
        {
            "wall": {
                "elementId": nearest["elementId"],
                "kind": "wall",
                "distanceMm": nearest["distanceMm"],
                "score": nearest["score"],
            },
            "placement": nearest["position"],
            "authoringPlacement": nearest.get("authoringPosition") or nearest["position"],
            "openingFit": nearest.get("openingFit"),
            "normalMm": nearest["normalMm"],
            "resolution": {
                "strategy": "query_hosts_nearest_wall",
                "confidence": nearest["score"],
            },
            "candidates": hosts[:10],
        },
    )


def resolve_wall_opening_host(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    """Resolve an opening source point to a wall-hosted authoring placement that fits."""

    point = request.get("nearPointMm") or request.get("pointMm") or request.get("sourcePointMm")
    if isinstance(point, dict):
        point = [point.get("xMm"), point.get("yMm"), point.get("zMm", 0)]
    width = _optional_float(request.get("widthMm") or request.get("openingWidthMm"))
    if not isinstance(point, list) or len(point) < 2:
        return error_envelope("invalid_request", "pointMm/nearPointMm/sourcePointMm is required.", status=400)
    if width is None or width <= 0:
        return error_envelope("invalid_request", "widthMm/openingWidthMm must be a positive number.", status=400)
    resolver_request = dict(request)
    resolver_request["nearPointMm"] = point
    resolver_request["openingWidthMm"] = width
    resolver_request["requireOpeningFit"] = True
    resolver_request["adjustOpeningToFit"] = bool(request.get("adjustOpeningToFit", True))
    resolver_request.setdefault("maxDistanceMm", 900)
    resolver_request.setdefault("endpointClearanceMm", 75)
    resolver_request.setdefault("maxAdjustmentMm", max(width / 2.0, 150.0))
    result = query_nearest_wall(model_id, doc, resolver_request)
    if not result.get("ok"):
        return result
    data = result["data"]
    authoring = data["authoringPlacement"]
    return success_envelope(
        model_id,
        doc,
        {
            "format": "resolveWallOpeningHost_v1",
            "host": data["wall"],
            "sourcePlacement": data["placement"],
            "authoring": {
                "wallId": data["wall"]["elementId"],
                "alongT": authoring["t"],
                "pointMm": authoring["pointMm"],
                "widthMm": width,
            },
            "openingFit": data.get("openingFit"),
            "normalMm": data.get("normalMm"),
            "resolution": {
                "strategy": "nearest_wall_with_opening_fit",
                "confidence": data.get("resolution", {}).get("confidence"),
            },
            "candidates": data.get("candidates", []),
        },
        warnings=[
            {
                "code": "opening_source_point_adjusted_to_fit",
                "message": "Source point was shifted along the wall so the opening width fits.",
                "details": data.get("openingFit"),
            }
        ]
        if data.get("openingFit", {}).get("adjusted")
        else [],
    )


def query_room_access_graph(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    room_ids = request.get("roomIds") or request.get("roomId")
    if isinstance(room_ids, str):
        room_ids = [room_ids]
    if room_ids is not None and not isinstance(room_ids, list):
        return error_envelope("invalid_request", "roomIds must be a list of strings.", status=400)
    graph = room_access_graph_v1(doc, room_ids=[str(room_id) for room_id in room_ids or []])
    if not graph.get("ok"):
        return error_envelope(
            str(graph.get("error", {}).get("code") or "invalid_request"),
            str(graph.get("error", {}).get("message") or "Room access graph failed."),
            status=400,
        )
    return success_envelope(model_id, doc, {"graph": graph})


def resolve_opening_source_match(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    """Classify source opening rows as likely same/distinct before authoring."""

    openings = [row for row in request.get("openings") or request.get("sourceOpenings") or [] if isinstance(row, dict)]
    if len(openings) < 2:
        return error_envelope(
            "invalid_request",
            "At least two source opening rows are required.",
            status=400,
        )
    matches = []
    for left_idx, left in enumerate(openings):
        for right in openings[left_idx + 1 :]:
            score, reasons = _source_opening_match_score(left, right)
            if score >= float(request.get("minScore") or 0.6):
                matches.append(
                    {
                        "status": "candidate_same_element" if score >= 0.8 else "candidate_needs_review",
                        "score": round(score, 4),
                        "sourceFactIds": [
                            left.get("factId") or left.get("sourceFactId"),
                            right.get("factId") or right.get("sourceFactId"),
                        ],
                        "reasons": reasons,
                        "requiredDisposition": "same_element | distinct_elements | source_repair_required",
                    }
                )
    matches.sort(key=lambda row: (-row["score"], str(row["sourceFactIds"])))
    return success_envelope(
        model_id,
        doc,
        {
            "format": "resolveOpeningSourceMatch_v1",
            "matchCount": len(matches),
            "matches": matches,
            "unmatchedSourceFactIds": _unmatched_opening_ids(openings, matches),
        },
    )


def resolve_dormer_opening_host(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    """Resolve a dormer-hosted opening to the best existing dormer element."""

    dormer_id = request.get("dormerId") or request.get("hostDormerId")
    host_roof_id = request.get("hostRoofId") or request.get("roofId")
    position = request.get("positionOnRoof") or request.get("sourcePositionOnRoof")
    candidates = []
    for dormer in sorted((e for e in doc.elements.values() if isinstance(e, DormerElem)), key=lambda d: d.id):
        if dormer_id and dormer.id != dormer_id:
            continue
        if host_roof_id and dormer.host_roof_id != host_roof_id:
            continue
        score = 1.0
        distance = None
        if isinstance(position, dict):
            dx = float(position.get("alongRidgeMm") or 0) - dormer.position_on_roof.along_ridge_mm
            dy = float(position.get("acrossRidgeMm") or 0) - dormer.position_on_roof.across_ridge_mm
            distance = math.hypot(dx, dy)
            score = max(0.0, 1.0 - distance / float(request.get("maxDistanceMm") or 2000))
        candidates.append(
            {
                "dormerId": dormer.id,
                "hostRoofId": dormer.host_roof_id,
                "distanceMm": round(distance, 4) if distance is not None else None,
                "score": round(score, 4),
                "positionOnRoof": dormer.position_on_roof.model_dump(by_alias=True),
            }
        )
    candidates.sort(key=lambda row: (-row["score"], row["dormerId"]))
    if not candidates:
        return error_envelope("not_found", "No matching dormer host found.", status=404)
    best = candidates[0]
    return success_envelope(
        model_id,
        doc,
        {
            "format": "resolveDormerOpeningHost_v1",
            "host": {
                "hostKind": "dormer",
                "hostElementId": best["dormerId"],
                "hostRoofId": best["hostRoofId"],
            },
            "resolution": {
                "strategy": "dormer_id_or_roof_local_position",
                "confidence": best["score"],
            },
            "authoring": {
                "status": "blocked_until_dormer_face_or_wall_host_exists",
                "requiredTools": ["author.dormer_on_roof", "opening.window_on_wall"],
                "note": "Current kernel resolves the dormer element; hosted window authoring still needs a dormer face/wall element or explicit supported fallback.",
            },
            "candidates": candidates[:10],
        },
    )


def resolve_roof_position_from_source_point(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    """Project a source point into a simple roof-local coordinate candidate."""

    roof_id = request.get("roofId") or request.get("hostRoofId")
    roof = doc.elements.get(str(roof_id or ""))
    if not isinstance(roof, RoofElem):
        return error_envelope("not_found", "hostRoofId/roofId must reference an existing roof.", status=404)
    point = _request_point(request, "sourcePointMm") or _request_point(request, "sourcePositionMm") or _request_point(request, "pointMm")
    if point is None:
        return error_envelope("invalid_request", "sourcePointMm, sourcePositionMm, or pointMm is required.", status=400)
    footprint = [_pt2(pt) for pt in roof.footprint_mm]
    bbox = _bbox_from_points(footprint)
    center_x = (bbox[0] + bbox[3]) / 2.0
    center_y = (bbox[1] + bbox[4]) / 2.0
    inside = bbox[0] <= point[0] <= bbox[3] and bbox[1] <= point[1] <= bbox[4]
    confidence = 0.7 if inside else 0.35
    warnings = [] if inside else [{"code": "source_point_outside_roof_bbox", "message": "Projected point lies outside the roof footprint bbox."}]
    return success_envelope(
        model_id,
        doc,
        {
            "format": "resolveRoofPositionFromSourcePoint_v1",
            "hostRoofId": roof.id,
            "positionOnRoof": {
                "alongRidgeMm": round(point[0] - center_x, 4),
                "acrossRidgeMm": round(point[1] - center_y, 4),
            },
            "sourcePointMm": point,
            "roofBBoxMm": bbox,
            "resolution": {
                "strategy": "roof_footprint_bbox_center_projection",
                "confidence": confidence,
            },
        },
        warnings=warnings,
    )


def validate_roof_dormer_source_alignment(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    """Validate modeled roof/dormer/opening elements against source roof facts."""

    facts = [fact for fact in request.get("facts") or request.get("sourceFacts") or [] if isinstance(fact, dict)]
    findings = []
    for fact in facts:
        kind = str(fact.get("kind") or "")
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        fact_id = fact.get("factId")
        if kind == "dormer":
            host_roof_id = value.get("hostRoofId") or value.get("hostRoofRef")
            if host_roof_id and not isinstance(doc.elements.get(str(host_roof_id)), RoofElem):
                findings.append(_roof_alignment_finding("missing_dormer_host_roof", fact_id, "Dormer source host roof is not modeled."))
            if value.get("depthMm") in (None, ""):
                findings.append(_roof_alignment_finding("source_dormer_depth_missing", fact_id, "Dormer source fact lacks depthMm."))
        elif kind in {"opening", "roof_opening"}:
            opening_text = " ".join(str(value.get(key) or "").lower() for key in ("openingType", "openingKind"))
            if "roof" in opening_text or "skylight" in opening_text:
                host_roof_id = value.get("hostRoofId") or value.get("hostRoofRef")
                if host_roof_id and not isinstance(doc.elements.get(str(host_roof_id)), RoofElem):
                    findings.append(_roof_alignment_finding("missing_roof_opening_host_roof", fact_id, "Roof opening source host roof is not modeled."))
                if not host_roof_id:
                    findings.append(_roof_alignment_finding("source_roof_opening_host_missing", fact_id, "Roof opening source fact lacks host roof reference."))
    modeled_dormers = [e for e in doc.elements.values() if isinstance(e, DormerElem)]
    modeled_roof_openings = [e for e in doc.elements.values() if isinstance(e, RoofOpeningElem)]
    return success_envelope(
        model_id,
        doc,
        {
            "format": "validateRoofDormerSourceAlignment_v1",
            "accepted": not findings,
            "summary": {
                "sourceFactCount": len(facts),
                "modeledDormerCount": len(modeled_dormers),
                "modeledRoofOpeningCount": len(modeled_roof_openings),
                "findingCount": len(findings),
                "errorCount": len(findings),
            },
            "findings": findings,
        },
    )


def _optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _source_opening_match_score(left: dict[str, Any], right: dict[str, Any]) -> tuple[float, list[str]]:
    left_value = left.get("value") if isinstance(left.get("value"), dict) else left
    right_value = right.get("value") if isinstance(right.get("value"), dict) else right
    score = 0.0
    reasons = []
    if left_value.get("levelId") and left_value.get("levelId") == right_value.get("levelId"):
        score += 0.25
        reasons.append("same_level")
    left_kind = _source_opening_kind(left, left_value)
    right_kind = _source_opening_kind(right, right_value)
    if left_kind == right_kind:
        score += 0.25
        reasons.append("same_opening_kind")
    for field, tolerance, weight in (("widthMm", 200.0, 0.2), ("heightMm", 250.0, 0.15)):
        lv = _number(left_value.get(field))
        rv = _number(right_value.get(field))
        if lv is not None and rv is not None and abs(lv - rv) <= tolerance:
            score += weight
            reasons.append(f"similar_{field}")
    if _different_source_ref(left, right):
        score += 0.15
        reasons.append("cross_source_match")
    return min(score, 1.0), reasons


def _source_opening_kind(fact: dict[str, Any], value: dict[str, Any]) -> str:
    raw = str(
        value.get("openingKind")
        or value.get("openingType")
        or fact.get("kind")
        or ""
    ).lower()
    if "door" in raw or "tuer" in raw or "tur" in raw:
        return "door"
    if "roof" in raw or "skylight" in raw or "dachfenster" in raw:
        return "roof_window"
    if "window" in raw or "fenster" in raw:
        return "window"
    return raw or "opening"


def _different_source_ref(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_prov = left.get("provenance") if isinstance(left.get("provenance"), dict) else {}
    right_prov = right.get("provenance") if isinstance(right.get("provenance"), dict) else {}
    return (
        left_prov.get("sourceDocumentId") != right_prov.get("sourceDocumentId")
        or left_prov.get("page") != right_prov.get("page")
        or left_prov.get("region") != right_prov.get("region")
    )


def _unmatched_opening_ids(openings: list[dict[str, Any]], matches: list[dict[str, Any]]) -> list[Any]:
    matched = {
        fact_id
        for match in matches
        for fact_id in match.get("sourceFactIds") or []
        if fact_id
    }
    return [
        opening.get("factId") or opening.get("sourceFactId")
        for opening in openings
        if (opening.get("factId") or opening.get("sourceFactId")) not in matched
    ]


def _request_point(request: dict[str, Any], key: str) -> list[float] | None:
    value = request.get(key)
    if isinstance(value, list) and len(value) >= 2:
        return [float(value[0]), float(value[1]), float(value[2]) if len(value) > 2 else 0.0]
    if isinstance(value, dict):
        if "xMm" in value and "yMm" in value:
            return [float(value.get("xMm") or 0), float(value.get("yMm") or 0), float(value.get("zMm") or 0)]
        if "x" in value and "y" in value:
            return [float(value.get("x") or 0), float(value.get("y") or 0), float(value.get("z") or 0)]
    return None


def _number(value: Any) -> float | None:
    if isinstance(value, int | float):
        return float(value)
    return None


def _roof_alignment_finding(code: str, fact_id: Any, message: str) -> dict[str, Any]:
    return {
        "code": code,
        "severity": "error",
        "sourceFactId": fact_id,
        "message": message,
    }


def resolve_host_face(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    hosts_req = {
        "hostKind": (request.get("hostKinds") or ["wall"])[0],
        "levelId": request.get("levelId"),
        "nearPointMm": request.get("pointMm"),
        "maxDistanceMm": request.get("maxDistanceMm", 500),
    }
    result = query_hosts(model_id, doc, hosts_req)
    if not result.get("ok"):
        return result
    hosts = result["data"]["hosts"]
    if not hosts:
        return error_envelope("not_found", "No host wall found within maxDistanceMm.", status=404)
    host = hosts[0]
    wall = doc.elements.get(host["elementId"])
    wall_height = wall.height_mm if isinstance(wall, WallElem) else 3000.0
    point = request.get("pointMm") or host["position"]["pointMm"]
    v = max(0.0, min(1.0, (point[2] if len(point) > 2 else 0.0) / max(wall_height, 1.0)))
    return success_envelope(
        model_id,
        doc,
        {
            "host": {
                "elementId": host["elementId"],
                "kind": "wall",
                "faceId": f"{host['elementId']}:nearest",
                "normal": host["normalMm"],
            },
            "placement": {
                "pointMm": point,
                "u": host["position"]["t"],
                "v": round(v, 6),
                "distanceAlongMm": host["position"]["distanceAlongMm"],
                "sillHeightMm": None,
            },
            "resolution": {
                "strategy": "nearest_host_face",
                "confidence": host["score"],
            },
        },
    )


def resolve_active_or_default_level(
    model_id: str, doc: Document, request: dict[str, Any]
) -> dict[str, Any]:
    if request.get("createIfMissing") is True:
        return error_envelope(
            "unsupported_filter",
            "createIfMissing is false-only for read-only M2 resolvers.",
            status=400,
        )
    hint = request.get("hint") or {}
    levels = sorted(
        (e for e in doc.elements.values() if isinstance(e, LevelElem)),
        key=lambda level: (level.elevation_mm, level.id),
    )
    strategy = "default_first_level"
    chosen: LevelElem | None = None
    if hint.get("levelId"):
        level = doc.elements.get(hint["levelId"])
        if not isinstance(level, LevelElem):
            return error_envelope(
                "unresolved_reference", "levelId does not resolve to a level.", status=422
            )
        chosen = level
        strategy = "from_level_id"
    elif hint.get("viewId"):
        view = doc.elements.get(hint["viewId"])
        level_id = getattr(view, "level_id", None)
        level = doc.elements.get(level_id or "")
        if isinstance(level, LevelElem):
            chosen = level
            strategy = "from_view"
    elif hint.get("name"):
        name = str(hint["name"]).casefold()
        matches = [level for level in levels if name in level.name.casefold()]
        if len(matches) > 1:
            return error_envelope(
                "ambiguous_match",
                "Multiple levels match name hint.",
                status=409,
                details={"candidateIds": [level.id for level in matches]},
            )
        chosen = matches[0] if matches else None
        strategy = "from_name"
    elif hint.get("elevationMm") is not None:
        elev = float(hint["elevationMm"])
        chosen = min(levels, key=lambda level: abs(level.elevation_mm - elev), default=None)
        strategy = "nearest_elevation"
    chosen = chosen or (levels[0] if levels else None)
    if chosen is None:
        return error_envelope("not_found", "No levels exist in model.", status=404)
    return success_envelope(
        model_id,
        doc,
        {
            "level": {"id": chosen.id, "name": chosen.name, "elevationMm": chosen.elevation_mm},
            "resolution": {"strategy": strategy, "confidence": 1.0},
        },
    )


def resolve_default_plan_view(
    model_id: str, doc: Document, request: dict[str, Any]
) -> dict[str, Any]:
    level_id = request.get("levelId")
    views = sorted(
        (e for e in doc.elements.values() if isinstance(e, PlanViewElem)), key=lambda v: v.id
    )
    if level_id:
        views = [v for v in views if v.level_id == level_id]
    if not views:
        return error_envelope("not_found", "No plan view found for requested level.", status=404)
    view = views[0]
    return success_envelope(
        model_id,
        doc,
        {
            "viewId": view.id,
            "levelId": view.level_id,
            "scale": view.scale,
            "resolution": {"strategy": "default_for_level", "confidence": 1.0},
        },
    )


def resolve_wall_by_line(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    line = request.get("lineMm")
    if not isinstance(line, list) or len(line) != 2:
        return error_envelope(
            "invalid_request", "lineMm must contain two [x,y] points.", status=400
        )
    level_id = request.get("levelId")
    tolerance = float(request.get("toleranceMm") or 100)
    a = (float(line[0][0]), float(line[0][1]))
    b = (float(line[1][0]), float(line[1][1]))
    req_len = max(_distance(a, b), 1.0)
    candidates: list[dict[str, Any]] = []
    for wall in sorted(
        (e for e in doc.elements.values() if isinstance(e, WallElem)), key=lambda w: w.id
    ):
        if level_id and wall.level_id != level_id:
            continue
        if wall.wall_curve is not None:
            continue
        wa = (wall.start.x_mm, wall.start.y_mm)
        wb = (wall.end.x_mm, wall.end.y_mm)
        direct = (_distance(a, wa) + _distance(b, wb)) / 2.0
        reversed_dist = (_distance(a, wb) + _distance(b, wa)) / 2.0
        distance = min(direct, reversed_dist)
        if distance > tolerance:
            continue
        overlap = min(req_len, _wall_len(wall)) / max(req_len, _wall_len(wall), 1.0)
        score = max(0.0, overlap * (1.0 - distance / max(tolerance, 1.0)))
        candidates.append(
            {
                "elementId": wall.id,
                "score": round(score, 4),
                "distanceMm": round(distance, 4),
                "overlapRatio": round(overlap, 4),
                "reversed": reversed_dist < direct,
            }
        )
    candidates.sort(key=lambda c: (-c["score"], c["distanceMm"], c["elementId"]))
    if not candidates:
        return error_envelope("not_found", "No wall matches line within tolerance.", status=404)
    if (
        len(candidates) > 1
        and candidates[0]["score"] - candidates[1]["score"] <= 0.05
        and request.get("preferNearestToMm") is None
    ):
        return error_envelope(
            "ambiguous_match",
            "Multiple walls match line within score tolerance.",
            status=409,
            details={"candidateIds": [c["elementId"] for c in candidates[:5]]},
        )
    best = candidates[0]
    return success_envelope(
        model_id,
        doc,
        {
            "wallId": best["elementId"],
            "match": {k: v for k, v in best.items() if k != "elementId"},
            "candidates": candidates[:10],
        },
    )


def resolve_floor_supports(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    floor_id = request.get("floorId")
    if not isinstance(floor_id, str) or not floor_id:
        return error_envelope("invalid_request", "floorId is required.", status=400)
    floor = doc.elements.get(floor_id)
    if not isinstance(floor, FloorElem):
        return error_envelope(
            "unresolved_reference", "floorId does not resolve to a floor.", status=422
        )

    support_kinds = set(request.get("supportKinds") or ["wall"])
    unsupported = sorted(support_kinds - {"wall"})
    if unsupported:
        return error_envelope(
            "unsupported_filter",
            "Only wall floor supports are supported by this resolver.",
            status=400,
            details={"unsupportedSupportKinds": unsupported, "supportedSupportKinds": ["wall"]},
        )

    tolerance = float(request.get("toleranceMm") or 250.0)
    vertical_tolerance = float(request.get("verticalToleranceMm") or 500.0)
    lower_level_id = request.get("lowerLevelId") or request.get("supportLevelId")
    floor_bbox = element_bbox_mm(doc, floor)
    if floor_bbox is None:
        return error_envelope("invalid_request", "Floor boundary could not be evaluated.", status=400)
    search_bbox = _expand_bbox_xy(tolerance)(floor_bbox)
    floor_z = _level_elevation(doc, floor.level_id)

    candidates: list[dict[str, Any]] = []
    for wall in sorted(
        (e for e in doc.elements.values() if isinstance(e, WallElem)), key=lambda w: w.id
    ):
        if lower_level_id and wall.level_id != lower_level_id:
            continue
        if wall.wall_curve is not None:
            continue
        wall_bbox = element_bbox_mm(doc, wall)
        if wall_bbox is None or not _bbox_intersects_xy(search_bbox, wall_bbox):
            continue
        wall_base_z = _level_elevation(doc, wall.level_id)
        wall_top_z = wall_base_z + wall.height_mm
        vertical_gap = abs(wall_top_z - floor_z)
        if not lower_level_id and vertical_gap > vertical_tolerance:
            continue
        overlap_area = _bbox_xy_overlap_area(search_bbox, wall_bbox)
        wall_area = max((wall_bbox[3] - wall_bbox[0]) * (wall_bbox[4] - wall_bbox[1]), 1.0)
        xy_score = min(1.0, overlap_area / wall_area)
        vertical_score = max(0.0, 1.0 - vertical_gap / max(vertical_tolerance, 1.0))
        score = 0.7 * xy_score + 0.3 * vertical_score
        candidates.append(
            {
                "kind": "wall",
                "elementId": wall.id,
                "levelId": wall.level_id,
                "score": round(score, 4),
                "xyOverlapAreaMm2": round(overlap_area, 3),
                "verticalGapMm": round(vertical_gap, 3),
                "reason": "wall bbox intersects floor boundary search area and wall top aligns to floor datum",
            }
        )
    candidates.sort(key=lambda c: (-c["score"], c["elementId"]))
    support_ids = [str(c["elementId"]) for c in candidates if c["score"] > 0]
    if not support_ids:
        return error_envelope(
            "not_found",
            "No floor supports matched the requested floor.",
            status=404,
            details={
                "floorId": floor.id,
                "floorLevelId": floor.level_id,
                "lowerLevelId": lower_level_id,
            },
        )

    return success_envelope(
        model_id,
        doc,
        {
            "floor": {
                "elementId": floor.id,
                "levelId": floor.level_id,
                "bboxMm": floor_bbox,
            },
            "supportIds": support_ids,
            "candidates": candidates[:25],
            "payloadPatch": {"props": {"supportedByIds": support_ids}},
            "resolution": {
                "strategy": "bbox_level_wall_support_match",
                "confidence": candidates[0]["score"],
            },
        },
    )


def resolve_room_boundary_edges(
    model_id: str, doc: Document, request: dict[str, Any]
) -> dict[str, Any]:
    room_ids = request.get("roomIds") or request.get("roomId")
    if isinstance(room_ids, str):
        room_ids = [room_ids]
    if room_ids is not None and not isinstance(room_ids, list):
        return error_envelope("invalid_request", "roomIds must be a list of strings.", status=400)
    report = room_boundary_edges_report_v1(doc, room_ids=[str(room_id) for room_id in room_ids or []])
    if not report.get("ok"):
        return error_envelope(
            str(report.get("error", {}).get("code") or "invalid_request"),
            str(report.get("error", {}).get("message") or "Room boundary edge report failed."),
            status=400,
        )
    return success_envelope(model_id, doc, {"boundaryEdges": report})


def _closed_boundary(points: list[list[float]]) -> list[list[float]]:
    if points and points[0] != points[-1]:
        return [*points, points[0]]
    return points


def _stable_loop_id(boundary: list[list[float]], source_ids: list[str]) -> str:
    norm = {
        "boundary": [[round(p[0], 3), round(p[1], 3)] for p in boundary],
        "sourceElementIds": sorted(source_ids),
    }
    digest = hashlib.sha256(repr(norm).encode("utf-8")).hexdigest()[:12]
    return f"loop:sha256:{digest}"


def _loop_from_boundary(
    level_id: str | None, boundary: list[list[float]], source_ids: list[str]
) -> dict[str, Any] | None:
    boundary = _closed_boundary(boundary)
    if len(boundary) < 4:
        return None
    area = _polygon_area(boundary[:-1])
    return {
        "id": _stable_loop_id(boundary, source_ids),
        "levelId": level_id,
        "closed": boundary[0] == boundary[-1],
        "areaMm2": abs(area),
        "orientation": "ccw" if area > 0 else "cw",
        "boundaryMm": boundary,
        "sourceElementIds": source_ids,
        "gaps": [],
    }


def _loop_from_walls(
    walls: list[WallElem], tolerance: float
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    if len(walls) < 3:
        return None, []
    unused = {w.id: w for w in walls}
    first = walls[0]
    boundary = [_pt2(first.start), _pt2(first.end)]
    source_ids = [first.id]
    del unused[first.id]
    warnings: list[dict[str, Any]] = []
    while unused:
        tail = tuple(boundary[-1])
        next_id = None
        reversed_next = False
        for wall_id, wall in unused.items():
            if _distance(tail, (wall.start.x_mm, wall.start.y_mm)) <= tolerance:
                next_id = wall_id
                break
            if _distance(tail, (wall.end.x_mm, wall.end.y_mm)) <= tolerance:
                next_id = wall_id
                reversed_next = True
                break
        if next_id is None:
            return None, [
                {"code": "open_wall_chain", "message": "Walls do not form a single ordered loop."}
            ]
        wall = unused.pop(next_id)
        next_pt = wall.start if reversed_next else wall.end
        if (
            _distance(
                tail,
                (
                    wall.start.x_mm if not reversed_next else wall.end.x_mm,
                    wall.start.y_mm if not reversed_next else wall.end.y_mm,
                ),
            )
            > 0
        ):
            warnings.append({"code": "small_gap_closed", "elementId": wall.id})
        boundary.append(_pt2(next_pt))
        source_ids.append(wall.id)
    if _distance(tuple(boundary[-1]), tuple(boundary[0])) > tolerance:
        return None, [
            {
                "code": "open_wall_chain",
                "message": "Wall chain end does not meet start within tolerance.",
            }
        ]
    boundary[-1] = boundary[0]
    return _loop_from_boundary(walls[0].level_id, boundary, source_ids), warnings


def query_enclosed_loops(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    if err := _invalid_include(request.get("include"), SUPPORTED_LOOP_INCLUDES):
        return err
    source = request.get("source") or {}
    tolerance = float(request.get("toleranceMm") or 25)
    level_id = request.get("levelId")
    loops: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if source.get("kind") in {"walls", "enclosing_walls"}:
        ids = source.get("elementIds") or []
        walls = [doc.elements.get(i) for i in ids]
        if not all(isinstance(w, WallElem) for w in walls):
            return error_envelope(
                "unresolved_reference", "source.elementIds must all resolve to walls.", status=422
            )
        loop, loop_warnings = _loop_from_walls(walls, tolerance)  # type: ignore[arg-type]
        warnings.extend(loop_warnings)
        if loop is not None:
            loops.append(loop)
    elif source.get("kind") in {"rooms", "floors", "roofs"}:
        ids = source.get("elementIds") or []
        for element_id in ids:
            element = doc.elements.get(element_id)
            if isinstance(element, RoomElem):
                loop = _loop_from_boundary(
                    element.level_id, [_pt2(p) for p in element.outline_mm], [element.id]
                )
            elif isinstance(element, FloorElem):
                loop = _loop_from_boundary(
                    element.level_id, [_pt2(p) for p in element.boundary_mm], [element.id]
                )
            elif isinstance(element, RoofElem):
                loop = _loop_from_boundary(
                    element.reference_level_id,
                    [_pt2(p) for p in element.footprint_mm],
                    [element.id],
                )
            else:
                return error_envelope(
                    "unresolved_reference",
                    f"{element_id} does not resolve to requested boundary source.",
                    status=422,
                )
            if loop is not None and (level_id is None or loop["levelId"] == level_id):
                loops.append(loop)
    else:
        return error_envelope(
            "unsupported_filter",
            "Only walls, enclosing_walls, rooms, floors, and roofs loop sources are supported.",
            status=400,
        )
    if not loops:
        return error_envelope(
            "degenerate_geometry",
            "No closed loop could be derived from source.",
            status=422,
            details={"warnings": warnings},
        )
    return success_envelope(model_id, doc, {"loops": loops}, warnings=warnings)


def resolve_loop_for_boundary(
    model_id: str, doc: Document, request: dict[str, Any]
) -> dict[str, Any]:
    result = query_enclosed_loops(model_id, doc, request)
    if not result.get("ok"):
        return result
    loop = result["data"]["loops"][0]
    return success_envelope(
        model_id,
        doc,
        {
            "loopId": loop["id"],
            "boundaryMm": loop["boundaryMm"],
            "sourceElementIds": loop["sourceElementIds"],
            "usableFor": ["floor", "roof", "room", "ceiling"],
            "resolution": {"strategy": "closed_wall_chain", "confidence": 0.98},
        },
        warnings=result.get("warnings") or [],
    )


def resolve_room_boundary(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    room_id = request.get("roomId")
    room = doc.elements.get(room_id or "")
    if not isinstance(room, RoomElem):
        return error_envelope("not_found", "roomId does not resolve to a room.", status=404)
    boundary = _closed_boundary([_pt2(p) for p in room.outline_mm])
    return success_envelope(
        model_id,
        doc,
        {
            "roomId": room.id,
            "levelId": room.level_id,
            "boundaryMm": boundary,
            "areaMm2": abs(_polygon_area(boundary[:-1])),
            "adjacentWallIds": [],
            "resolution": {"strategy": "room_element_boundary", "confidence": 1.0},
        },
    )


def resolve_family_type(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    category = request.get("category")
    text = str(request.get("nameOrText") or "").casefold()
    candidates = [
        e
        for e in doc.elements.values()
        if isinstance(e, FamilyTypeElem)
        and (category is None or e.discipline == category)
        and (not text or text in f"{e.id} {e.name} {e.parameters}".casefold())
    ]
    if not candidates and request.get("preferDefault"):
        candidates = [
            e
            for e in doc.elements.values()
            if isinstance(e, FamilyTypeElem) and (category is None or e.discipline == category)
        ]
    if not candidates:
        return error_envelope("not_found", "No family type matches request.", status=404)
    if len(candidates) > 1 and not request.get("preferDefault"):
        return error_envelope(
            "ambiguous_match",
            "Multiple family types match request.",
            status=409,
            details={"candidateIds": [c.id for c in candidates]},
        )
    chosen = sorted(candidates, key=lambda c: c.id)[0]
    return success_envelope(
        model_id,
        doc,
        {
            "typeId": chosen.id,
            "category": chosen.discipline,
            "name": chosen.name,
            "parameters": chosen.parameters,
            "resolution": {"strategy": "text_or_default_match", "confidence": 0.9},
        },
    )


def qa_advisor(model_id: str, doc: Document, request: dict[str, Any]) -> dict[str, Any]:
    """Read-only advisor wrapper over current constructability advisory checks."""

    profile = str(request.get("profile") or "authoring_default")
    limit = min(int(request.get("limit") or 100), 500)
    report = build_constructability_report(
        doc.elements,
        revision=doc.revision,
        profile=profile,
        design_option_sets=doc.design_option_sets,
    )
    findings = list(report["findings"])
    severity = request.get("severity")
    if severity:
        findings = [f for f in findings if f.get("severity") == severity]
    element_ids = set(request.get("elementIds") or [])
    if element_ids:
        findings = [
            f
            for f in findings
            if element_ids.intersection(str(eid) for eid in f.get("elementIds") or [])
        ]
    counts = Counter(str(f.get("severity") or "unknown") for f in findings)
    returned_findings = findings[:limit]
    return success_envelope(
        model_id,
        doc,
        {
            "format": "qaAdvisor_v1",
            "profile": profile,
            "findings": returned_findings,
            "rootCauseGroups": report.get("rootCauseGroups", []),
            "profilePreset": report.get("profilePreset"),
            "suppressionAudit": report.get("suppressionAudit"),
            "reviewWorkflow": report.get("reviewWorkflow"),
            "learningCorpus": report.get("learningCorpus"),
            "summary": {
                "findingCount": len(findings),
                "returnedCount": len(returned_findings),
                "severityCounts": dict(sorted(counts.items())),
                "rootCauseGroupCount": report["summary"].get("rootCauseGroupCount", 0),
            },
            "limitations": [
                "M2-G qa.advisor is read-only and wraps constructability advisory checks only.",
                "It does not run visual evidence, external-code, benchmark, or UI panel state checks.",
            ],
        },
    )
