from __future__ import annotations

from bim_ai.constructability_bcf import build_constructability_bcf_export
from bim_ai.elements import (
    AssetLibraryEntryElem,
    ConstructabilitySuppressionElem,
    LevelElem,
    PlacedAssetElem,
    WallElem,
)


def test_constructability_bcf_export_turns_findings_into_topics_with_viewpoints() -> None:
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

    export = build_constructability_bcf_export(elements, revision=3)

    assert export["format"] == "constructabilityBcfExport_v1"
    assert export["topicCount"] == 1
    assert export["viewpointCount"] == 1
    topic = export["topics"][0]
    viewpoint = export["viewpoints"][0]
    assert topic["topicKind"] == "bcf"
    assert topic["violationRuleIds"] == ["furniture_wall_hard_clash"]
    assert topic["elementIds"] == ["shelf-1", "wall-1"]
    assert topic["viewpointRef"] == viewpoint["viewpointId"]
    assert topic["evidenceRefs"] == [{"kind": "viewpoint", "viewpointId": viewpoint["viewpointId"]}]
    assert viewpoint["bboxMm"]["minX"] <= 900
    assert viewpoint["bboxMm"]["maxX"] >= 4000
    assert viewpoint["camera"]["target"]["zMm"] > 0


def test_constructability_bcf_export_skips_suppressed_findings() -> None:
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

    export = build_constructability_bcf_export(elements, revision=3)

    assert export["topicCount"] == 0
    assert export["viewpointCount"] == 0
