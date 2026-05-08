"""Gable roof footprint math shared by glTF export (WP-B04 / WP-X02)."""

from __future__ import annotations

import math
from typing import Literal

RoofGeometryMode = Literal[
    "mass_box",
    "gable_pitched_rectangle",
    "asymmetric_gable",
    "gable_pitched_l_shape",
    "hip",
    "flat",
]

RoofGeometrySupportTokenV0 = Literal[
    "gable_pitched_rectangle_supported",
    "gable_pitched_l_shape_supported",
    "hip_supported",
    "hip_candidate_deferred",
    "valley_candidate_deferred",
    "non_rectangular_footprint_deferred",
    "missing_slope_or_level",
]

RoofPlanGeometryReadoutV0 = Literal[
    "gable_projection_supported",
    "mass_box_peak_proxy",
    "footprint_proxy_deferred",
]

FootprintPlanWinding = Literal["ccw", "cw", "degenerate"]
RidgeAxisPlan = Literal["alongX", "alongZ"]


def outer_rect_extent(pts: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    """Axis-aligned bounds on the plan footprint; maps to world X and Z."""
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    return float(min(xs)), float(max(xs)), float(min(zs)), float(max(zs))


def gable_half_run_mm_and_ridge_axis(span_x: float, span_z: float) -> tuple[float, str]:
    """Ridge parallels the shorter footprint span; slope half-run is half the longer span (mm)."""
    if span_x <= span_z:
        return span_z / 2.0, "alongX"
    return span_x / 2.0, "alongZ"


def gable_ridge_rise_mm(span_x: float, span_z: float, slope_deg: float) -> tuple[float, str]:
    half_run, axis = gable_half_run_mm_and_ridge_axis(span_x, span_z)
    rise_mm = half_run * math.tan(math.radians(slope_deg))
    return rise_mm, axis


def plan_polygon_signed_area_mm2(pts: list[tuple[float, float]]) -> float:
    """Signed shoelace area on plan coordinates (x, z aliases stored as xMm/yMm)."""

    n = len(pts)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % n]
        s += x1 * z2 - x2 * z1
    return s * 0.5


def plan_polygon_winding_token(area_mm2: float, *, eps_mm2: float = 1.0) -> FootprintPlanWinding:
    if abs(area_mm2) <= eps_mm2:
        return "degenerate"
    return "ccw" if area_mm2 > 0 else "cw"


def plan_simple_polygon_is_convex_mm(
    pts: list[tuple[float, float]],
    *,
    cross_eps: float = 1e-6,
) -> bool:
    """Plan convexity for a simple closed ring (x/z); collinear segments are ignored for sign."""

    n = len(pts)
    if n < 3:
        return False
    signs: list[int] = []
    for i in range(n):
        x0, z0 = pts[i]
        x1, z1 = pts[(i + 1) % n]
        x2, z2 = pts[(i + 2) % n]
        v1x, v1z = x1 - x0, z1 - z0
        v2x, v2z = x2 - x1, z2 - z1
        cross = v1x * v2z - v1z * v2x
        if abs(cross) <= cross_eps:
            continue
        signs.append(1 if cross > 0 else -1)
    if not signs:
        return False
    return len(set(signs)) <= 1


def plan_simple_polygon_is_concave_mm(
    pts: list[tuple[float, float]],
    *,
    area_eps_mm2: float = 1.0,
    cross_eps: float = 1e-6,
) -> bool:
    """True when footprint has an interior reflex corner (e.g. L-shape)."""

    if len(pts) < 3:
        return False
    area = plan_polygon_signed_area_mm2(pts)
    if plan_polygon_winding_token(area, eps_mm2=area_eps_mm2) == "degenerate":
        return False
    return not plan_simple_polygon_is_convex_mm(pts, cross_eps=cross_eps)


def gable_pitched_rectangle_elevation_supported_v0(
    *,
    footprint_mm: list[tuple[float, float]],
    roof_geometry_mode: RoofGeometryMode,
    reference_level_resolves: bool,
    slope_deg: float | None,
) -> bool:
    """True when gable ridge / gable mesh is representative (rectangle + mode + level + slope)."""

    return (
        roof_geometry_support_token_v0(
            footprint_mm=footprint_mm,
            roof_geometry_mode=roof_geometry_mode,
            reference_level_resolves=reference_level_resolves,
            slope_deg=slope_deg,
        )
        == "gable_pitched_rectangle_supported"
    )


def roof_plan_geometry_readout_v0(
    *,
    roof_geometry_mode: RoofGeometryMode,
    roof_geometry_support_token: RoofGeometrySupportTokenV0 | None,
    gable_elevation_supported: bool,
) -> RoofPlanGeometryReadoutV0:
    """Compact agent-facing token: full gable chord vs mass-box peak proxy vs deferred footprint."""

    if gable_elevation_supported:
        return "gable_projection_supported"
    if roof_geometry_mode == "mass_box" and roof_geometry_support_token is None:
        return "mass_box_peak_proxy"
    return "footprint_proxy_deferred"


