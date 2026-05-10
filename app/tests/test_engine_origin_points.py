"""KRN-06: project base point + survey point + internal origin engine tests."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    INTERNAL_ORIGIN_ID,
    InternalOriginElem,
    ProjectBasePointElem,
    SurveyPointElem,
)
from bim_ai.engine import ensure_internal_origin, try_commit


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


def test_ensure_internal_origin_adds_singleton_when_missing():
    doc = _empty_doc()
    ensure_internal_origin(doc)
    el = doc.elements[INTERNAL_ORIGIN_ID]
    assert isinstance(el, InternalOriginElem)
    assert el.id == INTERNAL_ORIGIN_ID


def test_ensure_internal_origin_is_idempotent():
    doc = _empty_doc()
    ensure_internal_origin(doc)
    ensure_internal_origin(doc)
    ensure_internal_origin(doc)
    origins = [e for e in doc.elements.values() if isinstance(e, InternalOriginElem)]
    assert len(origins) == 1


def test_create_project_base_point_succeeds_and_sets_fields():
    ok, new_doc, _c, _v, code = try_commit(
        _empty_doc(),
        {
            "type": "createProjectBasePoint",
            "id": "pbp1",
            "positionMm": {"xMm": 1000, "yMm": 2000, "zMm": 0},
            "angleToTrueNorthDeg": 30.0,
            "clipped": True,
        },
    )
    assert ok, code
    pbp = new_doc.elements["pbp1"]
    assert isinstance(pbp, ProjectBasePointElem)
    assert pbp.position_mm.x_mm == 1000
    assert pbp.position_mm.y_mm == 2000
    assert pbp.angle_to_true_north_deg == 30.0
    assert pbp.clipped is True
    # Singleton helper internal_origin auto-backfilled.
    assert isinstance(new_doc.elements[INTERNAL_ORIGIN_ID], InternalOriginElem)


def test_create_project_base_point_singleton_enforced():
    ok1, doc1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createProjectBasePoint",
            "id": "pbp1",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "angleToTrueNorthDeg": 0,
        },
    )
    assert ok1

    with pytest.raises(ValueError, match="already exists"):
        try_commit(
            doc1,
            {
                "type": "createProjectBasePoint",
                "id": "pbp2",
                "positionMm": {"xMm": 1000, "yMm": 0, "zMm": 0},
                "angleToTrueNorthDeg": 0,
            },
        )


def test_move_project_base_point_translates_existing():
    _ok, doc1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createProjectBasePoint",
            "id": "pbp1",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "angleToTrueNorthDeg": 0,
        },
    )

    ok, doc2, _c, _v, _code = try_commit(
        doc1,
        {
            "type": "moveProjectBasePoint",
            "positionMm": {"xMm": 5000, "yMm": 6000, "zMm": 0},
        },
    )
    assert ok
    pbp = doc2.elements["pbp1"]
    assert isinstance(pbp, ProjectBasePointElem)
    assert pbp.position_mm.x_mm == 5000
    assert pbp.position_mm.y_mm == 6000


def test_move_project_base_point_without_existing_rejected():
    with pytest.raises(ValueError, match="no project_base_point"):
        try_commit(
            _empty_doc(),
            {
                "type": "moveProjectBasePoint",
                "positionMm": {"xMm": 5000, "yMm": 6000, "zMm": 0},
            },
        )


def test_rotate_project_base_point_updates_angle():
    _ok, doc1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createProjectBasePoint",
            "id": "pbp1",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "angleToTrueNorthDeg": 0,
        },
    )
    ok, doc2, _c, _v, _code = try_commit(
        doc1,
        {"type": "rotateProjectBasePoint", "angleToTrueNorthDeg": 45.0},
    )
    assert ok
    pbp = doc2.elements["pbp1"]
    assert isinstance(pbp, ProjectBasePointElem)
    assert pbp.angle_to_true_north_deg == 45.0


def test_create_survey_point_singleton_enforced():
    ok1, doc1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createSurveyPoint",
            "id": "sp1",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "sharedElevationMm": 100.0,
            "clipped": True,
        },
    )
    assert ok1
    sp = doc1.elements["sp1"]
    assert isinstance(sp, SurveyPointElem)
    assert sp.shared_elevation_mm == 100.0
    assert sp.clipped is True

    with pytest.raises(ValueError, match="already exists"):
        try_commit(
            doc1,
            {
                "type": "createSurveyPoint",
                "id": "sp2",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            },
        )


def test_move_survey_point_optionally_updates_shared_elevation():
    _ok, doc1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createSurveyPoint",
            "id": "sp1",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "sharedElevationMm": 100.0,
        },
    )

    # Position-only move keeps existing shared_elevation_mm.
    ok, doc2, _c, _v, _code = try_commit(
        doc1,
        {
            "type": "moveSurveyPoint",
            "positionMm": {"xMm": 1000, "yMm": 1000, "zMm": 0},
        },
    )
    assert ok
    sp = doc2.elements["sp1"]
    assert isinstance(sp, SurveyPointElem)
    assert sp.position_mm.x_mm == 1000
    assert sp.shared_elevation_mm == 100.0  # preserved

    # Explicit override updates the value.
    ok2, doc3, _c, _v, _code = try_commit(
        doc2,
        {
            "type": "moveSurveyPoint",
            "positionMm": {"xMm": 1000, "yMm": 1000, "zMm": 0},
            "sharedElevationMm": 250.0,
        },
    )
    assert ok2
    sp2 = doc3.elements["sp1"]
    assert isinstance(sp2, SurveyPointElem)
    assert sp2.shared_elevation_mm == 250.0


def test_update_coordinate_point_position_and_clipped_state():
    _ok, doc1, _c, _v, _code = try_commit(
        _empty_doc(),
        {
            "type": "createProjectBasePoint",
            "id": "pbp1",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "angleToTrueNorthDeg": 0,
        },
    )

    ok, doc2, _c, _v, code = try_commit(
        doc1,
        {
            "type": "updateElementProperty",
            "elementId": "pbp1",
            "key": "positionMm",
            "value": {"xMm": 1200, "yMm": -300, "zMm": 10},
        },
    )
    assert ok, code
    pbp = doc2.elements["pbp1"]
    assert isinstance(pbp, ProjectBasePointElem)
    assert pbp.position_mm.x_mm == 1200
    assert pbp.position_mm.y_mm == -300
    assert pbp.position_mm.z_mm == 10

    ok2, doc3, _c, _v, code2 = try_commit(
        doc2,
        {
            "type": "updateElementProperty",
            "elementId": "pbp1",
            "key": "clipped",
            "value": True,
        },
    )
    assert ok2, code2
    pbp2 = doc3.elements["pbp1"]
    assert isinstance(pbp2, ProjectBasePointElem)
    assert pbp2.clipped is True


def test_try_commit_backfills_internal_origin_for_legacy_doc():
    """A document that pre-dates KRN-06 acquires the singleton on its next commit."""
    legacy = _empty_doc()
    assert INTERNAL_ORIGIN_ID not in legacy.elements

    ok, new_doc, _c, _v, _code = try_commit(
        legacy,
        {
            "type": "createLevel",
            "id": "lvl-1",
            "name": "Ground",
            "elevationMm": 0,
        },
    )
    assert ok
    assert isinstance(new_doc.elements[INTERNAL_ORIGIN_ID], InternalOriginElem)
