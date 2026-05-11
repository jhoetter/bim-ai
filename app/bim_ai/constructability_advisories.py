from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from bim_ai.constraints_core import Violation
from bim_ai.constraints_wall_geometry import wall_length_mm, wall_unit_dir
from bim_ai.constructability_geometry import (
    AABB,
    PhysicalParticipant,
    aabb_overlaps,
    collect_physical_participants,
    collect_unsupported_physical_diagnostics,
)
from bim_ai.constructability_matrix import duplicate_cell_for, hard_clash_cell_for
from bim_ai.elements import (
    DoorElem,
    Element,
    SlabOpeningElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)

_CLASH_TOLERANCE_MM = 1.0
_SUPPORT_TOLERANCE_MM = 300.0
_LARGE_OPENING_MIN_WIDTH_MM = 1800.0
_LARGE_OPENING_WALL_RATIO = 0.4


def constructability_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    participants = collect_physical_participants(elements)
    participants_by_kind: dict[str, list[PhysicalParticipant]] = defaultdict(list)
    for participant in participants:
        participants_by_kind[participant.kind].append(participant)

    walls_by_id = {
        element.id: element for element in elements.values() if isinstance(element, WallElem)
    }
    openings_by_wall_id = _openings_by_wall_id(elements, walls_by_id)

    violations: list[Violation] = []
    violations.extend(_unsupported_proxy_violations(elements))
    violations.extend(_matrix_duplicate_geometry_violations(participants, elements))
    violations.extend(_matrix_hard_clash_violations(participants, elements))
    violations.extend(_mep_wall_penetration_violations(participants_by_kind, openings_by_wall_id))
    violations.extend(_mep_floor_ceiling_penetration_violations(participants_by_kind, elements))
    violations.extend(_stair_floor_opening_violations(participants_by_kind, elements))
    violations.extend(_door_clearance_violations(elements, participants_by_kind))
    violations.extend(_load_bearing_metadata_violations(walls_by_id))
    violations.extend(_large_opening_violations(elements, walls_by_id))
    violations.extend(_stacked_load_path_violations(participants_by_kind, walls_by_id))
    violations.extend(_unsupported_beam_violations(participants_by_kind, elements, walls_by_id))
    violations.extend(_unsupported_column_violations(participants_by_kind, walls_by_id))
    return violations


def _unsupported_proxy_violations(elements: dict[str, Element]) -> list[Violation]:
    violations: list[Violation] = []
    for diagnostic in collect_unsupported_physical_diagnostics(elements):
        violations.append(
            Violation(
                rule_id="constructability_proxy_unsupported",
                severity="warning",
                message=(
                    f"Physical element '{diagnostic.element_id}' ({diagnostic.kind}) has no "
                    f"constructability collision proxy: {diagnostic.reason}."
                ),
                element_ids=[diagnostic.element_id],
            )
        )
    return violations


def _matrix_hard_clash_violations(
    participants: list[PhysicalParticipant],
    elements: dict[str, Element],
) -> list[Violation]:
    violations: list[Violation] = []
    emitted: set[tuple[str, tuple[str, str]]] = set()
    for i, a in enumerate(participants):
        for b in participants[i + 1 :]:
            cell = hard_clash_cell_for(a, b)
            if cell is None:
                continue
            if not _same_or_unknown_level(a, b):
                continue
            if _has_allowed_host_relation(a, b, elements):
                continue
            if duplicate_cell_for(a, b) is not None and _aabb_equivalent(
                a.aabb, b.aabb, tolerance_mm=cell.tolerance_mm
            ):
                continue
            if not aabb_overlaps(a.aabb, b.aabb, tolerance_mm=cell.tolerance_mm):
                continue
            element_ids = tuple(sorted([a.element_id, b.element_id]))
            key = (cell.rule_id, element_ids)
            if key in emitted:
                continue
            emitted.add(key)
            violations.append(
                Violation(
                    rule_id=cell.rule_id,
                    severity=cell.severity,
                    message=cell.message,
                    element_ids=list(element_ids),
                )
            )
    return violations


