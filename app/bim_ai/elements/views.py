"""View, sheet, schedule, plan-view and template element models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import (
    CameraMm,
    EvidenceRef,
    LensMode,
    PhaseFilter,
    PlanDetailLevelPlan,
    Vec2Mm,
    Vec3Mm,
    ViewTemplateControlledField,
)
from bim_ai.elements_links import PlanTagBadgeStyle, PlanTagTarget

from ._shared import (
    ViewTemplateFieldControl,
    default_view_template_control_matrix,
)
from .rooms import AreaScheme

ViewpointCutawayStyle = Literal["none", "cap", "floor", "box"]


class ViewpointElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["viewpoint"] = "viewpoint"
    id: str
    name: str = "View"
    camera: CameraMm
    mode: Literal["plan_2d", "orbit_3d", "plan_canvas"] = "orbit_3d"
    viewer_clip_cap_elev_mm: float | None = Field(default=None, alias="viewerClipCapElevMm")
    viewer_clip_floor_elev_mm: float | None = Field(default=None, alias="viewerClipFloorElevMm")
    hidden_semantic_kinds_3d: list[str] = Field(default_factory=list, alias="hiddenSemanticKinds3d")
    cutaway_style: ViewpointCutawayStyle | None = Field(default=None, alias="cutawayStyle")
    plan_overlay_enabled: bool = Field(default=False, alias="planOverlayEnabled")
    plan_overlay_source_plan_view_id: str | None = Field(
        default=None, alias="planOverlaySourcePlanViewId"
    )
    plan_overlay_offset_mm: float | None = Field(default=None, alias="planOverlayOffsetMm")
    plan_overlay_opacity: float | None = Field(default=None, alias="planOverlayOpacity")
    plan_overlay_line_opacity: float | None = Field(default=None, alias="planOverlayLineOpacity")
    plan_overlay_fill_opacity: float | None = Field(default=None, alias="planOverlayFillOpacity")
    plan_overlay_annotations_visible: bool | None = Field(
        default=None, alias="planOverlayAnnotationsVisible"
    )
    plan_overlay_witness_lines_visible: bool | None = Field(
        default=None, alias="planOverlayWitnessLinesVisible"
    )
    section_box_enabled: bool | None = Field(default=None, alias="sectionBoxEnabled")
    section_box_min_mm: Vec3Mm | None = Field(default=None, alias="sectionBoxMinMm")
    section_box_max_mm: Vec3Mm | None = Field(default=None, alias="sectionBoxMaxMm")
    option_locks: dict[str, str] = Field(default_factory=dict, alias="optionLocks")


class IssueElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["issue"] = "issue"
    id: str
    title: str
    issue_type: str = Field(default="coordination_issue", alias="issueType")
    severity: str = "warning"
    responsible_discipline: str = Field(default="coordination", alias="responsibleDiscipline")
    responsible_team: str | None = Field(default=None, alias="responsibleTeam")
    status: Literal[
        "open",
        "in_progress",
        "reviewed",
        "resolved",
        "closed",
        "done",
        "not_an_issue",
    ] = "open"
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    viewpoint_id: str | None = Field(default=None, alias="viewpointId")
    assignee_placeholder: str | None = Field(default=None, alias="assigneePlaceholder")
    due_date: str | None = Field(default=None, alias="dueDate")
    resolution_history: list[dict[str, Any]] = Field(
        default_factory=list, alias="resolutionHistory"
    )
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


class PlanTagStyleElem(BaseModel):
    """Replayable catalog entry for plan opening tags / room labels (view-template slice)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["plan_tag_style"] = "plan_tag_style"
    id: str
    name: str = "Plan tag style"
    tag_target: PlanTagTarget = Field(alias="tagTarget")
    label_fields: list[str] = Field(default_factory=list, alias="labelFields")
    text_size_pt: float = Field(default=10.0, alias="textSizePt", gt=0)
    leader_visible: bool = Field(default=True, alias="leaderVisible")
    badge_style: PlanTagBadgeStyle = Field(default="none", alias="badgeStyle")
    color_token: str = Field(default="default", alias="colorToken")
    sort_key: int = Field(default=0, alias="sortKey")


PlanCategoryGraphicCategoryKey = Literal[
    "wall",
    "floor",
    "roof",
    "room",
    "door",
    "window",
    "stair",
    "grid_line",
    "room_separation",
    "dimension",
]

PlanLinePatternTokenPlan = Literal["solid", "dash_short", "dash_long", "dot"]
PlanViewSubtypePlan = Literal[
    "floor_plan",
    "area_plan",
    "lighting_plan",
    "power_plan",
    "coordination_plan",
    "callout",
    "ceiling_plan",
    "drafting",
]


