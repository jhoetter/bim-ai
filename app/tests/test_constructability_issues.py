from __future__ import annotations

from bim_ai.constraints_core import Violation
from bim_ai.constructability_issues import (
    STATUS_ACTIVE,
    STATUS_NEW,
    STATUS_RESOLVED,
    STATUS_SUPPRESSED,
    fingerprint_violation,
    reconcile_findings,
)


def _violation(
    rule_id: str = "clearance.headroom",
    element_ids: list[str] | None = None,
    **extra: object,
) -> dict[str, object]:
    return {
        "ruleId": rule_id,
        "elementIds": element_ids or ["B", "A"],
        "severity": "warning",
        "message": "Headroom is below target.",
        **extra,
    }


def test_fingerprint_is_deterministic_for_sorted_elements_and_point_bucket() -> None:
    first = _violation(element_ids=["B", "A"], point=[149.0, 251.0, 0.0])
    second = _violation(element_ids=["A", "B"], point=[145.0, 254.0, 1.0])

    assert fingerprint_violation(first) == fingerprint_violation(second)


def test_reconcile_creates_new_issue_for_new_finding() -> None:
    issues = reconcile_findings([], [_violation()], revision="r1")

    assert issues == [
        {
            "fingerprint": fingerprint_violation(_violation()),
            "ruleId": "clearance.headroom",
            "elementIds": ["A", "B"],
            "pairKey": "A::B",
            "locationBucket": None,
            "message": "Headroom is below target.",
            "severity": "warning",
            "status": STATUS_NEW,
            "firstSeenRevision": "r1",
            "lastSeenRevision": "r1",
            "resolvedRevision": None,
        }
    ]


def test_reconcile_repeated_new_finding_becomes_active_and_updates_last_seen() -> None:
    previous = reconcile_findings([], [_violation()], revision="r1")

    issues = reconcile_findings(previous, [_violation()], revision="r2")

    assert issues[0]["status"] == STATUS_ACTIVE
    assert issues[0]["firstSeenRevision"] == "r1"
    assert issues[0]["lastSeenRevision"] == "r2"
    assert issues[0]["resolvedRevision"] is None


def test_reconcile_marks_disappeared_unreviewed_finding_resolved() -> None:
    previous = reconcile_findings([], [_violation()], revision="r1")
    active = reconcile_findings(previous, [_violation()], revision="r2")

    issues = reconcile_findings(active, [], revision="r3")

    assert issues[0]["status"] == STATUS_RESOLVED
    assert issues[0]["lastSeenRevision"] == "r2"
    assert issues[0]["resolvedRevision"] == "r3"


def test_reconcile_preserves_suppressed_issue_when_finding_repeats() -> None:
    previous = reconcile_findings([], [_violation()], revision="r1")
    previous[0]["status"] = STATUS_SUPPRESSED

    issues = reconcile_findings(previous, [_violation()], revision="r2")

    assert issues[0]["status"] == STATUS_SUPPRESSED
    assert issues[0]["lastSeenRevision"] == "r2"
    assert issues[0]["resolvedRevision"] is None


def test_reconcile_accepts_existing_violation_model() -> None:
    violation = Violation(
        ruleId="clearance.headroom",
        severity="warning",
        message="Headroom is below target.",
        elementIds=["B", "A"],
    )

    issues = reconcile_findings([], [violation], revision=1)

    assert issues[0]["ruleId"] == "clearance.headroom"
    assert issues[0]["elementIds"] == ["A", "B"]
    assert issues[0]["pairKey"] == "A::B"


def test_reconcile_carries_constructability_context_fields() -> None:
    violation = Violation(
        ruleId="physical_duplicate_geometry",
        severity="warning",
        message="Duplicate physical geometry.",
        elementIds=["asset-b", "asset-a"],
        discipline="coordination",
        blockingClass="geometry",
    )

    issues = reconcile_findings([], [violation], revision=1)

    assert issues[0]["pairKey"] == "asset-a::asset-b"
    assert issues[0]["discipline"] == "coordination"
    assert issues[0]["blockingClass"] == "geometry"
