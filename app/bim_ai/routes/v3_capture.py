"""View-capture route — Phase A.1 + E.2 of mcp-native-bim-agent-tracker.

Exposes ``POST /api/v3/models/{model_id}/capture-views`` which runs the
existing Playwright capture machinery (`packages/web/scripts/view-capture-run.mjs`)
in-process and returns inline base64-encoded PNGs.

Why inline bytes (Option β in tracker E.2): the MCP transport surface stays
narrow — no filesystem coupling between bim-ai and bim-agent. The caller
writes the PNGs wherever it wants. The runner writes to a tempdir which is
cleaned up before the response is built.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import shutil
import subprocess  # noqa: S404 — controlled invocation of bundled Node script
import tempfile
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

v3_capture_router = APIRouter()

_DEFAULT_VIEWS: tuple[str, ...] = (
    "north-shaded",
    "north-wireframe",
    "south-shaded",
    "south-wireframe",
    "east-shaded",
    "east-wireframe",
    "west-shaded",
    "west-wireframe",
)
_SUPPORTED_DIRECTIONS = frozenset({"north", "south", "east", "west"})
_SUPPORTED_STYLES = frozenset({"shaded", "wireframe"})
_DEFAULT_WIDTH = 1024
_DEFAULT_HEIGHT = 768
_DEFAULT_TIMEOUT_S = 300  # 5 minutes — matches tracker constraint.

# Repo root: app/bim_ai/routes/v3_capture.py → up 4 levels.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CAPTURE_SCRIPT = _REPO_ROOT / "packages" / "web" / "scripts" / "view-capture-run.mjs"
_WEB_PACKAGE_DIR = _REPO_ROOT / "packages" / "web"


def _normalise_view(token: str) -> str:
    if not isinstance(token, str):
        raise HTTPException(
            status_code=422, detail=f"View tokens must be strings; got {type(token).__name__}."
        )
    cleaned = token.strip().lower()
    if "-" not in cleaned:
        raise HTTPException(
            status_code=422, detail=f"Bad view token '{token}': expected '<direction>-<style>'."
        )
    direction, _, style = cleaned.partition("-")
    if direction not in _SUPPORTED_DIRECTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported direction '{direction}'. Allowed: {sorted(_SUPPORTED_DIRECTIONS)}.",
        )
    if style not in _SUPPORTED_STYLES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported style '{style}'. Allowed: {sorted(_SUPPORTED_STYLES)}.",
        )
    return f"{direction}-{style}"


@v3_capture_router.post("/v3/models/{model_id}/capture-views")
async def capture_views(model_id: UUID, body: dict | None = None) -> dict[str, Any]:
    """Render the model in the live viewer and return inline base64 PNG captures.

    Body (all optional):
      - ``views`` — list of ``"<direction>-<style>"`` tokens (e.g. ``"north-shaded"``).
        Defaults to all 8 cardinal × {shaded, wireframe} combinations.
      - ``width``  / ``height`` — viewport pixels (default 1024×768).
      - ``webBaseUrl`` — override of the web origin Playwright opens. Defaults to
        ``$BIM_AI_WEB_BASE_URL`` or ``http://127.0.0.1:2000``.
      - ``timeoutMs`` — per-page timeout passed to Playwright (default 60000).

    Returns:
      ``{captures: [{view, encoding: "base64-png", data}], modelId, width, height, ok}``.
    """
    body = body or {}
    raw_views = body.get("views")
    if raw_views is None:
        views = list(_DEFAULT_VIEWS)
    else:
        if not isinstance(raw_views, list) or not raw_views:
            raise HTTPException(
                status_code=422, detail="`views` must be a non-empty list of strings."
            )
        views = [_normalise_view(v) for v in raw_views]

    width = int(body.get("width", _DEFAULT_WIDTH))
    height = int(body.get("height", _DEFAULT_HEIGHT))
    if width <= 0 or height <= 0 or width > 8192 or height > 8192:
        raise HTTPException(status_code=422, detail="width/height must be 1..8192.")

    web_base_url = (
        body.get("webBaseUrl") or os.environ.get("BIM_AI_WEB_BASE_URL") or "http://127.0.0.1:2000"
    )
    timeout_ms = int(body.get("timeoutMs", 60_000))
    if timeout_ms <= 0 or timeout_ms > _DEFAULT_TIMEOUT_S * 1000:
        raise HTTPException(
            status_code=422,
            detail=f"timeoutMs must be 1..{_DEFAULT_TIMEOUT_S * 1000}.",
        )

    if not _CAPTURE_SCRIPT.is_file():
        raise HTTPException(
            status_code=500,
            detail=f"Capture script missing at {_CAPTURE_SCRIPT}. Was the web package built?",
        )

    tmp_dir = Path(tempfile.mkdtemp(prefix="view-capture-"))
    try:
        cmd = [
            "node",
            str(_CAPTURE_SCRIPT),
            "--model-id",
            str(model_id),
            "--views",
            ",".join(views),
            "--out-dir",
            str(tmp_dir),
            "--web-url",
            web_base_url,
            "--width",
            str(width),
            "--height",
            str(height),
            "--timeout-ms",
            str(timeout_ms),
        ]
        logger.info("view-capture-run: spawning Node script for model=%s views=%s", model_id, views)
        try:
            proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *cmd,
                    cwd=str(_WEB_PACKAGE_DIR),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                ),
                timeout=10.0,
            )
        except TimeoutError as exc:  # pragma: no cover — process spawn rarely hangs
            raise HTTPException(status_code=504, detail="Failed to spawn capture process.") from exc

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=_DEFAULT_TIMEOUT_S,
            )
        except TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise HTTPException(
                status_code=504,
                detail=f"Capture timed out after {_DEFAULT_TIMEOUT_S}s.",
            ) from exc

        stdout_text = stdout_bytes.decode("utf-8", errors="replace").strip()
        stderr_text = stderr_bytes.decode("utf-8", errors="replace").strip()

        if proc.returncode != 0:
            logger.warning(
                "view-capture-run: node exited %s stderr=%s", proc.returncode, stderr_text[:2000]
            )
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Capture script failed.",
                    "returnCode": proc.returncode,
                    "stderr": stderr_text[:4000],
                    "stdout": stdout_text[-2000:],
                },
            )

        # Parse summary line (last JSON line in stdout).
        summary: dict[str, Any] = {}
        for line in reversed(stdout_text.splitlines()):
            stripped = line.strip()
            if stripped.startswith("{"):
                try:
                    summary = json.loads(stripped)
                    break
                except json.JSONDecodeError:
                    continue

        captures_out: list[dict[str, Any]] = []
        for view in views:
            png_path = tmp_dir / f"{view}.png"
            if not png_path.is_file():
                raise HTTPException(
                    status_code=502,
                    detail=f"Capture script did not produce PNG for view '{view}' (path={png_path}).",
                )
            data = png_path.read_bytes()
            captures_out.append(
                {
                    "view": view,
                    "encoding": "base64-png",
                    "data": base64.b64encode(data).decode("ascii"),
                    "bytes": len(data),
                }
            )

        return {
            "ok": True,
            "modelId": str(model_id),
            "width": width,
            "height": height,
            "captureCount": len(captures_out),
            "captures": captures_out,
            "bboxMm": summary.get("bbox"),
            "scriptErrors": summary.get("errors") or [],
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
