"""Shared logger helper (BRT-60).

Only 4 modules in the package import `logging` at all today. Pipeline
errors are surfaced via raised exceptions and dict payloads; structured
logs at phase boundaries are missing. This module exposes a single
`get_logger(name)` factory so the structured-log push under BRT-61 has
one canonical place to grow.

Today it's a thin wrapper over stdlib `logging` that:
- attaches a `JSONFormatter` to a stream handler if none is attached
- emits one JSON line per record (so downstream log shippers can ingest)
- includes a `correlation_id` field from `contextvars` when set —
  populated by the request-ID middleware in BRT-62

This is deliberately stdlib only — no `structlog` dependency yet. The
public API is small enough that swapping the implementation later (e.g.
to structlog) is a single-module change.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from typing import Any

_correlation_id: ContextVar[str | None] = ContextVar("bim_ai_correlation_id", default=None)


def set_correlation_id(value: str | None) -> None:
    """Set the correlation ID for the current async context.

    Called by the request-ID middleware (BRT-62) for each incoming
    request, and explicitly at pipeline-job entry points so logs
    emitted by long-running background work can be traced.
    """
    _correlation_id.set(value)


def get_correlation_id() -> str | None:
    return _correlation_id.get()


class JSONFormatter(logging.Formatter):
    """Emit one JSON line per log record.

    Fields:
    - ts: ISO-8601 timestamp from the record
    - level: lowercase level name
    - logger: dotted logger name
    - msg: the formatted message
    - correlation_id: from contextvar if set
    - any extras passed via ``extra={...}``
    """

    _RESERVED = frozenset(
        {
            "name",
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
            "taskName",
            "message",
            "asctime",
        }
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        cid = get_correlation_id()
        if cid:
            payload["correlation_id"] = cid
        for key, value in record.__dict__.items():
            if key in self._RESERVED or key.startswith("_"):
                continue
            payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def get_logger(name: str) -> logging.Logger:
    """Return a logger that emits JSON lines to stderr.

    The handler is attached lazily on first call so importing this
    module has no side effects beyond binding the symbol.
    """
    logger = logging.getLogger(name)
    if not any(getattr(h, "_bim_ai_io_log", False) for h in logger.handlers):
        handler = logging.StreamHandler(stream=sys.stderr)
        handler.setFormatter(JSONFormatter())
        handler._bim_ai_io_log = True  # type: ignore[attr-defined]
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger
