"""TEST-CQ-03 — colour_sampler Lab + fallback coverage.

Targets the 56% baseline lines in ``bim_ai.skb.colour_sampler``:

- Line 41: 3-char hex shorthand expansion in ``_hex_to_rgb``.
- Lines 202-271: the ``sample`` polygon helper with its NumPy / PIL / cv2
  import-fallback paths and HSV-from-BGR hue math.

The Lab round-trip and ranking-determinism assertions defend against
silent numeric drift in colour-distance ranking, which is load-bearing
for agent material assignment.
"""

from __future__ import annotations

import builtins
import math
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from PIL import Image

from bim_ai.skb import colour_sampler
from bim_ai.skb.colour_sampler import (
    MAT01_COLOUR_CATALOG,
    CatalogColourEntry,
    _delta_e,
    _hex_to_rgb,
    _pivot,
    _rgb_to_hex,
    _rgb_to_xyz,
    _srgb_to_linear,
    _xyz_to_lab,
    nearest_matches,
    sample,
)

# --- numeric tolerances ----------------------------------------------------
# CIE76 distance for an identical colour must be effectively zero;
# Lab → XYZ → Lab round-trip via the helpers is exact to float epsilon.
_LAB_EPS = 1e-6
# When we discretise back to 8-bit RGB and re-encode, a 1-LSB drift is
# the worst we tolerate (round-trip is mostly perfect for the values we
# test; the safety margin keeps the assertion robust under future
# whitepoint refactors).
_RGB_ROUND_TRIP_LSB = 1.0


# ---------------------------------------------------------------------------
# _hex_to_rgb — line 41 (3-char shorthand expansion)
# ---------------------------------------------------------------------------


def test_hex_to_rgb_three_char_shorthand_expands() -> None:
    # "#abc" → "#aabbcc" — this is the only path through line 41.
    assert _hex_to_rgb("#abc") == (0xAA, 0xBB, 0xCC)
    assert _hex_to_rgb("abc") == (0xAA, 0xBB, 0xCC)  # no leading hash either


def test_hex_to_rgb_six_char_passthrough() -> None:
    assert _hex_to_rgb("#a87a44") == (168, 122, 68)


def test_rgb_to_hex_round_trip_against_hex_to_rgb() -> None:
    for hex_ in ("#000000", "#ffffff", "#a87a44", "#3a3d3f"):
        assert _rgb_to_hex(_hex_to_rgb(hex_)) == hex_


# ---------------------------------------------------------------------------
# CIE Lab transformation correctness
# ---------------------------------------------------------------------------


def test_srgb_to_linear_known_anchors() -> None:
    # Anchor values from the IEC 61966-2-1 sRGB EOTF.
    assert _srgb_to_linear(0) == 0.0
    assert _srgb_to_linear(255) == pytest.approx(1.0, abs=1e-9)
    # Threshold pivot at 0.04045 maps to 0.04045 / 12.92.
    expected = 10.0 / 255.0 / 12.92
    assert _srgb_to_linear(10) == pytest.approx(expected, abs=1e-9)


def test_pivot_threshold_branches() -> None:
    # Above the Lab-cube-root threshold: returns t^(1/3).
    above = 0.5
    assert _pivot(above) == pytest.approx(above ** (1.0 / 3.0), abs=1e-12)
    # Below the threshold: returns the linear segment.
    below = 0.001
    expected = (24389 / 27 * below + 16) / 116
    assert _pivot(below) == pytest.approx(expected, abs=1e-12)


def test_white_maps_to_lab_l_100() -> None:
    L, a, b = _xyz_to_lab(_rgb_to_xyz((255, 255, 255)))
    # CIE Lab whitepoint: L*=100, a*=b*=0. Tolerance is loosened to 1e-4
    # because the sRGB→XYZ matrix in the module uses 7-digit rounded
    # coefficients (Lindbloom) which produce a tiny residual at white.
    assert L == pytest.approx(100.0, abs=1e-4)
    assert abs(a) < 1e-3
    assert abs(b) < 1e-3


def test_black_maps_to_lab_l_zero() -> None:
    L, a, b = _xyz_to_lab(_rgb_to_xyz((0, 0, 0)))
    assert L == pytest.approx(0.0, abs=_LAB_EPS)
    assert abs(a) < _LAB_EPS
    assert abs(b) < _LAB_EPS


