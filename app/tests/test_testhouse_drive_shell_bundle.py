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

MF-driver-24 (#103): the shell bundle MUST NOT emit ``createRoof``.
That phase used to author a redundant ``th-{house}-i{iter_n}-main-roof``
in addition to the dedicated ``_roof_bundle`` phase's
``th-{house}-main-roof``. The ids don't collide, so both committed and
the renderer drew two stacked gables. Tests below pin: zero createRoof
in the shell bundle, exactly one in the roof bundle, exactly one total
across the full author chain.
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

    # MF-driver-24 (#103): roof is the dedicated phase's job; shell must
    # not emit one even on the legacy 3-level shape where it used to.
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs == []

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
    # MF-driver-24 (#103): no roof in the shell bundle, regardless of
    # whether the IR carries a DG (the prior anchor target).
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs == []


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
    # MF-driver-24 (#103): roof is owned by ``_roof_bundle``. Shell
    # never emits one, regardless of how tall the level stack is.
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs == []


# ---------- 3-level without DG (h22 — KG/EG/OG-under-pitched-roof) ----------


def test_shell_bundle_three_level_kg_eg_og_emits_three_levels_no_roof() -> None:
    # h22-style: pitched roof sits over OG, no separate DG level.
    # Pre-fix this crashed on KeyError. Post-fix the bundle emits three
    # createLevel commands. MF-driver-24 (#103): the roof is no longer
    # emitted here either — ``_roof_bundle`` owns it — so we just
    # confirm no createRoof leaks out of the shell.
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
    assert roofs == []


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


# ---------- MF-driver-24 (#103): no double-roof emission --------------------


def _ir_with_dg_for_roof_phase(house: str) -> dict:
    """Minimal IR that satisfies BOTH ``_shell_bundle_from_ir`` (needs
    ``levels`` + ``exteriorWallChainEG``) AND ``_roof_bundle`` (needs a
    DG-level ``exterior_wall_chain`` fact). The DG polygon is the same
    rectangle as the EG chain so the roof phase always finds something
    to author."""

    return {
        "house": house,
        "levels": [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2500),
            _level("level-EG", "Erdgeschoss", elevation_mm=0),
            _level("level-DG", "Dachgeschoss", elevation_mm=2700),
        ],
        "exteriorWallChainEG": {"polygonMM": _EG_POLY, "wallThicknessMM": 240},
        "extractedFacts": [
            {
                "factId": "fact-dg-chain",
                "kind": "exterior_wall_chain",
                "levelId": "level-DG",
                "polygonMm": _EG_POLY,
            },
        ],
    }


def test_shell_bundle_emits_zero_create_roof_commands() -> None:
    """Issue #103: ``_shell_bundle_from_ir`` must not emit ANY createRoof.

    Pre-fix it emitted one ``th-{house}-i{iter_n}-main-roof`` in addition
    to the dedicated roof phase, producing two stacked gables at DG.
    """

    ir = _ir_with_dg_for_roof_phase("alpha")
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    roof_cmds = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roof_cmds == [], (
        "shell bundle must not emit createRoof — that belongs to _roof_bundle"
    )
    # And specifically: no command whose id matches the historical
    # shell-roof id pattern. Defensive belt-and-braces in case a future
    # refactor renames ``type`` but keeps the id around.
    shell_roof_ids = [
        c.get("id") for c in bundle["commands"] if str(c.get("id", "")).endswith("-main-roof")
    ]
    assert shell_roof_ids == []


def test_roof_bundle_emits_exactly_one_main_roof() -> None:
    """Issue #103: the dedicated roof phase still produces exactly one
    main gable roof — the fix removes shell duplication, not the roof
    phase itself."""

    ir = _ir_with_dg_for_roof_phase("alpha")
    pair = _DRV._roof_bundle(ir=ir, parent_revision=1, house="alpha")
    assert pair is not None, "_roof_bundle should author a roof for a valid DG chain"
    bundle, _consumed = pair

    main_roofs = [
        c
        for c in bundle["commands"]
        if c.get("type") == "createRoof" and c.get("id") == "th-alpha-main-roof"
    ]
    assert len(main_roofs) == 1
    assert main_roofs[0]["name"] == "Main gable roof"
    assert main_roofs[0]["referenceLevelId"] == "th-alpha-level-DG"


def test_full_shell_plus_roof_chain_produces_exactly_one_roof_element() -> None:
    """Issue #103: end-to-end, the union of shell + roof bundle commands
    contains EXACTLY one createRoof whose id is the roof phase's
    ``th-{house}-main-roof`` (and NOT the legacy
    ``th-{house}-i3-main-roof`` from shell).

    This is the property the renderer actually cares about: one and only
    one main gable rendered at DG. The CLAUDE.md project rule states
    explicitly that ``roofs=2`` is always a bug.
    """

    ir = _ir_with_dg_for_roof_phase("alpha")

    shell = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)
    roof_pair = _DRV._roof_bundle(ir=ir, parent_revision=2, house="alpha")
    assert roof_pair is not None
    roof_bundle, _consumed = roof_pair

    all_cmds = list(shell["commands"]) + list(roof_bundle["commands"])
    create_roofs = [c for c in all_cmds if c.get("type") == "createRoof"]
    # The roof bundle may add a Flachdach extension for EG-only wings;
    # this IR has none (DG chain == EG chain == rectangle) so the only
    # roof must be the main gable.
    assert len(create_roofs) == 1
    assert create_roofs[0]["id"] == "th-alpha-main-roof"
    # And the legacy shell id must NOT appear anywhere in the merged
    # command stream.
    assert not any(c.get("id") == "th-alpha-i3-main-roof" for c in all_cmds)
