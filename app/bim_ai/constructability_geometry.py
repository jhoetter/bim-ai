from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any

from bim_ai.elements import DEFAULT_DISCIPLINE_BY_KIND, Element, LevelElem


@dataclass(frozen=True)
class AABB:
    """Axis-aligned bounding box in model-space millimetres."""

    min_x: float
    min_y: float
    min_z: float
    max_x: float
    max_y: float
    max_z: float

    @property
    def width_mm(self) -> float:
        return self.max_x - self.min_x

    @property
    def depth_mm(self) -> float:
        return self.max_y - self.min_y

    @property
    def height_mm(self) -> float:
        return self.max_z - self.min_z


@dataclass(frozen=True)
class PhysicalParticipant:
    element_id: str
    kind: str
    category: str
    discipline: str | None
    level_id: str | None
    aabb: AABB
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class UnsupportedPhysicalDiagnostic:
    element_id: str
    kind: str
    reason: str


_PHYSICAL_KINDS = {
    "wall",
    "floor",
    "roof",
    "ceiling",
    "stair",
    "railing",
    "column",
    "beam",
    "pipe",
    "duct",
    "dormer",
    "placed_asset",
    "family_instance",
    "family_kit_instance",
    "toposolid",
}

_DIAGNOSTIC_PHYSICAL_KINDS = _PHYSICAL_KINDS | {
    "balcony",
    "mass",
    "soffit",
    "sweep",
}


def aabb_overlaps(a: AABB, b: AABB, *, tolerance_mm: float = 0.0) -> bool:
    tol = max(0.0, float(tolerance_mm))
    return not (
        a.max_x + tol < b.min_x
        or b.max_x + tol < a.min_x
        or a.max_y + tol < b.min_y
        or b.max_y + tol < a.min_y
        or a.max_z + tol < b.min_z
        or b.max_z + tol < a.min_z
    )


def aabb_distance_mm(a: AABB, b: AABB) -> float:
    sx = _interval_gap(a.min_x, a.max_x, b.min_x, b.max_x)
    sy = _interval_gap(a.min_y, a.max_y, b.min_y, b.max_y)
    sz = _interval_gap(a.min_z, a.max_z, b.min_z, b.max_z)
    return math.sqrt(sx * sx + sy * sy + sz * sz)


def participants_overlap(
    a: PhysicalParticipant,
    b: PhysicalParticipant,
    *,
    tolerance_mm: float = 0.0,
) -> bool:
    return aabb_overlaps(a.aabb, b.aabb, tolerance_mm=tolerance_mm)


def participants_overlap_narrow_phase(
    a: PhysicalParticipant,
    b: PhysicalParticipant,
    *,
    tolerance_mm: float = 0.0,
) -> bool:
    """Confirm participant overlap after broad-phase pruning."""

    if not _z_intervals_overlap(a.aabb, b.aabb, tolerance_mm=tolerance_mm):
        return False
    footprint_a = _metadata_footprint(a)
    footprint_b = _metadata_footprint(b)
    if footprint_a is None or footprint_b is None:
        return aabb_overlaps(a.aabb, b.aabb, tolerance_mm=tolerance_mm)
    return _convex_polygons_overlap_2d(
        footprint_a,
        footprint_b,
        tolerance_mm=tolerance_mm,
    )


def participant_distance_mm(a: PhysicalParticipant, b: PhysicalParticipant) -> float:
    return aabb_distance_mm(a.aabb, b.aabb)


def candidate_pairs_by_aabb(
    participants: list[PhysicalParticipant],
    *,
    tolerance_mm: float = 0.0,
) -> list[tuple[PhysicalParticipant, PhysicalParticipant]]:
    """Deterministic sweep-and-prune broad phase for overlapping participant AABBs."""

    tol = max(0.0, float(tolerance_mm))
    ordered = sorted(
        participants,
        key=lambda participant: (
            participant.aabb.min_x,
            participant.aabb.min_y,
            participant.aabb.min_z,
            participant.element_id,
        ),
    )
    pairs: list[tuple[PhysicalParticipant, PhysicalParticipant]] = []
    for index, a in enumerate(ordered):
        for b in ordered[index + 1 :]:
            if b.aabb.min_x > a.aabb.max_x + tol:
                break
            if aabb_overlaps(a.aabb, b.aabb, tolerance_mm=tol):
                pairs.append((a, b))
    return pairs


def collect_physical_participants(elements: dict[str, Element]) -> list[PhysicalParticipant]:
    participants: list[PhysicalParticipant] = []
    for eid in sorted(elements):
        participant = physical_participant_for_element(elements[eid], elements)
        if participant is not None:
            participants.append(participant)
    return participants


