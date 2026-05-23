"""Documentation / view / annotation / phase / construction-lens commands.

Elevation views, section cuts, callouts, BCF topics, agent assumptions/
deviations, validation rules, sun settings, phases (KRN-V3-01), discipline
tags (DSC-V3-01/02), construction-lens metadata, design options, drafting
views (callout markers + view breaks), per-element hide/show, project /
viewpoint / room-color-scheme upserts, issue tracking.

BRT-22 split — these classes used to live in ``app/bim_ai/commands.py``.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import (
    CameraMm,
    EvidenceRef,
    LensMode,
    PhaseFilter,
    RoomColorSchemeRow,
    Vec2Mm,
    Vec3Mm,
)


class CreateElevationViewCmd(BaseModel):
    """VIE-03 — first-class elevation view (N/S/E/W) sibling to section_cut."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createElevationView"] = "createElevationView"
    id: str | None = None
    name: str = "Elevation"
    direction: Literal["north", "south", "east", "west", "custom"] = "north"
    custom_angle_deg: float | None = Field(default=None, alias="customAngleDeg")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    scale: float = 100.0
    plan_detail_level: Literal["coarse", "medium", "fine"] | None = Field(
        default=None, alias="planDetailLevel"
    )
    marker_group_id: str | None = Field(default=None, alias="markerGroupId")
    marker_slot: Literal["north", "south", "east", "west", "custom"] | None = Field(
        default=None, alias="markerSlot"
    )


class CreateIssueFromViolationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createIssueFromViolation"] = "createIssueFromViolation"
    title: str
    violation_rule_id: str = Field(alias="violationRuleId")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    viewpoint_id: str | None = Field(default=None, alias="viewpointId")


class UpdateIssueStatusCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateIssueStatus"] = "updateIssueStatus"
    issue_id: str = Field(alias="issueId")
    status: Literal[
        "open",
        "in_progress",
        "reviewed",
        "resolved",
        "closed",
        "done",
        "not_an_issue",
        "new",
        "active",
        "approved",
        "suppressed",
    ]
    comment: str | None = None
    actor: str | None = None
    revision: str | int | None = None


class SaveViewpointCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["saveViewpoint"] = "saveViewpoint"
    id: str | None = None
    name: str = "Viewpoint"
    camera: CameraMm
    mode: Literal["plan_2d", "orbit_3d", "plan_canvas"] = "orbit_3d"
    viewer_clip_cap_elev_mm: float | None = Field(default=None, alias="viewerClipCapElevMm")
    viewer_clip_floor_elev_mm: float | None = Field(default=None, alias="viewerClipFloorElevMm")
    hidden_semantic_kinds_3d: list[str] = Field(default_factory=list, alias="hiddenSemanticKinds3d")
    cutaway_style: Literal["none", "cap", "floor", "box"] | None = Field(
        default=None, alias="cutawayStyle"
    )
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


class UpsertProjectSettingsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertProjectSettings"] = "upsertProjectSettings"
    id: str = "project_settings"
    name: str | None = None
    project_number: str | None = Field(default=None, alias="projectNumber")
    client_name: str | None = Field(default=None, alias="clientName")
    project_address: str | None = Field(default=None, alias="projectAddress")
    project_status: str | None = Field(default=None, alias="projectStatus")
    length_unit: str = Field(alias="lengthUnit", default="millimeter")
    angular_unit_deg: str = Field(alias="angularUnitDeg", default="degree")
    display_locale: str = Field(alias="displayLocale", default="en-US")


class UpsertRoomColorSchemeCmd(BaseModel):
    """Replace authoritative programme / department scheme colours (singleton replay)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertRoomColorScheme"] = "upsertRoomColorScheme"
    id: str = "bim-room-color-scheme"
    scheme_rows: list[RoomColorSchemeRow] = Field(default_factory=list, alias="schemeRows")


class CreateSectionCutCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSectionCut"] = "createSectionCut"
    id: str | None = None
    name: str = "Section"
    line_start_mm: Vec2Mm = Field(alias="lineStartMm")
    line_end_mm: Vec2Mm = Field(alias="lineEndMm")
    crop_depth_mm: float = Field(alias="cropDepthMm", default=8500)


class CreateCalloutCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createCallout"] = "createCallout"
    id: str | None = None
    name: str = "Callout"
    parent_sheet_id: str = Field(alias="parentSheetId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")


class CreateBcfTopicCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createBcfTopic"] = "createBcfTopic"
    id: str | None = None
    title: str
    viewpoint_ref: str | None = Field(default=None, alias="viewpointRef")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    plan_view_id: str | None = Field(default=None, alias="planViewId")
    section_cut_id: str | None = Field(default=None, alias="sectionCutId")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


class CreateAgentAssumptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createAgentAssumption"] = "createAgentAssumption"
    id: str | None = None
    statement: str
    source: Literal["manual", "bundle_dry_run", "evidence_summary"] = "manual"
    closure_status: Literal["open", "resolved", "accepted", "deferred"] = Field(
        default="resolved", alias="closureStatus"
    )
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")
    related_topic_id: str | None = Field(default=None, alias="relatedTopicId")


class CreateAgentDeviationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createAgentDeviation"] = "createAgentDeviation"
    id: str | None = None
    statement: str
    severity: Literal["info", "warning", "error"] = "warning"
    acknowledged: bool = True
    related_assumption_id: str | None = Field(default=None, alias="relatedAssumptionId")
    related_element_ids: list[str] = Field(default_factory=list, alias="relatedElementIds")


class UpsertValidationRuleCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertValidationRule"] = "upsertValidationRule"
    id: str | None = None
    name: str = "IDS"
    rule_json: dict[str, Any] = Field(alias="ruleJson", default_factory=dict)


# --- SUN-V3-01: sun_settings commands ----------------------------------------


class CreateSunSettingsCmd(BaseModel):
    """SUN-V3-01: create the project-level sun settings singleton.

    Rejects if one already exists (use UpdateSunSettings to modify).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createSunSettings"] = "createSunSettings"
    id: str | None = None
    latitude_deg: float = Field(default=48.13, alias="latitudeDeg")
    longitude_deg: float = Field(default=11.58, alias="longitudeDeg")
    date_iso: str = Field(default="2026-06-21", alias="dateIso")
    time_of_day: dict = Field(
        default_factory=lambda: {"hours": 14, "minutes": 30}, alias="timeOfDay"
    )
    daylight_saving_strategy: Literal["auto", "on", "off"] = Field(
        default="auto", alias="daylightSavingStrategy"
    )


