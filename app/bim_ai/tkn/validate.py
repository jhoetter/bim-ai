"""TKN-V3-01: validate(seq, kernel_state) → list[Advisory] — pure deterministic function."""

from __future__ import annotations

from typing import Any

from bim_ai.elements import (
    FloorElem,
    RoofElem,
    RoomElem,
    WallElem,
)
from bim_ai.tkn.types import Advisory, TokenSequence

_HOST_KIND_TO_ELEM_TYPES: dict[str, type] = {
    "wall": WallElem,
    "floor": FloorElem,
    "roof": RoofElem,
    "room": RoomElem,
}


def validate(seq: TokenSequence, kernel_state: dict[str, Any] | None = None) -> list[Advisory]:
    """Validate a TokenSequence; returns advisories (not exceptions).

    When kernel_state is provided, orphan-host checks are performed.
    """
    advisories: list[Advisory] = []

    for i, entity in enumerate(seq.entities):
        if not (0.0 <= entity.t_along_host <= 1.0):
            advisories.append(
                Advisory(
                    code="tkn_out_of_range",
                    message=f"entity[{i}] tAlongHost={entity.t_along_host} is outside [0,1]",
                    elementId=entity.element_id,
                    tokenIndex=i,
                )
            )

        if kernel_state is not None:
            host = kernel_state.get(entity.host_id)
            if host is None:
                advisories.append(
                    Advisory(
                        code="tkn_orphan_host",
                        message=(
                            f"entity[{i}] elementId={entity.element_id!r} references "
                            f"unknown host {entity.host_id!r}"
                        ),
                        elementId=entity.element_id,
                        tokenIndex=i,
                    )
                )
            else:
                expected_type = _HOST_KIND_TO_ELEM_TYPES.get(entity.host_kind)
                if expected_type is not None and not isinstance(host, expected_type):
                    advisories.append(
                        Advisory(
                            code="tkn_invalid_host_kind",
                            message=(
                                f"entity[{i}] hostKind={entity.host_kind!r} does not match "
                                f"actual element kind {getattr(host, 'kind', '?')!r}"
                            ),
                            elementId=entity.element_id,
                            tokenIndex=i,
                        )
                    )

    for i, envelope in enumerate(seq.envelopes):
        if kernel_state is not None:
            room = kernel_state.get(envelope.room_id)
            if room is None:
                advisories.append(
                    Advisory(
                        code="tkn_orphan_host",
                        message=(
                            f"envelope[{i}] roomId={envelope.room_id!r} references unknown room"
                        ),
                        elementId=envelope.room_id,
                        tokenIndex=i,
                    )
                )

    return advisories
