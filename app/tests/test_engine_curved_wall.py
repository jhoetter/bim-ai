from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import try_commit


def test_create_wall_preserves_native_arc_curve_metadata() -> None:
    level = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    ok, new_doc, _cmd, violations, code = try_commit(
        Document(revision=1, elements={"lvl-1": level}),
        {
            "type": "createWall",
            "id": "w-arc",
            "name": "Curved wall",
            "levelId": "lvl-1",
            "start": {"xMm": 500, "yMm": 0},
            "end": {"xMm": 1000, "yMm": 500},
            "wallCurve": {
                "kind": "arc",
                "center": {"xMm": 500, "yMm": 500},
                "radiusMm": 500,
                "startAngleDeg": -90,
                "endAngleDeg": 0,
                "sweepDeg": 90,
            },
            "thicknessMm": 200,
            "heightMm": 2800,
        },
    )

    assert ok is True, (code, violations)
    wall = new_doc.elements["w-arc"]
    dumped = wall.model_dump(by_alias=True)
    assert dumped["wallCurve"] == {
        "kind": "arc",
        "center": {"xMm": 500.0, "yMm": 500.0},
        "radiusMm": 500.0,
        "startAngleDeg": -90.0,
        "endAngleDeg": 0.0,
        "sweepDeg": 90.0,
    }


def test_create_wall_preserves_native_bezier_curve_metadata() -> None:
    level = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    ok, new_doc, _cmd, violations, code = try_commit(
        Document(revision=1, elements={"lvl-1": level}),
        {
            "type": "createWall",
            "id": "w-bezier",
            "name": "Curved curtain wall",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 6000, "yMm": 0},
            "wallCurve": {
                "kind": "bezier",
                "controlPoints": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 2500},
                    {"xMm": 4000, "yMm": 2500},
                    {"xMm": 6000, "yMm": 0},
                ],
            },
            "isCurtainWall": True,
            "curtainWallVCount": 4,
            "curtainWallHCount": 2,
            "thicknessMm": 200,
            "heightMm": 2800,
        },
    )

    assert ok is True, (code, violations)
    wall = new_doc.elements["w-bezier"]
    dumped = wall.model_dump(by_alias=True)
    assert dumped["wallCurve"] == {
        "kind": "bezier",
        "controlPoints": [
            {"xMm": 0.0, "yMm": 0.0},
            {"xMm": 2000.0, "yMm": 2500.0},
            {"xMm": 4000.0, "yMm": 2500.0},
            {"xMm": 6000.0, "yMm": 0.0},
        ],
    }
