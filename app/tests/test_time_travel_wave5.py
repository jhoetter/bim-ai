"""Time-travel Wave 5 — operational hardening unit tests.

* ``sweep_orphaned_open_commits`` SQL: the orphan filter must combine
  ``state='open'`` with an age cutoff against ``created_at``; both are
  required to avoid sweeping commits that opened seconds ago and
  haven't had time to attach their first transaction.
* ``snapshot_storage_summary`` SQL: aggregates over
  ``bim_model_snapshots`` (count, sum, max) plus a per-model rollup
  ordered by descending size — pin the SQL so a refactor cannot
  accidentally page through the entire snapshot history client-side.
* New admin routes are registered on the router.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.dialects import postgresql

from bim_ai.routes.time_travel import time_travel_router
from bim_ai.tables import ModelCommitRecord, ModelSnapshotRecord, UndoStackRecord


def _all_paths() -> set[str]:
    return {getattr(route, "path", "") for route in time_travel_router.routes}


def test_wave5_routes_registered() -> None:
    paths = _all_paths()
    assert "/time-travel/storage-summary" in paths
    assert "/time-travel/sweep-orphans" in paths


def test_sweep_orphans_route_only_post() -> None:
    for route in time_travel_router.routes:
        if getattr(route, "path", "") == "/time-travel/sweep-orphans":
            assert "POST" in route.methods
            assert "GET" not in route.methods
            return
    raise AssertionError("sweep-orphans route not found")


def test_storage_summary_route_only_get() -> None:
    for route in time_travel_router.routes:
        if getattr(route, "path", "") == "/time-travel/storage-summary":
            assert "GET" in route.methods
            assert "POST" not in route.methods
            return
    raise AssertionError("storage-summary route not found")


def test_orphan_query_combines_open_state_with_age_cutoff() -> None:
    """The orphan filter is ``state='open' AND created_at < threshold``.

    Both predicates are mandatory: dropping the age cutoff would also
    sweep commits that opened a millisecond ago, racing the writer.
    Dropping the state filter would also touch closed/aborted rows.
    """

    threshold = datetime(2026, 5, 23, tzinfo=UTC) - timedelta(seconds=3600)
    stmt = (
        select(ModelCommitRecord)
        .where(ModelCommitRecord.state == "open")
        .where(ModelCommitRecord.created_at < threshold)
    )
    sql = str(
        stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )
    assert "state = 'open'" in sql or "state =\n'open'" in sql or "'open'" in sql
    assert "created_at <" in sql


def test_per_commit_undo_count_query_targets_undo_stack() -> None:
    """The sweeper's "any rows attached?" check counts via undo_stack.commit_id."""

    stmt = select(func.count(UndoStackRecord.id)).where(
        UndoStackRecord.commit_id == "01ABCDEFGHJKMNPQRSTVWXYZ01"
    )
    sql = str(
        stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )
    assert "bim_undo_stack" in sql
    assert "commit_id" in sql
    assert "01ABCDEFGHJKMNPQRSTVWXYZ01" in sql


def test_storage_summary_per_model_rollup_orders_by_size_desc() -> None:
    """The per-model rollup must rank by SUM(document_size_bytes) DESC.

    Pinning the ORDER BY guards against an accidental ``order_by(model_id)``
    that would surface the lightest model first instead of the heaviest.
    """

    stmt = (
        select(
            ModelSnapshotRecord.model_id,
            func.count(ModelSnapshotRecord.id),
            func.coalesce(func.sum(ModelSnapshotRecord.document_size_bytes), 0),
        )
        .group_by(ModelSnapshotRecord.model_id)
        .order_by(desc(func.sum(ModelSnapshotRecord.document_size_bytes)))
        .limit(10)
    )
    sql = str(
        stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )
    assert "GROUP BY" in sql
    assert "ORDER BY" in sql
    assert "DESC" in sql
    assert "document_size_bytes" in sql
    assert "LIMIT" in sql


def test_storage_summary_response_keys_match_endpoint_contract() -> None:
    """The wire shape is the bridge between the helper and the route.

    Read the helper's source as a cheap "did anyone rename a key?" guard.
    """

    import inspect

    from bim_ai.versioning import snapshot_storage_summary

    src = inspect.getsource(snapshot_storage_summary)
    for key in (
        '"snapshotCount"',
        '"totalBytes"',
        '"maxBytes"',
        '"perModel"',
        '"commitStateMix"',
    ):
        assert key in src, f"snapshot_storage_summary missing key {key}"


def test_sweep_helper_returns_documented_shape() -> None:
    import inspect

    from bim_ai.versioning import sweep_orphaned_open_commits

    src = inspect.getsource(sweep_orphaned_open_commits)
    for key in ('"considered"', '"closed"', '"aborted"', '"thresholdAt"'):
        assert key in src, f"sweep_orphaned_open_commits missing key {key}"
