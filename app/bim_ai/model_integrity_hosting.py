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
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    Element,
    FamilyInstanceElem,
    FamilyTypeElem,
    FloorElem,
    PlacedAssetElem,
    RailingElem,
    ReferencePlaneElem,
    RoofElem,
    StairElem,
    VoidCutElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)

Point2 = tuple[float, float]
Interval = tuple[float, float]

DEFAULT_ENDPOINT_CLEARANCE_MM = 75.0
DEFAULT_ENVELOPE_TOLERANCE_MM = 25.0
DEFAULT_SUPPORT_TOLERANCE_MM = 75.0

HOSTED_OPENING_RULE_IDS = {
    "physical_wall_outside_envelope",
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
    "hosted_void_cut_orphan",
    "physical_access_proxy_leakage",
    "physical_floor_outside_support_context",
    "physical_floor_invalid_support_context",
    "physical_stair_without_floor_landings",
    "physical_railing_missing_host_context",
    "physical_railing_invalid_host_context",
    "model_integrity_asset_placement_floating",
    "model_integrity_asset_placement_circulation_overlap",
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
    "floor": "floor_hosted",
    "floor-hosted": "floor_hosted",
    "floor_hosted": "floor_hosted",
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
    "floor_hosted": "floor-hosted",
    "ceiling_hosted": "ceiling-hosted",
    "workplane_hosted": "workplane-hosted",
    "freestanding": "freestanding",
}

_TRACKER_ITEMS_BY_RULE_ID = {
    "physical_wall_outside_envelope": ["BIR-B02", "BIR-C02"],
    "hosted_opening_missing_host": ["BIR-B01", "BIR-C01"],
    "hosted_opening_host_not_wall": ["BIR-B01", "BIR-C01"],
    "hosted_opening_helper_host": ["BIR-B01", "BIR-C01", "BIR-C05"],
    "hosted_opening_host_outside_floor_envelope": ["BIR-B01", "BIR-C02"],
    "hosted_opening_outside_usable_span": ["BIR-B01", "BIR-C03", "BIR-C06"],
    "hosted_opening_missing_semantic_cut": ["BIR-B01", "BIR-C04"],
    "hosted_opening_overlap": ["BIR-B01", "BIR-C06"],
    "hosted_family_missing_host": ["BIR-C07", "BIR-C08"],
    "hosted_family_unsupported_host_class": ["BIR-C07", "BIR-C08"],
    "hosted_render_proxy_orphan": ["BIR-C08"],
    "hosted_void_cut_orphan": ["BIR-C04", "BIR-C08"],
    "physical_access_proxy_leakage": ["BIR-B03", "BIR-C05", "BIR-C08"],
    "physical_floor_outside_support_context": ["BIR-B02", "BIR-E02"],
    "physical_floor_invalid_support_context": ["BIR-B02", "BIR-E02"],
    "physical_stair_without_floor_landings": ["BIR-B02", "BIR-E05"],
    "physical_railing_missing_host_context": ["BIR-B02", "BIR-E03"],
    "physical_railing_invalid_host_context": ["BIR-B02", "BIR-E03"],
    "model_integrity_asset_placement_floating": ["BIR-B02", "BIR-V04"],
    "model_integrity_asset_placement_circulation_overlap": ["BIR-B02", "BIR-E05", "BIR-V04"],
}

_RECOMMENDATION_BY_RULE_ID = {
    "hosted_opening_missing_semantic_cut": "Create or restore a valid wall cut for the hosted opening, or mark the element nonphysical before commit.",
    "hosted_opening_overlap": "Separate, resize, or merge the affected openings so their host-wall intervals no longer overlap.",
    "hosted_family_missing_host": "Rehost the family/asset to a valid support element or delete the orphan rendered proxy.",
    "hosted_family_unsupported_host_class": "Match the family support class to the host kind, or rehost the instance to a compatible wall, face, ceiling, or workplane.",
    "hosted_render_proxy_orphan": "Delete the orphan proxy or recreate the missing host relationship before rendering/export.",
    "hosted_void_cut_orphan": "Delete the orphan void cut or point it at an existing physical host before rendering/export.",
    "physical_access_proxy_leakage": "Keep helper/access/diagnostic elements out of physical render, schedule, and export paths.",
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
                    host_ids=[wall.id],
                )
            )
        if _is_physical_wall(wall) and not _wall_supported_by_level_floor(
            wall,
            floors_by_level,
            tolerance_mm=envelope_tolerance_mm,
        ):
            violations.append(
                _violation(
                    "physical_wall_outside_envelope",
                    "error",
                    (
                        f"Physical wall '{wall.id}' is outside the level floor/building "
                        "support context and is not marked with explicit detached intent."
                    ),
                    [wall.id],
                    host_ids=[wall.id],
                    quick_fix_command={
                        "type": "set_element_prop",
                        "elementId": wall.id,
                        "key": "allowDetached",
                        "value": True,
                    },
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
                    host_ids=[host_id],
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
                    host_ids=[host_id],
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
                    host_ids=[host.id],
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
                    host_ids=[host.id],
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
                    host_ids=[host.id],
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
                    host_ids=[host.id],
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
                    host_ids=[host.id],
                )
            )

    violations.extend(_overlap_violations(hosted, elements))
    violations.extend(_hosted_family_support_violations(elements))
    violations.extend(_orphan_void_cut_violations(elements))
    violations.extend(_helper_visual_leakage_violations(elements))
    return sorted(violations, key=lambda v: (v.rule_id, v.element_ids, v.message))


