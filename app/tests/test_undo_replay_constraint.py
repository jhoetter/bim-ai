"""Undo-style replay must still respect constraints (WP-P02 adjacency)."""

from __future__ import annotations

import os
import time

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import (
    bundle_replay_diagnostics,
    replay_bundle_diagnostics_for_outcome,
    try_commit_bundle,
)


def test_bundle_replay_diagnostics_large_list_under_budget() -> None:
    """Pure replay metadata scan over a large command list (WP-P01 / WP-X01 scale gate).

    Local ceiling ~0.35s; CI runners get extra margin (same pattern as other perf guards).
    """
    wall_cmd: dict[str, object] = {
        "type": "createWall",
        "levelId": "lvl",
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 2600, "yMm": 0},
        "thicknessMm": 200,
        "heightMm": 2800,
    }
    cmds = [dict(wall_cmd) for _ in range(5000)]

    start = time.perf_counter()
    diag = bundle_replay_diagnostics(cmds)
    elapsed = time.perf_counter() - start

    assert diag["commandCount"] == 5000
    assert diag["commandTypesInOrder"] == ["createWall"] * 5000

    if os.environ.get("CI") == "true" or os.environ.get("GITHUB_ACTIONS") == "true":
        assert elapsed < 1.0
    else:
        assert elapsed < 0.35


def test_replay_diagnostics_for_ok_outcome_has_no_blocking_index() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    cmds: list[dict[str, object]] = [
        {
            "type": "createWall",
            "levelId": "lvl",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 2600, "yMm": 0},
            "thicknessMm": 200,
            "heightMm": 2800,
        }
    ]
    ok, new_doc, _cmds, _violations, code = try_commit_bundle(doc, cmds)
    assert ok is True
    assert new_doc is not None
    assert code == "ok"

    diag = replay_bundle_diagnostics_for_outcome(doc, cmds, outcome_code="ok")
    assert "firstBlockingCommandIndex" not in diag
    assert diag["commandCount"] == 1
    assert diag["commandTypesInOrder"] == ["createWall"]


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
    assert diag.get("blockingViolationRuleIds") == ["wall_missing_level"]


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
    assert diag.get("blockingViolationRuleIds") == ["wall_missing_level"]
