from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FamilyTypeElem,
    LevelElem,
    ValidationRuleElem,
    WallElem,
    WindowElem,
)


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
            "d1": DoorElem(
                kind="door", id="d1", name="D", wall_id="w1", along_t=0.45, width_mm=920
            ),
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


def test_ids_cleanroom_door_pressure_warns_when_missing_on_family_type() -> None:
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

    ft = FamilyTypeElem(
        kind="family_type",
        id="ft-clean-1",
        discipline="door",
        parameters={"displayName": "Interlock minus pressure"},
    )

    doc = Document(
        revision=1,
        elements={
            "lvl-1": lvl,
            "w1": wall,
            "ft-clean-1": ft,
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="Airlock",
                wallId="w1",
                alongT=0.45,
                widthMm=920,
                familyTypeId="ft-clean-1",
            ),
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-pressure",
                name="pressure_fixture",
                ruleJson={"enforceCleanroomDoorPressureRating": True},
            ),
        },
    )

    vs = evaluate(doc.elements)
    assert any(v.rule_id == "ids_cleanroom_door_pressure_metadata_missing" for v in vs)


def test_ids_cleanroom_door_pressure_ok_when_pressure_metadata_present() -> None:
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

    ft = FamilyTypeElem(
        kind="family_type",
        id="ft-clean-2",
        discipline="door",
        parameters={"PressureClass": "P3"},
    )

    doc = Document(
        revision=1,
        elements={
            "lvl-1": lvl,
            "w1": wall,
            "ft-clean-2": ft,
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="Airlock",
                wallId="w1",
                alongT=0.45,
                widthMm=920,
                familyTypeId="ft-clean-2",
            ),
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-pressure-ok",
                name="pressure_fixture_ok",
                ruleJson={"enforceCleanroomDoorPressureRating": True},
            ),
        },
    )

    vs = evaluate(doc.elements)
    assert all(v.rule_id != "ids_cleanroom_door_pressure_metadata_missing" for v in vs)


def test_ids_cleanroom_family_type_linkage_warns_on_unknown_ft() -> None:
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
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
                familyTypeId="missing-ft",
            ),
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-ft-link",
                name="fixture",
                ruleJson={"enforceCleanroomFamilyTypeLinkage": True},
            ),
        },
    )

    vs = evaluate(doc.elements)

    assert any(v.rule_id == "ids_cleanroom_family_type_unknown" for v in vs)


def test_ids_cleanroom_classification_matrix_requires_class_param() -> None:
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
    ft = FamilyTypeElem(
        kind="family_type",
        id="ft-1",
        discipline="door",
        parameters={"PressureClass": "P3"},
    )

    doc = Document(
        revision=2,
        elements={
            "lvl-1": lvl,
            "w1": wall,
            "ft-1": ft,
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
                familyTypeId="ft-1",
            ),
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-cr-class",
                name="fixture",
                ruleJson={"enforceCleanroomCleanroomClass": True},
            ),
        },
    )

    vs = evaluate(doc.elements)

    assert any(v.rule_id == "ids_cleanroom_cleanroom_class_missing" for v in vs)


def test_ids_cleanroom_interlock_grade_on_door_ft() -> None:
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
    ft = FamilyTypeElem(
        kind="family_type",
        id="ft-2",
        discipline="door",
        parameters={"CleanroomClass": "ISO7"},
    )

    doc = Document(
        revision=1,
        elements={
            "lvl-1": lvl,
            "w1": wall,
            "ft-2": ft,
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
                familyTypeId="ft-2",
            ),
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-il",
                name="fixture",
                ruleJson={"enforceCleanroomInterlockGrade": True},
            ),
        },
    )

    vs = evaluate(doc.elements)

    assert any(v.rule_id == "ids_cleanroom_interlock_grade_missing" for v in vs)


def test_ids_cleanroom_opening_finish_material_on_window_ft() -> None:
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
    ft = FamilyTypeElem(kind="family_type", id="ft-win", discipline="window", parameters={})

    doc = Document(
        revision=1,
        elements={
            "lvl-1": lvl,
            "w1": wall,
            "ft-win": ft,
            "win1": WindowElem(
                kind="window",
                id="win1",
                name="W",
                wallId="w1",
                alongT=0.4,
                widthMm=900,
                sillHeightMm=900,
                heightMm=1400,
                familyTypeId="ft-win",
            ),
            "rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-fin",
                name="fixture",
                ruleJson={"enforceCleanroomOpeningFinishMaterial": True},
            ),
        },
    )

    vs = evaluate(doc.elements)

    assert any(v.rule_id == "ids_cleanroom_opening_finish_material_missing" for v in vs)
