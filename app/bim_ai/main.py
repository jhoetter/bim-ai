from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, Query, Request, Response, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from starlette.middleware.base import RequestResponseEndpoint

from bim_ai._errors import register_route_error_handler
from bim_ai._io.log import get_logger, set_correlation_id
from bim_ai.ai_boundary import load_bill_of_rights_markdown
from bim_ai.config import get_settings
from bim_ai.db import init_db_schema
from bim_ai.hub import Hub
from bim_ai.jobs.queue import get_queue
from bim_ai.jobs.types import Job
from bim_ai.plan_projection_wire import plan_projection_wire_request_cache
from bim_ai.room_derivation import room_boundary_derivation_request_cache
from bim_ai.routes.api import api_router, websocket_loop
from bim_ai.routes.time_travel import time_travel_router
from bim_ai.schedule_derivation import schedule_table_derivation_request_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("BIM_AI_SKIP_DB_INIT") != "1":
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

# BRT-06: structured RouteError envelopes. Coexists with the legacy
# `raise HTTPException(...)` sites — the migration of those 234 calls
# proceeds incrementally per the backend-rework-tracker.
register_route_error_handler(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(time_travel_router, prefix="/api")


@app.middleware("http")
async def derived_payload_cache_middleware(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    with (
        room_boundary_derivation_request_cache(),
        schedule_table_derivation_request_cache(),
        plan_projection_wire_request_cache(),
    ):
        return await call_next(request)


_route_timing_log = get_logger("bim_ai.route_timing")


def _route_timing_threshold_ms() -> float:
    """PERF-A04: only emit a log line when a route takes longer than this.

    Default 250 ms keeps prod logs quiet but surfaces the obvious offenders.
    Set BIM_AI_ROUTE_TIMING_THRESHOLD_MS=0 to log every request (dev/test).
    """
    raw = os.getenv("BIM_AI_ROUTE_TIMING_THRESHOLD_MS")
    if raw is None or raw == "":
        return 250.0
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 250.0


@app.middleware("http")
async def route_timing_middleware(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    """PERF-A04: log slow HTTP routes with route, method, status, elapsed.

    Pulls model_id/revision from path/query params when present. Correlation
    ID rides via the contextvar from `correlation_id_middleware` below.
    """
    start = time.perf_counter()
    try:
        response = await call_next(request)
        status = response.status_code
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        _route_timing_log.warning(
            "route raised",
            extra={
                "route": request.scope.get("route").path  # type: ignore[union-attr]
                if request.scope.get("route") is not None
                else request.url.path,
                "method": request.method,
                "status": 500,
                "elapsed_ms": round(elapsed_ms, 2),
                "model_id": request.path_params.get("model_id")
                or request.path_params.get("id"),
                "revision": request.query_params.get("revision"),
            },
        )
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    if elapsed_ms >= _route_timing_threshold_ms():
        route = request.scope.get("route")
        _route_timing_log.info(
            "route slow",
            extra={
                "route": route.path if route is not None else request.url.path,
                "method": request.method,
                "status": status,
                "elapsed_ms": round(elapsed_ms, 2),
                "model_id": request.path_params.get("model_id")
                or request.path_params.get("id"),
                "revision": request.query_params.get("revision"),
            },
        )
    return response


@app.middleware("http")
async def correlation_id_middleware(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    """BRT-62: propagate a request-ID across logs.

    Reads X-Request-ID if the client sent one; otherwise mints a
    uuid4 hex prefix. Echoes the ID back on the response and binds
    it to the contextvar `_io.log` reads, so any `get_logger(...)`
    call inside the request's handlers includes `correlation_id`
    in its JSON output automatically.
    """
    import uuid

    incoming = request.headers.get("x-request-id") or ""
    rid = incoming.strip() or uuid.uuid4().hex[:16]
    set_correlation_id(rid)
    try:
        response = await call_next(request)
    finally:
        set_correlation_id(None)
    response.headers["x-request-id"] = rid
    return response


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
    initialSnapshot: bool = Query(default=True),
    snapshotRevision: int | None = Query(default=None),
):
    hub: Hub = websocket.app.state.hub
    await websocket_loop(
        websocket,
        model_id,
        hub,
        resume_from=resumeFrom,
        send_initial_snapshot=initialSnapshot,
        snapshot_revision=snapshotRevision,
    )
