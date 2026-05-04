from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, Vec2Mm, WallElem


def test_violations_tagged_discipline_via_evaluate_pipeline() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    lvl_dup = LevelElem(kind="level", id="lvl-dup", name="Dup", elevationMm=0)
    walls = WallElem(
        kind="wall",
        id="w1",
        name="Wall",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=100, yMm=0),
        thicknessMm=200,
        heightMm=2800,
    )
    doc_elems = Document(
        revision=1,
        elements={"lvl-1": lvl, "lvl-dup": lvl_dup, "w1": walls},
    ).elements
    viols = evaluate(dict(doc_elems))
    dup = next(v for v in viols if v.rule_id == "level_duplicate_elevation")
    assert dup.discipline == "structure"


def test_overlap_discipline_from_evaluate() -> None:
    viols = evaluate(
        {
            **Document(
                revision=1,
                elements={
                    "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
                    "w1": WallElem(
                        kind="wall",
                        id="w1",
                        name="A",
                        levelId="lvl",
                        start=Vec2Mm(xMm=0, yMm=0),
                        end=Vec2Mm(xMm=4000, yMm=0),
                        thicknessMm=200,
                        heightMm=2800,
                    ),
                },
            ).elements,
            "w2": WallElem(
                kind="wall",
                id="w2",
                name="B",
                levelId="lvl",
                start=Vec2Mm(xMm=1500, yMm=0),
                end=Vec2Mm(xMm=5500, yMm=0),
                thicknessMm=700,
                heightMm=2800,
            ),
        },
    )
    oval = next(v for v in viols if v.rule_id == "wall_overlap")
    assert oval.discipline == "coordination"


def test_room_overlap_plan_discipline() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    r1 = RoomElem(
        kind="room",
        id="r1",
        name="A",
        levelId="lvl",
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 4000, "yMm": 0},
            {"xMm": 4000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
    )
    r2 = RoomElem(
        kind="room",
        id="r2",
        name="B",
        levelId="lvl",
        outlineMm=[
            {"xMm": 2000, "yMm": 2000},
            {"xMm": 5200, "yMm": 2000},
            {"xMm": 5200, "yMm": 5200},
            {"xMm": 2000, "yMm": 5200},
        ],
    )
    viols = evaluate(dict(Document(revision=1, elements={"lvl": lvl, "r1": r1, "r2": r2}).elements))
    oval = next(v for v in viols if v.rule_id == "room_overlap_plan")
    assert oval.discipline == "architecture"
    assert oval.severity == "error"
