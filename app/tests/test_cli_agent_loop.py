"""AGT-01 — `bim-ai agent-loop` CLI subcommand.

Spins up a tiny mock HTTP server, runs the CLI in test-backend mode
against a goal markdown that drives convergence in a couple of
iterations, and asserts:
  * Per-iteration evidence dirs are created with snapshot/validate/
    evidence/patch/dry-run/apply/status JSON.
  * Convergence stops the loop early.
  * On regression the loop calls /undo and exits.
"""

from __future__ import annotations

import json
import subprocess
import threading
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

GOAL_MARKDOWN_CONVERGE = """\
# Seed two levels

```json
{
  "commands": [
    { "type": "createLevel", "id": "lvl-g", "name": "G", "elevationMm": 0 }
  ],
  "rationale": "seed level",
  "confidence": 0.95
}
```
"""

GOAL_MARKDOWN_NOOP = """\
# Empty patch — should bail with no-patch
"""

# Marker keyword the CLI heuristic uses for goal/snapshot overlap.
PROGRESS_KEYWORD = "lvl-g"


class _CliState:
    """Mutable state shared across mock-server calls within a single test."""

    def __init__(
        self,
        snapshot_sequence: list[dict[str, object]],
        patch_response: dict[str, object],
        validate_sequence: list[dict[str, object]] | None = None,
        bundle_responses: list[dict[str, object]] | None = None,
    ) -> None:
        self.snapshots = deque(snapshot_sequence)
        self.patch_response = patch_response
        self.validates = deque(validate_sequence or [{"violations": []}])
        self.bundle_responses = deque(bundle_responses or [{"ok": True}])
        self.snapshot_calls = 0
        self.validate_calls = 0
        self.iterate_calls = 0
        self.dry_run_calls = 0
        self.bundle_calls = 0
        self.undo_calls = 0

    def next_snapshot(self) -> dict[str, object]:
        self.snapshot_calls += 1
        if len(self.snapshots) == 1:
            return self.snapshots[0]
        return self.snapshots.popleft()

    def next_validate(self) -> dict[str, object]:
        self.validate_calls += 1
        if len(self.validates) == 1:
            return self.validates[0]
        return self.validates.popleft()

    def next_bundle(self) -> dict[str, object]:
        self.bundle_calls += 1
        if len(self.bundle_responses) == 1:
            return self.bundle_responses[0]
        return self.bundle_responses.popleft()


def _build_handler(state: _CliState) -> type[BaseHTTPRequestHandler]:
    class _Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: object) -> None:  # noqa: A002
            return

        def _send_json(self, status: int, body: object) -> None:
            data = json.dumps(body).encode("utf-8")
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:  # noqa: N802
            if self.path.endswith("/snapshot"):
                self._send_json(200, state.next_snapshot())
                return
            if self.path.endswith("/validate"):
                self._send_json(200, state.next_validate())
                return
            self._send_json(404, {"error": "not found"})

        def do_POST(self) -> None:  # noqa: N802
            length = int(self.headers.get("content-length") or "0")
            _ = self.rfile.read(length)
            if self.path.endswith("/agent-iterate"):
                state.iterate_calls += 1
                self._send_json(200, state.patch_response)
                return
            if self.path.endswith("/commands/bundle/dry-run"):
                state.dry_run_calls += 1
                self._send_json(200, {"ok": True, "dryRun": True})
                return
            if self.path.endswith("/commands/bundle"):
                self._send_json(200, state.next_bundle())
                return
            if self.path.endswith("/undo"):
                state.undo_calls += 1
                self._send_json(200, {"ok": True, "action": "undo"})
                return
            self._send_json(404, {"error": "not found"})

    return _Handler


