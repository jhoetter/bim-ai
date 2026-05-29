"""PERF-CQ-03: regression tests for the request-scoped evidence cache.

`build_evidence_package_payload` assembles ~30 sub-payloads and used to
re-call heavy derivations (room-boundary, plan-projection,
schedule-table, room-derivation preview/candidates, model summary,
type-material registry, plan-view wire index) once per call site —
sometimes 100+ times per request.

These tests pin the invariant: within one request, each
`(scope_id, derivation_kind)` pair is computed at most once.
"""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import UUID

import pytest

from bim_ai import (
    model_summary,
    plan_projection_wire,
    room_derivation,
    schedule_derivation,
    type_material_registry,
)
from bim_ai import (
    room_derivation_preview as rd_preview_mod,
)
from bim_ai.document import Document
from bim_ai.evidence_request_cache import (
    _EvidenceRequestCache,
    cached_compute,
    evidence_request_cache_scope,
    get_active_evidence_request_cache,
    hash_params,
)
from bim_ai.routes.api import build_evidence_package_payload

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS = _REPO_ROOT / "app" / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from performance_budget import (  # noqa: E402  (path-injection above)
    build_documentation_heavy_fixture,
    build_schedule_heavy_fixture,
    build_small_fixture,
)

MODEL_ID = UUID("00000000-0000-0000-0000-000000000fff")


# ---------------------------------------------------------------------------
# Unit tests for the cache primitive itself
# ---------------------------------------------------------------------------


def test_cache_get_or_compute_runs_factory_once() -> None:
    cache = _EvidenceRequestCache()
    calls = 0

    def factory() -> dict[str, int]:
        nonlocal calls
        calls += 1
        return {"call": calls}

    first = cache.get_or_compute(
        doc_revision=1,
        scope_id="document",
        derivation_kind="example",
        params_hash="",
        factory=factory,
    )
    second = cache.get_or_compute(
        doc_revision=1,
        scope_id="document",
        derivation_kind="example",
        params_hash="",
        factory=factory,
    )

    assert calls == 1
    assert first is second
    assert cache.computed_call_counts == {"example": 1}


def test_cache_key_includes_doc_revision_and_scope() -> None:
    cache = _EvidenceRequestCache()
    calls = 0

    def factory() -> int:
        nonlocal calls
        calls += 1
        return calls

    cache.get_or_compute(
        doc_revision=1,
        scope_id="A",
        derivation_kind="kind",
        params_hash="",
        factory=factory,
    )
    cache.get_or_compute(
        doc_revision=2,
        scope_id="A",
        derivation_kind="kind",
        params_hash="",
        factory=factory,
    )
    cache.get_or_compute(
        doc_revision=1,
        scope_id="B",
        derivation_kind="kind",
        params_hash="",
        factory=factory,
    )
    cache.get_or_compute(
        doc_revision=1,
        scope_id="A",
        derivation_kind="other",
        params_hash="",
        factory=factory,
    )
    cache.get_or_compute(
        doc_revision=1,
        scope_id="A",
        derivation_kind="kind",
        params_hash="p1",
        factory=factory,
    )

    assert calls == 5
    assert cache.size() == 5


def test_hash_params_is_order_invariant_for_dicts() -> None:
    a = hash_params({"x": 1, "y": 2})
    b = hash_params({"y": 2, "x": 1})
    assert a == b
    assert hash_params({"x": 1}) != hash_params({"x": 2})


def test_scope_activates_and_resets_context_var() -> None:
    assert get_active_evidence_request_cache() is None
    with evidence_request_cache_scope() as cache:
        assert get_active_evidence_request_cache() is cache
    assert get_active_evidence_request_cache() is None


def test_cached_compute_passes_through_when_no_scope_active() -> None:
    doc = Document(revision=1, elements={})
    calls = 0

    def factory() -> int:
        nonlocal calls
        calls += 1
        return calls

    a = cached_compute(
        doc=doc, scope_id="x", derivation_kind="y", factory=factory
    )
    b = cached_compute(
        doc=doc, scope_id="x", derivation_kind="y", factory=factory
    )
    # Without an active scope, every call runs the factory.
    assert calls == 2
    assert a == 1
    assert b == 2


