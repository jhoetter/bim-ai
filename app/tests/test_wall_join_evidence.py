"""Wall corner join manifest evidence (prompt-3 geometry slice)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, WallElem
from bim_ai.wall_join_evidence import collect_wall_corner_join_evidence_v0


def test_collect_corner_join_for_axis_aligned_l_shape() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wh": WallElem(
                kind="wall",
                id="wh",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "wv": WallElem(
                kind="wall",
                id="wv",
                name="V",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 0, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    ev = collect_wall_corner_join_evidence_v0(doc)
    assert ev is not None
    assert ev["format"] == "wallCornerJoinEvidence_v0"
    assert ev["joins"] == [
        {
            "wallIds": ["wh", "wv"],
            "vertexMm": {"xMm": 0.0, "yMm": 0.0},
            "levelId": "lvl",
            "joinKind": "corner",
        }
    ]


def test_disallowed_endpoint_is_not_corner_join_evidence() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wh": WallElem(
                kind="wall",
                id="wh",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                joinDisallowStart=True,
            ),
            "wv": WallElem(
                kind="wall",
                id="wv",
                name="V",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 0, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    assert collect_wall_corner_join_evidence_v0(doc) is None


def test_collinear_walls_sharing_endpoint_are_not_corner_joins() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="A",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w2": WallElem(
                kind="wall",
                id="w2",
                name="B",
                levelId="lvl",
                start={"xMm": 4000, "yMm": 0},
                end={"xMm": 8000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    assert collect_wall_corner_join_evidence_v0(doc) is None


def test_skew_wall_excluded_from_corner_join_evidence() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w_axis": WallElem(
                kind="wall",
                id="w_axis",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w_skew": WallElem(
                kind="wall",
                id="w_skew",
                name="S",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 4000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    assert collect_wall_corner_join_evidence_v0(doc) is None


def test_perpendicular_walls_without_shared_vertex_yield_no_join() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w2": WallElem(
                kind="wall",
                id="w2",
                name="V",
                levelId="lvl",
                start={"xMm": 1000, "yMm": 0},
                end={"xMm": 1000, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    assert collect_wall_corner_join_evidence_v0(doc) is None
