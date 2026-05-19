from __future__ import annotations

import math
import re
from collections.abc import Mapping
from typing import Any

from bim_ai.constraints_core import Violation
from bim_ai.constraints_wall_geometry import wall_length_mm
from bim_ai.document import Document
from bim_ai.elements import (
    AssetLibraryEntryElem,
    CeilingElem,
    DoorElem,
    Element,
    FamilyInstanceElem,
    FamilyTypeElem,
    FloorElem,
    PlacedAssetElem,
    ReferencePlaneElem,
    RoofElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)

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
    "hosted_family_missing_host",
    "hosted_family_unsupported_host_class",
    "hosted_render_proxy_orphan",
    "physical_access_proxy_leakage",
}

_ACCESS_PROXY_ID_RE = re.compile(r"(^|[-_])access[-_](wall|door|window|opening)([-_]|$)")
_HELPER_WORD_RE = re.compile(
    r"\b(access control|room graph|helper|synthetic|diagnostic|analysis[- ]?only|nonphysical)\b",
    re.IGNORECASE,
)
_HOST_SUPPORT_KEYS = (
    "hostSupport",
    "host_support",
    "hosting",
    "hostingMode",
    "hosting_mode",
    "hostKind",
    "host_kind",
)
_HOST_SUPPORT_ALIASES = {
    "wall": "wall_hosted",
    "wall-hosted": "wall_hosted",
    "wall_hosted": "wall_hosted",
    "hosted": "wall_hosted",
    "face": "face_hosted",
    "face-hosted": "face_hosted",
    "face_hosted": "face_hosted",
    "level": "level_hosted",
    "level-hosted": "level_hosted",
    "level_hosted": "level_hosted",
    "ceiling": "ceiling_hosted",
    "ceiling-hosted": "ceiling_hosted",
    "ceiling_hosted": "ceiling_hosted",
    "workplane": "workplane_hosted",
    "workplane-hosted": "workplane_hosted",
    "workplane_hosted": "workplane_hosted",
    "free": "freestanding",
    "freestanding": "freestanding",
    "free-standing": "freestanding",
}
_HOST_CLASSES_REQUIRING_ELEMENT = {
    "wall_hosted",
    "face_hosted",
    "ceiling_hosted",
    "workplane_hosted",
}
_HOST_CLASS_LABELS = {
    "wall_hosted": "wall-hosted",
    "face_hosted": "face-hosted",
    "level_hosted": "level-hosted",
    "ceiling_hosted": "ceiling-hosted",
    "workplane_hosted": "workplane-hosted",
    "freestanding": "freestanding",
}


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
                    quick_fix_command=_safe_delete_command(opening),
                )
            )
            if _renders_as_hosted_proxy(opening, elements):
                violations.append(_orphan_render_proxy_violation(opening, host_id))
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
                    quick_fix_command=_safe_delete_command(opening),
                )
            )
            if _renders_as_hosted_proxy(opening, elements):
                violations.append(_orphan_render_proxy_violation(opening, host_id))
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
                    quick_fix_command=_safe_delete_command(opening),
                )
            )
            if _renders_as_hosted_proxy(opening, elements):
                violations.append(_orphan_render_proxy_violation(opening, host.id))

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
                    quick_fix_command=_safe_delete_command(opening),
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
                    quick_fix_command=_resize_to_usable_span_command(
                        opening,
                        host,
                        endpoint_clearance_mm=endpoint_clearance_mm,
                    ),
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
    violations.extend(_hosted_family_support_violations(elements))
    return sorted(violations, key=lambda v: (v.rule_id, v.element_ids, v.message))


