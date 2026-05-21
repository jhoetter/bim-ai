"""Readback comparison for MCP-first reverse-BIM authoring."""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from typing import Any


ACCEPTED_READBACK_STATUSES = {"accepted", "matched", "passed", "ok"}


def build_reverse_bim_readback_comparison(
    *,
    expected_readback: list[dict[str, Any]] | None = None,
    model_readback: dict[str, Any] | list[dict[str, Any]] | None = None,
    elements: list[dict[str, Any]] | dict[str, Any] | None = None,
    tolerance_defaults: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Compare expected source-derived authoring readback with model evidence.

    This intentionally does not mutate the model. It gives the hybrid runner a
    deterministic answer to: "Did the live BIM state contain what the source
    specification said we just authored?"
    """

    expected_rows = [row for row in expected_readback or [] if isinstance(row, dict)]
    explicit_rows = _readback_rows(model_readback)
    element_rows = _element_rows(elements)
    rows: list[dict[str, Any]] = []
    for expectation in expected_rows:
        explicit = _match_explicit_row(expectation, explicit_rows)
        if explicit is not None:
            rows.append(_row_from_explicit(expectation, explicit))
            continue
        rows.append(
            _row_from_elements(
                expectation,
                element_rows,
                tolerance_defaults=tolerance_defaults or {},
            )
        )

    if not expected_rows:
        rows.append(
            {
                "status": "blocked",
                "code": "readback_expectations_missing",
                "blocking": True,
                "message": "No expected readback rows were supplied.",
            }
        )

    status_counts = Counter(str(row.get("status") or "unknown") for row in rows)
    blocking_rows = [row for row in rows if row.get("blocking")]
    payload = {
        "ok": not blocking_rows,
        "format": "reverseBimReadbackComparison_v1",
        "summary": {
            "expectationCount": len(expected_rows),
            "rowCount": len(rows),
            "matchedCount": status_counts.get("matched", 0) + status_counts.get("accepted", 0),
            "missingCount": status_counts.get("missing", 0),
            "mismatchedCount": status_counts.get("mismatched", 0),
            "blockedCount": len(blocking_rows),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "rows": rows,
        "nextStep": (
            "Readback matched expected source-derived authoring."
            if not blocking_rows
            else "Repair model authoring or reopen the affected source facts before accepting the slice."
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def _row_from_explicit(expectation: dict[str, Any], explicit: dict[str, Any]) -> dict[str, Any]:
    status = str(explicit.get("status") or explicit.get("readbackStatus") or "").lower()
    accepted = status in ACCEPTED_READBACK_STATUSES
    blocking_reasons = [] if accepted else ["explicit readback row is not accepted"]
    return {
        "expectationId": _expectation_id(expectation),
        "sourceFactId": _source_fact_id(expectation),
        "status": "matched" if accepted else "mismatched",
        "code": None if accepted else "readback_explicit_status_not_accepted",
        "blocking": not accepted,
        "blockingReasons": blocking_reasons,
        "expected": expectation.get("expected") or {},
        "actual": explicit,
    }


def _row_from_elements(
    expectation: dict[str, Any],
    elements: list[dict[str, Any]],
    *,
    tolerance_defaults: dict[str, float],
) -> dict[str, Any]:
    expected = expectation.get("expected") if isinstance(expectation.get("expected"), dict) else {}
    expected_kind = str(expected.get("elementKind") or "")
    expected_element_id = str(expected.get("elementId") or "")
    source_fact_id = _source_fact_id(expectation)
    candidates = _candidate_elements(
        elements,
        expected_kind=expected_kind,
        expected_element_id=expected_element_id,
        source_fact_id=source_fact_id,
    )
    count_status, count_reasons = _element_count_status(expected, len(candidates))
    field_reasons = []
    if candidates:
        field_reasons = _field_mismatch_reasons(
            expected=expected,
            actual=candidates[0],
            tolerances={
                **_expectation_tolerances(expectation),
                **tolerance_defaults,
            },
        )
    blocking_reasons = [*count_reasons, *field_reasons]
    status = "matched" if not blocking_reasons else ("mismatched" if field_reasons else count_status)
    code = None
    if blocking_reasons:
        code = "readback_expected_element_missing" if not candidates else "readback_geometry_mismatch"
    return {
        "expectationId": _expectation_id(expectation),
        "sourceFactId": source_fact_id,
        "status": status,
        "code": code,
        "blocking": bool(blocking_reasons),
        "blockingReasons": blocking_reasons,
        "expected": expected,
        "actual": {
            "matchedElementCount": len(candidates),
            "elementIds": [row.get("id") for row in candidates],
            "sample": candidates[0] if candidates else None,
        },
    }


def _candidate_elements(
    elements: list[dict[str, Any]],
    *,
    expected_kind: str,
    expected_element_id: str,
    source_fact_id: str,
) -> list[dict[str, Any]]:
    candidates = []
    for element in elements:
        if expected_element_id and str(element.get("id") or "") == expected_element_id:
            candidates.append(element)
            continue
        source_ids = element.get("sourceFactIds") or element.get("sourceFacts") or []
        if source_fact_id and isinstance(source_ids, list) and source_fact_id in {str(item) for item in source_ids}:
            candidates.append(element)
            continue
        if expected_kind and str(element.get("kind") or element.get("category") or "") == expected_kind:
            candidates.append(element)
    return candidates


def _element_count_status(expected: dict[str, Any], actual_count: int) -> tuple[str, list[str]]:
    count = expected.get("elementCount") if isinstance(expected.get("elementCount"), dict) else {}
    minimum = int(count.get("min") or 1)
    maximum_raw = count.get("max")
    maximum = int(maximum_raw) if isinstance(maximum_raw, int | float) else None
    reasons = []
    if actual_count < minimum:
        reasons.append(f"expected at least {minimum} element(s), found {actual_count}")
    if maximum is not None and actual_count > maximum:
        reasons.append(f"expected at most {maximum} element(s), found {actual_count}")
    if reasons and actual_count == 0:
        return "missing", reasons
    if reasons:
        return "mismatched", reasons
    return "matched", []


def _field_mismatch_reasons(
    *,
    expected: dict[str, Any],
    actual: dict[str, Any],
    tolerances: dict[str, float],
) -> list[str]:
    reasons = []
    expected_kind = str(expected.get("elementKind") or "")
    actual_kind = str(actual.get("kind") or actual.get("category") or "")
    if expected_kind and actual_kind and expected_kind != actual_kind:
        reasons.append(f"expected kind {expected_kind!r}, found {actual_kind!r}")
    expected_level = expected.get("levelId")
    actual_level = actual.get("levelId") or actual.get("referenceLevelId")
    if expected_level and actual_level and str(expected_level) != str(actual_level):
        reasons.append(f"expected level {expected_level!r}, found {actual_level!r}")
    for group_key in ("geometry", "parameters", "hostIds"):
        expected_group = expected.get(group_key) if isinstance(expected.get(group_key), dict) else {}
        for key, expected_value in expected_group.items():
            actual_value = _deep_get(actual, key)
            if actual_value is None:
                actual_value = _deep_get(actual.get("geometrySummary"), key)
            if actual_value is None:
                continue
            if not _values_match(expected_value, actual_value, tolerances):
                reasons.append(f"{group_key}.{key} differs from expected readback")
    return reasons


def _values_match(expected: Any, actual: Any, tolerances: dict[str, float]) -> bool:
    if isinstance(expected, int | float) and isinstance(actual, int | float):
        return math.isclose(
            float(expected),
            float(actual),
            abs_tol=float(tolerances.get("lengthMm") or tolerances.get("pointMm") or 1.0),
        )
    if isinstance(expected, str) or isinstance(actual, str):
        return str(expected) == str(actual)
    if isinstance(expected, dict) and isinstance(actual, dict):
        return all(_values_match(value, actual.get(key), tolerances) for key, value in expected.items())
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return False
        return all(_values_match(left, right, tolerances) for left, right in zip(expected, actual, strict=False))
    return expected == actual


def _deep_get(row: Any, key: str) -> Any:
    if not isinstance(row, dict):
        return None
    if key in row:
        return row[key]
    aliases = {
        "wallId": ["hostWallId", "hostId", "hostElementId"],
        "hostRoofId": ["hostId", "hostElementId"],
        "boundaryMm": ["boundary", "footprintMm"],
    }
    for alias in aliases.get(key, []):
        if alias in row:
            return row[alias]
    return None


def _readback_rows(value: dict[str, Any] | list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if not isinstance(value, dict):
        return []
    candidates = [
        value.get("rows"),
        value.get("readback"),
        value.get("modelReadback"),
        value.get("readbackEvidence"),
    ]
    data = value.get("data") if isinstance(value.get("data"), dict) else {}
    candidates.extend([data.get("rows"), data.get("readback"), data.get("elements")])
    rows: list[dict[str, Any]] = []
    for candidate in candidates:
        if isinstance(candidate, list):
            rows.extend(row for row in candidate if isinstance(row, dict))
    return rows


def _element_rows(value: list[dict[str, Any]] | dict[str, Any] | None) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if not isinstance(value, dict):
        return []
    candidates = [value.get("elements"), value.get("rows")]
    data = value.get("data") if isinstance(value.get("data"), dict) else {}
    candidates.extend([data.get("elements"), data.get("rows")])
    rows: list[dict[str, Any]] = []
    for candidate in candidates:
        if isinstance(candidate, list):
            rows.extend(row for row in candidate if isinstance(row, dict))
    return rows


def _match_explicit_row(expectation: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    expectation_id = _expectation_id(expectation)
    source_fact_id = _source_fact_id(expectation)
    for row in rows:
        if expectation_id and expectation_id in {
            str(row.get("expectationId") or ""),
            str(row.get("expectedReadbackId") or ""),
        }:
            return row
        if source_fact_id and source_fact_id == str(row.get("sourceFactId") or ""):
            return row
    return None


def _expectation_id(expectation: dict[str, Any]) -> str:
    return str(expectation.get("expectationId") or expectation.get("id") or "")


def _source_fact_id(expectation: dict[str, Any]) -> str:
    return str(expectation.get("sourceFactId") or expectation.get("factId") or "")


def _expectation_tolerances(expectation: dict[str, Any]) -> dict[str, float]:
    raw = expectation.get("tolerances")
    if not isinstance(raw, dict):
        return {}
    return {str(key): float(value) for key, value in raw.items() if isinstance(value, int | float)}


def _digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
