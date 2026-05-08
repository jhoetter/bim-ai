"""IMG-V3-01 — Pydantic models for the StructuredLayout wire format."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Advisory(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    code: str
    message: str | None = None


class PointMm(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    x: float
    y: float


class BboxMm(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    x: float
    y: float
    w: float
    h: float


class RoomRegion(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    polygon_mm: list[PointMm] = Field(alias="polygonMm", default_factory=list)
    detected_type_key: str | None = Field(default=None, alias="detectedTypeKey")
    detected_area_mm2: float | None = Field(default=None, alias="detectedAreaMm2")


class WallSegment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    a_mm: PointMm = Field(alias="aMm")
    b_mm: PointMm = Field(alias="bMm")
    thickness_mm: float | None = Field(default=None, alias="thicknessMm")


class OpeningHint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    host_wall_id: str = Field(alias="hostWallId")
    t_along_wall: float = Field(alias="tAlongWall")
    width_mm: float | None = Field(default=None, alias="widthMm")
    kind_hint: Literal["door", "window"] | None = Field(default=None, alias="kindHint")


class OcrLabel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    text: str
    bbox_mm: BboxMm = Field(alias="bboxMm")
    confidence: float


class ImageMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    width_px: int = Field(alias="widthPx")
    height_px: int = Field(alias="heightPx")
    calibration_mm_per_px: float | None = Field(default=None, alias="calibrationMmPerPx")
    brief_path: str | None = Field(default=None, alias="briefPath")


class StructuredLayout(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: Literal["img-v3.0"] = Field(default="img-v3.0", alias="schemaVersion")
    image_metadata: ImageMetadata = Field(alias="imageMetadata")
    rooms: list[RoomRegion] = Field(default_factory=list)
    walls: list[WallSegment] = Field(default_factory=list)
    openings: list[OpeningHint] = Field(default_factory=list)
    ocr_labels: list[OcrLabel] = Field(default_factory=list, alias="ocrLabels")
    advisories: list[Advisory] = Field(default_factory=list)
