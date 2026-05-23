"""WebSocket collab endpoint extracted from routes/api.py (BRT-24).

Exposes ``@router.websocket("/models/{model_id}/collab")`` — the COL-V3-01/02
yjs Y-WebSocket endpoint.

Note: the ``websocket_loop`` snapshot/replay helper used by the top-level
``/ws/{model_id}`` endpoint stays in ``routes/api.py`` because legacy
tests monkeypatch ``SessionMaker`` / ``load_model_row`` on the api
module to drive the bootstrap behaviour.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from bim_ai.collab.orchestrator import get_orchestrator
from bim_ai.db import SessionMaker
from bim_ai.routes.deps import resolve_caller_role, resolve_token_role

ws_bootstrap_router = APIRouter()

logger = logging.getLogger(__name__)


@ws_bootstrap_router.websocket("/models/{model_id}/collab")
async def collab_ws(
    websocket: WebSocket,
    model_id: UUID,
    subspace: Annotated[str, Query()] = "kernel",
    token: Annotated[str | None, Query()] = None,
    user_id: Annotated[str, Query(alias="userId")] = "local-dev",
) -> None:
    """COL-V3-01/COL-V3-02: yjs Y-WebSocket endpoint for real-time collab on a model.

    Relays raw yjs sync + awareness bytes between browser clients multiplexed
    by modelId. Does not interpret CRDT contents — yjs algorithms handle merge
    deterministically on each client.

    COL-V3-02: viewer and public-link-viewer origins are blocked from mutating
    the kernel subspace.
    """
    orchestrator = get_orchestrator()
    await websocket.accept()

    async with SessionMaker() as session:
        if token:
            try:
                caller_role = await resolve_token_role(session, str(model_id), token)
            except HTTPException:
                await websocket.close(code=4403)
                return
        else:
            caller_role = await resolve_caller_role(session, model_id, user_id)

    room = orchestrator.get_room(str(model_id))
    room.join(websocket, role=caller_role)
    try:
        while True:
            data = await websocket.receive_bytes()
            await room.broadcast(
                data, exclude=websocket, origin_role=caller_role, subspace=subspace
            )
    except WebSocketDisconnect:
        room.leave(websocket)
        orchestrator.remove_empty_rooms()
        logger.info("collab ws disconnect model=%s", model_id)
