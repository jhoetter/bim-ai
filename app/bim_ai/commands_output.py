from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CreatePresentationCanvasCmd(BaseModel):
    """OUT-V3-02 - create a named presentation canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_presentation_canvas"] = "create_presentation_canvas"
    id: str
    name: str


class UpdatePresentationCanvasCmd(BaseModel):
    """OUT-V3-02 - rename a presentation canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_presentation_canvas"] = "update_presentation_canvas"
    id: str
    name: str | None = None


class CreateFrameCmd(BaseModel):
    """OUT-V3-02 - add a frame (slide crop) on a presentation canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_frame"] = "create_frame"
    id: str
    presentation_canvas_id: str = Field(alias="presentationCanvasId")
    view_id: str = Field(alias="viewId")
    position_mm: dict = Field(alias="positionMm")
    size_mm: dict = Field(alias="sizeMm")
    caption: str | None = None
    brand_template_id: str | None = Field(default=None, alias="brandTemplateId")
    sort_order: int = Field(0, alias="sortOrder")


class UpdateFrameCmd(BaseModel):
    """OUT-V3-02 - update caption, position, size, or sort order of a frame."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_frame"] = "update_frame"
    id: str
    caption: str | None = None
    position_mm: dict | None = Field(default=None, alias="positionMm")
    size_mm: dict | None = Field(default=None, alias="sizeMm")
    sort_order: int | None = Field(default=None, alias="sortOrder")


class DeleteFrameCmd(BaseModel):
    """OUT-V3-02 - delete a frame from a canvas."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_frame"] = "delete_frame"
    id: str


class ReorderFrameCmd(BaseModel):
    """OUT-V3-02 - move a frame to a new sort position."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reorder_frame"] = "reorder_frame"
    id: str
    new_sort_order: int = Field(alias="newSortOrder")


class CreateSavedViewCmd(BaseModel):
    """OUT-V3-02 - save a camera and visibility snapshot on a base view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_saved_view"] = "create_saved_view"
    id: str
    base_view_id: str = Field(alias="baseViewId")
    name: str
    camera_state: dict | None = Field(default=None, alias="cameraState")
    visibility_overrides: dict | None = Field(default=None, alias="visibilityOverrides")
    detail_level: str | None = Field(default=None, alias="detailLevel")


class UpdateSavedViewCmd(BaseModel):
    """OUT-V3-02 - patch a saved view's name, camera, visibility or thumbnail."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_saved_view"] = "update_saved_view"
    id: str
    name: str | None = None
    camera_state: dict | None = Field(default=None, alias="cameraState")
    visibility_overrides: dict | None = Field(default=None, alias="visibilityOverrides")
    detail_level: str | None = Field(default=None, alias="detailLevel")
    thumbnail_data_uri: str | None = Field(default=None, alias="thumbnailDataUri")


class DeleteSavedViewCmd(BaseModel):
    """OUT-V3-02 - delete a saved view."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_saved_view"] = "delete_saved_view"
    id: str


class CreateBrandTemplateCmd(BaseModel):
    """OUT-V3-03 - create a brand template for Layer-C CSS overrides."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["create_brand_template"] = "create_brand_template"
    id: str
    name: str
    accent_hex: str = Field(alias="accentHex")
    accent_foreground_hex: str = Field(alias="accentForegroundHex")
    typeface: str = "Inter"
    logo_mark_svg_uri: str | None = Field(default=None, alias="logoMarkSvgUri")
    css_override_snippet: str | None = Field(default=None, alias="cssOverrideSnippet")


class UpdateBrandTemplateCmd(BaseModel):
    """OUT-V3-03 - patch fields on an existing brand template."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["update_brand_template"] = "update_brand_template"
    id: str
    name: str | None = None
    accent_hex: str | None = Field(default=None, alias="accentHex")
    accent_foreground_hex: str | None = Field(default=None, alias="accentForegroundHex")
    typeface: str | None = None
    logo_mark_svg_uri: str | None = Field(default=None, alias="logoMarkSvgUri")
    css_override_snippet: str | None = Field(default=None, alias="cssOverrideSnippet")


class DeleteBrandTemplateCmd(BaseModel):
    """OUT-V3-03 - delete a brand template."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["delete_brand_template"] = "delete_brand_template"
    id: str


class ReorderViewCmd(BaseModel):
    """CHR-V3-07 - move a viewpoint or saved_view to a new sort position."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["reorder_view"] = "reorder_view"
    view_id: str = Field(alias="viewId")
    new_sort_order: int = Field(alias="newSortOrder")
