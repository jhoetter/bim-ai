"""ISSUE-114 — barrel (Tonnendach) RoofGeometryMode coverage.

Covers:
- ``"barrel"`` is a valid ``RoofGeometryMode`` literal.
- ``roof_geometry_support_token_v0`` resolves rectangle footprints in barrel
  mode to ``"barrel_supported"`` without requiring ``slope_deg``.
- ``assert_valid_barrel_footprint_mm`` rejects non-rectangles and accepts
  axis-aligned rectangles.
- ``clamp_barrel_segment_count`` defaults / clamps as documented.
- ``barrel_arc_profile_points_mm`` returns a smooth arc with crown sagitta
  equal to ``rise_mm`` and endpoint heights snapping to 0.
- ``RoofElem`` accepts the new fields via either snake_case or camelCase.
- IFC export maps ``barrel`` to ``IfcRoof.PredefinedType = "BARREL_ROOF"``.
"""

from __future__ import annotations

import math
from typing import get_args

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoofElem
from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step
from bim_ai.roof_geometry import (
    BARREL_SEGMENT_COUNT_DEFAULT,
    BARREL_SEGMENT_COUNT_MAX,
    BARREL_SEGMENT_COUNT_MIN,
    RoofGeometryMode,
    assert_valid_barrel_footprint_mm,
    assert_valid_barrel_rise_mm,
    barrel_arc_profile_points_mm,
    barrel_arc_radius_from_chord_and_rise_mm,
    barrel_sweep_axis_token,
    clamp_barrel_segment_count,
    roof_geometry_support_token_v0,
)


def test_barrel_is_a_valid_roof_geometry_mode_literal() -> None:
    assert "barrel" in get_args(RoofGeometryMode)


def test_support_token_returns_barrel_supported_for_rectangle_without_slope() -> None:
    """Barrel mode uses ``barrel_rise_mm``, not planar slope — so a null
    slope must NOT gate the support token out."""

    rect = [(0.0, 0.0), (8000.0, 0.0), (8000.0, 4000.0), (0.0, 4000.0)]
    token = roof_geometry_support_token_v0(
        footprint_mm=rect,
        roof_geometry_mode="barrel",
        reference_level_resolves=True,
        slope_deg=None,
    )
    assert token == "barrel_supported"


def test_support_token_defers_non_rectangle_barrel_footprint() -> None:
    pent = [
        (0.0, 0.0),
        (8000.0, 0.0),
        (9000.0, 2000.0),
        (4000.0, 4500.0),
        (0.0, 3000.0),
    ]
    token = roof_geometry_support_token_v0(
        footprint_mm=pent,
        roof_geometry_mode="barrel",
        reference_level_resolves=True,
        slope_deg=None,
    )
    assert token == "non_rectangular_footprint_deferred"


def test_support_token_returns_missing_level_when_level_unresolved() -> None:
    rect = [(0.0, 0.0), (8000.0, 0.0), (8000.0, 4000.0), (0.0, 4000.0)]
    token = roof_geometry_support_token_v0(
        footprint_mm=rect,
        roof_geometry_mode="barrel",
        reference_level_resolves=False,
        slope_deg=None,
    )
    assert token == "missing_slope_or_level"


def test_assert_valid_barrel_footprint_accepts_rectangle() -> None:
    rect = [(0.0, 0.0), (8000.0, 0.0), (8000.0, 4000.0), (0.0, 4000.0)]
    # No exception.
    assert_valid_barrel_footprint_mm(rect)


def test_assert_valid_barrel_footprint_rejects_triangle() -> None:
    tri = [(0.0, 0.0), (5000.0, 0.0), (2500.0, 4000.0)]
    with pytest.raises(ValueError):
        assert_valid_barrel_footprint_mm(tri)


def test_assert_valid_barrel_rise_rejects_zero_or_negative() -> None:
    with pytest.raises(ValueError):
        assert_valid_barrel_rise_mm(None)
    with pytest.raises(ValueError):
        assert_valid_barrel_rise_mm(0)
    with pytest.raises(ValueError):
        assert_valid_barrel_rise_mm(-100.0)


