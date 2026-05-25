"""ISSUE-110 — pyramidal_hip (Zeltdach / Pyramidendach) RoofGeometryMode coverage.

Covers:
- ``"pyramidal_hip"`` is a valid ``RoofGeometryMode`` literal.
- ``roof_geometry_support_token_v0`` resolves rectangle Zeltdach footprints to
  the new ``"pyramidal_hip_supported"`` token (and falls back to the existing
  hip / deferred surfaces otherwise).
- ``footprint_is_square_ish_mm`` accepts a perfect square + a ±15 % aspect
  rectangle, rejects clearly oblong + non-rectangular footprints.
- ``assert_valid_pyramidal_hip_footprint_mm`` rejects non-rectangles.
- ``pyramidal_hip_apex_rise_mm`` matches ``short_half_span * tan(slope)``.
- ``CreateRoofCmd`` normalises authoring aliases (pyramid, zeltdach, …) onto
  the kernel literal.
- ``createRoof`` engine dispatch persists ``roof_geometry_mode = "pyramidal_hip"``
  and rejects non-rectangular Zeltdach footprints.
- IFC export emits ``IfcRoof.PredefinedType = "HIP_ROOF"`` for pyramidal_hip
  (IFC4's IfcRoofTypeEnum has no PYRAMIDAL_ROOF literal; HIP_ROOF is the
  closest semantic match — a hip whose ridge has collapsed to a single point).
"""

from __future__ import annotations

import math
from typing import get_args

import pytest

from bim_ai.commands.geometry import CreateRoofCmd
from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoofElem
from bim_ai.engine import apply_inplace
from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step
from bim_ai.roof_geometry import (
    RoofGeometryMode,
    assert_valid_pyramidal_hip_footprint_mm,
    footprint_is_square_ish_mm,
    pyramidal_hip_apex_rise_mm,
    roof_geometry_support_token_v0,
)


def test_pyramidal_hip_is_a_valid_roof_geometry_mode_literal() -> None:
    assert "pyramidal_hip" in get_args(RoofGeometryMode)


def test_support_token_v0_returns_pyramidal_hip_supported_for_square() -> None:
    square = [(0.0, 0.0), (5000.0, 0.0), (5000.0, 5000.0), (0.0, 5000.0)]
    token = roof_geometry_support_token_v0(
        footprint_mm=square,
        roof_geometry_mode="pyramidal_hip",
        reference_level_resolves=True,
        slope_deg=35.0,
    )
    assert token == "pyramidal_hip_supported"


def test_support_token_v0_accepts_near_square_rectangle_pyramidal_hip() -> None:
    # 5.4 × 5.6 m — typical Stadtvilla main block; still author as Zeltdach.
    near_square = [(0.0, 0.0), (5400.0, 0.0), (5400.0, 5600.0), (0.0, 5600.0)]
    token = roof_geometry_support_token_v0(
        footprint_mm=near_square,
        roof_geometry_mode="pyramidal_hip",
        reference_level_resolves=True,
        slope_deg=35.0,
    )
    assert token == "pyramidal_hip_supported"


def test_support_token_v0_defers_pyramidal_hip_on_non_rectangle() -> None:
    # Convex pentagon — not an axis-aligned rectangle. Should defer to the
    # hip candidate surface so the renderer takes the slab fallback.
    pent = [
        (0.0, 0.0),
        (6000.0, 0.0),
        (7000.0, 2000.0),
        (3000.0, 4000.0),
        (0.0, 3000.0),
    ]
    token = roof_geometry_support_token_v0(
        footprint_mm=pent,
        roof_geometry_mode="pyramidal_hip",
        reference_level_resolves=True,
        slope_deg=35.0,
    )
    assert token in {"hip_candidate_deferred", "non_rectangular_footprint_deferred"}


def test_footprint_is_square_ish_mm_accepts_perfect_square() -> None:
    square = [(0.0, 0.0), (5000.0, 0.0), (5000.0, 5000.0), (0.0, 5000.0)]
    assert footprint_is_square_ish_mm(square) is True


def test_footprint_is_square_ish_mm_accepts_near_square() -> None:
    # 5400 × 5600 → aspect 1.037, within the default 15 % tolerance.
    near_square = [(0.0, 0.0), (5400.0, 0.0), (5400.0, 5600.0), (0.0, 5600.0)]
    assert footprint_is_square_ish_mm(near_square) is True


def test_footprint_is_square_ish_mm_rejects_oblong_rectangle() -> None:
    # 4 × 10 m — aspect 2.5, well beyond the 1.15 cutoff.
    oblong = [(0.0, 0.0), (10000.0, 0.0), (10000.0, 4000.0), (0.0, 4000.0)]
    assert footprint_is_square_ish_mm(oblong) is False


def test_footprint_is_square_ish_mm_rejects_non_rectangle() -> None:
    tri = [(0.0, 0.0), (5000.0, 0.0), (2500.0, 4000.0)]
    assert footprint_is_square_ish_mm(tri) is False


