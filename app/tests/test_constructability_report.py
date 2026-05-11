from __future__ import annotations

from bim_ai.constructability_report import (
    build_constructability_report,
    build_constructability_summary_v1,
)
from bim_ai.elements import (
    AssetLibraryEntryElem,
    ConstructabilitySuppressionElem,
    LevelElem,
    PlacedAssetElem,
    StairElem,
    WallElem,
)


def test_constructability_report_filters_and_reconciles_findings() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Level 2", elevationMm=3000.0),
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

    report = build_constructability_report(elements, revision=7)

    assert report["format"] == "constructabilityReport_v1"
    assert report["revision"] == 7
    assert report["summary"]["findingCount"] == 1
    assert report["summary"]["ruleCounts"] == {"furniture_wall_hard_clash": 1}
    finding = report["findings"][0]
    assert finding["ruleId"] == "furniture_wall_hard_clash"
    assert finding["blockingClass"] == "geometry"
    assert "recommendation" in finding
    assert report["issues"][0]["ruleId"] == "furniture_wall_hard_clash"
    assert report["issues"][0]["pairKey"] == "shelf-1::wall-1"
    assert report["issues"][0]["recommendation"] == finding["recommendation"]


def test_constructability_report_marks_previous_issue_resolved() -> None:
    first = build_constructability_report({}, revision="r1")
    previous = [
        {
            "fingerprint": "abc",
            "ruleId": "physical_duplicate_geometry",
            "elementIds": ["a", "b"],
            "pairKey": "a::b",
            "status": "active",
            "firstSeenRevision": "r0",
            "lastSeenRevision": "r0",
            "resolvedRevision": None,
        }
    ]

    report = build_constructability_report({}, revision="r2", previous_issues=previous)

    assert first["summary"]["findingCount"] == 0
    assert report["issues"][0]["status"] == "resolved"
    assert report["issues"][0]["resolvedRevision"] == "r2"


def test_constructability_report_applies_scoped_suppression_records() -> None:
    elements = {
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
        "supp-1": ConstructabilitySuppressionElem(
            kind="constructability_suppression",
            id="supp-1",
            ruleId="furniture_wall_hard_clash",
            elementIds=["shelf-1", "wall-1"],
            reason="Intentional recessed built-in approved by reviewer.",
        ),
    }

    report = build_constructability_report(elements, revision=7)

    assert report["summary"]["findingCount"] == 0
    assert report["summary"]["suppressedFindingCount"] == 1
    assert report["summary"]["statusCounts"] == {"suppressed": 1}
    assert report["findings"] == []
    assert report["issues"][0]["status"] == "suppressed"
    assert report["issues"][0]["suppression"]["reason"] == (
        "Intentional recessed built-in approved by reviewer."
    )


