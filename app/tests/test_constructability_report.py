from __future__ import annotations

from bim_ai.advisor_policy_registry import (
    learning_corpus_contract_payload,
    profile_presets_payload,
    review_workflow_payload,
    rule_policy_payload,
)
from bim_ai.constructability_report import (
    build_constructability_report,
    build_constructability_summary_v1,
)
from bim_ai.elements import (
    AssetLibraryEntryElem,
    ConstructabilityIssueElem,
    ConstructabilitySuppressionElem,
    DoorElem,
    FloorElem,
    LevelElem,
    PlacedAssetElem,
    RoofElem,
    RoomElem,
    RoomSeparationElem,
    StairElem,
    WallElem,
    WindowElem,
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
    assert report["summary"]["findingCount"] >= 1
    structure_scope = report["domainIntegrityScope_v1"]["sourceScopes"]["structure_mep_lite"]
    assert structure_scope["certification"] == "not_certified_structural_engineering"
    assert "certified structural engineering" in structure_scope["engineeringDisclaimer"]
    assert report["summary"]["ruleCounts"]["furniture_wall_hard_clash"] == 1
    finding = next(
        row for row in report["findings"] if row["ruleId"] == "furniture_wall_hard_clash"
    )
    assert finding["ruleId"] == "furniture_wall_hard_clash"
    assert finding["blockingClass"] == "geometry"
    assert finding["suppressibility"] == "ignorable"
    assert finding["layerOwner"] == "constructability_advisor"
    assert finding["profileMembership"]
    assert finding["audienceText"]["ui"]
    assert finding["rootCauseGroupId"].startswith("physical_coordination:")
    assert "recommendation" in finding
    assert finding["priority"] == "P1"
    assert finding["priorityPolicy"]["visibleImpactRank"] == 2
    assert finding["priorityRank"] < 1200
    assert finding["viewpointRef"].startswith("vp-constructability-")
    assert finding["evidenceRefs"] == [
        {"kind": "viewpoint", "viewpointId": finding["viewpointRef"]}
    ]
    command_hint = finding["safeCommandHints"][0]
    assert command_hint["safety"] == "context_only"
    assert command_hint["command"]["type"] == "saveViewpoint"
    assert command_hint["command"]["id"] == finding["viewpointRef"]
    assert command_hint["command"]["camera"]["target"]["zMm"] > 0
    assert command_hint["command"]["sectionBoxEnabled"] is True
    assert command_hint["command"]["sectionBoxMinMm"]["xMm"] <= 0
    assert command_hint["command"]["sectionBoxMaxMm"]["xMm"] >= 4000
    assert finding["viewpointEvidence"]["schemaVersion"] == "advisorFindingViewpointBridge_v1"
    assert finding["viewpointEvidence"]["viewId"] == finding["viewpointRef"]
    assert finding["viewpointEvidence"]["viewpointId"] == finding["viewpointRef"]
    assert finding["viewpointEvidence"]["elementIds"] == ["shelf-1", "wall-1"]
    assert finding["viewpointEvidence"]["camera"] == command_hint["command"]["camera"]
    assert finding["viewpointEvidence"]["sectionBoxMinMm"] == command_hint["command"]["sectionBoxMinMm"]
    assert finding["viewpointEvidence"]["sectionBoxMaxMm"] == command_hint["command"]["sectionBoxMaxMm"]
    assert finding["actionability"]["viewpointEvidence"] == finding["viewpointEvidence"]
    assert report["summary"]["priorityCounts"]["P1"] >= 1
    assert report["summary"]["rootCauseGroupCount"] >= 1
    assert any(
        group["primaryRuleId"] == "furniture_wall_hard_clash" for group in report["rootCauseGroups"]
    )
    assert report["profilePreset"]["id"]
    assert report["reviewWorkflow"]["schemaVersion"] == (
        "advisor.false-positive-review-workflow.v1"
    )
    assert report["learningCorpus"]["schemaVersion"] == "advisor.learning-corpus-hook.v1"
    assert report["issues"][0]["ruleId"] == "furniture_wall_hard_clash"
    assert report["issues"][0]["pairKey"] == "shelf-1::wall-1"
    assert report["issues"][0]["recommendation"] == finding["recommendation"]


def test_constructability_report_groups_by_root_cause_and_sorts_by_phase_priority() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "wall-existing": WallElem(
            kind="wall",
            id="wall-existing",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
        "wall-new": WallElem(
            kind="wall",
            id="wall-new",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 2000},
            end={"xMm": 4000, "yMm": 2000},
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
        "shelf-existing": PlacedAssetElem(
            kind="placed_asset",
            id="shelf-existing",
            name="Shelf Existing",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 1200, "yMm": 0},
            paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
        ),
        "shelf-new": PlacedAssetElem(
            kind="placed_asset",
            id="shelf-new",
            name="Shelf New",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 1200, "yMm": 2000},
            paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
            phaseCreated="new",
        ),
    }

    report = build_constructability_report(elements, revision=8)

    assert report["summary"]["ruleCounts"] == {"furniture_wall_hard_clash": 2}
    assert report["summary"]["rootCauseGroupCount"] == 2
    assert report["rootCauseGroups"][0]["family"] == "physical_coordination"
    assert report["rootCauseGroups"][0]["elementIds"] == ["shelf-new", "wall-new"]
    assert report["rootCauseGroups"][0]["findingCount"] == 1
    assert report["findings"][0]["elementIds"] == ["shelf-new", "wall-new"]
    assert report["findings"][0]["priorityPolicy"]["phaseOwnershipRank"] == 0
    assert report["findings"][1]["priorityPolicy"]["phaseOwnershipRank"] == 1


