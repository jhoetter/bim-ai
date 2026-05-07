"""Tests for SKB-09 architectural archetype library (load-bearing slice)."""

from __future__ import annotations

import pytest

from bim_ai.skb.archetypes import (
    ARCHETYPES,
    ArchetypeParams,
    bundle_for,
    known_archetype_ids,
)
from bim_ai.skb.element_count_priors import out_of_range_kinds
from bim_ai.skb.phases import SKB_PHASES, from_dict_list


def test_known_archetype_ids_sorted_nonempty() -> None:
    ids = known_archetype_ids()
    assert ids == sorted(ids)
    assert ids
    assert "single_family_two_story_modest" in ids


def test_unknown_archetype_raises() -> None:
    with pytest.raises(ValueError):
        bundle_for("alien_house_v999")


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
    assert type_counts["createWall"] == 8       # 4 per floor × 2
    assert type_counts["createFloor"] == 2
    assert type_counts["createRoof"] == 1
    assert type_counts["insertDoorOnWall"] == 1
    assert type_counts["insertWindowOnWall"] == 4
    assert type_counts["createRoomOutline"] == 2
    assert type_counts["saveViewpoint"] == 1


def test_two_story_bundle_essential_kinds_in_range() -> None:
    """Sanity-check element kinds the load-bearing slice IS expected to
    cover (level / floor / roof / door / window). Walls and rooms are
    deliberately under the prior range here because the load-bearing
    archetype has no interior partitions yet — adding partitions is a
    subsequent archetype iteration."""
    rows = bundle_for("single_family_two_story_modest")
    kind_counts = {
        "level": sum(1 for r in rows if r["command"]["type"] == "createLevel"),
        "floor": sum(1 for r in rows if r["command"]["type"] == "createFloor"),
        "roof": sum(1 for r in rows if r["command"]["type"] == "createRoof"),
        "door": sum(1 for r in rows if r["command"]["type"] == "insertDoorOnWall"),
        "window": sum(1 for r in rows if r["command"]["type"] == "insertWindowOnWall"),
    }
    out = out_of_range_kinds("single_family_two_story_modest", kind_counts)
    # Filter to only the kinds we deliberately test (others are expected
    # to drift while the load-bearing slice grows).
    flagged = [k for k, _, _ in out if k in kind_counts]
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


def test_archetype_metadata_complete() -> None:
    for arch in ARCHETYPES.values():
        assert arch.archetype_id
        assert arch.name
        assert arch.description
        assert arch.default_style_id
        assert callable(arch.builder)
