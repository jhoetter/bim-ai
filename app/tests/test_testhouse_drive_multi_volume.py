"""MF-modeling-2 (#52): per-volume wall + slab authoring for multi-chain IRs.

Pre-fix, ``_exterior_walls_bundle`` did
``fact = chain_facts[0]`` — every disjoint ``exterior_wall_chain``
fact past the first one was silently dropped. For h13's main mass +
recessed NE cube accent, this meant the cube's walls and slab never
got authored; the renderer collapsed the building onto a single
prismatic bbox of the main chain and the accent volume vanished. The
``_roof_bundle`` flat-roof heuristic then drew a yellow Flachdach
sliver where the cube should have been (a roof with no walls under
it) — the visual signature called out in the issue.

The fix iterates ALL chain facts on the level. Each chain produces
its own walls + slab independently, with its own ``materialKey``
resolved per-fact. Per-volume semantics: a level with N disjoint
chains authors N sets of (walls + slab) — not one merged set, not
a bbox. IDs for chain index > 0 carry a ``-v{N}`` discriminator so
they don't collide with the legacy single-chain ids.

Tests below pin three things:

1. **Single-chain back-compat** (testhouse-1 baseline): a level with
   exactly one ``exterior_wall_chain`` fact produces byte-identical
   commands to pre-fix (same ids, same names, no ``-v`` suffix).
2. **Two disjoint chains**: a level with two ``exterior_wall_chain``
   facts (each carrying its own ``materialKey``) authors TWO sets of
   walls + TWO slabs, each routing the per-chain key correctly. The
   accent volume is not collapsed into the main mass and the
   materials don't bleed across volumes.
3. **Merged snapshot still validates** against ``_IRSchema``: the
   validator must accept an IR carrying 2+ ``exterior_wall_chain``
   entries with the same ``kind`` + ``levelId`` (the legitimate
   multi-volume shape). Per-volume IR shape extension is purely
   additive — the schema's other guarantees hold.
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


# Main mass — testhouse-1-style 9.9 m × 8.15 m rectangle.
_MAIN_RECT = [[0, 0], [9900, 0], [9900, 8150], [0, 8150]]
# NE cube accent — 3 m × 3 m square offset to the east of the main
# mass, disjoint (does not share any edge with the main rect).
_CUBE_RECT = [[11000, 5000], [14000, 5000], [14000, 8000], [11000, 8000]]


def _walls_and_slabs(bundle: dict) -> tuple[list[dict], list[dict]]:
    cmds = bundle["commands"]
    walls = [c for c in cmds if c.get("type") == "createWall"]
    slabs = [c for c in cmds if c.get("type") == "createFloor"]
    return walls, slabs


# ---------- 1. single-chain back-compat (byte-identical output) -------------


def test_single_chain_back_compat_authors_legacy_id_format() -> None:
    """A level with exactly one ``exterior_wall_chain`` fact must
    produce ids without the ``-v{N}`` suffix — byte-identical to the
    pre-fix output so existing testhouse-1 / alpha / beta / gamma
    snapshots keep matching."""

    ir = {
        "house": "testh",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
        ],
        "extractedFacts": [
            {
                "factId": "fact-eg-chain",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": _MAIN_RECT,
                "materialKey": "render_light_grey",
            },
        ],
    }
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="testh", level_short="EG"
    )
    assert pair is not None
    bundle, consumed = pair
    walls, slabs = _walls_and_slabs(bundle)

    # Single chain → exactly 4 walls (rect) + 1 slab.
    assert len(walls) == 4
    assert len(slabs) == 1

    # Legacy id format must be preserved exactly — no ``-v`` suffix.
    expected_wall_ids = {
        "th-testh-i-EG-ext-wall-0",
        "th-testh-i-EG-ext-wall-1",
        "th-testh-i-EG-ext-wall-2",
        "th-testh-i-EG-ext-wall-3",
    }
    assert {w["id"] for w in walls} == expected_wall_ids, (
        "single-chain wall ids must match the pre-fix legacy format exactly"
    )
    assert slabs[0]["id"] == "th-testh-i-EG-slab", (
        "single-chain slab id must match the pre-fix legacy format exactly"
    )
    # Wall name format must be unchanged for single-chain back-compat.
    assert walls[0]["name"] == "EG exterior wall 0"
    assert slabs[0]["name"] == "EG slab"
    # Consumed fact id list matches the single fact.
    assert consumed == ["fact-eg-chain"]


# ---------- 2. two disjoint chains → two sets of walls + slabs --------------


def test_two_disjoint_chains_author_two_sets_of_walls_and_slabs() -> None:
    """h13-style main mass + NE cube accent. Two ``exterior_wall_chain``
    facts on EG, each with its own ``materialKey``. Driver must author
    BOTH sets of walls + slabs — the accent volume is not collapsed,
    materials don't bleed across volumes, ids don't collide."""

    ir = {
        "house": "h13",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
        ],
        "extractedFacts": [
            {
                "factId": "fact-eg-main",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": _MAIN_RECT,
                "materialKey": "render_light_grey",
            },
            {
                "factId": "fact-eg-cube",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": _CUBE_RECT,
                "materialKey": "cladding_warm_wood",
            },
        ],
    }
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="h13", level_short="EG"
    )
    assert pair is not None
    bundle, consumed = pair
    walls, slabs = _walls_and_slabs(bundle)

    # 4 + 4 = 8 walls, 2 slabs (one per volume).
    assert len(walls) == 8, (
        f"expected 4 walls per volume × 2 volumes = 8 walls, got {len(walls)}"
    )
    assert len(slabs) == 2, (
        f"expected 1 slab per volume × 2 volumes = 2 slabs, got {len(slabs)}"
    )

    # Wall ids: volume 0 keeps the legacy format (no -v), volume 1
    # carries the -v1 suffix so the engine doesn't reject duplicate ids.
    wall_ids = {w["id"] for w in walls}
    assert "th-h13-i-EG-ext-wall-0" in wall_ids
    assert "th-h13-i-EG-ext-wall-3" in wall_ids
    assert "th-h13-i-EG-ext-wall-v1-0" in wall_ids
    assert "th-h13-i-EG-ext-wall-v1-3" in wall_ids
    # No collisions: every wall id is unique.
    assert len(wall_ids) == 8

    # Slab ids: same pattern — volume 0 legacy, volume 1 suffixed.
    slab_ids = {s["id"] for s in slabs}
    assert slab_ids == {"th-h13-i-EG-slab", "th-h13-i-EG-slab-v1"}, (
        f"per-volume slab ids must not collide; got {slab_ids}"
    )

    # Material routing: volume 0 walls all use the main material;
    # volume 1 walls all use the cube/accent material. Materials must
    # NOT bleed across volumes (that's the #60 + #52 interaction).
    main_walls = [w for w in walls if "-v" not in w["id"]]
    cube_walls = [w for w in walls if "-v1-" in w["id"]]
    assert {w["materialKey"] for w in main_walls} == {"render_light_grey"}, (
        "main volume walls must all use the main fact's materialKey"
    )
    assert {w["materialKey"] for w in cube_walls} == {"cladding_warm_wood"}, (
        "accent volume walls must all use the accent fact's materialKey"
    )

    # Slab boundaries must reflect EACH chain's own polygon (not a
    # merged bbox). Main slab spans 0..9900 x 0..8150; cube slab spans
    # 11000..14000 x 5000..8000 — disjoint footprints, proving the
    # bbox-collapse failure mode is gone.
    main_slab = next(s for s in slabs if s["id"] == "th-h13-i-EG-slab")
    cube_slab = next(s for s in slabs if s["id"] == "th-h13-i-EG-slab-v1")
    main_xs = [v["xMm"] for v in main_slab["boundaryMm"]]
    cube_xs = [v["xMm"] for v in cube_slab["boundaryMm"]]
    assert max(main_xs) == 9900, "main slab boundary must stop at main rect east edge"
    assert min(cube_xs) == 11000, "cube slab boundary must start past main rect east edge"
    # Per-volume consumed-fact accounting: both fact ids show up.
    assert set(consumed) == {"fact-eg-main", "fact-eg-cube"}


# ---------- 3. merged snapshot still validates against _IRSchema ------------


def test_multi_chain_ir_still_validates_against_ir_schema(tmp_path: Path) -> None:
    """The IR validator must accept an IR carrying 2+
    ``exterior_wall_chain`` extractedFacts with the same ``kind`` +
    ``levelId``. Multi-volume is an additive shape; nothing else about
    the schema should reject it.

    The schema validation only enforces required top-level keys
    (``house``, ``levels``, ``exteriorWallChainEG``); ``extractedFacts``
    is allowed-extra and not constrained for uniqueness. This test
    pins that contract so a future schema tightening doesn't
    accidentally regress multi-volume support."""

    ir = {
        "house": "h13",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
            {"id": "level-DG", "name": "Dachgeschoss", "elevationMM": 2700, "heightMM": 2400},
        ],
        # Legacy single-chain top-level field (kept for back-compat with
        # iter-3-era IRs; the driver's multi-volume path reads from
        # ``extractedFacts`` instead).
        "exteriorWallChainEG": {
            "polygonMM": _MAIN_RECT,
            "wallThicknessMM": 365,
        },
        "extractedFacts": [
            # Two chains on EG (main + cube accent).
            {
                "factId": "fact-eg-main",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": _MAIN_RECT,
                "materialKey": "render_light_grey",
            },
            {
                "factId": "fact-eg-cube",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": _CUBE_RECT,
                "materialKey": "cladding_warm_wood",
            },
            # And a DG chain over the main mass (cube is single-storey).
            {
                "factId": "fact-dg-main",
                "kind": "exterior_wall_chain",
                "levelId": "level-DG",
                "polygonMm": _MAIN_RECT,
                "materialKey": "render_light_grey",
            },
        ],
    }
    ir_path = tmp_path / "existing-building-ir.json"
    ir_path.write_text(json.dumps(ir), encoding="utf-8")
    # Must not raise / SystemExit. Validator accepts the multi-chain shape.
    out = _DRV._load_and_validate_ir(ir_path)
    assert out["house"] == "h13"
    chains = [
        f for f in out["extractedFacts"]
        if f.get("kind") == "exterior_wall_chain"
    ]
    assert len(chains) == 3, (
        "validator must preserve all 3 multi-volume chains; "
        f"got {len(chains)} after validation"
    )


# ---------- 4. partial degenerate chain doesn't kill valid sibling ----------


def test_degenerate_chain_skipped_but_valid_sibling_still_authored() -> None:
    """If one of multiple chains on a level is malformed (degenerate
    polygon), the bundle must skip THAT chain and still author the
    valid sibling — not abort the whole level. Defensive behaviour
    for reader-pass noise."""

    ir = {
        "house": "h13",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
        ],
        "extractedFacts": [
            {
                "factId": "fact-eg-main",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": _MAIN_RECT,
                "materialKey": "render_light_grey",
            },
            {
                # Degenerate: only 2 vertices — can't make a polygon.
                "factId": "fact-eg-bogus",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": [[0, 0], [100, 0]],
            },
        ],
    }
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="h13", level_short="EG"
    )
    assert pair is not None
    bundle, consumed = pair
    walls, slabs = _walls_and_slabs(bundle)
    # Only the main chain authors → 4 walls + 1 slab.
    assert len(walls) == 4
    assert len(slabs) == 1
    # Only the main chain's factId is in consumed (the degenerate one
    # is skipped entirely, not falsely claimed).
    assert consumed == ["fact-eg-main"]


# ---------- 5. all chains degenerate → bundle returns None ------------------


def test_all_chains_degenerate_returns_none() -> None:
    """When EVERY chain on the level is malformed, the bundle returns
    None — matching the pre-fix no-chain behaviour so the per-level
    authoring loop skips this phase cleanly."""

    ir = {
        "house": "h13",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
        ],
        "extractedFacts": [
            {
                "factId": "fact-bogus-1",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": [[0, 0]],  # one vertex
            },
            {
                "factId": "fact-bogus-2",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": [],  # empty
            },
        ],
    }
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="h13", level_short="EG"
    )
    assert pair is None


# ---------- 6. parametric across all 4-vertex levels (KG/EG/OG/DG) ----------


@pytest.mark.parametrize("level_short", ["KG", "EG", "OG", "DG"])
def test_single_chain_back_compat_across_all_levels(level_short: str) -> None:
    """Sanity sweep: every standard level keeps the legacy id pattern
    in single-chain mode. Catches accidental level-specific
    regressions in the per-volume refactor."""

    ir = {
        "house": "testh",
        "levels": [
            {"id": f"level-{level_short}", "name": level_short, "elevationMM": 0, "heightMM": 2700},
        ],
        "extractedFacts": [
            {
                "factId": f"fact-{level_short}-chain",
                "kind": "exterior_wall_chain",
                "levelId": f"level-{level_short}",
                "polygonMm": _MAIN_RECT,
            },
        ],
    }
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="testh", level_short=level_short
    )
    assert pair is not None
    bundle, _consumed = pair
    walls, slabs = _walls_and_slabs(bundle)
    assert len(walls) == 4
    assert len(slabs) == 1
    # Slab id has NO -v suffix in single-chain mode.
    assert slabs[0]["id"] == f"th-testh-i-{level_short}-slab"
    for w in walls:
        assert "-v" not in w["id"], (
            f"single-chain mode must not emit -v suffix; got {w['id']}"
        )
