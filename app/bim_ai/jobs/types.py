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
    "image_trace",
    "render_still",
    "render_video",
    "agent_call",
]

JobStatus = Literal["queued", "running", "done", "errored", "cancelled"]


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


class CreateJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    kind: JobKind
    inputs: dict[str, Any] = Field(default_factory=dict)
    model_id: str = Field(alias="modelId")
