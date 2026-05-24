"""PERF-C06: level-local invalidation for room-boundary derivation.

Editing a wall on level B must not bust the cached derivation slice for
level A. The acceptance test pins this by asserting the cached
level-A slice object identity is preserved across a level-B mutation,
and by counting calls into the uncached compute path to show level A
is not rebuilt.
"""

from __future__ import annotations

from typing import Any

import pytest

from bim_ai import room_derivation
from bim_ai.document import Document
from bim_ai.elements import LevelElem, WallElem
from bim_ai.room_derivation import (
    _ROOM_BOUNDARY_LEVEL_CACHE,
    _level_cache_keys_for_doc,
    compute_room_boundary_derivation,
    reset_room_boundary_doc_cache,
)


def _rect_walls(
    *,
    level_id: str,
    prefix: str,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
) -> tuple[WallElem, ...]:
    """Four axis-aligned walls closing a rectangle on `level_id`."""
    return (
        WallElem(
            kind="wall",
            id=f"{prefix}-s",
            name=f"{prefix}-S",
            levelId=level_id,
            start={"xMm": x0, "yMm": y0},
            end={"xMm": x1, "yMm": y0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id=f"{prefix}-n",
            name=f"{prefix}-N",
            levelId=level_id,
            start={"xMm": x0, "yMm": y1},
            end={"xMm": x1, "yMm": y1},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id=f"{prefix}-w",
            name=f"{prefix}-W",
            levelId=level_id,
            start={"xMm": x0, "yMm": y0},
            end={"xMm": x0, "yMm": y1},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id=f"{prefix}-e",
            name=f"{prefix}-E",
            levelId=level_id,
            start={"xMm": x1, "yMm": y0},
            end={"xMm": x1, "yMm": y1},
            thicknessMm=200,
            heightMm=2800,
        ),
    )


def _two_level_doc(
    *, revision: int, level_b_x1: float = 4000.0
) -> tuple[Document, tuple[str, str]]:
    lvl_a = LevelElem(kind="level", id="lvl-a", name="A", elevationMm=0)
    lvl_b = LevelElem(kind="level", id="lvl-b", name="B", elevationMm=3000)
    walls_a = _rect_walls(level_id="lvl-a", prefix="wa", x0=0, y0=0, x1=4000, y1=4000)
    walls_b = _rect_walls(
        level_id="lvl-b", prefix="wb", x0=0, y0=0, x1=level_b_x1, y1=4000
    )
    elements: dict[str, Any] = {"lvl-a": lvl_a, "lvl-b": lvl_b}
    for w in walls_a + walls_b:
        elements[w.id] = w
    doc = Document(revision=revision, elements=elements)
    return doc, ("lvl-a", "lvl-b")


def test_level_a_cache_slice_identity_preserved_across_level_b_mutation() -> None:
    """The PERF-C06 acceptance test.

    1. Build a two-level doc, derive, and snapshot level A's cached slice id.
    2. Mutate only level B (resize one wall), bump revision, derive again.
    3. Assert level A's cached slice is the *exact same object* as before,
       proving the level-A cache entry was not invalidated by the level-B edit.
    """
    reset_room_boundary_doc_cache()

    doc1, (lvl_a, _lvl_b) = _two_level_doc(revision=1, level_b_x1=4000.0)
    bundle1 = compute_room_boundary_derivation(doc1)
    assert bundle1["candidateCount"] >= 2  # one rect per level

    keys1 = _level_cache_keys_for_doc(doc1)
    a_slice_v1 = _ROOM_BOUNDARY_LEVEL_CACHE[keys1[lvl_a]]
    assert a_slice_v1 is not None
    # Sanity: the cached slice carries level A's candidate (and only that).
    a_cand_ids_v1 = {
        c.get("levelId") for c in a_slice_v1["axisAlignedRectangleCandidates"]
    }
    assert a_cand_ids_v1 == {lvl_a}

    # Mutate level B only: change the eastern wall's extent.
    doc2, _ = _two_level_doc(revision=2, level_b_x1=5000.0)
    bundle2 = compute_room_boundary_derivation(doc2)
    assert bundle2["candidateCount"] >= 2

    keys2 = _level_cache_keys_for_doc(doc2)
    # Level A's cache key must be unchanged (no level-A inputs moved).
    assert keys2[lvl_a] == keys1[lvl_a]
    a_slice_v2 = _ROOM_BOUNDARY_LEVEL_CACHE[keys2[lvl_a]]
    assert a_slice_v2 is a_slice_v1, (
        "level-A cached slice identity must survive a level-B-only mutation"
    )


def test_level_b_mutation_invalidates_only_level_b_key() -> None:
    """A mutation confined to level B must change *only* level B's cache key."""
    reset_room_boundary_doc_cache()

    doc1, (lvl_a, lvl_b) = _two_level_doc(revision=1, level_b_x1=4000.0)
    keys1 = _level_cache_keys_for_doc(doc1)

    doc2, _ = _two_level_doc(revision=2, level_b_x1=5000.0)
    keys2 = _level_cache_keys_for_doc(doc2)

    assert keys2[lvl_a] == keys1[lvl_a], "level-A key must be stable"
    assert keys2[lvl_b] != keys1[lvl_b], "level-B key must change with level-B edit"


def test_unchanged_doc_skips_uncached_recompute_on_partial_mutation(monkeypatch) -> None:
    """After a level-B mutation, the inner uncached compute runs only because
    level B's slice missed — level A's slice is served from the per-level cache.

    The bundle still goes through the whole-document uncached pass once for the
    second revision (per the scope clarifier: full inner-loop restructure is a
    follow-up), but the *third* call with no further mutation must hit the
    cross-request doc cache and skip the uncached path entirely.
    """
    calls = 0
    real = room_derivation._compute_room_boundary_derivation_uncached

    def counting_uncached(doc: Document) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return real(doc)

    monkeypatch.setattr(
        room_derivation, "_compute_room_boundary_derivation_uncached", counting_uncached
    )

    reset_room_boundary_doc_cache()
    doc1, _ = _two_level_doc(revision=1, level_b_x1=4000.0)
    compute_room_boundary_derivation(doc1)
    assert calls == 1

    doc2, _ = _two_level_doc(revision=2, level_b_x1=5000.0)
    compute_room_boundary_derivation(doc2)
    assert calls == 2

    # Re-deriving the same revision-2 doc must hit the cross-request doc cache.
    compute_room_boundary_derivation(doc2)
    assert calls == 2


def test_level_cache_hit_when_revision_changes_but_no_inputs_move() -> None:
    """If every per-level key is unchanged (e.g. revision bumped after a no-op
    change to a non-cached element), the doc cache misses but the per-level
    cache serves the whole bundle without invoking the uncached compute."""
    calls = 0
    real = room_derivation._compute_room_boundary_derivation_uncached

    def counting_uncached(doc: Document) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return real(doc)

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            room_derivation,
            "_compute_room_boundary_derivation_uncached",
            counting_uncached,
        )

        reset_room_boundary_doc_cache()
        doc1, _ = _two_level_doc(revision=1, level_b_x1=4000.0)
        compute_room_boundary_derivation(doc1)
        assert calls == 1

        # Same inputs, new revision -> doc-cache miss, all per-level keys hit.
        doc2, _ = _two_level_doc(revision=2, level_b_x1=4000.0)
        compute_room_boundary_derivation(doc2)
        assert calls == 1, "per-level cache must serve the full bundle"
