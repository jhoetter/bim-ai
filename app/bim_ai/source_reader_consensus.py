"""Independent AI-reader consensus checks for reverse-BIM source facts."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

from bim_ai.services.source_agent_loop import normalize_ai_visual_trace_reader_response

CRITICAL_FACT_KINDS = {
    "building_scope",
    "level",
    "storey",
    "wall_line",
    "wall_chain",
    "wall_thickness",
    "room",
    "area",
    "opening",
    "door",
    "window",
    "stair",
    "slab_opening",
    "roof",
    "dormer",
    "terrain",
    "parcel_boundary",
}

NUMERIC_TOLERANCES = {
    "areaM2": 0.25,
    "elevationMm": 20.0,
    "eaveHeightMm": 50.0,
    "heightMm": 30.0,
    "pitchDeg": 0.75,
    "ridgeHeightMm": 50.0,
    "sillHeightMm": 30.0,
    "thicknessMm": 10.0,
    "widthMm": 30.0,
}

COMPARISON_FIELDS_BY_KIND = {
    "building_scope": ["scopeType", "modeledExtent"],
    "level": ["name", "elevationMm"],
    "storey": ["name", "elevationMm"],
    "wall_thickness": ["appliesTo", "thicknessMm"],
    "room": ["levelId", "name", "areaM2"],
    "area": ["scope", "levelId", "name", "areaM2"],
    "opening": [
        "levelId",
        "openingKind",
        "openingType",
        "widthMm",
        "heightMm",
        "sillHeightMm",
        "hostWallRef",
    ],
    "door": ["levelId", "widthMm", "heightMm", "hostWallRef"],
    "window": ["levelId", "widthMm", "heightMm", "sillHeightMm", "hostWallRef"],
    "stair": ["fromLevelId", "toLevelId", "stepCount"],
    "roof": ["roofType", "pitchDeg", "eaveHeightMm", "ridgeHeightMm"],
    "dormer": ["hostRoofRef", "widthMm", "heightMm", "depthMm"],
    "parcel_boundary": ["parcelId", "areaM2"],
    "terrain": ["siteRef", "method"],
}


def build_source_reader_consensus_report(
    responses: list[dict[str, Any]] | dict[str, Any] | None,
    *,
    min_independent_readers: int = 2,
    consensus_dispositions: list[dict[str, Any]] | dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compare critical facts across independent AI-reader passes.

    This does not call an LLM. It validates the outputs already returned by
    multimodal readers and makes source-reading disagreement explicit before
    the MCP authoring agent can treat one pass as truth.
    """

    rows = _response_rows(responses)
    dispositions = _disposition_rows(consensus_dispositions)
    response_summaries = []
    facts_by_match_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    reader_keys_by_package: dict[str, set[str]] = defaultdict(set)
    critical_kinds_by_package: dict[str, set[str]] = defaultdict(set)

    for idx, response in enumerate(rows):
        package_id = str(
            response.get("workPackageId")
            or response.get("workPackage")
            or response.get("id")
            or "unknown"
        )
        reader_key = _reader_key(response, idx)
        reader_keys_by_package[package_id].add(reader_key)
        normalization = normalize_ai_visual_trace_reader_response(response)
        normalized_response = (
            normalization.get("response") if isinstance(normalization.get("response"), dict) else {}
        )
        normalized_facts = [
            fact
            for fact in normalized_response.get("facts") or []
            if isinstance(fact, dict) and str(fact.get("kind") or "") in CRITICAL_FACT_KINDS
        ]
        for fact in normalized_facts:
            critical_kinds_by_package[package_id].add(str(fact.get("kind") or ""))
            facts_by_match_key[_fact_match_key(fact)].append(
                {
                    "readerKey": reader_key,
                    "responseIndex": idx,
                    "workPackageId": package_id,
                    "fact": fact,
                }
            )
        response_summaries.append(
            {
                "responseIndex": idx,
                "workPackageId": package_id,
                "readerKey": reader_key,
                "criticalFactCount": len(normalized_facts),
                "normalization": normalization.get("summary"),
            }
        )

    blockers = []
    package_rows = []
    for package_id in sorted(reader_keys_by_package):
        reader_count = len(reader_keys_by_package[package_id])
        critical_kinds = sorted(critical_kinds_by_package.get(package_id, set()))
        status = "accepted"
        disposition = None
        if critical_kinds and reader_count < min_independent_readers:
            disposition = _matching_disposition(
                dispositions,
                code="reader_consensus_insufficient_independent_passes",
                work_package_id=package_id,
            )
            if disposition:
                status = "accepted_by_deterministic_disposition"
            else:
                status = "blocked_insufficient_independent_readers"
                blockers.append(
                    {
                        "code": "reader_consensus_insufficient_independent_passes",
                        "severity": "error",
                        "workPackageId": package_id,
                        "independentReaderCount": reader_count,
                        "requiredIndependentReaderCount": min_independent_readers,
                        "criticalFactKinds": critical_kinds,
                        "message": "Critical source facts require independent reader agreement or deterministic cross-check evidence.",
                    }
                )
        package_rows.append(
            {
                "workPackageId": package_id,
                "independentReaderCount": reader_count,
                "criticalFactKinds": critical_kinds,
                "status": status,
                "dispositionId": disposition.get("dispositionId") if disposition else None,
            }
        )

    fact_group_rows = []
    for match_key, group in sorted(facts_by_match_key.items()):
        reader_keys = sorted({str(row.get("readerKey")) for row in group})
        kind = str((group[0].get("fact") or {}).get("kind") or "unknown") if group else "unknown"
        comparisons = _compare_group(kind, group)
        resolved_comparisons = []
        for comparison in comparisons:
            if comparison.get("status") != "conflict":
                resolved_comparisons.append(comparison)
                continue
            disposition = _matching_disposition(
                dispositions,
                code="reader_consensus_critical_fact_conflict",
                match_key=match_key,
                kind=kind,
                field=str(comparison.get("field") or ""),
            )
            if disposition:
                resolved_comparisons.append(
                    {
                        **comparison,
                        "status": "resolved_by_deterministic_disposition",
                        "dispositionId": disposition.get("dispositionId"),
                        "decision": disposition.get("decision"),
                    }
                )
            else:
                resolved_comparisons.append(comparison)
        conflicts = [row for row in resolved_comparisons if row.get("status") == "conflict"]
        status = "blocked_conflict" if conflicts else "accepted"
        if conflicts:
            blockers.extend(
                {
                    "code": "reader_consensus_critical_fact_conflict",
                    "severity": "error",
                    "matchKey": match_key,
                    "kind": kind,
                    "field": conflict.get("field"),
                    "values": conflict.get("values"),
                    "message": "Independent readers disagree on a critical source fact field.",
                }
                for conflict in conflicts
            )
        fact_group_rows.append(
            {
                "matchKey": match_key,
                "kind": kind,
                "readerKeys": reader_keys,
                "factIds": sorted(
                    str((row.get("fact") or {}).get("factId") or "")
                    for row in group
                    if (row.get("fact") or {}).get("factId")
                ),
                "status": status,
                "comparisons": resolved_comparisons,
            }
        )

    blocker_counts = Counter(str(row.get("code") or "unknown") for row in blockers)
    return {
        "ok": not blockers,
        "format": "reverseBimSourceReaderConsensus_v1",
        "minimumIndependentReaders": min_independent_readers,
        "summary": {
            "responseCount": len(rows),
            "packageCount": len(package_rows),
            "criticalFactGroupCount": len(fact_group_rows),
            "blockingCount": len(blockers),
            "insufficientPackageCount": blocker_counts.get(
                "reader_consensus_insufficient_independent_passes", 0
            ),
            "conflictingFactGroupCount": blocker_counts.get(
                "reader_consensus_critical_fact_conflict", 0
            ),
            "blockerCountsByCode": dict(sorted(blocker_counts.items())),
        },
        "responses": response_summaries,
        "packages": package_rows,
        "factGroups": fact_group_rows,
        "dispositions": dispositions,
        "blockers": blockers,
    }


