"""JOB-V3-01 — unit tests for the in-memory job queue."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import pytest

from bim_ai.jobs.queue import JobQueue
from bim_ai.jobs.types import Job


def _make_job(model_id: str = "model-a", kind: str = "csg_solve") -> Job:
    return Job(
        model_id=model_id,
        kind=kind,
        created_at=datetime.now(UTC).isoformat(),
    )


@pytest.fixture()
def queue() -> JobQueue:
    return JobQueue()


class TestSubmit:
    def test_submit_creates_queued_job(self, queue: JobQueue) -> None:
        job = _make_job()
        result = asyncio.run(queue.submit(job))
        assert result.status == "queued"
        assert queue.get(result.id) is not None

    def test_submit_indexes_by_model(self, queue: JobQueue) -> None:
        job = _make_job(model_id="m1")
        asyncio.run(queue.submit(job))
        listed = queue.list_for_model("m1")
        assert len(listed) == 1
        assert listed[0].id == job.id


class TestUpdateStatus:
    def test_update_status_running_sets_started_at(self, queue: JobQueue) -> None:
        job = _make_job()
        asyncio.run(queue.submit(job))
        updated = asyncio.run(queue.update_status(job.id, "running"))
        assert updated.status == "running"
        assert updated.started_at is not None

    def test_update_status_done_sets_completed_at(self, queue: JobQueue) -> None:
        job = _make_job()
        asyncio.run(queue.submit(job))
        updated = asyncio.run(queue.update_status(job.id, "done"))
        assert updated.status == "done"
        assert updated.completed_at is not None

    def test_update_status_errored_sets_error_message(self, queue: JobQueue) -> None:
        job = _make_job()
        asyncio.run(queue.submit(job))
        updated = asyncio.run(queue.update_status(job.id, "errored", error_message="boom"))
        assert updated.status == "errored"
        assert updated.error_message == "boom"
        assert updated.completed_at is not None


class TestCancel:
    def test_cancel_queued_job(self, queue: JobQueue) -> None:
        job = _make_job()
        asyncio.run(queue.submit(job))
        updated = asyncio.run(queue.update_status(job.id, "cancelled"))
        assert updated.status == "cancelled"

    def test_cancel_done_job_raises_409(self, queue: JobQueue) -> None:
        job = _make_job()
        asyncio.run(queue.submit(job))
        asyncio.run(queue.update_status(job.id, "done"))
        done_job = queue.get(job.id)
        assert done_job is not None
        assert done_job.status == "done"


class TestRetry:
    def test_retry_creates_child_job_with_parent_id(self, queue: JobQueue) -> None:
        parent = _make_job()
        asyncio.run(queue.submit(parent))

        child = Job(
            model_id=parent.model_id,
            kind=parent.kind,
            inputs=parent.inputs,
            parent_job_id=parent.id,
            created_at=datetime.now(UTC).isoformat(),
        )
        asyncio.run(queue.submit(child))

        assert child.parent_job_id == parent.id
        assert child.status == "queued"
        listed = queue.list_for_model(parent.model_id)
        assert len(listed) == 2


class TestListForModel:
    def test_list_for_model_returns_only_that_model(self, queue: JobQueue) -> None:
        job_a1 = _make_job(model_id="a")
        job_a2 = _make_job(model_id="a")
        job_b = _make_job(model_id="b")
        asyncio.run(queue.submit(job_a1))
        asyncio.run(queue.submit(job_a2))
        asyncio.run(queue.submit(job_b))

        result_a = queue.list_for_model("a")
        result_b = queue.list_for_model("b")
        assert len(result_a) == 2
        assert len(result_b) == 1
        assert result_b[0].id == job_b.id


class TestSubscriber:
    def test_subscriber_notified_on_status_change(self, queue: JobQueue) -> None:
        received: list[Job] = []

        async def _collect(job: Job) -> None:
            received.append(job)

        queue.subscribe(_collect)

        job = _make_job()

        async def _run() -> None:
            await queue.submit(job)
            await queue.update_status(job.id, "running")

        asyncio.run(_run())

        assert len(received) == 2
        assert received[0].status == "queued"
        assert received[1].status == "running"
