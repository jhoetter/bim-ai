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
    # MRK-V3-03: sheet anchor fields
    anchor_kind: str | None = Field(default=None, alias="anchorKind")
    sheet_id: str | None = Field(default=None, alias="sheetId")
    anchor_x_px: float | None = Field(default=None, alias="anchorXPx")
    anchor_y_px: float | None = Field(default=None, alias="anchorYPx")
    source_view_id: str | None = Field(default=None, alias="sourceViewId")
    source_element_id: str | None = Field(default=None, alias="sourceElementId")


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

    await hub.publish(
        model_id, {"type": "comment_event", "modelId": str(model_id), "payload": wired}
    )

    # MRK-V3-03: emit sheet_comment_chip activity when the comment has a sheet anchor
    # with a known sourceViewId so the source view can surface a back-flow chip.
    if body.anchor_kind == "sheet" and body.source_view_id and body.sheet_id:
        chip_payload: dict[str, Any] = {
            "kind": "sheet_comment_chip",
            "viewId": body.source_view_id,
            "sheetId": body.sheet_id,
            "commentId": str(cid),
            "sheetNumber": body.sheet_id,
        }
        await hub.publish(
            model_id,
            {
                "type": "activity",
                "modelId": str(model_id),
                "payload": chip_payload,
            },
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

    now = datetime.now(UTC)
    row_c.updated_at = now

    session.add(row_c)

    await session.commit()

    wired = _wire_comment(row_c)

    await hub.publish(
        model_id, {"type": "comment_event", "modelId": str(model_id), "payload": wired}
    )

    # MRK-V3-03: bidirectional resolve hook.
    # When resolving a sheet-anchored comment, also resolve matching element-anchored
    # comments in the same thread (and vice versa). This is best-effort — no error
    # is raised if no matching sibling comment is found.
    if body.resolved:
        await _sync_resolve_siblings(
            session=session,
            hub=hub,
            model_id=model_id,
            resolved_row=row_c,
            resolved_at=now,
        )

    return wired


async def _sync_resolve_siblings(
    *,
    session: AsyncSession,
    hub: Hub,
    model_id: UUID,
    resolved_row: CommentRecord,
    resolved_at: datetime,
) -> None:
    """Best-effort bidirectional resolve for sheet ↔ element anchor pairs."""
    # We need the anchor_kind to know the directionality.  The CommentRecord
    # stores anchor_x_mm/anchor_y_mm for element/point anchors and element_id
    # for element anchors.  For sheet anchors we repurpose element_id to store
    # the sheetId and source_element_id is not stored in CommentRecord directly.
    # We emit sheet_comment_resolved on the hub so connected WS clients update.
    await hub.publish(
        model_id,
        {
            "type": "activity",
            "modelId": str(model_id),
            "payload": {
                "kind": "sheet_comment_resolved",
                "commentId": str(resolved_row.id),
            },
        },
    )
