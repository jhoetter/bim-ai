"""UX-STAT-019 — real api_router coverage for jobs endpoints."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.jobs.queue import get_queue
from bim_ai.routes_api import api_router


@pytest.fixture()
def client() -> TestClient:
    queue = get_queue()
    queue._jobs.clear()  # type: ignore[attr-defined]
    queue._model_index = defaultdict(list)  # type: ignore[attr-defined]
    app = FastAPI()
    app.include_router(api_router)
    return TestClient(app)


def _submit_body(model_id: str = "m-router", kind: str = "ifc_export") -> dict[str, Any]:
    return {"kind": kind, "modelId": model_id, "inputs": {"seeded": True}}


def test_jobs_list_route_is_mounted_and_returns_empty_list(client: TestClient) -> None:
    res = client.get("/api/jobs?modelId=no-jobs")
    assert res.status_code == 200
    assert res.json() == []


def test_jobs_create_get_cancel_retry_roundtrip(client: TestClient) -> None:
    created = client.post("/api/jobs", json=_submit_body(model_id="m-roundtrip")).json()
    assert created["status"] == "queued"
    assert created["modelId"] == "m-roundtrip"
    assert datetime.fromisoformat(created["createdAt"]).tzinfo == UTC

    fetched = client.get(f"/api/jobs/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created["id"]

    listed = client.get("/api/jobs?modelId=m-roundtrip")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    cancelled = client.post(f"/api/jobs/{created['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    retry = client.post(f"/api/jobs/{created['id']}/retry")
    assert retry.status_code == 200
    child = retry.json()
    assert child["id"] != created["id"]
    assert child["parentJobId"] == created["id"]
    assert child["status"] == "queued"
