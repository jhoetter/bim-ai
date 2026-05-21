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
        first["nested"].append("caller mutation")
        second = compute_room_boundary_derivation(doc)

    assert calls == 1
    assert first["callCount"] == 1
    assert second == {"callCount": 1, "nested": []}


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
