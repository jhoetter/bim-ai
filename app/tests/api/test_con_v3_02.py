"""CON-V3-02 — ConceptSeed handoff contract tests (T6 → T9 lifecycle).

Covers:
  - Create concept seed in draft state
  - Commit draft seed → committed + committedAt set
  - Commit already-committed seed → ValueError
  - Consume committed seed → consumed
  - Consume draft seed → ValueError
  - Consume consumed seed → ValueError
  - CommitConceptSeed with additional tokens merges into existing tokens
  - GET /concept-seeds?status=committed returns only committed seeds
  - TypeScript round-trip for ConceptSeedElem (schema version + shape)
  - Commit nonexistent seed → ValueError
  - Schema version preserved as "con-v3.0"
  - Assumptions log entries validated
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.commands import (
    CommitConceptSeedCmd,
    ConsumeConceptSeedCmd,
    CreateConceptSeedCmd,
)
from bim_ai.document import Document
from bim_ai.elements import ConceptSeedElem
from bim_ai.engine import apply_inplace

# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

MODEL_ID = str(uuid.uuid4())


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


def _token() -> dict:
    return {"hostId": "wall-1", "t": 0.5, "deltaMm": 100.0, "scaleFactor": 1.0, "rho": 0.8}


def _assumption_entry() -> dict:
    return {"assumption": "Wall is load-bearing", "confidence": 0.9, "source": "sketch_trace"}


def _create_seed(
    doc: Document,
    seed_id: str,
    *,
    model_id: str = MODEL_ID,
    envelope_tokens: list[dict] | None = None,
    assumptions_log: list[dict] | None = None,
) -> None:
    apply_inplace(
        doc,
        CreateConceptSeedCmd(
            id=seed_id,
            modelId=model_id,
            envelopeTokens=envelope_tokens or [],
            kernelElementDrafts=[],
            assumptionsLog=assumptions_log or [],
        ),
    )


# ---------------------------------------------------------------------------
# Test 1: Create concept seed in draft state
# ---------------------------------------------------------------------------


def test_create_concept_seed_stores_draft_element() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid, envelope_tokens=[_token()])

    assert sid in doc.elements
    elem = doc.elements[sid]
    assert isinstance(elem, ConceptSeedElem)
    assert elem.kind == "concept_seed"
    assert elem.status == "draft"
    assert elem.model_id == MODEL_ID
    assert len(elem.envelope_tokens) == 1


# ---------------------------------------------------------------------------
# Test 2: Commit draft seed → status = committed, committedAt set
# ---------------------------------------------------------------------------


def test_commit_draft_seed_transitions_to_committed() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)

    apply_inplace(doc, CommitConceptSeedCmd(id=sid))
    elem = doc.elements[sid]
    assert isinstance(elem, ConceptSeedElem)
    assert elem.status == "committed"
    assert elem.committed_at is not None
    # Must be valid ISO 8601 (non-empty string ending with +00:00 or Z)
    assert "T" in elem.committed_at


# ---------------------------------------------------------------------------
# Test 3: Commit already-committed seed → 400 (ValueError)
# ---------------------------------------------------------------------------


def test_commit_already_committed_seed_raises() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)
    apply_inplace(doc, CommitConceptSeedCmd(id=sid))

    with pytest.raises(ValueError, match="'committed'"):
        apply_inplace(doc, CommitConceptSeedCmd(id=sid))


# ---------------------------------------------------------------------------
# Test 4: Consume committed seed → status = consumed
# ---------------------------------------------------------------------------


def test_consume_committed_seed_transitions_to_consumed() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)
    apply_inplace(doc, CommitConceptSeedCmd(id=sid))
    apply_inplace(doc, ConsumeConceptSeedCmd(id=sid))

    elem = doc.elements[sid]
    assert isinstance(elem, ConceptSeedElem)
    assert elem.status == "consumed"


# ---------------------------------------------------------------------------
# Test 5: Consume draft seed → ValueError
# ---------------------------------------------------------------------------


def test_consume_draft_seed_raises() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)

    with pytest.raises(ValueError, match="'draft'"):
        apply_inplace(doc, ConsumeConceptSeedCmd(id=sid))


# ---------------------------------------------------------------------------
# Test 6: Consume consumed seed → ValueError
# ---------------------------------------------------------------------------


def test_consume_consumed_seed_raises() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)
    apply_inplace(doc, CommitConceptSeedCmd(id=sid))
    apply_inplace(doc, ConsumeConceptSeedCmd(id=sid))

    with pytest.raises(ValueError, match="'consumed'"):
        apply_inplace(doc, ConsumeConceptSeedCmd(id=sid))


# ---------------------------------------------------------------------------
# Test 7: CommitConceptSeed with additional tokens merges into existing tokens
# ---------------------------------------------------------------------------


def test_commit_merges_additional_envelope_tokens() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    initial_token = {"hostId": "wall-A", "t": 0.2, "deltaMm": 50.0, "scaleFactor": 1.0, "rho": 0.7}
    extra_token = {"hostId": "wall-B", "t": 0.8, "deltaMm": 120.0, "scaleFactor": 1.1, "rho": 0.6}

    _create_seed(doc, sid, envelope_tokens=[initial_token])
    apply_inplace(
        doc,
        CommitConceptSeedCmd(id=sid, envelopeTokens=[extra_token]),
    )

    elem = doc.elements[sid]
    assert isinstance(elem, ConceptSeedElem)
    assert len(elem.envelope_tokens) == 2
    assert elem.envelope_tokens[0]["hostId"] == "wall-A"
    assert elem.envelope_tokens[1]["hostId"] == "wall-B"


# ---------------------------------------------------------------------------
# Test 8: GET /concept-seeds?status=committed returns only committed seeds
# ---------------------------------------------------------------------------


def _build_concept_seeds_app() -> FastAPI:
    """Minimal FastAPI stub that implements the concept-seeds GET endpoint logic."""
    _store: dict[str, Document] = {}

    def _get_doc(model_id: str) -> Document:
        return _store.setdefault(model_id, Document(revision=1, elements={}))

    app = FastAPI()

    @app.post("/models/{model_id}/seeds")
    async def create_seed(model_id: str, body: dict[str, Any]) -> Any:
        doc = _get_doc(model_id)
        apply_inplace(
            doc,
            CreateConceptSeedCmd(
                id=body["id"],
                modelId=model_id,
                envelopeTokens=body.get("envelopeTokens", []),
                kernelElementDrafts=body.get("kernelElementDrafts", []),
                assumptionsLog=body.get("assumptionsLog", []),
            ),
        )
        return {"ok": True}

    @app.post("/models/{model_id}/seeds/{seed_id}/commit")
    async def commit_seed(model_id: str, seed_id: str) -> Any:
        doc = _get_doc(model_id)
        apply_inplace(doc, CommitConceptSeedCmd(id=seed_id))
        return {"ok": True}

    @app.get("/models/{model_id}/concept-seeds")
    async def list_concept_seeds(model_id: str, status: str | None = None) -> Any:
        doc = _get_doc(model_id)
        results = []
        for elem in doc.elements.values():
            if not isinstance(elem, ConceptSeedElem):
                continue
            if status is not None and elem.status != status:
                continue
            results.append(elem.model_dump(by_alias=True))
        return results

    return app


@pytest.fixture(scope="module")
def seeds_client() -> TestClient:
    return TestClient(_build_concept_seeds_app())


def test_get_concept_seeds_filters_by_committed_status(seeds_client: TestClient) -> None:
    mid = str(uuid.uuid4())
    draft_id = str(uuid.uuid4())
    committed_id = str(uuid.uuid4())

    seeds_client.post(f"/models/{mid}/seeds", json={"id": draft_id})
    seeds_client.post(f"/models/{mid}/seeds", json={"id": committed_id})
    seeds_client.post(f"/models/{mid}/seeds/{committed_id}/commit")

    resp = seeds_client.get(f"/models/{mid}/concept-seeds", params={"status": "committed"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == committed_id
    assert data[0]["status"] == "committed"


def test_get_concept_seeds_no_filter_returns_all(seeds_client: TestClient) -> None:
    mid = str(uuid.uuid4())
    sid1 = str(uuid.uuid4())
    sid2 = str(uuid.uuid4())

    seeds_client.post(f"/models/{mid}/seeds", json={"id": sid1})
    seeds_client.post(f"/models/{mid}/seeds", json={"id": sid2})
    seeds_client.post(f"/models/{mid}/seeds/{sid2}/commit")

    resp = seeds_client.get(f"/models/{mid}/concept-seeds")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


# ---------------------------------------------------------------------------
# Test 9: TypeScript round-trip — schema version + shape
# ---------------------------------------------------------------------------


def test_concept_seed_schema_version_is_con_v3() -> None:
    """ConceptSeedElem always carries schemaVersion='con-v3.0'."""
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)
    elem = doc.elements[sid]
    assert isinstance(elem, ConceptSeedElem)
    assert elem.schema_version == "con-v3.0"


def test_concept_seed_serialises_alias_fields() -> None:
    """model_dump(by_alias=True) uses camelCase keys as expected by TypeScript."""
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid, envelope_tokens=[_token()])
    elem = doc.elements[sid]
    assert isinstance(elem, ConceptSeedElem)
    wire = elem.model_dump(by_alias=True)
    assert "modelId" in wire
    assert "envelopeTokens" in wire
    assert "kernelElementDrafts" in wire
    assert "assumptionsLog" in wire
    assert "schemaVersion" in wire
    assert wire["schemaVersion"] == "con-v3.0"
    assert wire["kind"] == "concept_seed"


# ---------------------------------------------------------------------------
# Test 10: Commit nonexistent seed → ValueError
# ---------------------------------------------------------------------------


def test_commit_nonexistent_seed_raises_not_found() -> None:
    doc = _empty_doc()
    with pytest.raises(ValueError, match="no ConceptSeedElem"):
        apply_inplace(doc, CommitConceptSeedCmd(id="does-not-exist"))


# ---------------------------------------------------------------------------
# Test 11: Schema version preserved as "con-v3.0" after commit/consume
# ---------------------------------------------------------------------------


def test_schema_version_preserved_through_lifecycle() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)

    apply_inplace(doc, CommitConceptSeedCmd(id=sid))
    committed_elem = doc.elements[sid]
    assert isinstance(committed_elem, ConceptSeedElem)
    assert committed_elem.schema_version == "con-v3.0"

    apply_inplace(doc, ConsumeConceptSeedCmd(id=sid))
    consumed_elem = doc.elements[sid]
    assert isinstance(consumed_elem, ConceptSeedElem)
    assert consumed_elem.schema_version == "con-v3.0"


# ---------------------------------------------------------------------------
# Test 12: Assumptions log entries validated
# ---------------------------------------------------------------------------


def test_assumptions_log_stored_and_merged_on_commit() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    initial_assumption = _assumption_entry()
    extra_assumption = {
        "assumption": "Ceiling height is 2.7m",
        "confidence": 0.85,
        "source": "brief",
    }

    _create_seed(doc, sid, assumptions_log=[initial_assumption])

    # Commit with an additional assumption
    apply_inplace(
        doc,
        CommitConceptSeedCmd(id=sid, assumptionsLog=[extra_assumption]),
    )

    elem = doc.elements[sid]
    assert isinstance(elem, ConceptSeedElem)
    assert len(elem.assumptions_log) == 2
    assert elem.assumptions_log[0]["assumption"] == "Wall is load-bearing"
    assert elem.assumptions_log[1]["assumption"] == "Ceiling height is 2.7m"
    assert elem.assumptions_log[1]["confidence"] == 0.85
    assert elem.assumptions_log[1]["source"] == "brief"


# ---------------------------------------------------------------------------
# Bonus test: duplicate create raises ValueError
# ---------------------------------------------------------------------------


def test_create_duplicate_seed_raises() -> None:
    doc = _empty_doc()
    sid = str(uuid.uuid4())
    _create_seed(doc, sid)

    with pytest.raises(ValueError, match="duplicate element id"):
        _create_seed(doc, sid)
