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
    material_key: str | None = Field(default=None, alias="materialKey")
    # IFC-04: optional OmniClass / Uniclass / NSCC code; emitted via
    # IfcClassificationReference when set.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    is_curtain_wall: bool = Field(default=False, alias="isCurtainWall")
    pinned: bool = Field(default=False)
    curtain_wall_v_count: int | None = Field(default=None, alias="curtainWallVCount")
    curtain_wall_h_count: int | None = Field(default=None, alias="curtainWallHCount")
    curtain_panel_overrides: dict[str, CurtainPanelOverride] | None = Field(
        default=None, alias="curtainPanelOverrides"
    )
    recess_zones: list[WallRecessZone] | None = Field(default=None, alias="recessZones")


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
    # IFC-04: optional classification code emitted as IfcClassificationReference.
    ifc_classification_code: str | None = Field(default=None, alias="ifcClassificationCode")
    pinned: bool = Field(default=False)


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
    ref_element_id_a: str | None = Field(default=None, alias="refElementIdA")
    ref_element_id_b: str | None = Field(default=None, alias="refElementIdB")
    tag_definition_id: str | None = Field(default=None, alias="tagDefinitionId")
    auto_generated: bool = Field(default=False, alias="autoGenerated")
    pinned: bool = Field(default=False)


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
    """ANN-01 — view-local 2D filled region annotation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["detail_region"] = "detail_region"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    fill_colour: str = Field(default="#cccccc", alias="fillColour")
    fill_pattern: DetailRegionFillPattern = Field(default="solid", alias="fillPattern")
    stroke_mm: float = Field(default=0.5, alias="strokeMm", ge=0)
    stroke_colour: str = Field(default="#202020", alias="strokeColour")


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
    section_box_enabled: bool | None = Field(default=None, alias="sectionBoxEnabled")
    section_box_min_mm: Vec3Mm | None = Field(default=None, alias="sectionBoxMinMm")
    section_box_max_mm: Vec3Mm | None = Field(default=None, alias="sectionBoxMaxMm")


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


StairShape = Literal["straight", "l_shape", "u_shape", "spiral", "sketch"]


class StairRun(BaseModel):
    """KRN-07: one straight flight in a multi-run stair."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(alias="widthMm", default=1000)
    riser_count: int = Field(alias="riserCount", default=8)


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
    pinned: bool = Field(default=False)


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


class RailingElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["railing"] = "railing"
    id: str
    name: str = "Railing"
    hosted_stair_id: str | None = Field(default=None, alias="hostedStairId")
    path_mm: list[Vec2Mm] = Field(alias="pathMm")
    guard_height_mm: float = Field(alias="guardHeightMm", default=1040)
    pinned: bool = Field(default=False)


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
    wall_material_key: str | None = Field(default=None, alias="wallMaterialKey")
    roof_material_key: str | None = Field(default=None, alias="roofMaterialKey")
    has_floor_opening: bool = Field(default=False, alias="hasFloorOpening")
    pinned: bool = Field(default=False)


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


class SurveyPointElem(BaseModel):
    """KRN-06: survey point. Singleton; defines shared-coordinates origin."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["survey_point"] = "survey_point"
    id: str
    position_mm: Vec3Mm = Field(alias="positionMm")
    shared_elevation_mm: float = Field(default=0.0, alias="sharedElevationMm")


class InternalOriginElem(BaseModel):
    """KRN-06: internal origin. Singleton at modelling-space origin; never moves."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["internal_origin"] = "internal_origin"
    id: str = INTERNAL_ORIGIN_ID


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
    origin_alignment_mode: Literal["origin_to_origin"] = Field(
        default="origin_to_origin", alias="originAlignmentMode"
    )
    hidden: bool = Field(default=False)
    pinned: bool = Field(default=False)


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
    discipline: Literal["door", "window", "generic"] = "generic"
    parameters: dict[str, Any] = Field(default_factory=dict)
    catalog_source: FamilyCatalogSource | None = Field(
        default=None, alias="catalogSource"
    )


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
    phase_id: str | None = Field(default=None, alias="phaseId")
    crop_min_mm: Vec2Mm | None = Field(default=None, alias="cropMinMm")
    crop_max_mm: Vec2Mm | None = Field(default=None, alias="cropMaxMm")
    crop_enabled: bool | None = Field(default=None, alias="cropEnabled")
    crop_region_visible: bool | None = Field(default=None, alias="cropRegionVisible")
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")
    cut_plane_offset_mm: float | None = Field(default=None, alias="cutPlaneOffsetMm")
    categories_hidden: list[str] = Field(default_factory=list, alias="categoriesHidden")
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
    view_range_bottom_mm: float | None = Field(default=None, alias="viewRangeBottomMm")
    view_range_top_mm: float | None = Field(default=None, alias="viewRangeTopMm")


class SheetElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["sheet"] = "sheet"
    id: str
    name: str = "Sheet"
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
    computed_area_sq_mm: float | None = Field(default=None, alias="computedAreaSqMm")
    pinned: bool = Field(default=False)


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
    fill_color: str = Field(default="#ffffff", alias="fillColor")


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
    "link_model",
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
]


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
    pinned: bool = Field(default=False)


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
    pinned: bool = Field(default=False)


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
    | AgentAssumptionElem
    | AgentDeviationElem
    | ValidationRuleElem
    | SiteElem
    | Text3dElem
    | ProjectBasePointElem
    | SurveyPointElem
    | InternalOriginElem
    | LinkModelElem
    | SelectionSetElem
    | ClashTestElem
    | PlacedTagElem
    | DetailLineElem
    | DetailRegionElem
    | TextNoteElem
    | ReferencePlaneElem
    | PropertyLineElem
    | SweepElem
    | DormerElem
    | AreaElem
    | MaskingRegionElem
    | ColumnElem
    | BeamElem
    | CeilingElem,
    Field(discriminator="kind"),
]
