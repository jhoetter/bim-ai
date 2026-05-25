"""MAT-01 — kernel-side material catalog tests."""

from __future__ import annotations

import pytest

from bim_ai.material_catalog import (
    is_standing_seam_metal_key,
    list_materials,
    material_base_color,
    material_display_name,
    resolve_material,
)

REQUIRED_KEYS = (
    # Cladding
    "timber_cladding",
    "white_cladding",
    "cladding_beige_grey",
    "cladding_warm_wood",
    "cladding_dark_grey",
    # Render
    "white_render",
    "render_light_grey",
    "render_beige",
    "render_terracotta",
    # Aluminium
    "aluminium_dark_grey",
    "aluminium_natural",
    "aluminium_black",
    # Brick
    "brick_red",
    "brick_yellow",
    "brick_grey",
    # Stone
    "stone_limestone",
    "stone_slate",
    "stone_sandstone",
    # Concrete
    "concrete_smooth",
    "concrete_board_formed",
    # Glass
    "glass_clear",
    "glass_low_iron",
    "glass_fritted",
    "glass_obscured",
    # Standing-seam metal roof
    "metal_standing_seam_dark_grey",
    "metal_standing_seam_zinc",
    "metal_standing_seam_copper",
    # Log-course (Blockhaus / log construction) — issue #42
    "log_round_natural",
    "log_square_natural",
    # Fachwerk overlay timber — issue #111
    "timber_dark_oak",
)


@pytest.mark.parametrize("key", REQUIRED_KEYS)
def test_required_key_resolves(key: str) -> None:
    spec = resolve_material(key)
    assert spec is not None, f"missing material registry entry: {key}"
    assert spec.key == key
    assert spec.base_color.startswith("#") and len(spec.base_color) == 7
    assert 0.0 <= spec.roughness <= 1.0
    assert 0.0 <= spec.metalness <= 1.0
    assert spec.category
    assert spec.display_name


def test_unknown_keys_return_none() -> None:
    assert resolve_material(None) is None
    assert resolve_material("") is None
    assert resolve_material("definitely_not_a_real_key") is None


def test_material_base_color_falls_back_to_neutral_grey() -> None:
    assert material_base_color(None) == "#cccccc"
    assert material_base_color("definitely_not_a_real_key") == "#cccccc"
    # And resolves a known key properly.
    assert material_base_color("aluminium_natural") == "#a8acaf"


def test_aluminium_variants_are_metallic() -> None:
    for key in ("aluminium_dark_grey", "aluminium_natural", "aluminium_black"):
        spec = resolve_material(key)
        assert spec is not None
        assert spec.category == "metal"
        assert spec.metalness >= 0.5


def test_standing_seam_helper() -> None:
    assert is_standing_seam_metal_key("metal_standing_seam_dark_grey")
    assert is_standing_seam_metal_key("metal_standing_seam_zinc")
    assert is_standing_seam_metal_key("metal_standing_seam_copper")
    assert not is_standing_seam_metal_key("aluminium_natural")
    assert not is_standing_seam_metal_key(None)
    assert not is_standing_seam_metal_key("")


def test_standing_seam_variants_are_metal_roof_category() -> None:
    for key in (
        "metal_standing_seam_dark_grey",
        "metal_standing_seam_zinc",
        "metal_standing_seam_copper",
    ):
        spec = resolve_material(key)
        assert spec is not None
        assert spec.category == "metal_roof"


def test_list_materials_includes_required_keys() -> None:
    keys = {m.key for m in list_materials()}
    for k in REQUIRED_KEYS:
        assert k in keys


def test_material_display_name_lookup() -> None:
    assert material_display_name("aluminium_natural") == "Natural aluminium"
    assert material_display_name("metal_standing_seam_copper") == "Standing-seam metal — copper"
    assert material_display_name("nonexistent") == ""
    assert material_display_name(None) == ""


def test_log_course_blockhaus_variants() -> None:
    """MF-mat-1 / issue #42 — Blockhaus log-course materials are dedicated
    timber entries distinct from `timber_cladding` (which is a vertical
    Stülpschalung default and doesn't capture horizontal log courses).
    """
    round_log = resolve_material("log_round_natural")
    assert round_log is not None
    assert round_log.base_color == "#8a6a45"
    assert round_log.category == "timber"
    assert round_log.display_name == "Round log (natural)"

    square_log = resolve_material("log_square_natural")
    assert square_log is not None
    assert square_log.base_color == "#7c5b3b"
    assert square_log.category == "timber"
    assert square_log.display_name == "Square log (natural)"


def test_fachwerk_dark_oak_overlay_timber() -> None:
    """Issue #111 — dark oak timber for visible Fachwerk overlays.

    Distinct from `timber_cladding` (lighter Stülpschalung default) and from
    the log-course variants — the Fachwerk Ständer/Riegel raster needs a
    near-black dark oak to read against brick / plaster Gefache infill.
    """
    spec = resolve_material("timber_dark_oak")
    assert spec is not None
    assert spec.base_color == "#3a2418"
    assert spec.category == "timber"
    assert "Fachwerk" in spec.display_name
