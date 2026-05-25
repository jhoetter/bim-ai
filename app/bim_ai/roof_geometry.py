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
    "mono_pitch",
    "half_gable",
    # ISSUE-101: Versetztes Pultdach (offset double mono-pitch with clerestory
    # band) — two mono-pitched planes at different heights along the long axis,
    # joined by a horizontal clerestory wall band. Footprint must be an
    # axis-aligned rectangle; the step position partitions the long axis.
    "mono_pitch_offset",
    # ISSUE-114: Tonnendach (barrel roof) — a curved cylindrical-segment roof
    # swept along the long footprint axis. The arc sits between two eaves on
    # the short-axis sides and rises ``barrel_rise_mm`` above the eave at the
    # crown. Footprint must be an axis-aligned rectangle for v0; the renderer
    # tessellates the arc into ``barrel_segment_count`` flat strips that
    # approximate the cylindrical surface.
    "barrel",
    # ISSUE-112: Mansarddach (Mansard / French roof) — two-pitch roof where
    # the lower slope is near-vertical (steep skirt that encloses the DG) and
    # the upper slope is shallow (hipped or gabled cap). The two pitches meet
    # at a horizontal "knee" line at ``mansardKneeHeightMm`` above the eave.
    # Mansardgauben (dormers) cut into the steep lower slope reuse the
    # existing dormer renderer. Footprint must be an axis-aligned rectangle
    # for v0.
    "mansard",
]

RoofGeometrySupportTokenV0 = Literal[
    "gable_pitched_rectangle_supported",
    "gable_pitched_l_shape_supported",
    "hip_supported",
    "hip_candidate_deferred",
    "mono_pitch_supported",
    "half_gable_supported",
    "mono_pitch_offset_supported",
    "barrel_supported",
    "mansard_supported",
    "valley_candidate_deferred",
    "non_rectangular_footprint_deferred",
    "missing_slope_or_level",
]

# Compass-quadrant high edge for `mono_pitch` roofs (Pultdach). The opposite
# edge sits at the eave (low side). When omitted, defaults are inferred from
# the longer footprint span.
MonoPitchHighEdge = Literal["n", "e", "s", "w"]

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

    # ISSUE-114: barrel (Tonnendach) is parametrised by ``barrel_rise_mm``, not
    # a planar slope, so the slope gate must not gate it out. The reference
    # level still must resolve, and the footprint must have ≥3 vertices.
    if roof_geometry_mode == "barrel":
        if not reference_level_resolves or len(footprint_mm) < 3:
            return "missing_slope_or_level"
        if footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
            return "barrel_supported"
        return "non_rectangular_footprint_deferred"

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

    if roof_geometry_mode == "mono_pitch" and footprint_is_valid_axis_aligned_rectangle_mm(
        footprint_mm
    ):
        return "mono_pitch_supported"

    # ISSUE-105: Krüppelwalmdach (half-hipped) — gable footprint plus a hip
    # cap at the top fraction of the ridge. Same axis-aligned rectangle
    # predicate as gable_pitched_rectangle.
    if roof_geometry_mode == "half_gable" and footprint_is_valid_axis_aligned_rectangle_mm(
        footprint_mm
    ):
        return "half_gable_supported"

    if (
        roof_geometry_mode == "mono_pitch_offset"
        and footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm)
    ):
        return "mono_pitch_offset_supported"

    # ISSUE-112: Mansarddach — two-pitch (steep lower skirt + shallow upper
    # cap) restricted to axis-aligned rectangles for v0. The lower slope
    # encloses the DG; Mansardgauben sit on it.
    if roof_geometry_mode == "mansard" and footprint_is_valid_axis_aligned_rectangle_mm(
        footprint_mm
    ):
        return "mansard_supported"

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


def assert_valid_mono_pitch_footprint_mm(footprint_mm: list[tuple[float, float]]) -> None:
    """ISSUE-53: mono_pitch (Pultdach) requires an axis-aligned rectangle for v0.

    Non-rectangular footprints defer to the slab fallback (same as flat).
    """

    if not footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        raise ValueError(
            "mono_pitch footprintMm must be an axis-aligned rectangle "
            "(4 corner vertices); non-rectangular Pultdach is deferred"
        )


