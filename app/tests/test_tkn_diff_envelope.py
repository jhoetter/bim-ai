"""TEST-CQ-04 — direct coverage for tkn.diff envelope/entity comparison logic.

These tests construct TokenSequence values directly (no encode() path) so each
branch of ``_envelopes_differ`` and ``_entities_differ`` is exercised in
isolation. They also pin down behaviour the higher-level tests cover only
incidentally: float-epsilon tolerance boundary, identical-token short-circuit,
ordering stability, empty/empty diff, and ULID-prefix collision handling.
"""

from __future__ import annotations

import time

from bim_ai.tkn.diff import _FLOAT_EPSILON, diff
from bim_ai.tkn.types import (
    EntityToken,
    EnvelopeToken,
    TknScale,
    TokenSequence,
)

# ---------------------------------------------------------------------------
# Builders
# ---------------------------------------------------------------------------


def _envelope(
    room_id: str = "room-1",
    *,
    room_type_key: str = "bedroom.v1",
    host_wall_ids: list[str] | None = None,
    host_floor_id: str | None = "floor-1",
    door_ids: list[str] | None = None,
    window_ids: list[str] | None = None,
    layout_attrs: dict[str, float | str] | None = None,
) -> EnvelopeToken:
    return EnvelopeToken(
        roomId=room_id,
        roomTypeKey=room_type_key,
        hostWallIds=host_wall_ids if host_wall_ids is not None else ["w-1", "w-2"],
        hostFloorId=host_floor_id,
        doorIds=door_ids if door_ids is not None else ["d-1"],
        windowIds=window_ids if window_ids is not None else ["win-1"],
        layoutAttrs=layout_attrs if layout_attrs is not None else {"area_m2": 12.5},
    )


def _entity(
    element_id: str = "door-1",
    *,
    host_id: str = "wall-1",
    host_kind: str = "wall",
    t_along_host: float = 0.5,
    offset_normal_mm: float = 0.0,
    scale: TknScale | None = None,
    rotation_rad: float = 0.0,
    class_key: str = "door.swing.v1",
    catalog_key: str | None = "cat:door:std",
) -> EntityToken:
    return EntityToken(
        elementId=element_id,
        hostId=host_id,
        hostKind=host_kind,  # type: ignore[arg-type]
        tAlongHost=t_along_host,
        offsetNormalMm=offset_normal_mm,
        scale=scale if scale is not None else TknScale(),
        rotationRad=rotation_rad,
        classKey=class_key,
        catalogKey=catalog_key,
    )


# ---------------------------------------------------------------------------
# Empty / identical
# ---------------------------------------------------------------------------


def test_diff_empty_vs_empty_yields_empty_delta() -> None:
    a = TokenSequence()
    b = TokenSequence()
    delta = diff(a, b)
    assert delta.is_empty
    assert delta.added_envelopes == []
    assert delta.removed_envelopes == []
    assert delta.modified_envelopes == []
    assert delta.added_entities == []
    assert delta.removed_entities == []
    assert delta.modified_entities == []


def test_diff_identical_nonempty_sequences_yield_empty_delta() -> None:
    env = _envelope()
    ent = _entity()
    a = TokenSequence(envelopes=[env], entities=[ent])
    b = TokenSequence(envelopes=[env.model_copy(deep=True)], entities=[ent.model_copy(deep=True)])
    assert diff(a, b).is_empty


def test_diff_identical_token_short_circuit_is_fast() -> None:
    """Identical sequences must short-circuit (no per-field deep compare cost).

    We build a large but identical sequence and assert the diff runs in well
    under a second — protecting against accidental O(n*fields) blow-ups when
    no real difference exists.
    """
    envs = [_envelope(room_id=f"room-{i}") for i in range(200)]
    ents = [_entity(element_id=f"door-{i}") for i in range(800)]
    a = TokenSequence(envelopes=envs, entities=ents)
    # Same object references — purest short-circuit case.
    b = TokenSequence(envelopes=envs, entities=ents)

    start = time.perf_counter()
    delta = diff(a, b)
    elapsed = time.perf_counter() - start

    assert delta.is_empty
    assert elapsed < 0.25  # generous; identical-path should be near-instant


