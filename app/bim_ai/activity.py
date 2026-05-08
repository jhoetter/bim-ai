from __future__ import annotations

import time
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.tables import ActivityRowRecord

ActivityKind = Literal[
    "commit",
    "comment_created",
    "comment_resolved",
    "markup_created",
    "markup_resolved",
    "milestone_created",
    "option_set_lifecycle",
    "collab_join",
    "collab_leave",
    "sheet_comment_chip",
]


class SheetCommentChipEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["sheet_comment_chip"] = "sheet_comment_chip"
    view_id: str = Field(alias="viewId")
    sheet_id: str = Field(alias="sheetId")
    comment_id: str = Field(alias="commentId")
    sheet_number: str = Field(default="", alias="sheetNumber")


class ActivityRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    model_id: str = Field(alias="modelId")
    author_id: str = Field(alias="authorId")
    kind: ActivityKind
    payload: dict[str, Any] = Field(default_factory=dict)
    ts: int
    parent_snapshot_id: str | None = Field(default=None, alias="parentSnapshotId")
    result_snapshot_id: str | None = Field(default=None, alias="resultSnapshotId")


async def emit_activity_row(
    session: AsyncSession,
    *,
    model_id: str,
    author_id: str,
    kind: ActivityKind,
    payload: dict[str, Any],
    parent_snapshot_id: str | None = None,
    result_snapshot_id: str | None = None,
) -> ActivityRow:
    """Persist one activity row and return it."""
    row = ActivityRowRecord(
        id=str(uuid4()),
        model_id=model_id,
        author_id=author_id,
        kind=kind,
        payload=payload,
        ts=int(time.time() * 1000),
        parent_snapshot_id=parent_snapshot_id,
        result_snapshot_id=result_snapshot_id,
    )
    session.add(row)
    await session.flush()
    return ActivityRow(
        id=row.id,
        modelId=row.model_id,
        authorId=row.author_id,
        kind=row.kind,
        payload=dict(row.payload),
        ts=row.ts,
        parentSnapshotId=row.parent_snapshot_id,
        resultSnapshotId=row.result_snapshot_id,
    )
