"""KRN-08: area engine tests."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import AreaElem, LevelElem
from bim_ai.engine import try_commit


def _doc_with_level() -> Document:
    elements = {
        "lvl_g": LevelElem(kind="level", id="lvl_g", name="Ground", elevation_mm=0),
    }
    return Document(revision=1, elements=elements)


def _porch_boundary() -> list[dict]:
    # 4m × 5m porch
    return [
        {"xMm": 0, "yMm": 0},
        {"xMm": 4000, "yMm": 0},
        {"xMm": 4000, "yMm": 5000},
        {"xMm": 0, "yMm": 5000},
    ]


def test_create_area_succeeds_and_recomputes_gross() -> None:
    """KRN-08 acceptance: 4m × 5m gross area → 20_000_000 sq mm."""
    ok, doc, _c, _v, code = try_commit(
        _doc_with_level(),
        {
            "type": "createArea",
            "id": "a1",
            "name": "Porch",
            "levelId": "lvl_g",
            "boundaryMm": _porch_boundary(),
            "ruleSet": "gross",
        },
    )
    assert ok, code
    a = doc.elements["a1"]
    assert isinstance(a, AreaElem)
    assert a.name == "Porch"
    assert a.rule_set == "gross"
    assert a.computed_area_sq_mm == pytest.approx(20_000_000.0)


def test_create_area_no_rules_recomputes_polygon_area() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createArea",
            "id": "a1",
            "levelId": "lvl_g",
            "boundaryMm": _porch_boundary(),
            "ruleSet": "no_rules",
        },
    )
    assert ok
    assert doc.elements["a1"].computed_area_sq_mm == pytest.approx(20_000_000.0)


def test_create_area_rejects_unknown_level() -> None:
    with pytest.raises(ValueError, match="must reference an existing Level"):
        try_commit(
            _doc_with_level(),
            {
                "type": "createArea",
                "id": "a1",
                "levelId": "ghost",
                "boundaryMm": _porch_boundary(),
            },
        )


def test_create_area_rejects_too_few_vertices() -> None:
    with pytest.raises(ValueError, match="at least 3 points"):
        try_commit(
            _doc_with_level(),
            {
                "type": "createArea",
                "id": "a1",
                "levelId": "lvl_g",
                "boundaryMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
            },
        )


def test_update_area_replaces_boundary_and_recomputes() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createArea",
            "id": "a1",
            "levelId": "lvl_g",
            "boundaryMm": _porch_boundary(),
            "ruleSet": "gross",
        },
    )
    assert ok
    bigger = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 6000, "yMm": 0},
        {"xMm": 6000, "yMm": 5000},
        {"xMm": 0, "yMm": 5000},
    ]
    ok2, doc2, *_ = try_commit(
        doc,
        {
            "type": "updateArea",
            "areaId": "a1",
            "boundaryMm": bigger,
            "name": "Porch (updated)",
        },
    )
    assert ok2
    a = doc2.elements["a1"]
    assert isinstance(a, AreaElem)
    assert a.name == "Porch (updated)"
    assert a.computed_area_sq_mm == pytest.approx(30_000_000.0)


def test_delete_area_removes_element() -> None:
    ok, doc, *_ = try_commit(
        _doc_with_level(),
        {
            "type": "createArea",
            "id": "a1",
            "levelId": "lvl_g",
            "boundaryMm": _porch_boundary(),
        },
    )
    assert ok
    ok2, doc2, *_ = try_commit(doc, {"type": "deleteArea", "areaId": "a1"})
    assert ok2
    assert "a1" not in doc2.elements
