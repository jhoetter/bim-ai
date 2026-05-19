from __future__ import annotations

from collections.abc import Mapping
from typing import Any

Finding = dict[str, Any]

_ENVELOPE_ZONE_KINDS = {"envelope_zone", "envelopeZone"}
_OPENING_KINDS = {"door", "window", "wall_opening", "opening"}
_OCCUPIED_EXTERIOR_SPACE_TYPES = {"terrace", "roof_terrace", "loggia", "balcony"}
_LARGE_ROOF_VOID_AREA_RATIO = 0.25
_PROFILE_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "strict": ("layers", "thermal", "fire", "acoustic"),
    "permit_readiness": ("thermal", "fire"),
    "construction_readiness": ("layers", "thermal", "fire", "acoustic"),
}


def check_envelope_integrity(
    model_or_elements: Any,
    *,
    profile: str = "baseline",
) -> list[Finding]:
    """Return deterministic envelope/loggia/facade metadata findings.

    This checker intentionally consumes declared metadata only. It does not infer
    visual quality from sketches or judge facade composition unless a model
    element declares the expected rhythm/relationship metadata.
    """

    elements = _elements_from(model_or_elements)
    findings: list[Finding] = []

    findings.extend(_check_envelope_zones(elements))
    findings.extend(_check_roof_openings(elements))
    findings.extend(_check_occupied_exterior_spaces(elements))
    findings.extend(_check_loggias(elements))
    findings.extend(_check_facade_rhythm(elements))
    findings.extend(_check_roof_wall_relationships(elements))
    findings.extend(_check_performance_metadata(elements, profile=profile))

    return sorted(
        findings,
        key=lambda f: (str(f["ruleId"]), tuple(f["elementIds"]), str(f["code"])),
    )


