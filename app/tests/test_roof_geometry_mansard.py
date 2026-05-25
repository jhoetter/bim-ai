"""ISSUE-112 — mansard (Mansarddach + Mansardgauben) RoofGeometryMode coverage.

Covers:
- ``"mansard"`` is a valid ``RoofGeometryMode`` literal.
- ``roof_geometry_support_token_v0`` resolves rectangle mansard footprints
  to the new ``"mansard_supported"`` token.
- ``assert_valid_mansard_footprint_mm`` rejects non-rectangles and accepts
  axis-aligned rectangles.
- ``clamp_mansard_pitch_deg`` clamps into [min, max] and falls back on
  garbage / None / NaN.
- ``mansard_knee_height_mm`` resolves the knee elevation (default fraction +
  user override + max-skirt-rise clamp).
- ``mansard_upper_ridge_rise_mm`` returns knee + cap rise consistent with the
  two-pitch geometry.
- ``CreateRoofCmd`` accepts the new mode + ``mansard*`` fields, rejects
  non-rectangular mansard footprints, and persists the parameters on the
  resulting ``RoofElem``.
- IFC export tags ``IfcRoof.PredefinedType = MANSARD_ROOF`` (IFC4
  IfcRoofTypeEnum has MANSARD_ROOF explicitly) and round-trips the mansard
  pitches + knee height via ``Pset_BimAiKernel``.
- Author-friendly aliases ("mansard_roof", "mansarddach", "french_roof",
  "two_pitch") normalise into the kernel ``mansard`` literal.
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
    assert_valid_mansard_footprint_mm,
    clamp_mansard_pitch_deg,
    mansard_default_lower_pitch_deg,
    mansard_default_upper_pitch_deg,
    mansard_knee_height_mm,
    mansard_upper_ridge_rise_mm,
    roof_geometry_support_token_v0,
)

RECT_FOOTPRINT_MM = [
    (0.0, 0.0),
    (12000.0, 0.0),
    (12000.0, 9000.0),
    (0.0, 9000.0),
]


def test_mansard_is_a_valid_roof_geometry_mode_literal() -> None:
    assert "mansard" in get_args(RoofGeometryMode)


def test_support_token_v0_returns_mansard_supported_for_rectangle() -> None:
    token = roof_geometry_support_token_v0(
        footprint_mm=RECT_FOOTPRINT_MM,
        roof_geometry_mode="mansard",
        reference_level_resolves=True,
        slope_deg=70.0,
    )
    assert token == "mansard_supported"


def test_support_token_v0_defers_non_rectangular_mansard_footprint() -> None:
    pentagon = [
        (0.0, 0.0),
        (8000.0, 0.0),
        (9000.0, 3000.0),
        (4000.0, 6000.0),
        (0.0, 5000.0),
    ]
    token = roof_geometry_support_token_v0(
        footprint_mm=pentagon,
        roof_geometry_mode="mansard",
        reference_level_resolves=True,
        slope_deg=70.0,
    )
    # Convex pentagon falls through to the hip-candidate branch — the
    # correct "deferred" surface for v0.
    assert token in {"hip_candidate_deferred", "non_rectangular_footprint_deferred"}


def test_assert_valid_mansard_footprint_rejects_non_rectangle() -> None:
    tri = [(0.0, 0.0), (6000.0, 0.0), (3000.0, 4500.0)]
    with pytest.raises(ValueError):
        assert_valid_mansard_footprint_mm(tri)


def test_assert_valid_mansard_footprint_accepts_rectangle() -> None:
    # Does not raise.
    assert_valid_mansard_footprint_mm(RECT_FOOTPRINT_MM)


def test_mansard_default_pitches_match_typical_french_practice() -> None:
    # Steep lower skirt (~70°) + shallow upper cap (~20°) is the classic
    # Mansarddach silhouette. We pin these so callers that omit the fields
    # always get a recognisable Mansard.
    assert mansard_default_lower_pitch_deg() == pytest.approx(70.0)
    assert mansard_default_upper_pitch_deg() == pytest.approx(20.0)


@pytest.mark.parametrize(
    "raw,default,expected",
    [
        (None, 70.0, 70.0),
        (60.0, 70.0, 60.0),
        (0.0, 70.0, 1.0),  # clamp below min
        (95.0, 70.0, 89.0),  # clamp above max
        (float("nan"), 20.0, 20.0),  # NaN ⇒ default
        ("garbage", 20.0, 20.0),
    ],
)
def test_clamp_mansard_pitch_deg(raw, default, expected) -> None:
    assert clamp_mansard_pitch_deg(raw, default=default) == pytest.approx(expected)


def test_mansard_knee_height_defaults_to_60_pct_of_max_skirt_rise() -> None:
    # span 12 × 9 m, lower 70° → max skirt rise = (9000/2) * tan(70°) ≈ 12361 mm.
    # Default fraction 0.6 → ≈ 7416 mm.
    knee = mansard_knee_height_mm(
        span_x=12000.0,
        span_z=9000.0,
        lower_pitch_deg=70.0,
        raw_knee_height_mm=None,
    )
    expected = (9000.0 / 2.0) * math.tan(math.radians(70.0)) * 0.6
    assert knee == pytest.approx(expected, rel=1e-3)


def test_mansard_knee_height_clamps_at_max_skirt_rise() -> None:
    # Requesting a knee above the max → clamped to (max - 1) mm so the cap
    # still has ≥ 1 mm headroom.
    knee = mansard_knee_height_mm(
        span_x=12000.0,
        span_z=9000.0,
        lower_pitch_deg=70.0,
        raw_knee_height_mm=99_999.0,
    )
    max_rise = (9000.0 / 2.0) * math.tan(math.radians(70.0))
    assert knee == pytest.approx(max_rise - 1.0, rel=1e-3)


def test_mansard_knee_height_floors_at_min_height() -> None:
    # Requested knee at 50 mm → clamped up to min_height_mm = 100 mm.
    knee = mansard_knee_height_mm(
        span_x=12000.0,
        span_z=9000.0,
        lower_pitch_deg=70.0,
        raw_knee_height_mm=50.0,
    )
    assert knee == pytest.approx(100.0)


def test_mansard_upper_ridge_rise_equals_knee_plus_cap_rise() -> None:
    span_x = 12000.0
    span_z = 9000.0
    lower = 70.0
    upper = 20.0
    knee = mansard_knee_height_mm(
        span_x=span_x,
        span_z=span_z,
        lower_pitch_deg=lower,
        raw_knee_height_mm=4000.0,
    )
    ridge = mansard_upper_ridge_rise_mm(
        span_x=span_x,
        span_z=span_z,
        lower_pitch_deg=lower,
        upper_pitch_deg=upper,
        knee_height_mm=knee,
    )
    # Reconstruct: inset = knee / tan(lower); inner_short = span_z - 2*inset;
    # cap_rise = (inner_short/2) * tan(upper); total ridge = knee + cap_rise.
    inset = knee / math.tan(math.radians(lower))
    inner_short = min(span_x - 2 * inset, span_z - 2 * inset)
    cap_rise = (inner_short / 2.0) * math.tan(math.radians(upper))
    assert ridge == pytest.approx(knee + cap_rise, rel=1e-6)


def test_mansard_ridge_strictly_above_knee_for_positive_upper_pitch() -> None:
    # A finite positive upper pitch on a non-degenerate inner rectangle must
    # produce a ridge rise strictly above the knee height.
    knee = mansard_knee_height_mm(
        span_x=12000.0,
        span_z=9000.0,
        lower_pitch_deg=70.0,
        raw_knee_height_mm=4000.0,
    )
    ridge = mansard_upper_ridge_rise_mm(
        span_x=12000.0,
        span_z=9000.0,
        lower_pitch_deg=70.0,
        upper_pitch_deg=20.0,
        knee_height_mm=knee,
    )
    assert ridge > knee


def test_create_roof_dispatch_persists_mansard_fields() -> None:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="G", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-mansard",
        name="Mansard Roof",
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 12000, "yMm": 0},
            {"xMm": 12000, "yMm": 9000},
            {"xMm": 0, "yMm": 9000},
        ],
        roofGeometryMode="mansard",
        slopeDeg=70,
        mansardLowerPitchDeg=72,
        mansardUpperPitchDeg=18,
        mansardKneeHeightMm=3500,
    )
    apply_inplace(doc, cmd)
    rf = doc.elements["rf-mansard"]
    assert isinstance(rf, RoofElem)
    assert rf.roof_geometry_mode == "mansard"
    assert rf.mansard_lower_pitch_deg == pytest.approx(72.0)
    assert rf.mansard_upper_pitch_deg == pytest.approx(18.0)
    assert rf.mansard_knee_height_mm == pytest.approx(3500.0)


def test_create_roof_dispatch_rejects_non_rectangle_mansard_footprint() -> None:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="G", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-bad",
        name="Bad Mansard",
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 3000, "yMm": 4000},  # triangle, not a rectangle
        ],
        roofGeometryMode="mansard",
        slopeDeg=70,
    )
    with pytest.raises(ValueError):
        apply_inplace(doc, cmd)


def test_create_roof_alias_normalisation_maps_aliases_to_mansard() -> None:
    """Authoring callers can use friendly aliases for the Mansarddach mode."""

    for alias in (
        "mansard_roof",
        "mansarddach",
        "french_roof",
        "two_pitch",
    ):
        cmd = CreateRoofCmd(
            referenceLevelId="lvl-0",
            footprintMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 8000, "yMm": 0},
                {"xMm": 8000, "yMm": 6000},
                {"xMm": 0, "yMm": 6000},
            ],
            roofGeometryMode=alias,
            slopeDeg=70,
        )
        assert cmd.roof_geometry_mode == "mansard", alias


def test_create_roof_defaults_mansard_fields_to_none() -> None:
    """Omitting the mansard fields leaves them None so the renderer can apply
    its own defaults (avoids accidental data drift)."""

    cmd = CreateRoofCmd(
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 8000, "yMm": 0},
            {"xMm": 8000, "yMm": 6000},
            {"xMm": 0, "yMm": 6000},
        ],
        roofGeometryMode="mansard",
        slopeDeg=70,
    )
    assert cmd.mansard_lower_pitch_deg is None
    assert cmd.mansard_upper_pitch_deg is None
    assert cmd.mansard_knee_height_mm is None


@pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)
def test_ifc_mansard_export_sets_predefined_type_mansard_roof() -> None:
    """ISSUE-112: mansard roofs emit IfcRoof.PredefinedType = MANSARD_ROOF.

    IFC4's ``IfcRoofTypeEnum`` enumerates ``MANSARD_ROOF`` explicitly for
    the two-pitch French roof. The kernel parameters (lower/upper pitches,
    knee height) round-trip via Pset_BimAiKernel so authoritative replay
    reconstructs the same Mansarddach.
    """

    import ifcopenshell

    doc = Document(
        revision=816,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-mn": RoofElem(
                kind="roof",
                id="rf-mn",
                name="Mansard Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 12000, "yMm": 0},
                    {"xMm": 12000, "yMm": 9000},
                    {"xMm": 0, "yMm": 9000},
                ],
                overhangMm=300,
                slopeDeg=70,
                roofGeometryMode="mansard",
                mansardLowerPitchDeg=72,
                mansardUpperPitchDeg=18,
                mansardKneeHeightMm=3500,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    roofs = model.by_type("IfcRoof") or []
    assert len(roofs) == 1
    rf = roofs[0]
    assert getattr(rf, "PredefinedType", None) == "MANSARD_ROOF"

    # Round-trip Pset: the mansard fields live in Pset_BimAiKernel so
    # authoritative replay can reconstruct the same Mansarddach.
    psets = []
    for rel in model.by_type("IfcRelDefinesByProperties") or []:
        if rf in (rel.RelatedObjects or []):
            psets.append(rel.RelatingPropertyDefinition)
    found: dict[str, float] = {}
    for ps in psets:
        if getattr(ps, "Name", None) == "Pset_BimAiKernel":
            for p in ps.HasProperties or []:
                # Only the mansard numeric props are floats — skip the
                # kernel-identity Reference string and the footprint blob.
                if not str(p.Name).startswith("BimAiRoofMansard"):
                    continue
                found[p.Name] = float(p.NominalValue.wrappedValue)
    assert found.get("BimAiRoofMansardLowerPitchDeg") == pytest.approx(72.0)
    assert found.get("BimAiRoofMansardUpperPitchDeg") == pytest.approx(18.0)
    assert found.get("BimAiRoofMansardKneeHeightMm") == pytest.approx(3500.0)


def test_predicate_function_does_not_raise_for_default_rectangle() -> None:
    # Smoke test: the rectangle used in the IFC test passes the predicate.
    assert_valid_mansard_footprint_mm(RECT_FOOTPRINT_MM)