def _response_rows(responses: list[dict[str, Any]] | dict[str, Any] | None) -> list[dict[str, Any]]:
    if responses is None:
        return []
    if isinstance(responses, dict) and isinstance(responses.get("responses"), list):
        return [row for row in responses["responses"] if isinstance(row, dict)]
    if isinstance(responses, dict):
        return [
            {**value, "workPackageId": key}
            for key, value in responses.items()
            if isinstance(value, dict)
        ]
    if isinstance(responses, list):
        return [row for row in responses if isinstance(row, dict)]
    return []


def _disposition_rows(
    dispositions: list[dict[str, Any]] | dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if dispositions is None:
        return []
    if isinstance(dispositions, dict) and isinstance(dispositions.get("dispositions"), list):
        rows = [row for row in dispositions["dispositions"] if isinstance(row, dict)]
    elif isinstance(dispositions, dict):
        rows = [dispositions]
    elif isinstance(dispositions, list):
        rows = [row for row in dispositions if isinstance(row, dict)]
    else:
        rows = []
    out = []
    for index, row in enumerate(rows):
        if not _valid_deterministic_disposition(row):
            continue
        out.append(
            {
                **row,
                "dispositionId": row.get("dispositionId")
                or f"reader-consensus-disposition-{index + 1:03d}",
                "status": "accepted_for_consensus_resolution",
            }
        )
    return out


def _valid_deterministic_disposition(row: dict[str, Any]) -> bool:
    decision = str(row.get("decision") or "")
    if decision not in {
        "accept_deterministic_cross_check",
        "use_source_backed_value",
        "defer_source_limited",
        "use_authoritative_document",
    }:
        return False
    if not str(row.get("reason") or "").strip():
        return False
    if row.get("provenance") or row.get("sourceEvidence") or row.get("crossCheckEvidence"):
        return True
    return False


def _matching_disposition(
    dispositions: list[dict[str, Any]],
    *,
    code: str,
    work_package_id: str | None = None,
    match_key: str | None = None,
    kind: str | None = None,
    field: str | None = None,
) -> dict[str, Any] | None:
    for row in dispositions:
        if row.get("code") and str(row.get("code")) != code:
            continue
        if (
            work_package_id
            and row.get("workPackageId")
            and str(row.get("workPackageId")) != work_package_id
        ):
            continue
        if match_key and row.get("matchKey") and str(row.get("matchKey")) != match_key:
            continue
        if kind and row.get("kind") and str(row.get("kind")) != kind:
            continue
        if field and row.get("field") and str(row.get("field")) != field:
            continue
        return row
    return None


def _reader_key(response: dict[str, Any], index: int) -> str:
    explicit = response.get("readerId") or response.get("agentId") or response.get("readerPassId")
    if explicit:
        return str(explicit)
    provider = response.get("provider")
    model = response.get("model") or response.get("modelId")
    response_id = response.get("responseId")
    if provider or model or response_id:
        return "|".join(str(item) for item in (provider, model, response_id) if item)
    return f"reader-response-{index + 1}"


def _fact_match_key(fact: dict[str, Any]) -> str:
    kind = str(fact.get("kind") or "unknown")
    value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
    identity_fields = {
        "building_scope": ["targetScopeId"],
        "level": ["name", "levelId"],
        "storey": ["name", "levelId"],
        "wall_thickness": ["appliesTo", "elementScope", "levelId", "wallRole"],
        "room": ["levelId", "name"],
        "area": ["scope", "levelId", "name"],
        "opening": ["levelId", "openingKind", "openingType", "hostWallRef", "position"],
        "door": ["levelId", "hostWallRef", "position"],
        "window": ["levelId", "hostWallRef", "position"],
        "stair": ["fromLevelId", "toLevelId"],
        "slab_opening": ["levelId", "hostFloorRef"],
        "roof": ["roofType", "levelId", "referenceLevelId", "boundaryRef"],
        "dormer": ["hostRoofRef", "position"],
        "terrain": ["siteRef"],
        "parcel_boundary": ["parcelId"],
    }.get(kind, ["elementScope", "name"])
    parts = [kind]
    for field in identity_fields:
        raw = value.get(field)
        if raw not in (None, "", [], {}):
            parts.append(f"{field}:{_norm(raw)}")
    if len(parts) == 1:
        provenance = fact.get("provenance") if isinstance(fact.get("provenance"), dict) else {}
        for field in ("sourceDocumentId", "page", "region"):
            raw = provenance.get(field)
            if raw not in (None, "", [], {}):
                parts.append(f"{field}:{_norm(raw)}")
    return "|".join(parts)


def _compare_group(kind: str, group: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fields = COMPARISON_FIELDS_BY_KIND.get(kind, [])
    comparisons = []
    for field in fields:
        values = []
        for row in group:
            fact = row.get("fact") if isinstance(row.get("fact"), dict) else {}
            value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
            raw = value.get(field)
            if raw in (None, "", [], {}):
                continue
            values.append({"readerKey": row.get("readerKey"), "value": raw})
        if len(values) < 2:
            continue
        status = (
            "accepted" if _values_agree(field, [row["value"] for row in values]) else "conflict"
        )
        comparisons.append({"field": field, "status": status, "values": values})
    return comparisons


def _values_agree(field: str, values: list[Any]) -> bool:
    numeric_values = [_number(value) for value in values]
    if all(value is not None for value in numeric_values):
        nums = [float(value) for value in numeric_values if value is not None]
        tolerance = NUMERIC_TOLERANCES.get(field, 0.0)
        return max(nums) - min(nums) <= tolerance
    normalized = {_norm(value) for value in values}
    return len(normalized) <= 1


def _number(value: Any) -> float | None:
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value.replace(",", "."))
        except ValueError:
            return None
    return None


def _norm(value: Any) -> str:
    if isinstance(value, dict):
        value = "|".join(f"{key}:{value[key]}" for key in sorted(value))
    elif isinstance(value, list):
        value = "|".join(str(item) for item in value)
    return re.sub(r"[^a-z0-9.:-]+", "-", str(value).casefold()).strip("-")
