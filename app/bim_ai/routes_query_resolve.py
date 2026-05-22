from __future__ import annotations

# ruff: noqa: B008
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.area_reconciliation import build_area_reconciliation_report
from bim_ai.bim_requirement_validation_pack import (
    build_document_bim_requirement_validation_payload,
)
from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.query_resolve import (
    model_summary_resource,
    qa_advisor,
    query_elements,
    query_enclosed_loops,
    query_hosts,
    query_levels,
    query_nearest_wall,
    query_room_access_graph,
    query_types,
    query_views,
    resolve_active_or_default_level,
    resolve_default_plan_view,
    resolve_dormer_opening_host,
    resolve_family_type,
    resolve_floor_supports,
    resolve_host_face,
    resolve_loop_for_boundary,
    resolve_opening_source_match,
    resolve_roof_position_from_source_point,
    resolve_room_boundary,
    resolve_room_boundary_edges,
    resolve_wall_by_line,
    resolve_wall_opening_host,
    success_envelope,
    validate_roof_dormer_source_alignment,
)
from bim_ai.routes_deps import load_model_row

query_resolve_router = APIRouter()


def _query_resolve_response(payload: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    if payload.get("ok") is not False:
        return payload
    status = int(payload.pop("status", 400))
    return JSONResponse(status_code=status, content=payload)


async def _load_query_resolve_doc(
    model_id: UUID,
    session: AsyncSession,
) -> tuple[str, Document] | JSONResponse:
    row = await load_model_row(session, model_id)
    if row is None:
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": {
                    "code": "model_not_found",
                    "message": "Model not found",
                    "retryable": False,
                    "details": {},
                },
            },
        )
    return str(model_id), Document.model_validate(row.document)


@query_resolve_router.get("/models/{model_id}/query/summary")
async def query_model_summary_route(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return success_envelope(mid, doc, model_summary_resource(mid, doc))


@query_resolve_router.post("/models/{model_id}/query/elements")
async def query_elements_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_elements(mid, doc, body, include=body.get("include")))


@query_resolve_router.post("/models/{model_id}/query/levels")
async def query_levels_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_levels(mid, doc, include=body.get("include")))


@query_resolve_router.post("/models/{model_id}/query/types")
async def query_types_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_types(mid, doc, body, include=body.get("include")))


@query_resolve_router.post("/models/{model_id}/query/views")
async def query_views_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_views(mid, doc, body, include=body.get("include")))


@query_resolve_router.post("/models/{model_id}/query/hosts")
async def query_hosts_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_hosts(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/query/nearest-wall")
async def query_nearest_wall_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_nearest_wall(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/query/room-access-graph")
async def query_room_access_graph_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_room_access_graph(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/query/enclosed-loops")
async def query_enclosed_loops_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(query_enclosed_loops(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/active-or-default-level")
async def resolve_active_or_default_level_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_active_or_default_level(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/default-plan-view")
async def resolve_default_plan_view_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_default_plan_view(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/wall-by-line")
async def resolve_wall_by_line_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_wall_by_line(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/floor-supports")
async def resolve_floor_supports_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_floor_supports(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/opening-source-match")
async def resolve_opening_source_match_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_opening_source_match(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/wall-opening-host")
async def resolve_wall_opening_host_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_wall_opening_host(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/dormer-opening-host")
async def resolve_dormer_opening_host_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_dormer_opening_host(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/roof-position-from-source-point")
async def resolve_roof_position_from_source_point_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_roof_position_from_source_point(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/room-boundary-edges")
async def resolve_room_boundary_edges_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_room_boundary_edges(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/host-face")
async def resolve_host_face_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_host_face(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/family-type")
async def resolve_family_type_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_family_type(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/room-boundary")
async def resolve_room_boundary_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_room_boundary(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/resolve/loop-for-boundary")
async def resolve_loop_for_boundary_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(resolve_loop_for_boundary(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/validate/roof-dormer-source-alignment")
async def validate_roof_dormer_source_alignment_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(validate_roof_dormer_source_alignment(mid, doc, body))


@query_resolve_router.post("/models/{model_id}/qa/advisor")
async def qa_advisor_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return _query_resolve_response(qa_advisor(mid, doc, body))


@query_resolve_router.get("/models/{model_id}/qa/bim-requirement-validation")
async def qa_bim_requirement_validation_route(
    model_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    return build_document_bim_requirement_validation_payload(mid, doc)


@query_resolve_router.post("/models/{model_id}/qa/area-reconciliation")
async def qa_area_reconciliation_route(
    model_id: UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    session: AsyncSession = Depends(get_session),
) -> Any:
    loaded = await _load_query_resolve_doc(model_id, session)
    if isinstance(loaded, JSONResponse):
        return loaded
    mid, doc = loaded
    facts = body.get("sourceFacts") or body.get("facts") or []
    if not isinstance(facts, list):
        return JSONResponse(
            status_code=400,
            content={
                "ok": False,
                "error": {
                    "code": "invalid_request",
                    "message": "sourceFacts/facts must be a list.",
                },
            },
        )
    tolerance = float(body.get("toleranceM2") or 0.5)
    return build_area_reconciliation_report(mid, doc, facts, tolerance_m2=tolerance)
