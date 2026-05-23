"""EXP-V3-01 — Render-pipeline export route extracted from routes/api.py (BRT-24).

Exposes ``GET /api/v3/models/{model_id}/export`` which produces a glTF
(``gltf`` / ``gltf-pbr``), an IFC bundle, or a metadata-only payload
for external renderers.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.exp.render_export import build_export_bundle
from bim_ai.routes.deps import load_model_row

render_export_router = APIRouter()

_VALID_EXPORT_FORMATS = {"gltf", "gltf-pbr", "ifc-bundle", "metadata-only"}


@render_export_router.get("/v3/models/{model_id}/export", tags=["exp-v3-01"])
async def render_export(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    format: Annotated[str, Query()] = "metadata-only",
    viewId: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """EXP-V3-01 — Export model as glTF, IFC, or metadata bundle for external renderers."""
    if format not in _VALID_EXPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid export format '{format}'. Valid values: {sorted(_VALID_EXPORT_FORMATS)}",
        )

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)
    elements_list = [v.model_dump(by_alias=True) for v in doc.elements.values()]
    model_state = {"elements": elements_list}

    bundle = build_export_bundle(model_state, format, view_id=viewId)  # type: ignore[arg-type]
    return bundle.to_dict()
