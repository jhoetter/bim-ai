from __future__ import annotations

from typing import Any

from bim_ai import room_derivation
from bim_ai.document import Document
from bim_ai.room_derivation import (
    compute_room_boundary_derivation,
    room_boundary_derivation_request_cache,
)


def test_room_boundary_derivation_request_cache_reuses_document_result(monkeypatch) -> None:
    calls = 0
    doc = Document(revision=1, elements={})

    def fake_uncached(_doc: Document) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"callCount": calls, "nested": []}

    monkeypatch.setattr(room_derivation, "_compute_room_boundary_derivation_uncached", fake_uncached)

    with room_boundary_derivation_request_cache():
        first = compute_room_boundary_derivation(doc)
        second = compute_room_boundary_derivation(doc)

    # The bundle is cached by reference for performance. Callers must treat
    # it as read-only — the cache no longer deepcopies on hit (was a measured
    # share of the per-call cost on the room_stress fixture).
    assert calls == 1
    assert first is second
    assert first["callCount"] == 1


def test_room_boundary_derivation_request_cache_hits_across_document_wraps(monkeypatch) -> None:
    """Pydantic re-builds the elements dict during Document validation, so
    `id(doc.elements)` is unstable. The cache key fingerprints the elements
    contents instead so throwaway Document wraps share results — fixes the
    2026-05-22 audit finding where evaluate() defeated the C04 cache."""
    calls = 0

    def fake_uncached(_doc: Document) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"callCount": calls}

    monkeypatch.setattr(room_derivation, "_compute_room_boundary_derivation_uncached", fake_uncached)

    shared_elements: dict[str, Any] = {}
    with room_boundary_derivation_request_cache():
        doc_a = Document(revision=1, elements=shared_elements)
        doc_b = Document(revision=1, elements=shared_elements)
        assert doc_a.elements is not doc_b.elements  # pydantic builds new dicts
        a = compute_room_boundary_derivation(doc_a)
        b = compute_room_boundary_derivation(doc_b)

    assert calls == 1
    assert a is b


def test_room_boundary_derivation_request_cache_is_scoped(monkeypatch) -> None:
    calls = 0
    doc = Document(revision=1, elements={})

    def fake_uncached(_doc: Document) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"callCount": calls}

    monkeypatch.setattr(room_derivation, "_compute_room_boundary_derivation_uncached", fake_uncached)

    with room_boundary_derivation_request_cache():
        assert compute_room_boundary_derivation(doc)["callCount"] == 1
    with room_boundary_derivation_request_cache():
        assert compute_room_boundary_derivation(doc)["callCount"] == 2

    assert calls == 2
