"""Schedule routes extracted from routes/api.py (BRT-24).

Exposes:

- ``GET /api/models/{model_id}/schedules/{schedule_id}/table`` (PERF-F04/F06)
- ``GET /api/v3/models/{model_id}/schedules/{schedule_id}/rows`` (SCH-V3-01)

The PERF-F04 cross-request schedule-table cache lives in this module
keyed by (model_id, revision, schedule_id, lightweight).
"""

from __future__ import annotations

import math
from collections import OrderedDict
from copy import deepcopy
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.document import Document
from bim_ai.elements import ScheduleElem
from bim_ai.routes.deps import load_model_row
from bim_ai.schedule_csv import schedule_payload_to_csv, schedule_payload_with_column_subset
from bim_ai.schedule_derivation import derive_schedule_table

schedules_router = APIRouter()


# PERF-F04: cross-request schedule table cache keyed by
# (model_id, revision, schedule_id, lightweight). Same LRU shape as
# _PLAN_PROJECTION_CACHE — repeated /schedules/{id}/table requests for
# unchanged revisions skip the derive_schedule_table call, which is the
# dominant ~230 ms cost on room schedules (tracker baseline). The
# `lightweight` axis is part of the key so PERF-F06 lightweight mode and
# the full derivation never collide.
_SCHEDULE_TABLE_CACHE_MAX = 128
_SCHEDULE_TABLE_CACHE: OrderedDict[tuple[str, int, str, bool], dict[str, Any]] = OrderedDict()


def _row_revision(row: Any) -> int:
    raw = getattr(row, "revision", None)
    if raw is None and isinstance(getattr(row, "document", None), dict):
        raw = row.document.get("revision")
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


def _schedule_table_cache_key(
    *, model_id: UUID, revision: int, schedule_id: str, lightweight: bool = False
) -> tuple[str, int, str, bool]:
    return (str(model_id), revision, schedule_id, lightweight)


def _get_schedule_table_cache(key: tuple[str, int, str, bool]) -> dict[str, Any] | None:
    cached = _SCHEDULE_TABLE_CACHE.get(key)
    if cached is None:
        return None
    _SCHEDULE_TABLE_CACHE.move_to_end(key)
    return deepcopy(cached)


def _set_schedule_table_cache(
    key: tuple[str, int, str, bool], payload: dict[str, Any]
) -> None:
    _SCHEDULE_TABLE_CACHE[key] = deepcopy(payload)
    _SCHEDULE_TABLE_CACHE.move_to_end(key)
    while len(_SCHEDULE_TABLE_CACHE) > _SCHEDULE_TABLE_CACHE_MAX:
        _SCHEDULE_TABLE_CACHE.popitem(last=False)


@schedules_router.get(
    "/models/{model_id}/schedules/{schedule_id}/table",
    response_model=None,
)
async def schedule_derived_table(
    model_id: UUID,
    schedule_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    fmt: Annotated[str, Query(alias="format")] = "json",
    columns: Annotated[str | None, Query(alias="columns")] = None,
    include_schedule_totals_csv: Annotated[bool, Query(alias="includeScheduleTotalsCsv")] = False,
    lightweight: Annotated[bool, Query()] = False,
) -> dict[str, Any] | PlainTextResponse:
    """PERF-F06: `?lightweight=true` skips the expensive room programme
    closure pass (peer_finish_set_by_level +
    room_finish_schedule_row_extensions) for room/finish schedules. Other
    category types are unaffected. Use for lightweight grid display
    surfaces that don't need the finish-set closure.
    """
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    # PERF-F04: cross-request cache keyed by
    # (model_id, revision, schedule_id, lightweight).
    # columns/format/totals only affect post-processing, not the derivation.
    cache_key = _schedule_table_cache_key(
        model_id=model_id,
        revision=_row_revision(row),
        schedule_id=schedule_id,
        lightweight=lightweight,
    )
    payload = _get_schedule_table_cache(cache_key)
    if payload is None:
        doc = Document.model_validate(row.document)
        try:
            payload = derive_schedule_table(doc, schedule_id, lightweight=lightweight)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        _set_schedule_table_cache(cache_key, payload)
    if fmt.strip().lower() == "csv":
        export_payload = payload
        if columns and columns.strip():
            wanted = [c.strip() for c in columns.split(",") if c.strip()]
            if wanted:
                export_payload = schedule_payload_with_column_subset(payload, wanted)
        csv_body = schedule_payload_to_csv(
            export_payload,
            include_totals_csv=include_schedule_totals_csv,
        )
        safe = "".join(ch for ch in schedule_id if ch.isalnum() or ch in ("-", "_")) or "schedule"
        return PlainTextResponse(
            csv_body,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe}.csv"'},
        )
    out = payload
    if columns and columns.strip():
        wanted = [c.strip() for c in columns.split(",") if c.strip()]
        if wanted:
            out = schedule_payload_with_column_subset(payload, wanted)
    return out


@schedules_router.get("/v3/models/{model_id}/schedules/{schedule_id}/rows")
async def schedule_view_rows(
    model_id: UUID,
    schedule_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    filter_expr: Annotated[str | None, Query(alias="filterExpr")] = None,
    sort_key: Annotated[str | None, Query(alias="sortKey")] = None,
    sort_dir: Annotated[str | None, Query(alias="sortDir")] = None,
) -> list[dict[str, Any]]:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    doc = Document.model_validate(row.document)
    sv = doc.elements.get(schedule_id)
    if not isinstance(sv, ScheduleElem) or not sv.category:
        raise HTTPException(status_code=404, detail="Schedule view not found or has no category")

    category = sv.category
    effective_filter = filter_expr if filter_expr is not None else sv.filter_expr
    effective_sort_key = sort_key if sort_key is not None else sv.sort_key
    effective_sort_dir = sort_dir if sort_dir is not None else sv.sort_dir

    rows: list[dict[str, Any]] = []
    for elem_id, elem in doc.elements.items():
        if getattr(elem, "kind", None) != category:
            continue
        fields: dict[str, Any] = {"id": elem_id}
        name = getattr(elem, "name", None)
        if name is not None:
            fields["name"] = name
        if category == "wall":
            start = getattr(elem, "start", None)
            end = getattr(elem, "end", None)
            if start and end:
                dx = end.x_mm - start.x_mm
                dy = end.y_mm - start.y_mm
                fields["lengthMm"] = round(math.sqrt(dx * dx + dy * dy), 1)
            t = getattr(elem, "thickness_mm", None)
            if t is not None:
                fields["thicknessMm"] = t
            h = getattr(elem, "height_mm", None)
            if h is not None:
                fields["heightMm"] = h
        elif category == "door":
            w = getattr(elem, "width_mm", None)
            if w is not None:
                fields["widthMm"] = w
        elif category == "window":
            for attr, key in (
                ("width_mm", "widthMm"),
                ("height_mm", "heightMm"),
                ("sill_height_mm", "sillHeightMm"),
            ):
                v = getattr(elem, attr, None)
                if v is not None:
                    fields[key] = v
        props = getattr(elem, "props", None)
        if props:
            fields.update(props)
        if effective_filter:
            fl = effective_filter.lower()
            if not any(fl in str(v).lower() for v in fields.values()):
                continue
        rows.append({"elementId": elem_id, "fields": fields})

    if effective_sort_key:
        reverse = effective_sort_dir == "desc"
        rows.sort(
            key=lambda r: (
                r["fields"].get(effective_sort_key) is None,
                r["fields"].get(effective_sort_key, ""),
            ),
            reverse=reverse,
        )

    return rows
