from __future__ import annotations

from collections import Counter
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from bim_ai.code_profile_integrity import check_code_profile_integrity
from bim_ai.envelope_integrity import check_envelope_integrity
from bim_ai.room_access_integrity import check_room_access_integrity
from bim_ai.site_georeferencing_integrity import check_site_georeferencing_integrity
from bim_ai.structure_mep_lite_integrity import check_structure_mep_lite_integrity
from bim_ai.vertical_circulation_integrity import check_vertical_circulation_integrity

if TYPE_CHECKING:
    from bim_ai.advisor_profiling import AdvisorDiagnosticsProfiler

DOMAIN_INTEGRITY_TRACKER_ITEMS = (
    "BIR-D04",
    "BIR-D05",
    "BIR-D06",
    "BIR-D07",
    "BIR-E02",
    "BIR-E03",
    "BIR-E04",
    "BIR-E05",
    "BIR-E06",
    "BIR-E07",
    "BIR-F01",
    "BIR-F02",
    "BIR-F03",
    "BIR-F04",
    "BIR-F05",
    "BIR-F06",
    "BIR-F07",
    "BIR-G01",
    "BIR-G02",
    "BIR-G03",
    "BIR-G04",
    "BIR-G05",
    "BIR-G06",
    "BIR-G07",
    "BIR-S01",
    "BIR-S02",
    "BIR-S03",
    "BIR-S04",
    "BIR-S05",
    "BIR-S06",
)

_PRIORITY_BY_TOKEN = {
    "P0": "P0",
    "P1": "P1",
    "P2": "P2",
    "P3": "P3",
    "critical": "P0",
    "high": "P1",
    "medium": "P2",
    "low": "P3",
}


def check_domain_integrity(
    subject: Any,
    *,
    profile: str | Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Return normalized deterministic domain-depth findings.

    This combines P1 architecture, structure-lite, MEP-lite, fire, accessibility,
    and regional profile checks. It intentionally stays deterministic: it does
    not score sketch likeness or subjective design quality.
    """

    return check_domain_integrity_profiled(subject, profile=profile)


def check_domain_integrity_profiled(
    subject: Any,
    *,
    profile: str | Mapping[str, Any] | None = None,
    profiler: AdvisorDiagnosticsProfiler | None = None,
) -> list[dict[str, Any]]:
    """Return domain findings while optionally recording per-source timings."""

    findings: list[dict[str, Any]] = []
    for source, producer in (
        (
            "room_access",
            lambda: check_room_access_integrity(subject, profile=_profile_mapping(profile)),
        ),
        ("vertical_circulation", lambda: check_vertical_circulation_integrity(subject)),
        ("envelope", lambda: check_envelope_integrity(subject, profile=_profile_id(profile))),
        ("structure_mep_lite", lambda: check_structure_mep_lite_integrity(subject)),
        ("code_profile", lambda: check_code_profile_integrity(subject, profile=profile)),
        ("site_georeferencing", lambda: check_site_georeferencing_integrity(subject)),
    ):
        findings.extend(_run_source_check(source, producer, profile=profile, profiler=profiler))

    return sorted(
        findings,
        key=lambda finding: (
            str(finding.get("priority") or ""),
            str(finding.get("severity") or ""),
            str(finding.get("ruleId") or ""),
            tuple(str(eid) for eid in finding.get("elementIds") or ()),
        ),
    )


def _run_source_check(
    source: str,
    producer: Any,
    *,
    profile: str | Mapping[str, Any] | None,
    profiler: AdvisorDiagnosticsProfiler | None,
) -> list[dict[str, Any]]:
    def run() -> list[dict[str, Any]]:
        return [_normalize_finding(source, finding, profile=profile) for finding in producer()]

    if profiler is None:
        return run()
    return profiler.measure(
        check_id=f"domain_integrity.{source}",
        layer="domain_integrity",
        run=run,
    )


def domain_integrity_report(
    subject: Any,
    *,
    profile: str | Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    findings = check_domain_integrity(subject, profile=profile)
    severity_counts = Counter(str(finding.get("severity") or "unknown") for finding in findings)
    priority_counts = Counter(str(finding.get("priority") or "unknown") for finding in findings)
    source_counts = Counter(str(finding.get("source") or "unknown") for finding in findings)
    return {
        "format": "domainIntegrityReport_v1",
        "profile": _profile_id(profile),
        "deterministic": True,
        "trackerItems": list(DOMAIN_INTEGRITY_TRACKER_ITEMS),
        "ok": not any(str(finding.get("severity")) == "error" for finding in findings),
        "summary": {
            "findingCount": len(findings),
            "severityCounts": dict(sorted(severity_counts.items())),
            "priorityCounts": dict(sorted(priority_counts.items())),
            "sourceCounts": dict(sorted(source_counts.items())),
        },
        "findings": findings,
    }


def _normalize_finding(
    source: str,
    raw: Any,
    *,
    profile: str | Mapping[str, Any] | None,
) -> dict[str, Any]:
    if hasattr(raw, "to_dict"):
        data = raw.to_dict()
    elif isinstance(raw, Mapping):
        data = dict(raw)
    else:
        data = dict(getattr(raw, "__dict__", {}))

    if "rule_id" in data and "ruleId" not in data:
        data["ruleId"] = data.pop("rule_id")
    if "element_ids" in data and "elementIds" not in data:
        data["elementIds"] = list(data.pop("element_ids"))
    if "elementIds" not in data:
        data["elementIds"] = []
    if "message" not in data:
        data["message"] = str(data.get("ruleId") or "Domain integrity finding.")
    if "recommendation" not in data:
        data["recommendation"] = "Inspect the affected elements and resolve the domain integrity condition."
    data["priority"] = _priority(data.get("priority"))
    data["severity"] = str(data.get("severity") or "warning")
    data["source"] = source
    data["profile"] = _profile_id(profile)
    data["blocking"] = data["severity"] == "error"
    data["blockingClass"] = "domain_integrity"
    data["trackerItems"] = _tracker_items_for(data)
    data["elementIds"] = sorted(dict.fromkeys(str(eid) for eid in data.get("elementIds") or [] if eid))
    return {key: value for key, value in data.items() if value not in (None, [], {})}


def _tracker_items_for(data: Mapping[str, Any]) -> list[str]:
    values = [str(data.get("code") or ""), str(data.get("ruleId") or "")]
    found: list[str] = []
    for value in values:
        normalized_value = value.lower().replace("_", "-")
        for token in DOMAIN_INTEGRITY_TRACKER_ITEMS:
            normalized_token = token.lower()
            if (
                (token in value or normalized_token in normalized_value)
                and token not in found
            ):
                found.append(token)
    return found


def _priority(value: Any) -> str:
    token = str(value or "P1").strip()
    return _PRIORITY_BY_TOKEN.get(token, _PRIORITY_BY_TOKEN.get(token.lower(), "P1"))


def _profile_id(profile: str | Mapping[str, Any] | None) -> str:
    if profile is None:
        return "authoring_default"
    if isinstance(profile, str):
        return profile or "authoring_default"
    return str(profile.get("id") or profile.get("profileId") or "custom")


def _profile_mapping(profile: str | Mapping[str, Any] | None) -> Mapping[str, Any] | None:
    return profile if isinstance(profile, Mapping) else None
