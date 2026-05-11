"""KRN-01: property line engine tests."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import PropertyLineElem
from bim_ai.engine import try_commit


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


def test_create_property_line_succeeds_and_sets_fields() -> None:
    ok, new_doc, _c, _v, code = try_commit(
        _empty_doc(),
        {
            "type": "createPropertyLine",
            "id": "pl1",
            "name": "Street boundary",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 25_000, "yMm": 0},
            "setbackMm": 4500,
            "classification": "street",
        },
    )
    assert ok, code
    pl = new_doc.elements["pl1"]
    assert isinstance(pl, PropertyLineElem)
    assert pl.name == "Street boundary"
    assert pl.start_mm.x_mm == 0
    assert pl.end_mm.x_mm == 25_000
    assert pl.setback_mm == 4500
    assert pl.classification == "street"


def test_create_property_line_without_optional_fields() -> None:
    ok, new_doc, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createPropertyLine",
            "id": "pl1",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 10000, "yMm": 0},
        },
    )
    assert ok
    pl = new_doc.elements["pl1"]
    assert isinstance(pl, PropertyLineElem)
    assert pl.setback_mm is None
    assert pl.classification is None


def test_create_property_line_from_bearing_table_closes_polygon() -> None:
    ok, new_doc, _c, _v, code = try_commit(
        _empty_doc(),
        {
            "type": "createPropertyLine",
            "id": "pl-bearing",
            "name": "Survey lot",
            "authoringMode": "bearing_table",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 0, "yMm": 0},
            "bearingTable": {
                "rows": [
                    {"bearing": "90°", "distanceMm": 25000},
                    {"bearing": "S 00°00'00\" E", "distanceMm": 40000},
                    {"bearing": "270°", "distanceMm": 25000},
                    {"bearing": "N 0° W", "distanceMm": 40000},
                ]
            },
        },
    )
    assert ok, code
    pl = new_doc.elements["pl-bearing"]
    assert isinstance(pl, PropertyLineElem)
    assert pl.authoring_mode == "bearing_table"
    assert len(pl.boundary_mm) == 5
    assert pl.boundary_mm[1].x_mm == pytest.approx(25000)
    assert pl.boundary_mm[2].y_mm == pytest.approx(-40000)
    assert pl.closure_error_mm == pytest.approx(0, abs=0.001)


def test_update_property_line_bearing_table_rewalks_from_start() -> None:
    _ok, d1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createPropertyLine",
            "id": "pl1",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 10000, "yMm": 0},
        },
    )
    ok, d2, _c, _v, code = try_commit(
        d1,
        {
            "type": "updatePropertyLine",
            "propertyLineId": "pl1",
            "authoringMode": "bearing_table",
            "startMm": {"xMm": 1000, "yMm": 2000},
            "bearingTable": {
                "rows": [
                    {"bearing": "N 90 E", "distanceMm": 10000},
                    {"bearing": "S 0 E", "distanceMm": 10000},
                    {"bearing": "S 90 W", "distanceMm": 10000},
                    {"bearing": "N 0 E", "distanceMm": 10000},
                ]
            },
        },
    )
    assert ok, code
    pl = d2.elements["pl1"]
    assert isinstance(pl, PropertyLineElem)
    assert pl.boundary_mm[0].x_mm == 1000
    assert pl.boundary_mm[0].y_mm == 2000
    assert pl.boundary_mm[-1].x_mm == pytest.approx(1000)
    assert pl.boundary_mm[-1].y_mm == pytest.approx(2000)


def test_create_property_line_rejects_zero_length() -> None:
    with pytest.raises(ValueError, match="must differ"):
        try_commit(
            _empty_doc(),
            {
                "type": "createPropertyLine",
                "id": "pl1",
                "startMm": {"xMm": 1000, "yMm": 1000},
                "endMm": {"xMm": 1000, "yMm": 1000},
            },
        )


def test_update_property_line_changes_setback_and_classification() -> None:
    _ok, d1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createPropertyLine",
            "id": "pl1",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 10000, "yMm": 0},
            "setbackMm": 3000,
            "classification": "rear",
        },
    )
    ok2, d2, _c, _v, _code = try_commit(
        d1,
        {
            "type": "updatePropertyLine",
            "propertyLineId": "pl1",
            "setbackMm": 5000,
            "classification": "side",
        },
    )
    assert ok2
    pl = d2.elements["pl1"]
    assert isinstance(pl, PropertyLineElem)
    assert pl.setback_mm == 5000
    assert pl.classification == "side"


def test_delete_property_line_removes_element() -> None:
    _ok, d1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createPropertyLine",
            "id": "pl1",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 1000, "yMm": 0},
        },
    )
    ok2, d2, _c, _v, _code = try_commit(d1, {"type": "deletePropertyLine", "propertyLineId": "pl1"})
    assert ok2
    assert "pl1" not in d2.elements


def test_delete_property_line_unknown_id_fails() -> None:
    with pytest.raises(ValueError, match="must reference a property_line"):
        try_commit(
            _empty_doc(),
            {"type": "deletePropertyLine", "propertyLineId": "missing"},
        )
