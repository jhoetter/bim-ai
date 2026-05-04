from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit_bundle


def test_wall_datum_constraints_recompute_on_level_move():
    doc = Document(
        revision=1,
        elements={
            "lvl-eg": LevelElem(kind="level", id="lvl-eg", name="EG", elevationMm=0),
            "lvl-ukrd": LevelElem(kind="level", id="lvl-ukrd", name="UKRD", elevationMm=3000),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="Hosted",
                levelId="lvl-eg",
                start=Vec2Mm(xMm=0, yMm=0),
                end=Vec2Mm(xMm=5000, yMm=0),
                thicknessMm=200,
                heightMm=1000,
                base_constraint_level_id="lvl-eg",
                top_constraint_level_id="lvl-ukrd",
            ),
        },
    )

    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [{"type": "moveLevelElevation", "levelId": "lvl-ukrd", "elevationMm": 3200}],
    )
    assert ok is True
    assert code == "ok"
    assert new_doc is not None
    w = new_doc.elements["w1"]
    assert isinstance(w, WallElem)
    assert abs(w.height_mm - 3200.0) < 1.0
