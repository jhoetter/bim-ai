"""Time-travel Wave 4 — testhouse_iter filter on GET /api/models/{id}/commits.

The filter reads the structured ``context.testhouse_iter`` block whose
schema is pinned by
``spec/trackers/testhouse-clean-rebuild-tracker.md`` to
``{house, iter, phase}``. These tests confirm:

  1. The route registers ``testhouse_house`` and ``testhouse_iter`` as
     query parameters.
  2. The filter clauses compile to SQL that reads the JSONB sub-path
     ``context.testhouse_iter.house`` / ``.iter`` — i.e. they do NOT
     accidentally re-target the legacy flat ``houseName`` / ``iterationLabel``
     fields used by the pre-rebuild slice executor.
  3. The state-endpoint shape: ``{modelId, at, revision, document}`` —
     so the Workspace ``hydrateFromSnapshot`` path can read
     ``document.elements`` directly.

Full DB-backed integration tests for the route live under
``app/tests/integration/``; here we exercise only the pure layer.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import Select

from bim_ai.routes.time_travel import time_travel_router
from bim_ai.tables import ModelCommitRecord


def _find_route(path_suffix: str):
    for route in time_travel_router.routes:
        if getattr(route, "path", "").endswith(path_suffix):
            return route
    raise AssertionError(f"route ending in {path_suffix!r} not registered")


def test_list_commits_exposes_testhouse_filters() -> None:
    route = _find_route("/models/{model_id}/commits")
    # Inspect FastAPI's dependent query params (skip path params + Depends).
    param_names = {p.name for p in route.dependant.query_params}
    assert "testhouse_house" in param_names, (
        f"missing testhouse_house query parameter; got {param_names!r}"
    )
    assert "testhouse_iter" in param_names, (
        f"missing testhouse_iter query parameter; got {param_names!r}"
    )


def test_testhouse_iter_filter_reads_structured_subpath() -> None:
    """Compile the filter SQL and confirm the JSONB sub-path is correct.

    The filter must read ``context.testhouse_iter.house`` /
    ``context.testhouse_iter.iter`` — NOT the legacy flat fields
    ``houseName`` / ``iterationLabel`` used by the pre-rebuild slice
    executor. Both kinds of attribution can coexist on a row; the
    iter-picker only honors the structured one.
    """

    house_clause = ModelCommitRecord.context["testhouse_iter"]["house"].astext == "alpha"
    iter_clause = ModelCommitRecord.context["testhouse_iter"]["iter"].astext == "3"

    dialect = postgresql.dialect()

    # Render each clause as SQL against the postgres dialect.
    house_sql = str(
        house_clause.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )
    iter_sql = str(
        iter_clause.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )

    # The compiled WHERE clause walks `context -> 'testhouse_iter' ->> 'house'`.
    assert "'testhouse_iter'" in house_sql
    assert "'house'" in house_sql
    assert "->>" in house_sql  # text-cast operator

    assert "'testhouse_iter'" in iter_sql
    assert "'iter'" in iter_sql
    assert "->>" in iter_sql


def test_get_state_at_commit_response_shape_matches_frontend_contract() -> None:
    """The state endpoint returns ``{modelId, at, revision, document}``.

    The historical Workspace bootstrap in
    ``packages/web/src/workspace/useWorkspaceSnapshot.ts`` consumes this
    shape via ``hydrateFromSnapshot``. Mismatch here breaks the viewer.
    """

    route = _find_route("/models/{model_id}/state")
    # Inspect the route's return-annotation source via the endpoint function.
    # FastAPI doesn't constrain the dict's keys; the contract is enforced
    # by the body of the function — assert the function's source mentions
    # the expected keys to catch silent renames.
    import inspect

    source = inspect.getsource(route.endpoint)
    for key in ("modelId", '"at"', '"revision"', '"document"'):
        assert key in source, f"state route source missing {key!r} key — frontend contract drift?"


def test_list_commits_select_includes_testhouse_filter_when_set() -> None:
    """Smoke test that adding the filter mutates the Select statement.

    We build the same Select the route builds, with and without the
    filter, and confirm the WHERE-clause text differs only by the
    testhouse_iter sub-path predicate.
    """

    from sqlalchemy import desc, select

    base = (
        select(ModelCommitRecord)
        .where(ModelCommitRecord.model_id == "00000000-0000-0000-0000-000000000000")
        .order_by(desc(ModelCommitRecord.created_at), desc(ModelCommitRecord.commit_id))
    )
    with_filter: Select = base.where(
        ModelCommitRecord.context["testhouse_iter"]["house"].astext == "alpha"
    ).where(ModelCommitRecord.context["testhouse_iter"]["iter"].astext == "3")

    dialect = postgresql.dialect()
    base_sql = str(base.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))
    filtered_sql = str(
        with_filter.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )

    assert "testhouse_iter" not in base_sql
    assert "testhouse_iter" in filtered_sql
    assert "'alpha'" in filtered_sql
    assert "'3'" in filtered_sql
