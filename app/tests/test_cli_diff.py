"""CLI-02: bim-ai diff --from <rev> --to <rev>.

Mock the diff API endpoint and verify the CLI emits JSON / text / summary
forms correctly, with --out file support.
"""

from __future__ import annotations

import json
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

_FAKE_DIFF: dict[str, object] = {
    "modelId": "00000000-0000-0000-0000-0000000000aa",
    "fromRevision": 3,
    "toRevision": 5,
    "added": [{"kind": "door", "id": "d-1", "name": "Front door"}],
    "removed": [{"kind": "wall", "id": "w-removed", "name": "Old wall"}],
    "modified": [
        {
            "id": "w-a",
            "kind": "wall",
            "fieldChanges": [
                {"field": "thicknessMm", "from": 200, "to": 250},
            ],
        }
    ],
    "summary": {
        "addedCount": 1,
        "removedCount": 1,
        "modifiedCount": 1,
        "byKind": {
            "door": {"added": 1, "removed": 0, "modified": 0},
            "wall": {"added": 0, "removed": 1, "modified": 1},
        },
    },
}


class _DiffHandler(BaseHTTPRequestHandler):
    last_query: dict[str, list[str]] = {}

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        return

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        type(self).last_query = parse_qs(parsed.query)
        if parsed.path.endswith("/diff"):
            body = json.dumps(_FAKE_DIFF).encode("utf-8")
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
    server = ThreadingHTTPServer(("127.0.0.1", 0), _DiffHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()


def _run_cli(args: list[str], base_url: str) -> subprocess.CompletedProcess[str]:
    import os

    env = os.environ.copy()
    env["BIM_AI_BASE_URL"] = base_url
    env["BIM_AI_MODEL_ID"] = "00000000-0000-0000-0000-0000000000aa"
    return subprocess.run(
        ["node", str(REPO_ROOT / "packages/cli/cli.mjs"), *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        env=env,
        check=False,
    )


def test_diff_default_json_stdout(mock_server: str) -> None:
    proc = _run_cli(["diff", "--from", "3", "--to", "5"], mock_server)
    if proc.returncode != 0:
        pytest.fail(f"CLI failed: rc={proc.returncode}\nstdout={proc.stdout}\nstderr={proc.stderr}")
    payload = json.loads(proc.stdout)
    assert payload["fromRevision"] == 3
    assert payload["toRevision"] == 5
    assert payload["summary"]["addedCount"] == 1
    assert payload["modified"][0]["fieldChanges"][0]["field"] == "thicknessMm"
    # Verify CLI passed the query params through.
    assert _DiffHandler.last_query.get("fromRev") == ["3"]
    assert _DiffHandler.last_query.get("toRev") == ["5"]


def test_diff_summary_only(mock_server: str) -> None:
    proc = _run_cli(["diff", "--from", "3", "--to", "5", "--summary-only"], mock_server)
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert "summary" in payload
    assert "added" not in payload  # full element lists hidden
    assert payload["summary"]["addedCount"] == 1


def test_diff_text_form(mock_server: str) -> None:
    proc = _run_cli(["diff", "--from", "3", "--to", "5", "--text"], mock_server)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    assert "rev 3 -> 5" in out
    assert "added=1" in out and "removed=1" in out and "modified=1" in out
    assert "+ door d-1" in out
    assert "- wall w-removed" in out
    assert "* wall w-a" in out
    assert "thicknessMm: 200 -> 250" in out


def test_diff_to_file(mock_server: str, tmp_path: Path) -> None:
    out = tmp_path / "diff.json"
    proc = _run_cli(["diff", "--from", "3", "--to", "5", "--out", str(out)], mock_server)
    assert proc.returncode == 0, proc.stderr
    assert out.exists()
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["summary"]["modifiedCount"] == 1
    receipt = json.loads(proc.stdout)
    assert receipt["ok"] is True
    assert receipt["out"] == str(out)


def test_diff_no_revisions_lets_server_default(mock_server: str) -> None:
    """Without --from/--to, CLI sends no rev query params; server applies defaults."""
    proc = _run_cli(["diff"], mock_server)
    assert proc.returncode == 0, proc.stderr
    assert "fromRev" not in _DiffHandler.last_query
    assert "toRev" not in _DiffHandler.last_query
