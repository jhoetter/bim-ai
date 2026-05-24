"""MF-driver-15 (#79): ``_shell_bundle_from_ir`` iterates levels dynamically.

The shell bundle previously emitted ``createLevel`` commands by
dispatching off a hard-coded ``{KG, EG, DG}`` map. Any IR carrying an
``OG`` or ``SB`` level (legal post-PR #35) crashed with ``KeyError`` and
blocked the driver from authoring beyond EG on h22 / h23.

These tests pin the dynamic discovery: one ``createLevel`` per
``ir["levels"]`` entry, in source order, with the elevation pulled from
the IR entry (not a hard-coded fallback). Back-compat with the 3-level
KG/EG/DG alpha layout is asserted explicitly so the refactor is a
strict superset.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

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


# A simple 4-vertex EG polygon shared across the IRs below — actual
# geometry is irrelevant to the dispatch logic we're pinning.
_EG_POLY = [[0, 0], [8000, 0], [8000, 6000], [0, 6000]]


def _level(lid: str, name: str, *, elevation_mm: float, height_mm: float = 2700.0) -> dict:
    return {
        "id": lid,
        "name": name,
        "elevationMm": elevation_mm,
        "heightMm": height_mm,
    }


def _ir(house: str, levels: list[dict]) -> dict:
    return {
        "house": house,
        "levels": levels,
        "exteriorWallChainEG": {"polygonMM": _EG_POLY, "wallThicknessMM": 240},
    }


def _create_levels(bundle: dict) -> list[dict]:
    return [c for c in bundle["commands"] if c.get("type") == "createLevel"]


# ---------- 3-level back-compat (alpha) -------------------------------------


def test_shell_bundle_3_level_kg_eg_dg_unchanged() -> None:
    # The original alpha shape: KG/EG/DG. Pre-fix this worked; assert
    # the refactor preserves the exact id format + ordering so existing
    # houses keep authoring identically.
    ir = _ir(
        "alpha",
        [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2500),
            _level("level-EG", "Erdgeschoss", elevation_mm=0),
            _level("level-DG", "Dachgeschoss", elevation_mm=2700),
        ],
    )
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    levels = _create_levels(bundle)
    assert [lvl["id"] for lvl in levels] == [
        "th-alpha-i3-level-KG",
        "th-alpha-i3-level-EG",
        "th-alpha-i3-level-DG",
    ]
    assert [lvl["name"] for lvl in levels] == [
        "Kellergeschoss",
        "Erdgeschoss",
        "Dachgeschoss",
    ]
    assert [lvl["elevationMm"] for lvl in levels] == [-2500.0, 0.0, 2700.0]

    # Roof still anchors at DG for the legacy 3-level shape.
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert len(roofs) == 1
    assert roofs[0]["referenceLevelId"] == "th-alpha-i3-level-DG"

    # EG slab + walls reference the EG level id.
    floors = [c for c in bundle["commands"] if c.get("type") == "createFloor"]
    walls = [c for c in bundle["commands"] if c.get("type") == "createWall"]
    assert floors[0]["levelId"] == "th-alpha-i3-level-EG"
    assert all(w["levelId"] == "th-alpha-i3-level-EG" for w in walls)


# ---------- 4-level (h22 / h23 partial) — no KeyError ------------------------


def test_shell_bundle_4_level_kg_eg_og_dg_emits_four_createlevel() -> None:
    # Pre-fix this raised ``KeyError: 'OG'`` because the dispatch dict
    # only knew {KG, EG, DG}.
    ir = _ir(
        "h-four",
        [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2500),
            _level("level-EG", "Erdgeschoss", elevation_mm=0),
            _level("level-OG", "Obergeschoss", elevation_mm=2700),
            _level("level-DG", "Dachgeschoss", elevation_mm=5400),
        ],
    )
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    levels = _create_levels(bundle)
    assert len(levels) == 4
    assert [lvl["id"] for lvl in levels] == [
        "th-h-four-i3-level-KG",
        "th-h-four-i3-level-EG",
        "th-h-four-i3-level-OG",
        "th-h-four-i3-level-DG",
    ]
    # Roof still anchors at DG since the IR has one.
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs[0]["referenceLevelId"] == "th-h-four-i3-level-DG"


# ---------- 5-level (h23) — no KeyError -------------------------------------


def test_shell_bundle_5_level_kg_eg_og_dg_sb_emits_five_createlevel() -> None:
    # h23 layout: KG / EG / OG / DG / Spitzboden.
    ir = _ir(
        "h-five",
        [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2500),
            _level("level-EG", "Erdgeschoss", elevation_mm=0),
            _level("level-OG", "Obergeschoss", elevation_mm=2700),
            _level("level-DG", "Dachgeschoss", elevation_mm=5400),
            _level("level-SB", "Spitzboden", elevation_mm=8100),
        ],
    )
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    levels = _create_levels(bundle)
    assert len(levels) == 5
    assert [lvl["id"] for lvl in levels] == [
        "th-h-five-i3-level-KG",
        "th-h-five-i3-level-EG",
        "th-h-five-i3-level-OG",
        "th-h-five-i3-level-DG",
        "th-h-five-i3-level-SB",
    ]
    # Even with SB above DG, the main gable roof still anchors at DG
    # (the structural Dachgeschoss) when the IR has one — Spitzboden
    # is an attic *floor*, not the roof reference plane.
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs[0]["referenceLevelId"] == "th-h-five-i3-level-DG"


# ---------- 3-level without DG (h22 — KG/EG/OG-under-pitched-roof) ----------


def test_shell_bundle_three_level_kg_eg_og_falls_back_to_top_level_for_roof() -> None:
    # h22-style: pitched roof sits over OG, no separate DG level.
    # Pre-fix this also crashed on KeyError. Post-fix the bundle
    # emits three createLevel commands and the roof anchors at OG
    # (the topmost authored level) instead of pointing at a phantom
    # ``level-DG`` id that the model would never see.
    ir = _ir(
        "h22",
        [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2500),
            _level("level-EG", "Erdgeschoss", elevation_mm=0),
            _level("level-OG", "Obergeschoss", elevation_mm=2700),
        ],
    )
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    levels = _create_levels(bundle)
    assert [lvl["id"] for lvl in levels] == [
        "th-h22-i3-level-KG",
        "th-h22-i3-level-EG",
        "th-h22-i3-level-OG",
    ]
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs[0]["referenceLevelId"] == "th-h22-i3-level-OG"


# ---------- elevations come from the IR, not a hardcoded fallback -----------


def test_shell_bundle_uses_ir_elevation_for_every_level() -> None:
    # Distinctive elevations on each level — assert they reach the
    # bundle verbatim. If the dispatch ever silently overwrote one
    # with a hardcoded fallback, this test would catch it.
    ir = _ir(
        "h-elev",
        [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2750),
            _level("level-EG", "Erdgeschoss", elevation_mm=125),
            _level("level-OG", "Obergeschoss", elevation_mm=2825),
            _level("level-DG", "Dachgeschoss", elevation_mm=5550),
            _level("level-SB", "Spitzboden", elevation_mm=8350),
        ],
    )
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    elev_by_short = {c["id"].rsplit("-", 1)[-1]: c["elevationMm"] for c in _create_levels(bundle)}
    assert elev_by_short == {
        "KG": -2750.0,
        "EG": 125.0,
        "OG": 2825.0,
        "DG": 5550.0,
        "SB": 8350.0,
    }


# ---------- ``elevationMM`` (uppercase) IR shape is also honoured -----------


def test_shell_bundle_reads_uppercase_elevationMM_key() -> None:
    # Alpha-style IR exports use ``elevationMM`` (uppercase MM); the
    # ``_lvl_elevation_mm`` helper already tolerates this — pin that
    # the shell bundle keeps going through that helper rather than
    # reading the key directly.
    ir = {
        "house": "alpha",
        "levels": [
            {"id": "level-KG", "name": "Kellergeschoss", "elevationMM": -2500, "heightMM": 2500},
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
            {"id": "level-OG", "name": "Obergeschoss", "elevationMM": 2700, "heightMM": 2700},
            {"id": "level-DG", "name": "Dachgeschoss", "elevationMM": 5400, "heightMM": 2700},
        ],
        "exteriorWallChainEG": {"polygonMM": _EG_POLY, "wallThicknessMM": 240},
    }
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    elev_by_short = {c["id"].rsplit("-", 1)[-1]: c["elevationMm"] for c in _create_levels(bundle)}
    assert elev_by_short == {"KG": -2500.0, "EG": 0.0, "OG": 2700.0, "DG": 5400.0}
