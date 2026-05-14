from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, RoomElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit


def _minimal_doc() -> Document:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="Wall",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=4000, yMm=0),
        thicknessMm=200,
        heightMm=2800,
    )
    return Document(revision=1, elements={"lvl-1": lvl, "w1": wall})


def test_wall_zero_length_rejected_on_endpoint_move():
    doc = _minimal_doc()
    ok, _new_doc, _cmd, viols, code = try_commit(
        doc,
        {
            "type": "moveWallEndpoints",
            "wallId": "w1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 0, "yMm": 0},
        },
    )

    assert ok is False
    assert code == "constraint_error"
    assert any(v.rule_id == "wall_zero_length" for v in viols)


def test_wall_zero_length_rejected_on_create():
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)

    ok, _new_doc, _cmd, viols, code = try_commit(
        Document(revision=1, elements={"lvl-1": lvl}),
        {
            "type": "createWall",
            "id": "w_created",
            "name": "X",
            "levelId": "lvl-1",
            "start": {"xMm": 100, "yMm": 100},
            "end": {"xMm": 100, "yMm": 100},
            "thicknessMm": 200,
            "heightMm": 2800,
        },
    )

    assert ok is False
    assert code == "constraint_error"
    assert any(v.rule_id == "wall_zero_length" for v in viols)


def test_create_wall_persists_location_line():
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)

    ok, new_doc, _cmd, _viols, code = try_commit(
        Document(revision=1, elements={"lvl-1": lvl}),
        {
            "type": "createWall",
            "id": "w_location_line",
            "name": "Exterior face wall",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 4000, "yMm": 0},
            "thicknessMm": 250,
            "heightMm": 3000,
            "locationLine": "finish-face-exterior",
        },
    )

    assert ok is True
    assert new_doc is not None
    assert code == "ok"
    wall = new_doc.elements["w_location_line"]
    assert isinstance(wall, WallElem)
    assert wall.location_line == "finish-face-exterior"
    assert wall.model_dump(by_alias=True)["locationLine"] == "finish-face-exterior"


def test_try_commit_overlap_rejected():
    doc = _minimal_doc()
    ok, _new_doc, _cmd, viols, code = try_commit(
        doc,
        {
            "type": "createWall",
            "id": "w2",
            "name": "Overlapping wall",
            "levelId": "lvl-1",
            "start": {"xMm": 1500, "yMm": 0},
            "end": {"xMm": 5500, "yMm": 0},
            "thicknessMm": 700,
            "heightMm": 2800,
        },
    )

    assert ok is False
    assert code == "constraint_error"
    assert any(v.rule_id == "wall_overlap" for v in viols)


def test_door_width_greater_than_wall_rejected():
    doc = _minimal_doc()
    ok, _new_doc, _cmd, viols, code = try_commit(
        doc,
        {
            "type": "insertDoorOnWall",
            "id": "d1",
            "name": "Too wide",
            "wallId": "w1",
            "alongT": 0.5,
            "widthMm": 5000,
        },
    )

    assert ok is False
    assert code == "constraint_error"
    assert any(v.rule_id == "door_off_wall" for v in viols)


def test_room_far_from_door_is_warning_but_commits():
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="Wall",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=6000, yMm=0),
        thicknessMm=200,
        heightMm=2800,
    )
    door = DoorElem(
        kind="door",
        id="d1",
        name="Door",
        wallId="w1",
        alongT=0.5,
        widthMm=900,
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "w1": wall, "d1": door})

    ok, new_doc, _cmd, viols, code = try_commit(
        doc,
        {
            "type": "createRoomOutline",
            "id": "r_far",
            "name": "Far away",
            "levelId": "lvl-1",
            "outlineMm": [
                {"xMm": 9000, "yMm": 9000},
                {"xMm": 9500, "yMm": 9000},
                {"xMm": 9500, "yMm": 9500},
                {"xMm": 9000, "yMm": 9500},
            ],
        },
    )

    assert ok is True
    assert new_doc is not None
    assert new_doc.revision == doc.revision + 1

    warnings = [v for v in viols if v.severity == "warning"]
    assert any(v.rule_id == "room_no_door" for v in warnings)
    assert code == "ok"


def test_create_room_outline_persists_optional_programme_fields():
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    doc = Document(revision=1, elements={"lvl-1": lvl})
    ok, new_doc, _cmd, _viols, code = try_commit(
        doc,
        {
            "type": "createRoomOutline",
            "id": "r_meta",
            "name": "Tagged",
            "levelId": "lvl-1",
            "programmeCode": " A1 ",
            "department": " Lab ",
            "functionLabel": " Prep ",
            "finishSet": " F01 ",
            "outlineMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 2000, "yMm": 0},
                {"xMm": 2000, "yMm": 2000},
                {"xMm": 0, "yMm": 2000},
            ],
        },
    )
    assert ok is True
    assert new_doc is not None
    assert code == "ok"
    rm = new_doc.elements["r_meta"]
    assert isinstance(rm, RoomElem)
    assert rm.programme_code == "A1"
    assert rm.department == "Lab"
    assert rm.function_label == "Prep"
    assert rm.finish_set == "F01"