def hosted_opening_conflict_graph(
    doc_or_elements: Document | Mapping[str, Element],
    *,
    endpoint_clearance_mm: float = DEFAULT_ENDPOINT_CLEARANCE_MM,
) -> dict[str, Any]:
    """Return a deterministic graph of hosted opening nodes and wall-span conflicts."""

    elements = doc_or_elements.elements if isinstance(doc_or_elements, Document) else doc_or_elements
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    by_host: dict[str, list[dict[str, Any]]] = {}

    for opening in _hosted_openings(elements):
        host_id = _host_wall_id(opening)
        host = elements.get(host_id)
        node: dict[str, Any] = {
            "elementId": str(opening.id),
            "kind": str(opening.kind),
            "hostWallId": host_id,
            "supportClass": "wall_hosted",
        }
        if not isinstance(host, WallElem):
            node["hostState"] = "missing" if host is None else "unsupported_host_class"
            nodes.append(node)
            continue

        length = wall_length_mm(host)
        node["hostState"] = "valid"
        node["hostLengthMm"] = round(length, 3)
        interval = _opening_interval(opening, host)
        if interval is not None:
            start_t, end_t = interval
            node["interval"] = {
                "startT": round(start_t, 6),
                "endT": round(end_t, 6),
                "widthMm": round(max(0.0, end_t - start_t) * length, 3),
                "clearanceStartMm": round(start_t * length, 3),
                "clearanceEndMm": round((1.0 - end_t) * length, 3),
            }
            by_host.setdefault(host.id, []).append(node)

            if start_t < -1e-6 or end_t > 1.0 + 1e-6:
                edges.append(
                    {
                        "kind": "outside_wall_span",
                        "hostWallId": host.id,
                        "elementIds": [str(opening.id), host.id],
                    }
                )
            elif min(start_t * length, (1.0 - end_t) * length) < endpoint_clearance_mm:
                edges.append(
                    {
                        "kind": "endpoint_clearance",
                        "hostWallId": host.id,
                        "elementIds": [str(opening.id), host.id],
                        "minimumClearanceMm": endpoint_clearance_mm,
                    }
                )
        nodes.append(node)

    for host_id, host_nodes in sorted(by_host.items()):
        ordered = sorted(
            (node for node in host_nodes if isinstance(node.get("interval"), dict)),
            key=lambda node: (
                float(node["interval"]["startT"]),
                str(node["elementId"]),
            ),
        )
        for index, a_node in enumerate(ordered):
            a_interval = a_node["interval"]
            for b_node in ordered[index + 1 :]:
                b_interval = b_node["interval"]
                if float(b_interval["startT"]) >= float(a_interval["endT"]) - 1e-6:
                    break
                overlap_t = min(float(a_interval["endT"]), float(b_interval["endT"])) - max(
                    float(a_interval["startT"]),
                    float(b_interval["startT"]),
                )
                edges.append(
                    {
                        "kind": "overlap",
                        "hostWallId": host_id,
                        "elementIds": [str(a_node["elementId"]), str(b_node["elementId"]), host_id],
                        "overlapT": round(max(0.0, overlap_t), 6),
                    }
                )

    return {
        "format": "hostedOpeningConflictGraph_v1",
        "nodes": sorted(nodes, key=lambda node: str(node["elementId"])),
        "edges": sorted(
            edges,
            key=lambda edge: (
                str(edge.get("kind") or ""),
                str(edge.get("hostWallId") or ""),
                tuple(str(eid) for eid in edge.get("elementIds") or []),
            ),
        ),
    }