def collect_unsupported_physical_diagnostics(
    elements: dict[str, Element],
) -> list[UnsupportedPhysicalDiagnostic]:
    diagnostics: list[UnsupportedPhysicalDiagnostic] = []
    for eid in sorted(elements):
        elem = elements[eid]
        kind = str(getattr(elem, "kind", ""))
        if kind not in _DIAGNOSTIC_PHYSICAL_KINDS:
            continue
        if physical_participant_for_element(elem, elements) is None:
            diagnostics.append(
                UnsupportedPhysicalDiagnostic(
                    element_id=eid,
                    kind=kind,
                    reason=_unsupported_reason(elem, elements),
                )
            )
    return diagnostics


def physical_collision_contract_summary_v1(elements: dict[str, Element]) -> dict[str, Any]:
    """Auditable coverage summary for the constructability collision contract."""

    participants = collect_physical_participants(elements)
    unsupported = collect_unsupported_physical_diagnostics(elements)
    participant_counts: dict[str, int] = {}
    unsupported_counts: dict[str, int] = {}
    for participant in participants:
        participant_counts[participant.kind] = participant_counts.get(participant.kind, 0) + 1
    for diagnostic in unsupported:
        unsupported_counts[diagnostic.kind] = unsupported_counts.get(diagnostic.kind, 0) + 1
    return {
        "format": "physicalCollisionContractSummary_v1",
        "participantCount": len(participants),
        "unsupportedDiagnosticCount": len(unsupported),
        "participantCountsByKind": dict(sorted(participant_counts.items())),
        "unsupportedCountsByKind": dict(sorted(unsupported_counts.items())),
        "unsupportedDiagnostics": [
            {
                "elementId": diagnostic.element_id,
                "kind": diagnostic.kind,
                "reason": diagnostic.reason,
            }
            for diagnostic in unsupported
        ],
    }


def physical_participant_for_element(
    elem: Element,
    elements: dict[str, Element],
) -> PhysicalParticipant | None:
    kind = str(getattr(elem, "kind", ""))
    builders = {
        "wall": _aabb_for_wall,
        "floor": _aabb_for_floor,
        "roof": _aabb_for_roof,
        "ceiling": _aabb_for_ceiling,
        "stair": _aabb_for_stair,
        "railing": _aabb_for_railing,
        "column": _aabb_for_column,
        "beam": _aabb_for_beam,
        "pipe": _aabb_for_pipe,
        "duct": _aabb_for_duct,
        "dormer": _aabb_for_dormer,
        "placed_asset": _aabb_for_placed_asset,
        "family_instance": _aabb_for_family_instance,
        "family_kit_instance": _aabb_for_family_kit_instance,
        "toposolid": _aabb_for_toposolid,
    }
    builder = builders.get(kind)
    if builder is None:
        return None
    aabb = builder(elem, elements)
    if aabb is None:
        return None
    level_id = _element_level_id(elem)
    return PhysicalParticipant(
        element_id=str(elem.id),
        kind=kind,
        category=kind,
        discipline=_discipline_for(elem),
        level_id=level_id,
        aabb=aabb,
        metadata=_metadata_for(elem, elements, aabb),
    )


def _interval_gap(a_min: float, a_max: float, b_min: float, b_max: float) -> float:
    if a_max < b_min:
        return b_min - a_max
    if b_max < a_min:
        return a_min - b_max
    return 0.0


def _level_elevation_mm(elements: dict[str, Element], level_id: str | None) -> float:
    level = elements.get(level_id or "")
    return float(level.elevation_mm) if isinstance(level, LevelElem) else 0.0


def _element_level_id(elem: Any) -> str | None:
    for attr in ("level_id", "reference_level_id", "base_level_id"):
        value = getattr(elem, attr, None)
        if value:
            return str(value)
    return None


def _discipline_for(elem: Any) -> str | None:
    discipline = getattr(elem, "discipline", None)
    if discipline:
        return str(discipline)
    return DEFAULT_DISCIPLINE_BY_KIND.get(str(getattr(elem, "kind", "")))


def _metadata_for(elem: Any, elements: dict[str, Element], aabb: AABB) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for attr in (
        "name",
        "wall_type_id",
        "floor_type_id",
        "roof_type_id",
        "family_type_id",
        "asset_id",
        "system_type",
        "shape",
    ):
        value = getattr(elem, attr, None)
        if value is not None:
            metadata[attr] = value
    footprint = _footprint_for_element(elem, elements, aabb)
    if footprint is not None:
        metadata["footprintMm"] = footprint
    return metadata


def _metadata_footprint(participant: PhysicalParticipant) -> list[tuple[float, float]] | None:
    raw = participant.metadata.get("footprintMm")
    if not isinstance(raw, list) or len(raw) < 3:
        return None
    points: list[tuple[float, float]] = []
    for point in raw:
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            return None
        points.append((float(point[0]), float(point[1])))
    return points


def _z_intervals_overlap(a: AABB, b: AABB, *, tolerance_mm: float) -> bool:
    tol = max(0.0, float(tolerance_mm))
    return not (a.max_z + tol < b.min_z or b.max_z + tol < a.min_z)


