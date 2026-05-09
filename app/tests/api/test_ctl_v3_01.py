"""CTL-V3-01 — Catalog query API tests."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.catalog.query import _builtin_fixture, query_catalog

# ---------------------------------------------------------------------------
# Unit tests for query_catalog()
# ---------------------------------------------------------------------------

FIXTURE = _builtin_fixture()


def test_filter_by_kind_door() -> None:
    result = query_catalog(kind="door", catalog_store=FIXTURE)
    assert result["schemaVersion"] == "ctl-v3.0"
    kinds = {item["kind"] for item in result["items"]}
    assert kinds == {"door"}
    assert result["total"] == 2


def test_filter_by_kind_window() -> None:
    result = query_catalog(kind="window", catalog_store=FIXTURE)
    kinds = {item["kind"] for item in result["items"]}
    assert kinds == {"window"}
    assert result["total"] == 2


def test_filter_by_max_width() -> None:
    result = query_catalog(max_width_mm=900, catalog_store=FIXTURE)
    for item in result["items"]:
        assert item.get("widthMm", 0) <= 900


def test_filter_by_tag_exterior() -> None:
    result = query_catalog(tag="exterior", catalog_store=FIXTURE)
    for item in result["items"]:
        assert "exterior" in item.get("tags", [])
    assert result["total"] == 1
    assert result["items"][0]["id"] == "door-900"


def test_determinism() -> None:
    """Same call twice must produce identical output."""
    r1 = query_catalog(kind="door", catalog_store=FIXTURE)
    r2 = query_catalog(kind="door", catalog_store=FIXTURE)
    assert r1 == r2


def test_pagination() -> None:
    result = query_catalog(page=1, page_size=2, catalog_store=FIXTURE)
    assert result["page"] == 1
    assert result["pageSize"] == 2
    assert result["total"] == 5
    # Items are sorted by id; page 1 (0-indexed) = items 2 and 3
    assert len(result["items"]) == 2


def test_empty_query_returns_all() -> None:
    result = query_catalog(catalog_store=FIXTURE)
    assert result["total"] == 5
    assert len(result["items"]) == 5


def test_sort_by_id_deterministic() -> None:
    """Results must be sorted by id, not insertion order."""
    result = query_catalog(catalog_store=FIXTURE)
    ids = [item["id"] for item in result["items"]]
    assert ids == sorted(ids)


def test_filter_by_style() -> None:
    result = query_catalog(style="flush", catalog_store=FIXTURE)
    assert result["total"] == 1
    assert result["items"][0]["id"] == "door-800"


def test_filter_by_min_width() -> None:
    result = query_catalog(min_width_mm=1200, catalog_store=FIXTURE)
    for item in result["items"]:
        assert item.get("widthMm", float("inf")) >= 1200


# ---------------------------------------------------------------------------
# REST endpoint tests
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    app = FastAPI()

    @app.get("/api/v3/catalog")
    async def catalog_query_endpoint(
        kind: str | None = None,
        maxWidthMm: float | None = None,
        minWidthMm: float | None = None,
        tag: str | None = None,
        style: str | None = None,
        page: int = 0,
        pageSize: int = 50,
    ) -> Any:
        from bim_ai.catalog.query import query_catalog

        return query_catalog(
            kind=kind,
            max_width_mm=maxWidthMm,
            min_width_mm=minWidthMm,
            tag=tag,
            style=style,
            page=page,
            page_size=pageSize,
        )

    @app.get("/api/v3/tools")
    async def list_tools() -> Any:
        from bim_ai.api.registry import get_catalog

        catalog = get_catalog()
        return {"tools": [{"name": t.name} for t in catalog.tools]}

    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(_build_test_app())


def test_rest_catalog_query_window(client: TestClient) -> None:
    resp = client.get("/api/v3/catalog?kind=window")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["schemaVersion"] == "ctl-v3.0"
    assert isinstance(data["items"], list)
    assert all(item["kind"] == "window" for item in data["items"])
    assert data["total"] == 2


def test_rest_catalog_query_all(client: TestClient) -> None:
    resp = client.get("/api/v3/catalog")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 5
    assert "page" in data
    assert "pageSize" in data


def test_rest_catalog_max_width(client: TestClient) -> None:
    resp = client.get("/api/v3/catalog?maxWidthMm=800")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item.get("widthMm", 0) <= 800


def test_tool_descriptor_present(client: TestClient) -> None:
    resp = client.get("/api/v3/tools")
    assert resp.status_code == 200
    names = {t["name"] for t in resp.json()["tools"]}
    assert "catalog-query" in names
