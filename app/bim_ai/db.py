from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from bim_ai.config import get_settings
from bim_ai.tables import Base, UndoStackRecord


def make_engine():
    settings = get_settings()
    return create_async_engine(settings.database_url, pool_pre_ping=True)


engine = make_engine()
SessionMaker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionMaker() as session:
        yield session


async def init_db_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("ALTER TABLE bim_undo_stack ADD COLUMN IF NOT EXISTS transaction_metadata JSONB")
        )
        await conn.execute(
            text("ALTER TABLE bim_redo_stack ADD COLUMN IF NOT EXISTS transaction_metadata JSONB")
        )


def _metadata_idempotency(metadata: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(metadata, dict):
        return {}
    idem = metadata.get("idempotency")
    return idem if isinstance(idem, dict) else {}


async def find_idempotent_undo_record(
    session: AsyncSession,
    *,
    model_id: UUID,
    client_op_id: str | None = None,
    bundle_digest: str | None = None,
    user_id: str | None = None,
    search_limit: int = 500,
) -> UndoStackRecord | None:
    """Return a prior successful transaction matching a client id or digest."""
    if not client_op_id and not bundle_digest:
        return None

    stmt = (
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id)
        .order_by(desc(UndoStackRecord.id))
        .limit(max(1, search_limit))
    )
    if user_id:
        stmt = stmt.where(UndoStackRecord.user_id == user_id)
    res = await session.execute(stmt)
    for row in res.scalars():
        idem = _metadata_idempotency(row.transaction_metadata)
        if client_op_id and idem.get("clientOpId") == client_op_id:
            return row
        if bundle_digest and idem.get("bundleDigestSha256") == bundle_digest:
            return row
    return None
