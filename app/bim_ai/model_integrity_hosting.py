from __future__ import annotations

import math
import re
from collections.abc import Mapping
from typing import Any

from bim_ai.constraints_core import Violation
from bim_ai.constraints_wall_geometry import wall_length_mm
from bim_ai.document import Document
from bim_ai.elements import DoorElem, Element, FloorElem, WallElem, WallOpeningElem, WindowElem

Point2 = tuple[float, float]
Interval = tuple[float, float]

DEFAULT_ENDPOINT_CLEARANCE_MM = 75.0
DEFAULT_ENVELOPE_TOLERANCE_MM = 25.0

HOSTED_OPENING_RULE_IDS = {
    "hosted_opening_missing_host",
    "hosted_opening_host_not_wall",
    "hosted_opening_helper_host",
    "hosted_opening_host_outside_floor_envelope",
    "hosted_opening_outside_usable_span",
    "hosted_opening_missing_semantic_cut",
    "hosted_opening_overlap",
    "physical_access_proxy_leakage",
}

_ACCESS_PROXY_ID_RE = re.compile(r"(^|[-_])access[-_](wall|door|window|opening)([-_]|$)")
_HELPER_WORD_RE = re.compile(
    r"\b(access control|room graph|helper|synthetic|diagnostic|analysis[- ]?only|nonphysical)\b",
    re.IGNORECASE,
)


def hosted_opening_integrity_violations(
    doc_or_elements: Document | Mapping[str, Element],
    *,
    endpoint_clearance_mm: float = DEFAULT_ENDPOINT_CLEARANCE_MM,
    envelope_tolerance_mm: float = DEFAULT_ENVELOPE_TOLERANCE_MM,
) -> list[Violation]:
    """Return deterministic BIM-integrity findings for wall-hosted openings.

    The checker is intentionally pure and standalone. It validates the state after any
    source of mutation, including bulk agent bundles that can bypass UI host picking.
    """

    elements = doc_or_elements.elements if isinstance(doc_or_elements, Document) else doc_or_elements
    violations: list[Violation] = []

    walls = {eid: elem for eid, elem in elements.items() if isinstance(elem, WallElem)}
    floors_by_level = _floors_by_level(elements)
    hosted = _hosted_openings(elements)

    for wall in walls.values():
        if _is_access_proxy(wall) and _is_physical_wall(wall):
            violations.append(
                _violation(
                    "physical_access_proxy_leakage",
                    "error",
                    (
                        f"Access/helper wall '{wall.id}' is modeled as visible physical geometry; "
                        "convert it to nonphysical analysis data or replace it with a real wall."
                    ),
                    [wall.id],
                )
            )

    host_outside_reported: set[str] = set()
    for opening in hosted:
        opening_id = str(opening.id)
        host_id = _host_wall_id(opening)
        host = elements.get(host_id)

        if host is None:
            violations.append(
                _violation(
                    "hosted_opening_missing_host",
                    "error",
                    f"{_kind_label(opening)} '{opening_id}' references missing host wall '{host_id}'.",
                    [opening_id],
                )
            )
            continue

        if not isinstance(host, WallElem):
            violations.append(
                _violation(
                    "hosted_opening_host_not_wall",
                    "error",
                    (
                        f"{_kind_label(opening)} '{opening_id}' is hosted by '{host_id}', "
                        f"which is a {getattr(host, 'kind', 'non-wall')} instead of a wall."
                    ),
                    [opening_id, host_id],
                )
            )
            continue

        if _is_helper_or_nonphysical_wall(host):
            violations.append(
                _violation(
                    "hosted_opening_helper_host",
                    "error",
                    (
                        f"{_kind_label(opening)} '{opening_id}' is hosted by helper/nonphysical wall "
                        f"'{host.id}' instead of a real architectural wall."
                    ),
                    [opening_id, host.id],
                )
            )

        if _is_access_proxy(opening):
            violations.append(
                _violation(
                    "physical_access_proxy_leakage",
                    "error",
                    (
                        f"Access/helper {_kind_label(opening).lower()} '{opening_id}' is modeled as "
                        "physical BIM geometry; keep access-graph helpers nonphysical."
                    ),
                    [opening_id, host.id],
                )
            )

        if host.id not in host_outside_reported and not _wall_supported_by_level_floor(
            host,
            floors_by_level,
            tolerance_mm=envelope_tolerance_mm,
        ):
            host_outside_reported.add(host.id)
            violations.append(
                _violation(
                    "hosted_opening_host_outside_floor_envelope",
                    "error",
                    (
                        f"Host wall '{host.id}' does not intersect any floor/envelope footprint "
                        f"on level '{host.level_id}', so hosted openings on it are detached from "
                        "the building fabric."
                    ),
                    [opening_id, host.id],
                )
            )

        span_message = _span_violation_message(
            opening,
            host,
            endpoint_clearance_mm=endpoint_clearance_mm,
        )
        if span_message is not None:
            violations.append(
                _violation(
                    "hosted_opening_outside_usable_span",
                    "error",
                    span_message,
                    [opening_id, host.id],
                )
            )

        cut_message = _semantic_cut_violation_message(opening, host)
        if cut_message is not None:
            violations.append(
                _violation(
                    "hosted_opening_missing_semantic_cut",
                    "error",
                    cut_message,
                    [opening_id, host.id],
                )
            )

    violations.extend(_overlap_violations(hosted, elements))
    return sorted(violations, key=lambda v: (v.rule_id, v.element_ids, v.message))


