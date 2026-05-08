from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class Vec3Mm(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    z_mm: float = Field(alias="zMm")


class ElementAnchor(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["element"] = "element"
    element_id: str = Field(alias="elementId")
    offset_local_mm: Vec3Mm | None = Field(default=None, alias="offsetLocalMm")


class PointAnchor(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["point"] = "point"
    world_mm: Vec3Mm = Field(alias="worldMm")


class RegionAnchor(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["region"] = "region"
    min_mm: Vec3Mm = Field(alias="minMm")
    max_mm: Vec3Mm = Field(alias="maxMm")


class SheetAnchor(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["sheet"] = "sheet"
    sheet_id: str = Field(alias="sheetId")
    x_px: float = Field(alias="xPx")
    y_px: float = Field(alias="yPx")
    source_view_id: str | None = Field(default=None, alias="sourceViewId")
    source_element_id: str | None = Field(default=None, alias="sourceElementId")


CommentAnchor = Annotated[
    ElementAnchor | PointAnchor | RegionAnchor | SheetAnchor,
    Field(discriminator="kind"),
]


class Comment(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str
    model_id: str = Field(alias="modelId")
    thread_id: str = Field(alias="threadId")
    author_id: str = Field(alias="authorId")
    body: str
    anchor: CommentAnchor
    created_at: int = Field(alias="createdAt")
    resolved_at: int | None = Field(default=None, alias="resolvedAt")
    resolved_by: str | None = Field(default=None, alias="resolvedBy")
    is_orphaned: bool = Field(default=False, alias="isOrphaned")


def resolve_sheet_anchor_binding(
    anchor: SheetAnchor,
    sheet_pixel_map: dict[tuple[int, int], tuple[str, str]],
) -> SheetAnchor:
    """Populate sourceViewId + sourceElementId from the sheet pixel map if available."""
    key = (round(anchor.x_px), round(anchor.y_px))
    binding = sheet_pixel_map.get(key)
    if binding:
        return anchor.model_copy(update={"source_view_id": binding[0], "source_element_id": binding[1]})
    return anchor


def mark_orphaned_comments(
    comments: list[Comment],
    deleted_element_ids: set[str],
) -> list[Comment]:
    result = []
    for c in comments:
        if (
            c.anchor.kind == "element"
            and c.anchor.element_id in deleted_element_ids
            and not c.is_orphaned
        ):
            result.append(c.model_copy(update={"is_orphaned": True}))
        else:
            result.append(c)
    return result
