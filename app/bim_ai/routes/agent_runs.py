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

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.agent_run_parser import (
    default_sessions_dir,
    list_sessions,
    parse_timeline,
    session_path,
    summarize_session,
)
from bim_ai.db import get_session
from bim_ai.tables import ModelCommitRecord, ModelRecord

agent_runs_router = APIRouter()

# Seed list — extended at request time by `_discover_houses` from the
# filesystem and from ``bim_models.slug='house-*'``. Kept as a
# fallback so the inspector still surfaces something on a fresh
# checkout with no DB / no artifact tree.
_KNOWN_HOUSES = ("alpha", "beta", "gamma")
_HOUSE_RE = re.compile(r"^[a-z][a-z0-9]{1,32}$")
_ITER_RE = re.compile(r"^iter-(\d+[a-z]?)$", re.IGNORECASE)
_CAPTURE_FILENAME_RE = re.compile(r"^[a-z0-9][a-z0-9_\-]*\.(png|jpg|jpeg|svg)$", re.IGNORECASE)
_HOUSE_SLUG_RE = re.compile(r"^house-([a-z][a-z0-9]{1,32})$")


def _reverse_bim_dir() -> Path:
    """Root of the per-house artifact tree, overridable for tests."""

    env = os.getenv("BIM_AI_REVERSE_BIM_DIR")
    if env:
        return Path(env)
    # routes/agent_runs.py → routes/ → bim_ai/ → app/ → <repo root>
    return Path(__file__).resolve().parents[3] / "tmp" / "reverse-bim"


def _discover_filesystem_houses() -> set[str]:
    """House short-names from ``tmp/reverse-bim/house-<X>/`` directories."""

    root = _reverse_bim_dir()
    if not root.is_dir():
        return set()
    out: set[str] = set()
    try:
        for entry in root.iterdir():
            if not entry.is_dir():
                continue
            m = _HOUSE_SLUG_RE.match(entry.name)
            if m:
                out.add(m.group(1))
    except OSError:
        pass
    return out


async def _discover_db_houses(session: AsyncSession) -> set[str]:
    """House short-names from ``bim_models.slug``.

    Convention (enforced by ``scripts/testhouse_drive.py::_ensure_model``):
    a testhouse model's slug IS the house name — no ``house-`` prefix.
    A separate legacy probe handles models that still carry the
    pre-2026-05-23 ``house-<name>`` slug so old artefacts stay visible
    while we migrate.
    """

    out: set[str] = set()
    # New convention: slug == house name (alpha | beta | gamma).
    res = await session.execute(select(ModelRecord.slug).where(ModelRecord.slug.in_(_KNOWN_HOUSES)))
    for (slug,) in res.all():
        if slug:
            out.add(str(slug))
    # Legacy convention: slug == 'house-<name>'. Kept so models
    # authored before the convention switch still appear in the
    # dashboard until they're re-purged + re-authored.
    res = await session.execute(select(ModelRecord.slug).where(ModelRecord.slug.like("house-%")))
    for (slug,) in res.all():
        m = _HOUSE_SLUG_RE.match(str(slug or ""))
        if m:
            out.add(m.group(1))
    return out


async def _discover_houses(session: AsyncSession) -> list[str]:
    """Union of seed + filesystem + DB houses, deterministic order.

    Used by ``list_houses`` and by ``_validate_house``; both endpoints
    need to agree on the universe of allowed houses so a slug newly
    added to ``bim_models`` shows up in the inspector without a
    deploy.
    """

    found = set(_KNOWN_HOUSES) | _discover_filesystem_houses() | await _discover_db_houses(session)
    return sorted(found)


async def _validate_house_async(session: AsyncSession, house: str) -> str:
    if not _HOUSE_RE.match(house):
        raise HTTPException(status_code=400, detail=f"Invalid house id: {house!r}")
    if house in await _discover_houses(session):
        return house
    raise HTTPException(status_code=404, detail=f"Unknown house: {house}")


