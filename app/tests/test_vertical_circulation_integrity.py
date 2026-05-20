from __future__ import annotations

from bim_ai.elements import (
    BalusterPattern,
    CeilingElem,
    FloorElem,
    HandrailSupport,
    LevelElem,
    PlacedAssetElem,
    RailingElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    StairTreadLine,
    Vec2Mm,
    WallElem,
)
from bim_ai.vertical_circulation_integrity import check_vertical_circulation_integrity


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _floor(
    element_id: str,
    level_id: str,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    *,
    name: str = "Floor",
    props: dict | None = None,
) -> FloorElem:
    return FloorElem(
        id=element_id,
        name=name,
        levelId=level_id,
        boundaryMm=[_pt(x0, y0), _pt(x1, y0), _pt(x1, y1), _pt(x0, y1)],
        props=props,
    )


def _wall(element_id: str, level_id: str, x0: float, y0: float, x1: float, y1: float) -> WallElem:
    return WallElem(
        id=element_id,
        levelId=level_id,
        start=_pt(x0, y0),
        end=_pt(x1, y1),
    )


def _stair(element_id: str, start: Vec2Mm | None = None, end: Vec2Mm | None = None) -> StairElem:
    return StairElem(
        id=element_id,
        baseLevelId="L1",
        topLevelId="L2",
        runStartMm=start or _pt(900, 900),
        runEndMm=end or _pt(1400, 900),
        widthMm=1000,
    )


def _slab_opening(element_id: str = "O1", host_floor_id: str = "F2") -> SlabOpeningElem:
    return SlabOpeningElem(
        id=element_id,
        hostFloorId=host_floor_id,
        boundaryMm=[_pt(800, 300), _pt(1700, 300), _pt(1700, 1500), _pt(800, 1500)],
        isShaft=True,
    )


def _room(
    element_id: str,
    level_id: str,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    *,
    name: str = "Room",
    function_label: str = "Living",
) -> RoomElem:
    return RoomElem(
        id=element_id,
        levelId=level_id,
        name=name,
        outlineMm=[_pt(x0, y0), _pt(x1, y0), _pt(x1, y1), _pt(x0, y1)],
        functionLabel=function_label,
    )


def _railing(
    element_id: str = "R1",
    *,
    hosted_stair_id: str | None = "S1",
    host_floor_id: str | None = None,
    guard_height_mm: float = 1050,
    spacing_mm: float = 100,
    material_slots: dict[str, str | None] | None = None,
    supports: list[HandrailSupport] | None = None,
    props: dict | None = None,
) -> RailingElem:
    merged_props = dict(props or {})
    if host_floor_id is not None:
        merged_props["hostFloorId"] = host_floor_id
        merged_props["isExteriorGuard"] = True
    railing = RailingElem(
        id=element_id,
        hostedStairId=hosted_stair_id,
        pathMm=[_pt(0, 0), _pt(1000, 0)],
        guardHeightMm=guard_height_mm,
        balusterPattern=BalusterPattern(
            rule="regular",
            spacingMm=spacing_mm,
            profileFamilyId="baluster-round-25",
        ),
        handrailSupports=supports
        if supports is not None
        else [
            HandrailSupport(
                intervalMm=1200,
                bracketFamilyId="bracket-wall-01",
                hostWallId="W1",
            )
        ],
        materialSlots=material_slots
        if material_slots is not None
        else {"handrail": "steel", "post": "steel", "baluster": "steel"},
    )
    if merged_props:
        object.__setattr__(railing, "props", merged_props)
    return railing


def _clean_elements() -> dict[str, object]:
    l1 = LevelElem(id="L1", elevationMm=0)
    l2 = LevelElem(id="L2", elevationMm=3000)
    f1 = _floor("F1", "L1", 0, 0, 5000, 4000)
    f2 = _floor("F2", "L2", 0, 0, 5000, 4000, props={"supportedByIds": ["W1"]})
    terrace = _floor(
        "T1",
        "L2",
        5000,
        1000,
        6500,
        3000,
        name="Terrace",
        props={
            "exteriorSpaceType": "terrace",
            "supportedByIds": ["W1"],
            "drainageIntent": "scupper to roof drain",
            "accessIntent": "door D1",
            "boundaryIntent": "edge ids documented",
            "scheduleIntent": "Exterior occupied floor schedule",
        },
    )
    stair = _stair("S1")
    opening = _slab_opening("O1", "F2")
    wall = _wall("W1", "L2", 5000, 1000, 5000, 3000)
    stair_railing = _railing("R1", hosted_stair_id="S1")
    terrace_guard = _railing("R2", hosted_stair_id=None, host_floor_id="T1")
    return {
        e.id: e
        for e in [l1, l2, f1, f2, terrace, stair, opening, wall, stair_railing, terrace_guard]
    }