def assert_valid_mono_pitch_offset_footprint_mm(
    footprint_mm: list[tuple[float, float]],
) -> None:
    """ISSUE-101: mono_pitch_offset (Versetztes Pultdach) requires an
    axis-aligned rectangle for v0.

    The renderer/exporter partitions the long axis at
    ``step_position_along_long_axis_mm`` into a front and a rear sub-rectangle,
    each carrying its own mono-pitched slab and eave height. Non-rectangular
    footprints defer to the slab fallback (same as flat).
    """

    if not footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        raise ValueError(
            "mono_pitch_offset footprintMm must be an axis-aligned rectangle "
            "(4 corner vertices); non-rectangular Versetztes Pultdach is deferred"
        )


def mono_pitch_offset_long_axis_token(
    span_x: float, span_z: float
) -> RidgeAxisPlan:
    """ISSUE-101: pick the long-axis token along which the two mono-pitched
    planes are partitioned.

    The step partitioning runs perpendicular to the eave line (i.e. along the
    long horizontal axis of the footprint). Ties resolve to ``alongX`` for
    determinism.
    """

    if span_x >= span_z:
        return "alongX"
    return "alongZ"


def assert_valid_mono_pitch_offset_step_position_mm(
    span_along_long_axis_mm: float,
    step_position_mm: float | None,
    *,
    min_segment_mm: float = 100.0,
) -> float:
    """ISSUE-101: validate (or default) the step partition position.

    A ``None`` step defaults to the midpoint. A non-None step must sit strictly
    inside the footprint with at least ``min_segment_mm`` of run on either side
    so each mono-pitched slab has a meaningful eave-to-band span.
    """

    if step_position_mm is None:
        return float(span_along_long_axis_mm) / 2.0
    sp = float(step_position_mm)
    if sp <= min_segment_mm or sp >= span_along_long_axis_mm - min_segment_mm:
        raise ValueError(
            "mono_pitch_offset stepPositionAlongLongAxisMm must sit strictly "
            f"inside the footprint with at least {min_segment_mm:.0f} mm of run "
            "on each side of the clerestory band"
        )
    return sp


def mono_pitch_default_high_edge(
    span_x: float, span_z: float, *, fallback: MonoPitchHighEdge = "n"
) -> MonoPitchHighEdge:
    """ISSUE-53: when `mono_pitch_high_edge` is omitted, pick a deterministic default.

    The Pultdach ridge runs along the longer footprint span; the high edge sits
    perpendicular to that ridge on whichever quadrant the renderer/exporter
    picks. We default the high edge to the "n" side when the ridge runs along
    X (so the pitch points south→north uphill) and to "e" when the ridge runs
    along Z (uphill west→east). The caller may override at any time.
    """

    if span_x >= span_z:
        return "n"
    return "e"


def mono_pitch_ridge_rise_mm(
    span_x: float,
    span_z: float,
    slope_deg: float,
    high_edge: MonoPitchHighEdge,
) -> tuple[float, str]:
    """Vertical rise (mm) at the high edge of a mono_pitch roof + ridge axis token.

    Pitch direction (n/s vs e/w) selects which footprint span is the "run"
    perpendicular to the ridge. The full footprint span is the run for a
    Pultdach (unlike a symmetric gable, where the run is half the span).
    """

    slope_rad = math.radians(slope_deg)
    if high_edge in ("n", "s"):
        # Ridge runs along X; pitch points along Z. Run = full Z span.
        return span_z * math.tan(slope_rad), "alongX"
    # high_edge in ("e", "w") — ridge runs along Z; pitch along X.
    return span_x * math.tan(slope_rad), "alongZ"


def assert_valid_half_gable_footprint_mm(footprint_mm: list[tuple[float, float]]) -> None:
    """ISSUE-105: Krüppelwalmdach requires an axis-aligned rectangle (4 corners).

    A half-hipped roof is a gable whose top fraction of the triangular gable
    end is trimmed and replaced by a small hip face sloping back to the ridge.
    Geometrically, the footprint is still a rectangle (same predicate as the
    gable_pitched_rectangle mode) — the half-hip lives in elevation only, so
    we reuse the rectangle predicate here. Non-rectangular footprints defer
    to the slab fallback.
    """

    if not footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        raise ValueError(
            "half_gable footprintMm must be an axis-aligned rectangle "
            "(4 corner vertices); non-rectangular Krüppelwalmdach is deferred"
        )


