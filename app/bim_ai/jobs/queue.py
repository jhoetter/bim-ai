from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from .types import Job, JobOutputs, JobStatus


class JobQueue:
    """Single-process in-memory job queue for v3.0.

    Pluggable for Redis/Celery in v3.1 — callers interact via this interface only.
    # TODO(v3.1): persist to DB
    """

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._model_index: dict[str, list[str]] = defaultdict(list)
        self._subscribers: list[Callable[[Job], Awaitable[None]]] = []
        self._lock = asyncio.Lock()

    async def submit(self, job: Job) -> Job:
        async with self._lock:
            self._jobs[job.id] = job
            self._model_index[job.model_id].append(job.id)
        await self._notify(job)
        return job

    async def update_status(
        self,
        job_id: str,
        status: JobStatus,
        *,
        error_message: str | None = None,
        outputs: JobOutputs | None = None,
    ) -> Job:
        async with self._lock:
            job = self._jobs[job_id]
            now = datetime.now(UTC).isoformat()
            updates: dict = {"status": status}
            if status == "running":
                updates["started_at"] = now
            elif status in ("done", "errored", "cancelled"):
                updates["completed_at"] = now
            if error_message is not None:
                updates["error_message"] = error_message
            if outputs is not None:
                updates["outputs"] = outputs
            updated = job.model_copy(update=updates)
            self._jobs[job_id] = updated
        await self._notify(updated)
        return updated

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def list_for_model(self, model_id: str) -> list[Job]:
        ids = self._model_index.get(model_id, [])
        return [self._jobs[jid] for jid in ids if jid in self._jobs]

    def subscribe(self, callback: Callable[[Job], Awaitable[None]]) -> None:
        self._subscribers.append(callback)

    async def _notify(self, job: Job) -> None:
        for sub in self._subscribers:
            try:
                await sub(job)
            except Exception:
                pass  # best-effort


_queue: JobQueue | None = None


def get_queue() -> JobQueue:
    global _queue
    if _queue is None:
        _queue = JobQueue()
    return _queue
