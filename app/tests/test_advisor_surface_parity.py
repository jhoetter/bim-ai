from __future__ import annotations

from bim_ai.advisor_surface_parity import (
    build_advisor_four_surface_parity,
    normalize_advisor_findings_for_surface,
)


def test_advisor_four_surface_parity_matches_grouped_construction_profile_findings() -> None:
    finding = {
        "ruleId": "load_bearing_wall_removed_without_transfer",
        "severity": "error",
        "message": "Load-bearing wall is removed.",
        "elementIds": ["wall-1"],
        "discipline": "structure",
    }
    api_snapshot = {"violations": [finding]}
    ui_right_rail = {"violations": [finding]}
    cli_advisor = {
        "groups": [
            {
                "code": "load_bearing_wall_removed_without_transfer",
                "severity": "error",
                "count": 1,
                "elementIds": ["wall-1"],
            }
        ]
    }
    constructability_report = {
        "format": "constructabilityReport_v1",
        "profile": "construction_readiness",
        "findings": [finding],
    }

    parity = build_advisor_four_surface_parity(
        profile="construction_readiness",
        api_snapshot=api_snapshot,
        cli_advisor=cli_advisor,
        constructability_report=constructability_report,
        ui_right_rail=ui_right_rail,
    )

    assert parity["format"] == "advisorFourSurfaceParity_v1"
    assert parity["ok"] is True
    assert parity["summary"]["surfaceCount"] == 4
    assert parity["summary"]["groupCountBySurface"] == {
        "api_snapshot": 1,
        "cli_advisor": 1,
        "constructability_report": 1,
        "ui_right_rail": 1,
    }
    assert parity["mismatches"] == []


def test_advisor_four_surface_parity_reports_missing_and_unexpected_groups() -> None:
    canonical = {
        "findings": [
            {
                "ruleId": "constructability_metadata_requirement_missing",
                "severity": "warning",
                "elementIds": ["wall-2"],
            }
        ]
    }

    parity = build_advisor_four_surface_parity(
        profile="construction_readiness",
        api_snapshot={"violations": []},
        cli_advisor={
            "groups": [
                {
                    "code": "unexpected_rule",
                    "severity": "warning",
                    "count": 1,
                    "elementIds": ["wall-2"],
                }
            ]
        },
        constructability_report=canonical,
        ui_right_rail=canonical["findings"],
    )

    assert parity["ok"] is False
    missing = next(row for row in parity["mismatches"] if row["surface"] == "api_snapshot")
    assert missing["missingGroups"] == [
        "warning|constructability_metadata_requirement_missing|wall-2"
    ]
    cli = next(row for row in parity["mismatches"] if row["surface"] == "cli_advisor")
    assert cli["unexpectedGroups"] == ["warning|unexpected_rule|wall-2"]


def test_cli_advisor_groups_normalize_to_rule_id_shape() -> None:
    rows = normalize_advisor_findings_for_surface(
        "cli_advisor",
        {
            "groups": [
                {
                    "code": "opening_without_host",
                    "severity": "warning",
                    "count": 2,
                    "elementIds": ["opening-2", "opening-1"],
                }
            ]
        },
    )

    assert rows == [
        {
            "severity": "warning",
            "ruleId": "opening_without_host",
            "elementIds": ["opening-1", "opening-2"],
            "count": 2,
        }
    ]
