from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, ValidationRuleElem, WallElem, WindowElem


def test_ids_cleanroom_hint_warns_without_family():
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="Wall",
        levelId="lvl-1",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 5000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )

    doc = Document(
        revision=1,
        elements={
            "lvl-1": lvl,
            "w1": wall,
            "d1": DoorElem(kind="door", id="d1", name="D", wall_id="w1", along_t=0.45, width_mm=920),
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-1",
                name="cleanroom_fixture",
                ruleJson={"enforceCleanroomDoorFamilyTypes": True},
            ),
        },
    )

    vs = evaluate(doc.elements)
    assert any(v.rule_id == "ids_cleanroom_door_without_family_type" for v in vs)


def test_ids_cleanroom_window_warns_without_family_type():
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="Wall",
        levelId="lvl-1",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 5000, "yMm": 0},
        thicknessMm=200,
        heightMm=2800,
    )
    win = WindowElem(
        kind="window",
        id="win-1",
        name="Z",
        wallId="w1",
        alongT=0.5,
        widthMm=1200,
        sillHeightMm=900,
        heightMm=1400,
        familyTypeId="",
    )

    doc = Document(
        revision=1,
        elements={
            "lvl-1": lvl,
            "w1": wall,
            "win-1": win,
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-2",
                name="cleanroom_fixture_window",
                ruleJson={"enforceCleanroomWindowFamilyTypes": True},
            ),
        },
    )

    vs = evaluate(doc.elements)
    assert any(v.rule_id == "ids_cleanroom_window_without_family_type" for v in vs)