def _matrix_duplicate_geometry_violations(
    participants: list[PhysicalParticipant],
    elements: dict[str, Element],
) -> list[Violation]:
    violations: list[Violation] = []
    emitted: set[tuple[str, tuple[str, str]]] = set()
    for i, a in enumerate(participants):
        for b in participants[i + 1 :]:
            cell = duplicate_cell_for(a, b)
            if cell is None:
                continue
            if not _same_or_unknown_level(a, b):
                continue
            if _has_allowed_host_relation(a, b, elements):
                continue
            if not _aabb_equivalent(a.aabb, b.aabb, tolerance_mm=cell.tolerance_mm):
                continue
            element_ids = tuple(sorted([a.element_id, b.element_id]))
            key = (cell.rule_id, element_ids)
            if key in emitted:
                continue
            emitted.add(key)
            violations.append(
                Violation(
                    rule_id=cell.rule_id,
                    severity=cell.severity,
                    message=cell.message,
                    element_ids=list(element_ids),
                )
            )
    return violations


def _mep_wall_penetration_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    openings_by_wall_id: dict[str, list[_WallOpeningProxy]],
) -> list[Violation]:
    violations: list[Violation] = []
    walls = participants_by_kind.get("wall", [])
    if not walls:
        return violations

    for kind, rule_id, label in (
        ("pipe", "pipe_wall_penetration_without_opening", "Pipe"),
        ("duct", "duct_wall_penetration_without_opening", "Duct"),
    ):
        for service in participants_by_kind.get(kind, []):
            for wall in walls:
                if not _same_or_unknown_level(service, wall):
                    continue
                if not aabb_overlaps(service.aabb, wall.aabb, tolerance_mm=_CLASH_TOLERANCE_MM):
                    continue
                if _penetration_has_opening(
                    service, wall, openings_by_wall_id.get(wall.element_id, [])
                ):
                    continue
                violations.append(
                    Violation(
                        rule_id=rule_id,
                        severity="warning",
                        message=(
                            f"{label} crosses a wall collision proxy without a matching wall opening; "
                            "add a sleeve/opening or reroute the service."
                        ),
                        element_ids=sorted([service.element_id, wall.element_id]),
                    )
                )
    return violations


def _mep_floor_ceiling_penetration_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    elements: dict[str, Element],
) -> list[Violation]:
    violations: list[Violation] = []
    slab_openings_by_floor = _slab_openings_by_floor_id(elements)
    service_specs = (
        (
            "pipe",
            "pipe_floor_penetration_without_opening",
            "pipe_ceiling_penetration_without_opening",
            "Pipe",
        ),
        (
            "duct",
            "duct_floor_penetration_without_opening",
            "duct_ceiling_penetration_without_opening",
            "Duct",
        ),
    )
    for service_kind, floor_rule, ceiling_rule, label in service_specs:
        for service in participants_by_kind.get(service_kind, []):
            for floor in participants_by_kind.get("floor", []):
                if not _same_or_unknown_level(service, floor):
                    continue
                if not aabb_overlaps(service.aabb, floor.aabb, tolerance_mm=_CLASH_TOLERANCE_MM):
                    continue
                if _participant_has_slab_opening(
                    service, slab_openings_by_floor.get(floor.element_id, [])
                ):
                    continue
                violations.append(
                    Violation(
                        rule_id=floor_rule,
                        severity="warning",
                        message=(
                            f"{label} crosses a floor collision proxy without a matching slab opening; "
                            "add a shaft/sleeve opening or reroute the service."
                        ),
                        element_ids=sorted([service.element_id, floor.element_id]),
                    )
                )
            for ceiling in participants_by_kind.get("ceiling", []):
                if not _same_or_unknown_level(service, ceiling):
                    continue
                if not aabb_overlaps(service.aabb, ceiling.aabb, tolerance_mm=_CLASH_TOLERANCE_MM):
                    continue
                violations.append(
                    Violation(
                        rule_id=ceiling_rule,
                        severity="warning",
                        message=(
                            f"{label} crosses a ceiling collision proxy without a modeled route opening; "
                            "add an opening/plenum condition or reroute the service."
                        ),
                        element_ids=sorted([service.element_id, ceiling.element_id]),
                    )
                )
    return violations


