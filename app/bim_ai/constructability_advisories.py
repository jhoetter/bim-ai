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
    candidate_pairs_by_aabb,
    collect_physical_participants,
    collect_unsupported_physical_diagnostics,
    participants_overlap_narrow_phase,
)
from bim_ai.constructability_matrix import (
    DEFAULT_CONSTRUCTABILITY_MATRIX,
    ConstructabilityCheckType,
    ConstructabilityMatrixCell,
    duplicate_cell_for,
    hard_clash_cell_for,
    matrix_for_profile,
)
from bim_ai.elements import (
    BeamElem,
    ColumnElem,
    DoorElem,
    Element,
    FloorElem,
    GridLineElem,
    RailingElem,
    RoofElem,
    RoofOpeningElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)

_CLASH_TOLERANCE_MM = 1.0
_SUPPORT_TOLERANCE_MM = 300.0
_LARGE_OPENING_MIN_WIDTH_MM = 1800.0
_LARGE_OPENING_WALL_RATIO = 0.4
_FLOOR_SPAN_METADATA_THRESHOLD_MM = 9000.0
_STAIR_HEADROOM_CLEARANCE_MM = 2050.0
_LOW_ROOF_SLOPE_DEG = 2.0


def constructability_advisory_violations(
    elements: dict[str, Element],
    *,
    profile: str = "authoring_default",
) -> list[Violation]:
    matrix = matrix_for_profile(profile)
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
    violations.extend(_matrix_duplicate_geometry_violations(participants, elements, matrix))
    violations.extend(_matrix_hard_clash_violations(participants, elements, matrix))
    violations.extend(
        _mep_wall_penetration_violations(participants_by_kind, openings_by_wall_id, elements)
    )
    violations.extend(_mep_floor_ceiling_penetration_violations(participants_by_kind, elements))
    violations.extend(_stair_floor_opening_violations(participants_by_kind, elements))
    violations.extend(_stair_headroom_violations(participants_by_kind))
    violations.extend(_stair_landing_guardrail_violations(elements))
    violations.extend(_room_door_access_violations(elements, walls_by_id))
    violations.extend(_door_clearance_violations(elements, participants_by_kind))
    violations.extend(_window_operation_clearance_violations(elements, participants_by_kind))
    violations.extend(_load_bearing_metadata_violations(walls_by_id))
    violations.extend(_large_opening_violations(elements, walls_by_id))
    violations.extend(_load_bearing_wall_removed_violations(walls_by_id))
    violations.extend(_stacked_load_path_violations(participants_by_kind, walls_by_id))
    violations.extend(_floor_span_metadata_violations(participants_by_kind, elements))
    violations.extend(_floor_boundary_support_violations(participants_by_kind, elements))
    violations.extend(_roof_wall_coverage_violations(participants_by_kind, walls_by_id))
    violations.extend(_roof_low_slope_metadata_violations(elements))
    violations.extend(_roof_opening_violations(elements))
    violations.extend(_structural_material_by_type_violations(elements))
    violations.extend(_structural_bays_missing_grid_violations(elements))
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
    matrix: tuple[ConstructabilityMatrixCell, ...],
) -> list[Violation]:
    violations: list[Violation] = []
    emitted: set[tuple[str, tuple[str, str]]] = set()
    candidates = candidate_pairs_by_aabb(
        participants,
        tolerance_mm=_matrix_max_tolerance("hard", matrix),
    )
    for a, b in candidates:
        cell = hard_clash_cell_for(a, b, matrix=matrix)
        if cell is None:
            continue
        if not _same_or_unknown_level(a, b):
            continue
        if _has_allowed_host_relation(a, b, elements):
            continue
        if duplicate_cell_for(a, b, matrix=matrix) is not None and _aabb_equivalent(
            a.aabb, b.aabb, tolerance_mm=cell.tolerance_mm
        ):
            continue
        if not participants_overlap_narrow_phase(a, b, tolerance_mm=cell.tolerance_mm):
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
    matrix: tuple[ConstructabilityMatrixCell, ...],
) -> list[Violation]:
    violations: list[Violation] = []
    emitted: set[tuple[str, tuple[str, str]]] = set()
    candidates = candidate_pairs_by_aabb(
        participants,
        tolerance_mm=_matrix_max_tolerance("duplicate", matrix),
    )
    for a, b in candidates:
        cell = duplicate_cell_for(a, b, matrix=matrix)
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


