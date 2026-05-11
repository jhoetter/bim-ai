from __future__ import annotations

from bim_ai.constraints_core import Violation
from bim_ai.elements import DoorElem, Element, FloorElem, RoofElem, WallElem, WindowElem

METADATA_REQUIREMENT_RULE_ID = "constructability_metadata_requirement_missing"
_REQUIREMENT_PROFILES = {"permit_readiness", "construction_readiness"}


def constructability_metadata_requirement_violations(
    elements: dict[str, Element],
    *,
    profile: str,
) -> list[Violation]:
    """IDS-like constructability metadata checks for readiness profiles."""

    if profile not in _REQUIREMENT_PROFILES:
        return []

    violations: list[Violation] = []
    for element in elements.values():
        missing = _missing_requirements(element)
        if not missing:
            continue
        element_kind = getattr(element, "kind", "element")
        element_id = str(getattr(element, "id", "unknown"))
        violations.append(
            Violation(
                rule_id=METADATA_REQUIREMENT_RULE_ID,
                severity="warning",
                message=(
                    f"{element_kind.capitalize()} '{element_id}' is missing constructability "
                    f"metadata required by profile '{profile}': {', '.join(missing)}."
                ),
                element_ids=[element_id],
                discipline="coordination",
                blocking_class="metadata",
            )
        )
    return violations


def _missing_requirements(element: Element) -> list[str]:
    if isinstance(element, WallElem):
        return _missing_wall_requirements(element)
    if isinstance(element, DoorElem):
        return _missing_door_requirements(element)
    if isinstance(element, WindowElem):
        return _missing_window_requirements(element)
    if isinstance(element, FloorElem):
        return _missing_floor_requirements(element)
    if isinstance(element, RoofElem):
        return _missing_roof_requirements(element)
    return []


def _missing_wall_requirements(wall: WallElem) -> list[str]:
    missing: list[str] = []
    props = wall.props or {}
    if _is_primary_envelope_wall(wall):
        if wall.load_bearing is None and wall.structural_role == "unknown":
            missing.append("Pset_WallCommon.LoadBearing")
        if not _has_any_prop(
            props,
            "fireRating",
            "FireRating",
            "fire_rating",
        ):
            missing.append("Pset_WallCommon.FireRating")
    if wall.load_bearing is True and not (
        wall.structural_material_key
        or _has_any_prop(props, "structuralMaterial", "structuralMaterialKey")
    ):
        missing.append("structuralMaterialKey")
    return missing


def _missing_door_requirements(door: DoorElem) -> list[str]:
    props = door.props or {}
    if not _is_fire_rated_or_egress_door(door):
        return []

    missing: list[str] = []
    if not door.family_type_id:
        missing.append("familyTypeId")
    if door.operation_type is None:
        missing.append("operationType")
    if _has_truthy_prop(props, "fireDoor", "fireRated", "ratedOpening") and not _has_any_prop(
        props, "fireRating", "FireRating", "fire_rating"
    ):
        missing.append("Pset_DoorCommon.FireRating")
    if _has_truthy_prop(props, "egressDoor", "exitDoor", "requiredExit") and not _has_any_prop(
        props, "egressClearWidthMm", "clearWidthMm", "requiredClearWidthMm"
    ):
        missing.append("egressClearWidthMm")
    return missing


def _missing_window_requirements(window: WindowElem) -> list[str]:
    props = window.props or {}
    if not _has_truthy_prop(props, "egressWindow", "rescueOpening", "requiredEmergencyEscape"):
        return []

    missing: list[str] = []
    if not window.family_type_id:
        missing.append("familyTypeId")
    if not _has_any_prop(
        props,
        "egressClearOpeningAreaM2",
        "clearOpeningAreaM2",
        "egressCompliant",
    ):
        missing.append("egressClearOpeningAreaM2")
    return missing


def _missing_floor_requirements(floor: FloorElem) -> list[str]:
    props = floor.props or {}
    if not _has_truthy_prop(props, "requiresStructuralMetadata", "primaryStructuralFloor"):
        return []

    missing: list[str] = []
    if not floor.floor_type_id and not _has_any_prop(props, "assemblyType", "floorAssembly"):
        missing.append("floorTypeId")
    if not _has_any_prop(
        props,
        "structuralSystem",
        "structuralSystemId",
        "spanDirection",
        "joistSpacingMm",
    ):
        missing.append("structuralSystem")
    return missing


def _missing_roof_requirements(roof: RoofElem) -> list[str]:
    props = roof.props or {}
    if not (_has_truthy_prop(props, "primaryEnvelope", "requiresEnvelopeMetadata") or _is_low_slope(roof)):
        return []

    missing: list[str] = []
    if not roof.roof_type_id and not roof.material_key:
        missing.append("roofTypeId")
    if _is_low_slope(roof) and not _has_any_prop(
        props,
        "roofDrainageDesigned",
        "stormDrainageDesigned",
        "taperedInsulation",
        "flatRoofSystem",
    ):
        missing.append("roofDrainageDesigned")
    return missing


def _is_fire_rated_or_egress_door(door: DoorElem) -> bool:
    props = door.props or {}
    return _has_truthy_prop(
        props,
        "fireDoor",
        "fireRated",
        "ratedOpening",
        "egressDoor",
        "exitDoor",
        "requiredExit",
    )


def _is_low_slope(roof: RoofElem) -> bool:
    return roof.slope_deg is not None and float(roof.slope_deg) <= 2.0


def _is_primary_envelope_wall(wall: WallElem) -> bool:
    props = wall.props or {}
    return bool(
        _has_truthy_prop(props, "primaryEnvelope", "isExternal", "exterior")
        or wall.roof_attachment_id
    )


def _has_any_prop(props: dict[str, object], *keys: str) -> bool:
    normalized = {_normalize_key(key): value for key, value in props.items()}
    return any(_present(normalized.get(_normalize_key(key))) for key in keys)


def _has_truthy_prop(props: dict[str, object], *keys: str) -> bool:
    normalized = {_normalize_key(key): value for key, value in props.items()}
    for key in keys:
        value = normalized.get(_normalize_key(key))
        if isinstance(value, str):
            if value.strip().lower() in {"true", "yes", "1", "required", "external"}:
                return True
            continue
        if bool(value):
            return True
    return False


def _normalize_key(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _present(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True
