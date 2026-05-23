"""Schedule / sheet / view-template / plan-view command models.

Covers UpsertSchedule*, UpsertSheet*, view templates (legacy + V3), plan-view
upserts/updates, plan-tag styles, area-scheme literals, drafting-view, callout
views, sheet placement / metadata, window legend views.

BRT-22 split — these classes used to live in ``app/bim_ai/commands.py``.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import (
    ClipRect,
    PlanCategoryGraphicRow,
    PlanTagBadgeStyle,
    PlanTagTarget,
    Vec2Mm,
)


class UpsertTagDefinitionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertTagDefinition"] = "upsertTagDefinition"
    id: str | None = None
    name: str = "Tag"
    tag_kind: str = Field(alias="tagKind", default="custom")
    discipline: str = Field(default="architecture")


class UpsertViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertViewTemplate"] = "upsertViewTemplate"
    id: str | None = None
    name: str = "Template"
    scale: str = Field(alias="scale", default="scale_100")
    disciplines_visible: list[str] = Field(default_factory=list, alias="disciplinesVisible")
    hidden_categories: list[str] = Field(default_factory=list, alias="hiddenCategories")
    plan_detail_level: str | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(
        default=None, alias="planRoomFillOpacityScale"
    )
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    default_plan_opening_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanOpeningTagStyleId"
    )
    default_plan_room_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanRoomTagStyleId"
    )
    plan_category_graphics: list[PlanCategoryGraphicRow] | None = Field(
        default=None,
        alias="planCategoryGraphics",
    )


class UpsertPlanViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertPlanViewTemplate"] = "upsertPlanViewTemplate"
    id: str | None = None
    name: str = "Plan view template"
    scale: str = Field(alias="scale", default="scale_100")
    disciplines_visible: list[str] = Field(default_factory=list, alias="disciplinesVisible")
    hidden_categories: list[str] = Field(default_factory=list, alias="hiddenCategories")
    plan_detail_level: str | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(
        default=None, alias="planRoomFillOpacityScale"
    )
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    default_plan_opening_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanOpeningTagStyleId"
    )
    default_plan_room_tag_style_id: str | None = Field(
        default=None, alias="defaultPlanRoomTagStyleId"
    )
    plan_category_graphics: list[PlanCategoryGraphicRow] | None = Field(
        default=None,
        alias="planCategoryGraphics",
    )
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")


class ApplyPlanViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["applyPlanViewTemplate"] = "applyPlanViewTemplate"
    plan_view_id: str = Field(alias="planViewId")
    template_id: str = Field(alias="templateId")


class UpdatePlanViewCropCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePlanViewCrop"] = "updatePlanViewCrop"
    plan_view_id: str = Field(alias="planViewId")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")


class UpdatePlanViewRangeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePlanViewRange"] = "updatePlanViewRange"
    plan_view_id: str = Field(alias="planViewId")
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")


class UpsertPlanTagStyleCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertPlanTagStyle"] = "upsertPlanTagStyle"
    id: str | None = None
    name: str = "Plan tag style"
    tag_target: PlanTagTarget = Field(alias="tagTarget")
    label_fields: list[str] = Field(default_factory=list, alias="labelFields")
    text_size_pt: float = Field(default=10.0, alias="textSizePt", gt=0)
    leader_visible: bool = Field(default=True, alias="leaderVisible")
    badge_style: PlanTagBadgeStyle = Field(default="none", alias="badgeStyle")
    color_token: str = Field(default="default", alias="colorToken")
    sort_key: int = Field(default=0, alias="sortKey")


class UpsertSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSheet"] = "upsertSheet"
    id: str | None = None
    name: str = "Sheet"
    title_block: str | None = Field(default=None, alias="titleBlock")
    paper_width_mm: float | None = Field(default=None, alias="paperWidthMm")
    paper_height_mm: float | None = Field(default=None, alias="paperHeightMm")
    titleblock_parameters: dict[str, str] | None = Field(default=None, alias="titleblockParameters")


class UpsertSheetViewportsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSheetViewports"] = "upsertSheetViewports"
    sheet_id: str = Field(alias="sheetId")
    viewports_mm: list[dict[str, Any]] = Field(alias="viewportsMm", default_factory=list)


class UpsertScheduleCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertSchedule"] = "upsertSchedule"
    id: str | None = None
    name: str = "Schedule"
    sheet_id: str | None = Field(default=None, alias="sheetId")
    filters: dict[str, Any] = Field(default_factory=dict)
    grouping: dict[str, Any] = Field(default_factory=dict)


class UpsertScheduleFiltersCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertScheduleFilters"] = "upsertScheduleFilters"
    schedule_id: str = Field(alias="scheduleId")
    filters: dict[str, Any]
    grouping: dict[str, Any] | None = None


class UpsertRoomVolumeCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertRoomVolume"] = "upsertRoomVolume"
    room_id: str = Field(alias="roomId")
    upper_limit_level_id: str | None = Field(default=None, alias="upperLimitLevelId")
    volume_ceiling_offset_mm: float | None = Field(default=None, alias="volumeCeilingOffsetMm")


AreaSchemeCmd = Literal["gross_building", "net", "rentable"]
PlanViewSubtypeCmd = Literal[
    "floor_plan",
    "area_plan",
    "lighting_plan",
    "power_plan",
    "coordination_plan",
    "callout",
    "ceiling_plan",
    "drafting",
]


class UpsertPlanViewCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertPlanView"] = "upsertPlanView"
    id: str | None = None
    name: str = "Plan view"
    level_id: str = Field(alias="levelId")
    view_template_id: str | None = Field(default=None, alias="viewTemplateId")
    plan_presentation: Literal["default", "opening_focus", "room_scheme"] = Field(
        default="default",
        alias="planPresentation",
    )
    underlay_level_id: str | None = Field(default=None, alias="underlayLevelId")
    discipline: str = "architecture"
    view_subdiscipline: str | None = Field(default=None, alias="viewSubdiscipline")
    plan_view_subtype: PlanViewSubtypeCmd | None = Field(default=None, alias="planViewSubtype")
    area_scheme: AreaSchemeCmd = Field(default="gross_building", alias="areaScheme")
    phase_id: str | None = Field(default=None, alias="phaseId")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")
    cut_plane_offset_mm: float | None = Field(default=None, alias="cutPlaneOffsetMm")
    categories_hidden: list[str] = Field(default_factory=list, alias="categoriesHidden")
    plan_detail_level: str | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(
        default=None, alias="planRoomFillOpacityScale"
    )
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    plan_opening_tag_style_id: str | None = Field(default=None, alias="planOpeningTagStyleId")
    plan_room_tag_style_id: str | None = Field(default=None, alias="planRoomTagStyleId")
    plan_category_graphics: list[PlanCategoryGraphicRow] | None = Field(
        default=None,
        alias="planCategoryGraphics",
    )


# --- VIE-V3-03: view template v3 commands ------------------------------------


class CreateViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateViewTemplate"] = "CreateViewTemplate"
    template_id: str = Field(alias="templateId")
    name: str
    scale: int | None = Field(default=None)
    detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="detailLevel"
    )
    element_overrides: list[dict] = Field(default_factory=list, alias="elementOverrides")
    phase: str | None = Field(default=None)
    phase_filter: str | None = Field(default=None, alias="phaseFilter")
    template_control_matrix: dict[str, Any] | None = Field(
        default=None, alias="templateControlMatrix"
    )


class UpdateViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateViewTemplate"] = "UpdateViewTemplate"
    template_id: str = Field(alias="templateId")
    name: str | None = Field(default=None)
    scale: int | None = Field(default=None)
    detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="detailLevel"
    )
    element_overrides: list[dict] | None = Field(default=None, alias="elementOverrides")
    phase: str | None = Field(default=None)
    phase_filter: str | None = Field(default=None, alias="phaseFilter")
    template_control_matrix: dict[str, Any] | None = Field(
        default=None, alias="templateControlMatrix"
    )


class ApplyViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["ApplyViewTemplate"] = "ApplyViewTemplate"
    view_id: str = Field(alias="viewId")
    template_id: str = Field(alias="templateId")


class UnbindViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UnbindViewTemplate"] = "UnbindViewTemplate"
    view_id: str = Field(alias="viewId")


class DeleteViewTemplateCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteViewTemplate"] = "DeleteViewTemplate"
    template_id: str = Field(alias="templateId")


class CreateSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateSheet"] = "CreateSheet"
    sheet_id: str = Field(alias="sheetId")
    name: str
    number: str
    size: Literal["A0", "A1", "A2", "A3"] = "A1"
    orientation: Literal["landscape", "portrait"] = "landscape"
    titleblock_type_id: str = Field(default="default-a1-titleblock", alias="titleblockTypeId")
    metadata: dict = Field(default_factory=dict)


class PlaceViewOnSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["PlaceViewOnSheet"] = "PlaceViewOnSheet"
    sheet_id: str = Field(alias="sheetId")
    view_id: str = Field(alias="viewId")
    min_xy: dict = Field(alias="minXY")
    size: dict
    scale: int | None = Field(default=None)


class MoveViewOnSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["MoveViewOnSheet"] = "MoveViewOnSheet"
    sheet_id: str = Field(alias="sheetId")
    view_id: str = Field(alias="viewId")
    min_xy: dict = Field(alias="minXY")


class RemoveViewFromSheetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["RemoveViewFromSheet"] = "RemoveViewFromSheet"
    sheet_id: str = Field(alias="sheetId")
    view_id: str = Field(alias="viewId")


class SetSheetTitleblockCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["SetSheetTitleblock"] = "SetSheetTitleblock"
    sheet_id: str = Field(alias="sheetId")
    titleblock_type_id: str = Field(alias="titleblockTypeId")


class UpdateSheetMetadataCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateSheetMetadata"] = "UpdateSheetMetadata"
    sheet_id: str = Field(alias="sheetId")
    metadata: dict


class CreateWindowLegendViewCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateWindowLegendView"] = "CreateWindowLegendView"
    legend_id: str = Field(alias="legendId")
    name: str
    scope: Literal["all", "sheet", "project"] = "project"
    sort_by: Literal["type", "width", "count"] = Field(default="type", alias="sortBy")
    parent_sheet_id: str | None = Field(default=None, alias="parentSheetId")


# ---------------------------------------------------------------------------
# VIE-V3-02 — Drafting view + callout commands
# ---------------------------------------------------------------------------


class CreateDraftingViewCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateDraftingView"] = "CreateDraftingView"
    view_id: str = Field(alias="viewId")
    name: str
    scale: int = 50


class CreateViewCalloutCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateCallout"] = "CreateCallout"
    callout_view_id: str = Field(alias="calloutViewId")
    parent_view_id: str = Field(alias="parentViewId")
    clip_rect: ClipRect = Field(alias="clipRect")
    name: str
    scale: int = 5