def _matrix_max_tolerance(
    check_type: ConstructabilityCheckType,
    matrix: tuple[ConstructabilityMatrixCell, ...] = DEFAULT_CONSTRUCTABILITY_MATRIX,
) -> float:
    return max(
        (float(cell.tolerance_mm) for cell in matrix if cell.check_type == check_type),
        default=0.0,
    )


def _mep_wall_penetration_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    openings_by_wall_id: dict[str, list[_WallOpeningProxy]],
    elements: dict[str, Element],
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
                if _service_penetration_approved(service, wall.element_id, elements):
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
                if _service_penetration_approved(service, floor.element_id, elements):
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
                if _service_penetration_approved(service, ceiling.element_id, elements):
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


def _stair_headroom_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
) -> list[Violation]:
    violations: list[Violation] = []
    for stair in participants_by_kind.get("stair", []):
        for obstruction_kind, label in (("ceiling", "ceiling"), ("roof", "roof")):
            for overhead in participants_by_kind.get(obstruction_kind, []):
                if overhead.aabb.max_z <= stair.aabb.min_z:
                    continue
                if not _aabb_plan_overlaps(
                    stair.aabb,
                    overhead.aabb,
                    tolerance_mm=_CLASH_TOLERANCE_MM,
                ):
                    continue
                available_mm = overhead.aabb.min_z - stair.aabb.min_z
                if available_mm >= _STAIR_HEADROOM_CLEARANCE_MM:
                    continue
                violations.append(
                    Violation(
                        rule_id="stair_headroom_clearance_conflict",
                        severity="warning",
                        message=(
                            f"Stair headroom below the {label} is approximately "
                            f"{available_mm:.0f} mm; provide at least "
                            f"{_STAIR_HEADROOM_CLEARANCE_MM:.0f} mm clear headroom or revise "
                            "the stair/overhead geometry."
                        ),
                        element_ids=sorted([stair.element_id, overhead.element_id]),
                    )
                )
    return violations


def _stair_landing_guardrail_violations(elements: dict[str, Element]) -> list[Violation]:
    railings_by_stair_id: dict[str, list[RailingElem]] = defaultdict(list)
    for element in elements.values():
        if isinstance(element, RailingElem) and element.hosted_stair_id:
            railings_by_stair_id[element.hosted_stair_id].append(element)

    violations: list[Violation] = []
    for element in elements.values():
        if not isinstance(element, StairElem):
            continue
        rise_mm = _stair_rise_mm(element, elements)
        if _stair_needs_intermediate_landing(element, rise_mm) and not element.landings:
            violations.append(
                Violation(
                    rule_id="stair_landing_missing",
                    severity="warning",
                    message=(
                        "Stair geometry requires an intermediate landing but no landing polygon "
                        "is modeled."
                    ),
                    element_ids=[element.id],
                )
            )

        if rise_mm is None or rise_mm <= 600.0:
            continue
        hosted_railings = railings_by_stair_id.get(element.id, [])
        if not hosted_railings:
            violations.append(
                Violation(
                    rule_id="stair_guardrail_missing",
                    severity="warning",
                    message=(
                        "Stair rise exceeds the guardrail threshold without a hosted railing."
                    ),
                    element_ids=[element.id],
                )
            )
            continue
        low_railings = [
            railing.id for railing in hosted_railings if float(railing.guard_height_mm) < 900.0
        ]
        if low_railings:
            violations.append(
                Violation(
                    rule_id="stair_guardrail_height_insufficient",
                    severity="warning",
                    message=(
                        "Hosted stair railing guard height is below the constructability "
                        "threshold of 900 mm."
                    ),
                    element_ids=sorted([element.id, *low_railings]),
                )
            )
    return violations


