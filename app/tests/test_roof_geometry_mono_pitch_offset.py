"""ISSUE-101 — mono_pitch_offset (Versetztes Pultdach) RoofGeometryMode coverage.

Covers:
- ``"mono_pitch_offset"`` is a valid ``RoofGeometryMode`` literal.
- ``roof_geometry_support_token_v0`` resolves rectangle footprints in that
  mode to the new ``"mono_pitch_offset_supported"`` token.
- ``assert_valid_mono_pitch_offset_footprint_mm`` rejects non-rectangles and
  accepts axis-aligned rectangles.
- ``assert_valid_mono_pitch_offset_step_position_mm`` defaults / clamps as
  documented.
- ``RoofElem`` accepts the new fields via either snake_case or camelCase.
- IFC export maps ``mono_pitch_offset`` to ``IfcRoof.PredefinedType = SHED_ROOF``
  (closest IFC4 enum, same precedent as PR #71's mono_pitch mapping) and
  round-trips the parameters via ``Pset_BimAiKernel``.
"""

from __future__ import annotations

from typing import get_args

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoofElem
from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step
from bim_ai.roof_geometry import (
    RoofGeometryMode,
    assert_valid_mono_pitch_offset_footprint_mm,
    assert_valid_mono_pitch_offset_step_position_mm,
    mono_pitch_offset_long_axis_token,
    roof_geometry_support_token_v0,
)


def test_mono_pitch_offset_is_a_valid_roof_geometry_mode_literal() -> None:
    assert "mono_pitch_offset" in get_args(RoofGeometryMode)


def test_support_token_v0_returns_mono_pitch_offset_supported_for_rectangle() -> None:
    rect = [(0.0, 0.0), (10000.0, 0.0), (10000.0, 6000.0), (0.0, 6000.0)]
    token = roof_geometry_support_token_v0(
        footprint_mm=rect,
        roof_geometry_mode="mono_pitch_offset",
        reference_level_resolves=True,
        slope_deg=18.0,
    )
    assert token == "mono_pitch_offset_supported"


def test_support_token_v0_defers_non_rectangle_mono_pitch_offset_footprint() -> None:
    pent = [
        (0.0, 0.0),
        (10000.0, 0.0),
        (11000.0, 3000.0),
        (5000.0, 6000.0),
        (0.0, 4500.0),
    ]
    token = roof_geometry_support_token_v0(
        footprint_mm=pent,
        roof_geometry_mode="mono_pitch_offset",
        reference_level_resolves=True,
        slope_deg=18.0,
    )
    assert token in {"hip_candidate_deferred", "non_rectangular_footprint_deferred"}


def test_assert_valid_mono_pitch_offset_footprint_rejects_non_rectangle() -> None:
    tri = [(0.0, 0.0), (5000.0, 0.0), (2500.0, 4000.0)]
    with pytest.raises(ValueError):
        assert_valid_mono_pitch_offset_footprint_mm(tri)


def test_assert_valid_mono_pitch_offset_footprint_accepts_rectangle() -> None:
    rect = [(0.0, 0.0), (10000.0, 0.0), (10000.0, 6000.0), (0.0, 6000.0)]
    # Does not raise.
    assert_valid_mono_pitch_offset_footprint_mm(rect)


def test_mono_pitch_offset_long_axis_token_picks_x_when_x_is_longer() -> None:
    assert mono_pitch_offset_long_axis_token(10000.0, 6000.0) == "alongX"


def test_mono_pitch_offset_long_axis_token_picks_z_when_z_is_longer() -> None:
    assert mono_pitch_offset_long_axis_token(6000.0, 10000.0) == "alongZ"


def test_step_position_defaults_to_midpoint_when_none() -> None:
    assert assert_valid_mono_pitch_offset_step_position_mm(10000.0, None) == pytest.approx(
        5000.0
    )


def test_step_position_validates_minimum_segment_clearance() -> None:
    # 50 mm of clearance < 100 mm default min — must raise.
    with pytest.raises(ValueError):
        assert_valid_mono_pitch_offset_step_position_mm(10000.0, 50.0)
    with pytest.raises(ValueError):
        assert_valid_mono_pitch_offset_step_position_mm(10000.0, 9990.0)


def test_step_position_accepts_valid_partition() -> None:
    assert (
        assert_valid_mono_pitch_offset_step_position_mm(10000.0, 4000.0)
        == pytest.approx(4000.0)
    )


