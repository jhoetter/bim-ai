"""Tests for `bim_ai._io.log` (BRT-60)."""

from __future__ import annotations

import json
import logging
from io import StringIO

import pytest

from bim_ai._io.log import (
    JSONFormatter,
    get_correlation_id,
    get_logger,
    set_correlation_id,
)


@pytest.fixture(autouse=True)
def _reset_handlers() -> None:
    yield
    for name in list(logging.Logger.manager.loggerDict.keys()):
        if name.startswith("bim_ai_test_"):
            logger = logging.getLogger(name)
            logger.handlers.clear()
            logger.propagate = True


def _capture(logger_name: str) -> tuple[logging.Logger, StringIO]:
    logger = get_logger(logger_name)
    # Replace the stderr stream with a buffer for the test.
    handler = logger.handlers[0]
    buf = StringIO()
    handler.stream = buf  # type: ignore[attr-defined]
    return logger, buf


def test_json_formatter_emits_one_json_line_per_record() -> None:
    logger, buf = _capture("bim_ai_test_emits")
    logger.info("hello %s", "world")
    lines = buf.getvalue().strip().splitlines()
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["msg"] == "hello world"
    assert payload["level"] == "info"
    assert payload["logger"] == "bim_ai_test_emits"
    assert "ts" in payload


def test_extras_are_included() -> None:
    logger, buf = _capture("bim_ai_test_extras")
    logger.info("op", extra={"phase": "preflight", "duration_ms": 12})
    payload = json.loads(buf.getvalue().strip())
    assert payload["phase"] == "preflight"
    assert payload["duration_ms"] == 12


def test_correlation_id_appears_when_set() -> None:
    logger, buf = _capture("bim_ai_test_cid")
    set_correlation_id("req-42")
    try:
        logger.info("with cid")
    finally:
        set_correlation_id(None)
    payload = json.loads(buf.getvalue().strip())
    assert payload["correlation_id"] == "req-42"


def test_correlation_id_absent_by_default() -> None:
    logger, buf = _capture("bim_ai_test_no_cid")
    logger.info("without cid")
    payload = json.loads(buf.getvalue().strip())
    assert "correlation_id" not in payload


def test_get_correlation_id_round_trip() -> None:
    assert get_correlation_id() is None
    set_correlation_id("abc")
    try:
        assert get_correlation_id() == "abc"
    finally:
        set_correlation_id(None)


def test_handler_is_attached_once() -> None:
    logger = get_logger("bim_ai_test_idempotent")
    first_count = len(logger.handlers)
    get_logger("bim_ai_test_idempotent")
    assert len(logger.handlers) == first_count


def test_exception_info_is_serialized() -> None:
    logger, buf = _capture("bim_ai_test_exc")
    try:
        raise ValueError("boom")
    except ValueError:
        logger.exception("caught")
    payload = json.loads(buf.getvalue().strip())
    assert "exc" in payload
    assert "ValueError: boom" in payload["exc"]


def test_formatter_drops_underscore_prefixed_fields() -> None:
    # The handler-internal `_bim_ai_io_log` marker on the handler is on
    # the *handler*, not the record. But the formatter must drop any
    # underscore-prefixed extras passed by callers so internal state
    # doesn't leak.
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="t",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="x",
        args=None,
        exc_info=None,
    )
    record._secret = "no"  # type: ignore[attr-defined]
    record.public = "yes"  # type: ignore[attr-defined]
    payload = json.loads(formatter.format(record))
    assert payload["public"] == "yes"
    assert "_secret" not in payload
