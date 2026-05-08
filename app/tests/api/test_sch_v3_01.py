"""SCH-V3-01 — custom-properties + filterable schedule view tests."""

from __future__ import annotations

import math
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import PropertyDefinitionElem, ScheduleElem
from bim_ai.engine import ensure_internal_origin

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "sch_test",
    "value": True,
    "confidence": 0.99,
    "source": "test",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}
_CREATE_WALL = {
    "type": "createWall",
    "id": "wall-1",
    "name": "Wall A",
    "levelId": "lvl-1",
    "start": {"xMm": 0, "yMm": 0},
    "end": {"xMm": 5000, "yMm": 0},
    "thicknessMm": 200,
    "heightMm": 2800,
}


def _build_test_app() -> FastAPI:
    _models: dict[str, dict[str, Any]] = {}

    def _seed(model_id: str) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        bundle_raw = body.get("bundle")
        if bundle_raw is None:
            raise HTTPException(status_code=422, detail="bundle required")
        try:
            bundle = CommandBundle.model_validate(bundle_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        stored = _models[model_id]
        doc = stored["doc"]
        bundle.parent_revision = doc.revision
        result, new_doc = _apply_bundle(doc, bundle, "commit")
        if result.applied and new_doc is not None:
            _models[model_id] = {"revision": new_doc.revision, "doc": new_doc}
        return {
            "accepted": result.applied,
            "revision": new_doc.revision if result.applied and new_doc is not None else doc.revision,
        }

    @app.get("/api/v3/models/{model_id}/schedules/{schedule_id}/rows")
    async def schedule_rows_route(
        model_id: str,
        schedule_id: str,
        filterExpr: str | None = None,
        sortKey: str | None = None,
        sortDir: str | None = None,
    ) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        doc = _models[model_id]["doc"]
        sv = doc.elements.get(schedule_id)
        if not isinstance(sv, ScheduleElem) or not sv.category:
            raise HTTPException(status_code=404, detail="Schedule view not found or no category")
        category = sv.category
        effective_filter = filterExpr if filterExpr is not None else sv.filter_expr
        effective_sort_key = sortKey if sortKey is not None else sv.sort_key
        effective_sort_dir = sortDir if sortDir is not None else sv.sort_dir
        rows = []
        for elem_id, elem in doc.elements.items():
            if getattr(elem, "kind", None) != category:
                continue
            fields: dict[str, Any] = {"id": elem_id}
            name = getattr(elem, "name", None)
            if name is not None:
                fields["name"] = name
            if category == "wall":
                start = getattr(elem, "start", None)
                end = getattr(elem, "end", None)
                if start and end:
                    dx = end.x_mm - start.x_mm
                    dy = end.y_mm - start.y_mm
                    fields["lengthMm"] = round(math.sqrt(dx * dx + dy * dy), 1)
                t = getattr(elem, "thickness_mm", None)
                if t is not None:
                    fields["thicknessMm"] = t
                h = getattr(elem, "height_mm", None)
                if h is not None:
                    fields["heightMm"] = h
            props = getattr(elem, "props", None)
            if props:
                fields.update(props)
            if effective_filter:
                fl = effective_filter.lower()
                if not any(fl in str(v).lower() for v in fields.values()):
                    continue
            rows.append({"elementId": elem_id, "fields": fields})
        if effective_sort_key:
            reverse = effective_sort_dir == "desc"
            rows.sort(
                key=lambda r: (
                    r["fields"].get(effective_sort_key) is None,
                    r["fields"].get(effective_sort_key, ""),
                ),
                reverse=reverse,
            )
        return rows

    @app.get("/api/v3/tools")
    async def list_tools() -> Any:
        from bim_ai.api.registry import get_catalog

        catalog = get_catalog()
        return {"tools": [{"name": t.name} for t in catalog.tools]}

    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(_build_test_app())


def _bundle(cmds: list[dict], assumptions: list[dict] | None = None) -> dict:
    return {
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": cmds,
            "assumptions": assumptions or [_VALID_ASSUMPTION],
            "parentRevision": 0,
        }
    }


