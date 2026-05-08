"""SKT-01 closeout (wave-04) — sketch sessions for the four remaining sub-modes.

Covers `ceiling`, `in_place_mass`, `void_cut`, and `detail_region`. For each
sub-mode the suite asserts:

- happy path: a session with valid geometry + the right options produces the
  expected engine command, and that command commits cleanly through
  `try_commit` to land the matching element in the document;
- rejection path: invalid geometry (open loop / empty line set) or a missing
  required option raises `SketchInvalidError` from `finish_session`.

The earlier `test_sketch_session.py` and `test_sketch_session_other_kinds.py`
cover floor / roof / room_separation and stay authoritative for those.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    CeilingElem,
    DetailRegionElem,
    LevelElem,
    MassElem,
    PlanViewElem,
    Vec2Mm,
    VoidCutElem,
    WallElem,
)
from bim_ai.engine import try_commit
from bim_ai.sketch_session import SketchLine, SketchSession, finish_session
from bim_ai.sketch_validation import SketchInvalidError


def _line(x0: float, y0: float, x1: float, y1: float) -> SketchLine:
    return SketchLine(from_mm=Vec2Mm(xMm=x0, yMm=y0), to_mm=Vec2Mm(xMm=x1, yMm=y1))


def _rect_lines(w: float = 2000.0, h: float = 1000.0) -> list[SketchLine]:
    """Closed rectangle with 4 segments, CCW."""

    return [
        _line(0, 0, w, 0),
        _line(w, 0, w, h),
        _line(w, h, 0, h),
        _line(0, h, 0, 0),
    ]


def _open_lines() -> list[SketchLine]:
    """Three sides of a rectangle — fails closed-loop validation."""

    return [
        _line(0, 0, 1000, 0),
        _line(1000, 0, 1000, 1000),
        _line(1000, 1000, 0, 1000),
    ]


def _doc_with_level() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
        },
    )


def _doc_with_wall() -> Document:
    """A document with a level and a single wall to host void cuts against."""

    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="wall-1",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=5000, yMm=0),
        thicknessMm=200,
        heightMm=2700,
    )
    return Document(revision=1, elements={"lvl-1": lvl, "wall-1": wall})


def _doc_with_plan_view() -> Document:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    pv = PlanViewElem(
        kind="plan_view",
        id="pv-1",
        name="Level 1",
        levelId="lvl-1",
    )
    return Document(revision=1, elements={"lvl-1": lvl, "pv-1": pv})


# ------------------- ceiling --------------------------------------------------------


def test_ceiling_happy_path_emits_create_ceiling_and_commits() -> None:
    sess = SketchSession(
        sessionId="sk-c",
        modelId="m",
        elementKind="ceiling",
        levelId="lvl-1",
        lines=_rect_lines(),
        status="open",
        options={"heightOffsetMm": 2700, "thicknessMm": 25},
    )
    cmds = finish_session(sess, {"name": "Drop Ceiling"})
    assert len(cmds) == 1
    cmd = cmds[0]
    assert cmd["type"] == "createCeiling"
    assert cmd["levelId"] == "lvl-1"
    assert cmd["name"] == "Drop Ceiling"
    assert len(cmd["boundaryMm"]) == 4
    assert cmd["heightOffsetMm"] == 2700
    assert cmd["thicknessMm"] == 25

    ok, new_doc, _co, _viols, code = try_commit(_doc_with_level(), cmd)
    assert ok, code
    assert new_doc is not None
    ceilings = [el for el in new_doc.elements.values() if isinstance(el, CeilingElem)]
    assert len(ceilings) == 1
    assert ceilings[0].name == "Drop Ceiling"


def test_ceiling_rejects_open_loop() -> None:
    sess = SketchSession(
        sessionId="sk-c-bad",
        modelId="m",
        elementKind="ceiling",
        levelId="lvl-1",
        lines=_open_lines(),
        status="open",
    )
    with pytest.raises(SketchInvalidError) as exc_info:
        finish_session(sess)
    assert exc_info.value.code == "open_loop"


# ------------------- in_place_mass --------------------------------------------------


def test_in_place_mass_happy_path_emits_create_mass_and_commits() -> None:
    sess = SketchSession(
        sessionId="sk-m",
        modelId="m",
        elementKind="in_place_mass",
        levelId="lvl-1",
        lines=_rect_lines(w=4000, h=2000),
        status="open",
        options={"heightMm": 4500, "rotationDeg": 30, "materialKey": "concrete-default"},
    )
    cmds = finish_session(sess, {"name": "South Wing Mass"})
    assert len(cmds) == 1
    cmd = cmds[0]
    assert cmd["type"] == "createMass"
    assert cmd["levelId"] == "lvl-1"
    assert cmd["name"] == "South Wing Mass"
    assert len(cmd["footprintMm"]) == 4
    assert cmd["heightMm"] == 4500
    assert cmd["rotationDeg"] == 30
    assert cmd["materialKey"] == "concrete-default"

    ok, new_doc, _co, _viols, code = try_commit(_doc_with_level(), cmd)
    assert ok, code
    assert new_doc is not None
    masses = [el for el in new_doc.elements.values() if isinstance(el, MassElem)]
    assert len(masses) == 1
    assert masses[0].name == "South Wing Mass"
    assert masses[0].phase_id == "massing"
    assert masses[0].height_mm == 4500


def test_in_place_mass_rejects_open_loop() -> None:
    sess = SketchSession(
        sessionId="sk-m-bad",
        modelId="m",
        elementKind="in_place_mass",
        levelId="lvl-1",
        lines=_open_lines(),
        status="open",
    )
    with pytest.raises(SketchInvalidError) as exc_info:
        finish_session(sess)
    assert exc_info.value.code == "open_loop"


# ------------------- void_cut -------------------------------------------------------


def test_void_cut_happy_path_emits_create_void_cut_and_commits() -> None:
    sess = SketchSession(
        sessionId="sk-v",
        modelId="m",
        elementKind="void_cut",
        levelId="lvl-1",
        lines=_rect_lines(w=600, h=2100),
        status="open",
        options={"hostElementId": "wall-1", "depthMm": 250},
    )
    cmds = finish_session(sess)
    assert len(cmds) == 1
    cmd = cmds[0]
    assert cmd["type"] == "createVoidCut"
    assert cmd["hostElementId"] == "wall-1"
    assert cmd["depthMm"] == 250
    assert len(cmd["profileMm"]) == 4

    ok, new_doc, _co, _viols, code = try_commit(_doc_with_wall(), cmd)
    assert ok, code
    assert new_doc is not None
    voids = [el for el in new_doc.elements.values() if isinstance(el, VoidCutElem)]
    assert len(voids) == 1
    assert voids[0].host_element_id == "wall-1"
    assert voids[0].depth_mm == 250
    # Engine also emits an agent_deviation marker keyed against the host.
    devs = [el for el in new_doc.elements.values() if el.kind == "agent_deviation"]
    assert any("wall-1" in d.related_element_ids for d in devs)


def test_void_cut_missing_host_id_raises() -> None:
    """Rejection path: void_cut requires `hostElementId` in options."""

    sess = SketchSession(
        sessionId="sk-v-bad",
        modelId="m",
        elementKind="void_cut",
        levelId="lvl-1",
        lines=_rect_lines(),
        status="open",
        # No hostElementId — emitter must reject.
    )
    with pytest.raises(SketchInvalidError) as exc_info:
        finish_session(sess, {"depthMm": 100})
    assert exc_info.value.code == "missing_host"


# ------------------- detail_region --------------------------------------------------


def test_detail_region_happy_path_emits_create_detail_region_and_commits() -> None:
    sess = SketchSession(
        sessionId="sk-dr",
        modelId="m",
        elementKind="detail_region",
        levelId="lvl-1",
        lines=[
            _line(0, 0, 1000, 0),
            _line(1000, 0, 1000, 1000),
            _line(1000, 1000, 0, 1000),
            _line(0, 1000, 0, 0),
        ],
        status="open",
        options={"hostViewId": "pv-1"},
    )
    cmds = finish_session(sess, {"fillColour": "#ffeeaa"})
    assert len(cmds) == 1
    cmd = cmds[0]
    assert cmd["type"] == "createDetailRegion"
    assert cmd["hostViewId"] == "pv-1"
    assert cmd["fillColour"] == "#ffeeaa"
    assert len(cmd["boundaryMm"]) >= 3

    ok, new_doc, _co, _viols, code = try_commit(_doc_with_plan_view(), cmd)
    assert ok, code
    assert new_doc is not None
    regions = [el for el in new_doc.elements.values() if isinstance(el, DetailRegionElem)]
    assert len(regions) == 1
    assert regions[0].host_view_id == "pv-1"
    assert regions[0].fill_colour == "#ffeeaa"


def test_detail_region_rejects_empty_sketch() -> None:
    sess = SketchSession(
        sessionId="sk-dr-empty",
        modelId="m",
        elementKind="detail_region",
        levelId="lvl-1",
        lines=[],
        status="open",
        options={"hostViewId": "pv-1"},
    )
    with pytest.raises(SketchInvalidError) as exc_info:
        finish_session(sess)
    assert exc_info.value.code == "empty_sketch"
