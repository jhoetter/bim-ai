"""KRN-V3-06: plan region Create / Update / Delete engine tests."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanRegionElem
from bim_ai.engine import try_commit


def _doc_with_level() -> Document:
    elements = {
        "lvl_g": LevelElem(kind="level", id="lvl_g", name="Ground", elevation_mm=0),
    }
    return Document(revision=1, elements=elements)


def _square_outline() -> list[dict]:
    return [
        {"xMm": 0, "yMm": 0},
        {"xMm": 3000, "yMm": 0},
        {"xMm": 3000, "yMm": 4000},
        {"xMm": 0, "yMm": 4000},
    ]


# ── CreatePlanRegion ──────────────────────────────────────────────────────────


def test_create_plan_region_succeeds_and_sets_fields() -> None:
    ok, new_doc, _c, _v, code = try_commit(
        _doc_with_level(),
        {
            "type": "createPlanRegion",
            "id": "pr1",
            "levelId": "lvl_g",
            "outlineMm": _square_outline(),
            "cutPlaneOffsetMm": 900,
        },
    )
    assert ok, code
    pr = new_doc.elements["pr1"]
    assert isinstance(pr, PlanRegionElem)
    assert pr.level_id == "lvl_g"
    assert pr.cut_plane_offset_mm == pytest.approx(900.0)
    assert len(pr.outline_mm) == 4


def test_create_plan_region_rejects_unknown_level() -> None:
    with pytest.raises(ValueError, match="levelId"):
        try_commit(
            _doc_with_level(),
            {
                "type": "createPlanRegion",
                "id": "pr1",
                "levelId": "ghost",
                "outlineMm": _square_outline(),
            },
        )


def test_create_plan_region_rejects_too_few_vertices() -> None:
    with pytest.raises(ValueError, match="≥3 vertices"):
        try_commit(
            _doc_with_level(),
            {
                "type": "createPlanRegion",
                "id": "pr1",
                "levelId": "lvl_g",
                "outlineMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
            },
        )


def test_create_plan_region_default_cut_plane() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createPlanRegion",
            "id": "pr1",
            "levelId": "lvl_g",
            "outlineMm": _square_outline(),
        },
    )
    assert ok
    pr = doc.elements["pr1"]
    assert isinstance(pr, PlanRegionElem)
    assert pr.cut_plane_offset_mm == pytest.approx(-500.0)


# ── UpdatePlanRegion ──────────────────────────────────────────────────────────


def test_update_plan_region_cut_plane() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createPlanRegion",
            "id": "pr1",
            "levelId": "lvl_g",
            "outlineMm": _square_outline(),
            "cutPlaneOffsetMm": 1200,
        },
    )
    assert ok
    ok2, doc2, *_ = try_commit(
        doc,
        {"type": "updatePlanRegion", "id": "pr1", "cutPlaneOffsetMm": 900},
    )
    assert ok2
    pr = doc2.elements["pr1"]
    assert isinstance(pr, PlanRegionElem)
    assert pr.cut_plane_offset_mm == pytest.approx(900.0)


def test_update_plan_region_outline() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createPlanRegion",
            "id": "pr1",
            "levelId": "lvl_g",
            "outlineMm": _square_outline(),
        },
    )
    assert ok
    bigger = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 6000, "yMm": 0},
        {"xMm": 6000, "yMm": 8000},
        {"xMm": 0, "yMm": 8000},
    ]
    ok2, doc2, *_ = try_commit(
        doc,
        {"type": "updatePlanRegion", "id": "pr1", "outlineMm": bigger},
    )
    assert ok2
    pr = doc2.elements["pr1"]
    assert isinstance(pr, PlanRegionElem)
    assert pr.outline_mm[1].x_mm == pytest.approx(6000.0)


def test_update_plan_region_name() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createPlanRegion",
            "id": "pr1",
            "levelId": "lvl_g",
            "outlineMm": _square_outline(),
        },
    )
    assert ok
    ok2, doc2, *_ = try_commit(
        doc,
        {"type": "updatePlanRegion", "id": "pr1", "name": "Attic region"},
    )
    assert ok2
    pr = doc2.elements["pr1"]
    assert pr.name == "Attic region"


def test_update_plan_region_rejects_unknown_id() -> None:
    with pytest.raises(ValueError, match="plan_region"):
        try_commit(
            _doc_with_level(),
            {"type": "updatePlanRegion", "id": "ghost", "cutPlaneOffsetMm": 900},
        )


def test_update_plan_region_rejects_too_few_vertices() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createPlanRegion",
            "id": "pr1",
            "levelId": "lvl_g",
            "outlineMm": _square_outline(),
        },
    )
    assert ok
    with pytest.raises(ValueError, match="≥3 vertices"):
        try_commit(
            doc,
            {
                "type": "updatePlanRegion",
                "id": "pr1",
                "outlineMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
            },
        )


# ── DeletePlanRegion ──────────────────────────────────────────────────────────


def test_delete_plan_region_removes_element() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createPlanRegion",
            "id": "pr1",
            "levelId": "lvl_g",
            "outlineMm": _square_outline(),
        },
    )
    assert ok
    ok2, doc2, *_ = try_commit(doc, {"type": "deletePlanRegion", "id": "pr1"})
    assert ok2
    assert "pr1" not in doc2.elements


def test_delete_plan_region_rejects_unknown_id() -> None:
    with pytest.raises(ValueError, match="plan_region"):
        try_commit(_doc_with_level(), {"type": "deletePlanRegion", "id": "ghost"})
