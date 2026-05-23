"""Hosting-domain command models.

Door/window-on-wall placement, wall-top host attach/detach helpers, family
type upserts/opening-family assignment, and asset/family-instance placement.

BRT-22 split — these classes used to live in ``app/bim_ai/commands.py``.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import Vec2Mm


class InsertDoorOnWallCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["insertDoorOnWall"] = "insertDoorOnWall"
    id: str | None = None
    name: str = "Door"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=900)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")


class InsertWindowOnWallCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["insertWindowOnWall"] = "insertWindowOnWall"
    id: str | None = None
    name: str = "Window"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=1200)
    sill_height_mm: float = Field(alias="sillHeightMm", default=900)
    height_mm: float = Field(alias="heightMm", default=1500)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")


class FamilyCatalogSourceCmd(BaseModel):
    """FAM-08 — provenance triple stored on a family_type loaded from a catalog."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    catalog_id: str = Field(alias="catalogId")
    family_id: str = Field(alias="familyId")
    version: str


class UpsertFamilyTypeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertFamilyType"] = "upsertFamilyType"
    id: str | None = None
    name: str | None = None
    family_id: str | None = Field(default=None, alias="familyId")
    discipline: Literal["door", "window", "generic"] = "generic"
    parameters: dict[str, Any] = Field(default_factory=dict)
    parameter_schema: list[dict[str, Any]] | None = Field(default=None, alias="parameterSchema")
    required_dimensions: list[str] | None = Field(default=None, alias="requiredDimensions")
    host_support: str | None = Field(default=None, alias="hostSupport")
    material_slots: dict[str, str | None] | list[str] | None = Field(
        default=None, alias="materialSlots"
    )
    schedule_fields: list[str] | None = Field(default=None, alias="scheduleFields")
    ifc_mapping: dict[str, Any] | None = Field(default=None, alias="ifcMapping")
    gltf_mapping: dict[str, Any] | None = Field(default=None, alias="gltfMapping")
    render_support: dict[str, Any] | None = Field(default=None, alias="renderSupport")
    export_support: dict[str, Any] | None = Field(default=None, alias="exportSupport")
    plan_symbol: dict[str, Any] | str | None = Field(default=None, alias="planSymbol")
    visual_geometry: dict[str, Any] | str | None = Field(default=None, alias="visualGeometry")
    family_schema_version: str | None = Field(default=None, alias="familySchemaVersion")
    strict_family_schema: bool = Field(default=False, alias="strictFamilySchema")
    catalog_source: FamilyCatalogSourceCmd | None = Field(default=None, alias="catalogSource")


class AssignOpeningFamilyCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["assignOpeningFamily"] = "assignOpeningFamily"
    opening_id: str = Field(alias="openingId")
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    cut_depth_mm: float | None = Field(default=None, alias="cutDepthMm")
    reveal_interior_mm: float | None = Field(default=None, alias="revealInteriorMm")


class UpdateOpeningCleanroomCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateOpeningCleanroom"] = "updateOpeningCleanroom"
    opening_id: str = Field(alias="openingId")
    interlock_grade: str | None = Field(default=None, alias="interlockGrade")
    seal_rebate_mm: float | None = Field(default=None, alias="sealRebateMm")
    lod_plan: str | None = Field(default=None, alias="lodPlan")


class UpdateDoorCmd(BaseModel):
    """EDT-V3-06 — patch a door's width from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateDoor"] = "updateDoor"
    id: str
    width_mm: float | None = Field(default=None, alias="widthMm", gt=0)


class UpdateWindowCmd(BaseModel):
    """EDT-V3-06 — patch a window's dimensions from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateWindow"] = "updateWindow"
    id: str
    width_mm: float | None = Field(default=None, alias="widthMm", gt=0)
    sill_height_mm: float | None = Field(default=None, alias="sillHeightMm", ge=0)
    height_mm: float | None = Field(default=None, alias="heightMm", gt=0)


class UpdateMaterialPbrCmd(BaseModel):
    """MAT-V3-01 — set PBR map slots on a material element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_material_pbr"] = "update_material_pbr"
    id: str
    name: str | None = None
    albedo_color: str | None = Field(default=None, alias="albedoColor")
    albedo_map_id: str | None = Field(default=None, alias="albedoMapId")
    normal_map_id: str | None = Field(default=None, alias="normalMapId")
    roughness_map_id: str | None = Field(default=None, alias="roughnessMapId")
    metallic_map_id: str | None = Field(default=None, alias="metallicMapId")
    height_map_id: str | None = Field(default=None, alias="heightMapId")
    uv_scale_mm: dict | None = Field(default=None, alias="uvScaleMm")
    uv_rotation_deg: float | None = Field(default=None, alias="uvRotationDeg")
    hatch_pattern_id: str | None = Field(default=None, alias="hatchPatternId")


# --- AST-V3-01 — Asset library commands -------------------------------------


class IndexAssetCmd(BaseModel):
    """Index a new asset into the project's searchable library."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["IndexAsset"] = "IndexAsset"
    id: str | None = None
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
    plan_symbol_kind: (
        Literal[
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
        | None
    ) = Field(default=None, alias="planSymbolKind")
    render_proxy_kind: (
        Literal[
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
        | None
    ) = Field(default=None, alias="renderProxyKind")
    param_schema: list[dict[str, Any]] | None = Field(default=None, alias="paramSchema")
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


class PlaceAssetCmd(BaseModel):
    """Place an asset instance at a position on the canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["PlaceAsset"] = "PlaceAsset"
    id: str | None = None
    name: str | None = None
    asset_id: str = Field(alias="assetId")
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    param_values: dict[str, Any] = Field(default_factory=dict, alias="paramValues")
    host_element_id: str | None = Field(default=None, alias="hostElementId")


class PlaceFamilyInstanceCmd(BaseModel):
    """Place an instance of a project-loaded family_type."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["placeFamilyInstance"] = "placeFamilyInstance"
    id: str | None = None
    name: str | None = None
    family_type_id: str = Field(alias="familyTypeId")
    level_id: str | None = Field(default=None, alias="levelId")
    host_view_id: str | None = Field(default=None, alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    param_values: dict[str, Any] = Field(default_factory=dict, alias="paramValues")
    host_element_id: str | None = Field(default=None, alias="hostElementId")
    host_along_t: float | None = Field(default=None, alias="hostAlongT", ge=0, le=1)
