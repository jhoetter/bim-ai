from __future__ import annotations

import math
import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from bim_ai.cmd.types import AgentTrace
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


class WallArcCurve(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["arc"] = "arc"
    center: Vec2Mm
    radius_mm: float = Field(alias="radiusMm", gt=0)
    start_angle_deg: float = Field(alias="startAngleDeg")
    end_angle_deg: float = Field(alias="endAngleDeg")
    sweep_deg: float = Field(alias="sweepDeg")

    @model_validator(mode="after")
    def _validate_arc(self) -> WallArcCurve:
        vals = (
            self.center.x_mm,
            self.center.y_mm,
            self.radius_mm,
            self.start_angle_deg,
            self.end_angle_deg,
            self.sweep_deg,
        )
        if not all(math.isfinite(v) for v in vals):
            raise ValueError("wallCurve values must be finite")
        if abs(self.sweep_deg) <= 0.001 or abs(self.sweep_deg) > 360:
            raise ValueError("wallCurve.sweepDeg must be in (-360, 360] excluding 0")
        return self


class WallBezierCurve(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["bezier"] = "bezier"
    control_points: list[Vec2Mm] = Field(alias="controlPoints", min_length=4, max_length=4)

    @model_validator(mode="after")
    def _validate_bezier(self) -> WallBezierCurve:
        for pt in self.control_points:
            if not math.isfinite(pt.x_mm) or not math.isfinite(pt.y_mm):
                raise ValueError("wallCurve.controlPoints values must be finite")
        return self


WallCurve = Annotated[WallArcCurve | WallBezierCurve, Field(discriminator="kind")]


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


DisciplineTag = Literal["arch", "struct", "mep"]
LensMode = Literal["show_arch", "show_struct", "show_mep", "show_all"]
DEFAULT_DISCIPLINE_BY_KIND: dict[str, DisciplineTag] = {
    "beam": "struct",
    "column": "struct",
}

DEFAULT_DISCIPLINE_BY_KIND: dict[str, DisciplineTag] = {
    "wall": "arch",
    "door": "arch",
    "window": "arch",
    "wall_opening": "arch",
    "floor": "arch",
    "roof": "arch",
    "stair": "arch",
    "railing": "arch",
    "ceiling": "arch",
    "mass": "arch",
    "balcony": "arch",
    "sweep": "arch",
    "dormer": "arch",
    "soffit": "arch",
    "toposolid": "arch",
    "column": "struct",
    "beam": "struct",
    "brace": "struct",
    "foundation": "struct",
    "duct": "mep",
    "pipe": "mep",
    "fixture": "mep",
}

WallLayerFunction = Literal["structure", "insulation", "finish"]
WallBasisLine = Literal["center", "face_interior", "face_exterior"]
WallStructuralRole = Literal["unknown", "load_bearing", "non_load_bearing"]
WallLocationLine = Literal[
    "wall-centerline",
    "finish-face-exterior",
    "finish-face-interior",
    "core-centerline",
    "core-face-exterior",
    "core-face-interior",
]
PlanDetailLevelPlan = Literal["coarse", "medium", "fine"]
PhaseFilter = Literal["all", "existing", "demolition", "new"]
ViewTemplateControlledField = Literal[
    "scale",
    "detailLevel",
    "elementOverrides",
    "phase",
    "phaseFilter",
]


class ViewTemplateFieldControl(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    included: bool = True
    locked: bool = True


def default_view_template_control_matrix() -> dict[
    ViewTemplateControlledField, ViewTemplateFieldControl
]:
    return {
        "scale": ViewTemplateFieldControl(),
        "detailLevel": ViewTemplateFieldControl(),
        "elementOverrides": ViewTemplateFieldControl(),
        "phase": ViewTemplateFieldControl(),
        "phaseFilter": ViewTemplateFieldControl(),
    }


def normalize_view_template_control_matrix(
    matrix: dict[str, Any] | None,
    *,
    base: dict[str, ViewTemplateFieldControl] | None = None,
) -> dict[ViewTemplateControlledField, ViewTemplateFieldControl]:
    normalized = dict(base or default_view_template_control_matrix())
    if matrix is None:
        return normalized
    for field, raw_control in matrix.items():
        if field not in normalized:
            continue
        if isinstance(raw_control, ViewTemplateFieldControl):
            control = raw_control
        elif isinstance(raw_control, dict):
            control = ViewTemplateFieldControl.model_validate(raw_control)
        else:
            continue
        normalized[field] = control
    return normalized


_SCHEME_HEX_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ProjectSettingsElem(BaseModel):
    """Singleton-style project datum (canonical units / locale metadata)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["project_settings"] = "project_settings"
    id: str
    length_unit: str = Field(default="millimeter", alias="lengthUnit")
    angular_unit_deg: str = Field(default="degree", alias="angularUnitDeg")

    display_locale: str = Field(default="en-US", alias="displayLocale")
    room_area_computation_basis: str = Field(
        default="wall_finish",
        alias="roomAreaComputationBasis",
    )
    volume_computed_at: str = Field(
        default="finish_faces",
        alias="volumeComputedAt",
    )
    checkpoint_retention_limit: int = Field(
        default=20,
        ge=1,
        le=99,
        alias="checkpointRetentionLimit",
    )


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
    wraps_at_ends: bool = Field(default=False, alias="wrapsAtEnds")
    wraps_at_inserts: bool = Field(default=False, alias="wrapsAtInserts")


MaterialFaceKind = Literal["exterior", "interior", "top", "bottom", "left", "right", "generated"]
MaterialFaceOverrideSource = Literal["paint", "finish"]


class MaterialFaceOverride(BaseModel):
    """MAT-09 — Revit-like per-face Paint / finish override."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    face_kind: MaterialFaceKind = Field(alias="faceKind")
    material_key: str = Field(alias="materialKey", min_length=1)
    generated_face_id: str | None = Field(default=None, alias="generatedFaceId")
    source: MaterialFaceOverrideSource | None = Field(default="paint")
    uv_scale_mm: dict | None = Field(default=None, alias="uvScaleMm")
    uv_rotation_deg: float | None = Field(default=None, alias="uvRotationDeg")
    uv_offset_mm: dict | None = Field(default=None, alias="uvOffsetMm")


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


class MonitorSourceSpec(BaseModel):
    """FED-03 — structured Copy/Monitor source pointer.

    See ``packages/core/src/index.ts:MonitorSource`` for the wire shape.

    * ``link_id`` is the host's ``link_model`` element id when the source
      lives in another model; ``None`` for intra-host monitors.
    * ``element_id`` is the **source-side** element id (not the prefixed
      ``<linkId>::<sourceElemId>`` form).
    * ``source_revision_at_copy`` snapshots the source's revision counter at
      the moment the copy was made; ``BumpMonitoredRevisions`` re-evaluates
      drift against the source's current revision.
    * ``drifted`` / ``drifted_fields`` are written by the bump command and
      surface as a ``monitored_source_drift`` advisory.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    link_id: str | None = Field(default=None, alias="linkId")
    element_id: str = Field(alias="elementId")
    source_revision_at_copy: int = Field(default=0, alias="sourceRevisionAtCopy")
    drifted: bool = Field(default=False)
    drifted_fields: list[str] = Field(default_factory=list, alias="driftedFields")


class LevelElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["level"] = "level"
    id: str
    name: str = "Untitled Level"
    elevation_mm: float = Field(default=0, alias="elevationMm")
    datum_kind: str | None = Field(default=None, alias="datumKind")
    parent_level_id: str | None = Field(default=None, alias="parentLevelId")
    offset_from_parent_mm: float = Field(default=0, alias="offsetFromParentMm")
    monitor_source: MonitorSourceSpec | None = Field(default=None, alias="monitorSource")
    pinned: bool = Field(default=False)


CurtainPanelOverrideKind = Literal["empty", "system", "family_instance"]


class CurtainPanelOverride(BaseModel):
    """KRN-09 — per-cell substitution for a curtain-wall grid cell.

    `kind`:
      - `empty`      → leave the cell open (no glass, mullions stay)
      - `system`     → render a solid panel using the supplied `materialKey`
      - `family_instance` → instantiate a custom family at this cell (FAM-01)
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: CurtainPanelOverrideKind
    family_type_id: str | None = Field(default=None, alias="familyTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")


def curtain_grid_cell_id(v_index: int, h_index: int) -> str:
    """Deterministic cell-id used as the key in `wall.curtainPanelOverrides`."""

    return f"v{v_index}h{h_index}"


_CELL_ID_PATTERN = re.compile(r"^v(\d+)h(\d+)$")


def parse_curtain_grid_cell_id(cell_id: str) -> tuple[int, int]:
    """Inverse of `curtain_grid_cell_id`. Raises ValueError on malformed ids."""

    m = _CELL_ID_PATTERN.match(cell_id)
    if not m:
        raise ValueError(
            f"curtain panel cell id must match v<col>h<row> (zero-indexed); got '{cell_id}'"
        )
    return int(m.group(1)), int(m.group(2))


class WallRecessZone(BaseModel):
    """KRN-16 — wall recess / setback zone along the wall's alongT axis."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    along_t_start: float = Field(alias="alongTStart", ge=0, le=1)
    along_t_end: float = Field(alias="alongTEnd", ge=0, le=1)
    setback_mm: float = Field(alias="setbackMm", gt=0)
    sill_height_mm: float | None = Field(default=None, alias="sillHeightMm", ge=0)
    head_height_mm: float | None = Field(default=None, alias="headHeightMm", ge=0)
    floor_continues: bool = Field(default=False, alias="floorContinues")


class WallStackComponent(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    wall_type_id: str = Field(alias="wallTypeId")
    height_mm: float = Field(alias="heightMm", gt=0)


class WallStack(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    components: list[WallStackComponent] = Field(default_factory=list)


class WallElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["wall"] = "wall"
    id: str
    name: str = "Wall"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm
    wall_curve: WallCurve | None = Field(default=None, alias="wallCurve")
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_type_id: str | None = Field(default=None, alias="wallTypeId")
    location_line: WallLocationLine = Field(default="wall-centerline", alias="locationLine")
    base_constraint_level_id: str | None = Field(default=None, alias="baseConstraintLevelId")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")
    roof_attachment_id: str | None = Field(default=None, alias="roofAttachmentId")
    insulation_extension_mm: float = Field(default=0, alias="insulationExtensionMm")
    material_key: str | None = Field(default=None, alias="materialKey")
    face_material_overrides: list[MaterialFaceOverride] | None = Field(
        default=None, alias="faceMaterialOverrides"
    )
    load_bearing: bool | None = Field(default=None, alias="loadBearing")
    structural_role: WallStructuralRole = Field(default="unknown", alias="structuralRole")
    analytical_participation: bool = Field(default=False, alias="analyticalParticipation")
    structural_material_key: str | None = Field(default=None, alias="structuralMaterialKey")
    structural_intent_confidence: float | None = Field(
        default=None, alias="structuralIntentConfidence", ge=0, le=1
    )
    # IFC-04: optional OmniClass / Uniclass / NSCC code; emitted via
    # IfcClassificationReference when set.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    is_curtain_wall: bool = Field(default=False, alias="isCurtainWall")
    pinned: bool = Field(default=False)
    phase_id: str | None = Field(
        default=None,
        alias="phaseId",
        description="SKB-08 phase tag carried forward when materialised from a mass.",
    )
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    curtain_wall_v_count: int | None = Field(default=None, alias="curtainWallVCount")
    curtain_wall_h_count: int | None = Field(default=None, alias="curtainWallHCount")
    curtain_panel_overrides: dict[str, CurtainPanelOverride] | None = Field(
        default=None, alias="curtainPanelOverrides"
    )
    recess_zones: list[WallRecessZone] | None = Field(default=None, alias="recessZones")
    stack: WallStack | None = Field(default=None)
    lean_mm: Vec2Mm | None = Field(default=None, alias="leanMm")
    taper_ratio: float | None = Field(default=None, alias="taperRatio")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)
    # TOP-V3-04: site wall binding — when set, base elevation per-segment follows the toposolid surface.
    site_host_id: str | None = Field(default=None, alias="siteHostId")
    # F-040: per-endpoint Allow/Disallow join flag (mirrors Revit right-click → Allow/Disallow Join).
    join_disallow_start: bool = Field(default=False, alias="joinDisallowStart")
    join_disallow_end: bool = Field(default=False, alias="joinDisallowEnd")

    @model_validator(mode="after")
    def _validate_lean_taper(self) -> WallElem:
        if self.lean_mm is not None:
            magnitude = math.sqrt(self.lean_mm.x_mm**2 + self.lean_mm.y_mm**2)
            max_lean = self.height_mm * math.tan(math.radians(60))
            if magnitude > max_lean:
                raise ValueError("leanMm magnitude exceeds wall height × tan(60°)")
        if self.taper_ratio is not None:
            if not (0.1 < self.taper_ratio < 10.0):
                raise ValueError("taperRatio must be in (0.1, 10)")
        return self


DoorOperationType = Literal[
    "swing_single",
    "swing_double",
    "sliding_single",
    "sliding_double",
    "bi_fold",
    "pocket",
    "pivot",
    "automatic_double",
]

DoorSlidingTrackSide = Literal["wall_face", "in_pocket"]


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
    operation_type: DoorOperationType | None = Field(default=None, alias="operationType")
    sliding_track_side: DoorSlidingTrackSide | None = Field(default=None, alias="slidingTrackSide")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)


WindowOutlineKind = Literal[
    "rectangle",
    "arched_top",
    "gable_trapezoid",
    "circle",
    "octagon",
    "custom",
]


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
    outline_kind: WindowOutlineKind | None = Field(default=None, alias="outlineKind")
    outline_mm: list[Vec2Mm] | None = Field(default=None, alias="outlineMm")
    attached_roof_id: str | None = Field(default=None, alias="attachedRoofId")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)


class WallOpeningElem(BaseModel):
    """Frameless rectangular cut in a host wall (no door / window family)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["wall_opening"] = "wall_opening"
    id: str
    name: str = "Wall opening"
    host_wall_id: str = Field(alias="hostWallId")
    along_t_start: float = Field(alias="alongTStart", ge=0, le=1)
    along_t_end: float = Field(alias="alongTEnd", ge=0, le=1)
    sill_height_mm: float = Field(alias="sillHeightMm", ge=0)
    head_height_mm: float = Field(alias="headHeightMm", ge=0)
    pinned: bool = Field(default=False)
    discipline: DisciplineTag | None = Field(default=None)

    @model_validator(mode="after")
    def _check_bounds(self) -> WallOpeningElem:
        if self.along_t_start >= self.along_t_end:
            raise ValueError("wall_opening alongTStart must be < alongTEnd")
        if self.head_height_mm <= self.sill_height_mm:
            raise ValueError("wall_opening headHeightMm must be > sillHeightMm")
        return self


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
    programme_group: str | None = Field(default=None, alias="programmeGroup")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")
    room_fill_override_hex: str | None = Field(default=None, alias="roomFillOverrideHex")
    room_fill_pattern_override: (
        Literal["solid", "hatch_45", "hatch_90", "crosshatch", "dots"] | None
    ) = Field(default=None, alias="roomFillPatternOverride")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    props: dict[str, Any] | None = Field(default=None)


class GridLineElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["grid_line"] = "grid_line"
    id: str
    name: str = "Grid"
    pinned: bool = Field(default=False)
    start: Vec2Mm
    end: Vec2Mm
    label: str = ""
    level_id: str | None = Field(default=None, alias="levelId")
    monitor_source: MonitorSourceSpec | None = Field(default=None, alias="monitorSource")


PropertyLineClassification = Literal["street", "rear", "side", "other"]


class ReferencePlaneElem(BaseModel):
    """KRN-05: project-scope reference / work plane.

    Distinct from the family-editor variant (which lives only in family bundles).
    Anchored to a level; renders as a dashed grey line in plan and a translucent
    green vertical plane in 3D.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["reference_plane"] = "reference_plane"
    id: str
    name: str = ""
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    is_work_plane: bool = Field(default=False, alias="isWorkPlane")
    pinned: bool = Field(default=False)


class PropertyLineElem(BaseModel):
    """KRN-01: site / zoning property boundary line."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["property_line"] = "property_line"
    id: str
    name: str = ""
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    setback_mm: float | None = Field(default=None, alias="setbackMm", ge=0)
    classification: PropertyLineClassification | None = None
    authoring_mode: Literal["draw", "bearing_table"] = Field(default="draw", alias="authoringMode")
    boundary_mm: list[Vec2Mm] = Field(default_factory=list, alias="boundaryMm")
    bearing_table: dict[str, Any] | None = Field(default=None, alias="bearingTable")
    closure_error_mm: float | None = Field(default=None, alias="closureErrorMm", ge=0)
    pinned: bool = Field(default=False)


class DimensionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["dimension"] = "dimension"
    id: str
    name: str = "Dimension"
    level_id: str = Field(alias="levelId")
    a_mm: Vec2Mm = Field(alias="aMm")
    b_mm: Vec2Mm = Field(alias="bMm")
    offset_mm: Vec2Mm = Field(alias="offsetMm")
    text_offset_mm: Vec2Mm | None = Field(default=None, alias="textOffsetMm")
    anchor_a: dict[str, Any] | None = Field(default=None, alias="anchorA")
    anchor_b: dict[str, Any] | None = Field(default=None, alias="anchorB")
    state: Literal["linked", "partial", "unlinked"] = "unlinked"
    ref_element_id_a: str | None = Field(default=None, alias="refElementIdA")
    ref_element_id_b: str | None = Field(default=None, alias="refElementIdB")
    tag_definition_id: str | None = Field(default=None, alias="tagDefinitionId")
    auto_generated: bool = Field(default=False, alias="autoGenerated")
    pinned: bool = Field(default=False)


class AngularDimensionElem(BaseModel):
    """ANN-04 — view-local angular dimension between two rays from a shared vertex."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["angular_dimension"] = "angular_dimension"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    vertex_mm: Vec2Mm = Field(alias="vertexMm")
    ray_a_mm: Vec2Mm = Field(alias="rayAMm")
    ray_b_mm: Vec2Mm = Field(alias="rayBMm")
    arc_radius_mm: float = Field(default=500.0, alias="arcRadiusMm", gt=0)
    colour: str = Field(default="#202020")
    auto_generated: bool = Field(default=False, alias="autoGenerated")


class PlacedTagElem(BaseModel):
    """PLN-01 / ANN-01 — view-local placed tag (room / door / window)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["placed_tag"] = "placed_tag"
    id: str
    host_element_id: str = Field(alias="hostElementId")
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    tag_definition_id: str | None = Field(default=None, alias="tagDefinitionId")
    text_override: str | None = Field(default=None, alias="textOverride")
    auto_generated: bool = Field(default=False, alias="autoGenerated")


DetailLineStyle = Literal["solid", "dashed", "dotted"]


class DetailLineElem(BaseModel):
    """ANN-01 — view-local 2D polyline annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["detail_line"] = "detail_line"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    points_mm: list[Vec2Mm] = Field(alias="pointsMm")
    stroke_mm: float = Field(default=1.0, alias="strokeMm", gt=0)
    colour: str = Field(default="#202020")
    style: DetailLineStyle = Field(default="solid")


DetailRegionFillPattern = Literal["solid", "hatch_45", "hatch_90", "crosshatch", "dots"]


class DetailRegionElem(BaseModel):
    """ANN-01 / ANN-V3-01 — view-local 2D filled region annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["detail_region"] = "detail_region"
    id: str
    # v2 fields (ANN-01) — kept for backward compat
    host_view_id: str = Field(default="", alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(default_factory=list, alias="boundaryMm")
    fill_colour: str = Field(default="#cccccc", alias="fillColour")
    fill_pattern: DetailRegionFillPattern = Field(default="solid", alias="fillPattern")
    stroke_mm: float = Field(default=0.5, alias="strokeMm", ge=0)
    stroke_colour: str = Field(default="#202020", alias="strokeColour")
    # v3 fields (ANN-V3-01)
    view_id: str | None = Field(default=None, alias="viewId")
    vertices: list[dict] | None = None
    closed: bool | None = None
    hatch_id: str | None = Field(default=None, alias="hatchId")
    lineweight_override: float | None = Field(default=None, alias="lineweightOverride")
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")


TextNoteAnchor = Literal["tl", "tc", "tr", "cl", "c", "cr", "bl", "bc", "br"]


class TextNoteElem(BaseModel):
    """ANN-01 — view-local text note annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["text_note"] = "text_note"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    text: str
    font_size_mm: float = Field(alias="fontSizeMm", gt=0)
    anchor: TextNoteAnchor = Field(default="tl")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    colour: str = Field(default="#202020")


AnnotationSymbolType = Literal["north_arrow", "stair_up", "stair_down", "centerline"]


class AnnotationSymbolElem(BaseModel):
    """ANN-05 — view-local graphical symbol (North Arrow, Stair Path, Centerline)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["annotation_symbol"] = "annotation_symbol"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    symbol_type: AnnotationSymbolType = Field(alias="symbolType")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale: float = Field(default=1.0, gt=0)
    colour: str = Field(default="#202020")


class SpotElevationElem(BaseModel):
    """ANN-02 — view-local spot elevation annotation (diamond symbol + text)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["spot_elevation"] = "spot_elevation"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    elevation_mm: float = Field(alias="elevationMm")
    prefix: str = Field(default="")
    suffix: str = Field(default="")
    colour: str = Field(default="#202020")


class SpotCoordinateElem(BaseModel):
    """ANN-09 — view-local spot coordinate annotation (N/E at a point)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["spot_coordinate"] = "spot_coordinate"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    north_mm: float = Field(alias="northMm")
    east_mm: float = Field(alias="eastMm")
    colour: str = Field(default="#202020")


SpotSlopeFormat = Literal["percent", "ratio", "degree"]


class SpotSlopeElem(BaseModel):
    """ANN-10 — view-local spot slope annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["spot_slope"] = "spot_slope"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    slope_pct: float = Field(alias="slopePct")
    slope_format: SpotSlopeFormat = Field(default="percent", alias="slopeFormat")
    colour: str = Field(default="#202020")


class InsulationAnnotationElem(BaseModel):
    """ANN-11 — view-local insulation annotation (zigzag line)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["insulation_annotation"] = "insulation_annotation"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(default=200.0, alias="widthMm", gt=0)
    colour: str = Field(default="#202020")


class RadialDimensionElem(BaseModel):
    """ANN-06 — radial dimension from arc center to arc point."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["radial_dimension"] = "radial_dimension"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    center_mm: Vec2Mm = Field(alias="centerMm")
    arc_point_mm: Vec2Mm = Field(alias="arcPointMm")
    colour: str = Field(default="#202020")
    auto_generated: bool = Field(default=False, alias="autoGenerated")


class DiameterDimensionElem(BaseModel):
    """ANN-07 — diameter dimension across a circle."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["diameter_dimension"] = "diameter_dimension"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    center_mm: Vec2Mm = Field(alias="centerMm")
    arc_point_mm: Vec2Mm = Field(alias="arcPointMm")
    colour: str = Field(default="#202020")
    auto_generated: bool = Field(default=False, alias="autoGenerated")


class ArcLengthDimensionElem(BaseModel):
    """ANN-08 — arc length dimension on a curved segment."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["arc_length_dimension"] = "arc_length_dimension"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    center_mm: Vec2Mm = Field(alias="centerMm")
    radius_mm: float = Field(alias="radiusMm", gt=0)
    start_angle_deg: float = Field(alias="startAngleDeg")
    end_angle_deg: float = Field(alias="endAngleDeg")
    colour: str = Field(default="#202020")
    auto_generated: bool = Field(default=False, alias="autoGenerated")


class MaterialTagElem(BaseModel):
    """ANN-12 — view-local material layer tag."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["material_tag"] = "material_tag"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    host_element_id: str = Field(alias="hostElementId")
    layer_index: int = Field(default=0, alias="layerIndex", ge=0)
    position_mm: Vec2Mm = Field(alias="positionMm")
    text_override: str | None = Field(default=None, alias="textOverride")
    colour: str = Field(default="#202020")


class MultiCategoryTagElem(BaseModel):
    """ANN-13 — view-local multi-category tag (type mark)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["multi_category_tag"] = "multi_category_tag"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    host_element_id: str = Field(alias="hostElementId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    parameter_name: str = Field(default="Type Mark", alias="parameterName")
    text_override: str | None = Field(default=None, alias="textOverride")
    colour: str = Field(default="#202020")


class TreadNumberElem(BaseModel):
    """ANN-14 — auto-numbered tread annotation for a stair."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["tread_number"] = "tread_number"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    stair_element_id: str = Field(alias="stairElementId")
    start_number: int = Field(default=1, alias="startNumber", ge=1)
    colour: str = Field(default="#202020")


KeynoteTarget = Literal["element", "material", "user"]


class KeynoteElem(BaseModel):
    """ANN-15 — view-local keynote annotation linking to a key/description."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["keynote"] = "keynote"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    keynote_key: str = Field(alias="keynoteKey")
    keynote_text: str = Field(default="", alias="keynoteText")
    target: KeynoteTarget = Field(default="user")
    host_element_id: str | None = Field(default=None, alias="hostElementId")
    colour: str = Field(default="#202020")


class SpanDirectionElem(BaseModel):
    """ANN-16 — floor slab span direction arrow annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["span_direction"] = "span_direction"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    direction_deg: float = Field(default=0.0, alias="directionDeg")
    length_mm: float = Field(default=800.0, alias="lengthMm", gt=0)
    colour: str = Field(default="#202020")


DetailComponentShape = Literal[
    "us_wide_flange_beam",
    "concrete_column_square",
    "concrete_column_round",
    "steel_angle",
    "steel_channel",
    "bolt",
    "weld_symbol",
    "break_line",
    "centerline_end",
]


class DetailComponentElem(BaseModel):
    """ANN-17 — view-local 2D detail component (predefined shape)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["detail_component"] = "detail_component"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    component_shape: DetailComponentShape = Field(alias="componentShape")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    scale: float = Field(default=1.0, gt=0)
    colour: str = Field(default="#202020")


class RepeatingDetailElem(BaseModel):
    """ANN-18 — view-local repeating detail component pattern along a line."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["repeating_detail"] = "repeating_detail"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    component_shape: DetailComponentShape = Field(alias="componentShape")
    spacing_mm: float = Field(default=200.0, alias="spacingMm", gt=0)
    colour: str = Field(default="#202020")


class DetailGroupElem(BaseModel):
    """ANN-19 — named group of view-local detail elements."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["detail_group"] = "detail_group"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    name: str = Field(default="Group")
    member_ids: list[str] = Field(alias="memberIds")


class ColorFillLegendElem(BaseModel):
    """ANN-20 — view-local color fill legend box (room colour scheme legend)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["color_fill_legend"] = "color_fill_legend"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    scheme_parameter: str = Field(default="Name", alias="schemeParameter")
    title: str = Field(default="Color Fill Legend")


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
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_id: str | None = Field(
        default=None,
        alias="phaseId",
        description="SKB-08 phase tag carried forward when materialised from a mass.",
    )
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    # TOP-V3-01: elevation inherited from a toposolid heightmap at floor centroid (mm).
    toposolid_elevation_mm: float | None = Field(default=None, alias="toposolidElevationMm")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)


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
    ridge_offset_transverse_mm: float | None = Field(default=None, alias="ridgeOffsetTransverseMm")
    eave_height_left_mm: float | None = Field(default=None, alias="eaveHeightLeftMm")
    eave_height_right_mm: float | None = Field(default=None, alias="eaveHeightRightMm")
    roof_type_id: str | None = Field(default=None, alias="roofTypeId")
    material_key: str | None = Field(default=None, alias="materialKey")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_id: str | None = Field(
        default=None,
        alias="phaseId",
        description="SKB-08 phase tag carried forward when materialised from a mass.",
    )
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)


StairShape = Literal["straight", "l_shape", "u_shape", "spiral", "sketch"]


class StairTreadLine(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    from_mm: Vec2Mm = Field(alias="fromMm")
    to_mm: Vec2Mm = Field(alias="toMm")
    riser_height_mm: float | None = Field(default=None, alias="riserHeightMm")
    manual_override: bool = Field(default=False, alias="manualOverride")


class StairRun(BaseModel):
    """KRN-07: one flight in a multi-run stair.

    Straight runs use start_mm/end_mm. Curved runs (spiral, sketch) populate
    polyline_mm with ≥2 plan-coordinate points; renderers read polyline_mm when
    present and fall back to start/end otherwise.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(alias="widthMm", default=1000)
    riser_count: int = Field(alias="riserCount", default=8)
    polyline_mm: list[Vec2Mm] | None = Field(default=None, alias="polylineMm")


class StairLanding(BaseModel):
    """KRN-07: a flat polygon landing between two runs."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")


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
    # KRN-07 — multi-run support. Defaults preserve the legacy single-run shape.
    shape: StairShape = Field(default="straight")
    runs: list[StairRun] = Field(default_factory=list)
    landings: list[StairLanding] = Field(default_factory=list)
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    # KRN-07 closeout — spiral + sketch shape inputs.
    center_mm: Vec2Mm | None = Field(default=None, alias="centerMm")
    inner_radius_mm: float | None = Field(default=None, alias="innerRadiusMm")
    outer_radius_mm: float | None = Field(default=None, alias="outerRadiusMm")
    total_rotation_deg: float | None = Field(default=None, alias="totalRotationDeg")
    sketch_path_mm: list[Vec2Mm] | None = Field(default=None, alias="sketchPathMm")
    # KRN-V3-05 — by_sketch authoring mode fields.
    authoring_mode: Literal["by_component", "by_sketch"] = Field(
        default="by_component", alias="authoringMode"
    )
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    tread_lines: list[StairTreadLine] | None = Field(default=None, alias="treadLines")
    total_rise_mm: float | None = Field(default=None, alias="totalRiseMm")
    # KRN-V3-10 — monolithic / floating stair sub-kinds.
    sub_kind: Literal["standard", "monolithic", "floating"] = Field(
        default="standard", alias="subKind"
    )
    monolithic_material: str | None = Field(default=None, alias="monolithicMaterial")
    floating_tread_depth_mm: float | None = Field(default=None, alias="floatingTreadDepthMm", gt=0)
    floating_host_wall_id: str | None = Field(default=None, alias="floatingHostWallId")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    option_set_id: str | None = Field(default=None, alias="optionSetId")
    option_id: str | None = Field(default=None, alias="optionId")
    discipline: DisciplineTag | None = Field(default=None)

    @model_validator(mode="after")
    def _validate_shape_specific_fields(self) -> StairElem:
        if self.authoring_mode == "by_sketch":
            if self.boundary_mm is None or len(self.boundary_mm) < 3:
                raise ValueError("by_sketch stair requires boundaryMm with ≥ 3 points")
            if self.tread_lines is None or len(self.tread_lines) < 1:
                raise ValueError("by_sketch stair requires treadLines with ≥ 1 entry")
            if self.total_rise_mm is None or self.total_rise_mm <= 0:
                raise ValueError("by_sketch stair requires totalRiseMm > 0")
        if self.sub_kind == "floating":
            if not self.floating_host_wall_id:
                raise ValueError("'floating' stair requires floatingHostWallId")
        if self.sub_kind == "monolithic" and self.floating_host_wall_id is not None:
            raise ValueError("'monolithic' stair must not set floatingHostWallId")
        if self.authoring_mode == "by_sketch":
            return self
        if self.shape == "spiral":
            missing = [
                name
                for name, value in (
                    ("centerMm", self.center_mm),
                    ("innerRadiusMm", self.inner_radius_mm),
                    ("outerRadiusMm", self.outer_radius_mm),
                    ("totalRotationDeg", self.total_rotation_deg),
                )
                if value is None
            ]
            if missing:
                raise ValueError(
                    f"spiral stair requires {', '.join(missing)}",
                )
            if (
                self.inner_radius_mm is not None
                and self.outer_radius_mm is not None
                and self.outer_radius_mm <= self.inner_radius_mm
            ):
                raise ValueError("spiral stair outerRadiusMm must exceed innerRadiusMm")
        elif self.shape == "sketch":
            if self.sketch_path_mm is None or len(self.sketch_path_mm) < 2:
                raise ValueError("sketch stair requires sketchPathMm with at least two points")
        return self


class SlabOpeningElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["slab_opening"] = "slab_opening"
    id: str
    name: str = "Opening"
    host_floor_id: str = Field(alias="hostFloorId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    is_shaft: bool = Field(default=False, alias="isShaft")
    pinned: bool = Field(default=False)


class RoofOpeningElem(BaseModel):
    """IFC-03: opening hosted on a roof (skylight / roof penetration).

    The opening's footprint is given in plan coordinates (x, y). The
    roof renderer CSG-subtracts a vertical extrusion of this footprint
    spanning the roof body. Validation: footprint must lie within the
    host roof's plan footprint.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["roof_opening"] = "roof_opening"
    id: str
    name: str = "Roof opening"
    host_roof_id: str = Field(alias="hostRoofId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    pinned: bool = Field(default=False)


class BalusterPattern(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    rule: Literal["regular", "glass_panel", "cable"]
    spacing_mm: float | None = Field(default=None, alias="spacingMm", gt=0)
    profile_family_id: str | None = Field(default=None, alias="profileFamilyId")

    @model_validator(mode="after")
    def _validate_regular_requires_spacing(self) -> BalusterPattern:
        if self.rule == "regular" and (self.spacing_mm is None or self.spacing_mm <= 0):
            raise ValueError("balusterPattern.rule='regular' requires spacingMm > 0")
        return self


class HandrailSupport(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    interval_mm: float = Field(alias="intervalMm", gt=0)
    bracket_family_id: str = Field(alias="bracketFamilyId")
    host_wall_id: str = Field(alias="hostWallId")


class RailingElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["railing"] = "railing"
    id: str
    name: str = "Railing"
    hosted_stair_id: str | None = Field(default=None, alias="hostedStairId")
    path_mm: list[Vec2Mm] = Field(alias="pathMm")
    guard_height_mm: float = Field(alias="guardHeightMm", default=1040)
    baluster_pattern: BalusterPattern | None = Field(default=None, alias="balusterPattern")
    handrail_supports: list[HandrailSupport] | None = Field(default=None, alias="handrailSupports")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    agent_trace: AgentTrace | None = Field(default=None, alias="agentTrace")
    discipline: DisciplineTag | None = Field(default=None)


class SweepPathPoint(BaseModel):
    """KRN-15 — single vertex in a sweep's path polyline (xMm, yMm, optional zMm)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    z_mm: float | None = Field(default=None, alias="zMm")


class SweepProfilePoint(BaseModel):
    """KRN-15 — single vertex in a sweep's 2D profile cross-section."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    u_mm: float = Field(alias="uMm")
    v_mm: float = Field(alias="vMm")


SweepProfilePlane = Literal["normal_to_path_start", "work_plane"]


class SweepElem(BaseModel):
    """KRN-15 — project-level swept solid (closed profile along a polyline path)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["sweep"] = "sweep"
    id: str
    name: str = "Sweep"
    level_id: str = Field(alias="levelId")
    path_mm: list[SweepPathPoint] = Field(alias="pathMm")
    profile_mm: list[SweepProfilePoint] = Field(alias="profileMm")
    profile_plane: SweepProfilePlane = Field(default="work_plane", alias="profilePlane")
    material_key: str | None = Field(default=None, alias="materialKey")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)


DormerRoofKind = Literal["flat", "shed", "gable", "hipped"]


class DormerPositionOnRoof(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    along_ridge_mm: float = Field(alias="alongRidgeMm")
    across_ridge_mm: float = Field(alias="acrossRidgeMm")


class DormerElem(BaseModel):
    """KRN-14 — dormer cut through host roof + dormer walls + roof."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["dormer"] = "dormer"
    id: str
    name: str = "Dormer"
    host_roof_id: str = Field(alias="hostRoofId")
    position_on_roof: DormerPositionOnRoof = Field(alias="positionOnRoof")
    width_mm: float = Field(alias="widthMm", gt=0)
    wall_height_mm: float = Field(alias="wallHeightMm", gt=0)
    depth_mm: float = Field(alias="depthMm", gt=0)
    dormer_roof_kind: DormerRoofKind = Field(default="flat", alias="dormerRoofKind")
    dormer_roof_pitch_deg: float | None = Field(default=None, alias="dormerRoofPitchDeg")
    ridge_height_mm: float | None = Field(default=None, alias="ridgeHeightMm")
    wall_material_key: str | None = Field(default=None, alias="wallMaterialKey")
    roof_material_key: str | None = Field(default=None, alias="roofMaterialKey")
    has_floor_opening: bool = Field(default=False, alias="hasFloorOpening")
    pinned: bool = Field(default=False)

    @model_validator(mode="after")
    def _ridge_height_required_for_pitched(self) -> DormerElem:
        if self.dormer_roof_kind in ("gable", "hipped"):
            if self.ridge_height_mm is None or self.ridge_height_mm <= 0:
                raise ValueError(
                    "DormerElem.ridgeHeightMm must be > 0 when dormerRoofKind is "
                    "'gable' or 'hipped'"
                )
        return self

    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)


class WallEdgeFixed(BaseModel):
    """KRN-V3-08 — named top/bottom edge of a wall for sweep/reveal hosting."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["top", "bottom"]


class WallEdgeSpan(BaseModel):
    """KRN-V3-08 — custom vertical span along a wall for sweep/reveal hosting."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    start_mm: float = Field(alias="startMm")
    end_mm: float = Field(alias="endMm")


WallEdgeSpec = WallEdgeFixed | WallEdgeSpan


class RoofJoinElem(BaseModel):
    """KRN-V3-03 G11 — derived overlay that joins two roof solids along a seam.

    Does not mutate the source RoofElem records. The renderer computes the seam
    polyline on the fly from the two RoofElem footprints.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["roof_join"] = "roof_join"
    id: str
    name: str = "Roof Join"
    primary_roof_id: str = Field(alias="primaryRoofId")
    secondary_roof_id: str = Field(alias="secondaryRoofId")
    seam_mode: Literal["clip_secondary_into_primary", "merge_at_ridge"] = Field(alias="seamMode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")


class EdgeProfileRunElem(BaseModel):
    """KRN-V3-03 G12 — swept profile along a host element edge (fascia/gutter/cornice/plinth).

    ``hostEdge`` is one of the named edge tokens or a custom ``{startMm, endMm}`` dict.
    The renderer computes the swept solid; plan view shows a thin line on the edge.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["edge_profile_run"] = "edge_profile_run"
    id: str
    name: str = "Edge Profile Run"
    host_element_id: str = Field(alias="hostElementId")
    host_edge: Any = Field(alias="hostEdge")
    profile_family_id: str = Field(alias="profileFamilyId")
    offset_mm: Vec2Mm = Field(alias="offsetMm")
    miter_mode: Literal["auto", "manual"] = Field(default="auto", alias="miterMode")
    mode: Literal["sweep", "reveal"] = Field(default="sweep")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")


class SoffitElem(BaseModel):
    """KRN-V3-03 G13 — horizontal soffit panel under a roof eave.

    ``boundaryMm`` is a closed plan polygon (≥ 3 vertices). ``zMm`` is the
    underside elevation; the engine fills it from the host roof eave when the
    command omits it.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["soffit"] = "soffit"
    id: str
    name: str = "Soffit"
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    host_roof_id: str | None = Field(default=None, alias="hostRoofId")
    thickness_mm: float = Field(alias="thicknessMm")
    z_mm: float = Field(alias="zMm")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)

    @model_validator(mode="after")
    def _validate_boundary(self) -> SoffitElem:
        if len(self.boundary_mm) < 3:
            raise ValueError("SoffitElem.boundaryMm must have ≥ 3 vertices")
        return self


class BalconyElem(BaseModel):
    """Slab + glass balustrade projecting from a host wall at a fixed elevation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["balcony"] = "balcony"
    id: str
    name: str = "Balcony"
    wall_id: str = Field(alias="wallId")
    elevation_mm: float = Field(alias="elevationMm")
    projection_mm: float = Field(default=650, alias="projectionMm")
    slab_thickness_mm: float = Field(default=150, alias="slabThicknessMm")
    balustrade_height_mm: float = Field(default=1050, alias="balustradeHeightMm")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)


Text3dFontFamily = Literal["helvetiker", "optimer", "gentilis"]


class Text3dElem(BaseModel):
    """Extruded 3D letterforms (FAM-06). Real geometric text — distinct from text annotations."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["text_3d"] = "text_3d"
    id: str
    text: str = ""
    font_family: Text3dFontFamily = Field(default="helvetiker", alias="fontFamily")
    font_size_mm: float = Field(default=200.0, alias="fontSizeMm", gt=0)
    depth_mm: float = Field(default=50.0, alias="depthMm", gt=0)
    position_mm: Vec3Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


# --- KRN-06: Origin elements (project base point, survey point, internal origin) ---


INTERNAL_ORIGIN_ID = "internal_origin"


class ProjectBasePointElem(BaseModel):
    """KRN-06: project base point. Singleton; defines project rendering origin."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["project_base_point"] = "project_base_point"
    id: str
    position_mm: Vec3Mm = Field(alias="positionMm")
    angle_to_true_north_deg: float = Field(default=0.0, alias="angleToTrueNorthDeg")
    latitude_deg: float = Field(default=0.0, alias="latitudeDeg")
    longitude_deg: float = Field(default=0.0, alias="longitudeDeg")
    clipped: bool = False


class SurveyPointElem(BaseModel):
    """KRN-06: survey point. Singleton; defines shared-coordinates origin."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["survey_point"] = "survey_point"
    id: str
    position_mm: Vec3Mm = Field(alias="positionMm")
    shared_elevation_mm: float = Field(default=0.0, alias="sharedElevationMm")
    clipped: bool = False


class InternalOriginElem(BaseModel):
    """KRN-06: internal origin. Singleton at modelling-space origin; never moves."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["internal_origin"] = "internal_origin"
    id: str = INTERNAL_ORIGIN_ID


# --- SUN-V3-01: sun settings singleton -----------------------------------------


SUN_SETTINGS_ID = "sun_settings"


class SunSettingsTimeOfDay(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    hours: int = 12
    minutes: int = 0


class SunSettingsAnimationRange(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    start_iso: str = Field(alias="startIso")
    end_iso: str = Field(alias="endIso")
    interval_minutes: int = Field(default=60, alias="intervalMinutes")


class SunSettingsElem(BaseModel):
    """SUN-V3-01: project-level sun position singleton."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["sun_settings"] = "sun_settings"
    id: str = SUN_SETTINGS_ID
    latitude_deg: float = Field(default=48.13, alias="latitudeDeg")
    longitude_deg: float = Field(default=11.58, alias="longitudeDeg")
    date_iso: str = Field(default="2026-06-21", alias="dateIso")
    time_of_day: SunSettingsTimeOfDay = Field(
        default_factory=lambda: SunSettingsTimeOfDay(hours=14, minutes=30),
        alias="timeOfDay",
    )
    animation_range: SunSettingsAnimationRange | None = Field(default=None, alias="animationRange")
    daylight_saving_strategy: Literal["auto", "on", "off"] = Field(
        default="auto", alias="daylightSavingStrategy"
    )


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
]
AreaScheme = Literal["gross_building", "net", "rentable"]


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


class ConstructabilitySuppressionElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["constructability_suppression"] = "constructability_suppression"
    id: str
    rule_id: str | None = Field(default=None, alias="ruleId")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    reason: str
    active: bool = True
    expires_revision: int | None = Field(default=None, alias="expiresRevision")


ConstructabilityIssueStatus = Literal[
    "new",
    "active",
    "reviewed",
    "approved",
    "not_an_issue",
    "resolved",
    "suppressed",
]


class ConstructabilityIssueElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["constructability_issue"] = "constructability_issue"
    id: str
    fingerprint: str
    rule_id: str = Field(alias="ruleId")
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    pair_key: str | None = Field(default=None, alias="pairKey")
    status: ConstructabilityIssueStatus = "new"
    first_seen_revision: str | int | None = Field(default=None, alias="firstSeenRevision")
    last_seen_revision: str | int | None = Field(default=None, alias="lastSeenRevision")
    resolved_revision: str | int | None = Field(default=None, alias="resolvedRevision")
    location_bucket: str | None = Field(default=None, alias="locationBucket")
    message: str | None = None
    severity: str | None = None
    discipline: str | None = None
    blocking_class: str | None = Field(default=None, alias="blockingClass")
    recommendation: str | None = None
    assignee_placeholder: str | None = Field(default=None, alias="assigneePlaceholder")
    resolution_comment: str | None = Field(default=None, alias="resolutionComment")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, alias="evidenceRefs")


