"""Presentation, brand, frame, saved view and titleblock element models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.element_primitives import Vec2Mm


class TokenSlot(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    name: str
    x_mm: float = Field(alias="xMm")
    y_mm: float = Field(alias="yMm")
    font_size_mm: float = Field(default=3.5, alias="fontSizeMm")


class TitleblockTypeElem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["titleblock_type"] = "titleblock_type"
    id: str
    name: str
    svg_template: str = Field(default="", alias="svgTemplate")
    token_slots: list[TokenSlot] = Field(default_factory=list, alias="tokenSlots")


DEFAULT_TITLEBLOCK_TYPE = TitleblockTypeElem(
    id="default-a1-titleblock",
    name="A1 Landscape Standard",
    svgTemplate="",
    tokenSlots=[
        {"name": "projectName", "xMm": 180.0, "yMm": 15.0, "fontSizeMm": 5.0},
        {"name": "drawnBy", "xMm": 180.0, "yMm": 10.0, "fontSizeMm": 3.5},
        {"name": "checkedBy", "xMm": 220.0, "yMm": 10.0, "fontSizeMm": 3.5},
        {"name": "date", "xMm": 260.0, "yMm": 10.0, "fontSizeMm": 3.5},
        {"name": "number", "xMm": 260.0, "yMm": 15.0, "fontSizeMm": 5.0},
    ],
)


class PresentationLinkElem(BaseModel):
    """OUT-V3-01 — live presentation URL token persisted as a document element."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["presentation_link"] = "presentation_link"
    id: str
    model_id: str = Field(alias="modelId")
    page_scope_ids: list[str] = Field(default_factory=list, alias="pageScopeIds")
    token: str
    permission: Literal["viewer"] = "viewer"
    allow_measurement: bool = Field(default=False, alias="allowMeasurement")
    allow_comment: bool = Field(default=False, alias="allowComment")
    expires_at: int | None = Field(default=None, alias="expiresAt")
    created_at: int = Field(alias="createdAt")
    revoked_at: int | None = Field(default=None, alias="revokedAt")


# ---------------------------------------------------------------------------
# OUT-V3-03 — BrandTemplate element
# ---------------------------------------------------------------------------


class BrandTemplateElem(BaseModel):
    """OUT-V3-03 — Layer-C brand override for PDF/PPTX export."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    kind: Literal["brand_template"] = "brand_template"
    id: str
    name: str
    accent_hex: str = Field(alias="accentHex")
    accent_foreground_hex: str = Field(alias="accentForegroundHex")
    typeface: str = "Inter"
    logo_mark_svg_uri: str | None = Field(default=None, alias="logoMarkSvgUri")
    css_override_snippet: str | None = Field(default=None, alias="cssOverrideSnippet")


# ---------------------------------------------------------------------------
# OUT-V3-02 — Presentation canvas, frames, saved views
# ---------------------------------------------------------------------------


class FrameElem(BaseModel):
    """OUT-V3-02 — rectangular crop on a presentation canvas pointing at a viewId."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["frame"] = "frame"
    id: str
    presentation_canvas_id: str = Field(alias="presentationCanvasId")
    view_id: str = Field(alias="viewId")
    position_mm: dict = Field(alias="positionMm")  # {xMm, yMm}
    size_mm: dict = Field(alias="sizeMm")  # {widthMm, heightMm}
    caption: str | None = None
    brand_template_id: str | None = Field(None, alias="brandTemplateId")
    sort_order: int = Field(0, alias="sortOrder")


class SavedViewElem(BaseModel):
    """OUT-V3-02 — saved camera + visibility state on a view (3D/plan/sheet)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["saved_view"] = "saved_view"
    id: str
    base_view_id: str = Field(alias="baseViewId")
    name: str
    camera_state: dict | None = Field(None, alias="cameraState")
    visibility_overrides: dict | None = Field(None, alias="visibilityOverrides")
    detail_level: str | None = Field(None, alias="detailLevel")
    thumbnail_data_uri: str | None = Field(None, alias="thumbnailDataUri")


class PresentationCanvasElem(BaseModel):
    """OUT-V3-02 — named canvas that groups an ordered sequence of frames."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["presentation_canvas"] = "presentation_canvas"
    id: str
    name: str
    frame_ids: list[str] = Field(default_factory=list, alias="frameIds")


# ---------------------------------------------------------------------------
# CON-V3-02 — Concept seed handoff element
# ---------------------------------------------------------------------------


class ConceptSeedElem(BaseModel):
    """CON-V3-02 — typed handoff contract between T6 (concept/tracing) and T9 (refinement agent).

    A ConceptSeed carries structured layout JSON + envelope tokens + assumptions log.
    Lifecycle: draft → committed (T9 can consume) → consumed.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["concept_seed"] = "concept_seed"
    id: str
    model_id: str = Field(alias="modelId")
    source_underlay_id: str | None = Field(default=None, alias="sourceUnderlayId")
    envelope_tokens: list[dict] = Field(default_factory=list, alias="envelopeTokens")
    kernel_element_drafts: list[dict] = Field(default_factory=list, alias="kernelElementDrafts")
    assumptions_log: list[dict] = Field(default_factory=list, alias="assumptionsLog")
    status: Literal["draft", "committed", "consumed"] = "draft"
    committed_at: str | None = Field(default=None, alias="committedAt")
    schema_version: str = Field(default="con-v3.0", alias="schemaVersion")


class RevisionCloudElem(BaseModel):
    """ANN-03 — view-local revision cloud (closed cloud-shaped polygon boundary)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    kind: Literal["revision_cloud"] = "revision_cloud"
    id: str
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    colour: str = Field(default="#e05000")
    stroke_mm: float = Field(default=1.0, alias="strokeMm", gt=0)