def _door_clearance_violations(
    elements: dict[str, Element],
    participants_by_kind: dict[str, list[PhysicalParticipant]],
) -> list[Violation]:
    obstructions = [
        participant
        for kind in ("placed_asset", "family_instance", "wall")
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
            if obstruction.element_id == wall.id:
                continue
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
                        message=(
                            "Door operation clearance overlaps "
                            f"{_door_obstruction_label(obstruction)}; the door may not open."
                        ),
                        element_ids=sorted([element.id, obstruction.element_id]),
                    )
                )
    return violations


def _room_door_access_violations(
    elements: dict[str, Element],
    walls_by_id: dict[str, WallElem],
) -> list[Violation]:
    doors_by_level: dict[str, list[tuple[DoorElem, tuple[float, float]]]] = defaultdict(list)
    for element in elements.values():
        if not isinstance(element, DoorElem):
            continue
        wall = walls_by_id.get(element.wall_id)
        if wall is None:
            continue
        doors_by_level[wall.level_id].append((element, _door_midpoint(element, wall)))

    violations: list[Violation] = []
    rooms_by_level: dict[str, list[RoomElem]] = defaultdict(list)
    door_rooms: dict[str, list[str]] = defaultdict(list)
    for element in elements.values():
        if not isinstance(element, RoomElem):
            continue
        rooms_by_level[element.level_id].append(element)
        outline = [(float(p.x_mm), float(p.y_mm)) for p in element.outline_mm]
        if len(outline) < 3:
            continue
        accessible_doors = [
            door
            for door, midpoint in doors_by_level.get(element.level_id, [])
            if _point_in_or_near_polygon(midpoint, outline, tolerance_mm=250.0)
        ]
        for door in accessible_doors:
            door_rooms[door.id].append(element.id)
        if accessible_doors:
            continue
        violations.append(
            Violation(
                rule_id="room_without_door_access",
                severity="warning",
                message=(
                    "Room has no door midpoint on or inside its boundary; add a connected "
                    "door opening or revise the room boundary."
                ),
                element_ids=[element.id],
            )
        )
    violations.extend(
        _room_egress_graph_violations(
            rooms_by_level,
            doors_by_level,
            door_rooms,
            walls_by_id,
        )
    )
    return violations


def _room_egress_graph_violations(
    rooms_by_level: dict[str, list[RoomElem]],
    doors_by_level: dict[str, list[tuple[DoorElem, tuple[float, float]]]],
    door_rooms: dict[str, list[str]],
    walls_by_id: dict[str, WallElem],
) -> list[Violation]:
    violations: list[Violation] = []
    for level_id, rooms in rooms_by_level.items():
        exit_door_ids = {
            door.id
            for door, _midpoint in doors_by_level.get(level_id, [])
            if _is_exit_door(door, walls_by_id)
        }
        if not exit_door_ids:
            continue
        connected: dict[str, set[str]] = defaultdict(set)
        exit_rooms: set[str] = set()
        for door_id, room_ids in door_rooms.items():
            if door_id in exit_door_ids:
                exit_rooms.update(room_ids)
            for a in room_ids:
                for b in room_ids:
                    if a != b:
                        connected[a].add(b)
        reachable = _reachable_rooms(exit_rooms, connected)
        for room in rooms:
            if room.id in reachable:
                continue
            if not _door_rooms_for_room(room.id, door_rooms):
                continue
            violations.append(
                Violation(
                    rule_id="room_without_egress_path",
                    severity="warning",
                    message=(
                        "Room has a connected door but no traversable room-door path to an "
                        "exit door on the same level."
                    ),
                    element_ids=[room.id],
                )
            )
    return violations


def _reachable_rooms(start: set[str], connected: dict[str, set[str]]) -> set[str]:
    reachable: set[str] = set(start)
    pending = list(start)
    while pending:
        room_id = pending.pop()
        for next_room_id in connected.get(room_id, set()):
            if next_room_id in reachable:
                continue
            reachable.add(next_room_id)
            pending.append(next_room_id)
    return reachable


