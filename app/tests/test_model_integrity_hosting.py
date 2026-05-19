from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    AssetLibraryEntryElem,
    DoorElem,
    FamilyInstanceElem,
    FamilyTypeElem,
    FloorElem,
    LevelElem,
    PlacedAssetElem,
    RailingElem,
    StairElem,
    Vec2Mm,
    WallElem,
    WallOpeningElem,
    WindowElem,
)
from bim_ai.model_integrity_hosting import (
    hosted_opening_conflict_graph,
    hosted_opening_integrity_violations,
    physical_support_context_violations,
)


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _floor(id: str = "floor-1", *, level_id: str = "lvl-1") -> FloorElem:
    return FloorElem(
        id=id,
        levelId=level_id,
        boundaryMm=[_pt(0, 0), _pt(5000, 0), _pt(5000, 4000), _pt(0, 4000)],
    )


def _wall(
    id: str = "wall-1",
    *,
    level_id: str = "lvl-1",
    start: tuple[float, float] = (1000, 1000),
    end: tuple[float, float] = (4000, 1000),
    name: str = "Wall",
    props: dict[str, object] | None = None,
) -> WallElem:
    return WallElem(
        id=id,
        name=name,
        levelId=level_id,
        start=_pt(*start),
        end=_pt(*end),
        thicknessMm=200,
        heightMm=2800,
        props=props,
    )


def _doc(*elems: object) -> Document:
    base = {
        "lvl-1": LevelElem(id="lvl-1", name="Ground", elevationMm=0),
        "floor-1": _floor(),
    }
    base.update({elem.id: elem for elem in elems})  # type: ignore[attr-defined]
    return Document(elements=base)


def _rule_ids(doc: Document) -> list[str]:
    return [violation.rule_id for violation in hosted_opening_integrity_violations(doc)]


def test_valid_hosted_door_has_no_integrity_findings() -> None:
    wall = _wall()
    door = DoorElem(id="door-1", wallId=wall.id, alongT=0.5, widthMm=900)

    assert hosted_opening_integrity_violations(_doc(wall, door)) == []


def test_missing_and_wrong_kind_hosts_are_reported() -> None:
    missing = DoorElem(id="door-missing", wallId="missing-wall", alongT=0.5, widthMm=900)
    wrong = DoorElem(id="door-wrong", wallId="floor-1", alongT=0.5, widthMm=900)

    rule_ids = _rule_ids(_doc(missing, wrong))

    assert "hosted_opening_missing_host" in rule_ids
    assert "hosted_opening_host_not_wall" in rule_ids
    assert "hosted_render_proxy_orphan" in rule_ids


def test_helper_or_nonphysical_host_wall_is_not_accepted_as_real_wall() -> None:
    wall = _wall("helper-wall", name="Room graph helper wall", props={"helper": True})
    door = DoorElem(
        id="access-door-1",
        wallId=wall.id,
        alongT=0.5,
        widthMm=900,
        props={"repairSafeDelete": True},
    )

    violations = hosted_opening_integrity_violations(_doc(wall, door))

    assert any(v.rule_id == "hosted_opening_helper_host" for v in violations)
    assert any(v.rule_id == "physical_access_proxy_leakage" for v in violations)
    assert any(
        v.rule_id == "hosted_opening_helper_host"
        and v.quick_fix_command == {"type": "deleteElement", "elementId": door.id}
        for v in violations
    )


def test_host_wall_outside_level_floor_envelope_is_reported() -> None:
    wall = _wall("wall-outside", start=(6000, 1000), end=(7000, 1000))
    window = WindowElem(id="window-1", wallId=wall.id, alongT=0.5, widthMm=600)

    violations = hosted_opening_integrity_violations(_doc(wall, window))

    assert any(v.rule_id == "hosted_opening_host_outside_floor_envelope" for v in violations)
    assert any(v.rule_id == "physical_wall_outside_envelope" for v in violations)


def test_detached_intent_allows_outside_support_context() -> None:
    wall = _wall(
        "detached-wall",
        start=(6000, 1000),
        end=(7000, 1000),
        props={"allowDetached": True, "authoringIntent": "detached"},
    )
    window = WindowElem(id="window-detached", wallId=wall.id, alongT=0.5, widthMm=600)

    rule_ids = _rule_ids(_doc(wall, window))

    assert "physical_wall_outside_envelope" not in rule_ids
    assert "hosted_opening_host_outside_floor_envelope" not in rule_ids


