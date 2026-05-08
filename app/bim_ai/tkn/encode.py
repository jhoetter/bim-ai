"""TKN-V3-01: encode(elements) → TokenSequence — pure deterministic function."""

from __future__ import annotations

from typing import Any

from bim_ai.elements import (
    BalconyElem,
    DoorElem,
    DormerElem,
    FloorElem,
    RoofOpeningElem,
    RoomElem,
    SlabOpeningElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)
from bim_ai.tkn.types import (
    EntityToken,
    EnvelopeToken,
    TknScale,
    TokenSequence,
)


def encode(elements: dict[str, Any]) -> TokenSequence:
    """Encode kernel element dict into a TokenSequence.

    Deterministic: same elements dict (by content) always produces the same sequence.
    Sorted by element id throughout.
    """
    sorted_ids = sorted(elements.keys())

    envelopes: list[EnvelopeToken] = []
    entities: list[EntityToken] = []

    for eid in sorted_ids:
        el = elements[eid]

        if isinstance(el, RoomElem):
            envelopes.append(_encode_room(el, elements))
        elif isinstance(el, DoorElem):
            entities.append(_encode_door(el))
        elif isinstance(el, WindowElem):
            entities.append(_encode_window(el))
        elif isinstance(el, WallOpeningElem):
            entities.append(_encode_wall_opening(el))
        elif isinstance(el, SlabOpeningElem):
            entities.append(_encode_slab_opening(el))
        elif isinstance(el, RoofOpeningElem):
            entities.append(_encode_roof_opening(el))
        elif isinstance(el, DormerElem):
            entities.append(_encode_dormer(el))
        elif isinstance(el, BalconyElem):
            entities.append(_encode_balcony(el))

    return TokenSequence(
        schemaVersion="tkn-v3.0",
        envelopes=envelopes,
        entities=entities,
    )


def _encode_room(el: RoomElem, elements: dict[str, Any]) -> EnvelopeToken:
    layout_attrs: dict[str, float | str] = {}
    if el.outline_mm:
        xs = [p.x_mm for p in el.outline_mm]
        ys = [p.y_mm for p in el.outline_mm]
        layout_attrs["boundingWidthMm"] = max(xs) - min(xs)
        layout_attrs["boundingDepthMm"] = max(ys) - min(ys)
    if el.target_area_m2 is not None:
        layout_attrs["targetAreaM2"] = el.target_area_m2
    if el.programme_code:
        layout_attrs["programmeCode"] = el.programme_code

    level_id = el.level_id
    host_wall_ids: list[str] = sorted(
        eid
        for eid, e in elements.items()
        if isinstance(e, WallElem) and e.level_id == level_id
    )
    host_floor_id: str | None = next(
        (
            eid
            for eid in sorted(elements.keys())
            if isinstance(elements[eid], FloorElem)
            and elements[eid].level_id == level_id
        ),
        None,
    )

    # collect doors/windows whose host wall is in this room's level
    wall_id_set = set(host_wall_ids)
    door_ids: list[str] = sorted(
        eid
        for eid, e in elements.items()
        if isinstance(e, DoorElem) and e.wall_id in wall_id_set
    )
    window_ids: list[str] = sorted(
        eid
        for eid, e in elements.items()
        if isinstance(e, WindowElem) and e.wall_id in wall_id_set
    )

    return EnvelopeToken(
        roomId=el.id,
        roomTypeKey=el.programme_code or el.kind,
        layoutAttrs=layout_attrs,
        hostWallIds=host_wall_ids,
        hostFloorId=host_floor_id,
        doorIds=door_ids,
        windowIds=window_ids,
    )


def _encode_door(el: DoorElem) -> EntityToken:
    return EntityToken(
        elementId=el.id,
        hostId=el.wall_id,
        hostKind="wall",
        tAlongHost=el.along_t,
        offsetNormalMm=0.0,
        scale=TknScale(x=1.0, y=1.0, z=1.0),
        rotationRad=0.0,
        classKey="door",
        catalogKey=el.family_type_id,
    )


def _encode_window(el: WindowElem) -> EntityToken:
    return EntityToken(
        elementId=el.id,
        hostId=el.wall_id,
        hostKind="wall",
        tAlongHost=el.along_t,
        offsetNormalMm=0.0,
        scale=TknScale(x=1.0, y=1.0, z=1.0),
        rotationRad=0.0,
        classKey="window",
        catalogKey=el.family_type_id,
    )


def _encode_wall_opening(el: WallOpeningElem) -> EntityToken:
    t_mid = (el.along_t_start + el.along_t_end) / 2.0
    return EntityToken(
        elementId=el.id,
        hostId=el.host_wall_id,
        hostKind="wall",
        tAlongHost=t_mid,
        offsetNormalMm=0.0,
        scale=TknScale(x=1.0, y=1.0, z=1.0),
        rotationRad=0.0,
        classKey="wall_opening",
        catalogKey=None,
    )


def _encode_slab_opening(el: SlabOpeningElem) -> EntityToken:
    return EntityToken(
        elementId=el.id,
        hostId=el.host_floor_id,
        hostKind="floor",
        tAlongHost=0.5,
        offsetNormalMm=0.0,
        scale=TknScale(x=1.0, y=1.0, z=1.0),
        rotationRad=0.0,
        classKey="slab_opening",
        catalogKey=None,
    )


def _encode_roof_opening(el: RoofOpeningElem) -> EntityToken:
    return EntityToken(
        elementId=el.id,
        hostId=el.host_roof_id,
        hostKind="roof",
        tAlongHost=0.5,
        offsetNormalMm=0.0,
        scale=TknScale(x=1.0, y=1.0, z=1.0),
        rotationRad=0.0,
        classKey="roof_opening",
        catalogKey=None,
    )


def _encode_dormer(el: DormerElem) -> EntityToken:
    return EntityToken(
        elementId=el.id,
        hostId=el.host_roof_id,
        hostKind="roof",
        tAlongHost=0.5,
        offsetNormalMm=float(el.position_on_roof.across_ridge_mm),
        scale=TknScale(x=1.0, y=1.0, z=1.0),
        rotationRad=0.0,
        classKey="dormer",
        catalogKey=None,
    )


def _encode_balcony(el: BalconyElem) -> EntityToken:
    return EntityToken(
        elementId=el.id,
        hostId=el.wall_id,
        hostKind="wall",
        tAlongHost=0.5,
        offsetNormalMm=float(el.elevation_mm),
        scale=TknScale(x=1.0, y=1.0, z=1.0),
        rotationRad=0.0,
        classKey="balcony",
        catalogKey=None,
    )
