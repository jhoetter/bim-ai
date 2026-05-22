"""Unit tests for the pure helpers in ``scripts/backfill_model_commits.py``.

The DB-touching paths run under integration coverage with a real
postgres; here we cover the transaction grouping heuristic and the
context-inference logic.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))


class _Txn:
    """Minimal stand-in for UndoStackRecord used in grouping tests."""

    def __init__(
        self,
        *,
        id: int,
        user_id: str,
        created_at: datetime,
        revision_after: int = 1,
        transaction_metadata: dict | None = None,
        forward_commands: list | None = None,
        commit_id: str | None = None,
    ) -> None:
        self.id = id
        self.user_id = user_id
        self.created_at = created_at
        self.revision_after = revision_after
        self.transaction_metadata = transaction_metadata
        self.forward_commands = forward_commands or []
        self.undo_commands: list = []
        self.commit_id = commit_id


def _import_backfill():
    import importlib

    return importlib.import_module("backfill_model_commits")


def test_group_transactions_splits_on_time_gap() -> None:
    backfill = _import_backfill()
    base = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    txns = [
        _Txn(id=1, user_id="agent", created_at=base),
        _Txn(id=2, user_id="agent", created_at=base + timedelta(minutes=5)),
        _Txn(id=3, user_id="agent", created_at=base + timedelta(hours=2)),  # new group
        _Txn(id=4, user_id="agent", created_at=base + timedelta(hours=2, minutes=10)),
    ]
    groups = backfill._group_transactions(txns, gap_seconds=1800)
    assert [len(g) for g in groups] == [2, 2]
    assert [t.id for t in groups[0]] == [1, 2]
    assert [t.id for t in groups[1]] == [3, 4]


def test_group_transactions_splits_on_user_change() -> None:
    backfill = _import_backfill()
    base = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    txns = [
        _Txn(id=1, user_id="agent", created_at=base),
        _Txn(id=2, user_id="agent", created_at=base + timedelta(minutes=1)),
        _Txn(id=3, user_id="human", created_at=base + timedelta(minutes=2)),  # split
        _Txn(id=4, user_id="human", created_at=base + timedelta(minutes=3)),
    ]
    groups = backfill._group_transactions(txns, gap_seconds=1800)
    assert [len(g) for g in groups] == [2, 2]


def test_group_transactions_empty_list() -> None:
    backfill = _import_backfill()
    assert backfill._group_transactions([], gap_seconds=10) == []


def test_infer_iteration_label_and_house_name() -> None:
    backfill = _import_backfill()
    assert backfill._infer_iteration_label("tmp/reverse-bim/iter-12-captures/x") == "iter-12"
    assert backfill._infer_iteration_label("tmp/reverse-bim/house-alpha/iter-9-foo") == "iter-9"
    assert backfill._infer_iteration_label("noiteration/here") is None
    assert backfill._infer_iteration_label(None) is None

    assert backfill._infer_house_name("tmp/reverse-bim/house-alpha/foo") == "alpha"
    assert backfill._infer_house_name("house_beta/iter-2") == "beta"
    assert backfill._infer_house_name("plain-path") is None


def test_group_context_merges_hints() -> None:
    backfill = _import_backfill()
    base = datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    group = [
        _Txn(
            id=1,
            user_id="agent",
            created_at=base,
            transaction_metadata={
                "submitter": "agent",
                "workflow": {"route": "/api/reverse-bim/house-alpha/iter-9"},
            },
        ),
        _Txn(
            id=2,
            user_id="agent",
            created_at=base + timedelta(seconds=10),
            transaction_metadata={
                "workflow": {"route": "/api/reverse-bim/house-alpha/iter-9-followup"},
            },
        ),
    ]
    ctx = backfill._group_context(group)
    assert ctx["source"] == "retroactive"
    assert ctx["userId"] == "agent"
    assert ctx["submitter"] == "agent"
    assert ctx["iterationLabel"] == "iter-9"
    assert ctx["houseName"] == "alpha"
    assert ctx["txnCount"] == 2
    assert ctx["firstUndoId"] == 1
    assert ctx["lastUndoId"] == 2


def test_group_context_handles_empty_input() -> None:
    backfill = _import_backfill()
    assert backfill._group_context([])["source"] == "retroactive"
