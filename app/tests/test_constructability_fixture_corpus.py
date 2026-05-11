from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import TypeAdapter

from bim_ai.constraints_evaluation import evaluate
from bim_ai.constructability_report import build_constructability_report
from bim_ai.elements import Element

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "constructability_cases.json"
_ELEMENTS_ADAPTER = TypeAdapter(dict[str, Element])


def _load_cases() -> list[dict[str, Any]]:
    payload = json.loads(_FIXTURE_PATH.read_text())
    assert payload["format"] == "constructabilityFixtureCorpus_v1"
    cases = payload["cases"]
    assert len({case["id"] for case in cases}) == len(cases)
    return cases


@pytest.mark.parametrize("case", _load_cases(), ids=lambda case: case["id"])
def test_constructability_fixture_corpus_matches_expected_rules(
    case: dict[str, Any],
) -> None:
    elements = _ELEMENTS_ADAPTER.validate_python(case["elements"])
    expected_rule_ids = set(case["expectedRuleIds"])
    expected_evaluator_rule_ids = set(case.get("expectedEvaluatorRuleIds", expected_rule_ids))
    absent_rule_ids = set(case["absentRuleIds"])

    evaluator_rule_ids = {violation.rule_id for violation in evaluate(elements)}
    report = build_constructability_report(
        elements,
        revision=case["id"],
        profile="construction_readiness",
    )
    report_rule_counts = report["summary"]["ruleCounts"]
    report_rule_ids = set(report_rule_counts)

    assert expected_evaluator_rule_ids <= evaluator_rule_ids
    assert expected_rule_ids <= report_rule_ids
    assert absent_rule_ids.isdisjoint(evaluator_rule_ids)
    assert absent_rule_ids.isdisjoint(report_rule_ids)
    for rule_id in expected_rule_ids:
        assert report_rule_counts[rule_id] >= 1


def test_constructability_fixture_corpus_has_positive_and_negative_cases() -> None:
    cases = _load_cases()
    positive_ids = {
        case["id"] for case in cases if case["expectedRuleIds"]
    }
    negative_absent_rules = {
        rule_id
        for case in cases
        if not case["expectedRuleIds"]
        for rule_id in case["absentRuleIds"]
    }

    assert {
        "shelf_through_wall",
        "shelf_inside_readiness_clearance_zone",
        "pipe_through_wall_without_opening",
        "stair_missing_upper_slab_opening",
        "stair_under_low_ceiling",
        "duplicate_placed_assets",
        "large_opening_in_load_bearing_wall",
        "roof_too_small_for_primary_wall",
        "unsupported_beam",
    } <= positive_ids
    assert {
        "furniture_wall_hard_clash",
        "pipe_wall_penetration_without_opening",
        "stair_floor_penetration_without_slab_opening",
        "stair_headroom_clearance_conflict",
        "large_opening_in_load_bearing_wall_unresolved",
    } <= negative_absent_rules
