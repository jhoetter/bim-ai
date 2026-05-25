"""MF-driver-26 (#116): plumb the IR's ``site_topo`` fact through into
the ``CreateToposolid`` command.

Before this fix, ``_topology_bundle`` only read the IR's
``exterior_wall_chain`` fact and re-synthesised any slope from a
hard-coded per-house ``slope_specs`` table. Houses whose IR carried a
real ``site_topo`` fact with explicit ``heightSamples`` +
``footprintMargin`` (e.g. h22 with a 5.4 m N-S hillside drop) silently
lost the slope and rendered as flat slabs.

These tests pin the new behaviour:

* When the IR carries a ``site_topo`` fact with ``heightSamples``, the
  driver passes those samples through to ``CreateToposolid`` verbatim
  (normalised to the engine's ``xMm``/``yMm``/``zMm`` alias).
* When the fact also carries ``footprintMargin``, the toposolid boundary
  expands by that margin around the building footprint.
* The fact's ``factId`` is recorded as consumed so the assumption ledger
  reflects the IR provenance.
* When the IR has no ``site_topo`` fact, the legacy per-house slope
  synthesis stays in effect (preserves the alpha/beta/gamma fixtures).
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


# Hillside samples lifted from the issue body — h22 IR site_topo fact.
_H22_HEIGHT_SAMPLES = [
    {"x": 4305, "y": -6000, "z": 2700},
    {"x": 4305, "y": 0, "z": 1400},
    {"x": 4305, "y": 8920, "z": -1400},
    {"x": 4305, "y": 14920, "z": -2700},
    {"x": -6000, "y": 4460, "z": 0},
    {"x": 14610, "y": 4460, "z": 0},
]


def _ir_with_site_topo(
    *,
    height_samples: list[dict] | None = None,
    footprint_margin: float | None = 6000.0,
    include_kg: bool = False,
) -> dict:
    """Build a minimal IR whose ``extractedFacts`` carry a ``site_topo``
    fact alongside the mandatory ``exterior_wall_chain``."""

    facts: list[dict] = [
        {
            "kind": "exterior_wall_chain",
            "levelId": "level-EG",
            "factId": "fact-ext-eg",
            "polygonMm": [
                [0.0, 0.0],
                [8610.0, 0.0],
                [8610.0, 8920.0],
                [0.0, 8920.0],
                [0.0, 0.0],
            ],
        },
    ]
    site_topo: dict = {
        "kind": "site_topo",
        "factId": "fact-site-topo",
        "hillside": True,
        "downhillDirection": "S",
    }
    if height_samples is not None:
        site_topo["heightSamples"] = height_samples
    if footprint_margin is not None:
        site_topo["footprintMargin"] = footprint_margin
    facts.append(site_topo)

    levels: list[dict] = [
        {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
        {"id": "level-DG", "name": "Dachgeschoss", "elevationMM": 2700, "heightMM": 2400},
    ]
    if include_kg:
        levels.insert(
            0,
            {
                "id": "level-KG",
                "name": "Kellergeschoss",
                "elevationMM": -2700,
                "heightMM": 2700,
            },
        )

    return {
        "house": "h22",
        "levels": levels,
        "extractedFacts": facts,
    }


def _create_toposolid_cmd(commands: list[dict]) -> dict:
    create = next((c for c in commands if c["type"] == "CreateToposolid"), None)
    assert create is not None, "CreateToposolid must be present in the bundle"
    return create


# ---------------------------------------------------------------------------
# Core plumbing — site_topo.heightSamples reach createToposolid
# ---------------------------------------------------------------------------


def test_topology_bundle_passes_site_topo_height_samples_through() -> None:
    """The h22 IR's heightSamples must land on the CreateToposolid
    command verbatim (just normalised to the engine's xMm/yMm/zMm
    alias). This is the core regression guard for #116 — without it,
    the hillside slope is silently dropped and the toposolid renders
    flat.
    """

    ir = _ir_with_site_topo(height_samples=_H22_HEIGHT_SAMPLES)
    bundle, _ = _DRV._topology_bundle(ir=ir, parent_revision=1, house="h22")
    create = _create_toposolid_cmd(bundle["commands"])

    samples = create.get("heightSamples")
    assert samples, (
        "CreateToposolid must include heightSamples when the IR's site_topo "
        "fact provides them — issue #116 (toposolid drops IR heightSamples)."
    )
    assert len(samples) == len(_H22_HEIGHT_SAMPLES), (
        f"all {len(_H22_HEIGHT_SAMPLES)} IR samples must reach the command; "
        f"got {len(samples)}."
    )
    # Each sample uses the engine's xMm/yMm/zMm alias + matches the IR z exactly.
    expected_zs = sorted(float(s["z"]) for s in _H22_HEIGHT_SAMPLES)
    actual_zs = sorted(float(s["zMm"]) for s in samples)
    assert actual_zs == expected_zs, (
        "z values must round-trip the IR's heightSamples; got "
        f"{actual_zs} vs expected {expected_zs}."
    )
    for sample in samples:
        assert set(sample.keys()) >= {"xMm", "yMm", "zMm"}, (
            "every sample must carry the engine's xMm/yMm/zMm alias keys."
        )


def test_topology_bundle_accepts_height_samples_in_engine_alias() -> None:
    """An IR that already authors samples in the engine's xMm/yMm/zMm
    alias (rather than raw x/y/z) must be passed through unchanged."""

    alias_samples = [
        {"xMm": 0.0, "yMm": 0.0, "zMm": 1500.0},
        {"xMm": 8000.0, "yMm": 0.0, "zMm": -1500.0},
        {"xMm": 8000.0, "yMm": 8000.0, "zMm": -1500.0},
        {"xMm": 0.0, "yMm": 8000.0, "zMm": 1500.0},
    ]
    ir = _ir_with_site_topo(height_samples=alias_samples)
    bundle, _ = _DRV._topology_bundle(ir=ir, parent_revision=1, house="h22")
    create = _create_toposolid_cmd(bundle["commands"])
    samples = create.get("heightSamples") or []
    assert {(s["xMm"], s["yMm"], s["zMm"]) for s in samples} == {
        (s["xMm"], s["yMm"], s["zMm"]) for s in alias_samples
    }


def test_topology_bundle_consumes_site_topo_fact_id() -> None:
    """When the IR carries a ``site_topo`` fact, its factId must appear
    in the consumed-facts list returned by ``_topology_bundle`` so the
    assumption ledger reflects the IR provenance."""

    ir = _ir_with_site_topo(height_samples=_H22_HEIGHT_SAMPLES)
    _, consumed = _DRV._topology_bundle(ir=ir, parent_revision=1, house="h22")
    assert "fact-site-topo" in consumed
    # The exterior wall chain fact stays consumed (it's the boundary source).
    assert "fact-ext-eg" in consumed


# ---------------------------------------------------------------------------
# footprintMargin (mm) override
# ---------------------------------------------------------------------------


def test_topology_bundle_uses_site_topo_footprint_margin() -> None:
    """The IR's ``footprintMargin`` (mm) expands the building footprint
    when sizing the toposolid boundary. The h22 fact carries 6000 mm,
    not the legacy 5000 mm default."""

    ir = _ir_with_site_topo(
        height_samples=_H22_HEIGHT_SAMPLES, footprint_margin=6000.0
    )
    bundle, _ = _DRV._topology_bundle(ir=ir, parent_revision=1, house="h22")
    create = _create_toposolid_cmd(bundle["commands"])
    boundary = create["boundaryMm"]
    xs = [pt["xMm"] for pt in boundary]
    ys = [pt["yMm"] for pt in boundary]
    # IR building footprint is 8610x8920 mm anchored at origin; the
    # boundary must expand by exactly 6000 mm on every side.
    assert min(xs) == -6000.0
    assert max(xs) == 8610.0 + 6000.0
    assert min(ys) == -6000.0
    assert max(ys) == 8920.0 + 6000.0


def test_topology_bundle_falls_back_to_default_margin_without_site_topo() -> None:
    """When no ``site_topo`` fact is present, the legacy 5 m parcel band
    around the building footprint is preserved (no regression for the
    alpha/beta/gamma fixtures)."""

    ir = {
        "house": "alpha",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
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
    bundle, _ = _DRV._topology_bundle(ir=ir, parent_revision=1, house="alpha")
    create = _create_toposolid_cmd(bundle["commands"])
    boundary = create["boundaryMm"]
    xs = [pt["xMm"] for pt in boundary]
    ys = [pt["yMm"] for pt in boundary]
    # Legacy 5 m margin preserved.
    assert min(xs) == -5000.0
    assert max(xs) == 15000.0
    assert min(ys) == -5000.0
    assert max(ys) == 13000.0


# ---------------------------------------------------------------------------
# Hillside excavation interaction — the IR samples drive the hillside
# detection so an h22-style IR opts in to follow_terrain even though the
# house name is not one of the hard-coded alpha/beta/gamma fixtures.
# ---------------------------------------------------------------------------


def test_topology_bundle_site_topo_samples_drive_hillside_excavation() -> None:
    """The hillside-detection branch in ``_topology_bundle`` reads the
    authored heightSamples' std-dev. With h22's IR samples spanning
    ±2.7 m, std-dev is well over the threshold so the KG excavation
    must flip on ``topSurfaceMode=follow_terrain`` regardless of the
    house's slope_specs entry (h22 isn't in the legacy table)."""

    ir = _ir_with_site_topo(
        height_samples=_H22_HEIGHT_SAMPLES, include_kg=True
    )
    bundle, _ = _DRV._topology_bundle(ir=ir, parent_revision=1, house="h22")
    excavations = [
        c for c in bundle["commands"] if c["type"] == "CreateToposolidExcavation"
    ]
    assert excavations, (
        "below-grade levels must still emit a CreateToposolidExcavation."
    )
    assert excavations[0].get("topSurfaceMode") == "follow_terrain", (
        "an IR with hillside-scale heightSamples must trigger the "
        "follow_terrain excavation path so the daylight basement walls "
        "stay visible."
    )


def test_topology_bundle_legacy_slope_specs_preserved_without_site_topo() -> None:
    """The alpha/beta/gamma slope_specs fallback stays in effect when
    the IR carries no ``site_topo`` fact — guards against accidentally
    breaking the fixture houses that pre-date this fix."""

    ir = {
        "house": "beta",
        "levels": [
            {"id": "level-EG", "name": "Erdgeschoss", "elevationMM": 0, "heightMM": 2700},
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
    bundle, _ = _DRV._topology_bundle(ir=ir, parent_revision=1, house="beta")
    create = _create_toposolid_cmd(bundle["commands"])
    samples = create.get("heightSamples") or []
    # beta's hardcoded peak is 3800 mm; the fallback must still author
    # a non-empty hillside heightSamples set so the legacy fixture
    # renders identically.
    assert samples, (
        "without site_topo, the legacy per-house slope synthesis must still "
        "fire so beta's hillside isn't silently flattened."
    )
    zs = [float(s["zMm"]) for s in samples]
    assert max(zs) - min(zs) >= 3500.0, (
        "beta's legacy slope_specs peak (3800 mm) must remain in effect."
    )