def test_target_house_access_door_symptom_reports_error_even_when_host_resolves() -> None:
    floor = FloorElem(
        id="ground-base-floor",
        levelId="hf-lvl-ground",
        boundaryMm=[_pt(1000, 0), _pt(7000, 0), _pt(7000, 7000), _pt(1000, 7000)],
    )
    wall = WallElem(
        id="access-wall-hf-room-gf-bath-laundry",
        name="Bath / Laundry access control wall",
        levelId="hf-lvl-ground",
        start=_pt(7600, 1300),
        end=_pt(7600, 1900),
        thicknessMm=90,
        heightMm=2400,
        wallTypeId="wt-internal",
        materialKey="gypsum_board",
        loadBearing=False,
        structuralRole="non_load_bearing",
        analyticalParticipation=False,
    )
    door = DoorElem(
        id="access-door-hf-room-gf-bath-laundry",
        name="Bath / Laundry access door",
        wallId=wall.id,
        alongT=0.5,
        widthMm=500,
        familyTypeId="ft-pocket-door-standard",
    )
    doc = Document(
        elements={
            "hf-lvl-ground": LevelElem(id="hf-lvl-ground", name="Ground", elevationMm=0),
            floor.id: floor,
            wall.id: wall,
            door.id: door,
        }
    )

    violations = hosted_opening_integrity_violations(doc)
    rule_ids = {violation.rule_id for violation in violations}

    assert "hosted_opening_helper_host" in rule_ids
    assert "hosted_opening_host_outside_floor_envelope" in rule_ids
    assert "physical_access_proxy_leakage" in rule_ids
    assert all(
        violation.severity == "error"
        for violation in violations
        if violation.rule_id != "hosted_render_proxy_orphan"
    )


def test_opening_too_wide_or_near_endpoint_is_reported() -> None:
    wall = _wall(end=(1200, 1000))
    too_wide = DoorElem(id="too-wide", wallId=wall.id, alongT=0.5, widthMm=400)
    near_end = WindowElem(id="near-end", wallId=wall.id, alongT=0.2, widthMm=100)

    violations = hosted_opening_integrity_violations(_doc(wall, too_wide, near_end))

    by_id: dict[str, set[str]] = {}
    for violation in violations:
        for element_id in violation.element_ids:
            by_id.setdefault(element_id, set()).add(violation.rule_id)
    assert "hosted_opening_outside_usable_span" in by_id["too-wide"]
    assert "hosted_opening_outside_usable_span" in by_id["near-end"]
    assert any(
        v.rule_id == "hosted_opening_outside_usable_span"
        and v.quick_fix_command == {"type": "updateDoor", "id": "too-wide", "widthMm": 50}
        for v in violations
    )


def test_wall_opening_head_height_and_overlap_are_reported() -> None:
    wall = _wall()
    tall = WallOpeningElem(
        id="opening-tall",
        hostWallId=wall.id,
        alongTStart=0.2,
        alongTEnd=0.5,
        sillHeightMm=0,
        headHeightMm=3200,
    )
    overlapping = DoorElem(id="door-overlap", wallId=wall.id, alongT=0.45, widthMm=700)

    rule_ids = _rule_ids(_doc(wall, tall, overlapping))

    assert "hosted_opening_missing_semantic_cut" in rule_ids
    assert "hosted_opening_overlap" in rule_ids


def test_opening_conflict_graph_is_deterministic_for_overlap_and_clearance() -> None:
    wall = _wall()
    door = DoorElem(id="door-a", wallId=wall.id, alongT=0.5, widthMm=1200)
    window = WindowElem(id="window-b", wallId=wall.id, alongT=0.58, widthMm=900)
    near_end = WallOpeningElem(
        id="opening-near-end",
        hostWallId=wall.id,
        alongTStart=0.01,
        alongTEnd=0.04,
        sillHeightMm=0,
        headHeightMm=2100,
    )

    graph = hosted_opening_conflict_graph(_doc(wall, door, window, near_end))

    assert graph["format"] == "hostedOpeningConflictGraph_v1"
    assert [node["elementId"] for node in graph["nodes"]] == [
        "door-a",
        "opening-near-end",
        "window-b",
    ]
    assert graph["edges"] == [
        {
            "kind": "endpoint_clearance",
            "hostWallId": wall.id,
            "elementIds": ["opening-near-end", wall.id],
            "minimumClearanceMm": 75.0,
        },
        {
            "kind": "overlap",
            "hostWallId": wall.id,
            "elementIds": ["door-a", "window-b", wall.id],
            "overlapT": 0.27,
        },
    ]