AgentAssumptionSource = Literal["manual", "bundle_dry_run", "evidence_summary"]
AgentAssumptionClosureStatus = Literal["open", "resolved", "accepted", "deferred"]
# SKB-08: phaseId values match the SKB-12 cookbook's seven phase tags.
SkbPhaseId = Literal[
    "massing",
    "skeleton",
    "envelope",
    "openings",
    "interior",
    "detail",
    "documentation",
]


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
    # SKB-08: phase + sketch anchor for sketch-to-BIM auditability.
    phase_id: SkbPhaseId | None = Field(
        default=None,
        alias="phaseId",
        description="SKB-08: the SKB-12 phase the assumption was made in.",
    )
    sketch_anchor_mm: dict | None = Field(
        default=None,
        alias="sketchAnchorMm",
        description=(
            "SKB-08: optional sketch-coordinate anchor for the inference. "
            "Free-form dict so authors can carry pixel coords, polygon refs, "
            "or panel labels without a forced schema."
        ),
    )


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
    context_objects: list[SiteContextObjectRow] = Field(
        default_factory=list, alias="contextObjects"
    )


AreaRuleSet = Literal["gross", "net", "no_rules"]


class AreaElem(BaseModel):
    """KRN-08 — `area` element kind for legal/permit area calculations.

    Distinct from `room`: areas may include exterior porches and exclude
    interior shafts based on `ruleSet`. Authored via SKT-01 sketch session.
    `computedAreaSqMm` is recomputed by the engine after every command apply.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["area"] = "area"
    id: str
    name: str = "Area"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    rule_set: AreaRuleSet = Field(default="no_rules", alias="ruleSet")
    area_scheme: AreaScheme = Field(default="gross_building", alias="areaScheme")
    apply_area_rules: bool = Field(default=True, alias="applyAreaRules")
    computed_area_sq_mm: float | None = Field(default=None, alias="computedAreaSqMm")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")


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
# MEP elements — pipe, duct, and their legend annotations (MEP-01..04)
# ---------------------------------------------------------------------------

PipeSystemType = Literal[
    "domestic_cold_water",
    "domestic_hot_water",
    "sanitary",
    "storm_drainage",
    "fire_protection",
    "chilled_water",
    "condenser_water",
    "heating_hot_water",
    "other",
]


class PipeElem(BaseModel):
    """MEP-01 — straight pipe segment between two points."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["pipe"] = "pipe"
    id: str
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    diameter_mm: float = Field(default=25.0, alias="diameterMm", gt=0)
    system_type: PipeSystemType = Field(default="other", alias="systemType")
    material_key: str | None = Field(default=None, alias="materialKey")
    colour: str | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