def _validate_house(house: str) -> str:
    """Sync validator used by endpoints that don't need DB discovery.

    Accepts seed-list + filesystem-discovered names. Endpoints that
    also want DB-discovered names (the dashboard + iter-picker) use
    ``_validate_house_async`` instead.
    """

    if not _HOUSE_RE.match(house):
        raise HTTPException(status_code=400, detail=f"Invalid house id: {house!r}")
    if house in set(_KNOWN_HOUSES) | _discover_filesystem_houses():
        return house
    raise HTTPException(status_code=404, detail=f"Unknown house: {house}")


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
    # NS-11: dashboard now first checks the per-house location where
    # nightshift graders write (`tmp/reverse-bim/house-{X}/iter-{N}/grade-report.md`)
    # before falling back to the legacy global `iter-{N}-scoring/` layout.
    # Without this, all the nightshift grades were invisible to /agents
    # and every iter showed up as narrative-only.
    legacy = _scoring_dir_for(iteration) / f"{house}-subagent-report.md"
    per_house = _reverse_bim_dir() / f"house-{house}" / iteration / "grade-report.md"
    if per_house.is_file():
        return per_house
    return legacy


def _phase_narrative_path(house: str, iteration: str) -> Path:
    """Per-house JSON written by testhouse_drive for global phases.

    Global phases (preflight, reader-pass, scope-decisions) run before
    any bim_models row exists, so they can't ride on the commit context.
    The driver drops a narrative.json sidecar at
    ``tmp/reverse-bim/house-<X>/iter-<N>/narrative.json`` and this
    endpoint surfaces it.
    """

    return _reverse_bim_dir() / f"house-{house}" / iteration / "narrative.json"


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
async def list_houses(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Enumerate every house known to the inspector.

    Union of: the hardcoded seed list, every ``house-<X>/`` directory
    under ``tmp/reverse-bim/``, and every ``bim_models.slug='house-<X>'``
    row. A house's row is annotated with whether each source actually
    knows about it so the UI can flag DB-only and FS-only houses.
    """

    root = _reverse_bim_dir()
    fs_houses = _discover_filesystem_houses()
    db_houses = await _discover_db_houses(session)
    universe = sorted(set(_KNOWN_HOUSES) | fs_houses | db_houses)

    items = []
    for name in universe:
        house_dir = root / f"house-{name}"
        items.append(
            {
                "name": name,
                "present": name in fs_houses,
                "path": str(house_dir),
                "inSeed": name in _KNOWN_HOUSES,
                "inFilesystem": name in fs_houses,
                "inDatabase": name in db_houses,
            }
        )
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
        house_files = [
            n for n in all_files if n.startswith(f"{house}-") or n.startswith(f"{house}_")
        ]
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


# Source-doc id pattern: srcdoc-<12 lowercase hex chars>. The testhouse
# preflight pipeline writes rendered PNGs under
# ``tmp/reverse-bim/house-<X>/preflight/rendered-pages/<docId>/<filename>.png``;
# commit-context ``sourceEvidence[].renderedPath`` references those paths
# and the dashboard resolves a thumbnail via this endpoint.
_SOURCE_DOC_ID_RE = re.compile(r"^srcdoc-[a-f0-9]{12}$")
# Filename allows letters/digits/underscores plus hyphens, dots, spaces,
# and commas — the renderer occasionally produces filenames like
# ``"Grundrisse, Schnitt-1.png"`` so we widen beyond ``[\w\-.]``.
_SOURCE_PAGE_FILENAME_RE = re.compile(r"^[\w\-., ]+\.png$")


@agent_runs_router.get("/agent-runs/houses/{house}/source-pages/{doc_id}/{filename}")
async def get_source_page(house: str, doc_id: str, filename: str) -> FileResponse:
    """Serve a single rendered source-document page for a house.

    Mirrors :func:`get_iteration_capture`'s security model: validate the
    house, then validate ``doc_id`` and ``filename`` against tight regexes
    before joining to a path under ``tmp/reverse-bim/house-<X>/preflight
    /rendered-pages/<docId>/<filename>.png``. The dashboard's source-
    evidence thumbnail strip calls this endpoint with the ``docId`` +
    ``page`` fields from each commit's ``sourceEvidence[]`` row.
    """

    house = _validate_house(house)
    if not _SOURCE_DOC_ID_RE.match(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid doc_id: {doc_id!r}")
    if ".." in filename or "/" in filename or not _SOURCE_PAGE_FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail=f"Invalid filename: {filename!r}")
    path = (
        _reverse_bim_dir() / f"house-{house}" / "preflight" / "rendered-pages" / doc_id / filename
    )
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Source page not found: {filename}")
    return FileResponse(str(path), media_type="image/png")


# Fact ids in IR v2 are short kebab-case slugs like ``room-eg-wohnzimmer``
# or ``exterior-chain-dg``. The schema permits dots (for nested ids) and
# underscores; we keep the regex broad but reject path separators.
_FACT_ID_RE = re.compile(r"^[\w\-.]+$")


@agent_runs_router.get("/agent-runs/houses/{house}/facts/{fact_id}")
async def get_fact(house: str, fact_id: str) -> dict[str, Any]:
    """Return the raw IR fact dict for ``fact_id`` under ``house``.

    Reads ``tmp/reverse-bim/house-<X>/understanding/existing-building-ir
    .json`` and linear-scans ``extractedFacts`` for a matching ``factId``.
    Used by the dashboard's consumed-fact chip popovers so the UI can
    show ``kind`` / ``status`` / ``text`` / value summary without
    loading the whole IR client-side.
    """

    house = _validate_house(house)
    if not _FACT_ID_RE.match(fact_id):
        raise HTTPException(status_code=400, detail=f"Invalid fact_id: {fact_id!r}")
    ir_path = _reverse_bim_dir() / f"house-{house}" / "understanding" / "existing-building-ir.json"
    if not ir_path.is_file():
        raise HTTPException(status_code=404, detail=f"No IR for house {house}")
    try:
        ir = json.loads(ir_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"IR read/parse failed: {exc}") from exc
    facts = ir.get("extractedFacts") if isinstance(ir, dict) else None
    if isinstance(facts, list):
        for fact in facts:
            if isinstance(fact, dict) and str(fact.get("factId")) == fact_id:
                return fact
    raise HTTPException(status_code=404, detail=f"Fact {fact_id} not found in IR")


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


@agent_runs_router.get("/agent-runs/houses/{house}/log-tail")
async def get_house_log_tail(
    house: str,
    lines: Annotated[int, Query(ge=1, le=2000)] = 200,
) -> dict[str, Any]:
    """Tail the per-house ``run.jsonl`` driver log.

    ``scripts/testhouse_drive.py::_attach_house_run_log_sink`` writes
    every structured ``bim_ai.testhouse_iter`` log record to
    ``tmp/reverse-bim/house-<X>/run.jsonl`` for the lifetime of every
    driver invocation. This endpoint returns the last ``lines`` JSONL
    records (parsed into objects) so the dashboard can render the
    full agent timeline without grepping stderr.

    Each returned record is the JSONFormatter payload:
    ``{ts, level, logger, msg, correlation_id, ...extras}``.
    """

    house = _validate_house(house)
    path = _reverse_bim_dir() / f"house-{house}" / "run.jsonl"
    if not path.is_file():
        return {"house": house, "path": str(path), "lineCount": 0, "events": []}
    try:
        # Read up to ~1 MB tail to keep this cheap on long runs.
        size = path.stat().st_size
        with path.open("rb") as f:
            start = max(0, size - 1_000_000)
            f.seek(start)
            tail_bytes = f.read()
        text = tail_bytes.decode("utf-8", errors="replace")
        # Drop the (possibly truncated) first line.
        text_lines = text.splitlines()
        if start > 0 and text_lines:
            text_lines = text_lines[1:]
        events: list[dict[str, Any]] = []
        for raw in text_lines[-lines:]:
            raw = raw.strip()
            if not raw:
                continue
            try:
                events.append(json.loads(raw))
            except json.JSONDecodeError:
                events.append({"raw": raw, "_parseError": True})
        return {
            "house": house,
            "path": str(path),
            "lineCount": len(events),
            "events": events,
        }
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Read failed: {exc}") from exc


@agent_runs_router.get("/agent-runs/houses/{house}/iterations/{iteration}/visual-gate")
async def get_iteration_visual_gate(house: str, iteration: str) -> dict[str, Any]:
    """Return the per-iter visual-gate JSON written by the grader subagent.

    The grader writes
    ``tmp/reverse-bim/iter-<N>-scoring/<house>-subagent-grade.json``
    with the rubric + decision + topFixesForNextIter. This endpoint
    serves it so the /agents dashboard can show the visual-gate
    pass/fail decision inline next to the structural-gate sidecar.
    """

    house = _validate_house(house)
    iteration = _validate_iteration(iteration)
    path = _scoring_dir_for(iteration) / f"{house}-subagent-grade.json"
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"No visual-gate sidecar for house={house} iteration={iteration}",
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Read failed: {exc}") from exc


@agent_runs_router.get("/agent-runs/houses/{house}/iterations/{iteration}/structural-gate")
async def get_iteration_structural_gate(house: str, iteration: str) -> dict[str, Any]:
    """Return the per-floor structural-gate JSON written by the driver.

    The driver writes
    ``tmp/reverse-bim/house-<X>/iter-<N>/structural-gate.json`` after
    each floor iter (gap B1). It contains element counts, advisor +
    constructability finding roll-ups, and a pass/warn/fail decision.
    """

    house = _validate_house(house)
    iteration = _validate_iteration(iteration)
    path = _reverse_bim_dir() / f"house-{house}" / iteration / "structural-gate.json"
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"No structural-gate sidecar for house={house} iteration={iteration}",
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Read failed: {exc}") from exc


@agent_runs_router.get("/agent-runs/houses/{house}/iterations/{iteration}/narrative")
async def get_iteration_narrative(house: str, iteration: str) -> dict[str, Any]:
    """Return the human-readable phase-narrative JSON for an iteration.

    Global phases (preflight, reader-pass, scope-decisions) run before
    any ``bim_models`` row exists, so they can't ride on the
    ``bim_model_commits.context.testhouse_iter.narrative`` carrier.
    They write a sidecar at
    ``tmp/reverse-bim/house-<X>/iter-<N>/narrative.json``; this
    endpoint serves it so the dashboard shows "what the preflight saw
    / decided / produced" inline next to the MCP-driven iters.
    """

    house = _validate_house(house)
    iteration = _validate_iteration(iteration)
    path = _phase_narrative_path(house, iteration)
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"No phase narrative for house={house} iteration={iteration}",
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Read failed: {exc}") from exc


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


def _parse_iter_token(token: str) -> tuple[int, str] | None:
    """Parse ``"3"`` / ``"12b"`` / ``"5a"`` into ``(num, suffix)`` keys."""

    m = re.match(r"^(\d+)([a-z]?)$", token.lower())
    if not m:
        return None
    return int(m.group(1)), m.group(2)


def _scan_house_iter_directories(house: str) -> dict[str, dict[str, Any]]:
    """Filesystem evidence per iter under ``house-<X>/``.

    Returns ``{iter_label: {"label": ..., "path": ..., "captureCount": N}}``.
    Recognises two layouts:

    * **New rebuild**: ``tmp/reverse-bim/house-<X>/iter-N/`` (one dir per
      iter, holds whatever the iter produced — captures live alongside
      `mcp-handoff/` etc.).
    * **Legacy**: ``tmp/reverse-bim/iter-N-captures/<house>-*.png`` (kept
      working so old runs still surface).
    """

    out: dict[str, dict[str, Any]] = {}
    root = _reverse_bim_dir()
    house_dir = root / f"house-{house}"

    # New layout: per-house iter dirs.
    if house_dir.is_dir():
        try:
            for entry in house_dir.iterdir():
                if not entry.is_dir():
                    continue
                m = _ITER_RE.match(entry.name)
                if not m:
                    continue
                label = f"iter-{m.group(1).lower()}"
                cap_count = 0
                try:
                    cap_count = sum(
                        1
                        for p in entry.iterdir()
                        if p.is_file() and _CAPTURE_FILENAME_RE.match(p.name)
                    )
                except OSError:
                    pass
                out[label] = {"label": label, "path": str(entry), "captureCount": cap_count}
        except OSError:
            pass

    # Legacy layout: shared iter-N-captures/ at the top level filtered by
    # the house prefix on filenames.
    if root.is_dir():
        try:
            for entry in root.iterdir():
                if not entry.is_dir():
                    continue
                m = re.match(r"^iter-(\d+[a-z]?)-captures$", entry.name, re.IGNORECASE)
                if not m:
                    continue
                label = f"iter-{m.group(1).lower()}"
                house_files = 0
                try:
                    for p in entry.iterdir():
                        if not p.is_file():
                            continue
                        name = p.name
                        if name.startswith(f"{house}-") or name.startswith(f"{house}_"):
                            house_files += 1
                except OSError:
                    continue
                if house_files == 0:
                    continue
                existing = out.get(label)
                if existing is None:
                    out[label] = {
                        "label": label,
                        "path": str(entry),
                        "captureCount": house_files,
                    }
                else:
                    existing["captureCount"] = existing["captureCount"] + house_files
        except OSError:
            pass

    return out


async def _scan_house_iter_commits(session: AsyncSession, house: str) -> dict[str, dict[str, Any]]:
    """Latest commit per iter for ``house``, keyed by ``iter-<N>`` label.

    "Latest" is by ``created_at`` descending — matches the
    inspector's iter-picker semantics ("show the iter's final state").
    """

    res = await session.execute(
        select(ModelCommitRecord)
        .where(ModelCommitRecord.context["testhouse_iter"]["house"].astext == house)
        .order_by(ModelCommitRecord.created_at.desc())
    )
    out: dict[str, dict[str, Any]] = {}
    for commit in res.scalars():
        block = (commit.context or {}).get("testhouse_iter")
        iter_value = (block or {}).get("iter") if isinstance(block, dict) else None
        if iter_value is None:
            continue
        # Tolerate string-encoded iter numbers (e.g. JSON wire-format drift).
        try:
            iter_int = int(str(iter_value))
        except (TypeError, ValueError):
            continue
        label = f"iter-{iter_int}"
        if label in out:
            # Older commit for the same iter — keep the newest (first seen).
            continue
        out[label] = {
            "commitId": commit.commit_id,
            "modelId": str(commit.model_id),
            "phase": (block or {}).get("phase") if isinstance(block, dict) else None,
            "summary": commit.summary,
            "state": commit.state,
            "createdAt": commit.created_at.isoformat() if commit.created_at else None,
            "firstRevision": commit.first_revision,
            "lastRevision": commit.last_revision,
        }
    return out


async def _resolve_house_model_id(session: AsyncSession, house: str) -> str | None:
    """Resolve ``house → modelId`` for the iter-picker.

    Tried in order, first hit wins:

    1. ``bim_models.slug == house`` — the v2 convention: a testhouse
       model's slug IS the house name (alpha | beta | gamma). Enforced
       by ``scripts/testhouse_drive.py::_ensure_model`` so this branch
       is hot once a model exists.
    2. ``bim_models.slug == 'house-<house>'`` — legacy convention from
       runs before 2026-05-23.
    3. Any ``bim_model_commits`` row whose
       ``context.testhouse_iter.house`` matches. Falls back to the
       agent-side attribution if neither slug convention is in play.

    Returns ``None`` if nothing resolves.
    """

    row = await session.execute(select(ModelRecord.id).where(ModelRecord.slug == house))
    by_slug = row.scalar_one_or_none()
    if by_slug is not None:
        return str(by_slug)

    legacy_slug = f"house-{house}"
    row = await session.execute(select(ModelRecord.id).where(ModelRecord.slug == legacy_slug))
    by_legacy = row.scalar_one_or_none()
    if by_legacy is not None:
        return str(by_legacy)

    res = await session.execute(
        select(ModelCommitRecord.model_id)
        .where(ModelCommitRecord.context["testhouse_iter"]["house"].astext == house)
        .limit(1)
    )
    by_commit = res.scalar_one_or_none()
    if by_commit is not None:
        return str(by_commit)

    return None


@agent_runs_router.get("/agent-runs/houses/{house}/dashboard")
async def get_house_dashboard(
    house: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Per-house methodology dashboard (Wave 2 — minimal slice).

    Returns: fact-ledger stats from understanding/existing-building-ir.json,
    validation report inventory, rendered-page-group count, reader-pass
    count, iteration capture summary, and (Wave 4) the resolved
    ``modelId`` so the iter-picker can target the right BIM model
    without depending on session-attribution heuristics. Missing
    artifacts return null rather than 404 so the dashboard renders for
    partial houses.
    """

    house = _validate_house(house)
    model_id = await _resolve_house_model_id(session, house)
    return {
        **_dashboard_summary(house),
        "modelId": model_id,
        "iterations": _enumerate_iterations(house),
    }


@agent_runs_router.get("/agent-runs/houses/{house}/iter-picker")
async def get_house_iter_picker(
    house: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Unified per-iter view for the inspector's iter-picker.

    Merges two evidence sources keyed by iter label (``iter-<N>``):

    * Filesystem: directories under ``tmp/reverse-bim/house-<X>/iter-N/``
      (new rebuild layout) AND legacy ``iter-N-captures/`` filtered to
      this house. These cover preflight iters (iter-0/1/2) that don't
      write to the BIM model.
    * Commits: ``bim_model_commits`` rows tagged with
      ``context.testhouse_iter.house == <house>``. Only iters that
      actually authored model state.

    Each iter row is **clickable** in the UI only when ``commit`` is
    non-null; preflight iters render as visible-but-disabled with a
    tooltip. The result is sorted ``iter-1, iter-2, ..., iter-12b``.
    """

    house = await _validate_house_async(session, house)
    model_id = await _resolve_house_model_id(session, house)

    fs_iters = _scan_house_iter_directories(house)
    commit_iters = await _scan_house_iter_commits(session, house)

    labels = sorted(
        set(fs_iters) | set(commit_iters),
        key=lambda label: _parse_iter_token(label[len("iter-") :]) or (10**9, label),
    )

    items: list[dict[str, Any]] = []
    for label in labels:
        fs = fs_iters.get(label)
        commit = commit_iters.get(label)
        items.append(
            {
                "iter": label,
                # numeric form for sorting / linking in JS without re-parsing.
                "iterNumber": _parse_iter_token(label[len("iter-") :])
                and _parse_iter_token(label[len("iter-") :])[0],
                "fsPath": (fs or {}).get("path"),
                "captureCount": (fs or {}).get("captureCount", 0),
                "commit": commit,  # null when this iter has no model commit
            }
        )

    return {
        "house": house,
        "modelId": model_id,
        "items": items,
    }
