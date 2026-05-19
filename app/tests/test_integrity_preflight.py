from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    AssetLibraryEntryElem,
    DoorElem,
    FloorElem,
    LevelElem,
    PlacedAssetElem,
    Vec2Mm,
    WallElem,
)
from bim_ai.integrity_preflight import (
    build_integrity_preflight_report,
    build_multi_profile_comparison,
    build_source_command_index_from_transactions,
)


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _preflight_doc() -> Document:
    return Document(
        revision=7,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
            "door-orphan": DoorElem(
                kind="door",
                id="door-orphan",
                wallId="missing-wall",
                alongT=0.5,
                props={"repairSafeDelete": True},
            ),
        },
    )


def _profile_elements() -> dict[str, object]:
    return {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "floor-1": FloorElem(
            kind="floor",
            id="floor-1",
            levelId="lvl-1",
            boundaryMm=[_pt(0, 0), _pt(5000, 0), _pt(5000, 4000), _pt(0, 4000)],
        ),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            levelId="lvl-1",
            start=_pt(0, 0),
            end=_pt(4000, 0),
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


def test_integrity_preflight_payload_is_profile_independent_and_machine_readable() -> None:
    report = build_integrity_preflight_report(
        _preflight_doc(),
        revision=7,
        model_id="model-1",
        changed_element_ids=["door-orphan"],
    )

    rule_ids = {finding["ruleId"] for finding in report["findings"]}
    assert report["format"] == "integrityPreflightReport_v1"
    assert report["profileIndependent"] is True
    assert report["normalAdvisorSketchChecksIncluded"] is False
    assert report["summary"]["blockingFindingCount"] >= 1
    assert "model_integrity_unresolved_reference" in rule_ids
    assert "hosted_opening_missing_host" in rule_ids
    assert report["diagnostics"]["format"] == "advisorDiagnosticsProfile_v1"
    assert report["diagnostics"]["incrementalEligibility"]["changedElementIds"] == [
        "door-orphan"
    ]
    assert "digestSha256" in report


def test_integrity_preflight_links_findings_to_source_authoring_commands() -> None:
    source_command_index = build_source_command_index_from_transactions(
        [
            {
                "id": "txn-1",
                "revisionAfter": 7,
                "appliedCommands": [
                    {
                        "type": "insertDoorOnWall",
                        "id": "door-orphan",
                        "wallId": "missing-wall",
                        "sourceCommandId": "sketch-door-42",
                        "sourceRecipeRow": "recipe.csv:12",
                        "agentWave": "wave-18-e",
                    }
                ],
                "transactionMetadata": {"commit": "abc123"},
            }
        ]
    )

    report = build_integrity_preflight_report(
        _preflight_doc(),
        revision=7,
        model_id="model-1",
        source_command_index=source_command_index,
    )
    finding = next(
        row for row in report["findings"] if row["ruleId"] == "hosted_opening_missing_host"
    )

    assert report["provenance"]["format"] == "integrityPreflightProvenance_v1"
    assert report["provenance"]["sourceCommandLinkedFindingCount"] >= 1
    assert finding["sourceCommandIds"] == ["sketch-door-42"]
    assert finding["sourceCommands"][0]["affectedElementId"] == "door-orphan"
    assert finding["sourceCommands"][0]["sourceRecipeRow"] == "recipe.csv:12"


def test_integrity_remediation_loop_proposes_dry_runnable_fix_bundle() -> None:
    report = build_integrity_preflight_report(_preflight_doc(), revision=7, model_id="model-1")
    proposals = report["remediation"]["proposals"]

    assert report["remediation"]["format"] == "integrityRemediationLoop_v1"
    assert report["remediation"]["commitPolicy"]["requiresPassingDryRunEvidence"] is True
    assert proposals
    proposal = proposals[0]
    assert proposal["schemaVersion"] == "agentRemediationProposal_v1"
    assert proposal["dryRunRequired"] is True
    assert proposal["commands"] == [{"type": "deleteElement", "elementId": "door-orphan"}]
    assert proposal["dryRunRoute"] == "/api/models/{model_id}/commands/bundle/dry-run"
    assert proposal["commitRoute"] == "/api/models/{model_id}/commands/bundle"
    assert proposal["recaptureEvidence"]["expectedFormat"] == "integrityPreflightReport_v1"
    assert proposal["commitAllowedWithoutDryRun"] is False


def test_preflight_diagnostics_include_timing_skipped_and_incremental_metadata() -> None:
    report = build_integrity_preflight_report(
        _preflight_doc(),
        revision=7,
        changed_element_ids=["door-orphan"],
    )
    diagnostics = report["diagnostics"]
    timing_ids = {entry["checkId"] for entry in diagnostics["ruleTimings"]}
    skipped_ids = {entry["checkId"] for entry in diagnostics["skippedChecks"]}

    assert "model_integrity.invariants" in timing_ids
    assert "model_integrity.hosted_openings" in timing_ids
    assert "constructability.profile_rules" in skipped_ids
    assert "sketch.methodology_acceptance" in skipped_ids
    assert diagnostics["summary"]["skippedCheckCount"] == 2
    for entry in diagnostics["ruleTimings"]:
        assert entry["elapsedMs"] >= 0
        assert isinstance(entry["findingCount"], int)


def test_multi_profile_comparison_returns_profile_rows_and_rule_matrix() -> None:
    comparison = build_multi_profile_comparison(
        _profile_elements(),
        revision=8,
        profiles=["authoring_default", "construction_readiness", "fire", "mep"],
        changed_element_ids=["wall-1"],
    )

    assert comparison["format"] == "advisorMultiProfileComparison_v1"
    assert comparison["profiles"] == [
        "authoring_default",
        "construction_readiness",
        "fire",
        "mep",
    ]
    assert comparison["baselineProfile"] == "authoring_default"
    assert [row["profile"] for row in comparison["rows"]] == comparison["profiles"]
    assert comparison["summary"]["profileCount"] == 4
    assert all(row["diagnostics"]["format"] == "advisorDiagnosticsProfile_v1" for row in comparison["rows"])
    assert any(row["ruleId"] == "furniture_wall_hard_clash" for row in comparison["ruleMatrix"])
