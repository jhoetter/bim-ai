"""TEST-CQ-09 — capture-runner timing budget test.

bim-ai #124 (capture-runner timing) plus the broader class of capture
regressions (#132, #58, #61) all involved timing/sequencing in the
``view-capture-run`` boundary. There were no timing tests for the
capture runner; this module adds three:

1. ``test_capture_timeout_is_enforced`` — when the Node subprocess hangs,
   ``POST /api/v3/models/{model_id}/capture-views`` returns 504 within
   ``timeout + buffer`` ms instead of blocking the FastAPI worker.
2. ``test_timeout_releases_in_flight_resources`` — on timeout, the
   spawned process is killed and the tempdir is removed. Both are
   asserted via post-call accounting (filesystem state + proc spies).
3. ``test_capture_url_params_are_honoured`` — the CLI args the runner is
   given carry the view tokens that drive the azimuth/cardinal direction,
   and the runner script itself wires `captureMode=1` +
   `projection=orthographic` into the URL (verified by reading the
   shipped `.mjs` source, since URL construction is JS-side).

Total runtime budget for this module: ≤ 15s (simulated load). Individual
sleep-based hangs use sub-second timeouts shrunk via monkeypatch.
"""

from __future__ import annotations

import asyncio
import re
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.routes import v3_capture as v3_capture_module
from bim_ai.routes.v3_capture import v3_capture_router

# Module-runtime budget guard. The whole file should finish well under
# 15 simulated seconds. Each test individually trips at ~5s.
_PER_TEST_BUDGET_S = 5.0


# ---------------------------------------------------------------------------
# Fake subprocess plumbing
# ---------------------------------------------------------------------------


class _HangingProcess:
    """A fake `asyncio.subprocess.Process` whose `.communicate()` hangs.

    `_DEFAULT_TIMEOUT_S` is monkey-patched to a small value so
    `asyncio.wait_for` cancels the coroutine; that exercises the real
    timeout/kill/cleanup path in `capture_views`.
    """

    def __init__(self) -> None:
        self.returncode: int | None = None
        self.kill_called = False
        self.wait_called = False
        self.communicate_started = False

    async def communicate(self) -> tuple[bytes, bytes]:
        self.communicate_started = True
        # Sleep forever — wait_for will cancel us, which surfaces as
        # CancelledError → TimeoutError in `asyncio.wait_for`.
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            # Mimic real Process: cancellation propagates after cleanup.
            raise
        return b"", b""

    def kill(self) -> None:
        self.kill_called = True
        # After kill, the real Process exits non-zero.
        self.returncode = -9

    async def wait(self) -> int:
        self.wait_called = True
        return self.returncode or -9


class _SuccessfulProcess:
    """Fake `Process` that completes immediately with an ok JSON summary."""

    def __init__(self, summary_json: str, returncode: int = 0) -> None:
        self.returncode: int | None = returncode
        self._summary = summary_json
        self.kill_called = False

    async def communicate(self) -> tuple[bytes, bytes]:
        return self._summary.encode("utf-8"), b""

    def kill(self) -> None:  # pragma: no cover — not used in happy path
        self.kill_called = True

    async def wait(self) -> int:  # pragma: no cover
        return self.returncode or 0


# ---------------------------------------------------------------------------
# Test app fixture
# ---------------------------------------------------------------------------


@pytest.fixture()
def app() -> FastAPI:
    fastapi_app = FastAPI()
    fastapi_app.include_router(v3_capture_router, prefix="/api")
    return fastapi_app


