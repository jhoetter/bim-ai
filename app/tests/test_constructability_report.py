from __future__ import annotations

from bim_ai.constructability_report import build_constructability_report
from bim_ai.elements import (
    AssetLibraryEntryElem,
    ConstructabilitySuppressionElem,
    LevelElem,
    PlacedAssetElem,
    WallElem,
)


def test_constructability_report_filters_and_reconciles_findings() -> None:
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