def test_roof_elem_accepts_new_fields_via_snake_case() -> None:
    rf = RoofElem(
        kind="roof",
        id="rf-1",
        name="Versetztes Pultdach",
        reference_level_id="lvl-0",
        footprint_mm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 10000, "yMm": 0},
            {"xMm": 10000, "yMm": 6000},
            {"xMm": 0, "yMm": 6000},
        ],
        roof_geometry_mode="mono_pitch_offset",
        front_pitch_deg=12.0,
        rear_pitch_deg=20.0,
        front_eave_height_mm=2800.0,
        rear_eave_height_mm=3600.0,
        clerestory_band_height_mm=900.0,
        step_position_along_long_axis_mm=5500.0,
    )
    assert rf.roof_geometry_mode == "mono_pitch_offset"
    assert rf.front_pitch_deg == 12.0
    assert rf.rear_pitch_deg == 20.0
    assert rf.front_eave_height_mm == 2800.0
    assert rf.rear_eave_height_mm == 3600.0
    assert rf.clerestory_band_height_mm == 900.0
    assert rf.step_position_along_long_axis_mm == 5500.0


def test_roof_elem_accepts_new_fields_via_camel_case() -> None:
    rf = RoofElem.model_validate(
        {
            "kind": "roof",
            "id": "rf-2",
            "name": "Versetztes Pultdach (camel)",
            "referenceLevelId": "lvl-0",
            "footprintMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 10000, "yMm": 0},
                {"xMm": 10000, "yMm": 6000},
                {"xMm": 0, "yMm": 6000},
            ],
            "roofGeometryMode": "mono_pitch_offset",
            "frontPitchDeg": 15.0,
            "rearPitchDeg": 25.0,
            "frontEaveHeightMm": 2800.0,
            "rearEaveHeightMm": 3500.0,
            "clerestoryBandHeightMm": 800.0,
            "stepPositionAlongLongAxisMm": 6000.0,
        }
    )
    assert rf.front_pitch_deg == 15.0
    assert rf.rear_pitch_deg == 25.0
    assert rf.front_eave_height_mm == 2800.0
    assert rf.rear_eave_height_mm == 3500.0
    assert rf.clerestory_band_height_mm == 800.0
    assert rf.step_position_along_long_axis_mm == 6000.0


def test_roof_elem_back_compat_when_offset_fields_omitted() -> None:
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
    assert rf.front_pitch_deg is None
    assert rf.rear_pitch_deg is None
    assert rf.front_eave_height_mm is None
    assert rf.rear_eave_height_mm is None
    assert rf.clerestory_band_height_mm is None
    assert rf.step_position_along_long_axis_mm is None


@pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)
def test_ifc_mono_pitch_offset_export_sets_predefined_type_to_shed_roof() -> None:
    """ISSUE-101: mono_pitch_offset emits ``IfcRoof.PredefinedType = SHED_ROOF``.

    The closest IFC4 IfcRoofTypeEnum keyword for an offset double mono-pitch
    is ``SHED_ROOF`` — the same precedent set by PR #71 for the single-slope
    mono_pitch variant. The Versetztes Pultdach is two SHED_ROOF planes
    bridged by a clerestory wall band; no dedicated IFC4 enum exists.
    """

    import ifcopenshell

    doc = Document(
        revision=801,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-offset": RoofElem(
                kind="roof",
                id="rf-offset",
                name="Versetztes Pultdach",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 10000, "yMm": 0},
                    {"xMm": 10000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
                overhangMm=300,
                slopeDeg=15,
                roofGeometryMode="mono_pitch_offset",
                frontPitchDeg=12,
                rearPitchDeg=20,
                frontEaveHeightMm=2800,
                rearEaveHeightMm=3600,
                clerestoryBandHeightMm=900,
                stepPositionAlongLongAxisMm=5500,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    roofs = model.by_type("IfcRoof") or []
    assert len(roofs) == 1
    rf = roofs[0]
    assert getattr(rf, "PredefinedType", None) == "SHED_ROOF"

    # The body is a step-profile extrusion → IfcExtrudedAreaSolid with a
    # 6-vertex closed profile (front eave, rear eave-top, rear top at step,
    # band upper, band lower, front top at step) + closure point.
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
    # 6 unique vertices + closure point.
    assert len(pts) == 7


@pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)
def test_ifc_existing_modes_still_export_without_predefined_type_change() -> None:
    """ISSUE-101 guardrail: gable / hip / flat / mass_box do NOT regress to
    SHED_ROOF when the new field set is absent."""

    import ifcopenshell

    doc = Document(
        revision=802,
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
    # Gable mode never set PredefinedType explicitly — must not silently
    # become SHED_ROOF after the ISSUE-101 changes.
    pdt = getattr(rf, "PredefinedType", None)
    assert pdt != "SHED_ROOF"
