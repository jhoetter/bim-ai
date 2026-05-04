"""Undo-style replay must still respect constraints (WP-P02 adjacency)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import try_commit_bundle


def test_undo_restore_wall_with_missing_level_blocked() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})

    ghost_wall = {
        "kind": "wall",
        "id": "w-bad",
        "name": "W",
        "levelId": "level-missing",
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 2600, "yMm": 0},
        "thicknessMm": 200,
        "heightMm": 2800,
    }

    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        doc,
        [{"type": "restoreElement", "element": ghost_wall}],
    )

    assert ok is False
    assert new_doc is None
    assert code == "constraint_error"
    assert any(getattr(v, "rule_id", None) == "wall_missing_level" for v in violations)