# ---------------------------------------------------------------------------
# Reordering stability
# ---------------------------------------------------------------------------


def test_diff_is_stable_under_envelope_reordering() -> None:
    e1 = _envelope(room_id="room-1")
    e2 = _envelope(room_id="room-2", room_type_key="kitchen.v1")
    e3 = _envelope(room_id="room-3", room_type_key="bath.v1")

    a = TokenSequence(envelopes=[e1, e2, e3])
    b = TokenSequence(envelopes=[e3, e1, e2])  # same set, different order

    assert diff(a, b).is_empty


def test_diff_is_stable_under_entity_reordering() -> None:
    a_ents = [_entity(element_id=f"door-{i}", t_along_host=0.1 * i) for i in range(1, 6)]
    b_ents = list(reversed(a_ents))

    a = TokenSequence(entities=a_ents)
    b = TokenSequence(entities=b_ents)

    assert diff(a, b).is_empty


# ---------------------------------------------------------------------------
# Float-epsilon boundary
# ---------------------------------------------------------------------------


def test_diff_t_along_host_within_epsilon_is_not_modified() -> None:
    # Difference strictly less than epsilon → treated as equal.
    a_ent = _entity(t_along_host=0.5)
    b_ent = _entity(t_along_host=0.5 + _FLOAT_EPSILON / 2)
    delta = diff(TokenSequence(entities=[a_ent]), TokenSequence(entities=[b_ent]))
    assert delta.modified_entities == []
    assert delta.is_empty


def test_diff_t_along_host_just_outside_epsilon_is_modified() -> None:
    # Difference strictly greater than epsilon → flagged as modified.
    a_ent = _entity(t_along_host=0.5)
    b_ent = _entity(t_along_host=0.5 + _FLOAT_EPSILON * 10)
    delta = diff(TokenSequence(entities=[a_ent]), TokenSequence(entities=[b_ent]))
    assert len(delta.modified_entities) == 1
    assert delta.modified_entities[0].before.element_id == "door-1"


def test_diff_offset_normal_mm_epsilon_boundary() -> None:
    a_ent = _entity(offset_normal_mm=10.0)
    b_within = _entity(offset_normal_mm=10.0 + _FLOAT_EPSILON / 2)
    b_outside = _entity(offset_normal_mm=10.0 + _FLOAT_EPSILON * 10)

    assert diff(TokenSequence(entities=[a_ent]), TokenSequence(entities=[b_within])).is_empty
    assert (
        len(
            diff(
                TokenSequence(entities=[a_ent]),
                TokenSequence(entities=[b_outside]),
            ).modified_entities
        )
        == 1
    )


def test_diff_rotation_rad_epsilon_boundary() -> None:
    a_ent = _entity(rotation_rad=1.0)
    b_within = _entity(rotation_rad=1.0 + _FLOAT_EPSILON / 2)
    b_outside = _entity(rotation_rad=1.0 + _FLOAT_EPSILON * 10)

    assert diff(TokenSequence(entities=[a_ent]), TokenSequence(entities=[b_within])).is_empty
    assert (
        len(
            diff(
                TokenSequence(entities=[a_ent]),
                TokenSequence(entities=[b_outside]),
            ).modified_entities
        )
        == 1
    )


def test_diff_scale_xyz_epsilon_boundary() -> None:
    base = TknScale(x=1.0, y=1.0, z=1.0)
    within = TknScale(
        x=1.0 + _FLOAT_EPSILON / 4,
        y=1.0 - _FLOAT_EPSILON / 4,
        z=1.0 + _FLOAT_EPSILON / 4,
    )
    a_ent = _entity(scale=base)
    b_within = _entity(scale=within)

    assert diff(TokenSequence(entities=[a_ent]), TokenSequence(entities=[b_within])).is_empty

    for axis_kwargs in (
        TknScale(x=1.0 + _FLOAT_EPSILON * 10, y=1.0, z=1.0),
        TknScale(x=1.0, y=1.0 + _FLOAT_EPSILON * 10, z=1.0),
        TknScale(x=1.0, y=1.0, z=1.0 + _FLOAT_EPSILON * 10),
    ):
        delta = diff(
            TokenSequence(entities=[a_ent]),
            TokenSequence(entities=[_entity(scale=axis_kwargs)]),
        )
        assert len(delta.modified_entities) == 1


