from __future__ import annotations

import hashlib
import json

from bim_ai.ci_gate_runner import (
    constructability_ci_gate_rows_v1,
    summarize_ci_gate_run_v1,
    summarize_constructability_ci_gate_v1,
)
from bim_ai.elements import (
    AssetLibraryEntryElem,
    ConstructabilitySuppressionElem,
    Element,
    LevelElem,
    PlacedAssetElem,
    WallElem,
)

_SAMPLE_ROWS = [
    {"name": "ruff", "result": "ok"},
    {"name": "pytest", "result": "ok"},
    {"name": "typecheck", "result": "ok"},
    {"name": "vitest", "result": "ok"},
    {"name": "prettier", "result": "warn"},
    {"name": "evidence-package-probe", "result": "ok"},
]


def test_format_and_schema_version() -> None:
    s = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    assert s["format"] == "ciGateRunSummary_v1"
    assert s["schemaVersion"] == "v1"


def test_gates_count_matches_input() -> None:
    s = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    assert len(s["gates"]) == len(_SAMPLE_ROWS)


def test_gates_preserve_order() -> None:
    s = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    assert [r["name"] for r in s["gates"]] == [r["name"] for r in _SAMPLE_ROWS]


def test_verdict_pass_when_no_failures() -> None:
    s = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    assert s["verdict"] == "pass"


def test_warn_does_not_flip_verdict_to_fail() -> None:
    rows = [{"name": "prettier", "result": "warn"}]
    s = summarize_ci_gate_run_v1(rows)
    assert s["verdict"] == "pass"


def test_single_failed_gate_flips_verdict() -> None:
    for i, row in enumerate(_SAMPLE_ROWS):
        rows = [dict(r) for r in _SAMPLE_ROWS]
        rows[i] = {**rows[i], "result": "fail"}
        s = summarize_ci_gate_run_v1(rows)
        assert s["verdict"] == "fail", f"gate '{row['name']}' fail did not flip verdict"


def test_digest_is_64_hex() -> None:
    s = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    dig = s["aggregateDigestSha256"]
    assert isinstance(dig, str) and len(dig) == 64
    assert all(c in "0123456789abcdef" for c in dig)


def test_digest_is_deterministic() -> None:
    a = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    b = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    assert a["aggregateDigestSha256"] == b["aggregateDigestSha256"]


def test_digest_matches_canonical_gates_json() -> None:
    s = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    canonical = json.dumps(s["gates"], sort_keys=True, separators=(",", ":"))
    expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    assert s["aggregateDigestSha256"] == expected


def test_digest_changes_when_result_changes() -> None:
    rows_b = [dict(r) for r in _SAMPLE_ROWS]
    rows_b[0] = {**rows_b[0], "result": "fail"}
    sa = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    sb = summarize_ci_gate_run_v1(rows_b)
    assert sa["aggregateDigestSha256"] != sb["aggregateDigestSha256"]


def test_full_result_is_deterministic() -> None:
    a = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    b = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    assert a == b


def test_result_is_json_serialisable() -> None:
    s = summarize_ci_gate_run_v1(_SAMPLE_ROWS)
    loaded = json.loads(json.dumps(s))
    assert loaded["format"] == "ciGateRunSummary_v1"


def test_empty_rows_gives_pass_verdict() -> None:
    s = summarize_ci_gate_run_v1([])
    assert s["verdict"] == "pass"
    assert s["gates"] == []


def _constructability_elements(*, suppressed: bool = False) -> dict[str, Element]:
    elements: dict[str, Element] = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
        "asset-shelf": AssetLibraryEntryElem(
            kind="asset_library_entry",
            id="asset-shelf",
            assetKind="block_2d",
            name="Shelf",
            category="casework",
            tags=[],
            thumbnailKind="schematic_plan",
            thumbnailWidthMm=600,
            thumbnailHeightMm=300,
        ),
        "shelf-1": PlacedAssetElem(
            kind="placed_asset",
            id="shelf-1",
            name="Shelf",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 1200, "yMm": 0},
            paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
        ),
    }
    if suppressed:
        elements["supp-1"] = ConstructabilitySuppressionElem(
            kind="constructability_suppression",
            id="supp-1",
            ruleId="furniture_wall_hard_clash",
            elementIds=["shelf-1", "wall-1"],
            reason="Intentional recessed built-in approved by reviewer.",
        )
    return elements


def test_constructability_gate_rows_report_errors_without_failing_by_default() -> None:
    rows = constructability_ci_gate_rows_v1(
        _constructability_elements(),
        revision=1,
    )

    no_open_errors = next(row for row in rows if row["name"] == "constructability_no_open_errors")
    assert no_open_errors["result"] == "ok"
    assert no_open_errors["errorCount"] == 1


def test_constructability_gate_fails_when_fail_on_error_enabled() -> None:
    summary = summarize_constructability_ci_gate_v1(
        _constructability_elements(),
        revision=1,
        fail_on_constructability_error=True,
    )

    assert summary["verdict"] == "fail"
    row = next(
        gate for gate in summary["gates"] if gate["name"] == "constructability_no_open_errors"
    )
    assert row["result"] == "fail"
    assert row["errorCount"] == 1


def test_constructability_gate_passes_when_error_is_suppressed() -> None:
    summary = summarize_constructability_ci_gate_v1(
        _constructability_elements(suppressed=True),
        revision=1,
        fail_on_constructability_error=True,
    )

    assert summary["verdict"] == "pass"
    rows = {row["name"]: row for row in summary["gates"]}
    assert rows["constructability_no_open_errors"]["errorCount"] == 0
    assert rows["constructability_suppression_audit"]["suppressedFindingCount"] == 1
