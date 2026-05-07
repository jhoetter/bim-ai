"""SKB-07 — region colour sampler.

Deterministic vision aid: takes a sketch / colour-study PNG and a
rectangular region (or polygon), samples the dominant RGB, and returns
the top-K nearest matches from the MAT-01 catalog.

No model. No vision LLM. Pure NumPy / Pillow + sRGB Euclidean distance
in CIE Lab space. The agent is still the brain; this is a calibrated
ruler that maps "what colour is this facade in the colour study?" to
"the agent should set materialKey: 'cladding_beige_grey'".
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


@dataclass(frozen=True)
class CatalogColourEntry:
    """A material catalog entry mapped to its sRGB hex."""

    material_key: str
    base_color_hex: str
    display_name: str


@dataclass(frozen=True)
class ColourMatch:
    material_key: str
    display_name: str
    catalog_hex: str
    sample_hex: str
    distance: float


def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    r, g, b = rgb
    return f"#{r:02x}{g:02x}{b:02x}"


def _srgb_to_linear(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _rgb_to_xyz(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = (_srgb_to_linear(v) for v in rgb)
    # sRGB D65
    x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
    return x, y, z


def _xyz_to_lab(xyz: tuple[float, float, float]) -> tuple[float, float, float]:
    # D65 reference white
    xn, yn, zn = 0.95047, 1.0, 1.08883
    x, y, z = xyz
    fx, fy, fz = (_pivot(v / ref) for v, ref in zip((x, y, z), (xn, yn, zn)))
    L = 116 * fy - 16
    a = 500 * (fx - fy)
    b = 200 * (fy - fz)
    return L, a, b


def _pivot(t: float) -> float:
    return t ** (1.0 / 3.0) if t > (216 / 24389) else (24389 / 27 * t + 16) / 116


def _delta_e(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    """CIE76 Delta-E in Lab space (sufficient for swatch matching)."""
    la, aa, ba = _xyz_to_lab(_rgb_to_xyz(a))
    lb, ab, bb = _xyz_to_lab(_rgb_to_xyz(b))
    return ((la - lb) ** 2 + (aa - ab) ** 2 + (ba - bb) ** 2) ** 0.5


def sample_region_mean_rgb(
    image_path: str | Path,
    region_xyxy: tuple[int, int, int, int],
) -> tuple[int, int, int]:
    """Mean sRGB of a rectangular region of the image. Coordinates are
    pixel `(x_min, y_min, x_max, y_max)` with origin top-left.

    Uses Pillow + numpy. Returns ints in [0, 255].
    """
    from PIL import Image
    import numpy as np

    img = Image.open(image_path).convert("RGB")
    x0, y0, x1, y1 = region_xyxy
    crop = img.crop((x0, y0, x1, y1))
    arr = np.asarray(crop, dtype=np.float32)
    if arr.size == 0:
        raise ValueError(f"empty region {region_xyxy} in {image_path}")
    mean = arr.reshape(-1, 3).mean(axis=0)
    return tuple(int(round(v)) for v in mean)  # type: ignore[return-value]


def nearest_matches(
    sample_rgb: tuple[int, int, int],
    catalog: Sequence[CatalogColourEntry],
    top_k: int = 3,
) -> list[ColourMatch]:
    """Return the `top_k` nearest catalog matches for a sample colour
    using CIE Lab Delta-E. Smallest distance is the closest match.
    """
    rows: list[ColourMatch] = []
    for entry in catalog:
        cat_rgb = _hex_to_rgb(entry.base_color_hex)
        d = _delta_e(sample_rgb, cat_rgb)
        rows.append(
            ColourMatch(
                material_key=entry.material_key,
                display_name=entry.display_name,
                catalog_hex=entry.base_color_hex,
                sample_hex=_rgb_to_hex(sample_rgb),
                distance=d,
            )
        )
    rows.sort(key=lambda r: r.distance)
    return rows[:top_k]


# Pre-baked catalog mirroring MAT-01 keys with hex base colors. Kept here
# (rather than importing from web/) so this module is purely Python-side.
MAT01_COLOUR_CATALOG: list[CatalogColourEntry] = [
    CatalogColourEntry("timber_cladding", "#8b6340", "Timber cladding (orange-brown)"),
    CatalogColourEntry("white_cladding", "#f4f4f0", "White cladding"),
    CatalogColourEntry("white_render", "#f4f4f0", "White render"),
    CatalogColourEntry("cladding_beige_grey", "#c4b59a", "Beige-grey cladding"),
    CatalogColourEntry("cladding_warm_wood", "#a87a44", "Warm wood cladding"),
    CatalogColourEntry("cladding_dark_grey", "#3a3d3f", "Dark-grey cladding"),
    CatalogColourEntry("render_light_grey", "#cfd0cd", "Light-grey render"),
    CatalogColourEntry("render_beige", "#d8c8a8", "Beige render"),
    CatalogColourEntry("render_terracotta", "#a85432", "Terracotta render"),
    CatalogColourEntry("aluminium_dark_grey", "#3d4042", "Dark-grey aluminium"),
    CatalogColourEntry("aluminium_natural", "#a8acaf", "Natural aluminium"),
    CatalogColourEntry("aluminium_black", "#1c1d1e", "Black aluminium"),
    CatalogColourEntry("brick_red", "#8a3a26", "Red brick"),
    CatalogColourEntry("brick_yellow", "#c5a857", "Yellow brick"),
    CatalogColourEntry("brick_grey", "#7a7873", "Grey brick"),
    CatalogColourEntry("stone_limestone", "#d8d0bc", "Limestone"),
    CatalogColourEntry("stone_slate", "#3e3a35", "Slate"),
    CatalogColourEntry("stone_sandstone", "#b89968", "Sandstone"),
    CatalogColourEntry("concrete_smooth", "#9c9a94", "Smooth concrete"),
    CatalogColourEntry("metal_standing_seam_dark_grey", "#3a3d3f", "Standing-seam metal — dark grey"),
    CatalogColourEntry("metal_standing_seam_zinc", "#7a7d80", "Standing-seam metal — zinc"),
    CatalogColourEntry("metal_standing_seam_copper", "#b86b3c", "Standing-seam metal — copper"),
    CatalogColourEntry("glass_clear", "#e6efef", "Clear glass"),
]


def sample_and_match(
    image_path: str | Path,
    region_xyxy: tuple[int, int, int, int],
    top_k: int = 3,
    catalog: Sequence[CatalogColourEntry] | None = None,
) -> list[ColourMatch]:
    """One-shot helper: sample mean RGB of a region, return top-K matches."""
    cat = catalog if catalog is not None else MAT01_COLOUR_CATALOG
    rgb = sample_region_mean_rgb(image_path, region_xyxy)
    return nearest_matches(rgb, cat, top_k=top_k)