class UpdateSunSettingsCmd(BaseModel):
    """SUN-V3-01: update the project-level sun settings singleton.

    Partial update — only provided fields are changed.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateSunSettings"] = "updateSunSettings"
    latitude_deg: float | None = Field(default=None, alias="latitudeDeg")
    longitude_deg: float | None = Field(default=None, alias="longitudeDeg")
    date_iso: str | None = Field(default=None, alias="dateIso")
    time_of_day: dict | None = Field(default=None, alias="timeOfDay")
    daylight_saving_strategy: Literal["auto", "on", "off"] | None = Field(
        default=None, alias="daylightSavingStrategy"
    )


# --- KRN-V3-01: phases --------------------------------------------------------


class CreatePhaseCmd(BaseModel):
    """KRN-V3-01 — create a new project-level phase."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPhase"] = "createPhase"
    id: str | None = None
    name: str
    ord: int


class RenamePhaseCmd(BaseModel):
    """KRN-V3-01 — rename an existing phase."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["renamePhase"] = "renamePhase"
    phase_id: str = Field(alias="phaseId")
    name: str


class ReorderPhaseCmd(BaseModel):
    """KRN-V3-01 — change a phase's ordinal position."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reorderPhase"] = "reorderPhase"
    phase_id: str = Field(alias="phaseId")
    ord: int


class DeletePhaseCmd(BaseModel):
    """KRN-V3-01 — delete a phase, optionally retargeting its elements."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deletePhase"] = "deletePhase"
    phase_id: str = Field(alias="phaseId")
    retarget_to_phase_id: str | None = Field(default=None, alias="retargetToPhaseId")


class SetElementPhaseCmd(BaseModel):
    """KRN-V3-01 — set phase_created / phase_demolished on any phaseable element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setElementPhase"] = "setElementPhase"
    element_id: str = Field(alias="elementId")
    phase_created_id: str | None = Field(default=None, alias="phaseCreatedId")
    phase_demolished_id: str | None = Field(default=None, alias="phaseDemolishedId")
    clear_demolished: bool = Field(default=False, alias="clearDemolished")


class SetElementDisciplineCmd(BaseModel):
    """DSC-V3-01 — set discipline tag on one or more elements; undo + activity.

    Pass discipline=None (or null in JSON) to reset the element to its kind's
    DEFAULT_DISCIPLINE_BY_KIND value.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setElementDiscipline"] = "setElementDiscipline"
    element_ids: list[str] = Field(alias="elementIds")
    discipline: Literal["arch", "struct", "mep"] | None = "arch"


class SetViewPhaseCmd(BaseModel):
    """KRN-V3-01 — set the as-of phase for a plan view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setViewPhase"] = "setViewPhase"
    view_id: str = Field(alias="viewId")
    phase_id: str = Field(alias="phaseId")


class SetViewPhaseFilterCmd(BaseModel):
    """KRN-V3-01 — set the phase filter on a plan view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setViewPhaseFilter"] = "setViewPhaseFilter"
    view_id: str = Field(alias="viewId")
    phase_filter: PhaseFilter = Field(alias="phaseFilter")


class SetViewLensCmd(BaseModel):
    """DSC-V3-02 — set the discipline lens on a view.

    Elements not matching the lens render at 25% opacity (ghost).
    Does not mutate element discipline fields.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["set_view_lens"] = "set_view_lens"
    view_id: str = Field(alias="viewId")
    lens: LensMode


# --- Construction-lens commands ---------------------------------------------


class ConstructionMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    actual_start: str | None = Field(default=None, alias="actualStart")
    actual_end: str | None = Field(default=None, alias="actualEnd")
    installation_sequence: int | None = Field(default=None, alias="installationSequence")
    dependencies: list[str] = Field(default_factory=list)
    progress_status: str | None = Field(default=None, alias="progressStatus")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")
    issue_ids: list[str] = Field(default_factory=list, alias="issueIds")
    punch_item_ids: list[str] = Field(default_factory=list, alias="punchItemIds")
    inspection_checklist: list[dict[str, Any]] = Field(
        default_factory=list, alias="inspectionChecklist"
    )


class SetElementConstructionCmd(BaseModel):
    """Construction lens — attach execution metadata without changing design intent."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setElementConstruction"] = "setElementConstruction"
    element_id: str = Field(alias="elementId")
    metadata: ConstructionMetadata
    phase_created_id: str | None = Field(default=None, alias="phaseCreatedId")
    phase_demolished_id: str | None = Field(default=None, alias="phaseDemolishedId")
    clear_demolished: bool = Field(default=False, alias="clearDemolished")


class CreateConstructionPackageCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createConstructionPackage"] = "createConstructionPackage"
    id: str | None = None
    name: str
    code: str | None = None
    phase_id: str | None = Field(default=None, alias="phaseId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    actual_start: str | None = Field(default=None, alias="actualStart")
    actual_end: str | None = Field(default=None, alias="actualEnd")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    dependencies: list[str] = Field(default_factory=list)


class CreateConstructionLogisticsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createConstructionLogistics"] = "createConstructionLogistics"
    id: str | None = None
    name: str
    logistics_kind: str = Field(alias="logisticsKind")
    boundary_mm: list[Vec2Mm] = Field(default_factory=list, alias="boundaryMm")
    path_mm: list[Vec2Mm] = Field(default_factory=list, alias="pathMm")
    phase_id: str | None = Field(default=None, alias="phaseId")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    planned_start: str | None = Field(default=None, alias="plannedStart")
    planned_end: str | None = Field(default=None, alias="plannedEnd")
    progress_status: str = Field(default="not_started", alias="progressStatus")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")


class UpsertConstructionQaChecklistCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["upsertConstructionQaChecklist"] = "upsertConstructionQaChecklist"
    id: str | None = None
    name: str
    target_element_ids: list[str] = Field(default_factory=list, alias="targetElementIds")
    construction_package_id: str | None = Field(default=None, alias="constructionPackageId")
    phase_id: str | None = Field(default=None, alias="phaseId")
    responsible_company: str | None = Field(default=None, alias="responsibleCompany")
    progress_status: str = Field(default="not_started", alias="progressStatus")
    checklist: list[dict[str, Any]] = Field(default_factory=list)


# --- Design options ---------------------------------------------------------


class CreateOptionSetCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createOptionSet"] = "createOptionSet"
    id: str
    name: str


class AddOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["addOption"] = "addOption"
    option_set_id: str = Field(alias="optionSetId")
    option_id: str = Field(alias="optionId")
    name: str
    is_primary: bool = Field(default=False, alias="isPrimary")


class RemoveOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["removeOption"] = "removeOption"
    option_set_id: str = Field(alias="optionSetId")
    option_id: str = Field(alias="optionId")


class SetPrimaryOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setPrimaryOption"] = "setPrimaryOption"
    option_set_id: str = Field(alias="optionSetId")
    option_id: str = Field(alias="optionId")


class AssignElementToOptionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["assignElementToOption"] = "assignElementToOption"
    element_id: str = Field(alias="elementId")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")


class SetViewOptionLockCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setViewOptionLock"] = "setViewOptionLock"
    view_id: str = Field(alias="viewId")
    option_set_id: str = Field(alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")


# --- VIE-V3-02 — drafting-view companions (overrides, breaks, hides) --------


class SetElementOverrideCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["SetElementOverride"] = "SetElementOverride"
    view_id: str = Field(alias="viewId")
    category_or_id: str = Field(alias="categoryOrId")
    alternate_render: str = Field(alias="alternateRender")


class AddViewBreakCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["AddViewBreak"] = "AddViewBreak"
    view_id: str = Field(alias="viewId")
    axis_mm: float = Field(alias="axisMM")
    width_mm: float = Field(alias="widthMM")


class RemoveViewBreakCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["RemoveViewBreak"] = "RemoveViewBreak"
    view_id: str = Field(alias="viewId")
    axis_mm: float = Field(alias="axisMM")


class HideElementInViewCmd(BaseModel):
    """Hide a specific element in a named plan view (F-102 per-element hide)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["hideElementInView"] = "hideElementInView"
    plan_view_id: str = Field(alias="planViewId")
    element_id: str = Field(alias="elementId")


class UnhideElementInViewCmd(BaseModel):
    """Remove a specific element from the hidden-element list of a plan view (F-102)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["unhideElementInView"] = "unhideElementInView"
    plan_view_id: str = Field(alias="planViewId")
    element_id: str = Field(alias="elementId")