def _stair_floor_opening_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    elements: dict[str, Element],
) -> list[Violation]:
    violations: list[Violation] = []
    slab_openings_by_floor = _slab_openings_by_floor_id(elements)
    for stair in participants_by_kind.get("stair", []):
        for floor in participants_by_kind.get("floor", []):
            if floor.aabb.min_z <= stair.aabb.min_z + _CLASH_TOLERANCE_MM:
                continue
            if floor.aabb.min_z > stair.aabb.max_z + _CLASH_TOLERANCE_MM:
                continue
            if not aabb_overlaps(stair.aabb, floor.aabb, tolerance_mm=_CLASH_TOLERANCE_MM):
                continue
            if _participant_has_slab_opening(
                stair, slab_openings_by_floor.get(floor.element_id, [])
            ):
                continue
            violations.append(
                Violation(
                    rule_id="stair_floor_penetration_without_slab_opening",
                    severity="warning",
                    message=(
                        "Stair envelope reaches an upper floor without a matching slab/shaft "
                        "opening; add a stair opening or revise the stair/floor layout."
                    ),
                    element_ids=sorted([stair.element_id, floor.element_id]),
                )
            )
    return violations


def _door_clearance_violations(
    elements: dict[str, Element],
    participants_by_kind: dict[str, list[PhysicalParticipant]],
) -> list[Violation]:
    obstructions = [
        participant
        for kind in ("placed_asset", "family_instance")
        for participant in participants_by_kind.get(kind, [])
    ]
    if not obstructions:
        return []

    walls_by_id = {
        element.id: element for element in elements.values() if isinstance(element, WallElem)
    }
    violations: list[Violation] = []
    for element in elements.values():
        if not isinstance(element, DoorElem):
            continue
        wall = walls_by_id.get(element.wall_id)
        if wall is None:
            continue
        clearance = _door_clearance_aabb(element, wall)
        if clearance is None:
            continue
        for obstruction in obstructions:
            source = elements.get(obstruction.element_id)
            if getattr(source, "host_element_id", None) == wall.id:
                continue
            if not _levels_compatible(getattr(source, "level_id", None), wall.level_id):
                continue
            if aabb_overlaps(clearance, obstruction.aabb, tolerance_mm=_CLASH_TOLERANCE_MM):
                violations.append(
                    Violation(
                        rule_id="door_operation_clearance_conflict",
                        severity="warning",
                        message="Door operation clearance overlaps a placed object; the door may not open.",
                        element_ids=sorted([element.id, obstruction.element_id]),
                    )
                )
    return violations


def _load_bearing_metadata_violations(walls_by_id: dict[str, WallElem]) -> list[Violation]:
    violations: list[Violation] = []
    for wall in walls_by_id.values():
        props = wall.props or {}
        if not _truthy_prop(
            props, "primaryEnvelope", "isExternal", "exterior", "requiresStructuralIntent"
        ):
            continue
        if wall.load_bearing is not None or wall.structural_role != "unknown":
            continue
        violations.append(
            Violation(
                rule_id="wall_load_bearing_unknown_primary_envelope",
                severity="warning",
                message=(
                    "Primary/envelope wall has no load-bearing intent; classify it before relying "
                    "on structural constructability checks."
                ),
                element_ids=[wall.id],
            )
        )
    return violations


