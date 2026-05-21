"""Decal, property, schedule, detail-region, kit, image-underlay, and concept-seed
command schemas extracted from commands.py."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CreateDecalCmd(BaseModel):
    """MAT-V3-01 — create a decal element hosted on a parent surface."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_decal"] = "create_decal"
    id: str | None = None
    parent_element_id: str = Field(alias="parentElementId")
    parent_surface: Literal["front", "back", "top", "left", "right", "bottom"] = Field(
        alias="parentSurface"
    )
    image_asset_id: str = Field(alias="imageAssetId")
    uv_rect: dict = Field(alias="uvRect")
    opacity: float = 1.0


# ---------------------------------------------------------------------------
# SCH-V3-01 — Custom-properties + schedule view commands
# ---------------------------------------------------------------------------


class CreatePropertyDefinitionCmd(BaseModel):
    """SCH-V3-01 — define a custom property schema entry."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_property_definition"] = "create_property_definition"
    id: str
    key: str
    label: str
    prop_kind: str = Field(alias="propKind")
    enum_values: list[str] | None = Field(default=None, alias="enumValues")
    default_value: Any | None = Field(default=None, alias="defaultValue")
    applies_to: list[str] = Field(alias="appliesTo")
    show_in_schedule: bool = Field(default=True, alias="showInSchedule")


class SetElementPropCmd(BaseModel):
    """SCH-V3-01 — set a custom property value on any element that carries props."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["set_element_prop"] = "set_element_prop"
    element_id: str = Field(alias="elementId")
    key: str
    value: Any


class CreateScheduleViewCmd(BaseModel):
    """SCH-V3-01 — create a filterable schedule view element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_schedule_view"] = "create_schedule_view"
    id: str
    name: str
    category: str
    columns: list[dict] = Field(default_factory=list)
    filter_expr: str | None = Field(default=None, alias="filterExpr")
    sort_key: str | None = Field(default=None, alias="sortKey")
    sort_dir: Literal["asc", "desc"] | None = Field(default=None, alias="sortDir")


# ---------------------------------------------------------------------------
# ANN-V3-01 — Detail-region drawing-mode authoring
# ---------------------------------------------------------------------------


class DrawDetailRegionCmd(BaseModel):
    """ANN-V3-01 — draw a polyline or closed hatch region on a view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_detail_region"] = "create_detail_region"
    id: str
    view_id: str = Field(alias="viewId")
    vertices: list[dict]
    closed: bool = False
    hatch_id: str | None = Field(default=None, alias="hatchId")
    lineweight_override: float | None = Field(default=None, alias="lineweightOverride")
    phase_created: str | None = Field(default=None, alias="phaseCreated")


class UpdateDetailRegionCmd(BaseModel):
    """ANN-V3-01 — patch vertices, closed flag, or hatch on a detail_region."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_detail_region"] = "update_detail_region"
    id: str
    vertices: list[dict] | None = None
    closed: bool | None = None
    hatch_id: str | None = Field(default=None, alias="hatchId")
    lineweight_override: float | None = Field(default=None, alias="lineweightOverride")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")


# ---------------------------------------------------------------------------
# AST-V3-04 — Parametric kitchen kit commands
# ---------------------------------------------------------------------------


class PlaceKitCmd(BaseModel):
    """AST-V3-04 — place a parametric kitchen kit on a wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["place_kit"] = "place_kit"
    id: str
    kit_id: Literal["kitchen_modular"] = Field(alias="kitId", default="kitchen_modular")
    host_wall_id: str = Field(alias="hostWallId")
    start_mm: float = Field(alias="startMm")
    end_mm: float = Field(alias="endMm")
    components: list[dict] = Field(default_factory=list)
    countertop_depth_mm: float = Field(default=600.0, alias="countertopDepthMm")
    countertop_thickness_mm: float = Field(default=40.0, alias="countertopThicknessMm")
    countertop_material_id: str | None = Field(default=None, alias="countertopMaterialId")


class UpdateKitComponentCmd(BaseModel):
    """AST-V3-04 — patch a single component in a placed kitchen kit."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_kit_component"] = "update_kit_component"
    id: str
    component_index: int = Field(alias="componentIndex")
    width_mm: float | None = Field(default=None, alias="widthMm")
    door_style: str | None = Field(default=None, alias="doorStyle")
    material_id: str | None = Field(default=None, alias="materialId")


# ---------------------------------------------------------------------------
# IMP-V3-01 — Image-as-underlay commands
# ---------------------------------------------------------------------------

_ALLOWED_IMAGE_PREFIXES = (
    "data:image/png",
    "data:image/jpeg",
    "data:application/pdf",
)

_MAX_SRC_BYTES = 50 * 1024 * 1024  # 50 MB


class ImportImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — import a raster or PDF file as a plan-canvas underlay."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["import_image_underlay"] = "import_image_underlay"
    id: str | None = None
    src: str
    rect_mm: dict = Field(alias="rectMm")
    rotation_deg: float = Field(0.0, alias="rotationDeg")
    opacity: float = 0.4
    locked_scale: bool = Field(False, alias="lockedScale")


class MoveImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — reposition an image underlay (preserves width/height)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["move_image_underlay"] = "move_image_underlay"
    id: str
    rect_mm: dict = Field(alias="rectMm")


class ScaleImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — resize an image underlay's width/height."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["scale_image_underlay"] = "scale_image_underlay"
    id: str
    width_mm: float = Field(alias="widthMm")
    height_mm: float = Field(alias="heightMm")


class RotateImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — rotate an image underlay."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["rotate_image_underlay"] = "rotate_image_underlay"
    id: str
    rotation_deg: float = Field(alias="rotationDeg")


class DeleteImageUnderlayCmd(BaseModel):
    """IMP-V3-01 — remove an image underlay from the model."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_image_underlay"] = "delete_image_underlay"
    id: str


# ---------------------------------------------------------------------------
# CON-V3-02 — Concept seed handoff contract (T6 → T9)
# ---------------------------------------------------------------------------


class CreateConceptSeedCmd(BaseModel):
    """CON-V3-02 — create a concept seed in draft state."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_concept_seed"] = "create_concept_seed"
    id: str
    model_id: str = Field(alias="modelId")
    source_underlay_id: str | None = Field(default=None, alias="sourceUnderlayId")
    envelope_tokens: list[dict] = Field(default_factory=list, alias="envelopeTokens")
    kernel_element_drafts: list[dict] = Field(default_factory=list, alias="kernelElementDrafts")
    assumptions_log: list[dict] = Field(default_factory=list, alias="assumptionsLog")


class CommitConceptSeedCmd(BaseModel):
    """CON-V3-02 — transitions a ConceptSeedElem from draft → committed."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["commit_concept_seed"] = "commit_concept_seed"
    id: str
    envelope_tokens: list[dict] | None = Field(default=None, alias="envelopeTokens")
    kernel_element_drafts: list[dict] | None = Field(default=None, alias="kernelElementDrafts")
    assumptions_log: list[dict] | None = Field(default=None, alias="assumptionsLog")


class ConsumeConceptSeedCmd(BaseModel):
    """CON-V3-02 — T9 marks a seed as consumed after ingesting it."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["consume_concept_seed"] = "consume_concept_seed"
    id: str

