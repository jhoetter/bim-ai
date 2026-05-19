from __future__ import annotations

from bim_ai.constructability_performance import advisor_incremental_diagnostic_eligibility_v1
from bim_ai.constructability_report import build_constructability_report
from bim_ai.elements import AssetLibraryEntryElem, DoorElem, LevelElem, PlacedAssetElem, WallElem


def _elements() -> dict[str, object]:
    return {
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
        "wall-far": WallElem(
            kind="wall",
            id="wall-far",
            levelId="lvl-1",
            start={"xMm": 10000, "yMm": 0},
            end={"xMm": 12000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
        "door-1": DoorElem(kind="door", id="door-1", wallId="wall-1", alongT=0.5),
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


def test_incremental_diagnostic_eligibility_scopes_reference_and_pair_impact() -> None:
    eligibility = advisor_incremental_diagnostic_eligibility_v1(
        _elements(),
        changed_element_ids={"wall-1"},
    )

    assert eligibility["format"] == "advisorIncrementalDiagnosticEligibility_v1"
    assert eligibility["incrementalEligible"] is True
    assert eligibility["changedElementIds"] == ["wall-1"]
    assert "door-1" in eligibility["impactedElementIds"]
    assert "shelf-1" in eligibility["impactedElementIds"]
    assert "wall-far" not in eligibility["impactedElementIds"]
    assert eligibility["constructabilityPairImpact"]["impactedPairs"] == [["shelf-1", "wall-1"]]
    assert eligibility["diagnosticSchedulingPolicy"]["format"] == "diagnosticUiSchedulingPolicy_v1"
    assert eligibility["diagnosticSchedulingPolicy"]["inputProtection"] == {
        "maxSynchronousDiagnosticMs": 0,
        "overlayPointerEvents": "none",
        "preservePointerEvents": True,
        "preserveCameraControls": True,
        "preserveSelection": True,
    }
    assert (
        eligibility["backgroundExecutionPlan"]["format"] == "backgroundDiagnosticExecutionPlan_v1"
    )
    assert (
        eligibility["backgroundExecutionPlan"]["cachePolicy"]["reuseCleanRowsOutsideImpactedScope"]
        is True
    )
    task_modes = {row["runMode"] for row in eligibility["backgroundExecutionPlan"]["tasks"]}
    assert "incremental_background" in task_modes
    assert "deferred_full_scan" in task_modes


def test_incremental_diagnostic_full_scan_is_deferred_background_work() -> None:
    elements = _elements()
    eligibility = advisor_incremental_diagnostic_eligibility_v1(
        elements,
        changed_element_ids=set(elements),
    )

    assert eligibility["incrementalEligible"] is False
    assert eligibility["fullScanRequiredReason"] == "impacted_scope_covers_full_model"
    assert eligibility["diagnosticSchedulingPolicy"]["degradationLevel"] == "deferred"
    assert eligibility["diagnosticSchedulingPolicy"]["workPlans"]["advisor"]["runMode"] == (
        "defer_until_idle"
    )
    assert eligibility["backgroundExecutionPlan"]["cancellation"] == {
        "cancelOnNewRevision": True,
        "cancelOnChangedScopeSuperseded": True,
        "preserveLastGoodResults": True,
    }


def test_constructability_report_includes_rule_timing_and_incremental_metadata() -> None:
    report = build_constructability_report(
        _elements(),
        revision="rev-profile",
        profile="construction_readiness",
        changed_element_ids={"wall-1"},
    )
    profiling = report["profiling"]
    timings = {entry["checkId"]: entry for entry in profiling["ruleTimings"]}

    assert profiling["format"] == "advisorDiagnosticsProfile_v1"
    assert profiling["deterministicOrder"] is True
    assert profiling["incrementalEligibility"]["changedElementIds"] == ["wall-1"]
    assert profiling["summary"]["checkCount"] >= 9
    assert "advisor.evaluate_constructability_rules" in timings
    assert "constructability.clearance" in timings
    assert "model_integrity.constructability_errors" in timings
    assert "domain_integrity.room_access" in timings
    for entry in profiling["ruleTimings"]:
        assert entry["elapsedMs"] >= 0
        assert entry["candidateElementCount"] == len(_elements())
        assert isinstance(entry["findingCount"], int)
