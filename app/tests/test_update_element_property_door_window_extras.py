"""KRN-12 / KRN-13 — door operationType + window outlineKind setters via updateElementProperty.

The renderer (TS web) and Python validation already understand operation_type,
sliding_track_side, outline_kind and attached_roof_id on DoorElem/WindowElem,
but no command path could set them until this branch landed. The seed-rebuild
authors a sliding loggia door + a trapezoidal window through these keys.
"""

from __future__ import annotations

import pytest

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    LevelElem,
    RoofElem,
    Vec2Mm,
    WallElem,
    WindowElem,
)
from bim_ai.engine import apply_inplace


def _base_doc() -> Document:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
        "w1": WallElem(
            kind="wall",
            id="w1",
            name="W",
            level_id="lv",
            start=Vec2Mm(x_mm=0, y_mm=0),
            end=Vec2Mm(x_mm=4000, y_mm=0),
            thickness_mm=200,
            height_mm=2800,
        ),
        "d1": DoorElem(
            kind="door",
            id="d1",
            name="D1",
            wall_id="w1",
            along_t=0.5,
            width_mm=1800,
        ),
        "z1": WindowElem(
            kind="window",
            id="z1",
            name="Z1",
            wall_id="w1",
            along_t=0.2,
            width_mm=1200,
            sill_height_mm=900,
            height_mm=1500,
        ),
        "rf1": RoofElem(
            kind="roof",
            id="rf1",
            name="R",
            reference_level_id="lv",
            footprint_mm=[
                Vec2Mm(x_mm=0, y_mm=0),
                Vec2Mm(x_mm=4000, y_mm=0),
                Vec2Mm(x_mm=4000, y_mm=4000),
                Vec2Mm(x_mm=0, y_mm=4000),
            ],
        ),
    }
    return Document(revision=1, elements=els)  # type: ignore[arg-type]


def test_door_operation_type_setter() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="d1", key="operationType", value="sliding_double"),
    )
    d = doc.elements["d1"]
    assert isinstance(d, DoorElem)
    assert d.operation_type == "sliding_double"


def test_door_operation_type_clear_with_empty_value() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="d1", key="operationType", value="sliding_single"),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="d1", key="operationType", value=""),
    )
    d = doc.elements["d1"]
    assert isinstance(d, DoorElem)
    assert d.operation_type is None


def test_door_operation_type_invalid_rejected() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="operationType"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="d1", key="operationType", value="garage"),
        )


def test_door_sliding_track_side_setter() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="d1", key="slidingTrackSide", value="in_pocket"),
    )
    d = doc.elements["d1"]
    assert isinstance(d, DoorElem)
    assert d.sliding_track_side == "in_pocket"


def test_door_sliding_track_side_invalid_rejected() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="slidingTrackSide"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="d1", key="slidingTrackSide", value="ceiling"),
        )


def test_window_outline_kind_setter() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="z1", key="outlineKind", value="gable_trapezoid"),
    )
    z = doc.elements["z1"]
    assert isinstance(z, WindowElem)
    assert z.outline_kind == "gable_trapezoid"


def test_window_outline_kind_invalid_rejected() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="outlineKind"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="z1", key="outlineKind", value="hexagon"),
        )


def test_window_attached_roof_id_setter() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="z1", key="attachedRoofId", value="rf1"),
    )
    z = doc.elements["z1"]
    assert isinstance(z, WindowElem)
    assert z.attached_roof_id == "rf1"


def test_window_attached_roof_id_unknown_target_rejected() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="attachedRoofId"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="z1", key="attachedRoofId", value="not-a-roof"),
        )


def test_window_attached_roof_id_must_reference_roof_kind() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="attachedRoofId"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="z1", key="attachedRoofId", value="w1"),
        )


def test_door_window_unknown_key_error_lists_new_keys() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="operationType"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="d1", key="bogus", value="x"),
        )
    with pytest.raises(ValueError, match="outlineKind"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="z1", key="bogus", value="x"),
        )


def test_door_only_keys_rejected_on_window() -> None:
    """operationType / slidingTrackSide are door-only — error lists supported window keys."""
    doc = _base_doc()
    with pytest.raises(ValueError):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="z1", key="operationType", value="swing_single"),
        )


def test_window_only_keys_rejected_on_door() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="d1", key="outlineKind", value="rectangle"),
        )