def _check_envelope_zones(elements: Mapping[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    exterior_wall_ids_by_level: dict[str, set[str]] = {}
    roofs_by_level: dict[str, set[str]] = {}
    floors_by_level: dict[str, set[str]] = {}

    for element_id, element in elements.items():
        kind = _kind(element)
        level_id = _level_id(element)
        if not level_id:
            continue
        if kind == "wall" and _is_envelope_role(element, "exterior_wall"):
            exterior_wall_ids_by_level.setdefault(level_id, set()).add(element_id)
        elif kind == "roof" and _is_envelope_role(element, "roof"):
            roofs_by_level.setdefault(level_id, set()).add(element_id)
        elif kind == "floor" and _is_envelope_role(element, "floor"):
            floors_by_level.setdefault(level_id, set()).add(element_id)

    for zone_id, zone in elements.items():
        if _kind(zone) not in _ENVELOPE_ZONE_KINDS:
            continue
        level_id = _level_id(zone)
        unresolved = _as_str_list(_value(zone, "unresolvedGapIds", "unresolved_gap_ids"))
        unresolved += _as_str_list(_value(zone, "unresolvedHoleIds", "unresolved_hole_ids"))
        if unresolved:
            findings.append(
                _finding(
                    "bir_f03_unresolved_envelope_gap",
                    "unresolved_envelope_gap",
                    "error",
                    "high",
                    [zone_id, *unresolved],
                    "Resolve or explicitly classify declared envelope holes/gaps.",
                )
            )

        required_ids = _as_str_list(_value(zone, "requiredElementIds", "required_element_ids"))
        missing = [element_id for element_id in required_ids if element_id not in elements]
        if missing:
            findings.append(
                _finding(
                    "bir_f03_envelope_zone_missing_element",
                    "envelope_zone_missing_element",
                    "error",
                    "high",
                    [zone_id, *missing],
                    "Create the missing envelope element or remove it from the zone declaration.",
                )
            )

        if not level_id:
            continue
        zone_ids = set(required_ids)
        has_wall = bool(zone_ids & exterior_wall_ids_by_level.get(level_id, set()))
        has_roof = bool(zone_ids & roofs_by_level.get(level_id, set()))
        has_floor = bool(zone_ids & floors_by_level.get(level_id, set()))
        if required_ids and not (has_wall and (has_roof or has_floor)):
            findings.append(
                _finding(
                    "bir_f03_incoherent_envelope_zone",
                    "incoherent_envelope_zone",
                    "warning",
                    "medium",
                    [zone_id, *required_ids],
                    "Declare exterior walls plus a roof or floor boundary for the level zone.",
                )
            )

    for element_id, opening in elements.items():
        if _kind(opening) not in _OPENING_KINDS or not _is_envelope_role(opening, "opening"):
            continue
        host_id = _host_wall_id(opening)
        host = elements.get(host_id or "")
        if not host_id or not host or not _is_envelope_role(host, "exterior_wall"):
            findings.append(
                _finding(
                    "bir_f03_envelope_opening_host_missing",
                    "envelope_opening_host_missing",
                    "error",
                    "high",
                    [element_id] + ([host_id] if host_id else []),
                    "Host envelope openings on a declared exterior wall.",
                )
            )

    return findings


def _check_roof_openings(elements: Mapping[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for element_id, opening in elements.items():
        if _kind(opening) != "roof_opening":
            continue

        host_id = _host_roof_id(opening)
        host = elements.get(host_id or "")
        if not host_id or _kind(host) != "roof":
            findings.append(
                _finding(
                    "bir_f01_roof_opening_host_missing",
                    "roof_opening_host_missing",
                    "error",
                    "critical",
                    [element_id] + ([host_id] if host_id else []),
                    "Host roof openings on an existing roof.",
                )
            )
            continue

        boundary = _polygon_from(_value(opening, "boundaryMm", "boundary_mm"))
        footprint = _polygon_from(_value(host, "footprintMm", "footprint_mm"))
        if len(boundary) < 3 or len(footprint) < 3:
            findings.append(
                _finding(
                    "bir_f01_roof_opening_footprint_invalid",
                    "roof_opening_footprint_invalid",
                    "error",
                    "critical",
                    [element_id, host_id],
                    "Provide valid host roof and opening polygons before accepting roof void evidence.",
                    hostFootprintVertexCount=len(footprint),
                    openingBoundaryVertexCount=len(boundary),
                )
            )
        elif any(not _point_in_polygon_or_on_edge(point, footprint) for point in boundary):
            findings.append(
                _finding(
                    "bir_f01_roof_opening_outside_host_footprint",
                    "roof_opening_outside_host_footprint",
                    "error",
                    "critical",
                    [element_id, host_id],
                    "Move the roof opening fully inside the host roof footprint.",
                )
            )
        else:
            opening_area = abs(_polygon_area(boundary))
            host_area = abs(_polygon_area(footprint))
            if (
                host_area > 1.0
                and opening_area / host_area >= _LARGE_ROOF_VOID_AREA_RATIO
                and not _truthy_field(
                    opening,
                    "largeVoidIntent",
                    "largeVoidMetadata",
                    "largeVoidSupportIntent",
                    "structuralTrimIntent",
                )
            ):
                findings.append(
                    _finding(
                        "bir_f01_large_roof_opening_metadata_missing",
                        "large_roof_opening_metadata_missing",
                        "error",
                        "critical",
                        [element_id, host_id],
                        "Large roof openings require explicit void/support intent before acceptance.",
                        openingAreaRatio=round(opening_area / host_area, 6),
                    )
                )

        if not _is_occupied_roof_void(opening):
            continue
        missing = _missing_occupied_roof_void_evidence(opening, elements)
        if missing:
            findings.append(
                _finding(
                    "bir_f02_occupied_roof_void_evidence_missing",
                    "occupied_roof_void_evidence_missing",
                    "error",
                    "critical",
                    [element_id, host_id],
                    "Declare real occupied roof void evidence: cut, floor, returns/curbs, guard, access, drainage, support, and evidence view.",
                    missing=missing,
                )
            )
    return findings


def _check_occupied_exterior_spaces(elements: Mapping[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for element_id, floor in elements.items():
        if _kind(floor) != "floor":
            continue
        props = _props(floor)
        space_type = str(_pick(props, "exteriorSpaceType", "exterior_space_type") or "").lower()
        if space_type not in _OCCUPIED_EXTERIOR_SPACE_TYPES:
            continue
        missing: list[str] = []
        if not _has_existing_ref(
            floor, elements, "guardId", "guardIds", "guardrailId", "guardrailIds"
        ):
            missing.append("guard")
        if not _has_existing_ref(
            floor, elements, "accessOpeningId", "accessOpeningIds", "accessElementIds"
        ):
            missing.append("access")
        if not _truthy_field(floor, "drainageIntent", "drainage", "drainageSlopePercent"):
            missing.append("drainage")
        if not (
            _has_existing_ref(floor, elements, "supportedByIds", "supportIds", "hostIds")
            or _truthy_field(floor, "supportIntent", "cantileverSupportIntent")
        ):
            missing.append("support")
        if missing:
            findings.append(
                _finding(
                    "bir_f04_occupied_exterior_space_relation_incomplete",
                    "occupied_exterior_space_relation_incomplete",
                    "error",
                    "high",
                    [element_id],
                    "Terrace, balcony, and loggia floors require guard, access, drainage, and support evidence.",
                    missing=missing,
                )
            )

        contained_by = _pick(props, "containedByFloorId", "contained_by_floor_id")
        if contained_by:
            host = elements.get(str(contained_by))
            boundary = _polygon_from(_value(floor, "boundaryMm", "boundary_mm"))
            host_boundary = _polygon_from(_value(host, "boundaryMm", "boundary_mm"))
            if _kind(host) != "floor" or len(boundary) < 3 or len(host_boundary) < 3:
                findings.append(
                    _finding(
                        "bir_f04_occupied_exterior_space_containment_invalid",
                        "occupied_exterior_space_containment_invalid",
                        "error",
                        "high",
                        [element_id, str(contained_by)],
                        "Reference a real host floor boundary for contained terrace/loggia space metadata.",
                    )
                )
            elif any(not _point_in_polygon_or_on_edge(point, host_boundary) for point in boundary):
                findings.append(
                    _finding(
                        "bir_f04_occupied_exterior_space_containment_invalid",
                        "occupied_exterior_space_containment_invalid",
                        "error",
                        "high",
                        [element_id, str(contained_by)],
                        "Keep contained terrace/loggia floor geometry inside the declared host floor boundary, or model it as an explicit exterior extension with support.",
                    )
                )
    return findings


def _check_loggias(elements: Mapping[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for element_id, element in elements.items():
        if not _is_loggia(element):
            continue
        props = _props(element)
        missing: list[str] = []
        side_return_ids = _as_str_list(_pick(props, "sideReturnIds", "side_return_ids"))
        existing_side_return_ids = [
            side_return_id for side_return_id in side_return_ids if side_return_id in elements
        ]
        if len(existing_side_return_ids) < 2:
            missing.append("sideReturnIds")
        for field in (
            "topReturnId",
            "bottomReturnId",
            "guardId",
            "accessOpeningId",
            "floorId",
            "ceilingId",
        ):
            ref_id = _pick(props, field, _snake(field))
            if not ref_id or str(ref_id) not in elements:
                missing.append(field)
        if missing:
            findings.append(
                _finding(
                    "bir_f04_loggia_relation_incomplete",
                    "loggia_relation_incomplete",
                    "error",
                    "high",
                    [element_id],
                    "Declare loggia side/top/bottom returns, guard, access, floor, and ceiling.",
                    missing=missing,
                )
            )
    return findings


def _check_facade_rhythm(elements: Mapping[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for element_id, element in elements.items():
        rhythm = _pick(_props(element), "facadeRhythm", "facade_rhythm")
        if not isinstance(rhythm, Mapping):
            continue
        expected = _pick(rhythm, "bayCount", "bay_count")
        if expected is None:
            continue
        try:
            expected_count = int(expected)
        except (TypeError, ValueError):
            findings.append(
                _finding(
                    "bir_f05_facade_rhythm_count_invalid",
                    "facade_rhythm_count_invalid",
                    "warning",
                    "medium",
                    [element_id],
                    "Declare facade bayCount as an integer when facade rhythm metadata is used.",
                    expected=str(expected),
                )
            )
            continue
        bay_ids = _as_str_list(_pick(rhythm, "bayIds", "bay_ids"))
        opening_ids = _as_str_list(_pick(rhythm, "openingIds", "opening_ids"))
        actual = len(bay_ids or opening_ids)
        if actual != expected_count:
            findings.append(
                _finding(
                    "bir_f05_facade_rhythm_mismatch",
                    "facade_rhythm_mismatch",
                    "warning",
                    "medium",
                    [element_id, *(bay_ids or opening_ids)],
                    "Update declared facade bay count or the referenced bay/opening metadata.",
                    expected=str(expected),
                    actual=str(actual),
                )
            )
        missing_openings = [
            opening_id
            for opening_id in opening_ids
            if _kind(elements.get(opening_id)) not in _OPENING_KINDS
        ]
        if missing_openings:
            findings.append(
                _finding(
                    "bir_f05_facade_opening_reference_missing",
                    "facade_opening_reference_missing",
                    "error",
                    "high",
                    [element_id, *missing_openings],
                    "Point declared facade rhythm openingIds at real door/window/opening elements.",
                )
            )
        attachment_mismatches = [
            opening_id
            for opening_id in opening_ids
            if opening_id in elements and _host_wall_id(elements[opening_id]) != element_id
        ]
        if attachment_mismatches:
            findings.append(
                _finding(
                    "bir_f05_facade_opening_attachment_mismatch",
                    "facade_opening_attachment_mismatch",
                    "error",
                    "high",
                    [element_id, *attachment_mismatches],
                    "Attach declared facade rhythm openings to the facade wall they are mapped under.",
                )
            )
        requires_glazing_support = bool(
            _pick(rhythm, "requiresGlazingSupport", "requires_glazing_support")
        )
        support_ids = _as_str_list(_pick(rhythm, "glazingSupportIds", "glazing_support_ids"))
        missing_supports = [support_id for support_id in support_ids if support_id not in elements]
        if requires_glazing_support and not support_ids:
            findings.append(
                _finding(
                    "bir_f05_facade_glazing_support_missing",
                    "facade_glazing_support_missing",
                    "error",
                    "high",
                    [element_id],
                    "Declare mullion, frame, wall, beam, or other support ids for facade glazing that requires support.",
                )
            )
        elif missing_supports:
            findings.append(
                _finding(
                    "bir_f05_facade_glazing_support_missing",
                    "facade_glazing_support_missing",
                    "error",
                    "high",
                    [element_id, *missing_supports],
                    "Point declared facade glazing support ids at existing support elements.",
                )
            )
    return findings


def _check_roof_wall_relationships(elements: Mapping[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for element_id, element in elements.items():
        kind = _kind(element)
        if kind == "wall" and _is_envelope_role(element, "exterior_wall"):
            roof_id = _value(element, "roofAttachmentId", "roof_attachment_id")
            if roof_id and str(roof_id) not in elements:
                findings.append(
                    _finding(
                        "bir_f06_wall_roof_attachment_missing",
                        "wall_roof_attachment_missing",
                        "error",
                        "high",
                        [element_id, str(roof_id)],
                        "Attach the exterior wall top constraint to an existing roof.",
                    )
                )
        if kind != "roof":
            continue
        props = _props(element)
        requires_wrapper = bool(_pick(props, "requiresWrapperRelationship"))
        attached_wall_ids = _as_str_list(_pick(props, "attachedWallIds", "attached_wall_ids"))
        if requires_wrapper and not attached_wall_ids:
            findings.append(
                _finding(
                    "bir_f06_roof_wrapper_relationship_missing",
                    "roof_wrapper_relationship_missing",
                    "error",
                    "high",
                    [element_id],
                    "Declare which exterior walls the roof wraps or bears on.",
                )
            )
        missing_wall_ids = [wall_id for wall_id in attached_wall_ids if wall_id not in elements]
        if missing_wall_ids:
            findings.append(
                _finding(
                    "bir_f06_roof_attached_wall_reference_missing",
                    "roof_attached_wall_reference_missing",
                    "error",
                    "high",
                    [element_id, *missing_wall_ids],
                    "Point roof attachedWallIds at existing exterior wall elements.",
                )
            )
        overhang = _value(element, "overhangMm", "overhang_mm")
        semantics = _pick(props, "overhangSemantics", "overhang_semantics")
        overhang_mm = _float_or_none(overhang)
        if overhang_mm is not None and overhang_mm > 0 and not semantics:
            findings.append(
                _finding(
                    "bir_f06_roof_overhang_semantics_missing",
                    "roof_overhang_semantics_missing",
                    "warning",
                    "medium",
                    [element_id],
                    "Declare overhang semantics such as eave, rake, canopy, or none.",
                )
            )
    return findings


def _check_performance_metadata(elements: Mapping[str, Any], *, profile: str) -> list[Finding]:
    required = _PROFILE_REQUIREMENTS.get(profile, ())
    if not required:
        return []
    findings: list[Finding] = []
    for element_id, element in elements.items():
        kind = _kind(element)
        if kind not in {"wall", "roof", "floor", "slab", "door", "window", "wall_opening"}:
            continue
        if not any(_is_envelope_role(element, role) for role in ("exterior_wall", "roof", "floor", "opening")):
            continue
        requirements = [
            name
            for name in required
            if name != "layers" or kind in {"wall", "roof", "floor", "slab"}
        ]
        missing = [name for name in requirements if not _has_performance_metadata(element, name)]
        if missing:
            findings.append(
                _finding(
                    "bir_f07_performance_metadata_missing",
                    "performance_metadata_missing",
                    "warning",
                    "medium",
                    [element_id],
                    f"Add {', '.join(missing)} placeholder metadata for profile '{profile}'.",
                    missing=missing,
                )
            )
    return findings


def _finding(
    rule_id: str,
    code: str,
    severity: str,
    priority: str,
    element_ids: list[str],
    recommendation: str,
    **extra: Any,
) -> Finding:
    payload: Finding = {
        "ruleId": rule_id,
        "code": code,
        "severity": severity,
        "priority": priority,
        "discipline": "architecture",
        "perspective": "envelope",
        "elementIds": [str(element_id) for element_id in element_ids if element_id],
        "recommendation": recommendation,
        "trackerItems": _tracker_items_for_rule(rule_id),
    }
    payload.update({key: value for key, value in extra.items() if value not in (None, [], "")})
    return payload


def _elements_from(model_or_elements: Any) -> dict[str, Any]:
    raw = getattr(model_or_elements, "elements", model_or_elements)
    if not isinstance(raw, Mapping):
        return {}
    return {str(key): value for key, value in raw.items()}


def _kind(element: Any) -> str:
    return str(_value(element, "kind") or "")


def _props(element: Any) -> Mapping[str, Any]:
    props = _value(element, "props")
    return props if isinstance(props, Mapping) else {}


def _value(element: Any, *names: str) -> Any:
    for name in names:
        if isinstance(element, Mapping) and name in element:
            return element[name]
        if not isinstance(element, Mapping) and hasattr(element, name):
            return getattr(element, name)
    return None


def _pick(mapping: Mapping[str, Any], *names: str) -> Any:
    for name in names:
        if name in mapping:
            return mapping[name]
    return None


def _level_id(element: Any) -> str | None:
    value = _value(element, "levelId", "level_id", "referenceLevelId", "reference_level_id")
    return str(value) if value else None


def _host_wall_id(element: Any) -> str | None:
    value = _value(element, "wallId", "wall_id", "hostWallId", "host_wall_id")
    return str(value) if value else None


def _host_roof_id(element: Any) -> str | None:
    value = _value(element, "hostRoofId", "host_roof_id")
    return str(value) if value else None


def _is_envelope_role(element: Any, role: str) -> bool:
    props = _props(element)
    declared = _pick(props, "envelopeRole", "envelope_role")
    if declared == role:
        return True
    if role == "exterior_wall":
        return bool(_pick(props, "isExterior", "is_exterior", "primaryEnvelope"))
    if role == "roof":
        return bool(_pick(props, "primaryEnvelope", "isEnvelopeRoof"))
    if role == "floor":
        return bool(_pick(props, "primaryEnvelope", "isEnvelopeFloor"))
    if role == "opening":
        return bool(_pick(props, "envelopeOpening", "isEnvelopeOpening"))
    return False


def _is_loggia(element: Any) -> bool:
    props = _props(element)
    return _kind(element) in {"balcony", "loggia"} and bool(
        _pick(props, "isLoggia", "loggia") or _pick(props, "featureType") == "loggia"
    )


def _is_occupied_roof_void(element: Any) -> bool:
    props = _props(element)
    if _pick(props, "occupiedRoofVoid", "occupiedTerrace", "isOccupiedRoofVoid"):
        return True
    space_type = str(
        _pick(props, "spaceType", "exteriorSpaceType", "featureKind") or ""
    ).lower()
    return space_type in {"terrace", "roof_terrace", "roof_court", "loggia", "occupied_void"}


def _missing_occupied_roof_void_evidence(
    opening: Any,
    elements: Mapping[str, Any],
) -> list[str]:
    evidence = _evidence_mapping(opening)
    missing: list[str] = []
    if not _truthy_field(opening, "cut", "renderedCut", "cutEvidence", source=evidence):
        missing.append("cut")
    if not _has_existing_ref(
        opening,
        elements,
        "occupiedFloorId",
        "terraceFloorId",
        "floorId",
        source=evidence,
        allowed_kinds={"floor"},
    ):
        missing.append("occupiedFloorId")
    if not _has_existing_ref(
        opening,
        elements,
        "returnIds",
        "curbIds",
        "parapetIds",
        source=evidence,
        min_count=2,
    ):
        missing.append("returnIds")
    if not _has_existing_ref(
        opening,
        elements,
        "guardId",
        "guardIds",
        "guardrailId",
        "guardrailIds",
        source=evidence,
    ):
        missing.append("guardId")
    if not _has_existing_ref(
        opening,
        elements,
        "accessOpeningId",
        "accessOpeningIds",
        "accessElementIds",
        source=evidence,
        allowed_kinds=_OPENING_KINDS,
    ):
        missing.append("accessOpeningId")
    if not _truthy_field(
        opening, "drainage", "drainageIntent", "drainageSlopePercent", source=evidence
    ):
        missing.append("drainage")
    if not (
        _has_existing_ref(opening, elements, "supportedByIds", "supportIds", source=evidence)
        or _truthy_field(opening, "support", "supportIntent", source=evidence)
    ):
        missing.append("support")
    if not _truthy_field(opening, "evidenceView", "evidenceViewId", source=evidence):
        missing.append("evidenceView")
    return missing


def _evidence_mapping(element: Any) -> Mapping[str, Any]:
    props = _props(element)
    for key in (
        "occupiedVoidEvidence",
        "occupied_void_evidence",
        "roofOpeningRenderSupport",
        "roof_opening_render_support",
        "renderSupport",
        "rendererSupport",
    ):
        value = _pick(props, key)
        if isinstance(value, Mapping):
            return value
    return {}


def _truthy_field(element: Any, *names: str, source: Mapping[str, Any] | None = None) -> bool:
    props = _props(element)
    for name in names:
        value = _pick(source or {}, name, _snake(name))
        if value:
            return True
        value = _value(element, name, _snake(name))
        if value:
            return True
        value = _pick(props, name, _snake(name))
        if value:
            return True
    return False


def _has_existing_ref(
    element: Any,
    elements: Mapping[str, Any],
    *names: str,
    source: Mapping[str, Any] | None = None,
    allowed_kinds: set[str] | None = None,
    min_count: int = 1,
) -> bool:
    props = _props(element)
    refs: list[str] = []
    for name in names:
        refs.extend(_as_str_list(_pick(source or {}, name, _snake(name))))
        refs.extend(_as_str_list(_value(element, name, _snake(name))))
        refs.extend(_as_str_list(_pick(props, name, _snake(name))))
    refs = sorted(dict.fromkeys(refs))
    if len(refs) < min_count:
        return False
    existing = [
        ref
        for ref in refs
        if ref in elements and (allowed_kinds is None or _kind(elements.get(ref)) in allowed_kinds)
    ]
    return len(existing) >= min_count


def _polygon_from(value: Any) -> list[tuple[float, float]]:
    if not isinstance(value, list | tuple):
        return []
    points: list[tuple[float, float]] = []
    for point in value:
        x = _value(point, "xMm", "x_mm")
        y = _value(point, "yMm", "y_mm")
        if x is None or y is None:
            continue
        try:
            points.append((float(x), float(y)))
        except (TypeError, ValueError):
            continue
    return points


def _point_in_polygon_or_on_edge(
    point: tuple[float, float],
    polygon: list[tuple[float, float]],
    tolerance_mm: float = 1.0,
) -> bool:
    for index, current in enumerate(polygon):
        if (
            _distance_point_to_segment(point, current, polygon[(index + 1) % len(polygon)])
            <= tolerance_mm
        ):
            return True

    inside = False
    x, y = point
    j = len(polygon) - 1
    for i, pi in enumerate(polygon):
        pj = polygon[j]
        intersects = (pi[1] > y) != (pj[1] > y) and x < (
            (pj[0] - pi[0]) * (y - pi[1]) / (pj[1] - pi[1]) + pi[0]
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _distance_point_to_segment(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx = bx - ax
    dy = by - ay
    length_sq = dx * dx + dy * dy
    if length_sq <= 1e-9:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    x = ax + t * dx
    y = ay + t * dy
    return ((px - x) ** 2 + (py - y) ** 2) ** 0.5


def _polygon_area(polygon: list[tuple[float, float]]) -> float:
    if len(polygon) < 3:
        return 0.0
    total = 0.0
    for index, (x1, y1) in enumerate(polygon):
        x2, y2 = polygon[(index + 1) % len(polygon)]
        total += x1 * y2 - x2 * y1
    return total / 2.0


def _has_performance_metadata(element: Any, name: str) -> bool:
    props = _props(element)
    if name == "layers":
        return bool(
            _value(element, "typeLayerIds", "type_layer_ids", "materialLayerIds", "material_layer_ids")
            or _value(element, "constructionAssemblyId", "construction_assembly_id")
            or _pick(
                props,
                "typeLayers",
                "typeLayerIds",
                "materialLayers",
                "materialLayerIds",
                "constructionAssemblyId",
            )
        )
    if name == "thermal":
        return bool(
            _value(element, "thermalClassification", "thermal_classification")
            or _pick(props, "thermalProfile", "thermalPerformancePlaceholder")
        )
    if name == "fire":
        return bool(
            _value(element, "fireResistanceRating", "fire_resistance_rating")
            or _pick(props, "fireRating", "firePerformancePlaceholder")
        )
    if name == "acoustic":
        return bool(_pick(props, "acousticRating", "acousticPerformancePlaceholder"))
    return False


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value else []
    if isinstance(value, list | tuple | set):
        return [str(item) for item in value if item]
    return []


def _snake(camel: str) -> str:
    out = []
    for index, char in enumerate(camel):
        if char.isupper() and index:
            out.append("_")
        out.append(char.lower())
    return "".join(out)


def _float_or_none(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _tracker_items_for_rule(rule_id: str) -> list[str]:
    normalized = rule_id.lower()
    for token in ("f01", "f02", "f03", "f04", "f05", "f06", "f07"):
        if f"bir_{token}" in normalized:
            return [f"BIR-{token.upper()}"]
    return []
