"""MF-modeling-1 (#31): pitched-roof generator on multi-vertex footprints.

Pre-fix, ``scripts/testhouse_drive._roof_bundle`` always emitted
``roofGeometryMode: gable_pitched_rectangle`` and bbox-rectified any
>4-vertex footprint to its axis-aligned bounds. That visually hides
the L-step (gable overhangs the void of the inner corner) and — for
reader polygons with a collinear midpoint per facade — also forces
the bbox path even when the engine's ``gable_pitched_l_shape`` mode
would author a geometrically faithful roof.

Tests below pin three things without going near MCP / snapshots:

1. ``_strip_collinear_vertices`` drops the extra reader-emitted
   midpoints so the engine's strict shape predicates can fire.
2. ``_roof_bundle`` routes a clean 6-vertex L-shape DG chain through
   ``gable_pitched_l_shape``.
3. ``_roof_bundle`` still falls back to bbox-rectified
   ``gable_pitched_rectangle`` for irregular >4-vertex polygons.
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


# ---------- _strip_collinear_vertices ---------------------------------------


def test_strip_collinear_drops_axis_aligned_midpoint() -> None:
    # Gamma EG chain: 7 vertices with one collinear midpoint at
    # (13990, 0) on the segment (0,0)→(17700,0).
    poly = [
        [0, 0],
        [13990, 0],
        [17700, 0],
        [17700, 3700],
        [13990, 3700],
        [13990, 6000],
        [0, 6000],
    ]
    cleaned = _DRV._strip_collinear_vertices(poly)
    assert len(cleaned) == 6, f"expected 6v L-shape after strip, got {cleaned}"
    # The collinear (13990, 0) midpoint is dropped; the reflex corner
    # (13990, 3700) is kept because its incoming/outgoing edges turn.
    assert [13990, 0] not in cleaned
    assert [13990, 3700] in cleaned


def test_strip_collinear_is_a_noop_for_a_clean_rectangle() -> None:
    poly = [[0, 0], [10000, 0], [10000, 5000], [0, 5000]]
    assert _DRV._strip_collinear_vertices(poly) == poly


def test_strip_collinear_handles_degenerate_polygon() -> None:
    # All collinear (zero-area line) — return the original so the
    # caller's downstream `< 3` check still rejects it.
    poly = [[0, 0], [5000, 0], [10000, 0]]
    out = _DRV._strip_collinear_vertices(poly)
    assert out == [[0, 0], [5000, 0], [10000, 0]]


# ---------- _roof_bundle dispatch -------------------------------------------


def _ir_with_dg_chain(poly: list[list[float]]) -> dict:
    """Minimal IR with a DG exterior_wall_chain. Engine validators
    elsewhere ensure the rest is well-formed; for the tests below we
    only need ``_roof_bundle`` to find the chain."""

    return {
        "levels": [
            {"id": "level-DG", "name": "Dachgeschoss"},
            {"id": "level-EG", "name": "Erdgeschoss"},
        ],
        "extractedFacts": [
            {
                "factId": "fact-dg-chain",
                "kind": "exterior_wall_chain",
                "levelId": "level-DG",
                "polygonMm": poly,
            },
            # Provide eave + ridge so the pitch derivation has data
            # (otherwise the default 35° is fine; this just exercises
            # the same code path as the real driver).
            {
                "factId": "fact-eave",
                "kind": "eave_height",
                "levelId": "global",
                "valueMm": 5400,
            },
            {
                "factId": "fact-ridge",
                "kind": "ridge_height",
                "levelId": "global",
                "valueMm": 9500,
            },
        ],
    }


def test_roof_bundle_routes_clean_l_shape_to_gable_pitched_l_shape() -> None:
    # 6-vertex L (axis-aligned, one reflex corner at (13990, 3700)).
    l_shape = [
        [0, 0],
        [17700, 0],
        [17700, 3700],
        [13990, 3700],
        [13990, 6000],
        [0, 6000],
    ]
    ir = _ir_with_dg_chain(l_shape)
    bundle, consumed = _DRV._roof_bundle(ir=ir, parent_revision=1, house="gamma")
    main = bundle["commands"][0]
    assert main["roofGeometryMode"] == "gable_pitched_l_shape"
    # Footprint preserves the actual L vertices — no bbox rectify.
    assert len(main["footprintMm"]) == 6
    xs = [p["xMm"] for p in main["footprintMm"]]
    ys = [p["yMm"] for p in main["footprintMm"]]
    assert max(xs) == 17700 and max(ys) == 6000
    assert "fact-dg-chain" in consumed


def test_roof_bundle_routes_collinear_midpoint_l_shape_through_strip() -> None:
    # 7-vertex L (gamma-style collinear midpoint on the bottom edge).
    poly = [
        [0, 0],
        [13990, 0],
        [17700, 0],
        [17700, 3700],
        [13990, 3700],
        [13990, 6000],
        [0, 6000],
    ]
    ir = _ir_with_dg_chain(poly)
    bundle, _consumed = _DRV._roof_bundle(ir=ir, parent_revision=1, house="gamma")
    main = bundle["commands"][0]
    # After collinear-strip the polygon is a valid 6-vertex L, so we
    # route to gable_pitched_l_shape (not bbox-rectified rectangle).
    assert main["roofGeometryMode"] == "gable_pitched_l_shape"
    assert len(main["footprintMm"]) == 6


def test_roof_bundle_falls_back_to_bbox_for_irregular_polygon() -> None:
    # Non-L 5-vertex pentagon — collinear-strip yields 5 verts, fails
    # the L predicate, so we bbox-rectify and keep the historical
    # gable_pitched_rectangle behaviour.
    pentagon = [
        [0, 0],
        [10000, 0],
        [12000, 4000],
        [10000, 8000],
        [0, 8000],
    ]
    ir = _ir_with_dg_chain(pentagon)
    bundle, _consumed = _DRV._roof_bundle(ir=ir, parent_revision=1, house="gamma")
    main = bundle["commands"][0]
    assert main["roofGeometryMode"] == "gable_pitched_rectangle"
    # Bbox rectified: exactly 4 corners covering the input bounds.
    assert len(main["footprintMm"]) == 4
    xs = [p["xMm"] for p in main["footprintMm"]]
    ys = [p["yMm"] for p in main["footprintMm"]]
    assert (min(xs), max(xs)) == (0, 12000)
    assert (min(ys), max(ys)) == (0, 8000)


def test_roof_bundle_preserves_clean_rectangle_passthrough() -> None:
    # 4-vertex axis-aligned rectangle (alpha / current gamma DG):
    # nothing to strip, nothing to rectify.
    rect = [[0, 0], [13990, 0], [13990, 6000], [0, 6000]]
    ir = _ir_with_dg_chain(rect)
    bundle, _consumed = _DRV._roof_bundle(ir=ir, parent_revision=1, house="alpha")
    main = bundle["commands"][0]
    assert main["roofGeometryMode"] == "gable_pitched_rectangle"
    assert len(main["footprintMm"]) == 4
