"""Role management, public-link, and shared-token routes.

Routes mounted here cover ``/api/models/{model_id}/roles``,
``/api/models/{model_id}/public-link``, ``/api/models/{model_id}/public-links``,
and ``/api/shared/{token}`` plus ``/api/shared/{token}/verify-password``.
"""

from __future__ import annotations

# ruff: noqa: B008
import secrets
import time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.routes_deps import load_model_row, resolve_caller_role, violations_wire
from bim_ai.tables import (
    PublicLinkRecord,
    RoleAssignmentRecord,
)

sharing_router = APIRouter()


# ---------------------------------------------------------------------------
# COL-V3-02 — role management + public-link share routes
# ---------------------------------------------------------------------------


class GrantRoleBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    subject_kind: str = Field(alias="subjectKind")
    subject_id: str = Field(alias="subjectId")
    role: str
    expires_at: int | None = Field(default=None, alias="expiresAt")


class CreatePublicLinkBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    expires_at: int | None = Field(default=None, alias="expiresAt")


@sharing_router.get("/models/{model_id}/roles")
async def list_roles(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-02: list all role assignments for a model."""
    res = await session.execute(
        select(RoleAssignmentRecord).where(RoleAssignmentRecord.model_id == str(model_id))
    )
    rows = res.scalars().all()
    return {
        "roles": [
            {
                "id": r.id,
                "modelId": r.model_id,
                "subjectKind": r.subject_kind,
                "subjectId": r.subject_id,
                "role": r.role,
                "grantedBy": r.granted_by,
                "grantedAt": r.granted_at,
                "expiresAt": r.expires_at,
            }
            for r in rows
        ]
    }


@sharing_router.post("/models/{model_id}/roles")
async def grant_role(
    model_id: UUID,
    body: GrantRoleBody,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-02: grant a role to a subject. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can grant roles")
    now_ms = int(time.time() * 1000)
    assignment_id = secrets.token_urlsafe(16)
    record = RoleAssignmentRecord(
        id=assignment_id,
        model_id=str(model_id),
        subject_kind=body.subject_kind,
        subject_id=body.subject_id,
        role=body.role,
        granted_by=user_id,
        granted_at=now_ms,
        expires_at=body.expires_at,
    )
    session.add(record)
    await session.commit()
    return {
        "id": assignment_id,
        "modelId": str(model_id),
        "subjectKind": body.subject_kind,
        "subjectId": body.subject_id,
        "role": body.role,
        "grantedBy": user_id,
        "grantedAt": now_ms,
        "expiresAt": body.expires_at,
    }


@sharing_router.delete("/models/{model_id}/roles/{assignment_id}")
async def revoke_role(
    model_id: UUID,
    assignment_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-02: revoke a role assignment. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can revoke roles")
    res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.id == assignment_id,
            RoleAssignmentRecord.model_id == str(model_id),
        )
    )
    record = res.scalars().first()
    if record is None:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    await session.delete(record)
    await session.commit()
    return {"deleted": assignment_id}


@sharing_router.post("/models/{model_id}/public-link")
async def create_public_link(
    model_id: UUID,
    body: CreatePublicLinkBody,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-02: create a public-link token for viewer access. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create public links")
    token = secrets.token_urlsafe(32)
    now_ms = int(time.time() * 1000)
    assignment_id = secrets.token_urlsafe(16)
    record = RoleAssignmentRecord(
        id=assignment_id,
        model_id=str(model_id),
        subject_kind="public-link",
        subject_id=token,
        role="public-link-viewer",
        granted_by=user_id,
        granted_at=now_ms,
        expires_at=body.expires_at,
    )
    session.add(record)
    await session.commit()
    url = f"/api/models/{model_id}/snapshot?token={token}"
    return {"token": token, "url": url, "assignmentId": assignment_id}


# ---------------------------------------------------------------------------
# COL-V3-03 — Shareable public link
# ---------------------------------------------------------------------------


class CreatePublicLinkBodyV3(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    display_name: str | None = Field(default=None, alias="displayName")
    expires_at: int | None = Field(default=None, alias="expiresAt")
    password: str | None = Field(default=None)


class VerifyPasswordBody(BaseModel):
    password: str


@sharing_router.post("/models/{model_id}/public-links")
async def create_public_link_v3(
    model_id: UUID,
    body: CreatePublicLinkBodyV3,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-03: create a public link with optional expiry and password. Admin only."""
    from bim_ai.public_links import generate_link_token, hash_link_password

    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create public links")

    now_ms = int(time.time() * 1000)
    link_id = secrets.token_urlsafe(16)
    token = generate_link_token()
    password_hash = hash_link_password(body.password) if body.password else None

    link_record = PublicLinkRecord(
        id=link_id,
        model_id=str(model_id),
        token=token,
        created_by=user_id,
        created_at=now_ms,
        expires_at=body.expires_at,
        password_hash=password_hash,
        is_revoked=False,
        display_name=body.display_name,
        open_count=0,
    )
    session.add(link_record)

    assignment_id = secrets.token_urlsafe(16)
    role_record = RoleAssignmentRecord(
        id=assignment_id,
        model_id=str(model_id),
        subject_kind="public-link",
        subject_id=token,
        role="public-link-viewer",
        granted_by=user_id,
        granted_at=now_ms,
        expires_at=body.expires_at,
    )
    session.add(role_record)
    await session.commit()

    return {
        "id": link_id,
        "modelId": str(model_id),
        "token": token,
        "createdBy": user_id,
        "createdAt": now_ms,
        "expiresAt": body.expires_at,
        "isRevoked": False,
        "displayName": body.display_name,
        "openCount": 0,
    }


@sharing_router.get("/models/{model_id}/public-links")
async def list_public_links(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-03: list non-revoked public links for a model."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.is_revoked.is_(False),
        )
    )
    records = res.scalars().all()
    return {
        "links": [
            {
                "id": r.id,
                "modelId": r.model_id,
                "token": r.token,
                "createdBy": r.created_by,
                "createdAt": r.created_at,
                "expiresAt": r.expires_at,
                "isRevoked": r.is_revoked,
                "displayName": r.display_name,
                "openCount": r.open_count,
            }
            for r in records
        ]
    }