def _convex_polygons_overlap_2d(
    a: list[tuple[float, float]],
    b: list[tuple[float, float]],
    *,
    tolerance_mm: float,
) -> bool:
    for polygon in (a, b):
        for p0, p1 in zip(polygon, polygon[1:] + polygon[:1], strict=False):
            axis = (-(p1[1] - p0[1]), p1[0] - p0[0])
            length = math.hypot(axis[0], axis[1])
            if length <= 1e-9:
                continue
            unit = (axis[0] / length, axis[1] / length)
            a_min, a_max = _project_polygon(a, unit)
            b_min, b_max = _project_polygon(b, unit)
            if a_max + tolerance_mm < b_min or b_max + tolerance_mm < a_min:
                return False
    return True


def _project_polygon(
    polygon: list[tuple[float, float]],
    axis: tuple[float, float],
) -> tuple[float, float]:
    values = [point[0] * axis[0] + point[1] * axis[1] for point in polygon]
    return (min(values), max(values))


def _footprint_for_element(
    elem: Any,
    elements: dict[str, Element],
    aabb: AABB,
) -> list[tuple[float, float]] | None:
    kind = str(getattr(elem, "kind", ""))
    if kind == "wall":
        return _wall_footprint(elem)
    if kind == "floor":
        return [(float(point.x_mm), float(point.y_mm)) for point in elem.boundary_mm]
    if kind == "roof":
        return [(float(point.x_mm), float(point.y_mm)) for point in elem.footprint_mm]
    if kind == "toposolid":
        return [(float(point.x_mm), float(point.y_mm)) for point in elem.boundary_mm]
    if kind == "dormer":
        host = elements.get(getattr(elem, "host_roof_id", "") or "")
        if host is not None and getattr(host, "kind", None) == "roof":
            return _dormer_footprint_points(elem, host)
    if kind == "placed_asset":
        entry = elements.get(elem.asset_id)
        width = (
            _dimension_from_sources(
                elem.param_values,
                getattr(entry, "param_schema", None),
                ("widthMm", "lengthMm", "diameterMm", "bMm"),
            )
            or aabb.width_mm
        )
        depth = (
            _dimension_from_sources(
                elem.param_values,
                getattr(entry, "param_schema", None),
                ("depthMm", "diameterMm", "hMm"),
            )
            or aabb.depth_mm
        )
        return _centered_rect_footprint(elem.position_mm, width, depth, float(elem.rotation_deg))
    if kind == "family_instance":
        family_type = elements.get(elem.family_type_id)
        type_params = getattr(family_type, "parameters", None)
        width = (
            _dimension_from_sources(
                elem.param_values,
                type_params,
                ("widthMm", "lengthMm", "diameterMm", "bMm"),
            )
            or aabb.width_mm
        )
        depth = (
            _dimension_from_sources(
                elem.param_values,
                type_params,
                ("depthMm", "diameterMm", "hMm"),
            )
            or aabb.depth_mm
        )
        return _centered_rect_footprint(elem.position_mm, width, depth, float(elem.rotation_deg))
    return _aabb_plan_footprint(aabb)


def _wall_footprint(elem: Any) -> list[tuple[float, float]] | None:
    sx = float(elem.start.x_mm)
    sy = float(elem.start.y_mm)
    ex = float(elem.end.x_mm)
    ey = float(elem.end.y_mm)
    dx = ex - sx
    dy = ey - sy
    length = math.hypot(dx, dy)
    if length <= 1e-9:
        return None
    nx = -dy / length
    ny = dx / length
    half = float(elem.thickness_mm) / 2.0
    return [
        (sx + nx * half, sy + ny * half),
        (ex + nx * half, ey + ny * half),
        (ex - nx * half, ey - ny * half),
        (sx - nx * half, sy - ny * half),
    ]


def _centered_rect_footprint(
    center: Any,
    width_mm: float,
    depth_mm: float,
    rotation_deg: float,
) -> list[tuple[float, float]]:
    cx = float(center.x_mm)
    cy = float(center.y_mm)
    half_w = float(width_mm) / 2.0
    half_d = float(depth_mm) / 2.0
    theta = math.radians(rotation_deg)
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)
    points = [(-half_w, -half_d), (half_w, -half_d), (half_w, half_d), (-half_w, half_d)]
    return [(cx + x * cos_t - y * sin_t, cy + x * sin_t + y * cos_t) for x, y in points]


def _aabb_plan_footprint(aabb: AABB) -> list[tuple[float, float]]:
    return [
        (aabb.min_x, aabb.min_y),
        (aabb.max_x, aabb.min_y),
        (aabb.max_x, aabb.max_y),
        (aabb.min_x, aabb.max_y),
    ]


def _bounds_from_points(
    points: list[tuple[float, float]], min_z: float, max_z: float
) -> AABB | None:
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return AABB(min(xs), min(ys), min_z, max(xs), max(ys), max_z)


