from __future__ import annotations

from bim_ai.code_profile_integrity import check_code_profile_integrity


def _rule_ids(findings: list[dict[str, object]]) -> set[str]:
    return {str(finding["ruleId"]) for finding in findings}


def _assert_contract(findings: list[dict[str, object]]) -> None:
    required = {
        "ruleId",
        "code",
        "severity",
        "priority",
        "discipline",
        "perspective",
        "elementIds",
        "recommendation",
    }
    for finding in findings:
        assert required <= finding.keys()
        assert finding["elementIds"]


def test_default_profile_is_advisory_and_minimal() -> None:
    elements = {
        "door-1": {
            "kind": "door",
            "id": "door-1",
            "widthMm": 760,
            "props": {"accessibleDoor": True, "thresholdHeightMm": 45},
        },
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "props": {"fireRated": True},
        },
    }

    assert check_code_profile_integrity(elements) == []


def test_fire_profile_blocks_missing_fire_metadata() -> None:
    elements = {
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "props": {"fireSeparation": True},
        },
        "door-1": {
            "kind": "door",
            "id": "door-1",
            "widthMm": 900,
            "props": {"exitDoor": True, "fireDoor": True},
        },
        "stair-1": {
            "kind": "stair",
            "id": "stair-1",
            "props": {"protectedStair": True},
        },
        "compartment-wall-1": {
            "kind": "wall",
            "id": "compartment-wall-1",
            "fireRating": "EI60",
            "props": {"compartmentBoundary": True},
        },
    }

    findings = check_code_profile_integrity(elements, profile="fire")

    _assert_contract(findings)
    assert {finding["severity"] for finding in findings} == {"error"}
    assert {finding["priority"] for finding in findings} == {"P0"}
    assert all(finding["trackerItems"] == ["BIR-G05"] for finding in findings)
    assert {
        "code_profile_fire_rating_missing",
        "code_profile_exit_door_metadata_missing",
        "code_profile_protected_stair_placeholder_missing",
        "code_profile_compartment_placeholder_missing",
    } <= _rule_ids(findings)


def test_accessibility_profile_blocks_narrow_threshold_circulation_and_sanitary_issues() -> None:
    elements = {
        "door-1": {
            "kind": "door",
            "id": "door-1",
            "widthMm": 760,
            "props": {
                "accessibleDoor": True,
                "thresholdHeightMm": 35,
                "maneuveringClearanceMm": 250,
                "swingObstructsAccessibleRoute": True,
            },
        },
        "route-1": {
            "kind": "circulation_path",
            "id": "route-1",
            "props": {"accessibleRoute": True, "clearWidthMm": 1000},
        },
        "sanitary-1": {
            "kind": "room",
            "id": "sanitary-1",
            "props": {"accessibleSanitary": True, "turningDiameterMm": 1300},
        },
    }

    findings = check_code_profile_integrity(elements, profile="accessibility")

    _assert_contract(findings)
    assert {finding["severity"] for finding in findings} == {"error"}
    assert {
        "code_profile_accessible_door_width_insufficient",
        "code_profile_accessible_threshold_too_high",
        "code_profile_door_clearance_insufficient",
        "code_profile_door_swing_conflict",
        "code_profile_circulation_width_insufficient",
        "code_profile_accessible_route_continuity_missing",
        "code_profile_sanitary_turning_zone_insufficient",
    } == _rule_ids(findings)
    assert all(finding["trackerItems"] == ["BIR-G06"] for finding in findings)


def test_fire_profile_requires_firestop_metadata_for_rated_host_penetrations() -> None:
    elements = {
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "fireRating": "EI60",
            "props": {"fireSeparation": True},
        },
        "pipe-1": {
            "kind": "pipe",
            "id": "pipe-1",
            "passesThroughElementIds": ["wall-1"],
        },
    }

    findings = check_code_profile_integrity(elements, profile="fire")

    firestop = next(f for f in findings if f["ruleId"] == "code_profile_firestop_metadata_missing")
    assert firestop["elementIds"] == ["pipe-1", "wall-1"]
    assert firestop["code"] == "BIR-G05"


def test_regional_profile_metadata_requires_source_and_basis() -> None:
    elements = {
        "settings-1": {
            "kind": "project_settings",
            "id": "settings-1",
            "props": {"locale": "US-CA"},
        }
    }

    findings = check_code_profile_integrity(
        elements,
        profile={
            "id": "california_advisory",
            "regional": True,
            "locale": "US-CA",
            "basis": "",
        },
    )

    _assert_contract(findings)
    assert findings[0]["ruleId"] == "code_profile_regional_package_metadata_missing"
    assert findings[0]["severity"] == "warning"
    assert "source" in str(findings[0]["message"])
    assert "advisory-vs-enforced basis" in str(findings[0]["message"])


def test_regional_profile_findings_carry_locale_source_profile_and_basis() -> None:
    findings = check_code_profile_integrity(
        {},
        profile={
            "id": "berlin_enforced",
            "regional": True,
            "locale": "DE-BE",
            "source": "Bauordnung Berlin placeholder",
            "basis": "enforced",
        },
    )

    assert findings == []

    missing_source = check_code_profile_integrity(
        {},
        profile={
            "id": "berlin_enforced",
            "regional": True,
            "locale": "DE-BE",
            "basis": "enforced",
        },
    )

    finding = missing_source[0]
    assert finding["ruleId"] == "code_profile_regional_package_metadata_missing"
    assert finding["severity"] == "error"
    assert finding["profileId"] == "berlin_enforced"
    assert finding["basis"] == "enforced"
    assert finding["locale"] == "DE-BE"
    assert finding["sourceBasis"] is None
    assert finding["trackerItems"] == ["BIR-G07"]


def test_accepted_placeholder_metadata_passes() -> None:
    elements = {
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "fireRating": "EI60",
            "props": {
                "fireSeparation": True,
                "compartmentBoundary": True,
                "compartmentId": "C-01",
                "compartmentBasis": "placeholder for authority review",
            },
        },
        "door-1": {
            "kind": "door",
            "id": "door-1",
            "fireRating": "EI30",
            "props": {
                "exitDoor": True,
                "egressClearWidthMm": 900,
                "swingDirection": "out",
                "landingClearanceMm": 1500,
            },
        },
        "stair-1": {
            "kind": "stair",
            "id": "stair-1",
            "props": {
                "protectedStair": True,
                "enclosureRating": "EI60",
                "smokeControlStrategy": "placeholder",
            },
        },
        "route-1": {
            "kind": "circulation_path",
            "id": "route-1",
            "props": {
                "accessibleRoute": True,
                "clearWidthMm": 1500,
                "continuousAccessibleRoute": True,
            },
        },
        "sanitary-1": {
            "kind": "room",
            "id": "sanitary-1",
            "props": {"accessibleSanitary": True, "turningDiameterMm": 1500},
        },
        "settings-1": {
            "kind": "project_settings",
            "id": "settings-1",
            "props": {
                "locale": "DE-BE",
                "source": "Bauordnung Berlin placeholder",
                "basis": "advisory",
            },
        },
    }

    findings = check_code_profile_integrity(
        elements,
        profile={
            "id": "accepted_placeholders",
            "domains": ["fire", "accessibility", "regional"],
            "source": "Bauordnung Berlin placeholder",
            "locale": "DE-BE",
            "basis": "advisory",
        },
    )

    assert findings == []
