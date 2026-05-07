"""SKB-20 — architectural style → defaults bias vectors.

When the customer brief specifies a style ("modernist", "traditional",
"farmhouse"), the agent should adopt sensible defaults rather than
authoring an eclectic mishmash. This module centralises those defaults
so each archetype, prompt, and validator references the same source.

Pairs with SKB-09 (archetype library) — archetypes lock in the massing,
this module locks in the materials/finishes/proportions bias.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

RoofBias = Literal["asymmetric_gable", "gable", "shed", "flat", "hip", "mansard"]


@dataclass(frozen=True)
class StyleBias:
    """Default biases for one architectural style."""

    style_id: str
    name: str
    roof_bias: list[RoofBias]                # ordered preference
    palette: dict[str, str]                   # logical surface → MAT-01 materialKey
    glazing_ratio: float                      # facade glass area / facade area
    typical_eave_overhang_mm: int
    typical_floor_height_mm: int
    typical_wall_thickness_mm: int
    notes: str = ""


STYLE_BIASES: dict[str, StyleBias] = {
    "modernist": StyleBias(
        style_id="modernist",
        name="Modernist",
        roof_bias=["asymmetric_gable", "shed", "flat"],
        palette={
            "ground_cladding": "cladding_beige_grey",
            "upper_cladding": "render_white",
            "accent_cladding": "cladding_warm_wood",
            "roof": "metal_standing_seam_dark_grey",
            "frames": "aluminium_dark_grey",
            "balustrade": "glass_clear",
        },
        glazing_ratio=0.45,
        typical_eave_overhang_mm=200,
        typical_floor_height_mm=3000,
        typical_wall_thickness_mm=200,
        notes="Asymmetric massing, large glazing, monochrome palette + warm-wood accent.",
    ),
    "traditional": StyleBias(
        style_id="traditional",
        name="Traditional",
        roof_bias=["gable", "hip"],
        palette={
            "ground_cladding": "brick_red",
            "upper_cladding": "render_light_grey",
            "accent_cladding": "stone_limestone",
            "roof": "tile_clay_red",
            "frames": "aluminium_natural",
            "balustrade": "stone_limestone",
        },
        glazing_ratio=0.22,
        typical_eave_overhang_mm=400,
        typical_floor_height_mm=2700,
        typical_wall_thickness_mm=300,
        notes="Symmetric facades, smaller windows, warm masonry palette.",
    ),
    "farmhouse": StyleBias(
        style_id="farmhouse",
        name="Farmhouse",
        roof_bias=["gable", "shed"],
        palette={
            "ground_cladding": "cladding_white_board_batten",
            "upper_cladding": "cladding_warm_wood",
            "accent_cladding": "stone_limestone",
            "roof": "metal_standing_seam_dark_grey",
            "frames": "aluminium_black",
            "balustrade": "cladding_warm_wood",
        },
        glazing_ratio=0.30,
        typical_eave_overhang_mm=600,
        typical_floor_height_mm=2700,
        typical_wall_thickness_mm=200,
        notes="Steep gables, deep eaves, white board-and-batten + warm wood, black frames.",
    ),
    "industrial_warehouse": StyleBias(
        style_id="industrial_warehouse",
        name="Industrial / Warehouse conversion",
        roof_bias=["flat", "shed"],
        palette={
            "ground_cladding": "brick_red",
            "upper_cladding": "brick_yellow",
            "accent_cladding": "concrete_smooth",
            "roof": "metal_standing_seam_zinc",
            "frames": "aluminium_black",
            "balustrade": "metal_railing",
        },
        glazing_ratio=0.50,
        typical_eave_overhang_mm=100,
        typical_floor_height_mm=4000,
        typical_wall_thickness_mm=350,
        notes="Tall floor heights, large industrial windows, exposed brick.",
    ),
    "scandinavian": StyleBias(
        style_id="scandinavian",
        name="Scandinavian",
        roof_bias=["gable", "shed"],
        palette={
            "ground_cladding": "cladding_warm_wood",
            "upper_cladding": "cladding_warm_wood",
            "accent_cladding": "render_white",
            "roof": "metal_standing_seam_dark_grey",
            "frames": "aluminium_natural",
            "balustrade": "glass_clear",
        },
        glazing_ratio=0.35,
        typical_eave_overhang_mm=300,
        typical_floor_height_mm=2800,
        typical_wall_thickness_mm=250,
        notes="All-wood envelope, simple gables, light interiors, glass balustrades.",
    ),
}


def known_style_ids() -> list[str]:
    """Sorted list of style ids."""
    return sorted(STYLE_BIASES.keys())


def style_for_brief_hint(hint: str) -> StyleBias | None:
    """Map a free-form style hint from a brief to the closest matching
    style, or None if no confident match exists.
    """
    p = hint.strip().lower()
    if not p:
        return None
    if any(k in p for k in ("modernist", "modern", "minimal", "contemporary")):
        return STYLE_BIASES["modernist"]
    if any(k in p for k in ("traditional", "classical", "georgian", "victorian", "colonial")):
        return STYLE_BIASES["traditional"]
    if any(k in p for k in ("farmhouse", "country", "rural")):
        return STYLE_BIASES["farmhouse"]
    if any(k in p for k in ("industrial", "warehouse", "loft")):
        return STYLE_BIASES["industrial_warehouse"]
    if any(k in p for k in ("scandinavian", "nordic", "scandi")):
        return STYLE_BIASES["scandinavian"]
    return None