def _line_box_aabb(
    start: Any,
    end: Any,
    width_mm: float,
    min_z: float,
    max_z: float,
) -> AABB | None:
    sx, sy = float(start.x_mm), float(start.y_mm)
    ex, ey = float(end.x_mm), float(end.y_mm)
    dx = ex - sx
    dy = ey - sy
    length = math.hypot(dx, dy)
    if length < 1e-6:
        half = float(width_mm) / 2.0
        return AABB(sx - half, sy - half, min_z, sx + half, sy + half, max_z)
    half = float(width_mm) / 2.0
    nx = -dy / length
    ny = dx / length
    points = [
        (sx + nx * half, sy + ny * half),
        (sx - nx * half, sy - ny * half),
        (ex + nx * half, ey + ny * half),
        (ex - nx * half, ey - ny * half),
    ]
    return _bounds_from_points(points, min_z, max_z)


def _centered_rotated_box_aabb(
    center: Any,
    width_mm: float,
    depth_mm: float,
    min_z: float,
    max_z: float,
    rotation_deg: float,
) -> AABB:
    cx, cy = float(center.x_mm), float(center.y_mm)
    half_w = float(width_mm) / 2.0
    half_d = float(depth_mm) / 2.0
    rad = math.radians(float(rotation_deg))
    cos_r = math.cos(rad)
    sin_r = math.sin(rad)
    corners = []
    for lx, ly in (
        (-half_w, -half_d),
        (-half_w, half_d),
        (half_w, -half_d),
        (half_w, half_d),
    ):
        corners.append((cx + lx * cos_r - ly * sin_r, cy + lx * sin_r + ly * cos_r))
    wrapped = _bounds_from_points(corners, min_z, max_z)
    assert wrapped is not None
    return wrapped


def _aabb_for_wall(elem: Any, elements: dict[str, Element]) -> AABB | None:
    level_id = elem.base_constraint_level_id or elem.level_id
    min_z = _level_elevation_mm(elements, level_id) + float(elem.base_constraint_offset_mm)
    if elem.top_constraint_level_id:
        max_z = _level_elevation_mm(elements, elem.top_constraint_level_id) + float(
            elem.top_constraint_offset_mm
        )
        if max_z <= min_z:
            max_z = min_z + float(elem.height_mm)
    else:
        max_z = min_z + float(elem.height_mm)
    return _line_box_aabb(elem.start, elem.end, float(elem.thickness_mm), min_z, max_z)


def _aabb_for_floor(elem: Any, elements: dict[str, Element]) -> AABB | None:
    base_z = _level_elevation_mm(elements, elem.level_id)
    return _bounds_from_points(
        [(float(p.x_mm), float(p.y_mm)) for p in elem.boundary_mm],
        base_z,
        base_z + float(elem.thickness_mm),
    )


def _aabb_for_roof(elem: Any, elements: dict[str, Element]) -> AABB | None:
    footprint = [(float(p.x_mm), float(p.y_mm)) for p in elem.footprint_mm]
    if not footprint:
        return None
    overhang = max(0.0, float(getattr(elem, "overhang_mm", 0.0) or 0.0))
    xs = [p[0] for p in footprint]
    ys = [p[1] for p in footprint]
    min_x, max_x = min(xs) - overhang, max(xs) + overhang
    min_y, max_y = min(ys) - overhang, max(ys) + overhang
    base_z = _level_elevation_mm(elements, elem.reference_level_id)
    slope_deg = getattr(elem, "slope_deg", None)
    rise = 0.0
    if slope_deg is not None:
        run = min(max_x - min_x, max_y - min_y) / 2.0
        rise = abs(math.tan(math.radians(float(slope_deg)))) * max(0.0, run)
    return AABB(min_x, min_y, base_z, max_x, max_y, base_z + max(300.0, rise + 300.0))


def _aabb_for_toposolid(elem: Any, elements: dict[str, Element]) -> AABB | None:
    del elements
    footprint = [(float(point.x_mm), float(point.y_mm)) for point in getattr(elem, "boundary_mm", [])]
    if len(footprint) < 3:
        return None

    samples: list[float] = []
    grid = getattr(elem, "heightmap_grid_mm", None)
    if grid is not None:
        samples.extend(float(value) for value in getattr(grid, "values", []) or [])
    else:
        samples.extend(float(sample.z_mm) for sample in getattr(elem, "height_samples", []) or [])

    top_z = max(samples) if samples else float(getattr(elem, "base_elevation_mm", None) or 0.0)
    base_elevation = getattr(elem, "base_elevation_mm", None)
    if base_elevation is not None:
        underside_z = float(base_elevation) - float(getattr(elem, "thickness_mm", 1500.0) or 1500.0)
    elif samples:
        underside_z = min(samples) - float(getattr(elem, "thickness_mm", 1500.0) or 1500.0)
    else:
        underside_z = top_z - float(getattr(elem, "thickness_mm", 1500.0) or 1500.0)
    if underside_z >= top_z:
        underside_z = top_z - max(1.0, float(getattr(elem, "thickness_mm", 1500.0) or 1500.0))
    return _bounds_from_points(footprint, underside_z, top_z)


