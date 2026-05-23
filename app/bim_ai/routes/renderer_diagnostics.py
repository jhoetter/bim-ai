"""Renderer-diagnostic-packet persistence route extracted from routes/api.py (BRT-24).

Exposes ``POST /api/models/{model_id}/renderer-diagnostics`` for the
WebGL viewport to ship per-revision GPU/render diagnostics back to the
kernel for evidence-package embedding.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.renderer_diagnostic_persistence import (
    append_renderer_diagnostic_packet,
    normalize_renderer_diagnostic_packet,
    renderer_diagnostic_packet_embedding,
)
from bim_ai.routes.deps import load_model_row

renderer_diagnostics_router = APIRouter()


class RendererDiagnosticPacketPersistBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    packet: dict[str, Any]
    user_id: str | None = Field(default="local-dev", alias="userId")


@renderer_diagnostics_router.post("/models/{model_id}/renderer-diagnostics")
async def persist_renderer_diagnostics(
    model_id: UUID,
    body: RendererDiagnosticPacketPersistBody,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    packet_revision = body.packet.get("modelRevision")
    if packet_revision is not None and str(packet_revision) != str(doc.revision):
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "renderer_diagnostic_packet_revision_conflict",
                "currentRevision": doc.revision,
                "packetRevision": packet_revision,
            },
        )
    packet = normalize_renderer_diagnostic_packet(
        body.packet,
        model_id=str(model_id),
        model_revision=doc.revision,
    )
    row.document = append_renderer_diagnostic_packet(row.document, packet)
    await session.commit()
    return {
        "ok": True,
        "modelId": str(model_id),
        "revision": doc.revision,
        "rendererDiagnosticPacket_v1": packet,
        "rendererDiagnosticPacketEmbedding_v1": renderer_diagnostic_packet_embedding(
            row.document,
            model_revision=doc.revision,
        ),
    }
