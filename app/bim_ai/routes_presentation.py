from __future__ import annotations

import json
import secrets
import time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.hub import Hub
from bim_ai.routes_deps import get_hub, load_model_row
from bim_ai.tables import PublicLinkRecord

presentation_router = APIRouter()
_SESSION_DEPENDENCY = Depends(get_session)
_HUB_DEPENDENCY = Depends(get_hub)

# OUT-V3-01 — Live presentation URL
# ---------------------------------------------------------------------------

_presentation_ws_sessions: dict[str, set[WebSocket]] = {}


class CreatePresentationBody(BaseModel):
    pageScopeIds: list[str] = Field(default_factory=list)
    allowMeasurement: bool = False
    allowComment: bool = False
    expiresAt: int | None = None


@presentation_router.post("/models/{model_id}/presentations")
async def create_presentation(
    model_id: UUID,
    body: CreatePresentationBody,
    session: AsyncSession = _SESSION_DEPENDENCY,
    user_id: str = Query(default="local-dev", alias="userId"),
) -> dict[str, Any]:
    """OUT-V3-01: create a live presentation link for a model."""
    from bim_ai.public_links import generate_link_token

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    now_ms = int(time.time() * 1000)
    link_id = secrets.token_urlsafe(16)
    token = generate_link_token()

    link_record = PublicLinkRecord(
        id=link_id,
        model_id=str(model_id),
        token=token,
        created_by=user_id,
        created_at=now_ms,
        expires_at=body.expiresAt,
        is_revoked=False,
        display_name="presentation",
        open_count=0,
        allow_measurement=body.allowMeasurement,
        allow_comment=body.allowComment,
        page_scope_ids=json.dumps(body.pageScopeIds),
    )
    session.add(link_record)
    await session.commit()

    return {
        "id": link_id,
        "modelId": str(model_id),
        "token": token,
        "pageScopeIds": body.pageScopeIds,
        "allowMeasurement": body.allowMeasurement,
        "allowComment": body.allowComment,
        "expiresAt": body.expiresAt,
        "createdAt": now_ms,
        "isRevoked": False,
        "openCount": 0,
        "displayName": "presentation",
        "url": f"/p/{token}",
    }