def clamp_half_hip_height_fraction(
    fraction: float | None, *, default: float = 0.33
) -> float:
    """ISSUE-105: clamp the half-hip height fraction into [0, 1].

    - ``None`` returns ``default`` (typical Krüppelwalm covers the top third).
    - Values outside [0, 1] are clamped instead of raising so a misconfigured
      input degrades gracefully to a full gable (0) or full hip (1) rather
      than crashing the renderer / IFC export.
    """

    if fraction is None:
        return default
    try:
        f = float(fraction)
    except (TypeError, ValueError):
        return default
    if math.isnan(f):
        return default
    return max(0.0, min(1.0, f))


def half_gable_truncation_height_mm(
    full_ridge_rise_mm: float, half_hip_height_fraction: float | None
) -> float:
    """ISSUE-105: vertical height (mm above eave) at which the gable triangle
    is truncated and the hip cap begins.

    - ``fraction = 0`` ⇒ truncation height == full ridge ⇒ no hip cap (pure gable).
    - ``fraction = 1`` ⇒ truncation height == eave ⇒ full hip.
    - ``fraction = 0.33`` ⇒ hip occupies the top third (Krüppelwalm default).

    Returns max(0, ridge_rise * (1 - fraction)).
    """

    f = clamp_half_hip_height_fraction(half_hip_height_fraction)
    return max(0.0, float(full_ridge_rise_mm) * (1.0 - f))


def assert_valid_mansard_footprint_mm(footprint_mm: list[tuple[float, float]]) -> None:
    """ISSUE-112: mansard (Mansarddach) requires an axis-aligned rectangle for v0.

    A Mansard / French roof has a steep lower slope (near-vertical skirt that
    encloses the DG and hosts Mansardgauben) and a shallow upper slope (cap).
    The two slopes meet at a horizontal "knee" line at
    ``mansardKneeHeightMm`` above the eave. Non-rectangular footprints
    defer to the slab fallback (same as flat).
    """

    if not footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        raise ValueError(
            "mansard footprintMm must be an axis-aligned rectangle "
            "(4 corner vertices); non-rectangular Mansarddach is deferred"
        )


def mansard_default_lower_pitch_deg() -> float:
    """ISSUE-112: default steep skirt pitch for Mansarddach.

    A typical Mansarddach has a lower skirt that is near-vertical — French
    practice puts it around 70°. We default to 70° so callers that omit the
    field get a recognisable Mansard silhouette without needing a magic
    number.
    """

    return 70.0


def mansard_default_upper_pitch_deg() -> float:
    """ISSUE-112: default shallow cap pitch for Mansarddach.

    The upper cap is shallow — typical practice is 10–30°. We default to
    20° so the cap is clearly distinct from the steep skirt without
    flattening into a pseudo-flat roof.
    """

    return 20.0


def clamp_mansard_pitch_deg(
    raw: float | None,
    *,
    default: float,
    min_deg: float = 1.0,
    max_deg: float = 89.0,
) -> float:
    """ISSUE-112: clamp a mansard pitch into ``[min_deg, max_deg]``.

    Mansard slopes are bounded: the lower (steep) slope must be below
    90° (a true vertical would degenerate into a wall, not a roof slope)
    and the upper (shallow) slope must be above 0° so it still drains.
    ``None`` / NaN / garbage falls back to ``default``.
    """

    if raw is None:
        return float(default)
    try:
        f = float(raw)
    except (TypeError, ValueError):
        return float(default)
    if math.isnan(f):
        return float(default)
    return max(min_deg, min(max_deg, f))


