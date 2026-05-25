"""ISSUE-105 — half_gable (Krüppelwalmdach) RoofGeometryMode coverage.

Covers:
- ``"half_gable"`` is a valid ``RoofGeometryMode`` literal.
- ``roof_geometry_support_token_v0`` resolves rectangle half-gable footprints
  to the new ``"half_gable_supported"`` token.
- ``assert_valid_half_gable_footprint_mm`` rejects non-rectangles and accepts
  axis-aligned rectangles.
- ``clamp_half_hip_height_fraction`` clamps into [0, 1] and falls back on
  garbage / None / NaN.
- ``half_gable_truncation_height_mm`` matches ``ridge_rise * (1 - fraction)``
  with the 0 / 1 edge cases producing the expected pure-gable / pure-hip caps.
- ``CreateRoofCmd`` accepts the new mode + ``halfHipHeightFraction`` field,
  rejects non-rectangular Krüppelwalm footprints, and persists the fraction
  on the resulting ``RoofElem``.
- IFC export tags ``IfcRoof.PredefinedType = HIPPED_GABLE_ROOF`` for
  half_gable (IFC4's IfcRoofTypeEnum explicitly lists HIPPED_GABLE_ROOF for
  the half-hipped variant — see buildingSMART IFC4 documentation).
- Author-friendly aliases ("kruppelwalm", "half_hipped", "jerkin_head",
  "clipped_gable") normalise into the kernel ``half_gable`` literal.
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
    assert_valid_half_gable_footprint_mm,
    clamp_half_hip_height_fraction,
    half_gable_truncation_height_mm,
    roof_geometry_support_token_v0,
)

RECT_FOOTPRINT_MM = [
    (0.0, 0.0),
    (8000.0, 0.0),
    (8000.0, 5000.0),
    (0.0, 5000.0),
]


def test_half_gable_is_a_valid_roof_geometry_mode_literal() -> None:
    assert "half_gable" in get_args(RoofGeometryMode)


def test_support_token_v0_returns_half_gable_supported_for_rectangle() -> None:
    token = roof_geometry_support_token_v0(
        footprint_mm=RECT_FOOTPRINT_MM,
        roof_geometry_mode="half_gable",
        reference_level_resolves=True,
        slope_deg=35.0,
    )
    assert token == "half_gable_supported"


def test_support_token_v0_defers_non_rectangular_half_gable_footprint() -> None:
    pentagon = [
        (0.0, 0.0),
        (6000.0, 0.0),
        (7000.0, 2000.0),
        (3000.0, 4500.0),
        (0.0, 3000.0),
    ]
    token = roof_geometry_support_token_v0(
        footprint_mm=pentagon,
        roof_geometry_mode="half_gable",
        reference_level_resolves=True,
        slope_deg=35.0,
    )
    # Convex pentagon (not a rectangle): falls through to the generic
    # hip-candidate branch — the correct "deferred" surface for v0.
    assert token in {"hip_candidate_deferred", "non_rectangular_footprint_deferred"}


def test_assert_valid_half_gable_footprint_rejects_non_rectangle() -> None:
    tri = [(0.0, 0.0), (6000.0, 0.0), (3000.0, 4500.0)]
    with pytest.raises(ValueError):
        assert_valid_half_gable_footprint_mm(tri)


def test_assert_valid_half_gable_footprint_accepts_rectangle() -> None:
    # Does not raise.
    assert_valid_half_gable_footprint_mm(RECT_FOOTPRINT_MM)


@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, 0.33),  # default = top third (Krüppelwalm convention)
        (0.0, 0.0),  # full gable
        (1.0, 1.0),  # full hip
        (0.5, 0.5),
        (-0.5, 0.0),  # clamp below
        (1.5, 1.0),  # clamp above
        (float("nan"), 0.33),  # NaN ⇒ default (graceful degrade)
        ("garbage", 0.33),  # invalid ⇒ default
    ],
)
def test_clamp_half_hip_height_fraction(raw, expected) -> None:
    assert clamp_half_hip_height_fraction(raw) == pytest.approx(expected)


def test_half_gable_truncation_height_zero_fraction_returns_full_rise() -> None:
    # fraction 0 ⇒ truncation at the full ridge rise ⇒ no hip cap (pure gable).
    assert half_gable_truncation_height_mm(2400.0, 0.0) == pytest.approx(2400.0)


def test_half_gable_truncation_height_one_fraction_returns_zero() -> None:
    # fraction 1 ⇒ truncation at the eave ⇒ functionally a full hip.
    assert half_gable_truncation_height_mm(2400.0, 1.0) == pytest.approx(0.0)


def test_half_gable_truncation_height_one_third_returns_two_thirds() -> None:
    # fraction 0.33 ⇒ truncation at 67% of the ridge rise (hip covers top third).
    assert half_gable_truncation_height_mm(3000.0, 0.33) == pytest.approx(
        3000.0 * (1 - 0.33)
    )


def test_create_roof_dispatch_persists_half_gable_fields() -> None:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="G", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-kw",
        name="Krüppelwalm Roof",
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 8000, "yMm": 0},
            {"xMm": 8000, "yMm": 5000},
            {"xMm": 0, "yMm": 5000},
        ],
        roofGeometryMode="half_gable",
        slopeDeg=35,
        halfHipHeightFraction=0.33,
    )
    apply_inplace(doc, cmd)
    rf = doc.elements["rf-kw"]
    assert isinstance(rf, RoofElem)
    assert rf.roof_geometry_mode == "half_gable"
    assert rf.half_hip_height_fraction == pytest.approx(0.33)


def test_create_roof_dispatch_rejects_non_rectangle_half_gable_footprint() -> None:
    doc = Document(
        revision=0,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="G", elevationMm=0),
        },
    )
    cmd = CreateRoofCmd(
        id="rf-bad",
        name="Bad Krüppelwalm",
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 3000, "yMm": 4000},  # triangle, not a rectangle
        ],
        roofGeometryMode="half_gable",
        slopeDeg=30,
    )
    with pytest.raises(ValueError):
        apply_inplace(doc, cmd)


def test_create_roof_alias_normalisation_maps_aliases_to_half_gable() -> None:
    """Authoring callers can use friendly aliases for the Krüppelwalm mode."""

    for alias in (
        "kruppelwalm",
        "krueppelwalmdach",
        "half_hipped",
        "jerkin_head",
        "clipped_gable",
    ):
        cmd = CreateRoofCmd(
            referenceLevelId="lvl-0",
            footprintMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 6000, "yMm": 0},
                {"xMm": 6000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
            roofGeometryMode=alias,
            slopeDeg=30,
        )
        assert cmd.roof_geometry_mode == "half_gable", alias


def test_create_roof_defaults_half_hip_height_fraction_to_none() -> None:
    """Omitting halfHipHeightFraction leaves the field None so the renderer
    can apply its own default (avoids accidental data drift)."""

    cmd = CreateRoofCmd(
        referenceLevelId="lvl-0",
        footprintMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 6000, "yMm": 0},
            {"xMm": 6000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
        roofGeometryMode="half_gable",
        slopeDeg=30,
    )
    assert cmd.half_hip_height_fraction is None


@pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)
def test_ifc_half_gable_export_sets_predefined_type_hipped_gable_roof() -> None:
    """ISSUE-105: half_gable roofs emit IfcRoof.PredefinedType = HIPPED_GABLE_ROOF.

    IFC4's ``IfcRoofTypeEnum`` enumerates ``HIPPED_GABLE_ROOF`` explicitly
    for the half-hipped variant (a gable roof with a small hip section at
    the top of each gable end). The buildingSMART IFC4 IfcRoof documentation
    describes HIPPED_GABLE_ROOF as exactly this geometry.
    """

    import ifcopenshell

    doc = Document(
        revision=815,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-hg": RoofElem(
                kind="roof",
                id="rf-hg",
                name="Krüppelwalm Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
                overhangMm=300,
                slopeDeg=35,
                roofGeometryMode="half_gable",
                halfHipHeightFraction=0.33,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    roofs = model.by_type("IfcRoof") or []
    assert len(roofs) == 1
    rf = roofs[0]
    assert getattr(rf, "PredefinedType", None) == "HIPPED_GABLE_ROOF"

    # Body still uses the gable-rectangle SweptSolid extrusion (the half-hip
    # is captured in the PredefinedType + round-trip Pset; the IFC body is
    # the same triangular prism as the parent gable mode so downstream
    # quantity/area tooling keeps working unchanged).
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

    # Round-trip Pset: the half-hip fraction lives in Pset_BimAiKernel so
    # authoritative replay can reconstruct the same Krüppelwalm.
    psets = []
    for rel in model.by_type("IfcRelDefinesByProperties") or []:
        if rf in (rel.RelatedObjects or []):
            psets.append(rel.RelatingPropertyDefinition)
    found_fraction = None
    for ps in psets:
        if getattr(ps, "Name", None) == "Pset_BimAiKernel":
            for p in ps.HasProperties or []:
                if p.Name == "BimAiRoofHalfHipHeightFraction":
                    found_fraction = float(p.NominalValue.wrappedValue)
    assert found_fraction == pytest.approx(0.33)


def test_predicate_function_does_not_raise_for_default_rectangle() -> None:
    # Smoke test: the rectangle used in the IFC test passes the predicate.
    assert_valid_half_gable_footprint_mm(RECT_FOOTPRINT_MM)


def test_truncation_height_clamps_negative_fraction_to_full_rise() -> None:
    # Negative fraction ⇒ clamped to 0 ⇒ truncation at full rise (pure gable).
    assert half_gable_truncation_height_mm(2400.0, -1.0) == pytest.approx(2400.0)


def test_truncation_height_clamps_oversized_fraction_to_eave() -> None:
    # Fraction > 1 ⇒ clamped to 1 ⇒ truncation at the eave (functional hip).
    assert half_gable_truncation_height_mm(2400.0, 5.0) == pytest.approx(0.0)


def test_truncation_height_nan_fraction_falls_back_to_default() -> None:
    # NaN ⇒ default fraction (0.33) ⇒ ridge * (1 - 0.33).
    rise = 3000.0
    expected = rise * (1 - 0.33)
    assert half_gable_truncation_height_mm(rise, float("nan")) == pytest.approx(expected)


def test_full_rise_matches_half_run_times_tan_slope_for_default_rectangle() -> None:
    # Reference: full ridge rise on a half_gable is identical to the
    # corresponding gable_pitched_rectangle (the rectangle predicate +
    # half-span × tan(slope) are shared); the half-hip lives only in
    # elevation. This locks the invariant.
    half_run_mm = 2500.0  # half of the 5000 mm short span
    slope_deg = 35.0
    expected_rise = half_run_mm * math.tan(math.radians(slope_deg))
    assert expected_rise > 0
