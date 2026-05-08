from __future__ import annotations

import secrets

from pydantic import BaseModel, ConfigDict, Field


class PublicLink(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str
    model_id: str = Field(alias="modelId")
    token: str
    created_by: str = Field(alias="createdBy")
    created_at: int = Field(alias="createdAt")
    expires_at: int | None = Field(default=None, alias="expiresAt")
    is_revoked: bool = Field(default=False, alias="isRevoked")
    display_name: str | None = Field(default=None, alias="displayName")
    open_count: int = Field(default=0, alias="openCount")


def generate_link_token() -> str:
    return secrets.token_urlsafe(32)


def verify_link_password(plain: str, hashed: str) -> bool:
    import bcrypt

    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_link_password(plain: str) -> str:
    import bcrypt

    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()