DuctSystemType = Literal[
    "supply_air",
    "return_air",
    "exhaust_air",
    "outside_air",
    "other_air",
    "other",
]
DuctShape = Literal["rectangular", "round", "oval"]


class DuctElem(BaseModel):
    """MEP-02 — straight duct segment between two points."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["duct"] = "duct"
    id: str
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    elevation_mm: float = Field(default=0.0, alias="elevationMm")
    width_mm: float = Field(default=300.0, alias="widthMm", gt=0)
    height_mm: float = Field(default=200.0, alias="heightMm", gt=0)
    shape: DuctShape = Field(default="rectangular")
    system_type: DuctSystemType = Field(default="other", alias="systemType")
    colour: str | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)
    pinned: bool = Field(default=False)


class PipeLegendEntrySpec(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    system_type: str = Field(alias="systemType")
    label: str
    colour: str


class PipeLegendElem(BaseModel):
    """MEP-03 — view-local pipe legend annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["pipe_legend"] = "pipe_legend"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[PipeLegendEntrySpec] = Field(default_factory=list)
    title: str = Field(default="Pipe Legend")


class DuctLegendEntrySpec(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    system_type: str = Field(alias="systemType")
    label: str
    colour: str


class DuctLegendElem(BaseModel):
    """MEP-04 — view-local duct legend annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["duct_legend"] = "duct_legend"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    entries: list[DuctLegendEntrySpec] = Field(default_factory=list)
    title: str = Field(default="Duct Legend")


class RevisionCloudElem(BaseModel):
    """ANN-03 — view-local revision cloud (closed cloud-shaped polygon boundary)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["revision_cloud"] = "revision_cloud"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    colour: str = Field(default="#e05000")
    stroke_mm: float = Field(default=1.0, alias="strokeMm", gt=0)


class SelectionSetRuleSpec(BaseModel):
    """FED-02: a single rule in a selection set's filter list.

    ``link_scope`` controls which models the rule resolves against:

    * ``'host'`` (default) — only host elements match.
    * ``'all_links'`` — every ``link_model`` element is walked; matching source
      elements are included with their AABBs transformed by the link's
      ``positionMm`` + ``rotationDeg``.
    * ``{ 'specificLinkId': '<link-id>' }`` — restrict matches to a single
      link.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    field: Literal["category", "level", "typeName"]
    operator: Literal["equals", "contains"]
    value: str
    link_scope: str | dict[str, str] | None = Field(default=None, alias="linkScope")


class SelectionSetElem(BaseModel):
    """FED-02: a named filter that resolves to a list of element ids.

    Stored in the model so it can be referenced by clash tests and (later)
    schedules. The element itself is non-graphical.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["selection_set"] = "selection_set"
    id: str
    name: str = "Selection Set"
    filter_rules: list[SelectionSetRuleSpec] = Field(default_factory=list, alias="filterRules")


class ClashResultSpec(BaseModel):
    """FED-02: a single pair-wise clash between two resolved elements.

    ``link_chain_a`` / ``link_chain_b`` are empty arrays for host elements
    and ``[link_id]`` for elements pulled from a linked model. Multi-hop
    transitive links are deferred (FED-01's expander is single-hop only).
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    element_id_a: str = Field(alias="elementIdA")
    element_id_b: str = Field(alias="elementIdB")
    distance_mm: float = Field(alias="distanceMm")
    link_chain_a: list[str] = Field(default_factory=list, alias="linkChainA")
    link_chain_b: list[str] = Field(default_factory=list, alias="linkChainB")


class ClashTestElem(BaseModel):
    """FED-02: a pair of selection sets that the engine clash-tests on demand.

    ``set_a_ids`` / ``set_b_ids`` are lists of ``selection_set`` element ids
    (multiple sets are unioned). Clash detection is run by the
    ``RunClashTest`` command which writes its findings into ``results``.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["clash_test"] = "clash_test"
    id: str
    name: str = "Clash Test"
    set_a_ids: list[str] = Field(default_factory=list, alias="setAIds")
    set_b_ids: list[str] = Field(default_factory=list, alias="setBIds")
    tolerance_mm: float = Field(default=0.0, alias="toleranceMm")
    results: list[ClashResultSpec] | None = None


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
    "wall_opening",
    "room",
    "grid_line",
    "dimension",
    "viewpoint",
    "issue",
    "floor",
    "roof",
    "stair",
    "slab_opening",
    "roof_opening",
    "railing",
    "family_type",
    "family_instance",
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
    "text_3d",
    "project_base_point",
    "survey_point",
    "internal_origin",
    "sun_settings",
    "link_model",
    "link_dxf",
    "selection_set",
    "clash_test",
    "placed_tag",
    "detail_line",
    "detail_region",
    "text_note",
    "reference_plane",
    "property_line",
    "balcony",
    "sweep",
    "dormer",
    "area",
    "masking_region",
    "spot_elevation",
    "material_tag",
    "multi_category_tag",
    "tread_number",
    "keynote",
    "span_direction",
    "detail_component",
    "repeating_detail",
    "detail_group",
    "color_fill_legend",
    "mass",
    "constraint",
    "roof_join",
    "edge_profile_run",
    "soffit",
    "view",
    "toposolid",
    "property_definition",
    "brand_template",
]


