"""KRN-10: masking region engine tests."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, MaskingRegionElem, PlanViewElem
from bim_ai.engine import try_commit


def _doc_with_plan_view() -> Document:
    elements = {
        "lvl_g": LevelElem(kind="level", id="lvl_g", name="Ground", elevation_mm=0),
        "pv1": PlanViewElem(kind="plan_view", id="pv1", name="Ground — Plan", level_id="lvl_g"),
    }
    return Document(revision=1, elements=elements)


def _square_boundary() -> list[dict]:
    return [
        {"xMm": 0, "yMm": 0},
        {"xMm": 1000, "yMm": 0},
        {"xMm": 1000, "yMm": 1000},
        {"xMm": 0, "yMm": 1000},
    ]


def test_create_masking_region_succeeds_and_sets_fields() -> None:
    ok, new_doc, _c, _v, code = try_commit(
        _doc_with_plan_view(),
        {
            "type": "createMaskingRegion",
            "id": "mr1",
            "hostViewId": "pv1",
            "boundaryMm": _square_boundary(),
            "fillColor": "#fafafa",
        },
    )
    assert ok, code
    mr = new_doc.elements["mr1"]
    assert isinstance(mr, MaskingRegionElem)
    assert mr.host_view_id == "pv1"
    assert mr.fill_color == "#fafafa"
    assert len(mr.boundary_mm) == 4


def test_create_masking_region_rejects_unknown_view() -> None:
    with pytest.raises(ValueError, match="hostViewId"):
        try_commit(
            _doc_with_plan_view(),
            {
                "type": "createMaskingRegion",
                "id": "mr1",
                "hostViewId": "missing-view",
                "boundaryMm": _square_boundary(),
            },
        )


def test_create_masking_region_rejects_non_view_host() -> None:
    # A LevelElem is not a view; the engine must refuse to host a masking
    # region on it.
    with pytest.raises(ValueError, match="hostViewId"):
        try_commit(
            _doc_with_plan_view(),
            {
                "type": "createMaskingRegion",
                "id": "mr1",
                "hostViewId": "lvl_g",
                "boundaryMm": _square_boundary(),
            },
        )


def test_create_masking_region_requires_three_vertices() -> None:
    with pytest.raises(ValueError, match="at least 3 points"):
        try_commit(
            _doc_with_plan_view(),
            {
                "type": "createMaskingRegion",
                "id": "mr1",
                "hostViewId": "pv1",
                "boundaryMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
            },
        )


def test_update_masking_region_replaces_boundary_and_fill() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_plan_view(),
        {
            "type": "createMaskingRegion",
            "id": "mr1",
            "hostViewId": "pv1",
            "boundaryMm": _square_boundary(),
        },
    )
    assert ok
    new_boundary = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 2000, "yMm": 0},
        {"xMm": 2000, "yMm": 2000},
        {"xMm": 0, "yMm": 2000},
    ]
    ok2, doc2, *_ = try_commit(
        doc,
        {
            "type": "updateMaskingRegion",
            "maskingRegionId": "mr1",
            "boundaryMm": new_boundary,
            "fillColor": "#000000",
        },
    )
    assert ok2
    mr = doc2.elements["mr1"]
    assert isinstance(mr, MaskingRegionElem)
    assert mr.fill_color == "#000000"
    assert mr.boundary_mm[2].x_mm == 2000


def test_delete_masking_region_removes_element() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_plan_view(),
        {
            "type": "createMaskingRegion",
            "id": "mr1",
            "hostViewId": "pv1",
            "boundaryMm": _square_boundary(),
        },
    )
    assert ok
    ok2, doc2, *_ = try_commit(
        doc,
        {"type": "deleteMaskingRegion", "maskingRegionId": "mr1"},
    )
    assert ok2
    assert "mr1" not in doc2.elements