def _violation(rule_id: str, severity: str, message: str, element_ids: list[str]) -> Violation:
    return Violation(
        rule_id=rule_id,
        severity=severity,
        message=message,
        element_ids=sorted(dict.fromkeys(element_ids)),
        blocking=severity == "error",
        discipline="architecture",
        blocking_class="model_integrity",
    )


def _hosted_openings(elements: Mapping[str, Element]) -> list[DoorElem | WindowElem | WallOpeningElem]:
    hosted = [
        elem
        for elem in elements.values()
        if isinstance(elem, DoorElem | WindowElem | WallOpeningElem)
    ]
    return sorted(hosted, key=lambda elem: str(elem.id))


def _host_wall_id(opening: DoorElem | WindowElem | WallOpeningElem) -> str:
    if isinstance(opening, WallOpeningElem):
        return opening.host_wall_id
    return opening.wall_id


def _kind_label(opening: DoorElem | WindowElem | WallOpeningElem) -> str:
    return str(getattr(opening, "kind", "hosted opening")).replace("_", " ").title()


def _floors_by_level(elements: Mapping[str, Element]) -> dict[str, list[FloorElem]]:
    floors: dict[str, list[FloorElem]] = {}
    for elem in elements.values():
        if isinstance(elem, FloorElem):
            floors.setdefault(elem.level_id, []).append(elem)
    for level_id in floors:
        floors[level_id].sort(key=lambda floor: floor.id)
    return floors


def _wall_supported_by_level_floor(
    wall: WallElem,
    floors_by_level: Mapping[str, list[FloorElem]],
    *,
    tolerance_mm: float,
) -> bool:
    floors = floors_by_level.get(wall.level_id)
    if not floors:
        return True

    segment = ((wall.start.x_mm, wall.start.y_mm), (wall.end.x_mm, wall.end.y_mm))
    midpoint = (
        (wall.start.x_mm + wall.end.x_mm) / 2.0,
        (wall.start.y_mm + wall.end.y_mm) / 2.0,
    )
    for floor in floors:
        polygon = [(point.x_mm, point.y_mm) for point in floor.boundary_mm]
        if len(polygon) < 3:
            continue
        if (
            _point_in_or_near_polygon(segment[0], polygon, tolerance_mm)
            or _point_in_or_near_polygon(segment[1], polygon, tolerance_mm)
            or _point_in_or_near_polygon(midpoint, polygon, tolerance_mm)
            or _segment_intersects_polygon(segment[0], segment[1], polygon, tolerance_mm)
        ):
            return True
    return False


