"""Floor and roof family element models, plus openings and roof attachments."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from bim_ai.cmd.types import AgentTrace
from bim_ai.element_primitives import (
    DisciplineTag,
    StructuralAnalysisStatus,
    StructuralMaterial,
    StructuralRole,
    ThermalClassificationSource,
    ThermalEnvelopeClassification,
    Vec2Mm,
)
from bim_ai.roof_geometry import RoofGeometryMode

from ._shared import CircularityProperties
from .walls import WallTypeLayer


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
    load_bearing: bool | None = Field(default=None, alias="loadBearing")
    structural_role: StructuralRole = Field(default="slab", alias="structuralRole")
    structural_material: StructuralMaterial | str | None = Field(
        default=None, alias="structuralMaterial"
    )
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    fire_resistance_rating: str | None = Field(default=None, alias="fireResistanceRating")
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
    circularity: CircularityProperties | None = None
    props: dict[str, Any] | None = Field(default=None)
    thermal_classification: ThermalEnvelopeClassification | None = Field(
        default=None, alias="thermalClassification"
    )
    thermal_classification_source: ThermalClassificationSource | None = Field(
        default=None, alias="thermalClassificationSource"
    )
    energy_scenario_id: str | None = Field(default=None, alias="energyScenarioId")


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
    load_bearing: bool | None = Field(default=None, alias="loadBearing")
    structural_role: StructuralRole = Field(default="unknown", alias="structuralRole")
    structural_material: StructuralMaterial | str | None = Field(
        default=None, alias="structuralMaterial"
    )
    analysis_status: StructuralAnalysisStatus = Field(default="not_modeled", alias="analysisStatus")
    fire_resistance_rating: str | None = Field(default=None, alias="fireResistanceRating")
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
    circularity: CircularityProperties | None = None
    props: dict[str, Any] | None = Field(default=None)
    thermal_classification: ThermalEnvelopeClassification | None = Field(
        default=None, alias="thermalClassification"
    )
    thermal_classification_source: ThermalClassificationSource | None = Field(
        default=None, alias="thermalClassificationSource"
    )
    energy_scenario_id: str | None = Field(default=None, alias="energyScenarioId")


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