def _codes(elements: dict[str, object]) -> set[str]:
    return {finding["code"] for finding in check_vertical_circulation_integrity(elements)}


def test_clean_two_level_stair_and_terrace_has_no_findings() -> None:
    assert check_vertical_circulation_integrity(_clean_elements()) == []


def test_unsupported_elevated_slab_reports_support_intent_failure() -> None:
    elements = _clean_elements()
    elements["F2"] = _floor("F2", "L2", 0, 0, 5000, 4000)

    findings = check_vertical_circulation_integrity(elements)

    assert "unsupported_slab" in {finding["code"] for finding in findings}
    for finding in findings:
        assert {
            "ruleId",
            "code",
            "severity",
            "priority",
            "discipline",
            "perspective",
            "elementIds",
            "recommendation",
        }.issubset(finding)


def test_missing_stair_graph_connection_reports_endpoint_failure() -> None:
    elements = _clean_elements()
    elements["S1"] = _stair("S1", end=_pt(9000, 9000))

    assert "stair_graph_connection_missing" in _codes(elements)


def test_source_evidenced_existing_stair_tolerance_suppresses_comfort_proxy_findings() -> None:
    elements = _clean_elements()
    elements["S1"] = StairElem(
        id="S1",
        baseLevelId="L1",
        topLevelId="L2",
        runStartMm=_pt(900, 900),
        runEndMm=_pt(1400, 900),
        widthMm=1000,
        riserMm=183,
        treadMm=250,
        authoringMode="by_sketch",
        boundaryMm=[_pt(700, 700), _pt(1700, 700), _pt(1700, 1800), _pt(700, 1800)],
        treadLines=[
            StairTreadLine(fromMm=_pt(700, 700), toMm=_pt(1700, 700), riserHeightMm=183),
            StairTreadLine(fromMm=_pt(700, 900), toMm=_pt(1700, 900), riserHeightMm=183),
        ],
        totalRiseMm=3000,
        landings=[
            {
                "id": "landing-existing",
                "boundaryMm": [_pt(800, 800), _pt(1600, 800), _pt(1600, 1600), _pt(800, 1600)],
            }
        ],
        props={
            "existingConditionTolerance": {
                "accepted": True,
                "findingCodes": [
                    "stair_riser_tread_comfort_failure",
                    "stair_landing_too_small",
                    "stair_by_sketch_riser_too_high",
                ],
                "reason": "Existing stair dimensions are source-documented and retained as existing condition.",
                "sourceFactIds": ["leo-stair-eg-dg"],
            }
        },
    )

    codes = _codes(elements)

    assert "stair_riser_tread_comfort_failure" not in codes
    assert "stair_landing_too_small" not in codes
    assert "stair_by_sketch_riser_too_high" not in codes


def test_stair_without_hosted_guard_reports_stair_guardrail_gap() -> None:
    elements = _clean_elements()
    elements.pop("R1")

    assert "stair_guardrail_missing" in _codes(elements)


def test_missing_upper_slab_opening_reports_stair_penetration_failure() -> None:
    elements = _clean_elements()
    elements.pop("O1")

    assert "stair_missing_slab_opening" in _codes(elements)


def test_low_ceiling_over_stair_reports_headroom_conflict() -> None:
    elements = _clean_elements()
    elements["ceiling-low"] = CeilingElem(
        id="ceiling-low",
        levelId="L1",
        boundaryMm=[_pt(500, 300), _pt(1700, 300), _pt(1700, 1500), _pt(500, 1500)],
        heightOffsetMm=1800,
        thicknessMm=100,
    )

    assert "stair_headroom_clearance_conflict" in _codes(elements)


def test_by_sketch_stair_reports_landing_and_riser_metadata_failures() -> None:
    elements = _clean_elements()
    elements["S1"] = StairElem(
        id="S1",
        baseLevelId="L1",
        topLevelId="L2",
        runStartMm=_pt(900, 900),
        runEndMm=_pt(3900, 900),
        widthMm=1000,
        authoringMode="by_sketch",
        boundaryMm=[_pt(700, 300), _pt(4100, 300), _pt(4100, 1500), _pt(700, 1500)],
        treadLines=[
            StairTreadLine(fromMm=_pt(1200, 300), toMm=_pt(1200, 1500), riserHeightMm=220)
        ],
        totalRiseMm=3000,
    )
    elements["O1"] = SlabOpeningElem(
        id="O1",
        hostFloorId="F2",
        boundaryMm=[_pt(700, 300), _pt(4100, 300), _pt(4100, 1500), _pt(700, 1500)],
        isShaft=True,
    )
    elements["R1"] = _railing("R1", hosted_stair_id="S1", props=None)

    codes = _codes(elements)

    assert "stair_landing_missing" in codes
    assert "stair_by_sketch_riser_too_high" in codes


