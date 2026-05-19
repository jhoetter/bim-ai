from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from time import perf_counter_ns
from typing import Any, TypeVar

T = TypeVar("T")


class AdvisorDiagnosticsProfiler:
    """Low-overhead timing collector for deterministic Advisor diagnostics."""

    def __init__(
        self,
        *,
        element_count: int,
        changed_element_ids: Iterable[str] = (),
        incremental_eligibility: Mapping[str, Any] | None = None,
    ) -> None:
        self._element_count = int(element_count)
        self._changed_element_ids = sorted({str(eid) for eid in changed_element_ids if eid})
        self._incremental_eligibility = (
            dict(incremental_eligibility) if incremental_eligibility is not None else None
        )
        self._started_ns = perf_counter_ns()
        self._entries: list[dict[str, Any]] = []

    def measure(
        self,
        *,
        check_id: str,
        layer: str,
        run: Callable[[], T],
        finding_count: Callable[[T], int] | None = None,
        candidate_element_count: int | None = None,
        impacted_element_count: int | None = None,
        incremental_eligible: bool | None = None,
    ) -> T:
        started_ns = perf_counter_ns()
        result = run()
        elapsed_ns = perf_counter_ns() - started_ns
        self._entries.append(
            _timing_entry(
                check_id=check_id,
                layer=layer,
                elapsed_ns=elapsed_ns,
                finding_count=finding_count(result) if finding_count else _safe_len(result),
                candidate_element_count=(
                    self._element_count
                    if candidate_element_count is None
                    else int(candidate_element_count)
                ),
                impacted_element_count=impacted_element_count,
                incremental_eligible=incremental_eligible,
            )
        )
        return result

    def skip(
        self,
        *,
        check_id: str,
        layer: str,
        reason: str,
        candidate_element_count: int | None = None,
        incremental_eligible: bool | None = None,
    ) -> None:
        self._entries.append(
            _skipped_entry(
                check_id=check_id,
                layer=layer,
                reason=reason,
                candidate_element_count=(
                    self._element_count
                    if candidate_element_count is None
                    else int(candidate_element_count)
                ),
                incremental_eligible=incremental_eligible,
            )
        )

    def payload(self) -> dict[str, Any]:
        total_elapsed_ns = perf_counter_ns() - self._started_ns
        total_findings = sum(int(entry.get("findingCount") or 0) for entry in self._entries)
        skipped_checks = [
            entry for entry in self._entries if str(entry.get("status") or "") == "skipped"
        ]
        payload: dict[str, Any] = {
            "format": "advisorDiagnosticsProfile_v1",
            "clock": "perf_counter_ns",
            "deterministicOrder": True,
            "elementCount": self._element_count,
            "changedElementIds": self._changed_element_ids,
            "summary": {
                "checkCount": len(self._entries),
                "skippedCheckCount": len(skipped_checks),
                "totalFindingCount": total_findings,
                "totalElapsedMs": _elapsed_ms(total_elapsed_ns),
            },
            "ruleTimings": list(self._entries),
            "skippedChecks": skipped_checks,
        }
        if self._incremental_eligibility is not None:
            payload["incrementalEligibility"] = dict(self._incremental_eligibility)
        return payload


def _timing_entry(
    *,
    check_id: str,
    layer: str,
    elapsed_ns: int,
    finding_count: int,
    candidate_element_count: int,
    impacted_element_count: int | None,
    incremental_eligible: bool | None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "checkId": check_id,
        "layer": layer,
        "elapsedMs": _elapsed_ms(elapsed_ns),
        "findingCount": int(finding_count),
        "candidateElementCount": int(candidate_element_count),
    }
    if impacted_element_count is not None:
        entry["impactedElementCount"] = int(impacted_element_count)
    if incremental_eligible is not None:
        entry["incrementalEligible"] = bool(incremental_eligible)
    return entry


def _skipped_entry(
    *,
    check_id: str,
    layer: str,
    reason: str,
    candidate_element_count: int,
    incremental_eligible: bool | None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "checkId": check_id,
        "layer": layer,
        "status": "skipped",
        "skipReason": reason,
        "elapsedMs": 0.0,
        "findingCount": 0,
        "candidateElementCount": int(candidate_element_count),
    }
    if incremental_eligible is not None:
        entry["incrementalEligible"] = bool(incremental_eligible)
    return entry


def _elapsed_ms(elapsed_ns: int) -> float:
    return round(max(0, int(elapsed_ns)) / 1_000_000.0, 3)


def _safe_len(value: Any) -> int:
    try:
        return len(value)
    except TypeError:
        return 0
