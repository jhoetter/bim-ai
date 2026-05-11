from __future__ import annotations

from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from bim_ai.ai_boundary import load_bill_of_rights_markdown
from bim_ai.config import get_settings
from bim_ai.db import init_db_schema
from bim_ai.hub import Hub
from bim_ai.jobs.queue import get_queue
from bim_ai.jobs.types import Job
from bim_ai.routes_api import api_router, websocket_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_schema()
    app.state.hub = Hub()

    async def _broadcast_job_update(job: Job) -> None:
        await app.state.hub.publish(
            job.model_id,
            {"type": "job_update", "job": job.model_dump(by_alias=True)},
        )

    get_queue().subscribe(_broadcast_job_update)
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


@app.get("/bill-of-rights", response_class=PlainTextResponse)
async def public_bill_of_rights() -> PlainTextResponse:
    return PlainTextResponse(
        load_bill_of_rights_markdown(),
        media_type="text/markdown; charset=utf-8",
    )


@app.websocket("/ws/{model_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    model_id: UUID,
    resumeFrom: int | None = Query(default=None),
):
    hub: Hub = websocket.app.state.hub
    await websocket_loop(websocket, model_id, hub, resume_from=resumeFrom)
