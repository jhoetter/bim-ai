"""TKN-V3-01: decode(seq, kernel_state) → list[Command] — pure deterministic function."""

from __future__ import annotations

from typing import Any

from bim_ai.elements import DoorElem, WindowElem
from bim_ai.tkn.encode import encode
from bim_ai.tkn.types import EntityToken, EnvelopeToken, TokenSequence

_FLOAT_EPSILON = 1e-6


def decode(seq: TokenSequence, kernel_state: dict[str, Any]) -> list[dict[str, Any]]:
    """Produce the minimal command list that brings kernel_state into alignment with seq.

    For each mutated EntityToken, emits a MoveElement command.
    For added EntityTokens, emits InsertDoorOnWall / InsertWindowOnWall.
    For removed EntityTokens, emits DeleteElement.
    Envelope (room) mutations are not yet translated to commands (stub).
    """
    current_seq = encode(kernel_state)
    current_by_id: dict[str, EntityToken] = {e.element_id: e for e in current_seq.entities}
    target_by_id: dict[str, EntityToken] = {e.element_id: e for e in seq.entities}

    commands: list[dict[str, Any]] = []

    # Detect modifications and removals
    for elem_id, current_tok in current_by_id.items():
        if elem_id not in target_by_id:
            commands.append({"type": "deleteElement", "elementId": elem_id})
        else:
            target_tok = target_by_id[elem_id]
            if abs(target_tok.t_along_host - current_tok.t_along_host) > _FLOAT_EPSILON:
                commands.append(
                    {
                        "type": "moveElement",
                        "elementId": elem_id,
                        "tAlongHost": target_tok.t_along_host,
                    }
                )

    # Detect additions
    for elem_id, target_tok in target_by_id.items():
        if elem_id not in current_by_id:
            commands.extend(_commands_for_new_entity(target_tok, kernel_state))

    return commands


def _commands_for_new_entity(tok: EntityToken, kernel_state: dict[str, Any]) -> list[dict[str, Any]]:
    if tok.class_key == "door":
        return [
            {
                "type": "insertDoorOnWall",
                "id": tok.element_id,
                "wallId": tok.host_id,
                "alongT": tok.t_along_host,
                "catalogKey": tok.catalog_key,
            }
        ]
    if tok.class_key == "window":
        return [
            {
                "type": "insertWindowOnWall",
                "id": tok.element_id,
                "wallId": tok.host_id,
                "alongT": tok.t_along_host,
                "catalogKey": tok.catalog_key,
            }
        ]
    return []
