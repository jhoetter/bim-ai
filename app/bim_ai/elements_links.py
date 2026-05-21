"""Link, DXF, family, room separation, plan region, tag definition, join,
section, and elevation element models extracted from elements.py.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import DisciplineTag, Vec2Mm, Vec3Mm


class LinkModelElem(BaseModel):
    """FED-01: link to another bim-ai model in the same DB.

    The source's elements are treated as read-only renderable context. Snapshot
    expansion (``?expandLinks=true``) inlines them with provenance markers so
    renderers can ghost them. The load-bearing slice supports only
    ``origin_to_origin`` alignment; other modes are deferred to follow-up WPs.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["link_model"] = "link_model"
    id: str
    name: str = "Linked model"
    source_model_id: str = Field(alias="sourceModelId")
    source_model_revision: int | None = Field(default=None, alias="sourceModelRevision")
    position_mm: Vec3Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] = Field(
        default="origin_to_origin", alias="originAlignmentMode"
    )
    visibility_mode: Literal["host_view", "linked_view"] = Field(
        default="host_view", alias="visibilityMode"
    )
    hidden: bool = Field(default=False)
    pinned: bool = Field(default=False)


class DxfLineworkLine(BaseModel):
    """FED-04 — single straight line primitive in a DXF underlay."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["line"] = "line"
    start: Vec2Mm
    end: Vec2Mm
    layer_name: str | None = Field(default=None, alias="layerName")
    layer_color: str | None = Field(default=None, alias="layerColor")


class DxfLineworkPolyline(BaseModel):
    """FED-04 — open or closed polyline primitive in a DXF underlay."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["polyline"] = "polyline"
    points: list[Vec2Mm]
    closed: bool = False
    layer_name: str | None = Field(default=None, alias="layerName")
    layer_color: str | None = Field(default=None, alias="layerColor")


class DxfLineworkArc(BaseModel):
    """FED-04 — circular-arc primitive (centre + radius + sweep) in a DXF underlay.

    ``start_deg`` / ``end_deg`` follow the DXF convention (CCW from +X axis).
    For full circles the parser emits ``start_deg=0`` / ``end_deg=360``.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["arc"] = "arc"
    center: Vec2Mm
    radius_mm: float = Field(alias="radiusMm", gt=0)
    start_deg: float = Field(alias="startDeg")
    end_deg: float = Field(alias="endDeg")
    layer_name: str | None = Field(default=None, alias="layerName")
    layer_color: str | None = Field(default=None, alias="layerColor")


DxfLineworkPrim = Annotated[
    DxfLineworkLine | DxfLineworkPolyline | DxfLineworkArc,
    Field(discriminator="kind"),
]


class DxfLayerMeta(BaseModel):
    """F-019 — queryable DXF layer summary preserved on a link."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    name: str
    color: str | None = None
    primitive_count: int = Field(default=0, alias="primitiveCount", ge=0)


class LinkDxfElem(BaseModel):
    """FED-04 — DXF site-plan underlay attached to a host model level.

    The element holds a parsed list of 2D linework primitives (lines,
    polylines, arcs); the plan canvas renders them as a desaturated grey
    underlay on the active level so authoring snaps to the imported drawing
    without round-tripping through a shadow model. ``scale_factor`` carries
    the unit conversion the parser inferred from the DXF ``$INSUNITS``
    header so coordinates land in millimetres on import.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["link_dxf"] = "link_dxf"
    id: str
    name: str = "DXF Underlay"
    level_id: str = Field(alias="levelId")
    origin_mm: Vec2Mm = Field(alias="originMm")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] = Field(
        default="origin_to_origin", alias="originAlignmentMode"
    )
    unit_override: str | int | None = Field(default=None, alias="unitOverride")
    unit_scale_to_mm: float | None = Field(default=None, alias="unitScaleToMm", gt=0)
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale_factor: float = Field(default=1.0, alias="scaleFactor", gt=0)
    linework: list[DxfLineworkPrim] = Field(default_factory=list)
    dxf_layers: list[DxfLayerMeta] = Field(default_factory=list, alias="dxfLayers")
    hidden_layer_names: list[str] = Field(default_factory=list, alias="hiddenLayerNames")
    pinned: bool = Field(default=False)
    source_path: str | None = Field(default=None, alias="sourcePath")
    cad_reference_type: Literal["linked", "embedded"] = Field(
        default="linked", alias="cadReferenceType"
    )
    source_metadata: dict[str, Any] = Field(default_factory=dict, alias="sourceMetadata")
    reload_status: Literal["not_reloaded", "ok", "source_missing", "parse_error", "embedded"] = (
        Field(default="not_reloaded", alias="reloadStatus")
    )
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    loaded: bool = Field(default=True)
    color_mode: Literal["black_white", "custom", "native"] | None = Field(
        default=None, alias="colorMode"
    )
    custom_color: str | None = Field(default=None, alias="customColor")
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)


class ExternalLinkElem(BaseModel):
    """F-024 — generic IFC/PDF/image external-link row managed by Manage Links."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["link_external"] = "link_external"
    id: str
    name: str = "External link"
    external_link_type: Literal["ifc", "pdf", "image"] = Field(alias="externalLinkType")
    source_path: str = Field(alias="sourcePath")
    source_name: str | None = Field(default=None, alias="sourceName")
    source_metadata: dict[str, Any] = Field(default_factory=dict, alias="sourceMetadata")
    reload_status: Literal["not_reloaded", "ok", "source_missing", "parse_error"] = Field(
        default="not_reloaded", alias="reloadStatus"
    )
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    loaded: bool = Field(default=True)
    hidden: bool = Field(default=False)
    pinned: bool = Field(default=False)
    origin_mm: Vec2Mm | None = Field(default=None, alias="originMm")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] = Field(
        default="origin_to_origin", alias="originAlignmentMode"
    )
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale_factor: float = Field(default=1.0, alias="scaleFactor", gt=0)
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)


