"""Site / project-coords / link / clash command models.

UpsertSite, project base points, survey points, property lines (KRN-01),
link_model (FED-01), link_dxf (FED-04), external links (F-024), selection
sets + clash tests (FED-02), monitored-element reconcile (FED-03).

BRT-22 split — these classes used to live in ``app/bim_ai/commands.py``.
Note: ``commands_site.py`` (the legacy sibling) hosts the toposolid /
graded-region commands; those are re-exported from the barrel directly and
are not duplicated here.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import (
    DxfLayerMeta,
    DxfLineworkPrim,
    SiteContextObjectRow,
    Vec2Mm,
    Vec3Mm,
)


class UpsertSiteCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSite"] = "upsertSite"
    id: str
    name: str = "Site"
    reference_level_id: str = Field(alias="referenceLevelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    pad_thickness_mm: float = Field(alias="padThicknessMm", default=80.0)
    base_offset_mm: float = Field(default=0.0, alias="baseOffsetMm")
    north_deg_cw_from_plan_x: float | None = Field(default=None, alias="northDegCwFromPlanX")
    uniform_setback_mm: float | None = Field(default=None, alias="uniformSetbackMm")
    context_objects: list[SiteContextObjectRow] = Field(
        default_factory=list, alias="contextObjects"
    )


# --- KRN-06: Origin element commands ----------------------------------------


class CreateProjectBasePointCmd(BaseModel):
    """Create the (singleton) project base point. Rejects if one already exists."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createProjectBasePoint"] = "createProjectBasePoint"
    id: str | None = None
    position_mm: Vec3Mm = Field(alias="positionMm")
    angle_to_true_north_deg: float = Field(default=0.0, alias="angleToTrueNorthDeg")
    clipped: bool = False


class MoveProjectBasePointCmd(BaseModel):
    """Move the project base point. Translates rendering / shared coords; geometry unchanged."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveProjectBasePoint"] = "moveProjectBasePoint"
    position_mm: Vec3Mm = Field(alias="positionMm")


class RotateProjectBasePointCmd(BaseModel):
    """Rotate the project base point's true-north angle (degrees)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["rotateProjectBasePoint"] = "rotateProjectBasePoint"
    angle_to_true_north_deg: float = Field(alias="angleToTrueNorthDeg")


class CreateSurveyPointCmd(BaseModel):
    """Create the (singleton) survey point. Rejects if one already exists."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSurveyPoint"] = "createSurveyPoint"
    id: str | None = None
    position_mm: Vec3Mm = Field(alias="positionMm")
    shared_elevation_mm: float = Field(default=0.0, alias="sharedElevationMm")
    clipped: bool = False


class MoveSurveyPointCmd(BaseModel):
    """Move the survey point. Translates shared-coords output; geometry unchanged."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveSurveyPoint"] = "moveSurveyPoint"
    position_mm: Vec3Mm = Field(alias="positionMm")
    shared_elevation_mm: float | None = Field(default=None, alias="sharedElevationMm")


# --- KRN-01: property lines --------------------------------------------------

PropertyLineClassificationCmd = Literal["street", "rear", "side", "other"]


class CreatePropertyLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPropertyLine"] = "createPropertyLine"
    id: str | None = None
    name: str = ""
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    setback_mm: float | None = Field(default=None, alias="setbackMm", ge=0)
    classification: PropertyLineClassificationCmd | None = None
    authoring_mode: Literal["draw", "bearing_table"] = Field(default="draw", alias="authoringMode")
    bearing_table: dict[str, Any] | None = Field(default=None, alias="bearingTable")


class UpdatePropertyLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePropertyLine"] = "updatePropertyLine"
    property_line_id: str = Field(alias="propertyLineId")
    name: str | None = None
    start_mm: Vec2Mm | None = Field(default=None, alias="startMm")
    end_mm: Vec2Mm | None = Field(default=None, alias="endMm")
    setback_mm: float | None = Field(default=None, alias="setbackMm", ge=0)
    classification: PropertyLineClassificationCmd | None = None
    authoring_mode: Literal["draw", "bearing_table"] | None = Field(
        default=None, alias="authoringMode"
    )
    bearing_table: dict[str, Any] | None = Field(default=None, alias="bearingTable")


class DeletePropertyLineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deletePropertyLine"] = "deletePropertyLine"
    property_line_id: str = Field(alias="propertyLineId")


# --- FED-01: link_model commands ---------------------------------------------


class CreateLinkModelCmd(BaseModel):
    """FED-01: insert a ``link_model`` element pointing at another bim-ai model.

    Engine-level validation rejects empty ``sourceModelId`` and self-reference
    (``sourceModelId`` matching this link's own id). Existence in DB and
    circular-link BFS are validated by the route handler that has DB access.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createLinkModel"] = "createLinkModel"
    id: str | None = None
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


class UpdateLinkModelCmd(BaseModel):
    """FED-01: update position / rotation / hidden / pinned on a ``link_model``."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateLinkModel"] = "updateLinkModel"
    link_id: str = Field(alias="linkId")
    name: str | None = None
    position_mm: Vec3Mm | None = Field(default=None, alias="positionMm")
    rotation_deg: float | None = Field(default=None, alias="rotationDeg")
    hidden: bool | None = None
    pinned: bool | None = None
    source_model_revision: int | None = Field(default=None, alias="sourceModelRevision")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] | None = (
        Field(default=None, alias="originAlignmentMode")
    )
    visibility_mode: Literal["host_view", "linked_view"] | None = Field(
        default=None, alias="visibilityMode"
    )


class DeleteLinkModelCmd(BaseModel):
    """FED-01: remove a ``link_model``. The source model is untouched."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteLinkModel"] = "deleteLinkModel"
    link_id: str = Field(alias="linkId")


class CreateLinkDxfCmd(BaseModel):
    """FED-04: create a ``link_dxf`` element from parsed DXF linework.

    Mirrors :class:`bim_ai.elements.LinkDxfElem` minus ``kind`` plus an
    optional ``id`` (the engine assigns one when omitted). The route
    handler runs ``parse_dxf_to_linework`` then dispatches this command
    through ``try_commit_bundle`` so the import is undoable.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createLinkDxf"] = "createLinkDxf"
    id: str | None = None
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


class UpdateLinkDxfCmd(BaseModel):
    """FED-04 / F-017 / F-020: update display properties on a ``link_dxf`` element.

    All fields are optional; only supplied fields are applied. Allows the
    frontend ``ManageLinksDialog`` to persist per-link opacity and color-mode
    settings without re-uploading the full linework payload.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateLinkDxf"] = "updateLinkDxf"
    link_id: str = Field(alias="linkId")
    color_mode: Literal["black_white", "custom", "native"] | None = Field(
        default=None, alias="colorMode"
    )
    custom_color: str | None = Field(default=None, alias="customColor")
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)
    hidden_layer_names: list[str] | None = Field(default=None, alias="hiddenLayerNames")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] | None = (
        Field(default=None, alias="originAlignmentMode")
    )
    unit_override: str | int | None = Field(default=None, alias="unitOverride")
    unit_scale_to_mm: float | None = Field(default=None, alias="unitScaleToMm", gt=0)
    linework: list[DxfLineworkPrim] | None = Field(default=None)
    dxf_layers: list[DxfLayerMeta] | None = Field(default=None, alias="dxfLayers")
    source_path: str | None = Field(default=None, alias="sourcePath")
    cad_reference_type: Literal["linked", "embedded"] | None = Field(
        default=None, alias="cadReferenceType"
    )
    source_metadata: dict[str, Any] | None = Field(default=None, alias="sourceMetadata")
    reload_status: (
        Literal["not_reloaded", "ok", "source_missing", "parse_error", "embedded"] | None
    ) = Field(default=None, alias="reloadStatus")
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    reload_source: bool = Field(default=False, alias="reloadSource")
    loaded: bool | None = Field(default=None)


class CreateExternalLinkCmd(BaseModel):
    """F-024: create a generic IFC/PDF/image external-link row."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createExternalLink"] = "createExternalLink"
    id: str | None = None
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


