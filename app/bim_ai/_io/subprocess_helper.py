"""Subprocess hygiene helper (BRT-70/71).

`run_subprocess` is a small, typed wrapper that:
- Always passes an explicit `timeout` (mandatory keyword arg — no
  unbounded waits)
- Always passes `check=False` so the caller decides what to do with
  a non-zero return code
- Narrowly catches `FileNotFoundError` and `TimeoutExpired` and
  surfaces them as a typed `SubprocessFailure` so callers can branch
  on the cause without re-implementing the same try/except

It's deliberately *not* an exception-swallowing helper: real
subprocess errors (permission denied, signal etc.) still surface as
exceptions so they're traceable.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class SubprocessOk:
    """Successful subprocess completion (exit 0 OR non-zero — the
    caller decides what counts as success based on `return_code`).
    """

    kind: Literal["ok"] = "ok"
    return_code: int = 0
    stdout: str = ""
    stderr: str = ""


@dataclass(frozen=True, slots=True)
class SubprocessFailure:
    """Subprocess could not be invoked or exceeded its timeout.

    `reason` is one of:
    - "not_found"   — the executable was not on PATH (`FileNotFoundError`)
    - "timeout"     — `subprocess.TimeoutExpired` was raised

    Other errors propagate as exceptions.
    """

    kind: Literal["failure"]
    reason: Literal["not_found", "timeout"]
    message: str


def run_subprocess(
    command: list[str],
    *,
    timeout_seconds: float,
    stdin: str | None = None,
    text: bool = True,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
) -> SubprocessOk | SubprocessFailure:
    """Run *command* with mandatory timeout. Always captures stdout/stderr.

    Returns SubprocessOk for any process that finished within
    `timeout_seconds` (zero or non-zero exit), and SubprocessFailure
    for not-found / timeout. Other exceptions propagate.

    Note the timeout is keyword-only and required — there is no
    sensible default for arbitrary commands, and an unbounded
    subprocess wedges the worker.
    """
    try:
        proc = subprocess.run(
            command,
            input=stdin,
            capture_output=True,
            text=text,
            timeout=timeout_seconds,
            check=False,
            cwd=cwd,
            env=env,
        )
    except FileNotFoundError as exc:
        return SubprocessFailure(kind="failure", reason="not_found", message=str(exc))
    except subprocess.TimeoutExpired as exc:
        return SubprocessFailure(kind="failure", reason="timeout", message=str(exc))
    return SubprocessOk(
        kind="ok",
        return_code=proc.returncode,
        stdout=proc.stdout if isinstance(proc.stdout, str) else "",
        stderr=proc.stderr if isinstance(proc.stderr, str) else "",
    )
