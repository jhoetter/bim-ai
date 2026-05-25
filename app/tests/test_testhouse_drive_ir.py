"""MF-driver-1 (#10): IR-schema validator for ``scripts/testhouse_drive.py``.

The driver previously crashed with ``KeyError: 'levels'`` when a reader-pass
produced a valid-but-different IR shape. The fix adds a pydantic
``_IRSchema`` + ``_load_and_validate_ir`` helper that fails fast with a
structured log line and clean stderr message.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

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


def _valid_ir() -> dict:
    return {
        "house": "alpha",
        "levels": [
            {"id": "level-KG", "name": "Kellergeschoss", "elevationMM": -2700, "heightMM": 2700},
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
            {"id": "level-DG", "name": "Dachgeschoss", "elevationMM": 2700, "heightMM": 2400},
        ],
        "exteriorWallChainEG": {
            "polygonMM": [[0, 0], [10000, 0], [10000, 8000], [0, 8000]],
            "wallThicknessMM": 365,
        },
        "extractedFacts": [{"kind": "level", "id": "level-EG"}],
    }


def _write_ir(tmp_path: Path, ir: dict) -> Path:
    p = tmp_path / "existing-building-ir.json"
    p.write_text(json.dumps(ir), encoding="utf-8")
    return p


def test_accepts_a_well_formed_ir(tmp_path: Path) -> None:
    ir_path = _write_ir(tmp_path, _valid_ir())
    out = _DRV._load_and_validate_ir(ir_path)
    assert out["house"] == "alpha"
    assert len(out["levels"]) == 3
    # Returns the raw dict (not the pydantic model) so the rest of the
    # driver keeps working via dict access.
    assert isinstance(out, dict)


def test_missing_levels_exits_with_clear_message(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    ir = _valid_ir()
    del ir["levels"]
    ir_path = _write_ir(tmp_path, ir)
    with pytest.raises(SystemExit) as exc_info:
        _DRV._load_and_validate_ir(ir_path)
    assert exc_info.value.code == 2
    err = capsys.readouterr().err
    assert str(ir_path) in err
    assert "levels" in err  # the missing-key hint must name the offending key


def test_missing_multiple_required_keys_lists_all(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    ir = _valid_ir()
    del ir["levels"]
    del ir["exteriorWallChainEG"]
    ir_path = _write_ir(tmp_path, ir)
    with pytest.raises(SystemExit) as exc_info:
        _DRV._load_and_validate_ir(ir_path)
    assert exc_info.value.code == 2
    err = capsys.readouterr().err
    # Both missing keys should appear in the message — not just the first.
    assert "levels" in err
    assert "exteriorWallChainEG" in err


def test_alternate_reader_shape_with_only_extractedFacts_fails_loudly(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # The exact failure mode reported by bim-agent iter-3: the LLM reader
    # wrote a single top-level extractedFacts list with kind:'level' entries
    # but no top-level 'levels' / 'exteriorWallChainEG'.
    ir = {
        "house": "beta",
        "extractedFacts": [
            {"kind": "level", "id": "level-EG", "name": "Erdgeschoss"},
            {"kind": "exterior_wall_chain", "polygonMM": [[0, 0], [5, 0]]},
        ],
    }
    ir_path = _write_ir(tmp_path, ir)
    with pytest.raises(SystemExit) as exc_info:
        _DRV._load_and_validate_ir(ir_path)
    assert exc_info.value.code == 2
    err = capsys.readouterr().err
    assert "levels" in err and "exteriorWallChainEG" in err


def test_missing_file_raises_filenotfounderror(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        _DRV._load_and_validate_ir(tmp_path / "does-not-exist.json")


def test_extra_top_level_fields_are_allowed(tmp_path: Path) -> None:
    # extractedFacts, derivedRooms, etc. must not trigger a validation
    # error — only the keys the driver dereferences are required.
    ir = _valid_ir()
    ir["derivedRooms"] = [{"id": "room-1"}]
    ir["someNewReaderField"] = {"foo": "bar"}
    ir_path = _write_ir(tmp_path, ir)
    out = _DRV._load_and_validate_ir(ir_path)
    assert out["derivedRooms"] == [{"id": "room-1"}]
    assert out["someNewReaderField"] == {"foo": "bar"}


# ---------------------------------------------------------------------------
# MF-driver-23 (#99): ``levels[*].name`` is optional and defaults to a
# canonical German label derived from the id. Reader subagents that emit
# only ``id`` per level should validate successfully.
# ---------------------------------------------------------------------------


def _ir_without_level_names() -> dict:
    ir = _valid_ir()
    for lvl in ir["levels"]:
        lvl.pop("name", None)
    return ir


def test_level_without_name_defaults_to_canonical_german_label(tmp_path: Path) -> None:
    ir_path = _write_ir(tmp_path, _ir_without_level_names())
    out = _DRV._load_and_validate_ir(ir_path)
    # The raw dict is returned, but the validator mutates it in-place to fill
    # in the derived name so downstream code that does ``lvl.get("name")``
    # sees a stable human-readable label.
    by_id = {lvl["id"]: lvl for lvl in out["levels"]}
    assert by_id["level-KG"]["name"] == "Kellergeschoss"
    assert by_id["level-EG"]["name"] == "Erdgeschoss"
    assert by_id["level-DG"]["name"] == "Dachgeschoss"


def test_explicit_level_name_is_preserved(tmp_path: Path) -> None:
    ir = _valid_ir()
    # Caller-supplied names — including non-canonical ones — must not be
    # overwritten by the derivation logic.
    ir["levels"][0]["name"] = "Ground Floor (custom)"
    ir["levels"][1]["name"] = "Erdgeschoss"
    ir_path = _write_ir(tmp_path, ir)
    out = _DRV._load_and_validate_ir(ir_path)
    by_id = {lvl["id"]: lvl for lvl in out["levels"]}
    assert by_id["level-KG"]["name"] == "Ground Floor (custom)"
    assert by_id["level-EG"]["name"] == "Erdgeschoss"


def test_level_missing_both_id_and_name_is_rejected(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    ir = _valid_ir()
    # Strip both id and name from the first level — the validator must
    # still reject because ``id`` is required for downstream lookups; the
    # name-derivation cannot manufacture an id.
    ir["levels"][0].pop("name", None)
    ir["levels"][0].pop("id", None)
    ir_path = _write_ir(tmp_path, ir)
    with pytest.raises(SystemExit) as exc_info:
        _DRV._load_and_validate_ir(ir_path)
    assert exc_info.value.code == 2
    err = capsys.readouterr().err
    # The error must point at the offending level's id, not silently pass.
    assert "id" in err


def test_unknown_level_id_defaults_name_to_id(tmp_path: Path) -> None:
    ir = _valid_ir()
    # Append an unknown-id level (e.g. a future "level-XX") with no name.
    # The validator should accept it and default name to the id itself,
    # leaving the rest of the driver to either handle or surface the id.
    ir["levels"].append({"id": "level-XX", "elevationMM": 5400, "heightMM": 2400})
    ir_path = _write_ir(tmp_path, ir)
    out = _DRV._load_and_validate_ir(ir_path)
    by_id = {lvl["id"]: lvl for lvl in out["levels"]}
    assert by_id["level-XX"]["name"] == "level-XX"


def test_log_line_is_structured(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # The "ir_invalid" event line must include the offending IR path so
    # the operator (or the next bim-agent reader attempt) can find it.
    captured: list[dict] = []

    def _capture(msg: str, **kwargs):  # type: ignore[no-untyped-def]
        captured.append({"msg": msg, **kwargs})

    monkeypatch.setattr(_DRV.logger, "error", _capture)

    ir = _valid_ir()
    del ir["levels"]
    ir_path = _write_ir(tmp_path, ir)
    with pytest.raises(SystemExit):
        _DRV._load_and_validate_ir(ir_path)
    assert captured, "expected one structured log line"
    extra = captured[0].get("extra", {})
    assert extra.get("event") == "testhouse_iter.ir_invalid"
    assert extra.get("ir_path") == str(ir_path)
    assert any(prob["loc"] == ["levels"] for prob in extra.get("problems", []))
