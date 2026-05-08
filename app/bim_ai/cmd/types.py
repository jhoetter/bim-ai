"""CMD-V3-01 — Pydantic types for the command-bundle apply API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AssumptionEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str = Field(min_length=1)
    value: str | int | float | bool
    confidence: float = Field(ge=0, le=1)
    source: str
    contestable: bool = True
    evidence: str | None = None


class ToleranceEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    advisory_class: str = Field(alias="advisoryClass")
    reason: str


class CommandBundle(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: Literal["cmd-v3.0"] = Field(default="cmd-v3.0", alias="schemaVersion")
    commands: list[dict[str, Any]]
    assumptions: list[AssumptionEntry] = Field(min_length=1)
    parent_revision: int = Field(alias="parentRevision")
    target_option_id: str | None = Field(default=None, alias="targetOptionId")
    tolerances: list[ToleranceEntry] | None = None


class BundleResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: str = Field(default="cmd-v3.0", alias="schemaVersion")
    applied: bool
    new_revision: int | None = Field(default=None, alias="newRevision")
    option_id: str | None = Field(default=None, alias="optionId")
    violations: list[dict[str, Any]] = Field(default_factory=list)
    checkpoint_snapshot_id: str | None = Field(default=None, alias="checkpointSnapshotId")


class AgentTrace(BaseModel):
    """Provenance trace from the agent bundle that authored an element."""

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    bundle_id: str | None = Field(default=None, alias="bundleId")
    revision: int | None = None
    phase: str | None = None
