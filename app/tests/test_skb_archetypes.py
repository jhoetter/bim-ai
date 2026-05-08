"""Tests for SKB-09 architectural archetype library."""

from __future__ import annotations

from typing import Any

import pytest

from bim_ai.skb.archetypes import (
    ARCHETYPES,
    ArchetypeParams,
    bundle_for,
    known_archetype_ids,
)
from bim_ai.skb.element_count_priors import out_of_range_kinds
from bim_ai.skb.phases import SKB_PHASES, from_dict_list

# ── helpers shared across archetype tests ──────────────────────────────


def _kind_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    """Bundle commands → kind-count dict matching the priors-module keys.

    The ``wall`` count is the total number of walls (perimeter +
    partition), matching the priors table's combined wall ranges. The
    ``partition`` count is the subset of walls whose id begins with
    ``ptn-`` — the SKB-09 archetype builders' convention for marking
    interior room-separation walls.
    """
    counts: dict[str, int] = {
        "level": 0, "wall": 0, "partition": 0, "floor": 0, "roof": 0,
        "door": 0, "window": 0, "room": 0, "stair": 0,
    }
    type_to_kind = {
        "createLevel": "level",
        "createFloor": "floor",
        "createRoof": "roof",
        "insertDoorOnWall": "door",
        "insertWindowOnWall": "window",
        "createRoomOutline": "room",
        "createStair": "stair",
    }
    for row in rows:
        cmd = row["command"]
        ctype = cmd["type"]
        if ctype == "createWall":
            counts["wall"] += 1
            if cmd.get("id", "").startswith("ptn-"):
                counts["partition"] += 1
        elif ctype in type_to_kind:
            counts[type_to_kind[ctype]] += 1
    return counts


# ── registry / metadata sanity ─────────────────────────────────────────


def test_known_archetype_ids_sorted_nonempty() -> None:
    ids = known_archetype_ids()
    assert ids == sorted(ids)
    assert ids
    assert "single_family_two_story_modest" in ids
    assert "l_shape_bungalow" in ids
    assert "cabin_a_frame" in ids
    assert "townhouse_three_story" in ids


def test_unknown_archetype_raises() -> None:
    with pytest.raises(ValueError):
        bundle_for("alien_house_v999")


def test_archetype_metadata_complete() -> None:
    for arch in ARCHETYPES.values():
        assert arch.archetype_id
        assert arch.name
        assert arch.description
        assert arch.default_style_id
        assert callable(arch.builder)
        # default_params must carry positive footprint dimensions
        assert arch.default_params.width_mm > 0
        assert arch.default_params.depth_mm > 0
        assert arch.default_params.floor_height_mm > 0


# ── single_family_two_story_modest (extended) ──────────────────────────


def test_two_story_bundle_parses_as_phased() -> None:
    rows = bundle_for("single_family_two_story_modest")
    bundle = from_dict_list(rows)
    assert bundle.size == len(rows)


def test_two_story_bundle_uses_known_phases() -> None:
    rows = bundle_for("single_family_two_story_modest")
    phases_used = {row["phase"] for row in rows}
    for p in phases_used:
        assert p in SKB_PHASES