def test_advisor_policy_contracts_cover_profiles_audience_review_and_learning() -> None:
    presets = {preset["id"]: preset for preset in profile_presets_payload()}

    assert set(presets) == {
        "accessibility",
        "architecture",
        "construction_readiness",
        "exchange",
        "fire",
        "mep",
        "sketch_acceptance",
        "structure",
    }
    for preset in presets.values():
        assert preset["defaultSeverityFloor"]
        assert preset["disciplineFocus"]
        assert preset["ruleMembership"]

    policy = rule_policy_payload("physical_duplicate_geometry")
    assert policy["suppressibility"] == "review_required"
    assert policy["tolerancePolicy"] == {
        "requiresOwner": True,
        "requiresExpiry": True,
        "requiresEvidence": True,
    }
    assert set(policy["audienceText"]) == {"ui", "agent", "docs"}
    assert all(policy["audienceText"][key] for key in ("ui", "agent", "docs"))

    workflow = review_workflow_payload()
    assert workflow["requiredFieldsByClassification"]["accepted_tolerance"] == [
        "owner",
        "expiresRevision",
        "evidenceRefs",
        "reviewNote",
    ]

    corpus = learning_corpus_contract_payload()
    assert corpus["schemaVersion"] == "advisor.learning-corpus-hook.v1"
    assert "false_positive" in corpus["allowedLabels"]
    assert {"ruleId", "classification", "evidenceRefs"} <= set(corpus["fixtureKeyFields"])
    assert {row["classification"] for row in corpus["seedFixtures"]} >= {
        "true_positive",
        "false_positive",
        "profile_mismatch",
    }
    assert all(row["fixtureKey"] and row["evidenceRefs"] for row in corpus["seedFixtures"])


