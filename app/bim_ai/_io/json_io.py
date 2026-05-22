"""Shared JSON read/write helpers (BRT-10)."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def read_json(path: Path, *, default: Any = None) -> Any:
    """Read JSON from *path*. Return *default* on any failure.

    Mirrors the dominant existing behavior in
    `reverse_bim_reader_dispatch._read_json` and
    `reverse_bim_source_revision_persistence._load_json`: missing
    files and parse errors collapse to a safe sentinel rather than
    propagating, because callers want a structured result not a
    crash. The previous helpers hard-coded `{}` as that sentinel;
    pass `default={}` to match.
    """
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(
    path: Path,
    payload: Any,
    *,
    indent: int | None = 2,
    ensure_ascii: bool = False,
    trailing_newline: bool = True,
    atomic: bool = True,
) -> None:
    """Write *payload* as JSON to *path*, creating parents.

    Matches `folder_output._write_json`: pretty-printed,
    `ensure_ascii=False`, single trailing newline. Atomic by
    default — writes to a tempfile in the same directory and
    renames, so partial writes never appear on disk.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=indent, ensure_ascii=ensure_ascii)
    if trailing_newline:
        text = text + "\n"
    if not atomic:
        path.write_text(text, encoding="utf-8")
        return
    fd, tmp_path = tempfile.mkstemp(
        prefix=path.name + ".",
        suffix=".tmp",
        dir=str(path.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
