"""VER-V3-01 — Activity stream route tests.

Stub FastAPI app pattern (same as test_apply_bundle_route.py): in-memory
_rows list acts as the database; no real DB or session required.
"""
from __future__ import annotations

import time
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.activity import ActivityRow, ActivityKind, emit_activity_row
from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "ground_level_mm",
    "value": 0,
    "confidence": 0.95,
    "source": "brief",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-g", "name": "Ground", "elevationMm": 0}


def _build_test_app() -> tuple[FastAPI, list[dict[str, Any]]]:
    _models: dict[str, dict[str, Any]] = {}
    _rows: list[dict[str, Any]] = []

    def _seed(model_id: str, revision: int = 1) -> None:
        doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    _BLOCKING = {
        "revision_conflict", "assumption_log_required", "assumption_log_malformed",
        "assumption_log_duplicate_key", "direct_main_commit_forbidden",
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
        mode = body.get("mode", "dry_run")
        if mode not in ("dry_run", "commit"):
            mode = "dry_run"
        uid = body.get("userId", "local-dev") or "local-dev"
        doc = _models[model_id]["doc"]
        result, new_doc = _apply_bundle(doc, bundle, mode)  # type: ignore[arg-type]
        if not result.applied and result.violations:
            if {v.get("advisoryClass") for v in result.violations} & _BLOCKING:
                raise HTTPException(status_code=409, detail={
                    "result": result.model_dump(by_alias=True),
                    "violations": result.violations,
                })
        if result.applied and result.new_revision is not None and new_doc is not None:
            old_rev = doc.revision
            _models[model_id] = {"revision": new_doc.revision, "doc": new_doc}
            _rows.append({
                "id": str(uuid.uuid4()), "modelId": model_id, "authorId": uid,
                "kind": "commit", "payload": {"commandCount": len(bundle.commands)},
                "ts": int(time.time() * 1000),
                "parentSnapshotId": str(old_rev), "resultSnapshotId": str(new_doc.revision),
            })
        return result.model_dump(by_alias=True)

    @app.get("/api/models/{model_id}/activity")
    async def list_activity(
        model_id: str, limit: int = 50, before: int | None = None,
        kind: str | None = None, authorId: str | None = None,
    ) -> Any:
        from fastapi import HTTPException
        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        filtered = [r for r in _rows if r["modelId"] == model_id]
        if before is not None:
            filtered = [r for r in filtered if r["ts"] < before]
        if kind is not None:
            filtered = [r for r in filtered if r["kind"] == kind]
        if authorId is not None:
            filtered = [r for r in filtered if r["authorId"] == authorId]
        filtered.sort(key=lambda r: r["ts"], reverse=True)
        return {"modelId": model_id, "rows": filtered[:limit]}

    @app.post("/api/models/{model_id}/activity/{row_id}/restore")
    async def restore_activity_row(model_id: str, row_id: str) -> Any:
        from fastapi import HTTPException
        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        act_row = next((r for r in _rows if r["id"] == row_id and r["modelId"] == model_id), None)
        if act_row is None:
            raise HTTPException(status_code=404, detail="Activity row not found")
        if not act_row.get("parentSnapshotId"):
            raise HTTPException(status_code=409, detail="No parentSnapshotId")
        current_rev = _models[model_id]["revision"]
        new_rev = current_rev + 1
        _models[model_id]["revision"] = new_rev
        restore_id = str(uuid.uuid4())
        _rows.append({
            "id": restore_id, "modelId": model_id, "authorId": "restore",
            "kind": "commit",
            "payload": {"restore": True, "fromRevision": int(act_row["parentSnapshotId"]), "toRevision": new_rev},
            "ts": int(time.time() * 1000) + 1,
            "parentSnapshotId": str(current_rev), "resultSnapshotId": str(new_rev),
        })
        return {"modelId": model_id, "restoredRevision": new_rev, "activityRowId": restore_id}

    return app, _rows


@pytest.fixture()
def app_and_rows() -> tuple[FastAPI, list[dict[str, Any]]]:
    return _build_test_app()


@pytest.fixture()
def client(app_and_rows: tuple[FastAPI, list[dict[str, Any]]]) -> TestClient:
    return TestClient(app_and_rows[0])


@pytest.fixture()
def rows(app_and_rows: tuple[FastAPI, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    return app_and_rows[1]


def _commit_body(**overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = {
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [_CREATE_LEVEL],
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": 1,
        },
        "mode": "commit",
        "userId": "user-1",
    }
    defaults.update(overrides)
    return defaults


@pytest.mark.asyncio
async def test_emit_activity_row_inserts_and_returns() -> None:
    import bim_ai.activity as activity_module
    original = activity_module.ActivityRowRecord

    class _Fake:
        def __init__(self, **kw: Any) -> None:
            for k, v in kw.items():
                setattr(self, k, v)

    activity_module.ActivityRowRecord = _Fake  # type: ignore[assignment]
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    try:
        result = await emit_activity_row(
            session, model_id="m1", author_id="u1", kind="commit",
            payload={"commandCount": 3}, parent_snapshot_id="1", result_snapshot_id="2",
        )
    finally:
        activity_module.ActivityRowRecord = original
    assert isinstance(result, ActivityRow)
    assert result.model_id == "m1"
    assert result.kind == "commit"
    assert result.parent_snapshot_id == "1"
    session.add.assert_called_once()
    session.flush.assert_awaited_once()


class TestListActivity:
    def test_descending_ts(self, client: TestClient, rows: list[dict]) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_commit_body())
        client.post(f"/api/models/{MODEL_ID}/bundles", json={
            "bundle": {"schemaVersion": "cmd-v3.0",
                       "commands": [{"type": "createLevel", "id": "l2", "name": "L2", "elevationMm": 3000}],
                       "assumptions": [_VALID_ASSUMPTION], "parentRevision": 2},
            "mode": "commit", "userId": "user-1",
        })
        res = client.get(f"/api/models/{MODEL_ID}/activity")
        assert res.status_code == 200
        ts_list = [r["ts"] for r in res.json()["rows"]]
        assert len(ts_list) >= 2
        assert ts_list == sorted(ts_list, reverse=True)

    def test_404_unknown_model(self, client: TestClient) -> None:
        res = client.get(f"/api/models/{uuid.uuid4()}/activity")
        assert res.status_code == 404

    def test_kind_filter(self, client: TestClient, rows: list[dict]) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_commit_body())
        rows.append({"id": str(uuid.uuid4()), "modelId": MODEL_ID, "authorId": "u2",
                     "kind": "comment_created", "payload": {},
                     "ts": int(time.time() * 1000) + 100,
                     "parentSnapshotId": None, "resultSnapshotId": None})
        res = client.get(f"/api/models/{MODEL_ID}/activity?kind=commit")
        assert res.status_code == 200
        assert all(r["kind"] == "commit" for r in res.json()["rows"])

    def test_author_filter(self, client: TestClient, rows: list[dict]) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_commit_body(userId="alice"))
        rows.append({"id": str(uuid.uuid4()), "modelId": MODEL_ID, "authorId": "bob",
                     "kind": "commit", "payload": {}, "ts": int(time.time() * 1000) + 10,
                     "parentSnapshotId": "2", "resultSnapshotId": "3"})
        res = client.get(f"/api/models/{MODEL_ID}/activity?authorId=alice")
        assert res.status_code == 200
        assert all(r["authorId"] == "alice" for r in res.json()["rows"])

    def test_limit(self, client: TestClient, rows: list[dict]) -> None:
        now = int(time.time() * 1000)
        for i in range(10):
            rows.append({"id": str(uuid.uuid4()), "modelId": MODEL_ID, "authorId": "bulk",
                         "kind": "commit", "payload": {}, "ts": now + i,
                         "parentSnapshotId": str(i), "resultSnapshotId": str(i + 1)})
        res = client.get(f"/api/models/{MODEL_ID}/activity?limit=5")
        assert res.status_code == 200
        assert len(res.json()["rows"]) <= 5

    def test_before_cursor(self, client: TestClient, rows: list[dict]) -> None:
        now = int(time.time() * 1000)
        for i in range(5):
            rows.append({"id": str(uuid.uuid4()), "modelId": MODEL_ID, "authorId": "pager",
                         "kind": "commit", "payload": {}, "ts": now + i * 1000,
                         "parentSnapshotId": str(i), "resultSnapshotId": str(i + 1)})
        cutoff = now + 2500
        res = client.get(f"/api/models/{MODEL_ID}/activity?before={cutoff}")
        assert res.status_code == 200
        assert all(r["ts"] < cutoff for r in res.json()["rows"])