def _aabb_for_dormer(elem: Any, elements: dict[str, Element]) -> AABB | None:
    host = elements.get(getattr(elem, "host_roof_id", "") or "")
    if host is None or getattr(host, "kind", None) != "roof":
        return None
    footprint = _dormer_footprint_points(elem, host)
    if not footprint:
        return None
    center_x = sum(point[0] for point in footprint) / len(footprint)
    center_y = sum(point[1] for point in footprint) / len(footprint)
    base_z = _roof_height_at_point_mm(host, elements, center_x, center_y) - 75.0
    wall_height = max(500.0, float(getattr(elem, "wall_height_mm", 0.0) or 0.0))
    roof_kind = str(getattr(elem, "dormer_roof_kind", "") or "flat")
    roof_rise = 150.0
    if roof_kind in {"gable", "hipped"}:
        roof_rise = max(100.0, float(getattr(elem, "ridge_height_mm", 0.0) or 1200.0))
    elif roof_kind == "shed":
        pitch = float(getattr(elem, "dormer_roof_pitch_deg", 0.0) or 8.0)
        run = max(100.0, float(getattr(elem, "depth_mm", 0.0) or 0.0))
        roof_rise = max(100.0, abs(math.tan(math.radians(pitch))) * run)
    return _bounds_from_points(footprint, base_z, base_z + wall_height + roof_rise + 150.0)


def _dormer_footprint_points(elem: Any, host_roof: Any) -> list[tuple[float, float]] | None:
    footprint = [(float(p.x_mm), float(p.y_mm)) for p in getattr(host_roof, "footprint_mm", [])]
    if not footprint:
        return None
    xs = [p[0] for p in footprint]
    ys = [p[1] for p in footprint]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = max_x - min_x
    span_y = max_y - min_y
    ridge_axis = getattr(host_roof, "ridge_axis", None)
    ridge_along_x = True if ridge_axis == "x" else False if ridge_axis == "z" else span_x >= span_y
    position = getattr(elem, "position_on_roof", None)
    along = float(getattr(position, "along_ridge_mm", 0.0) if position is not None else 0.0)
    across = float(getattr(position, "across_ridge_mm", 0.0) if position is not None else 0.0)
    center_x = (min_x + max_x) / 2.0 + (along if ridge_along_x else across)
    center_y = (min_y + max_y) / 2.0 + (across if ridge_along_x else along)
    half_width = float(getattr(elem, "width_mm", 0.0) or 0.0) / 2.0
    half_depth = float(getattr(elem, "depth_mm", 0.0) or 0.0) / 2.0
    if ridge_along_x:
        x0, x1 = center_x - half_width, center_x + half_width
        y0, y1 = center_y - half_depth, center_y + half_depth
    else:
        x0, x1 = center_x - half_depth, center_x + half_depth
        y0, y1 = center_y - half_width, center_y + half_width
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def _roof_height_at_point_mm(
    roof: Any,
    elements: dict[str, Element],
    x_mm: float,
    y_mm: float,
) -> float:
    ref_z = _level_elevation_mm(elements, getattr(roof, "reference_level_id", None))
    walls_at_ref = [
        e
        for e in elements.values()
        if getattr(e, "kind", None) == "wall"
        and getattr(e, "level_id", None) == getattr(roof, "reference_level_id", None)
    ]
    wall_top = max((float(getattr(w, "height_mm", 0.0) or 0.0) for w in walls_at_ref), default=0.0)
    eave_z = ref_z + wall_top
    if getattr(roof, "roof_geometry_mode", None) == "mass_box":
        return eave_z
    footprint = [(float(p.x_mm), float(p.y_mm)) for p in getattr(roof, "footprint_mm", [])]
    if not footprint:
        return eave_z
    xs = [p[0] for p in footprint]
    ys = [p[1] for p in footprint]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = max_x - min_x
    span_y = max_y - min_y
    slope_deg = min(70.0, max(5.0, float(getattr(roof, "slope_deg", None) or 25.0)))
    tan = math.tan(math.radians(slope_deg))
    ridge_axis = getattr(roof, "ridge_axis", None)
    ridge_along_x = True if ridge_axis == "x" else False if ridge_axis == "z" else span_x >= span_y
    mode = getattr(roof, "roof_geometry_mode", None)
    if mode == "asymmetric_gable":
        offset = float(getattr(roof, "ridge_offset_transverse_mm", 0.0) or 0.0)
        eave_left = (
            ref_z + float(getattr(roof, "eave_height_left_mm", 0.0))
            if getattr(roof, "eave_height_left_mm", None) is not None
            else eave_z
        )
        eave_right = (
            ref_z + float(getattr(roof, "eave_height_right_mm", 0.0))
            if getattr(roof, "eave_height_right_mm", None) is not None
            else eave_z
        )
        if ridge_along_x:
            half_span = span_y / 2.0
            ridge_y = (min_y + max_y) / 2.0 + max(-half_span + 1e-6, min(half_span - 1e-6, offset))
            left_run = ridge_y - min_y
            ridge_z = eave_left + left_run * tan
            if y_mm <= ridge_y:
                t = 0.0 if left_run <= 0 else max(0.0, min(1.0, (y_mm - min_y) / left_run))
                return eave_left + t * (ridge_z - eave_left)
            right_run = max_y - ridge_y
            t = 0.0 if right_run <= 0 else max(0.0, min(1.0, (y_mm - ridge_y) / right_run))
            return ridge_z + t * (eave_right - ridge_z)
        half_span = span_x / 2.0
        ridge_x = (min_x + max_x) / 2.0 + max(-half_span + 1e-6, min(half_span - 1e-6, offset))
        left_run = ridge_x - min_x
        ridge_z = eave_left + left_run * tan
        if x_mm <= ridge_x:
            t = 0.0 if left_run <= 0 else max(0.0, min(1.0, (x_mm - min_x) / left_run))
            return eave_left + t * (ridge_z - eave_left)
        right_run = max_x - ridge_x
        t = 0.0 if right_run <= 0 else max(0.0, min(1.0, (x_mm - ridge_x) / right_run))
        return ridge_z + t * (eave_right - ridge_z)
    if ridge_along_x:
        run = span_y / 2.0 - abs(y_mm - (min_y + max_y) / 2.0)
    else:
        run = span_x / 2.0 - abs(x_mm - (min_x + max_x) / 2.0)
    return eave_z + max(0.0, run) * tan