def mansard_knee_height_mm(
    *,
    span_x: float,
    span_z: float,
    lower_pitch_deg: float,
    raw_knee_height_mm: float | None,
    default_fraction: float = 0.6,
    min_height_mm: float = 100.0,
) -> float:
    """ISSUE-112: resolve the knee elevation (above eave) for the mansard.

    The knee height is the elevation at which the steep lower skirt
    transitions into the shallow upper cap.

    - ``raw_knee_height_mm = None`` defaults to ``default_fraction`` (60%)
      of the maximum elevation the steep skirt can reach before the
      upper cap takes over the centre of the rectangle.
    - Returned value is clamped to ``[min_height_mm, max_skirt_rise]``
      where ``max_skirt_rise = half_short_span × tan(lower_pitch_deg)``.

    The max-skirt-rise upper bound exists because, geometrically, a steep
    skirt cannot rise higher than the point where the two opposite skirts
    meet at the rectangle centerline. Beyond that, there is no room left
    for the shallow upper cap and the roof degenerates back into a hip /
    gable. We always leave at least 1 mm of headroom so the cap is
    representable.
    """

    half_short_span = min(span_x, span_z) / 2.0
    lower_rad = math.radians(max(1.0, min(89.0, lower_pitch_deg)))
    max_skirt_rise = half_short_span * math.tan(lower_rad)
    if max_skirt_rise <= min_height_mm:
        # Degenerate rectangle (sub-mm short span / sub-vertical skirt) —
        # return the safer floor so the renderer/IFC don't crash on zero.
        return min_height_mm
    if raw_knee_height_mm is None:
        target = max_skirt_rise * default_fraction
    else:
        try:
            target = float(raw_knee_height_mm)
        except (TypeError, ValueError):
            target = max_skirt_rise * default_fraction
        if math.isnan(target):
            target = max_skirt_rise * default_fraction
    return max(min_height_mm, min(max_skirt_rise - 1.0, target))


