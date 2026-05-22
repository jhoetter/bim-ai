"""HTTP routes for the developer-only ``/agents`` observability surface.

These endpoints expose Claude Code session JSONLs that already live on
disk; see ``spec/agent-run-inspector-tracker.md`` for the design.
Wave 1 surface only — Wave 2 (artifact viewers, lineage trace, per-house
methodology dashboard) ships separately.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query

from bim_ai.agent_run_parser import (
    default_sessions_dir,
    list_sessions,
    parse_timeline,
    session_path,
    summarize_session,
)

agent_runs_router = APIRouter()


@agent_runs_router.get("/agent-runs/sessions")
async def list_session_runs(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    house: Annotated[str | None, Query()] = None,
    iteration: Annotated[str | None, Query()] = None,
    model_id: Annotated[str | None, Query(alias="modelId")] = None,
) -> dict[str, Any]:
    """List Claude Code sessions visible on disk, newest first.

    Filters: ``house``, ``iteration``, ``modelId``. Inferred values
    (from tool inputs / paths) are what's compared — exact match.
    """

    summaries = list_sessions()
    items = []
    for s in summaries:
        if house and s.inferred_house != house:
            continue
        if iteration and s.inferred_iteration != iteration:
            continue
        if model_id and s.inferred_model_id != model_id:
            continue
        items.append(asdict(s))
        if len(items) >= limit:
            break
    return {
        "sessionsDir": str(default_sessions_dir()),
        "total": len(summaries),
        "returned": len(items),
        "items": items,
    }


@agent_runs_router.get("/agent-runs/sessions/{session_id}")
async def get_session_run(
    session_id: str,
    include_raw: Annotated[bool, Query(alias="includeRaw")] = False,
    limit_events: Annotated[int, Query(ge=1, le=20000, alias="limitEvents")] = 5000,
) -> dict[str, Any]:
    """Return the full parsed timeline for one session, plus its summary.

    ``includeRaw=true`` keeps the metadata/system events; the UI hides
    them by default. ``limitEvents`` caps the timeline length so the
    largest sessions don't OOM the response.
    """

    path = session_path(session_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    summary = summarize_session(path)
    events = []
    truncated = False
    for event in parse_timeline(path):
        if event.kind == "raw" and not include_raw:
            continue
        events.append(
            {
                "kind": event.kind,
                "timestamp": event.timestamp,
                "uuid": event.uuid,
                "parentUuid": event.parent_uuid,
                "sequence": event.sequence,
                "payload": event.payload,
            }
        )
        if len(events) >= limit_events:
            truncated = True
            break

    return {
        "summary": asdict(summary),
        "events": events,
        "truncated": truncated,
    }