def test_slab_opening_outside_host_and_degenerate_boundary_are_reported() -> None:
    elements = _clean_elements()
    elements["O1"] = SlabOpeningElem(
        id="O1",
        hostFloorId="F2",
        boundaryMm=[_pt(4900, 100), _pt(5200, 100), _pt(5200, 100), _pt(4900, 100)],
    )

    codes = _codes(elements)

    assert "slab_opening_degenerate" in codes
    assert "slab_opening_outside_host" in codes


def test_invalid_stair_level_transition_is_reported() -> None:
    elements = _clean_elements()
    elements["S1"] = StairElem(
        id="S1",
        baseLevelId="L2",
        topLevelId="L1",
        runStartMm=_pt(900, 900),
        runEndMm=_pt(1400, 900),
        widthMm=1000,
    )

    assert "stair_level_transition_invalid" in _codes(elements)


def test_terrace_without_drainage_guard_access_metadata_reports_exterior_space_intent() -> None:
    elements = _clean_elements()
    elements.pop("R2")
    elements["T1"] = _floor(
        "T1",
        "L2",
        5000,
        1000,
        6500,
        3000,
        name="Loggia",
        props={
            "exteriorSpaceType": "loggia",
            "supportedByIds": ["W1"],
            "boundaryIntent": "edge ids documented",
            "scheduleIntent": "Exterior occupied floor schedule",
        },
    )

    findings = check_vertical_circulation_integrity(elements)

    exterior = [
        finding
        for finding in findings
        if finding["code"] == "occupied_exterior_space_metadata_missing"
    ]
    assert len(exterior) == 1
    assert "guard" in exterior[0]["message"]
    assert "drainage" in exterior[0]["message"]
    assert "access" in exterior[0]["message"]


def test_railing_bad_spacing_height_and_host_reports_profile_integrity() -> None:
    elements = _clean_elements()
    elements["R1"] = _railing(
        "R1",
        hosted_stair_id="missing-stair",
        guard_height_mm=820,
        spacing_mm=180,
        material_slots={"handrail": "steel"},
        supports=[
            HandrailSupport(
                intervalMm=1200,
                bracketFamilyId="bracket-wall-01",
                hostWallId="missing-wall",
            )
        ],
    )

    codes = _codes(elements)

    assert "railing_host_reference_unresolved" in codes
    assert "railing_guard_height_too_low" in codes
    assert "railing_baluster_spacing_too_wide" in codes
    assert "railing_handrail_support_host_invalid" in codes
    assert "railing_material_slots_missing" in codes


def test_hosted_stair_railing_short_path_reports_continuity_gap() -> None:
    elements = _clean_elements()
    elements["S1"] = _stair("S1", start=_pt(900, 900), end=_pt(3900, 900))
    elements["O1"] = SlabOpeningElem(
        id="O1",
        hostFloorId="F2",
        boundaryMm=[_pt(800, 300), _pt(4000, 300), _pt(4000, 1500), _pt(800, 1500)],
        isShaft=True,
    )
    elements["R1"] = _railing(
        "R1",
        hosted_stair_id="S1",
        supports=[
            HandrailSupport(
                intervalMm=1200,
                bracketFamilyId="bracket-wall-01",
                hostWallId="W1",
            )
        ],
    )

    assert "railing_stair_continuity_gap" in _codes(elements)


def test_bedroom_and_furniture_overlap_with_stair_are_reported() -> None:
    elements = _clean_elements()
    elements["bedroom-1"] = _room(
        "bedroom-1",
        "L1",
        500,
        200,
        1900,
        1800,
        name="Bedroom 1",
        function_label="Sleeping",
    )
    elements["chair-1"] = PlacedAssetElem(
        id="chair-1",
        name="Chair",
        assetId="chair-type",
        levelId="L1",
        positionMm=_pt(950, 900),
    )

    codes = _codes(elements)

    assert "stair_sleeping_room_overlap" in codes
    assert "stair_furniture_overlap" in codes


def test_detached_slab_fragment_reports_isolated_floor() -> None:
    elements = _clean_elements()
    elements["FRAG"] = _floor(
        "FRAG",
        "L2",
        20000,
        20000,
        21000,
        21000,
        props={"supportedByIds": ["W1"]},
    )

    assert "detached_slab_fragment" in _codes(elements)
