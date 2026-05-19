from __future__ import annotations

from collections.abc import Mapping
from typing import Any

Finding = dict[str, Any]

_ENVELOPE_ZONE_KINDS = {"envelope_zone", "envelopeZone"}
_OPENING_KINDS = {"door", "window", "wall_opening", "opening"}
_PROFILE_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "strict": ("thermal", "fire", "acoustic"),
    "permit_readiness": ("thermal", "fire"),
    "construction_readiness": ("thermal", "fire", "acoustic"),
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


def _check_loggias(elements: Mapping[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for element_id, element in elements.items():
        if not _is_loggia(element):
            continue
        props = _props(element)
        missing: list[str] = []
        if len(_as_str_list(_pick(props, "sideReturnIds", "side_return_ids"))) < 2:
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
        bay_ids = _as_str_list(_pick(rhythm, "bayIds", "bay_ids"))
        opening_ids = _as_str_list(_pick(rhythm, "openingIds", "opening_ids"))
        actual = len(bay_ids or opening_ids)
        if actual != int(expected):
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
        overhang = _value(element, "overhangMm", "overhang_mm")
        semantics = _pick(props, "overhangSemantics", "overhang_semantics")
        if overhang and float(overhang) > 0 and not semantics:
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
        if _kind(element) not in {"wall", "roof", "floor", "door", "window", "wall_opening"}:
            continue
        if not any(_is_envelope_role(element, role) for role in ("exterior_wall", "roof", "floor", "opening")):
            continue
        missing = [name for name in required if not _has_performance_metadata(element, name)]
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


def _has_performance_metadata(element: Any, name: str) -> bool:
    props = _props(element)
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
