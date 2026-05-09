"""VER-V3-02 — REST endpoint tests for milestone CRUD routes.

Uses a stub FastAPI app with an in-memory store (no live DB),
following the same pattern as test_apply_bundle_route.py.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.milestones import CreateMilestoneBody

MODEL_ID = str(uuid.uuid4())
UNKNOWN_MODEL_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Stub app
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    """Stub app with in-memory stores for models, milestones, and activity rows."""
    _models: set[str] = {MODEL_ID}
    _milestones: dict[str, dict[str, Any]] = {}
    _activity_rows: list[dict[str, Any]] = []

    app = FastAPI()

    @app.post("/api/models/{model_id}/milestones")
    async def create_milestone(model_id: str, body: CreateMilestoneBody) -> Any:
        from uuid import uuid4

        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        milestone_id = str(uuid4())
        now_ms = int(time.time() * 1000)
        record = {
            "id": milestone_id,
            "modelId": model_id,
            "name": body.name,
            "description": body.description,
            "snapshotId": body.snapshot_id,
            "authorId": body.author_id,
            "createdAt": now_ms,
        }
        _milestones[milestone_id] = record
        _activity_rows.append(
            {
                "kind": "milestone_created",
                "modelId": model_id,
                "payload": {"name": body.name, "milestoneId": milestone_id},
            }
        )
        return record

    @app.get("/api/models/{model_id}/milestones")
    async def list_milestones(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        rows = [m for m in _milestones.values() if m["modelId"] == model_id]
        rows.sort(key=lambda m: m["createdAt"], reverse=True)
        return {"modelId": model_id, "milestones": rows}

    @app.delete("/api/models/{model_id}/milestones/{milestone_id}")
    async def delete_milestone(model_id: str, milestone_id: str) -> Any:
        from fastapi import HTTPException

        record = _milestones.get(milestone_id)
        if record is None or record["modelId"] != model_id:
            raise HTTPException(status_code=404, detail="Milestone not found")
        del _milestones[milestone_id]
        return {"deleted": milestone_id}

    @app.get("/api/_activity_rows")
    async def get_activity_rows() -> Any:
        return {"rows": _activity_rows}

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


def _create_body(**overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = {
        "name": "Pre-client review v1",
        "snapshotId": "5",
        "authorId": "alice",
    }
    defaults.update(overrides)
    return defaults


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCreateMilestone:
    def test_creates_milestone_and_returns_it(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/milestones", json=_create_body())
        assert res.status_code == 200
        body = res.json()
        assert body["name"] == "Pre-client review v1"
        assert body["snapshotId"] == "5"
        assert body["authorId"] == "alice"
        assert body["modelId"] == MODEL_ID
        assert "id" in body
        assert "createdAt" in body

    def test_create_emits_activity_row(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/milestones", json=_create_body(name="Milestone A"))
        assert res.status_code == 200
        milestone_id = res.json()["id"]

        activity_res = client.get("/api/_activity_rows")
        rows = activity_res.json()["rows"]
        milestone_rows = [r for r in rows if r["kind"] == "milestone_created"]
        assert len(milestone_rows) >= 1
        latest = milestone_rows[-1]
        assert latest["payload"]["name"] == "Milestone A"
        assert latest["payload"]["milestoneId"] == milestone_id

    def test_create_unknown_model_returns_404(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{UNKNOWN_MODEL_ID}/milestones", json=_create_body())
        assert res.status_code == 404

    def test_create_with_optional_description(self, client: TestClient) -> None:
        res = client.post(
            f"/api/models/{MODEL_ID}/milestones",
            json=_create_body(description="After schematic design phase"),
        )
        assert res.status_code == 200
        assert res.json()["description"] == "After schematic design phase"


class TestListMilestones:
    def test_returns_milestones_descending_created_at(self, client: TestClient) -> None:
        client.post(f"/api/models/{MODEL_ID}/milestones", json=_create_body(name="First"))
        client.post(f"/api/models/{MODEL_ID}/milestones", json=_create_body(name="Second"))

        res = client.get(f"/api/models/{MODEL_ID}/milestones")
        assert res.status_code == 200
        milestones = res.json()["milestones"]
        assert len(milestones) >= 2
        timestamps = [m["createdAt"] for m in milestones]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_list_unknown_model_returns_404(self, client: TestClient) -> None:
        res = client.get(f"/api/models/{UNKNOWN_MODEL_ID}/milestones")
        assert res.status_code == 404


class TestDeleteMilestone:
    def test_delete_removes_milestone(self, client: TestClient) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/milestones", json=_create_body())
        milestone_id = create_res.json()["id"]

        del_res = client.delete(f"/api/models/{MODEL_ID}/milestones/{milestone_id}")
        assert del_res.status_code == 200
        assert del_res.json()["deleted"] == milestone_id

        list_res = client.get(f"/api/models/{MODEL_ID}/milestones")
        ids = [m["id"] for m in list_res.json()["milestones"]]
        assert milestone_id not in ids

    def test_delete_unknown_id_returns_404(self, client: TestClient) -> None:
        res = client.delete(f"/api/models/{MODEL_ID}/milestones/nonexistent-id")
        assert res.status_code == 404


class TestRoundTrip:
    def test_create_list_delete_list_empty(self, client: TestClient) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/milestones", json=_create_body())
        milestone_id = create_res.json()["id"]

        list_res = client.get(f"/api/models/{MODEL_ID}/milestones")
        ids = [m["id"] for m in list_res.json()["milestones"]]
        assert milestone_id in ids

        client.delete(f"/api/models/{MODEL_ID}/milestones/{milestone_id}")

        list_res2 = client.get(f"/api/models/{MODEL_ID}/milestones")
        ids2 = [m["id"] for m in list_res2.json()["milestones"]]
        assert milestone_id not in ids2
