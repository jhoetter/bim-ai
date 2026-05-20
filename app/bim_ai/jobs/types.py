from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

JobKind = Literal[
    "csg_solve",
    "ifc_export",
    "dxf_import",
    "gltf_export",
    "sketch_trace",
    "render_still",
    "render_video",
    "agent_call",
]

JobStatus = Literal["queued", "running", "done", "errored", "cancelled"]


class JobProgress(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    current: int = Field(default=0, ge=0)
    total: int = Field(default=1, ge=1)
    percent: float = Field(default=0.0, ge=0.0, le=100.0)
    phase: str = "queued"
    message: str | None = None


class JobCancellation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    cancellable: bool = True
    requested: bool = False
    requested_at: str | None = Field(default=None, alias="requestedAt")
    reason: str | None = None


class JobCacheEvidence(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    cache_key: str = Field(alias="cacheKey")
    cache_scope: str = Field(alias="cacheScope")
    cache_hit: bool = Field(default=False, alias="cacheHit")
    source_digests: dict[str, str] = Field(default_factory=dict, alias="sourceDigests")
    evidence_digest: str | None = Field(default=None, alias="evidenceDigest")
    evidence_refs: list[str] = Field(default_factory=list, alias="evidenceRefs")


class JobOutputs(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    primary_asset_id: str | None = Field(default=None, alias="primaryAssetId")
    secondary_asset_ids: list[str] = Field(default_factory=list, alias="secondaryAssetIds")


class JobCostEstimate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    credits: float


class Job(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    model_id: str = Field(alias="modelId")
    kind: JobKind
    status: JobStatus = "queued"
    inputs: dict[str, Any] = Field(default_factory=dict)
    outputs: JobOutputs | None = None
    created_at: str = Field(alias="createdAt")
    started_at: str | None = Field(default=None, alias="startedAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    error_message: str | None = Field(default=None, alias="errorMessage")
    cost_estimate: JobCostEstimate | None = Field(default=None, alias="costEstimate")
    parent_job_id: str | None = Field(default=None, alias="parentJobId")
    progress: JobProgress | None = None
    cancellation: JobCancellation = Field(default_factory=JobCancellation)
    cache_evidence: JobCacheEvidence | None = Field(default=None, alias="cacheEvidence")


class CreateJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    kind: JobKind
    inputs: dict[str, Any] = Field(default_factory=dict)
    model_id: str = Field(alias="modelId")
