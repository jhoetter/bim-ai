"""MF-driver-26 (#130): bim-agent observability shim for testhouse_drive.

When ``BIM_AGENT_URL`` is set in the environment AND an iter_id is
resolvable (env var ``BIM_AGENT_ITER_ID`` or ``--bim-agent-iter-id``),
the driver POSTs every ``testhouse_iter.*`` log record to bim-agent's
``/api/events`` endpoint, the reader IR snapshot to ``/api/irs`` after
``_load_and_validate_ir``, and the preflight classification to
``/api/source-docs``.

These tests pin the gating + payload contract:

1. With ``BIM_AGENT_URL`` unset → ``httpx.post`` is never called.
2. With ``BIM_AGENT_URL`` + iter_id set → each ``testhouse_iter.*`` log
   emits exactly one POST to ``/api/events`` with the documented payload
   keys.
3. ``httpx.post`` raising is swallowed — the handler never propagates.
4. Log records that are NOT ``testhouse_iter.*`` are ignored.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
from pathlib import Path
from typing import Any
from unittest import mock

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "testhouse_drive.py"


def _load_driver():
    spec = importlib.util.spec_from_file_location("testhouse_drive", SCRIPT_PATH)
    assert spec and spec.loader, "could not build importlib spec for testhouse_drive.py"
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("testhouse_drive", mod)
    spec.loader.exec_module(mod)
    return mod


_DRV = _load_driver()


@pytest.fixture(autouse=True)
def _isolate_logger_handlers():
    """Snapshot + restore handlers on the bim_ai.testhouse_iter logger.

    The driver's module-level ``logger`` is shared across tests; without
    snapshotting, a handler attached in one test would leak into the
    next and skew the POST count assertions.
    """

    log = logging.getLogger("bim_ai.testhouse_iter")
    original = list(log.handlers)
    # Strip every handler that the bim-agent shim might have left from a
    # previous test run in the same process.
    log.handlers = [
        h for h in log.handlers if not getattr(h, "_bim_ai_bim_agent_handler", False)
    ]
    try:
        yield log
    finally:
        log.handlers = original


# ---------------------------------------------------------------------------
# Gating: BIM_AGENT_URL unset → no POST
# ---------------------------------------------------------------------------


def test_handler_is_noop_when_bim_agent_url_unset(monkeypatch, _isolate_logger_handlers) -> None:
    monkeypatch.delenv("BIM_AGENT_URL", raising=False)
    monkeypatch.delenv("BIM_AGENT_ITER_ID", raising=False)

    with mock.patch.object(_DRV.httpx, "post") as mock_post:
        _DRV._attach_bim_agent_handler(iter_id=42)

        # Even with iter_id explicitly set, missing URL means no handler.
        assert not any(
            getattr(h, "_bim_ai_bim_agent_handler", False)
            for h in _isolate_logger_handlers.handlers
        )

        # Emitting a record still must not POST.
        _DRV.logger.info(
            "testhouse_iter.start",
            extra={"house": "alpha", "iter": 3, "phase": "exterior-shell"},
        )
        assert mock_post.call_count == 0


def test_handler_is_noop_when_iter_id_unset(monkeypatch, _isolate_logger_handlers) -> None:
    monkeypatch.setenv("BIM_AGENT_URL", "http://127.0.0.1:38500")
    monkeypatch.delenv("BIM_AGENT_ITER_ID", raising=False)

    with mock.patch.object(_DRV.httpx, "post") as mock_post:
        _DRV._attach_bim_agent_handler(iter_id=None)
        _DRV.logger.info(
            "testhouse_iter.start",
            extra={"house": "alpha", "iter": 3, "phase": "exterior-shell"},
        )
        assert mock_post.call_count == 0


def test_post_bim_agent_ir_is_noop_when_unset(monkeypatch) -> None:
    monkeypatch.delenv("BIM_AGENT_URL", raising=False)
    with mock.patch.object(_DRV.httpx, "post") as mock_post:
        _DRV._post_bim_agent_ir(iter_id=42, ir={"house": "alpha"})
        assert mock_post.call_count == 0


def test_post_bim_agent_source_docs_is_noop_when_unset(monkeypatch) -> None:
    monkeypatch.delenv("BIM_AGENT_URL", raising=False)
    with mock.patch.object(_DRV.httpx, "post") as mock_post:
        _DRV._post_bim_agent_source_docs(iter_id=42, docs=[{"id": "EG.pdf"}])
        assert mock_post.call_count == 0


# ---------------------------------------------------------------------------
# Happy path: env + iter_id set → POST per testhouse_iter.* record
# ---------------------------------------------------------------------------


def test_each_testhouse_iter_record_emits_one_post(monkeypatch, _isolate_logger_handlers) -> None:
    monkeypatch.setenv("BIM_AGENT_URL", "http://127.0.0.1:38500")

    with mock.patch.object(_DRV.httpx, "post") as mock_post:
        _DRV._attach_bim_agent_handler(iter_id=77)

        _DRV.logger.info(
            "testhouse_iter.start",
            extra={
                "house": "alpha",
                "iter": 3,
                "phase": "exterior-shell",
                "model_id": "m-1",
                "commit_id": "c-1",
            },
        )
        _DRV.logger.info(
            "testhouse_iter.end",
            extra={
                "house": "alpha",
                "iter": 3,
                "phase": "exterior-shell",
                "status": "ok",
                "elapsed_ms": 1234,
            },
        )

        assert mock_post.call_count == 2

        # First call: testhouse_iter.start
        first_call = mock_post.call_args_list[0]
        # First positional arg is the URL.
        assert first_call.args[0] == "http://127.0.0.1:38500/api/events"
        body: dict[str, Any] = first_call.kwargs["json"]
        assert body["iter_id"] == 77
        assert body["kind"] == "testhouse_iter.start"
        assert body["phase"] == "exterior-shell"
        assert body["bim_ai_model_id"] == "m-1"
        assert body["bim_ai_commit_id"] == "c-1"
        # payload_json carries every non-reserved extra.
        assert body["payload_json"]["house"] == "alpha"
        assert body["payload_json"]["iter"] == 3
        # Timeout is bounded so observability never blocks the build.
        assert first_call.kwargs["timeout"] == 3.0

        # Second call: testhouse_iter.end carries status + elapsed_ms.
        second_call = mock_post.call_args_list[1]
        body2: dict[str, Any] = second_call.kwargs["json"]
        assert body2["kind"] == "testhouse_iter.end"
        assert body2["status"] == "ok"
        assert body2["elapsed_ms"] == 1234


def test_event_extra_routes_when_msg_is_not_kind(monkeypatch, _isolate_logger_handlers) -> None:
    """Records that put the kind in ``extra={'event': 'testhouse_iter.*'}``
    (the second emit pattern the driver uses, e.g. ``ir_invalid``) are
    also recognised."""

    monkeypatch.setenv("BIM_AGENT_URL", "http://127.0.0.1:38500")

    with mock.patch.object(_DRV.httpx, "post") as mock_post:
        _DRV._attach_bim_agent_handler(iter_id=5)
        _DRV.logger.error(
            "ir_invalid",
            extra={"event": "testhouse_iter.ir_invalid", "ir_path": "/tmp/ir.json"},
        )
        assert mock_post.call_count == 1
        body = mock_post.call_args.kwargs["json"]
        assert body["kind"] == "testhouse_iter.ir_invalid"


# ---------------------------------------------------------------------------
# Robustness: POST failure is swallowed
# ---------------------------------------------------------------------------


def test_post_failure_is_swallowed(monkeypatch, _isolate_logger_handlers) -> None:
    monkeypatch.setenv("BIM_AGENT_URL", "http://127.0.0.1:38500")

    with mock.patch.object(_DRV.httpx, "post", side_effect=RuntimeError("boom")) as mock_post:
        _DRV._attach_bim_agent_handler(iter_id=1)
        # Must not raise.
        _DRV.logger.info(
            "testhouse_iter.start",
            extra={"house": "alpha", "iter": 3, "phase": "exterior-shell"},
        )
        assert mock_post.call_count == 1


def test_post_ir_failure_is_swallowed(monkeypatch) -> None:
    monkeypatch.setenv("BIM_AGENT_URL", "http://127.0.0.1:38500")
    with mock.patch.object(_DRV.httpx, "post", side_effect=RuntimeError("boom")):
        # Must not raise.
        _DRV._post_bim_agent_ir(iter_id=1, ir={"house": "alpha"})


def test_post_source_docs_failure_is_swallowed(monkeypatch) -> None:
    monkeypatch.setenv("BIM_AGENT_URL", "http://127.0.0.1:38500")
    with mock.patch.object(_DRV.httpx, "post", side_effect=RuntimeError("boom")):
        # Must not raise.
        _DRV._post_bim_agent_source_docs(iter_id=1, docs=[{"id": "EG.pdf"}])


# ---------------------------------------------------------------------------
# Filtering: non-testhouse_iter.* records are ignored
# ---------------------------------------------------------------------------


def test_non_testhouse_iter_records_are_ignored(monkeypatch, _isolate_logger_handlers) -> None:
    monkeypatch.setenv("BIM_AGENT_URL", "http://127.0.0.1:38500")

    with mock.patch.object(_DRV.httpx, "post") as mock_post:
        _DRV._attach_bim_agent_handler(iter_id=9)

        # No prefix → ignored.
        _DRV.logger.info("some.other.event", extra={"phase": "noise"})
        # Different prefix → ignored.
        _DRV.logger.info("agent_runs.hydrate", extra={"phase": "noise"})

        assert mock_post.call_count == 0

        # Sanity: a real testhouse_iter.* record still fires after the
        # filtered ones, proving the handler is wired and the filter
        # itself is what dropped the noise.
        _DRV.logger.info(
            "testhouse_iter.start",
            extra={"house": "alpha", "iter": 3, "phase": "exterior-shell"},
        )
        assert mock_post.call_count == 1


# ---------------------------------------------------------------------------
# Resolver precedence
# ---------------------------------------------------------------------------


def test_resolve_iter_id_prefers_explicit_arg(monkeypatch) -> None:
    monkeypatch.setenv("BIM_AGENT_ITER_ID", "99")
    assert _DRV._resolve_bim_agent_iter_id(7) == 7


def test_resolve_iter_id_falls_back_to_env(monkeypatch) -> None:
    monkeypatch.setenv("BIM_AGENT_ITER_ID", "99")
    assert _DRV._resolve_bim_agent_iter_id(None) == 99


def test_resolve_iter_id_returns_none_when_unset(monkeypatch) -> None:
    monkeypatch.delenv("BIM_AGENT_ITER_ID", raising=False)
    assert _DRV._resolve_bim_agent_iter_id(None) is None


def test_resolve_iter_id_returns_none_for_garbage_env(monkeypatch) -> None:
    monkeypatch.setenv("BIM_AGENT_ITER_ID", "not-a-number")
    assert _DRV._resolve_bim_agent_iter_id(None) is None
