"""SKB-13 — empirical element-count priors per architectural archetype.

Cheap protection against the "agent forgot half the building" failure mode.
When an agent commits a bundle whose counts fall wildly outside the prior
range for its declared archetype, the validator emits a warning advisory
listing the kinds that look wrong.

Intentionally _coarse_ — the goal is to catch obvious omissions
("3 walls in a 200 m² house"), not to enforce architectural opinion.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CountRange:
    """Inclusive lower / upper bound on the number of instances of a kind."""

    lo: int
    hi: int

    def contains(self, n: int) -> bool:
        return self.lo <= n <= self.hi


# Archetype id → kind → expected range.
#
# Counts are for the architectural envelope (no furniture, no annotations).
# Add archetypes as SKB-09 ships its starter bundles.
ARCHETYPE_PRIORS: dict[str, dict[str, CountRange]] = {
    "single_family_two_story_modest": {
        "level": CountRange(2, 4),
        "wall": CountRange(12, 24),
        "door": CountRange(1, 4),
        "window": CountRange(4, 12),
        "floor": CountRange(2, 4),
        "roof": CountRange(1, 3),
        "stair": CountRange(1, 2),
        "room": CountRange(4, 12),
    },
    "single_family_one_story_compact": {
        "level": CountRange(1, 2),
        "wall": CountRange(8, 16),
        "door": CountRange(1, 3),
        "window": CountRange(3, 8),
        "floor": CountRange(1, 2),
        "roof": CountRange(1, 2),
        "stair": CountRange(0, 1),
        "room": CountRange(3, 8),
    },
    "townhouse_three_story": {
        "level": CountRange(3, 5),
        "wall": CountRange(18, 36),
        "door": CountRange(2, 6),
        "window": CountRange(6, 16),
        "floor": CountRange(3, 5),
        "roof": CountRange(1, 2),
        "stair": CountRange(2, 4),
        "room": CountRange(6, 16),
    },
    "cabin_a_frame": {
        "level": CountRange(1, 3),
        "wall": CountRange(4, 12),
        "door": CountRange(1, 2),
        "window": CountRange(2, 6),
        "floor": CountRange(1, 3),
        "roof": CountRange(1, 1),
        "stair": CountRange(0, 1),
        "room": CountRange(1, 4),
    },
    "l_shape_bungalow": {
        "level": CountRange(1, 2),
        "wall": CountRange(10, 20),
        "door": CountRange(1, 3),
        "window": CountRange(4, 10),
        "floor": CountRange(1, 2),
        "roof": CountRange(1, 2),
        "stair": CountRange(0, 1),
        "room": CountRange(4, 10),
    },
    "modernist_gable_two_story": {
        "level": CountRange(2, 4),
        "wall": CountRange(10, 22),
        "door": CountRange(1, 4),
        "window": CountRange(3, 12),
        "floor": CountRange(2, 4),
        "roof": CountRange(1, 3),
        "stair": CountRange(1, 2),
        "room": CountRange(3, 10),
    },
}


def out_of_range_kinds(
    archetype_id: str,
    kind_counts: dict[str, int],
) -> list[tuple[str, int, CountRange]]:
    """Return the kinds whose count falls outside the archetype's prior range.

    Returns an empty list when the archetype is unknown — silence is safer
    than false-positive warnings on archetypes the priors don't cover yet.
    """
    priors = ARCHETYPE_PRIORS.get(archetype_id)
    if priors is None:
        return []

    out: list[tuple[str, int, CountRange]] = []
    for kind, expected in sorted(priors.items()):
        actual = kind_counts.get(kind, 0)
        if not expected.contains(actual):
            out.append((kind, actual, expected))
    return out


def known_archetypes() -> list[str]:
    """Sorted list of archetype ids the priors cover."""
    return sorted(ARCHETYPE_PRIORS.keys())