class PlanCategoryGraphicRow(BaseModel):
    """Per-category plan line weight factor and line pattern token (template + plan_view override)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    category_key: PlanCategoryGraphicCategoryKey = Field(alias="categoryKey")
    line_weight_factor: float | None = Field(default=None, alias="lineWeightFactor", gt=0, le=3)
    line_pattern_token: PlanLinePatternTokenPlan | None = Field(
        default=None, alias="linePatternToken"
    )


class PlanViewElem(BaseModel):
    """First-class floor-plan view artifact (Revit-like plan definitions)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["plan_view"] = "plan_view"
    id: str
    name: str = "Plan view"
    level_id: str = Field(alias="levelId")
    view_template_id: str | None = Field(default=None, alias="viewTemplateId")
    plan_presentation: Literal["default", "opening_focus", "room_scheme"] = Field(
        default="default",
        alias="planPresentation",
    )
    underlay_level_id: str | None = Field(default=None, alias="underlayLevelId")
    discipline: str = Field(default="architecture", alias="discipline")
    view_subdiscipline: str | None = Field(default=None, alias="viewSubdiscipline")
    phase_id: str | None = Field(default=None, alias="phaseId")
    phase_filter: PhaseFilter = Field(default="all", alias="phaseFilter")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    crop_enabled: bool | None = Field(default=None, alias="cropEnabled")
    crop_region_visible: bool | None = Field(default=None, alias="cropRegionVisible")
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")
    cut_plane_offset_mm: float | None = Field(default=None, alias="cutPlaneOffsetMm")
    categories_hidden: list[str] = Field(default_factory=list, alias="categoriesHidden")
    hidden_element_ids: list[str] = Field(default_factory=list, alias="hiddenElementIds")
    plan_detail_level: PlanDetailLevelPlan | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(
        default=None, alias="planRoomFillOpacityScale"
    )
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    plan_opening_tag_style_id: str | None = Field(default=None, alias="planOpeningTagStyleId")
    plan_room_tag_style_id: str | None = Field(default=None, alias="planRoomTagStyleId")
    plan_category_graphics: list[PlanCategoryGraphicRow] = Field(
        default_factory=list,
        alias="planCategoryGraphics",
    )
    option_locks: dict[str, str] = Field(default_factory=dict, alias="optionLocks")
    # VIE-V3-03: new-style template binding (distinct from view_template_id / viewTemplateId)
    template_id: str | None = Field(default=None, alias="templateId")
    scale: int | None = Field(default=None)
    element_overrides: list[dict] = Field(default_factory=list, alias="elementOverrides")
    # DSC-V3-02: per-view discipline lens; does not mutate element discipline
    default_lens: LensMode = Field(default="show_all", alias="defaultLens")
    # F-028/F-098: Revit-like plan subtype and area scheme metadata.
    plan_view_subtype: PlanViewSubtypePlan | None = Field(default=None, alias="planViewSubtype")
    area_scheme: AreaScheme = Field(default="gross_building", alias="areaScheme")


class ViewTemplateElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["view_template"] = "view_template"
    id: str
    name: str = "View template"
    scale: str | int | None = Field(default=None, alias="scale")
    disciplines_visible: list[str] = Field(default_factory=list, alias="disciplinesVisible")
    hidden_categories: list[str] = Field(default_factory=list, alias="hiddenCategories")
    plan_detail_level: PlanDetailLevelPlan | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        alias="planRoomFillOpacityScale",
    )
    plan_show_opening_tags: bool = Field(default=False, alias="planShowOpeningTags")
    plan_show_room_labels: bool = Field(default=False, alias="planShowRoomLabels")
    default_plan_opening_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanOpeningTagStyleId"
    )
    default_plan_room_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanRoomTagStyleId"
    )
    plan_category_graphics: list[PlanCategoryGraphicRow] = Field(
        default_factory=list,
        alias="planCategoryGraphics",
    )
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")
    # VIE-V3-03: view template v3 fields
    detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="detailLevel"
    )
    crop_default: dict | None = Field(default=None, alias="cropDefault")
    visibility_filters: list[dict] = Field(default_factory=list, alias="visibilityFilters")
    element_overrides: list[dict] = Field(default_factory=list, alias="elementOverrides")
    phase: str | None = Field(default=None)
    phase_filter: str | None = Field(default=None, alias="phaseFilter")
    template_control_matrix: dict[ViewTemplateControlledField, ViewTemplateFieldControl] = Field(
        default_factory=default_view_template_control_matrix,
        alias="templateControlMatrix",
    )


