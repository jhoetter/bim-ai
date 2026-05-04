from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import try_commit, try_commit_bundle

_RECT = {
    "type": "createRoomRectangle",
    "levelId": "lvl-1",
    "origin": {"xMm": 1000, "yMm": -2000},
    "widthMm": 3500,
    "depthMm": 2800,
}


def test_create_room_rectangle_ok() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    doc = Document(revision=1, elements={"lvl-1": lvl})
    ok, new_doc, _, _viols, code = try_commit(doc, _RECT)

    assert ok is True

    assert code == "ok"

    kinds = sorted({e.kind for e in new_doc.elements.values()})

    assert "room" in kinds

    assert "wall" in kinds


def test_room_rectangle_bundle_matches_single() -> None:

    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)

    doc = Document(revision=1, elements={"lvl-1": lvl})

    cmd = {
        "type": "createRoomRectangle",
        "levelId": "lvl-1",
        "origin": {"xMm": 300, "yMm": -300},
        "widthMm": 2000,
        "depthMm": 1500,
    }

    ok1, d1, _, _, code1 = try_commit(doc, cmd)

    ok2, d2, _, _, code2 = try_commit_bundle(doc, [cmd])

    assert ok1 and ok2

    assert code1 == code2 == "ok"

    assert len(d1.elements) == len(d2.elements)