@sharing_router.post("/models/{model_id}/public-links/{link_id}/revoke")
async def revoke_public_link(
    model_id: UUID,
    link_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """COL-V3-03: revoke a public link and delete its RoleAssignment. Admin only."""
    caller_role = await resolve_caller_role(session, model_id, user_id)
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can revoke public links")

    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.id == link_id,
            PublicLinkRecord.model_id == str(model_id),
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Public link not found")

    link_record.is_revoked = True

    role_res = await session.execute(
        select(RoleAssignmentRecord).where(
            RoleAssignmentRecord.model_id == str(model_id),
            RoleAssignmentRecord.subject_kind == "public-link",
            RoleAssignmentRecord.subject_id == link_record.token,
        )
    )
    role_record = role_res.scalars().first()
    if role_record is not None:
        await session.delete(role_record)

    await session.commit()
    return {"revoked": link_id}


@sharing_router.get("/shared/{token}")
async def resolve_shared_token(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-03: resolve a public link token and return the model document."""
    now_ms = int(time.time() * 1000)
    res = await session.execute(select(PublicLinkRecord).where(PublicLinkRecord.token == token))
    link_record = res.scalars().first()
    if link_record is None or link_record.is_revoked:
        raise HTTPException(status_code=410, detail="Link not found or revoked")
    if link_record.expires_at is not None and link_record.expires_at < now_ms:
        raise HTTPException(status_code=410, detail="Link has expired")

    try:
        from sqlalchemy import update as sa_update

        await session.execute(
            sa_update(PublicLinkRecord)
            .where(PublicLinkRecord.id == link_record.id)
            .values(open_count=PublicLinkRecord.open_count + 1)
        )
        await session.commit()
    except Exception:
        pass

    try:
        model_uuid = UUID(link_record.model_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Model not found") from None

    row = await load_model_row(session, model_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)
    elements_wire = {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}
    return {
        "modelId": str(row.id),
        "revision": doc.revision,
        "elements": elements_wire,
        "violations": violations_wire(doc.elements),
        "publicLink": {
            "id": link_record.id,
            "displayName": link_record.display_name,
            "openCount": link_record.open_count,
        },
    }


@sharing_router.post("/shared/{token}/verify-password")
async def verify_public_link_password(
    token: str,
    body: VerifyPasswordBody,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """COL-V3-03: verify the password for a public link."""
    res = await session.execute(select(PublicLinkRecord).where(PublicLinkRecord.token == token))
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Public link not found")

    if link_record.password_hash is None:
        return {"ok": True}

    from bim_ai.public_links import verify_link_password

    return {"ok": verify_link_password(body.password, link_record.password_hash)}

