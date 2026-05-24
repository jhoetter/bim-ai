"""Site, terrain, origin, sun, and neighborhood element models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import Vec2Mm, Vec3Mm
from bim_ai.elements_constructability import SiteContextType

PropertyLineClassification = Literal["street", "rear", "side", "other"]


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


ToposolidExcavationCutMode = Literal["to_top_of_cutter", "to_bottom_of_cutter", "custom_depth"]
ToposolidExcavationTopSurfaceMode = Literal["flat", "follow_terrain"]


class ToposolidExcavationElem(BaseModel):
    """Revit-like explicit relation: a cutter excavates a host Toposolid.

    MF-driver-10 (#46): ``top_surface_mode`` controls the shape of the
    excavation's top face. ``"flat"`` (default, back-compat) gives a uniform
    cut depth across the cutter footprint — appropriate for flat lots. On a
    hillside, that uniform cut buries the legitimate exposed lower walls on
    the daylight side. ``"follow_terrain"`` samples the host toposolid's
    ``heightSamples`` at each cutter vertex so the excavation's top face
    tilts with the natural grade and only the truly-below-grade portion of
    the basement is removed from view.

    ``top_height_samples`` is an optional per-vertex override (parallel to
    the cutter polygon) for callers that have a pre-computed top elevation
    profile and want to bypass the implicit lookup against the host's
    ``heightSamples``. When provided, it takes precedence over
    ``top_surface_mode``.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["toposolid_excavation"] = "toposolid_excavation"
    id: str
    host_toposolid_id: str = Field(alias="hostToposolidId")
    cutter_element_id: str = Field(alias="cutterElementId")
    cut_mode: ToposolidExcavationCutMode = Field("to_bottom_of_cutter", alias="cutMode")
    offset_mm: float = Field(0.0, alias="offsetMm")
    custom_depth_mm: float | None = Field(None, alias="customDepthMm")
    estimated_volume_m3: float | None = Field(None, alias="estimatedVolumeM3")
    top_surface_mode: ToposolidExcavationTopSurfaceMode = Field(
        "flat", alias="topSurfaceMode"
    )
    top_height_samples: list[HeightSample] | None = Field(
        default=None, alias="topHeightSamples"
    )


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
