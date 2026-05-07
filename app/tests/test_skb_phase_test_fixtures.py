"""Tests for SKB-18 phase-by-phase test fixtures."""

from __future__ import annotations

from collections import Counter

from bim_ai.skb.element_count_priors import CountRange
from bim_ai.skb.phase_test_fixtures import (
    PhaseFixture,
    assert_advisory_rule_ids,
    assert_kind_counts,
    evaluate_fixture,
    kind_counts_from_elements,
)


SAMPLE_ELEMENTS = {
    "L1": {"kind": "level", "id": "L1"},
    "L2": {"kind": "level", "id": "L2"},
    "w1": {"kind": "wall", "id": "w1"},
    "w2": {"kind": "wall", "id": "w2"},
    "w3": {"kind": "wall", "id": "w3"},
    "f1": {"kind": "floor", "id": "f1"},
}


def test_kind_counts_from_dict_elements() -> None:
    c = kind_counts_from_elements(SAMPLE_ELEMENTS)
    assert c["level"] == 2
    assert c["wall"] == 3
    assert c["floor"] == 1


def test_assert_kind_counts_exact_pass() -> None:
    failures = assert_kind_counts(
        Counter({"level": 2, "wall": 3, "floor": 1}),
        {"level": 2, "wall": 3},
    )
    assert failures == []


def test_assert_kind_counts_exact_fail() -> None:
    failures = assert_kind_counts(
        Counter({"level": 2}),
        {"level": 3},
    )
    assert failures
    assert "level" in failures[0]


def test_assert_kind_counts_range_pass() -> None:
    failures = assert_kind_counts(
        Counter({"wall": 16}),
        {"wall": CountRange(12, 24)},
    )
    assert failures == []


def test_assert_kind_counts_range_fail() -> None:
    failures = assert_kind_counts(
        Counter({"wall": 5}),
        {"wall": CountRange(12, 24)},
    )
    assert failures
    assert "[12, 24]" in failures[0]


def test_assert_advisory_rule_ids_expected_missing() -> None:
    failures = assert_advisory_rule_ids(
        advisory_rule_ids=["x"],
        expected_present=["should_be_present_v1"],
    )
    assert failures
    assert "should_be_present_v1" in failures[0]


def test_assert_advisory_rule_ids_forbidden_present() -> None:
    failures = assert_advisory_rule_ids(
        advisory_rule_ids=["bad_rule_v1"],
        forbidden=["bad_rule_v1"],
    )
    assert failures
    assert "bad_rule_v1" in failures[0]


def test_evaluate_fixture_pass() -> None:
    fix = PhaseFixture(
        phase="skeleton",
        name="basic skeleton",
        expected_kind_counts={"level": 2, "wall": CountRange(2, 5)},
        forbidden_advisory_rule_ids=["wall_corner_gap_or_overlap_v1"],
    )
    result = evaluate_fixture(
        fix,
        SAMPLE_ELEMENTS,
        actual_advisory_rule_ids=["some_other_rule_v1"],
    )
    assert result.passed
    assert result.failures == []
    assert result.phase == "skeleton"


def test_evaluate_fixture_fail() -> None:
    fix = PhaseFixture(
        phase="envelope",
        name="needs door",
        expected_kind_counts={"door": 1},
    )
    result = evaluate_fixture(fix, SAMPLE_ELEMENTS)
    assert not result.passed
    assert len(result.failures) >= 1