def _aabb_for_ceiling(elem: Any, elements: dict[str, Element]) -> AABB | None:
    base_z = _level_elevation_mm(elements, elem.level_id) + float(elem.height_offset_mm)
    return _bounds_from_points(
        [(float(p.x_mm), float(p.y_mm)) for p in elem.boundary_mm],
        base_z,
        base_z + float(elem.thickness_mm),
    )


def _aabb_for_stair(elem: Any, elements: dict[str, Element]) -> AABB | None:
    min_z = _level_elevation_mm(elements, elem.base_level_id)
    max_z = _level_elevation_mm(elements, elem.top_level_id)
    if max_z <= min_z:
        max_z = min_z + float(elem.total_rise_mm or elem.riser_mm * 8)

    boxes: list[AABB] = []
    if getattr(elem, "boundary_mm", None):
        box = _bounds_from_points(
            [(float(p.x_mm), float(p.y_mm)) for p in elem.boundary_mm],
            min_z,
            max_z,
        )
        if box is not None:
            boxes.append(box)
    elif getattr(elem, "shape", None) == "spiral" and elem.center_mm is not None:
        radius = float(elem.outer_radius_mm or elem.width_mm)
        c = elem.center_mm
        boxes.append(
            AABB(
                float(c.x_mm) - radius,
                float(c.y_mm) - radius,
                min_z,
                float(c.x_mm) + radius,
                float(c.y_mm) + radius,
                max_z,
            )
        )
    elif getattr(elem, "sketch_path_mm", None):
        box = _bounds_from_points(
            [(float(p.x_mm), float(p.y_mm)) for p in elem.sketch_path_mm],
            min_z,
            max_z,
        )
        if box is not None:
            pad = float(elem.width_mm) / 2.0
            boxes.append(
                AABB(
                    box.min_x - pad,
                    box.min_y - pad,
                    box.min_z,
                    box.max_x + pad,
                    box.max_y + pad,
                    box.max_z,
                )
            )
    else:
        runs = list(elem.runs) if getattr(elem, "runs", None) else []
        if not runs:
            boxes.append(
                _line_box_aabb(elem.run_start, elem.run_end, float(elem.width_mm), min_z, max_z)
            )
        for run in runs:
            path = run.polyline_mm or [run.start_mm, run.end_mm]
            for start, end in zip(path, path[1:], strict=False):
                box = _line_box_aabb(start, end, float(run.width_mm), min_z, max_z)
                if box is not None:
                    boxes.append(box)

    for landing in getattr(elem, "landings", []) or []:
        box = _bounds_from_points(
            [(float(p.x_mm), float(p.y_mm)) for p in landing.boundary_mm],
            min_z,
            max_z,
        )
        if box is not None:
            boxes.append(box)

    boxes = [box for box in boxes if box is not None]
    if not boxes:
        return None
    return AABB(
        min(box.min_x for box in boxes),
        min(box.min_y for box in boxes),
        min_z,
        max(box.max_x for box in boxes),
        max(box.max_y for box in boxes),
        max_z,
    )


