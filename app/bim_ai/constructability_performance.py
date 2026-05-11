from __future__ import annotations

from typing import Any

from bim_ai.constructability_geometry import (
    candidate_pairs_by_aabb,
    collect_physical_participants,
)
from bim_ai.elements import Element


def constructability_broad_phase_stats_v1(
    elements: dict[str, Element],
    *,
    tolerance_mm: float = 1.0,
) -> dict[str, Any]:
    participants = collect_physical_participants(elements)
    candidate_pairs = candidate_pairs_by_aabb(participants, tolerance_mm=tolerance_mm)
    total_possible_pairs = max(0, len(participants) * (len(participants) - 1) // 2)
    return {
        "format": "constructabilityBroadPhaseStats_v1",
        "physicalParticipantCount": len(participants),
        "totalPossiblePairCount": total_possible_pairs,
        "candidatePairCount": len(candidate_pairs),
        "prunedPairCount": max(0, total_possible_pairs - len(candidate_pairs)),
        "candidatePairs": [
            sorted([a.element_id, b.element_id])
            for a, b in sorted(
                candidate_pairs,
                key=lambda pair: tuple(sorted([pair[0].element_id, pair[1].element_id])),
            )
        ],
    }


def impacted_constructability_pairs_v1(
    elements: dict[str, Element],
    *,
    changed_element_ids: set[str],
    tolerance_mm: float = 1.0,
) -> dict[str, Any]:
    stats = constructability_broad_phase_stats_v1(elements, tolerance_mm=tolerance_mm)
    changed = {str(element_id) for element_id in changed_element_ids}
    impacted = [
        pair
        for pair in stats["candidatePairs"]
        if changed.intersection(str(element_id) for element_id in pair)
    ]
    return {
        "format": "constructabilityImpactedPairs_v1",
        "changedElementIds": sorted(changed),
        "candidatePairCount": stats["candidatePairCount"],
        "impactedPairCount": len(impacted),
        "impactedPairs": impacted,
    }
