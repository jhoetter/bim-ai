"""FAM-08 — GET /api/family-catalogs[/:id] endpoint shape.

Mounts the catalog routes onto a thin FastAPI app (so we don't have to
spin up the full DB lifespan) and asserts the server returns the
expected index + payload shapes.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.family_catalog_format import load_catalog_index
from bim_ai.routes_api import get_family_catalog, list_family_catalogs


def _build_test_app() -> FastAPI:
    app = FastAPI()
    app.add_api_route("/api/family-catalogs", list_family_catalogs, methods=["GET"])
    app.add_api_route(
        "/api/family-catalogs/{catalog_id}", get_family_catalog, methods=["GET"]
    )
    return app


def test_index_endpoint_returns_all_bundled_catalogs() -> None:
    client = TestClient(_build_test_app())
    res = client.get("/api/family-catalogs")
    assert res.status_code == 200
    body = res.json()
    assert "catalogs" in body
    by_id = {c["catalogId"]: c for c in body["catalogs"]}
    expected = {entry.catalog_id for entry in load_catalog_index()}
    assert set(by_id) == expected
    sample = by_id["living-room-furniture"]
    assert sample["familyCount"] >= 4
    assert sample["name"]
    assert sample["version"]
    assert "description" in sample


def test_get_catalog_endpoint_returns_full_payload() -> None:
    client = TestClient(_build_test_app())
    res = client.get("/api/family-catalogs/living-room-furniture")
    assert res.status_code == 200
    body = res.json()
    assert body["catalogId"] == "living-room-furniture"
    assert isinstance(body["families"], list)
    fam_ids = {f["id"] for f in body["families"]}
    assert "catalog:living-room:sofa-3-seat" in fam_ids
    sofa = next(f for f in body["families"] if f["id"] == "catalog:living-room:sofa-3-seat")
    assert sofa["discipline"] == "generic"
    assert sofa["defaultTypes"], "sofa family must ship at least one defaultType"
    dt = sofa["defaultTypes"][0]
    assert dt["familyId"] == sofa["id"]
    assert "parameters" in dt


def test_get_catalog_endpoint_returns_404_for_unknown() -> None:
    client = TestClient(_build_test_app())
    res = client.get("/api/family-catalogs/no-such-catalog")
    assert res.status_code == 404


def test_get_catalog_payload_uses_camelcase_aliases() -> None:
    client = TestClient(_build_test_app())
    res = client.get("/api/family-catalogs/bathroom-fixtures")
    assert res.status_code == 200
    body = res.json()
    assert "catalogId" in body and "thumbnailsBaseUrl" in body
    if body["families"]:
        fam = body["families"][0]
        if fam["defaultTypes"]:
            dt = fam["defaultTypes"][0]
            assert "familyId" in dt
            assert "discipline" in dt
