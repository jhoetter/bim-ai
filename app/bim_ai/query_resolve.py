"""Read-only query/resolve projections for MCP/UI parity.

The functions here intentionally return compact, typed-ish wire dictionaries
instead of exposing raw engine internals as the primary contract.
"""

from __future__ import annotations

import hashlib
import math
from collections import Counter
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    ElevationViewElem,
    FamilyTypeElem,
    FloorElem,
    FloorTypeElem,
    LevelElem,
    MaterialElem,
    PlanViewElem,
    RoofElem,
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
    doc: Document, wall: WallElem, point: list[float], max_distance: float
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
    candidates = []
    for wall in sorted(
        (e for e in doc.elements.values() if isinstance(e, WallElem)), key=lambda w: w.id
    ):
        if level_id and wall.level_id != level_id:
            continue
        if wall.wall_curve is not None:
            continue
        if candidate := _host_candidate(doc, wall, point, max_distance):
            candidates.append(candidate)
    candidates.sort(key=lambda c: (c["distanceMm"], c["elementId"]))
    return success_envelope(model_id, doc, {"hosts": candidates})


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