class SheetXY(BaseModel):
    """Sheet-space 2D coordinate (mm from sheet origin)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    x: float
    y: float


class ViewPlacement(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    view_id: str = Field(alias="viewId")
    min_xy: SheetXY = Field(alias="minXY")
    size: SheetXY
    scale: int | None = Field(default=None)


class SheetMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    project_name: str = Field(default="", alias="projectName")
    drawn_by: str = Field(default="", alias="drawnBy")
    checked_by: str = Field(default="", alias="checkedBy")
    date: str = Field(default="")
    revision: str = Field(default="")


class SheetElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["sheet"] = "sheet"
    id: str
    name: str = "Sheet"
    number: str = Field(default="")
    size: Literal["A0", "A1", "A2", "A3"] = Field(default="A1")
    orientation: Literal["landscape", "portrait"] = Field(default="landscape")
    titleblock_type_id: str = Field(default="default-a1-titleblock", alias="titleblockTypeId")
    revision_id: str | None = Field(default=None, alias="revisionId")
    view_placements: list[ViewPlacement] = Field(default_factory=list, alias="viewPlacements")
    metadata: SheetMetadata = Field(default_factory=SheetMetadata)
    brand_template_id: str | None = Field(default=None, alias="brandTemplateId")
    # Legacy v2 fields — preserved so old documents round-trip unchanged
    title_block: str | None = Field(default=None, alias="titleBlock")
    viewports_mm: list[dict[str, Any]] = Field(default_factory=list, alias="viewportsMm")
    paper_width_mm: float = Field(default=42_000, alias="paperWidthMm")
    paper_height_mm: float = Field(default=29_700, alias="paperHeightMm")
    titleblock_parameters: dict[str, str] = Field(
        default_factory=dict, alias="titleblockParameters"
    )


class ScheduleElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["schedule"] = "schedule"
    id: str
    name: str = "Schedule"
    sheet_id: str | None = Field(default=None, alias="sheetId")
    filters: dict[str, Any] = Field(default_factory=dict)
    grouping: dict[str, Any] = Field(default_factory=dict)
    # SCH-V3-01: custom schedule-view fields
    category: str | None = Field(default=None)
    columns: list[dict] = Field(default_factory=list)
    filter_expr: str | None = Field(default=None, alias="filterExpr")
    sort_key: str | None = Field(default=None, alias="sortKey")
    sort_dir: Literal["asc", "desc"] | None = Field(default=None, alias="sortDir")


class CalloutElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["callout"] = "callout"
    id: str
    name: str = "Callout"
    parent_sheet_id: str = Field(alias="parentSheetId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")


class MaskingRegionElem(BaseModel):
    """KRN-10 — view-local 2D filled region that occludes underlying linework.

    Renders on plan / section / elevation as an opaque polygon above element
    linework but below text/dimension annotations. Not visible in 3D.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["masking_region"] = "masking_region"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    void_boundaries_mm: list[list[Vec2Mm]] = Field(default_factory=list, alias="voidBoundariesMm")
    fill_color: str = Field(default="#ffffff", alias="fillColor")


# ---------------------------------------------------------------------------
# VIE-V3-02 — Drafting view + callout + cut-profile + view-break models
# ---------------------------------------------------------------------------


class XY(BaseModel):
    """Plain 2D coordinate (no mm suffix) — used for clip rect corners and break axes."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    x: float
    y: float


class ClipRect(BaseModel):
    """Clip rectangle for callout sub-views (model coordinates)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    min_xy: XY = Field(alias="minXY")
    max_xy: XY = Field(alias="maxXY")


class ElementOverrideSpec(BaseModel):
    """Per-view per-category cut-profile override (singleLine | outline | css-var)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    category_or_id: str = Field(alias="categoryOrId")
    alternate_render: str = Field(alias="alternateRender")


class ViewBreakSpec(BaseModel):
    """A single view-break gap in a long elevation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    axis_mm: float = Field(alias="axisMM")
    width_mm: float = Field(alias="widthMM", gt=0)


class ViewElem(BaseModel):
    """VIE-V3-02 — unified view element for drafting views, callouts, and 2D detailing.

    Drafting views (subKind='drafting') bypass the projection pipeline entirely;
    they contain only annotation, detail components, and filled regions.
    Callout views (subKind='callout') inherit the parent's projection matrix but
    clip to `clipRectInParent`.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["view"] = "view"
    id: str
    name: str = "View"
    sub_kind: Literal["plan", "section", "elevation", "drafting", "callout", "3d"] = Field(
        default="plan", alias="subKind"
    )
    parent_view_id: str | None = Field(default=None, alias="parentViewId")
    clip_rect_in_parent: ClipRect | None = Field(default=None, alias="clipRectInParent")
    element_overrides: list[ElementOverrideSpec] = Field(
        default_factory=list, alias="elementOverrides"
    )
    breaks: list[ViewBreakSpec] = Field(default_factory=list)
    scale: float = Field(default=100.0, gt=0)
    detail_level: Literal["coarse", "medium", "fine"] = Field(default="medium", alias="detailLevel")
    # DSC-V3-02: per-view discipline lens; does not mutate element discipline
    default_lens: LensMode = Field(default="show_all", alias="defaultLens")


class WindowLegendViewElem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["window_legend_view"] = "window_legend_view"
    id: str
    name: str
    scope: Literal["all", "sheet", "project"] = "project"
    sort_by: Literal["type", "width", "count"] = Field(default="type", alias="sortBy")
    parent_sheet_id: str | None = Field(default=None, alias="parentSheetId")
