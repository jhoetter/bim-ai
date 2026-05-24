"""PERF-D07 — async/job-backed evidence package.

Covers the in-process worker that wraps ``build_evidence_package_payload``:

- Worker submits, runs, and completes a job through the existing
  ``JobQueue`` (status transitions queued → running → done).
- Result store holds the payload keyed by job id; the stored payload is
  the exact dict returned by the injected builder.
- Builder exceptions surface as ``errored`` status with an error message.
- Bounded LRU evicts the oldest entry when over capacity.

The wire-level ``?async=true`` branch on
``GET /api/models/{id}/evidence-package`` is exercised via the public
worker contract here (the route's job is just to call
``submit_evidence_package_job``); HTTP-level coverage lives alongside the
other route smoke tests.
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

import pytest

from bim_ai.document import Document
from bim_ai.jobs.evidence_package import (
    EvidencePackageJobStore,
    submit_evidence_package_job,
)
from bim_ai.jobs.queue import JobQueue


def _empty_doc() -> Document:
    return Document.model_validate({"revision": 1, "elements": {}})


async def _drain_pending_tasks() -> None:
    """Yield to the event loop until all pending tasks finish."""

    for _ in range(50):
        pending = [t for t in asyncio.all_tasks() if not t.done()]
        # Drop our own current task from the wait list.
        current = asyncio.current_task()
        pending = [t for t in pending if t is not current]
        if not pending:
            return
        await asyncio.gather(*pending, return_exceptions=True)


@pytest.mark.asyncio
async def test_submit_runs_builder_and_stores_payload_with_digest() -> None:
    queue = JobQueue()
    store = EvidencePackageJobStore()
    model_id = uuid4()
    expected_payload: dict[str, Any] = {"format": "evidencePackage_v1", "elementCount": 7}

    builder_calls: list[dict[str, Any]] = []

    def builder(**kwargs: Any) -> dict[str, Any]:
        builder_calls.append(kwargs)
        return dict(expected_payload)

    submitted = await submit_evidence_package_job(
        queue=queue,
        store=store,
        model_id=model_id,
        mode="default",
        debug=False,
        doc=_empty_doc(),
        source_document={"revision": 1, "elements": {}},
        source_digest_sha256="sha256:fixture",
        builder=builder,
    )

    assert submitted.kind == "evidence_package"
    assert submitted.model_id == str(model_id)
    assert submitted.status == "queued"
    assert submitted.inputs["mode"] == "default"
    assert submitted.inputs["sourceDigestSha256"] == "sha256:fixture"

    await _drain_pending_tasks()

    final = queue.get(submitted.id)
    assert final is not None
    assert final.status == "done"
    assert final.progress is not None
    assert final.progress.phase == "done"
    assert final.progress.percent == 100.0

    result = store.get(submitted.id)
    assert result is not None
    assert result.payload == expected_payload
    assert result.source_digest_sha256 == "sha256:fixture"
    assert result.mode == "default"

    assert len(builder_calls) == 1
    assert builder_calls[0]["mode"] == "default"
    assert builder_calls[0]["model_id"] == model_id
    assert builder_calls[0]["source_document"] == {"revision": 1, "elements": {}}


@pytest.mark.asyncio
async def test_builder_exception_marks_job_errored_and_skips_store() -> None:
    queue = JobQueue()
    store = EvidencePackageJobStore()

    def boom(**_: Any) -> dict[str, Any]:
        raise RuntimeError("kaboom")

    submitted = await submit_evidence_package_job(
        queue=queue,
        store=store,
        model_id=uuid4(),
        mode="summary",
        debug=False,
        doc=_empty_doc(),
        source_document={"revision": 1, "elements": {}},
        source_digest_sha256="sha256:err",
        builder=boom,
    )

    await _drain_pending_tasks()

    final = queue.get(submitted.id)
    assert final is not None
    assert final.status == "errored"
    assert final.error_message == "kaboom"
    assert store.get(submitted.id) is None


def test_store_evicts_oldest_when_over_capacity() -> None:
    from bim_ai.jobs.evidence_package import EvidencePackageJobResult

    store = EvidencePackageJobStore(maxsize=2)
    store.put(
        "a",
        EvidencePackageJobResult(
            payload={"k": "a"},
            source_digest_sha256="sha256:a",
            completed_at="2026-01-01T00:00:00+00:00",
            mode="default",
        ),
    )
    store.put(
        "b",
        EvidencePackageJobResult(
            payload={"k": "b"},
            source_digest_sha256="sha256:b",
            completed_at="2026-01-01T00:00:01+00:00",
            mode="default",
        ),
    )
    store.put(
        "c",
        EvidencePackageJobResult(
            payload={"k": "c"},
            source_digest_sha256="sha256:c",
            completed_at="2026-01-01T00:00:02+00:00",
            mode="default",
        ),
    )

    assert store.get("a") is None
    assert store.get("b") is not None
    assert store.get("c") is not None
    assert len(store) == 2
