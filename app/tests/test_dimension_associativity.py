from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import try_commit


def test_create_dimension_infers_linked_state_from_feature_refs() -> None:
    level = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    ok, new_doc, _cmd, violations, code = try_commit(
        Document(revision=1, elements={"lvl-1": level}),
        {
            "type": "createDimension",
            "id": "dim-1",
            "levelId": "lvl-1",
            "aMm": {"xMm": 0, "yMm": 0},
            "bMm": {"xMm": 3000, "yMm": 0},
            "offsetMm": {"xMm": 0, "yMm": 500},
            "refElementIdA": "wall-a",
            "refElementIdB": "wall-b",
        },
    )

    assert ok is True, (code, violations)
    dim = new_doc.elements["dim-1"]
    dumped = dim.model_dump(by_alias=True)
    assert dumped["state"] == "linked"
    assert dumped["anchorA"]["kind"] == "feature"
    assert dumped["anchorB"]["feature"]["elementId"] == "wall-b"


def test_create_dimension_preserves_explicit_partial_anchor_state() -> None:
    level = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    ok, new_doc, _cmd, violations, code = try_commit(
        Document(revision=1, elements={"lvl-1": level}),
        {
            "type": "createDimension",
            "id": "dim-2",
            "levelId": "lvl-1",
            "aMm": {"xMm": 0, "yMm": 0},
            "bMm": {"xMm": 3000, "yMm": 0},
            "offsetMm": {"xMm": 0, "yMm": 500},
            "state": "partial",
            "anchorA": {
                "kind": "feature",
                "feature": {"elementId": "wall-a", "anchor": "end"},
                "fallbackPositionMm": {"xMm": 0, "yMm": 0},
            },
            "anchorB": {"kind": "free", "fallbackPositionMm": {"xMm": 3000, "yMm": 0}},
        },
    )

    assert ok is True, (code, violations)
    dumped = new_doc.elements["dim-2"].model_dump(by_alias=True)
    assert dumped["state"] == "partial"
    assert dumped["anchorA"]["feature"]["anchor"] == "end"
    assert dumped["anchorB"]["kind"] == "free"
