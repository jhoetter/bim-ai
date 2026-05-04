"""Undo-style replay must still respect constraints (WP-P02 adjacency)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import replay_bundle_diagnostics_for_outcome, try_commit_bundle


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

    diag = replay_bundle_diagnostics_for_outcome(
        doc,
        [{"type": "restoreElement", "element": ghost_wall}],
        outcome_code="constraint_error",
    )
    assert diag.get("firstBlockingCommandIndex") == 0


def test_bundle_replay_diagnostics_second_command_blocks_first_valid() -> None:
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
    cmds: list[dict[str, object]] = [
        {
            "type": "createWall",
            "levelId": "lvl",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 2600, "yMm": 0},
            "thicknessMm": 200,
            "heightMm": 2800,
        },
        {"type": "restoreElement", "element": ghost_wall},
    ]
    ok, new_doc, _cmds, _violations, code = try_commit_bundle(doc, cmds)
    assert ok is False
    assert new_doc is None
    assert code == "constraint_error"

    diag = replay_bundle_diagnostics_for_outcome(doc, cmds, outcome_code="constraint_error")
    assert diag.get("firstBlockingCommandIndex") == 1
