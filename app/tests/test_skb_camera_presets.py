"""Tests for SKB-16 camera presets."""

from __future__ import annotations

from bim_ai.skb.camera_presets import (
    CAMERA_PRESETS,
    known_preset_ids,
    preset_for_sketch_panel,
)


def test_known_preset_ids_sorted_and_complete() -> None:
    ids = known_preset_ids()
    assert ids
    assert ids == sorted(ids)
    assert "vp-main-iso" in ids
    assert "vp-front-elev" in ids


def test_each_preset_has_consistent_id() -> None:
    for k, p in CAMERA_PRESETS.items():
        assert p.id == k


def test_preset_for_sketch_panel_main_iso() -> None:
    assert preset_for_sketch_panel("Main Perspective from SSW").id == "vp-main-iso"
    assert preset_for_sketch_panel("ssw iso panel").id == "vp-main-iso"


def test_preset_for_sketch_panel_elevations() -> None:
    assert preset_for_sketch_panel("Front Elevation").id == "vp-front-elev"
    assert preset_for_sketch_panel("rear elevation").id == "vp-rear-elev"
    assert preset_for_sketch_panel("side elevation, east").id == "vp-side-elev-east"
    assert preset_for_sketch_panel("Side Elevation - West").id == "vp-side-elev-west"


def test_preset_for_sketch_panel_roof_plan() -> None:
    assert preset_for_sketch_panel("roof plan").id == "vp-roof-plan"
    assert preset_for_sketch_panel("Top-down roof view").id == "vp-roof-plan"


def test_preset_for_sketch_panel_unknown_returns_none() -> None:
    assert preset_for_sketch_panel("alien spaceship view") is None
    assert preset_for_sketch_panel("") is None


def test_distance_factors_are_positive() -> None:
    for p in CAMERA_PRESETS.values():
        assert p.distance_factor > 0