def physical_support_context_violations(
    doc_or_elements: Document | Mapping[str, Element],
    *,
    tolerance_mm: float = DEFAULT_SUPPORT_TOLERANCE_MM,
) -> list[Violation]:
    """Return deterministic support-context findings for non-wall physical elements."""

    elements = doc_or_elements.elements if isinstance(doc_or_elements, Document) else doc_or_elements
    violations: list[Violation] = []
    floors = sorted(
        (elem for elem in elements.values() if isinstance(elem, FloorElem)),
        key=lambda elem: str(elem.id),
    )
    levels = {elem.id: elem for elem in elements.values() if hasattr(elem, "elevation_mm")}

    for asset in sorted(
        (elem for elem in elements.values() if isinstance(elem, PlacedAssetElem)),
        key=lambda elem: str(elem.id),
    ):
        violations.extend(_placed_asset_support_context_violations(asset, elements, tolerance_mm))

    for floor in floors:
        violations.extend(
            _floor_support_context_violations(
                floor,
                floors,
                elements,
                levels,
                tolerance_mm=tolerance_mm,
            )
        )

    for stair in sorted(
        (elem for elem in elements.values() if isinstance(elem, StairElem)),
        key=lambda elem: str(elem.id),
    ):
        violations.extend(_stair_support_context_violations(stair, floors, elements, tolerance_mm))

    for railing in sorted(
        (elem for elem in elements.values() if isinstance(elem, RailingElem)),
        key=lambda elem: str(elem.id),
    ):
        violations.extend(_railing_support_context_violations(railing, elements, tolerance_mm))

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
            "hostIds": [host_id] if host_id else [],
            "supportClass": "wall_hosted",
            "trackerItems": sorted({"BIR-B01", "BIR-C06"}),
            "recommendation": "Keep hosted openings within a valid, non-overlapping host-wall interval and maintain a semantic/rendered wall cut.",
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
                        "hostIds": [host.id],
                        "trackerItems": sorted({"BIR-B01", "BIR-C03", "BIR-C06"}),
                        "recommendation": _recommendation_for_rule(
                            "hosted_opening_outside_usable_span"
                        ),
                        "safeFixHints": _safe_fix_hints_for_rule(
                            "hosted_opening_outside_usable_span",
                            _resize_to_usable_span_command(
                                opening,
                                host,
                                endpoint_clearance_mm=endpoint_clearance_mm,
                            ),
                        ),
                    }
                )
            elif min(start_t * length, (1.0 - end_t) * length) < endpoint_clearance_mm:
                edges.append(
                    {
                        "kind": "endpoint_clearance",
                        "hostWallId": host.id,
                        "elementIds": [str(opening.id), host.id],
                        "hostIds": [host.id],
                        "minimumClearanceMm": endpoint_clearance_mm,
                        "trackerItems": sorted({"BIR-B01", "BIR-C03", "BIR-C06"}),
                        "recommendation": _recommendation_for_rule(
                            "hosted_opening_outside_usable_span"
                        ),
                        "safeFixHints": _safe_fix_hints_for_rule(
                            "hosted_opening_outside_usable_span",
                            _resize_to_usable_span_command(
                                opening,
                                host,
                                endpoint_clearance_mm=endpoint_clearance_mm,
                            ),
                        ),
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
                        "hostIds": [host_id],
                        "overlapT": round(max(0.0, overlap_t), 6),
                        "trackerItems": sorted({"BIR-B01", "BIR-C06"}),
                        "recommendation": _recommendation_for_rule("hosted_opening_overlap"),
                        "safeFixHints": _safe_fix_hints_for_rule(
                            "hosted_opening_overlap",
                            None,
                        ),
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


def _placed_asset_support_context_violations(
    asset: PlacedAssetElem,
    elements: Mapping[str, Element],
    tolerance_mm: float,
) -> list[Violation]:
    if _has_detached_intent(asset):
        return []
    entry = elements.get(asset.asset_id)
    support = _placed_asset_support_class(asset, entry)
    if support not in {"freestanding", "floor_hosted", "level_hosted"}:
        return []

    violations: list[Violation] = []
    point = (asset.position_mm.x_mm, asset.position_mm.y_mm)
    if not _point_supported_by_level_floor(
        point,
        asset.level_id,
        elements,
        tolerance_mm=tolerance_mm,
    ):
        violations.append(
            _violation(
                "model_integrity_asset_placement_floating",
                "error",
                (
                    f"Placed asset '{asset.id}' has no floor support at its position on "
                    f"level '{asset.level_id}'. Move it onto a same-level floor footprint, "
                    "set an explicit host, or record intentional detached placement."
                ),
                [asset.id, asset.asset_id],
                quick_fix_command={
                    "type": "resolveAssetPlacementSupport",
                    "elementId": asset.id,
                    "safeFixes": ["move_inside_floor", "set_hostElementId", "mark_intentional_detached"],
                },
            )
        )

    overlap_id = _circulation_overlap_at_point(
        point,
        asset.level_id,
        elements,
        tolerance_mm=tolerance_mm,
    )
    if overlap_id is not None and not _asset_allows_circulation_overlap(asset):
        violations.append(
            _violation(
                "model_integrity_asset_placement_circulation_overlap",
                "error",
                (
                    f"Placed asset '{asset.id}' overlaps vertical circulation '{overlap_id}'. "
                    "Move it clear of stairs/ramps or set explicit circulation-overlap intent."
                ),
                [asset.id, asset.asset_id, overlap_id],
                quick_fix_command={
                    "type": "resolveAssetPlacementSupport",
                    "elementId": asset.id,
                    "conflictingElementId": overlap_id,
                    "safeFixes": ["move_clear_of_circulation", "mark_allowCirculationOverlap"],
                },
            )
        )
    return violations


def _floor_support_context_violations(
    floor: FloorElem,
    floors: list[FloorElem],
    elements: Mapping[str, Element],
    levels: Mapping[str, Element],
    *,
    tolerance_mm: float,
) -> list[Violation]:
    if _has_detached_intent(floor) or _floor_bool(floor, "isCantilever", "cantilever"):
        return []
    support_ids = _support_reference_ids(floor)
    if support_ids:
        missing = [element_id for element_id in support_ids if element_id not in elements]
        if missing:
            return [
                _violation(
                    "physical_floor_invalid_support_context",
                    "error",
                    (
                        f"Floor/slab '{floor.id}' declares support references that do not "
                        f"resolve: {', '.join(missing)}. Point support metadata at real walls, "
                        "columns, beams, or slabs."
                    ),
                    [floor.id, *missing],
                    quick_fix_command={
                        "type": "resolveFloorSupportContext",
                        "elementId": floor.id,
                        "missingSupportIds": missing,
                        "safeFixes": ["set_supportedByIds", "create_supports", "mark_allowDetached"],
                    },
                )
            ]
        return []

    elevated = _level_elevation_mm(levels.get(floor.level_id)) > 1.0
    detached_fragment = _is_smaller_same_level_slab_fragment(floor, floors) and not _floor_touches_context(
        floor,
        floors,
        elements,
        tolerance_mm=tolerance_mm,
    )
    if not elevated and not detached_fragment:
        return []
    if _floor_touches_context(floor, floors, elements, tolerance_mm=tolerance_mm):
        return []
    return [
        _violation(
            "physical_floor_outside_support_context",
            "error",
            (
                f"Floor/slab '{floor.id}' is outside supported building context. Add "
                "supportedByIds/supportIds, model bearing support, connect it to a same-level "
                "slab, or mark explicit detached/cantilever intent."
            ),
            [floor.id],
            quick_fix_command={
                "type": "set_element_prop",
                "elementId": floor.id,
                "key": "allowDetached",
                "value": True,
            },
        )
    ]


def _stair_support_context_violations(
    stair: StairElem,
    floors: list[FloorElem],
    elements: Mapping[str, Element],
    tolerance_mm: float,
) -> list[Violation]:
    if _has_detached_intent(stair):
        return []
    missing_landings: list[str] = []
    base_floor = _floor_at_point(floors, stair.base_level_id, stair.run_start, tolerance_mm)
    top_floor = _floor_at_point(floors, stair.top_level_id, stair.run_end, tolerance_mm)
    if base_floor is None:
        missing_landings.append("base")
    if top_floor is None:
        missing_landings.append("top")
    if not missing_landings:
        return []
    element_ids = [stair.id]
    if stair.base_level_id in elements:
        element_ids.append(stair.base_level_id)
    if stair.top_level_id in elements:
        element_ids.append(stair.top_level_id)
    return [
        _violation(
            "physical_stair_without_floor_landings",
            "error",
            (
                f"Stair '{stair.id}' is detached from floor support at its "
                f"{'/'.join(missing_landings)} landing. Move the endpoints onto floor "
                "footprints or add landing slabs/openings for the connected levels."
            ),
            element_ids,
            quick_fix_command={
                "type": "resolveStairLandingSupport",
                "elementId": stair.id,
                "missingLandings": missing_landings,
                "safeFixes": ["move_run_endpoint_to_floor", "create_landing_slab", "mark_allowDetached"],
            },
        )
    ]


def _railing_support_context_violations(
    railing: RailingElem,
    elements: Mapping[str, Element],
    tolerance_mm: float,
) -> list[Violation]:
    if _has_detached_intent(railing):
        return []
    host_ids = _railing_host_ids(railing)
    if not host_ids:
        return [
            _violation(
                "physical_railing_missing_host_context",
                "error",
                (
                    f"Railing '{railing.id}' has no explicit stair, floor, wall, or edge host. "
                    "Attach it to a supported stair/floor edge/wall or mark detached intent."
                ),
                [railing.id],
                quick_fix_command={
                    "type": "resolveRailingSupportContext",
                    "elementId": railing.id,
                    "safeFixes": ["set_hostedStairId", "set_hostFloorId", "set_hostWallId"],
                },
            )
        ]

    invalid = _invalid_railing_host_ids(railing, elements)
    if invalid:
        return [
            _violation(
                "physical_railing_invalid_host_context",
                "error",
                (
                    f"Railing '{railing.id}' references unsupported or missing host context "
                    f"{', '.join(invalid)}. Use existing stair/floor/wall hosts or a documented floor edge id."
                ),
                [railing.id, *invalid],
                quick_fix_command={
                    "type": "resolveRailingSupportContext",
                    "elementId": railing.id,
                    "invalidHostIds": invalid,
                    "safeFixes": ["set_valid_host", "delete_detached_railing", "mark_allowDetached"],
                },
            )
        ]

    if railing.host_floor_id:
        host = elements.get(railing.host_floor_id)
        if isinstance(host, FloorElem):
            polygon = _floor_polygon(host)
            off_floor = [
                index
                for index, point in enumerate(railing.path_mm)
                if not _point_in_or_near_polygon(
                    (point.x_mm, point.y_mm),
                    polygon,
                    tolerance_mm,
                )
            ]
            if off_floor:
                return [
                    _violation(
                        "physical_railing_invalid_host_context",
                        "error",
                        (
                            f"Railing '{railing.id}' has path vertices outside host floor "
                            f"'{host.id}'. Align the rail to the supported floor edge or rehost it."
                        ),
                        [railing.id, host.id],
                        quick_fix_command={
                            "type": "resolveRailingSupportContext",
                            "elementId": railing.id,
                            "hostFloorId": host.id,
                            "offFloorPathVertexIndexes": off_floor,
                            "safeFixes": ["align_path_to_floor_edge", "set_hostedStairId"],
                        },
                    )
                ]
    return []


def _violation(
    rule_id: str,
    severity: str,
    message: str,
    element_ids: list[str],
    *,
    quick_fix_command: dict[str, Any] | None = None,
    host_ids: list[str] | None = None,
    recommendation: str | None = None,
) -> Violation:
    affected_ids = sorted(dict.fromkeys(str(eid) for eid in element_ids if eid))
    normalized_host_ids = sorted(dict.fromkeys(str(eid) for eid in host_ids or [] if eid))
    fix_hints = _safe_fix_hints_for_rule(rule_id, quick_fix_command)
    return Violation(
        rule_id=rule_id,
        severity=severity,
        message=message,
        element_ids=affected_ids,
        blocking=severity == "error",
        quick_fix_command=quick_fix_command,
        discipline="architecture",
        blocking_class="model_integrity",
        trackerItems=list(_TRACKER_ITEMS_BY_RULE_ID.get(rule_id, ())),
        recommendation=recommendation or _recommendation_for_rule(rule_id),
        affectedElementIds=affected_ids,
        hostIds=normalized_host_ids,
        safeFixHints=fix_hints,
    )


def _hosted_openings(elements: Mapping[str, Element]) -> list[DoorElem | WindowElem | WallOpeningElem]:
    hosted = [
        elem
        for elem in elements.values()
        if isinstance(elem, DoorElem | WindowElem | WallOpeningElem)
    ]
    return sorted(hosted, key=lambda elem: str(elem.id))


def _recommendation_for_rule(rule_id: str) -> str:
    if rule_id in _RECOMMENDATION_BY_RULE_ID:
        return _RECOMMENDATION_BY_RULE_ID[rule_id]
    if rule_id.startswith("hosted_opening_"):
        return "Resolve the hosted opening relationship, wall-span interval, or host geometry before commit."
    if rule_id.startswith("physical_") or rule_id.startswith("model_integrity_"):
        return "Resolve the physical support context or record explicit detached/nonphysical intent."
    return "Inspect the affected BIM elements and resolve the deterministic integrity finding."


def _safe_fix_hints_for_rule(
    rule_id: str,
    quick_fix_command: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []
    if quick_fix_command is not None:
        hints.append(
            {
                "kind": "quick_fix_command",
                "safety": "review_required",
                "command": quick_fix_command,
            }
        )
    if rule_id in {
        "hosted_opening_missing_host",
        "hosted_opening_host_not_wall",
        "hosted_opening_helper_host",
        "hosted_family_missing_host",
        "hosted_family_unsupported_host_class",
        "hosted_render_proxy_orphan",
        "hosted_void_cut_orphan",
    }:
        hints.append({"kind": "rehost_or_delete", "safety": "needs_user_intent"})
        if rule_id.startswith("hosted_opening_"):
            hints.append({"kind": "set_valid_host_wall", "safety": "needs_user_intent"})
        elif rule_id.startswith("hosted_family_"):
            hints.append({"kind": "set_compatible_family_host", "safety": "needs_user_intent"})
    elif rule_id == "hosted_opening_missing_semantic_cut":
        hints.append({"kind": "restore_host_cut_or_mark_nonphysical", "safety": "review_required"})
        hints.append({"kind": "create_missing_wall_opening", "safety": "review_required"})
    elif rule_id == "hosted_opening_overlap":
        hints.append({"kind": "resize_reposition_or_merge_openings", "safety": "review_required"})
    elif rule_id == "hosted_opening_outside_usable_span":
        hints.append({"kind": "resize_or_reposition_opening", "safety": "review_required"})
    elif rule_id in {
        "physical_wall_outside_envelope",
        "hosted_opening_host_outside_floor_envelope",
    }:
        hints.append({"kind": "move_into_floor_envelope", "safety": "needs_user_intent"})
        hints.append({"kind": "create_missing_support_or_mark_detached", "safety": "review_required"})
    elif rule_id == "physical_access_proxy_leakage":
        hints.append({"kind": "convert_to_analysis_or_delete_helper", "safety": "review_required"})
    elif rule_id in {
        "physical_floor_outside_support_context",
        "physical_floor_invalid_support_context",
        "physical_stair_without_floor_landings",
        "physical_railing_missing_host_context",
        "physical_railing_invalid_host_context",
        "model_integrity_asset_placement_floating",
        "model_integrity_asset_placement_circulation_overlap",
    }:
        hints.append({"kind": "create_missing_support_or_rehost", "safety": "review_required"})
        hints.append({"kind": "mark_intentional_detached", "safety": "needs_user_intent"})
    return hints


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
    if _has_detached_intent(wall):
        return True
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
                host_ids=[host_id],
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
                    host_ids=[],
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
                    host_ids=[host_id],
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
                    host_ids=[host_id],
                    quick_fix_command=_safe_delete_command(elem),
                )
            )
            if _renders_as_hosted_proxy(elem, elements):
                violations.append(_orphan_render_proxy_violation(elem, host_id))
    return violations


def _orphan_void_cut_violations(elements: Mapping[str, Element]) -> list[Violation]:
    violations: list[Violation] = []
    for elem in sorted(elements.values(), key=lambda e: str(e.id)):
        if not isinstance(elem, VoidCutElem):
            continue
        host_id = str(elem.host_element_id)
        host = elements.get(host_id)
        if host is None:
            violations.append(
                _violation(
                    "hosted_void_cut_orphan",
                    "error",
                    (
                        f"Void cut '{elem.id}' references missing host '{host_id}', so rendered "
                        "cut geometry would leak without a physical host."
                    ),
                    [elem.id, host_id],
                    host_ids=[host_id],
                    quick_fix_command={"type": "deleteElement", "elementId": elem.id},
                )
            )
            continue
        if _is_visual_helper(host) or (
            isinstance(host, WallElem) and _is_helper_or_nonphysical_wall(host)
        ):
            violations.append(
                _violation(
                    "hosted_void_cut_orphan",
                    "error",
                    (
                        f"Void cut '{elem.id}' targets helper/nonphysical host '{host_id}'. "
                        "Cuts must resolve to physical BIM host geometry."
                    ),
                    [elem.id, host_id],
                    host_ids=[host_id],
                    quick_fix_command={"type": "deleteElement", "elementId": elem.id},
                )
            )
    return violations


def _helper_visual_leakage_violations(elements: Mapping[str, Element]) -> list[Violation]:
    violations: list[Violation] = []
    for elem in sorted(elements.values(), key=lambda e: str(e.id)):
        if isinstance(elem, WallElem | DoorElem | WindowElem | WallOpeningElem):
            continue
        if not _is_visual_helper(elem):
            continue
        if not _has_physical_render_or_export_marker(elem, elements):
            continue
        violations.append(
            _violation(
                "physical_access_proxy_leakage",
                "error",
                (
                    f"Helper/analysis element '{elem.id}' declares physical render/export "
                    "geometry; keep diagnostic helpers out of physical view, schedule, and "
                    "export paths."
                ),
                [str(elem.id)],
                quick_fix_command=_safe_delete_command(elem),
            )
        )
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
            raw_values.append(family_type.host_support)
            raw_values.extend(_support_values_from_mapping(family_type.parameters))
            if family_type.discipline in {"door", "window"}:
                raw_values.append("wall_hosted")
    elif isinstance(elem, PlacedAssetElem):
        asset = elements.get(elem.asset_id)
        raw_values.extend(_support_values_from_mapping(getattr(asset, "param_values", None)))
        if isinstance(asset, AssetLibraryEntryElem):
            raw_values.append(asset.placement_support)
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


def _placed_asset_support_class(asset: PlacedAssetElem, entry: Element | None) -> str:
    raw = _support_values_from_mapping(asset.param_values)
    raw.extend(_support_values_from_mapping(getattr(entry, "param_values", None)))
    placement_support = getattr(entry, "placement_support", None)
    if placement_support:
        raw.append(placement_support)
    if isinstance(entry, AssetLibraryEntryElem) and entry.category in {"door", "window"}:
        raw.append("wall_hosted")
    for value in raw:
        support = _normalize_support_class(value)
        if support is not None:
            return support
    return "freestanding"


def _point_supported_by_level_floor(
    point: Point2,
    level_id: str,
    elements: Mapping[str, Element],
    *,
    tolerance_mm: float,
) -> bool:
    floors = [
        elem
        for elem in elements.values()
        if isinstance(elem, FloorElem) and elem.level_id == level_id
    ]
    if not floors:
        return False
    return any(_point_in_or_near_polygon(point, _floor_polygon(floor), tolerance_mm) for floor in floors)


def _circulation_overlap_at_point(
    point: Point2,
    level_id: str,
    elements: Mapping[str, Element],
    *,
    tolerance_mm: float,
) -> str | None:
    for elem in sorted(elements.values(), key=lambda candidate: str(getattr(candidate, "id", ""))):
        if not isinstance(elem, StairElem):
            continue
        if level_id not in {elem.base_level_id, elem.top_level_id}:
            continue
        polygon = _stair_polygon(elem)
        if polygon and _point_in_or_near_polygon(point, polygon, tolerance_mm):
            return elem.id
    return None


def _asset_allows_circulation_overlap(asset: PlacedAssetElem) -> bool:
    values = [asset.param_values.get("allowCirculationOverlap"), asset.param_values.get("allowStairOverlap")]
    return any(_truthy(value) for value in values)


def _support_reference_ids(elem: Any) -> list[str]:
    props = getattr(elem, "props", None) or {}
    ids: list[str] = []
    for key in ("supportedByIds", "supportIds", "hostIds", "bearingElementIds"):
        value = props.get(key)
        if isinstance(value, str):
            ids.append(value)
        elif isinstance(value, list | tuple | set):
            ids.extend(str(item) for item in value if item)
    return sorted(dict.fromkeys(ids))


def _floor_bool(floor: FloorElem, *keys: str) -> bool:
    props = getattr(floor, "props", None) or {}
    return any(_truthy(props.get(key)) for key in keys)


def _level_elevation_mm(level: Element | None) -> float:
    elevation = getattr(level, "elevation_mm", 0.0)
    try:
        return float(elevation)
    except (TypeError, ValueError):
        return 0.0


def _is_smaller_same_level_slab_fragment(floor: FloorElem, floors: list[FloorElem]) -> bool:
    same_level = [other for other in floors if other.level_id == floor.level_id]
    if len(same_level) < 2:
        return False
    largest_area = max(_polygon_area_abs(_floor_polygon(other)) for other in same_level)
    return _polygon_area_abs(_floor_polygon(floor)) < largest_area - 1.0


def _floor_touches_context(
    floor: FloorElem,
    floors: list[FloorElem],
    elements: Mapping[str, Element],
    *,
    tolerance_mm: float,
) -> bool:
    polygon = _floor_polygon(floor)
    for other in floors:
        if other.id == floor.id or other.level_id != floor.level_id:
            continue
        if _polygons_touch_or_overlap(polygon, _floor_polygon(other), tolerance_mm):
            return True
    for elem in elements.values():
        if isinstance(elem, WallElem) and elem.level_id == floor.level_id:
            if _point_in_or_near_polygon((elem.start.x_mm, elem.start.y_mm), polygon, tolerance_mm):
                return True
            if _point_in_or_near_polygon((elem.end.x_mm, elem.end.y_mm), polygon, tolerance_mm):
                return True
        if isinstance(elem, ColumnElem) and elem.level_id == floor.level_id:
            if _point_in_or_near_polygon(
                (elem.position_mm.x_mm, elem.position_mm.y_mm),
                polygon,
                tolerance_mm,
            ):
                return True
        if isinstance(elem, BeamElem) and getattr(elem, "level_id", None) == floor.level_id:
            start = getattr(elem, "start_mm", None)
            end = getattr(elem, "end_mm", None)
            if start is not None and _point_in_or_near_polygon((start.x_mm, start.y_mm), polygon, tolerance_mm):
                return True
            if end is not None and _point_in_or_near_polygon((end.x_mm, end.y_mm), polygon, tolerance_mm):
                return True
    return False


def _floor_at_point(
    floors: list[FloorElem],
    level_id: str,
    point: Any,
    tolerance_mm: float,
) -> FloorElem | None:
    for floor in sorted(floors, key=lambda candidate: candidate.id):
        if floor.level_id != level_id:
            continue
        if _point_in_or_near_polygon((point.x_mm, point.y_mm), _floor_polygon(floor), tolerance_mm):
            return floor
    return None


def _railing_host_ids(railing: RailingElem) -> list[str]:
    ids: list[str] = []
    for value in (
        railing.hosted_stair_id,
        railing.host_floor_id,
        railing.host_wall_id,
        railing.host_edge_id,
    ):
        if value:
            ids.append(value)
    props = getattr(railing, "props", None) or {}
    for key in ("hostedStairId", "hostFloorId", "hostWallId", "hostEdgeId", "hostIds"):
        value = props.get(key)
        if isinstance(value, str):
            ids.append(value)
        elif isinstance(value, list | tuple | set):
            ids.extend(str(item) for item in value if item)
    return sorted(dict.fromkeys(ids))


def _invalid_railing_host_ids(railing: RailingElem, elements: Mapping[str, Element]) -> list[str]:
    invalid: list[str] = []
    if railing.hosted_stair_id and not isinstance(elements.get(railing.hosted_stair_id), StairElem):
        invalid.append(railing.hosted_stair_id)
    if railing.host_floor_id and not isinstance(elements.get(railing.host_floor_id), FloorElem):
        invalid.append(railing.host_floor_id)
    if railing.host_wall_id and not isinstance(elements.get(railing.host_wall_id), WallElem):
        invalid.append(railing.host_wall_id)
    if railing.host_edge_id and not _railing_edge_host_resolves(railing.host_edge_id, elements):
        invalid.append(railing.host_edge_id)
    return sorted(dict.fromkeys(invalid))


def _railing_edge_host_resolves(edge_id: str, elements: Mapping[str, Element]) -> bool:
    if edge_id in elements:
        return True
    if ":edge:" not in edge_id:
        return False
    host_id = edge_id.split(":edge:", 1)[0]
    return isinstance(elements.get(host_id), FloorElem | StairElem | WallElem)


def _floor_polygon(floor: FloorElem) -> list[Point2]:
    return [(point.x_mm, point.y_mm) for point in floor.boundary_mm]


def _stair_polygon(stair: StairElem) -> list[Point2]:
    if stair.boundary_mm and len(stair.boundary_mm) >= 3:
        return [(point.x_mm, point.y_mm) for point in stair.boundary_mm]
    sx, sy = stair.run_start.x_mm, stair.run_start.y_mm
    ex, ey = stair.run_end.x_mm, stair.run_end.y_mm
    dx = ex - sx
    dy = ey - sy
    length = math.hypot(dx, dy)
    if length <= 1e-9:
        half = max(250.0, stair.width_mm / 2.0)
        return [(sx - half, sy - half), (sx + half, sy - half), (sx + half, sy + half), (sx - half, sy + half)]
    nx = -dy / length
    ny = dx / length
    half = stair.width_mm / 2.0
    return [
        (sx + nx * half, sy + ny * half),
        (ex + nx * half, ey + ny * half),
        (ex - nx * half, ey - ny * half),
        (sx - nx * half, sy - ny * half),
    ]


def _polygons_touch_or_overlap(a: list[Point2], b: list[Point2], tolerance_mm: float) -> bool:
    if len(a) < 3 or len(b) < 3:
        return False
    if any(_point_in_or_near_polygon(point, b, tolerance_mm) for point in a):
        return True
    if any(_point_in_or_near_polygon(point, a, tolerance_mm) for point in b):
        return True
    for i in range(len(a)):
        a0 = a[i]
        a1 = a[(i + 1) % len(a)]
        for j in range(len(b)):
            b0 = b[j]
            b1 = b[(j + 1) % len(b)]
            if _segments_intersect(a0, a1, b0, b1):
                return True
            if (
                _point_to_segment_distance_mm(a0, b0, b1) <= tolerance_mm
                or _point_to_segment_distance_mm(a1, b0, b1) <= tolerance_mm
                or _point_to_segment_distance_mm(b0, a0, a1) <= tolerance_mm
                or _point_to_segment_distance_mm(b1, a0, a1) <= tolerance_mm
            ):
                return True
    return False


def _polygon_area_abs(polygon: list[Point2]) -> float:
    if len(polygon) < 3:
        return 0.0
    area = 0.0
    for index, (x0, y0) in enumerate(polygon):
        x1, y1 = polygon[(index + 1) % len(polygon)]
        area += x0 * y1 - x1 * y0
    return abs(area) / 2.0


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
        host_ids=[host_id] if host_id else [],
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
    params = getattr(elem, "param_values", None) or {}
    if (
        _is_access_proxy(elem)
        or _truthy(props.get("repairSafeDelete"))
        or _truthy(params.get("repairSafeDelete"))
    ):
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


def _has_detached_intent(elem: Any) -> bool:
    props = getattr(elem, "props", None) or {}
    param_values = getattr(elem, "param_values", None) or {}
    if (
        _truthy(props.get("allowDetached"))
        or _truthy(props.get("allow_detached"))
        or _truthy(param_values.get("allowDetached"))
        or _truthy(param_values.get("allow_detached"))
        or _truthy(getattr(elem, "allow_detached", False))
    ):
        return True
    intent = str(
        props.get("authoringIntent")
        or props.get("authoring_intent")
        or props.get("intent")
        or param_values.get("authoringIntent")
        or param_values.get("authoring_intent")
        or getattr(elem, "authoring_intent", "")
        or "",
    ).strip().lower()
    return intent in {"detached", "intentional_detached", "detached_study", "exterior_detached"}


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


def _is_visual_helper(elem: Any) -> bool:
    if _is_access_proxy(elem):
        return True
    params = getattr(elem, "param_values", None) or {}
    return (
        _truthy(params.get("accessProxy"))
        or _truthy(params.get("helper"))
        or _truthy(params.get("analysisOnly"))
        or _truthy(params.get("nonPhysical"))
        or str(params.get("role", "")).lower()
        in {"access_proxy", "helper", "room_graph", "analysis", "diagnostic"}
    )


def _has_physical_render_or_export_marker(elem: Any, elements: Mapping[str, Element]) -> bool:
    props = getattr(elem, "props", None) or {}
    params = getattr(elem, "param_values", None) or {}
    marker_keys = {
        "renderProxy",
        "renderProxyKind",
        "rendererProxy",
        "proxyGeometry",
        "visualGeometry",
        "gltfMapping",
        "ifcMapping",
        "exportAsPhysical",
        "scheduleAsPhysical",
        "visibleIn3d",
        "visibleIn3D",
    }
    if any(key in props or key in params for key in marker_keys):
        return True
    if isinstance(elem, FamilyInstanceElem):
        family_type = elements.get(elem.family_type_id)
        return any(
            bool(getattr(family_type, attr, None))
            for attr in ("render_support", "export_support", "visual_geometry", "gltf_mapping", "ifc_mapping")
        )
    if isinstance(elem, PlacedAssetElem):
        asset = elements.get(elem.asset_id)
        return any(
            bool(getattr(asset, attr, None))
            for attr in ("render_proxy_kind", "render_support", "export_metadata", "gltf_mapping", "ifc_mapping")
        )
    return False


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
