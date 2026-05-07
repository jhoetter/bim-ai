"""FAM-08 — external family catalog file format.

Catalogs are JSON files at ``app/bim_ai/family_catalogs/<catalog-id>.json``
with the following shape::

    {
      "catalogId": str,
      "name": str,
      "version": str,
      "description": str,
      "thumbnailsBaseUrl": str | None,
      "families": [FamilyDefinition, ...]
    }

A *FamilyDefinition* mirrors the in-project family_type schema: id, name,
discipline, params, defaultTypes (each defaultType is the canonical wire
shape consumed by the in-project family library and resolver).

Loading a catalog never mutates a project; it only validates the JSON and
exposes the parsed payload. Placement into a project is a separate
operation that creates ``family_type`` elements with the optional
``catalogSource`` provenance field (catalogId + familyId + version).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

CATALOGS_DIR = Path(__file__).resolve().parent / "family_catalogs"

FamilyDiscipline = Literal[
    "door",
    "window",
    "stair",
    "railing",
    "wall_type",
    "floor_type",
    "roof_type",
    "column",
    "beam",
    "generic",
]


class FamilyParamDef(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    key: str
    label: str
    type: Literal["length_mm", "angle_deg", "material_key", "boolean", "option"]
    default: Any = None
    options: list[str] | None = None
    min: float | None = None
    max: float | None = None
    instance_overridable: bool = Field(default=False, alias="instanceOverridable")
    formula: str | None = None


class FamilyDefaultType(BaseModel):
    """Canonical wire shape for a family_type element loaded from a catalog."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    name: str
    family_id: str = Field(alias="familyId")
    discipline: FamilyDiscipline
    parameters: dict[str, Any] = Field(default_factory=dict)
    is_built_in: bool = Field(default=False, alias="isBuiltIn")


class FamilyDefinition(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str
    name: str
    discipline: FamilyDiscipline
    thumbnail: str | None = None
    params: list[FamilyParamDef] = Field(default_factory=list)
    default_types: list[FamilyDefaultType] = Field(
        default_factory=list, alias="defaultTypes"
    )


class CatalogPayload(BaseModel):
    """Full catalog payload returned by ``GET /api/family-catalogs/{id}``."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    catalog_id: str = Field(alias="catalogId")
    name: str
    version: str
    description: str = ""
    thumbnails_base_url: str | None = Field(default=None, alias="thumbnailsBaseUrl")
    families: list[FamilyDefinition] = Field(default_factory=list)


class CatalogIndexEntry(BaseModel):
    """Compact entry for ``GET /api/family-catalogs``."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    catalog_id: str = Field(alias="catalogId")
    name: str
    version: str
    description: str
    thumbnails_base_url: str | None = Field(default=None, alias="thumbnailsBaseUrl")
    family_count: int = Field(alias="familyCount")


class CatalogValidationError(ValueError):
    """Raised when a catalog JSON file fails schema validation."""


def load_catalog_file(path: Path) -> CatalogPayload:
    """Read + validate a catalog JSON file, returning the parsed payload.

    Raises ``CatalogValidationError`` (subclass of ``ValueError``) on shape
    mismatch or invalid JSON; ``FileNotFoundError`` if the file is missing.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise
    try:
        raw = json.loads(text)
    except json.JSONDecodeError as exc:
        raise CatalogValidationError(f"{path.name}: invalid JSON ({exc})") from exc
    try:
        return CatalogPayload.model_validate(raw)
    except ValidationError as exc:
        raise CatalogValidationError(f"{path.name}: {exc}") from exc


def list_catalog_files(catalogs_dir: Path | None = None) -> list[Path]:
    """Return sorted list of ``*.json`` catalog files under ``catalogs_dir``."""
    base = catalogs_dir or CATALOGS_DIR
    if not base.exists():
        return []
    return sorted(p for p in base.glob("*.json") if p.is_file())


def load_catalog_index(catalogs_dir: Path | None = None) -> list[CatalogIndexEntry]:
    """Load every catalog under ``catalogs_dir`` and return compact entries.

    Catalog files that fail validation are skipped (logged via warning) so a
    single bad catalog does not break the index endpoint.
    """
    out: list[CatalogIndexEntry] = []
    for path in list_catalog_files(catalogs_dir):
        try:
            payload = load_catalog_file(path)
        except (CatalogValidationError, FileNotFoundError):
            continue
        out.append(
            CatalogIndexEntry(
                catalogId=payload.catalog_id,
                name=payload.name,
                version=payload.version,
                description=payload.description,
                thumbnailsBaseUrl=payload.thumbnails_base_url,
                familyCount=len(payload.families),
            )
        )
    return out


def load_catalog_by_id(
    catalog_id: str, catalogs_dir: Path | None = None
) -> CatalogPayload | None:
    """Return the catalog with matching ``catalogId`` or ``None`` if absent."""
    base = catalogs_dir or CATALOGS_DIR
    candidate = base / f"{catalog_id}.json"
    if candidate.exists():
        try:
            payload = load_catalog_file(candidate)
        except CatalogValidationError:
            return None
        if payload.catalog_id == catalog_id:
            return payload
    for path in list_catalog_files(base):
        try:
            payload = load_catalog_file(path)
        except CatalogValidationError:
            continue
        if payload.catalog_id == catalog_id:
            return payload
    return None


def find_family_in_catalog(
    catalog: CatalogPayload, family_id: str
) -> FamilyDefinition | None:
    for fam in catalog.families:
        if fam.id == family_id:
            return fam
    return None


__all__ = [
    "CATALOGS_DIR",
    "CatalogIndexEntry",
    "CatalogPayload",
    "CatalogValidationError",
    "FamilyDefaultType",
    "FamilyDefinition",
    "FamilyParamDef",
    "find_family_in_catalog",
    "list_catalog_files",
    "load_catalog_by_id",
    "load_catalog_file",
    "load_catalog_index",
]