def _large_opening_violations(
    elements: dict[str, Element],
    walls_by_id: dict[str, WallElem],
) -> list[Violation]:
    violations: list[Violation] = []
    for element in elements.values():
        wall_id = _opening_wall_id(element)
        if wall_id is None:
            continue
        wall = walls_by_id.get(wall_id)
        if wall is None or not _is_load_bearing_wall(wall):
            continue
        width = _opening_width_mm(element, wall)
        if width is None:
            continue
        wall_length = wall_length_mm(wall)
        if (
            width < _LARGE_OPENING_MIN_WIDTH_MM
            and width / max(wall_length, 1.0) < _LARGE_OPENING_WALL_RATIO
        ):
            continue
        if _opening_has_structural_resolution(element):
            continue
        violations.append(
            Violation(
                rule_id="large_opening_in_load_bearing_wall_unresolved",
                severity="warning",
                message=(
                    "Large opening is hosted in a load-bearing wall without recorded lintel/header "
                    "or structural review metadata."
                ),
                element_ids=sorted([wall.id, str(element.id)]),
            )
        )
    return violations


def _stacked_load_path_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    walls_by_id: dict[str, WallElem],
) -> list[Violation]:
    load_bearing_walls = [
        wall
        for wall in participants_by_kind.get("wall", [])
        if _is_load_bearing_wall(walls_by_id.get(wall.element_id))
    ]
    if not load_bearing_walls:
        return []

    lowest_base_z = min(wall.aabb.min_z for wall in load_bearing_walls)
    supports = [
        *load_bearing_walls,
        *participants_by_kind.get("column", []),
    ]
    violations: list[Violation] = []
    for wall in load_bearing_walls:
        if wall.aabb.min_z <= lowest_base_z + _SUPPORT_TOLERANCE_MM:
            continue
        if any(_support_under_stacked_wall(wall, support) for support in supports):
            continue
        violations.append(
            Violation(
                rule_id="stacked_load_path_discontinuity",
                severity="warning",
                message=(
                    "Load-bearing wall starts above the lowest bearing level without a modeled "
                    "wall or column support below it."
                ),
                element_ids=[wall.element_id],
            )
        )
    return violations


def _unsupported_beam_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    elements: dict[str, Element],
    walls_by_id: dict[str, WallElem],
) -> list[Violation]:
    supports = [
        *participants_by_kind.get("column", []),
        *[
            participant
            for participant in participants_by_kind.get("wall", [])
            if _is_load_bearing_wall(walls_by_id.get(participant.element_id))
        ],
    ]
    if not supports:
        return [
            Violation(
                rule_id="beam_without_support",
                severity="warning",
                message="Beam has no modeled columns or load-bearing walls available as supports.",
                element_ids=[beam.element_id],
            )
            for beam in participants_by_kind.get("beam", [])
        ]

    violations: list[Violation] = []
    for beam in participants_by_kind.get("beam", []):
        beam_element = elements.get(beam.element_id)
        explicit_start = str(getattr(beam_element, "start_column_id", "") or "")
        explicit_end = str(getattr(beam_element, "end_column_id", "") or "")
        if (
            explicit_start
            and explicit_end
            and explicit_start in elements
            and explicit_end in elements
        ):
            continue
        endpoints = _beam_endpoint_boxes(beam)
        supported_count = sum(
            1
            for endpoint in endpoints
            if any(
                aabb_overlaps(endpoint, support.aabb, tolerance_mm=_SUPPORT_TOLERANCE_MM)
                for support in supports
            )
        )
        if supported_count < 2:
            violations.append(
                Violation(
                    rule_id="beam_without_support",
                    severity="warning",
                    message="Beam endpoint is not near two modeled supports; add columns/load-bearing walls or link explicit supports.",
                    element_ids=[beam.element_id],
                )
            )
    return violations


