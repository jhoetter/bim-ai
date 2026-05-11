from __future__ import annotations

from bim_ai.constructability_bcf import (
    build_constructability_bcf_export,
    constructability_issue_elements_from_bcf_topics,
)
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


def test_constructability_bcf_topics_import_as_persisted_issues() -> None:
    payload = {
        "format": "constructabilityBcfExport_v1",
        "topics": [
            {
                "topicId": "bcf-constructability-abc123",
                "title": "Furniture intersects wall.",
                "status": "approved",
                "elementIds": ["shelf-1", "wall-1"],
                "violationRuleIds": ["furniture_wall_hard_clash"],
                "constructabilityIssueFingerprint": "abc123def456",
                "severity": "error",
                "discipline": "coordination",
                "blockingClass": "geometry",
                "recommendation": "Move the shelf.",
                "message": "Shelf intersects wall.",
                "evidenceRefs": [{"kind": "viewpoint", "viewpointId": "vp-1"}],
            }
        ],
    }

    issues = constructability_issue_elements_from_bcf_topics(payload, revision="r7")

    assert len(issues) == 1
    issue = issues[0]
    assert issue.kind == "constructability_issue"
    assert issue.id == "ci-abc123def456"
    assert issue.fingerprint == "abc123def456"
    assert issue.rule_id == "furniture_wall_hard_clash"
    assert issue.status == "approved"
    assert issue.first_seen_revision == "r7"
    assert issue.last_seen_revision == "r7"
    assert issue.element_ids == ["shelf-1", "wall-1"]
    assert issue.evidence_refs[0].viewpoint_id == "vp-1"
