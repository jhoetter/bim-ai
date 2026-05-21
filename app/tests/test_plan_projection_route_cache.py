from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from bim_ai import routes_api


async def test_projection_plan_route_reuses_revision_cache(monkeypatch: Any) -> None:
    model_id = uuid4()
    row = SimpleNamespace(revision=3, document={"revision": 3, "elements": {}})
    calls = 0

    async def fake_load_model_row(session: object, row_model_id: object) -> object:
        assert row_model_id == model_id
        return row

    def fake_projection(*args: object, **kwargs: object) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"format": "projection", "calls": calls, "nested": {"value": 1}}

    routes_api._PLAN_PROJECTION_CACHE.clear()
    monkeypatch.setattr(routes_api, "load_model_row", fake_load_model_row)
    monkeypatch.setattr(routes_api, "plan_projection_wire_from_request", fake_projection)

    first = await routes_api.projection_plan_wire_route(
        model_id,
        session=object(),
        plan_view_id="pv",
        fallback_level_id=None,
        global_plan_presentation="default",
    )
    first["nested"]["value"] = 99
    second = await routes_api.projection_plan_wire_route(
        model_id,
        session=object(),
        plan_view_id="pv",
        fallback_level_id=None,
        global_plan_presentation="default",
    )

    assert calls == 1
    assert second == {"format": "projection", "calls": 1, "nested": {"value": 1}}


async def test_projection_plan_route_cache_is_revision_scoped(monkeypatch: Any) -> None:
    model_id = uuid4()
    rows = [
        SimpleNamespace(revision=3, document={"revision": 3, "elements": {}}),
        SimpleNamespace(revision=4, document={"revision": 4, "elements": {}}),
    ]
    calls = 0

    async def fake_load_model_row(session: object, row_model_id: object) -> object:
        assert row_model_id == model_id
        return rows.pop(0)

    def fake_projection(*args: object, **kwargs: object) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"format": "projection", "calls": calls}

    routes_api._PLAN_PROJECTION_CACHE.clear()
    monkeypatch.setattr(routes_api, "load_model_row", fake_load_model_row)
    monkeypatch.setattr(routes_api, "plan_projection_wire_from_request", fake_projection)

    await routes_api.projection_plan_wire_route(model_id, session=object())
    second = await routes_api.projection_plan_wire_route(model_id, session=object())

    assert calls == 2
    assert second == {"format": "projection", "calls": 2}