# ---------------------------------------------------------------------------
# Entity non-float field branches
# ---------------------------------------------------------------------------


def test_diff_entity_host_id_change_is_modified() -> None:
    a = TokenSequence(entities=[_entity(host_id="wall-1")])
    b = TokenSequence(entities=[_entity(host_id="wall-2")])
    delta = diff(a, b)
    assert len(delta.modified_entities) == 1


def test_diff_entity_host_kind_change_is_modified() -> None:
    a = TokenSequence(entities=[_entity(host_kind="wall")])
    b = TokenSequence(entities=[_entity(host_kind="floor")])
    delta = diff(a, b)
    assert len(delta.modified_entities) == 1


def test_diff_entity_class_key_change_is_modified() -> None:
    a = TokenSequence(entities=[_entity(class_key="door.swing.v1")])
    b = TokenSequence(entities=[_entity(class_key="door.slide.v1")])
    delta = diff(a, b)
    assert len(delta.modified_entities) == 1


def test_diff_entity_catalog_key_change_is_modified() -> None:
    a = TokenSequence(entities=[_entity(catalog_key="cat:door:std")])
    b = TokenSequence(entities=[_entity(catalog_key="cat:door:premium")])
    delta = diff(a, b)
    assert len(delta.modified_entities) == 1


# ---------------------------------------------------------------------------
# Envelope per-field branches
# ---------------------------------------------------------------------------


def test_diff_envelope_room_type_key_change_is_modified() -> None:
    a = TokenSequence(envelopes=[_envelope(room_type_key="bedroom.v1")])
    b = TokenSequence(envelopes=[_envelope(room_type_key="kitchen.v1")])
    delta = diff(a, b)
    assert len(delta.modified_envelopes) == 1
    assert delta.modified_envelopes[0].before.room_id == "room-1"


def test_diff_envelope_host_wall_ids_change_is_modified() -> None:
    a = TokenSequence(envelopes=[_envelope(host_wall_ids=["w-1", "w-2"])])
    b = TokenSequence(envelopes=[_envelope(host_wall_ids=["w-1", "w-3"])])
    delta = diff(a, b)
    assert len(delta.modified_envelopes) == 1


def test_diff_envelope_host_floor_id_change_is_modified() -> None:
    a = TokenSequence(envelopes=[_envelope(host_floor_id="floor-1")])
    b = TokenSequence(envelopes=[_envelope(host_floor_id="floor-2")])
    delta = diff(a, b)
    assert len(delta.modified_envelopes) == 1


def test_diff_envelope_door_ids_change_is_modified() -> None:
    a = TokenSequence(envelopes=[_envelope(door_ids=["d-1"])])
    b = TokenSequence(envelopes=[_envelope(door_ids=["d-1", "d-2"])])
    delta = diff(a, b)
    assert len(delta.modified_envelopes) == 1


def test_diff_envelope_window_ids_change_is_modified() -> None:
    a = TokenSequence(envelopes=[_envelope(window_ids=["win-1"])])
    b = TokenSequence(envelopes=[_envelope(window_ids=["win-2"])])
    delta = diff(a, b)
    assert len(delta.modified_envelopes) == 1


def test_diff_envelope_layout_attrs_change_is_modified() -> None:
    a = TokenSequence(envelopes=[_envelope(layout_attrs={"area_m2": 12.5})])
    b = TokenSequence(envelopes=[_envelope(layout_attrs={"area_m2": 14.0})])
    delta = diff(a, b)
    assert len(delta.modified_envelopes) == 1


# ---------------------------------------------------------------------------
# Envelope add / remove
# ---------------------------------------------------------------------------


