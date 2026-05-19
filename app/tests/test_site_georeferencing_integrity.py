from __future__ import annotations

from bim_ai.site_georeferencing_integrity import (
    import_diagnostic_report_v1,
    linked_model_transform_diagnostics_v1,
    multi_building_shared_coordinate_diagnostics_v1,
    project_coordinate_system_diagnostics_v1,
    project_coordinate_system_summary_v1,
    roundtrip_drift_report_v1,
    site_georeferencing_report_v1,
    site_relationship_diagnostics_v1,
)


def _base_elements() -> dict[str, dict]:
    return {
        "internal_origin": {"kind": "internal_origin", "id": "internal_origin"},
        "pbp": {
            "kind": "project_base_point",
            "id": "pbp",
            "positionMm": {"xMm": 1000, "yMm": 2000, "zMm": 10},
            "angleToTrueNorthDeg": 12.5,
            "latitudeDeg": 48.13,
            "longitudeDeg": 11.58,
        },
        "survey": {
            "kind": "survey_point",
            "id": "survey",
            "positionMm": {"xMm": 5000, "yMm": 6000, "zMm": 0},
            "sharedElevationMm": 450000,
        },
        "lvl-0": {"kind": "level", "id": "lvl-0", "elevationMm": 0},
    }


def test_project_coordinate_system_summary_is_exportable_when_datums_are_explicit() -> None:
    summary = project_coordinate_system_summary_v1(_base_elements())
    findings = project_coordinate_system_diagnostics_v1(_base_elements())

    assert summary["exportable"] is True
    assert summary["projectBasePointIds"] == ["pbp"]
    assert summary["surveyPointIds"] == ["survey"]
    assert summary["trueNorthDeg"] == 12.5
    assert findings == []


def test_missing_coordinate_datums_and_shared_coord_link_are_reported() -> None:
    elements = {
        "lvl-0": {"kind": "level", "id": "lvl-0", "elevationMm": 0},
        "link-struct": {
            "kind": "link_model",
            "id": "link-struct",
            "sourceModelId": "src-1",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "originAlignmentMode": "shared_coords",
        },
    }

    coordinate_rules = {f.rule_id for f in project_coordinate_system_diagnostics_v1(elements)}
    link_rules = {f.rule_id for f in linked_model_transform_diagnostics_v1(elements)}

    assert "site_coordinate_system_missing_datum" in coordinate_rules
    assert "site_link_shared_coords_missing_survey_point" in link_rules


def test_import_diagnostic_contract_normalizes_categories_and_tracker_items() -> None:
    report = import_diagnostic_report_v1(
        [
            {
                "code": "ifc.transform.delta",
                "category": "transform_drift",
                "severity": "error",
                "message": "Readback placement drifted 24 mm.",
                "elementIds": ["wall-2", "wall-2", "link-ifc"],
            },
            {"code": "ifc.proxy", "category": "unknown_vendor_proxy", "severity": "loud"},
        ],
        operation_id="import-1",
        source_name="campus.ifc",
    )

    assert report["summary"]["diagnosticCount"] == 2
    transform = report["diagnostics"][0]
    assert transform["category"] == "transform_drift"
    assert transform["severity"] == "error"
    assert transform["elementIds"] == ["link-ifc", "wall-2"]
    assert transform["trackerItems"] == ["BIR-S02", "BIR-S03", "BIR-S04"]
    fallback = report["diagnostics"][1]
    assert fallback["category"] == "unsupported_product"
    assert fallback["severity"] == "warning"


def test_roundtrip_drift_report_detects_counts_placement_category_and_material() -> None:
    source = {
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 4000, "yMm": 0},
            "materialKey": "brick",
        },
        "floor-1": {
            "kind": "floor",
            "id": "floor-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 4000},
            ],
        },
    }
    readback = {
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 4012, "yMm": 0},
            "materialKey": "fallback",
        },
        "floor-1": {"kind": "roof", "id": "floor-1"},
        "door-extra": {"kind": "door", "id": "door-extra"},
    }

    report = roundtrip_drift_report_v1(source, readback, placement_tolerance_mm=5)
    statuses = {row["status"] for row in report["drifts"]}

    assert report["ok"] is False
    assert "placement_drift" in statuses
    assert "materialKey_drift" in statuses
    assert "category_drift" in statuses
    assert "unexpected_in_readback" in statuses
    assert "element_count_drift" in statuses


def test_site_relationship_diagnostics_cover_toposolid_hosts_and_property_lines() -> None:
    elements = {
        **_base_elements(),
        "site": {
            "kind": "site",
            "id": "site",
            "referenceLevelId": "lvl-0",
            "boundaryMm": [
                {"xMm": -10000, "yMm": -10000},
                {"xMm": 10000, "yMm": -10000},
                {"xMm": 10000, "yMm": 10000},
            ],
        },
        "topo": {
            "kind": "toposolid",
            "id": "topo",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 0, "yMm": 1000},
            ],
        },
        "floor-far": {
            "kind": "floor",
            "id": "floor-far",
            "levelId": "lvl-0",
            "boundaryMm": [
                {"xMm": 5000, "yMm": 5000},
                {"xMm": 6000, "yMm": 5000},
                {"xMm": 6000, "yMm": 6000},
            ],
        },
        "wall-bad-host": {
            "kind": "wall",
            "id": "wall-bad-host",
            "levelId": "lvl-0",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 100, "yMm": 0},
            "siteHostId": "missing-topo",
        },
        "prop": {
            "kind": "property_line",
            "id": "prop",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 1, "yMm": 1},
            "closureErrorMm": 25,
        },
    }

    rules = {f.rule_id for f in site_relationship_diagnostics_v1(elements)}

    assert "site_relationship_wall_invalid_toposolid_host" in rules
    assert "site_relationship_building_outside_toposolid" in rules
    assert "site_relationship_property_line_closure_error" in rules


def test_multi_building_shared_coordinate_support_reports_missing_anchor() -> None:
    elements = {
        "lvl-0": {"kind": "level", "id": "lvl-0", "elevationMm": 0},
        "floor-a": {
            "kind": "floor",
            "id": "floor-a",
            "levelId": "lvl-0",
            "props": {"buildingId": "A"},
            "boundaryMm": [],
        },
        "floor-b": {
            "kind": "floor",
            "id": "floor-b",
            "levelId": "lvl-0",
            "props": {"buildingId": "B"},
            "boundaryMm": [],
        },
    }

    findings = multi_building_shared_coordinate_diagnostics_v1(elements)

    assert [f.rule_id for f in findings] == [
        "site_multi_building_no_shared_coordinate_links",
        "site_multi_building_missing_shared_coordinates",
    ]
    assert all("BIR-S06" in f.tracker_items for f in findings)


def test_site_georeferencing_report_is_deterministic_and_groups_bir_s_items() -> None:
    report = site_georeferencing_report_v1(
        {
            **_base_elements(),
            "link-dxf": {
                "kind": "link_dxf",
                "id": "link-dxf",
                "levelId": "lvl-0",
                "originMm": {"xMm": 0, "yMm": 0},
                "originAlignmentMode": "origin_to_origin",
                "linework": [],
            },
        }
    )

    assert report["format"] == "siteGeoreferencingIntegrityReport_v1"
    assert report["trackerItems"] == ["BIR-S01", "BIR-S02", "BIR-S03", "BIR-S04", "BIR-S05", "BIR-S06"]
    assert report["findings"][0]["ruleId"] == "site_import_missing_source_metadata"
    assert report["findings"][0]["trackerItems"] == ["BIR-S02", "BIR-S03"]
