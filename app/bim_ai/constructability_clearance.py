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
    return violations


def _aabb_overlaps(a: AABB, b: AABB) -> bool:
    return not (
        a.max_x < b.min_x
        or b.max_x < a.min_x
        or a.max_y < b.min_y
        or b.max_y < a.min_y
        or a.max_z < b.min_z
        or b.max_z < a.min_z
    )
