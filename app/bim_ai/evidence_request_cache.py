"""PERF-CQ-03: Request-scoped computation cache for the evidence package.

`build_evidence_package_payload` assembles ~30 sub-payloads that
collectively re-call a handful of heavy derivations (room-boundary,
plan-projection, schedule-table, model-summary, type-material registry,
room-derivation preview/candidates). Each derivation already has its
own cache layer, but the existing request-scoped caches
(`room_boundary_derivation_request_cache`,
`plan_projection_wire_request_cache`,
`schedule_table_derivation_request_cache`) are *opt-in* context
managers — and the evidence-package callers never entered them.

This module provides a single context manager
(`evidence_request_cache_scope`) that activates all three pre-existing
request caches at once, plus an `_EvidenceRequestCache` keyed on
`(doc_revision, scope_id, derivation_kind, params_hash)` for the
derivations that don't have their own contextvar cache (model summary,
type-material registry, room-derivation preview/candidates,
constructability summary v1, plan_view_wire_index).

The cache is per-request (a `ContextVar` instance, opened/closed by the
context manager) — never global, so concurrent requests cannot leak
state. Cached values are returned by reference; callers must treat them
as read-only within the request.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Iterator
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from typing import Any

from bim_ai.document import Document
from bim_ai.plan_projection_wire import plan_projection_wire_request_cache
from bim_ai.room_derivation import room_boundary_derivation_request_cache
from bim_ai.schedule_derivation import schedule_table_derivation_request_cache

_EvidenceRequestCacheKey = tuple[int, str, str, str]


class _EvidenceRequestCache:
    """Dict-backed cache keyed on `(doc_revision, scope_id, derivation_kind, params_hash)`.

    Lives for the duration of a single `build_evidence_package_payload`
    call (or any other request-scoped block opened via
    `evidence_request_cache_scope`). Stores derivation outputs by
    reference; callers must not mutate cached values.
    """

    __slots__ = ("_store", "computed_call_counts")

    def __init__(self) -> None:
        self._store: dict[_EvidenceRequestCacheKey, Any] = {}
        # Test/diagnostic counter: how many actual factory invocations
        # happened, by derivation_kind. Tests assert this is exactly
        # one per `(scope_id, derivation_kind)` pair within a request.
        self.computed_call_counts: dict[str, int] = {}

    def get_or_compute[T](
        self,
        *,
        doc_revision: int,
        scope_id: str,
        derivation_kind: str,
        params_hash: str,
        factory: Callable[[], T],
    ) -> T:
        key: _EvidenceRequestCacheKey = (
            int(doc_revision),
            str(scope_id),
            str(derivation_kind),
            str(params_hash),
        )
        if key in self._store:
            return self._store[key]  # type: ignore[no-any-return]
        value = factory()
        self._store[key] = value
        self.computed_call_counts[derivation_kind] = (
            self.computed_call_counts.get(derivation_kind, 0) + 1
        )
        return value

    # ---- introspection -----------------------------------------------------

    def size(self) -> int:
        return len(self._store)

    def keys(self) -> list[_EvidenceRequestCacheKey]:
        return list(self._store.keys())


_EVIDENCE_REQUEST_CACHE: ContextVar[_EvidenceRequestCache | None] = ContextVar(
    "evidence_request_cache", default=None
)


def get_active_evidence_request_cache() -> _EvidenceRequestCache | None:
    """Return the request-scoped cache if one is currently active."""

    return _EVIDENCE_REQUEST_CACHE.get()


def hash_params(*parts: Any) -> str:
    """Hash a deterministic tuple of params into a short hex string.

    Used to build `params_hash` for `_EvidenceRequestCache`. The input
    is canonicalized via `json.dumps(sort_keys=True)` so dict ordering
    doesn't affect cache identity. Non-JSON-serialisable parts fall
    back to `repr()` — fine for the scalar kwargs the evidence package
    uses today.
    """

    canon: list[Any] = []
    for p in parts:
        try:
            json.dumps(p, sort_keys=True, default=str)
            canon.append(p)
        except TypeError:
            canon.append(repr(p))
    raw = json.dumps(canon, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.blake2b(raw.encode("utf-8"), digest_size=8).hexdigest()


@contextmanager
def evidence_request_cache_scope() -> Iterator[_EvidenceRequestCache]:
    """Open a fresh request-scoped cache + the three pre-existing
    derivation request caches (room boundary, plan projection wire,
    schedule table). All four are torn down on exit so concurrent
    requests cannot share state."""

    cache = _EvidenceRequestCache()
    token = _EVIDENCE_REQUEST_CACHE.set(cache)
    with ExitStack() as stack:
        stack.enter_context(room_boundary_derivation_request_cache())
        stack.enter_context(plan_projection_wire_request_cache())
        stack.enter_context(schedule_table_derivation_request_cache())
        try:
            yield cache
        finally:
            _EVIDENCE_REQUEST_CACHE.reset(token)


# ---------------------------------------------------------------------------
# Convenience wrappers — call these inside `build_evidence_package_payload`
# instead of the raw derivation functions. If no cache is active the
# raw factory still runs (so they remain safe outside the evidence
# block).
# ---------------------------------------------------------------------------


def _doc_scope_id(doc: Document) -> str:
    """Stable scope id for "the whole document".

    The room-boundary / plan-projection / schedule caches already key
    on the element fingerprint internally, so for the
    document-level derivations we just need a constant string per
    request scope. Using the element-set length + first/last id avoids
    collisions across radically different fixtures in the same test
    session.
    """

    n = len(doc.elements)
    if n == 0:
        return "doc:empty"
    first = next(iter(doc.elements))
    return f"doc:{n}:{first}"


def cached_compute[T](
    *,
    doc: Document,
    scope_id: str,
    derivation_kind: str,
    params_hash: str = "",
    factory: Callable[[], T],
) -> T:
    """Top-level helper: route through the active request cache if
    present, otherwise run the factory directly."""

    cache = _EVIDENCE_REQUEST_CACHE.get()
    if cache is None:
        return factory()
    return cache.get_or_compute(
        doc_revision=doc.revision,
        scope_id=scope_id,
        derivation_kind=derivation_kind,
        params_hash=params_hash,
        factory=factory,
    )