class UpdateExternalLinkCmd(BaseModel):
    """F-024: update generic IFC/PDF/image external-link metadata and controls."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateExternalLink"] = "updateExternalLink"
    link_id: str = Field(alias="linkId")
    name: str | None = None
    source_path: str | None = Field(default=None, alias="sourcePath")
    source_name: str | None = Field(default=None, alias="sourceName")
    source_metadata: dict[str, Any] | None = Field(default=None, alias="sourceMetadata")
    reload_status: Literal["not_reloaded", "ok", "source_missing", "parse_error"] | None = Field(
        default=None, alias="reloadStatus"
    )
    last_reload_message: str | None = Field(default=None, alias="lastReloadMessage")
    reload_source: bool = Field(default=False, alias="reloadSource")
    loaded: bool | None = Field(default=None)
    hidden: bool | None = Field(default=None)
    pinned: bool | None = Field(default=None)
    origin_mm: Vec2Mm | None = Field(default=None, alias="originMm")
    origin_alignment_mode: Literal["origin_to_origin", "project_origin", "shared_coords"] | None = (
        Field(default=None, alias="originAlignmentMode")
    )
    rotation_deg: float | None = Field(default=None, alias="rotationDeg")
    scale_factor: float | None = Field(default=None, alias="scaleFactor", gt=0)
    overlay_opacity: float | None = Field(default=None, alias="overlayOpacity", ge=0.0, le=1.0)


class DeleteExternalLinkCmd(BaseModel):
    """F-024: remove a generic IFC/PDF/image external-link row."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteExternalLink"] = "deleteExternalLink"
    link_id: str = Field(alias="linkId")


# --- FED-02: selection_set + clash_test commands ----------------------------


class SelectionSetRuleCmd(BaseModel):
    """FED-02: a single filter rule passed in a ``selection_set`` upsert.

    See ``SelectionSetRuleSpec`` in ``elements.py`` for field semantics.
    ``link_scope`` accepts ``'host'``, ``'all_links'``, or
    ``{ 'specificLinkId': '<link-id>' }``.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    field: Literal["category", "level", "typeName"]
    operator: Literal["equals", "contains"]
    value: str
    link_scope: str | dict[str, str] | None = Field(default=None, alias="linkScope")


class UpsertSelectionSetCmd(BaseModel):
    """FED-02: create or replace a ``selection_set`` element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSelectionSet"] = "upsertSelectionSet"
    id: str | None = None
    name: str = "Selection Set"
    filter_rules: list[SelectionSetRuleCmd] = Field(default_factory=list, alias="filterRules")


class UpsertClashTestCmd(BaseModel):
    """FED-02: create or replace a ``clash_test`` element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertClashTest"] = "upsertClashTest"
    id: str | None = None
    name: str = "Clash Test"
    set_a_ids: list[str] = Field(default_factory=list, alias="setAIds")
    set_b_ids: list[str] = Field(default_factory=list, alias="setBIds")
    tolerance_mm: float = Field(default=0.0, alias="toleranceMm")


class RunClashTestCmd(BaseModel):
    """FED-02: run a ``clash_test`` and persist the results onto the element.

    The engine resolves each referenced selection set across its rules'
    ``link_scope`` (host, all linked models, or one specific link), transforms
    linked AABBs by the link's positionMm + rotationDeg, and computes
    pair-wise clashes within ``tolerance_mm``. Results carry a ``link_chain``
    identifying each element's source link (empty for host).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["runClashTest"] = "runClashTest"
    clash_test_id: str = Field(alias="clashTestId")


# --- FED-03: cross-link Copy/Monitor commands -------------------------------


class BumpMonitoredRevisionsCmd(BaseModel):
    """FED-03: walk every monitored element and re-evaluate drift.

    For each element carrying ``monitor_source``, the engine looks up the
    source element (through ``link_id`` for cross-link monitors, else
    intra-host), compares the monitored fields, and writes ``drifted`` +
    ``drifted_fields`` back onto the host element. Drifted elements then
    surface as ``monitored_source_drift`` advisories.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["bumpMonitoredRevisions"] = "bumpMonitoredRevisions"


class ReconcileMonitoredElementCmd(BaseModel):
    """FED-03: resolve drift on a single monitored element.

    ``mode`` is either ``'accept_source'`` (overwrite host fields with the
    current source values; clears ``drifted``) or ``'keep_host'`` (bump
    ``source_revision_at_copy`` to the source's current revision and clear
    ``drifted`` without touching host fields).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reconcileMonitoredElement"] = "reconcileMonitoredElement"
    element_id: str = Field(alias="elementId")
    mode: Literal["accept_source", "keep_host"]
