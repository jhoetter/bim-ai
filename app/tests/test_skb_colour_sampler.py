"""Tests for SKB-07 region colour sampler + nearest-match."""

from __future__ import annotations

from pathlib import Path

import pytest

from bim_ai.skb.colour_sampler import (
    MAT01_COLOUR_CATALOG,
    CatalogColourEntry,
    nearest_matches,
    sample_and_match,
    sample_region_mean_rgb,
)


def _make_solid_png(path: Path, rgb: tuple[int, int, int], size: int = 32) -> None:
    from PIL import Image
    Image.new("RGB", (size, size), color=rgb).save(path)


def test_nearest_match_exact_hit() -> None:
    catalog = MAT01_COLOUR_CATALOG
    # exact hex of cladding_warm_wood
    matches = nearest_matches((168, 122, 68), catalog, top_k=3)
    assert matches[0].material_key == "cladding_warm_wood"
    assert matches[0].distance < 1e-3


def test_nearest_match_returns_top_k_sorted() -> None:
    catalog = MAT01_COLOUR_CATALOG
    matches = nearest_matches((100, 100, 100), catalog, top_k=5)
    assert len(matches) == 5
    distances = [m.distance for m in matches]
    assert distances == sorted(distances)


def test_sample_region_mean_rgb_solid(tmp_path: Path) -> None:
    p = tmp_path / "solid.png"
    _make_solid_png(p, (200, 150, 100))
    rgb = sample_region_mean_rgb(p, (4, 4, 28, 28))
    assert rgb == (200, 150, 100)


def test_sample_and_match_finds_close_catalog_entry(tmp_path: Path) -> None:
    p = tmp_path / "sample.png"
    # Roughly the warm-wood colour
    _make_solid_png(p, (168, 122, 68))
    matches = sample_and_match(p, (4, 4, 28, 28), top_k=3)
    assert matches[0].material_key == "cladding_warm_wood"
    assert matches[0].distance < 1.0


def test_sample_region_empty_raises(tmp_path: Path) -> None:
    p = tmp_path / "x.png"
    _make_solid_png(p, (10, 20, 30))
    with pytest.raises(ValueError):
        sample_region_mean_rgb(p, (10, 10, 10, 10))  # zero area


def test_catalog_entries_have_valid_hex() -> None:
    for entry in MAT01_COLOUR_CATALOG:
        assert entry.base_color_hex.startswith("#")
        assert len(entry.base_color_hex) == 7
        # hex digits parse cleanly
        int(entry.base_color_hex[1:], 16)


def test_custom_catalog_supported() -> None:
    custom = [CatalogColourEntry("test_key", "#aabbcc", "Test colour")]
    matches = nearest_matches((170, 187, 204), custom, top_k=1)
    assert matches[0].material_key == "test_key"