class FamilyCatalogSource(BaseModel):
    """FAM-08 — provenance for a family_type loaded from an external catalog."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    catalog_id: str = Field(alias="catalogId")
    family_id: str = Field(alias="familyId")
    version: str


class FamilyTypeElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["family_type"] = "family_type"
    id: str
    name: str = ""
    family_id: str = Field(default="", alias="familyId")
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
    catalog_source: FamilyCatalogSource | None = Field(default=None, alias="catalogSource")


class FamilyInstanceElem(BaseModel):
    """Placed instance of a project-loaded family_type."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["family_instance"] = "family_instance"
    id: str
    name: str = ""
    family_type_id: str = Field(alias="familyTypeId")
    level_id: str | None = Field(default=None, alias="levelId")
    host_view_id: str | None = Field(default=None, alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    param_values: dict[str, Any] = Field(default_factory=dict, alias="paramValues")
    host_element_id: str | None = Field(default=None, alias="hostElementId")
    host_along_t: float | None = Field(default=None, alias="hostAlongT")
    discipline: DisciplineTag | None = Field(default=None)


class RoomSeparationElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["room_separation"] = "room_separation"
    id: str
    name: str = "Room separator"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm
    pinned: bool = Field(default=False)


class PlanRegionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["plan_region"] = "plan_region"
    id: str
    name: str = "Plan region"
    level_id: str = Field(alias="levelId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")
    cut_plane_offset_mm: float = Field(alias="cutPlaneOffsetMm", default=-500)


class TagDefinitionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["tag_definition"] = "tag_definition"
    id: str
    name: str = "Tag"
    tag_kind: Literal["room", "sill", "slab_finish", "custom"] = Field(
        default="custom", alias="tagKind"
    )
    discipline: str = Field(default="architecture")


class JoinGeometryElem(BaseModel):
    """Lightweight deterministic join bookkeeping (corner / abut refs)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["join_geometry"] = "join_geometry"
    id: str
    joined_element_ids: list[str] = Field(alias="joinedElementIds")
    notes: str = ""


class SectionCutElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["section_cut"] = "section_cut"
    id: str
    name: str = "Section"
    line_start_mm: Vec2Mm = Field(alias="lineStartMm")
    line_end_mm: Vec2Mm = Field(alias="lineEndMm")
    crop_depth_mm: float = Field(default=8500, alias="cropDepthMm")
    segmented_path_mm: list[Vec2Mm] = Field(default_factory=list, alias="segmentedPathMm")
    pinned: bool = Field(default=False)


ElevationDirection = Literal["north", "south", "east", "west", "custom"]


class ElevationViewElem(BaseModel):
    """VIE-03 — first-class N/S/E/W elevation view, sibling to section_cut.

    Reuses the section_cut projection pipeline via the
    `elevation_view_to_section_params` helper (see section_projection_primitives).
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["elevation_view"] = "elevation_view"
    id: str
    name: str = "Elevation"
    direction: ElevationDirection = "north"
    custom_angle_deg: float | None = Field(default=None, alias="customAngleDeg")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    scale: float = Field(default=100.0)
    plan_detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="planDetailLevel"
    )
    marker_group_id: str | None = Field(default=None, alias="markerGroupId")
    marker_slot: ElevationDirection | None = Field(default=None, alias="markerSlot")
    pinned: bool = Field(default=False)


PlanTagTarget = Literal["opening", "room"]
PlanTagBadgeStyle = Literal["none", "rounded", "flag"]