def _aabb_for_railing(elem: Any, elements: dict[str, Element]) -> AABB | None:
    path = list(getattr(elem, "path_mm", []) or [])
    if len(path) < 2:
        return None
    level_id = _hosted_stair_level_id(elem, elements)
    min_z = _level_elevation_mm(elements, level_id)
    max_z = min_z + float(getattr(elem, "guard_height_mm", 1040.0))
    boxes = [
        _line_box_aabb(start, end, 80.0, min_z, max_z)
        for start, end in zip(path, path[1:], strict=False)
    ]
    boxes = [box for box in boxes if box is not None]
    if not boxes:
        return None
    return AABB(
        min(box.min_x for box in boxes),
        min(box.min_y for box in boxes),
        min_z,
        max(box.max_x for box in boxes),
        max(box.max_y for box in boxes),
        max_z,
    )


def _aabb_for_column(elem: Any, elements: dict[str, Element]) -> AABB:
    min_z = _level_elevation_mm(elements, elem.level_id) + float(elem.base_constraint_offset_mm)
    max_z = min_z + float(elem.height_mm)
    if elem.top_constraint_level_id:
        constrained = _level_elevation_mm(elements, elem.top_constraint_level_id) + float(
            elem.top_constraint_offset_mm
        )
        if constrained > min_z:
            max_z = constrained
    return _centered_rotated_box_aabb(
        elem.position_mm,
        float(elem.b_mm),
        float(elem.h_mm),
        min_z,
        max_z,
        float(elem.rotation_deg),
    )


def _aabb_for_beam(elem: Any, elements: dict[str, Element]) -> AABB | None:
    min_z = _level_elevation_mm(elements, elem.level_id)
    return _line_box_aabb(
        elem.start_mm,
        elem.end_mm,
        float(elem.width_mm),
        min_z,
        min_z + float(elem.height_mm),
    )


def _aabb_for_pipe(elem: Any, elements: dict[str, Element]) -> AABB | None:
    radius = float(elem.diameter_mm) / 2.0
    center_z = _level_elevation_mm(elements, elem.level_id) + float(elem.elevation_mm)
    return _line_box_aabb(
        elem.start_mm, elem.end_mm, float(elem.diameter_mm), center_z - radius, center_z + radius
    )


def _aabb_for_duct(elem: Any, elements: dict[str, Element]) -> AABB | None:
    width = float(elem.width_mm)
    height = float(elem.height_mm)
    center_z = _level_elevation_mm(elements, elem.level_id) + float(elem.elevation_mm)
    return _line_box_aabb(
        elem.start_mm, elem.end_mm, width, center_z - height / 2.0, center_z + height / 2.0
    )


def _aabb_for_placed_asset(elem: Any, elements: dict[str, Element]) -> AABB | None:
    entry = elements.get(elem.asset_id)
    width = _dimension_from_sources(
        elem.param_values,
        getattr(entry, "param_schema", None),
        ("widthMm", "lengthMm", "diameterMm", "bMm"),
    )
    if width is None:
        width = _positive_float(getattr(entry, "thumbnail_width_mm", None))
    depth = _dimension_from_sources(
        elem.param_values,
        getattr(entry, "param_schema", None),
        ("depthMm", "diameterMm", "hMm"),
    )
    if depth is None:
        depth = _positive_float(getattr(entry, "thumbnail_height_mm", None))
    height = _dimension_from_sources(
        elem.param_values,
        getattr(entry, "param_schema", None),
        ("proxyHeightMm", "heightMm", "zMm"),
    )
    width = width or 1000.0
    depth = depth or 1000.0
    height = height or 1000.0
    base_z = _level_elevation_mm(elements, elem.level_id)
    return _centered_rotated_box_aabb(
        elem.position_mm,
        width,
        depth,
        base_z,
        base_z + height,
        float(elem.rotation_deg),
    )


def _aabb_for_family_instance(elem: Any, elements: dict[str, Element]) -> AABB | None:
    family_type = elements.get(elem.family_type_id)
    type_params = getattr(family_type, "parameters", None)
    width = _dimension_from_sources(
        elem.param_values,
        type_params,
        ("widthMm", "lengthMm", "diameterMm", "bMm"),
    )
    depth = _dimension_from_sources(
        elem.param_values,
        type_params,
        ("depthMm", "diameterMm", "hMm"),
    )
    height = _dimension_from_sources(
        elem.param_values,
        type_params,
        ("proxyHeightMm", "heightMm", "zMm"),
    )
    if width is None or depth is None or height is None:
        return None
    base_z = _level_elevation_mm(elements, elem.level_id)
    return _centered_rotated_box_aabb(
        elem.position_mm,
        width,
        depth,
        base_z,
        base_z + height,
        float(elem.rotation_deg),
    )