def _unsupported_column_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    walls_by_id: dict[str, WallElem],
) -> list[Violation]:
    columns = participants_by_kind.get("column", [])
    if not columns:
        return []

    lowest_base = min(column.aabb.min_z for column in columns)
    supports = [
        *participants_by_kind.get("floor", []),
        *[
            participant
            for participant in participants_by_kind.get("wall", [])
            if _is_load_bearing_wall(walls_by_id.get(participant.element_id))
        ],
    ]
    violations: list[Violation] = []
    for column in columns:
        if column.aabb.min_z <= lowest_base + _SUPPORT_TOLERANCE_MM:
            continue
        lower_columns = [
            other
            for other in columns
            if other.element_id != column.element_id and other.aabb.max_z <= column.aabb.min_z
        ]
        if any(_support_under_column(column, support) for support in [*supports, *lower_columns]):
            continue
        violations.append(
            Violation(
                rule_id="column_without_foundation_or_support",
                severity="warning",
                message="Column starts above the lowest modeled column base without a lower support or floor under it.",
                element_ids=[column.element_id],
            )
        )
    return violations


class _WallOpeningProxy:
    def __init__(
        self,
        element_id: str,
        wall_id: str,
        t_start: float,
        t_end: float,
        z_min: float,
        z_max: float,
    ):
        self.element_id = element_id
        self.wall_id = wall_id
        self.t_start = min(t_start, t_end)
        self.t_end = max(t_start, t_end)
        self.z_min = min(z_min, z_max)
        self.z_max = max(z_min, z_max)


def _openings_by_wall_id(
    elements: dict[str, Element],
    walls_by_id: dict[str, WallElem],
) -> dict[str, list[_WallOpeningProxy]]:
    out: dict[str, list[_WallOpeningProxy]] = defaultdict(list)
    for element in elements.values():
        wall_id = _opening_wall_id(element)
        if wall_id is None:
            continue
        wall = walls_by_id.get(wall_id)
        if wall is None:
            continue
        width = _opening_width_mm(element, wall)
        if width is None:
            continue
        wall_length = max(wall_length_mm(wall), 1.0)
        center_t = _opening_center_t(element)
        half_t = min(0.5, (width / wall_length) / 2.0)
        z_min, z_max = _opening_z_range(element)
        out[wall_id].append(
            _WallOpeningProxy(
                str(element.id), wall_id, center_t - half_t, center_t + half_t, z_min, z_max
            )
        )
    return out


def _slab_openings_by_floor_id(elements: dict[str, Element]) -> dict[str, list[SlabOpeningElem]]:
    out: dict[str, list[SlabOpeningElem]] = defaultdict(list)
    for element in elements.values():
        if isinstance(element, SlabOpeningElem):
            out[element.host_floor_id].append(element)
    return out


def _participant_has_slab_opening(
    participant: PhysicalParticipant,
    openings: list[SlabOpeningElem],
) -> bool:
    if not openings:
        return False
    x, y = _aabb_center_xy(participant.aabb)
    return any(_point_in_polygon_mm(x, y, opening.boundary_mm) for opening in openings)


def _aabb_center_xy(aabb: AABB) -> tuple[float, float]:
    return ((aabb.min_x + aabb.max_x) / 2.0, (aabb.min_y + aabb.max_y) / 2.0)


def _point_in_polygon_mm(x: float, y: float, points: Any) -> bool:
    polygon = [(float(point.x_mm), float(point.y_mm)) for point in points]
    if len(polygon) < 3:
        return False

    inside = False
    previous_x, previous_y = polygon[-1]
    for current_x, current_y in polygon:
        denominator = previous_y - current_y
        crosses_scanline = (current_y > y) != (previous_y > y)
        if crosses_scanline and abs(denominator) > 1e-9:
            x_at_y = (previous_x - current_x) * (y - current_y) / denominator + current_x
            if x < x_at_y:
                inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside


def _penetration_has_opening(
    service: PhysicalParticipant,
    wall: PhysicalParticipant,
    openings: list[_WallOpeningProxy],
) -> bool:
    if not openings:
        return False
    t = _service_wall_t(service.aabb, wall.aabb)
    z = (service.aabb.min_z + service.aabb.max_z) / 2.0
    for opening in openings:
        z_min = wall.aabb.min_z + opening.z_min
        z_max = wall.aabb.min_z + opening.z_max
        if (
            opening.t_start - 0.05 <= t <= opening.t_end + 0.05
            and z_min - 50.0 <= z <= z_max + 50.0
        ):
            return True
    return False


