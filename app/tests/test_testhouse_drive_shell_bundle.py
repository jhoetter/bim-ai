"""MF-driver-15 (#79): ``_shell_bundle_from_ir`` iterates levels dynamically.

The shell bundle previously emitted ``createLevel`` commands by
dispatching off a hard-coded ``{KG, EG, DG}`` map. Any IR carrying an
``OG`` or ``SB`` level (legal post-PR #35) crashed with ``KeyError`` and
blocked the driver from authoring beyond EG on h22 / h23.

These tests pin the dynamic discovery: the shell bundle handles every
level shape the IR may carry (3-, 4-, 5-level) without crashing, and
the walls/slab it emits bind to the canonical EG level id seeded by
the topology phase.

MF-driver-24 (#103): the shell bundle MUST NOT emit ``createRoof``.
That phase used to author a redundant ``th-{house}-i{iter_n}-main-roof``
in addition to the dedicated ``_roof_bundle`` phase's
``th-{house}-main-roof``. The ids don't collide, so both committed and
the renderer drew two stacked gables. Tests below pin: zero createRoof
in the shell bundle, exactly one in the roof bundle, exactly one total
across the full author chain.

MF-driver-25 (#115): the shell bundle MUST NOT emit ``createLevel``
either — same exact pattern as the duplicate-roof bug above. The shell
phase previously authored ``th-{house}-i{iter_n}-level-{KG|EG|…}`` while
``_project_setup_bundle`` (the topology phase) authored the canonical
``th-{house}-level-{KG|EG|…}`` for the same storeys. The ids don't
collide → both commit → snapshots show doubled level element counts and
walls / roofs end up split across two parallel level namespaces. Tests
below pin: zero createLevel in the shell bundle (the topology phase is
the sole authority), walls + slab bind to the canonical EG level id,
and the union of topology + shell commands produces exactly one
createLevel per IR storey.
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


def test_shell_bundle_3_level_kg_eg_dg_emits_zero_create_level() -> None:
    # Post-#115: the shell bundle no longer owns level emission. The
    # topology phase (``_project_setup_bundle``) is the sole authority.
    # Walls + slab bind to the canonical EG level id ``th-{house}-level-EG``.
    ir = _ir(
        "alpha",
        [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2500),
            _level("level-EG", "Erdgeschoss", elevation_mm=0),
            _level("level-DG", "Dachgeschoss", elevation_mm=2700),
        ],
    )
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    assert _create_levels(bundle) == [], (
        "shell bundle must not emit createLevel — that belongs to _project_setup_bundle"
    )

    # MF-driver-24 (#103): roof is the dedicated phase's job; shell must
    # not emit one even on the legacy 3-level shape where it used to.
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs == []

    # EG slab + walls reference the canonical (iter-independent) EG level id.
    floors = [c for c in bundle["commands"] if c.get("type") == "createFloor"]
    walls = [c for c in bundle["commands"] if c.get("type") == "createWall"]
    assert floors[0]["levelId"] == "th-alpha-level-EG"
    assert all(w["levelId"] == "th-alpha-level-EG" for w in walls)


# ---------- 4-level (h22 / h23 partial) — no KeyError ------------------------


def test_shell_bundle_4_level_kg_eg_og_dg_emits_zero_create_level() -> None:
    # Pre-#79 this raised ``KeyError: 'OG'`` because the dispatch dict
    # only knew {KG, EG, DG}. Post-#115 the shell emits no levels at all,
    # regardless of how many the IR declares — the topology phase covers
    # every shape uniformly.
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

    assert _create_levels(bundle) == []
    # MF-driver-24 (#103): no roof in the shell bundle, regardless of
    # whether the IR carries a DG (the prior anchor target).
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs == []
    # Walls + slab still bind to the canonical EG storey.
    floors = [c for c in bundle["commands"] if c.get("type") == "createFloor"]
    walls = [c for c in bundle["commands"] if c.get("type") == "createWall"]
    assert floors[0]["levelId"] == "th-h-four-level-EG"
    assert all(w["levelId"] == "th-h-four-level-EG" for w in walls)


# ---------- 5-level (h23) — no KeyError -------------------------------------


def test_shell_bundle_5_level_kg_eg_og_dg_sb_emits_zero_create_level() -> None:
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

    assert _create_levels(bundle) == []
    # MF-driver-24 (#103): roof is owned by ``_roof_bundle``. Shell
    # never emits one, regardless of how tall the level stack is.
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs == []


# ---------- 3-level without DG (h22 — KG/EG/OG-under-pitched-roof) ----------


def test_shell_bundle_three_level_kg_eg_og_emits_zero_create_level_no_roof() -> None:
    # h22-style: pitched roof sits over OG, no separate DG level.
    # Post-#115 the shell bundle authors no levels at all here either.
    ir = _ir(
        "h22",
        [
            _level("level-KG", "Kellergeschoss", elevation_mm=-2500),
            _level("level-EG", "Erdgeschoss", elevation_mm=0),
            _level("level-OG", "Obergeschoss", elevation_mm=2700),
        ],
    )
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    assert _create_levels(bundle) == []
    roofs = [c for c in bundle["commands"] if c.get("type") == "createRoof"]
    assert roofs == []


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


# ---------- MF-driver-25 (#115): no double-level emission -------------------


def test_shell_bundle_emits_zero_create_level_commands() -> None:
    """Issue #115: ``_shell_bundle_from_ir`` must not emit ANY createLevel.

    Pre-fix it emitted one ``th-{house}-i{iter_n}-level-{short}`` per IR
    storey in addition to the topology phase's canonical
    ``th-{house}-level-{short}``. The ids don't collide so both commit
    and every house snapshot showed double the expected level count
    (h22: 6 levels instead of 3, h23: 10 instead of 5), with walls
    landing on one namespace and roofs/rooms on the other.
    """

    ir = _ir_with_dg_for_roof_phase("alpha")
    bundle = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=1, iter_n=3)

    level_cmds = [c for c in bundle["commands"] if c.get("type") == "createLevel"]
    assert level_cmds == [], (
        "shell bundle must not emit createLevel — that belongs to _project_setup_bundle"
    )
    # And specifically: no command whose id matches the historical
    # iter-prefixed level id pattern.
    shell_level_ids = [
        c.get("id") for c in bundle["commands"] if "-i3-level-" in str(c.get("id", ""))
    ]
    assert shell_level_ids == []


def test_project_setup_bundle_emits_exactly_one_level_per_ir_storey() -> None:
    """Issue #115: the dedicated topology phase emits exactly one canonical
    ``th-{house}-level-{short}`` createLevel per IR storey — the fix
    removes shell duplication, not the topology phase itself."""

    ir = _ir_with_dg_for_roof_phase("alpha")
    bundle = _DRV._project_setup_bundle(ir=ir, parent_revision=1, house="alpha")
    assert bundle is not None, "_project_setup_bundle should author levels for any valid IR"

    levels = [c for c in bundle["commands"] if c.get("type") == "createLevel"]
    assert [lvl["id"] for lvl in levels] == [
        "th-alpha-level-KG",
        "th-alpha-level-EG",
        "th-alpha-level-DG",
    ]
    assert all(not str(lvl["id"]).startswith("th-alpha-i") for lvl in levels), (
        "topology levels must use the canonical (iter-independent) id scheme"
    )


def test_full_topology_plus_shell_chain_produces_exactly_one_level_per_storey() -> None:
    """Issue #115: end-to-end, the union of topology + shell bundle
    commands contains EXACTLY one createLevel per IR storey, all under
    the canonical ``th-{house}-level-{short}`` id (no iter prefix).

    This is the property the renderer actually cares about: walls / floors
    / roofs / rooms all bind to the same level namespace and the
    snapshot ``LEVELS (N):`` count matches ``len(ir.levels)`` exactly.
    """

    ir = _ir_with_dg_for_roof_phase("alpha")

    ps = _DRV._project_setup_bundle(ir=ir, parent_revision=1, house="alpha")
    assert ps is not None
    shell = _DRV._shell_bundle_from_ir(ir=ir, parent_revision=2, iter_n=3)

    all_cmds = list(ps["commands"]) + list(shell["commands"])
    level_ids = [c.get("id") for c in all_cmds if c.get("type") == "createLevel"]
    assert level_ids == [
        "th-alpha-level-KG",
        "th-alpha-level-EG",
        "th-alpha-level-DG",
    ], "exactly one createLevel per IR storey, all on the canonical namespace"
    # And the legacy iter-prefixed shell ids must NOT appear anywhere
    # in the merged command stream.
    assert not any(
        "-i3-level-" in str(c.get("id", "")) for c in all_cmds if c.get("type") == "createLevel"
    )
    # The shell's walls + slab must bind to the canonical EG id (same
    # one the topology phase authored), not some shell-local variant.
    eg_id = "th-alpha-level-EG"
    walls = [c for c in shell["commands"] if c.get("type") == "createWall"]
    floors = [c for c in shell["commands"] if c.get("type") == "createFloor"]
    assert all(w["levelId"] == eg_id for w in walls)
    assert all(f["levelId"] == eg_id for f in floors)
