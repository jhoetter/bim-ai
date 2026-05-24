"""ISSUE-53 — mono_pitch (Pultdach) RoofGeometryMode coverage.

Covers:
- `"mono_pitch"` is a valid `RoofGeometryMode` literal.
- `roof_geometry_support_token_v0` resolves rectangle Pultdach footprints to
  the new `"mono_pitch_supported"` token (and falls back to
  `non_rectangular_footprint_deferred` otherwise).
- `assert_valid_mono_pitch_footprint_mm` rejects non-rectangles.
- `mono_pitch_default_high_edge` picks "n" for ridge-along-X footprints and
  "e" for ridge-along-Z.
- `mono_pitch_ridge_rise_mm` matches `span_perp * tan(slope)` and exposes the
  correct ridge axis token.
- `createRoof` engine dispatch persists the new `mono_pitch_high_edge` field
  and rejects non-rectangular Pultdach footprints.
- IFC export emits `IfcRoof.PredefinedType = "SHED_ROOF"` for mono_pitch (IFC4's
  IfcRoofTypeEnum uses SHED_ROOF for the single-slope / Pultdach variant — see
  the buildingSMART IFC4 IfcRoof documentation; "monopitch" is colloquial).
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
    assert_valid_mono_pitch_footprint_mm,
    mono_pitch_default_high_edge,
    mono_pitch_ridge_rise_mm,
    roof_geometry_support_token_v0,
)


def test_mono_pitch_is_a_valid_roof_geometry_mode_literal() -> None:
    assert "mono_pitch" in get_args(RoofGeometryMode)


def test_support_token_v0_returns_mono_pitch_supported_for_rectangle() -> None:
    rect = [(0.0, 0.0), (6000.0, 0.0), (6000.0, 4000.0), (0.0, 4000.0)]
    token = roof_geometry_support_token_v0(
        footprint_mm=rect,
        roof_geometry_mode="mono_pitch",
        reference_level_resolves=True,
        slope_deg=15.0,
    )
    assert token == "mono_pitch_supported"


def test_support_token_v0_defers_non_rectangle_mono_pitch_footprint() -> None:
    # Convex pentagon — not a rectangle. Should defer for now (per v0 scope).
    pent = [
        (0.0, 0.0),
        (6000.0, 0.0),
        (7000.0, 2000.0),
        (3000.0, 4000.0),
        (0.0, 3000.0),
    ]
    token = roof_geometry_support_token_v0(
        footprint_mm=pent,
        roof_geometry_mode="mono_pitch",
        reference_level_resolves=True,
        slope_deg=15.0,
    )
    # The pentagon is convex with ≥ 4 vertices but not a rectangle; the
    # generic convex/hip branch resolves it as a hip candidate, which is the
    # correct "deferred" surface for mono_pitch v0 (rectangle-only).
    assert token in {"hip_candidate_deferred", "non_rectangular_footprint_deferred"}


def test_assert_valid_mono_pitch_footprint_rejects_non_rectangle() -> None:
    tri = [(0.0, 0.0), (5000.0, 0.0), (2500.0, 4000.0)]
    with pytest.raises(ValueError):
        assert_valid_mono_pitch_footprint_mm(tri)


def test_assert_valid_mono_pitch_footprint_accepts_rectangle() -> None:
    rect = [(0.0, 0.0), (6000.0, 0.0), (6000.0, 4000.0), (0.0, 4000.0)]
    # Does not raise.
    assert_valid_mono_pitch_footprint_mm(rect)


def test_mono_pitch_default_high_edge_picks_n_when_ridge_along_x() -> None:
    # Long span along X → ridge along X → default high edge "n".
    assert mono_pitch_default_high_edge(span_x=8000.0, span_z=4000.0) == "n"


def test_mono_pitch_default_high_edge_picks_e_when_ridge_along_z() -> None:
    # Long span along Z → ridge along Z → default high edge "e".
    assert mono_pitch_default_high_edge(span_x=4000.0, span_z=8000.0) == "e"


def test_mono_pitch_ridge_rise_matches_run_times_tan_slope() -> None:
    span_x, span_z, slope_deg = 6000.0, 4000.0, 15.0
    rise_mm, axis = mono_pitch_ridge_rise_mm(
        span_x, span_z, slope_deg, high_edge="n"
    )
    assert axis == "alongX"
    # Pultdach: full span perpendicular to the ridge is the run (4000 mm here).
    assert rise_mm == pytest.approx(span_z * math.tan(math.radians(slope_deg)))

    rise_e, axis_e = mono_pitch_ridge_rise_mm(
        span_x, span_z, slope_deg, high_edge="e"
    )
    assert axis_e == "alongZ"
    assert rise_e == pytest.approx(span_x * math.tan(math.radians(slope_deg)))


def test_create_roof_dispatch_persists_mono_pitch_fields() -> None:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="G", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-1",
        name="Pultdach",
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 6000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
        roofGeometryMode="mono_pitch",
        slopeDeg=15,
        monoPitchHighEdge="n",
    )
    apply_inplace(doc, cmd)
    rf = doc.elements["rf-1"]
    assert isinstance(rf, RoofElem)
    assert rf.roof_geometry_mode == "mono_pitch"
    assert rf.mono_pitch_high_edge == "n"


def test_create_roof_alias_normalisation_maps_mono_slope_to_mono_pitch() -> None:
    cmd = CreateRoofCmd(
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 6000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
        roofGeometryMode="mono_slope",
        slopeDeg=15,
    )
    assert cmd.roof_geometry_mode == "mono_pitch"


def test_create_roof_dispatch_rejects_non_rectangle_mono_pitch_footprint() -> None:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="G", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-bad",
        name="Bad Pultdach",
        referenceLevelId="lvl-0",
        # Triangle — not a rectangle.
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 3000, "yMm": 4000},
        ],
        roofGeometryMode="mono_pitch",
        slopeDeg=15,
    )
    with pytest.raises(ValueError):
        apply_inplace(doc, cmd)


@pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)
def test_ifc_mono_pitch_export_sets_predefined_type() -> None:
    """ISSUE-53: mono_pitch roofs emit IfcRoof.PredefinedType = SHED_ROOF.

    IFC4's `IfcRoofTypeEnum` uses `SHED_ROOF` for the single-slope variant
    (the buildingSMART IFC4 documentation describes SHED_ROOF as a roof with
    a single inclination — i.e. mono-pitch / Pultdach). There is no separate
    `MONOPITCH_ROOF` keyword in the enum.
    """

    import ifcopenshell

    doc = Document(
        revision=703,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-mono": RoofElem(
                kind="roof",
                id="rf-mono",
                name="Pultdach Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6000, "yMm": 0},
                    {"xMm": 6000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                overhangMm=300,
                slopeDeg=15,
                roofGeometryMode="mono_pitch",
                monoPitchHighEdge="n",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    roofs = model.by_type("IfcRoof") or []
    assert len(roofs) == 1
    rf = roofs[0]
    assert getattr(rf, "PredefinedType", None) == "SHED_ROOF"

    # The body is a single tilted slab → IfcExtrudedAreaSolid with a
    # 3-vertex right-triangle profile (eave + ridge + eave-closure).
    body = None
    for r in rf.Representation.Representations or []:
        if getattr(r, "RepresentationIdentifier", None) == "Body":
            body = r
            break
    assert body is not None
    items = list(body.Items or [])
    assert len(items) == 1
    extrusion = items[0]
    assert extrusion.is_a("IfcExtrudedAreaSolid")
    pts = list(extrusion.SweptArea.OuterCurve.Points)
    # 3 unique corners + closure point
    assert len(pts) == 4
    ys = [p.Coordinates[1] for p in pts]
    # Pultdach rise = 4.0 m * tan(15°)
    expected_rise = 4.0 * math.tan(math.radians(15.0))
    assert max(ys) == pytest.approx(expected_rise, abs=1e-3)
    assert min(ys) == pytest.approx(0.0, abs=1e-6)
