from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

DEFAULT_ACCESSIBLE_DOOR_CLEAR_WIDTH_MM = 850.0
DEFAULT_MAX_ACCESSIBLE_THRESHOLD_MM = 20.0
DEFAULT_CIRCULATION_CLEAR_WIDTH_MM = 1200.0
DEFAULT_SANITARY_TURNING_DIAMETER_MM = 1500.0


@dataclass(frozen=True)
class CodeProfile:
    profile_id: str = "default"
    fire: bool = False
    accessibility: bool = False
    regional: bool = False
    enforced: bool = False
    locale: str | None = None
    source: str | None = None
    basis: str = "advisory"
    accessible_door_clear_width_mm: float = DEFAULT_ACCESSIBLE_DOOR_CLEAR_WIDTH_MM
    max_accessible_threshold_mm: float = DEFAULT_MAX_ACCESSIBLE_THRESHOLD_MM
    circulation_clear_width_mm: float = DEFAULT_CIRCULATION_CLEAR_WIDTH_MM
    sanitary_turning_diameter_mm: float = DEFAULT_SANITARY_TURNING_DIAMETER_MM


def check_code_profile_integrity(
    model_or_elements: Any,
    *,
    profile: str | Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Return profile-controlled code metadata findings without mutating the model."""

    code_profile = _profile_from(profile)
    elements = _element_list(model_or_elements)
    elements_by_id = {
        _element_id(element): element for element in elements if _element_id(element) != "unknown"
    }

    findings: list[dict[str, Any]] = []
    if code_profile.fire:
        findings.extend(_fire_findings(elements, code_profile, elements_by_id))
    if code_profile.accessibility:
        findings.extend(_accessibility_findings(elements, code_profile))
    if code_profile.regional:
        findings.extend(_regional_findings(elements, code_profile))

    return sorted(
        findings,
        key=lambda f: (
            str(f.get("ruleId") or ""),
            tuple(str(eid) for eid in f.get("elementIds") or []),
            str(f.get("code") or ""),
        ),
    )


def _fire_findings(
    elements: list[Mapping[str, Any]],
    profile: CodeProfile,
    elements_by_id: Mapping[str, Mapping[str, Any]],
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for element in elements:
        kind = _kind(element)
        element_id = _element_id(element)
        if kind in {"wall", "floor", "ceiling", "roof", "door", "window", "wall_opening"}:
            if _requires_fire_rating(element) and not _has_any(
                element,
                "fireRating",
                "FireRating",
                "fire_rating",
                "fireResistanceRating",
                "ratingMinutes",
            ):
                findings.append(
                    _finding(
                        "code_profile_fire_rating_missing",
                        "BIR-G05",
                        profile,
                        element_id,
                        "fire",
                        "fire_safety",
                        "Add fire-resistance rating metadata or mark the element out of scope.",
                        "Required fire-rated element is missing rating metadata.",
                    )
                )

        if kind == "door" and _has_truthy(
            element, "exitDoor", "egressDoor", "requiredExit", "requiredExitDoor"
        ):
            missing = [
                label
                for label, keys in (
                    ("clear exit width", ("egressClearWidthMm", "clearWidthMm")),
                    ("swing direction", ("swingDirection", "opensInDirectionOfEgress")),
                    ("landing clearance", ("landingClearanceMm", "maneuveringClearanceMm")),
                )
                if not _has_any(element, *keys)
            ]
            if missing:
                findings.append(
                    _finding(
                        "code_profile_exit_door_metadata_missing",
                        "BIR-G05",
                        profile,
                        element_id,
                        "fire",
                        "egress",
                        "Add exit door width, swing, and landing clearance metadata.",
                        f"Exit door metadata is incomplete: {', '.join(missing)}.",
                    )
                )

            width = _number(element, "egressClearWidthMm", "clearWidthMm", "widthMm")
            if width is not None and width < profile.accessible_door_clear_width_mm:
                findings.append(
                    _finding(
                        "code_profile_exit_door_width_insufficient",
                        "BIR-G05",
                        profile,
                        element_id,
                        "fire",
                        "egress",
                        "Increase clear exit width or update the exit-door designation.",
                        (
                            f"Exit door clear width {width:g} mm is below "
                            f"{profile.accessible_door_clear_width_mm:g} mm."
                        ),
                    )
                )
            if _has_truthy(element, "opensAgainstEgress"):
                findings.append(
                    _finding(
                        "code_profile_exit_door_swing_conflict",
                        "BIR-G05",
                        profile,
                        element_id,
                        "fire",
                        "egress",
                        "Revise the exit door swing or document an authority-reviewed exception.",
                        "Exit door swing is marked against egress direction.",
                    )
                )

        if kind == "stair" and _has_truthy(
            element, "protectedStair", "egressStair", "requiredExitStair"
        ):
            if not _placeholder_accepted(
                element,
                "protectedStair",
                required_keys=("enclosureRating", "smokeControlStrategy"),
            ):
                findings.append(
                    _finding(
                        "code_profile_protected_stair_placeholder_missing",
                        "BIR-G05",
                        profile,
                        element_id,
                        "fire",
                        "egress",
                        "Record protected stair enclosure and smoke-control placeholder metadata.",
                        "Protected stair placeholder metadata is incomplete.",
                    )
                )

        if _has_truthy(element, "compartmentBoundary", "fireCompartmentBoundary"):
            if not _placeholder_accepted(
                element,
                "compartment",
                required_keys=("compartmentId", "compartmentBasis"),
            ):
                findings.append(
                    _finding(
                        "code_profile_compartment_placeholder_missing",
                        "BIR-G05",
                        profile,
                        element_id,
                        "fire",
                        "compartmentation",
                        "Add compartment id and basis placeholder metadata.",
                        "Compartment boundary placeholder metadata is incomplete.",
                    )
                )

        if kind in {"pipe", "duct", "cable_tray", "mep_route", "mep_route_placeholder"}:
            crossed_ids = _ids(
                element,
                "passesThroughElementIds",
                "crossesElementIds",
                "intersectsElementIds",
                "penetratesElementIds",
            )
            rated_hosts = [
                crossed_id
                for crossed_id in crossed_ids
                if _requires_fire_rating(elements_by_id.get(crossed_id))
                or _has_any(elements_by_id.get(crossed_id), "fireRating", "fireResistanceRating")
            ]
            if rated_hosts and not _has_any(
                element,
                "firestopSystemId",
                "firestopRating",
                "penetrationFireRating",
                "approvedFirestopDetailId",
            ):
                findings.append(
                    _finding(
                        "code_profile_firestop_metadata_missing",
                        "BIR-G05",
                        profile,
                        element_id,
                        "fire",
                        "penetrations",
                        "Add firestop system/rating metadata for MEP penetrations through fire-rated hosts.",
                        "MEP route penetrates fire-rated hosts without firestop metadata.",
                        extra_element_ids=rated_hosts,
                    )
                )
    return findings


def _accessibility_findings(
    elements: list[Mapping[str, Any]], profile: CodeProfile
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for element in elements:
        kind = _kind(element)
        element_id = _element_id(element)

        if kind == "door" and _accessibility_scoped(element):
            width = _number(element, "clearWidthMm", "accessibleClearWidthMm", "widthMm")
            if width is not None and width < profile.accessible_door_clear_width_mm:
                findings.append(
                    _finding(
                        "code_profile_accessible_door_width_insufficient",
                        "BIR-G06",
                        profile,
                        element_id,
                        "architecture",
                        "accessibility",
                        "Increase clear door width or remove it from the accessible route.",
                        (
                            f"Accessible door clear width {width:g} mm is below "
                            f"{profile.accessible_door_clear_width_mm:g} mm."
                        ),
                    )
                )

            threshold = _number(element, "thresholdHeightMm", "accessibleThresholdMm")
            if threshold is not None and threshold > profile.max_accessible_threshold_mm:
                findings.append(
                    _finding(
                        "code_profile_accessible_threshold_too_high",
                        "BIR-G06",
                        profile,
                        element_id,
                        "architecture",
                        "accessibility",
                        "Lower the threshold or add compliant transition metadata.",
                        (
                            f"Accessible threshold {threshold:g} mm exceeds "
                            f"{profile.max_accessible_threshold_mm:g} mm."
                        ),
                    )
                )

            clearance = _number(
                element,
                "maneuveringClearanceMm",
                "latchSideClearanceMm",
                "doorClearanceMm",
            )
            if clearance is not None and clearance < 300.0:
                findings.append(
                    _finding(
                        "code_profile_door_clearance_insufficient",
                        "BIR-G06",
                        profile,
                        element_id,
                        "architecture",
                        "accessibility",
                        "Provide maneuvering clearance metadata for the accessible door swing.",
                        f"Door maneuvering clearance {clearance:g} mm is below 300 mm.",
                    )
                )

            if _has_truthy(element, "opensAgainstEgress", "swingObstructsAccessibleRoute"):
                findings.append(
                    _finding(
                        "code_profile_door_swing_conflict",
                        "BIR-G06",
                        profile,
                        element_id,
                        "architecture",
                        "accessibility",
                        "Revise the swing or document why it does not obstruct the route.",
                        "Door swing conflicts with egress or accessible route metadata.",
                    )
                )

        if kind in {"corridor", "route", "accessible_route", "circulation_path", "room"}:
            if _has_truthy(element, "accessibleRoute", "primaryCirculation", "publicRoute"):
                width = _number(element, "clearWidthMm", "routeClearWidthMm", "widthMm")
                if width is None:
                    findings.append(
                        _finding(
                            "code_profile_accessible_route_metadata_missing",
                            "BIR-G06",
                            profile,
                            element_id,
                            "architecture",
                            "accessibility",
                            "Add accessible route clear width and continuity metadata.",
                            "Accessible route metadata is missing clear width.",
                        )
                    )
                elif width < profile.circulation_clear_width_mm:
                    findings.append(
                        _finding(
                            "code_profile_circulation_width_insufficient",
                            "BIR-G06",
                            profile,
                            element_id,
                            "architecture",
                            "accessibility",
                            "Increase circulation width or update the route designation.",
                            (
                                f"Circulation clear width {width:g} mm is below "
                                f"{profile.circulation_clear_width_mm:g} mm."
                            ),
                        )
                    )
                if not _has_any(
                    element,
                    "routeContinuity",
                    "continuousAccessibleRoute",
                    "connectsAccessibleDestinationIds",
                    "servedRoomIds",
                ):
                    findings.append(
                        _finding(
                            "code_profile_accessible_route_continuity_missing",
                            "BIR-G06",
                            profile,
                            element_id,
                            "architecture",
                            "accessibility",
                            "Add accessible route continuity/connectivity metadata for deterministic route review.",
                            "Accessible route is missing continuity/connectivity metadata.",
                        )
                    )

        if kind in {"room", "sanitary_room", "toilet_room", "bathroom"} and _has_truthy(
            element, "accessibleSanitary", "sanitaryTurningZone", "accessibleToiletRoom"
        ):
            turning = _number(element, "turningDiameterMm", "turningZoneDiameterMm")
            if turning is None or turning < profile.sanitary_turning_diameter_mm:
                findings.append(
                    _finding(
                        "code_profile_sanitary_turning_zone_insufficient",
                        "BIR-G06",
                        profile,
                        element_id,
                        "architecture",
                        "accessibility",
                        "Add a compliant sanitary turning-zone placeholder or revise the layout.",
                        "Accessible sanitary turning-zone metadata is missing or undersized.",
                    )
                )
    return findings


def _regional_findings(
    elements: list[Mapping[str, Any]], profile: CodeProfile
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    package_elements = [
        element
        for element in elements
        if _kind(element) in {"project_settings", "code_profile", "regional_code_package"}
        or _has_any(element, "regionalCodePackage", "codePackage")
    ]
    if not package_elements:
        package_elements = [None]  # type: ignore[list-item]

    for element in package_elements:
        element_id = _element_id(element) if element is not None else "project"
        locale = profile.locale or _text(element, "locale", "codeLocale", "jurisdiction")
        source = profile.source or _text(element, "source", "codeSource", "referenceSource")
        basis = _normalized_text(
            profile.basis or _text(element, "basis", "enforcementBasis", "codeBasis")
        )
        missing = []
        if not locale:
            missing.append("locale")
        if not source:
            missing.append("source")
        if basis not in {"advisory", "enforced"}:
            missing.append("advisory-vs-enforced basis")

        if missing:
            findings.append(
                _finding(
                    "code_profile_regional_package_metadata_missing",
                    "BIR-G07",
                    profile,
                    element_id,
                    "code",
                    "regional_code",
                    "Add regional code package locale, source, severity, and advisory/enforced basis.",
                    f"Regional code package metadata is incomplete: {', '.join(missing)}.",
                )
            )
    return findings


def _finding(
    rule_id: str,
    code: str,
    profile: CodeProfile,
    element_id: str,
    discipline: str,
    perspective: str,
    recommendation: str,
    message: str,
    *,
    extra_element_ids: Iterable[str] = (),
) -> dict[str, Any]:
    severity = "error" if profile.enforced else "warning"
    element_ids = [element_id, *(str(eid) for eid in extra_element_ids if eid)]
    return {
        "ruleId": rule_id,
        "code": code,
        "severity": severity,
        "priority": "P0" if severity == "error" else "P2",
        "discipline": discipline,
        "perspective": perspective,
        "elementIds": list(dict.fromkeys(element_ids)),
        "recommendation": recommendation,
        "message": message,
        "profileId": profile.profile_id,
        "basis": "enforced" if profile.enforced else "advisory",
        "locale": profile.locale,
        "sourceBasis": profile.source,
        "trackerItems": _tracker_items_for_code(code),
    }


def _profile_from(profile: str | Mapping[str, Any] | None) -> CodeProfile:
    if profile is None:
        return CodeProfile()
    if isinstance(profile, str):
        token = profile.strip().lower()
        return CodeProfile(
            profile_id=token or "default",
            fire=token in {"fire", "fire_safety", "permit", "full"},
            accessibility=token in {"accessibility", "accessible", "permit", "full"},
            regional=token in {"regional", "regional_code", "permit", "full"},
            enforced=token in {"fire", "accessibility", "regional", "permit", "full"},
            basis="enforced" if token in {"fire", "accessibility", "regional", "permit", "full"} else "advisory",
        )

    profile_id = str(profile.get("id") or profile.get("profileId") or "custom")
    raw_basis = (
        profile.get("basis")
        if "basis" in profile
        else profile.get("enforcementBasis", "advisory")
    )
    basis = _normalized_text(raw_basis)
    basis_was_explicit = "basis" in profile or "enforcementBasis" in profile
    enforced = bool(profile.get("enforced")) or basis == "enforced"
    domains = {
        str(domain).strip().lower()
        for domain in _iterable(profile.get("domains") or profile.get("checks"))
    }
    return CodeProfile(
        profile_id=profile_id,
        fire=bool(profile.get("fire")) or "fire" in domains or "fire_safety" in domains,
        accessibility=bool(profile.get("accessibility"))
        or "accessibility" in domains
        or "accessible" in domains,
        regional=bool(profile.get("regional")) or "regional" in domains or "regional_code" in domains,
        enforced=enforced,
        locale=_optional_text(profile.get("locale") or profile.get("jurisdiction")),
        source=_optional_text(profile.get("source") or profile.get("codeSource")),
        basis=basis if basis_was_explicit else ("enforced" if enforced else "advisory"),
        accessible_door_clear_width_mm=_float_or_default(
            profile.get("accessibleDoorClearWidthMm"), DEFAULT_ACCESSIBLE_DOOR_CLEAR_WIDTH_MM
        ),
        max_accessible_threshold_mm=_float_or_default(
            profile.get("maxAccessibleThresholdMm"), DEFAULT_MAX_ACCESSIBLE_THRESHOLD_MM
        ),
        circulation_clear_width_mm=_float_or_default(
            profile.get("circulationClearWidthMm"), DEFAULT_CIRCULATION_CLEAR_WIDTH_MM
        ),
        sanitary_turning_diameter_mm=_float_or_default(
            profile.get("sanitaryTurningDiameterMm"), DEFAULT_SANITARY_TURNING_DIAMETER_MM
        ),
    )


def _element_list(model_or_elements: Any) -> list[Mapping[str, Any]]:
    if model_or_elements is None:
        return []
    if isinstance(model_or_elements, Mapping):
        raw_elements = model_or_elements.get("elements", model_or_elements)
        if isinstance(raw_elements, Mapping):
            return [_as_mapping(element) for element in raw_elements.values()]
        if isinstance(raw_elements, Iterable) and not isinstance(raw_elements, (str, bytes)):
            return [_as_mapping(element) for element in raw_elements]
    elements = getattr(model_or_elements, "elements", None)
    if isinstance(elements, Mapping):
        return [_as_mapping(element) for element in elements.values()]
    if isinstance(elements, Iterable) and not isinstance(elements, (str, bytes)):
        return [_as_mapping(element) for element in elements]
    return []


def _as_mapping(element: Any) -> Mapping[str, Any]:
    if isinstance(element, Mapping):
        return element
    if hasattr(element, "model_dump"):
        return element.model_dump(by_alias=True)
    if hasattr(element, "__dict__"):
        return vars(element)
    return {}


def _kind(element: Mapping[str, Any] | None) -> str:
    return str(_lookup(element, "kind") or "").strip().lower()


def _element_id(element: Mapping[str, Any] | None) -> str:
    return str(_lookup(element, "id") or "unknown")


def _accessibility_scoped(element: Mapping[str, Any]) -> bool:
    return _has_truthy(
        element,
        "accessible",
        "accessibleDoor",
        "accessibleRoute",
        "publicEntry",
        "requiredAccessible",
    )


def _requires_fire_rating(element: Mapping[str, Any]) -> bool:
    return _has_truthy(
        element,
        "fireRated",
        "fireDoor",
        "ratedOpening",
        "fireSeparation",
        "fireBarrier",
        "compartmentBoundary",
        "requiresFireRating",
    )


def _placeholder_accepted(
    element: Mapping[str, Any],
    placeholder_key: str,
    *,
    required_keys: tuple[str, ...],
) -> bool:
    if _has_truthy(element, f"{placeholder_key}PlaceholderAccepted", "placeholderAccepted"):
        return True
    return all(_has_any(element, key) for key in required_keys)


def _has_any(element: Mapping[str, Any] | None, *keys: str) -> bool:
    return any(_present(_lookup(element, key)) for key in keys)


def _has_truthy(element: Mapping[str, Any] | None, *keys: str) -> bool:
    return any(_truthy(_lookup(element, key)) for key in keys)


def _number(element: Mapping[str, Any] | None, *keys: str) -> float | None:
    for key in keys:
        value = _lookup(element, key)
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _ids(element: Mapping[str, Any] | None, *keys: str) -> list[str]:
    ids: list[str] = []
    for key in keys:
        value = _lookup(element, key)
        if value in (None, ""):
            continue
        if isinstance(value, str):
            ids.append(value)
        elif isinstance(value, Iterable) and not isinstance(value, Mapping):
            ids.extend(str(item) for item in value if item not in (None, ""))
        else:
            ids.append(str(value))
    return ids


def _text(element: Mapping[str, Any] | None, *keys: str) -> str | None:
    for key in keys:
        value = _optional_text(_lookup(element, key))
        if value:
            return value
    return None


def _lookup(element: Mapping[str, Any] | None, key: str) -> Any:
    if element is None:
        return None
    normalized = _normalize_key(key)
    for current_key, value in element.items():
        if _normalize_key(str(current_key)) == normalized:
            return value
    props = element.get("props")
    if isinstance(props, Mapping):
        for current_key, value in props.items():
            if _normalize_key(str(current_key)) == normalized:
                return value
    metadata = element.get("metadata")
    if isinstance(metadata, Mapping):
        for current_key, value in metadata.items():
            if _normalize_key(str(current_key)) == normalized:
                return value
    return None


def _present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True


def _truthy(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "1", "required", "enforced"}
    return bool(value)


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalized_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_key(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _float_or_default(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _iterable(value: Any) -> Iterable[Any]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,)
    if isinstance(value, Iterable):
        return value
    return (value,)


def _tracker_items_for_code(code: str) -> list[str]:
    parts = str(code).split("-")
    if len(parts) >= 2 and parts[0] == "BIR":
        return [f"{parts[0]}-{parts[1]}"]
    return []
