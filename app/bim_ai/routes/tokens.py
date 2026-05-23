"""TKN-V3-01 — TokenSequence encode/decode/diff routes extracted from routes/api.py (BRT-24).

Exposes:

- ``GET  /api/models/{model_id}/tokens/encode``
- ``POST /api/models/{model_id}/tokens/decode``
- ``POST /api/models/{model_id}/tokens/diff``
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.routes.deps import load_model_row
from bim_ai.tkn import decode, diff, encode
from bim_ai.tkn.types import TokenSequence

tokens_router = APIRouter()


class TknDecodeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sequence: dict[str, Any]


class TknDiffRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sequence_a: dict[str, Any] = Field(alias="sequenceA")
    sequence_b: dict[str, Any] = Field(alias="sequenceB")


@tokens_router.get("/models/{model_id}/tokens/encode")
async def tokens_encode(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Encode the current kernel state into a TokenSequence."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    seq = encode(doc.elements)
    return seq.model_dump(by_alias=True)


@tokens_router.post("/models/{model_id}/tokens/decode")
async def tokens_decode(
    model_id: UUID,
    body: TknDecodeRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Decode a TokenSequence into commands relative to the current kernel state."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    seq = TokenSequence.model_validate(body.sequence)
    cmds = decode(seq, doc.elements)
    return {"commands": cmds}


@tokens_router.post("/models/{model_id}/tokens/diff")
async def tokens_diff(
    model_id: UUID,
    body: TknDiffRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Return the structural diff between two TokenSequences."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    seq_a = TokenSequence.model_validate(body.sequence_a)
    seq_b = TokenSequence.model_validate(body.sequence_b)
    delta = diff(seq_a, seq_b)
    return delta.model_dump(by_alias=True)
