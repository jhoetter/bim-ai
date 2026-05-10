"""OUT-V3-01 — Live presentation URL tests.

Stub FastAPI app pattern (same as test_public_links_route.py).
No live DB required — in-memory presentation + model stores.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.testclient import TestClient

from bim_ai.public_links import generate_link_token

MODEL_ID = str(uuid.uuid4())
UNKNOWN_MODEL_ID = str(uuid.uuid4())


def _build_test_app() -> tuple[FastAPI, dict[str, Any]]:
    _models: dict[str, dict[str, Any]] = {
        MODEL_ID: {"revision": 1, "elements": {}, "violations": []}
    }
    _presentations: dict[str, dict[str, Any]] = {}
    _token_index: dict[str, str] = {}
    # token -> set of active WS connections (mirrors production _presentation_ws_sessions)
    _ws_sessions: dict[str, set] = {}

    app = FastAPI()

    @app.post("/api/models/{model_id}/presentations")
    async def create_presentation(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        now_ms = int(time.time() * 1000)
        link_id = uuid.uuid4().hex
        token = generate_link_token()

        record = {
            "id": link_id,
            "modelId": model_id,
            "token": token,
            "pageScopeIds": body.get("pageScopeIds", []),
            "allowMeasurement": body.get("allowMeasurement", False),
            "allowComment": body.get("allowComment", False),
            "expiresAt": body.get("expiresAt"),
            "createdAt": now_ms,
            "isRevoked": False,
            "openCount": 0,
            "displayName": "presentation",
        }
        _presentations[link_id] = record
        _token_index[token] = link_id
        return {**record, "url": f"/p/{token}"}

    @app.get("/api/models/{model_id}/presentations")
    async def list_presentations(model_id: str) -> Any:
        rows = [
            p
            for p in _presentations.values()
            if p["modelId"] == model_id
        ]
        rows.sort(key=lambda p: (p["isRevoked"], -p["createdAt"]))
        return {"presentations": rows}

    @app.post("/api/models/{model_id}/presentations/{link_id}/revoke")
    async def revoke_presentation(model_id: str, link_id: str) -> Any:
        from fastapi import HTTPException

        if link_id not in _presentations or _presentations[link_id]["modelId"] != model_id:
            raise HTTPException(status_code=404, detail="Presentation not found")

        now_ms = int(time.time() * 1000)
        _presentations[link_id]["isRevoked"] = True

        # Push {type: "revoked"} to all active WS sessions for this token, then close them
        token = _presentations[link_id]["token"]
        active_sockets = _ws_sessions.pop(token, set())
        for ws in list(active_sockets):
            try:
                await ws.send_json({"type": "revoked"})
                await ws.close(code=4403)
            except Exception:
                pass

        return {"revokedAt": now_ms}

    @app.post("/api/models/{model_id}/presentations/{link_id}/activate")
    async def activate_presentation(model_id: str, link_id: str) -> Any:
        from fastapi import HTTPException

        if link_id not in _presentations or _presentations[link_id]["modelId"] != model_id:
            raise HTTPException(status_code=404, detail="Presentation not found")

        now_ms = int(time.time() * 1000)
        _presentations[link_id]["isRevoked"] = False

        return {"activatedAt": now_ms, "isRevoked": False}

    @app.get("/api/p/{token}")
    async def resolve_presentation(token: str) -> Any:
        from fastapi import HTTPException

        link_id = _token_index.get(token)
        if link_id is None:
            raise HTTPException(status_code=404, detail="Presentation not found")

        record = _presentations[link_id]
        if record["isRevoked"]:
            return {"status": "revoked"}

        now_ms = int(time.time() * 1000)
        if record["expiresAt"] is not None and record["expiresAt"] < now_ms:
            return {"status": "revoked"}

        record["openCount"] += 1
        model = _models[record["modelId"]]
        return {
            "status": "ok",
            "modelId": record["modelId"],
            "revision": model["revision"],
            "elements": model["elements"],
            "violations": model["violations"],
            "wsUrl": f"/api/p/{token}/ws",
            "allowMeasurement": record["allowMeasurement"],
            "allowComment": record["allowComment"],
            "pageScopeIds": record["pageScopeIds"],
            "presentation": {
                "id": record["id"],
                "displayName": record["displayName"],
                "openCount": record["openCount"],
            },
        }

    @app.websocket("/api/p/{token}/ws")
    async def presentation_ws(websocket: WebSocket, token: str) -> None:
        link_id = _token_index.get(token)
        if link_id is None or _presentations[link_id]["isRevoked"]:
            await websocket.accept()
            await websocket.send_json({"type": "revoked"})
            await websocket.close(code=4403)
            return
        await websocket.accept()
        _ws_sessions.setdefault(token, set()).add(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            sessions = _ws_sessions.get(token)
            if sessions:
                sessions.discard(websocket)
                if not sessions:
                    _ws_sessions.pop(token, None)

    return app, _presentations


@pytest.fixture()
def app_and_data() -> tuple[FastAPI, dict[str, Any]]:
    return _build_test_app()


@pytest.fixture()
def client(app_and_data: tuple[FastAPI, dict[str, Any]]) -> TestClient:
    app, _ = app_and_data
    return TestClient(app)


@pytest.fixture()
def presentations(app_and_data: tuple[FastAPI, dict[str, Any]]) -> dict[str, Any]:
    _, data = app_and_data
    return data


class TestCreatePresentation:
    def test_creates_record_with_token_and_url(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        assert res.status_code == 200
        body = res.json()
        assert "token" in body
        assert "url" in body
        assert body["url"].startswith("/p/")
        assert body["isRevoked"] is False

    def test_404_unknown_model(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{UNKNOWN_MODEL_ID}/presentations", json={})
        assert res.status_code == 404

    def test_empty_page_scope_ids_accepted(self, client: TestClient) -> None:
        res = client.post(
            f"/api/models/{MODEL_ID}/presentations", json={"pageScopeIds": []}
        )
        assert res.status_code == 200
        assert res.json()["pageScopeIds"] == []

    def test_page_scope_ids_persisted(self, client: TestClient) -> None:
        res = client.post(
            f"/api/models/{MODEL_ID}/presentations",
            json={"pageScopeIds": ["page-1", "page-2"]},
        )
        assert res.status_code == 200
        assert res.json()["pageScopeIds"] == ["page-1", "page-2"]

    def test_tokens_are_unique(self, client: TestClient) -> None:
        r1 = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        r2 = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        assert r1.json()["token"] != r2.json()["token"]


class TestResolvePresentationToken:
    def test_returns_model_snapshot(self, client: TestClient) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        token = create.json()["token"]

        res = client.get(f"/api/p/{token}")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["modelId"] == MODEL_ID
        assert "elements" in body
        assert "revision" in body

    def test_returns_revoked_status_when_is_revoked(
        self, client: TestClient, presentations: dict
    ) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        link_id = create.json()["id"]
        token = create.json()["token"]

        client.post(f"/api/models/{MODEL_ID}/presentations/{link_id}/revoke")

        res = client.get(f"/api/p/{token}")
        assert res.status_code == 200
        assert res.json()["status"] == "revoked"

    def test_open_count_increments_on_each_resolve(
        self, client: TestClient, presentations: dict
    ) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        link_id = create.json()["id"]
        token = create.json()["token"]

        client.get(f"/api/p/{token}")
        client.get(f"/api/p/{token}")
        assert presentations[link_id]["openCount"] == 2

    def test_404_unknown_token(self, client: TestClient) -> None:
        res = client.get("/api/p/no-such-token")
        assert res.status_code == 404


class TestRevokePresentation:
    def test_sets_is_revoked_true(self, client: TestClient, presentations: dict) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        link_id = create.json()["id"]

        res = client.post(f"/api/models/{MODEL_ID}/presentations/{link_id}/revoke")
        assert res.status_code == 200
        assert "revokedAt" in res.json()
        assert presentations[link_id]["isRevoked"] is True

    def test_404_unknown_link(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/presentations/bad-id/revoke")
        assert res.status_code == 404


class TestActivatePresentation:
    def test_sets_is_revoked_false(self, client: TestClient, presentations: dict) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        link_id = create.json()["id"]
        client.post(f"/api/models/{MODEL_ID}/presentations/{link_id}/revoke")

        res = client.post(f"/api/models/{MODEL_ID}/presentations/{link_id}/activate")
        assert res.status_code == 200
        assert "activatedAt" in res.json()
        assert res.json()["isRevoked"] is False
        assert presentations[link_id]["isRevoked"] is False

    def test_404_unknown_link(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/presentations/bad-id/activate")
        assert res.status_code == 404


class TestListPresentations:
    def test_lists_presentations(self, client: TestClient) -> None:
        client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        res = client.get(f"/api/models/{MODEL_ID}/presentations")
        assert res.status_code == 200
        assert len(res.json()["presentations"]) >= 1

    def test_lists_revoked_presentations_as_inactive(self, client: TestClient) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        link_id = create.json()["id"]
        client.post(f"/api/models/{MODEL_ID}/presentations/{link_id}/revoke")

        res = client.get(f"/api/models/{MODEL_ID}/presentations")
        row = next(p for p in res.json()["presentations"] if p["id"] == link_id)
        assert row["isRevoked"] is True


class TestPresentationWebSocket:
    def test_ws_connects_for_valid_token(self, client: TestClient) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        token = create.json()["token"]

        with client.websocket_connect(f"/api/p/{token}/ws") as ws:
            ws.send_text("ping")

    def test_ws_closes_with_revoked_message_for_revoked_token(
        self, client: TestClient
    ) -> None:
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        link_id = create.json()["id"]
        token = create.json()["token"]
        client.post(f"/api/models/{MODEL_ID}/presentations/{link_id}/revoke")

        with client.websocket_connect(f"/api/p/{token}/ws") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "revoked"

class TestRevokeWsPush:
    def test_revoke_pushes_to_active_ws_session(self, client: TestClient) -> None:
        """Acceptance: incognito viewer shows 'presentation revoked' in <1 s.

        Steps:
        1. Create presentation link
        2. Connect WS client to /api/p/{token}/ws (simulates active viewer)
        3. Revoke the link via POST /api/models/.../presentations/{id}/revoke
        4. Assert WS client received {"type": "revoked"}
        5. (Connection close is handled by the server after sending the message)
        """
        # 1. Create a presentation link
        create = client.post(f"/api/models/{MODEL_ID}/presentations", json={})
        assert create.status_code == 200
        body = create.json()
        link_id = body["id"]
        token = body["token"]

        # 2. Connect WS client (simulates an active viewer tab)
        with client.websocket_connect(f"/api/p/{token}/ws") as ws:
            # 3. Revoke while WS is connected — server must push "revoked" message
            revoke = client.post(
                f"/api/models/{MODEL_ID}/presentations/{link_id}/revoke"
            )
            assert revoke.status_code == 200
            assert "revokedAt" in revoke.json()

            # 4. Assert WS client received the revoked message
            msg = ws.receive_json()
            assert msg == {"type": "revoked"}
