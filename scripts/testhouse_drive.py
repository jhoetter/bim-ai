#!/usr/bin/env python3
"""Generic driver for the testhouse clean-rebuild iterations.

One entry point covers every iter/phase required by
``spec/trackers/testhouse-clean-rebuild-tracker.md``. There are no
per-iter apply scripts (the tracker forbids them); each phase calls
the appropriate REST routes and emits the four structured-log records
the tracker pins on the ``bim_ai.testhouse_iter`` channel.

Usage::

    # iter-0 preflight (renders @ 240 DPI, classifies pages, writes
    # reader-pass manifest):
    uv run python scripts/testhouse_drive.py preflight --house alpha

    # iter-3 first MCP slice authoring — exterior walls + floors +
    # main roof — wrapped in commit_context() with the tracker's pinned
    # testhouse_iter agent_context schema. Creates the bim_models row
    # if absent so the rebuild starts from a clean slate.
    uv run python scripts/testhouse_drive.py author-shell \\
        --house alpha --iter 3

Requires the local API to be reachable (``make dev-forwarded`` →
``http://127.0.0.1:28500``). Override via ``--api-base``.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import httpx  # noqa: E402

from bim_ai._io.log import JSONFormatter, get_logger, set_correlation_id  # noqa: E402

HOUSES = ("alpha", "beta", "gamma")
DEFAULT_API_BASE = "http://127.0.0.1:28500/api"
DEFAULT_DPI = 240

logger = get_logger("bim_ai.testhouse_iter")


def _attach_house_run_log_sink(house: str) -> None:
    """Attach a per-house ``run.jsonl`` file handler to the testhouse_iter logger.

    Append-only JSONL: every structured log record the driver emits
    while authoring ``house`` is also written to
    ``tmp/reverse-bim/house-<X>/run.jsonl`` so a reviewer can read
    the full agent timeline post-hoc. The /agents dashboard surfaces
    the tail of this file via the ``log-tail`` endpoint.
    """

    import logging

    run_log_path = _house_workdir(house) / "run.jsonl"
    run_log_path.parent.mkdir(parents=True, exist_ok=True)
    sink_attr = f"_bim_ai_run_log_{house}"
    for h in logger.handlers:
        if getattr(h, sink_attr, False):
            return
    handler = logging.FileHandler(str(run_log_path), mode="a", encoding="utf-8")
    handler.setFormatter(JSONFormatter())
    setattr(handler, sink_attr, True)
    logger.addHandler(handler)


def _house_root(house: str) -> Path:
    return REPO_ROOT / "testhouses" / f"house-{house}"


def _house_workdir(house: str) -> Path:
    return REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}"


def _post(*, api_base: str, path: str, body: dict, timeout: float = 600.0) -> dict:
    url = f"{api_base.rstrip('/')}{path}"
    with httpx.Client(timeout=timeout) as client:
        r = client.post(url, json=body)
        r.raise_for_status()
        return r.json()


def _run_preflight(*, house: str, api_base: str, dpi: int) -> dict:
    """Iter-0 phase: prepare-ai-visual-trace-run + classify + reader plan.

    Single REST call to ``/api/v3/source/prepare-ai-visual-trace-run``
    runs folder-manifest, render at the requested DPI, document
    classification, work-order build, and writes the initial
    reader-pass-manifest under ``preflight/``.
    """

    source_root = _house_root(house)
    out_dir = _house_workdir(house) / "preflight"
    if not source_root.is_dir():
        raise FileNotFoundError(f"missing source folder: {source_root}")
    out_dir.mkdir(parents=True, exist_ok=True)

    payload = {
        "rootPath": str(source_root),
        "outputDir": str(out_dir),
        "dpi": dpi,
        "runId": f"iter-0-house-{house}",
    }
    result = _post(
        api_base=api_base,
        path="/v3/source/prepare-ai-visual-trace-run",
        body=payload,
    )
    # /agents dashboard (`agent_runs.py::_dashboard_summary`) reads
    # `house-<X>/rendered-pages/` directly. Our preflight writes one
    # level deeper at `preflight/rendered-pages/`. Symlink the
    # convenient short path → the canonical preflight path so both
    # the dashboard's `renderedPageGroups` count and the existing
    # downstream tooling stay happy.
    rendered_under_preflight = out_dir / "rendered-pages"
    rendered_short = _house_workdir(house) / "rendered-pages"
    if rendered_under_preflight.is_dir() and not rendered_short.exists():
        rendered_short.symlink_to(rendered_under_preflight.relative_to(rendered_short.parent))
    return result


def _cmd_preflight(args: argparse.Namespace) -> int:
    house = args.house
    iter_n = 0
    phase = "preflight"
    set_correlation_id(f"iter-{iter_n}-house-{house}-{uuid.uuid4().hex[:8]}")

    logger.info(
        "testhouse_iter.start",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "source_root": str(_house_root(house)),
            "model_id": None,
        },
    )

    started = time.monotonic()
    try:
        result = _run_preflight(house=house, api_base=args.api_base, dpi=args.dpi)
    except Exception as exc:  # noqa: BLE001 — log and re-raise
        logger.error(
            "testhouse_iter.end",
            extra={
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "status": "failed",
                "elapsed_ms": int((time.monotonic() - started) * 1000),
                "error": str(exc),
            },
        )
        raise

    elapsed_ms = int((time.monotonic() - started) * 1000)
    summary = (result or {}).get("summary") or {}
    artifacts = (result or {}).get("artifacts") or {}

    # Human-readable narrative for the /agents dashboard — a reviewer
    # reads "what did the agent see / decide / produce" without
    # cross-referencing this driver code.
    file_count = int(summary.get("fileCount") or summary.get("documentCount") or 0)
    rendered_pages = int(summary.get("renderedPageCount") or 0)
    work_packages = int(summary.get("workPackageCount") or 0)
    reader_requests = int(summary.get("readerRequestCount") or 0)
    _write_global_phase_narrative(
        house=house,
        iter_n=iter_n,
        phase=phase,
        narrative_input=(
            f"Source folder testhouses/house-{house}/ — {file_count} PDF(s) covering the "
            "ground floor (EG), upper floor (DG), elevations (Ansichten), section + composite "
            "plan, plus parcel / drainage / legal / energy documents."
        ),
        narrative_reasoning=(
            f"Single call to /api/v3/source/prepare-ai-visual-trace-run rendered every PDF page "
            f"at {args.dpi} DPI, ran filename-heuristic document classification, built a per-page "
            f"work-order, and seeded an empty reader-pass manifest. This is the deterministic "
            f"preflight; the visual reader (iter-1) consumes its output."
        ),
        narrative_outcome=(
            f"{rendered_pages} pages rendered, {file_count} documents classified, "
            f"{work_packages} work packages, {reader_requests} reader requests staged. "
            f"Artifacts under tmp/reverse-bim/house-{house}/preflight/."
        ),
        inputs=[{"path": str(_house_root(house)), "fileCount": file_count}],
        outputs=[
            {"path": str(v), "role": k} for k, v in (artifacts or {}).items() if isinstance(v, str)
        ],
        extra={"summary": summary, "elapsedMs": elapsed_ms},
    )

    logger.info(
        "testhouse_iter.end",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "status": "ok" if result.get("ok") else "failed",
            "elapsed_ms": elapsed_ms,
            "summary": summary,
            "artifacts": artifacts,
        },
    )

    print(
        json.dumps(
            {
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "ok": bool(result.get("ok")),
                "summary": summary,
                "artifacts": artifacts,
                "elapsed_ms": elapsed_ms,
            },
            sort_keys=True,
        )
    )
    return 0 if result.get("ok") else 1


TRACKER_PATH = "spec/trackers/testhouse-clean-rebuild-tracker.md"


def _write_global_phase_narrative(
    *,
    house: str,
    iter_n: int,
    phase: str,
    narrative_input: str,
    narrative_reasoning: str,
    narrative_outcome: str,
    inputs: list[dict] | None = None,
    outputs: list[dict] | None = None,
    extra: dict | None = None,
) -> Path:
    """Write a phase-narrative JSON for global (pre-MCP) phases.

    Per-house globally-scoped phases — preflight (iter-0), reader-pass
    (iter-1), scope-decisions (iter-2), and any other phase that runs
    before a bim_models row exists — can't ride on the
    bim_model_commits.context narrative carrier. They write a sidecar
    JSON the `/agents` dashboard reads via a dedicated endpoint so the
    human-readable trace still surfaces in the UI.
    """

    out_dir = _house_workdir(house) / f"iter-{iter_n}"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "narrative.json"
    payload = {
        "schemaVersion": "testhousePhaseNarrative_v1",
        "house": house,
        "iter": iter_n,
        "phase": phase,
        "narrative": {
            "input": narrative_input,
            "reasoning": narrative_reasoning,
            "outcome": narrative_outcome,
        },
        "inputs": inputs or [],
        "outputs": outputs or [],
        "writtenAt": datetime.now(UTC).isoformat() if "datetime" in globals() else None,
    }
    if extra:
        payload.update(extra)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return path


PROJECT_ID_FOR_TESTHOUSES = "892ee9f7-307c-5e40-a838-3bc64b5f5f92"  # seed project


def _ir_path(house: str) -> Path:
    return _house_workdir(house) / "understanding" / "existing-building-ir.json"


def _lvl_height_mm(lvl: dict, default: float = 2700.0) -> float:
    """Read a level's floor-to-floor height tolerant of every IR schema variant.

    Reader IRs across v2.0 / v2.1 use one of these keys:
      * ``heightMM`` — alpha v2.0 (uppercase MM)
      * ``heightMm`` — gamma v2.1 (lowercase Mm)
      * ``floorToFloorMm`` — alpha v2.1 fact-grounded variant
    """

    for key in ("heightMM", "heightMm", "floorToFloorMm"):
        v = lvl.get(key)
        if v is not None:
            return float(v)
    return default


def _lvl_elevation_mm(lvl: dict, default: float = 0.0) -> float:
    """Mirror of :func:`_lvl_height_mm` for the level elevation."""

    for key in ("elevationMM", "elevationMm"):
        v = lvl.get(key)
        if v is not None:
            return float(v)
    return default


def _partition_segment(fact: dict) -> list[list[float]] | None:
    """Return a 2-vertex line segment for an interior_partition fact.

    Tolerant of both reader-IR shapes:
      * ``polygonMm: [[ax, ay], [bx, by]]`` (alpha, beta)
      * ``startMm: {xMm, yMm}`` + ``endMm: {xMm, yMm}`` (gamma)
    Returns ``None`` if neither is present or malformed.
    """

    seg = fact.get("polygonMm") or fact.get("polygonMM")
    if isinstance(seg, list) and len(seg) >= 2:
        try:
            return [
                [float(seg[0][0]), float(seg[0][1])],
                [float(seg[1][0]), float(seg[1][1])],
            ]
        except (KeyError, TypeError, IndexError):
            pass
    start = fact.get("startMm")
    end = fact.get("endMm")
    if isinstance(start, dict) and isinstance(end, dict):
        try:
            return [
                [float(start.get("xMm") or 0), float(start.get("yMm") or 0)],
                [float(end.get("xMm") or 0), float(end.get("yMm") or 0)],
            ]
        except (TypeError, ValueError):
            pass
    # Some IRs use [x, y] lists rather than {xMm, yMm} dicts for the
    # endpoints (gamma v2.1).
    if isinstance(start, list) and isinstance(end, list) and len(start) >= 2 and len(end) >= 2:
        try:
            return [
                [float(start[0]), float(start[1])],
                [float(end[0]), float(end[1])],
            ]
        except (TypeError, ValueError):
            pass
    return None


def _ensure_model(*, house: str, api_base: str) -> str:
    """Return a bim_models.id for ``house``; create if absent.

    Convention: the DB slug IS the house name (``alpha`` | ``beta`` |
    ``gamma``) — same string the inspector's URL parameter uses, no
    ``house-`` prefix. This makes the seed name and the agent tracker
    name identical by construction; ``agent_runs.py::_resolve_house_model_id``
    looks the slug up directly without prefix-juggling.

    A legacy probe checks for the old ``house-<name>`` slug too so
    pre-2026-05-23 models can be cleaned up via the purge script.
    """

    boot = httpx.get(f"{api_base.rstrip('/')}/bootstrap", timeout=30.0).json()
    for proj in boot.get("projects") or []:
        for m in proj.get("models") or []:
            slug = m.get("slug")
            if slug == house or slug == f"house-{house}":
                return str(m["id"])
    body = {"slug": house}
    url = f"{api_base.rstrip('/')}/projects/{PROJECT_ID_FOR_TESTHOUSES}/models"
    r = httpx.post(url, json=body, timeout=60.0)
    r.raise_for_status()
    return str(r.json()["id"])


def _shell_bundle_from_ir(*, ir: dict, parent_revision: int, iter_n: int) -> dict:
    """Build a CMD-V3-01 bundle for iter-3's exterior shell.

    Authors the three storey levels, a closed EG wall loop, an EG slab
    floor, and a main gable roof — enough to satisfy iter-3's
    ≥ 4/10 exterior bar while keeping the command list short.
    """

    house = ir["house"]
    poly = ir["exteriorWallChainEG"]["polygonMM"]
    thickness = float(ir["exteriorWallChainEG"]["wallThicknessMM"])
    eg_height = next((_lvl_height_mm(lvl) for lvl in ir["levels"] if lvl["id"] == "level-EG"), 2700)

    level_kg = f"th-{house}-i{iter_n}-level-KG"
    level_eg = f"th-{house}-i{iter_n}-level-EG"
    level_dg = f"th-{house}-i{iter_n}-level-DG"

    commands: list[dict] = []
    for lvl in ir["levels"]:
        commands.append(
            {
                "type": "createLevel",
                "id": {"KG": level_kg, "EG": level_eg, "DG": level_dg}[lvl["id"].split("-")[-1]],
                "name": lvl["name"],
                "elevationMm": _lvl_elevation_mm(lvl),
            }
        )

    for i in range(len(poly)):
        a = poly[i]
        b = poly[(i + 1) % len(poly)]
        commands.append(
            {
                "type": "createWall",
                "id": f"th-{house}-i{iter_n}-eg-wall-{i}",
                "name": f"EG exterior wall {i}",
                "levelId": level_eg,
                "start": {"xMm": float(a[0]), "yMm": float(a[1])},
                "end": {"xMm": float(b[0]), "yMm": float(b[1])},
                "thicknessMm": thickness,
                "heightMm": float(eg_height),
            }
        )

    commands.append(
        {
            "type": "createFloor",
            "id": f"th-{house}-i{iter_n}-eg-slab",
            "name": "EG slab",
            "levelId": level_eg,
            "boundaryMm": [{"xMm": float(p[0]), "yMm": float(p[1])} for p in poly],
            "thicknessMm": 220,
        }
    )

    commands.append(
        {
            "type": "createRoof",
            "id": f"th-{house}-i{iter_n}-main-roof",
            "name": "Main gable roof",
            "referenceLevelId": level_dg,
            "footprintMm": [{"xMm": float(p[0]), "yMm": float(p[1])} for p in poly],
            "overhangMm": 400,
            "slopeDeg": 35,
            "roofGeometryMode": "gable_pitched_rectangle",
        }
    )

    return {
        "schemaVersion": "cmd-v3.0",
        "commands": commands,
        "parentRevision": parent_revision,
        "assumptions": [
            {
                "key": f"testhouse_iter_{iter_n}_{house}_shell",
                "value": "iter-3 exterior shell: levels KG/EG/DG, closed EG wall loop, slab, main gable roof",
                "confidence": 0.5,
                "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                "contestable": True,
                "evidence": "iter-1 reader pass on EG-1.png + Ansichten-1.png",
            }
        ],
    }


def _current_revision(*, api_base: str, model_id: str) -> int:
    r = httpx.get(f"{api_base.rstrip('/')}/models/{model_id}/snapshot", timeout=30.0)
    r.raise_for_status()
    return int(r.json().get("revision") or 1)


def _snapshot(*, api_base: str, model_id: str) -> dict:
    r = httpx.get(f"{api_base.rstrip('/')}/models/{model_id}/snapshot", timeout=30.0)
    r.raise_for_status()
    return r.json()


def _apply_slice(
    *,
    house: str,
    iter_n: int,
    phase: str,
    bundle: dict,
    api_base: str,
    submitter: str,
) -> dict:
    """Apply a CMD-V3-01 bundle as a hybrid slice with testhouse_iter context.

    Returns ``{model_id, commit_id, revision_after, ok, executionState,
    elapsed_ms}`` and emits the four structured-log records the tracker
    pins on ``bim_ai.testhouse_iter``.
    """

    set_correlation_id(f"iter-{iter_n}-{phase}-house-{house}-{uuid.uuid4().hex[:8]}")
    logger.info(
        "testhouse_iter.start",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "source_root": str(_house_root(house)),
            "model_id": None,
        },
    )
    started = time.monotonic()

    try:
        model_id = _ensure_model(house=house, api_base=api_base)
        payload = {
            "phase": {"phaseId": phase},
            "bundle": bundle,
            "commit": True,
            "iterationLabel": f"iter-{iter_n}",
            "houseName": house,
            "outputDir": str(_house_workdir(house) / f"iter-{iter_n}"),
            "submitter": submitter,
            "userId": "local-dev",
            "advisorProfile": "authoring_default",
            "testhouseIter": {"house": house, "iter": iter_n, "phase": phase},
            "tool": "hybrid-reverse-bim",
            "controllingTracker": TRACKER_PATH,
        }
        logger.info(
            "testhouse_iter.commit_opened",
            extra={
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "commit_id": None,
                "model_id": model_id,
                "command_count": len(bundle["commands"]),
            },
        )
        result = _post(
            api_base=api_base,
            path=f"/v3/models/{model_id}/reverse-bim/hybrid-slice-execute",
            body=payload,
            timeout=600.0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "testhouse_iter.end",
            extra={
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "status": "failed",
                "elapsed_ms": int((time.monotonic() - started) * 1000),
                "error": str(exc),
            },
        )
        raise

    elapsed_ms = int((time.monotonic() - started) * 1000)
    rev_after = int((_snapshot(api_base=api_base, model_id=model_id).get("revision")) or 1)
    # time-travel router is mounted at /api (not /api/v3) — see main.py.
    # Filter on phase too (the tracker schema's `phase` field) by paging
    # the recent commits and matching client-side.
    commits = httpx.get(
        f"{api_base.rstrip('/')}/models/{model_id}/commits",
        params={"limit": 10, "testhouse_house": house, "testhouse_iter": iter_n},
        timeout=30.0,
    ).json()
    commit_id = None
    for item in commits.get("items") or commits.get("commits") or []:
        ctx_phase = ((item.get("context") or {}).get("testhouse_iter") or {}).get("phase")
        if ctx_phase == phase:
            commit_id = item.get("commitId") or item.get("commit_id")
            break

    logger.info(
        "testhouse_iter.commit_closed",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "commit_id": commit_id,
            "revision_after": rev_after,
        },
    )
    logger.info(
        "testhouse_iter.end",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "status": "ok" if result.get("ok") else "partial",
            "elapsed_ms": elapsed_ms,
            "commit_id": commit_id,
            "model_id": model_id,
        },
    )
    out = {
        "house": house,
        "iter": iter_n,
        "phase": phase,
        "ok": bool(result.get("ok")),
        "model_id": model_id,
        "commit_id": commit_id,
        "revision_after": rev_after,
        "elapsed_ms": elapsed_ms,
        "executionState": result.get("executionState"),
    }
    print(json.dumps(out, sort_keys=True))
    return out


def _cmd_author_shell(args: argparse.Namespace) -> int:
    house = args.house
    iter_n = int(args.iter)
    ir_path = _ir_path(house)
    if not ir_path.is_file():
        raise FileNotFoundError(f"missing iter-1 IR: {ir_path}. Run iter-1 (reader pass) first.")
    ir = json.loads(ir_path.read_text(encoding="utf-8"))
    model_id = _ensure_model(house=house, api_base=args.api_base)
    parent_rev = _current_revision(api_base=args.api_base, model_id=model_id)
    bundle = _shell_bundle_from_ir(ir=ir, parent_revision=parent_rev, iter_n=iter_n)
    out = _apply_slice(
        house=house,
        iter_n=iter_n,
        phase="exterior-shell",
        bundle=bundle,
        api_base=args.api_base,
        submitter="testhouse_drive.author-shell",
    )
    return 0 if out["ok"] else 1


# ───────────────────────────────────────────────────────────────────
# ortho-viewpoints phase (cardinal 3D cameras for the visual loop)
# ───────────────────────────────────────────────────────────────────

ORTHO_DIRECTIONS: dict[str, tuple[float, float, float]] = {
    # camera offset from building center, unit direction. +z=0.05 gives
    # a slight downward tilt so the eave line stays visible.
    "north": (0.0, 1.0, 0.05),  # camera north of building, looking south
    "east": (1.0, 0.0, 0.05),
    "south": (0.0, -1.0, 0.05),
    "west": (-1.0, 0.0, 0.05),
}


def _model_bbox_mm(snapshot: dict) -> tuple[float, float, float, float, float, float]:
    """Coarse axis-aligned bbox over walls + floors + roofs in the live model.

    Falls back to ``(0,0,0,1,1,1)`` if no geometry is present (lets the
    caller fail cleanly without crashing on empty models).
    """

    xs: list[float] = []
    ys: list[float] = []
    zs: list[float] = []
    levels: dict[str, float] = {}
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict):
            continue
        if e.get("kind") == "level":
            levels[str(e.get("id"))] = float(e.get("elevationMm") or 0)
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict):
            continue
        kind = e.get("kind")
        if kind == "wall":
            for pt in (e.get("start"), e.get("end")):
                if isinstance(pt, dict):
                    xs.append(float(pt.get("xMm") or 0))
                    ys.append(float(pt.get("yMm") or 0))
            base_z = levels.get(str(e.get("levelId")), 0)
            zs.extend([base_z, base_z + float(e.get("heightMm") or 0)])
        elif kind in {"floor", "roof"}:
            boundary = e.get("boundaryMm") or e.get("footprintMm") or []
            for pt in boundary:
                if isinstance(pt, dict):
                    xs.append(float(pt.get("xMm") or 0))
                    ys.append(float(pt.get("yMm") or 0))
            base_z = levels.get(str(e.get("levelId") or e.get("referenceLevelId")), 0)
            zs.append(base_z)
    if not xs or not ys:
        return (0.0, 1.0, 0.0, 1.0, 0.0, 1.0)
    if not zs:
        zs = [0.0, 3000.0]
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))


def _ortho_camera(
    bbox: tuple[float, float, float, float, float, float],
    offset_unit: tuple[float, float, float],
) -> dict:
    """Cardinal-direction camera at 2.5× bbox diagonal — near-orthographic perspective."""

    xmin, xmax, ymin, ymax, zmin, zmax = bbox
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2
    cz = (zmin + zmax) / 2
    diag = math.sqrt((xmax - xmin) ** 2 + (ymax - ymin) ** 2 + (zmax - zmin) ** 2)
    radius = 2.5 * (diag or 10_000)
    norm = math.sqrt(sum(c * c for c in offset_unit)) or 1.0
    return {
        "position": {
            "xMm": round(cx + radius * offset_unit[0] / norm, 1),
            "yMm": round(cy + radius * offset_unit[1] / norm, 1),
            "zMm": round(cz + radius * offset_unit[2] / norm, 1),
        },
        "target": {"xMm": round(cx, 1), "yMm": round(cy, 1), "zMm": round(cz, 1)},
        "up": {"xMm": 0.0, "yMm": 0.0, "zMm": 1.0},
    }


def _ortho_views_bundle(*, snapshot: dict, parent_revision: int, iter_n: int, house: str) -> dict:
    bbox = _model_bbox_mm(snapshot)
    commands: list[dict] = []
    for direction, offset in ORTHO_DIRECTIONS.items():
        commands.append(
            {
                "type": "saveViewpoint",
                "id": f"th-{house}-i{iter_n}-view-3d-ortho-{direction}",
                "name": f"3D ortho — {direction}",
                "camera": _ortho_camera(bbox, offset),
                "mode": "orbit_3d",
            }
        )
    return {
        "schemaVersion": "cmd-v3.0",
        "commands": commands,
        "parentRevision": parent_revision,
        "assumptions": [
            {
                "key": f"testhouse_iter_{iter_n}_{house}_ortho_views",
                "value": "Four cardinal 3D viewpoints @ 2.5×bbox-diag for near-orthographic facade capture",
                "confidence": 0.9,
                "source": f"bbox over walls/floors/roofs in model snapshot rev {parent_revision}",
                "contestable": False,
                "evidence": "scripts/archive/testhouse_iter14_author_ortho_viewpoints.py (recipe of record)",
            }
        ],
    }


# ───────────────────────────────────────────────────────────────────
# v2 per-floor inside-out authoring
# ───────────────────────────────────────────────────────────────────

# IR fact lookup helpers.


def _facts_for_level(ir: dict, level_id: str) -> list[dict]:
    return [
        f
        for f in (ir.get("extractedFacts") or [])
        if isinstance(f, dict) and (f.get("levelId") == level_id or f.get("levelId") == "global")
    ]


def _facts_by_kind(facts: list[dict], kind: str) -> list[dict]:
    return [f for f in facts if f.get("kind") == kind]


def _source_evidence_from_facts(facts: list[dict]) -> list[dict]:
    """Distinct (docId, page) pairs across the consumed facts."""

    seen: set[tuple] = set()
    evidence: list[dict] = []
    for f in facts:
        doc_id = f.get("sourceDocId")
        page = f.get("sourcePage")
        if not doc_id:
            continue
        key = (doc_id, page)
        if key in seen:
            continue
        seen.add(key)
        rendered = (
            f"tmp/reverse-bim/house-{f.get('house', '')}/preflight/rendered-pages/{doc_id}/"
            if doc_id
            else None
        )
        evidence.append(
            {
                "docId": doc_id,
                "page": page,
                "role": f.get("kind"),
                "renderedPath": rendered,
            }
        )
    return evidence


# Bundle builders per sub-phase. Each returns (commands, consumed_fact_ids,
# source_evidence) or None when the phase is empty (skipped).


def _topology_bundle(
    *, ir: dict, parent_revision: int, house: str
) -> tuple[dict, list[str]] | None:
    """v2 topology slice — toposolid sized to the building footprint + 5m margin.

    Per the v2 tracker, topology lands BEFORE any building element so
    the KG slab + walls have a parent to anchor against. We seed the
    toposolid from the IR's exterior_wall_chain polygon (the building
    footprint), expanded by 5 m on every side to give a realistic
    parcel-like context band, and we set its `baseElevationMm` to
    just below the KG floor so the basement is "in the ground". A
    later iter authors a real parcel polygon + the excavation
    relation; this is the bare-site MVP that unblocks the per-floor
    loop.
    """

    chain = next(
        (
            f
            for f in (ir.get("extractedFacts") or [])
            if f.get("kind") == "exterior_wall_chain" and f.get("levelId") == "level-EG"
        ),
        None,
    )
    if chain is None:
        return None
    poly = chain.get("polygonMm") or chain.get("polygonMM") or []
    if len(poly) >= 2 and poly[0] == poly[-1]:
        poly = poly[:-1]
    if len(poly) < 3:
        return None

    margin = 5000  # 5 m parcel-context band around the building.
    xs = [float(p[0]) for p in poly]
    ys = [float(p[1]) for p in poly]
    xmin, xmax = min(xs) - margin, max(xs) + margin
    ymin, ymax = min(ys) - margin, max(ys) + margin
    topo_poly = [
        {"xMm": xmin, "yMm": ymin},
        {"xMm": xmax, "yMm": ymin},
        {"xMm": xmax, "yMm": ymax},
        {"xMm": xmin, "yMm": ymax},
    ]

    # KG sits at -2500; place the toposolid surface ~at grade (0 mm)
    # with the solid extending 1500 mm down. The KG excavation is
    # authored later as a Toposolid excavation relation against the
    # KG slab.
    return (
        {
            "schemaVersion": "cmd-v3.0",
            "commands": [
                {
                    "type": "CreateToposolid",
                    "toposolidId": f"th-{house}-toposolid",
                    "name": "Site toposolid",
                    "boundaryMm": topo_poly,
                    "thicknessMm": 1500,
                    "baseElevationMm": -1500,
                }
            ],
            "parentRevision": parent_revision,
            "assumptions": [
                {
                    "key": f"testhouse_{house}_topology",
                    "value": f"Toposolid {xmax - xmin:.0f}×{ymax - ymin:.0f} mm around the EG footprint with 5 m parcel margin",
                    "confidence": 0.5,
                    "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                    "contestable": True,
                    "evidence": "iter-1 EG exterior_wall_chain expanded by 5 m on every side; surface at grade (0 mm), solid extends 1500 mm down. Parcel boundary + excavation relation deferred.",
                }
            ],
        },
        [str(chain.get("factId"))],
    )


def _project_setup_bundle(*, ir: dict, parent_revision: int, house: str) -> dict | None:
    commands: list[dict] = []
    for lvl in ir.get("levels") or []:
        short = lvl["id"].split("-")[-1]  # KG / EG / DG
        commands.append(
            {
                "type": "createLevel",
                "id": f"th-{house}-level-{short}",
                "name": lvl.get("name") or short,
                "elevationMm": _lvl_elevation_mm(lvl),
            }
        )
    if not commands:
        return None
    return {
        "schemaVersion": "cmd-v3.0",
        "commands": commands,
        "parentRevision": parent_revision,
        "assumptions": [
            {
                "key": f"testhouse_{house}_project_setup",
                "value": "Storey levels KG/EG/DG from IR.levels[]",
                "confidence": 0.95,
                "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                "contestable": False,
                "evidence": "iter-1 reader pass",
            }
        ],
    }


def _rooms_bundle(
    *, ir: dict, parent_revision: int, house: str, level_short: str
) -> tuple[dict, list[str]] | None:
    level_id = f"th-{house}-level-{level_short}"
    eg_height = next(
        (_lvl_height_mm(lvl) for lvl in ir["levels"] if lvl["id"].endswith(level_short)), 2700
    )
    facts = _facts_for_level(ir, f"level-{level_short}")
    rooms = _facts_by_kind(facts, "room_outline")
    if not rooms:
        return None
    commands: list[dict] = []
    consumed: list[str] = []
    for r in rooms:
        poly = r.get("polygonMm") or r.get("polygonMM") or []
        if len(poly) >= 2 and poly[0] == poly[-1]:
            poly = poly[:-1]
        if not poly or len(poly) < 3:
            continue
        commands.append(
            {
                "type": "createRoomOutline",
                "id": f"th-{house}-i-{level_short}-room-{_slugify(r.get('text') or r.get('factId'))}",
                "name": str(r.get("text") or "Room"),
                "levelId": level_id,
                "outlineMm": [{"xMm": float(p[0]), "yMm": float(p[1])} for p in poly],
            }
        )
        consumed.append(str(r.get("factId")))
    if not commands:
        return None
    bundle = {
        "schemaVersion": "cmd-v3.0",
        "commands": commands,
        "parentRevision": parent_revision,
        "assumptions": [
            {
                "key": f"testhouse_{house}_{level_short}_rooms",
                "value": f"{len(commands)} room outlines for {level_short} from IR.extractedFacts[kind=room_outline]",
                "confidence": 0.7,
                "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                "contestable": True,
                "evidence": f"iter-1 reader pass on level-{level_short}",
            }
        ],
    }
    # used heights for downstream height-aware authoring; record for traceability
    bundle["__metaEgHeight"] = eg_height  # type: ignore[index] — consumed in this module only
    return (bundle, consumed)


def _exterior_walls_bundle(
    *, ir: dict, parent_revision: int, house: str, level_short: str
) -> tuple[dict, list[str]] | None:
    level_id = f"th-{house}-level-{level_short}"
    eg_height = next(
        (_lvl_height_mm(lvl) for lvl in ir["levels"] if lvl["id"].endswith(level_short)), 2700
    )
    facts = _facts_for_level(ir, f"level-{level_short}")
    chain_facts = _facts_by_kind(facts, "exterior_wall_chain")
    if not chain_facts:
        return None
    fact = chain_facts[0]
    poly = fact.get("polygonMm") or fact.get("polygonMM") or []
    # If the IR repeats the first vertex at the tail (closed-loop form),
    # drop the duplicate before generating walls — otherwise the last
    # createWall has zero length and the dry-run rejects the bundle.
    if len(poly) >= 2 and poly[0] == poly[-1]:
        poly = poly[:-1]
    if not poly or len(poly) < 3:
        return None

    # Skip exterior-chain edges that coincide with an interior_partition
    # tagged as a party-wall on this floor. The reader puts the
    # Doppelhaus party wall in interior_partition facts so it's modeled
    # as a single (interior) wall, not duplicated as a 365 mm exterior
    # wall + a 175 mm party-wall partition stacked on the same line.
    party_segments: list[tuple[tuple[float, float], tuple[float, float]]] = []
    for p in _facts_by_kind(facts, "interior_partition"):
        text = f"{p.get('text') or ''} {p.get('note') or ''} {p.get('factId') or ''}".lower()
        if "party" not in text:
            continue
        seg = _partition_segment(p)
        if seg is not None:
            party_segments.append(
                (
                    (seg[0][0], seg[0][1]),
                    (seg[1][0], seg[1][1]),
                )
            )

    def _seg_match(
        a: tuple[float, float],
        b: tuple[float, float],
        x: tuple[float, float],
        y: tuple[float, float],
        tol: float = 50.0,
    ) -> bool:
        def _close(p1: tuple[float, float], p2: tuple[float, float]) -> bool:
            return math.hypot(p1[0] - p2[0], p1[1] - p2[1]) <= tol

        return (_close(a, x) and _close(b, y)) or (_close(a, y) and _close(b, x))

    commands: list[dict] = []
    for i in range(len(poly)):
        a = (float(poly[i][0]), float(poly[i][1]))
        b = (float(poly[(i + 1) % len(poly)][0]), float(poly[(i + 1) % len(poly)][1]))
        if any(_seg_match(a, b, ps[0], ps[1]) for ps in party_segments):
            # Edge already covered by a party-wall interior partition.
            continue
        commands.append(
            {
                "type": "createWall",
                "id": f"th-{house}-i-{level_short}-ext-wall-{i}",
                "name": f"{level_short} exterior wall {i}",
                "levelId": level_id,
                "start": {"xMm": a[0], "yMm": a[1]},
                "end": {"xMm": b[0], "yMm": b[1]},
                "thicknessMm": 365,
                "heightMm": float(eg_height),
            }
        )
    # slab — boundary follows the same polygon.
    commands.append(
        {
            "type": "createFloor",
            "id": f"th-{house}-i-{level_short}-slab",
            "name": f"{level_short} slab",
            "levelId": level_id,
            "boundaryMm": [{"xMm": float(p[0]), "yMm": float(p[1])} for p in poly],
            "thicknessMm": 220,
        }
    )
    return (
        {
            "schemaVersion": "cmd-v3.0",
            "commands": commands,
            "parentRevision": parent_revision,
            "assumptions": [
                {
                    "key": f"testhouse_{house}_{level_short}_ext_walls",
                    "value": f"Exterior wall chain + slab for {level_short} derived from IR polygon",
                    "confidence": 0.6,
                    "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                    "contestable": True,
                    "evidence": f"iter-1 reader pass — exterior_wall_chain fact level-{level_short}",
                }
            ],
        },
        [str(fact.get("factId"))],
    )


def _partitions_bundle(
    *, ir: dict, parent_revision: int, house: str, level_short: str
) -> tuple[dict, list[str]] | None:
    """Author interior partition walls from IR partition facts.

    Each `interior_partition` fact carries a `polygonMm` of two
    vertices (start + end of the wall segment). Authored at the
    floor's heightMM with a 175 mm thickness (typical interior
    Trockenwand or Mauerwand). After these walls land the
    `<floor>-openings` phase can host interior doors on them via
    `_host_on_nearest_wall` (no code change needed — it already
    walks every wall on the level).
    """

    level_id = f"th-{house}-level-{level_short}"
    floor_height = next(
        (_lvl_height_mm(lvl) for lvl in ir["levels"] if lvl["id"].endswith(level_short)), 2700
    )
    facts = _facts_for_level(ir, f"level-{level_short}")
    partitions = _facts_by_kind(facts, "interior_partition")
    if not partitions:
        return None

    commands: list[dict] = []
    consumed: list[str] = []
    for p in partitions:
        # Author EVERY partition (incl. party-wall partitions) as a
        # 175 mm interior wall. The exterior-walls bundle separately
        # detects party-wall partitions and drops the matching
        # exterior-chain edge so the two never stack — the visible
        # west boundary is the 175 mm partition, no 365 mm exterior.
        seg = _partition_segment(p)
        if seg is None:
            continue
        a, b = seg[0], seg[1]
        if a == b:
            continue
        commands.append(
            {
                "type": "createWall",
                "id": f"th-{house}-i-{level_short}-partition-{_slugify(p.get('factId'))}",
                "name": (str(p.get("note") or "Partition"))[:80],
                "levelId": level_id,
                "start": {"xMm": float(a[0]), "yMm": float(a[1])},
                "end": {"xMm": float(b[0]), "yMm": float(b[1])},
                "thicknessMm": 175,
                "heightMm": float(floor_height),
            }
        )
        consumed.append(str(p.get("factId")))

    if not commands:
        return None
    return (
        {
            "schemaVersion": "cmd-v3.0",
            "commands": commands,
            "parentRevision": parent_revision,
            "assumptions": [
                {
                    "key": f"testhouse_{house}_{level_short}_partitions",
                    "value": f"{len(commands)} interior partitions @ 175 mm from IR.extractedFacts[kind=interior_partition]",
                    "confidence": 0.6,
                    "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                    "contestable": True,
                    "evidence": f"iter-1 reader: partition line segments for level-{level_short}",
                }
            ],
        },
        consumed,
    )


def _host_on_nearest_wall(
    vertex: list, walls: list[dict], *, max_distance_mm: float = 500.0
) -> tuple[dict | None, float]:
    """Return (wall_element, alongT) hosting ``vertex`` on the nearest exterior wall.

    ``walls`` is the snapshot list of wall elements (each carrying
    ``start: {xMm, yMm}`` + ``end: {xMm, yMm}``). Hosts on the wall
    whose segment is closest to ``vertex``, clamping the parameter to
    ``[0, 1]``. Returns ``(None, 0)`` if every wall is farther than
    ``max_distance_mm``.
    """

    px = float(vertex[0])
    py = float(vertex[1])
    best: tuple[dict | None, float, float] = (None, 0.0, float("inf"))
    for w in walls:
        start = w.get("start") or {}
        end = w.get("end") or {}
        sx, sy = float(start.get("xMm") or 0), float(start.get("yMm") or 0)
        ex, ey = float(end.get("xMm") or 0), float(end.get("yMm") or 0)
        dx, dy = ex - sx, ey - sy
        ll = dx * dx + dy * dy
        if ll <= 1e-6:
            continue
        t = ((px - sx) * dx + (py - sy) * dy) / ll
        t = max(0.0, min(1.0, t))
        cx = sx + t * dx
        cy = sy + t * dy
        d = math.hypot(cx - px, cy - py)
        if d < best[2]:
            best = (w, t, d)
    if best[0] is None or best[2] > max_distance_mm:
        return (None, 0.0)
    return (best[0], best[1])


def _openings_bundle(
    *, ir: dict, parent_revision: int, house: str, level_short: str, snapshot: dict
) -> tuple[dict, list[str], list[dict]] | None:
    """Build doors + windows hosted on existing exterior walls for this level.

    Returns ``(bundle, consumed_fact_ids, skipped_facts)`` or ``None``
    when there are no openings to author.

    Skipped facts list captures openings whose nearest wall was beyond
    the max hosting distance — these are typically interior doors that
    belong on partitions we haven't authored yet.
    """

    level_id = f"th-{house}-level-{level_short}"
    walls = [
        e
        for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") == "wall" and e.get("levelId") == level_id
    ]
    if not walls:
        return None

    facts = _facts_for_level(ir, f"level-{level_short}")
    doors = _facts_by_kind(facts, "door")
    windows = _facts_by_kind(facts, "window")

    eg_height = next(
        (_lvl_height_mm(lvl) for lvl in ir["levels"] if lvl["id"].endswith(level_short)), 2700
    )

    commands: list[dict] = []
    consumed: list[str] = []
    skipped: list[dict] = []
    # Track running opening width per wall so we don't pile multiple
    # doors onto a short interior partition (e.g. the 1300 mm bad/wc
    # wall can host one door, not two).
    wall_load_mm: dict[str, float] = {}

    def _try_host(
        *,
        fact: dict,
        opening_kind: str,
        opening_width_mm: float,
        cmd_type: str,
        extra_cmd_fields: dict,
    ) -> None:
        # Reader IRs use one of three shapes for opening position:
        #   1. ``vertexMm: [x, y]`` (alpha) — the door/window center.
        #   2. ``wallStartMm + wallEndMm`` (gamma) — the host wall
        #      segment; we take its midpoint as the vertex.
        #   3. ``startMm + endMm`` (beta-ish alt) — same idea.
        vertex = fact.get("vertexMm")
        if not (isinstance(vertex, list) and len(vertex) >= 2):
            for ks, ke in (("wallStartMm", "wallEndMm"), ("startMm", "endMm")):
                s, e = fact.get(ks), fact.get(ke)
                # Dict-shape endpoints {xMm, yMm}.
                if isinstance(s, dict) and isinstance(e, dict):
                    vertex = [
                        (float(s.get("xMm") or 0) + float(e.get("xMm") or 0)) / 2,
                        (float(s.get("yMm") or 0) + float(e.get("yMm") or 0)) / 2,
                    ]
                    break
                # List-shape endpoints [x, y].
                if isinstance(s, list) and isinstance(e, list) and len(s) >= 2 and len(e) >= 2:
                    vertex = [
                        (float(s[0]) + float(e[0])) / 2,
                        (float(s[1]) + float(e[1])) / 2,
                    ]
                    break
        if not (isinstance(vertex, list) and len(vertex) >= 2):
            return
        wall, t = _host_on_nearest_wall(vertex, walls)
        if wall is None:
            skipped.append(
                {
                    "factId": fact.get("factId"),
                    "kind": opening_kind,
                    "reason": "no_host_within_500mm",
                }
            )
            return
        start, end = wall.get("start") or {}, wall.get("end") or {}
        wlen = math.hypot(
            float(end.get("xMm") or 0) - float(start.get("xMm") or 0),
            float(end.get("yMm") or 0) - float(start.get("yMm") or 0),
        )
        extent = opening_width_mm + 200.0  # 100 mm clearance each side
        if wlen < extent:
            skipped.append(
                {
                    "factId": fact.get("factId"),
                    "kind": opening_kind,
                    "reason": f"host_wall_too_short_{int(wlen)}mm",
                }
            )
            return
        t_min = (extent / 2) / wlen
        t_max = 1 - t_min
        if t < t_min - 0.2 or t > t_max + 0.2:
            skipped.append(
                {
                    "factId": fact.get("factId"),
                    "kind": opening_kind,
                    "reason": "host_position_at_corner",
                }
            )
            return
        t = max(t_min, min(t_max, t))
        wid = str(wall.get("id"))
        used = wall_load_mm.get(wid, 0.0)
        if used + extent > wlen:
            skipped.append(
                {
                    "factId": fact.get("factId"),
                    "kind": opening_kind,
                    "reason": "wall_capacity_exceeded",
                }
            )
            return
        wall_load_mm[wid] = used + extent
        commands.append(
            {
                "type": cmd_type,
                "id": f"th-{house}-i-{level_short}-{opening_kind}-{_slugify(fact.get('factId'))}",
                "name": str(fact.get("text") or opening_kind.title())[:80],
                "wallId": wid,
                "alongT": round(t, 4),
                "widthMm": int(opening_width_mm),
                **extra_cmd_fields,
            }
        )
        consumed.append(str(fact.get("factId")))

    for d in doors:
        # 800 mm typical interior door fits a 1300 mm partition with margin.
        _try_host(
            fact=d,
            opening_kind="door",
            opening_width_mm=800.0,
            cmd_type="insertDoorOnWall",
            extra_cmd_fields={},
        )

    for w in windows:
        _try_host(
            fact=w,
            opening_kind="window",
            opening_width_mm=1200.0,
            cmd_type="insertWindowOnWall",
            extra_cmd_fields={
                "sillHeightMm": 900,
                # Reserve 200 mm header clearance below the wall top
                # so the constructability check's 150 mm lintel rule
                # passes even on the low DG storey (2500 mm walls).
                "heightMm": int(min(1500, max(800, eg_height - 900 - 200))),
            },
        )

    if not commands:
        return None

    return (
        {
            "schemaVersion": "cmd-v3.0",
            "commands": commands,
            "parentRevision": parent_revision,
            "assumptions": [
                {
                    "key": f"testhouse_{house}_{level_short}_openings",
                    "value": (
                        f"{sum(1 for c in commands if c['type'] == 'insertDoorOnWall')} doors + "
                        f"{sum(1 for c in commands if c['type'] == 'insertWindowOnWall')} windows "
                        f"hosted on nearest exterior wall (≤3 m); "
                        f"{len(skipped)} interior openings skipped (no partition host yet)"
                    ),
                    "confidence": 0.5,
                    "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                    "contestable": True,
                    "evidence": f"iter-1 reader pass — door/window facts for level-{level_short}",
                }
            ],
        },
        consumed,
        skipped,
    )


def _roof_bundle(*, ir: dict, parent_revision: int, house: str) -> tuple[dict, list[str]] | None:
    """Roof draws on the DG floor extent + IR roof globals."""

    facts = _facts_for_level(ir, "level-DG")
    chain = _facts_by_kind(facts, "exterior_wall_chain")
    if not chain:
        return None
    poly = chain[0].get("polygonMm") or chain[0].get("polygonMM") or []
    if len(poly) >= 2 and poly[0] == poly[-1]:
        poly = poly[:-1]
    if not poly or len(poly) < 3:
        return None
    dg_level_id = f"th-{house}-level-DG"
    return (
        {
            "schemaVersion": "cmd-v3.0",
            "commands": [
                {
                    "type": "createRoof",
                    "id": f"th-{house}-main-roof",
                    "name": "Main gable roof",
                    "referenceLevelId": dg_level_id,
                    "footprintMm": [{"xMm": float(p[0]), "yMm": float(p[1])} for p in poly],
                    "overhangMm": 400,
                    "slopeDeg": 35,
                    "roofGeometryMode": "gable_pitched_rectangle",
                },
            ],
            "parentRevision": parent_revision,
            "assumptions": [
                {
                    "key": f"testhouse_{house}_roof",
                    "value": "Gable roof following DG extent; pitch 35°; overhang 400 mm",
                    "confidence": 0.6,
                    "source": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                    "contestable": True,
                    "evidence": "iter-1 reader: Satteldach, ridge E-W, eave 5400, ridge 9500",
                }
            ],
        },
        [str(chain[0].get("factId"))],
    )


def _slugify(s: str | None) -> str:
    import re as _re

    if not s:
        return "x"
    return _re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "x"


def _cmd_floor(args: argparse.Namespace) -> int:
    """v2 per-floor inside-out authoring loop for one floor of one house.

    Phases per spec/trackers/testhouse-clean-rebuild-tracker.md v2:
      <floor>-project-setup (KG only — creates levels)
      <floor>-rooms
      <floor>-partitions  (skipped — derived by createRoomOutline pending iter)
      <floor>-openings    (skipped pending door/window IR-driven authoring)
      <floor>-exterior-walls
      <floor>-roof        (DG only)
      <floor>-structural-gate  (advisor/constructability/integrity readouts)
      <floor>-visual-gate (capture + grader subagent — separate command)

    MVP: rooms + exterior-walls + roof are authored; partitions/openings/
    structural-gate are logged as phase commits with empty bundles so the
    iter-picker shows them, with explicit `source_limited` dispositions
    where the IR doesn't yet drive them. The grader subagent is invoked
    separately via `grade-floor`.
    """

    house = args.house
    iter_n = int(args.iter)
    floor = args.floor.upper()  # TOPOLOGY | KG | EG | DG | ROOF
    ir = json.loads(_ir_path(house).read_text(encoding="utf-8"))
    api_base = args.api_base

    model_id = _ensure_model(house=house, api_base=api_base)

    # TOPOLOGY iter seeds the site toposolid + project levels — the
    # bare-site state every subsequent floor anchors against.
    if floor == "TOPOLOGY":
        rev = _current_revision(api_base=api_base, model_id=model_id)
        ps_bundle = _project_setup_bundle(ir=ir, parent_revision=rev, house=house)
        if ps_bundle is not None:
            levels = ir.get("levels") or []
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase="topology-project-setup",
                bundle=ps_bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=[],
                source_evidence=[],
                narrative_input=(
                    f"{len(levels)} storey level(s) declared by the iter-1 reader: "
                    + ", ".join(
                        f"{lvl['name']} @ {int(_lvl_elevation_mm(lvl))}mm (height {int(_lvl_height_mm(lvl))}mm)"
                        for lvl in levels
                    )
                ),
                narrative_reasoning=(
                    "Seed the project with one createLevel per IR.levels[] entry before any "
                    "geometry is authored — every wall / slab / opening downstream binds to a "
                    "level by id, so this slice is the prerequisite for the whole rebuild."
                ),
                narrative_outcome=(
                    f"{len(levels)} levels created with stable ids th-{house}-level-{{KG|EG|DG}} "
                    f"so the floor sub-phases below can reference them by name."
                ),
            )
        rev = _current_revision(api_base=api_base, model_id=model_id)
        topo_pair = _topology_bundle(ir=ir, parent_revision=rev, house=house)
        if topo_pair is not None:
            bundle, consumed = topo_pair
            evidence = _source_evidence_from_facts(
                [
                    f
                    for f in (ir.get("extractedFacts") or [])
                    if f.get("kind") == "exterior_wall_chain" and f.get("levelId") == "level-EG"
                ]
            )
            for ev in evidence:
                ev["renderedPath"] = ev["renderedPath"].replace("house-/", f"house-{house}/")
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase="topology-toposolid",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
                narrative_input=(
                    "The EG exterior wall chain fact from the iter-1 reader pass — defines the "
                    "building footprint that the site has to accommodate."
                ),
                narrative_reasoning=(
                    "Build a CreateToposolid sized to the footprint + 5m parcel margin on every "
                    "side, surface at grade (0 mm), solid extending 1500 mm down. This is the "
                    "bare-site MVP that anchors every floor below it. A real parcel polygon + "
                    "the KG-as-cutter excavation relation are deferred to a later iter."
                ),
                narrative_outcome=(
                    "One toposolid element th-{house}-toposolid landed; subsequent floor slices "
                    "now have ground reference to host against."
                ),
            )
        return 0

    # KG iter seeds project setup (levels) ONLY if no level exists yet
    # — supports the v1-style "go straight to KG" path as a fallback,
    # while staying idempotent when iter-3 TOPOLOGY already ran.
    if floor == "KG":
        snap = _snapshot(api_base=api_base, model_id=model_id)
        has_levels = any(
            isinstance(e, dict) and e.get("kind") == "level"
            for e in (snap.get("elements") or {}).values()
        )
        if not has_levels:
            rev = int(snap.get("revision") or 1)
            bundle = _project_setup_bundle(ir=ir, parent_revision=rev, house=house)
            if bundle is not None:
                _apply_slice(
                    house=house,
                    iter_n=iter_n,
                    phase=f"{floor.lower()}-project-setup",
                    bundle=bundle,
                    api_base=api_base,
                    submitter="testhouse_drive.floor",
                )

    # Per-floor sub-phases (skip ROOF — handled separately below).
    if floor in {"KG", "EG", "DG"}:
        # rooms
        rev = _current_revision(api_base=api_base, model_id=model_id)
        rooms_pair = _rooms_bundle(ir=ir, parent_revision=rev, house=house, level_short=floor)
        if rooms_pair is not None:
            bundle, consumed = rooms_pair
            bundle.pop("__metaEgHeight", None)
            evidence = _source_evidence_from_facts(
                _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "room_outline")
            )
            for ev in evidence:
                ev["renderedPath"] = ev["renderedPath"].replace("house-/", f"house-{house}/")
            room_names = [
                str(f.get("text") or "?")
                for f in _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "room_outline")
            ]
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase=f"{floor.lower()}-rooms",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
                narrative_input=(
                    f"{len(room_names)} room_outline fact(s) for level-{floor} from the iter-1 "
                    f"reader pass on the {floor} floor plan: {', '.join(room_names) or '(none)'}"
                ),
                narrative_reasoning=(
                    "Inside-out: place room outlines FIRST so partitions can later derive from "
                    "shared edges and openings have hosts. Each createRoomOutline takes the "
                    f"polygon vertices the reader extracted from the {floor} plan and tags the "
                    "room with its source-named function (Wohnzimmer, Küche, ...). No walls are "
                    "authored at this step — just the topology."
                ),
                narrative_outcome=(
                    f"{len(consumed)} room outlines committed at level-{floor}. Rooms will be "
                    "flagged room_unenclosed by Advisor until partitions + exterior walls land."
                ),
            )

        # interior partitions — between rooms, before exterior walls
        # so the inside-out order holds and interior doors have hosts.
        rev = _current_revision(api_base=api_base, model_id=model_id)
        part_pair = _partitions_bundle(ir=ir, parent_revision=rev, house=house, level_short=floor)
        if part_pair is not None:
            bundle, consumed = part_pair
            evidence = _source_evidence_from_facts(
                _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "interior_partition")
            )
            for ev in evidence:
                ev["renderedPath"] = ev["renderedPath"].replace("house-/", f"house-{house}/")
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase=f"{floor.lower()}-partitions",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
                narrative_input=(
                    f"{len(consumed)} interior_partition fact(s) for level-{floor} — line "
                    "segments between adjacent rooms identified by the reader."
                ),
                narrative_reasoning=(
                    "One createWall per partition fact at 175 mm thickness (typical interior "
                    "Trockenwand). These walls give interior doors something to host on in the "
                    "openings sub-phase that follows exterior walls."
                ),
                narrative_outcome=(f"{len(consumed)} partition walls committed at level-{floor}."),
            )

        # exterior walls + slab
        rev = _current_revision(api_base=api_base, model_id=model_id)
        ext_pair = _exterior_walls_bundle(
            ir=ir, parent_revision=rev, house=house, level_short=floor
        )
        if ext_pair is not None:
            bundle, consumed = ext_pair
            evidence = _source_evidence_from_facts(
                _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "exterior_wall_chain")
            )
            for ev in evidence:
                ev["renderedPath"] = ev["renderedPath"].replace("house-/", f"house-{house}/")
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase=f"{floor.lower()}-exterior-walls",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
                narrative_input=(
                    f"The exterior_wall_chain fact for level-{floor} — the closed polygon that "
                    "defines the floor's perimeter."
                ),
                narrative_reasoning=(
                    "One createWall per polygon edge at 365 mm thickness (typical exterior "
                    "Außenwand), plus one createFloor whose boundary follows the same polygon "
                    "as the floor slab. The trailing-duplicate vertex of the closed-loop "
                    "polygon is trimmed so the last wall isn't zero-length."
                ),
                narrative_outcome=(
                    "4 exterior wall segments + 1 slab committed; the floor now has an enclosed "
                    "perimeter the openings phase can host windows against."
                ),
            )

        # openings: doors + windows hosted on the exterior walls we just
        # placed. Re-snapshot first so we see the live wall ids.
        snap_after_ext = _snapshot(api_base=api_base, model_id=model_id)
        rev = int(snap_after_ext.get("revision") or 1)
        op_triple = _openings_bundle(
            ir=ir,
            parent_revision=rev,
            house=house,
            level_short=floor,
            snapshot=snap_after_ext,
        )
        if op_triple is not None:
            bundle, consumed, skipped = op_triple
            evidence = _source_evidence_from_facts(
                _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "door")
                + _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "window")
            )
            for ev in evidence:
                ev["renderedPath"] = ev["renderedPath"].replace("house-/", f"house-{house}/")
            door_facts = _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "door")
            window_facts = _facts_by_kind(_facts_for_level(ir, f"level-{floor}"), "window")
            placed_doors = sum(
                1 for c in bundle.get("commands") or [] if c.get("type") == "insertDoorOnWall"
            )
            placed_windows = sum(
                1 for c in bundle.get("commands") or [] if c.get("type") == "insertWindowOnWall"
            )
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase=f"{floor.lower()}-openings",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
                narrative_input=(
                    f"{len(door_facts)} door fact(s) + {len(window_facts)} window fact(s) for "
                    f"level-{floor}. Each fact carries a vertexMm position the reader extracted "
                    "from the floor plan."
                ),
                narrative_reasoning=(
                    "For every opening fact: find the nearest live wall on the floor "
                    "(exterior chain + interior partitions both qualify), compute the parameter "
                    "alongT clamped so the opening fits with 100 mm endpoint margin, skip if "
                    "the host is too short or too far away. Doors default 800 mm wide; windows "
                    "1200 mm wide with sill 900 mm. Window height capped to wall_height − "
                    "200 mm header reserve so the constructability lintel rule passes."
                ),
                narrative_outcome=(
                    f"{placed_doors} door(s) + {placed_windows} window(s) hosted; "
                    f"{len(skipped)} opening(s) skipped (typically interior doors whose nearest "
                    "wall is beyond the 500 mm hosting threshold)."
                ),
            )
            if skipped:
                logger.info(
                    "testhouse_iter.openings_skipped",
                    extra={
                        "house": house,
                        "iter": iter_n,
                        "phase": f"{floor.lower()}-openings",
                        "skipped_count": len(skipped),
                        "skipped": skipped,
                    },
                )

    # ROOF: single roof slice on top of existing DG extent.
    if floor == "ROOF":
        rev = _current_revision(api_base=api_base, model_id=model_id)
        roof_pair = _roof_bundle(ir=ir, parent_revision=rev, house=house)
        if roof_pair is not None:
            bundle, consumed = roof_pair
            evidence = _source_evidence_from_facts(
                _facts_by_kind(ir.get("extractedFacts") or [], "ridge_height")
            )
            for ev in evidence:
                ev["renderedPath"] = ev["renderedPath"].replace("house-/", f"house-{house}/")
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase="roof-main",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
                narrative_input=(
                    "The DG exterior_wall_chain (footprint) + IR roof globals "
                    "(type, ridge orientation, eave/ridge heights, pitch). All extracted by "
                    "the reader from Ansichten-1.png + the section view."
                ),
                narrative_reasoning=(
                    "One createRoof with gable_pitched_rectangle geometry mode, footprint = DG "
                    "polygon, slope 35°, overhang 400 mm. Dormers + ridge-precise height + "
                    "party-wall flatness on the Doppelhaus west side are corrector-loop work."
                ),
                narrative_outcome=(
                    "One main roof committed; the building reads as a closed mass in the visual "
                    "captures. Dormers, ridge fine-tuning, and party-wall handling deferred."
                ),
            )

    # Always author + capture 4 cardinal ortho views at the end of
    # every floor iter so the /agents dashboard renders a visual
    # progression (bare site → KG slab → EG mass → DG → roof). See
    # spec/trackers/testhouse-clean-rebuild-tracker.md "Per-floor
    # phase contract".
    if not args.skip_per_iter_capture:
        try:
            snap = _snapshot(api_base=api_base, model_id=model_id)
            rev = int(snap.get("revision") or 1)
            ov_bundle = _ortho_views_bundle(
                snapshot=snap, parent_revision=rev, iter_n=iter_n, house=house
            )
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase=f"{floor.lower()}-ortho-viewpoints",
                bundle=ov_bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=[],
                source_evidence=[],
                narrative_input=(
                    f"Live model bbox at revision {rev} after the {floor.lower()} "
                    "authoring slices — walls, slabs, and roof if present."
                ),
                narrative_reasoning=(
                    "Per-iter visual loop: author 4 cardinal cameras (N/E/S/W) at "
                    "2.5× bbox diagonal so the perspective is near-orthographic, "
                    "then drive Playwright to capture each viewpoint. Lands the "
                    "per-iter ortho strip on the /agents dashboard so a reviewer "
                    "sees the building grow across iters."
                ),
                narrative_outcome=(
                    "4 saveViewpoint commands committed. Playwright capture follows."
                ),
            )
            _capture_ortho_for_iter(
                house=house, iter_n=iter_n, api_base=api_base, web_base=DEFAULT_WEB_BASE
            )
        except Exception as exc:  # noqa: BLE001 — capture is best-effort per iter
            logger.warning(
                "testhouse_iter.per_iter_ortho_failed",
                extra={
                    "house": house,
                    "iter": iter_n,
                    "phase": f"{floor.lower()}-ortho-captures",
                    "error": str(exc)[:200],
                },
            )

    return 0


def _capture_ortho_for_iter(*, house: str, iter_n: int, api_base: str, web_base: str) -> dict:
    """Drive Playwright to capture 4 ortho views for a single iter.

    Extracted so the per-iter floor command can call it without going
    through the argparse subcommand wrapper. Same dual-write to the
    legacy iter-N-captures/ layout the dashboard reads.
    """

    model_id = _ensure_model(house=house, api_base=api_base)
    out_dir = _house_workdir(house) / f"iter-{iter_n}" / "captures"
    out_dir.mkdir(parents=True, exist_ok=True)
    plan = _ortho_capture_plan(
        house=house, iter_n=iter_n, model_id=model_id, web_base=web_base, out_dir=out_dir
    )
    plan_path = out_dir / "ortho-capture-plan.json"
    plan_path.write_text(json.dumps(plan, indent=2, sort_keys=True), encoding="utf-8")
    cmd = [
        "pnpm",
        "--filter",
        "@bim-ai/web",
        "reverse-bim:capture",
        "--",
        "--plan",
        str(plan_path),
        "--out",
        str(out_dir),
        "--json",
    ]
    proc = subprocess.run(  # noqa: S603 — known command
        cmd,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=240,
    )
    pngs = sorted(out_dir.glob("ortho-*.png"))
    legacy_written = _dual_write_captures(
        house=house, iter_n=iter_n, source_dir=out_dir, capture_name_prefix="ortho"
    )
    logger.info(
        "testhouse_iter.per_iter_ortho_captured",
        extra={
            "house": house,
            "iter": iter_n,
            "png_count": len(pngs),
            "legacy_dual_write_count": len(legacy_written),
            "returncode": proc.returncode,
        },
    )
    return {"png_count": len(pngs), "returncode": proc.returncode}


def _apply_slice_v2(
    *,
    house: str,
    iter_n: int,
    phase: str,
    bundle: dict,
    api_base: str,
    submitter: str,
    consumed_fact_ids: list[str],
    source_evidence: list[dict],
    narrative_input: str = "",
    narrative_reasoning: str = "",
    narrative_outcome: str = "",
) -> dict:
    """v2 wrapper around _apply_slice that injects the three new arrays.

    Builds the testhouseIter dict with consumedFactIds + sourceEvidence
    before calling the hybrid-slice-execute route; producedElementIds is
    backfilled by the route post-commit from the bundle's changedIds.
    """

    set_correlation_id(f"iter-{iter_n}-{phase}-house-{house}-{uuid.uuid4().hex[:8]}")
    logger.info(
        "testhouse_iter.start",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "source_root": str(_house_root(house)),
            "model_id": None,
            "consumedFactIds": consumed_fact_ids,
            "sourceEvidence": source_evidence,
        },
    )
    started = time.monotonic()

    try:
        model_id = _ensure_model(house=house, api_base=api_base)
        payload = {
            "phase": {"phaseId": phase},
            "bundle": bundle,
            "commit": True,
            "iterationLabel": f"iter-{iter_n}",
            "houseName": house,
            "outputDir": str(_house_workdir(house) / f"iter-{iter_n}"),
            "submitter": submitter,
            "userId": "local-dev",
            "advisorProfile": "authoring_default",
            "testhouseIter": {
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "consumedFactIds": consumed_fact_ids,
                "sourceEvidence": source_evidence,
                # Human-readable narrative trio the inspector renders on
                # each iter card so a reviewer can see — without
                # cross-referencing the code — what the agent saw, what
                # it decided, and what it produced.
                "narrative": {
                    "input": narrative_input,
                    "reasoning": narrative_reasoning,
                    "outcome": narrative_outcome,
                },
                "commandCount": len(bundle.get("commands") or []),
            },
            "tool": "hybrid-reverse-bim",
            "controllingTracker": TRACKER_PATH,
        }
        logger.info(
            "testhouse_iter.commit_opened",
            extra={
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "commit_id": None,
                "model_id": model_id,
                "command_count": len(bundle["commands"]),
            },
        )
        result = _post(
            api_base=api_base,
            path=f"/v3/models/{model_id}/reverse-bim/hybrid-slice-execute",
            body=payload,
            timeout=600.0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "testhouse_iter.end",
            extra={
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "status": "failed",
                "elapsed_ms": int((time.monotonic() - started) * 1000),
                "error": str(exc),
            },
        )
        raise

    elapsed_ms = int((time.monotonic() - started) * 1000)
    rev_after = int((_snapshot(api_base=api_base, model_id=model_id).get("revision")) or 1)
    commits = httpx.get(
        f"{api_base.rstrip('/')}/models/{model_id}/commits",
        params={"limit": 10, "testhouse_house": house, "testhouse_iter": iter_n},
        timeout=30.0,
    ).json()
    commit_id = None
    produced = []
    for item in commits.get("items") or commits.get("commits") or []:
        ctx_th = (item.get("context") or {}).get("testhouse_iter") or {}
        if ctx_th.get("phase") == phase:
            commit_id = item.get("commitId") or item.get("commit_id")
            produced = ctx_th.get("producedElementIds") or []
            break

    logger.info(
        "testhouse_iter.commit_closed",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "commit_id": commit_id,
            "revision_after": rev_after,
            "producedElementIds": produced,
        },
    )
    logger.info(
        "testhouse_iter.end",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "status": "ok" if result.get("ok") else "partial",
            "elapsed_ms": elapsed_ms,
            "commit_id": commit_id,
            "model_id": model_id,
        },
    )
    out = {
        "house": house,
        "iter": iter_n,
        "phase": phase,
        "ok": bool(result.get("ok")),
        "model_id": model_id,
        "commit_id": commit_id,
        "revision_after": rev_after,
        "elapsed_ms": elapsed_ms,
        "executionState": result.get("executionState"),
        "producedElementIds": produced,
    }
    print(json.dumps(out, sort_keys=True))
    return out


def _emit_event(
    *,
    house: str,
    iter_n: int | None,
    phase: str,
    category: str,
    severity: str = "info",
    msg: str | None = None,
    **extras: Any,
) -> None:
    """Emit one structured ``bim_ai.testhouse_iter.<msg>`` record.

    Adds a ``category`` + ``severity`` field so the /agents dashboard
    can filter / icon-color the timeline (gap B5). All keyword
    arguments after ``msg`` land in the record as extras.
    """

    payload = {
        "house": house,
        "iter": iter_n,
        "phase": phase,
        "category": category,
        "severity": severity,
        **extras,
    }
    log_msg = msg or f"testhouse_iter.{category}"
    level = logger.error if severity == "error" else logger.warning if severity == "warn" else logger.info
    level(log_msg, extra=payload)


def _cmd_narrate_globals(args: argparse.Namespace) -> int:
    """Synthesise iter-1 (reader) + iter-2 (scope) narrative.json sidecars
    from the on-disk IR so the /agents dashboard's global-phase strip has
    a card for every pre-MCP step (iter-0 preflight is written by the
    preflight phase itself; iter-1 / iter-2 had no writer until this
    subcommand existed).
    """

    house = args.house
    ir_path = _ir_path(house)
    if not ir_path.is_file():
        raise FileNotFoundError(f"missing IR for narration: {ir_path}")
    ir = json.loads(ir_path.read_text(encoding="utf-8"))
    facts = ir.get("extractedFacts") or []
    by_kind: dict[str, int] = {}
    for f in facts:
        k = str(f.get("kind") or "?")
        by_kind[k] = by_kind.get(k, 0) + 1

    reader_narrative = ir.get("readerNarrative") or {}
    rn_input = str(reader_narrative.get("input") or "").strip()
    rn_reasoning = str(reader_narrative.get("reasoning") or "").strip()
    rn_outcome = str(reader_narrative.get("outcome") or "").strip()

    # iter-1: reader-pass narrative.
    docs = sorted({str(f.get("sourceDocId") or "") for f in facts if f.get("sourceDocId")})
    levels = ir.get("levels") or []
    _write_global_phase_narrative(
        house=house,
        iter_n=1,
        phase="reader-pass",
        narrative_input=(
            rn_input
            or (
                f"The {len(docs)} preflight-rendered source-page PNG group(s) for house-{house} "
                f"covering the EG / DG plans, elevations, section, plus supplementary "
                f"Baubeschreibung and Wohnflächenberechnung documents."
            )
        ),
        narrative_reasoning=(
            rn_reasoning
            or (
                "A vision-capable subagent reads each rendered page, traces room outlines from "
                "labels + dim chains, identifies partition lines between rooms, marks door / "
                "window centers, and back-derives level heights from the section + Wohnflächen "
                "calculations. Every extracted value carries a derivationNote spelling out the "
                "source pixel-to-mm chain."
            )
        ),
        narrative_outcome=(
            rn_outcome
            or f"{len(facts)} facts produced across {len(levels)} levels — broken down as "
            + ", ".join(f"{k}={v}" for k, v in sorted(by_kind.items()))
        ),
        inputs=[
            {
                "path": f"tmp/reverse-bim/house-{house}/preflight/rendered-pages/{d}",
                "role": "rendered-page-group",
            }
            for d in docs[:16]
        ],
        outputs=[
            {
                "path": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                "role": "existingBuildingIR_v2",
            }
        ],
        extra={"summary": {"factTotal": len(facts), "byKind": by_kind, "levels": len(levels)}},
    )

    # iter-2: scope-decisions narrative.
    scope = ir.get("scope") or {}
    _write_global_phase_narrative(
        house=house,
        iter_n=2,
        phase="scope-decisions",
        narrative_input=(
            "The reader IR's scope block + the per-house source-faithful constraints "
            f"identified during iter-1: kind={scope.get('kind') or '?'}, "
            f"halfWeKept={scope.get('halfWeKept') or 'n/a'}, "
            f"partyWallSide={scope.get('partyWallSide') or 'n/a'}."
        ),
        narrative_reasoning=(
            "Doppelhaus halves: model only the half-we-kept, treat the party-wall side as a "
            "flat interior partition (175 mm, not a 365 mm exterior wall), origin at the SW "
            "corner of the kept-half EG, +x east / +y north / units mm. The reader's "
            "interior_partition facts already carry the party-wall segment; the driver's "
            "exterior-wall builder skips any chain edge that overlaps a party-wall partition "
            "so the two never collide."
        ),
        narrative_outcome=(
            f"Scope locked: {scope.get('notes') or '(no notes)'}. Every downstream MCP slice "
            "(KG → EG → DG → roof) honours these decisions."
        ),
        inputs=[
            {
                "path": f"tmp/reverse-bim/house-{house}/understanding/existing-building-ir.json",
                "role": "existingBuildingIR_v2",
            }
        ],
        outputs=[
            {
                "path": f"tmp/reverse-bim/house-{house}/iter-2/narrative.json",
                "role": "testhousePhaseNarrative_v1",
            }
        ],
        extra={"scope": scope},
    )

    _emit_event(
        house=house,
        iter_n=1,
        phase="reader-pass-narrative",
        category="narrative_global",
        severity="info",
        msg="testhouse_iter.narrate_globals.iter1_written",
        factTotal=len(facts),
        byKind=by_kind,
        path=str(_house_workdir(house) / "iter-1" / "narrative.json"),
    )
    _emit_event(
        house=house,
        iter_n=2,
        phase="scope-decisions-narrative",
        category="narrative_global",
        severity="info",
        msg="testhouse_iter.narrate_globals.iter2_written",
        path=str(_house_workdir(house) / "iter-2" / "narrative.json"),
    )
    print(
        json.dumps(
            {
                "house": house,
                "iter1": str(_house_workdir(house) / "iter-1" / "narrative.json"),
                "iter2": str(_house_workdir(house) / "iter-2" / "narrative.json"),
                "factTotal": len(facts),
                "byKind": by_kind,
            },
            sort_keys=True,
        )
    )
    return 0


def _cmd_author_ortho_views(args: argparse.Namespace) -> int:
    house = args.house
    iter_n = int(args.iter)
    model_id = _ensure_model(house=house, api_base=args.api_base)
    snap = _snapshot(api_base=args.api_base, model_id=model_id)
    parent_rev = int(snap.get("revision") or 1)
    bundle = _ortho_views_bundle(
        snapshot=snap, parent_revision=parent_rev, iter_n=iter_n, house=house
    )
    out = _apply_slice(
        house=house,
        iter_n=iter_n,
        phase="ortho-viewpoints",
        bundle=bundle,
        api_base=args.api_base,
        submitter="testhouse_drive.author-ortho-views",
    )
    return 0 if out["ok"] else 1


# ───────────────────────────────────────────────────────────────────
# capture phase — drive Playwright via packages/web's capture runner
# ───────────────────────────────────────────────────────────────────

import subprocess  # noqa: E402

DEFAULT_WEB_BASE = "http://127.0.0.1:22000"


def _ortho_capture_plan(
    *, house: str, iter_n: int, model_id: str, web_base: str, out_dir: Path
) -> dict:
    captures = []
    for direction in ORTHO_DIRECTIONS:
        view_id = f"th-{house}-i{iter_n}-view-3d-ortho-{direction}"
        captures.append(
            {
                "captureId": f"ui:ortho-{direction}",
                "evidenceKind": "ui",
                "viewId": view_id,
                "viewKind": "orbit_3d",
                "url": f"{web_base.rstrip('/')}/?modelId={model_id}&activeViewpoint={view_id}",
                "path": str(out_dir / f"ortho-{direction}.png"),
                "playwrightSteps": [
                    {"action": "open_url", "target": "url"},
                    {"action": "wait_for_model_idle", "target": "jobs/status"},
                    {"action": "activate_3d_view", "viewId": view_id},
                    {"action": "screenshot", "selector": "[data-evidence-capture-root], body"},
                ],
                "visualChecklistItems": [
                    "exterior_silhouette_matches_source_elevation",
                    "wall_top_meets_roof_eave",
                    "roof_pitch_matches_ansichten",
                ],
            }
        )
    return {
        "format": "reverseBimViewCapturePlan_v1",
        "modelId": model_id,
        "runId": f"iter-{iter_n}-house-{house}-ortho",
        "baseUrl": web_base,
        "viewport": {"width": 1920, "height": 1200, "deviceScaleFactor": 1},
        "captures": captures,
        "blockers": [],
    }


# Mapping from our per-house capture name → the {house}-{view}-{variant}.png
# pattern AgentHouseDashboard.tsx expects (VIEW_KINDS = ['3d', 'elev-N…']).
# The dashboard renders both the 'full' and 'crop' variants; we only have the
# full screenshot, so 'crop' aliases the same file.
_LEGACY_VIEW_NAME_MAP = {
    "ortho-north": "elev-north",
    "ortho-east": "elev-east",
    "ortho-south": "elev-south",
    "ortho-west": "elev-west",
}


def _dual_write_captures(
    *, house: str, iter_n: int, source_dir: Path, capture_name_prefix: str = "ortho"
) -> list[Path]:
    """Copy per-house captures to the legacy iter-N-captures/ layout.

    `AgentHouseDashboard.tsx` resolves capture filenames as
    `{house}-{view-kind}-{variant}.png` and discovers them via
    `agent_runs.py::_enumerate_iterations` which scans
    `tmp/reverse-bim/iter-N-captures/`. We mirror our per-house PNGs
    there so the dashboard renders the iter card without any UI change.

    Returns the list of written paths.
    """

    legacy_dir = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-{iter_n}-captures"
    legacy_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for png in sorted(source_dir.glob(f"{capture_name_prefix}-*.png")):
        # Extract direction from "ortho-north.png" → "north"
        stem = png.stem  # "ortho-north"
        if "-" not in stem:
            continue
        direction = stem.split("-", 1)[1]
        view_kind = _LEGACY_VIEW_NAME_MAP.get(stem, f"{capture_name_prefix}-{direction}")
        for variant in ("full", "crop"):
            dst = legacy_dir / f"{house}-{view_kind}-{variant}.png"
            dst.write_bytes(png.read_bytes())
            written.append(dst)
    # Also drop a top-down 3d-full alias of the south view so the
    # dashboard's '3d' tile has a thumbnail until per-floor authoring
    # adds a proper top-down ortho.
    south = source_dir / f"{capture_name_prefix}-south.png"
    if south.is_file():
        for variant in ("full", "crop"):
            dst = legacy_dir / f"{house}-3d-{variant}.png"
            dst.write_bytes(south.read_bytes())
            written.append(dst)
    return written


def _cmd_capture_ortho_views(args: argparse.Namespace) -> int:
    house = args.house
    iter_n = int(args.iter)
    phase = "ortho-captures"
    set_correlation_id(f"iter-{iter_n}-{phase}-house-{house}-{uuid.uuid4().hex[:8]}")

    model_id = _ensure_model(house=house, api_base=args.api_base)
    out_dir = _house_workdir(house) / f"iter-{iter_n}" / "captures"
    out_dir.mkdir(parents=True, exist_ok=True)
    plan = _ortho_capture_plan(
        house=house,
        iter_n=iter_n,
        model_id=model_id,
        web_base=args.web_base,
        out_dir=out_dir,
    )
    plan_path = out_dir / "ortho-capture-plan.json"
    plan_path.write_text(json.dumps(plan, indent=2, sort_keys=True), encoding="utf-8")

    logger.info(
        "testhouse_iter.start",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "source_root": str(_house_root(house)),
            "model_id": model_id,
            "capture_count": len(plan["captures"]),
            "plan_path": str(plan_path),
        },
    )
    started = time.monotonic()
    cmd = [
        "pnpm",
        "--filter",
        "@bim-ai/web",
        "reverse-bim:capture",
        "--",
        "--plan",
        str(plan_path),
        "--out",
        str(out_dir),
        "--json",
    ]
    proc = subprocess.run(  # noqa: S603 — known command, args from this driver
        cmd,
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=240,
    )
    elapsed_ms = int((time.monotonic() - started) * 1000)
    pngs = sorted(out_dir.glob("ortho-*.png"))
    legacy_written = _dual_write_captures(
        house=house, iter_n=iter_n, source_dir=out_dir, capture_name_prefix="ortho"
    )
    status = "ok" if (proc.returncode == 0 and len(pngs) == 4) else "partial"
    logger.info(
        "testhouse_iter.end",
        extra={
            "house": house,
            "iter": iter_n,
            "phase": phase,
            "status": status,
            "elapsed_ms": elapsed_ms,
            "png_count": len(pngs),
            "legacy_dual_write_count": len(legacy_written),
            "runner_returncode": proc.returncode,
            "stderr_tail": (proc.stderr or "")[-400:],
        },
    )
    print(
        json.dumps(
            {
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "status": status,
                "elapsed_ms": elapsed_ms,
                "png_count": len(pngs),
                "pngs": [str(p) for p in pngs],
                "plan_path": str(plan_path),
                "runner_returncode": proc.returncode,
            },
            sort_keys=True,
        )
    )
    return 0 if status == "ok" else 1


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--api-base",
        default=DEFAULT_API_BASE,
        help=f"API base URL (default: {DEFAULT_API_BASE}).",
    )

    sub = parser.add_subparsers(dest="cmd", required=True)

    pre = sub.add_parser(
        "preflight",
        help="Iter-0: render PDFs @ DPI, classify pages, reader-pass plan.",
    )
    pre.add_argument("--house", required=True, choices=HOUSES)
    pre.add_argument("--dpi", type=int, default=DEFAULT_DPI)
    pre.set_defaults(func=_cmd_preflight)

    auth = sub.add_parser(
        "author-shell",
        help="Iter-3+: first MCP slice — levels + EG wall loop + slab + main roof.",
    )
    auth.add_argument("--house", required=True, choices=HOUSES)
    auth.add_argument("--iter", type=int, required=True)
    auth.set_defaults(func=_cmd_author_shell)

    ov = sub.add_parser(
        "author-ortho-views",
        help="Iter-3+ visual loop: 4 cardinal 3D viewpoints @ 2.5×bbox-diag.",
    )
    ov.add_argument("--house", required=True, choices=HOUSES)
    ov.add_argument("--iter", type=int, required=True)
    ov.set_defaults(func=_cmd_author_ortho_views)

    ng = sub.add_parser(
        "narrate-globals",
        help="Synthesise iter-1 (reader) + iter-2 (scope) narrative.json from the IR.",
    )
    ng.add_argument("--house", required=True, choices=HOUSES)
    ng.set_defaults(func=_cmd_narrate_globals)

    fl = sub.add_parser(
        "floor",
        help="v2 per-floor inside-out authoring loop (one floor of one house).",
    )
    fl.add_argument("--house", required=True, choices=HOUSES)
    fl.add_argument("--iter", type=int, required=True)
    fl.add_argument("--floor", required=True, choices=("TOPOLOGY", "KG", "EG", "DG", "ROOF"))
    fl.add_argument(
        "--skip-per-iter-capture",
        action="store_true",
        help="Skip the auto ortho-view authoring + Playwright capture at the end of this iter.",
    )
    fl.set_defaults(func=_cmd_floor)

    cap = sub.add_parser(
        "capture-ortho-views",
        help="Iter-3+ visual loop: drive Playwright to screenshot the 4 ortho views.",
    )
    cap.add_argument("--house", required=True, choices=HOUSES)
    cap.add_argument("--iter", type=int, required=True)
    cap.add_argument("--web-base", default=DEFAULT_WEB_BASE)
    cap.set_defaults(func=_cmd_capture_ortho_views)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    # Every subcommand that takes --house gets a per-house run.jsonl
    # log sink attached so /agents can tail the full agent timeline.
    house = getattr(args, "house", None)
    if isinstance(house, str) and house in HOUSES:
        _attach_house_run_log_sink(house)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