def test_diff_envelope_added_only_in_b() -> None:
    a = TokenSequence()
    b = TokenSequence(envelopes=[_envelope(room_id="room-new")])
    delta = diff(a, b)
    assert len(delta.added_envelopes) == 1
    assert delta.added_envelopes[0].envelope.room_id == "room-new"
    assert delta.removed_envelopes == []
    assert delta.modified_envelopes == []


def test_diff_envelope_removed_only_in_a() -> None:
    a = TokenSequence(envelopes=[_envelope(room_id="room-gone")])
    b = TokenSequence()
    delta = diff(a, b)
    assert len(delta.removed_envelopes) == 1
    assert delta.removed_envelopes[0].room_id == "room-gone"
    assert delta.added_envelopes == []


def test_diff_mixed_envelope_add_remove_modify() -> None:
    kept_same = _envelope(room_id="room-keep")
    pre_mod = _envelope(room_id="room-mod", room_type_key="bedroom.v1")
    post_mod = _envelope(room_id="room-mod", room_type_key="study.v1")
    only_a = _envelope(room_id="room-old")
    only_b = _envelope(room_id="room-new")

    a = TokenSequence(envelopes=[kept_same, pre_mod, only_a])
    b = TokenSequence(envelopes=[kept_same, post_mod, only_b])
    delta = diff(a, b)

    assert [e.envelope.room_id for e in delta.added_envelopes] == ["room-new"]
    assert [e.room_id for e in delta.removed_envelopes] == ["room-old"]
    assert [m.before.room_id for m in delta.modified_envelopes] == ["room-mod"]


# ---------------------------------------------------------------------------
# ULID-prefix collision
# ---------------------------------------------------------------------------


def test_diff_ulid_prefix_collision_does_not_match_entities() -> None:
    """Two element IDs sharing a long common prefix but differing in suffix
    must be treated as distinct — diff keys must use full ID equality, not
    prefix matching."""
    shared = "01HV9X8Q2K5N3M7P4R6T8W"  # 22-char ULID-like prefix
    id_a = f"{shared}AAAA"
    id_b = f"{shared}BBBB"

    a = TokenSequence(entities=[_entity(element_id=id_a)])
    b = TokenSequence(entities=[_entity(element_id=id_b)])
    delta = diff(a, b)

    # Distinct IDs → one removal + one addition, never a modification.
    assert delta.modified_entities == []
    assert [r.element_id for r in delta.removed_entities] == [id_a]
    assert [a_.entity.element_id for a_ in delta.added_entities] == [id_b]


def test_diff_ulid_prefix_collision_does_not_match_envelopes() -> None:
    shared = "01HV9X8Q2K5N3M7P4R6T8W"
    id_a = f"{shared}AAAA"
    id_b = f"{shared}BBBB"

    a = TokenSequence(envelopes=[_envelope(room_id=id_a)])
    b = TokenSequence(envelopes=[_envelope(room_id=id_b)])
    delta = diff(a, b)

    assert delta.modified_envelopes == []
    assert [r.room_id for r in delta.removed_envelopes] == [id_a]
    assert [a_.envelope.room_id for a_ in delta.added_envelopes] == [id_b]


def test_diff_ulid_exact_match_with_prefix_neighbours_modifies_only_exact() -> None:
    """Mixed scenario: one ID is shared exactly across a/b, a second ID
    differs only in the suffix. Only the exact-match pair should be
    considered as a candidate for modification; the prefix neighbour must
    surface as remove+add."""
    shared = "01HV9X8Q2K5N3M7P4R6T8W"
    exact = f"{shared}EQEQ"
    only_a = f"{shared}AAAA"
    only_b = f"{shared}BBBB"

    a = TokenSequence(
        entities=[
            _entity(element_id=exact, t_along_host=0.2),
            _entity(element_id=only_a, t_along_host=0.4),
        ],
    )
    b = TokenSequence(
        entities=[
            _entity(element_id=exact, t_along_host=0.8),  # modified
            _entity(element_id=only_b, t_along_host=0.4),
        ],
    )
    delta = diff(a, b)

    assert [m.before.element_id for m in delta.modified_entities] == [exact]
    assert [r.element_id for r in delta.removed_entities] == [only_a]
    assert [a_.entity.element_id for a_ in delta.added_entities] == [only_b]
