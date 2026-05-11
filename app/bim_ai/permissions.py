from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["admin", "editor", "viewer", "public-link-viewer"]
SubjectKind = Literal["user", "public-link"]
DisciplineRestriction = Literal["arch", "struct", "mep"]

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
    discipline_restriction: DisciplineRestriction | None = Field(
        default=None, alias="disciplineRestriction"
    )
    granted_by: str = Field(alias="grantedBy")
    granted_at: int = Field(alias="grantedAt")
    expires_at: int | None = Field(default=None, alias="expiresAt")


def authorize_command(role: Role, command_type: str) -> bool:
    """Return True if the role is permitted to execute command_type."""
    allowed = VERB_ALLOWLIST.get(role, set())
    return "*" in allowed or command_type in allowed


def discipline_for_element(element: Any) -> DisciplineRestriction:
    discipline = getattr(element, "discipline", None)
    if discipline in ("arch", "struct", "mep"):
        return discipline
    kind = getattr(element, "kind", None)
    if kind in {"column", "beam", "brace", "foundation"}:
        return "struct"
    if kind in {"duct", "pipe", "fixture"}:
        return "mep"
    return "arch"


def comment_anchor_scope(
    discipline_restriction: DisciplineRestriction | None,
    target_element: Any | None,
) -> Literal["in_scope", "cross_discipline_warning"]:
    """Return the soft T8 comment scope for a discipline-restricted reviewer."""

    if discipline_restriction is None or target_element is None:
        return "in_scope"
    if discipline_for_element(target_element) == discipline_restriction:
        return "in_scope"
    return "cross_discipline_warning"