def _service_wall_t(service: AABB, wall: AABB) -> float:
    service_x = (service.min_x + service.max_x) / 2.0
    service_y = (service.min_y + service.max_y) / 2.0
    if wall.width_mm >= wall.depth_mm:
        return _clamp01((service_x - wall.min_x) / max(wall.width_mm, 1.0))
    return _clamp01((service_y - wall.min_y) / max(wall.depth_mm, 1.0))


def _door_clearance_aabb(door: DoorElem, wall: WallElem) -> AABB | None:
    wall_len = wall_length_mm(wall)
    if wall_len <= 0:
        return None
    ux, uy = wall_unit_dir(wall)
    nx, ny = -uy, ux
    cx = float(wall.start.x_mm) + (float(wall.end.x_mm) - float(wall.start.x_mm)) * door.along_t
    cy = float(wall.start.y_mm) + (float(wall.end.y_mm) - float(wall.start.y_mm)) * door.along_t
    half_along = max(float(door.width_mm) / 2.0, 450.0)
    swing_depth = max(float(door.width_mm), 750.0)
    points = [
        (cx - ux * half_along - nx * swing_depth, cy - uy * half_along - ny * swing_depth),
        (cx + ux * half_along - nx * swing_depth, cy + uy * half_along - ny * swing_depth),
        (cx - ux * half_along + nx * swing_depth, cy - uy * half_along + ny * swing_depth),
        (cx + ux * half_along + nx * swing_depth, cy + uy * half_along + ny * swing_depth),
    ]
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return AABB(min(xs), min(ys), -1_000_000.0, max(xs), max(ys), 1_000_000.0)


def _beam_endpoint_boxes(beam: PhysicalParticipant) -> list[AABB]:
    half = _SUPPORT_TOLERANCE_MM / 2.0
    z_min = beam.aabb.min_z - half
    z_max = beam.aabb.max_z + half
    endpoints: list[tuple[float, float]]
    if beam.aabb.width_mm >= beam.aabb.depth_mm:
        cy = (beam.aabb.min_y + beam.aabb.max_y) / 2.0
        endpoints = [(beam.aabb.min_x, cy), (beam.aabb.max_x, cy)]
    else:
        cx = (beam.aabb.min_x + beam.aabb.max_x) / 2.0
        endpoints = [(cx, beam.aabb.min_y), (cx, beam.aabb.max_y)]
    return [AABB(x - half, y - half, z_min, x + half, y + half, z_max) for x, y in endpoints]


def _support_under_column(column: PhysicalParticipant, support: PhysicalParticipant) -> bool:
    vertical_gap = column.aabb.min_z - support.aabb.max_z
    if vertical_gap < -_SUPPORT_TOLERANCE_MM or vertical_gap > _SUPPORT_TOLERANCE_MM:
        return False
    return not (
        column.aabb.max_x < support.aabb.min_x - _SUPPORT_TOLERANCE_MM
        or support.aabb.max_x < column.aabb.min_x - _SUPPORT_TOLERANCE_MM
        or column.aabb.max_y < support.aabb.min_y - _SUPPORT_TOLERANCE_MM
        or support.aabb.max_y < column.aabb.min_y - _SUPPORT_TOLERANCE_MM
    )


