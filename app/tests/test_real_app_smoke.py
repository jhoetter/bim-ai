from __future__ import annotations

from fastapi.testclient import TestClient

from bim_ai.main import app


def test_real_app_health_schema_and_catalog_routes_are_registered() -> None:
    client = TestClient(app)

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "service": "bim-ai"}

    schema = client.get("/api/schema")
    assert schema.status_code == 200
    schema_body = schema.json()
    assert schema_body["version"]
    assert "commandsUnionSchema" in schema_body
    assert "elementUnionSchema" in schema_body
    assert "perspectiveIds" in schema_body

    templates = client.get("/api/templates")
    assert templates.status_code == 200
    template_ids = {row["id"] for row in templates.json()["templates"]}
    assert "residential-eu" in template_ids
    assert template_ids

    catalogs = client.get("/api/family-catalogs")
    assert catalogs.status_code == 200
    catalog_ids = {row["catalogId"] for row in catalogs.json()["catalogs"]}
    assert {"kitchen-fixtures", "bathroom-fixtures", "living-room-furniture"} <= catalog_ids

    tools = client.get("/api/v3/tools")
    assert tools.status_code == 200
    tool_names = {row["name"] for row in tools.json()["tools"]}
    assert {"api-list-tools", "apply-bundle", "model-show"} <= tool_names


def test_real_app_returns_404_for_unknown_family_catalog() -> None:
    client = TestClient(app)

    response = client.get("/api/family-catalogs/not-a-real-catalog")

    assert response.status_code == 404
    assert response.json()["detail"] == "Catalog not found"