class PropertyDefinitionElem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["property_definition"] = "property_definition"
    id: str
    key: str
    label: str
    prop_kind: Literal["mm", "m2", "currency", "enum", "string", "bool", "date"] = Field(
        alias="propKind"
    )
    enum_values: list[str] | None = Field(default=None, alias="enumValues")
    default_value: Any | None = Field(default=None, alias="defaultValue")
    applies_to: list[str] = Field(alias="appliesTo")
    show_in_schedule: bool = Field(default=True, alias="showInSchedule")


class ColumnElem(BaseModel):
    """EDT-04 — vertical structural column placed at a single point on a level.

    Cross-section is a rectangle (bMm × hMm) with optional rotation about
    the vertical axis. Spans from the host level upward by ``heightMm``;
    optional top constraint mirrors the wall datum-constraint pattern.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["column"] = "column"
    id: str
    name: str = "Column"
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    b_mm: float = Field(alias="bMm", default=300, gt=0)
    h_mm: float = Field(alias="hMm", default=300, gt=0)
    height_mm: float = Field(alias="heightMm", default=2800, gt=0)
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")
    base_constraint_offset_mm: float = Field(default=0, alias="baseConstraintOffsetMm")
    top_constraint_level_id: str | None = Field(default=None, alias="topConstraintLevelId")
    top_constraint_offset_mm: float = Field(default=0, alias="topConstraintOffsetMm")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)


class BeamElem(BaseModel):
    """EDT-04 — horizontal structural beam between two points on a level.

    Optional ``startColumnId`` / ``endColumnId`` link the beam to the
    columns it bears on, which lets the geometry layer trim the ends.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["beam"] = "beam"
    id: str
    name: str = "Beam"
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(alias="widthMm", default=200, gt=0)
    height_mm: float = Field(alias="heightMm", default=400, gt=0)
    material_key: str | None = Field(default=None, alias="materialKey")
    start_column_id: str | None = Field(default=None, alias="startColumnId")
    end_column_id: str | None = Field(default=None, alias="endColumnId")
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)


