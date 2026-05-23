"""Wall-family element models (wall types, walls, openings, edges)."""

from __future__ import annotations

import math
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from bim_ai.cmd.types import AgentTrace
from bim_ai.element_primitives import (
    DisciplineTag,
    StructuralAnalysisStatus,
    StructuralMaterial,
    ThermalClassificationSource,
    ThermalEnvelopeClassification,
    Vec2Mm,
    WallBasisLine,
    WallCurve,
    WallLayerFunction,
    WallLocationLine,
    WallStructuralRole,
)

from ._shared import CircularityProperties, MaterialFaceOverride


class WallTypeLayer(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    thickness_mm: float = Field(alias="thicknessMm", gt=0)
    layer_function: WallLayerFunction = Field(alias="function")
    material_key: str | None = Field(default=None, alias="materialKey")
    wraps_at_ends: bool = Field(default=False, alias="wrapsAtEnds")
    wraps_at_inserts: bool = Field(default=False, alias="wrapsAtInserts")


class WallTypeElem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["wall_type"] = "wall_type"
    id: str
    name: str = "Wall type"
    layers: list[WallTypeLayer] = Field(default_factory=list)
    basis_line: WallBasisLine = Field(default="center", alias="basisLine")


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
    top_constraint_host_id: str | None = Field(default=None, alias="topConstraintHostId")
    top_constraint_host_face: str | None = Field(default=None, alias="topConstraintHostFace")
    insulation_extension_mm: float = Field(default=0, alias="insulationExtensionMm")
    material_key: str | None = Field(default=None, alias="materialKey")
    face_material_overrides: list[MaterialFaceOverride] | None = Field(
        default=None, alias="faceMaterialOverrides"
    )
    load_bearing: bool | None = Field(default=None, alias="loadBearing")
    structural_role: WallStructuralRole = Field(default="unknown", alias="structuralRole")
    structural_material: StructuralMaterial | str | None = Field(
        default=None, alias="structuralMaterial"
    )
    analytical_participation: bool = Field(default=False, alias="analyticalParticipation")
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    structural_material_key: str | None = Field(default=None, alias="structuralMaterialKey")
    structural_intent_confidence: float | None = Field(
        default=None, alias="structuralIntentConfidence", ge=0, le=1
    )
    fire_resistance_rating: str | None = Field(default=None, alias="fireResistanceRating")
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
    circularity: CircularityProperties | None = None
    curtain_wall_v_count: int | None = Field(default=None, alias="curtainWallVCount")
    curtain_wall_h_count: int | None = Field(default=None, alias="curtainWallHCount")
    curtain_wall_panel_type: str | None = Field(default=None, alias="curtainWallPanelType")
    curtain_wall_mullion_type: str | None = Field(default=None, alias="curtainWallMullionType")
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
    circularity: CircularityProperties | None = None
    props: dict[str, Any] | None = Field(default=None)
    thermal_classification: ThermalEnvelopeClassification | None = Field(
        default=None, alias="thermalClassification"
    )
    thermal_classification_source: ThermalClassificationSource | None = Field(
        default=None, alias="thermalClassificationSource"
    )
    energy_scenario_id: str | None = Field(default=None, alias="energyScenarioId")
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
    props: dict[str, Any] | None = Field(default=None)

    @model_validator(mode="after")
    def _check_bounds(self) -> WallOpeningElem:
        if self.along_t_start >= self.along_t_end:
            raise ValueError("wall_opening alongTStart must be < alongTEnd")
        if self.head_height_mm <= self.sill_height_mm:
            raise ValueError("wall_opening headHeightMm must be > sillHeightMm")
        return self


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
