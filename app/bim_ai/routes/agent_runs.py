"""HTTP routes for the developer-only ``/agents`` observability surface.

These endpoints expose Claude Code session JSONLs and the per-house
reverse-BIM artifact tree under ``tmp/reverse-bim/``; see
``spec/agent-run-inspector-tracker.md`` for the design.

Wave 1: session listing + timeline.
Wave 2 (this file extension): iteration captures + scoring reports per
house. The full methodology dashboard (fact-ledger stats, lineage trace,
schema-driven phase grid) lands in subsequent slices.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import asdict
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse

from bim_ai.agent_run_parser import (
    default_sessions_dir,
    list_sessions,
    parse_timeline,
    session_path,
    summarize_session,
)

agent_runs_router = APIRouter()

# Restrict house ids to the known testhouse set; matches the parser
# (alpha/beta/gamma). Extend when adding houses.
_KNOWN_HOUSES = ("alpha", "beta", "gamma")
_HOUSE_RE = re.compile(r"^[a-z][a-z0-9]{1,32}$")
_ITER_RE = re.compile(r"^iter-(\d+[a-z]?)$", re.IGNORECASE)
_CAPTURE_FILENAME_RE = re.compile(r"^[a-z0-9][a-z0-9_\-]*\.(png|jpg|jpeg|svg)$", re.IGNORECASE)


def _reverse_bim_dir() -> Path:
    """Root of the per-house artifact tree, overridable for tests."""

    env = os.getenv("BIM_AI_REVERSE_BIM_DIR")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2] / "tmp" / "reverse-bim"


def _validate_house(house: str) -> str:
    if not _HOUSE_RE.match(house):
        raise HTTPException(status_code=400, detail=f"Invalid house id: {house!r}")
    if house not in _KNOWN_HOUSES:
        # Allow unknown houses if a directory exists; helps when new
        # testhouses are added without redeploying.
        candidate = _reverse_bim_dir() / f"house-{house}"
        if not candidate.is_dir():
            raise HTTPException(status_code=404, detail=f"Unknown house: {house}")
    return house


def _validate_iteration(label: str) -> str:
    m = _ITER_RE.match(label)
    if not m:
        raise HTTPException(status_code=400, detail=f"Invalid iteration label: {label!r}")
    return f"iter-{m.group(1).lower()}"


def _validate_capture_filename(filename: str) -> str:
    if not _CAPTURE_FILENAME_RE.match(filename) or ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail=f"Invalid capture filename: {filename!r}")
    return filename


def _capture_dir_for(iteration: str) -> Path:
    """Iteration captures live at tmp/reverse-bim/<iter>-captures/."""

    return _reverse_bim_dir() / f"{iteration}-captures"


def _scoring_dir_for(iteration: str) -> Path:
    return _reverse_bim_dir() / f"{iteration}-scoring"


def _scoring_path_for(iteration: str, house: str) -> Path:
    return _scoring_dir_for(iteration) / f"{house}-subagent-report.md"


@agent_runs_router.get("/agent-runs/sessions")
async def list_session_runs(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    house: Annotated[str | None, Query()] = None,
    iteration: Annotated[str | None, Query()] = None,
    model_id: Annotated[str | None, Query(alias="modelId")] = None,
) -> dict[str, Any]:
    """List Claude Code sessions visible on disk, newest first."""

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
    """Return the full parsed timeline for one session, plus its summary."""

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


@agent_runs_router.get("/agent-runs/houses")
async def list_houses() -> dict[str, Any]:
    """Enumerate known houses with their artifact-tree presence."""

    root = _reverse_bim_dir()
    items = []
    for name in _KNOWN_HOUSES:
        house_dir = root / f"house-{name}"
        items.append(
            {
                "name": name,
                "present": house_dir.is_dir(),
                "path": str(house_dir),
            }
        )
    # Also surface any extra house-<x>/ directories on disk.
    if root.is_dir():
        for entry in sorted(root.iterdir()):
            if not entry.is_dir() or not entry.name.startswith("house-"):
                continue
            short = entry.name[len("house-"):]
            if short in _KNOWN_HOUSES:
                continue
            if not _HOUSE_RE.match(short):
                continue
            items.append({"name": short, "present": True, "path": str(entry)})
    return {"reverseBimDir": str(root), "items": items}


def _enumerate_iterations(house: str) -> list[dict[str, Any]]:
    """Return every iter-N-captures directory containing files for ``house``.

    Each entry: iteration label, list of capture filenames belonging to
    this house, whether a scoring report exists, and a list of all
    capture filenames in the directory (for context).
    """

    root = _reverse_bim_dir()
    if not root.is_dir():
        return []

    results: list[dict[str, Any]] = []
    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue
        m = re.match(r"^iter-(\d+[a-z]?)-captures$", entry.name, re.IGNORECASE)
        if not m:
            continue
        iteration_label = f"iter-{m.group(1).lower()}"
        # Filter capture filenames that belong to this house.
        try:
            all_files = sorted(p.name for p in entry.iterdir() if p.is_file())
        except OSError:
            continue
        house_files = [n for n in all_files if n.startswith(f"{house}-") or n.startswith(f"{house}_")]
        scoring_path = _scoring_path_for(iteration_label, house)
        try:
            mtime = entry.stat().st_mtime
        except OSError:
            mtime = 0.0
        results.append(
            {
                "iteration": iteration_label,
                "captureCount": len(house_files),
                "captures": house_files,
                "allCaptureCount": len(all_files),
                "scoringReportPresent": scoring_path.is_file(),
                "scoringReportPath": str(scoring_path) if scoring_path.is_file() else None,
                "capturesDir": str(entry),
                "mtime": mtime,
            }
        )
    # Sort iter-1 < iter-2 < ... < iter-9 < iter-10 < ... < iter-12b.
    def _iter_key(item: dict[str, Any]) -> tuple[int, str]:
        label = str(item.get("iteration") or "")
        m2 = _ITER_RE.match(label)
        if not m2:
            return (10**9, label)
        token = m2.group(1).lower()
        # Split numeric prefix from letter suffix.
        m3 = re.match(r"^(\d+)([a-z]?)$", token)
        if not m3:
            return (10**9, token)
        return (int(m3.group(1)), m3.group(2))

    results.sort(key=_iter_key)
    return results


@agent_runs_router.get("/agent-runs/houses/{house}/iterations")
async def list_house_iterations(house: str) -> dict[str, Any]:
    """List every iteration with captures for the given house."""

    _validate_house(house)
    items = _enumerate_iterations(house)
    return {"house": house, "iterations": items}


@agent_runs_router.get("/agent-runs/houses/{house}/iterations/{iteration}/captures/{filename}")
async def get_iteration_capture(
    house: str,
    iteration: str,
    filename: str,
) -> FileResponse:
    """Serve a single capture image for an iteration."""

    house = _validate_house(house)
    iteration = _validate_iteration(iteration)
    filename = _validate_capture_filename(filename)
    if not filename.startswith(f"{house}-") and not filename.startswith(f"{house}_"):
        raise HTTPException(
            status_code=400,
            detail=f"Capture filename must start with house prefix '{house}-'",
        )
    path = _capture_dir_for(iteration) / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Capture not found: {filename}")
    media_type = "image/png" if filename.lower().endswith(".png") else None
    return FileResponse(str(path), media_type=media_type)


@agent_runs_router.get("/agent-runs/houses/{house}/iterations/{iteration}/scoring")
async def get_iteration_scoring(
    house: str,
    iteration: str,
) -> PlainTextResponse:
    """Return the raw subagent-report markdown for an iteration."""

    house = _validate_house(house)
    iteration = _validate_iteration(iteration)
    path = _scoring_path_for(iteration, house)
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"No scoring report for house={house} iteration={iteration}",
        )
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Read failed: {exc}") from exc
    return PlainTextResponse(text, media_type="text/markdown; charset=utf-8")


def _dashboard_summary(house: str) -> dict[str, Any]:
    """Best-effort summary of the per-house artifact tree.

    Reads understanding/existing-building-ir.json and counts facts by
    kind/status. Missing files are tolerated and surface as ``null``.
    """

    house_dir = _reverse_bim_dir() / f"house-{house}"
    if not house_dir.is_dir():
        return {"house": house, "present": False}

    summary: dict[str, Any] = {
        "house": house,
        "present": True,
        "path": str(house_dir),
    }

    ir_path = house_dir / "understanding" / "existing-building-ir.json"
    fact_counts_by_kind: dict[str, int] = {}
    fact_counts_by_status: dict[str, int] = {}
    if ir_path.is_file():
        try:
            ir = json.loads(ir_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            ir = None
        if isinstance(ir, dict):
            facts = ir.get("extractedFacts")
            if isinstance(facts, list):
                for fact in facts:
                    if not isinstance(fact, dict):
                        continue
                    kind = str(fact.get("kind") or fact.get("subtype") or "unknown")
                    fact_counts_by_kind[kind] = fact_counts_by_kind.get(kind, 0) + 1
                    status = str(fact.get("status") or "unknown")
                    fact_counts_by_status[status] = fact_counts_by_status.get(status, 0) + 1
            summary["irKnown"] = True
            summary["format"] = ir.get("format")
            summary["topKeys"] = sorted(ir.keys())
        else:
            summary["irKnown"] = False
    else:
        summary["irKnown"] = False

    summary["factCountsByKind"] = fact_counts_by_kind
    summary["factCountsByStatus"] = fact_counts_by_status
    summary["factTotal"] = sum(fact_counts_by_kind.values())

    # Validation reports: count present + report names.
    val_dir = house_dir / "validation"
    if val_dir.is_dir():
        try:
            summary["validationReports"] = sorted(
                p.name for p in val_dir.iterdir() if p.is_file() and p.suffix == ".json"
            )
        except OSError:
            summary["validationReports"] = []
    else:
        summary["validationReports"] = []

    # Source: PDF rendering count (rough activity signal).
    rp_dir = house_dir / "rendered-pages"
    if rp_dir.is_dir():
        try:
            summary["renderedPageGroups"] = sum(1 for p in rp_dir.iterdir() if p.is_dir())
        except OSError:
            summary["renderedPageGroups"] = 0
    else:
        summary["renderedPageGroups"] = 0

    # Reader-pass summary.
    ai_dir = house_dir / "ai-reading"
    pass_count = 0
    if ai_dir.is_dir():
        for sub in ("assignments", "responses"):
            sub_dir = ai_dir / sub
            if sub_dir.is_dir():
                try:
                    pass_count = max(
                        pass_count,
                        sum(1 for p in sub_dir.iterdir() if p.is_dir()),
                    )
                except OSError:
                    pass
    summary["readerPassCount"] = pass_count

    return summary


@agent_runs_router.get("/agent-runs/houses/{house}/dashboard")
async def get_house_dashboard(house: str) -> dict[str, Any]:
    """Per-house methodology dashboard (Wave 2 — minimal slice).

    Returns: fact-ledger stats from understanding/existing-building-ir.json,
    validation report inventory, rendered-page-group count, reader-pass
    count, and iteration capture summary. Missing artifacts return null
    rather than 404 so the dashboard renders for partial houses.
    """

    house = _validate_house(house)
    return {
        **_dashboard_summary(house),
        "iterations": _enumerate_iterations(house),
    }
