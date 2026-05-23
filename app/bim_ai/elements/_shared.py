"""Shared low-level building blocks used by multiple element-family modules.

Kept private (`_shared`) because callers import these through the
``bim_ai.elements`` barrel; nothing outside the package should import from
this module directly.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from bim_ai.element_primitives import (
    ViewTemplateControlledField,
)

MaterialFaceKind = Literal["exterior", "interior", "top", "bottom", "left", "right", "generated"]
MaterialFaceOverrideSource = Literal["paint", "finish"]


class MaterialFaceOverride(BaseModel):
    """MAT-09 — Revit-like per-face Paint / finish override."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    face_kind: MaterialFaceKind = Field(alias="faceKind")
    material_key: str = Field(alias="materialKey", min_length=1)
    generated_face_id: str | None = Field(default=None, alias="generatedFaceId")
    source: MaterialFaceOverrideSource | None = Field(default="paint")
    uv_scale_mm: dict | None = Field(default=None, alias="uvScaleMm")
    uv_rotation_deg: float | None = Field(default=None, alias="uvRotationDeg")
    uv_offset_mm: dict | None = Field(default=None, alias="uvOffsetMm")


class MaterialImpactProperties(BaseModel):
    """Source-backed lifecycle impact data for a shared material record."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    epd_reference: str | None = Field(default=None, alias="epdReference")
    epd_source_url: str | None = Field(default=None, alias="epdSourceUrl")
    gwp_per_unit: float | None = Field(default=None, alias="gwpPerUnit")
    gwp_unit: (
        Literal[
            "kgco2e_per_m3",
            "kgco2e_per_m2",
            "kgco2e_per_kg",
            "kgco2e_per_unit",
        ]
        | None
    ) = Field(default=None, alias="gwpUnit")
    biogenic_carbon_notes: str | None = Field(default=None, alias="biogenicCarbonNotes")
    recycled_content_percent: float | None = Field(
        default=None, ge=0, le=100, alias="recycledContentPercent"
    )
    reuse_potential: str | None = Field(default=None, alias="reusePotential")
    service_life_years: float | None = Field(default=None, gt=0, alias="serviceLifeYears")
    end_of_life_scenario: str | None = Field(default=None, alias="endOfLifeScenario")
    data_quality_level: Literal["verified_epd", "manufacturer", "generic", "estimated"] | None = (
        Field(default=None, alias="dataQualityLevel")
    )


class CircularityProperties(BaseModel):
    """Reusable circularity metadata for components and material passports."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    reused_component: bool = Field(default=False, alias="reusedComponent")
    demountability: Literal["unknown", "low", "medium", "high"] = "unknown"
    recyclability: Literal["unknown", "low", "medium", "high"] = "unknown"
    material_passport_notes: str | None = Field(default=None, alias="materialPassportNotes")
    hazardous_material_warning: str | None = Field(default=None, alias="hazardousMaterialWarning")


class MonitorSourceSpec(BaseModel):
    """FED-03 — structured Copy/Monitor source pointer.

    See ``packages/core/src/index.ts:MonitorSource`` for the wire shape.

    * ``link_id`` is the host's ``link_model`` element id when the source
      lives in another model; ``None`` for intra-host monitors.
    * ``element_id`` is the **source-side** element id (not the prefixed
      ``<linkId>::<sourceElemId>`` form).
    * ``source_revision_at_copy`` snapshots the source's revision counter at
      the moment the copy was made; ``BumpMonitoredRevisions`` re-evaluates
      drift against the source's current revision.
    * ``drifted`` / ``drifted_fields`` are written by the bump command and
      surface as a ``monitored_source_drift`` advisory.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    link_id: str | None = Field(default=None, alias="linkId")
    element_id: str = Field(alias="elementId")
    source_revision_at_copy: int = Field(default=0, alias="sourceRevisionAtCopy")
    drifted: bool = Field(default=False)
    drifted_fields: list[str] = Field(default_factory=list, alias="driftedFields")


class ViewTemplateFieldControl(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    included: bool = True
    locked: bool = True


def default_view_template_control_matrix() -> dict[
    ViewTemplateControlledField, ViewTemplateFieldControl
]:
    return {
        "scale": ViewTemplateFieldControl(),
        "detailLevel": ViewTemplateFieldControl(),
        "elementOverrides": ViewTemplateFieldControl(),
        "phase": ViewTemplateFieldControl(),
        "phaseFilter": ViewTemplateFieldControl(),
    }


def normalize_view_template_control_matrix(
    matrix: dict[str, Any] | None,
    *,
    base: dict[str, ViewTemplateFieldControl] | None = None,
) -> dict[ViewTemplateControlledField, ViewTemplateFieldControl]:
    normalized = dict(base or default_view_template_control_matrix())
    if matrix is None:
        return normalized
    for field, raw_control in matrix.items():
        if field not in normalized:
            continue
        if isinstance(raw_control, ViewTemplateFieldControl):
            control = raw_control
        elif isinstance(raw_control, dict):
            control = ViewTemplateFieldControl.model_validate(raw_control)
        else:
            continue
        normalized[field] = control
    return normalized


_SCHEME_HEX_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class RoomColorSchemeRow(BaseModel):
    """One programme and/or department → fill colour for room-scheme presentation."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    scheme_color_hex: str = Field(alias="schemeColorHex")

    @field_validator("programme_code", "department", mode="before")
    @classmethod
    def _strip_optional_str(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("scheme_color_hex", mode="before")
    @classmethod
    def _normalize_scheme_hex(cls, v: Any) -> str:
        s = str(v).strip()
        if not _SCHEME_HEX_PATTERN.fullmatch(s):
            raise ValueError("schemeColorHex must be a '#RRGGBB' literal")
        return f"#{s[1:].upper()}"

    @model_validator(mode="after")
    def _needs_programme_or_department(self) -> RoomColorSchemeRow:
        if not self.programme_code and not self.department:
            raise ValueError("each scheme row needs a non-empty programmeCode and/or department")
        return self
