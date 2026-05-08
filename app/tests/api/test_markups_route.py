"""MRK-V3-02 — REST tests for markup CRUD routes and _rdp_simplify."""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict, Field

MODEL_ID = str(uuid.uuid4())

_ELEMENT_ANCHOR: dict[str, Any] = {"kind": "element", "elementId": "wall-001"}
_WORLD_ANCHOR: dict[str, Any] = {
    "kind": "world",
    "worldMm": {"xMm": 100.0, "yMm": 200.0, "zMm": 0.0},
}

_FREEHAND_SHAPE: dict[str, Any] = {
    "kind": "freehand",
    "pathPx": [{"xPx": float(x), "yPx": float(x % 3)} for x in range(20)],
    "color": "var(--cat-edit)",
    "strokeWidthPx": 2.0,
}
_ARROW_SHAPE: dict[str, Any] = {
    "kind": "arrow",
    "fromMm": {"xMm": 0.0, "yMm": 0.0},
    "toMm": {"xMm": 500.0, "yMm": 500.0},
    "color": "var(--cat-edit)",
}
_CLOUD_SHAPE: dict[str, Any] = {
    "kind": "cloud",
    "pointsMm": [
        {"xMm": 0.0, "yMm": 0.0},
        {"xMm": 500.0, "yMm": 0.0},
        {"xMm": 500.0, "yMm": 500.0},
        {"xMm": 0.0, "yMm": 500.0},
    ],
}
_TEXT_SHAPE: dict[str, Any] = {
    "kind": "text",
    "bodyMd": "Check this area",
    "positionMm": {"xMm": 100.0, "yMm": 200.0},
}


# ---------------------------------------------------------------------------
# Stub request body — defined at module level so FastAPI resolves the type
# correctly even under `from __future__ import annotations`.
# ---------------------------------------------------------------------------


class _MarkupCreateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    view_id: str | None = Field(default=None, alias="viewId")
    anchor: dict
    shape: dict
    author_id: str = Field(alias="authorId")


# ---------------------------------------------------------------------------
# Stub app
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    from bim_ai.markups import Markup, Vec2Px, _rdp_simplify, sanitize_color

    _store: dict[str, list[dict]] = {}

    def _markups(model_id: str) -> list[dict]:
        return _store.setdefault(model_id, [])

    app = FastAPI()

    @app.post("/models/{model_id}/markups")
    async def create_markup(model_id: str, body: _MarkupCreateBody) -> Any:
        mid = str(uuid.uuid4())
        shape = dict(body.shape)
        if shape.get("kind") == "freehand":
            path = shape.get("pathPx", [])
            simplified = _rdp_simplify([Vec2Px.model_validate(p) for p in path])
            shape["pathPx"] = [p.model_dump(by_alias=True) for p in simplified]
            shape["color"] = sanitize_color(shape.get("color", "var(--cat-edit)"))
        elif shape.get("kind") == "arrow":
            shape["color"] = sanitize_color(shape.get("color", "var(--cat-edit)"))

        raw: dict[str, Any] = {
            "id": mid,
            "modelId": model_id,
            "viewId": body.view_id,
            "anchor": body.anchor,
            "shape": shape,
            "authorId": body.author_id,
            "createdAt": int(time.time() * 1000),
            "resolvedAt": None,
        }
        markup = Markup.model_validate(raw)
        _markups(model_id).append(markup.model_dump(by_alias=True))
        return markup.model_dump(by_alias=True)

    @app.get("/models/{model_id}/markups")
    async def list_markups(
        model_id: str,
        viewId: str | None = None,
        resolved: str | None = None,
    ) -> Any:
        markups = list(_markups(model_id))
        if viewId is not None:
            markups = [m for m in markups if m.get("viewId") == viewId]
        if resolved is not None and resolved.lower() == "false":
            markups = [m for m in markups if m.get("resolvedAt") is None]
        return {"markups": markups}

    @app.patch("/models/{model_id}/markups/{markup_id}/resolve")
    async def resolve_markup(model_id: str, markup_id: str) -> Any:
        markups = _markups(model_id)
        for i, m in enumerate(markups):
            if m.get("id") == markup_id:
                m = dict(m)
                m["resolvedAt"] = int(time.time() * 1000)
                markups[i] = m
                return m
        raise HTTPException(status_code=404, detail="Markup not found")

    @app.delete("/models/{model_id}/markups/{markup_id}")
    async def delete_markup(model_id: str, markup_id: str) -> Any:
        markups = _markups(model_id)
        for i, m in enumerate(markups):
            if m.get("id") == markup_id:
                markups.pop(i)
                return {"deleted": True, "id": markup_id}
        raise HTTPException(status_code=404, detail="Markup not found")

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCreateMarkup:
    def test_freehand_shape_creates_markup(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-1", "anchor": _ELEMENT_ANCHOR, "shape": _FREEHAND_SHAPE},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["shape"]["kind"] == "freehand"
        assert body["authorId"] == "user-1"
        assert body["resolvedAt"] is None

    def test_arrow_shape_creates_markup(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-2", "anchor": _WORLD_ANCHOR, "shape": _ARROW_SHAPE},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["shape"]["kind"] == "arrow"
        assert body["anchor"]["kind"] == "world"

    def test_freehand_path_simplified(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-1", "anchor": _ELEMENT_ANCHOR, "shape": _FREEHAND_SHAPE},
        )
        assert res.status_code == 200
        path = res.json()["shape"]["pathPx"]
        assert len(path) < 20

    def test_cloud_shape_creates_markup(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-3", "anchor": _ELEMENT_ANCHOR, "shape": _CLOUD_SHAPE},
        )
        assert res.status_code == 200
        assert res.json()["shape"]["kind"] == "cloud"

    def test_text_shape_creates_markup(self, client: TestClient) -> None:
        res = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-4", "anchor": _ELEMENT_ANCHOR, "shape": _TEXT_SHAPE},
        )
        assert res.status_code == 200
        assert res.json()["shape"]["kind"] == "text"


class TestListMarkups:
    def test_get_returns_all_markups(self, client: TestClient) -> None:
        for shape in (_FREEHAND_SHAPE, _ARROW_SHAPE):
            client.post(
                f"/models/{MODEL_ID}/markups",
                json={"authorId": "user-1", "anchor": _ELEMENT_ANCHOR, "shape": shape},
            )
        res = client.get(f"/models/{MODEL_ID}/markups")
        assert res.status_code == 200
        assert len(res.json()["markups"]) >= 2

    def test_resolved_false_excludes_resolved(self, client: TestClient) -> None:
        m = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-1", "anchor": _ELEMENT_ANCHOR, "shape": _ARROW_SHAPE},
        ).json()
        client.patch(f"/models/{MODEL_ID}/markups/{m['id']}/resolve")

        res = client.get(f"/models/{MODEL_ID}/markups", params={"resolved": "false"})
        assert res.status_code == 200
        ids = [x["id"] for x in res.json()["markups"]]
        assert m["id"] not in ids


