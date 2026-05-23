"""Structural, framing and constraint element models (columns, beams, ceilings, masses,
sweeps, constraints, reference planes, grid lines, void cuts, 3D text)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import (
    DisciplineTag,
    StructuralAnalysisStatus,
    StructuralMaterial,
    StructuralRole,
    Vec2Mm,
    Vec3Mm,
)

from ._shared import MonitorSourceSpec


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
    load_bearing: bool | None = Field(default=True, alias="loadBearing")
    structural_role: StructuralRole = Field(default="column", alias="structuralRole")
    structural_material: StructuralMaterial | str | None = Field(
        default=None, alias="structuralMaterial"
    )
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    fire_resistance_rating: str | None = Field(default=None, alias="fireResistanceRating")
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
    load_bearing: bool | None = Field(default=True, alias="loadBearing")
    structural_role: StructuralRole = Field(default="beam", alias="structuralRole")
    structural_material: StructuralMaterial | str | None = Field(
        default=None, alias="structuralMaterial"
    )
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    fire_resistance_rating: str | None = Field(default=None, alias="fireResistanceRating")


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
    load_bearing: bool | None = Field(default=True, alias="loadBearing")
    structural_role: StructuralRole = Field(default="column", alias="structuralRole")
    structural_material: StructuralMaterial | str | None = Field(
        default=None, alias="structuralMaterial"
    )
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    fire_resistance_rating: str | None = Field(default=None, alias="fireResistanceRating")
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
    load_bearing: bool | None = Field(default=True, alias="loadBearing")
    structural_role: StructuralRole = Field(default="beam", alias="structuralRole")
    structural_material: StructuralMaterial | str | None = Field(
        default=None, alias="structuralMaterial"
    )
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    fire_resistance_rating: str | None = Field(default=None, alias="fireResistanceRating")
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
