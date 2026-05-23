"""CON-V3-02 — concept-seed handoff route extracted from routes/api.py (BRT-24).

Exposes ``GET /api/v3/models/{model_id}/concept-seeds``.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.elements import ConceptSeedElem
from bim_ai.routes.deps import load_model_row

concept_seeds_router = APIRouter()


@concept_seeds_router.get("/v3/models/{model_id}/concept-seeds")
async def list_concept_seeds(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    status: Annotated[str | None, Query()] = None,
) -> list[dict[str, Any]]:
    """CON-V3-02: return concept seeds for a model, optionally filtered by status."""
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    seeds: list[dict[str, Any]] = []
    for elem in doc.elements.values():
        if not isinstance(elem, ConceptSeedElem):
            continue
        if status is not None and elem.status != status:
            continue
        seeds.append(elem.model_dump(by_alias=True))

    return seeds