class TestResolveMarkup:
    def test_resolve_sets_resolved_at(self, client: TestClient) -> None:
        m = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-1", "anchor": _ELEMENT_ANCHOR, "shape": _ARROW_SHAPE},
        ).json()
        res = client.patch(f"/models/{MODEL_ID}/markups/{m['id']}/resolve")
        assert res.status_code == 200
        assert res.json()["resolvedAt"] is not None

    def test_resolve_404_unknown(self, client: TestClient) -> None:
        res = client.patch(f"/models/{MODEL_ID}/markups/nonexistent/resolve")
        assert res.status_code == 404


class TestDeleteMarkup:
    def test_delete_removes_markup(self, client: TestClient) -> None:
        m = client.post(
            f"/models/{MODEL_ID}/markups",
            json={"authorId": "user-1", "anchor": _ELEMENT_ANCHOR, "shape": _TEXT_SHAPE},
        ).json()
        res = client.delete(f"/models/{MODEL_ID}/markups/{m['id']}")
        assert res.status_code == 200
        assert res.json()["deleted"] is True

        list_res = client.get(f"/models/{MODEL_ID}/markups")
        ids = [x["id"] for x in list_res.json()["markups"]]
        assert m["id"] not in ids

    def test_delete_404_unknown(self, client: TestClient) -> None:
        res = client.delete(f"/models/{MODEL_ID}/markups/nonexistent")
        assert res.status_code == 404


class TestRdpSimplify:
    def test_reduces_20_point_zigzag(self) -> None:
        from bim_ai.markups import Vec2Px, _rdp_simplify

        pts = [Vec2Px.model_validate({"xPx": float(i), "yPx": 0.0 if i % 2 == 0 else 10.0}) for i in range(20)]
        simplified = _rdp_simplify(pts, epsilon=2.0)
        assert len(simplified) < 20

    def test_preserves_two_point_path(self) -> None:
        from bim_ai.markups import Vec2Px, _rdp_simplify

        pts = [
            Vec2Px.model_validate({"xPx": 0.0, "yPx": 0.0}),
            Vec2Px.model_validate({"xPx": 100.0, "yPx": 100.0}),
        ]
        result = _rdp_simplify(pts, epsilon=2.0)
        assert len(result) == 2
        assert result[0].x_px == 0.0
        assert result[1].x_px == 100.0
