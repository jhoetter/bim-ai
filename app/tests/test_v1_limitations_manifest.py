"""Tests for v1_limitations_manifest (prompt-5 / WP-A02, WP-X06)."""

from __future__ import annotations

import json

from bim_ai.v1_limitations_manifest import build_v1_limitations_manifest_v1


def test_determinism() -> None:
    a = build_v1_limitations_manifest_v1()
    b = build_v1_limitations_manifest_v1()
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def test_format_and_schema_version() -> None:
    m = build_v1_limitations_manifest_v1()
    assert m["format"] == "v1LimitationsManifest_v1"
    assert m["schemaVersion"] == 1


def test_wp_x06_present_with_reason() -> None:
    m = build_v1_limitations_manifest_v1()
    ids = {wp["id"] for wp in m["deferredWorkpackages"]}
    assert "WP-X06" in ids
    wp_x06 = next(wp for wp in m["deferredWorkpackages"] if wp["id"] == "WP-X06")
    assert wp_x06.get("reason", "")
    assert wp_x06.get("title", "")


def test_deferred_workpackages_have_required_fields() -> None:
    m = build_v1_limitations_manifest_v1()
    for wp in m["deferredWorkpackages"]:
        assert "id" in wp
        assert "title" in wp
        assert "reason" in wp
        assert wp["reason"]


def test_non_goals_non_empty() -> None:
    m = build_v1_limitations_manifest_v1()
    assert len(m["nonGoals"]) > 0


def test_non_goals_contains_rvt_native_entry() -> None:
    m = build_v1_limitations_manifest_v1()
    rvt_entry = next(
        (g for g in m["nonGoals"] if "RVT native" in g or "rvt native" in g.lower()),
        None,
    )
    assert rvt_entry is not None, "nonGoals must include the RVT-native import/export entry"


def test_non_goals_contains_second_source_of_truth_entry() -> None:
    m = build_v1_limitations_manifest_v1()
    sot_entry = next(
        (g for g in m["nonGoals"] if "second drawing" in g.lower() or "source of truth" in g.lower()),
        None,
    )
    assert sot_entry is not None, "nonGoals must include the 'second drawing-only source of truth' entry"


def test_partial_areas_non_empty() -> None:
    m = build_v1_limitations_manifest_v1()
    assert len(m["partialAreas"]) > 0


def test_partial_areas_have_required_fields() -> None:
    m = build_v1_limitations_manifest_v1()
    for area in m["partialAreas"]:
        assert "area" in area
        assert "parityRead" in area
        assert area["area"]
        assert area["parityRead"]


def test_aggregate_digest_is_stable_hex() -> None:
    m = build_v1_limitations_manifest_v1()
    digest = m["aggregateDigest"]
    assert isinstance(digest, str)
    assert len(digest) == 64
    int(digest, 16)  # raises ValueError if not valid hex


def test_aggregate_digest_stable_across_builds() -> None:
    a = build_v1_limitations_manifest_v1()
    b = build_v1_limitations_manifest_v1()
    assert a["aggregateDigest"] == b["aggregateDigest"]
