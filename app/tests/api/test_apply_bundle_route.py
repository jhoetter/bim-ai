"""CMD-V3-01 — REST endpoint tests for POST /api/models/{model_id}/bundles.

Uses a stub FastAPI app that mimics the route's logic without a live DB,
following the same pattern as test_agent_iterate.py.
"""

from __future__ import annotations

import json
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.engine import (
    compute_delta_wire,
    ensure_cardinal_elevation_views,
    ensure_internal_origin,
    ensure_seed_hatches,
    ensure_sun_settings,
)
from bim_ai.transaction_metadata import build_transaction_metadata, command_bundle_digest

_VALID_ASSUMPTION = {
    "key": "ground_level_mm",
    "value": 0,
    "confidence": 0.95,
    "source": "brief",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-g", "name": "Ground", "elevationMm": 0}

MODEL_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Stub app
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    """Stub app with in-memory model store — no DB required."""
    _models: dict[str, dict[str, Any]] = {}
    _command_log: dict[str, list[dict[str, Any]]] = {}

    def _seed(model_id: str, revision: int = 1) -> None:
        doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        ensure_cardinal_elevation_views(doc)
        ensure_sun_settings(doc)
        ensure_seed_hatches(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}
        _command_log[model_id] = []

    _seed(MODEL_ID)

    app = FastAPI()

    _BLOCKING_ADVISORY_CLASSES = {
        "revision_conflict",
        "assumption_log_required",
        "assumption_log_malformed",
        "assumption_log_duplicate_key",
        "direct_main_commit_forbidden",
        "option_routing_not_yet_implemented",
    }

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        bundle_raw = body.get("bundle")
        if not isinstance(bundle_raw, dict):
            raise HTTPException(status_code=422, detail="bundle field required")

        try:
            bundle = CommandBundle.model_validate(bundle_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        mode_raw = body.get("mode", "dry_run")
        mode = mode_raw if mode_raw in ("dry_run", "commit") else "dry_run"

        doc = _models[model_id]["doc"]
        uid = body.get("userId") or "local-dev"
        submitter = body.get("submitter") or "human"
        bundle_digest = command_bundle_digest(
            bundle.commands,
            parent_revision=bundle.parent_revision,
            assumptions=list(bundle.assumptions),
            submitter=submitter,
            route="/api/models/{model_id}/bundles",
        )
        client_op_id = body.get("clientOpId")
        if mode == "commit":
            for entry in _command_log.get(model_id, []):
                if entry.get("userId") != uid:
                    continue
                tx = entry.get("transactionMetadata") or {}
                idem = tx.get("idempotency") or {}
                if (
                    client_op_id
                    and idem.get("clientOpId") == client_op_id
                    or idem.get("bundleDigestSha256") == bundle_digest
                ):
                    return {
                        "schemaVersion": "cmd-v3.0",
                        "applied": True,
                        "newRevision": entry["revisionAfter"],
                        "currentRevision": doc.revision,
                        "changedIds": tx.get("changedIds", []),
                        "violations": [],
                        "checkpointSnapshotId": None,
                        "transactionMetadata": tx,
                        "idempotentReplay": True,
                        "idempotencyMatch": idem,
                    }
        result, new_doc_from_bundle = _apply_bundle(doc, bundle, mode)  # type: ignore[arg-type]

        if not result.applied and result.violations:
            blocking_classes = {v.get("advisoryClass") for v in result.violations}
            if blocking_classes & _BLOCKING_ADVISORY_CLASSES:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "result": result.model_dump(by_alias=True),
                        "violations": result.violations,
                    },
                )

        if result.applied and result.new_revision is not None and new_doc_from_bundle is not None:
            old_doc = doc
            transaction_metadata = build_transaction_metadata(
                doc_before=old_doc,
                new_doc=new_doc_from_bundle,
                commands=bundle.commands,
                user_id=uid,
                submitter=submitter,
                parent_revision=bundle.parent_revision,
                assumptions=list(bundle.assumptions),
                client_op_id=client_op_id,
                workflow={
                    "route": "/api/models/{model_id}/bundles",
                    "entryPoint": "cmd-v3-apply-bundle",
                    "surface": "api-v3",
                    "mode": "commit",
                },
                bundle_digest=bundle_digest,
            )
            _models[model_id] = {
                "revision": new_doc_from_bundle.revision,
                "doc": new_doc_from_bundle,
            }
            _command_log.setdefault(model_id, []).insert(
                0,
                {
                    "id": len(_command_log.get(model_id, [])) + 1,
                    "userId": uid,
                    "revisionAfter": new_doc_from_bundle.revision,
                    "appliedCommands": bundle.commands,
                    "transactionMetadata": transaction_metadata,
                },
            )
            out = result.model_dump(by_alias=True)
            out["transactionMetadata"] = transaction_metadata
            out["delta"] = compute_delta_wire(old_doc, new_doc_from_bundle)
            return out

        return result.model_dump(by_alias=True)

    @app.get("/api/models/{model_id}/snapshot")
    async def snapshot(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        doc = _models[model_id]["doc"]
        return {
            "modelId": model_id,
            "revision": doc.revision,
            "elements": {
                k: v.model_dump(mode="json", by_alias=True) for k, v in doc.elements.items()
            },
        }

    @app.get("/api/models/{model_id}/command-log")
    async def command_log(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        return {"modelId": model_id, "entries": _command_log.get(model_id, [])}

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


def _bundle_body(**overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = {
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [_CREATE_LEVEL],
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": 1,
        },
        "mode": "dry_run",
    }
    defaults.update(overrides)
    return defaults


def _simple_house_bundle(parent_revision: int) -> dict[str, Any]:
    path = (
        Path(__file__).resolve().parents[3]
        / "spec"
        / "benchmarks"
        / "simple-single-storey-house"
        / "mcp-cli-command-bundle.json"
    )
    bundle = json.loads(path.read_text())
    bundle["parentRevision"] = parent_revision
    return bundle


def _kind_counts(snapshot_body: dict[str, Any]) -> Counter[str]:
    return Counter(
        element.get("kind")
        for element in snapshot_body.get("elements", {}).values()
        if isinstance(element, dict)
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDryRunRoute:
    def test_200_dry_run_returns_bundle_result(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/bundles", json=_bundle_body())
        assert res.status_code == 200
        body = res.json()
        assert body["applied"] is False
        assert body["schemaVersion"] == "cmd-v3.0"
        assert "checkpointSnapshotId" in body
        assert "violations" in body

    def test_200_dry_run_does_not_increment_revision(self, client: TestClient) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_bundle_body())
        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        assert snap.json()["revision"] == 1


class TestCommitRoute:
    def test_200_commit_returns_applied_true(self, client: TestClient) -> None:
        res = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle_body(mode="commit"),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["applied"] is True
        assert body["newRevision"] == 2

    def test_200_commit_increments_revision(self, client: TestClient) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_bundle_body(mode="commit"))
        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        assert snap.json()["revision"] == 2

    def test_commit_simple_house_bundle_materializes_geometry_and_command_log(
        self, client: TestClient
    ) -> None:
        before = client.get(f"/api/models/{MODEL_ID}/snapshot").json()
        before_counts = _kind_counts(before)
        assert before_counts["wall"] == 0
        assert before_counts["roof"] == 0

        bundle = _simple_house_bundle(parent_revision=before["revision"])
        res = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json={
                "bundle": bundle,
                "mode": "commit",
                "userId": "benchmark-agent",
                "submitter": "benchmark-agent",
            },
        )

        assert res.status_code == 200
        body = res.json()
        assert body["applied"] is True
        assert body["newRevision"] == before["revision"] + 1
        assert len(body["changedIds"]) >= 20
        tx = body["transactionMetadata"]
        assert tx["parentRevision"] == before["revision"]
        assert tx["revisionBefore"] == before["revision"]
        assert tx["revisionAfter"] == body["newRevision"]
        assert tx["agentIdentity"] == {
            "userId": "benchmark-agent",
            "submitter": "benchmark-agent",
        }
        assert tx["assumptions"]["count"] == len(bundle["assumptions"])
        assert tx["audit"]["hasAssumptionAudit"] is True
        assert "ssh-wall-north" in tx["changedIds"]
        assert "ssh-wall-north" in tx["collaborationDelta"]["changedIds"]
        assert {"ssh-roof-main", "ssh-floor-ground", "ssh-wall-north"} <= set(body["changedIds"])

        after = client.get(f"/api/models/{MODEL_ID}/snapshot").json()
        after_counts = _kind_counts(after)
        assert after["revision"] == body["newRevision"]
        assert after_counts["wall"] == 6
        assert after_counts["floor"] == 1
        assert after_counts["roof"] == 1
        assert after_counts["room"] == 3
        assert after_counts["door"] == 3
        assert after_counts["window"] == 3
        assert "ssh-roof-main" in after["elements"]

        log = client.get(f"/api/models/{MODEL_ID}/command-log").json()
        assert log["entries"][0]["revisionAfter"] == body["newRevision"]
        assert len(log["entries"][0]["appliedCommands"]) == 28
        assert log["entries"][0]["transactionMetadata"] == tx

    def test_dry_run_simple_house_bundle_does_not_mutate(self, client: TestClient) -> None:
        before = client.get(f"/api/models/{MODEL_ID}/snapshot").json()
        bundle = _simple_house_bundle(parent_revision=before["revision"])

        res = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json={
                "bundle": bundle,
                "mode": "dry_run",
                "userId": "benchmark-agent",
                "submitter": "benchmark-agent",
            },
        )

        assert res.status_code == 200
        body = res.json()
        assert body["applied"] is False
        assert body["newRevision"] is None
        assert body["changedIds"] == []
        after = client.get(f"/api/models/{MODEL_ID}/snapshot").json()
        assert after["revision"] == before["revision"]
        assert after["elements"] == before["elements"]
        assert client.get(f"/api/models/{MODEL_ID}/command-log").json()["entries"] == []

    def test_commit_replay_with_same_client_op_id_is_idempotent(self, client: TestClient) -> None:
        body = _bundle_body(
            mode="commit",
            clientOpId="stable-op-1",
            userId="agent-1",
            submitter="agent-runner",
        )
        first = client.post(f"/api/models/{MODEL_ID}/bundles", json=body)
        assert first.status_code == 200
        first_body = first.json()
        assert first_body["applied"] is True
        assert first_body["newRevision"] == 2

        replay = client.post(f"/api/models/{MODEL_ID}/bundles", json=body)
        assert replay.status_code == 200
        replay_body = replay.json()
        assert replay_body["idempotentReplay"] is True
        assert replay_body["newRevision"] == first_body["newRevision"]
        assert replay_body["currentRevision"] == first_body["newRevision"]
        assert replay_body["transactionMetadata"] == first_body["transactionMetadata"]
        assert replay_body["idempotencyMatch"]["clientOpId"] == "stable-op-1"
        assert client.get(f"/api/models/{MODEL_ID}/snapshot").json()["revision"] == 2
        assert len(client.get(f"/api/models/{MODEL_ID}/command-log").json()["entries"]) == 1

    def test_commit_replay_with_same_bundle_digest_is_idempotent_even_when_stale(
        self, client: TestClient
    ) -> None:
        body = _bundle_body(mode="commit", userId="agent-1", submitter="agent-runner")
        first = client.post(f"/api/models/{MODEL_ID}/bundles", json=body)
        assert first.status_code == 200
        first_body = first.json()

        replay = client.post(f"/api/models/{MODEL_ID}/bundles", json=body)
        assert replay.status_code == 200
        replay_body = replay.json()
        assert replay_body["idempotentReplay"] is True
        assert replay_body["newRevision"] == first_body["newRevision"]
        assert (
            replay_body["idempotencyMatch"]["bundleDigestSha256"]
            == (first_body["transactionMetadata"]["idempotency"]["bundleDigestSha256"])
        )
        assert len(client.get(f"/api/models/{MODEL_ID}/command-log").json()["entries"]) == 1


