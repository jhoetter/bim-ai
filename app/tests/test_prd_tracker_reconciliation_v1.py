"""Tests for the PRD tracker reconciliation manifest (Wave 5 / WP-001 / WP-A02).

Validates:
- Manifest builds are deterministic (byte-identical JSON)
- Every WP-* in the parsed tracker either appears in the mapping or staleTrackerRows
- Every PRD §5/§6/§7/§8/§9/§11/§12/§13/§15 anchor has at least one workpackage (or deferred)
- Rows are sorted by prdSectionId with no duplicates
- Every row has a valid coverage token
- Coverage counts sum to total rows
- staleTrackerRows are sorted and each references a real tracker WP ID

SKIP REASON: spec/revit-production-parity-workpackage-tracker.md was deleted in
commit e441173e (superseded by spec/workpackage-master-tracker.md). These tests
were written against the old Wave-5 tracker format and are no longer active.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from bim_ai.prd_tracker_reconciliation_v1 import (
    _PRD_TO_WORKPACKAGES,
    COVERAGE_TOKENS,
    build_prd_tracker_reconciliation_manifest_v1,
    parse_prd_section_anchors_v1,
    parse_tracker_workpackages_v1,
)

_TRACKER_PATH = Path(__file__).resolve().parents[2] / "spec" / "revit-production-parity-workpackage-tracker.md"
pytestmark = pytest.mark.skipif(
    not _TRACKER_PATH.exists(),
    reason="spec/revit-production-parity-workpackage-tracker.md was deleted (superseded by workpackage-master-tracker.md)",
)

# Section number prefixes that require tracker coverage per the prompt spec.
_REQUIRED_SECTION_PREFIXES = (
    "5_",
    "6_",
    "7_",
    "8_",
    "9_",
    "11_",
    "12_",
    "13_",
    "15_",
)

# ── Determinism ───────────────────────────────────────────────────────────────


def test_manifest_is_deterministic() -> None:
    a = build_prd_tracker_reconciliation_manifest_v1()
    b = build_prd_tracker_reconciliation_manifest_v1()
    assert a == b


def test_manifest_json_is_byte_identical() -> None:
    a = build_prd_tracker_reconciliation_manifest_v1()
    b = build_prd_tracker_reconciliation_manifest_v1()
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def test_manifest_digest_is_sha256() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    dig = m.get("prdTrackerReconciliationDigestSha256")
    assert isinstance(dig, str) and len(dig) == 64, f"expected 64-char hex digest, got {dig!r}"


def test_manifest_digest_stable_across_calls() -> None:
    a = build_prd_tracker_reconciliation_manifest_v1()
    b = build_prd_tracker_reconciliation_manifest_v1()
    assert (
        a["prdTrackerReconciliationDigestSha256"] == b["prdTrackerReconciliationDigestSha256"]
    )


# ── Schema shape ──────────────────────────────────────────────────────────────


def test_manifest_has_required_top_level_keys() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    for key in (
        "format",
        "schemaVersion",
        "reconciliationRows",
        "staleTrackerRows",
        "coverageCounts",
        "allowedCoverageTokens",
        "prdTrackerReconciliationDigestSha256",
    ):
        assert key in m, f"manifest missing key: {key!r}"


def test_manifest_format_is_correct() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    assert m["format"] == "prdTrackerReconciliationManifest_v1"


def test_manifest_schema_version_is_1() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    assert m["schemaVersion"] == 1


# ── Reconciliation rows ───────────────────────────────────────────────────────


def test_reconciliation_rows_is_non_empty_list() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    assert isinstance(m["reconciliationRows"], list) and m["reconciliationRows"]


def test_rows_sorted_by_section_id() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    ids = [r["prdSectionId"] for r in m["reconciliationRows"]]
    assert ids == sorted(ids), f"rows not sorted; got order: {ids}"


def test_rows_section_ids_unique() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    ids = [r["prdSectionId"] for r in m["reconciliationRows"]]
    duplicates = [x for x in ids if ids.count(x) > 1]
    assert not duplicates, f"duplicate prdSectionIds: {duplicates}"


def test_every_row_has_required_fields() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    for row in m["reconciliationRows"]:
        sid = row.get("prdSectionId")
        assert sid, f"row missing prdSectionId: {row!r}"
        assert isinstance(row.get("prdSectionTitle"), str), f"{sid}: missing prdSectionTitle"
        assert row.get("prdSectionLevel") in (2, 3), f"{sid}: prdSectionLevel must be 2 or 3"
        assert isinstance(row.get("workpackageIds"), list), f"{sid}: workpackageIds must be list"
        assert "coverage" in row, f"{sid}: missing coverage"


def test_every_row_coverage_token_is_valid() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    for row in m["reconciliationRows"]:
        sid = row["prdSectionId"]
        token = row["coverage"]
        assert token in COVERAGE_TOKENS, (
            f"{sid}: invalid coverage token {token!r}; allowed: {sorted(COVERAGE_TOKENS)}"
        )


def test_coverage_counts_sum_to_total_rows() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    total = sum(m["coverageCounts"].values())
    assert total == len(m["reconciliationRows"]), (
        f"coverageCounts sum {total} != len(rows) {len(m['reconciliationRows'])}"
    )


def test_covered_rows_have_all_done_workpackages() -> None:
    from bim_ai.prd_tracker_reconciliation_v1 import _TRACKER_PATH

    tracker_rows = parse_tracker_workpackages_v1(_TRACKER_PATH)
    state_by_wp = {row.id: row.state for row in tracker_rows}

    m = build_prd_tracker_reconciliation_manifest_v1()
    for row in m["reconciliationRows"]:
        if row["coverage"] == "covered":
            for wp_id in row["workpackageIds"]:
                assert state_by_wp.get(wp_id) == "done", (
                    f"covered row {row['prdSectionId']!r}: WP {wp_id!r} state is "
                    f"{state_by_wp.get(wp_id)!r}, expected 'done'"
                )


# ── Required section coverage (§5/§6/§7/§8/§9/§11/§12/§13/§15) ─────────────


def test_required_sections_have_workpackage_or_deferred() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    rows_by_id = {r["prdSectionId"]: r for r in m["reconciliationRows"]}

    failures: list[str] = []
    for sid, row in rows_by_id.items():
        if not any(sid.startswith(prefix) for prefix in _REQUIRED_SECTION_PREFIXES):
            continue
        coverage = row["coverage"]
        if coverage == "orphan":
            failures.append(
                f"{sid!r}: coverage=orphan (no workpackages and not deferred)"
            )

    assert not failures, (
        "Required PRD sections (§5/§6/§7/§8/§9/§11/§12/§13/§15) must have "
        "at least one workpackage or deferred coverage:\n"
        + "\n".join(failures)
    )


def test_required_section_prefixes_all_present_in_rows() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    ids = {r["prdSectionId"] for r in m["reconciliationRows"]}
    for prefix in _REQUIRED_SECTION_PREFIXES:
        matches = [sid for sid in ids if sid.startswith(prefix)]
        assert matches, f"No reconciliation row found with prefix {prefix!r}"


# ── Tracker WP partition: every WP is either in mapping or staleTrackerRows ──


def test_every_tracker_wp_is_in_mapping_or_stale() -> None:
    from bim_ai.prd_tracker_reconciliation_v1 import _TRACKER_PATH

    tracker_rows = parse_tracker_workpackages_v1(_TRACKER_PATH)
    m = build_prd_tracker_reconciliation_manifest_v1()

    stale_ids = {r["workpackageId"] for r in m["staleTrackerRows"]}

    all_mapped_wp_ids: set[str] = set()
    for wp_list in _PRD_TO_WORKPACKAGES.values():
        all_mapped_wp_ids.update(wp_list)

    unaccounted: list[str] = []
    for row in tracker_rows:
        if row.id not in all_mapped_wp_ids and row.id not in stale_ids:
            unaccounted.append(row.id)

    assert not unaccounted, (
        f"Tracker WP IDs not in mapping or staleTrackerRows: {unaccounted}"
    )


def test_stale_tracker_rows_sorted_by_workpackage_id() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    ids = [r["workpackageId"] for r in m["staleTrackerRows"]]
    assert ids == sorted(ids), f"staleTrackerRows not sorted; got {ids}"


def test_stale_tracker_rows_have_required_fields() -> None:
    m = build_prd_tracker_reconciliation_manifest_v1()
    for row in m["staleTrackerRows"]:
        assert "workpackageId" in row, f"stale row missing workpackageId: {row!r}"
        assert "title" in row, f"stale row missing title: {row!r}"
        assert "state" in row, f"stale row missing state: {row!r}"


def test_stale_tracker_rows_reference_real_tracker_ids() -> None:
    from bim_ai.prd_tracker_reconciliation_v1 import _TRACKER_PATH

    tracker_rows = parse_tracker_workpackages_v1(_TRACKER_PATH)
    known_ids = {row.id for row in tracker_rows}

    m = build_prd_tracker_reconciliation_manifest_v1()
    for stale in m["staleTrackerRows"]:
        assert stale["workpackageId"] in known_ids, (
            f"staleTrackerRows entry {stale['workpackageId']!r} not found in tracker"
        )


# ── Parser unit tests ─────────────────────────────────────────────────────────


def test_parse_prd_anchors_returns_sorted_list() -> None:
    from bim_ai.prd_tracker_reconciliation_v1 import _PRD_PATH

    anchors = parse_prd_section_anchors_v1(_PRD_PATH)
    assert anchors, "parse_prd_section_anchors_v1 must return non-empty list"
    ids = [a.sectionId for a in anchors]
    assert ids == sorted(ids), "anchors must be sorted by sectionId"


def test_parse_prd_anchors_levels_are_2_or_3() -> None:
    from bim_ai.prd_tracker_reconciliation_v1 import _PRD_PATH

    anchors = parse_prd_section_anchors_v1(_PRD_PATH)
    for anchor in anchors:
        assert anchor.level in (2, 3), f"{anchor.sectionId}: level must be 2 or 3"


def test_parse_tracker_workpackages_returns_wp_rows() -> None:
    from bim_ai.prd_tracker_reconciliation_v1 import _TRACKER_PATH

    rows = parse_tracker_workpackages_v1(_TRACKER_PATH)
    assert rows, "parse_tracker_workpackages_v1 must return non-empty list"
    for row in rows:
        assert row.id.startswith("WP-"), f"row id must start with 'WP-': {row.id!r}"


def test_parse_tracker_workpackages_states_are_valid() -> None:
    from bim_ai.prd_tracker_reconciliation_v1 import _TRACKER_PATH

    valid_states = {"done", "partial", "stub", "pending", "deferred"}
    rows = parse_tracker_workpackages_v1(_TRACKER_PATH)
    for row in rows:
        assert row.state in valid_states, (
            f"{row.id}: unexpected state {row.state!r}; allowed: {sorted(valid_states)}"
        )


def test_parse_prd_anchors_from_minimal_fixture(tmp_path: pytest.FixtureDef) -> None:
    prd = tmp_path / "prd.md"  # type: ignore[arg-type]
    prd.write_text(
        "# PRD\n"
        "## 5. Screenshot Requirements\n"
        "### 5.1 R1 — Exterior View\n"
        "## 6. Model Kernel\n",
        encoding="utf-8",
    )
    anchors = parse_prd_section_anchors_v1(prd)
    ids = [a.sectionId for a in anchors]
    assert "5_screenshot_requirements" in ids
    assert "5_1_r1_exterior_view" in ids
    assert "6_model_kernel" in ids
    assert ids == sorted(ids)


def test_parse_tracker_from_minimal_fixture(tmp_path: pytest.FixtureDef) -> None:
    tracker = tmp_path / "tracker.md"  # type: ignore[arg-type]
    tracker.write_text(
        "## Current Workpackages\n"
        "| ID     | Workpackage | State   | Maturity | Progress | Notes |\n"
        "| ------ | ----------- | ------- | -------- | -------- | ----- |\n"
        "| WP-001 | Tracker     | done    | 4 parity | 100%     |       |\n"
        "| WP-A01 | Golden ref  | partial | 2 usable | 40%      |       |\n"
        "\n"
        "## Next Section\n",
        encoding="utf-8",
    )
    rows = parse_tracker_workpackages_v1(tracker)
    assert len(rows) == 2
    assert rows[0].id == "WP-001" and rows[0].state == "done"
    assert rows[1].id == "WP-A01" and rows[1].state == "partial"


# ── Mapping dict sanity ───────────────────────────────────────────────────────


def test_mapping_has_entries_for_required_section_prefixes() -> None:
    for prefix in _REQUIRED_SECTION_PREFIXES:
        matches = [k for k in _PRD_TO_WORKPACKAGES if k.startswith(prefix)]
        assert matches, f"_PRD_TO_WORKPACKAGES has no key with prefix {prefix!r}"


def test_mapping_values_are_non_empty_lists() -> None:
    for sid, wp_list in _PRD_TO_WORKPACKAGES.items():
        assert isinstance(wp_list, list) and wp_list, (
            f"mapping[{sid!r}] must be a non-empty list"
        )


def test_mapping_wp_ids_start_with_wp_prefix() -> None:
    for sid, wp_list in _PRD_TO_WORKPACKAGES.items():
        for wp_id in wp_list:
            assert wp_id.startswith("WP-"), (
                f"mapping[{sid!r}] contains non-WP ID: {wp_id!r}"
            )