def test_footprint_is_square_ish_mm_custom_tolerance() -> None:
    # 5 × 6 → aspect 1.2; outside 15 % default but inside 25 %.
    rect = [(0.0, 0.0), (5000.0, 0.0), (5000.0, 6000.0), (0.0, 6000.0)]
    assert footprint_is_square_ish_mm(rect, aspect_tol=0.15) is False
    assert footprint_is_square_ish_mm(rect, aspect_tol=0.25) is True


def test_assert_valid_pyramidal_hip_footprint_rejects_non_rectangle() -> None:
    tri = [(0.0, 0.0), (5000.0, 0.0), (2500.0, 4000.0)]
    with pytest.raises(ValueError):
        assert_valid_pyramidal_hip_footprint_mm(tri)


def test_assert_valid_pyramidal_hip_footprint_accepts_rectangle() -> None:
    rect = [(0.0, 0.0), (5000.0, 0.0), (5000.0, 5000.0), (0.0, 5000.0)]
    # No exception.
    assert_valid_pyramidal_hip_footprint_mm(rect)


def test_pyramidal_hip_apex_rise_mm_square_matches_short_half_span() -> None:
    span = 5000.0
    slope_deg = 35.0
    rise = pyramidal_hip_apex_rise_mm(span, span, slope_deg)
    expected = (span / 2.0) * math.tan(math.radians(slope_deg))
    assert rise == pytest.approx(expected, rel=1e-9)


def test_pyramidal_hip_apex_rise_mm_uses_short_axis_for_rectangles() -> None:
    # For a 5 × 8 rectangle the apex sits above the centroid; the steeper
    # short-side faces hit `slope_deg` exactly, so rise = short_half * tan().
    short = 5000.0
    long_ = 8000.0
    slope_deg = 30.0
    rise = pyramidal_hip_apex_rise_mm(long_, short, slope_deg)
    expected = (short / 2.0) * math.tan(math.radians(slope_deg))
    assert rise == pytest.approx(expected, rel=1e-9)
    # And swapping axes is symmetric.
    assert pyramidal_hip_apex_rise_mm(short, long_, slope_deg) == pytest.approx(rise, rel=1e-9)


def test_create_roof_cmd_normalises_pyramid_aliases_to_pyramidal_hip() -> None:
    for alias in (
        "pyramid",
        "pyramidal",
        "pyramid_roof",
        "pyramidal_roof",
        "zelt",
        "zeltdach",
        "pyramidendach",
        "pavilion_roof",
        "tent_roof",
    ):
        cmd = CreateRoofCmd(
            type="createRoof",
            referenceLevelId="lvl-0",
            footprintMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 5000},
                {"xMm": 0, "yMm": 5000},
            ],
            roofGeometryMode=alias,
            slopeDeg=35.0,
        )
        assert cmd.roof_geometry_mode == "pyramidal_hip", f"alias '{alias}' did not normalise"


def _square_doc(slope_deg: float = 35.0) -> Document:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="L0", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-0",
        name="Zeltdach",
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 6000, "yMm": 6000},
            {"xMm": 0, "yMm": 6000},
        ],
        slopeDeg=slope_deg,
        roofGeometryMode="pyramidal_hip",
    )
    apply_inplace(doc, cmd)
    return doc


def test_engine_dispatch_persists_pyramidal_hip_mode() -> None:
    doc = _square_doc()
    rf = doc.elements["rf-0"]
    assert isinstance(rf, RoofElem)
    assert rf.roof_geometry_mode == "pyramidal_hip"


def test_engine_dispatch_rejects_non_rectangle_pyramidal_hip() -> None:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="L0", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-bad",
        name="Bad Zeltdach",
        referenceLevelId="lvl-0",
        # Triangle — not a rectangle.
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 5000, "yMm": 0},
            {"xMm": 2500, "yMm": 4000},
        ],
        slopeDeg=35.0,
        roofGeometryMode="pyramidal_hip",
    )
    with pytest.raises(ValueError, match="pyramidal_hip"):
        apply_inplace(doc, cmd)


@pytest.mark.skipif(not IFC_AVAILABLE, reason="ifcopenshell not installed in this environment")
def test_ifc_export_emits_hip_roof_predefined_type_for_pyramidal_hip() -> None:
    """Authoritative kernel replay tag: PredefinedType=HIP_ROOF for Zeltdach."""

    doc = _square_doc()
    step_text = export_ifc_model_step(doc)
    assert isinstance(step_text, str)
    # The IfcRoof entity for pyramidal_hip should carry PredefinedType=HIP_ROOF.
    # Match a relaxed substring rather than a strict regex so the test is
    # resilient to ifcopenshell formatting nits.
    assert "HIP_ROOF" in step_text


@pytest.mark.skipif(not IFC_AVAILABLE, reason="ifcopenshell not installed in this environment")
def test_ifc_export_round_trips_pyramidal_hip_plan_footprint() -> None:
    """The plan footprint round-trips via Pset_BimAiKernel so authoritative
    replay reconstructs the Zeltdach without inverting the slab profile."""

    doc = _square_doc()
    step_text = export_ifc_model_step(doc)
    assert "BimAiRoofPlanFootprintMm" in step_text
    # The kernel mode literal also rides on Pset_BimAiKernel.
    assert "pyramidal_hip" in step_text
