"""CLI-01: bim-ai export json — emits snapshot JSON to stdout / --out file.

Spins up a tiny mock HTTP server returning a canned snapshot, runs the CLI
against it, and asserts the output is valid JSON with the documented shape.
"""

from __future__ import annotations

import json
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

_FAKE_SNAPSHOT: dict[str, object] = {
    "modelId": "00000000-0000-0000-0000-0000000000aa",
    "revision": 7,
    "elements": {
        "lvl-g": {"kind": "level", "id": "lvl-g", "name": "G", "elevationMm": 0},
        "w-a": {
            "kind": "wall",
            "id": "w-a",
            "name": "W",
            "levelId": "lvl-g",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 4000, "yMm": 0},
            "thicknessMm": 200,
            "heightMm": 2800,
        },
    },
    "violations": [],
}


class _SnapshotHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        # Silence default stderr logging during tests.
        return

    def do_GET(self) -> None:  # noqa: N802 — http.server contract
        if "/snapshot" in self.path:
            body = json.dumps(_FAKE_SNAPSHOT).encode("utf-8")
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.end_headers()


@pytest.fixture
def mock_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _SnapshotHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()


def _run_cli(args: list[str], base_url: str, extra_env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    import os

    env = os.environ.copy()
    env["BIM_AI_BASE_URL"] = base_url
    env["BIM_AI_MODEL_ID"] = "00000000-0000-0000-0000-0000000000aa"
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        ["node", str(REPO_ROOT / "packages/cli/cli.mjs"), *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        env=env,
        check=False,
    )


def test_export_json_stdout(mock_server: str) -> None:
    proc = _run_cli(["export", "json"], mock_server)
    if proc.returncode != 0:
        pytest.fail(f"CLI failed: rc={proc.returncode}\nstdout={proc.stdout}\nstderr={proc.stderr}")
    payload = json.loads(proc.stdout)
    assert payload["_format"] == "bimAiSnapshot_v1"
    assert payload["_revision"] == 7
    assert payload["revision"] == 7
    assert "lvl-g" in payload["elements"]
    assert payload["elements"]["w-a"]["thicknessMm"] == 200
    assert payload["violations"] == []


def test_export_json_to_file(mock_server: str, tmp_path: Path) -> None:
    out = tmp_path / "snap.json"
    proc = _run_cli(["export", "json", "--out", str(out)], mock_server)
    if proc.returncode != 0:
        pytest.fail(f"CLI failed: rc={proc.returncode}\nstdout={proc.stdout}\nstderr={proc.stderr}")
    assert out.exists(), "expected --out file to be written"
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["_format"] == "bimAiSnapshot_v1"
    assert payload["revision"] == 7
    summary = json.loads(proc.stdout)
    assert summary["ok"] is True
    assert summary["elementCount"] == 2
    assert summary["revision"] == 7