def _span_violation_message(
    opening: DoorElem | WindowElem | WallOpeningElem,
    host: WallElem,
    *,
    endpoint_clearance_mm: float,
) -> str | None:
    length = wall_length_mm(host)
    if length < 10.0:
        return f"Host wall '{host.id}' is too short to host {_kind_label(opening).lower()} '{opening.id}'."

    interval = _opening_interval(opening, host)
    if interval is None:
        return (
            f"{_kind_label(opening)} '{opening.id}' exceeds the usable span of host wall "
            f"'{host.id}'."
        )

    start_t, end_t = interval
    if start_t < -1e-6 or end_t > 1.0 + 1e-6:
        return (
            f"{_kind_label(opening)} '{opening.id}' extends outside the endpoints of host wall "
            f"'{host.id}'."
        )

    clearance_start = start_t * length
    clearance_end = (1.0 - end_t) * length
    min_clearance = min(clearance_start, clearance_end)
    if min_clearance < endpoint_clearance_mm:
        return (
            f"{_kind_label(opening)} '{opening.id}' leaves only {min_clearance:.1f} mm endpoint "
            f"clearance on host wall '{host.id}' (minimum {endpoint_clearance_mm:.1f} mm)."
        )
    return None


def _semantic_cut_violation_message(
    opening: DoorElem | WindowElem | WallOpeningElem,
    host: WallElem,
) -> str | None:
    if isinstance(opening, WindowElem):
        head = opening.sill_height_mm + opening.height_mm
        if head > host.height_mm + 1e-6:
            return (
                f"Window '{opening.id}' head height ({head:.1f} mm) exceeds host wall "
                f"'{host.id}' height ({host.height_mm:.1f} mm), so no valid semantic wall cut exists."
            )
    if isinstance(opening, WallOpeningElem):
        if opening.head_height_mm > host.height_mm + 1e-6:
            return (
                f"Wall opening '{opening.id}' head height ({opening.head_height_mm:.1f} mm) exceeds "
                f"host wall '{host.id}' height ({host.height_mm:.1f} mm)."
            )

    props = getattr(opening, "props", None) or {}
    if _truthy(props.get("disableHostCut")) or str(props.get("hostCut", "")).lower() == "none":
        return (
            f"{_kind_label(opening)} '{opening.id}' declares no semantic host cut; hosted elements "
            "must cut the wall or remain nonphysical."
        )
    return None


def _overlap_violations(
    hosted: list[DoorElem | WindowElem | WallOpeningElem],
    elements: Mapping[str, Element],
) -> list[Violation]:
    by_host: dict[str, list[tuple[DoorElem | WindowElem | WallOpeningElem, Interval]]] = {}
    for opening in hosted:
        host = elements.get(_host_wall_id(opening))
        if not isinstance(host, WallElem):
            continue
        interval = _opening_interval(opening, host)
        if interval is None:
            continue
        by_host.setdefault(host.id, []).append((opening, interval))

    violations: list[Violation] = []
    for host_id, rows in sorted(by_host.items()):
        ordered = sorted(rows, key=lambda row: (row[1][0], str(row[0].id)))
        for index, (a_opening, a_interval) in enumerate(ordered):
            for b_opening, b_interval in ordered[index + 1 :]:
                if b_interval[0] >= a_interval[1] - 1e-6:
                    break
                violations.append(
                    _violation(
                        "hosted_opening_overlap",
                        "error",
                        (
                            f"Hosted openings '{a_opening.id}' and '{b_opening.id}' overlap "
                            f"on wall '{host_id}'."
                        ),
                        [str(a_opening.id), str(b_opening.id), host_id],
                    )
                )
    return violations


def _opening_interval(
    opening: DoorElem | WindowElem | WallOpeningElem,
    host: WallElem,
) -> Interval | None:
    if isinstance(opening, WallOpeningElem):
        return opening.along_t_start, opening.along_t_end
    length = wall_length_mm(host)
    if length < 10.0:
        return None
    half_t = (opening.width_mm / 2.0) / length
    return opening.along_t - half_t, opening.along_t + half_t


