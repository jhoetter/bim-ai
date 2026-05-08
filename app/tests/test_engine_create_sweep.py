"""KRN-15: tests for the createSweep command + SweepElem validation."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, SweepElem
from bim_ai.engine import try_commit


def _doc_with_level() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevation_mm=0),
        },
    )


def test_create_sweep_minimal_succeeds():
    ok, new_doc, _cmd, _viols, code = try_commit(
        _doc_with_level(),
        {
            "type": "createSweep",
            "id": "sw-frame",
            "name": "Picture frame",
            "levelId": "lvl-1",
            "pathMm": [
                {"xMm": 0, "yMm": 0, "zMm": 3000},
                {"xMm": 5000, "yMm": 0, "zMm": 3000},
                {"xMm": 5000, "yMm": 0, "zMm": 4500},
                {"xMm": 0, "yMm": 0, "zMm": 4500},
                {"xMm": 0, "yMm": 0, "zMm": 3000},
            ],
            "profileMm": [
                {"uMm": -100, "vMm": -50},
                {"uMm": 100, "vMm": -50},
                {"uMm": 100, "vMm": 50},
                {"uMm": -100, "vMm": 50},
            ],
            "profilePlane": "work_plane",
            "materialKey": "white_render",
        },
    )
    assert ok, f"expected success, got {code}"
    assert new_doc is not None
    el = new_doc.elements["sw-frame"]
    assert isinstance(el, SweepElem)
    assert el.material_key == "white_render"
    assert len(el.path_mm) == 5
    assert len(el.profile_mm) == 4


def test_create_sweep_unknown_level_rejected():
    with pytest.raises(ValueError, match="level"):
        try_commit(
            _doc_with_level(),
            {
                "type": "createSweep",
                "id": "sw1",
                "levelId": "no-such-level",
                "pathMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
                "profileMm": [
                    {"uMm": -50, "vMm": -50},
                    {"uMm": 50, "vMm": -50},
                    {"uMm": 0, "vMm": 50},
                ],
                "profilePlane": "work_plane",
            },
        )


def test_create_sweep_short_path_rejected():
    with pytest.raises(Exception, match="."):
        try_commit(
            _doc_with_level(),
            {
                "type": "createSweep",
                "id": "sw1",
                "levelId": "lvl-1",
                "pathMm": [{"xMm": 0, "yMm": 0}],
                "profileMm": [
                    {"uMm": -50, "vMm": -50},
                    {"uMm": 50, "vMm": -50},
                    {"uMm": 0, "vMm": 50},
                ],
                "profilePlane": "work_plane",
            },
        )


def test_create_sweep_short_profile_rejected():
    with pytest.raises(Exception, match="."):
        try_commit(
            _doc_with_level(),
            {
                "type": "createSweep",
                "id": "sw1",
                "levelId": "lvl-1",
                "pathMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
                "profileMm": [
                    {"uMm": 0, "vMm": 0},
                    {"uMm": 100, "vMm": 0},
                ],
                "profilePlane": "work_plane",
            },
        )


def test_create_sweep_unknown_material_rejected():
    with pytest.raises(Exception, match="."):
        try_commit(
            _doc_with_level(),
            {
                "type": "createSweep",
                "id": "sw1",
                "levelId": "lvl-1",
                "pathMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
                "profileMm": [
                    {"uMm": -50, "vMm": -50},
                    {"uMm": 50, "vMm": -50},
                    {"uMm": 0, "vMm": 50},
                ],
                "profilePlane": "work_plane",
                "materialKey": "no_such_material_xyz",
            },
        )


def test_create_sweep_invalid_profile_plane_rejected():
    with pytest.raises(Exception, match="."):
        try_commit(
            _doc_with_level(),
            {
                "type": "createSweep",
                "id": "sw1",
                "levelId": "lvl-1",
                "pathMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
                "profileMm": [
                    {"uMm": -50, "vMm": -50},
                    {"uMm": 50, "vMm": -50},
                    {"uMm": 0, "vMm": 50},
                ],
                "profilePlane": "weird_plane",
            },
        )
