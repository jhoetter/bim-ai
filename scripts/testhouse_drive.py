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
    uv run python scripts/testhouse_drive.py preflight --house beta
    uv run python scripts/testhouse_drive.py preflight --house gamma

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

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