class CeilingElem(BaseModel):
    """EDT-04 — flat ceiling slab bounded by a closed polygon at a level.

    ``heightOffsetMm`` is measured from the host level elevation; positive
    values raise the ceiling above the level. Distinct from ``floor``
    because ceilings hang from above and host downward-facing finishes.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["ceiling"] = "ceiling"
    id: str
    name: str = "Ceiling"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    height_offset_mm: float = Field(default=2700, alias="heightOffsetMm")
    thickness_mm: float = Field(default=20, alias="thicknessMm", gt=0)
    ceiling_type_id: str | None = Field(default=None, alias="ceilingTypeId")
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)
    props: dict[str, Any] | None = Field(default=None)


ConstraintRule = Literal[
    "equal_distance",
    "equal_length",
    "parallel",
    "perpendicular",
    "collinear",
]
ConstraintAnchor = Literal["start", "end", "mid", "center"]


class ConstraintRefRow(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    element_id: str = Field(alias="elementId")
    anchor: ConstraintAnchor = "center"


class ConstraintElem(BaseModel):
    """EDT-02 — geometric constraint between element groups.

    Engine evaluates constraints after each command apply and rejects
    commands that would violate any `error`-severity constraint. Locked
    distances (`equal_distance` with `lockedValueMm`) are the most common
    case, set via the padlock UI on a temporary dimension.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["constraint"] = "constraint"
    id: str
    name: str = ""
    rule: ConstraintRule
    refs_a: list[ConstraintRefRow] = Field(alias="refsA")
    refs_b: list[ConstraintRefRow] = Field(alias="refsB")
    locked_value_mm: float | None = Field(default=None, alias="lockedValueMm")
    severity: Literal["warning", "error"] = "error"
    pinned: bool = Field(default=False)


