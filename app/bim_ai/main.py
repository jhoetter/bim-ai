from __future__ import annotations

from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from bim_ai.config import get_settings
from bim_ai.db import init_db_schema
from bim_ai.hub import Hub
from bim_ai.routes_api import api_router, websocket_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_schema()
    app.state.hub = Hub()
    yield


settings = get_settings()

app = FastAPI(title="BIM AI", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.websocket("/ws/{model_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    model_id: UUID,
    resumeFrom: int | None = Query(default=None),
):
    hub: Hub = websocket.app.state.hub
    await websocket_loop(websocket, model_id, hub, resume_from=resumeFrom)
