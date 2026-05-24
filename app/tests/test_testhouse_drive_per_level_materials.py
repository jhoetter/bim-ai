"""MF-render-6 (#60): per-level exterior-wall ``materialKey`` routing.

Pre-fix, ``_exterior_walls_bundle`` hardcoded
``materialKey="render_light_grey"`` on every createWall it emitted,
regardless of what the IR's per-level ``exterior_wall_chain`` fact
declared. For a 2-tone Doppelhaus (house-22 / beta) where EG ships
``render_light_grey`` (Putz) and DG ships ``cladding_warm_wood``
(Holzschalung), this meant both storeys were authored with the same
material — the renderer (post PR #55) then had nothing per-level to
paint with and the iter-13 capture showed one finish across the whole
elevation.

These tests pin the driver-side routing:

1. An IR with 2 per-level ``exterior_wall_chain`` facts (each carrying
   its own ``materialKey``) produces EG walls with the EG key and DG
   walls with the DG key — NOT swapped, NOT collapsed onto one.
2. Back-compat: an IR with no per-level ``materialKey`` but the legacy
   top-level ``ir["exteriorWallChainEG"]["materialKey"]`` field still
   authors walls with that single key for every floor.
3. Edge case: a per-level chain with NO ``materialKey`` anywhere falls
   back to the sensible default (``render_light_grey``) without crashing.
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


# A small 4-vertex rectangle suffices for material-routing assertions —
# the L-shape / collinear-strip behaviour is covered in
# ``test_testhouse_drive_walls.py``.
_RECT = [[0, 0], [9900, 0], [9900, 8150], [0, 8150]]


def _walls(bundle: dict) -> list[dict]:
    return [c for c in bundle["commands"] if c.get("type") == "createWall"]


def _two_storey_ir(eg_material: str | None, dg_material: str | None) -> dict:
    """Two-storey IR with separate per-level ``exterior_wall_chain``
    facts. Mirrors the house-22 (beta) Doppelhaus shape with explicit
    2-tone materials."""

    eg_fact: dict = {
        "factId": "fact-eg-chain",
        "kind": "exterior_wall_chain",
        "levelId": "level-EG",
        "polygonMm": _RECT,
    }
    if eg_material is not None:
        eg_fact["materialKey"] = eg_material

    dg_fact: dict = {
        "factId": "fact-dg-chain",
        "kind": "exterior_wall_chain",
        "levelId": "level-DG",
        "polygonMm": _RECT,
    }
    if dg_material is not None:
        dg_fact["materialKey"] = dg_material

    return {
        "house": "beta",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
            {"id": "level-DG", "name": "Dachgeschoss", "elevationMM": 2700, "heightMM": 2400},
        ],
        "extractedFacts": [eg_fact, dg_fact],
    }


# ---------- 1. per-level materials: not swapped, not collapsed -------------


def test_per_level_material_keys_route_to_their_own_floor() -> None:
    ir = _two_storey_ir(
        eg_material="render_light_grey",
        dg_material="cladding_warm_wood",
    )

    eg_pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="beta", level_short="EG"
    )
    dg_pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="beta", level_short="DG"
    )
    assert eg_pair is not None and dg_pair is not None

    eg_walls = _walls(eg_pair[0])
    dg_walls = _walls(dg_pair[0])
    assert eg_walls and dg_walls

    eg_keys = {w["materialKey"] for w in eg_walls}
    dg_keys = {w["materialKey"] for w in dg_walls}

    # EG walls must all carry the EG fact's materialKey — not the DG one,
    # and not a hardcoded fallback.
    assert eg_keys == {"render_light_grey"}, (
        f"EG walls should all use 'render_light_grey' from the EG fact; got {eg_keys}"
    )
    # DG walls must all carry the DG fact's materialKey — not the EG one,
    # and not a hardcoded fallback. Catches both the "swap" and the
    # "collapse onto a single key" failure modes called out in #60.
    assert dg_keys == {"cladding_warm_wood"}, (
        f"DG walls should all use 'cladding_warm_wood' from the DG fact; got {dg_keys}"
    )


# ---------- 2. back-compat: legacy top-level exteriorWallChainEG -----------


def test_legacy_top_level_material_key_back_compat() -> None:
    # Older iter-3-era IRs only carry a single top-level
    # ``exteriorWallChainEG`` (no per-fact materialKey). When the per-
    # level fact lacks a key, the driver must fall back to the legacy
    # top-level key so existing IRs keep authoring with the right paint.
    ir = _two_storey_ir(eg_material=None, dg_material=None)
    ir["exteriorWallChainEG"] = {
        "polygonMM": _RECT,
        "wallThicknessMM": 365,
        "materialKey": "render_light_grey",
    }

    for floor in ("EG", "DG"):
        pair = _DRV._exterior_walls_bundle(
            ir=ir, parent_revision=1, house="beta", level_short=floor
        )
        assert pair is not None
        walls = _walls(pair[0])
        assert walls
        keys = {w["materialKey"] for w in walls}
        assert keys == {"render_light_grey"}, (
            f"{floor} walls should fall back to legacy top-level key; got {keys}"
        )


# ---------- 3. edge case: no materialKey anywhere falls back to default ----


def test_missing_material_key_falls_back_to_default_without_crashing() -> None:
    # When neither the per-level fact nor the legacy top-level chain
    # declares a materialKey, the bundle must still author walls (don't
    # crash, don't emit None) and fall back to a sensible default so the
    # renderer has something to resolve.
    ir = _two_storey_ir(eg_material=None, dg_material=None)

    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="beta", level_short="EG"
    )
    assert pair is not None
    walls = _walls(pair[0])
    assert walls
    keys = {w["materialKey"] for w in walls}
    assert keys == {"render_light_grey"}, (
        f"missing materialKey should fall back to 'render_light_grey'; got {keys}"
    )
    # Every wall must carry a non-empty string — the renderer warns on
    # unresolved keys (PR #55) so an empty fallback would regress that.
    for w in walls:
        assert isinstance(w["materialKey"], str) and w["materialKey"], (
            f"every wall must carry a non-empty materialKey string; got {w!r}"
        )
