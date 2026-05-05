"""Undo-style replay must still respect constraints (WP-P02 adjacency)."""

from __future__ import annotations

import os
import time

from bim_ai.document import Document
from bim_ai.elements import LevelElem
from bim_ai.engine import (
    AGENT_LARGE_BUNDLE_ADVISORY_TEXT_V1,
    authoritative_replay_v0_preflight_detail,
    bundle_commands_are_authoritative_replay_v0_only,
    bundle_replay_diagnostics,
    command_bundle_merge_preflight_v1,
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
    budget = diag["replayPerformanceBudget_v1"]
    assert budget["format"] == "replayPerformanceBudget_v1"
    assert budget["commandCount"] == 5000
    assert budget["commandTypeHistogram"] == [{"commandType": "createWall", "count": 5000}]
    assert budget["distinctCommandTypeCount"] == 1
    assert budget["largeBundleWarn"] is True
    assert budget["warningCodes"] == ["large_command_bundle"]
    assert budget["agentBundleAdvisory"] == AGENT_LARGE_BUNDLE_ADVISORY_TEXT_V1
    assert budget["declaredDiagnosticsBudgetMsLocal"] == 350
    assert budget["declaredDiagnosticsBudgetMsCi"] == 1000
    assert "firstBlockingCommandIndex" not in budget

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
    bok = diag["replayPerformanceBudget_v1"]
    assert bok["largeBundleWarn"] is False
    assert bok["warningCodes"] == []
    assert bok["agentBundleAdvisory"] == ""
    assert "firstBlockingCommandIndex" not in bok


def test_bundle_replay_diagnostics_histogram_sorted_by_command_type() -> None:
    cmds = [
        {"type": "zLast"},
        {"type": "aFirst"},
        {"type": "mMid"},
        {"type": "aFirst"},
    ]
    diag = bundle_replay_diagnostics(cmds)
    hist = diag["replayPerformanceBudget_v1"]["commandTypeHistogram"]
    assert [row["commandType"] for row in hist] == ["aFirst", "mMid", "zLast"]
    assert hist == [
        {"commandType": "aFirst", "count": 2},
        {"commandType": "mMid", "count": 1},
        {"commandType": "zLast", "count": 1},
    ]


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
    bb = diag["replayPerformanceBudget_v1"]
    assert bb.get("firstBlockingCommandIndex") == 0


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
    bb = diag["replayPerformanceBudget_v1"]
    assert bb.get("firstBlockingCommandIndex") == 1


def _minimal_wall_cmd(*, wid: str, level_id: str = "lvl") -> dict[str, object]:
    return {
        "type": "createWall",
        "id": wid,
        "levelId": level_id,
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 2600, "yMm": 0},
        "thicknessMm": 200,
        "heightMm": 2800,
    }


def test_bundle_commands_are_authoritative_replay_v0_only() -> None:
    wall_cmd = _minimal_wall_cmd(wid="w-a")
    assert bundle_commands_are_authoritative_replay_v0_only([wall_cmd]) is True
    assert bundle_commands_are_authoritative_replay_v0_only([wall_cmd, {"type": "noop"}]) is False


def test_authoritative_preflight_detail_duplicate_declared_id() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    cmds: list[dict[str, object]] = [_minimal_wall_cmd(wid="dup"), _minimal_wall_cmd(wid="dup")]
    detail = authoritative_replay_v0_preflight_detail(doc, cmds)
    assert detail is not None
    assert detail.reason_code == "merge_id_collision"
    assert detail.first_conflicting_step_index == 1
    assert detail.conflicting_declared_ids == ("dup",)


def test_authoritative_preflight_detail_missing_level_hint() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    cmds: list[dict[str, object]] = [_minimal_wall_cmd(wid="w-a", level_id="lvl-missing")]
    detail = authoritative_replay_v0_preflight_detail(doc, cmds)
    assert detail is not None
    assert detail.reason_code == "merge_reference_unresolved"
    assert detail.first_conflicting_step_index == 0
    assert len(detail.missing_reference_hints) == 1
    h0 = detail.missing_reference_hints[0]
    assert h0["referenceKey"] == "levelId"
    assert h0["referenceId"] == "lvl-missing"


def test_command_bundle_merge_preflight_digest_stable() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    cmds: list[dict[str, object]] = [_minimal_wall_cmd(wid="w-new")]
    detail = authoritative_replay_v0_preflight_detail(doc, cmds)
    assert detail is None
    diag = replay_bundle_diagnostics_for_outcome(doc, cmds, outcome_code="ok")
    a = command_bundle_merge_preflight_v1(
        doc=doc,
        cmds_raw=cmds,
        authoritative_failure=None,
        outcome_code="ok",
        violations=[],
        replay_diag=diag,
    )
    b = command_bundle_merge_preflight_v1(
        doc=doc,
        cmds_raw=cmds,
        authoritative_failure=None,
        outcome_code="ok",
        violations=[],
        replay_diag=diag,
    )
    assert a["evidenceDigestSha256"] == b["evidenceDigestSha256"]
    assert a["format"] == "commandBundleMergePreflight_v1"
    assert a["reasonCode"] == "ok"
    assert a["safeRetryClassification"] == "safe_retry_unchanged"


def test_merge_preflight_constraint_error_matches_blocking_step() -> None:
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
    cmds: list[dict[str, object]] = [{"type": "restoreElement", "element": ghost_wall}]
    ok, _new_doc, _cmds, violations, code = try_commit_bundle(doc, cmds)
    assert ok is False
    diag = replay_bundle_diagnostics_for_outcome(doc, cmds, outcome_code=code)
    mf = command_bundle_merge_preflight_v1(
        doc=doc,
        cmds_raw=cmds,
        authoritative_failure=None,
        outcome_code=code,
        violations=violations,
        replay_diag=diag,
    )
    assert mf["reasonCode"] == "constraint_error"
    assert mf["firstConflictingStepIndex"] == 0
    assert mf["safeRetryClassification"] == "requires_manual_resolution"
