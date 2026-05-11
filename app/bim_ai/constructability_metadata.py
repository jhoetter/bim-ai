from __future__ import annotations

from bim_ai.constraints_core import Violation
from bim_ai.elements import Element, WallElem

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
        if not isinstance(element, WallElem):
            continue
        missing = _missing_wall_requirements(element)
        if not missing:
            continue
        violations.append(
            Violation(
                rule_id=METADATA_REQUIREMENT_RULE_ID,
                severity="warning",
                message=(
                    f"Wall '{element.id}' is missing constructability metadata required by "
                    f"profile '{profile}': {', '.join(missing)}."
                ),
                element_ids=[element.id],
                discipline="coordination",
                blocking_class="metadata",
            )
        )
    return violations


def _missing_wall_requirements(wall: WallElem) -> list[str]:
    missing: list[str] = []
    props = wall.props or {}
    if _is_primary_envelope_wall(wall) and not _has_any_prop(
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


def _is_primary_envelope_wall(wall: WallElem) -> bool:
    props = wall.props or {}
    return bool(
        _has_truthy_prop(props, "primaryEnvelope", "isExternal", "exterior")
        or wall.roof_attachment_id
    )


def _has_any_prop(props: dict[str, object], *keys: str) -> bool:
    return any(_present(props.get(key)) for key in keys)


def _has_truthy_prop(props: dict[str, object], *keys: str) -> bool:
    return any(bool(props.get(key)) for key in keys)


def _present(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True
