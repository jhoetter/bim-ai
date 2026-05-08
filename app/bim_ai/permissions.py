from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["admin", "editor", "viewer", "public-link-viewer"]
SubjectKind = Literal["user", "public-link"]

VERB_ALLOWLIST: dict[Role, set[str]] = {
    "admin": {"*"},
    "editor": {
        "createWall",
        "createDoor",
        "createWindow",
        "createStair",
        "createLevel",
        "moveElement",
        "setWallStack",
        "assignElementToOption",
        "createComment",
        "resolveComment",
        "createMarkup",
    },
    "viewer": {"createComment", "resolveComment", "createMarkup"},
    "public-link-viewer": {"createComment", "resolveComment"},
}


class RoleAssignment(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str
    model_id: str = Field(alias="modelId")
    subject_kind: SubjectKind = Field(alias="subjectKind")
    subject_id: str = Field(alias="subjectId")
    role: Role
    granted_by: str = Field(alias="grantedBy")
    granted_at: int = Field(alias="grantedAt")
    expires_at: int | None = Field(default=None, alias="expiresAt")


def authorize_command(role: Role, command_type: str) -> bool:
    """Return True if the role is permitted to execute command_type."""
    allowed = VERB_ALLOWLIST.get(role, set())
    return "*" in allowed or command_type in allowed