def _is_helper_or_nonphysical_wall(wall: WallElem) -> bool:
    if not _is_physical_wall(wall):
        return True
    return _is_access_proxy(wall) or _HELPER_WORD_RE.search(wall.name or "") is not None


def _is_physical_wall(wall: WallElem) -> bool:
    props = wall.props or {}
    if _truthy(props.get("nonPhysical")) or _truthy(props.get("analysisOnly")):
        return False
    if str(props.get("physicalRole", "")).lower() in {"helper", "analysis", "nonphysical"}:
        return False
    if props.get("physical") is False:
        return False
    return True


def _is_access_proxy(elem: Any) -> bool:
    elem_id = str(getattr(elem, "id", ""))
    if _ACCESS_PROXY_ID_RE.search(elem_id):
        return True
    name = str(getattr(elem, "name", "") or "")
    if _HELPER_WORD_RE.search(name):
        return True
    props = getattr(elem, "props", None) or {}
    return (
        _truthy(props.get("accessProxy"))
        or _truthy(props.get("helper"))
        or str(props.get("role", "")).lower() in {"access_proxy", "helper", "room_graph"}
    )


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def _point_in_or_near_polygon(point: Point2, polygon: list[Point2], tolerance_mm: float) -> bool:
    if _point_to_polygon_distance_mm(point, polygon) <= tolerance_mm:
        return True
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


def _point_to_polygon_distance_mm(point: Point2, polygon: list[Point2]) -> float:
    if not polygon:
        return math.inf
    return min(
        _point_to_segment_distance_mm(point, polygon[i], polygon[(i + 1) % len(polygon)])
        for i in range(len(polygon))
    )


def _segment_intersects_polygon(
    start: Point2,
    end: Point2,
    polygon: list[Point2],
    tolerance_mm: float,
) -> bool:
    for index in range(len(polygon)):
        edge_start = polygon[index]
        edge_end = polygon[(index + 1) % len(polygon)]
        if _segments_intersect(start, end, edge_start, edge_end):
            return True
        if (
            _point_to_segment_distance_mm(start, edge_start, edge_end) <= tolerance_mm
            or _point_to_segment_distance_mm(end, edge_start, edge_end) <= tolerance_mm
        ):
            return True
    return False


def _segments_intersect(a: Point2, b: Point2, c: Point2, d: Point2) -> bool:
    def orient(p: Point2, q: Point2, r: Point2) -> float:
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    def on_segment(p: Point2, q: Point2, r: Point2) -> bool:
        return (
            min(p[0], r[0]) - 1e-9 <= q[0] <= max(p[0], r[0]) + 1e-9
            and min(p[1], r[1]) - 1e-9 <= q[1] <= max(p[1], r[1]) + 1e-9
        )

    o1 = orient(a, b, c)
    o2 = orient(a, b, d)
    o3 = orient(c, d, a)
    o4 = orient(c, d, b)
    if o1 * o2 < 0 and o3 * o4 < 0:
        return True
    if abs(o1) <= 1e-9 and on_segment(a, c, b):
        return True
    if abs(o2) <= 1e-9 and on_segment(a, d, b):
        return True
    if abs(o3) <= 1e-9 and on_segment(c, a, d):
        return True
    if abs(o4) <= 1e-9 and on_segment(c, b, d):
        return True
    return False


def _point_to_segment_distance_mm(point: Point2, start: Point2, end: Point2) -> float:
    px, py = point
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    length_sq = dx * dx + dy * dy
    if length_sq <= 1e-12:
        return math.hypot(px - sx, py - sy)
    t = max(0.0, min(1.0, ((px - sx) * dx + (py - sy) * dy) / length_sq))
    qx = sx + t * dx
    qy = sy + t * dy
    return math.hypot(px - qx, py - qy)
