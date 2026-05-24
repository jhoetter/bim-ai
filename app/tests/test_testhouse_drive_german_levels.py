"""MF-driver-3 (#12): German level name normalization for ``testhouse_drive.py``.

Reader subagents on testhouse-2 / testhouse-3 emit storey labels verbatim from
German source PDFs ("Untergeschoss (UG / Keller)", "Spitzboden", …). Without
normalization the IR validator either passes the raw label through (so the
authored snapshot ends up with 6 / 7 duplicate levels) or downstream phases
fail to find a matching ``createLevel`` call.

These tests pin the German→canonical mapping and prove that
``_load_and_validate_ir`` rewrites both ``levels[*].id`` and
``extractedFacts[*].levelId`` in place before the validator runs.
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


# ---------------------------------------------------------------------------
# Unit tests for the pure ``_normalize_level_id`` helper
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # KG family
        ("UG", "level-KG"),
        ("Untergeschoss", "level-KG"),
        ("untergeschoss", "level-KG"),
        ("Kellergeschoss", "level-KG"),
        ("Keller", "level-KG"),
        ("Untergeschoss (UG / Keller)", "level-KG"),
        # EG family
        ("EG", "level-EG"),
        ("Erdgeschoss", "level-EG"),
        ("Erdgeschoss (EG)", "level-EG"),
        # OG family
        ("OG", "level-OG"),
        ("Obergeschoss", "level-OG"),
        # DG family
        ("DG", "level-DG"),
        ("Dachgeschoss", "level-DG"),
        ("Dachgeschoss (DG)", "level-DG"),
        # SB family
        ("SB", "level-SB"),
        ("Spitzboden", "level-SB"),
    ],
)
def test_normalize_level_id_maps_german_labels(raw: str, expected: str) -> None:
    assert _DRV._normalize_level_id(raw) == expected


@pytest.mark.parametrize(
    "canonical",
    ["level-KG", "level-EG", "level-OG", "level-DG", "level-SB"],
)
def test_normalize_level_id_is_idempotent_on_canonical(canonical: str) -> None:
    # Already-canonical ids must pass through verbatim — including the exact
    # original casing — so re-running the driver on a previously-normalized IR
    # is a no-op.
    assert _DRV._normalize_level_id(canonical) == canonical


def test_normalize_level_id_passes_unknown_through() -> None:
    # Unknown tokens are returned verbatim so the IR validator (or the
    # downstream phase) can surface the original label in its error message.
    assert _DRV._normalize_level_id("garage") == "garage"
    assert _DRV._normalize_level_id("attic") == "attic"


def test_normalize_level_id_kellergeschoss_wins_over_keller_substring() -> None:
    # "Kellergeschoss" must not be matched by the "keller" substring rule
    # before its own exact-match entry triggers. Both map to KG, but the
    # priority matters because "kellergeschoss" contains "keller".
    assert _DRV._normalize_level_id("Kellergeschoss") == "level-KG"


def test_normalize_level_id_handles_non_string_gracefully() -> None:
    # Defensive: if a malformed IR carries a non-string id we hand it back
    # untouched so the pydantic validator produces the cleaner error.
    assert _DRV._normalize_level_id(None) is None  # type: ignore[arg-type]
    assert _DRV._normalize_level_id(42) == 42  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# End-to-end: _load_and_validate_ir rewrites levels[*].id + facts[*].levelId
# ---------------------------------------------------------------------------


def _write_ir(tmp_path: Path, ir: dict) -> Path:
    p = tmp_path / "existing-building-ir.json"
    p.write_text(json.dumps(ir), encoding="utf-8")
    return p


def _exterior_chain() -> dict:
    return {
        "polygonMM": [[0, 0], [10000, 0], [10000, 8000], [0, 8000]],
        "wallThicknessMM": 365,
    }


def test_load_and_validate_ir_rewrites_german_level_ids(tmp_path: Path) -> None:
    # Mirrors the testhouse-3 reader output: 5 levels emitted verbatim.
    ir = {
        "house": "testhouse-3",
        "levels": [
            {"id": "Kellergeschoss", "name": "Kellergeschoss"},
            {"id": "Erdgeschoss", "name": "Erdgeschoss"},
            {"id": "Obergeschoss", "name": "Obergeschoss"},
            {"id": "Dachgeschoss", "name": "Dachgeschoss"},
            {"id": "Spitzboden", "name": "Spitzboden"},
        ],
        "exteriorWallChainEG": _exterior_chain(),
    }
    out = _DRV._load_and_validate_ir(_write_ir(tmp_path, ir))
    assert [lvl["id"] for lvl in out["levels"]] == [
        "level-KG",
        "level-EG",
        "level-OG",
        "level-DG",
        "level-SB",
    ]
    # Names are preserved verbatim — only ids are canonicalized.
    assert out["levels"][0]["name"] == "Kellergeschoss"
    assert out["levels"][4]["name"] == "Spitzboden"


def test_load_and_validate_ir_rewrites_testhouse2_parenthesized_forms(tmp_path: Path) -> None:
    # Mirrors the testhouse-2 reader output: the source PDF emits multi-word
    # parenthesized labels ("Untergeschoss (UG / Keller)").
    ir = {
        "house": "testhouse-2",
        "levels": [
            {"id": "Untergeschoss (UG / Keller)", "name": "Untergeschoss (UG / Keller)"},
            {"id": "Erdgeschoss (EG)", "name": "Erdgeschoss (EG)"},
            {"id": "Dachgeschoss (DG)", "name": "Dachgeschoss (DG)"},
        ],
        "exteriorWallChainEG": _exterior_chain(),
    }
    out = _DRV._load_and_validate_ir(_write_ir(tmp_path, ir))
    assert [lvl["id"] for lvl in out["levels"]] == ["level-KG", "level-EG", "level-DG"]


def test_load_and_validate_ir_rewrites_extracted_facts_level_refs(tmp_path: Path) -> None:
    # extractedFacts entries reference levels via ``levelId`` (rooms / walls /
    # openings) or via ``id`` on a ``kind: 'level'`` fact. Both must be
    # rewritten so cross-references survive normalization.
    ir = {
        "house": "testhouse-3",
        "levels": [
            {"id": "Kellergeschoss", "name": "Kellergeschoss"},
            {"id": "Erdgeschoss", "name": "Erdgeschoss"},
        ],
        "exteriorWallChainEG": _exterior_chain(),
        "extractedFacts": [
            {"kind": "level", "id": "Kellergeschoss", "name": "Kellergeschoss"},
            {"kind": "level", "id": "Erdgeschoss", "name": "Erdgeschoss"},
            {"kind": "room", "name": "Wohnzimmer", "levelId": "Erdgeschoss"},
            {"kind": "wall", "levelId": "Kellergeschoss"},
            {"kind": "opening", "levelId": "level-EG"},  # already canonical
        ],
    }
    out = _DRV._load_and_validate_ir(_write_ir(tmp_path, ir))
    assert [lvl["id"] for lvl in out["levels"]] == ["level-KG", "level-EG"]
    facts = out["extractedFacts"]
    assert facts[0]["id"] == "level-KG"
    assert facts[1]["id"] == "level-EG"
    assert facts[2]["levelId"] == "level-EG"
    assert facts[3]["levelId"] == "level-KG"
    # Already-canonical reference must be untouched.
    assert facts[4]["levelId"] == "level-EG"


def test_load_and_validate_ir_is_idempotent_on_already_canonical_ir(tmp_path: Path) -> None:
    # Re-running the driver on a previously-normalized IR must produce the
    # same output — no double-rewrite, no validator failure.
    ir = {
        "house": "testhouse-3",
        "levels": [
            {"id": "level-KG", "name": "Kellergeschoss"},
            {"id": "level-EG", "name": "Erdgeschoss"},
            {"id": "level-OG", "name": "Obergeschoss"},
        ],
        "exteriorWallChainEG": _exterior_chain(),
        "extractedFacts": [
            {"kind": "room", "name": "Wohnzimmer", "levelId": "level-EG"},
        ],
    }
    out = _DRV._load_and_validate_ir(_write_ir(tmp_path, ir))
    assert [lvl["id"] for lvl in out["levels"]] == ["level-KG", "level-EG", "level-OG"]
    assert out["extractedFacts"][0]["levelId"] == "level-EG"


def test_load_and_validate_ir_unknown_level_id_still_validates(tmp_path: Path) -> None:
    # An unknown German-ish token must pass through normalization unchanged,
    # but the IR is still structurally valid (id + name present), so the
    # validator accepts it. The operator can then spot the offending token in
    # the snapshot rather than getting a generic schema error.
    ir = {
        "house": "alpha",
        "levels": [
            {"id": "Erdgeschoss", "name": "Erdgeschoss"},
            {"id": "GartenebeneXYZ", "name": "GartenebeneXYZ"},
        ],
        "exteriorWallChainEG": _exterior_chain(),
    }
    out = _DRV._load_and_validate_ir(_write_ir(tmp_path, ir))
    assert [lvl["id"] for lvl in out["levels"]] == ["level-EG", "GartenebeneXYZ"]
