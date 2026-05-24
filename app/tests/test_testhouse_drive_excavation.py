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


# ---------------------------------------------------------------------------
# MF-driver-13 (#63): flat-lot excavation top must sit at level-EG, NOT at
# the host toposolid's heightSamples surface. Without the explicit pin,
# a downstream renderer that nearest-samples the host terrain at the
# cutter centroid can lift the excavation top ~peak/2 above grade and
# occlude the EG cladding on the N/S/E faces (the over-burial bug that
# alpha/beta/gamma all showed after PR #50 landed).
# ---------------------------------------------------------------------------


def test_topology_bundle_flat_lot_pins_excavation_top_at_eg_elevation() -> None:
    """alpha is the canonical flat-lot fixture. Its KG excavation MUST
    carry an explicit ``topHeightSamples`` array whose z values equal
    ``level-EG.elevationMm`` (0) — not whatever the host toposolid's
    heightSamples happen to read at the cutter centroid. This is the
    data-authoritative fix for issue #63."""

    bundle, _ = _DRV._topology_bundle(
        ir=_ir_with_kg(), parent_revision=1, house="alpha"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    samples = excavation.get("topHeightSamples")
    assert samples, (
        "flat-lot excavation must pin topHeightSamples to level-EG.elevationMm "
        "so the top is authoritative regardless of how a renderer samples the "
        "host toposolid (issue #63 over-burial fix)."
    )
    assert all(s["zMm"] == 0.0 for s in samples), (
        "flat-lot topHeightSamples must all sit at level-EG.elevationMm (0). "
        "Any non-zero z here means the excavation top will lift above grade "
        "and occlude the EG cladding."
    )
    # The pinned samples must cover the cutter footprint so the renderer
    # can reconstruct the flat top everywhere over the cutter, not just
    # at one point.
    assert len(samples) >= 4, (
        "topHeightSamples must cover the cutter polygon corners so the "
        "flat-top reconstruction is unambiguous everywhere."
    )
    # Mode stays absent (engine default = flat); only the data carrier changes.
    assert "topSurfaceMode" not in excavation


def test_topology_bundle_flat_lot_pin_uses_nonzero_eg_elevation() -> None:
    """When the IR's level-EG sits at a non-zero elevation (e.g. a
    podium-style design with EG at +500), the flat-mode excavation top
    must track THAT elevation, not assume 0."""

    ir = _ir_with_kg()
    # Promote EG to +500 mm — KG correspondingly shifts but we keep its
    # depth assertion focused on the EG elevation pin.
    for lvl in ir["levels"]:
        if lvl["id"] == "level-EG":
            lvl["elevationMM"] = 500.0
    bundle, _ = _DRV._topology_bundle(
        ir=ir, parent_revision=1, house="alpha"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    samples = excavation.get("topHeightSamples") or []
    assert samples, "flat-mode excavation must carry topHeightSamples"
    assert all(s["zMm"] == 500.0 for s in samples), (
        "topHeightSamples z must equal level-EG.elevationMm; got "
        f"{[s['zMm'] for s in samples]}"
    )


def test_topology_bundle_hillside_keeps_follow_terrain_no_top_pin() -> None:
    """Guardrail: PR #50 hillside behavior is untouched — beta still
    emits topSurfaceMode=follow_terrain and does NOT pin topHeightSamples
    (the engine reads the host's heightSamples nearest the cutter to
    build the tilted top)."""

    ir = _ir_with_kg()
    ir["house"] = "beta"
    bundle, _ = _DRV._topology_bundle(
        ir=ir, parent_revision=1, house="beta"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    assert excavation.get("topSurfaceMode") == "follow_terrain", (
        "hillside houses must still flip on follow_terrain (PR #50 contract)."
    )
    # On the hillside the daylight side relies on the host's tilted
    # heightSamples; an explicit pin would re-flatten the top and
    # re-bury the daylight walls (regress #46).
    assert "topHeightSamples" not in excavation, (
        "hillside excavations must NOT pin topHeightSamples — that would "
        "regress PR #50 by re-flattening the top and re-burying the "
        "daylight basement walls."
    )


def test_topology_bundle_borderline_lot_uses_flat_path_and_pins_top() -> None:
    """A borderline lot with heightSamples std-dev JUST UNDER the
    HILLSIDE_HEIGHT_SAMPLE_STDDEV_MM threshold (e.g. gamma's ~244 mm)
    must take the flat path AND carry the topHeightSamples pin so the
    top face stays at grade. Confirms the threshold gates both halves
    of the fix consistently (no off-by-one between mode + pin)."""

    ir = _ir_with_kg()
    ir["house"] = "gamma"
    bundle, _ = _DRV._topology_bundle(
        ir=ir, parent_revision=1, house="gamma"
    )
    excavation = next(
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    )
    # Threshold gate: flat path -> no follow_terrain mode flip.
    assert "topSurfaceMode" not in excavation
    # Same gate: flat path -> explicit topHeightSamples pin.
    samples = excavation.get("topHeightSamples")
    assert samples, (
        "borderline-but-flat lot must also pin topHeightSamples so the "
        "renderer doesn't lift the excavation top via host heightSamples."
    )
    assert all(s["zMm"] == 0.0 for s in samples)