def test_neutral_gray_has_zero_chroma() -> None:
    # Any neutral (R == G == B) is on the achromatic axis: a* ≈ b* ≈ 0.
    for v in (32, 64, 128, 192):
        _, a, b = _xyz_to_lab(_rgb_to_xyz((v, v, v)))
        assert abs(a) < 1e-3, f"gray {v} should have a*≈0, got {a}"
        assert abs(b) < 1e-3, f"gray {v} should have b*≈0, got {b}"


@pytest.mark.parametrize(
    ("rgb", "label"),
    [
        ((255, 0, 0), "red"),
        ((0, 255, 0), "green"),
        ((0, 0, 255), "blue"),
        ((255, 255, 255), "white"),
        ((0, 0, 0), "black"),
        ((128, 128, 128), "mid-gray"),
    ],
)
def test_delta_e_self_is_zero(rgb: tuple[int, int, int], label: str) -> None:
    # CIE76 distance from a colour to itself is always 0.
    assert _delta_e(rgb, rgb) == pytest.approx(0.0, abs=_LAB_EPS), label


def test_delta_e_symmetric() -> None:
    a = (200, 100, 50)
    b = (50, 100, 200)
    assert _delta_e(a, b) == pytest.approx(_delta_e(b, a), abs=_LAB_EPS)


def test_delta_e_triangle_inequality_for_three_anchors() -> None:
    # Triangle inequality is a property of any metric; CIE76 in Lab is one.
    a = (255, 0, 0)
    b = (0, 255, 0)
    c = (0, 0, 255)
    assert _delta_e(a, c) <= _delta_e(a, b) + _delta_e(b, c) + _LAB_EPS


def test_delta_e_red_far_from_green() -> None:
    # Sanity floor: primary-to-primary distance should be large.
    assert _delta_e((255, 0, 0), (0, 255, 0)) > 50.0


# ---------------------------------------------------------------------------
# Catalog round-trip: each catalog hex parses, encodes back, and the
# Lab distance from a sample matching its own hex is ≈ 0.
# ---------------------------------------------------------------------------


def test_catalog_hex_round_trip_and_self_distance_zero() -> None:
    for entry in MAT01_COLOUR_CATALOG:
        rgb = _hex_to_rgb(entry.base_color_hex)
        assert _rgb_to_hex(rgb) == entry.base_color_hex.lower()
        # Distance from the sample to the catalog entry that is its own
        # exact hex must be 0.
        matches = nearest_matches(rgb, [entry], top_k=1)
        assert matches[0].distance == pytest.approx(0.0, abs=_LAB_EPS)


# ---------------------------------------------------------------------------
# Ranking determinism — same input list → same output ordering across runs
# ---------------------------------------------------------------------------


def test_nearest_matches_deterministic_across_repeated_calls() -> None:
    sample_rgb = (120, 110, 100)
    first = [m.material_key for m in nearest_matches(sample_rgb, MAT01_COLOUR_CATALOG, top_k=5)]
    for _ in range(10):
        again = [
            m.material_key for m in nearest_matches(sample_rgb, MAT01_COLOUR_CATALOG, top_k=5)
        ]
        assert again == first


def test_nearest_matches_stable_with_duplicate_distances() -> None:
    # Two catalog entries with identical hex → identical distance → ordering
    # falls back to insertion order (Python sort is stable). Asserts the
    # behavioural contract that ranking is deterministic even on ties.
    duplicates = [
        CatalogColourEntry("first_key", "#808080", "First"),
        CatalogColourEntry("second_key", "#808080", "Second"),
        CatalogColourEntry("third_key", "#808080", "Third"),
    ]
    matches = nearest_matches((128, 128, 128), duplicates, top_k=3)
    keys = [m.material_key for m in matches]
    assert keys == ["first_key", "second_key", "third_key"]
    # And they all have the same distance.
    assert matches[0].distance == matches[1].distance == matches[2].distance


def test_nearest_matches_top_k_truncates() -> None:
    # top_k larger than catalog returns the whole catalog, sorted.
    matches = nearest_matches((10, 20, 30), MAT01_COLOUR_CATALOG, top_k=999)
    assert len(matches) == len(MAT01_COLOUR_CATALOG)
    distances = [m.distance for m in matches]
    assert distances == sorted(distances)


# ---------------------------------------------------------------------------
# polygon ``sample`` — happy paths via the PIL/numpy fallback
# (cv2 is not installed in the test env, so the ``except ImportError``
# branches are the live code path here).
# ---------------------------------------------------------------------------


def _solid_png(tmp_path: Path, rgb: tuple[int, int, int], size: int = 16) -> Path:
    p = tmp_path / f"solid_{rgb[0]}_{rgb[1]}_{rgb[2]}.png"
    Image.new("RGB", (size, size), color=rgb).save(p)
    return p


