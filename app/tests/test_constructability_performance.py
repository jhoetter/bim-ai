from __future__ import annotations

from bim_ai.constructability_performance import (
    constructability_broad_phase_stats_v1,
    impacted_constructability_pairs_v1,
)
from bim_ai.elements import AssetLibraryEntryElem, LevelElem, PlacedAssetElem, WallElem


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


def test_constructability_broad_phase_stats_report_pruned_pairs() -> None:
    stats = constructability_broad_phase_stats_v1(_elements())

    assert stats["format"] == "constructabilityBroadPhaseStats_v1"
    assert stats["physicalParticipantCount"] == 3
    assert stats["totalPossiblePairCount"] == 3
    assert stats["candidatePairCount"] == 1
    assert stats["prunedPairCount"] == 2
    assert stats["candidatePairs"] == [["shelf-1", "wall-1"]]


def test_impacted_constructability_pairs_filters_to_changed_elements() -> None:
    impacted = impacted_constructability_pairs_v1(
        _elements(),
        changed_element_ids={"wall-far", "shelf-1"},
    )

    assert impacted["format"] == "constructabilityImpactedPairs_v1"
    assert impacted["candidatePairCount"] == 1
    assert impacted["impactedPairCount"] == 1
    assert impacted["impactedPairs"] == [["shelf-1", "wall-1"]]
