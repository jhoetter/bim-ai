from __future__ import annotations

import asyncio
import os
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from bim_ai.db import SessionMaker, engine, init_db_schema
from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin
from bim_ai.main import app as real_app
from bim_ai.routes_deps import document_to_wire
from bim_ai.tables import (
    ActivityRowRecord,
    CommentRecord,
    ModelRecord,
    ProjectRecord,
    RedoStackRecord,
    UndoStackRecord,
)

pytestmark = pytest.mark.integration


def _requires_db_real_path() -> None:
    if os.getenv("BIM_AI_RUN_DB_REAL_PATH") != "1":
        pytest.skip("set BIM_AI_RUN_DB_REAL_PATH=1 to run DB-backed real-path smoke")


async def _seed_model(project_id: UUID, model_id: UUID) -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    async with SessionMaker() as session:
        await session.execute(
            delete(ActivityRowRecord).where(ActivityRowRecord.model_id == str(model_id))
        )
        await session.execute(delete(CommentRecord).where(CommentRecord.model_id == model_id))
        await session.execute(delete(UndoStackRecord).where(UndoStackRecord.model_id == model_id))
        await session.execute(delete(RedoStackRecord).where(RedoStackRecord.model_id == model_id))
        await session.execute(delete(ModelRecord).where(ModelRecord.id == model_id))
        await session.execute(delete(ProjectRecord).where(ProjectRecord.id == project_id))
        session.add(ProjectRecord(id=project_id, slug=f"real-path-{project_id}", title="Real Path"))
        session.add(
            ModelRecord(
                id=model_id,
                project_id=project_id,
                slug="db-backed",
                revision=1,
                document=document_to_wire(doc),
            )
        )
        await session.commit()


async def _cleanup_model(project_id: UUID, model_id: UUID) -> None:
    async with SessionMaker() as session:
        await session.execute(
            delete(ActivityRowRecord).where(ActivityRowRecord.model_id == str(model_id))
        )
        await session.execute(delete(CommentRecord).where(CommentRecord.model_id == model_id))
        await session.execute(delete(UndoStackRecord).where(UndoStackRecord.model_id == model_id))
        await session.execute(delete(RedoStackRecord).where(RedoStackRecord.model_id == model_id))
        await session.execute(delete(ModelRecord).where(ModelRecord.id == model_id))
        await session.execute(delete(ProjectRecord).where(ProjectRecord.id == project_id))
        await session.commit()


def _bundle(parent_revision: int, level_id: str, client_op_id: str) -> dict[str, Any]:
    return {
        "commands": [
            {
                "type": "createLevel",
                "id": level_id,
                "name": "DB real path",
                "elevationMm": 0,
            }
        ],
        "parentRevision": parent_revision,
        "clientOpId": client_op_id,
        "userId": "cq17-db",
    }


def test_real_postgres_schema_session_bundle_activity_and_comments() -> None:
    _requires_db_real_path()
    project_id = uuid4()
    model_id = uuid4()

    asyncio.run(init_db_schema())
    asyncio.run(engine.dispose())
    asyncio.run(_seed_model(project_id, model_id))
    asyncio.run(engine.dispose())
    try:
        with TestClient(real_app) as client:
            committed = client.post(
                f"/api/models/{model_id}/commands/bundle",
                json=_bundle(1, "db-level", "cq17-db-real-path"),
            )
            assert committed.status_code == 200
            assert committed.json()["revision"] == 2

            stale = client.post(
                f"/api/models/{model_id}/commands/bundle",
                json=_bundle(1, "db-level-stale", "cq17-db-stale"),
            )
            assert stale.status_code == 409

            activity = client.get(f"/api/models/{model_id}/activity")
            assert activity.status_code == 200
            assert activity.json()["events"][0]["commandTypes"] == ["createLevel"]

            comment = client.post(
                f"/api/models/{model_id}/comments",
                json={"userDisplay": "CQ17 DB", "body": "DB-backed real path comment"},
            )
            assert comment.status_code == 200
            assert comment.json()["body"] == "DB-backed real path comment"

            comments = client.get(f"/api/models/{model_id}/comments")
            assert comments.status_code == 200
            assert comments.json()["comments"][0]["body"] == "DB-backed real path comment"
    finally:
        asyncio.run(engine.dispose())
        asyncio.run(_cleanup_model(project_id, model_id))
        asyncio.run(engine.dispose())