@presentation_router.get("/models/{model_id}/presentations")
async def list_presentations(
    model_id: UUID,
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> dict[str, Any]:
    """OUT-V3-01: list presentation links for a model, including inactive links."""
    res = await session.execute(
        select(PublicLinkRecord)
        .where(
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.display_name == "presentation",
        )
        .order_by(PublicLinkRecord.is_revoked.asc(), desc(PublicLinkRecord.created_at))
    )
    records = res.scalars().all()
    presentations = []
    for r in records:
        presentations.append(
            {
                "id": r.id,
                "modelId": r.model_id,
                "token": r.token,
                "createdBy": r.created_by,
                "createdAt": r.created_at,
                "expiresAt": r.expires_at,
                "isRevoked": r.is_revoked,
                "openCount": r.open_count,
                "pageScopeIds": json.loads(r.page_scope_ids) if r.page_scope_ids else [],
                "allowMeasurement": r.allow_measurement,
                "allowComment": r.allow_comment,
            }
        )
    return {"presentations": presentations}


@presentation_router.post("/models/{model_id}/presentations/{link_id}/revoke")
async def revoke_presentation(
    model_id: UUID,
    link_id: str,
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> dict[str, Any]:
    """OUT-V3-01: revoke a presentation link and notify active WS sessions."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.id == link_id,
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    now_ms = int(time.time() * 1000)
    link_record.is_revoked = True
    await session.commit()

    token = link_record.token
    if token in _presentation_ws_sessions:
        for ws in list(_presentation_ws_sessions[token]):
            try:
                await ws.send_json({"type": "revoked"})
                await ws.close(code=4403)
            except Exception:
                pass
        _presentation_ws_sessions.pop(token, None)

    return {"revokedAt": now_ms}


@presentation_router.post("/models/{model_id}/presentations/{link_id}/activate")
async def activate_presentation(
    model_id: UUID,
    link_id: str,
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> dict[str, Any]:
    """OUT-V3-01: reactivate a presentation link without rotating its token."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.id == link_id,
            PublicLinkRecord.model_id == str(model_id),
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    now_ms = int(time.time() * 1000)
    link_record.is_revoked = False
    await session.commit()

    return {"activatedAt": now_ms, "isRevoked": False}


@presentation_router.get("/p/{token}")
async def resolve_presentation_token(
    token: str,
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> dict[str, Any]:
    """OUT-V3-01: public viewer route — resolves a presentation token."""
    from sqlalchemy import update as sa_update

    now_ms = int(time.time() * 1000)
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.token == token,
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()
    if link_record is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    if link_record.is_revoked:
        return {"status": "revoked"}
    if link_record.expires_at is not None and link_record.expires_at < now_ms:
        return {"status": "revoked"}

    await session.execute(
        sa_update(PublicLinkRecord)
        .where(PublicLinkRecord.id == link_record.id)
        .values(open_count=PublicLinkRecord.open_count + 1)
    )
    await session.commit()

    model_uuid = UUID(link_record.model_id)
    row = await load_model_row(session, model_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)
    elements_wire = {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}
    return {
        "status": "ok",
        "modelId": str(row.id),
        "revision": doc.revision,
        "elements": elements_wire,
        "wsUrl": f"/api/p/{token}/ws",
        "allowMeasurement": link_record.allow_measurement,
        "allowComment": link_record.allow_comment,
        "pageScopeIds": json.loads(link_record.page_scope_ids)
        if link_record.page_scope_ids
        else [],
        "presentation": {
            "id": link_record.id,
            "displayName": link_record.display_name,
            "openCount": link_record.open_count + 1,
        },
    }


@presentation_router.websocket("/p/{token}/ws")
async def presentation_ws(
    websocket: WebSocket,
    token: str,
    hub: Hub = _HUB_DEPENDENCY,
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> None:
    """OUT-V3-01: WebSocket for live presentation updates."""
    res = await session.execute(
        select(PublicLinkRecord).where(
            PublicLinkRecord.token == token,
            PublicLinkRecord.display_name == "presentation",
        )
    )
    link_record = res.scalars().first()

    await websocket.accept()

    if link_record is None or link_record.is_revoked:
        await websocket.send_json({"type": "revoked"})
        await websocket.close(code=4403)
        return

    if token not in _presentation_ws_sessions:
        _presentation_ws_sessions[token] = set()
    _presentation_ws_sessions[token].add(websocket)

    sid = str(link_record.model_id)
    hub.subscribe(sid, websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.unregister(websocket)
        if token in _presentation_ws_sessions:
            _presentation_ws_sessions[token].discard(websocket)


# OUT-V3-02 — Presentation canvas PPTX bundle export
# ---------------------------------------------------------------------------


@presentation_router.get(
    "/v3/models/{model_id}/presentation-canvases/{canvas_id}/export",
    tags=["out-v3-02"],
)
async def export_presentation_canvas(
    model_id: UUID,
    canvas_id: str,
    format: str = Query(default="pptx-bundle"),
    session: AsyncSession = _SESSION_DEPENDENCY,
) -> Any:
    """OUT-V3-02 — Export a presentation canvas as a structured PPTX bundle JSON.

    Returns the PptxBundle JSON contract (schemaVersion, title, slides[]).
    Binary .pptx writing via python-pptx is reserved for a future iteration.
    """
    from bim_ai.elements import FrameElem, PresentationCanvasElem
    from bim_ai.exp.pptx_export import build_pptx_bundle

    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    doc = Document.model_validate(row.document)

    canvas_elem = doc.elements.get(canvas_id)
    if canvas_elem is None or not isinstance(canvas_elem, PresentationCanvasElem):
        raise HTTPException(
            status_code=404,
            detail=f"presentation_canvas '{canvas_id}' not found in model",
        )

    if format != "pptx-bundle":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format '{format}'. Only 'pptx-bundle' is supported.",
        )

    frames = [
        elem.model_dump(by_alias=True)
        for elem in doc.elements.values()
        if isinstance(elem, FrameElem) and elem.presentation_canvas_id == canvas_id
    ]

    canvas_dict = canvas_elem.model_dump(by_alias=True)
    bundle = build_pptx_bundle(canvas_dict, frames)
    return bundle.to_dict()


# ---------------------------------------------------------------------------
