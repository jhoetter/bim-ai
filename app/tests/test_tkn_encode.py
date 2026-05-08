"""TKN-V3-01 — encode acceptance tests."""

from __future__ import annotations

import json

import pytest

from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoomElem,
    Vec2Mm,
    WallElem,
    WindowElem,
)
from bim_ai.tkn import encode
from bim_ai.tkn.types import TokenSequence


def _base_elements() -> dict:
    """Minimal level + wall + door + window + floor + room."""
    return {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground Floor", elevationMm=0),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            name="Wall 1",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=5000, yMm=0),
            thicknessMm=200,
            heightMm=2800,
        ),
        "door-1": DoorElem(
            kind="door",
            id="door-1",
            name="Door 1",
            wallId="wall-1",
            alongT=0.3,
            widthMm=900,
        ),
        "window-1": WindowElem(
            kind="window",
            id="window-1",
            name="Window 1",
            wallId="wall-1",
            alongT=0.7,
            widthMm=1200,
            sillHeightMm=900,
            heightMm=1500,
        ),
        "floor-1": FloorElem(
            kind="floor",
            id="floor-1",
            name="Floor 1",
            levelId="lvl-1",
            boundaryMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=5000, yMm=0),
                Vec2Mm(xMm=5000, yMm=4000),
                Vec2Mm(xMm=0, yMm=4000),
            ],
            thicknessMm=200,
        ),
        "room-1": RoomElem(
            kind="room",
            id="room-1",
            name="Living Room",
            levelId="lvl-1",
            outlineMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=5000, yMm=0),
                Vec2Mm(xMm=5000, yMm=4000),
                Vec2Mm(xMm=0, yMm=4000),
            ],
        ),
    }


def test_encode_returns_token_sequence() -> None:
    seq = encode(_base_elements())
    assert isinstance(seq, TokenSequence)
    assert seq.schema_version == "tkn-v3.0"


def test_encode_schema_version() -> None:
    seq = encode(_base_elements())
    assert seq.schema_version == "tkn-v3.0"


def test_encode_door_as_entity_token() -> None:
    seq = encode(_base_elements())
    door_tokens = [e for e in seq.entities if e.class_key == "door"]
    assert len(door_tokens) == 1
    tok = door_tokens[0]
    assert tok.element_id == "door-1"
    assert tok.host_id == "wall-1"
    assert tok.host_kind == "wall"
    assert abs(tok.t_along_host - 0.3) < 1e-9


def test_encode_window_as_entity_token() -> None:
    seq = encode(_base_elements())
    win_tokens = [e for e in seq.entities if e.class_key == "window"]
    assert len(win_tokens) == 1
    tok = win_tokens[0]
    assert tok.element_id == "window-1"
    assert tok.host_id == "wall-1"
    assert tok.host_kind == "wall"
    assert abs(tok.t_along_host - 0.7) < 1e-9


def test_encode_room_as_envelope_token() -> None:
    seq = encode(_base_elements())
    assert len(seq.envelopes) == 1
    env = seq.envelopes[0]
    assert env.room_id == "room-1"
    assert "wall-1" in env.host_wall_ids
    assert env.host_floor_id == "floor-1"
    assert "door-1" in env.door_ids
    assert "window-1" in env.window_ids


def test_encode_is_deterministic() -> None:
    """Acceptance criterion (a): same model encoded twice → byte-identical."""
    els = _base_elements()
    seq_a = encode(els)
    seq_b = encode(els)
    assert seq_a == seq_b
    # Also check JSON serialisation is identical
    assert seq_a.model_dump(by_alias=True) == seq_b.model_dump(by_alias=True)


def test_encode_deterministic_order_independent_of_dict_insertion() -> None:
    """Reversal of element insertion order must not change output."""
    els = _base_elements()
    # Build reversed dict
    reversed_els = dict(reversed(list(els.items())))
    seq_a = encode(els)
    seq_b = encode(reversed_els)
    assert seq_a == seq_b


def test_encode_empty_model() -> None:
    seq = encode({})
    assert seq.envelopes == []
    assert seq.entities == []
    assert seq.schema_version == "tkn-v3.0"


def test_encode_no_non_hosted_elements_in_entities() -> None:
    """Level and wall elements must not appear in entities."""
    seq = encode(_base_elements())
    entity_class_keys = {e.class_key for e in seq.entities}
    assert "level" not in entity_class_keys
    assert "wall" not in entity_class_keys
    assert "floor" not in entity_class_keys


def test_encode_layout_attrs_populated_for_room_with_outline() -> None:
    seq = encode(_base_elements())
    env = seq.envelopes[0]
    assert "boundingWidthMm" in env.layout_attrs
    assert "boundingDepthMm" in env.layout_attrs
    assert abs(float(env.layout_attrs["boundingWidthMm"]) - 5000) < 1e-3
    assert abs(float(env.layout_attrs["boundingDepthMm"]) - 4000) < 1e-3
