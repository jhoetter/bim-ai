"""VIE-V3-01 — detail-level rendering tests.

Verifies that planDoorMesh / planWindowMesh / planStairMesh /
planFamilyInstanceMesh route geometry by coarse / medium / fine and that
the phase_render_style attribute is set for demolished elements.
"""

from __future__ import annotations

import pytest

from bim_ai.elements import ColumnElem, DoorElem, StairElem, Vec2Mm, WindowElem
from bim_ai.engine import (
    planDoorMesh,
    planFamilyInstanceMesh,
    planStairMesh,
    planWindowMesh,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _door(phase_demolished: str | None = None) -> DoorElem:
    d = DoorElem(id="d-1", wallId="w-1", alongT=0.5, widthMm=900.0)
    if phase_demolished:
        d = d.model_copy(update={"phase_demolished": phase_demolished})
    return d


def _window(phase_demolished: str | None = None) -> WindowElem:
    w = WindowElem(
        id="win-1", wallId="w-1", alongT=0.5, widthMm=1200.0, sillHeightMm=900.0, heightMm=1500.0
    )
    if phase_demolished:
        w = w.model_copy(update={"phase_demolished": phase_demolished})
    return w


def _stair(phase_demolished: str | None = None) -> StairElem:
    s = StairElem(
        id="st-1",
        baseLevelId="lvl-1",
        topLevelId="lvl-2",
        runStartMm=Vec2Mm(xMm=0.0, yMm=0.0),
        runEndMm=Vec2Mm(xMm=3000.0, yMm=0.0),
        widthMm=1200.0,
        riserMm=175.0,
        treadMm=275.0,
    )
    if phase_demolished:
        s = s.model_copy(update={"phase_demolished": phase_demolished})
    return s


def _column(phase_demolished: str | None = None) -> ColumnElem:
    c = ColumnElem(
        id="col-1",
        levelId="lvl-1",
        positionMm=Vec2Mm(xMm=0.0, yMm=0.0),
        bMm=300.0,
        hMm=300.0,
        heightMm=2800.0,
    )
    if phase_demolished:
        c = c.model_copy(update={"phase_demolished": phase_demolished})
    return c


# ---------------------------------------------------------------------------
# planDoorMesh
# ---------------------------------------------------------------------------


def test_door_coarse_fewer_segments_than_fine():
    door = _door()
    assert len(planDoorMesh(door, "coarse")) < len(planDoorMesh(door, "fine"))


def test_door_medium_no_arc():
    segs = planDoorMesh(_door(), "medium")
    assert all(not s.is_arc for s in segs)


def test_door_fine_has_arc():
    segs = planDoorMesh(_door(), "fine")
    assert any(s.is_arc for s in segs)


# ---------------------------------------------------------------------------
# planWindowMesh
# ---------------------------------------------------------------------------


def test_window_coarse_exactly_one_segment():
    assert len(planWindowMesh(_window(), "coarse")) == 1


def test_window_fine_at_least_three_segments():
    assert len(planWindowMesh(_window(), "fine")) >= 3


def test_window_medium_between_coarse_and_fine():
    c = len(planWindowMesh(_window(), "coarse"))
    m = len(planWindowMesh(_window(), "medium"))
    f = len(planWindowMesh(_window(), "fine"))
    assert c <= m <= f


# ---------------------------------------------------------------------------
# planStairMesh
# ---------------------------------------------------------------------------


def test_stair_coarse_exactly_four_segments():
    assert len(planStairMesh(_stair(), "coarse")) == 4


def test_stair_fine_more_than_four_segments():
    assert len(planStairMesh(_stair(), "fine")) > 4


def test_stair_medium_more_than_coarse():
    c = len(planStairMesh(_stair(), "coarse"))
    m = len(planStairMesh(_stair(), "medium"))
    assert m > c


# ---------------------------------------------------------------------------
# planFamilyInstanceMesh
# ---------------------------------------------------------------------------


def test_family_coarse_exactly_four_segments():
    assert len(planFamilyInstanceMesh(_column(), "coarse")) == 4


def test_family_medium_more_than_coarse():
    c = len(planFamilyInstanceMesh(_column(), "coarse"))
    m = len(planFamilyInstanceMesh(_column(), "medium"))
    assert m > c


def test_family_fine_same_as_medium():
    assert len(planFamilyInstanceMesh(_column(), "medium")) == len(
        planFamilyInstanceMesh(_column(), "fine")
    )


# ---------------------------------------------------------------------------
# Phase filter: demolished elements → bold_dashed_grey on all four kinds
# ---------------------------------------------------------------------------


def test_phase_demolition_coarse_door():
    segs = planDoorMesh(_door(phase_demolished="phase-2"), "coarse")
    assert all(s.phase_render_style == "bold_dashed_grey" for s in segs)


def test_phase_demolition_coarse_window():
    segs = planWindowMesh(_window(phase_demolished="phase-2"), "coarse")
    assert all(s.phase_render_style == "bold_dashed_grey" for s in segs)


def test_phase_demolition_coarse_stair():
    segs = planStairMesh(_stair(phase_demolished="phase-2"), "coarse")
    assert all(s.phase_render_style == "bold_dashed_grey" for s in segs)


def test_phase_demolition_coarse_family():
    segs = planFamilyInstanceMesh(_column(phase_demolished="phase-2"), "coarse")
    assert all(s.phase_render_style == "bold_dashed_grey" for s in segs)


# ---------------------------------------------------------------------------
# All helpers accept all three levels without raising
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("level", ["coarse", "medium", "fine"])
def test_door_all_levels_no_raise(level: str):
    planDoorMesh(_door(), level)


@pytest.mark.parametrize("level", ["coarse", "medium", "fine"])
def test_window_all_levels_no_raise(level: str):
    planWindowMesh(_window(), level)


@pytest.mark.parametrize("level", ["coarse", "medium", "fine"])
def test_stair_all_levels_no_raise(level: str):
    planStairMesh(_stair(), level)


@pytest.mark.parametrize("level", ["coarse", "medium", "fine"])
def test_family_all_levels_no_raise(level: str):
    planFamilyInstanceMesh(_column(), level)


# ---------------------------------------------------------------------------
# Unknown level falls back to fine behaviour without raising
# ---------------------------------------------------------------------------


def test_door_unknown_level_fallback():
    assert len(planDoorMesh(_door(), "ultra_detail")) == len(planDoorMesh(_door(), "fine"))


def test_window_unknown_level_fallback():
    assert len(planWindowMesh(_window(), "hd")) == len(planWindowMesh(_window(), "fine"))


def test_stair_unknown_level_fallback():
    assert len(planStairMesh(_stair(), "ultra")) == len(planStairMesh(_stair(), "fine"))


def test_family_unknown_level_fallback():
    assert len(planFamilyInstanceMesh(_column(), "ultra")) == len(
        planFamilyInstanceMesh(_column(), "medium")
    )
