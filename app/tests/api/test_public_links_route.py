"""COL-V3-03 — Public link route tests.

Stub FastAPI app pattern (same as test_activity_route.py).
No live DB required — in-memory public link store.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.public_links import generate_link_token, hash_link_password, verify_link_password

MODEL_ID = str(uuid.uuid4())
UNKNOWN_MODEL_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Stub app
# ---------------------------------------------------------------------------


def _build_test_app() -> tuple[FastAPI, dict[str, Any]]:
    """Build a stub app with in-memory public link + model stores."""
    _models: dict[str, dict[str, Any]] = {
        MODEL_ID: {"revision": 1, "elements": {}, "violations": []}
    }
    _links: dict[str, dict[str, Any]] = {}  # link_id -> link dict
    _token_index: dict[str, str] = {}  # token -> link_id

    app = FastAPI()

    @app.post("/api/models/{model_id}/public-links")
    async def create_public_link(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        now_ms = int(time.time() * 1000)
        link_id = uuid.uuid4().hex
        token = generate_link_token()
        password_hash = hash_link_password(body["password"]) if body.get("password") else None

        link = {
            "id": link_id,
            "modelId": model_id,
            "token": token,
            "createdBy": "local-dev",
            "createdAt": now_ms,
            "expiresAt": body.get("expiresAt"),
            "passwordHash": password_hash,
            "isRevoked": False,
            "displayName": body.get("displayName"),
            "openCount": 0,
        }
        _links[link_id] = link
        _token_index[token] = link_id
        return {k: v for k, v in link.items() if k != "passwordHash"}

    @app.get("/api/models/{model_id}/public-links")
    async def list_public_links(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        active = [
            {k: v for k, v in lnk.items() if k != "passwordHash"}
            for lnk in _links.values()
            if lnk["modelId"] == model_id and not lnk["isRevoked"]
        ]
        return {"links": active}

    @app.post("/api/models/{model_id}/public-links/{link_id}/revoke")
    async def revoke_public_link(model_id: str, link_id: str) -> Any:
        from fastapi import HTTPException

        if link_id not in _links or _links[link_id]["modelId"] != model_id:
            raise HTTPException(status_code=404, detail="Public link not found")

        _links[link_id]["isRevoked"] = True
        return {"revoked": link_id}

    @app.get("/api/shared/{token}")
    async def resolve_shared_token(token: str) -> Any:
        from fastapi import HTTPException

        link_id = _token_index.get(token)
        if link_id is None:
            raise HTTPException(status_code=410, detail="Link not found or revoked")

        link = _links[link_id]
        if link["isRevoked"]:
            raise HTTPException(status_code=410, detail="Link not found or revoked")

        now_ms = int(time.time() * 1000)
        if link["expiresAt"] is not None and link["expiresAt"] < now_ms:
            raise HTTPException(status_code=410, detail="Link has expired")

        link["openCount"] += 1

        model = _models[link["modelId"]]
        return {
            "modelId": link["modelId"],
            "revision": model["revision"],
            "elements": model["elements"],
            "violations": model["violations"],
            "publicLink": {
                "id": link["id"],
                "displayName": link["displayName"],
                "openCount": link["openCount"],
            },
        }

    @app.post("/api/shared/{token}/verify-password")
    async def verify_password(token: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        link_id = _token_index.get(token)
        if link_id is None:
            raise HTTPException(status_code=404, detail="Public link not found")

        link = _links[link_id]
        if link["passwordHash"] is None:
            return {"ok": True}

        return {"ok": verify_link_password(body["password"], link["passwordHash"])}

    return app, _links


@pytest.fixture()
def app_and_links() -> tuple[FastAPI, dict[str, Any]]:
    return _build_test_app()


@pytest.fixture()
def client(app_and_links: tuple[FastAPI, dict[str, Any]]) -> TestClient:
    app, _ = app_and_links
    return TestClient(app)


@pytest.fixture()
def links(app_and_links: tuple[FastAPI, dict[str, Any]]) -> dict[str, Any]:
    _, lnks = app_and_links
    return lnks


# ---------------------------------------------------------------------------
# generate_link_token unit tests
# ---------------------------------------------------------------------------


def test_generate_link_token_generates_distinct_tokens() -> None:
    t1 = generate_link_token()
    t2 = generate_link_token()
    assert t1 != t2
    assert len(t1) > 0
    assert len(t2) > 0


# ---------------------------------------------------------------------------
# POST /public-links
# ---------------------------------------------------------------------------


class TestCreatePublicLink:
    def test_creates_link_with_unique_token(self, client: TestClient, links: dict) -> None:
        res1 = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        res2 = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        assert res1.status_code == 200
        assert res2.status_code == 200
        assert res1.json()["token"] != res2.json()["token"]
        assert len(links) == 2

    def test_response_contains_expected_fields(self, client: TestClient) -> None:
        res = client.post(
            f"/api/models/{MODEL_ID}/public-links",
            json={"displayName": "Test User"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["isRevoked"] is False
        assert body["openCount"] == 0
        assert body["displayName"] == "Test User"
        assert "token" in body
        assert "id" in body

    def test_404_unknown_model(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{UNKNOWN_MODEL_ID}/public-links", json={})
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# GET /public-links
# ---------------------------------------------------------------------------


class TestListPublicLinks:
    def test_returns_created_link(self, client: TestClient) -> None:
        client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        res = client.get(f"/api/models/{MODEL_ID}/public-links")
        assert res.status_code == 200
        assert len(res.json()["links"]) >= 1

    def test_does_not_return_revoked_links(self, client: TestClient) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        link_id = create_res.json()["id"]
        client.post(f"/api/models/{MODEL_ID}/public-links/{link_id}/revoke")
        res = client.get(f"/api/models/{MODEL_ID}/public-links")
        assert res.status_code == 200
        ids = [lnk["id"] for lnk in res.json()["links"]]
        assert link_id not in ids


# ---------------------------------------------------------------------------
# POST /public-links/{link_id}/revoke
# ---------------------------------------------------------------------------


class TestRevokePublicLink:
    def test_sets_is_revoked_true(self, client: TestClient, links: dict) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        link_id = create_res.json()["id"]

        revoke_res = client.post(
            f"/api/models/{MODEL_ID}/public-links/{link_id}/revoke"
        )
        assert revoke_res.status_code == 200
        assert revoke_res.json()["revoked"] == link_id
        assert links[link_id]["isRevoked"] is True

    def test_404_unknown_link(self, client: TestClient) -> None:
        res = client.post(f"/api/models/{MODEL_ID}/public-links/bad-id/revoke")
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# GET /shared/{token}
# ---------------------------------------------------------------------------


class TestResolveSharedToken:
    def test_returns_model_document(self, client: TestClient) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        token = create_res.json()["token"]

        res = client.get(f"/api/shared/{token}")
        assert res.status_code == 200
        body = res.json()
        assert body["modelId"] == MODEL_ID
        assert "elements" in body
        assert "revision" in body

    def test_increments_open_count(self, client: TestClient, links: dict) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        token = create_res.json()["token"]
        link_id = create_res.json()["id"]

        client.get(f"/api/shared/{token}")
        client.get(f"/api/shared/{token}")
        assert links[link_id]["openCount"] == 2

    def test_revoked_token_returns_410(self, client: TestClient) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        link_id = create_res.json()["id"]
        token = create_res.json()["token"]

        client.post(f"/api/models/{MODEL_ID}/public-links/{link_id}/revoke")

        res = client.get(f"/api/shared/{token}")
        assert res.status_code == 410

    def test_expired_token_returns_410(self, client: TestClient) -> None:
        past_ms = int(time.time() * 1000) - 60_000
        create_res = client.post(
            f"/api/models/{MODEL_ID}/public-links",
            json={"expiresAt": past_ms},
        )
        token = create_res.json()["token"]

        res = client.get(f"/api/shared/{token}")
        assert res.status_code == 410

    def test_unknown_token_returns_410(self, client: TestClient) -> None:
        res = client.get("/api/shared/no-such-token")
        assert res.status_code == 410


# ---------------------------------------------------------------------------
# POST /shared/{token}/verify-password
# ---------------------------------------------------------------------------


class TestVerifyPassword:
    def test_correct_password_returns_ok_true(self, client: TestClient) -> None:
        create_res = client.post(
            f"/api/models/{MODEL_ID}/public-links",
            json={"password": "s3cr3t"},
        )
        token = create_res.json()["token"]

        res = client.post(f"/api/shared/{token}/verify-password", json={"password": "s3cr3t"})
        assert res.status_code == 200
        assert res.json()["ok"] is True

    def test_wrong_password_returns_ok_false(self, client: TestClient) -> None:
        create_res = client.post(
            f"/api/models/{MODEL_ID}/public-links",
            json={"password": "s3cr3t"},
        )
        token = create_res.json()["token"]

        res = client.post(
            f"/api/shared/{token}/verify-password", json={"password": "wrong"}
        )
        assert res.status_code == 200
        assert res.json()["ok"] is False

    def test_no_password_link_returns_ok_true(self, client: TestClient) -> None:
        create_res = client.post(f"/api/models/{MODEL_ID}/public-links", json={})
        token = create_res.json()["token"]

        res = client.post(
            f"/api/shared/{token}/verify-password", json={"password": "anything"}
        )
        assert res.status_code == 200
        assert res.json()["ok"] is True