def mansard_upper_ridge_rise_mm(
    *,
    span_x: float,
    span_z: float,
    lower_pitch_deg: float,
    upper_pitch_deg: float,
    knee_height_mm: float,
) -> float:
    """ISSUE-112: vertical rise (mm above eave) at the ridge of the upper cap.

    Geometry:
    - The lower (steep) skirt eats into the rectangle from each edge by
      ``inset = knee_height / tan(lower_pitch_deg)`` until it reaches the
      knee elevation.
    - The remaining inner rectangle at the knee carries the shallow
      upper cap (hipped/gabled). Half of the SHORTER inner span × tan
      of the upper pitch is the ridge rise above the knee.
    - Total ridge rise above the eave = knee_height + upper-cap rise.
    """

    lower_rad = math.radians(max(1.0, min(89.0, lower_pitch_deg)))
    upper_rad = math.radians(max(1.0, min(89.0, upper_pitch_deg)))
    inset_each_side = knee_height_mm / math.tan(lower_rad) if math.tan(lower_rad) > 1e-9 else 0.0
    inner_span_x = max(0.0, span_x - 2.0 * inset_each_side)
    inner_span_z = max(0.0, span_z - 2.0 * inset_each_side)
    inner_short = min(inner_span_x, inner_span_z)
    cap_rise = (inner_short / 2.0) * math.tan(upper_rad)
    return knee_height_mm + cap_rise


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
    cos_half = (in_dir[0] * out_dir[0] + in_dir[1] * out_dir[1]) / max(
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


# ---------------------------------------------------------------------------
# ISSUE-114: barrel (Tonnendach) helpers
# ---------------------------------------------------------------------------

BARREL_SEGMENT_COUNT_DEFAULT = 12
BARREL_SEGMENT_COUNT_MIN = 3
BARREL_SEGMENT_COUNT_MAX = 256


def assert_valid_barrel_footprint_mm(footprint_mm: list[tuple[float, float]]) -> None:
    """ISSUE-114: barrel (Tonnendach) requires an axis-aligned rectangle for v0.

    Non-rectangular footprints defer to the slab fallback (same precedent as
    mono_pitch and mono_pitch_offset). Sweeping a smooth cylindrical-segment
    along a non-axis-aligned path is plausible but out of scope for v0.
    """

    if not footprint_is_valid_axis_aligned_rectangle_mm(footprint_mm):
        raise ValueError(
            "barrel footprintMm must be an axis-aligned rectangle "
            "(4 corner vertices); non-rectangular Tonnendach is deferred"
        )


def assert_valid_barrel_rise_mm(barrel_rise_mm: float | None) -> float:
    """ISSUE-114: barrel rise (crown height above the eave plane) must be > 0.

    Returns the validated value as a float so callers can store it back.
    """

    if barrel_rise_mm is None:
        raise ValueError("barrel roofs require barrelRiseMm > 0")
    try:
        rise = float(barrel_rise_mm)
    except (TypeError, ValueError) as exc:
        raise ValueError("barrelRiseMm must be a numeric mm value") from exc
    if not (rise > 0.0):
        raise ValueError("barrelRiseMm must be > 0")
    return rise


def clamp_barrel_segment_count(
    value: int | float | None, *, default: int = BARREL_SEGMENT_COUNT_DEFAULT
) -> int:
    """ISSUE-114: clamp the tessellation strip count into the supported range.

    - ``None`` (or junk) → ``default`` (12 strips covers a half-circle smoothly).
    - Values below ``BARREL_SEGMENT_COUNT_MIN`` are raised to the minimum so the
      tessellation always produces a closed shell.
    - Values above ``BARREL_SEGMENT_COUNT_MAX`` are clamped to keep mesh sizes
      bounded for downstream renderers.
    """

    if value is None:
        return int(default)
    try:
        n = int(value)
    except (TypeError, ValueError):
        return int(default)
    if n < BARREL_SEGMENT_COUNT_MIN:
        return BARREL_SEGMENT_COUNT_MIN
    if n > BARREL_SEGMENT_COUNT_MAX:
        return BARREL_SEGMENT_COUNT_MAX
    return n


def barrel_sweep_axis_token(span_x: float, span_z: float) -> RidgeAxisPlan:
    """ISSUE-114: pick the axis along which the cylindrical segment sweeps.

    The arc spans the *short* footprint axis (the chord of the cylinder) and
    sweeps along the *long* axis. Ties resolve to ``alongX`` for determinism.
    """

    if span_x >= span_z:
        return "alongX"
    return "alongZ"


def barrel_arc_radius_from_chord_and_rise_mm(chord_mm: float, rise_mm: float) -> float:
    """ISSUE-114: circle radius for a circular arc with given chord & sagitta.

    Geometry: a circular arc with chord ``c`` and rise (sagitta) ``h`` lies on
    a circle of radius ``r = (c^2 + 4 h^2) / (8 h)``. Used by the tessellator
    to project arc points onto the chord plane.
    """

    if chord_mm <= 0.0:
        raise ValueError("barrel chord_mm must be > 0")
    if rise_mm <= 0.0:
        raise ValueError("barrel rise_mm must be > 0")
    c = float(chord_mm)
    h = float(rise_mm)
    return (c * c + 4.0 * h * h) / (8.0 * h)


def barrel_arc_profile_points_mm(
    chord_mm: float,
    rise_mm: float,
    segment_count: int,
) -> list[tuple[float, float]]:
    """ISSUE-114: ``segment_count + 1`` points (u, v) on the arc cross-section.

    The arc is parametrised in the chord plane:
    - ``u`` runs along the chord from 0 to ``chord_mm`` (the short footprint
      axis).
    - ``v`` is the height above the chord (the eave plane), 0 at both eaves
      and ``rise_mm`` at the crown.

    Even tessellation in arc-angle (not in chord) keeps strip widths roughly
    equal in arc length, which is the right thing for a smooth Tonnendach.
    """

    if segment_count < BARREL_SEGMENT_COUNT_MIN:
        raise ValueError(
            f"barrel_arc_profile_points_mm requires segment_count ≥ {BARREL_SEGMENT_COUNT_MIN}"
        )
    if chord_mm <= 0.0 or rise_mm <= 0.0:
        raise ValueError("barrel_arc_profile_points_mm requires chord_mm > 0 and rise_mm > 0")

    c = float(chord_mm)
    h = float(rise_mm)
    r = barrel_arc_radius_from_chord_and_rise_mm(c, h)
    # Circle center sits below the chord midpoint at distance (r - h).
    cx = c / 2.0
    cy = -(r - h)
    # Half-angle subtended by the chord at the center: sin(theta) = (c/2) / r.
    half_chord = c / 2.0
    sin_theta = max(-1.0, min(1.0, half_chord / r))
    theta = math.asin(sin_theta)
    pts: list[tuple[float, float]] = []
    for i in range(segment_count + 1):
        # Parameter t in [-1, +1] maps to angle [-theta, +theta] measured from
        # the vertical axis through the center (so t=0 is the crown).
        t = -1.0 + 2.0 * (i / segment_count)
        ang = t * theta
        # Point on circle (sin for u, cos for v) measured from the center;
        # ``cy + r * cos(ang)`` is the height above the chord plane (0 at
        # endpoints, ``rise_mm`` at the crown).
        u = cx + r * math.sin(ang)
        v = cy + r * math.cos(ang)
        # Snap endpoint heights to exactly 0 to absorb float drift so callers
        # comparing against the eave plane don't fail equality checks.
        if i == 0 or i == segment_count:
            v = 0.0
        pts.append((u, v))
    return pts