def _support_under_stacked_wall(
    upper_wall: PhysicalParticipant,
    support: PhysicalParticipant,
) -> bool:
    if upper_wall.element_id == support.element_id:
        return False
    vertical_gap = upper_wall.aabb.min_z - support.aabb.max_z
    if vertical_gap < -_SUPPORT_TOLERANCE_MM or vertical_gap > _SUPPORT_TOLERANCE_MM:
        return False
    return not (
        upper_wall.aabb.max_x < support.aabb.min_x - _SUPPORT_TOLERANCE_MM
        or support.aabb.max_x < upper_wall.aabb.min_x - _SUPPORT_TOLERANCE_MM
        or upper_wall.aabb.max_y < support.aabb.min_y - _SUPPORT_TOLERANCE_MM
        or support.aabb.max_y < upper_wall.aabb.min_y - _SUPPORT_TOLERANCE_MM
    )


def _opening_wall_id(element: Any) -> str | None:
    if isinstance(element, (DoorElem, WindowElem)):
        return element.wall_id
    if isinstance(element, WallOpeningElem):
        return element.host_wall_id
    return None


def _opening_center_t(element: Any) -> float:
    if isinstance(element, (DoorElem, WindowElem)):
        return float(element.along_t)
    if isinstance(element, WallOpeningElem):
        return (float(element.along_t_start) + float(element.along_t_end)) / 2.0
    return 0.5


def _opening_width_mm(element: Any, wall: WallElem) -> float | None:
    if isinstance(element, (DoorElem, WindowElem)):
        return float(element.width_mm)
    if isinstance(element, WallOpeningElem):
        return abs(float(element.along_t_end) - float(element.along_t_start)) * wall_length_mm(wall)
    return None


def _opening_z_range(element: Any) -> tuple[float, float]:
    if isinstance(element, DoorElem):
        return (0.0, 2100.0)
    if isinstance(element, WindowElem):
        return (float(element.sill_height_mm), float(element.sill_height_mm + element.height_mm))
    if isinstance(element, WallOpeningElem):
        return (float(element.sill_height_mm), float(element.head_height_mm))
    return (0.0, 0.0)


def _opening_has_structural_resolution(element: Any) -> bool:
    props = getattr(element, "props", None) or {}
    return _truthy_prop(
        props,
        "lintelDesigned",
        "headerDesigned",
        "structuralReviewed",
        "structuralReviewApproved",
        "openingReinforced",
    )


def _is_load_bearing_wall(wall: WallElem | None) -> bool:
    if wall is None:
        return False
    return wall.load_bearing is True or wall.structural_role == "load_bearing"


def _same_or_unknown_level(a: PhysicalParticipant, b: PhysicalParticipant) -> bool:
    return _levels_compatible(a.level_id, b.level_id)


def _has_allowed_host_relation(
    a: PhysicalParticipant,
    b: PhysicalParticipant,
    elements: dict[str, Element],
) -> bool:
    elem_a = elements.get(a.element_id)
    elem_b = elements.get(b.element_id)
    return _is_hosted_by(elem_a, b.element_id) or _is_hosted_by(elem_b, a.element_id)


def _is_hosted_by(element: Any, host_element_id: str) -> bool:
    if element is None:
        return False
    host_ids = (
        getattr(element, "host_element_id", None),
        getattr(element, "host_wall_id", None),
        getattr(element, "wall_id", None),
    )
    return host_element_id in {str(host_id) for host_id in host_ids if host_id}


def _aabb_equivalent(a: AABB, b: AABB, *, tolerance_mm: float) -> bool:
    return (
        abs(a.min_x - b.min_x) <= tolerance_mm
        and abs(a.min_y - b.min_y) <= tolerance_mm
        and abs(a.min_z - b.min_z) <= tolerance_mm
        and abs(a.max_x - b.max_x) <= tolerance_mm
        and abs(a.max_y - b.max_y) <= tolerance_mm
        and abs(a.max_z - b.max_z) <= tolerance_mm
    )


def _levels_compatible(a: Any, b: Any) -> bool:
    return not a or not b or str(a) == str(b)


def _truthy_prop(props: dict[str, Any], *keys: str) -> bool:
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


def _clamp01(value: float) -> float:
    if not math.isfinite(value):
        return 0.5
    return min(1.0, max(0.0, value))
