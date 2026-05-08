"""TKN-V3-01: Python Pydantic types mirroring the TypeScript TokenSequence schema."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class TknScale(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    x: float = 1.0
    y: float = 1.0
    z: float = 1.0


class EntityToken(BaseModel):
    """Host-referenced placement token for any element hosted to wall/floor/roof/level/room."""

    model_config = ConfigDict(populate_by_name=True)
    element_id: str = Field(alias="elementId")
    host_id: str = Field(alias="hostId")
    host_kind: Literal["wall", "floor", "roof", "level", "room"] = Field(alias="hostKind")
    t_along_host: float = Field(alias="tAlongHost", ge=0.0, le=1.0)
    offset_normal_mm: float = Field(alias="offsetNormalMm", default=0.0)
    scale: TknScale = Field(default_factory=TknScale)
    rotation_rad: float = Field(alias="rotationRad", default=0.0)
    class_key: str = Field(alias="classKey")
    catalog_key: str | None = Field(alias="catalogKey", default=None)


class EnvelopeToken(BaseModel):
    """Room-scale composition token encoding the bounding layout of a room."""

    model_config = ConfigDict(populate_by_name=True)
    room_id: str = Field(alias="roomId")
    room_type_key: str = Field(alias="roomTypeKey")
    layout_attrs: dict[str, float | str] = Field(alias="layoutAttrs", default_factory=dict)
    host_wall_ids: list[str] = Field(alias="hostWallIds", default_factory=list)
    host_floor_id: str | None = Field(alias="hostFloorId", default=None)
    door_ids: list[str] = Field(alias="doorIds", default_factory=list)
    window_ids: list[str] = Field(alias="windowIds", default_factory=list)


class TokenSequence(BaseModel):
    """Complete deterministic token representation of a kernel state."""

    model_config = ConfigDict(populate_by_name=True)
    schema_version: Literal["tkn-v3.0"] = Field(alias="schemaVersion", default="tkn-v3.0")
    envelopes: list[EnvelopeToken] = Field(default_factory=list)
    entities: list[EntityToken] = Field(default_factory=list)


class Advisory(BaseModel):
    """Validation advisory emitted by tkn.validate()."""

    model_config = ConfigDict(populate_by_name=True)
    code: str
    message: str
    element_id: str | None = Field(alias="elementId", default=None)
    token_index: int | None = Field(alias="tokenIndex", default=None)


class AddedEnvelope(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    envelope: EnvelopeToken


class RemovedEnvelope(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    room_id: str = Field(alias="roomId")


class ModifiedEnvelope(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    before: EnvelopeToken
    after: EnvelopeToken


class AddedEntity(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    entity: EntityToken


class RemovedEntity(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    element_id: str = Field(alias="elementId")


class ModifiedEntity(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    before: EntityToken
    after: EntityToken


class TokenSequenceDelta(BaseModel):
    """Result of diff(a, b) — describes changes between two TokenSequences."""

    model_config = ConfigDict(populate_by_name=True)
    added_envelopes: Annotated[list[AddedEnvelope], Field(alias="addedEnvelopes")] = []
    removed_envelopes: Annotated[list[RemovedEnvelope], Field(alias="removedEnvelopes")] = []
    modified_envelopes: Annotated[list[ModifiedEnvelope], Field(alias="modifiedEnvelopes")] = []
    added_entities: Annotated[list[AddedEntity], Field(alias="addedEntities")] = []
    removed_entities: Annotated[list[RemovedEntity], Field(alias="removedEntities")] = []
    modified_entities: Annotated[list[ModifiedEntity], Field(alias="modifiedEntities")] = []

    @property
    def is_empty(self) -> bool:
        return not (
            self.added_envelopes
            or self.removed_envelopes
            or self.modified_envelopes
            or self.added_entities
            or self.removed_entities
            or self.modified_entities
        )
