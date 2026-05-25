from __future__ import annotations

import math
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
LensMode = Literal["show_arch", "show_struct", "show_mep", "show_fire_safety", "show_all"]
ConstructionProgressStatus = Literal[
    "not_started",
    "in_progress",
    "installed",
    "inspected",
    "accepted",
]
ConstructionLogisticsKind = Literal[
    "temporary_partition",
    "scaffolding_zone",
    "crane_lift_zone",
    "laydown_area",
    "access_route",
    "site_safety_zone",
]
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
    "facade_bay": "arch",
    "sweep": "arch",
    "dormer": "arch",
    "soffit": "arch",
    "toposolid": "arch",
    "toposolid_excavation": "arch",
    "column": "struct",
    "beam": "struct",
    "brace": "struct",
    "foundation": "struct",
    "duct": "mep",
    "pipe": "mep",
    "cable_tray": "mep",
    "mep_equipment": "mep",
    "fixture": "mep",
    "mep_terminal": "mep",
    "mep_opening_request": "mep",
}

WallLayerFunction = Literal["structure", "insulation", "finish"]
WallBasisLine = Literal["center", "face_interior", "face_exterior"]
StructuralRole = Literal[
    "unknown",
    "load_bearing",
    "non_load_bearing",
    "bearing_wall",
    "shear_wall",
    "slab",
    "beam",
    "column",
    "foundation",
    "brace",
]
WallStructuralRole = StructuralRole
StructuralMaterial = Literal["concrete", "steel", "timber", "masonry", "composite", "other"]
StructuralAnalysisStatus = Literal[
    "not_modelled", "not_modeled", "ready_for_export", "needs_review"
]
ThermalEnvelopeClassification = Literal[
    "exterior_wall_outside_air",
    "wall_against_ground",
    "wall_against_unheated_space",
    "roof_or_top_floor_ceiling_outside_air",
    "floor_slab_against_ground",
    "floor_against_unheated_basement",
    "window_or_door_thermal_envelope",
    "internal_outside_thermal_envelope",
]
ThermalClassificationSource = Literal["auto", "manual", "batch", "imported"]
EnergyHeatingStatus = Literal["heated", "low_heated", "unheated"]
EnergyUsageProfile = Literal["residential", "office", "school", "retail", "other"]
ThermalBridgeMarkerType = Literal[
    "balcony_slab",
    "window_reveal",
    "roof_wall_junction",
    "floor_wall_junction",
    "basement_transition",
    "cantilever",
    "user_defined",
]
RenovationScenarioStatus = Literal["as_is", "scenario_a", "scenario_b", "target"]
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