def test_two_story_bundle_emits_expected_kinds() -> None:
    rows = bundle_for("single_family_two_story_modest")
    type_counts: dict[str, int] = {}
    for row in rows:
        t = row["command"]["type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    assert type_counts["createLevel"] == 2
    # 8 perimeter + 6 partitions = 14 walls
    assert type_counts["createWall"] == 14
    assert type_counts["createFloor"] == 2
    assert type_counts["createRoof"] == 1
    assert type_counts["insertDoorOnWall"] == 1
    assert type_counts["insertWindowOnWall"] == 8
    assert type_counts["createStair"] == 1
    assert type_counts["createRoomOutline"] == 6
    assert type_counts["saveViewpoint"] == 3


def test_two_story_bundle_essential_kinds_in_range() -> None:
    """The extended modest archetype now ships interior partitions and a
    stair, so wall and room counts are inside their priors."""
    rows = bundle_for("single_family_two_story_modest")
    counts = _kind_counts(rows)
    out = out_of_range_kinds("single_family_two_story_modest", counts)
    flagged = [k for k, _, _ in out if k in counts]
    assert flagged == [], f"unexpected out-of-range kinds: {flagged}"


def test_two_story_bundle_uses_default_dimensions() -> None:
    rows = bundle_for("single_family_two_story_modest")
    walls = [r["command"] for r in rows if r["command"]["type"] == "createWall"]
    south = next(w for w in walls if w["id"] == "w-gf-s")
    assert south["start"] == {"xMm": 0, "yMm": 0}
    assert south["end"] == {"xMm": 7000, "yMm": 0}


def test_two_story_bundle_respects_param_overrides() -> None:
    rows = bundle_for(
        "single_family_two_story_modest",
        ArchetypeParams(width_mm=10000, depth_mm=12000, floor_height_mm=3500),
    )
    walls = [r["command"] for r in rows if r["command"]["type"] == "createWall"]
    south = next(w for w in walls if w["id"] == "w-gf-s")
    assert south["end"] == {"xMm": 10000, "yMm": 0}
    assert south["heightMm"] == 3500


# ── new archetypes: parses + phases + counts in priors ─────────────────


@pytest.mark.parametrize("archetype_id", [
    "l_shape_bungalow",
    "cabin_a_frame",
    "townhouse_three_story",
])
def test_archetype_bundle_parses_as_phased(archetype_id: str) -> None:
    rows = bundle_for(archetype_id)
    bundle = from_dict_list(rows)
    assert bundle.size == len(rows)


@pytest.mark.parametrize("archetype_id", [
    "l_shape_bungalow",
    "cabin_a_frame",
    "townhouse_three_story",
])
def test_archetype_bundle_uses_known_phases(archetype_id: str) -> None:
    rows = bundle_for(archetype_id)
    phases_used = {row["phase"] for row in rows}
    for p in phases_used:
        assert p in SKB_PHASES


@pytest.mark.parametrize("archetype_id", [
    "single_family_two_story_modest",
    "l_shape_bungalow",
    "cabin_a_frame",
    "townhouse_three_story",
])
def test_archetype_bundle_kind_counts_in_priors(archetype_id: str) -> None:
    rows = bundle_for(archetype_id)
    counts = _kind_counts(rows)
    out = out_of_range_kinds(archetype_id, counts)
    flagged = [(k, n, (r.lo, r.hi)) for k, n, r in out]
    assert flagged == [], f"{archetype_id}: out-of-range kinds: {flagged}"


@pytest.mark.parametrize("archetype_id", [
    "single_family_two_story_modest",
    "l_shape_bungalow",
    "cabin_a_frame",
    "townhouse_three_story",
])
def test_archetype_bundle_emits_at_least_one_viewpoint(archetype_id: str) -> None:
    rows = bundle_for(archetype_id)
    vps = [r for r in rows if r["command"]["type"] == "saveViewpoint"]
    assert len(vps) >= 1
    # iso preset should be present (sketches always have a main perspective panel)
    iso = [vp for vp in vps if vp["command"]["id"] == "vp-main-iso"]
    assert iso, f"{archetype_id}: missing vp-main-iso viewpoint"


# ── per-archetype dimension overrides ──────────────────────────────────


def test_l_shape_bungalow_respects_dimension_overrides() -> None:
    rows = bundle_for(
        "l_shape_bungalow",
        ArchetypeParams(
            width_mm=12000, depth_mm=12000,
            floor_height_mm=3300, storey_count=1,
        ),
    )
    walls = [r["command"] for r in rows if r["command"]["type"] == "createWall"]
    south = next(w for w in walls if w["id"] == "w-perim-0")
    assert south["start"] == {"xMm": 0, "yMm": 0}
    assert south["end"] == {"xMm": 12000, "yMm": 0}
    assert south["heightMm"] == 3300


def test_cabin_a_frame_respects_dimension_overrides() -> None:
    rows = bundle_for(
        "cabin_a_frame",
        ArchetypeParams(
            width_mm=8000, depth_mm=10000,
            floor_height_mm=3300, storey_count=2,
        ),
    )
    walls = [r["command"] for r in rows if r["command"]["type"] == "createWall"]
    south = next(w for w in walls if w["id"] == "w-gf-s")
    assert south["end"] == {"xMm": 8000, "yMm": 0}
    assert south["heightMm"] == 3300
    # mezz level elevation tracks the floor-height override (~2/3 of h).
    levels = [r["command"] for r in rows if r["command"]["type"] == "createLevel"]
    mezz = next(lvl for lvl in levels if lvl["id"] == "lvl-mezz")
    assert abs(mezz["elevationMm"] - 3300 * 2.0 / 3.0) < 1e-6


def test_townhouse_three_story_respects_dimension_overrides() -> None:
    rows = bundle_for(
        "townhouse_three_story",
        ArchetypeParams(
            width_mm=6000, depth_mm=14000,
            floor_height_mm=3300, storey_count=3,
        ),
    )
    walls = [r["command"] for r in rows if r["command"]["type"] == "createWall"]
    south = next(w for w in walls if w["id"] == "w-l0-s")
    assert south["end"] == {"xMm": 6000, "yMm": 0}
    assert south["heightMm"] == 3300


# ── townhouse-specific: party walls pinned ─────────────────────────────


def test_townhouse_party_walls_are_pinned() -> None:
    rows = bundle_for("townhouse_three_story")
    pin_targets = {
        r["command"]["elementId"]
        for r in rows
        if r["command"]["type"] == "pinElement"
    }
    # east + west walls on every level must be pinned
    expected = {
        f"w-{lvl}-{side}"
        for lvl in ("l0", "l1", "l2")
        for side in ("e", "w")
    }
    assert expected <= pin_targets, (
        f"missing party-wall pins: {expected - pin_targets}"
    )


# ── cabin-specific: mezzanine LevelElem hookup ─────────────────────────


def test_cabin_mezzanine_level_declared_as_child() -> None:
    rows = bundle_for("cabin_a_frame")
    levels = [r["command"] for r in rows if r["command"]["type"] == "createLevel"]
    mezz = next(lvl for lvl in levels if lvl["id"] == "lvl-mezz")
    assert mezz.get("parentLevelId") == "lvl-ground"
    assert mezz["elevationMm"] > 0


# ── default-params vs library defaults ─────────────────────────────────


def test_default_params_match_archetype_defaults() -> None:
    """``bundle_for`` with no ``params`` uses the per-archetype defaults,
    not the bare ``ArchetypeParams()`` library defaults."""
    rows = bundle_for("townhouse_three_story")
    walls = [r["command"] for r in rows if r["command"]["type"] == "createWall"]
    south = next(w for w in walls if w["id"] == "w-l0-s")
    # townhouse default footprint is 5m × 12m, not the library 7m × 8m
    assert south["end"] == {"xMm": 5000, "yMm": 0}
