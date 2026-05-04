"""Room derivation preview heuristic (orthogonal wall loops)."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, WallElem
from bim_ai.room_derivation_preview import room_derivation_preview


def test_finds_rectangle_from_four_axis_walls():
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, **{w.id: w for w in walls}})
    prev = room_derivation_preview(doc)
    assert prev["candidateCount"] >= 1
    cand = prev["axisAlignedRectangleCandidates"][0]
    assert cand["approxAreaM2"] == pytest.approx(16.0, rel=1e-2)
    assert sorted(cand["wallIds"]) == sorted(w.id for w in walls)