def _door_rooms_for_room(room_id: str, door_rooms: dict[str, list[str]]) -> list[str]:
    return [door_id for door_id, room_ids in door_rooms.items() if room_id in room_ids]


def _is_exit_door(door: DoorElem, walls_by_id: dict[str, WallElem]) -> bool:
    props = door.props or {}
    if _truthy_prop(props, "egressDoor", "exitDoor", "requiredExit", "exteriorDoor"):
        return True
    wall = walls_by_id.get(door.wall_id)
    return wall is not None and _is_primary_envelope_wall(wall)


def _window_operation_clearance_violations(
    elements: dict[str, Element],
    participants_by_kind: dict[str, list[PhysicalParticipant]],
) -> list[Violation]:
    obstructions = [
        participant
        for kind in ("placed_asset", "family_instance", "wall")
        for participant in participants_by_kind.get(kind, [])
    ]
    if not obstructions:
        return []

    walls_by_id = {
        element.id: element for element in elements.values() if isinstance(element, WallElem)
    }
    violations: list[Violation] = []
    for element in elements.values():
        if not isinstance(element, WindowElem):
            continue
        wall = walls_by_id.get(element.wall_id)
        if wall is None:
            continue
        clearance = _window_clearance_aabb(element, wall)
        if clearance is None:
            continue
        for obstruction in obstructions:
            if obstruction.element_id == wall.id:
                continue
            source = elements.get(obstruction.element_id)
            if getattr(source, "host_element_id", None) == wall.id:
                continue
            if not _levels_compatible(getattr(source, "level_id", None), wall.level_id):
                continue
            if aabb_overlaps(clearance, obstruction.aabb, tolerance_mm=_CLASH_TOLERANCE_MM):
                violations.append(
                    Violation(
                        rule_id="window_operation_clearance_conflict",
                        severity="warning",
                        message=(
                            "Window operation/maintenance clearance overlaps "
                            f"{_door_obstruction_label(obstruction)}; revise nearby objects "
                            "or the window/opening."
                        ),
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


def _load_bearing_wall_removed_violations(walls_by_id: dict[str, WallElem]) -> list[Violation]:
    violations: list[Violation] = []
    for wall in walls_by_id.values():
        if not _is_load_bearing_wall(wall):
            continue
        if not _wall_marked_removed(wall):
            continue
        if _wall_has_transfer_resolution(wall):
            continue
        violations.append(
            Violation(
                rule_id="load_bearing_wall_removed_without_transfer",
                severity="warning",
                message=(
                    "Load-bearing wall is marked demolished/removed without transfer beam, "
                    "temporary works, or structural review metadata."
                ),
                element_ids=[wall.id],
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
        *participants_by_kind.get("beam", []),
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
                    "wall, column, or beam support below it."
                ),
                element_ids=[wall.element_id],
            )
        )
    return violations


def _floor_span_metadata_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    elements: dict[str, Element],
) -> list[Violation]:
    violations: list[Violation] = []
    for floor_participant in participants_by_kind.get("floor", []):
        floor = elements.get(floor_participant.element_id)
        if not isinstance(floor, FloorElem):
            continue
        span_mm = max(floor_participant.aabb.width_mm, floor_participant.aabb.depth_mm)
        if span_mm <= _FLOOR_SPAN_METADATA_THRESHOLD_MM:
            continue
        if _floor_has_structural_system_metadata(floor):
            continue
        violations.append(
            Violation(
                rule_id="floor_span_without_support_metadata",
                severity="warning",
                message=(
                    "Floor span exceeds the default constructability threshold without "
                    "structural system, beam grid, or engineering review metadata."
                ),
                element_ids=[floor.id],
            )
        )
    return violations


def _roof_wall_coverage_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    walls_by_id: dict[str, WallElem],
) -> list[Violation]:
    roofs = participants_by_kind.get("roof", [])
    if not roofs:
        return []

    violations: list[Violation] = []
    for wall_participant in participants_by_kind.get("wall", []):
        wall = walls_by_id.get(wall_participant.element_id)
        if wall is None or not _is_primary_envelope_wall(wall):
            continue
        if any(
            _aabb_plan_covers(roof.aabb, wall_participant.aabb, tolerance_mm=100.0)
            for roof in roofs
        ):
            continue
        violations.append(
            Violation(
                rule_id="roof_wall_coverage_gap",
                severity="warning",
                message=(
                    "Primary/envelope wall is outside the modeled roof footprint; revise the "
                    "roof overhang/footprint or wall envelope alignment."
                ),
                element_ids=[wall.id],
            )
        )
    return violations


