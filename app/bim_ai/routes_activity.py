from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.hub import Hub
from bim_ai.routes_deps import get_hub, load_model_row
from bim_ai.tables import CommentRecord, UndoStackRecord

activity_router = APIRouter()


class CommentCreateBody(BaseModel):
    model_config = {"populate_by_name": True}

    user_display: str = Field(alias="userDisplay")
    body: str
    element_id: str | None = Field(default=None, alias="elementId")
    level_id: str | None = Field(default=None, alias="levelId")
    anchor_x_mm: float | None = Field(default=None, alias="anchorXMm")
    anchor_y_mm: float | None = Field(default=None, alias="anchorYMm")


class CommentResolveBody(BaseModel):
    resolved: bool = True


def _wire_comment(row: CommentRecord) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "modelId": str(row.model_id),
        "userDisplay": row.user_display,
        "body": row.body,
        "elementId": row.element_id,
        "levelId": row.level_id,
        "anchorXMm": row.anchor_x_mm,
        "anchorYMm": row.anchor_y_mm,
        "resolved": row.resolved,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
    }


@activity_router.get("/models/{model_id}/activity")
async def model_activity(
    model_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    res = await session.execute(
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id)
        .order_by(desc(UndoStackRecord.id))
        .limit(50),
    )
    rows = res.scalars().all()
    events: list[dict[str, Any]] = []

    for u in rows:
        forwards = list(u.forward_commands)
        summaries: list[str] = []
        for cmd in forwards:
            if isinstance(cmd, dict):
                summaries.append(str(cmd.get("type", "?")))
            else:
                summaries.append("?")

        events.append(
            {
                "id": u.id,
                "userId": u.user_id,
                "revisionAfter": u.revision_after,
                "createdAt": u.created_at.isoformat(),
                "commandTypes": summaries,
            },
        )

    return {"modelId": str(model_id), "events": events}


@activity_router.get("/models/{model_id}/comments")
async def list_comments(
    model_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    res = await session.execute(
        select(CommentRecord)
        .where(CommentRecord.model_id == model_id)
        .order_by(desc(CommentRecord.created_at)),
    )
    crs = list(res.scalars().all())

    return {
        "modelId": str(model_id),
        "comments": [_wire_comment(c) for c in crs],
    }


@activity_router.post("/models/{model_id}/comments")
async def create_comment(
    model_id: UUID,
    body: CommentCreateBody,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)

    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    cid = uuid4()

    now = datetime.now(UTC)

    crow = CommentRecord(
        id=cid,
        model_id=model_id,
        user_display=body.user_display,
        body=body.body.strip(),
        element_id=body.element_id,
        level_id=body.level_id,
        anchor_x_mm=body.anchor_x_mm,
        anchor_y_mm=body.anchor_y_mm,
        resolved=False,
        created_at=now,
        updated_at=now,
    )

    session.add(crow)

    await session.commit()

    wired = _wire_comment(crow)

    await hub.broadcast_json(
        model_id, {"type": "comment_event", "modelId": str(model_id), "payload": wired}
    )

    return wired


@activity_router.patch("/models/{model_id}/comments/{comment_id}")
async def patch_comment(
    model_id: UUID,
    comment_id: UUID,
    body: CommentResolveBody,
    session: AsyncSession = Depends(get_session),
    hub: Hub = Depends(get_hub),
) -> dict[str, Any]:

    row_c = await session.get(CommentRecord, comment_id)

    if row_c is None or row_c.model_id != model_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    row_c.resolved = body.resolved

    row_c.updated_at = datetime.now(UTC)

    session.add(row_c)

    await session.commit()

    wired = _wire_comment(row_c)

    await hub.broadcast_json(
        model_id, {"type": "comment_event", "modelId": str(model_id), "payload": wired}
    )

    return wired
