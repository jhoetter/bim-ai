from __future__ import annotations

from bim_ai.constraints_core import Violation
from bim_ai.document import Document
from bim_ai.elements import AssetLibraryEntryElem, DoorElem, FloorElem, LevelElem, Vec2Mm, WallElem
from bim_ai.engine import compute_delta_wire, try_commit, try_commit_bundle


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _base_doc() -> Document:
    level = LevelElem(id="lvl-1", name="Ground", elevationMm=0)
    floor = FloorElem(
        id="floor-1",
        levelId=level.id,
        boundaryMm=[_pt(0, 0), _pt(5000, 0), _pt(5000, 4000), _pt(0, 4000)],
    )
    wall = WallElem(
        id="wall-1",
        name="Interior wall",
        levelId=level.id,
        start=_pt(1000, 1000),
        end=_pt(4000, 1000),
        thicknessMm=200,
        heightMm=2800,
    )
    return Document(elements={level.id: level, floor.id: floor, wall.id: wall})


def _rule_ids(violations: list[Violation]) -> set[str]:
    return {v.rule_id for v in violations}


def test_single_command_commit_rejects_physical_helper_wall_before_persisting() -> None:
    ok, new_doc, _cmd, violations, code = try_commit(
        _base_doc(),
        {
            "type": "set_element_prop",
            "elementId": "wall-1",
            "key": "helper",
            "value": True,
        },
    )

    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert "physical_access_proxy_leakage" in _rule_ids(violations)


