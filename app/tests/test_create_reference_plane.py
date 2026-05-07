"""KRN-05: project-scope reference plane engine tests."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, ReferencePlaneElem
from bim_ai.engine import try_commit


def _doc_with_two_levels() -> Document:
    elements = {
        "lvl_g": LevelElem(kind="level", id="lvl_g", name="Ground", elevation_mm=0),
        "lvl_1": LevelElem(kind="level", id="lvl_1", name="Level 1", elevation_mm=3000),
    }
    return Document(revision=1, elements=elements)


def test_create_reference_plane_succeeds_and_sets_fields() -> None:
    ok, new_doc, _c, _v, code = try_commit(
        _doc_with_two_levels(),
        {
            "type": "createReferencePlane",
            "id": "rp1",
            "name": "Symmetry",
            "levelId": "lvl_g",
            "startMm": {"xMm": 0, "yMm": 1000},
            "endMm": {"xMm": 5000, "yMm": 1000},
        },
    )
    assert ok, code
    rp = new_doc.elements["rp1"]
    assert isinstance(rp, ReferencePlaneElem)
    assert rp.name == "Symmetry"
    assert rp.level_id == "lvl_g"
    assert rp.start_mm.x_mm == 0
    assert rp.end_mm.x_mm == 5000
    assert rp.is_work_plane is False


def test_create_reference_plane_rejects_unknown_level() -> None:
    with pytest.raises(ValueError, match="must reference an existing Level"):
        try_commit(
            _doc_with_two_levels(),
            {
                "type": "createReferencePlane",
                "id": "rp1",
                "levelId": "nope",
                "startMm": {"xMm": 0, "yMm": 0},
                "endMm": {"xMm": 1000, "yMm": 0},
            },
        )


def test_create_reference_plane_rejects_zero_length() -> None:
    with pytest.raises(ValueError, match="must differ"):
        try_commit(
            _doc_with_two_levels(),
            {
                "type": "createReferencePlane",
                "id": "rp1",
                "levelId": "lvl_g",
                "startMm": {"xMm": 1000, "yMm": 1000},
                "endMm": {"xMm": 1000, "yMm": 1000},
            },
        )


def test_work_plane_uniqueness_per_level_on_create() -> None:
    """Setting isWorkPlane=true on a new ref plane clears the flag on others on
    the same level."""
    _ok, d1, _c, _v, _code = try_commit(
        _doc_with_two_levels(),
        {
            "type": "createReferencePlane",
            "id": "rp1",
            "levelId": "lvl_g",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 1000, "yMm": 0},
            "isWorkPlane": True,
        },
    )
    rp1 = d1.elements["rp1"]
    assert isinstance(rp1, ReferencePlaneElem)
    assert rp1.is_work_plane is True

    # New ref plane on the SAME level with isWorkPlane=true clears rp1.
    _ok2, d2, _c, _v, _code = try_commit(
        d1,
        {
            "type": "createReferencePlane",
            "id": "rp2",
            "levelId": "lvl_g",
            "startMm": {"xMm": 0, "yMm": 1000},
            "endMm": {"xMm": 1000, "yMm": 1000},
            "isWorkPlane": True,
        },
    )
    rp1b = d2.elements["rp1"]
    rp2b = d2.elements["rp2"]
    assert isinstance(rp1b, ReferencePlaneElem)
    assert isinstance(rp2b, ReferencePlaneElem)
    assert rp1b.is_work_plane is False
    assert rp2b.is_work_plane is True


def test_work_plane_uniqueness_does_not_affect_other_levels() -> None:
    _ok, d1, _c, _v, _code = try_commit(
        _doc_with_two_levels(),
        {
            "type": "createReferencePlane",
            "id": "rp1",
            "levelId": "lvl_g",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 1000, "yMm": 0},
            "isWorkPlane": True,
        },
    )
    _ok2, d2, _c, _v, _code = try_commit(
        d1,
        {
            "type": "createReferencePlane",
            "id": "rp2",
            "levelId": "lvl_1",
            "startMm": {"xMm": 0, "yMm": 1000},
            "endMm": {"xMm": 1000, "yMm": 1000},
            "isWorkPlane": True,
        },
    )
    rp1 = d2.elements["rp1"]
    rp2 = d2.elements["rp2"]
    assert isinstance(rp1, ReferencePlaneElem)
    assert isinstance(rp2, ReferencePlaneElem)
    assert rp1.is_work_plane is True  # untouched: different level
    assert rp2.is_work_plane is True


def test_update_reference_plane_clears_other_work_plane_on_same_level() -> None:
    _ok, d1, _c, _v, _code = try_commit(
        _doc_with_two_levels(),
        {
            "type": "createReferencePlane",
            "id": "rp1",
            "levelId": "lvl_g",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 1000, "yMm": 0},
            "isWorkPlane": True,
        },
    )
    _ok2, d2, _c, _v, _code = try_commit(
        d1,
        {
            "type": "createReferencePlane",
            "id": "rp2",
            "levelId": "lvl_g",
            "startMm": {"xMm": 0, "yMm": 2000},
            "endMm": {"xMm": 1000, "yMm": 2000},
        },
    )
    # Flip rp2 to work plane via update.
    ok3, d3, _c, _v, _code = try_commit(
        d2,
        {
            "type": "updateReferencePlane",
            "referencePlaneId": "rp2",
            "isWorkPlane": True,
        },
    )
    assert ok3
    rp1 = d3.elements["rp1"]
    rp2 = d3.elements["rp2"]
    assert isinstance(rp1, ReferencePlaneElem)
    assert isinstance(rp2, ReferencePlaneElem)
    assert rp1.is_work_plane is False
    assert rp2.is_work_plane is True


def test_delete_reference_plane_removes_element() -> None:
    _ok, d1, _c, _v, _code = try_commit(
        _doc_with_two_levels(),
        {
            "type": "createReferencePlane",
            "id": "rp1",
            "levelId": "lvl_g",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 1000, "yMm": 0},
        },
    )
    ok2, d2, _c, _v, _code = try_commit(
        d1,
        {"type": "deleteReferencePlane", "referencePlaneId": "rp1"},
    )
    assert ok2
    assert "rp1" not in d2.elements


def test_delete_reference_plane_unknown_id_fails() -> None:
    with pytest.raises(ValueError, match="must reference a reference_plane"):
        try_commit(
            _doc_with_two_levels(),
            {"type": "deleteReferencePlane", "referencePlaneId": "missing"},
        )
