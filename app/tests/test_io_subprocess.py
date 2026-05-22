"""Tests for `bim_ai._io.subprocess_helper` (BRT-70/71)."""

from __future__ import annotations

import os
import sys

import pytest

from bim_ai._io.subprocess_helper import (
    SubprocessFailure,
    SubprocessOk,
    run_subprocess,
)


def test_ok_zero_exit() -> None:
    result = run_subprocess([sys.executable, "-c", "print('hi')"], timeout_seconds=5.0)
    assert isinstance(result, SubprocessOk)
    assert result.return_code == 0
    assert result.stdout.strip() == "hi"


def test_ok_nonzero_exit_is_still_ok() -> None:
    result = run_subprocess([sys.executable, "-c", "import sys; sys.exit(7)"], timeout_seconds=5.0)
    assert isinstance(result, SubprocessOk)
    assert result.return_code == 7


def test_failure_not_found() -> None:
    result = run_subprocess(["bim_ai_definitely_no_such_binary_xyz123"], timeout_seconds=5.0)
    assert isinstance(result, SubprocessFailure)
    assert result.reason == "not_found"


def test_failure_timeout() -> None:
    result = run_subprocess(
        [sys.executable, "-c", "import time; time.sleep(5)"],
        timeout_seconds=0.5,
    )
    assert isinstance(result, SubprocessFailure)
    assert result.reason == "timeout"


def test_stdin_is_forwarded() -> None:
    result = run_subprocess(
        [sys.executable, "-c", "import sys; sys.stdout.write(sys.stdin.read().upper())"],
        timeout_seconds=5.0,
        stdin="hello",
    )
    assert isinstance(result, SubprocessOk)
    assert result.stdout == "HELLO"


def test_env_is_passed() -> None:
    result = run_subprocess(
        [sys.executable, "-c", "import os; print(os.environ['BIM_AI_TEST'])"],
        timeout_seconds=5.0,
        env={**os.environ, "BIM_AI_TEST": "abc123"},
    )
    assert isinstance(result, SubprocessOk)
    assert result.stdout.strip() == "abc123"


def test_timeout_is_required_kwarg() -> None:
    with pytest.raises(TypeError):
        run_subprocess([sys.executable, "-c", "print('x')"])  # type: ignore[call-arg]
