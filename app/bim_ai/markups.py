from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class Vec2Px(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    x_px: float = Field(alias="xPx")
    y_px: float = Field(alias="yPx")


class Vec2Mm(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")


class Vec3Mm(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    z_mm: float = Field(alias="zMm")


# Anchors
class ElementAnchorM(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["element"] = "element"
    element_id: str = Field(alias="elementId")


class WorldAnchorM(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["world"] = "world"
    world_mm: Vec3Mm = Field(alias="worldMm")


class ScreenAnchorM(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["screen"] = "screen"
    view_id: str = Field(alias="viewId")
    x_px: float = Field(alias="xPx")
    y_px: float = Field(alias="yPx")


MarkupAnchor = Annotated[
    ElementAnchorM | WorldAnchorM | ScreenAnchorM,
    Field(discriminator="kind"),
]


# Shapes
class FreehandShape(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["freehand"] = "freehand"
    path_px: list[Vec2Px] = Field(alias="pathPx")
    color: str = "var(--cat-edit)"
    stroke_width_px: float = Field(default=2.0, alias="strokeWidthPx")


class ArrowShape(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["arrow"] = "arrow"
    from_mm: Vec2Mm = Field(alias="fromMm")
    to_mm: Vec2Mm = Field(alias="toMm")
    color: str = "var(--cat-edit)"


class CloudShape(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["cloud"] = "cloud"
    points_mm: list[Vec2Mm] = Field(alias="pointsMm")


class TextShape(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["text"] = "text"
    body_md: str = Field(alias="bodyMd")
    position_mm: Vec2Mm = Field(alias="positionMm")


MarkupShape = Annotated[
    FreehandShape | ArrowShape | CloudShape | TextShape,
    Field(discriminator="kind"),
]


class Markup(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str
    model_id: str = Field(alias="modelId")
    view_id: str | None = Field(default=None, alias="viewId")
    anchor: MarkupAnchor
    shape: MarkupShape
    author_id: str = Field(alias="authorId")
    created_at: int = Field(alias="createdAt")
    resolved_at: int | None = Field(default=None, alias="resolvedAt")


_CSS_COLOR_ALLOWLIST = frozenset(
    {
        "var(--cat-edit)",
        "var(--cat-review)",
        "var(--cat-approve)",
        "var(--semantic-warning)",
        "var(--semantic-error)",
        "var(--brand-primary)",
    }
)

_FALLBACK_COLOR = "var(--cat-edit)"


def sanitize_color(color: str) -> str:
    """Reject bare hex literals; map unknown tokens to the default."""
    return color if color in _CSS_COLOR_ALLOWLIST else _FALLBACK_COLOR


def _rdp_simplify(points: list[Vec2Px], epsilon: float = 2.0) -> list[Vec2Px]:
    """Reduce a freehand path using Ramer-Douglas-Peucker."""
    if len(points) <= 2:
        return points

    def _perp_dist(pt: Vec2Px, a: Vec2Px, b: Vec2Px) -> float:
        dx, dy = b.x_px - a.x_px, b.y_px - a.y_px
        if dx == 0 and dy == 0:
            return ((pt.x_px - a.x_px) ** 2 + (pt.y_px - a.y_px) ** 2) ** 0.5
        t = ((pt.x_px - a.x_px) * dx + (pt.y_px - a.y_px) * dy) / (dx * dx + dy * dy)
        return ((pt.x_px - (a.x_px + t * dx)) ** 2 + (pt.y_px - (a.y_px + t * dy)) ** 2) ** 0.5

    def _rdp(pts: list[Vec2Px]) -> list[Vec2Px]:
        if len(pts) <= 2:
            return pts
        max_dist, max_idx = 0.0, 0
        for i in range(1, len(pts) - 1):
            d = _perp_dist(pts[i], pts[0], pts[-1])
            if d > max_dist:
                max_dist, max_idx = d, i
        if max_dist > epsilon:
            return _rdp(pts[: max_idx + 1])[:-1] + _rdp(pts[max_idx:])
        return [pts[0], pts[-1]]

    return _rdp(points)
