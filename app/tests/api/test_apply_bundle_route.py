"""CMD-V3-01 — REST endpoint tests for POST /api/models/{model_id}/bundles.

Uses a stub FastAPI app that mimics the route's logic without a live DB,
following the same pattern as test_agent_iterate.py.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin


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

    def _seed(model_id: str, revision: int = 1) -> None:
        doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}

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
        result = _apply_bundle(doc, bundle, mode)  # type: ignore[arg-type]

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

        if result.applied and result.new_revision is not None:
            from bim_ai.engine import try_commit_bundle
            ok, new_doc, _c, _v, _code = try_commit_bundle(doc, bundle.commands)
            if ok and new_doc is not None:
                _models[model_id] = {"revision": new_doc.revision, "doc": new_doc}

        return result.model_dump(by_alias=True)

    @app.get("/api/models/{model_id}/snapshot")
    async def snapshot(model_id: str) -> Any:
        from fastapi import HTTPException
        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        doc = _models[model_id]["doc"]
        return {"modelId": model_id, "revision": doc.revision}

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


class TestConflictRoute:
    def test_409_stale_revision(self, client: TestClient) -> None:
        body = _bundle_body(
            bundle={
                "schemaVersion": "cmd-v3.0",
                "commands": [_CREATE_LEVEL],
                "assumptions": [_VALID_ASSUMPTION],
                "parentRevision": 99,
            },
            mode="commit",
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
