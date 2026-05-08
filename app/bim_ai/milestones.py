from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Milestone(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    model_id: str = Field(alias="modelId")
    name: str
    description: str | None = Field(default=None)
    snapshot_id: str = Field(alias="snapshotId")
    author_id: str = Field(alias="authorId")
    created_at: int = Field(alias="createdAt")


class CreateMilestoneBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    name: str
    description: str | None = Field(default=None)
    snapshot_id: str = Field(alias="snapshotId")
    author_id: str = Field(default="local-dev", alias="authorId")