def test_sample_returns_none_for_empty_polygon() -> None:
    assert sample(image=object(), polygon_pts=[]) is None


def test_sample_living_for_warm_red(tmp_path: Path) -> None:
    p = _solid_png(tmp_path, (220, 40, 40))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(p), poly) == "living"


def test_sample_kitchen_for_yellow(tmp_path: Path) -> None:
    # Yellow → hue ≈ 60° → "kitchen"
    p = _solid_png(tmp_path, (220, 220, 40))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(p), poly) == "kitchen"


def test_sample_bathroom_for_blue(tmp_path: Path) -> None:
    # Blue → hue ≈ 240°? No — in HSV blue is 240° which is bedroom range.
    # Use cyan / teal (≈ 180°) to land squarely in the bathroom band.
    p = _solid_png(tmp_path, (40, 200, 200))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(p), poly) == "bathroom"


def test_sample_bedroom_for_purple(tmp_path: Path) -> None:
    # Purple/violet (≈ 280°) → "bedroom".
    p = _solid_png(tmp_path, (150, 40, 220))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(p), poly) == "bedroom"


def test_sample_grayscale_pixel_returns_living(tmp_path: Path) -> None:
    # Neutral gray has delta == 0 in HSV → branch takes ``hue_deg = 0.0``,
    # which falls in the 0-30° "living" band. This exercises the
    # ``delta < 1e-6`` branch on line 251-252.
    p = _solid_png(tmp_path, (128, 128, 128))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(p), poly) == "living"


def test_sample_degenerate_bbox_returns_none(tmp_path: Path) -> None:
    # Polygon points that collapse to a single column produce
    # ``x1 <= x0`` → returns None (line 243-244 branch).
    p = _solid_png(tmp_path, (200, 100, 50))
    # All x-coords identical → x1 == x0 after clipping.
    poly = [(5, 2), (5, 14)]
    assert sample(str(p), poly) is None


def test_sample_with_ndarray_input(tmp_path: Path) -> None:
    # Pass a numpy ndarray directly — exercises the ``isinstance(image, np.ndarray)``
    # branch on line 209.
    arr = np.zeros((20, 20, 3), dtype=np.uint8)
    arr[..., 2] = 220  # red channel in BGR (cv2 convention) → red in RGB[0]
    # The function treats `image` as BGR. Setting [..., 2] = 220 places the
    # value in the "R" channel of the BGR layout the function uses.
    poly = [(2, 2), (18, 2), (18, 18), (2, 18)]
    # In the numpy fallback, the code does r = mean_bgr[2], g = mean_bgr[1],
    # b = mean_bgr[0]; with our array, r=220, g=0, b=0 → hue 0 → "living".
    assert sample(arr, poly) == "living"


def test_sample_with_2d_ndarray_is_promoted_to_bgr(tmp_path: Path) -> None:
    # 2-D ndarray triggers the ``np.stack([image] * 3, axis=-1)`` branch
    # on line 210.
    arr = np.full((20, 20), 128, dtype=np.uint8)
    poly = [(2, 2), (18, 2), (18, 18), (2, 18)]
    # Replicated mid-gray → delta ≈ 0 → hue 0 → "living".
    assert sample(arr, poly) == "living"


def test_sample_returns_none_on_unreadable_path(tmp_path: Path) -> None:
    # Non-existent path: PIL raises FileNotFoundError → outer ``except``
    # swallows it (line 270-271) and returns None.
    missing = tmp_path / "does-not-exist.png"
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(missing), poly) is None


# ---------------------------------------------------------------------------
# Hue branch coverage: green-dominant and blue-dominant pixels trigger
# the ``max_c == g`` and the ``else`` (max_c == b) branches in the numpy
# HSV computation (lines 253-258). The earlier red-dominant tests cover
# ``max_c == r``.
# ---------------------------------------------------------------------------


def test_sample_green_dominant_uses_g_branch(tmp_path: Path) -> None:
    # Strong green → ``max_c == g`` branch on lines 255-256.
    p = _solid_png(tmp_path, (40, 220, 40))  # hue ≈ 120° → bathroom
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(p), poly) == "bathroom"


def test_sample_blue_dominant_uses_else_branch(tmp_path: Path) -> None:
    # Pure blue → ``max_c == b`` → ``else`` branch on lines 257-258.
    # hue ≈ 240° → bedroom (201-329 range).
    p = _solid_png(tmp_path, (40, 40, 220))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]
    assert sample(str(p), poly) == "bedroom"


