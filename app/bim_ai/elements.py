from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

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


WallLayerFunction = Literal["structure", "insulation", "finish"]
WallBasisLine = Literal["center", "face_interior", "face_exterior"]
PlanDetailLevelPlan = Literal["coarse", "medium", "fine"]


class ProjectSettingsElem(BaseModel):
    """Singleton-style project datum (canonical units / locale metadata)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["project_settings"] = "project_settings"
    id: str
    length_unit: str = Field(default="millimeter", alias="lengthUnit")
    angular_unit_deg: str = Field(default="degree", alias="angularUnitDeg")
    display_locale: str = Field(default="en-US", alias="displayLocale")


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


class IssueElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["issue"] = "issue"
    id: str
    title: str
    status: Literal["open", "in_progress", "done"] = "open"
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    viewpoint_id: str | None = Field(default=None, alias="viewpointId")
    assignee_placeholder: str | None = Field(default=None, alias="assigneePlaceholder")


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


class ValidationRuleElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["validation_rule"] = "validation_rule"
    id: str
    name: str = "IDS clause"
    rule_json: dict[str, Any] = Field(default_factory=dict, alias="ruleJson")


ElementKind = Literal[
    "project_settings",
    "wall_type",
    "floor_type",
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
    "join_geometry",
    "section_cut",
    "plan_view",
    "view_template",
    "sheet",
    "schedule",
    "callout",
    "bcf",
    "validation_rule",
]


Element = Annotated[
    ProjectSettingsElem
    | WallTypeElem
    | FloorTypeElem
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
    | JoinGeometryElem
    | SectionCutElem
    | PlanViewElem
    | ViewTemplateElem
    | SheetElem
    | ScheduleElem
    | CalloutElem
    | BcfElem
    | ValidationRuleElem,
    Field(discriminator="kind"),
]
