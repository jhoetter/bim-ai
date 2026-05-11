"""COL-V3-02 — permission tier tests.

Pure unit tests run against authorize_command directly.
Integration tests use a stub FastAPI app with an in-memory role store
(no live DB required), following the same pattern as test_apply_bundle_route.py.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException, Query
from fastapi.testclient import TestClient
from pydantic import BaseModel

from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin
from bim_ai.permissions import RoleAssignment, authorize_command, comment_anchor_scope

MODEL_ID = str(uuid.uuid4())

# ---------------------------------------------------------------------------
# Unit — authorize_command
# ---------------------------------------------------------------------------


def test_admin_can_create_wall() -> None:
    assert authorize_command("admin", "createWall") is True


def test_viewer_cannot_create_wall() -> None:
    assert authorize_command("viewer", "createWall") is False


def test_viewer_can_create_comment() -> None:
    assert authorize_command("viewer", "createComment") is True


def test_public_link_viewer_can_create_comment() -> None:
    assert authorize_command("public-link-viewer", "createComment") is True


def test_public_link_viewer_cannot_create_wall() -> None:
    assert authorize_command("public-link-viewer", "createWall") is False


def test_editor_can_create_wall() -> None:
    assert authorize_command("editor", "createWall") is True


def test_editor_can_create_comment() -> None:
    assert authorize_command("editor", "createComment") is True


def test_admin_wildcard_covers_unknown_verb() -> None:
    assert authorize_command("admin", "someUnknownVerb") is True


def test_public_link_viewer_cannot_create_markup() -> None:
    assert authorize_command("public-link-viewer", "createMarkup") is False


def test_role_assignment_accepts_discipline_restriction_alias() -> None:
    assignment = RoleAssignment.model_validate(
        {
            "id": "role-1",
            "modelId": MODEL_ID,
            "subjectKind": "user",
            "subjectId": "struct-reviewer",
            "role": "viewer",
            "disciplineRestriction": "struct",
            "grantedBy": "admin",
            "grantedAt": 1,
        }
    )
    assert assignment.discipline_restriction == "struct"


class _ScopedElement(BaseModel):
    kind: str
    discipline: str | None = None


def test_discipline_restricted_comment_scope_warns_cross_discipline_anchor() -> None:
    arch_wall = _ScopedElement(kind="wall", discipline="arch")
    struct_column = _ScopedElement(kind="column", discipline=None)

    assert comment_anchor_scope("struct", struct_column) == "in_scope"
    assert comment_anchor_scope("struct", arch_wall) == "cross_discipline_warning"
    assert comment_anchor_scope(None, arch_wall) == "in_scope"


# ---------------------------------------------------------------------------
# Stub app for integration tests
# ---------------------------------------------------------------------------

# In-memory role store: model_id -> list of role records
_ROLES: dict[str, list[dict[str, Any]]] = {}
# In-memory model store
_MODELS: dict[str, Document] = {}


def _seed_model(model_id: str) -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    _MODELS[model_id] = doc


def _seed_role(
    model_id: str,
    user_id: str,
    role: str,
    subject_kind: str = "user",
    expires_at: int | None = None,
) -> str:
    assignment_id = str(uuid.uuid4())
    _ROLES.setdefault(model_id, []).append(
        {
            "id": assignment_id,
            "model_id": model_id,
            "subject_kind": subject_kind,
            "subject_id": user_id,
            "role": role,
            "granted_by": "admin",
            "granted_at": int(time.time() * 1000),
            "expires_at": expires_at,
        }
    )
    return assignment_id


def _resolve_role(model_id: str, user_id: str) -> str:
    records = _ROLES.get(model_id, [])
    now_ms = int(time.time() * 1000)
    for r in records:
        if r["subject_kind"] == "user" and r["subject_id"] == user_id:
            if r["expires_at"] is None or r["expires_at"] > now_ms:
                return r["role"]
    return "admin"


def _resolve_token(model_id: str, token: str) -> str:
    records = _ROLES.get(model_id, [])
    now_ms = int(time.time() * 1000)
    for r in records:
        if r["subject_kind"] == "public-link" and r["subject_id"] == token:
            if r["expires_at"] is not None and r["expires_at"] < now_ms:
                raise HTTPException(status_code=403, detail="Public-link token has expired")
            return r["role"]
    raise HTTPException(status_code=403, detail="Invalid public-link token")


def _build_test_app() -> FastAPI:
    app = FastAPI()

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(
        model_id: str,
        body: dict[str, Any],
        token: str | None = Query(default=None),
    ) -> Any:
        if model_id not in _MODELS:
            raise HTTPException(status_code=404, detail="Model not found")

        user_id = body.get("userId") or "local-dev"
        if token:
            caller_role = _resolve_token(model_id, token)
        else:
            caller_role = _resolve_role(model_id, user_id)

        bundle_raw = body.get("bundle")
        if not isinstance(bundle_raw, dict):
            raise HTTPException(status_code=422, detail="bundle field required")

        # Permission gate runs on raw command types BEFORE full Pydantic validation
        # so that 403 fires before any 422 from schema errors.
        raw_commands = bundle_raw.get("commands", [])
        if isinstance(raw_commands, list):
            for raw_cmd in raw_commands:
                cmd_type = raw_cmd.get("type", "") if isinstance(raw_cmd, dict) else ""
                if not authorize_command(caller_role, str(cmd_type)):  # type: ignore[arg-type]
                    raise HTTPException(
                        status_code=403,
                        detail=f"Role '{caller_role}' is not permitted to execute '{cmd_type}'",
                    )

        try:
            bundle = CommandBundle.model_validate(bundle_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        mode = body.get("mode", "dry_run")
        if mode not in ("dry_run", "commit"):
            mode = "dry_run"
        doc = _MODELS[model_id]
        result, new_doc = _apply_bundle(doc, bundle, mode)  # type: ignore[arg-type]
        if result.applied and new_doc is not None:
            _MODELS[model_id] = new_doc
        return result.model_dump(by_alias=True)

    @app.post("/api/models/{model_id}/public-link")
    async def create_public_link(model_id: str, body: dict[str, Any]) -> Any:
        import secrets as _secrets

        token_val = _secrets.token_urlsafe(32)
        expires_at = body.get("expiresAt")
        _seed_role(
            model_id,
            token_val,
            "public-link-viewer",
            subject_kind="public-link",
            expires_at=expires_at,
        )
        return {"token": token_val, "url": f"/api/models/{model_id}/snapshot?token={token_val}"}

    return app


@pytest.fixture(autouse=True)
def _reset_stores() -> None:
    _ROLES.clear()
    _MODELS.clear()
    _seed_model(MODEL_ID)


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Integration — API gate
# ---------------------------------------------------------------------------


def test_viewer_forbidden_to_create_wall(client: TestClient) -> None:
    """Viewer role blocks createWall with HTTP 403."""
    _seed_role(MODEL_ID, "viewer-user", "viewer")

    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json={
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": [{"type": "createWall", "name": "W1"}],
                "assumptions": [],
            },
            "mode": "dry_run",
            "userId": "viewer-user",
        },
    )
    assert resp.status_code == 403
    assert "viewer" in resp.json()["detail"]


def test_viewer_allowed_to_create_comment(client: TestClient) -> None:
    """Viewer role passes createComment through the gate (may fail in engine, but not 403)."""
    _seed_role(MODEL_ID, "viewer-user", "viewer")

    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json={
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": [{"type": "createComment", "body": "Nice!"}],
                "assumptions": [],
            },
            "mode": "dry_run",
            "userId": "viewer-user",
        },
    )
    assert resp.status_code != 403


def test_no_role_record_defaults_to_admin(client: TestClient) -> None:
    """No role record means admin (backwards compat); createWall passes the gate."""
    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json={
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": [{"type": "createWall", "name": "W1"}],
                "assumptions": [],
            },
            "mode": "dry_run",
            "userId": "unknown-dev-user",
        },
    )
    assert resp.status_code != 403


# ---------------------------------------------------------------------------
# Integration — public-link token
# ---------------------------------------------------------------------------


def test_public_link_token_creation_and_role(client: TestClient) -> None:
    """POST /public-link creates a token that resolves to public-link-viewer."""
    resp = client.post(f"/api/models/{MODEL_ID}/public-link", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    token = data["token"]
    assert len(token) > 10

    # The token should resolve to public-link-viewer (blocks createWall)
    resp2 = client.post(
        f"/api/models/{MODEL_ID}/bundles?token={token}",
        json={
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": [{"type": "createWall", "name": "W1"}],
                "assumptions": [],
            },
            "mode": "dry_run",
        },
    )
    assert resp2.status_code == 403

    # …but allows createComment
    resp3 = client.post(
        f"/api/models/{MODEL_ID}/bundles?token={token}",
        json={
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": [{"type": "createComment", "body": "hello"}],
                "assumptions": [],
            },
            "mode": "dry_run",
        },
    )
    assert resp3.status_code != 403


def test_expired_public_link_token_raises_403(client: TestClient) -> None:
    """An already-expired public-link token is rejected with HTTP 403."""
    now_ms = int(time.time() * 1000)
    expired_ms = now_ms - 60_000
    token_val = "my-expired-test-token"
    _seed_role(
        MODEL_ID,
        token_val,
        "public-link-viewer",
        subject_kind="public-link",
        expires_at=expired_ms,
    )

    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles?token={token_val}",
        json={
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": [{"type": "createComment", "body": "hello"}],
                "assumptions": [],
            },
            "mode": "dry_run",
        },
    )
    assert resp.status_code == 403
    assert "expired" in resp.json()["detail"].lower()
