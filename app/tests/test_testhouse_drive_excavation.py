"""MF-driver-8 (#37): driver wiring for ``toposolid_excavation`` around
below-grade levels.

When the IR declares a level with ``elevationMm < 0`` (typical Keller),
``_topology_bundle`` must emit a ``CreateToposolidExcavation`` command
alongside the toposolid so the KG walls + windows aren't rendered
hanging in open air below the topo surface. When every level sits at or
above grade, no excavation should be emitted.
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


def _ir_with_kg(elevation_mm: float = -2700) -> dict:
    """Minimal IR with a KG below grade + EG at grade."""

    return {
        "house": "alpha",
        "levels": [
            {
                "id": "level-KG",
                "name": "Kellergeschoss",
                "elevationMM": elevation_mm,
                "heightMM": 2700,
            },
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
            {"id": "level-DG", "name": "Dachgeschoss", "elevationMM": 2700, "heightMM": 2400},
        ],
        "extractedFacts": [
            {
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "factId": "fact-ext-eg",
                "polygonMm": [
                    [0.0, 0.0],
                    [10000.0, 0.0],
                    [10000.0, 8000.0],
                    [0.0, 8000.0],
                    [0.0, 0.0],
                ],
            }
        ],
    }


def _ir_only_at_or_above_grade() -> dict:
    """IR without any below-grade level — no excavation should be emitted."""

    return {
        "house": "alpha",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
            {"id": "level-DG", "name": "Dachgeschoss", "elevationMM": 2700, "heightMM": 2400},
        ],
        "extractedFacts": [
            {
                "kind": "exterior_wall_chain",
                "levelId": "level-EG",
                "factId": "fact-ext-eg",
                "polygonMm": [
                    [0.0, 0.0],
                    [10000.0, 0.0],
                    [10000.0, 8000.0],
                    [0.0, 8000.0],
                    [0.0, 0.0],
                ],
            }
        ],
    }


def test_topology_bundle_emits_excavation_for_below_grade_level() -> None:
    bundle, consumed = _DRV._topology_bundle(
        ir=_ir_with_kg(), parent_revision=1, house="alpha"
    )
    commands = bundle["commands"]
    types = [c["type"] for c in commands]
    assert types[0] == "CreateToposolid", "Toposolid must be authored first"
    assert "CreateToposolidExcavation" in types, (
        "_topology_bundle must emit a CreateToposolidExcavation for level-KG (elevationMm<0)"
    )

    # The excavation needs a cutter floor that exists in the same bundle
    # (the engine resolves cutter_element_id at dispatch time and rejects
    # forward references).
    assert "createFloor" in types, (
        "_topology_bundle must author a cutter floor that the excavation cmd references"
    )
    excavation_cmds = [c for c in commands if c["type"] == "CreateToposolidExcavation"]
    cutter_floor_cmds = [c for c in commands if c["type"] == "createFloor"]
    assert len(excavation_cmds) == 1
    assert len(cutter_floor_cmds) == 1
    assert cutter_floor_cmds[0]["id"] == excavation_cmds[0]["cutterElementId"]
    assert cutter_floor_cmds[0]["levelId"] == "th-alpha-level-KG"
    assert excavation_cmds[0]["hostToposolidId"] == "th-alpha-toposolid"

    # Depth = abs(elevationMm) + 500
    assert excavation_cmds[0]["cutMode"] == "custom_depth"
    assert excavation_cmds[0]["customDepthMm"] == 2700 + 500

    # The cutter floor must extend at least the building extent + 500 mm
    # collar so the excavation envelopes the basement walls.
    boundary_xs = [pt["xMm"] for pt in cutter_floor_cmds[0]["boundaryMm"]]
    boundary_ys = [pt["yMm"] for pt in cutter_floor_cmds[0]["boundaryMm"]]
    assert min(boundary_xs) <= -500.0 + 1e-6
    assert max(boundary_xs) >= 10000.0 + 500.0 - 1e-6
    assert min(boundary_ys) <= -500.0 + 1e-6
    assert max(boundary_ys) >= 8000.0 + 500.0 - 1e-6

    # The consumed-facts list still names the exterior wall chain fact.
    assert "fact-ext-eg" in consumed


def test_topology_bundle_emits_no_excavation_when_all_levels_at_or_above_grade() -> None:
    bundle, _ = _DRV._topology_bundle(
        ir=_ir_only_at_or_above_grade(), parent_revision=1, house="alpha"
    )
    types = [c["type"] for c in bundle["commands"]]
    assert "CreateToposolidExcavation" not in types
    # No synthetic cutter floor either when there's nothing to excavate.
    assert "createFloor" not in types


def test_topology_bundle_excavation_depth_scales_with_elevation() -> None:
    bundle, _ = _DRV._topology_bundle(
        ir=_ir_with_kg(elevation_mm=-4000), parent_revision=1, house="alpha"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    assert excavation["customDepthMm"] == 4000 + 500


# ---------------------------------------------------------------------------
# MF-driver-10 (#46): hillside-aware excavation (topSurfaceMode dispatch).
# ---------------------------------------------------------------------------


def test_topology_bundle_flat_lot_keeps_uniform_depth_excavation() -> None:
    """alpha is a flat-lot fixture — its heightSamples have negligible
    variance. The driver must keep the uniform-depth (no topSurfaceMode)
    cut from #37 so the basement walls aren't left hanging in open air
    on a flat site."""

    bundle, _ = _DRV._topology_bundle(
        ir=_ir_with_kg(), parent_revision=1, house="alpha"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    assert "topSurfaceMode" not in excavation, (
        "flat-lot houses must keep the original uniform-depth excavation "
        "from #37 — emitting follow_terrain on a flat lot would re-expose "
        "the basement walls below the topo surface."
    )


def test_topology_bundle_hillside_house_emits_follow_terrain_excavation() -> None:
    """beta is the hillside fixture (3.8 m E-W drop). After #46 the
    driver must emit ``topSurfaceMode: follow_terrain`` so the daylight
    basement walls on the low-terrain side remain exposed instead of
    being buried by the uniform cut from #37."""

    ir = _ir_with_kg()
    ir["house"] = "beta"
    bundle, _ = _DRV._topology_bundle(
        ir=ir, parent_revision=1, house="beta"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    assert excavation.get("topSurfaceMode") == "follow_terrain", (
        "hillside houses (heightSamples std-dev > "
        f"{_DRV.HILLSIDE_HEIGHT_SAMPLE_STDDEV_MM} mm) must emit "
        "topSurfaceMode=follow_terrain so the daylight basement walls "
        "remain visible."
    )
    # Depth + cutMode preserved — the change is purely the top face mode.
    assert excavation["cutMode"] == "custom_depth"
    assert excavation["customDepthMm"] == 2700 + 500


def test_topology_bundle_records_hillside_threshold_constant() -> None:
    """The std-dev threshold is module-level + tunable, per issue #46."""

    threshold = _DRV.HILLSIDE_HEIGHT_SAMPLE_STDDEV_MM
    assert isinstance(threshold, (int, float))
    # Per the issue guardrail: defensible value in the 500-1000 mm range.
    assert 500.0 <= float(threshold) <= 1000.0


def test_topology_bundle_below_threshold_falls_back_to_flat() -> None:
    """gamma's slope (1 m, ~peak/2 amplitude => std-dev well under
    500 mm) sits below the hillside threshold, so it keeps the flat
    excavation."""

    ir = _ir_with_kg()
    ir["house"] = "gamma"
    bundle, _ = _DRV._topology_bundle(
        ir=ir, parent_revision=1, house="gamma"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    # gamma's slope spec is modest enough that std-dev is under the
    # 500 mm threshold — keep flat behavior.
    assert "topSurfaceMode" not in excavation