def test_constructability_report_omits_open_separator_only_room_access_signal() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "room-a": RoomElem(
            kind="room",
            id="room-a",
            name="Living",
            levelId="lvl-1",
            outlineMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 2000, "yMm": 0},
                {"xMm": 2000, "yMm": 2000},
                {"xMm": 0, "yMm": 2000},
            ],
            programmeCode="living",
            department="Residential",
            functionLabel="Living",
            finishSet="standard",
            targetAreaM2=4.0,
            props={
                "roomBimIntent": {
                    "number": "A",
                    "occupancyUse": "living",
                    "areaSource": "authored_outline_area_m2",
                    "boundingStatus": "bounded_with_open_plan_edge",
                    "classification": {"ifcEntityIntent": "IfcSpace"},
                }
            },
        ),
        "room-b": RoomElem(
            kind="room",
            id="room-b",
            name="Dining",
            levelId="lvl-1",
            outlineMm=[
                {"xMm": 2000, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 2000},
                {"xMm": 2000, "yMm": 2000},
            ],
            programmeCode="dining",
            department="Residential",
            functionLabel="Dining",
            finishSet="standard",
            targetAreaM2=4.0,
            props={
                "roomBimIntent": {
                    "number": "B",
                    "occupancyUse": "dining",
                    "areaSource": "authored_outline_area_m2",
                    "boundingStatus": "bounded_with_open_plan_edge",
                    "classification": {"ifcEntityIntent": "IfcSpace"},
                }
            },
        ),
        "sep": RoomSeparationElem(
            kind="room_separation",
            id="sep",
            levelId="lvl-1",
            start={"xMm": 2000, "yMm": 0},
            end={"xMm": 2000, "yMm": 2000},
        ),
    }

    report = build_constructability_report(elements, revision=7, profile="construction_readiness")

    assert "room_access_open_separator_only_access" not in {
        finding["ruleId"] for finding in report["findings"]
    }


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


