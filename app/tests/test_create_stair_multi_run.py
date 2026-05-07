"""KRN-07: multi-run stairs — engine accepts new shape; legacy single-run preserved."""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateLevelCmd, CreateStairCmd
from bim_ai.document import Document
from bim_ai.elements import StairElem, StairLanding, StairRun
from bim_ai.engine import apply_inplace


def _doc_with_levels() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl-0", name="L0", elevationMm=0))
    apply_inplace(doc, CreateLevelCmd(id="lvl-1", name="L1", elevationMm=2800))
    return doc


def test_legacy_single_run_stair_still_works() -> None:
    """A CreateStairCmd with no shape/runs should default to shape='straight'."""

    doc = _doc_with_levels()
    apply_inplace(
        doc,
        CreateStairCmd(
            id="s-legacy",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 4000, "yMm": 0},
        ),
    )
    s = doc.elements["s-legacy"]
    assert isinstance(s, StairElem)
    assert s.shape == "straight"
    assert len(s.runs) == 1
    assert s.runs[0].start_mm.x_mm == 0
    assert s.runs[0].end_mm.x_mm == 4000
    assert s.landings == []


def test_l_shape_stair_two_runs_with_explicit_landing() -> None:
    """KRN-07 acceptance: an L-shape stair with two perpendicular runs joined at a landing."""

    doc = _doc_with_levels()
    apply_inplace(
        doc,
        CreateStairCmd(
            id="s-L",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            shape="l_shape",
            runs=[
                StairRun(
                    id="r1",
                    startMm={"xMm": 0, "yMm": 0},
                    endMm={"xMm": 2200, "yMm": 0},
                    widthMm=1000,
                    riserCount=8,
                ),
                StairRun(
                    id="r2",
                    startMm={"xMm": 2700, "yMm": 500},
                    endMm={"xMm": 2700, "yMm": 2700},
                    widthMm=1000,
                    riserCount=8,
                ),
            ],
            landings=[
                StairLanding(
                    id="L1",
                    boundaryMm=[
                        {"xMm": 2200, "yMm": 0},
                        {"xMm": 3200, "yMm": 0},
                        {"xMm": 3200, "yMm": 1000},
                        {"xMm": 2200, "yMm": 1000},
                    ],
                ),
            ],
        ),
    )
    s = doc.elements["s-L"]
    assert isinstance(s, StairElem)
    assert s.shape == "l_shape"
    assert len(s.runs) == 2
    assert sum(r.riser_count for r in s.runs) == 16
    assert len(s.landings) == 1
    assert len(s.landings[0].boundary_mm) == 4


def test_l_shape_stair_auto_derives_landing_when_omitted() -> None:
    """When the caller omits landings[], the engine should derive one per run-gap."""

    doc = _doc_with_levels()
    apply_inplace(
        doc,
        CreateStairCmd(
            id="s-L-auto",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            shape="l_shape",
            runs=[
                StairRun(
                    id="r1",
                    startMm={"xMm": 0, "yMm": 0},
                    endMm={"xMm": 2200, "yMm": 0},
                    widthMm=1000,
                    riserCount=8,
                ),
                StairRun(
                    id="r2",
                    startMm={"xMm": 2700, "yMm": 500},
                    endMm={"xMm": 2700, "yMm": 2700},
                    widthMm=1000,
                    riserCount=8,
                ),
            ],
        ),
    )
    s = doc.elements["s-L-auto"]
    assert isinstance(s, StairElem)
    assert len(s.landings) == 1
    bounds = s.landings[0].boundary_mm
    assert len(bounds) == 4
    # Centered on midpoint of run-1 end and run-2 start: ((2200+2700)/2, (0+500)/2) = (2450, 250)
    cx = sum(p.x_mm for p in bounds) / 4
    cy = sum(p.y_mm for p in bounds) / 4
    assert cx == pytest.approx(2450.0, abs=1.0)
    assert cy == pytest.approx(250.0, abs=1.0)


def test_u_shape_stair_two_runs_opposite_directions() -> None:
    """KRN-07: U-shape stair with two parallel runs going opposite directions."""

    doc = _doc_with_levels()
    apply_inplace(
        doc,
        CreateStairCmd(
            id="s-U",
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            shape="u_shape",
            runs=[
                StairRun(
                    id="r1",
                    startMm={"xMm": 0, "yMm": 0},
                    endMm={"xMm": 2200, "yMm": 0},
                    widthMm=1000,
                    riserCount=8,
                ),
                StairRun(
                    id="r2",
                    startMm={"xMm": 2200, "yMm": 1500},
                    endMm={"xMm": 0, "yMm": 1500},
                    widthMm=1000,
                    riserCount=8,
                ),
            ],
        ),
    )
    s = doc.elements["s-U"]
    assert isinstance(s, StairElem)
    assert s.shape == "u_shape"
    assert len(s.runs) == 2
    # Auto-landing centered on midpoint of run-1 end (2200,0) and run-2 start (2200,1500)
    assert len(s.landings) == 1


def test_create_stair_rejects_missing_levels() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl-0", name="L0", elevationMm=0))
    with pytest.raises(ValueError, match="must reference existing Level"):
        apply_inplace(
            doc,
            CreateStairCmd(
                base_level_id="lvl-0",
                top_level_id="missing-level",
                run_start_mm={"xMm": 0, "yMm": 0},
                run_end_mm={"xMm": 4000, "yMm": 0},
            ),
        )
