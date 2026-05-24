"""Async/job-backed evidence-package worker (PERF-D07).

The existing ``JobQueue`` (see :mod:`bim_ai.jobs.queue`) is a metadata-only
registry in v3.0 — no real worker process consumes it. This module wires
``"evidence_package"`` jobs through an in-process ``asyncio.create_task``
that:

1. Submits a ``Job`` to the queue with ``kind="evidence_package"``.
2. Runs the CPU-bound :func:`build_evidence_package_payload` in a threadpool
   (so the FastAPI event loop stays responsive for other requests).
3. Stores the resulting payload in a bounded LRU keyed by job id, alongside
   the document's semantic digest so stale results can be detected.
4. Flips the job status ``queued → running → done`` (or ``errored``).

The wire shape mirrors the issue: the existing sync endpoint stays the
default, ``?async=true`` returns ``{ "jobId": "...", ... }``, and clients
poll ``GET /api/jobs/{job_id}`` for status then ``GET /api/jobs/{job_id}/result``
for the payload.

Single-process by design — matches ``JobQueue``'s
``# TODO(v3.1): persist to DB`` posture. Swapping in a real worker
(celery/rq/arq + redis) later does not require route changes.
"""

from __future__ import annotations

import asyncio
import logging
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from starlette.concurrency import run_in_threadpool

from bim_ai.document import Document

from .queue import JobQueue
from .types import Job

logger = logging.getLogger("bim_ai.jobs.evidence_package")

# Builder callable signature matches ``build_evidence_package_payload`` in
# ``bim_ai.routes.api``; passed in to avoid an import cycle.
EvidencePackageBuilder = Callable[..., dict[str, Any]]


@dataclass(frozen=True)
class EvidencePackageJobResult:
    """In-memory result entry for an ``evidence_package`` job.

    ``source_digest_sha256`` is the document-level digest captured at submit
    time. Clients can compare against the current document digest to detect
    a stale result (e.g. the model was edited while the job was running).
    """

    payload: dict[str, Any]
    source_digest_sha256: str
    completed_at: str
    mode: str


class EvidencePackageJobStore:
    """Bounded LRU of completed ``evidence_package`` payloads.

    Single-process, single-instance — fine for v3.0; the ``JobQueue`` it
    rides on is also single-process. Eviction is LRU by job id with
    ``maxsize`` cap so a chatty client cannot OOM the API.
    """

    def __init__(self, maxsize: int = 32) -> None:
        self._maxsize = max(1, maxsize)
        self._results: OrderedDict[str, EvidencePackageJobResult] = OrderedDict()

    def put(self, job_id: str, result: EvidencePackageJobResult) -> None:
        self._results[job_id] = result
        self._results.move_to_end(job_id)
        while len(self._results) > self._maxsize:
            self._results.popitem(last=False)

    def get(self, job_id: str) -> EvidencePackageJobResult | None:
        result = self._results.get(job_id)
        if result is not None:
            self._results.move_to_end(job_id)
        return result

    def __len__(self) -> int:
        return len(self._results)


_store: EvidencePackageJobStore | None = None


def get_evidence_package_job_store() -> EvidencePackageJobStore:
    global _store
    if _store is None:
        _store = EvidencePackageJobStore()
    return _store


def _reset_evidence_package_job_store_for_tests() -> None:
    """Test-only helper; clears the module-level LRU."""

    global _store
    _store = None


def submit_evidence_package_job(
    *,
    queue: JobQueue,
    store: EvidencePackageJobStore,
    model_id: UUID,
    mode: str,
    debug: bool,
    doc: Document,
    source_document: dict[str, Any],
    source_digest_sha256: str,
    builder: EvidencePackageBuilder,
    task_factory: Callable[[Awaitable[Any]], Any] = asyncio.create_task,
) -> Awaitable[Job]:
    """Submit an ``evidence_package`` job and schedule its background run.

    Returns the awaitable that resolves to the submitted ``Job`` (with
    ``status="queued"``). The background task itself is fire-and-forget;
    consumers poll the existing ``GET /api/jobs/{job_id}`` endpoint for
    status and ``GET /api/jobs/{job_id}/result`` once status is ``done``.
    """

    job = Job(
        model_id=str(model_id),
        kind="evidence_package",
        inputs={
            "mode": mode,
            "debug": debug,
            "sourceDigestSha256": source_digest_sha256,
        },
        created_at=datetime.now(UTC).isoformat(),
    )

    async def _submit_and_run() -> Job:
        submitted = await queue.submit(job)
        task_factory(
            _run_evidence_package_job(
                queue=queue,
                store=store,
                job_id=submitted.id,
                model_id=model_id,
                mode=mode,
                debug=debug,
                doc=doc,
                source_document=source_document,
                source_digest_sha256=source_digest_sha256,
                builder=builder,
            )
        )
        return submitted

    return _submit_and_run()


async def _run_evidence_package_job(
    *,
    queue: JobQueue,
    store: EvidencePackageJobStore,
    job_id: str,
    model_id: UUID,
    mode: str,
    debug: bool,
    doc: Document,
    source_document: dict[str, Any],
    source_digest_sha256: str,
    builder: EvidencePackageBuilder,
) -> None:
    """Execute the evidence-package build off the request path.

    The build is CPU-bound — run it in a threadpool so the FastAPI event
    loop can keep serving other requests. Status transitions go through
    the existing ``JobQueue`` so the polling endpoint (``GET /api/jobs/{id}``)
    returns up-to-date progress without any new infrastructure.
    """

    try:
        await queue.update_status(job_id, "running")
        await queue.update_progress(
            job_id,
            current=0,
            total=1,
            phase="building",
            message="Building evidence package",
        )
        payload = await run_in_threadpool(
            builder,
            model_id=model_id,
            doc=doc,
            source_document=source_document,
            mode=mode,
        )
        store.put(
            job_id,
            EvidencePackageJobResult(
                payload=payload,
                source_digest_sha256=source_digest_sha256,
                completed_at=datetime.now(UTC).isoformat(),
                mode=mode,
            ),
        )
        await queue.update_progress(
            job_id,
            current=1,
            total=1,
            phase="done",
            message="Evidence package ready",
        )
        await queue.update_status(job_id, "done")
    except Exception as exc:  # pragma: no cover - exercised via tests
        logger.exception("evidence_package job %s failed", job_id)
        try:
            await queue.update_status(job_id, "errored", error_message=str(exc))
        except Exception:
            logger.exception("failed to mark evidence_package job %s errored", job_id)