@pytest.fixture
def cli_server(request: pytest.FixtureRequest):
    state: _CliState = request.param
    server = ThreadingHTTPServer(("127.0.0.1", 0), _build_handler(state))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield (state, f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown()
        server.server_close()


def _run_cli(
    args: list[str], base_url: str
) -> subprocess.CompletedProcess[str]:
    import os

    env = os.environ.copy()
    env["BIM_AI_BASE_URL"] = base_url
    env["BIM_AI_MODEL_ID"] = "00000000-0000-0000-0000-0000000000aa"
    env["BIM_AI_AGENT_BACKEND"] = "test"
    return subprocess.run(
        ["node", str(REPO_ROOT / "packages/cli/cli.mjs"), *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
        env=env,
        check=False,
    )


def _empty_snap() -> dict[str, object]:
    return {"modelId": "x", "revision": 1, "elements": {}, "violations": []}


def _snap_with_keyword() -> dict[str, object]:
    return {
        "modelId": "x",
        "revision": 2,
        "elements": {
            "lvl-g": {
                "kind": "level",
                "id": "lvl-g",
                "name": "G",
                "elevationMm": 0,
            }
        },
        "violations": [],
    }


@pytest.mark.parametrize(
    "cli_server",
    [
        _CliState(
            snapshot_sequence=[_empty_snap(), _snap_with_keyword()],
            patch_response={
                "patch": [
                    {
                        "type": "createLevel",
                        "id": "lvl-g",
                        "name": "G",
                        "elevationMm": 0,
                    }
                ],
                "rationale": "seed",
                "confidence": 0.9,
                "backend": "test",
            },
        )
    ],
    indirect=True,
)
def test_agent_loop_writes_per_iter_evidence_and_progresses(
    cli_server: tuple[_CliState, str], tmp_path: Path
) -> None:
    state, base = cli_server
    out_dir = tmp_path / "loop"
    proc = _run_cli(
        [
            "agent-loop",
            "--goal",
            str(_write_goal(tmp_path, GOAL_MARKDOWN_CONVERGE)),
            "--max-iter",
            "3",
            "--evidence-out",
            str(out_dir),
        ],
        base,
    )
    if proc.returncode != 0:
        pytest.fail(f"CLI rc={proc.returncode}\nstdout={proc.stdout}\nstderr={proc.stderr}")
    iter_dir = out_dir / "iter-01"
    assert iter_dir.exists(), f"missing iter-01 dir under {out_dir}"
    for name in (
        "snapshot.json",
        "validate.json",
        "evidence.json",
        "patch.json",
        "dry-run.json",
        "apply.json",
        "snapshot.after.json",
        "validate.after.json",
        "status.json",
    ):
        assert (iter_dir / name).exists(), f"missing {name} under iter-01"

    status = json.loads((iter_dir / "status.json").read_text(encoding="utf-8"))
    assert status["status"] == "progress"
    assert status["iteration"] == 1
    assert status["patchSize"] == 1
    assert state.iterate_calls >= 1
    assert state.dry_run_calls >= 1
    assert state.bundle_calls >= 1
    assert state.undo_calls == 0


@pytest.mark.parametrize(
    "cli_server",
    [
        _CliState(
            snapshot_sequence=[_snap_with_keyword(), _empty_snap()],
            patch_response={
                "patch": [
                    {
                        "type": "noop",
                    }
                ],
                "rationale": "regress",
                "confidence": 0.4,
                "backend": "test",
            },
        )
    ],
    indirect=True,
)
def test_agent_loop_rolls_back_on_regression(
    cli_server: tuple[_CliState, str], tmp_path: Path
) -> None:
    state, base = cli_server
    out_dir = tmp_path / "loop"
    proc = _run_cli(
        [
            "agent-loop",
            "--goal",
            str(_write_goal(tmp_path, GOAL_MARKDOWN_CONVERGE)),
            "--max-iter",
            "2",
            "--evidence-out",
            str(out_dir),
        ],
        base,
    )
    assert proc.returncode == 0, proc.stderr
    status = json.loads((out_dir / "iter-01" / "status.json").read_text(encoding="utf-8"))
    assert status["status"] == "regression-rolled-back"
    assert state.undo_calls == 1


@pytest.mark.parametrize(
    "cli_server",
    [
        _CliState(
            snapshot_sequence=[_empty_snap()],
            patch_response={
                "patch": [],
                "rationale": "no-op",
                "confidence": 0.0,
                "backend": "test",
            },
        )
    ],
    indirect=True,
)
def test_agent_loop_bails_when_backend_returns_empty_patch(
    cli_server: tuple[_CliState, str], tmp_path: Path
) -> None:
    state, base = cli_server
    out_dir = tmp_path / "loop"
    proc = _run_cli(
        [
            "agent-loop",
            "--goal",
            str(_write_goal(tmp_path, GOAL_MARKDOWN_NOOP)),
            "--max-iter",
            "3",
            "--evidence-out",
            str(out_dir),
        ],
        base,
    )
    assert proc.returncode == 0, proc.stderr
    status = json.loads((out_dir / "iter-01" / "status.json").read_text(encoding="utf-8"))
    assert status["status"] == "no-patch"
    # No bundle, no undo when the backend returned nothing.
    assert state.bundle_calls == 0
    assert state.undo_calls == 0


def _write_goal(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "goal.md"
    p.write_text(body, encoding="utf-8")
    return p