def _floor_boundary_support_violations(
    participants_by_kind: dict[str, list[PhysicalParticipant]],
    elements: dict[str, Element],
) -> list[Violation]:
    walls = participants_by_kind.get("wall", [])
    if not walls:
        return []
    violations: list[Violation] = []
    for floor_participant in participants_by_kind.get("floor", []):
        floor = elements.get(floor_participant.element_id)
        if not isinstance(floor, FloorElem):
            continue
        props = floor.props or {}
        if not _truthy_prop(props, "requiresBoundaryWallSupport", "requiresPerimeterSupport"):
            continue
        boundary = [(float(p.x_mm), float(p.y_mm)) for p in floor.boundary_mm]
        unsupported_edges = [
            index
            for index, (a, b) in enumerate(zip(boundary, boundary[1:] + boundary[:1], strict=False))
            if not _floor_edge_has_wall_support(a, b, floor_participant, walls)
        ]
        if not unsupported_edges:
            continue
        violations.append(
            Violation(
                rule_id="floor_boundary_without_wall_support",
                severity="warning",
                message=(
                    "Floor requires perimeter wall support but has unsupported boundary "
                    f"edge(s): {unsupported_edges}."
                ),
                element_ids=[floor.id],
            )
        )
    return violations


def _roof_low_slope_metadata_violations(elements: dict[str, Element]) -> list[Violation]:
    violations: list[Violation] = []
    for element in elements.values():
        if not isinstance(element, RoofElem):
            continue
        slope = element.slope_deg
        if slope is None or float(slope) > _LOW_ROOF_SLOPE_DEG:
            continue
        if _roof_has_low_slope_resolution(element):
            continue
        violations.append(
            Violation(
                rule_id="roof_low_slope_without_drainage_metadata",
                severity="warning",
                message=(
                    f"Roof slope is {float(slope):.1f} degrees without flat-roof/drainage "
                    "constructability metadata; add tapered insulation, drainage, or review data."
                ),
                element_ids=[element.id],
            )
        )
    return violations


def _roof_opening_violations(elements: dict[str, Element]) -> list[Violation]:
    violations: list[Violation] = []
    for element in elements.values():
        if not isinstance(element, RoofOpeningElem):
            continue
        host = elements.get(element.host_roof_id)
        if not isinstance(host, RoofElem):
            violations.append(
                Violation(
                    rule_id="roof_opening_missing_host",
                    severity="warning",
                    message="Roof opening references a missing or non-roof host.",
                    element_ids=[element.id],
                )
            )
            continue
        roof_polygon = [(float(point.x_mm), float(point.y_mm)) for point in host.footprint_mm]
        opening_polygon = [(float(point.x_mm), float(point.y_mm)) for point in element.boundary_mm]
        outside_vertices = [
            point
            for point in opening_polygon
            if not _point_in_or_near_polygon(point, roof_polygon, tolerance_mm=50.0)
        ]
        if outside_vertices:
            violations.append(
                Violation(
                    rule_id="roof_opening_outside_host_footprint",
                    severity="warning",
                    message=(
                        "Roof opening footprint extends outside the host roof footprint; revise "
                        "the void boundary or host roof."
                    ),
                    element_ids=sorted([element.id, host.id]),
                )
            )
        roof_area = _polygon_area_abs_mm2(roof_polygon)
        opening_area = _polygon_area_abs_mm2(opening_polygon)
        if (
            roof_area > 0.0
            and opening_area / roof_area > 0.25
            and not _roof_opening_has_structural_review(element, host)
        ):
            violations.append(
                Violation(
                    rule_id="roof_opening_large_void_without_review",
                    severity="warning",
                    message=(
                        "Roof opening removes more than 25% of the host roof footprint without "
                        "structural/curb framing review metadata."
                    ),
                    element_ids=sorted([element.id, host.id]),
                )
            )
    return violations


