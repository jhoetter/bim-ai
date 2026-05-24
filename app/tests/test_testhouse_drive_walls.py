"""MF-driver-11 (#48): exterior-wall + slab authoring follows the L-shape
footprint, not the rectangular bbox.

Pre-fix, ``_exterior_walls_bundle`` iterated the IR's
``exterior_wall_chain`` polygon as-is. That handled clean 4-vert
rectangles and clean 6-vert L-shapes correctly, but did NOT mirror the
collinear-midpoint cleanup that ``_roof_bundle`` (PR #41 / #31) applies
before its shape predicate runs. The net effect was that reader IRs
which emit an extra collinear vertex per facade (e.g. gamma's carport
offset) produced a roof routed through ``gable_pitched_l_shape`` while
the walls + slab underneath authored one redundant zero-turn segment
per facade — the rendered massing diverges from the roof footprint.

Tests below pin three things without going near MCP / snapshots:

1. A clean 6-vertex L-shape chain still authors exactly 6 walls + a
   6-vertex slab boundary (no regression vs the pre-fix behaviour).
2. A 7-vertex L-shape chain (one collinear midpoint per facade — the
   gamma carport pattern) cleans to 6 walls + a 6-vertex slab boundary
   so the skeleton matches the roof footprint authored by
   ``_roof_bundle``.
3. A 4-vertex rectangle (alpha / testhouse-1 baseline) still authors
   exactly 4 walls + a 4-vertex slab boundary.
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


def _ir_with_eg_chain(poly: list[list[float]]) -> dict:
    """Minimal IR with a single EG ``exterior_wall_chain`` fact. The
    bundle only inspects the level + chain — everything else can stay
    empty for these tests."""

    return {
        "house": "testh",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
        ],
        "extractedFacts": [
            {
                "factId": "fact-eg-chain",
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "polygonMm": poly,
            },
        ],
    }


def _walls_and_slab(bundle: dict) -> tuple[list[dict], dict]:
    cmds = bundle["commands"]
    walls = [c for c in cmds if c.get("type") == "createWall"]
    floors = [c for c in cmds if c.get("type") == "createFloor"]
    assert len(floors) == 1, f"expected exactly 1 createFloor, got {len(floors)}"
    return walls, floors[0]


# ---------- 6-vertex L-shape (house-23 EG with carport offset) --------------


def test_exterior_walls_bundle_authors_6_walls_for_clean_l_shape() -> None:
    # 6-vertex L-shape with the reflex corner at (7990, -2300) — the
    # carport "step" in house-23's EG exterior_wall_chain. The polygon
    # is already clean (no collinear midpoints).
    l_shape = [
        [0, 0],
        [7990, 0],
        [7990, -2300],
        [13990, -2300],
        [13990, 6910],
        [0, 6910],
    ]
    ir = _ir_with_eg_chain(l_shape)
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="testh", level_short="EG"
    )
    assert pair is not None
    walls, slab = _walls_and_slab(pair[0])
    assert len(walls) == 6, f"expected 6 walls for 6-vertex L, got {len(walls)}"
    # Slab boundary follows the L-shape polygon — not a 4-vert bbox.
    assert len(slab["boundaryMm"]) == 6
    # Pin the actual L-shape extents: the carport step at y=-2300 must
    # appear in the slab boundary (proving we didn't bbox to y∈[0,6910]).
    ys = [v["yMm"] for v in slab["boundaryMm"]]
    assert min(ys) == -2300, "slab boundary lost the carport step"
    assert max(ys) == 6910


# ---------- 7-vertex L-shape with one collinear midpoint --------------------


def test_exterior_walls_bundle_strips_collinear_midpoint_on_l_shape() -> None:
    # 7-vertex L-shape where the reader inserted a midpoint at (13990, 0)
    # collinear with the segment (0,0)→(17700,0). Mirrors the gamma EG
    # carport pattern that PR #41 added ``_strip_collinear_vertices`` to
    # handle for the roof; the wall bundle must apply the same cleanup
    # so the skeleton matches the roof footprint.
    poly = [
        [0, 0],
        [13990, 0],
        [17700, 0],
        [17700, 3700],
        [13990, 3700],
        [13990, 6000],
        [0, 6000],
    ]
    ir = _ir_with_eg_chain(poly)
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="testh", level_short="EG"
    )
    assert pair is not None
    walls, slab = _walls_and_slab(pair[0])
    # After the collinear-midpoint strip the polygon is a clean 6-vert
    # L — exactly 6 walls (no redundant zero-turn segment along the
    # bottom edge) and a 6-vert slab boundary.
    assert len(walls) == 6, f"expected 6 walls after collinear strip, got {len(walls)}"
    assert len(slab["boundaryMm"]) == 6
    # The collinear (13990, 0) midpoint must NOT appear as a wall
    # endpoint along the bottom edge — the bottom edge is a single
    # (0,0)→(17700,0) segment after the strip.
    bottom_xs = sorted(
        {
            w["start"]["xMm"]
            for w in walls
            if w["start"]["yMm"] == 0 and w["end"]["yMm"] == 0
        }
        | {
            w["end"]["xMm"]
            for w in walls
            if w["start"]["yMm"] == 0 and w["end"]["yMm"] == 0
        }
    )
    assert bottom_xs == [0, 17700], (
        f"bottom edge should be one (0,0)→(17700,0) wall after strip; got xs={bottom_xs}"
    )


# ---------- 4-vertex rectangle (alpha / testhouse-1 baseline) ---------------


def test_exterior_walls_bundle_preserves_clean_rectangle_passthrough() -> None:
    # 4-vertex axis-aligned rectangle — alpha's EG chain. The strip must
    # be a no-op so we still get exactly 4 walls + a 4-vert slab.
    rect = [[0, 0], [9900, 0], [9900, 8150], [0, 8150]]
    ir = _ir_with_eg_chain(rect)
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="alpha", level_short="EG"
    )
    assert pair is not None
    walls, slab = _walls_and_slab(pair[0])
    assert len(walls) == 4, f"rectangular polygon must keep 4 walls, got {len(walls)}"
    assert len(slab["boundaryMm"]) == 4


# ---------- 8-vertex U / multi-step polygon (gamma EG U-shape) --------------


def test_exterior_walls_bundle_preserves_8_vertex_multi_step_polygon() -> None:
    # 8-vert U-shape — the strip drops no vertices because every turn
    # is non-collinear, so every edge still becomes its own wall.
    u_shape = [
        [0, 0],
        [13990, 0],
        [13990, 6910],
        [9500, 6910],
        [9500, 7910],
        [4500, 7910],
        [4500, 6910],
        [0, 6910],
    ]
    ir = _ir_with_eg_chain(u_shape)
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="gamma", level_short="EG"
    )
    assert pair is not None
    walls, slab = _walls_and_slab(pair[0])
    assert len(walls) == 8, f"8-vert U-shape must author 8 walls, got {len(walls)}"
    assert len(slab["boundaryMm"]) == 8
