"""Asset library, placed asset, kit, hatch pattern, material, decal and image-asset
element models."""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import DisciplineTag, Vec2Mm

from ._shared import CircularityProperties, MaterialImpactProperties


class AssetParamEntry(BaseModel):
    """One parameter definition in an asset's parametric schema."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    key: str
    kind: Literal["mm", "enum", "material", "bool"]
    default: Any
    constraints: Any = None


AssetSymbolKind = Literal[
    "bed",
    "wardrobe",
    "lamp",
    "rug",
    "fridge",
    "oven",
    "sink",
    "counter",
    "sofa",
    "table",
    "chair",
    "toilet",
    "bath",
    "shower",
    "bathroom_layout",
    "generic",
]


class AssetLibraryEntryElem(BaseModel):
    """AST-V3-01 — searchable asset library entry with schematic-2D thumbnail."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["asset_library_entry"] = "asset_library_entry"
    id: str
    asset_kind: Literal["family_instance", "block_2d", "kit", "decal", "profile"] = Field(
        alias="assetKind", default="block_2d"
    )
    name: str
    tags: list[str] = Field(default_factory=list)
    category: Literal[
        "furniture", "kitchen", "bathroom", "door", "window", "decal", "profile", "casework"
    ]
    discipline_tags: list[Literal["arch", "struct", "mep"]] = Field(
        default_factory=list, alias="disciplineTags"
    )
    thumbnail_kind: Literal["schematic_plan", "rendered_3d"] = Field(
        default="schematic_plan", alias="thumbnailKind"
    )
    thumbnail_width_mm: float | None = Field(default=None, alias="thumbnailWidthMm")
    thumbnail_height_mm: float | None = Field(default=None, alias="thumbnailHeightMm")
    width_mm: float | None = Field(default=None, alias="widthMm")
    depth_mm: float | None = Field(default=None, alias="depthMm")
    height_mm: float | None = Field(default=None, alias="heightMm")
    clearance_mm: float | None = Field(default=None, alias="clearanceMm")
    maintenance_zone_mm: dict[str, float] | None = Field(default=None, alias="maintenanceZoneMm")
    placement_support: str | None = Field(default=None, alias="placementSupport")
    plan_symbol_kind: AssetSymbolKind | None = Field(default=None, alias="planSymbolKind")
    render_proxy_kind: AssetSymbolKind | None = Field(default=None, alias="renderProxyKind")
    param_schema: list[AssetParamEntry] | None = Field(default=None, alias="paramSchema")
    material_slots: dict[str, str | None] | list[str] | None = Field(
        default=None, alias="materialSlots"
    )
    render_support: dict[str, Any] | None = Field(default=None, alias="renderSupport")
    schedule_fields: list[str] | None = Field(default=None, alias="scheduleFields")
    export_metadata: dict[str, Any] | None = Field(default=None, alias="exportMetadata")
    ifc_mapping: dict[str, Any] | None = Field(default=None, alias="ifcMapping")
    gltf_mapping: dict[str, Any] | None = Field(default=None, alias="gltfMapping")
    published_from_org_id: str | None = Field(default=None, alias="publishedFromOrgId")
    description: str | None = None


class PlacedAssetElem(BaseModel):
    """AST-V3-01 — a placed asset instance positioned on the canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["placed_asset"] = "placed_asset"
    id: str
    name: str
    asset_id: str = Field(alias="assetId")
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    param_values: dict[str, Any] = Field(default_factory=dict, alias="paramValues")
    host_element_id: str | None = Field(default=None, alias="hostElementId")
    discipline: DisciplineTag | None = Field(default=None)


# ---------------------------------------------------------------------------
# AST-V3-04 — Parametric kitchen kit
# ---------------------------------------------------------------------------


class KitComponent(BaseModel):
    """AST-V3-04 — one component in a kitchen kit chain."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    component_kind: Literal[
        "base",
        "upper",
        "oven_housing",
        "sink",
        "pantry",
        "countertop",
        "end_panel",
        "dishwasher",
        "fridge",
    ] = Field(alias="componentKind")
    width_mm: float | None = Field(default=None, alias="widthMm")  # None = auto-fill
    height_mm: float | None = Field(default=None, alias="heightMm")
    depth_mm: float | None = Field(default=None, alias="depthMm")
    door_style: str | None = Field(default=None, alias="doorStyle")  # shaker|flat|beaded|glazed
    material_id: str | None = Field(default=None, alias="materialId")
    hardware_family_id: str | None = Field(default=None, alias="hardwareFamilyId")