def _violation(
    rule_id: str,
    severity: str,
    message: str,
    element_ids: list[str],
    *,
    quick_fix_command: dict[str, Any] | None = None,
) -> Violation:
    return Violation(
        rule_id=rule_id,
        severity=severity,
        message=message,
        element_ids=sorted(dict.fromkeys(element_ids)),
        blocking=severity == "error",
        quick_fix_command=quick_fix_command,
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
    del hosted
    violations: list[Violation] = []
    graph = hosted_opening_conflict_graph(elements)
    for edge in graph["edges"]:
        if edge.get("kind") != "overlap":
            continue
        element_ids = [str(eid) for eid in edge.get("elementIds") or []]
        if len(element_ids) < 3:
            continue
        a_id, b_id, host_id = element_ids[:3]
        violations.append(
            _violation(
                "hosted_opening_overlap",
                "error",
                f"Hosted openings '{a_id}' and '{b_id}' overlap on wall '{host_id}'.",
                [a_id, b_id, host_id],
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


def _hosted_family_support_violations(elements: Mapping[str, Element]) -> list[Violation]:
    violations: list[Violation] = []
    for elem in sorted(elements.values(), key=lambda e: str(e.id)):
        if not isinstance(elem, FamilyInstanceElem | PlacedAssetElem):
            continue
        support_class = _declared_support_class(elem, elements)
        if support_class in (None, "freestanding", "level_hosted"):
            continue
        host_id = elem.host_element_id
        if not host_id:
            violations.append(
                _violation(
                    "hosted_family_missing_host",
                    "error",
                    (
                        f"{_element_label(elem)} '{elem.id}' declares "
                        f"{_HOST_CLASS_LABELS[support_class]} support but has no host element."
                    ),
                    [elem.id],
                    quick_fix_command=_safe_delete_command(elem),
                )
            )
            if _renders_as_hosted_proxy(elem, elements):
                violations.append(_orphan_render_proxy_violation(elem, None))
            continue

        host = elements.get(host_id)
        if host is None:
            violations.append(
                _violation(
                    "hosted_family_missing_host",
                    "error",
                    (
                        f"{_element_label(elem)} '{elem.id}' declares "
                        f"{_HOST_CLASS_LABELS[support_class]} support but references missing host "
                        f"'{host_id}'."
                    ),
                    [elem.id],
                    quick_fix_command=_safe_delete_command(elem),
                )
            )
            if _renders_as_hosted_proxy(elem, elements):
                violations.append(_orphan_render_proxy_violation(elem, host_id))
            continue

        if not _host_kind_supported(support_class, host):
            violations.append(
                _violation(
                    "hosted_family_unsupported_host_class",
                    "error",
                    (
                        f"{_element_label(elem)} '{elem.id}' declares "
                        f"{_HOST_CLASS_LABELS[support_class]} support but is hosted by "
                        f"'{host_id}' ({getattr(host, 'kind', 'unknown')})."
                    ),
                    [elem.id, host_id],
                    quick_fix_command=_safe_delete_command(elem),
                )
            )
            if _renders_as_hosted_proxy(elem, elements):
                violations.append(_orphan_render_proxy_violation(elem, host_id))
    return violations


def _declared_support_class(
    elem: DoorElem | WindowElem | WallOpeningElem | FamilyInstanceElem | PlacedAssetElem,
    elements: Mapping[str, Element],
) -> str | None:
    if isinstance(elem, DoorElem | WindowElem | WallOpeningElem):
        return "wall_hosted"

    raw_values: list[Any] = []
    raw_values.extend(_support_values_from_mapping(getattr(elem, "param_values", None)))
    if isinstance(elem, FamilyInstanceElem):
        family_type = elements.get(elem.family_type_id)
        if isinstance(family_type, FamilyTypeElem):
            raw_values.extend(_support_values_from_mapping(family_type.parameters))
            if family_type.discipline in {"door", "window"}:
                raw_values.append("wall_hosted")
    elif isinstance(elem, PlacedAssetElem):
        asset = elements.get(elem.asset_id)
        raw_values.extend(_support_values_from_mapping(getattr(asset, "param_values", None)))
        if isinstance(asset, AssetLibraryEntryElem):
            raw_values.extend(_support_values_from_param_schema(asset.param_schema))
            if asset.category in {"door", "window"}:
                raw_values.append("wall_hosted")

    for raw in raw_values:
        support = _normalize_support_class(raw)
        if support is not None:
            return support
    return None


def _support_values_from_mapping(raw: Any) -> list[Any]:
    if not isinstance(raw, Mapping):
        return []
    return [raw[key] for key in _HOST_SUPPORT_KEYS if key in raw]


def _support_values_from_param_schema(raw: Any) -> list[Any]:
    if not isinstance(raw, list):
        return []
    values: list[Any] = []
    for entry in raw:
        if not isinstance(entry, Mapping):
            continue
        key = str(entry.get("key") or entry.get("id") or entry.get("name") or "")
        if key in _HOST_SUPPORT_KEYS:
            values.append(entry.get("value") or entry.get("default") or entry.get("defaultValue"))
    return values


def _normalize_support_class(raw: Any) -> str | None:
    if raw is None:
        return None
    token = str(raw).strip().lower().replace(" ", "_")
    if not token:
        return None
    return _HOST_SUPPORT_ALIASES.get(token, _HOST_SUPPORT_ALIASES.get(token.replace("_", "-")))


def _host_kind_supported(support_class: str, host: Element) -> bool:
    if support_class == "wall_hosted":
        return isinstance(host, WallElem) and _is_physical_wall(host)
    if support_class == "face_hosted":
        return isinstance(host, WallElem | FloorElem | RoofElem | CeilingElem)
    if support_class == "ceiling_hosted":
        return isinstance(host, CeilingElem)
    if support_class == "workplane_hosted":
        return isinstance(host, ReferencePlaneElem)
    return support_class not in _HOST_CLASSES_REQUIRING_ELEMENT


def _orphan_render_proxy_violation(
    elem: DoorElem | WindowElem | WallOpeningElem | FamilyInstanceElem | PlacedAssetElem,
    host_id: str | None,
) -> Violation:
    element_id = str(elem.id)
    ids = [element_id, host_id] if host_id else [element_id]
    return _violation(
        "hosted_render_proxy_orphan",
        "warning",
        (
            f"{_element_label(elem)} '{element_id}' can render a hosted proxy, but its host "
            "geometry is missing or unsupported."
        ),
        [eid for eid in ids if eid],
        quick_fix_command=_safe_delete_command(elem),
    )


def _renders_as_hosted_proxy(
    elem: DoorElem | WindowElem | WallOpeningElem | FamilyInstanceElem | PlacedAssetElem,
    elements: Mapping[str, Element],
) -> bool:
    if isinstance(elem, DoorElem | WindowElem | WallOpeningElem):
        return True
    props = getattr(elem, "props", None) or {}
    params = getattr(elem, "param_values", None) or {}
    if any(
        key in props or key in params
        for key in ("renderProxy", "renderProxyKind", "rendererProxy", "proxyGeometry")
    ):
        return True
    if _declared_support_class(elem, elements) in _HOST_CLASSES_REQUIRING_ELEMENT:
        return True
    if isinstance(elem, PlacedAssetElem):
        asset = elements.get(elem.asset_id)
        return bool(getattr(asset, "render_proxy_kind", None))
    return False


def _safe_delete_command(elem: Any) -> dict[str, Any] | None:
    props = getattr(elem, "props", None) or {}
    if _is_access_proxy(elem) or _truthy(props.get("repairSafeDelete")):
        return {"type": "deleteElement", "elementId": str(elem.id)}
    return None


def _resize_to_usable_span_command(
    opening: DoorElem | WindowElem | WallOpeningElem,
    host: WallElem,
    *,
    endpoint_clearance_mm: float,
) -> dict[str, Any] | None:
    if isinstance(opening, WallOpeningElem):
        length = wall_length_mm(host)
        center_t = (opening.along_t_start + opening.along_t_end) / 2.0
        half_t = min(center_t, 1.0 - center_t) - endpoint_clearance_mm / max(length, 1.0)
        if half_t <= 0.005:
            return None
        return {
            "type": "updateWallOpening",
            "openingId": opening.id,
            "alongTStart": round(max(0.0, center_t - half_t), 6),
            "alongTEnd": round(min(1.0, center_t + half_t), 6),
        }
    length = wall_length_mm(host)
    center_t = opening.along_t
    half_t = min(center_t, 1.0 - center_t) - endpoint_clearance_mm / max(length, 1.0)
    if half_t <= 0.005:
        return None
    safe_width = math.floor(max(1.0, 2.0 * half_t * length))
    if safe_width >= opening.width_mm:
        return None
    return {"type": f"update{_kind_label(opening)}", "id": opening.id, "widthMm": safe_width}


def _element_label(elem: Any) -> str:
    return str(getattr(elem, "kind", "element")).replace("_", " ")


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