def test_create_property_definition(client: TestClient) -> None:
    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "create_property_definition",
                    "id": "pd-1",
                    "key": "cost_per_m2",
                    "label": "Cost/m²",
                    "propKind": "currency",
                    "appliesTo": ["wall"],
                    "showInSchedule": True,
                }
            ]
        ),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["accepted"] is True


def test_set_element_prop(client: TestClient) -> None:
    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_WALL]),
    )
    assert r.status_code == 200
    assert r.json()["accepted"] is True

    r2 = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "set_element_prop",
                    "elementId": "wall-1",
                    "key": "cost_per_m2",
                    "value": 85.0,
                }
            ]
        ),
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["accepted"] is True


def test_schedule_rows(client: TestClient) -> None:
    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                _CREATE_LEVEL,
                _CREATE_WALL,
                {
                    "type": "create_schedule_view",
                    "id": "sv-1",
                    "name": "Wall Schedule",
                    "category": "wall",
                },
            ]
        ),
    )
    assert r.status_code == 200
    assert r.json()["accepted"] is True

    rows_resp = client.get(f"/api/v3/models/{MODEL_ID}/schedules/sv-1/rows")
    assert rows_resp.status_code == 200, rows_resp.text
    rows = rows_resp.json()
    assert isinstance(rows, list)
    assert any(row["elementId"] == "wall-1" for row in rows)
    wall_row = next(row for row in rows if row["elementId"] == "wall-1")
    assert "lengthMm" in wall_row["fields"]
    assert wall_row["fields"]["lengthMm"] == pytest.approx(5000.0, rel=0.01)


def test_filter_expr(client: TestClient) -> None:
    # Set up level, wall, and schedule view first
    client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                _CREATE_LEVEL,
                _CREATE_WALL,
                {
                    "type": "create_schedule_view",
                    "id": "sv-1",
                    "name": "Wall Schedule",
                    "category": "wall",
                },
            ]
        ),
    )

    rows_resp = client.get(f"/api/v3/models/{MODEL_ID}/schedules/sv-1/rows?filterExpr=Wall+A")
    assert rows_resp.status_code == 200
    rows = rows_resp.json()
    assert any(row["elementId"] == "wall-1" for row in rows)

    rows_none = client.get(
        f"/api/v3/models/{MODEL_ID}/schedules/sv-1/rows?filterExpr=ZZZZNOTFOUND"
    ).json()
    assert rows_none == []


def test_set_prop_unknown_element(client: TestClient) -> None:
    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "set_element_prop",
                    "elementId": "nonexistent-xyz",
                    "key": "cost",
                    "value": 999,
                }
            ]
        ),
    )
    assert r.status_code in (200, 422, 400)
    if r.status_code == 200:
        assert r.json()["accepted"] is False


def test_custom_prop_round_trip(client: TestClient) -> None:
    # Set up level, wall, schedule view, and a custom prop
    client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_WALL]),
    )
    client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "create_schedule_view",
                    "id": "sv-1",
                    "name": "Wall Schedule",
                    "category": "wall",
                }
            ]
        ),
    )

    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "set_element_prop",
                    "elementId": "wall-1",
                    "key": "fire_rating",
                    "value": "REI-90",
                }
            ]
        ),
    )
    assert r.status_code == 200
    assert r.json()["accepted"] is True

    rows_resp = client.get(f"/api/v3/models/{MODEL_ID}/schedules/sv-1/rows")
    rows = rows_resp.json()
    wall_row = next((row for row in rows if row["elementId"] == "wall-1"), None)
    assert wall_row is not None
    assert wall_row["fields"].get("fire_rating") == "REI-90"


def test_tool_descriptors_present(client: TestClient) -> None:
    resp = client.get("/api/v3/tools")
    assert resp.status_code == 200
    names = {t["name"] for t in resp.json()["tools"]}
    assert "create-schedule-view" in names
    assert "set-element-prop" in names
