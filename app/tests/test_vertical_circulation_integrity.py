from __future__ import annotations

from bim_ai.elements import (
    BalusterPattern,
    FloorElem,
    HandrailSupport,
    LevelElem,
    RailingElem,
    StairElem,
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
    wall = _wall("W1", "L2", 5000, 1000, 5000, 3000)
    stair_railing = _railing("R1", hosted_stair_id="S1")
    terrace_guard = _railing("R2", hosted_stair_id=None, host_floor_id="T1")
    return {e.id: e for e in [l1, l2, f1, f2, terrace, stair, wall, stair_railing, terrace_guard]}


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