def _roof_opening_has_structural_review(opening: RoofOpeningElem, host: RoofElem) -> bool:
    opening_props = getattr(opening, "props", None) or {}
    if _truthy_prop(
        opening_props,
        "structuralReviewed",
        "structuralReviewApproved",
        "curbFramingDesigned",
        "trimmerFramingDesigned",
    ):
        return True
    host_props = host.props or {}
    if _truthy_prop(
        host_props,
        "roofOpeningsStructurallyReviewed",
        "roofVoidFramingDesigned",
        "curbFramingDesigned",
        "trimmerFramingDesigned",
    ):
        return True
    approved_ids = {
        str(value)
        for key in (
            "approvedRoofOpeningIds",
            "structurallyReviewedRoofOpeningIds",
            "curbFramedRoofOpeningIds",
        )
        for value in _coerce_sequence(host_props.get(key))
    }
    return opening.id in approved_ids


def _coerce_sequence(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return list(value)
    return [value]


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


def _stair_rise_mm(stair: StairElem, elements: dict[str, Element]) -> float | None:
    if stair.total_rise_mm is not None:
        return float(stair.total_rise_mm)
    base = _element_level_elevation_mm(elements, stair.base_level_id)
    top = _element_level_elevation_mm(elements, stair.top_level_id)
    if base is None or top is None:
        return None
    return max(0.0, top - base)


def _element_level_elevation_mm(elements: dict[str, Element], level_id: str | None) -> float | None:
    if not level_id:
        return None
    level = elements.get(level_id)
    elevation = getattr(level, "elevation_mm", None)
    if elevation is None:
        return None
    return float(elevation)


def _stair_needs_intermediate_landing(stair: StairElem, rise_mm: float | None) -> bool:
    if stair.shape in {"l_shape", "u_shape"} and len(stair.runs) > 1:
        return True
    return rise_mm is not None and rise_mm > 3700.0


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


def _window_clearance_aabb(window: WindowElem, wall: WallElem) -> AABB | None:
    wall_len = wall_length_mm(wall)
    if wall_len <= 0:
        return None
    ux, uy = wall_unit_dir(wall)
    nx, ny = -uy, ux
    cx = float(wall.start.x_mm) + (float(wall.end.x_mm) - float(wall.start.x_mm)) * window.along_t
    cy = float(wall.start.y_mm) + (float(wall.end.y_mm) - float(wall.start.y_mm)) * window.along_t
    half_along = max(float(window.width_mm) / 2.0, 450.0)
    operation_depth = max(600.0, float(window.width_mm) * 0.35)
    points = [
        (cx - ux * half_along - nx * operation_depth, cy - uy * half_along - ny * operation_depth),
        (cx + ux * half_along - nx * operation_depth, cy + uy * half_along - ny * operation_depth),
        (cx - ux * half_along + nx * operation_depth, cy - uy * half_along + ny * operation_depth),
        (cx + ux * half_along + nx * operation_depth, cy + uy * half_along + ny * operation_depth),
    ]
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    base_z = float(window.sill_height_mm)
    top_z = float(window.sill_height_mm + window.height_mm)
    return AABB(min(xs), min(ys), base_z, max(xs), max(ys), top_z)


def _door_midpoint(door: DoorElem, wall: WallElem) -> tuple[float, float]:
    t = max(0.0, min(1.0, float(door.along_t)))
    x = float(wall.start.x_mm) + (float(wall.end.x_mm) - float(wall.start.x_mm)) * t
    y = float(wall.start.y_mm) + (float(wall.end.y_mm) - float(wall.start.y_mm)) * t
    return (x, y)


def _door_obstruction_label(obstruction: PhysicalParticipant) -> str:
    if obstruction.kind == "wall":
        return "a wall"
    return "a placed object"


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


def _wall_marked_removed(wall: WallElem) -> bool:
    if getattr(wall, "phase_demolished", None):
        return True
    props = wall.props or {}
    return _truthy_prop(props, "demolished", "removed", "toBeRemoved", "phaseDemolished")


def _wall_has_transfer_resolution(wall: WallElem) -> bool:
    props = wall.props or {}
    return _truthy_prop(
        props,
        "transferDesigned",
        "transferBeamDesigned",
        "temporaryWorksDesigned",
        "structuralReviewed",
        "structuralReviewApproved",
        "loadPathTransferred",
    )


def _is_primary_envelope_wall(wall: WallElem) -> bool:
    props = wall.props or {}
    return _truthy_prop(
        props,
        "primaryEnvelope",
        "isExternal",
        "exterior",
        "requiresEnvelopeAlignment",
    )


def _aabb_plan_covers(container: AABB, contained: AABB, *, tolerance_mm: float) -> bool:
    tol = max(0.0, float(tolerance_mm))
    return (
        container.min_x <= contained.min_x + tol
        and container.max_x >= contained.max_x - tol
        and container.min_y <= contained.min_y + tol
        and container.max_y >= contained.max_y - tol
    )


def _aabb_plan_overlaps(a: AABB, b: AABB, *, tolerance_mm: float) -> bool:
    tol = max(0.0, float(tolerance_mm))
    return not (
        a.max_x + tol < b.min_x
        or b.max_x + tol < a.min_x
        or a.max_y + tol < b.min_y
        or b.max_y + tol < a.min_y
    )


def _point_in_or_near_polygon(
    point: tuple[float, float],
    polygon: list[tuple[float, float]],
    *,
    tolerance_mm: float,
) -> bool:
    if _point_in_polygon(point, polygon):
        return True
    return any(
        _point_segment_distance_mm(point, a, b) <= tolerance_mm
        for a, b in zip(polygon, polygon[1:] + polygon[:1], strict=False)
    )


def _point_in_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i, pi in enumerate(polygon):
        xi, yi = pi
        xj, yj = polygon[j]
        denom = yj - yi
        if abs(denom) < 1e-9:
            denom = 1e-9
        intersects = (yi > y) != (yj > y) and (x < (xj - xi) * (y - yi) / denom + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


def _point_segment_distance_mm(
    point: tuple[float, float],
    a: tuple[float, float],
    b: tuple[float, float],
) -> float:
    px, py = point
    ax, ay = a
    bx, by = b
    dx = bx - ax
    dy = by - ay
    length_sq = dx * dx + dy * dy
    if length_sq <= 1e-9:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    closest_x = ax + t * dx
    closest_y = ay + t * dy
    return math.hypot(px - closest_x, py - closest_y)


def _polygon_area_abs_mm2(polygon: list[tuple[float, float]]) -> float:
    if len(polygon) < 3:
        return 0.0
    total = 0.0
    for a, b in zip(polygon, polygon[1:] + polygon[:1], strict=False):
        total += a[0] * b[1] - b[0] * a[1]
    return abs(total) / 2.0


def _floor_edge_has_wall_support(
    a: tuple[float, float],
    b: tuple[float, float],
    floor: PhysicalParticipant,
    walls: list[PhysicalParticipant],
) -> bool:
    mid = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
    for wall in walls:
        if not _levels_compatible(floor.level_id, wall.level_id):
            continue
        if _point_in_aabb_plan(mid, wall.aabb, tolerance_mm=250.0):
            return True
        wall_mid = (
            (wall.aabb.min_x + wall.aabb.max_x) / 2.0,
            (wall.aabb.min_y + wall.aabb.max_y) / 2.0,
        )
        if _point_segment_distance_mm(wall_mid, a, b) <= 250.0:
            return True
    return False


def _point_in_aabb_plan(
    point: tuple[float, float],
    aabb: AABB,
    *,
    tolerance_mm: float,
) -> bool:
    x, y = point
    return (
        aabb.min_x - tolerance_mm <= x <= aabb.max_x + tolerance_mm
        and aabb.min_y - tolerance_mm <= y <= aabb.max_y + tolerance_mm
    )


def _floor_has_structural_system_metadata(floor: FloorElem) -> bool:
    props = floor.props or {}
    if _truthy_prop(
        props,
        "spanResolved",
        "engineeredFloor",
        "structuralReviewed",
        "structuralReviewApproved",
    ):
        return True
    for key in (
        "structuralSystem",
        "structuralSystemId",
        "supportSystem",
        "beamGridId",
        "joistSpacingMm",
        "spanDirection",
    ):
        value = props.get(key)
        if value not in (None, "", []):
            return True
    return False


def _roof_has_low_slope_resolution(roof: RoofElem) -> bool:
    props = roof.props or {}
    return _truthy_prop(
        props,
        "flatRoofSystem",
        "roofDrainageDesigned",
        "stormDrainageDesigned",
        "taperedInsulation",
        "drainageReviewed",
        "structuralReviewApproved",
    )


def _service_penetration_approved(
    service: PhysicalParticipant,
    host_element_id: str,
    elements: dict[str, Element],
) -> bool:
    element = elements.get(service.element_id)
    props = getattr(element, "props", None) or {}
    if _truthy_prop(
        props,
        "penetrationApproved",
        "penetrationReviewed",
        "sleeveApproved",
        "constructabilityPenetrationApproved",
    ):
        return True
    for key in (
        "approvedPenetrationHostIds",
        "approvedWallPenetrationIds",
        "approvedFloorPenetrationIds",
        "approvedCeilingPenetrationIds",
        "sleeveHostIds",
    ):
        values = props.get(key)
        if isinstance(values, str) and values == host_element_id:
            return True
        if isinstance(values, list) and host_element_id in {str(value) for value in values}:
            return True
    return False


def _structural_material_by_type_violations(elements: dict[str, Element]) -> list[Violation]:
    grouped: dict[str, list[Element]] = defaultdict(list)
    for element in elements.values():
        key = _structural_type_key(element)
        if key:
            grouped[key].append(element)

    violations: list[Violation] = []
    for type_key, group in grouped.items():
        by_material: dict[str, list[str]] = defaultdict(list)
        for element in group:
            material = _structural_material_token(element)
            if material:
                by_material[material].append(element.id)
        if len(by_material) <= 1:
            continue
        violations.append(
            Violation(
                rule_id="structural_material_inconsistent_by_type",
                severity="warning",
                message=(
                    "Structural elements sharing the same type have inconsistent structural "
                    f"materials ({type_key}); align the type material or split the type."
                ),
                element_ids=sorted(element.id for element in group),
            )
        )
    return violations


def _structural_bays_missing_grid_violations(elements: dict[str, Element]) -> list[Violation]:
    framing_ids = sorted(
        element.id for element in elements.values() if isinstance(element, (BeamElem, ColumnElem))
    )
    if len(framing_ids) < 4:
        return []
    grid_count = sum(1 for element in elements.values() if isinstance(element, GridLineElem))
    if grid_count >= 2:
        return []
    return [
        Violation(
            rule_id="structural_bays_missing_grids",
            severity="warning",
            message=(
                "Repeated structural beams/columns are modeled without enough grid lines; "
                "add grids to document the bay layout and support coordination."
            ),
            element_ids=framing_ids,
        )
    ]


def _structural_type_key(element: Element) -> str:
    if isinstance(element, WallElem) and element.wall_type_id:
        return f"wall:{element.wall_type_id}"
    if isinstance(element, FloorElem) and element.floor_type_id:
        return f"floor:{element.floor_type_id}"
    if isinstance(element, RoofElem) and element.roof_type_id:
        return f"roof:{element.roof_type_id}"
    return ""


def _structural_material_token(element: Element) -> str:
    for attr in ("structural_material", "structural_material_key", "material_key"):
        value = getattr(element, attr, None)
        token = str(value or "").strip()
        if token:
            return token
    return ""


def _is_load_bearing_wall(wall: WallElem | None) -> bool:
    if wall is None:
        return False
    return wall.load_bearing is True or wall.structural_role in {
        "load_bearing",
        "bearing_wall",
        "shear_wall",
    }


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