def test_hosted_family_support_classification_flags_wrong_host_and_orphan_proxy() -> None:
    wall = _wall()
    family_type = FamilyTypeElem(
        id="ft-wall-hosted-sign",
        familyId="fam-sign",
        discipline="generic",
        parameters={"hostSupport": "wall_hosted"},
    )
    instance = FamilyInstanceElem(
        id="family-sign",
        familyTypeId=family_type.id,
        positionMm=_pt(1200, 1100),
        hostElementId="floor-1",
        paramValues={"renderProxyKind": "box"},
    )
    asset = PlacedAssetElem(
        id="asset-door-proxy",
        name="Door proxy asset",
        assetId="missing-asset",
        levelId="lvl-1",
        positionMm=_pt(1000, 1000),
        hostElementId="missing-wall",
        paramValues={"hostSupport": "wall_hosted"},
    )

    violations = hosted_opening_integrity_violations(_doc(wall, family_type, instance, asset))
    rule_ids = [v.rule_id for v in violations]

    assert "hosted_family_unsupported_host_class" in rule_ids
    assert "hosted_family_missing_host" in rule_ids
    assert "hosted_render_proxy_orphan" in rule_ids

def test_physical_support_context_flags_assets_floors_stairs_and_railings() -> None:
    level_2 = LevelElem(id="lvl-2", name="Upper", elevationMm=3000)
    upper_floor = FloorElem(
        id="floor-2",
        levelId="lvl-2",
        boundaryMm=[_pt(0, 0), _pt(5000, 0), _pt(5000, 4000), _pt(0, 4000)],
        props={"supportedByIds": ["wall-1"]},
    )
    asset_entry = AssetLibraryEntryElem(
        id="asset-chair",
        name="Chair",
        category="furniture",
        widthMm=500,
        depthMm=500,
        placementSupport="freestanding",
    )
    stair = StairElem(
        id="stair-detached",
        baseLevelId="lvl-1",
        topLevelId="lvl-2",
        runStartMm=_pt(7000, 7000),
        runEndMm=_pt(7500, 7500),
        widthMm=1000,
        boundaryMm=[_pt(6500, 6500), _pt(8000, 6500), _pt(8000, 8000), _pt(6500, 8000)],
        authoringMode="by_sketch",
        treadLines=[{"fromMm": _pt(6600, 6600), "toMm": _pt(7900, 6600)}],
        totalRiseMm=3000,
    )
    floating_asset = PlacedAssetElem(
        id="asset-floating",
        name="Floating chair",
        assetId=asset_entry.id,
        levelId="lvl-1",
        positionMm=_pt(9000, 9000),
    )
    asset_on_stair = PlacedAssetElem(
        id="asset-on-stair",
        name="Chair on stair",
        assetId=asset_entry.id,
        levelId="lvl-1",
        positionMm=_pt(7000, 7000),
    )
    detached_floor = FloorElem(
        id="floor-fragment",
        levelId="lvl-1",
        boundaryMm=[_pt(9000, 0), _pt(10000, 0), _pt(10000, 1000), _pt(9000, 1000)],
    )
    rail = RailingElem(
        id="rail-floating",
        pathMm=[_pt(0, 0), _pt(1000, 0)],
        guardHeightMm=1040,
    )

    doc = _doc(
        _wall(),
        level_2,
        upper_floor,
        asset_entry,
        stair,
        floating_asset,
        asset_on_stair,
        detached_floor,
        rail,
    )
    violations = physical_support_context_violations(doc)
    rule_ids = {violation.rule_id for violation in violations}

    assert "model_integrity_asset_placement_floating" in rule_ids
    assert "model_integrity_asset_placement_circulation_overlap" in rule_ids
    assert "physical_floor_outside_support_context" in rule_ids
    assert "physical_stair_without_floor_landings" in rule_ids
    assert "physical_railing_missing_host_context" in rule_ids
    assert all(violation.quick_fix_command for violation in violations)


def test_valid_non_wall_support_contexts_pass() -> None:
    level_2 = LevelElem(id="lvl-2", name="Upper", elevationMm=3000)
    upper_floor = FloorElem(
        id="floor-2",
        levelId="lvl-2",
        boundaryMm=[_pt(0, 0), _pt(5000, 0), _pt(5000, 4000), _pt(0, 4000)],
        props={"supportedByIds": ["wall-1"]},
    )
    asset_entry = AssetLibraryEntryElem(
        id="asset-chair",
        name="Chair",
        category="furniture",
        widthMm=500,
        depthMm=500,
        placementSupport="freestanding",
    )
    asset = PlacedAssetElem(
        id="asset-ok",
        name="Chair",
        assetId=asset_entry.id,
        levelId="lvl-1",
        positionMm=_pt(2500, 2500),
    )
    stair = StairElem(
        id="stair-ok",
        baseLevelId="lvl-1",
        topLevelId="lvl-2",
        runStartMm=_pt(1000, 1000),
        runEndMm=_pt(1200, 1200),
        widthMm=1000,
    )
    rail = RailingElem(
        id="rail-ok",
        hostedStairId=stair.id,
        pathMm=[_pt(1000, 500), _pt(1200, 700)],
        guardHeightMm=1040,
    )

    assert physical_support_context_violations(
        _doc(_wall(), level_2, upper_floor, asset_entry, asset, stair, rail)
    ) == []

