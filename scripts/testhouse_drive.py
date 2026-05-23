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


def _cmd_author_shell(args: argparse.Namespace) -> int:
    house = args.house
    iter_n = int(args.iter)
    phase = "exterior-shell"
    set_correlation_id(f"iter-{iter_n}-house-{house}-{uuid.uuid4().hex[:8]}")

    ir_path = _ir_path(house)
    if not ir_path.is_file():
        raise FileNotFoundError(f"missing iter-1 IR: {ir_path}. Run iter-1 (reader pass) first.")
    ir = json.loads(ir_path.read_text(encoding="utf-8"))

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
        model_id = _ensure_model(house=house, api_base=args.api_base)
        parent_rev = _current_revision(api_base=args.api_base, model_id=model_id)
        bundle = _shell_bundle_from_ir(ir=ir, parent_revision=parent_rev, iter_n=iter_n)

        payload = {
            "phase": {"phaseId": phase},
            "bundle": bundle,
            "commit": True,
            "iterationLabel": f"iter-{iter_n}",
            "houseName": house,
            "outputDir": str(_house_workdir(house) / f"iter-{iter_n}"),
            "submitter": "testhouse_drive.author-shell",
            "userId": "local-dev",
            "advisorProfile": "authoring_default",
            # The tracker pins this exact context schema; the route
            # propagates it into bim_model_commits.context.
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
                "parent_revision": parent_rev,
                "command_count": len(bundle["commands"]),
            },
        )
        result = _post(
            api_base=args.api_base,
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
    snapshot = httpx.get(
        f"{args.api_base.rstrip('/')}/models/{model_id}/snapshot", timeout=30.0
    ).json()
    rev_after = int(snapshot.get("revision") or parent_rev)
    # time-travel router is mounted at /api (not /api/v3) — see main.py.
    commits = httpx.get(
        f"{args.api_base.rstrip('/')}/models/{model_id}/commits",
        params={"limit": 1, "testhouse_house": house, "testhouse_iter": iter_n},
        timeout=30.0,
    ).json()
    commit_id = None
    items = commits.get("items") or commits.get("commits") or []
    if items:
        commit_id = items[0].get("commitId") or items[0].get("commit_id")

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
    print(
        json.dumps(
            {
                "house": house,
                "iter": iter_n,
                "phase": phase,
                "ok": bool(result.get("ok")),
                "model_id": model_id,
                "commit_id": commit_id,
                "revision_after": rev_after,
                "elapsed_ms": elapsed_ms,
                "executionState": result.get("executionState"),
            },
            sort_keys=True,
        )
    )
    return 0 if result.get("ok") else 1


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

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