def test_bundle_commit_rejects_helper_hosted_physical_door() -> None:
    commands = [
        {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0},
        {
            "type": "createFloor",
            "id": "floor-1",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
        },
        {
            "type": "createWall",
            "id": "wall-1",
            "name": "Interior wall",
            "levelId": "lvl-1",
            "start": {"xMm": 1000, "yMm": 1000},
            "end": {"xMm": 4000, "yMm": 1000},
            "heightMm": 2800,
            "thicknessMm": 200,
        },
        {"type": "set_element_prop", "elementId": "wall-1", "key": "helper", "value": True},
        {
            "type": "insertDoorOnWall",
            "id": "door-1",
            "wallId": "wall-1",
            "alongT": 0.5,
            "widthMm": 900,
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(Document(elements={}), commands)

    rule_ids = _rule_ids(violations)
    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert "physical_access_proxy_leakage" in rule_ids
    assert "hosted_opening_helper_host" in rule_ids


def test_bundle_commit_rejects_hosted_opening_missing_semantic_cut() -> None:
    commands = [
        {
            "type": "insertDoorOnWall",
            "id": "door-no-cut",
            "wallId": "wall-1",
            "alongT": 0.5,
            "widthMm": 900,
        },
        {
            "type": "set_element_prop",
            "elementId": "door-no-cut",
            "key": "disableHostCut",
            "value": True,
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(_base_doc(), commands)
    violation = next(v for v in violations if v.rule_id == "hosted_opening_missing_semantic_cut")
    payload = violation.model_dump(by_alias=True)

    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert payload["hostIds"] == ["wall-1"]
    assert payload["trackerItems"] == ["BIR-B01", "BIR-C04"]
    assert payload["recommendation"]


def test_bundle_commit_rejects_overlapping_hosted_openings_with_graph_metadata() -> None:
    doc = _base_doc()
    doc.elements["door-existing"] = DoorElem(
        id="door-existing",
        wallId="wall-1",
        alongT=0.45,
        widthMm=900,
    )

    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        doc,
        [
            {
                "type": "insertWindowOnWall",
                "id": "window-overlap",
                "wallId": "wall-1",
                "alongT": 0.55,
                "widthMm": 900,
            }
        ],
    )
    violation = next(v for v in violations if v.rule_id == "hosted_opening_overlap")
    payload = violation.model_dump(by_alias=True)

    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert payload["hostIds"] == ["wall-1"]
    assert payload["trackerItems"] == ["BIR-B01", "BIR-C06"]
    assert payload["safeFixHints"] == [
        {"kind": "resize_reposition_or_merge_openings", "safety": "review_required"}
    ]


def test_bundle_commit_rejects_hosted_family_support_mismatch() -> None:
    commands = [
        {
            "type": "upsertFamilyType",
            "id": "ft-ceiling-hosted",
            "familyId": "fam-detector",
            "discipline": "generic",
            "hostSupport": "ceiling_hosted",
            "renderSupport": {"mode": "box"},
        },
        {
            "type": "placeFamilyInstance",
            "id": "family-detector",
            "familyTypeId": "ft-ceiling-hosted",
            "positionMm": {"xMm": 1200, "yMm": 1100},
            "hostElementId": "wall-1",
            "paramValues": {"renderProxyKind": "box"},
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(_base_doc(), commands)
    violation = next(v for v in violations if v.rule_id == "hosted_family_unsupported_host_class")
    payload = violation.model_dump(by_alias=True)

    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert payload["hostIds"] == ["wall-1"]
    assert payload["trackerItems"] == ["BIR-C07", "BIR-C08"]


def test_bundle_commit_rejects_physical_wall_outside_support_context() -> None:
    commands = [
        {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0},
        {
            "type": "createFloor",
            "id": "floor-1",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
        },
        {
            "type": "createWall",
            "id": "wall-outside",
            "levelId": "lvl-1",
            "start": {"xMm": 6000, "yMm": 1000},
            "end": {"xMm": 7000, "yMm": 1000},
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(Document(elements={}), commands)

    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    violation = next(v for v in violations if v.rule_id == "physical_wall_outside_envelope")
    assert violation.quick_fix_command == {
        "type": "set_element_prop",
        "elementId": "wall-outside",
        "key": "allowDetached",
        "value": True,
    }


def test_bundle_commit_allows_explicit_detached_intent() -> None:
    commands = [
        {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0},
        {
            "type": "createFloor",
            "id": "floor-1",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
        },
        {
            "type": "createWall",
            "id": "wall-detached",
            "levelId": "lvl-1",
            "start": {"xMm": 6000, "yMm": 1000},
            "end": {"xMm": 7000, "yMm": 1000},
            "allowDetached": True,
            "authoringIntent": "detached",
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(Document(elements={}), commands)

    assert ok
    assert new_doc is not None
    assert code == "ok"
    assert "physical_wall_outside_envelope" not in _rule_ids(violations)


def test_agent_authored_command_requires_explicit_context() -> None:
    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        _base_doc(),
        [
            {
                "type": "createWall",
                "id": "agent-wall",
                "agentAuthored": True,
                "levelId": "lvl-1",
                "start": {"xMm": 1200, "yMm": 1300},
                "end": {"xMm": 2400, "yMm": 1300},
            }
        ],
    )

    assert not ok
    assert new_doc is None
    assert code == "authoring_validation_error"
    violation = violations[0]
    assert violation.rule_id == "agent_authoring_explicit_context_required"
    assert violation.quick_fix_command is not None
    assert violation.quick_fix_command["type"] == "completeAgentAuthoringContext"
    assert set(violation.quick_fix_command["required"]) == {
        "physicalRole",
        "wallTypeId/materialKey",
    }
    payload = violation.model_dump(by_alias=True)
    assert payload["trackerItems"] == ["BIR-B06"]
    assert payload["safeFixHints"] == [
        {
            "kind": "complete_agent_authoring_context",
            "safety": "required_before_commit",
            "required": ["physicalRole", "wallTypeId/materialKey"],
        }
    ]


def test_agent_authored_family_instance_requires_explicit_support_context() -> None:
    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        _base_doc(),
        [
            {
                "type": "placeFamilyInstance",
                "id": "agent-family",
                "source": "agent",
                "familyTypeId": "ft-generic",
                "positionMm": {"xMm": 2500, "yMm": 2500},
                "physicalRole": "physical",
            }
        ],
    )

    assert not ok
    assert new_doc is None
    assert code == "authoring_validation_error"
    violation = violations[0]
    assert violation.rule_id == "agent_authoring_explicit_context_required"
    assert violation.quick_fix_command is not None
    assert violation.quick_fix_command["required"] == ["levelId/hostElementId/hostViewId"]


def test_agent_authored_command_rejects_invalid_physical_role_aliases() -> None:
    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        _base_doc(),
        [
            {
                "type": "createWall",
                "id": "agent-wall",
                "agentTrace": {"sourceCommandId": "cmd-1"},
                "levelId": "lvl-1",
                "start": {"xMm": 1200, "yMm": 1300},
                "end": {"xMm": 2400, "yMm": 1300},
                "materialKey": "gypsum_board",
                "physicalRole": "draft",
            }
        ],
    )

    assert not ok
    assert new_doc is None
    assert code == "authoring_validation_error"
    assert violations[0].quick_fix_command is not None
    assert violations[0].quick_fix_command["required"] == ["physicalRole=physical|analysis"]


def test_agent_authored_asset_requires_explicit_placement_support() -> None:
    doc = _base_doc()
    asset = AssetLibraryEntryElem(
        id="asset-chair",
        name="Chair",
        category="furniture",
        widthMm=500,
        depthMm=500,
        placementSupport="freestanding",
    )
    doc.elements[asset.id] = asset

    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        doc,
        [
            {
                "type": "PlaceAsset",
                "id": "chair-1",
                "agentAuthored": True,
                "assetId": asset.id,
                "levelId": "lvl-1",
                "positionMm": {"xMm": 2500, "yMm": 2500},
                "physicalRole": "physical",
            }
        ],
    )

    assert not ok
    assert new_doc is None
    assert code == "authoring_validation_error"
    violation = violations[0]
    assert violation.rule_id == "agent_authoring_explicit_context_required"
    assert "hostElementId/placementSupport" in violation.quick_fix_command["required"]


def test_bundle_commit_rejects_asset_floor_stair_and_railing_support_failures() -> None:
    commands = [
        {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0},
        {"type": "createLevel", "id": "lvl-2", "name": "Upper", "elevationMm": 3000},
        {
            "type": "createFloor",
            "id": "floor-1",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
        },
        {
            "type": "IndexAsset",
            "id": "asset-chair",
            "name": "Chair",
            "category": "furniture",
            "widthMm": 500,
            "depthMm": 500,
            "placementSupport": "freestanding",
        },
        {
            "type": "PlaceAsset",
            "id": "chair-floating",
            "assetId": "asset-chair",
            "levelId": "lvl-1",
            "positionMm": {"xMm": 9000, "yMm": 9000},
        },
        {
            "type": "createFloor",
            "id": "floor-upper-floating",
            "levelId": "lvl-2",
            "boundaryMm": [
                {"xMm": 7000, "yMm": 0},
                {"xMm": 8000, "yMm": 0},
                {"xMm": 8000, "yMm": 1000},
                {"xMm": 7000, "yMm": 1000},
            ],
        },
        {
            "type": "createStair",
            "id": "stair-detached",
            "baseLevelId": "lvl-1",
            "topLevelId": "lvl-2",
            "runStartMm": {"xMm": 9000, "yMm": 9000},
            "runEndMm": {"xMm": 9200, "yMm": 9200},
            "widthMm": 1000,
        },
        {
            "type": "createRailing",
            "id": "rail-detached",
            "pathMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(Document(elements={}), commands)
    rule_ids = _rule_ids(violations)

    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert "model_integrity_asset_placement_floating" in rule_ids
    assert "physical_floor_outside_support_context" in rule_ids
    assert "physical_stair_without_floor_landings" in rule_ids
    assert "physical_railing_missing_host_context" in rule_ids
    assert all(
        v.quick_fix_command
        for v in violations
        if v.rule_id
        in {
            "model_integrity_asset_placement_floating",
            "physical_floor_outside_support_context",
            "physical_stair_without_floor_landings",
            "physical_railing_missing_host_context",
        }
    )


def test_delta_wire_default_includes_commit_integrity_findings() -> None:
    before = _base_doc()
    after = before.model_copy(deep=True)
    wall = after.elements["wall-1"]
    after.elements["wall-1"] = wall.model_copy(update={"props": {"helper": True}})

    delta = compute_delta_wire(before, after)
    rule_ids = {row["ruleId"] for row in delta["violations"]}

    assert "physical_access_proxy_leakage" in rule_ids
