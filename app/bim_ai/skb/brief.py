"""SKB-21 — canonical sketch-to-BIM brief format.

Every customer sketch + verbal description lands in a structured Brief
before authoring starts. The agent's first task is to fill the brief out
from the source material and log it as evidence; only then does authoring
begin.

This makes the agent's interpretation explicit and auditable. Pairs with
SKB-12 (cookbook) which references the brief shape.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RoomProgramEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    name: str
    target_area_m2: float = Field(alias="targetAreaM2")
    storey_hint: str | None = Field(default=None, alias="storeyHint")


class KeyDimension(BaseModel):
    """A specific dimension call-out the agent should respect verbatim."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    label: str  # e.g. "house width", "ridge height"
    value_mm: float = Field(alias="valueMm")
    confidence: Literal["explicit", "inferred"] = "explicit"
    sketch_anchor: str | None = Field(
        default=None,
        alias="sketchAnchor",
        description="Free-form anchor in the sketch where the dimension is called out.",
    )


class MaterialIntent(BaseModel):
    """A material the brief calls out, mapped to a MAT-01 catalog key."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    surface: str  # logical surface ("ground walls", "roof")
    description: str  # free-form ("dark grey standing-seam metal")
    catalog_key: str | None = Field(
        default=None,
        alias="catalogKey",
        description="Resolved MAT-01 materialKey, or None if no match yet.",
    )


class SpecialFeature(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    label: str  # "loggia", "dormer", "balcony"
    description: str
    sketch_anchor: str | None = Field(default=None, alias="sketchAnchor")


class ReferenceImage(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    path: str
    panel_label: str | None = Field(
        default=None,
        alias="panelLabel",
        description="What the panel shows (e.g. 'Front elevation', 'SSW perspective').",
    )
    preset_id: str | None = Field(
        default=None,
        alias="presetId",
        description="SKB-16 camera preset id matching this panel, when known.",
    )


class SketchBrief(BaseModel):
    """The full brief shape the agent fills out before authoring."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    schema_version: int = Field(default=1, alias="schemaVersion")
    title: str
    style_hint: str | None = Field(default=None, alias="styleHint")  # SKB-20
    archetype_hint: str | None = Field(default=None, alias="archetypeHint")  # SKB-09
    site_orientation_deg: float | None = Field(
        default=None,
        alias="siteOrientationDeg",
        description="Building primary axis bearing from true north (0 = north).",
    )
    program: list[RoomProgramEntry] = Field(default_factory=list)
    key_dimensions: list[KeyDimension] = Field(
        default_factory=list,
        alias="keyDimensions",
    )
    material_intent: list[MaterialIntent] = Field(
        default_factory=list,
        alias="materialIntent",
    )
    special_features: list[SpecialFeature] = Field(
        default_factory=list,
        alias="specialFeatures",
    )
    reference_images: list[ReferenceImage] = Field(
        default_factory=list,
        alias="referenceImages",
    )
    notes: str | None = None


def brief_to_evidence_dict(brief: SketchBrief) -> dict[str, Any]:
    """Serialise the brief to the canonical evidence-log shape."""
    return brief.model_dump(by_alias=True, mode="json")


def brief_from_dict(payload: dict[str, Any]) -> SketchBrief:
    """Parse a brief from a dict (e.g. loaded JSON)."""
    return SketchBrief.model_validate(payload)


SAMPLE_BRIEF: dict[str, Any] = {
    "schemaVersion": 1,
    "title": "Asymmetric two-storey demo house",
    "styleHint": "modernist",
    "archetypeHint": "modernist_gable_two_story",
    "siteOrientationDeg": 0.0,
    "program": [
        {"name": "Open-plan kitchen + living", "targetAreaM2": 56.0, "storeyHint": "Ground"},
        {"name": "Bedroom 1", "targetAreaM2": 18.0, "storeyHint": "First"},
        {"name": "Bedroom 2", "targetAreaM2": 12.0, "storeyHint": "First"},
        {"name": "Bathroom", "targetAreaM2": 6.0, "storeyHint": "First"},
        {"name": "Loggia (covered balcony)", "targetAreaM2": 10.0, "storeyHint": "First"},
        {"name": "Roof terrace (east deck)", "targetAreaM2": 16.0, "storeyHint": "First"},
    ],
    "keyDimensions": [
        {"label": "ground-floor footprint width (E-W)", "valueMm": 7000, "confidence": "explicit"},
        {"label": "ground-floor footprint depth (N-S)", "valueMm": 8000, "confidence": "explicit"},
        {
            "label": "first-floor footprint width (E-W)",
            "valueMm": 5000,
            "confidence": "inferred",
            "sketchAnchor": "upper volume aligned to west edge",
        },
        {"label": "ground-to-first floor height", "valueMm": 3000, "confidence": "explicit"},
        {"label": "ridge height above ground", "valueMm": 7500, "confidence": "inferred"},
    ],
    "materialIntent": [
        {
            "surface": "ground walls + east extension",
            "description": "light beige/grey vertical siding",
            "catalogKey": "cladding_beige_grey",
        },
        {
            "surface": "upper side walls",
            "description": "smooth white render",
            "catalogKey": "render_white",
        },
        {
            "surface": "loggia recessed back wall",
            "description": "warm natural wood vertical siding",
            "catalogKey": "cladding_warm_wood",
        },
        {
            "surface": "roof",
            "description": "dark grey standing-seam metal",
            "catalogKey": "metal_standing_seam_dark_grey",
        },
        {
            "surface": "window/door frames",
            "description": "dark grey aluminium",
            "catalogKey": "aluminium_dark_grey",
        },
    ],
    "specialFeatures": [
        {
            "label": "loggia",
            "description": "Recessed covered balcony on south upper facade, ~1500 mm setback, frameless glass balustrade, wood floor.",
        },
        {
            "label": "dormer",
            "description": "Massive rectangular cut-out in east roof slope opening to the east roof terrace via floor-to-ceiling sliding glass doors.",
        },
        {
            "label": "asymmetric gable",
            "description": "Roof ridge significantly off-center east, low west wall, high east wall.",
        },
    ],
    "referenceImages": [
        {
            "path": "spec/target-house/target-house-1.png",
            "panelLabel": "SSW iso colour study",
            "presetId": "vp-main-iso",
        },
        {
            "path": "spec/target-house/target-house-2.png",
            "panelLabel": "SSW iso line sketch",
            "presetId": "vp-main-iso",
        },
    ],
    "notes": "See spec/target-house/target-house-seed.md for the architectural ground truth.",
}
