from __future__ import annotations

import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from bim_ai.roof_geometry import RoofGeometryMode

# --- Geometry primitives ------------------------------------------------------------


class Vec2Mm(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")


class Vec3Mm(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    z_mm: float = Field(alias="zMm")


class CameraMm(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    position: Vec3Mm
    target: Vec3Mm
    up: Vec3Mm


EvidenceRefKind = Literal["sheet", "viewpoint", "plan_view", "section_cut", "deterministic_png"]


class EvidenceRef(BaseModel):
    """BCF/issue pointer into deterministic evidence rows or PNG basenames."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: EvidenceRefKind
    sheet_id: str | None = Field(default=None, alias="sheetId")
    viewpoint_id: str | None = Field(default=None, alias="viewpointId")
    plan_view_id: str | None = Field(default=None, alias="planViewId")
    section_cut_id: str | None = Field(default=None, alias="sectionCutId")
    png_basename: str | None = Field(default=None, alias="pngBasename")


WallLayerFunction = Literal["structure", "insulation", "finish"]
WallBasisLine = Literal["center", "face_interior", "face_exterior"]
PlanDetailLevelPlan = Literal["coarse", "medium", "fine"]

_SCHEME_HEX_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ProjectSettingsElem(BaseModel):
    """Singleton-style project datum (canonical units / locale metadata)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["project_settings"] = "project_settings"
    id: str
    length_unit: str = Field(default="millimeter", alias="lengthUnit")
    angular_unit_deg: str = Field(default="degree", alias="angularUnitDeg")

    display_locale: str = Field(default="en-US", alias="displayLocale")


class RoomColorSchemeRow(BaseModel):
    """One programme and/or department → fill colour for room-scheme presentation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    scheme_color_hex: str = Field(alias="schemeColorHex")

    @field_validator("programme_code", "department", mode="before")
    @classmethod
    def _strip_optional_str(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("scheme_color_hex", mode="before")
    @classmethod
    def _normalize_scheme_hex(cls, v: Any) -> str:
        s = str(v).strip()
        if not _SCHEME_HEX_PATTERN.fullmatch(s):
            raise ValueError("schemeColorHex must be a '#RRGGBB' literal")
        return f"#{s[1:].upper()}"

    @model_validator(mode="after")
    def _needs_programme_or_department(self) -> RoomColorSchemeRow:
        if not self.programme_code and not self.department:
            raise ValueError("each scheme row needs a non-empty programmeCode and/or department")
        return self


class RoomColorSchemeElem(BaseModel):
    """Singleton document colour overrides for programme/department fills (replayable deltas)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["room_color_scheme"] = "room_color_scheme"
    id: str
    scheme_rows: list[RoomColorSchemeRow] = Field(default_factory=list, alias="schemeRows")


class WallTypeLayer(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    thickness_mm: float = Field(alias="thicknessMm", gt=0)
    layer_function: WallLayerFunction = Field(alias="function")
    material_key: str | None = Field(default=None, alias="materialKey")


class WallTypeElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["wall_type"] = "wall_type"
    id: str
    name: str = "Wall type"
    layers: list[WallTypeLayer] = Field(default_factory=list)
    basis_line: WallBasisLine = Field(default="center", alias="basisLine")


class FloorTypeElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["floor_type"] = "floor_type"
    id: str
    name: str = "Floor type"
    layers: list[WallTypeLayer] = Field(default_factory=list)


class RoofTypeElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["roof_type"] = "roof_type"
    id: str
    name: str = "Roof type"
    layers: list[WallTypeLayer] = Field(default_factory=list)


class LevelElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["level"] = "level"
    id: str
    name: str = "Untitled Level"
    elevation_mm: float = Field(default=0, alias="elevationMm")
    datum_kind: str | None = Field(default=None, alias="datumKind")
    parent_level_id: str | None = Field(default=None, alias="parentLevelId")
    offset_from_parent_mm: float = Field(default=0, alias="offsetFromParentMm")


class WallElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["wall"] = "wall"
    id: str
    name: str = "Wall"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    base_constraint_level_id: str | None = Field(default=None, alias="baseConstraintLevelId")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")
    roof_attachment_id: str | None = Field(default=None, alias="roofAttachmentId")
    insulation_extension_mm: float = Field(default=0, alias="insulationExtensionMm")


class DoorElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["door"] = "door"
    id: str
    name: str = "Door"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=900)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")
    host_cut_depth_mm: float | None = Field(default=None, alias="hostCutDepthMm")
    reveal_interior_mm: float | None = Field(default=None, alias="revealInteriorMm")
    interlock_grade: str | None = Field(default=None, alias="interlockGrade")
    lod_plan: Literal["simple", "detailed"] | None = Field(default=None, alias="lodPlan")


class WindowElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["window"] = "window"
    id: str
    name: str = "Window"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", ge=0, le=1)
    width_mm: float = Field(alias="widthMm", default=1200)
    sill_height_mm: float = Field(alias="sillHeightMm", default=900)
    height_mm: float = Field(alias="heightMm", default=1500)
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")
    host_cut_depth_mm: float | None = Field(default=None, alias="hostCutDepthMm")
    reveal_interior_mm: float | None = Field(default=None, alias="revealInteriorMm")
    interlock_grade: str | None = Field(default=None, alias="interlockGrade")
    seal_rebate_mm: float | None = Field(default=None, alias="sealRebateMm")
    lod_plan: Literal["simple", "detailed"] | None = Field(default=None, alias="lodPlan")


class RoomElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["room"] = "room"
    id: str
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")
    upper_limit_level_id: str | None = Field(default=None, alias="upperLimitLevelId")
    volume_ceiling_offset_mm: float | None = Field(default=None, alias="volumeCeilingOffsetMm")
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")


class GridLineElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["grid_line"] = "grid_line"
    id: str
    name: str = "Grid"
    start: Vec2Mm
    end: Vec2Mm
    label: str = ""
    level_id: str | None = Field(default=None, alias="levelId")


class DimensionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["dimension"] = "dimension"
    id: str
    name: str = "Dimension"
    level_id: str = Field(alias="levelId")
    a_mm: Vec2Mm = Field(alias="aMm")
    b_mm: Vec2Mm = Field(alias="bMm")
    offset_mm: Vec2Mm = Field(alias="offsetMm")
    ref_element_id_a: str | None = Field(default=None, alias="refElementIdA")
    ref_element_id_b: str | None = Field(default=None, alias="refElementIdB")
    tag_definition_id: str | None = Field(default=None, alias="tagDefinitionId")


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


class IssueElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["issue"] = "issue"
    id: str
    title: str
    status: Literal["open", "in_progress", "done"] = "open"
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    viewpoint_id: str | None = Field(default=None, alias="viewpointId")
    assignee_placeholder: str | None = Field(default=None, alias="assigneePlaceholder")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


class FloorElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["floor"] = "floor"
    id: str
    name: str = "Floor"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    thickness_mm: float = Field(alias="thicknessMm", default=220)
    structure_thickness_mm: float = Field(alias="structureThicknessMm", default=140)
    finish_thickness_mm: float = Field(alias="finishThicknessMm", default=0)
    floor_type_id: str | None = Field(default=None, alias="floorTypeId")
    insulation_extension_mm: float = Field(default=0, alias="insulationExtensionMm")
    room_bounded: bool = Field(default=False, alias="roomBounded")


class RoofElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["roof"] = "roof"
    id: str
    name: str = "Roof"
    reference_level_id: str = Field(alias="referenceLevelId")
    footprint_mm: list[Vec2Mm] = Field(alias="footprintMm")
    overhang_mm: float = Field(default=400, alias="overhangMm")
    slope_deg: float | None = Field(default=25.0, alias="slopeDeg")
    edge_slope_flags: dict[str, bool] = Field(default_factory=dict, alias="edgeSlopeFlags")
    roof_geometry_mode: RoofGeometryMode = Field(default="mass_box", alias="roofGeometryMode")
    roof_type_id: str | None = Field(default=None, alias="roofTypeId")


class StairElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["stair"] = "stair"
    id: str
    name: str = "Stair"
    base_level_id: str = Field(alias="baseLevelId")
    top_level_id: str = Field(alias="topLevelId")
    run_start: Vec2Mm = Field(alias="runStartMm")
    run_end: Vec2Mm = Field(alias="runEndMm")
    width_mm: float = Field(alias="widthMm", default=1000)
    riser_mm: float = Field(alias="riserMm", default=175)
    tread_mm: float = Field(alias="treadMm", default=275)


class SlabOpeningElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["slab_opening"] = "slab_opening"
    id: str
    name: str = "Opening"
    host_floor_id: str = Field(alias="hostFloorId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    is_shaft: bool = Field(default=False, alias="isShaft")


class RailingElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["railing"] = "railing"
    id: str
    name: str = "Railing"
    hosted_stair_id: str | None = Field(default=None, alias="hostedStairId")
    path_mm: list[Vec2Mm] = Field(alias="pathMm")
    guard_height_mm: float = Field(alias="guardHeightMm", default=1040)


class FamilyTypeElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["family_type"] = "family_type"
    id: str
    discipline: Literal["door", "window", "generic"] = "generic"
    parameters: dict[str, Any] = Field(default_factory=dict)


class RoomSeparationElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["room_separation"] = "room_separation"
    id: str
    name: str = "Room separator"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm


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


PlanTagTarget = Literal["opening", "room"]
PlanTagBadgeStyle = Literal["none", "rounded", "flag"]


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


class PlanCategoryGraphicRow(BaseModel):
    """Per-category plan line weight factor and line pattern token (template + plan_view override)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    category_key: PlanCategoryGraphicCategoryKey = Field(alias="categoryKey")
    line_weight_factor: float | None = Field(default=None, alias="lineWeightFactor", gt=0, le=3)
    line_pattern_token: PlanLinePatternTokenPlan | None = Field(default=None, alias="linePatternToken")


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
    phase_id: str | None = Field(default=None, alias="phaseId")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")
    cut_plane_offset_mm: float | None = Field(default=None, alias="cutPlaneOffsetMm")
    categories_hidden: list[str] = Field(default_factory=list, alias="categoriesHidden")
    plan_detail_level: PlanDetailLevelPlan | None = Field(default=None, alias="planDetailLevel")
    plan_room_fill_opacity_scale: float | None = Field(default=None, alias="planRoomFillOpacityScale")
    plan_show_opening_tags: bool | None = Field(default=None, alias="planShowOpeningTags")
    plan_show_room_labels: bool | None = Field(default=None, alias="planShowRoomLabels")
    plan_opening_tag_style_id: str | None = Field(default=None, alias="planOpeningTagStyleId")
    plan_room_tag_style_id: str | None = Field(default=None, alias="planRoomTagStyleId")
    plan_category_graphics: list[PlanCategoryGraphicRow] = Field(
        default_factory=list,
        alias="planCategoryGraphics",
    )


class ViewTemplateElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["view_template"] = "view_template"
    id: str
    name: str = "View template"
    scale: Literal["scale_50", "scale_100", "scale_200"] = Field(default="scale_100", alias="scale")
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


class SheetElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["sheet"] = "sheet"
    id: str
    name: str = "Sheet"
    title_block: str | None = Field(default=None, alias="titleBlock")
    viewports_mm: list[dict[str, Any]] = Field(default_factory=list, alias="viewportsMm")
    paper_width_mm: float = Field(default=42_000, alias="paperWidthMm")
    paper_height_mm: float = Field(default=29_700, alias="paperHeightMm")
    titleblock_parameters: dict[str, str] = Field(default_factory=dict, alias="titleblockParameters")


class ScheduleElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["schedule"] = "schedule"
    id: str
    name: str = "Schedule"
    sheet_id: str | None = Field(default=None, alias="sheetId")
    filters: dict[str, Any] = Field(default_factory=dict)
    grouping: dict[str, Any] = Field(default_factory=dict)


class CalloutElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["callout"] = "callout"
    id: str
    name: str = "Callout"
    parent_sheet_id: str = Field(alias="parentSheetId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")


class BcfElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["bcf"] = "bcf"
    id: str
    title: str
    viewpoint_ref: str | None = Field(default=None, alias="viewpointRef")
    status: str = Field(default="open")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    plan_view_id: str | None = Field(default=None, alias="planViewId")
    section_cut_id: str | None = Field(default=None, alias="sectionCutId")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


AgentAssumptionSource = Literal["manual", "bundle_dry_run", "evidence_summary"]
AgentAssumptionClosureStatus = Literal["open", "resolved", "accepted", "deferred"]


class AgentAssumptionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["agent_assumption"] = "agent_assumption"
    id: str
    statement: str
    source: AgentAssumptionSource = "manual"
    closure_status: AgentAssumptionClosureStatus = Field(
        default="resolved",
        alias="closureStatus",
        description="Open assumptions require explicit resolution before acceptance.",
    )
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")
    related_topic_id: str | None = Field(default=None, alias="relatedTopicId")


AgentDeviationSeverity = Literal["info", "warning", "error"]


class AgentDeviationElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["agent_deviation"] = "agent_deviation"
    id: str
    statement: str
    severity: AgentDeviationSeverity = "warning"
    acknowledged: bool = True
    related_assumption_id: str | None = Field(default=None, alias="relatedAssumptionId")
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")


class ValidationRuleElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["validation_rule"] = "validation_rule"
    id: str
    name: str = "IDS clause"
    rule_json: dict[str, Any] = Field(default_factory=dict, alias="ruleJson")


SiteContextType = Literal["tree", "shrub", "neighbor_proxy", "entourage"]


class SiteContextObjectRow(BaseModel):
    """Lightweight non-BIM context marker (entourage / neighboring mass proxy)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    context_type: SiteContextType = Field(alias="contextType")
    label: str = ""
    position_mm: Vec2Mm = Field(alias="positionMm")
    scale: float = Field(default=1.0, gt=0)
    category: str = "site_entourage"


class SiteElem(BaseModel):
    """Bounded site pad + optional orientation / setbacks / context entourage rows."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["site"] = "site"
    id: str
    name: str = "Site"
    reference_level_id: str = Field(alias="referenceLevelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    pad_thickness_mm: float = Field(alias="padThicknessMm", default=80.0, gt=0)
    base_offset_mm: float = Field(
        default=0.0,
        alias="baseOffsetMm",
        description="Offset from reference level elevation to bottom of pad (mm).",
    )
    north_deg_cw_from_plan_x: float | None = Field(
        default=None,
        alias="northDegCwFromPlanX",
        description="Clockwise degrees from +plan X to project north (plan view).",
    )
    uniform_setback_mm: float | None = Field(
        default=None,
        alias="uniformSetbackMm",
        ge=0,
        description="Optional uniform property setback metadata (mm), documentary v0.",
    )
    context_objects: list[SiteContextObjectRow] = Field(default_factory=list, alias="contextObjects")


ElementKind = Literal[
    "project_settings",
    "room_color_scheme",
    "wall_type",
    "floor_type",
    "roof_type",
    "level",
    "wall",
    "door",
    "window",
    "room",
    "grid_line",
    "dimension",
    "viewpoint",
    "issue",
    "floor",
    "roof",
    "stair",
    "slab_opening",
    "railing",
    "family_type",
    "room_separation",
    "plan_region",
    "tag_definition",
    "plan_tag_style",
    "join_geometry",
    "section_cut",
    "plan_view",
    "view_template",
    "sheet",
    "schedule",
    "callout",
    "bcf",
    "agent_assumption",
    "agent_deviation",
    "validation_rule",
    "site",
]


Element = Annotated[
    ProjectSettingsElem
    | RoomColorSchemeElem
    | WallTypeElem
    | FloorTypeElem
    | RoofTypeElem
    | LevelElem
    | WallElem
    | DoorElem
    | WindowElem
    | RoomElem
    | GridLineElem
    | DimensionElem
    | ViewpointElem
    | IssueElem
    | FloorElem
    | RoofElem
    | StairElem
    | SlabOpeningElem
    | RailingElem
    | FamilyTypeElem
    | RoomSeparationElem
    | PlanRegionElem
    | TagDefinitionElem
    | PlanTagStyleElem
    | JoinGeometryElem
    | SectionCutElem
    | PlanViewElem
    | ViewTemplateElem
    | SheetElem
    | ScheduleElem
    | CalloutElem
    | BcfElem
    | AgentAssumptionElem
    | AgentDeviationElem
    | ValidationRuleElem
    | SiteElem,
    Field(discriminator="kind"),
]
