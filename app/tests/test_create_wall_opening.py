"""KRN-04: createWallOpening / updateWallOpening engine tests."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, WallElem, WallOpeningElem
from bim_ai.engine import try_commit


def _doc_with_wall() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="EG", elevationMm=0),
            "w-1": WallElem(
                kind="wall",
                id="w-1",
                name="Wall",
                levelId="lvl-0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )


def test_create_wall_opening_succeeds_for_valid_inputs():
    doc = _doc_with_wall()
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createWallOpening",
            "id": "wo-1",
            "name": "Pass-through",
            "hostWallId": "w-1",
            "alongTStart": 0.1,
            "alongTEnd": 0.4,
            "sillHeightMm": 200,
            "headHeightMm": 2400,
        },
    )
    assert ok
    el = doc_a.elements.get("wo-1")
    assert isinstance(el, WallOpeningElem)
    assert el.kind == "wall_opening"
    assert el.host_wall_id == "w-1"
    assert el.along_t_start == 0.1
    assert el.along_t_end == 0.4
    assert el.sill_height_mm == 200
    assert el.head_height_mm == 2400


def test_create_wall_opening_rejects_missing_host_wall():
    doc = _doc_with_wall()
    with pytest.raises(ValueError, match="hostWallId"):
        try_commit(
            doc,
            {
                "type": "createWallOpening",
                "id": "wo-1",
                "hostWallId": "does-not-exist",
                "alongTStart": 0.1,
                "alongTEnd": 0.4,
                "sillHeightMm": 200,
                "headHeightMm": 2400,
            },
        )


def test_create_wall_opening_rejects_inverted_along_t():
    doc = _doc_with_wall()
    with pytest.raises(ValueError, match="alongT"):
        try_commit(
            doc,
            {
                "type": "createWallOpening",
                "id": "wo-1",
                "hostWallId": "w-1",
                "alongTStart": 0.6,
                "alongTEnd": 0.3,
                "sillHeightMm": 200,
                "headHeightMm": 2400,
            },
        )


def test_create_wall_opening_rejects_head_below_sill():
    doc = _doc_with_wall()
    with pytest.raises(ValueError, match="headHeight"):
        try_commit(
            doc,
            {
                "type": "createWallOpening",
                "id": "wo-1",
                "hostWallId": "w-1",
                "alongTStart": 0.2,
                "alongTEnd": 0.5,
                "sillHeightMm": 1500,
                "headHeightMm": 1500,
            },
        )


def test_create_wall_opening_rejects_head_above_wall_height():
    doc = _doc_with_wall()
    with pytest.raises(ValueError, match="wall height|headHeight"):
        try_commit(
            doc,
            {
                "type": "createWallOpening",
                "id": "wo-1",
                "hostWallId": "w-1",
                "alongTStart": 0.2,
                "alongTEnd": 0.5,
                "sillHeightMm": 200,
                "headHeightMm": 5000,
            },
        )


def test_update_wall_opening_partial_update_preserves_others():
    doc = _doc_with_wall()
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createWallOpening",
            "id": "wo-1",
            "hostWallId": "w-1",
            "alongTStart": 0.2,
            "alongTEnd": 0.5,
            "sillHeightMm": 200,
            "headHeightMm": 2400,
        },
    )
    assert ok

    ok2, doc_b, *_ = try_commit(
        doc_a,
        {
            "type": "updateWallOpening",
            "openingId": "wo-1",
            "sillHeightMm": 400,
        },
    )
    assert ok2
    el = doc_b.elements["wo-1"]
    assert isinstance(el, WallOpeningElem)
    assert el.sill_height_mm == 400
    assert el.head_height_mm == 2400  # unchanged
    assert el.along_t_start == 0.2  # unchanged
    assert el.along_t_end == 0.5  # unchanged


def test_update_wall_opening_rejects_invalid_combined_state():
    doc = _doc_with_wall()
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createWallOpening",
            "id": "wo-1",
            "hostWallId": "w-1",
            "alongTStart": 0.2,
            "alongTEnd": 0.5,
            "sillHeightMm": 200,
            "headHeightMm": 2400,
        },
    )
    assert ok

    # Lifting sill above the existing head should fail.
    with pytest.raises(ValueError, match="headHeight"):
        try_commit(
            doc_a,
            {
                "type": "updateWallOpening",
                "openingId": "wo-1",
                "sillHeightMm": 2500,
            },
        )


def test_wall_opening_does_not_appear_in_door_or_window_schedules():
    """Wall openings have no family — they must not appear in door/window schedules.

    The schedule derivation iterates DoorElem / WindowElem instances; a
    WallOpeningElem is a different model and won't match either filter.
    """
    doc = _doc_with_wall()
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createWallOpening",
            "id": "wo-1",
            "hostWallId": "w-1",
            "alongTStart": 0.2,
            "alongTEnd": 0.5,
            "sillHeightMm": 200,
            "headHeightMm": 2400,
        },
    )
    assert ok
    door_count = sum(1 for e in doc_a.elements.values() if e.kind == "door")
    window_count = sum(1 for e in doc_a.elements.values() if e.kind == "window")
    wall_opening_count = sum(1 for e in doc_a.elements.values() if e.kind == "wall_opening")
    assert door_count == 0
    assert window_count == 0
    assert wall_opening_count == 1


def test_wall_opening_pydantic_validator_catches_invalid_construction():
    """Direct WallOpeningElem construction should also reject invalid data."""
    with pytest.raises(ValueError):
        WallOpeningElem(
            id="wo",
            hostWallId="w-1",
            alongTStart=0.5,
            alongTEnd=0.3,  # invalid
            sillHeightMm=200,
            headHeightMm=2400,
        )
    with pytest.raises(ValueError):
        WallOpeningElem(
            id="wo",
            hostWallId="w-1",
            alongTStart=0.1,
            alongTEnd=0.5,
            sillHeightMm=2400,
            headHeightMm=2400,  # head must be > sill
        )
