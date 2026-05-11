from __future__ import annotations

from bim_ai.constraints_core import Violation
from bim_ai.constructability_geometry import (
    AABB,
    collect_physical_participants,
    participant_distance_mm,
)
from bim_ai.constructability_matrix import participant_matrix_group
from bim_ai.elements import Element

FURNITURE_WALL_CLEARANCE_RULE_ID = "furniture_wall_clearance_conflict"
MAINTENANCE_CLEARANCE_RULE_ID = "maintenance_clearance_conflict"

_FURNITURE_WALL_CLEARANCE_BY_PROFILE_MM = {
    "design_review": 150.0,
    "permit_readiness": 300.0,
    "construction_readiness": 300.0,
}


def constructability_clearance_violations(
    elements: dict[str, Element],
    *,
    profile: str,
) -> list[Violation]:
    """Profile-gated static clearance checks for constructability reports."""

    required_clearance_mm = _FURNITURE_WALL_CLEARANCE_BY_PROFILE_MM.get(profile)
    if required_clearance_mm is None:
        return []

    participants = collect_physical_participants(elements)
    furniture = [p for p in participants if participant_matrix_group(p) == "furniture"]
    walls = [p for p in participants if participant_matrix_group(p) == "wall"]
    violations: list[Violation] = []
    for item in furniture:
        for wall in walls:
            if item.level_id is not None and wall.level_id is not None and item.level_id != wall.level_id:
                continue
            if _aabb_overlaps(item.aabb, wall.aabb):
                continue
            distance_mm = participant_distance_mm(item, wall)
            if distance_mm > required_clearance_mm:
                continue
            violations.append(
                Violation(
                    rule_id=FURNITURE_WALL_CLEARANCE_RULE_ID,
                    severity="warning",
                    message=(
                        "Furniture or family collision proxy is "
                        f"{distance_mm:.0f} mm from a wall; profile '{profile}' requires "
                        f"{required_clearance_mm:.0f} mm clearance."
                    ),
                    element_ids=sorted([item.element_id, wall.element_id]),
                    discipline="architecture",
                    blocking_class="geometry",
                )
            )
    clearance_by_element_id = _element_required_clearances(elements)
    for item in participants:
        required_mm = clearance_by_element_id.get(item.element_id)
        if required_mm is None:
            continue
        for obstruction in participants:
            if obstruction.element_id == item.element_id:
                continue
            if item.level_id is not None and obstruction.level_id is not None and item.level_id != obstruction.level_id:
                continue
            if _aabb_overlaps(item.aabb, obstruction.aabb):
                continue
            distance_mm = participant_distance_mm(item, obstruction)
            if distance_mm > required_mm:
                continue
            violations.append(
                Violation(
                    rule_id=MAINTENANCE_CLEARANCE_RULE_ID,
                    severity="warning",
                    message=(
                        f"Element '{item.element_id}' is {distance_mm:.0f} mm from "
                        f"'{obstruction.element_id}'; profile '{profile}' requires "
                        f"{required_mm:.0f} mm maintenance/operation clearance."
                    ),
                    element_ids=sorted([item.element_id, obstruction.element_id]),
                    discipline="architecture",
                    blocking_class="geometry",
                )
            )
    return violations


def _element_required_clearances(elements: dict[str, Element]) -> dict[str, float]:
    clearances: dict[str, float] = {}
    for element_id, element in elements.items():
        sources = [
            getattr(element, "props", None) or {},
            getattr(element, "param_values", None) or {},
        ]
        for source in sources:
            value = _first_positive_number(
                source,
                "maintenanceClearanceMm",
                "requiredClearanceMm",
                "serviceClearanceMm",
                "cabinetClearanceMm",
                "frontClearanceMm",
            )
            if value is not None:
                clearances[str(element_id)] = value
                break
    return clearances


def _first_positive_number(source: dict[str, object], *keys: str) -> float | None:
    normalized = {_normalize_key(key): value for key, value in source.items()}
    for key in keys:
        value = normalized.get(_normalize_key(key))
        try:
            number = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if number > 0:
            return number
    return None


def _normalize_key(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _aabb_overlaps(a: AABB, b: AABB) -> bool:
    return not (
        a.max_x < b.min_x
        or b.max_x < a.min_x
        or a.max_y < b.min_y
        or b.max_y < a.min_y
        or a.max_z < b.min_z
        or b.max_z < a.min_z
    )
