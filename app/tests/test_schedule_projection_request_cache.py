from __future__ import annotations

from typing import Any

from bim_ai import plan_projection_wire, schedule_derivation
from bim_ai.document import Document
from bim_ai.plan_projection_wire import (
    plan_projection_wire_request_cache,
    resolve_plan_projection_wire,
)
from bim_ai.schedule_derivation import (
    derive_schedule_table,
    schedule_table_derivation_request_cache,
)


def test_schedule_table_request_cache_reuses_document_schedule_result(monkeypatch) -> None:
    calls = 0
    doc = Document(revision=1, elements={})

    def fake_uncached(
        _doc: Document,
        schedule_id: str,
        *,
        room_boundary_derivation: dict[str, Any] | None = None,
        lightweight: bool = False,
    ) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {
            "callCount": calls,
            "scheduleId": schedule_id,
            "hasRoomBoundary": room_boundary_derivation is not None,
            "rows": [],
        }

    monkeypatch.setattr(schedule_derivation, "_derive_schedule_table_uncached", fake_uncached)

    with schedule_table_derivation_request_cache():
        first = derive_schedule_table(doc, "sch-rooms")
        second = derive_schedule_table(doc, "sch-rooms")

    # The table is cached by reference for performance. Callers must treat it
    # as read-only — the cache no longer deepcopies on hit (cross-request
    # `_SCHEDULE_TABLE_CACHE` in routes/api.py still deepcopies on store).
    assert calls == 1
    assert first is second
    assert first["callCount"] == 1


def test_schedule_table_request_cache_hits_across_document_wraps(monkeypatch) -> None:
    """Pydantic rebuilds the elements dict during Document validation, so
    `id(doc.elements)` is unstable. The cache key fingerprints the elements
    contents instead so throwaway Document wraps share results — extends the
    2026-05-23 PERF-C04 fix (audit finding #2) to schedule derivation."""
    calls = 0

    def fake_uncached(
        _doc: Document,
        _schedule_id: str,
        *,
        room_boundary_derivation: dict[str, Any] | None = None,
        lightweight: bool = False,
    ) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"callCount": calls}

    monkeypatch.setattr(schedule_derivation, "_derive_schedule_table_uncached", fake_uncached)

    shared_elements: dict[str, Any] = {}
    with schedule_table_derivation_request_cache():
        doc_a = Document(revision=1, elements=shared_elements)
        doc_b = Document(revision=1, elements=shared_elements)
        assert doc_a.elements is not doc_b.elements  # pydantic builds new dicts
        a = derive_schedule_table(doc_a, "sch-rooms")
        b = derive_schedule_table(doc_b, "sch-rooms")

    assert calls == 1
    assert a is b


def test_schedule_table_request_cache_keys_room_boundary_bundle(monkeypatch) -> None:
    calls = 0
    doc = Document(revision=1, elements={})
    first_boundary: dict[str, Any] = {"rooms": []}
    second_boundary: dict[str, Any] = {"rooms": []}

    def fake_uncached(
        _doc: Document,
        _schedule_id: str,
        *,
        room_boundary_derivation: dict[str, Any] | None = None,
        lightweight: bool = False,
    ) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"callCount": calls, "boundaryObjectId": id(room_boundary_derivation)}

    monkeypatch.setattr(schedule_derivation, "_derive_schedule_table_uncached", fake_uncached)

    with schedule_table_derivation_request_cache():
        assert (
            derive_schedule_table(
                doc,
                "sch-rooms",
                room_boundary_derivation=first_boundary,
            )["callCount"]
            == 1
        )
        assert (
            derive_schedule_table(
                doc,
                "sch-rooms",
                room_boundary_derivation=first_boundary,
            )["callCount"]
            == 1
        )
        assert (
            derive_schedule_table(
                doc,
                "sch-rooms",
                room_boundary_derivation=second_boundary,
            )["callCount"]
            == 2
        )

    assert calls == 2


def test_plan_projection_wire_request_cache_reuses_projection_result(monkeypatch) -> None:
    calls = 0
    doc = Document(revision=1, elements={})

    def fake_uncached(
        _doc: Document,
        *,
        plan_view_id: str | None,
        fallback_level_id: str | None,
        global_plan_presentation: str = "default",
        sheet_viewport_row_for_crop: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {
            "callCount": calls,
            "planViewId": plan_view_id,
            "fallbackLevelId": fallback_level_id,
            "presentation": global_plan_presentation,
            "crop": sheet_viewport_row_for_crop,
            "items": [],
        }

    monkeypatch.setattr(
        plan_projection_wire,
        "_resolve_plan_projection_wire_uncached",
        fake_uncached,
    )

    with plan_projection_wire_request_cache():
        first = resolve_plan_projection_wire(
            doc,
            plan_view_id="pv-1",
            fallback_level_id="lv-1",
            sheet_viewport_row_for_crop={"b": 2, "a": 1},
        )
        second = resolve_plan_projection_wire(
            doc,
            plan_view_id="pv-1",
            fallback_level_id="lv-1",
            sheet_viewport_row_for_crop={"a": 1, "b": 2},
        )

    # The wire is cached by reference for performance. Callers must treat it
    # as read-only — the cache no longer deepcopies on hit (cross-request
    # `_PLAN_PROJECTION_CACHE` in routes/api.py still deepcopies on store).
    # The order-insensitive crop key still collapses logically-equivalent crops.
    assert calls == 1
    assert first is second
    assert first["callCount"] == 1


def test_plan_projection_wire_request_cache_hits_across_document_wraps(monkeypatch) -> None:
    """Pydantic rebuilds the elements dict during Document validation, so
    `id(doc.elements)` is unstable. The cache key fingerprints the elements
    contents instead so throwaway Document wraps share results — extends the
    2026-05-23 PERF-C04 fix (audit finding #2) to plan projection."""
    calls = 0

    def fake_uncached(
        _doc: Document,
        *,
        plan_view_id: str | None,
        fallback_level_id: str | None,
        global_plan_presentation: str = "default",
        sheet_viewport_row_for_crop: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"callCount": calls}

    monkeypatch.setattr(
        plan_projection_wire,
        "_resolve_plan_projection_wire_uncached",
        fake_uncached,
    )

    shared_elements: dict[str, Any] = {}
    with plan_projection_wire_request_cache():
        doc_a = Document(revision=1, elements=shared_elements)
        doc_b = Document(revision=1, elements=shared_elements)
        assert doc_a.elements is not doc_b.elements  # pydantic builds new dicts
        a = resolve_plan_projection_wire(doc_a, plan_view_id="pv", fallback_level_id="lv")
        b = resolve_plan_projection_wire(doc_b, plan_view_id="pv", fallback_level_id="lv")

    assert calls == 1
    assert a is b


def test_plan_projection_wire_request_cache_is_scoped(monkeypatch) -> None:
    calls = 0
    doc = Document(revision=1, elements={})

    def fake_uncached(
        _doc: Document,
        *,
        plan_view_id: str | None,
        fallback_level_id: str | None,
        global_plan_presentation: str = "default",
        sheet_viewport_row_for_crop: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"callCount": calls}

    monkeypatch.setattr(
        plan_projection_wire,
        "_resolve_plan_projection_wire_uncached",
        fake_uncached,
    )

    with plan_projection_wire_request_cache():
        assert (
            resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")[
                "callCount"
            ]
            == 1
        )
    with plan_projection_wire_request_cache():
        assert (
            resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")[
                "callCount"
            ]
            == 2
        )

    assert calls == 2