def test_constructability_report_uses_persisted_issue_elements() -> None:
    initial_elements = {
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
    first_report = build_constructability_report(initial_elements, revision="r1")
    issue = first_report["issues"][0]
    persisted = ConstructabilityIssueElem.model_validate(
        {
            "kind": "constructability_issue",
            "id": "ci-1",
            **issue,
            "status": "approved",
            "resolutionComment": "Reviewed as intentional built-in recess.",
        }
    )

    second_report = build_constructability_report(
        {**initial_elements, "ci-1": persisted},
        revision="r2",
    )

    assert second_report["issues"][0]["status"] == "approved"
    assert second_report["issues"][0]["firstSeenRevision"] == "r1"
    assert second_report["issues"][0]["lastSeenRevision"] == "r2"
    assert second_report["issues"][0]["resolutionComment"] == (
        "Reviewed as intentional built-in recess."
    )


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
    assert report["issues"][0]["suppression"]["policy"]["suppressibility"] == "ignorable"


def test_constructability_report_enforces_review_required_tolerance_policy() -> None:
    base_elements = {
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
        "wall-2": WallElem(
            kind="wall",
            id="wall-2",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
    }
    incomplete_suppression = ConstructabilitySuppressionElem(
        kind="constructability_suppression",
        id="supp-incomplete",
        ruleId="physical_duplicate_geometry",
        elementIds=["wall-1", "wall-2"],
        reason="Temporary duplicate during import cleanup.",
    )

    incomplete_report = build_constructability_report(
        {**base_elements, "supp-incomplete": incomplete_suppression},
        revision=7,
    )

    assert incomplete_report["summary"]["ruleCounts"]["physical_duplicate_geometry"] == 1
    assert incomplete_report["summary"]["suppressedFindingCount"] == 0
    invalid = incomplete_report["suppressionAudit"]["invalidRecords"][0]
    assert invalid["reason"] == "tolerance_policy_incomplete"
    assert invalid["missing"] == ["owner", "expiresRevision", "evidenceRefs"]

    complete_suppression = ConstructabilitySuppressionElem(
        kind="constructability_suppression",
        id="supp-complete",
        ruleId="physical_duplicate_geometry",
        elementIds=["wall-1", "wall-2"],
        reason="Temporary duplicate retained for reviewed import comparison.",
        owner="qa@example.com",
        expiresRevision=9,
        evidenceRefs=[{"kind": "viewpoint", "viewpointId": "vp-dup"}],
        reviewClassification="accepted_tolerance",
    )
    complete_report = build_constructability_report(
        {**base_elements, "supp-complete": complete_suppression},
        revision=7,
    )

    assert "physical_duplicate_geometry" not in complete_report["summary"]["ruleCounts"]
    assert complete_report["summary"]["suppressedFindingCount"] == 1
    assert complete_report["suppressionAudit"]["invalidRecords"] == []
    suppressed_issue = next(
        issue for issue in complete_report["issues"] if issue["status"] == "suppressed"
    )
    assert suppressed_issue["suppression"]["owner"] == "qa@example.com"


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

    assert (
        "constructability_metadata_requirement_missing"
        not in authoring_report["summary"]["ruleCounts"]
    )
    assert readiness_report["summary"]["ruleCounts"] == {
        "constructability_metadata_requirement_missing": 1
    }
    finding = readiness_report["findings"][0]
    assert finding["blockingClass"] == "metadata"
    assert finding["severity"] == "warning"
    assert finding["severityPolicy"] == "profile_metadata_warning"
    assert "Pset_WallCommon.FireRating" in finding["message"]
    assert "structuralMaterialKey" in finding["message"]
    assert resolved_report["summary"]["ruleCounts"] == {}


def test_constructability_readiness_reports_opening_floor_and_roof_metadata_requirements() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 5000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
        "door-egress": DoorElem(
            kind="door",
            id="door-egress",
            wallId="wall-1",
            alongT=0.35,
            widthMm=1000,
            props={"egressDoor": True, "fireDoor": True},
        ),
        "window-egress": WindowElem(
            kind="window",
            id="window-egress",
            wallId="wall-1",
            alongT=0.7,
            widthMm=1200,
            heightMm=1200,
            props={"egressWindow": True},
        ),
        "floor-structural": FloorElem(
            kind="floor",
            id="floor-structural",
            levelId="lvl-1",
            boundaryMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
            props={"requiresStructuralMetadata": True},
        ),
        "roof-flat": RoofElem(
            kind="roof",
            id="roof-flat",
            referenceLevelId="lvl-1",
            footprintMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
            slopeDeg=1.0,
            props={"primaryEnvelope": True},
        ),
    }

    report = build_constructability_report(elements, revision=14, profile="permit_readiness")

    metadata_findings = [
        finding
        for finding in report["findings"]
        if finding["ruleId"] == "constructability_metadata_requirement_missing"
    ]
    assert {finding["elementIds"][0] for finding in metadata_findings} == {
        "door-egress",
        "floor-structural",
        "roof-flat",
        "window-egress",
    }
    messages = "\n".join(finding["message"] for finding in metadata_findings)
    assert "Pset_DoorCommon.FireRating" in messages
    assert "egressClearWidthMm" in messages
    assert "egressClearOpeningAreaM2" in messages
    assert "structuralSystem" in messages
    assert "roofDrainageDesigned" in messages


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

    assert "furniture_wall_clearance_conflict" not in authoring_report["summary"]["ruleCounts"]
    assert readiness_report["summary"]["ruleCounts"] == {"furniture_wall_clearance_conflict": 1}
    assert readiness_report["findings"][0]["severity"] == "error"
    assert clear_report["summary"]["ruleCounts"] == {}


def test_constructability_maintenance_clearance_uses_element_requirement() -> None:
    elements = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0.0),
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
        "service-panel": PlacedAssetElem(
            kind="placed_asset",
            id="service-panel",
            name="Service panel",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 0, "yMm": 0},
            paramValues={
                "widthMm": 600,
                "depthMm": 300,
                "proxyHeightMm": 900,
                "maintenanceClearanceMm": 900,
            },
        ),
        "cart": PlacedAssetElem(
            kind="placed_asset",
            id="cart",
            name="Cart",
            assetId="asset-shelf",
            levelId="lvl-1",
            positionMm={"xMm": 0, "yMm": 1000},
            paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
        ),
    }

    authoring_report = build_constructability_report(elements, revision=16)
    readiness_report = build_constructability_report(
        elements,
        revision=16,
        profile="construction_readiness",
    )

    assert "maintenance_clearance_conflict" not in authoring_report["summary"]["ruleCounts"]
    assert readiness_report["summary"]["ruleCounts"]["maintenance_clearance_conflict"] == 1
