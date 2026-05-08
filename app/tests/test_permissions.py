"""COL-V3-02 — permission tier tests."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from bim_ai.permissions import authorize_command


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


def test_public_link_viewer_cannot_resolve_comment_via_markup() -> None:
    assert authorize_command("public-link-viewer", "createMarkup") is False


# ---------------------------------------------------------------------------
# Integration — API gate via POST /bundles
# ---------------------------------------------------------------------------


@pytest.fixture()
def _seed_model(test_client: AsyncClient, project_model):  # type: ignore[no-untyped-def]
    """Return (project_id, model_id) for a fresh model."""
    return project_model


@pytest.mark.asyncio
async def test_viewer_forbidden_to_create_wall(
    async_client: AsyncClient,
    test_db_session,
    project_model,
) -> None:
    """A viewer role record blocks createWall with HTTP 403."""
    from bim_ai.tables import RoleAssignmentRecord

    project_id, model_id = project_model

    # Insert a viewer role for user "viewer-user"
    now_ms = int(time.time() * 1000)
    test_db_session.add(
        RoleAssignmentRecord(
            id="test-viewer-1",
            model_id=str(model_id),
            subject_kind="user",
            subject_id="viewer-user",
            role="viewer",
            granted_by="admin",
            granted_at=now_ms,
            expires_at=None,
        )
    )
    await test_db_session.commit()

    resp = await async_client.post(
        f"/api/models/{model_id}/bundles",
        json={
            "bundle": {
                "commands": [
                    {
                        "type": "createWall",
                        "name": "W1",
                        "levelId": "l1",
                        "start": {"xMm": 0, "yMm": 0},
                        "end": {"xMm": 1000, "yMm": 0},
                        "thicknessMm": 200,
                        "heightMm": 2800,
                    }
                ],
                "bundleId": "test-bundle",
            },
            "mode": "dry_run",
            "userId": "viewer-user",
        },
    )
    assert resp.status_code == 403
    assert "viewer" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_viewer_allowed_to_create_comment(
    async_client: AsyncClient,
    test_db_session,
    project_model,
) -> None:
    """A viewer role record allows createComment."""
    from bim_ai.tables import RoleAssignmentRecord

    project_id, model_id = project_model

    now_ms = int(time.time() * 1000)
    test_db_session.add(
        RoleAssignmentRecord(
            id="test-viewer-2",
            model_id=str(model_id),
            subject_kind="user",
            subject_id="viewer-user-2",
            role="viewer",
            granted_by="admin",
            granted_at=now_ms,
            expires_at=None,
        )
    )
    await test_db_session.commit()

    resp = await async_client.post(
        f"/api/models/{model_id}/bundles",
        json={
            "bundle": {
                "commands": [
                    {
                        "type": "createComment",
                        "body": "Nice design!",
                    }
                ],
                "bundleId": "test-bundle-2",
            },
            "mode": "dry_run",
            "userId": "viewer-user-2",
        },
    )
    # createComment is allowed by viewer; should not 403 (may 404/422 on engine validation)
    assert resp.status_code != 403


@pytest.mark.asyncio
async def test_no_role_record_defaults_to_admin(
    async_client: AsyncClient,
    project_model,
) -> None:
    """No role record means admin (backwards compat); createWall is allowed."""
    project_id, model_id = project_model

    resp = await async_client.post(
        f"/api/models/{model_id}/bundles",
        json={
            "bundle": {
                "commands": [
                    {
                        "type": "createWall",
                        "name": "W1",
                        "levelId": "l1",
                        "start": {"xMm": 0, "yMm": 0},
                        "end": {"xMm": 1000, "yMm": 0},
                        "thicknessMm": 200,
                        "heightMm": 2800,
                    }
                ],
                "bundleId": "test-bundle-admin",
            },
            "mode": "dry_run",
            "userId": "unknown-dev-user",
        },
    )
    # Should not 403 — may fail on engine validation (404 model levels etc.), but not forbidden
    assert resp.status_code != 403


# ---------------------------------------------------------------------------
# Integration — public-link token
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_link_token_creation_and_role(
    async_client: AsyncClient,
    test_db_session,
    project_model,
) -> None:
    """POST /public-link creates a token; resolving it returns public-link-viewer role."""
    from bim_ai.permissions import authorize_command
    from bim_ai.routes_api import _resolve_token_role

    project_id, model_id = project_model

    resp = await async_client.post(f"/api/models/{model_id}/public-link", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    token = data["token"]
    assert len(token) > 10

    # Resolve the token directly via helper
    role = await _resolve_token_role(test_db_session, str(model_id), token)
    assert role == "public-link-viewer"
    assert authorize_command(role, "createComment") is True
    assert authorize_command(role, "createWall") is False


@pytest.mark.asyncio
async def test_expired_public_link_token_raises_403(
    async_client: AsyncClient,
    test_db_session,
    project_model,
) -> None:
    """An already-expired token raises HTTP 403."""
    from fastapi import HTTPException

    from bim_ai.routes_api import _resolve_token_role
    from bim_ai.tables import RoleAssignmentRecord

    project_id, model_id = project_model

    # Token that expired 1 minute ago
    now_ms = int(time.time() * 1000)
    expired_ms = now_ms - 60_000
    test_db_session.add(
        RoleAssignmentRecord(
            id="test-expired-token",
            model_id=str(model_id),
            subject_kind="public-link",
            subject_id="expired-token-value",
            role="public-link-viewer",
            granted_by="admin",
            granted_at=now_ms - 120_000,
            expires_at=expired_ms,
        )
    )
    await test_db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await _resolve_token_role(test_db_session, str(model_id), "expired-token-value")
    assert exc_info.value.status_code == 403
    assert "expired" in exc_info.value.detail.lower()
