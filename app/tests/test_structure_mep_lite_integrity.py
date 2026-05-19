from __future__ import annotations

from bim_ai.structure_mep_lite_integrity import (
    check_structure_mep_lite_integrity,
    structure_mep_lite_integrity_report,
)


def _base_clean_elements() -> dict[str, dict[str, object]]:
    return {
        "lvl-0": {"kind": "level", "id": "lvl-0", "elevationMm": 0},
        "lvl-1": {"kind": "level", "id": "lvl-1", "elevationMm": 3000},
        "col-a-0": {
            "kind": "column",
            "id": "col-a-0",
            "levelId": "lvl-0",
            "loadBearing": True,
            "gridId": "A1",
        },
        "col-a-1": {
            "kind": "column",
            "id": "col-a-1",
            "levelId": "lvl-1",
            "loadBearing": True,
            "gridId": "A1",
        },
        "col-b-0": {
            "kind": "column",
            "id": "col-b-0",
            "levelId": "lvl-0",
            "loadBearing": True,
            "gridId": "B1",
        },
        "beam-1": {
            "kind": "beam",
            "id": "beam-1",
            "levelId": "lvl-1",
            "loadBearing": True,
            "supportedByIds": ["col-a-1", "col-b-0"],
        },
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "levelId": "lvl-1",
            "loadBearing": False,
        },
        "opening-small": {
            "kind": "wall_opening",
            "id": "opening-small",
            "hostWallId": "wall-1",
            "widthMm": 900,
            "heightMm": 2100,
        },
        "riser-1": {
            "kind": "riser",
            "id": "riser-1",
            "levelId": "lvl-0",
            "accessPanelIds": ["access-1"],
        },
        "bath-0": {
            "kind": "room",
            "id": "bath-0",
            "levelId": "lvl-0",
            "category": "bathroom",
            "serviceStackId": "wet-a",
            "servedByRiserId": "riser-1",
        },
        "bath-1": {
            "kind": "room",
            "id": "bath-1",
            "levelId": "lvl-1",
            "category": "bathroom",
            "serviceStackId": "wet-a",
            "servedByRiserId": "riser-1",
        },
        "pipe-1": {
            "kind": "pipe",
            "id": "pipe-1",
            "levelId": "lvl-1",
            "passesThroughElementIds": ["wall-1"],
            "openingRequestId": "opening-small",
        },
        "route-placeholder-1": {
            "kind": "mep_route_placeholder",
            "id": "route-placeholder-1",
            "levelId": "lvl-1",
            "routedFromId": "riser-1",
            "routedToId": "bath-1",
        },
        "ahu-zone": {
            "kind": "equipment_zone",
            "id": "ahu-zone",
            "levelId": "lvl-1",
            "maintenanceAccess": "front",
        },
    }


def _rule_ids(report_or_findings) -> set[str]:
    findings = report_or_findings["findings"] if isinstance(report_or_findings, dict) else report_or_findings
    return {finding["ruleId"] if isinstance(finding, dict) else finding.ruleId for finding in findings}


def test_clean_concept_bim_metadata_has_no_structure_mep_lite_findings() -> None:
    report = structure_mep_lite_integrity_report({"elements": _base_clean_elements()})

    assert report["ok"] is True
    assert report["findingCount"] == 0
    assert report["findings"] == []
    assert report["method"] == "deterministic_structure_lite_constructability_checks"
    assert report["certification"] == "not_certified_structural_engineering"
    assert "certified structural engineering" in report["engineeringDisclaimer"]
    assert report["trackedItems"] == ["BIR-G01", "BIR-G02", "BIR-G03", "BIR-G04"]


def test_findings_have_required_machine_readable_fields() -> None:
    elements = _base_clean_elements()
    elements["wall-1"].pop("loadBearing")

    report = structure_mep_lite_integrity_report(elements)

    finding = report["findings"][0]
    assert {
        "ruleId",
        "code",
        "severity",
        "priority",
        "discipline",
        "perspective",
        "elementIds",
        "recommendation",
    } <= set(finding)
    assert finding["ruleId"] == "structure_lite_load_bearing_flag_missing"
    assert finding["code"] == "BIR-G01-LOAD-BEARING-FLAG"
    assert finding["discipline"] == "structure"
    assert finding["perspective"] == "structure_lite"
    assert finding["elementIds"] == ["wall-1"]


def test_missing_load_path_is_reported_for_unstacked_load_bearing_support() -> None:
    elements = _base_clean_elements()
    elements["col-a-1"]["gridId"] = "C9"

    findings = check_structure_mep_lite_integrity(elements)

    assert "structure_lite_load_path_missing" in _rule_ids(findings)
    missing = next(f for f in findings if f.ruleId == "structure_lite_load_path_missing")
    assert missing.elementIds == ("col-a-1",)
    assert missing.priority == "P1"


def test_uncoordinated_large_opening_is_reported() -> None:
    elements = _base_clean_elements()
    elements["opening-large"] = {
        "kind": "wall_opening",
        "id": "opening-large",
        "hostWallId": "wall-1",
        "widthMm": 2400,
        "heightMm": 2200,
    }

    report = structure_mep_lite_integrity_report({"elements": elements})

    assert "structure_lite_large_opening_uncoordinated" in _rule_ids(report)
    finding = next(
        f for f in report["findings"] if f["ruleId"] == "structure_lite_large_opening_uncoordinated"
    )
    assert finding["elementIds"] == ["opening-large", "wall-1"]
    assert finding["discipline"] == "coordination"


def test_mep_route_crossing_host_without_opening_is_reported() -> None:
    elements = _base_clean_elements()
    elements["pipe-1"].pop("openingRequestId")

    findings = check_structure_mep_lite_integrity({"elements": elements})

    assert "mep_lite_route_penetration_opening_missing" in _rule_ids(findings)
    crossing = next(f for f in findings if f.ruleId == "mep_lite_route_penetration_opening_missing")
    assert crossing.elementIds == ("pipe-1", "wall-1")
    assert crossing.discipline == "mep"


def test_wet_room_unstacked_and_unserved_are_reported() -> None:
    elements = _base_clean_elements()
    elements["bath-1"].pop("servedByRiserId")
    elements["bath-1"]["serviceStackId"] = "wet-offset"

    findings = check_structure_mep_lite_integrity(elements)

    assert {
        "mep_lite_wet_room_unserved",
        "mep_lite_wet_room_unstacked",
    } <= _rule_ids(findings)
    assert any(f.elementIds == ("bath-1",) for f in findings)


def test_missing_riser_service_access_and_unresolved_route_placeholder_are_reported() -> None:
    elements = _base_clean_elements()
    elements["riser-1"].pop("accessPanelIds")
    elements["route-placeholder-1"].pop("routedFromId")
    elements["route-placeholder-1"].pop("routedToId")

    findings = check_structure_mep_lite_integrity(elements)

    assert {
        "mep_lite_service_access_missing",
        "mep_lite_route_placeholder_unresolved",
    } <= _rule_ids(findings)
    access = next(f for f in findings if f.ruleId == "mep_lite_service_access_missing")
    assert access.elementIds == ("riser-1",)
