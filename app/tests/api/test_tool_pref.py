"""CHR-V3-08 — Tests for SetToolPrefCmd (tool modifier preference persistence).

Two tests at the agent-callable API layer:
  - test_set_tool_pref_stores_value: POST SetToolPrefCmd → assert doc.tool_prefs updated
  - test_set_tool_pref_emits_activity: POST SetToolPrefCmd → assert tool_pref_changed in activity log

Uses a stub FastAPI app with in-memory state — no live DB required.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.commands import SetToolPrefCmd
from bim_ai.document import Document
from bim_ai.engine import apply_inplace, clone_document, ensure_internal_origin

MODEL_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Stub app
# ---------------------------------------------------------------------------


def _build_test_app() -> tuple[FastAPI, list[dict[str, Any]]]:
    """Stub app with in-memory doc store and activity row list."""
    _models: dict[str, dict[str, Any]] = {}
    _rows: list[dict[str, Any]] = []

    def _seed(model_id: str) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    @app.post("/api/models/{model_id}/commands")
    async def apply_command(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        cmd_raw = body.get("command")
        if not isinstance(cmd_raw, dict):
            raise HTTPException(status_code=422, detail="command field required")

        doc = _models[model_id]["doc"]
        cand = clone_document(doc)

        try:
            from pydantic import TypeAdapter

            from bim_ai.commands import Command

            cmd = TypeAdapter(Command).validate_python(cmd_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        try:
            apply_inplace(cand, cmd)
        except Exception as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        cand.revision = doc.revision + 1
        uid = body.get("userId", "local-dev") or "local-dev"
        _models[model_id] = {"doc": cand}

        # Emit tool_pref_changed activity when SetToolPrefCmd is applied
        if isinstance(cmd, SetToolPrefCmd):
            _rows.append(
                {
                    "id": str(uuid.uuid4()),
                    "modelId": model_id,
                    "authorId": uid,
                    "kind": "tool_pref_changed",
                    "payload": {
                        "tool": cmd.tool,
                        "prefKey": cmd.pref_key,
                        "prefValue": cmd.pref_value,
                    },
                    "ts": int(time.time() * 1000),
                }
            )

        return {"ok": True, "revision": cand.revision}

    @app.get("/api/models/{model_id}/tool-prefs")
    async def get_tool_prefs(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        return {"toolPrefs": _models[model_id]["doc"].tool_prefs}

    @app.get("/api/models/{model_id}/activity")
    async def list_activity(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        return {"rows": [r for r in _rows if r["modelId"] == model_id]}

    return app, _rows


@pytest.fixture()
def app_and_rows() -> tuple[FastAPI, list[dict[str, Any]]]:
    return _build_test_app()


@pytest.fixture()
def client(app_and_rows: tuple[FastAPI, list[dict[str, Any]]]) -> TestClient:
    app, _ = app_and_rows
    return TestClient(app)


@pytest.fixture()
def rows(app_and_rows: tuple[FastAPI, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    _, r = app_and_rows
    return r


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_set_tool_pref_stores_value(client: TestClient) -> None:
    """POST SetToolPrefCmd → doc.tool_prefs stores the pref under tool/key."""
    res = client.post(
        f"/api/models/{MODEL_ID}/commands",
        json={
            "command": {
                "type": "setToolPref",
                "tool": "wall",
                "prefKey": "alignment",
                "prefValue": "center",
            },
            "userId": "user-1",
        },
    )
    assert res.status_code == 200
    assert res.json()["ok"] is True

    prefs = client.get(f"/api/models/{MODEL_ID}/tool-prefs").json()
    assert prefs["toolPrefs"]["wall"]["alignment"] == "center"


def test_set_tool_pref_overwrites_existing_value(client: TestClient) -> None:
    """Applying SetToolPrefCmd twice updates the stored value."""
    for value in ("finish", "core"):
        client.post(
            f"/api/models/{MODEL_ID}/commands",
            json={
                "command": {
                    "type": "setToolPref",
                    "tool": "wall",
                    "prefKey": "alignment",
                    "prefValue": value,
                },
                "userId": "user-1",
            },
        )
    prefs = client.get(f"/api/models/{MODEL_ID}/tool-prefs").json()
    assert prefs["toolPrefs"]["wall"]["alignment"] == "core"


def test_set_tool_pref_stores_multiple_tools(client: TestClient) -> None:
    """Prefs for different tools are stored independently."""
    client.post(
        f"/api/models/{MODEL_ID}/commands",
        json={
            "command": {
                "type": "setToolPref",
                "tool": "wall",
                "prefKey": "alignment",
                "prefValue": "finish",
            }
        },
    )
    client.post(
        f"/api/models/{MODEL_ID}/commands",
        json={
            "command": {
                "type": "setToolPref",
                "tool": "door",
                "prefKey": "swingSide",
                "prefValue": "left",
            }
        },
    )
    prefs = client.get(f"/api/models/{MODEL_ID}/tool-prefs").json()
    assert prefs["toolPrefs"]["wall"]["alignment"] == "finish"
    assert prefs["toolPrefs"]["door"]["swingSide"] == "left"


def test_set_tool_pref_emits_activity(
    client: TestClient, rows: list[dict[str, Any]]
) -> None:
    """POST SetToolPrefCmd → tool_pref_changed activity row is emitted."""
    before_count = len(rows)
    res = client.post(
        f"/api/models/{MODEL_ID}/commands",
        json={
            "command": {
                "type": "setToolPref",
                "tool": "door",
                "prefKey": "swingSide",
                "prefValue": "right",
            },
            "userId": "agent-1",
        },
    )
    assert res.status_code == 200
    assert len(rows) == before_count + 1
    emitted = rows[-1]
    assert emitted["kind"] == "tool_pref_changed"
    assert emitted["modelId"] == MODEL_ID
    assert emitted["authorId"] == "agent-1"
    assert emitted["payload"]["tool"] == "door"
    assert emitted["payload"]["prefKey"] == "swingSide"
    assert emitted["payload"]["prefValue"] == "right"


def test_set_tool_pref_activity_in_list(
    client: TestClient, rows: list[dict[str, Any]]
) -> None:
    """tool_pref_changed rows appear in GET /activity."""
    client.post(
        f"/api/models/{MODEL_ID}/commands",
        json={
            "command": {
                "type": "setToolPref",
                "tool": "window",
                "prefKey": "multipleMode",
                "prefValue": "true",
            }
        },
    )
    act = client.get(f"/api/models/{MODEL_ID}/activity").json()
    kinds = [r["kind"] for r in act["rows"]]
    assert "tool_pref_changed" in kinds