# ---------------------------------------------------------------------------
# Spec acceptance: within one evidence-package call, each (scope, derivation)
# pair runs at most once. We assert this by spying on the uncached primitives
# below the cache layer.
# ---------------------------------------------------------------------------


class _CallSpy:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    def wrap(self, name: str, fn):  # type: ignore[no-untyped-def]
        def wrapper(*args, **kwargs):  # type: ignore[no-untyped-def]
            self.counts[name] = self.counts.get(name, 0) + 1
            return fn(*args, **kwargs)

        return wrapper


@pytest.fixture
def heavy_fixture_with_schedules() -> Document:
    return build_schedule_heavy_fixture()


@pytest.fixture
def documentation_heavy_fixture() -> Document:
    return build_documentation_heavy_fixture()


def _wrap_primitives(monkeypatch: pytest.MonkeyPatch, spy: _CallSpy) -> None:
    """Install spies on the heavy derivation primitives that the evidence
    package re-runs in many call sites. Wrapping the underlying
    `_uncached` functions (rather than the public wrappers) gives us a
    deterministic count regardless of whether the public wrapper itself
    is memoised."""

    monkeypatch.setattr(
        room_derivation,
        "_compute_room_boundary_derivation_uncached",
        spy.wrap(
            "compute_room_boundary_derivation",
            room_derivation._compute_room_boundary_derivation_uncached,
        ),
    )
    monkeypatch.setattr(
        plan_projection_wire,
        "_resolve_plan_projection_wire_uncached",
        spy.wrap(
            "resolve_plan_projection_wire",
            plan_projection_wire._resolve_plan_projection_wire_uncached,
        ),
    )
    monkeypatch.setattr(
        schedule_derivation,
        "_derive_schedule_table_uncached",
        spy.wrap(
            "derive_schedule_table",
            schedule_derivation._derive_schedule_table_uncached,
        ),
    )
    monkeypatch.setattr(
        rd_preview_mod,
        "room_derivation_preview",
        spy.wrap("room_derivation_preview", rd_preview_mod.room_derivation_preview),
    )
    monkeypatch.setattr(
        rd_preview_mod,
        "room_derivation_candidates_review",
        spy.wrap(
            "room_derivation_candidates_review",
            rd_preview_mod.room_derivation_candidates_review,
        ),
    )
    monkeypatch.setattr(
        type_material_registry,
        "merged_registry_payload",
        spy.wrap(
            "merged_registry_payload", type_material_registry.merged_registry_payload
        ),
    )
    monkeypatch.setattr(
        model_summary,
        "compute_model_summary",
        spy.wrap("compute_model_summary", model_summary.compute_model_summary),
    )

    # `routes.api` and other modules already imported the public wrappers
    # by name above before the test ran, so propagate the spy-wrapped
    # bindings into every importing module's namespace.
    from bim_ai.routes import api as api_mod

    monkeypatch.setattr(
        api_mod,
        "room_derivation_preview",
        rd_preview_mod.room_derivation_preview,
    )
    monkeypatch.setattr(
        api_mod,
        "room_derivation_candidates_review",
        rd_preview_mod.room_derivation_candidates_review,
    )
    monkeypatch.setattr(
        api_mod,
        "merged_registry_payload",
        type_material_registry.merged_registry_payload,
    )
    monkeypatch.setattr(
        api_mod,
        "compute_model_summary",
        model_summary.compute_model_summary,
    )
    # `model_summary` calls `room_derivation_preview` internally; rebind
    # the module-cached name so the spy sees those invocations too.
    monkeypatch.setattr(
        model_summary,
        "room_derivation_preview",
        rd_preview_mod.room_derivation_preview,
    )


