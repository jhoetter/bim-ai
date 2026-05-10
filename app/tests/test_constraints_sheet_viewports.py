from __future__ import annotations

from bim_ai.constraints import _sheet_viewport_zero_extent_labels, _viewport_dimension_mm
from bim_ai.constraints_sheet_viewports import (
    SHEET_VIEWPORT_MIN_SIDE_MM,
    repair_sheet_viewport_extents_inplace_rows,
    sheet_viewport_zero_extent_labels,
    viewport_dimension_mm,
)


def test_viewport_dimension_parses_numbers_strings_and_aliases() -> None:
    assert viewport_dimension_mm({"widthMm": 120}, "widthMm", "width_mm") == 120.0
    assert viewport_dimension_mm({"width_mm": " 42.5 "}, "widthMm", "width_mm") == 42.5
    assert viewport_dimension_mm({"widthMm": True}, "widthMm", "width_mm") is None
    assert viewport_dimension_mm({"widthMm": "bad"}, "widthMm", "width_mm") is None
    assert _viewport_dimension_mm({"widthMm": "10"}, "widthMm", "width_mm") == 10.0


def test_repair_sheet_viewport_extents_clones_and_clamps_invalid_rows() -> None:
    original = [
        {"viewportId": "a", "widthMm": 0, "heightMm": "75"},
        {"viewportId": "b", "width_mm": 20, "height_mm": -1},
        "not-a-viewport",
    ]

    repaired, changed = repair_sheet_viewport_extents_inplace_rows(original)

    assert changed is True
    assert repaired[0] == {
        "viewportId": "a",
        "widthMm": SHEET_VIEWPORT_MIN_SIDE_MM,
        "heightMm": "75",
    }
    assert repaired[1] == {
        "viewportId": "b",
        "width_mm": 20,
        "height_mm": -1,
        "heightMm": SHEET_VIEWPORT_MIN_SIDE_MM,
    }
    assert repaired[2] == "not-a-viewport"
    assert original[0]["widthMm"] == 0


def test_sheet_viewport_zero_extent_labels_are_sorted_with_legacy_alias() -> None:
    rows = [
        {"viewportId": "z", "widthMm": 0, "heightMm": 10},
        {"viewport_id": "a", "widthMm": 10, "heightMm": None},
        {"widthMm": False, "heightMm": 10},
        {"viewportId": "ok", "widthMm": 10, "heightMm": 10},
    ]

    assert sheet_viewport_zero_extent_labels(rows) == ["a", "idx=2", "z"]
    assert _sheet_viewport_zero_extent_labels(rows) == ["a", "idx=2", "z"]