def test_assert_valid_barrel_rise_accepts_positive() -> None:
    assert assert_valid_barrel_rise_mm(1500.0) == pytest.approx(1500.0)


def test_barrel_sweep_axis_picks_long_axis() -> None:
    # When X-span is longer, sweep is along X (the arc spans Z).
    assert barrel_sweep_axis_token(10000.0, 6000.0) == "alongX"
    # When Z-span is longer, sweep is along Z.
    assert barrel_sweep_axis_token(6000.0, 10000.0) == "alongZ"
    # Ties resolve to alongX for determinism.
    assert barrel_sweep_axis_token(5000.0, 5000.0) == "alongX"


def test_clamp_barrel_segment_count_defaults_and_clamps() -> None:
    assert clamp_barrel_segment_count(None) == BARREL_SEGMENT_COUNT_DEFAULT
    assert clamp_barrel_segment_count("not a number") == BARREL_SEGMENT_COUNT_DEFAULT
    assert clamp_barrel_segment_count(2) == BARREL_SEGMENT_COUNT_MIN
    assert clamp_barrel_segment_count(BARREL_SEGMENT_COUNT_MAX + 50) == BARREL_SEGMENT_COUNT_MAX
    assert clamp_barrel_segment_count(16) == 16


def test_barrel_arc_radius_for_half_circle_equals_half_chord() -> None:
    """When rise = chord/2 the arc is a half-circle and r == chord/2."""
    r = barrel_arc_radius_from_chord_and_rise_mm(4000.0, 2000.0)
    assert r == pytest.approx(2000.0)


def test_barrel_arc_radius_for_shallow_arc_grows() -> None:
    """Shallow rise → much larger radius (sanity)."""
    shallow = barrel_arc_radius_from_chord_and_rise_mm(4000.0, 500.0)
    deep = barrel_arc_radius_from_chord_and_rise_mm(4000.0, 2000.0)
    assert shallow > deep