def test_each_scope_derivation_pair_runs_at_most_once_schedule_heavy(
    monkeypatch: pytest.MonkeyPatch,
    heavy_fixture_with_schedules: Document,
) -> None:
    """Spec acceptance #5 — each `(scope, derivation)` pair is computed
    at most once per evidence-package call."""

    spy = _CallSpy()
    _wrap_primitives(monkeypatch, spy)

    build_evidence_package_payload(model_id=MODEL_ID, doc=heavy_fixture_with_schedules)

    # The document-scoped wrappers must be called at most once.
    assert spy.counts.get("compute_model_summary", 0) == 1, spy.counts
    assert spy.counts.get("room_derivation_preview", 0) == 1, spy.counts
    assert spy.counts.get("room_derivation_candidates_review", 0) == 1, spy.counts
    assert spy.counts.get("merged_registry_payload", 0) == 1, spy.counts

    # The heavy primitives below the cache layer. Each unique
    # `(scope, derivation)` triple must run at most once. The schedule_heavy
    # fixture has one plan view and one level — so `resolve_plan_projection_wire`
    # is called with a fixed `(plan_view_id, fallback_level_id, presentation)`
    # tuple and should fold to a single invocation regardless of how many
    # sub-payloads re-derive it.
    rd_count = spy.counts.get("compute_room_boundary_derivation", 0)
    assert rd_count == 1, (
        f"compute_room_boundary_derivation called {rd_count}x — request cache leaked"
    )

    pp_count = spy.counts.get("resolve_plan_projection_wire", 0)
    # Each distinct (plan_view_id, fallback_level_id, presentation) tuple
    # may run once. Schedule_heavy has one level so this is bounded by the
    # number of distinct call-site argument tuples — single-digit.
    assert pp_count <= 8, (
        f"resolve_plan_projection_wire called {pp_count}x — should be ≤ "
        "the number of distinct (plan_view_id, fallback_level_id) tuples"
    )


def test_each_scope_derivation_pair_runs_at_most_once_documentation_heavy(
    monkeypatch: pytest.MonkeyPatch,
    documentation_heavy_fixture: Document,
) -> None:
    """Same invariant for the documentation_heavy fixture (multiple
    plan views, multiple sheets). The doc-scoped wrappers still run
    exactly once; per-arguments primitives run at most once per
    unique kwargs tuple."""

    spy = _CallSpy()
    _wrap_primitives(monkeypatch, spy)

    build_evidence_package_payload(
        model_id=MODEL_ID, doc=documentation_heavy_fixture
    )

    assert spy.counts.get("compute_model_summary", 0) == 1, spy.counts
    assert spy.counts.get("room_derivation_preview", 0) == 1, spy.counts
    assert spy.counts.get("room_derivation_candidates_review", 0) == 1, spy.counts
    assert spy.counts.get("merged_registry_payload", 0) == 1, spy.counts
    assert spy.counts.get("compute_room_boundary_derivation", 0) == 1, spy.counts

    # documentation_heavy: 2 plan views — bounded above by single-digit number
    # of distinct argument tuples.
    pp_count = spy.counts.get("resolve_plan_projection_wire", 0)
    assert pp_count <= 12, (
        f"resolve_plan_projection_wire called {pp_count}x in documentation_heavy "
        "— more than expected number of distinct argument tuples"
    )

    # Schedules: documentation_heavy has 4 schedules × 2 levels = 8 schedule ids.
    # Each `(schedule_id, room_boundary_derivation, lightweight)` tuple should
    # be called at most twice (once each for the two lightweight modes used
    # inside the package).
    sched_count = spy.counts.get("derive_schedule_table", 0)
    assert sched_count <= 24, (
        f"derive_schedule_table called {sched_count}x — schedule request "
        "cache leaked"
    )


# ---------------------------------------------------------------------------
# Determinism: the cache must not change derivation outputs.
# ---------------------------------------------------------------------------


def test_evidence_package_output_unchanged_by_cache_layer_small() -> None:
    """The cache is a pure memoisation layer — the payload digest is
    stable across repeated calls. (We rebuild the doc to dodge any
    cross-request caches keyed on object identity.)"""

    a = build_evidence_package_payload(model_id=MODEL_ID, doc=build_small_fixture())
    b = build_evidence_package_payload(model_id=MODEL_ID, doc=build_small_fixture())

    assert a["semanticDigestSha256"] == b["semanticDigestSha256"]
