"""TKN-V3-01 — decode acceptance tests."""

from __future__ import annotations

import pytest

from bim_ai.elements import (
    DoorElem,
    LevelElem,
    Vec2Mm,
    WallElem,
    WindowElem,
)
from bim_ai.tkn import decode, encode
from bim_ai.tkn.types import TokenSequence


def _doc_with_door(along_t: float = 0.3) -> dict:
    return {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
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
            alongT=along_t,
            widthMm=900,
        ),
    }


def test_decode_current_state_produces_no_commands() -> None:
    """decode(encode(state), state) must be empty — no spurious moves."""
    els = _doc_with_door(along_t=0.3)
    seq = encode(els)
    cmds = decode(seq, els)
    assert cmds == []


def test_decode_mutated_t_emits_move_element() -> None:
    """Acceptance criterion (c): change tAlongHost 0.3→0.5, decode emits MoveElement."""
    els = _doc_with_door(along_t=0.3)
    seq = encode(els)

    # Mutate the door token's tAlongHost
    mutated_entities = []
    for ent in seq.entities:
        if ent.element_id == "door-1":
            mutated_entities.append(
                ent.model_copy(update={"t_along_host": 0.5})
            )
        else:
            mutated_entities.append(ent)

    mutated_seq = seq.model_copy(update={"entities": mutated_entities})
    cmds = decode(mutated_seq, els)

    assert len(cmds) == 1
    cmd = cmds[0]
    assert cmd["type"] == "moveElement"
    assert cmd["elementId"] == "door-1"
    assert abs(cmd["tAlongHost"] - 0.5) < 1e-9


def test_decode_move_element_applied_to_engine() -> None:
    """After decoding and applying the MoveElement command, door slides to new t."""
    from bim_ai.document import Document
    from bim_ai.engine import try_commit

    els = _doc_with_door(along_t=0.3)
    seq = encode(els)

    mutated_entities = [
        ent.model_copy(update={"t_along_host": 0.5}) if ent.element_id == "door-1" else ent
        for ent in seq.entities
    ]
    mutated_seq = seq.model_copy(update={"entities": mutated_entities})
    cmds = decode(mutated_seq, els)
    assert len(cmds) == 1

    doc = Document(revision=1, elements=els)
    ok, new_doc, _, viols, code = try_commit(doc, cmds[0])
    assert ok, f"commit failed: {code} / {viols}"
    assert new_doc is not None
    door = new_doc.elements["door-1"]
    assert isinstance(door, DoorElem)
    assert abs(door.along_t - 0.5) < 1e-9


def test_decode_removed_entity_emits_delete() -> None:
    """If a token is absent from seq but present in state, decode emits deleteElement."""
    els = _doc_with_door(along_t=0.3)
    seq = encode(els)

    # Remove door token from sequence
    seq_no_door = seq.model_copy(
        update={"entities": [e for e in seq.entities if e.element_id != "door-1"]}
    )
    cmds = decode(seq_no_door, els)

    assert any(c["type"] == "deleteElement" and c["elementId"] == "door-1" for c in cmds)


def test_round_trip_encode_decode_encode() -> None:
    """Acceptance criterion (b): encode → decode(self) → empty cmds → re-encode == original."""
    els = _doc_with_door(along_t=0.3)
    seq_a = encode(els)
    cmds = decode(seq_a, els)
    assert cmds == [], f"Expected no commands, got: {cmds}"
    seq_b = encode(els)
    assert seq_a == seq_b
