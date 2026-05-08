"""TKN-V3-01 — diff acceptance tests."""

from __future__ import annotations

import pytest

from bim_ai.elements import (
    DoorElem,
    LevelElem,
    Vec2Mm,
    WallElem,
    WindowElem,
)
from bim_ai.tkn import diff, encode
from bim_ai.tkn.types import TokenSequence


def _elements_with_door(along_t: float = 0.3) -> dict:
    return {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            name="Wall",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=5000, yMm=0),
            thicknessMm=200,
            heightMm=2800,
        ),
        "door-1": DoorElem(
            kind="door",
            id="door-1",
            name="Door",
            wallId="wall-1",
            alongT=along_t,
            widthMm=900,
        ),
    }


def test_diff_identical_sequences_is_empty() -> None:
    els = _elements_with_door()
    seq = encode(els)
    delta = diff(seq, seq)
    assert delta.is_empty


def test_diff_self_copy_is_empty() -> None:
    els = _elements_with_door()
    seq_a = encode(els)
    seq_b = encode(els)
    delta = diff(seq_a, seq_b)
    assert delta.is_empty


def test_diff_detects_t_change_as_modified_entity() -> None:
    seq_a = encode(_elements_with_door(along_t=0.3))
    seq_b = encode(_elements_with_door(along_t=0.5))
    delta = diff(seq_a, seq_b)

    assert len(delta.modified_entities) == 1
    mod = delta.modified_entities[0]
    assert mod.before.element_id == "door-1"
    assert mod.after.element_id == "door-1"
    assert abs(mod.before.t_along_host - 0.3) < 1e-9
    assert abs(mod.after.t_along_host - 0.5) < 1e-9


def test_diff_detects_added_entity() -> None:
    els_a = _elements_with_door()
    els_b = {**els_a, "window-1": WindowElem(
        kind="window",
        id="window-1",
        name="Window",
        wallId="wall-1",
        alongT=0.7,
        widthMm=1200,
        sillHeightMm=900,
        heightMm=1500,
    )}
    delta = diff(encode(els_a), encode(els_b))

    assert len(delta.added_entities) == 1
    assert delta.added_entities[0].entity.element_id == "window-1"
    assert delta.removed_entities == []


def test_diff_detects_removed_entity() -> None:
    els_a = _elements_with_door()
    els_b = {k: v for k, v in els_a.items() if k != "door-1"}
    delta = diff(encode(els_a), encode(els_b))

    assert len(delta.removed_entities) == 1
    assert delta.removed_entities[0].element_id == "door-1"
    assert delta.added_entities == []
