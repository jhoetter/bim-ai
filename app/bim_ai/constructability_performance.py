from __future__ import annotations

from collections.abc import Iterable, Mapping
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


def advisor_incremental_diagnostic_eligibility_v1(
    elements: dict[str, Element],
    *,
    changed_element_ids: Iterable[str],
    tolerance_mm: float = 1.0,
) -> dict[str, Any]:
    """Return the deterministic element scope for incremental diagnostics.

    The helper is intentionally pure: it derives one-hop model references and
    constructability broad-phase pair impact without mutating the model or
    requiring cached state.
    """

    element_ids = {str(element_id) for element_id in elements}
    changed = sorted({str(element_id) for element_id in changed_element_ids if element_id})
    unknown_changed = [element_id for element_id in changed if element_id not in element_ids]

    if not changed:
        return _incremental_eligibility_payload(
            changed=changed,
            unknown_changed=unknown_changed,
            total_element_count=len(element_ids),
            impacted=[],
            reason="no_changed_elements_provided",
            pair_impact=_empty_pair_impact(changed),
        )
    if not any(element_id in element_ids for element_id in changed):
        return _incremental_eligibility_payload(
            changed=changed,
            unknown_changed=unknown_changed,
            total_element_count=len(element_ids),
            impacted=[],
            reason="changed_elements_not_in_model",
            pair_impact=_empty_pair_impact(changed),
        )

    direct_refs, reverse_refs = _reference_graph(elements)
    impacted = set(element_id for element_id in changed if element_id in element_ids)
    for element_id in changed:
        impacted.update(direct_refs.get(element_id, set()))
        impacted.update(reverse_refs.get(element_id, set()))

    pair_impact = impacted_constructability_pairs_v1(
        elements,
        changed_element_ids=set(changed),
        tolerance_mm=tolerance_mm,
    )
    for pair in pair_impact["impactedPairs"]:
        impacted.update(str(element_id) for element_id in pair if str(element_id) in element_ids)

    impacted_sorted = sorted(impacted)
    reason = None
    if not impacted_sorted:
        reason = "changed_elements_not_in_model"
    elif len(impacted_sorted) >= len(element_ids):
        reason = "impacted_scope_covers_full_model"

    return _incremental_eligibility_payload(
        changed=changed,
        unknown_changed=unknown_changed,
        total_element_count=len(element_ids),
        impacted=impacted_sorted,
        reason=reason,
        pair_impact=pair_impact,
    )


def _incremental_eligibility_payload(
    *,
    changed: list[str],
    unknown_changed: list[str],
    total_element_count: int,
    impacted: list[str],
    reason: str | None,
    pair_impact: dict[str, Any],
) -> dict[str, Any]:
    eligible = bool(changed) and bool(impacted) and len(impacted) < total_element_count

    checks = [
        {
            "checkId": "model_integrity.reference_local",
            "layer": "model_integrity",
            "incrementalEligible": eligible,
            "impactedElementCount": len(impacted),
        },
        {
            "checkId": "domain_integrity.element_local",
            "layer": "domain_integrity",
            "incrementalEligible": eligible,
            "impactedElementCount": len(impacted),
        },
        {
            "checkId": "constructability.broad_phase_pairs",
            "layer": "constructability",
            "incrementalEligible": bool(changed)
            and pair_impact["impactedPairCount"] < pair_impact["candidatePairCount"],
            "impactedPairCount": pair_impact["impactedPairCount"],
            "candidatePairCount": pair_impact["candidatePairCount"],
        },
        {
            "checkId": "renderer.diagnostics.element_scope",
            "layer": "renderer_diagnostics",
            "incrementalEligible": eligible,
            "impactedElementCount": len(impacted),
        },
    ]

    return {
        "format": "advisorIncrementalDiagnosticEligibility_v1",
        "changedElementIds": changed,
        "unknownChangedElementIds": unknown_changed,
        "totalElementCount": total_element_count,
        "impactedElementCount": len(impacted),
        "impactedElementIds": impacted,
        "incrementalEligible": eligible,
        "fullScanRequiredReason": reason,
        "checks": checks,
        "constructabilityPairImpact": pair_impact,
    }


def _empty_pair_impact(changed: list[str]) -> dict[str, Any]:
    return {
        "format": "constructabilityImpactedPairs_v1",
        "changedElementIds": changed,
        "candidatePairCount": 0,
        "impactedPairCount": 0,
        "impactedPairs": [],
    }


def _reference_graph(
    elements: dict[str, Element],
) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    element_ids = {str(element_id) for element_id in elements}
    direct_refs: dict[str, set[str]] = {}
    reverse_refs: dict[str, set[str]] = {element_id: set() for element_id in element_ids}
    for element_id, element in elements.items():
        source_id = str(element_id)
        refs = {
            ref
            for ref in _reference_ids(_element_payload(element))
            if ref in element_ids and ref != source_id
        }
        direct_refs[source_id] = refs
        for ref in refs:
            reverse_refs.setdefault(ref, set()).add(source_id)
    return direct_refs, reverse_refs


def _element_payload(element: Element | Mapping[str, Any]) -> Mapping[str, Any]:
    if isinstance(element, Mapping):
        return element
    if hasattr(element, "model_dump"):
        return element.model_dump(by_alias=True)
    return dict(getattr(element, "__dict__", {}))


def _reference_ids(value: Any, *, key: str = "") -> set[str]:
    if isinstance(value, Mapping):
        refs: set[str] = set()
        for child_key, child_value in value.items():
            refs.update(_reference_ids(child_value, key=str(child_key)))
        return refs
    if isinstance(value, (list, tuple, set)):
        refs = set()
        for item in value:
            refs.update(_reference_ids(item, key=key))
        return refs
    if not _is_reference_key(key):
        return set()
    if isinstance(value, str) and value.strip():
        return {value.strip()}
    return set()


def _is_reference_key(key: str) -> bool:
    normalized = key.replace("_", "").replace("-", "").lower()
    if normalized in {"id", "kind", "name"}:
        return False
    return normalized.endswith("id") or normalized.endswith("ids")
