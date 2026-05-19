from __future__ import annotations

from bim_ai.constructability_report import build_constructability_report
from bim_ai.domain_integrity import check_domain_integrity, domain_integrity_report
from bim_ai.elements import DoorElem, LevelElem, Vec2Mm, WallElem


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

    assert "code_profile_accessible_door_width_insufficient" in rule_ids
    assert "code_profile_accessible_threshold_too_high" in rule_ids
    assert report["summary"]["ruleCounts"]["code_profile_accessible_threshold_too_high"] >= 1