class MassElem(BaseModel):
    """SKB-02 — volumetric massing primitive.

    An axis-aligned (or rotated) box representing a building mass before
    walls are authored. Used during the SKB-12 cookbook's massing phase
    so the agent can iterate on volumes before committing to walls.

    A subsequent `materializeMassToWalls` engine command (deferred)
    auto-extracts walls + floor + roof-stub from each mass so the agent
    never starts the wall phase from a blank canvas.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["mass"] = "mass"
    id: str
    name: str = "Mass"
    level_id: str = Field(alias="levelId")
    footprint_mm: list[Vec2Mm] = Field(
        alias="footprintMm",
        description=(
            "Closed polygon of the mass's plan footprint (≥3 vertices). "
            "Axis-aligned rectangles use 4 corners; arbitrary polygons OK."
        ),
    )
    height_mm: float = Field(default=3000, alias="heightMm", gt=0)
    rotation_deg: float = Field(default=0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")
    phase_id: str | None = Field(
        default="massing",
        alias="phaseId",
        description="SKB-08 phase tag; defaults to 'massing'.",
    )
    pinned: bool = Field(default=False)
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: DisciplineTag | None = Field(default=None)


class PresentationLinkElem(BaseModel):
    """OUT-V3-01 — live presentation URL token persisted as a document element."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["presentation_link"] = "presentation_link"
    id: str
    model_id: str = Field(alias="modelId")
    page_scope_ids: list[str] = Field(default_factory=list, alias="pageScopeIds")
    token: str
    permission: Literal["viewer"] = "viewer"
    allow_measurement: bool = Field(default=False, alias="allowMeasurement")
    allow_comment: bool = Field(default=False, alias="allowComment")
    expires_at: int | None = Field(default=None, alias="expiresAt")
    created_at: int = Field(alias="createdAt")
    revoked_at: int | None = Field(default=None, alias="revokedAt")


