"""KRN-16: tests for the setWallRecessZones command + recess validation."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit


def _doc_with_wall() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevation_mm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                level_id="lvl-1",
                start=Vec2Mm(xMm=0, yMm=0),
                end=Vec2Mm(xMm=5000, yMm=0),
                thickness_mm=200,
                height_mm=4000,
            ),
        },
    )


def test_set_wall_recess_zones_minimal_succeeds():
    ok, new_doc, _, _, code = try_commit(
        _doc_with_wall(),
        {
            "type": "setWallRecessZones",
            "wallId": "w1",
            "recessZones": [
                {
                    "alongTStart": 0.1,
                    "alongTEnd": 0.9,
                    "setbackMm": 1500,
                    "floorContinues": True,
                }
            ],
        },
    )
    assert ok, f"expected success, got {code}"
    assert new_doc is not None
    wall = new_doc.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.recess_zones is not None
    assert len(wall.recess_zones) == 1
    z = wall.recess_zones[0]
    assert z.along_t_start == 0.1
    assert z.along_t_end == 0.9
    assert z.setback_mm == 1500
    assert z.floor_continues is True


def test_set_wall_recess_zones_overlap_rejected():
    with pytest.raises(ValueError, match="overlap"):
        try_commit(
            _doc_with_wall(),
            {
                "type": "setWallRecessZones",
                "wallId": "w1",
                "recessZones": [
                    {"alongTStart": 0.1, "alongTEnd": 0.5, "setbackMm": 500},
                    {"alongTStart": 0.4, "alongTEnd": 0.9, "setbackMm": 500},
                ],
            },
        )


def test_set_wall_recess_zones_inverted_t_rejected():
    with pytest.raises(Exception):
        try_commit(
            _doc_with_wall(),
            {
                "type": "setWallRecessZones",
                "wallId": "w1",
                "recessZones": [{"alongTStart": 0.7, "alongTEnd": 0.3, "setbackMm": 500}],
            },
        )


def test_set_wall_recess_zones_setback_sanity_bound():
    # thicknessMm = 200 → bound = 1600. 2000 should be rejected.
    with pytest.raises(Exception):
        try_commit(
            _doc_with_wall(),
            {
                "type": "setWallRecessZones",
                "wallId": "w1",
                "recessZones": [
                    {"alongTStart": 0.1, "alongTEnd": 0.9, "setbackMm": 2000}
                ],
            },
        )


def test_set_wall_recess_zones_unknown_wall_rejected():
    with pytest.raises(ValueError, match="wall"):
        try_commit(
            _doc_with_wall(),
            {
                "type": "setWallRecessZones",
                "wallId": "no-such-wall",
                "recessZones": [
                    {"alongTStart": 0.1, "alongTEnd": 0.9, "setbackMm": 500}
                ],
            },
        )


def test_set_wall_recess_zones_clears_when_empty():
    doc = _doc_with_wall()
    # First set a zone.
    ok1, doc1, _, _, _ = try_commit(
        doc,
        {
            "type": "setWallRecessZones",
            "wallId": "w1",
            "recessZones": [{"alongTStart": 0.1, "alongTEnd": 0.9, "setbackMm": 500}],
        },
    )
    assert ok1 and doc1 is not None
    # Then clear.
    ok2, doc2, _, _, _ = try_commit(
        doc1,
        {"type": "setWallRecessZones", "wallId": "w1", "recessZones": []},
    )
    assert ok2 and doc2 is not None
    wall = doc2.elements["w1"]
    assert isinstance(wall, WallElem)
    assert wall.recess_zones is None