def test_constructability_report_construction_readiness_promotes_serious_findings() -> None:
    elements = {
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

    report = build_constructability_report(elements, revision=7, profile="construction_readiness")

    assert report["profile"] == "construction_readiness"
    assert report["summary"]["severityCounts"] == {"error": 1}
    assert report["findings"][0]["severity"] == "error"
    assert report["findings"][0]["blocking"] is True
    assert report["issues"][0]["severity"] == "error"


def test_constructability_summary_reports_counts_coverage_and_open_errors() -> None:
    elements = {
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

    summary = build_constructability_summary_v1(elements, revision=9)

    assert summary["format"] == "constructabilitySummary_v1"
    assert summary["profileId"] == "construction_readiness"
    assert summary["modelRevision"] == 9
    assert summary["counts"]["error"] == 1
    assert summary["counts"]["warning"] == 0
    assert summary["coverage"] == {
        "physicalElements": 2,
        "proxySupported": 2,
        "proxyUnsupported": 0,
    }
    assert len(summary["openIssueIds"]) == 1
    assert summary["openErrorIssueIds"] == summary["openIssueIds"]


def test_constructability_report_respects_phase_filter_scope() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
            phaseCreated="new",
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

    all_phase_report = build_constructability_report(elements, revision=10)
    existing_report = build_constructability_report(
        elements,
        revision=10,
        phase_filter="existing",
    )

    assert all_phase_report["summary"]["ruleCounts"] == {"furniture_wall_hard_clash": 1}
    assert existing_report["summary"]["ruleCounts"] == {}
    assert existing_report["scope"]["phaseFilter"] == "existing"


def test_constructability_report_respects_design_option_scope() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
            optionSetId="scheme",
            optionId="option-b",
        ),
        "stair-1": StairElem(
            kind="stair",
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm={"xMm": 1200, "yMm": -600},
            runEndMm={"xMm": 1200, "yMm": 600},
            widthMm=1000,
            optionSetId="scheme",
            optionId="option-a",
        ),
    }
    design_option_sets = [
        {
            "id": "scheme",
            "options": [
                {"id": "option-a", "isPrimary": True},
                {"id": "option-b", "isPrimary": False},
            ],
        }
    ]

    unscoped_report = build_constructability_report(elements, revision=11)
    primary_option_report = build_constructability_report(
        elements,
        revision=11,
        design_option_sets=design_option_sets,
    )
    locked_option_report = build_constructability_report(
        elements,
        revision=11,
        option_locks={"scheme": "option-b"},
        design_option_sets=design_option_sets,
    )

    assert unscoped_report["summary"]["ruleCounts"] == {"stair_wall_hard_clash": 1}
    assert primary_option_report["summary"]["ruleCounts"] == {}
    assert primary_option_report["scope"]["primaryOptionIds"] == {"scheme": "option-a"}
    assert locked_option_report["summary"]["ruleCounts"] == {}
    assert locked_option_report["scope"]["optionLocks"] == {"scheme": "option-b"}


def test_constructability_readiness_reports_ids_like_metadata_requirements() -> None:
    wall = WallElem(
        kind="wall",
        id="wall-1",
        levelId="lvl-1",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 4000, "yMm": 0},
        thicknessMm=200,
        heightMm=3000,
        loadBearing=True,
        props={"primaryEnvelope": True},
    )
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "wall-1": wall,
    }

    authoring_report = build_constructability_report(elements, revision=12)
    readiness_report = build_constructability_report(
        elements,
        revision=12,
        profile="construction_readiness",
    )
    resolved_report = build_constructability_report(
        {
            **elements,
            "wall-1": wall.model_copy(
                update={
                    "props": {"primaryEnvelope": True, "fireRating": "REI 60"},
                    "structural_material_key": "timber",
                }
            ),
        },
        revision=13,
        profile="construction_readiness",
    )

    assert "constructability_metadata_requirement_missing" not in authoring_report[
        "summary"
    ]["ruleCounts"]
    assert readiness_report["summary"]["ruleCounts"] == {
        "constructability_metadata_requirement_missing": 1
    }
    finding = readiness_report["findings"][0]
    assert finding["blockingClass"] == "metadata"
    assert "Pset_WallCommon.FireRating" in finding["message"]
    assert "structuralMaterialKey" in finding["message"]
    assert resolved_report["summary"]["ruleCounts"] == {}


def test_constructability_clearance_rule_is_profile_enabled() -> None:
    elements = {
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
            positionMm={"xMm": 1200, "yMm": 400},
            paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
        ),
    }

    authoring_report = build_constructability_report(elements, revision=14)
    readiness_report = build_constructability_report(
        elements,
        revision=14,
        profile="construction_readiness",
    )
    clear_report = build_constructability_report(
        {
            **elements,
            "shelf-1": PlacedAssetElem(
                kind="placed_asset",
                id="shelf-1",
                name="Shelf",
                assetId="asset-shelf",
                levelId="lvl-1",
                positionMm={"xMm": 1200, "yMm": 900},
                paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
            ),
        },
        revision=15,
        profile="construction_readiness",
    )

    assert "furniture_wall_clearance_conflict" not in authoring_report["summary"][
        "ruleCounts"
    ]
    assert readiness_report["summary"]["ruleCounts"] == {
        "furniture_wall_clearance_conflict": 1
    }
    assert readiness_report["findings"][0]["severity"] == "error"
    assert clear_report["summary"]["ruleCounts"] == {}
