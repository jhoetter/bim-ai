"""Tests for `bim_ai._io.json_io` (BRT-10)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from bim_ai._io.json_io import read_json, write_json


def test_read_json_returns_default_for_missing_file(tmp_path: Path) -> None:
    missing = tmp_path / "nope.json"
    assert read_json(missing) is None
    assert read_json(missing, default={}) == {}
    assert read_json(missing, default=[]) == []


def test_read_json_returns_default_for_corrupt_file(tmp_path: Path) -> None:
    corrupt = tmp_path / "bad.json"
    corrupt.write_text("{not json", encoding="utf-8")
    assert read_json(corrupt, default={}) == {}


def test_read_json_returns_parsed_payload(tmp_path: Path) -> None:
    target = tmp_path / "ok.json"
    target.write_text('{"a": 1, "b": [2, 3]}', encoding="utf-8")
    assert read_json(target) == {"a": 1, "b": [2, 3]}


def test_write_json_creates_parents(tmp_path: Path) -> None:
    nested = tmp_path / "a" / "b" / "c.json"
    write_json(nested, {"x": 1})
    assert nested.exists()
    assert json.loads(nested.read_text()) == {"x": 1}


def test_write_json_default_format_matches_folder_output(tmp_path: Path) -> None:
    # folder_output._write_json wrote pretty JSON with ensure_ascii=False
    # and a single trailing newline. Lock that byte shape so we can
    # migrate that call site without diff noise in evidence-pack files.
    target = tmp_path / "out.json"
    write_json(target, {"a": 1, "b": "ümlaut"})
    written = target.read_text(encoding="utf-8")
    assert written == '{\n  "a": 1,\n  "b": "ümlaut"\n}\n'


def test_write_json_atomic_leaves_no_temp_on_failure(tmp_path: Path) -> None:
    target = tmp_path / "out.json"
    target.write_text("{}", encoding="utf-8")

    class Unserializable:
        pass

    with pytest.raises(TypeError):
        write_json(target, {"bad": Unserializable()})
    # original content untouched, no stray tempfiles in dir
    assert target.read_text() == "{}"
    leftovers = [p for p in tmp_path.iterdir() if p.name != "out.json"]
    assert leftovers == []


def test_write_json_non_atomic_path(tmp_path: Path) -> None:
    target = tmp_path / "out.json"
    write_json(target, {"x": 1}, atomic=False)
    assert json.loads(target.read_text()) == {"x": 1}


def test_write_json_without_trailing_newline(tmp_path: Path) -> None:
    target = tmp_path / "out.json"
    write_json(target, {"x": 1}, trailing_newline=False)
    assert not target.read_text().endswith("\n")