def test_barrel_arc_profile_points_have_correct_endpoints_and_crown() -> None:
    chord = 4000.0
    rise = 1500.0
    n = 12
    pts = barrel_arc_profile_points_mm(chord, rise, n)
    # n+1 points returned.
    assert len(pts) == n + 1
    # Endpoints snap exactly to (0, 0) and (chord, 0).
    assert pts[0] == pytest.approx((0.0, 0.0))
    assert pts[-1] == pytest.approx((chord, 0.0))
    # Crown sits at chord midpoint with height == rise.
    crown = pts[n // 2]
    assert crown[0] == pytest.approx(chord / 2.0)
    assert crown[1] == pytest.approx(rise)
    # All intermediate points sit at v >= 0 (the arc is above the chord).
    assert all(p[1] >= -1e-6 for p in pts)


def test_barrel_arc_profile_points_handles_half_circle() -> None:
    """Half-circle (rise = chord/2) — endpoint angles approach ±90°."""
    chord = 4000.0
    rise = 2000.0
    n = 8
    pts = barrel_arc_profile_points_mm(chord, rise, n)
    crown = pts[n // 2]
    assert crown[1] == pytest.approx(rise)
    # No point should overshoot the rise.
    assert max(p[1] for p in pts) <= rise + 1.0


def test_barrel_arc_profile_points_rejects_bad_inputs() -> None:
    with pytest.raises(ValueError):
        barrel_arc_profile_points_mm(0.0, 1000.0, 12)
    with pytest.raises(ValueError):
        barrel_arc_profile_points_mm(4000.0, 0.0, 12)
    with pytest.raises(ValueError):
        barrel_arc_profile_points_mm(4000.0, 1000.0, 1)


def test_roof_elem_accepts_barrel_fields_via_snake_case() -> None:
    rf = RoofElem(
        kind="roof",
        id="rf-barrel",
        name="Tonnendach",
        reference_level_id="lvl-0",
        footprint_mm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 8000, "yMm": 0},
            {"xMm": 8000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
        roof_geometry_mode="barrel",
        barrel_rise_mm=1500.0,
        barrel_segment_count=16,
    )
    assert rf.roof_geometry_mode == "barrel"
    assert rf.barrel_rise_mm == pytest.approx(1500.0)
    assert rf.barrel_segment_count == 16


def test_roof_elem_accepts_barrel_fields_via_camel_case() -> None:
    rf = RoofElem.model_validate(
        {
            "kind": "roof",
            "id": "rf-barrel-camel",
            "name": "Tonnendach (camel)",
            "referenceLevelId": "lvl-0",
            "footprintMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 8000, "yMm": 0},
                {"xMm": 8000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
            "roofGeometryMode": "barrel",
            "barrelRiseMm": 1200.0,
            "barrelSegmentCount": 24,
        }
    )
    assert rf.roof_geometry_mode == "barrel"
    assert rf.barrel_rise_mm == pytest.approx(1200.0)
    assert rf.barrel_segment_count == 24


def test_roof_elem_back_compat_when_barrel_fields_omitted() -> None:
    rf = RoofElem(
        kind="roof",
        id="rf-bc",
        name="Plain gable",
        reference_level_id="lvl-0",
        footprint_mm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 6000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
    )
    assert rf.barrel_rise_mm is None
    assert rf.barrel_segment_count is None


@pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)
def test_ifc_barrel_export_sets_predefined_type_to_barrel_roof() -> None:
    """ISSUE-114: barrel emits ``IfcRoof.PredefinedType = BARREL_ROOF``.

    IFC4 IfcRoofTypeEnum has a dedicated BARREL_ROOF keyword for
    vault/cylindrical-segment roofs. The geometry body falls back to the
    planar slab prism for v0; the PredefinedType still lets downstream
    consumers identify the Tonnendach intent.
    """

    import ifcopenshell

    doc = Document(
        revision=901,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "rf-barrel": RoofElem(
                kind="roof",
                id="rf-barrel",
                name="Tonnendach",
                referenceLevelId="l0",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                overhangMm=300,
                roofGeometryMode="barrel",
                barrelRiseMm=1500,
                barrelSegmentCount=12,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    roofs = model.by_type("IfcRoof") or []
    assert len(roofs) == 1
    rf = roofs[0]
    assert getattr(rf, "PredefinedType", None) == "BARREL_ROOF"


@pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)
def test_ifc_existing_modes_do_not_regress_to_barrel_roof() -> None:
    """ISSUE-114 guardrail: gable / flat / mass_box do NOT silently inherit
    BARREL_ROOF when the new fields are absent."""

    import ifcopenshell

    doc = Document(
        revision=902,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "rf-gable": RoofElem(
                kind="roof",
                id="rf-gable",
                name="Gable",
                referenceLevelId="l0",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
                roofGeometryMode="gable_pitched_rectangle",
                slopeDeg=30,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    rf = model.by_type("IfcRoof")[0]
    pdt = getattr(rf, "PredefinedType", None)
    assert pdt != "BARREL_ROOF"


def test_barrel_arc_smooth_monotonic_rising_to_crown() -> None:
    """Sanity: heights rise monotonically from each eave toward the crown."""
    chord = 6000.0
    rise = 2000.0
    n = 12
    pts = barrel_arc_profile_points_mm(chord, rise, n)
    half = n // 2
    # Heights non-decreasing from left eave to crown.
    for i in range(half):
        assert pts[i + 1][1] >= pts[i][1] - 1e-6
    # Heights non-increasing from crown to right eave.
    for i in range(half, n):
        assert pts[i + 1][1] <= pts[i][1] + 1e-6
    # Symmetric to within float precision around the chord midpoint.
    for i in range(half + 1):
        left = pts[i]
        right = pts[n - i]
        assert math.isclose(left[1], right[1], abs_tol=1e-6)
        assert math.isclose(chord - left[0], right[0], abs_tol=1e-6)
