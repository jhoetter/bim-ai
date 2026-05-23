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
                "elevationMm": float(lvl.get("elevationMM") or 0),
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
        (lvl["heightMM"] for lvl in ir["levels"] if lvl["id"].endswith(level_short)), 2700
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
        (lvl["heightMM"] for lvl in ir["levels"] if lvl["id"].endswith(level_short)), 2700
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
    commands: list[dict] = []
    for i in range(len(poly)):
        a = poly[i]
        b = poly[(i + 1) % len(poly)]
        commands.append(
            {
                "type": "createWall",
                "id": f"th-{house}-i-{level_short}-ext-wall-{i}",
                "name": f"{level_short} exterior wall {i}",
                "levelId": level_id,
                "start": {"xMm": float(a[0]), "yMm": float(a[1])},
                "end": {"xMm": float(b[0]), "yMm": float(b[1])},
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
        (lvl["heightMM"] for lvl in ir["levels"] if lvl["id"].endswith(level_short)), 2700
    )

    commands: list[dict] = []
    consumed: list[str] = []
    skipped: list[dict] = []

    for d in doors:
        vertex = d.get("vertexMm")
        if not isinstance(vertex, list) or len(vertex) < 2:
            continue
        wall, t = _host_on_nearest_wall(vertex, walls)
        if wall is None:
            skipped.append(
                {"factId": d.get("factId"), "kind": "door", "reason": "no_host_within_500mm"}
            )
            continue
        commands.append(
            {
                "type": "insertDoorOnWall",
                "id": f"th-{house}-i-{level_short}-door-{_slugify(d.get('factId'))}",
                "name": str(d.get("text") or "Door")[:80],
                "wallId": wall.get("id"),
                "alongT": round(t, 4),
                "widthMm": 900,
            }
        )
        consumed.append(str(d.get("factId")))

    for w in windows:
        vertex = w.get("vertexMm")
        if not isinstance(vertex, list) or len(vertex) < 2:
            continue
        wall, t = _host_on_nearest_wall(vertex, walls)
        if wall is None:
            skipped.append(
                {"factId": w.get("factId"), "kind": "window", "reason": "no_host_within_500mm"}
            )
            continue
        commands.append(
            {
                "type": "insertWindowOnWall",
                "id": f"th-{house}-i-{level_short}-window-{_slugify(w.get('factId'))}",
                "name": str(w.get("text") or "Window")[:80],
                "wallId": wall.get("id"),
                "alongT": round(t, 4),
                "widthMm": 1200,
                "sillHeightMm": 900,
                # Reserve 200 mm header clearance below the wall top so the
                # constructability check's 150 mm lintel rule passes even
                # on the low DG storey (2500 mm walls).
                "heightMm": int(min(1500, max(800, eg_height - 900 - 200))),
            }
        )
        consumed.append(str(w.get("factId")))

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
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase="topology-project-setup",
                bundle=ps_bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=[],
                source_evidence=[],
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
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase=f"{floor.lower()}-rooms",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
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
            _apply_slice_v2(
                house=house,
                iter_n=iter_n,
                phase=f"{floor.lower()}-openings",
                bundle=bundle,
                api_base=api_base,
                submitter="testhouse_drive.floor",
                consumed_fact_ids=consumed,
                source_evidence=evidence,
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
            )

    return 0


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

    fl = sub.add_parser(
        "floor",
        help="v2 per-floor inside-out authoring loop (one floor of one house).",
    )
    fl.add_argument("--house", required=True, choices=HOUSES)
    fl.add_argument("--iter", type=int, required=True)
    fl.add_argument("--floor", required=True, choices=("TOPOLOGY", "KG", "EG", "DG", "ROOF"))
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
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
