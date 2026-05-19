from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from bim_ai.domain_integrity import check_domain_integrity
from bim_ai.elements import Element
from bim_ai.model_integrity import check_model_integrity_invariants
from bim_ai.model_integrity_hosting import (
    hosted_opening_integrity_violations,
    physical_support_context_violations,
)

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "p0_integrity_cases.json"
_ELEMENT_ADAPTER = TypeAdapter(Element)
_REQUIRED_FIXTURE_CLASSES = {
    "minimal_synthetic",
    "target_house_regression",
    "benchmark_seed",
    "import_export_roundtrip",
    "performance_stress",
    "disposable_local_evidence_rehearsal",
    "user_realistic_sketch",
}


def _load_corpus() -> dict[str, Any]:
    payload = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    assert payload["format"] == "p0IntegrityFixtureCorpus_v1"
    assert len({case["id"] for case in payload["cases"]}) == len(payload["cases"])
    return payload


def _typed_elements(raw_elements: dict[str, Any]) -> dict[str, Element]:
    elements: dict[str, Element] = {}
    for element_id, element in raw_elements.items():
        try:
            elements[str(element_id)] = _ELEMENT_ADAPTER.validate_python(element)
        except ValidationError:
            continue
    return elements


def _integrity_findings(raw_elements: dict[str, Any]) -> list[dict[str, Any]]:
    elements = _typed_elements(raw_elements)
    findings: list[dict[str, Any]] = []
    findings.extend(finding.to_dict() for finding in check_model_integrity_invariants(elements))
    findings.extend(
        violation.model_dump(by_alias=True)
        for violation in hosted_opening_integrity_violations(elements)
    )
    findings.extend(
        violation.model_dump(by_alias=True)
        for violation in physical_support_context_violations(elements)
    )
    findings.extend(check_domain_integrity(raw_elements, profile="construction_readiness"))
    return findings


def _expected_by_rule(case: dict[str, Any]) -> dict[str, set[tuple[str, ...]]]:
    expected: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    for row in case.get("expectedFindings", []):
        expected[str(row["ruleId"])].add(tuple(sorted(str(eid) for eid in row["elementIds"])))
    return expected


def _actual_by_rule(
    findings: list[dict[str, Any]],
    rules_under_test: set[str],
) -> dict[str, set[tuple[str, ...]]]:
    actual: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    for finding in findings:
        rule_id = str(finding.get("ruleId") or "")
        if rule_id not in rules_under_test:
            continue
        actual[rule_id].add(tuple(sorted(str(eid) for eid in finding.get("elementIds") or [])))
    return actual


@pytest.mark.parametrize("case", _load_corpus()["cases"], ids=lambda case: case["id"])
def test_p0_integrity_fixture_corpus_matches_expected_findings(
    case: dict[str, Any],
) -> None:
    findings = _integrity_findings(case["elements"])
    rules_under_test = {str(rule_id) for rule_id in case["rulesUnderTest"]}
    expected = _expected_by_rule(case)
    actual = _actual_by_rule(findings, rules_under_test)

    assert set(expected) == set(actual)
    for rule_id, expected_element_sets in expected.items():
        assert actual[rule_id] == expected_element_sets

    actual_rule_ids = {str(finding.get("ruleId") or "") for finding in findings}
    assert actual_rule_ids.isdisjoint(set(case.get("absentRuleIds", [])))


def test_p0_integrity_fixture_corpus_classes_are_explicit_and_auditable() -> None:
    corpus = _load_corpus()
    fixture_classes = corpus["fixtureClasses"]

    assert _REQUIRED_FIXTURE_CLASSES <= set(fixture_classes)
    assert all(fixture_classes[name]["auditable"] is True for name in _REQUIRED_FIXTURE_CLASSES)
    assert {case["fixtureClass"] for case in corpus["cases"]} <= set(fixture_classes)
    assert {"minimal_synthetic", "target_house_regression"} <= {
        case["fixtureClass"] for case in corpus["cases"]
    }


def test_p0_integrity_fixture_corpus_covers_room_and_target_house_regressions() -> None:
    corpus = _load_corpus()
    cases_by_id = {case["id"]: case for case in corpus["cases"]}

    assert {
        "room_overlap_outside_slab",
        "room_detached_island",
        "room_access_helper_host_not_real_boundary",
        "room_boundary_fake_room_separation_access",
        "room_egress_unresolved_path",
        "room_wall_topology_gap",
        "room_schedule_metadata_missing",
        "target_house_detached_access_wall",
        "target_house_roof_cut_outside_host",
        "target_house_roof_cut_inside_host",
    } <= set(cases_by_id)
    assert "room_containment_outside_floor_slab" in cases_by_id[
        "room_overlap_outside_slab"
    ]["rulesUnderTest"]
    assert cases_by_id["target_house_detached_access_wall"]["fixtureClass"] == (
        "target_house_regression"
    )