def roof_geometry_support_token_v0(
    *,
    footprint_mm: list[tuple[float, float]],
    roof_geometry_mode: RoofGeometryMode,
    reference_level_resolves: bool,
    slope_deg: float | None,
) -> RoofGeometrySupportTokenV0 | None:
    """Deterministic hip/valley/skip matrix; None for ordinary mass_box axis-aligned rectangles."""

    if not reference_level_resolves or len(footprint_mm) < 3 or slope_deg is None:
        return "missing_slope_or_level"

    area = plan_polygon_signed_area_mm2(footprint_mm)
    if plan_polygon_winding_token(area) == "degenerate":
        return "non_rectangular_footprint_deferred"

    if plan_simple_polygon_is_concave_mm(footprint_mm):
        if roof_geometry_mode == "gable_pitched_l_shape" and footprint_is_valid_l_shape_mm(
            footprint_mm
        ):
            return "gable_pitched_l_shape_supported"
        return "valley_candidate_deferred"

    if roof_geometry_mode in (
        "gable_pitched_rectangle",
        "asymmetric_gable",
    ) and footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        return "gable_pitched_rectangle_supported"

    is_convex = plan_simple_polygon_is_convex_mm(footprint_mm)
    is_rect = footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm)
    if roof_geometry_mode == "hip" and is_convex and len(footprint_mm) >= 4:
        return "hip_supported"
    if is_convex and len(footprint_mm) >= 4 and not is_rect:
        return "hip_candidate_deferred"

    if roof_geometry_mode == "mass_box" and is_rect and is_convex:
        return None

    return "non_rectangular_footprint_deferred"


def footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm: list[tuple[float, float]]) -> bool:
    """Same geometric predicate as assert_valid_gable_pitched_rectangle_footprint_mm, non-throwing."""

    if len(footprint_mm) != 4:
        return False
    xs = [p[0] for p in footprint_mm]
    zs = [p[1] for p in footprint_mm]
    x0, x1 = min(xs), max(xs)
    z0, z1 = min(zs), max(zs)
    tol = 1.0
    corners = {(x0, z0), (x0, z1), (x1, z0), (x1, z1)}
    hit: set[tuple[float, float]] = set()
    for p in footprint_mm:
        matched = False
        for c in corners:
            if abs(p[0] - c[0]) <= tol and abs(p[1] - c[1]) <= tol:
                hit.add(c)
                matched = True
                break
        if not matched:
            return False
    return len(hit) == 4


def gable_ridge_segment_plan_mm(
    x0_mm: float,
    x1_mm: float,
    z0_mm: float,
    z1_mm: float,
    ridge_axis: RidgeAxisPlan,
) -> tuple[tuple[float, float], tuple[float, float]]:
    """Ridge centerline in plan mm between footprint extents (parallel to ridge_axis)."""

    if ridge_axis == "alongX":
        zm = (z0_mm + z1_mm) * 0.5
        return (x0_mm, zm), (x1_mm, zm)
    xm = (x0_mm + x1_mm) * 0.5
    return (xm, z0_mm), (xm, z1_mm)


def gable_rectangle_fascia_edge_plan_token_v0(ridge_axis: RidgeAxisPlan) -> str:
    """Deterministic plan-axis roles for rectangle gable roofs (eaves parallel to ridge; rake at gable ends)."""

    if ridge_axis == "alongX":
        return "eaveParallelPlanX_gableRakeParallelPlanZ"
    return "eaveParallelPlanZ_gableRakeParallelPlanX"


def mass_box_roof_proxy_peak_z_mm(
    reference_level_elevation_mm: float, slope_deg: float | None
) -> float:
    """Section/plan proxy peak for roofGeometryMode=mass_box (800 mm nominal half-run heuristic)."""

    slope = float(slope_deg if slope_deg is not None else 25.0)
    rise = 800.0 * math.tan(math.radians(slope))
    return float(reference_level_elevation_mm) + rise


def assert_valid_gable_pitched_rectangle_footprint_mm(
    footprint_mm: list[tuple[float, float]],
) -> None:
    """Require four axis-aligned rectangle corners (plan mm)."""
    if len(footprint_mm) != 4:
        raise ValueError(
            "gable_pitched_rectangle footprintMm must be exactly 4 vertices (axis-aligned rectangle)"
        )
    if not footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        raise ValueError(
            "gable_pitched_rectangle footprintMm must be an axis-aligned rectangle (corners only)"
        )