@pytest.fixture()
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture()
def capture_script_present(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Stub the capture script existence check so we don't need a built web pkg.

    The route refuses to spawn anything if `_CAPTURE_SCRIPT.is_file()` is
    False. In CI the file is present, but tests should not rely on the
    web package being built. We point the constants at a real temp file.
    """
    fake_script = tmp_path / "view-capture-run.mjs"
    fake_script.write_text("// stub", encoding="utf-8")
    monkeypatch.setattr(v3_capture_module, "_CAPTURE_SCRIPT", fake_script)
    monkeypatch.setattr(v3_capture_module, "_WEB_PACKAGE_DIR", tmp_path)
    return fake_script


# ---------------------------------------------------------------------------
# Test 1 — timeout enforcement
# ---------------------------------------------------------------------------


def test_capture_timeout_is_enforced(
    client: TestClient,
    capture_script_present: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If the Node script hangs, the endpoint must return 504, not block."""
    # Shrink the wall-clock budget so the test stays sub-second.
    monkeypatch.setattr(v3_capture_module, "_DEFAULT_TIMEOUT_S", 1)

    hanging = _HangingProcess()

    async def _fake_exec(*_args: Any, **_kwargs: Any) -> _HangingProcess:
        return hanging

    monkeypatch.setattr(
        v3_capture_module.asyncio, "create_subprocess_exec", _fake_exec
    )

    started_at = time.monotonic()
    resp = client.post(
        f"/api/v3/models/{uuid4()}/capture-views",
        # `timeoutMs` upper bound is `_DEFAULT_TIMEOUT_S * 1000`; we
        # patched the default to 1 above, so cap is 1000ms. Keep the
        # per-page timeout under the wall-clock budget too.
        json={"views": ["north-shaded"], "timeoutMs": 500},
    )
    elapsed_s = time.monotonic() - started_at

    assert resp.status_code == 504, (
        f"Expected 504 on hang, got {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    # `detail` is a string here (not a dict) — matches the route's
    # current behavior. Just assert it names the timeout.
    assert "timed out" in str(body.get("detail", "")).lower(), body
    # Budget guard: < 3× the timeout (covers loop scheduling jitter).
    assert elapsed_s < _PER_TEST_BUDGET_S, (
        f"Endpoint hung past budget: {elapsed_s:.2f}s"
    )
    # Sanity: the fake process's communicate() actually got invoked
    # (otherwise we'd be testing the spawn-timeout branch).
    assert hanging.communicate_started


# ---------------------------------------------------------------------------
# Test 2 — resource accounting after timeout
# ---------------------------------------------------------------------------


def test_timeout_releases_in_flight_resources(
    client: TestClient,
    capture_script_present: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """After a capture timeout, the subprocess is killed and tempdir
    is removed. This is the 'Three.js resources leak' acceptance — the
    Python boundary owns process + tempdir lifetime; if either leaks
    the browser-side handles can't be reaped either.
    """
    monkeypatch.setattr(v3_capture_module, "_DEFAULT_TIMEOUT_S", 1)

    hanging = _HangingProcess()

    # Track which tempdir the route created so we can post-mortem it.
    created_tempdirs: list[str] = []
    original_mkdtemp = v3_capture_module.tempfile.mkdtemp

    def _spy_mkdtemp(*args: Any, **kwargs: Any) -> str:
        path = original_mkdtemp(*args, **kwargs)
        created_tempdirs.append(path)
        return path

    monkeypatch.setattr(v3_capture_module.tempfile, "mkdtemp", _spy_mkdtemp)

    async def _fake_exec(*_args: Any, **_kwargs: Any) -> _HangingProcess:
        return hanging

    monkeypatch.setattr(
        v3_capture_module.asyncio, "create_subprocess_exec", _fake_exec
    )

    started_at = time.monotonic()
    resp = client.post(
        f"/api/v3/models/{uuid4()}/capture-views",
        # See note in test_capture_timeout_is_enforced: cap is
        # `_DEFAULT_TIMEOUT_S * 1000` and we patched to 1.
        json={"views": ["north-shaded", "south-shaded"], "timeoutMs": 500},
    )
    elapsed_s = time.monotonic() - started_at

    assert resp.status_code == 504, resp.text
    assert elapsed_s < _PER_TEST_BUDGET_S

    # 1. The hanging process was killed and waited on. If either is
    #    skipped the OS keeps a zombie around (and the underlying
    #    Playwright browser context never tears down → Three.js
    #    Scene/Renderer leak in the real path).
    assert hanging.kill_called, "Hung subprocess was not killed on timeout."
    assert hanging.wait_called, "Hung subprocess was not awaited after kill."

    # 2. The tempdir we observed being created no longer exists on disk.
    #    `capture_views` uses `try/finally: shutil.rmtree(...)`; if the
    #    timeout path skips finally, we leak PNG bytes per invocation.
    assert len(created_tempdirs) == 1, (
        f"Expected exactly one tempdir; saw {created_tempdirs!r}"
    )
    assert not Path(created_tempdirs[0]).exists(), (
        f"Tempdir leaked after timeout: {created_tempdirs[0]}"
    )


# ---------------------------------------------------------------------------
# Test 3 — capture URL params are honoured
# ---------------------------------------------------------------------------


def test_capture_url_params_are_honoured(
    client: TestClient,
    capture_script_present: Path,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """The route must hand the runner the view tokens / dimensions / web
    base url it was given, and the runner script must wire
    `captureMode=1` + `projection=orthographic` + cardinal azimuth into
    the Playwright URL. The Python side owns the argv contract; the JS
    side owns the URL contract. We assert both.
    """
    # NB: `timeoutMs` validation caps at `_DEFAULT_TIMEOUT_S * 1000`,
    # so do NOT shrink the default here — happy path completes
    # immediately via the stub subprocess.

    captured_argv: list[tuple[str, ...]] = []
    captured_kwargs: list[dict[str, Any]] = []

    # Simulate the Node script: write the expected PNGs into --out-dir
    # so the response builder doesn't 502 on missing files.
    async def _fake_exec(*args: str, **kwargs: Any) -> _SuccessfulProcess:
        captured_argv.append(tuple(args))
        captured_kwargs.append(kwargs)
        # Find the --out-dir and --views args to forge PNGs.
        out_dir = None
        views_csv = None
        items = list(args)
        for i, item in enumerate(items):
            if item == "--out-dir" and i + 1 < len(items):
                out_dir = items[i + 1]
            elif item == "--views" and i + 1 < len(items):
                views_csv = items[i + 1]
        assert out_dir is not None and views_csv is not None
        out_path = Path(out_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        # Minimal valid 1×1 PNG bytes (8-byte signature + IHDR + IDAT + IEND).
        png_bytes = (
            b"\x89PNG\r\n\x1a\n"
            b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
            b"\x00\x00\x00\rIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
            b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        for view in views_csv.split(","):
            (out_path / f"{view.strip()}.png").write_bytes(png_bytes)
        summary = (
            '{"ok": true, "modelId": "stub", "outDir": "/tmp", '
            '"bbox": {"xmin": 0, "xmax": 1, "ymin": 0, "ymax": 1, '
            '"zmin": 0, "zmax": 1, "count": 0}, "captures": [], "errors": []}'
        )
        return _SuccessfulProcess(summary)

    monkeypatch.setattr(
        v3_capture_module.asyncio, "create_subprocess_exec", _fake_exec
    )

    model_id = str(uuid4())
    started_at = time.monotonic()
    resp = client.post(
        f"/api/v3/models/{model_id}/capture-views",
        json={
            "views": [
                "north-shaded",
                "south-shaded",
                "east-shaded",
                "west-shaded",
            ],
            "width": 1280,
            "height": 720,
            "webBaseUrl": "http://127.0.0.1:9999",
            "timeoutMs": 30_000,
        },
    )
    elapsed_s = time.monotonic() - started_at

    assert resp.status_code == 200, resp.text
    assert elapsed_s < _PER_TEST_BUDGET_S
    body = resp.json()
    assert body["ok"] is True
    assert body["captureCount"] == 4

    # ---- Python→Node argv contract ----
    assert len(captured_argv) == 1, "Subprocess should be spawned exactly once."
    argv = captured_argv[0]
    assert argv[0] == "node"
    # Map flag → value for ergonomic assertions.
    flag_to_value: dict[str, str] = {}
    it = iter(argv[1:])
    last_positional: str | None = None
    for token in it:
        if token.startswith("--"):
            try:
                flag_to_value[token] = next(it)
            except StopIteration:  # pragma: no cover
                break
        else:
            last_positional = token
    # Script path is positional (first non-flag arg). Confirm the route
    # spawned the bundled .mjs entry point.
    assert any(a.endswith("view-capture-run.mjs") for a in argv), argv
    # azimuth-equivalent: view tokens carry cardinal direction, and the
    # script maps them via DIRECTION_VECTORS.  The route must forward
    # every requested cardinal direction verbatim.
    views_csv = flag_to_value["--views"]
    assert views_csv.split(",") == [
        "north-shaded",
        "south-shaded",
        "east-shaded",
        "west-shaded",
    ]
    assert flag_to_value["--model-id"] == model_id
    assert flag_to_value["--width"] == "1280"
    assert flag_to_value["--height"] == "720"
    assert flag_to_value["--web-url"] == "http://127.0.0.1:9999"
    assert flag_to_value["--timeout-ms"] == "30000"
    # cwd must point at packages/web so playwright's chromium binary
    # is discovered via the local node_modules (regression #58/#61).
    assert captured_kwargs[0].get("cwd") is not None
    # Silence unused-binding lint without changing the parse logic above.
    _ = last_positional

    # ---- JS-side URL contract ----
    # The URL construction lives in `view-capture-run.mjs`. We assert
    # the shipped source still wires the three capture URL parameters
    # the acceptance criteria call out. This pins the contract: if the
    # script is refactored to drop `captureMode=1` or
    # `projection=orthographic`, this test fails.
    script_src = (
        Path(v3_capture_module.__file__).resolve().parents[3]
        / "packages"
        / "web"
        / "scripts"
        / "view-capture-run.mjs"
    ).read_text(encoding="utf-8")
    assert "captureMode=1" in script_src, (
        "view-capture-run.mjs must set ?captureMode=1 on the workspace URL."
    )
    assert "projection=orthographic" in script_src, (
        "view-capture-run.mjs must set ?projection=orthographic on the URL."
    )
    # The runner exposes the cardinal direction → azimuth vector table.
    # If a refactor drops a direction, capture for that view is silently
    # wrong (issue #58 class), so we pin the table membership here too.
    for direction in ("north", "south", "east", "west"):
        # match e.g.  `north: [0.0, 1.0, 0.05]`
        pattern = rf"\b{direction}\s*:\s*\["
        assert re.search(pattern, script_src), (
            f"view-capture-run.mjs must define an azimuth vector for {direction!r}."
        )
