from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass, field, is_dataclass
from hashlib import sha256
from typing import Any

STATUS_NEW = "new"
STATUS_ACTIVE = "active"
STATUS_RESOLVED = "resolved"
STATUS_REVIEWED = "reviewed"
STATUS_APPROVED = "approved"
STATUS_NOT_AN_ISSUE = "not_an_issue"
STATUS_SUPPRESSED = "suppressed"

ISSUE_STATUSES = {
    STATUS_NEW,
    STATUS_ACTIVE,
    STATUS_RESOLVED,
    STATUS_REVIEWED,
    STATUS_APPROVED,
    STATUS_NOT_AN_ISSUE,
    STATUS_SUPPRESSED,
}

PRESERVED_REVIEW_STATUSES = {
    STATUS_REVIEWED,
    STATUS_APPROVED,
    STATUS_NOT_AN_ISSUE,
    STATUS_SUPPRESSED,
}


@dataclass
class ConstructabilityIssue:
    fingerprint: str
    ruleId: str
    elementIds: list[str] = field(default_factory=list)
    status: str = STATUS_NEW
    firstSeenRevision: str | int | None = None
    lastSeenRevision: str | int | None = None
    resolvedRevision: str | int | None = None
    locationBucket: str | None = None
    message: str | None = None
    severity: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def issue_to_dict(issue: ConstructabilityIssue | Mapping[str, Any]) -> dict[str, Any]:
    if isinstance(issue, ConstructabilityIssue):
        return issue.to_dict()
    if is_dataclass(issue):
        return asdict(issue)
    return dict(issue)


def fingerprint_violation(violation: Any, *, bucket_size: float = 100.0) -> str:
    rule_id = str(_read(violation, "rule_id", "ruleId", default=""))
    element_ids = sorted(
        str(element_id) for element_id in _read(violation, "element_ids", "elementIds", default=[])
    )
    location_bucket = _location_bucket(violation, bucket_size=bucket_size)
    parts = [f"rule:{rule_id}", f"elements:{','.join(element_ids)}"]
    if location_bucket is not None:
        parts.append(f"location:{location_bucket}")
    return sha256("|".join(parts).encode("utf-8")).hexdigest()


def reconcile_findings(
    previous_issues: Iterable[ConstructabilityIssue | Mapping[str, Any]],
    current_violations: Iterable[Any],
    revision: str | int,
) -> list[dict[str, Any]]:
    previous_by_fingerprint = {
        str(_read(issue, "fingerprint")): issue_to_dict(issue)
        for issue in previous_issues
        if _read(issue, "fingerprint", default=None) is not None
    }

    current_by_fingerprint: dict[str, Any] = {}
    for violation in current_violations:
        current_by_fingerprint[fingerprint_violation(violation)] = violation

    reconciled: list[dict[str, Any]] = []

    for fingerprint in sorted(current_by_fingerprint):
        violation = current_by_fingerprint[fingerprint]
        previous = previous_by_fingerprint.get(fingerprint)
        if previous is None:
            reconciled.append(_new_issue(fingerprint, violation, revision))
            continue

        issue = dict(previous)
        previous_status = str(issue.get("status", STATUS_ACTIVE))
        if previous_status in PRESERVED_REVIEW_STATUSES:
            status = previous_status
        elif previous_status == STATUS_NEW:
            status = STATUS_ACTIVE
        else:
            status = STATUS_ACTIVE

        issue.update(_violation_snapshot(fingerprint, violation))
        issue["status"] = status
        issue["lastSeenRevision"] = revision
        if status != STATUS_RESOLVED:
            issue["resolvedRevision"] = None
        reconciled.append(issue)

    for fingerprint in sorted(set(previous_by_fingerprint) - set(current_by_fingerprint)):
        issue = dict(previous_by_fingerprint[fingerprint])
        if issue.get("status") not in PRESERVED_REVIEW_STATUSES:
            issue["status"] = STATUS_RESOLVED
            issue["resolvedRevision"] = revision
        reconciled.append(issue)

    return reconciled


def _new_issue(fingerprint: str, violation: Any, revision: str | int) -> dict[str, Any]:
    issue = _violation_snapshot(fingerprint, violation)
    issue.update(
        {
            "status": STATUS_NEW,
            "firstSeenRevision": revision,
            "lastSeenRevision": revision,
            "resolvedRevision": None,
        }
    )
    return issue


def _violation_snapshot(fingerprint: str, violation: Any) -> dict[str, Any]:
    rule_id = str(_read(violation, "rule_id", "ruleId", default=""))
    element_ids = sorted(
        str(element_id) for element_id in _read(violation, "element_ids", "elementIds", default=[])
    )
    return {
        "fingerprint": fingerprint,
        "ruleId": rule_id,
        "elementIds": element_ids,
        "locationBucket": _location_bucket(violation),
        "message": _read(violation, "message", default=None),
        "severity": _read(violation, "severity", default=None),
    }


def _location_bucket(violation: Any, *, bucket_size: float = 100.0) -> str | None:
    point = _read(violation, "point", "location", default=None)
    if point is not None:
        bucketed = _bucket_numbers(_coordinates(point), bucket_size=bucket_size)
        return "point:" + ",".join(str(value) for value in bucketed)

    bbox = _read(violation, "bbox", "boundingBox", "bounding_box", default=None)
    if bbox is not None:
        bucketed = _bucket_numbers(_coordinates(bbox), bucket_size=bucket_size)
        return "bbox:" + ",".join(str(value) for value in bucketed)

    return None


def _coordinates(value: Any) -> list[float]:
    if isinstance(value, Mapping):
        keys = ("x", "y", "z", "minX", "minY", "minZ", "maxX", "maxY", "maxZ")
        return [float(value[key]) for key in keys if key in value]
    return [float(item) for item in value]


def _bucket_numbers(values: Iterable[float], *, bucket_size: float) -> list[int]:
    return [round(value / bucket_size) for value in values]


def _read(value: Any, *names: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        for name in names:
            if name in value:
                return value[name]
        return default

    if is_dataclass(value):
        for name in names:
            if hasattr(value, name):
                return getattr(value, name)
        return default

    for name in names:
        if hasattr(value, name):
            return getattr(value, name)
    return default