class FamilyKitInstanceElem(BaseModel):
    """AST-V3-04 — a placed parametric kitchen kit snap-chain on a wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["family_kit_instance"] = "family_kit_instance"
    id: str
    kit_id: Literal["kitchen_modular"] = Field(alias="kitId")
    host_wall_id: str = Field(alias="hostWallId")
    start_mm: float = Field(alias="startMm")
    end_mm: float = Field(alias="endMm")
    components: list[KitComponent] = Field(default_factory=list)
    countertop_depth_mm: float = Field(default=600.0, alias="countertopDepthMm")
    countertop_thickness_mm: float = Field(default=40.0, alias="countertopThicknessMm")
    countertop_material_id: str | None = Field(default=None, alias="countertopMaterialId")
    toe_kick_height_mm: float = Field(default=100.0, alias="toeKickHeightMm")
    upper_base_clearance_mm: float = Field(default=460.0, alias="upperBaseClearanceMm")
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")


# ---------------------------------------------------------------------------
# CAN-V3-02 — Hatch pattern definitions
# ---------------------------------------------------------------------------

HatchPatternKind = Literal["lines", "crosshatch", "dots", "curve", "svg"]


class HatchPatternDefElem(BaseModel):
    """CAN-V3-02 — built-in hatch pattern definition. Scales with paper-mm at plot scale."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["hatch_pattern_def"] = "hatch_pattern_def"
    id: str
    name: str
    paper_mm_repeat: float = Field(alias="paperMmRepeat")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    stroke_width_mm: float = Field(default=0.18, alias="strokeWidthMm")
    pattern_kind: HatchPatternKind = Field(alias="patternKind")
    svg_source: str | None = Field(default=None, alias="svgSource")


# ---------------------------------------------------------------------------
# MAT-V3-01 — Material PBR map slots + Decals
# ---------------------------------------------------------------------------


class MaterialElem(BaseModel):
    """MAT-V3-01 — first-class material element with optional PBR map slots."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["material"] = "material"
    id: str
    name: str
    source: Literal["builtin", "curated_asset", "project", "family"] | None = None
    category: str | None = None
    graphics: dict | None = None
    appearance: dict | None = None
    physical: dict | None = None
    thermal: dict | None = None
    sustainability: MaterialImpactProperties | None = None
    circularity: CircularityProperties | None = None
    albedo_color: str | None = Field(default=None, alias="albedoColor")
    albedo_map_id: str | None = Field(default=None, alias="albedoMapId")
    normal_map_id: str | None = Field(default=None, alias="normalMapId")
    roughness_map_id: str | None = Field(default=None, alias="roughnessMapId")
    metallic_map_id: str | None = Field(default=None, alias="metallicMapId")
    height_map_id: str | None = Field(default=None, alias="heightMapId")
    uv_scale_mm: dict | None = Field(default=None, alias="uvScaleMm")
    uv_rotation_deg: float | None = Field(default=None, alias="uvRotationDeg")
    uv_offset_mm: dict | None = Field(default=None, alias="uvOffsetMm")
    projection: str | None = None
    hatch_pattern_id: str | None = Field(default=None, alias="hatchPatternId")


ImageAssetMapUsage = Literal["albedo", "normal", "roughness", "metalness", "height", "opacity"]


class ImageAssetElem(BaseModel):
    """MAT-11 — project texture image asset with provenance metadata."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["image_asset"] = "image_asset"
    id: str
    filename: str
    mime_type: str = Field(alias="mimeType")
    byte_size: int = Field(alias="byteSize", ge=0)
    width_px: int | None = Field(default=None, alias="widthPx")
    height_px: int | None = Field(default=None, alias="heightPx")
    content_hash: str = Field(alias="contentHash")
    map_usage_hint: ImageAssetMapUsage = Field(alias="mapUsageHint")
    source: str | None = None
    license: str | None = None
    provenance: str | None = None
    data_url: str | None = Field(default=None, alias="dataUrl")


class DecalElem(BaseModel):
    """MAT-V3-01 — 2D image decal hosted on a parent surface."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["decal"] = "decal"
    id: str
    parent_element_id: str = Field(alias="parentElementId")
    parent_surface: Literal["front", "back", "top", "left", "right", "bottom"] = Field(
        alias="parentSurface"
    )
    image_asset_id: str = Field(alias="imageAssetId")
    uv_rect: dict = Field(alias="uvRect")
    opacity: float = 1.0


# ---------------------------------------------------------------------------
# IMP-V3-01 — Image-as-underlay element
# ---------------------------------------------------------------------------

_HEX_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")


class ImageUnderlayElem(BaseModel):
    """IMP-V3-01 — raster/PDF underlay pinned to the plan canvas."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["image_underlay"] = "image_underlay"
    id: str
    src: str
    rect_mm: dict = Field(alias="rectMm")  # {xMm, yMm, widthMm, heightMm}
    rotation_deg: float = Field(0.0, alias="rotationDeg")
    opacity: float = 0.4
    locked_scale: bool = Field(False, alias="lockedScale")