class TestRestoreActivityRow:
    def test_creates_new_commit_row(self, client: TestClient, rows: list[dict]) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_commit_body())
        row_id = rows[0]["id"]
        res = client.post(f"/api/models/{MODEL_ID}/activity/{row_id}/restore")
        assert res.status_code == 200
        body = res.json()
        assert "restoredRevision" in body
        assert "activityRowId" in body
        restore_row = next((r for r in rows if r["id"] == body["activityRowId"]), None)
        assert restore_row is not None
        assert restore_row["payload"].get("restore") is True

    def test_404_unknown_row(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/activity/{uuid.uuid4()}/restore")
        assert res.status_code == 404

    def test_additive(self, client: TestClient, rows: list[dict]) -> None:
        client.post(f"/api/models/{MODEL_ID}/bundles", json=_commit_body())
        before = len(rows)
        client.post(f"/api/models/{MODEL_ID}/activity/{rows[0]['id']}/restore")
        assert len(rows) > before


class TestBundleAutoEmit:
    def test_commit_emits(self, client: TestClient, rows: list[dict]) -> None:
        before = len(rows)
        res = client.post(f"/api/models/{MODEL_ID}/bundles", json=_commit_body())
        assert res.status_code == 200
        assert res.json()["applied"] is True
        assert len(rows) == before + 1
        assert rows[-1]["kind"] == "commit"
        assert rows[-1]["modelId"] == MODEL_ID

    def test_dry_run_no_emit(self, client: TestClient, rows: list[dict]) -> None:
        before = len(rows)
        res = client.post(f"/api/models/{MODEL_ID}/bundles", json=_commit_body(mode="dry_run"))
        assert res.status_code == 200
        assert res.json()["applied"] is False
        assert len(rows) == before
