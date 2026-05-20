from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CreateToposolidCmd(BaseModel):
    """TOP-V3-01 - create a terrain solid from a closed boundary and height data."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateToposolid"] = "CreateToposolid"
    toposolid_id: str = Field(alias="toposolidId")
    name: str | None = None
    boundary_mm: list[dict] = Field(alias="boundaryMm")
    height_samples: list[dict] = Field(default_factory=list, alias="heightSamples")
    heightmap_grid_mm: dict | None = Field(default=None, alias="heightmapGridMm")
    thickness_mm: float = Field(default=1500.0, alias="thicknessMm")
    base_elevation_mm: float | None = Field(default=None, alias="baseElevationMm")
    default_material_key: str | None = Field(default=None, alias="defaultMaterialKey")


class UpdateToposolidCmd(BaseModel):
    """TOP-V3-01 - patch fields on an existing toposolid."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateToposolid"] = "UpdateToposolid"
    toposolid_id: str = Field(alias="toposolidId")
    name: str | None = None
    thickness_mm: float | None = Field(default=None, alias="thicknessMm")
    base_elevation_mm: float | None = Field(default=None, alias="baseElevationMm")
    default_material_key: str | None = Field(default=None, alias="defaultMaterialKey")
    pinned: bool | None = None


class DeleteToposolidCmd(BaseModel):
    """TOP-V3-01 - delete a toposolid; emits a warning if floors are hosted on it."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteToposolid"] = "DeleteToposolid"
    toposolid_id: str = Field(alias="toposolidId")


class CreateToposolidSubdivisionCmd(BaseModel):
    """TOP-V3-02 - create a surface-finish region on an existing toposolid."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_toposolid_subdivision"] = "create_toposolid_subdivision"
    id: str
    host_toposolid_id: str = Field(alias="hostToposolidId")
    boundary_mm: list[dict] = Field(alias="boundaryMm")
    finish_category: str = Field(alias="finishCategory")
    material_key: str = Field(alias="materialKey")
    name: str | None = None


class UpdateToposolidSubdivisionCmd(BaseModel):
    """TOP-V3-02 - patch fields on an existing toposolid subdivision."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_toposolid_subdivision"] = "update_toposolid_subdivision"
    id: str
    boundary_mm: list[dict] | None = Field(default=None, alias="boundaryMm")
    finish_category: str | None = Field(default=None, alias="finishCategory")
    material_key: str | None = Field(default=None, alias="materialKey")
    name: str | None = None


class DeleteToposolidSubdivisionCmd(BaseModel):
    """TOP-V3-02 - remove a toposolid subdivision from the model."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_toposolid_subdivision"] = "delete_toposolid_subdivision"
    id: str


class CreateGradedRegionCmd(BaseModel):
    """TOP-V3-04 - create a graded region anchored to a toposolid.

    ``flat`` mode requires ``targetZMm``; ``slope`` mode requires both
    ``slopeAxisDeg`` and ``slopeDegPercent``.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateGradedRegion"] = "CreateGradedRegion"
    id: str | None = None
    host_toposolid_id: str = Field(alias="hostToposolidId")
    boundary_mm: list[dict] = Field(alias="boundaryMm")
    target_mode: Literal["flat", "slope"] = Field("flat", alias="targetMode")
    target_z_mm: float | None = Field(None, alias="targetZMm")
    slope_axis_deg: float | None = Field(None, alias="slopeAxisDeg")
    slope_deg_percent: float | None = Field(None, alias="slopeDegPercent")


class UpdateGradedRegionCmd(BaseModel):
    """TOP-V3-04 - patch fields on an existing graded region."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateGradedRegion"] = "UpdateGradedRegion"
    id: str
    boundary_mm: list[dict] | None = Field(None, alias="boundaryMm")
    target_mode: Literal["flat", "slope"] | None = Field(None, alias="targetMode")
    target_z_mm: float | None = Field(None, alias="targetZMm")
    slope_axis_deg: float | None = Field(None, alias="slopeAxisDeg")
    slope_deg_percent: float | None = Field(None, alias="slopeDegPercent")


class DeleteGradedRegionCmd(BaseModel):
    """TOP-V3-04 - delete a graded region by id."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteGradedRegion"] = "DeleteGradedRegion"
    id: str


ToposolidExcavationCutMode = Literal["to_top_of_cutter", "to_bottom_of_cutter", "custom_depth"]


class CreateToposolidExcavationCmd(BaseModel):
    """TOP-V3-05 - declare that a floor/roof/toposolid excavates a host toposolid."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["CreateToposolidExcavation"] = "CreateToposolidExcavation"
    id: str | None = None
    host_toposolid_id: str = Field(alias="hostToposolidId")
    cutter_element_id: str = Field(alias="cutterElementId")
    cut_mode: ToposolidExcavationCutMode = Field("to_bottom_of_cutter", alias="cutMode")
    offset_mm: float = Field(0.0, alias="offsetMm")
    custom_depth_mm: float | None = Field(None, alias="customDepthMm")
    estimated_volume_m3: float | None = Field(None, alias="estimatedVolumeM3")


class UpdateToposolidExcavationCmd(BaseModel):
    """TOP-V3-05 - patch a toposolid excavation relation."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["UpdateToposolidExcavation"] = "UpdateToposolidExcavation"
    id: str
    cut_mode: ToposolidExcavationCutMode | None = Field(None, alias="cutMode")
    offset_mm: float | None = Field(None, alias="offsetMm")
    custom_depth_mm: float | None = Field(None, alias="customDepthMm")
    estimated_volume_m3: float | None = Field(None, alias="estimatedVolumeM3")


class DeleteToposolidExcavationCmd(BaseModel):
    """TOP-V3-05 - delete a toposolid excavation relation."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["DeleteToposolidExcavation"] = "DeleteToposolidExcavation"
    id: str