class TestConflictRoute:
    def test_409_stale_revision(self, client: TestClient) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_bundle_body(mode="commit"))
        body = _bundle_body(
            bundle={
                "schemaVersion": "cmd-v3.0",
                "commands": [_CREATE_LEVEL],
                "assumptions": [_VALID_ASSUMPTION],
                "parentRevision": 1,
            },
            mode="commit",
            userId="other-agent",
        )
        res = client.post(f"/api/models/{MODEL_ID}/bundles", json=body)
        assert res.status_code == 409
        detail = res.json()["detail"]
        violations = detail.get("violations", [])
        classes = {v.get("advisoryClass") for v in violations}
        assert "revision_conflict" in classes

    def test_409_missing_assumptions(self, client: TestClient) -> None:
        # Assumptions min_length=1 enforced by Pydantic; sending an empty list
        # should result in a 422 from Pydantic before it even reaches apply_bundle.
        # But we need to test the apply_bundle structural validation path too.
        # Send a valid Pydantic body but with assumption_log_required surfaced
        # via a mangled confidence.
        body = _bundle_body(
            bundle={
                "schemaVersion": "cmd-v3.0",
                "commands": [_CREATE_LEVEL],
                "assumptions": [_VALID_ASSUMPTION],
                "parentRevision": 1,
            },
        )
        # Inject a duplicate key to trigger assumption_log_duplicate_key
        body["bundle"]["assumptions"] = [_VALID_ASSUMPTION, dict(_VALID_ASSUMPTION)]
        res = client.post(f"/api/models/{MODEL_ID}/bundles", json=body)
        assert res.status_code == 409
        detail = res.json()["detail"]
        violations = detail.get("violations", [])
        classes = {v.get("advisoryClass") for v in violations}
        assert "assumption_log_duplicate_key" in classes


class TestMalformedBodyRoute:
    def test_422_missing_bundle_field(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/bundles", json={"mode": "dry_run"})
        assert res.status_code == 422

    def test_422_wrong_schema_version(self, client: TestClient) -> None:
        body = _bundle_body(
            bundle={
                "schemaVersion": "old-v1",
                "commands": [],
                "assumptions": [_VALID_ASSUMPTION],
                "parentRevision": 1,
            },
        )
        res = client.post(f"/api/models/{MODEL_ID}/bundles", json=body)
        assert res.status_code == 422

    def test_404_unknown_model(self, client: TestClient) -> None:
        res = client.post(
            f"/api/models/{uuid.uuid4()}/bundles",
            json=_bundle_body(),
        )
        assert res.status_code == 404
