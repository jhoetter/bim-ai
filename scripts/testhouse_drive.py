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
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import httpx  # noqa: E402

from bim_ai._io.log import get_logger, set_correlation_id  # noqa: E402

HOUSES = ("alpha", "beta", "gamma")
DEFAULT_API_BASE = "http://127.0.0.1:28500/api"
DEFAULT_DPI = 240

logger = get_logger("bim_ai.testhouse_iter")


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
    return _post(
        api_base=api_base,
        path="/v3/source/prepare-ai-visual-trace-run",
        body=payload,
    )


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
PROJECT_ID_FOR_TESTHOUSES = "892ee9f7-307c-5e40-a838-3bc64b5f5f92"  # seed project


def _ir_path(house: str) -> Path:
    return _house_workdir(house) / "understanding" / "existing-building-ir.json"


def _ensure_model(*, house: str, api_base: str) -> str:
    """Return a bim_models.id for ``house-<house>``; create if absent."""

    boot = httpx.get(f"{api_base.rstrip('/')}/bootstrap", timeout=30.0).json()
    for proj in boot.get("projects") or []:
        for m in proj.get("models") or []:
            if m.get("slug") == f"house-{house}":
                return str(m["id"])
    body = {"slug": f"house-{house}"}
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
    eg_height = next((lvl["heightMM"] for lvl in ir["levels"] if lvl["id"] == "level-EG"), 2700)

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
                "elevationMm": float(lvl["elevationMM"]),
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
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