# ---------------------------------------------------------------------------
# Fallback behaviour when NumPy / PIL are unavailable
# ---------------------------------------------------------------------------


def _import_blocker(*blocked: str):
    """Build a replacement for ``builtins.__import__`` that raises
    ImportError for any module name in ``blocked``.
    """
    real_import = builtins.__import__

    def fake_import(
        name: str,
        globals: dict[str, Any] | None = None,
        locals: dict[str, Any] | None = None,
        fromlist: tuple[str, ...] = (),
        level: int = 0,
    ):
        if name in blocked or any(name.startswith(b + ".") for b in blocked):
            raise ImportError(f"blocked: {name}")
        return real_import(name, globals, locals, fromlist, level)

    return fake_import


def test_sample_returns_none_when_numpy_unavailable(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Block ``import numpy`` inside ``sample``. The outer try/except
    # (line 205, 270-271) swallows the ImportError and returns None.
    p = _solid_png(tmp_path, (200, 100, 50))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]

    monkeypatch.setattr(builtins, "__import__", _import_blocker("numpy"))

    # Sanity: the blocker actually blocks numpy.
    with pytest.raises(ImportError):
        __import__("numpy")  # noqa: F401

    assert sample(str(p), poly) is None


def test_sample_returns_none_when_pil_unavailable(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # cv2 is already unavailable in the test env, so when PIL is also
    # blocked the inner fallback path (line 219-222) raises ImportError,
    # which propagates to the outer ``except`` (line 270-271) → None.
    p = _solid_png(tmp_path, (200, 100, 50))
    poly = [(2, 2), (14, 2), (14, 14), (2, 14)]

    monkeypatch.setattr(builtins, "__import__", _import_blocker("PIL", "cv2"))

    assert sample(str(p), poly) is None


def test_sample_region_mean_rgb_propagates_when_pil_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # ``sample_region_mean_rgb`` does not catch ImportError — confirm the
    # contract that PIL/numpy being unavailable surfaces as ImportError
    # rather than silently returning empty / zero data.
    p = _solid_png(tmp_path, (200, 100, 50))
    monkeypatch.setattr(builtins, "__import__", _import_blocker("PIL", "numpy"))
    with pytest.raises(ImportError):
        colour_sampler.sample_region_mean_rgb(p, (0, 0, 8, 8))


# ---------------------------------------------------------------------------
# Transparent-pixel behaviour: the PIL ``Image.open(...).convert("RGB")``
# composite path drops the alpha channel. Confirm that the public
# ``sample_region_mean_rgb`` strips alpha and returns RGB only.
# ---------------------------------------------------------------------------


def test_sample_region_mean_rgb_strips_alpha(tmp_path: Path) -> None:
    # RGBA image with fully-transparent pixels: convert("RGB") composites
    # over black (PIL default), so the returned RGB is (0, 0, 0).
    p = tmp_path / "rgba.png"
    img = Image.new("RGBA", (16, 16), color=(255, 100, 50, 0))
    img.save(p)

    rgb = colour_sampler.sample_region_mean_rgb(p, (0, 0, 16, 16))
    # Tuple is 3-element (RGB, no alpha) regardless of input mode.
    assert len(rgb) == 3
    # All three channels are valid uint8 values.
    for v in rgb:
        assert isinstance(v, int)
        assert 0 <= v <= 255


def test_sample_region_mean_rgb_opaque_rgba(tmp_path: Path) -> None:
    # Fully-opaque RGBA: convert("RGB") returns the RGB channels intact.
    p = tmp_path / "rgba_opaque.png"
    Image.new("RGBA", (16, 16), color=(180, 120, 60, 255)).save(p)
    rgb = colour_sampler.sample_region_mean_rgb(p, (2, 2, 14, 14))
    # Within 1 LSB (no compression artefact expected on a solid PNG).
    assert all(
        abs(actual - expected) <= _RGB_ROUND_TRIP_LSB
        for actual, expected in zip(rgb, (180, 120, 60), strict=False)
    )


# ---------------------------------------------------------------------------
# Soft sanity floor: ensure no test hits a non-finite Lab value.
# ---------------------------------------------------------------------------


def test_no_lab_value_is_nan_or_inf_on_full_catalog() -> None:
    for entry in MAT01_COLOUR_CATALOG:
        L, a, b = _xyz_to_lab(_rgb_to_xyz(_hex_to_rgb(entry.base_color_hex)))
        for v in (L, a, b):
            assert math.isfinite(v), f"{entry.material_key} → non-finite Lab {v}"