class VoidCutElem(BaseModel):
    """SKT-01 — subtractive-boolean marker against a host element.

    The geometry is a closed profile + extrusion depth; the renderer is
    responsible for performing the actual CSG. The element exists in the
    document so it survives undo / redo and IFC export.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["void_cut"] = "void_cut"
    id: str
    host_element_id: str = Field(alias="hostElementId")
    profile_mm: list[Vec2Mm] = Field(alias="profileMm")
    depth_mm: float = Field(alias="depthMm", gt=0)


class PhaseElem(BaseModel):
    """KRN-V3-01 — project-level phasing primitive.

    Default chain: Existing (ord=0) → Demolition (ord=1) → New (ord=2).
    ``ord`` governs display order and element classification: phase_created.ord ==
    view.phase.ord → new; < view.phase.ord → existing or demolition.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["phase"] = "phase"
    id: str
    name: str
    ord: int = 0


class TokenSlot(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    name: str
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    font_size_mm: float = Field(default=3.5, alias="fontSizeMm")


class TitleblockTypeElem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["titleblock_type"] = "titleblock_type"
    id: str
    name: str
    svg_template: str = Field(default="", alias="svgTemplate")
    token_slots: list[TokenSlot] = Field(default_factory=list, alias="tokenSlots")


DEFAULT_TITLEBLOCK_TYPE = TitleblockTypeElem(
    id="default-a1-titleblock",
    name="A1 Landscape Standard",
    svgTemplate="",
    tokenSlots=[
        {"name": "projectName", "xMm": 180.0, "yMm": 15.0, "fontSizeMm": 5.0},
        {"name": "drawnBy", "xMm": 180.0, "yMm": 10.0, "fontSizeMm": 3.5},
        {"name": "checkedBy", "xMm": 220.0, "yMm": 10.0, "fontSizeMm": 3.5},
        {"name": "date", "xMm": 260.0, "yMm": 10.0, "fontSizeMm": 3.5},
        {"name": "number", "xMm": 260.0, "yMm": 15.0, "fontSizeMm": 5.0},
    ],
)


class WindowLegendViewElem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["window_legend_view"] = "window_legend_view"
    id: str
    name: str
    scope: Literal["all", "sheet", "project"] = "project"
    sort_by: Literal["type", "width", "count"] = Field(default="type", alias="sortBy")
    parent_sheet_id: str | None = Field(default=None, alias="parentSheetId")


# ---------------------------------------------------------------------------
# TOP-V3-01 — Toposolid primitive
# ---------------------------------------------------------------------------


class HeightSample(BaseModel):
    """TOP-V3-01 — single (x, y, z) terrain sample point."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    z_mm: float = Field(alias="zMm")


class HeightmapGrid(BaseModel):
    """Regular-grid DEM raster (dense parametrisation)."""

    """TOP-V3-01 — regular-grid heightmap representation."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    step_mm: float = Field(alias="stepMm")
    rows: int
    cols: int
    values: list[float]  # row-major, len == rows * cols


class ToposolidElem(BaseModel):
    """TOP-V3-01 terrain solid primitive."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["toposolid"] = "toposolid"
    id: str
    name: str | None = None
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    height_samples: list[HeightSample] = Field(default_factory=list, alias="heightSamples")
    heightmap_grid_mm: HeightmapGrid | None = Field(default=None, alias="heightmapGridMm")
    thickness_mm: float = Field(default=1500.0, alias="thicknessMm")
    base_elevation_mm: float | None = Field(default=None, alias="baseElevationMm")
    default_material_key: str | None = Field(default=None, alias="defaultMaterialKey")
    pinned: bool = False
    phase_created: str | None = Field(default=None, alias="phaseCreated")
    phase_demolished: str | None = Field(default=None, alias="phaseDemolished")
    discipline: str | None = None


# ---------------------------------------------------------------------------
# TOP-V3-02 — Toposolid subdivision (surface finish region)
# ---------------------------------------------------------------------------

ToposolidFinishCategory = Literal["paving", "lawn", "road", "planting", "other"]


class ToposolidSubdivisionElem(BaseModel):
    """TOP-V3-02 — a named surface-finish region on a host toposolid.

    A closed XY polygon (``boundary_mm``) within the host toposolid's footprint
    that receives a distinct finish material (paving, lawn, road, planting, other).
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["toposolid_subdivision"] = "toposolid_subdivision"
    id: str
    name: str | None = None
    host_toposolid_id: str = Field(alias="hostToposolidId")
    boundary_mm: list[dict] = Field(alias="boundaryMm")  # [{xMm, yMm}] closed polygon
    finish_category: ToposolidFinishCategory = Field(alias="finishCategory")
    material_key: str = Field(alias="materialKey")


# ---------------------------------------------------------------------------
# TOP-V3-04 — Graded region element
# ---------------------------------------------------------------------------


class GradedRegionElem(BaseModel):
    """TOP-V3-04 — a graded region anchored to a toposolid surface.

    ``flat`` mode: the region is levelled to ``target_z_mm``.
    ``slope`` mode: the region is graded along ``slope_axis_deg`` at ``slope_deg_percent``.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["graded_region"] = "graded_region"
    id: str
    host_toposolid_id: str = Field(alias="hostToposolidId")
    boundary_mm: list[dict] = Field(alias="boundaryMm")  # [{xMm, yMm}]
    target_mode: Literal["flat", "slope"] = Field("flat", alias="targetMode")
    target_z_mm: float | None = Field(None, alias="targetZMm")
    slope_axis_deg: float | None = Field(None, alias="slopeAxisDeg")
    slope_deg_percent: float | None = Field(None, alias="slopeDegPercent")


# AST-V3-01 — Asset library entry + placed asset instance
# ---------------------------------------------------------------------------


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
    plan_symbol_kind: AssetSymbolKind | None = Field(default=None, alias="planSymbolKind")
    render_proxy_kind: AssetSymbolKind | None = Field(default=None, alias="renderProxyKind")
    param_schema: list[AssetParamEntry] | None = Field(default=None, alias="paramSchema")
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


# ---------------------------------------------------------------------------
# OUT-V3-03 — BrandTemplate element
# ---------------------------------------------------------------------------


class BrandTemplateElem(BaseModel):
    """OUT-V3-03 — Layer-C brand override for PDF/PPTX export."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["brand_template"] = "brand_template"
    id: str
    name: str
    accent_hex: str = Field(alias="accentHex")
    accent_foreground_hex: str = Field(alias="accentForegroundHex")
    typeface: str = "Inter"
    logo_mark_svg_uri: str | None = Field(default=None, alias="logoMarkSvgUri")
    css_override_snippet: str | None = Field(default=None, alias="cssOverrideSnippet")


# ---------------------------------------------------------------------------
# OUT-V3-02 — Presentation canvas, frames, saved views
# ---------------------------------------------------------------------------


class FrameElem(BaseModel):
    """OUT-V3-02 — rectangular crop on a presentation canvas pointing at a viewId."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["frame"] = "frame"
    id: str
    presentation_canvas_id: str = Field(alias="presentationCanvasId")
    view_id: str = Field(alias="viewId")
    position_mm: dict = Field(alias="positionMm")  # {xMm, yMm}
    size_mm: dict = Field(alias="sizeMm")  # {widthMm, heightMm}
    caption: str | None = None
    brand_template_id: str | None = Field(None, alias="brandTemplateId")
    sort_order: int = Field(0, alias="sortOrder")


class SavedViewElem(BaseModel):
    """OUT-V3-02 — saved camera + visibility state on a view (3D/plan/sheet)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["saved_view"] = "saved_view"
    id: str
    base_view_id: str = Field(alias="baseViewId")
    name: str
    camera_state: dict | None = Field(None, alias="cameraState")
    visibility_overrides: dict | None = Field(None, alias="visibilityOverrides")
    detail_level: str | None = Field(None, alias="detailLevel")
    thumbnail_data_uri: str | None = Field(None, alias="thumbnailDataUri")


class PresentationCanvasElem(BaseModel):
    """OUT-V3-02 — named canvas that groups an ordered sequence of frames."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["presentation_canvas"] = "presentation_canvas"
    id: str
    name: str
    frame_ids: list[str] = Field(default_factory=list, alias="frameIds")


# ---------------------------------------------------------------------------
# CON-V3-02 — Concept seed handoff element
# ---------------------------------------------------------------------------


class ConceptSeedElem(BaseModel):
    """CON-V3-02 — typed handoff contract between T6 (concept/tracing) and T9 (refinement agent).

    A ConceptSeed carries structured layout JSON + envelope tokens + assumptions log.
    Lifecycle: draft → committed (T9 can consume) → consumed.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["concept_seed"] = "concept_seed"
    id: str
    model_id: str = Field(alias="modelId")
    source_underlay_id: str | None = Field(default=None, alias="sourceUnderlayId")
    envelope_tokens: list[dict] = Field(default_factory=list, alias="envelopeTokens")
    kernel_element_drafts: list[dict] = Field(default_factory=list, alias="kernelElementDrafts")
    assumptions_log: list[dict] = Field(default_factory=list, alias="assumptionsLog")
    status: Literal["draft", "committed", "consumed"] = "draft"
    committed_at: str | None = Field(default=None, alias="committedAt")
    schema_version: str = Field(default="con-v3.0", alias="schemaVersion")


# ---------------------------------------------------------------------------
# OSM-V3-01 — Neighborhood massing import
# ---------------------------------------------------------------------------


class NeighborhoodMassElem(BaseModel):
    """OSM-V3-01 — read-only building footprint imported from OpenStreetMap."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["neighborhood_mass"] = "neighborhood_mass"
    id: str
    osm_id: str | None = Field(None, alias="osmId")
    footprint_mm: list[dict] = Field(alias="footprintMm")  # [{xMm, yMm}]
    height_mm: float = Field(alias="heightMm")
    base_elevation_mm: float = Field(0.0, alias="baseElevationMm")
    source: Literal["osm", "manual"] = "osm"
    is_read_only: bool = Field(True, alias="isReadOnly")


class NeighborhoodImportSessionElem(BaseModel):
    """OSM-V3-01 — records the bounding box + timestamp of an OSM neighborhood import."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["neighborhood_import_session"] = "neighborhood_import_session"
    id: str
    bbox: dict  # {minLat, minLon, maxLat, maxLon}
    fetch_timestamp: str = Field(alias="fetchTimestamp")  # ISO 8601
    osm_etag: str | None = Field(None, alias="osmEtag")
    radius_m: float = Field(200.0, alias="radiusM")


# NOTE: PropertyDefinitionElem is defined earlier in this file (SCH-V3-01).
# The duplicate stub that was here has been removed to fix the discriminated-union breakage.

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
    | WallOpeningElem
    | RoomElem
    | GridLineElem
    | DimensionElem
    | AngularDimensionElem
    | ViewpointElem
    | IssueElem
    | FloorElem
    | RoofElem
    | StairElem
    | SlabOpeningElem
    | RoofOpeningElem
    | RailingElem
    | BalconyElem
    | FamilyTypeElem
    | RoomSeparationElem
    | PlanRegionElem
    | TagDefinitionElem
    | PlanTagStyleElem
    | JoinGeometryElem
    | SectionCutElem
    | ElevationViewElem
    | PlanViewElem
    | ViewTemplateElem
    | SheetElem
    | ScheduleElem
    | CalloutElem
    | BcfElem
    | ConstructabilitySuppressionElem
    | ConstructabilityIssueElem
    | AgentAssumptionElem
    | AgentDeviationElem
    | ValidationRuleElem
    | SiteElem
    | Text3dElem
    | ProjectBasePointElem
    | SurveyPointElem
    | InternalOriginElem
    | SunSettingsElem
    | LinkModelElem
    | LinkDxfElem
    | ExternalLinkElem
    | SelectionSetElem
    | ClashTestElem
    | PlacedTagElem
    | DetailLineElem
    | DetailRegionElem
    | TextNoteElem
    | AnnotationSymbolElem
    | ReferencePlaneElem
    | PropertyLineElem
    | SweepElem
    | DormerElem
    | AreaElem
    | MaskingRegionElem
    | SpotElevationElem
    | MaterialTagElem
    | MultiCategoryTagElem
    | TreadNumberElem
    | KeynoteElem
    | SpanDirectionElem
    | DetailComponentElem
    | RepeatingDetailElem
    | DetailGroupElem
    | ColorFillLegendElem
    | FamilyInstanceElem
    | ColumnElem
    | BeamElem
    | CeilingElem
    | MassElem
    | PresentationLinkElem
    | VoidCutElem
    | ConstraintElem
    | PhaseElem
    | RoofJoinElem
    | EdgeProfileRunElem
    | SoffitElem
    | TitleblockTypeElem
    | WindowLegendViewElem
    | ViewElem
    | ToposolidElem
    | ToposolidSubdivisionElem
    | GradedRegionElem
    | AssetLibraryEntryElem
    | PlacedAssetElem
    | FamilyKitInstanceElem
    | HatchPatternDefElem
    | MaterialElem
    | ImageAssetElem
    | DecalElem
    | PropertyDefinitionElem
    | ImageUnderlayElem
    | ConceptSeedElem
    | NeighborhoodMassElem
    | NeighborhoodImportSessionElem
    | FrameElem
    | SavedViewElem
    | PresentationCanvasElem
    | BrandTemplateElem
    | PipeElem
    | DuctElem
    | PipeLegendElem
    | DuctLegendElem
    | RadialDimensionElem
    | DiameterDimensionElem
    | ArcLengthDimensionElem,
    Field(discriminator="kind"),
]
