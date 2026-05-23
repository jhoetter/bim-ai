"""VER-V3-02 — named milestone routes extracted from routes/api.py (BRT-24).

Exposes:

- ``POST   /api/models/{model_id}/milestones``
- ``GET    /api/models/{model_id}/milestones``
- ``DELETE /api/models/{model_id}/milestones/{milestone_id}``
"""

from __future__ import annotations

import time
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.activity import emit_activity_row
from bim_ai.db import get_session
from bim_ai.milestones import CreateMilestoneBody
from bim_ai.routes.deps import load_model_row
from bim_ai.tables import MilestoneRecord

milestones_router = APIRouter()


@milestones_router.post("/models/{model_id}/milestones")
async def create_milestone(
    model_id: UUID,
    body: CreateMilestoneBody,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """VER-V3-02: create a named milestone pinned to a snapshot id."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    milestone_id = str(uuid4())
    now_ms = int(time.time() * 1000)
    record = MilestoneRecord(
        id=milestone_id,
        model_id=str(model_id),
        name=body.name,
        description=body.description,
        snapshot_id=body.snapshot_id,
        author_id=body.author_id,
        created_at=now_ms,
    )
    session.add(record)
    await session.flush()

    await emit_activity_row(
        session,
        model_id=str(model_id),
        author_id=body.author_id,
        kind="milestone_created",
        payload={"name": body.name, "milestoneId": milestone_id},
    )
    await session.commit()

    return {
        "id": milestone_id,
        "modelId": str(model_id),
        "name": body.name,
        "description": body.description,
        "snapshotId": body.snapshot_id,
        "authorId": body.author_id,
        "createdAt": now_ms,
    }


@milestones_router.get("/models/{model_id}/milestones")
async def list_milestones(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """VER-V3-02: list all milestones for a model, descending createdAt."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    res = await session.execute(
        select(MilestoneRecord)
        .where(MilestoneRecord.model_id == str(model_id))
        .order_by(desc(MilestoneRecord.created_at))
    )
    milestones = res.scalars().all()

    return {
        "modelId": str(model_id),
        "milestones": [
            {
                "id": m.id,
                "modelId": m.model_id,
                "name": m.name,
                "description": m.description,
                "snapshotId": m.snapshot_id,
                "authorId": m.author_id,
                "createdAt": m.created_at,
            }
            for m in milestones
        ],
    }


@milestones_router.delete("/models/{model_id}/milestones/{milestone_id}")
async def delete_milestone(
    model_id: UUID,
    milestone_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """VER-V3-02: delete a milestone by id."""
    res = await session.execute(
        select(MilestoneRecord).where(
            MilestoneRecord.id == milestone_id,
            MilestoneRecord.model_id == str(model_id),
        )
    )
    record = res.scalars().first()
    if record is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    await session.delete(record)
    await session.commit()
    return {"deleted": milestone_id}