def _aabb_for_family_kit_instance(elem: Any, elements: dict[str, Element]) -> AABB | None:
    wall = elements.get(getattr(elem, "host_wall_id", "") or "")
    if wall is None or getattr(wall, "kind", None) != "wall":
        return None
    start_t = float(getattr(elem, "start_mm", 0.0))
    end_t = float(getattr(elem, "end_mm", 0.0))
    if end_t <= start_t:
        return None
    wall_len = math.hypot(
        float(wall.end.x_mm) - float(wall.start.x_mm),
        float(wall.end.y_mm) - float(wall.start.y_mm),
    )
    if wall_len <= 1e-6:
        return None
    ux = (float(wall.end.x_mm) - float(wall.start.x_mm)) / wall_len
    uy = (float(wall.end.y_mm) - float(wall.start.y_mm)) / wall_len
    nx = -uy
    ny = ux
    depth = float(getattr(elem, "countertop_depth_mm", 600.0) or 600.0)
    height = _family_kit_height_mm(elem)
    base_z = _level_elevation_mm(elements, getattr(wall, "level_id", None))
    sx = float(wall.start.x_mm) + ux * start_t
    sy = float(wall.start.y_mm) + uy * start_t
    ex = float(wall.start.x_mm) + ux * min(end_t, wall_len)
    ey = float(wall.start.y_mm) + uy * min(end_t, wall_len)
    half_wall = float(getattr(wall, "thickness_mm", 200.0)) / 2.0
    points = [
        (sx + nx * half_wall, sy + ny * half_wall),
        (ex + nx * half_wall, ey + ny * half_wall),
        (sx + nx * (half_wall + depth), sy + ny * (half_wall + depth)),
        (ex + nx * (half_wall + depth), ey + ny * (half_wall + depth)),
    ]
    return _bounds_from_points(points, base_z, base_z + height)


def _dimension_from_sources(
    instance_values: dict[str, Any] | None,
    type_values: Any,
    keys: tuple[str, ...],
) -> float | None:
    for source in (instance_values or {}, _normalize_type_values(type_values)):
        for key in keys:
            value = _lookup_dimension(source, key)
            if value is not None:
                return value
    return None


def _normalize_type_values(type_values: Any) -> dict[str, Any]:
    if type_values is None:
        return {}
    if isinstance(type_values, dict):
        return type_values
    normalized: dict[str, Any] = {}
    for param in type_values or []:
        key = getattr(param, "key", None)
        if key is None and isinstance(param, dict):
            key = param.get("key")
        if not key:
            continue
        value = getattr(param, "default", None)
        if value is None and isinstance(param, dict):
            value = param.get("default")
        normalized[str(key)] = value
    return normalized


def _lookup_dimension(values: dict[str, Any], canonical_key: str) -> float | None:
    wanted = {_normalize_dimension_key(canonical_key)}
    aliases = {
        "widthmm": {"w", "width", "nominalwidth", "nominalwidthmm", "length", "lengthmm"},
        "depthmm": {"d", "depth", "nominaldepth", "nominaldepthmm"},
        "heightmm": {"h", "height", "nominalheight", "nominalheightmm"},
        "diametermm": {"diameter", "dia", "diam"},
        "bmm": {"b", "width", "widthmm"},
        "hmm": {"h", "depth", "depthmm"},
        "proxyheightmm": {"proxyheight", "height", "heightmm"},
        "zmm": {"z", "height", "heightmm"},
    }
    wanted |= aliases.get(_normalize_dimension_key(canonical_key), set())
    for key, value in values.items():
        if _normalize_dimension_key(str(key)) in wanted:
            parsed = _positive_float(value)
            if parsed is not None:
                return parsed
    return None


_NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")


def _positive_float(value: Any) -> float | None:
    if isinstance(value, dict):
        for key in ("value", "default", "valueMm", "value_mm"):
            parsed = _positive_float(value.get(key))
            if parsed is not None:
                return parsed
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        match = _NUMBER_RE.search(str(value))
        if match is None:
            return None
        parsed = float(match.group(0))
    if math.isfinite(parsed) and parsed > 0:
        return parsed
    return None


def _normalize_dimension_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _hosted_stair_level_id(elem: Any, elements: dict[str, Element]) -> str | None:
    stair_id = getattr(elem, "hosted_stair_id", None)
    stair = elements.get(stair_id or "")
    if stair is not None:
        return getattr(stair, "base_level_id", None)
    return None


def _family_kit_height_mm(elem: Any) -> float:
    height = 0.0
    for component in getattr(elem, "components", []) or []:
        component_height = _positive_float(getattr(component, "height_mm", None))
        if component_height is not None:
            height = max(height, component_height)
    return height or 2400.0


def _unsupported_reason(elem: Any, elements: dict[str, Element]) -> str:
    kind = str(getattr(elem, "kind", ""))
    if kind == "family_instance":
        return (
            "missing positive width/depth/height in instance paramValues or family_type parameters"
        )
    if kind == "wall":
        return "wall has degenerate centerline"
    if kind in _PHYSICAL_KINDS:
        return "missing or degenerate geometry inputs"
    return "no constructability collision proxy implemented for this physical kind"
