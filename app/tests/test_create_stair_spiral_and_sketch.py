"""KRN-07 closeout: spiral + sketch shape variants for CreateStair."""

from __future__ import annotations

import math

import pytest

from bim_ai.commands import CreateLevelCmd, CreateStairCmd
from bim_ai.document import Document
from bim_ai.elements import StairElem
from bim_ai.engine import apply_inplace, try_commit
from bim_ai.sketch_session import SketchLine, SketchSession, finish_session
from bim_ai.sketch_validation import SketchInvalidError


def _doc_with_levels() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl-0", name="L0", elevationMm=0))
    apply_inplace(doc, CreateLevelCmd(id="lvl-1", name="L1", elevationMm=2800))
    return doc


def test_spiral_stair_derives_n_treads() -> None:
    """Spiral stair: 12 risers around a 270° rotation should produce a single curved-run
    record with a 13-vertex polyline (riserCount + 1 sample points)."""

    doc = _doc_with_levels()
    apply_inplace(
        doc,
        CreateStairCmd(
            id="s-spiral",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            shape="spiral",
            centerMm={"xMm": 0, "yMm": 0},
            innerRadiusMm=200,
            outerRadiusMm=1200,
            totalRotationDeg=270,
            riserCount=12,
        ),
    )
    s = doc.elements["s-spiral"]
    assert isinstance(s, StairElem)
    assert s.shape == "spiral"
    assert len(s.runs) == 1
    assert s.runs[0].polyline_mm is not None
    assert len(s.runs[0].polyline_mm) == 13
    midR = (200 + 1200) / 2
    first = s.runs[0].polyline_mm[0]
    assert first.x_mm == pytest.approx(midR, abs=1e-6)
    assert first.y_mm == pytest.approx(0, abs=1e-6)
    last = s.runs[0].polyline_mm[-1]
    expected_x = midR * math.cos(math.radians(270))
    expected_y = midR * math.sin(math.radians(270))
    assert last.x_mm == pytest.approx(expected_x, abs=1e-6)
    assert last.y_mm == pytest.approx(expected_y, abs=1e-6)


def test_spiral_validates_required_fields() -> None:
    """Missing centerMm on a spiral stair must raise."""

    with pytest.raises(ValueError, match="centerMm"):
        CreateStairCmd(
            id="s-bad-spiral",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            shape="spiral",
            innerRadiusMm=200,
            outerRadiusMm=1200,
            totalRotationDeg=270,
            riserCount=12,
        )


def test_spiral_outer_must_exceed_inner() -> None:
    """outerRadiusMm must strictly exceed innerRadiusMm."""

    with pytest.raises(ValueError, match="outerRadiusMm"):
        CreateStairCmd(
            id="s-bad-radii",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            shape="spiral",
            centerMm={"xMm": 0, "yMm": 0},
            innerRadiusMm=600,
            outerRadiusMm=400,
            totalRotationDeg=270,
            riserCount=12,
        )


def test_sketch_stair_uses_polyline_path() -> None:
    """Sketch stair: derived run carries the input path verbatim as polyline_mm."""

    doc = _doc_with_levels()
    path = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 1500, "yMm": 0},
        {"xMm": 2500, "yMm": 1000},
        {"xMm": 3500, "yMm": 1000},
    ]
    apply_inplace(
        doc,
        CreateStairCmd(
            id="s-sketch",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 3500, "yMm": 1000},
            shape="sketch",
            sketchPathMm=path,
        ),
    )
    s = doc.elements["s-sketch"]
    assert isinstance(s, StairElem)
    assert s.shape == "sketch"
    assert len(s.runs) == 1
    pl = s.runs[0].polyline_mm
    assert pl is not None
    assert [(p.x_mm, p.y_mm) for p in pl] == [(0, 0), (1500, 0), (2500, 1000), (3500, 1000)]
    assert s.sketch_path_mm is not None
    assert len(s.sketch_path_mm) == 4


def test_sketch_stair_validates_min_two_points() -> None:
    """A sketch stair with <2 path points must raise."""

    with pytest.raises(ValueError, match="sketchPathMm"):
        CreateStairCmd(
            id="s-bad-sketch",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            shape="sketch",
            sketchPathMm=[{"xMm": 0, "yMm": 0}],
        )


def test_sketch_path_can_be_emitted_from_sketch_session_finish() -> None:
    """Round-trip: SKT-01 sketch session with elementKind='stair' → finish_session
    emits a CreateStair with shape='sketch' and the sketch lines as the polyline."""

    session = SketchSession(
        sessionId="sess-1",
        modelId="m1",
        elementKind="stair",
        levelId="lvl-0",
        lines=[
            SketchLine(fromMm={"xMm": 0, "yMm": 0}, toMm={"xMm": 1500, "yMm": 0}),
            SketchLine(fromMm={"xMm": 1500, "yMm": 0}, toMm={"xMm": 1500, "yMm": 1500}),
        ],
    )
    cmds = finish_session(session, options={"topLevelId": "lvl-1"})
    assert len(cmds) == 1
    cmd = cmds[0]
    assert cmd["type"] == "createStair"
    assert cmd["shape"] == "sketch"
    assert cmd["baseLevelId"] == "lvl-0"
    assert cmd["topLevelId"] == "lvl-1"
    assert cmd["sketchPathMm"] == [
        {"xMm": 0, "yMm": 0},
        {"xMm": 1500, "yMm": 0},
        {"xMm": 1500, "yMm": 1500},
    ]

    doc = _doc_with_levels()
    ok, next_doc, _, _, _ = try_commit(doc, cmd)
    assert ok and next_doc is not None
    stair = next(e for e in next_doc.elements.values() if isinstance(e, StairElem))
    assert stair.shape == "sketch"
    assert stair.sketch_path_mm is not None
    assert len(stair.sketch_path_mm) == 3


def test_sketch_stair_session_requires_top_level() -> None:
    """finish_session(elementKind='stair') without topLevelId must raise."""

    session = SketchSession(
        sessionId="sess-2",
        modelId="m1",
        elementKind="stair",
        levelId="lvl-0",
        lines=[
            SketchLine(fromMm={"xMm": 0, "yMm": 0}, toMm={"xMm": 1500, "yMm": 0}),
        ],
    )
    with pytest.raises(SketchInvalidError):
        finish_session(session, options={})