def footprint_is_valid_l_shape_mm(footprint_mm: list[tuple[float, float]]) -> bool:
    """KRN-02: True for axis-aligned L-shape — six vertices, exactly one reflex corner."""

    if len(footprint_mm) != 6:
        return False
    area = plan_polygon_signed_area_mm2(footprint_mm)
    if plan_polygon_winding_token(area) == "degenerate":
        return False
    n = len(footprint_mm)
    wsign = 1 if area > 0 else -1
    reflex_count = 0
    for i in range(n):
        a = footprint_mm[(i - 1) % n]
        b = footprint_mm[i]
        c = footprint_mm[(i + 1) % n]
        cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        if cross * wsign < -1e-6:
            reflex_count += 1
    if reflex_count != 1:
        return False
    # All edges must be axis-aligned for the L-shape gable to render correctly.
    tol = 1.0
    for i in range(n):
        a = footprint_mm[i]
        b = footprint_mm[(i + 1) % n]
        if abs(a[0] - b[0]) > tol and abs(a[1] - b[1]) > tol:
            return False
    return True


def assert_valid_l_shape_footprint_mm(footprint_mm: list[tuple[float, float]]) -> None:
    """KRN-02: gable_pitched_l_shape requires axis-aligned 6-vertex L footprint."""

    if not footprint_is_valid_l_shape_mm(footprint_mm):
        raise ValueError(
            "gable_pitched_l_shape footprintMm must be an axis-aligned 6-vertex L-shape"
            " with exactly one reflex corner"
        )


def assert_valid_hip_footprint_mm(footprint_mm: list[tuple[float, float]]) -> None:
    """KRN-03: hip mode requires a convex polygon with ≥ 4 vertices."""

    if len(footprint_mm) < 4:
        raise ValueError("hip footprintMm requires at least 4 vertices (convex polygon)")
    if not plan_simple_polygon_is_convex_mm(footprint_mm):
        raise ValueError("hip footprintMm must be a convex polygon")


def _bisector_trim_length(
    in_dir: tuple[float, float],
    out_dir: tuple[float, float],
    profile_reach_mm: float = 0.0,
) -> float:
    """Miter trim length at an interior corner from the bisector angle."""
    cos_half = (
        in_dir[0] * out_dir[0] + in_dir[1] * out_dir[1]
    ) / max(
        math.hypot(*in_dir) * math.hypot(*out_dir), 1e-9
    )
    cos_half = max(-1.0, min(1.0, cos_half))
    half_angle = math.acos(cos_half) / 2.0
    if half_angle < 1e-6:
        return 0.0
    return profile_reach_mm * math.tan(half_angle)


def edge_profile_run_path_mm(
    footprint_mm: list[tuple[float, float]],
    host_edge: str,
    *,
    level_elevation_mm: float = 0.0,
    overhang_mm: float = 0.0,
    slope_deg: float | None = None,
) -> list[tuple[float, float, float]]:
    """KRN-V3-03 G12 — 3D waypoints for an EdgeProfileRun on a rectangular gable roof.

    Pure: no element dict lookups. Caller passes the resolved roof fields.
    """
    if len(footprint_mm) < 3:
        raise ValueError("edge_profile_run_path_mm: footprint must have ≥ 3 vertices")

    x0, x1, z0, z1 = outer_rect_extent(footprint_mm)
    span_x = x1 - x0
    span_z = z1 - z0
    _, ridge_axis = gable_half_run_mm_and_ridge_axis(span_x, span_z)

    slope = float(slope_deg) if slope_deg is not None else 0.0
    eave_z = level_elevation_mm

    if host_edge == "eave":
        if ridge_axis == "alongX":
            return [
                (x0 - overhang_mm, z0, eave_z),
                (x1 + overhang_mm, z0, eave_z),
                (x1 + overhang_mm, z1, eave_z),
                (x0 - overhang_mm, z1, eave_z),
            ]
        else:
            return [
                (x0, z0 - overhang_mm, eave_z),
                (x1, z0 - overhang_mm, eave_z),
                (x1, z1 + overhang_mm, eave_z),
                (x0, z1 + overhang_mm, eave_z),
            ]
    elif host_edge == "rake":
        half_run, _ = gable_half_run_mm_and_ridge_axis(span_x, span_z)
        rise_mm = half_run * math.tan(math.radians(slope)) if slope else 0.0
        xm = (x0 + x1) / 2.0
        zm = (z0 + z1) / 2.0
        if ridge_axis == "alongX":
            return [
                (x0 - overhang_mm, zm, eave_z),
                (x0 - overhang_mm, zm, eave_z + rise_mm),
                (x1 + overhang_mm, zm, eave_z + rise_mm),
                (x1 + overhang_mm, zm, eave_z),
            ]
        else:
            return [
                (xm, z0 - overhang_mm, eave_z),
                (xm, z0 - overhang_mm, eave_z + rise_mm),
                (xm, z1 + overhang_mm, eave_z + rise_mm),
                (xm, z1 + overhang_mm, eave_z),
            ]
    else:
        raise ValueError(f"edge_profile_run_path_mm: unsupported host_edge '{host_edge}'")
