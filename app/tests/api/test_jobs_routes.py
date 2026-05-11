"""JOB-V3-01 — REST endpoint tests for the jobs queue API."""

from __future__ import annotations

from datetime import UTC

import pytest
from fastapi import Depends, FastAPI, Query
from fastapi.testclient import TestClient

from bim_ai.jobs.queue import JobQueue
from bim_ai.jobs.types import CreateJobRequest, Job


def _build_test_app() -> FastAPI:
    """Stub app with an isolated JobQueue — no DB required."""
    from datetime import datetime

    from fastapi import HTTPException

    queue = JobQueue()

    def _get_q() -> JobQueue:
        return queue

    app = FastAPI()

    @app.post("/api/jobs", status_code=201)
    async def create_job(body: CreateJobRequest, q: JobQueue = Depends(_get_q)) -> dict:
        job = Job(
            model_id=body.model_id,
            kind=body.kind,
            inputs=body.inputs,
            created_at=datetime.now(UTC).isoformat(),
        )
        submitted = await q.submit(job)
        return submitted.model_dump(by_alias=True)

    @app.get("/api/jobs")
    async def list_jobs(
        model_id: str = Query(alias="modelId"), q: JobQueue = Depends(_get_q)
    ) -> list[dict]:
        return [j.model_dump(by_alias=True) for j in q.list_for_model(model_id)]

    @app.get("/api/jobs/{job_id}")
    async def get_job(job_id: str, q: JobQueue = Depends(_get_q)) -> dict:
        job = q.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="job not found")
        return job.model_dump(by_alias=True)

    @app.post("/api/jobs/{job_id}/cancel")
    async def cancel_job(job_id: str, q: JobQueue = Depends(_get_q)) -> dict:
        job = q.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="job not found")
        if job.status not in ("queued", "running"):
            raise HTTPException(status_code=409, detail="job cannot be cancelled")
        updated = await q.update_status(job_id, "cancelled")
        return updated.model_dump(by_alias=True)

    @app.post("/api/jobs/{job_id}/retry")
    async def retry_job(job_id: str, q: JobQueue = Depends(_get_q)) -> dict:
        job = q.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="job not found")
        retry = Job(
            model_id=job.model_id,
            kind=job.kind,
            inputs=job.inputs,
            parent_job_id=job.id,
            created_at=datetime.now(UTC).isoformat(),
        )
        submitted = await q.submit(retry)
        return submitted.model_dump(by_alias=True)

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


def _submit_body(model_id: str = "model-x", kind: str = "csg_solve") -> dict:
    return {"kind": kind, "modelId": model_id, "inputs": {}}


class TestCreateJob:
    def test_201_on_valid_submit(self, client: TestClient) -> None:
        res = client.post("/api/jobs", json=_submit_body())
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "queued"
        assert body["kind"] == "csg_solve"
        assert "id" in body
        assert "createdAt" in body

    def test_422_on_unknown_kind(self, client: TestClient) -> None:
        res = client.post("/api/jobs", json={"kind": "nope", "modelId": "m1"})
        assert res.status_code == 422

    def test_image_trace_job_kind_is_supported_for_trace_queue(self, client: TestClient) -> None:
        res = client.post("/api/jobs", json=_submit_body(kind="image_trace"))

        assert res.status_code == 201
        body = res.json()
        assert body["kind"] == "image_trace"
        assert body["status"] == "queued"


class TestListJobs:
    def test_list_returns_submitted_jobs(self, client: TestClient) -> None:
        client.post("/api/jobs", json=_submit_body(model_id="m-list"))
        client.post("/api/jobs", json=_submit_body(model_id="m-list", kind="ifc_export"))
        res = client.get("/api/jobs?modelId=m-list")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2

    def test_list_empty_for_unknown_model(self, client: TestClient) -> None:
        res = client.get("/api/jobs?modelId=no-such-model")
        assert res.status_code == 200
        assert res.json() == []


class TestGetJob:
    def test_get_existing_job(self, client: TestClient) -> None:
        created = client.post("/api/jobs", json=_submit_body()).json()
        res = client.get(f"/api/jobs/{created['id']}")
        assert res.status_code == 200
        assert res.json()["id"] == created["id"]

    def test_404_for_unknown_job(self, client: TestClient) -> None:
        res = client.get("/api/jobs/does-not-exist")
        assert res.status_code == 404


class TestCancelJob:
    def test_cancel_queued_job(self, client: TestClient) -> None:
        job = client.post("/api/jobs", json=_submit_body()).json()
        res = client.post(f"/api/jobs/{job['id']}/cancel")
        assert res.status_code == 200
        assert res.json()["status"] == "cancelled"

    def test_409_cancel_already_cancelled(self, client: TestClient) -> None:
        job = client.post("/api/jobs", json=_submit_body()).json()
        client.post(f"/api/jobs/{job['id']}/cancel")
        res = client.post(f"/api/jobs/{job['id']}/cancel")
        assert res.status_code == 409

    def test_404_cancel_unknown_job(self, client: TestClient) -> None:
        res = client.post("/api/jobs/nope/cancel")
        assert res.status_code == 404


class TestRetryJob:
    def test_retry_creates_new_job_with_parent_id(self, client: TestClient) -> None:
        parent = client.post("/api/jobs", json=_submit_body()).json()
        res = client.post(f"/api/jobs/{parent['id']}/retry")
        assert res.status_code == 200
        child = res.json()
        assert child["parentJobId"] == parent["id"]
        assert child["status"] == "queued"
        assert child["id"] != parent["id"]

    def test_404_retry_unknown_job(self, client: TestClient) -> None:
        res = client.post("/api/jobs/nope/retry")
        assert res.status_code == 404
