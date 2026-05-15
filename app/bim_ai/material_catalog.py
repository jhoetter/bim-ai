"""Material catalog — MAT-01.

Kernel-side mirror of the per-`materialKey` PBR registry that the web
viewport uses (`packages/web/src/viewport/materials.ts`). Both sides need
to agree on the registered key set so authoring tools, IFC export, and
schedule rendering can resolve a `materialKey` to a stable display name
and base colour without round-tripping through the renderer.

This module is intentionally a flat data table — no element coupling —
so it can be imported from anywhere (commands, exporters, schedule
derivation) without pulling in heavy dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

MaterialCategoryKind = Literal[
    "cladding",
    "render",
    "metal",
    "metal_roof",
    "brick",
    "stone",
    "concrete",
    "glass",
    "timber",
    "membrane",
    "plaster",
    "placeholder",
    "air",
]


@dataclass(frozen=True)
class MaterialPbrSpec:
    """PBR + classification spec for a single `materialKey`."""

    key: str
    base_color: str
    roughness: float
    metalness: float
    category: MaterialCategoryKind
    display_name: str
    hatch_pattern: str | None = None
    normal_map_url: str | None = None
    aliases: tuple[str, ...] = field(default_factory=tuple)


_MATERIALS: tuple[MaterialPbrSpec, ...] = (
    # ── Legacy default keys (preserved) ──────────────────────────────
    MaterialPbrSpec(
        key="timber_cladding",
        base_color="#7c5b3b",
        roughness=0.85,
        metalness=0.0,
        category="cladding",
        display_name="Timber cladding",
    ),
    MaterialPbrSpec(
        key="white_cladding",
        base_color="#f4f4f0",
        roughness=0.92,
        metalness=0.0,
        category="cladding",
        display_name="White cladding",
    ),
    MaterialPbrSpec(
        key="white_render",
        base_color="#f4f4f0",
        roughness=0.92,
        metalness=0.0,
        category="render",
        display_name="White render",
    ),
    MaterialPbrSpec(
        key="timber_frame_insulation",
        base_color="#d6b675",
        roughness=0.95,
        metalness=0.0,
        category="timber",
        display_name="Timber frame + insulation",
    ),
    MaterialPbrSpec(
        key="timber_stud",
        base_color="#cf9b56",
        roughness=0.9,
        metalness=0.0,
        category="timber",
        display_name="Timber stud",
    ),
    MaterialPbrSpec(
        key="vcl_membrane",
        base_color="#b9c0c8",
        roughness=0.7,
        metalness=0.0,
        category="membrane",
        display_name="VCL membrane",
    ),
    MaterialPbrSpec(
        key="plasterboard",
        base_color="#ece8de",
        roughness=0.92,
        metalness=0.0,
        category="plaster",
        display_name="Plasterboard",
    ),
    MaterialPbrSpec(
        key="plaster",
        base_color="#efe9d8",
        roughness=0.92,
        metalness=0.0,
        category="plaster",
        display_name="Plaster",
    ),
    MaterialPbrSpec(
        key="masonry_brick",
        base_color="#a45a3f",
        roughness=0.9,
        metalness=0.0,
        category="brick",
        hatch_pattern="brick",
        display_name="Masonry brick",
    ),
    MaterialPbrSpec(
        key="masonry_block",
        base_color="#bcb6a8",
        roughness=0.9,
        metalness=0.0,
        category="brick",
        hatch_pattern="block",
        display_name="Masonry block",
    ),
    MaterialPbrSpec(
        key="air",
        base_color="#ffffff",
        roughness=1.0,
        metalness=0.0,
        category="air",
        display_name="Air gap",
    ),
    # ── MAT-01 cladding variants ─────────────────────────────────────
    MaterialPbrSpec(
        key="cladding_beige_grey",
        base_color="#c4b59a",
        roughness=0.85,
        metalness=0.0,
        category="cladding",
        display_name="Beige-grey cladding",
    ),
    MaterialPbrSpec(
        key="cladding_warm_wood",
        base_color="#a87a44",
        roughness=0.85,
        metalness=0.0,
        category="cladding",
        display_name="Warm wood cladding",
    ),
    MaterialPbrSpec(
        key="cladding_dark_grey",
        base_color="#3a3d3f",
        roughness=0.85,
        metalness=0.0,
        category="cladding",
        display_name="Dark-grey cladding",
    ),
    # ── MAT-01 render variants ───────────────────────────────────────
    MaterialPbrSpec(
        key="render_light_grey",
        base_color="#cfd0cd",
        roughness=0.92,
        metalness=0.0,
        category="render",
        display_name="Light-grey render",
    ),
    MaterialPbrSpec(
        key="render_beige",
        base_color="#d8c8a8",
        roughness=0.92,
        metalness=0.0,
        category="render",
        display_name="Beige render",
    ),
    MaterialPbrSpec(
        key="render_terracotta",
        base_color="#a85432",
        roughness=0.92,
        metalness=0.0,
        category="render",
        display_name="Terracotta render",
    ),
    MaterialPbrSpec(
        key="roof_tile_terracotta",
        base_color="#7d3424",
        roughness=0.88,
        metalness=0.0,
        category="brick",
        hatch_pattern="tile",
        display_name="Terracotta clay roof tile",
    ),
    # ── MAT-01 aluminium variants ────────────────────────────────────
    MaterialPbrSpec(
        key="aluminium_dark_grey",
        base_color="#3d4042",
        roughness=0.3,
        metalness=0.6,
        category="metal",
        display_name="Dark-grey aluminium",
    ),
    MaterialPbrSpec(
        key="aluminium_natural",
        base_color="#a8acaf",
        roughness=0.2,
        metalness=0.85,
        category="metal",
        display_name="Natural aluminium",
    ),
    MaterialPbrSpec(
        key="aluminium_black",
        base_color="#1c1d1e",
        roughness=0.4,
        metalness=0.55,
        category="metal",
        display_name="Black aluminium",
    ),
    # ── MAT-01 brick variants ────────────────────────────────────────
    MaterialPbrSpec(
        key="brick_red",
        base_color="#8a3a26",
        roughness=0.9,
        metalness=0.0,
        category="brick",
        hatch_pattern="brick",
        display_name="Red brick",
    ),
    MaterialPbrSpec(
        key="brick_yellow",
        base_color="#c5a857",
        roughness=0.9,
        metalness=0.0,
        category="brick",
        hatch_pattern="brick",
        display_name="Yellow brick",
    ),
    MaterialPbrSpec(
        key="brick_grey",
        base_color="#7a7873",
        roughness=0.9,
        metalness=0.0,
        category="brick",
        hatch_pattern="brick",
        display_name="Grey brick",
    ),
    # ── MAT-01 stone variants ────────────────────────────────────────
    MaterialPbrSpec(
        key="stone_limestone",
        base_color="#d8d0bc",
        roughness=0.88,
        metalness=0.0,
        category="stone",
        hatch_pattern="stone",
        display_name="Limestone",
    ),
    MaterialPbrSpec(
        key="stone_slate",
        base_color="#3e3a35",
        roughness=0.7,
        metalness=0.0,
        category="stone",
        hatch_pattern="stone",
        display_name="Slate",
    ),
    MaterialPbrSpec(
        key="stone_sandstone",
        base_color="#b89968",
        roughness=0.88,
        metalness=0.0,
        category="stone",
        hatch_pattern="stone",
        display_name="Sandstone",
    ),
    # ── MAT-01 concrete variants ─────────────────────────────────────
    MaterialPbrSpec(
        key="concrete_smooth",
        base_color="#9c9a94",
        roughness=0.7,
        metalness=0.0,
        category="concrete",
        hatch_pattern="concrete",
        display_name="Smooth concrete",
    ),
    MaterialPbrSpec(
        key="concrete_board_formed",
        base_color="#a8a59c",
        roughness=0.85,
        metalness=0.0,
        category="concrete",
        hatch_pattern="concrete",
        display_name="Board-formed concrete",
    ),
    # ── MAT-01 glass variants ────────────────────────────────────────
    MaterialPbrSpec(
        key="glass_clear",
        base_color="#b8d6e6",
        roughness=0.05,
        metalness=0.0,
        category="glass",
        display_name="Clear glass",
    ),
    MaterialPbrSpec(
        key="glass_low_iron",
        base_color="#d2e6ee",
        roughness=0.05,
        metalness=0.0,
        category="glass",
        display_name="Low-iron glass",
    ),
    MaterialPbrSpec(
        key="glass_fritted",
        base_color="#dfe6ea",
        roughness=0.35,
        metalness=0.0,
        category="glass",
        display_name="Fritted glass",
    ),
    MaterialPbrSpec(
        key="glass_obscured",
        base_color="#e6ecef",
        roughness=0.55,
        metalness=0.0,
        category="glass",
        display_name="Obscured glass",
    ),
    # ── MAT-01 standing-seam metal roof variants ─────────────────────
    MaterialPbrSpec(
        key="metal_standing_seam_dark_grey",
        base_color="#3a3d3f",
        roughness=0.35,
        metalness=0.7,
        category="metal_roof",
        display_name="Standing-seam metal — dark grey",
    ),
    MaterialPbrSpec(
        key="metal_standing_seam_zinc",
        base_color="#7a7d80",
        roughness=0.35,
        metalness=0.7,
        category="metal_roof",
        display_name="Standing-seam metal — zinc",
    ),
    MaterialPbrSpec(
        key="metal_standing_seam_copper",
        base_color="#b86b3c",
        roughness=0.35,
        metalness=0.7,
        category="metal_roof",
        display_name="Standing-seam metal — copper",
    ),
    # ── KRN-09 placeholder ───────────────────────────────────────────
    MaterialPbrSpec(
        key="placeholder_unloaded",
        base_color="#ff66cc",
        roughness=0.6,
        metalness=0.0,
        category="placeholder",
        display_name="Placeholder (unloaded)",
    ),
)


_BY_KEY: dict[str, MaterialPbrSpec] = {m.key: m for m in _MATERIALS}


def resolve_material(material_key: str | None) -> MaterialPbrSpec | None:
    """Return the PBR spec for a `material_key`, or None if unknown."""

    if not material_key:
        return None
    return _BY_KEY.get(material_key)


def list_materials() -> tuple[MaterialPbrSpec, ...]:
    """Read-only view of every registered material spec."""

    return _MATERIALS


# IFC-04: MAT-01 `category` → IFC4 standard `IfcMaterial.Category` string.
# IFC4 schema material categories per buildingSMART are informally defined
# (e.g. "Concrete", "Steel", "Wood", "Glass", "Masonry", "Stone", "Metal",
# "Gypsum"); this table maps the bim-ai MAT-01 taxonomy onto them so the
# exported IfcMaterial.Category survives third-party round-trips.
_MATERIAL_CATEGORY_TO_IFC: dict[MaterialCategoryKind, str] = {
    "timber": "Wood",
    "concrete": "Concrete",
    "metal": "Metal",
    "metal_roof": "Metal",
    "glass": "Glass",
    "brick": "Masonry",
    "stone": "Stone",
    "plaster": "Gypsum",
    "render": "Render",
    "cladding": "Cladding",
    "membrane": "Membrane",
    # `placeholder` and `air` intentionally have no IFC-standard mapping —
    # they're authoring placeholders, not buildable materials.
}


def ifc_standard_material_category(material_key: str | None) -> str | None:
    """IFC-04: map a MAT-01 `material_key` to its IFC4-standard
    `IfcMaterial.Category` string (e.g. ``"Wood"``, ``"Concrete"``,
    ``"Glass"``, ``"Masonry"``). Returns ``None`` when the key is
    unknown or maps to a non-buildable MAT-01 category
    (``placeholder`` / ``air``).
    """

    spec = resolve_material(material_key)
    if spec is None:
        return None
    return _MATERIAL_CATEGORY_TO_IFC.get(spec.category)


def material_base_color(material_key: str | None) -> str:
    """Cheap base-colour lookup; falls back to neutral grey."""

    spec = resolve_material(material_key)
    return spec.base_color if spec else "#cccccc"


def is_standing_seam_metal_key(material_key: str | None) -> bool:
    """True when a roof material should receive generated roof striping."""

    if not material_key:
        return False
    return material_key.startswith("metal_standing_seam_") or material_key.startswith("roof_tile_")


def material_display_name(material_key: str | None) -> str:
    """Human label for schedules / UI; empty string for unknown keys."""

    spec = resolve_material(material_key)
    return spec.display_name if spec else ""
