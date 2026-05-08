"""TKN-V3-01: diff(a, b) → TokenSequenceDelta — pure deterministic function."""

from __future__ import annotations

from bim_ai.tkn.types import (
    AddedEntity,
    AddedEnvelope,
    EntityToken,
    EnvelopeToken,
    ModifiedEntity,
    ModifiedEnvelope,
    RemovedEntity,
    RemovedEnvelope,
    TokenSequence,
    TokenSequenceDelta,
)

_FLOAT_EPSILON = 1e-6


def diff(a: TokenSequence, b: TokenSequence) -> TokenSequenceDelta:
    """Compute the delta between two TokenSequences."""
    delta = TokenSequenceDelta()

    # Envelope diff — keyed by roomId
    a_env: dict[str, EnvelopeToken] = {e.room_id: e for e in a.envelopes}
    b_env: dict[str, EnvelopeToken] = {e.room_id: e for e in b.envelopes}

    for room_id, a_tok in a_env.items():
        if room_id not in b_env:
            delta.removed_envelopes.append(RemovedEnvelope(roomId=room_id))
        else:
            b_tok = b_env[room_id]
            if _envelopes_differ(a_tok, b_tok):
                delta.modified_envelopes.append(ModifiedEnvelope(before=a_tok, after=b_tok))

    for room_id, b_tok in b_env.items():
        if room_id not in a_env:
            delta.added_envelopes.append(AddedEnvelope(envelope=b_tok))

    # Entity diff — keyed by elementId
    a_ent: dict[str, EntityToken] = {e.element_id: e for e in a.entities}
    b_ent: dict[str, EntityToken] = {e.element_id: e for e in b.entities}

    for elem_id, a_tok in a_ent.items():
        if elem_id not in b_ent:
            delta.removed_entities.append(RemovedEntity(elementId=elem_id))
        else:
            b_tok = b_ent[elem_id]
            if _entities_differ(a_tok, b_tok):
                delta.modified_entities.append(ModifiedEntity(before=a_tok, after=b_tok))

    for elem_id, b_tok in b_ent.items():
        if elem_id not in a_ent:
            delta.added_entities.append(AddedEntity(entity=b_tok))

    return delta


def _envelopes_differ(a: EnvelopeToken, b: EnvelopeToken) -> bool:
    if a.room_type_key != b.room_type_key:
        return True
    if a.host_wall_ids != b.host_wall_ids:
        return True
    if a.host_floor_id != b.host_floor_id:
        return True
    if a.door_ids != b.door_ids:
        return True
    if a.window_ids != b.window_ids:
        return True
    if a.layout_attrs != b.layout_attrs:
        return True
    return False


def _entities_differ(a: EntityToken, b: EntityToken) -> bool:
    if a.host_id != b.host_id:
        return True
    if a.host_kind != b.host_kind:
        return True
    if abs(a.t_along_host - b.t_along_host) > _FLOAT_EPSILON:
        return True
    if abs(a.offset_normal_mm - b.offset_normal_mm) > _FLOAT_EPSILON:
        return True
    if a.class_key != b.class_key:
        return True
    if a.catalog_key != b.catalog_key:
        return True
    if abs(a.rotation_rad - b.rotation_rad) > _FLOAT_EPSILON:
        return True
    if (
        abs(a.scale.x - b.scale.x) > _FLOAT_EPSILON
        or abs(a.scale.y - b.scale.y) > _FLOAT_EPSILON
        or abs(a.scale.z - b.scale.z) > _FLOAT_EPSILON
    ):
        return True
    return False
