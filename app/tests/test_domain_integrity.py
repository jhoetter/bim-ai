from __future__ import annotations

from bim_ai.constructability_report import build_constructability_report
from bim_ai.domain_integrity import check_domain_integrity, domain_integrity_report
from bim_ai.elements import DoorElem, FloorElem, LevelElem, StairElem, Vec2Mm, WallElem


def _elements() -> dict[str, dict]:
    return {
        "lvl-1": {"kind": "level", "id": "lvl-1", "elevationMm": 0},
        "room-1": {
            "kind": "room",
            "id": "room-1",
            "name": "Room",
            "levelId": "lvl-1",
            "outlineMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 3000, "yMm": 0},
                {"xMm": 3000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
        },
        "zone-1": {
            "kind": "envelope_zone",
            "id": "zone-1",
            "levelId": "lvl-1",
            "unresolvedGapIds": ["gap-1"],
        },
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "levelId": "lvl-1",
            "props": {"fireSeparation": True},
        },
        "door-1": {
            "kind": "door",
            "id": "door-1",
            "wallId": "wall-1",
            "widthMm": 760,
            "props": {"accessibleDoor": True, "thresholdHeightMm": 35},
        },
        "pipe-1": {
            "kind": "pipe",
            "id": "pipe-1",
            "levelId": "lvl-1",
            "passesThroughElementIds": ["wall-1"],
        },
    }


def test_domain_integrity_normalizes_checker_findings() -> None:
    findings = check_domain_integrity(_elements(), profile="accessibility")
    rule_ids = {finding["ruleId"] for finding in findings}

    assert "room_access_missing_room_schedule_fields" in rule_ids
    assert "bir_f03_unresolved_envelope_gap" in rule_ids
    assert "mep_lite_route_penetration_opening_missing" in rule_ids
    assert "code_profile_accessible_door_width_insufficient" in rule_ids
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
            "source",
            "blockingClass",
        } <= set(finding)


def test_domain_integrity_preserves_vertical_circulation_tracker_metadata() -> None:
    elements = {
        "lvl-1": LevelElem(id="lvl-1", elevationMm=0),
        "lvl-2": LevelElem(id="lvl-2", elevationMm=3000),
        "wall-1": WallElem(
            id="wall-1",
            levelId="lvl-2",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=3000, yMm=0),
        ),
        "floor-1": FloorElem(
            id="floor-1",
            levelId="lvl-1",
            boundaryMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=4000, yMm=0),
                Vec2Mm(xMm=4000, yMm=3000),
                Vec2Mm(xMm=0, yMm=3000),
            ],
        ),
        "floor-2": FloorElem(
            id="floor-2",
            levelId="lvl-2",
            boundaryMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=4000, yMm=0),
                Vec2Mm(xMm=4000, yMm=3000),
                Vec2Mm(xMm=0, yMm=3000),
            ],
            props={"supportedByIds": ["wall-1"]},
        ),
        "stair-1": StairElem(
            id="stair-1",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm=Vec2Mm(xMm=800, yMm=800),
            runEndMm=Vec2Mm(xMm=1800, yMm=800),
            widthMm=1000,
        ),
    }

    findings = check_domain_integrity(elements)
    opening = next(finding for finding in findings if finding["ruleId"] == "BIR-E01")

    assert opening["code"] == "stair_missing_slab_opening"
    assert opening["severity"] == "error"
    assert opening["priority"] == "P0"
    assert opening["source"] == "vertical_circulation"
    assert opening["trackerItems"] == ["BIR-E01"]
    assert opening["recommendation"]


def test_domain_integrity_report_summarizes_sources_and_profile() -> None:
    report = domain_integrity_report(_elements(), profile="accessibility")

    assert report["format"] == "domainIntegrityReport_v1"
    assert report["profile"] == "accessibility"
    assert report["ok"] is False
    assert report["summary"]["sourceCounts"]["room_access"] >= 1
    assert report["summary"]["sourceCounts"]["envelope"] >= 1
    assert report["summary"]["sourceCounts"]["structure_mep_lite"] >= 1
    assert report["summary"]["sourceCounts"]["code_profile"] >= 1


def test_constructability_report_exposes_domain_integrity_findings() -> None:
    elements = {
        "lvl-1": LevelElem(id="lvl-1", elevationMm=0),
        "wall-1": WallElem(
            id="wall-1",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=4000, yMm=0),
        ),
        "door-1": DoorElem(
            id="door-1",
            wallId="wall-1",
            alongT=0.5,
            widthMm=760,
            props={"accessibleDoor": True, "thresholdHeightMm": 35},
        ),
    }

    report = build_constructability_report(elements, revision=1, profile="accessibility")
    rule_ids = {finding["ruleId"] for finding in report["findings"]}

    assert "room_access_invalid_subject" not in rule_ids
    assert "code_profile_accessible_door_width_insufficient" in rule_ids
    assert "code_profile_accessible_threshold_too_high" in rule_ids
    assert report["summary"]["ruleCounts"]["code_profile_accessible_threshold_too_high"] >= 1
