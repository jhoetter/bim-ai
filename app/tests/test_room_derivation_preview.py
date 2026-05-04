"""Room derivation preview heuristic (orthogonal wall loops)."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, WallElem
from bim_ai.room_derivation_preview import (
    room_derivation_candidates_review,
    room_derivation_preview,
)


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


def test_room_derivation_flags_overlap_with_authored_room_bbox() -> None:
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

    rm = RoomElem(
        kind="room",
        id="rm-live",
        name="Existing",
        levelId="lvl-1",
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 4000, "yMm": 0},
            {"xMm": 4000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
    )

    doc = Document(revision=5, elements={"lvl-1": lvl, "rm-live": rm, **{w.id: w for w in walls}})
    rev = room_derivation_candidates_review(doc)
    c0 = rev["candidates"][0]
    assert c0["perimeterApproxM"] == pytest.approx(16.0, rel=1e-2)
    assert any(w.get("code") == "overlap_authored_room" for w in (c0.get("warnings") or []))
    comps = c0.get("comparisonToAuthoredRooms") or []

    assert comps and comps[0]["roomId"] == "rm-live"


def test_room_derivation_candidates_review_has_stable_ids_and_commands():
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
    rev = room_derivation_candidates_review(doc)
    assert rev["format"] == "roomDerivationCandidates_v1"
    assert rev["candidateCount"] >= 1
    c0 = rev["candidates"][0]
    assert len(str(c0.get("candidateId", ""))) >= 8
    assert c0["suggestedCommand"]["type"] == "createRoomOutline"
    assert isinstance(c0["suggestedBundleCommands"], list) and len(c0["suggestedBundleCommands"]) == 1
    assert c0["perimeterApproxM"] == pytest.approx(16.0, rel=1e-2)
