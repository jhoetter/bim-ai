from __future__ import annotations

from bim_ai.domain_integrity import check_domain_integrity
from bim_ai.site_georeferencing_integrity import (
    check_site_georeferencing_integrity,
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


def test_missing_level_datum_is_blocking_domain_finding() -> None:
    elements = {
        "internal_origin": {"kind": "internal_origin", "id": "internal_origin"},
        "pbp": {
            "kind": "project_base_point",
            "id": "pbp",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "angleToTrueNorthDeg": 0,
        },
        "survey": {
            "kind": "survey_point",
            "id": "survey",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
        },
    }

    findings = check_site_georeferencing_integrity(elements)
    row = next(f for f in findings if f["ruleId"] == "site_coordinate_system_missing_level_datum")

    assert row["severity"] == "error"
    assert row["blocking"] is True
    assert row["code"] == "site_coordinate_system_missing_level_datum"
    assert row["discipline"] == "site"
    assert row["perspective"] == "coordination"
    assert row["trackerItems"] == ["BIR-S01"]


def test_domain_integrity_preserves_site_georeferencing_tracker_items() -> None:
    findings = check_domain_integrity({"lvl-1": {"kind": "level", "id": "lvl-1"}})
    site_rows = [f for f in findings if f["source"] == "site_georeferencing"]

    assert site_rows
    assert any("BIR-S01" in row["trackerItems"] for row in site_rows)
    assert any("BIR-S05" in row["trackerItems"] for row in site_rows)
    assert all(row["code"] == row["ruleId"] for row in site_rows)


def test_stale_unloaded_links_and_transform_drift_are_reported() -> None:
    elements = {
        **_base_elements(),
        "link-struct": {
            "kind": "link_model",
            "id": "link-struct",
            "sourceModelId": "struct-v12",
            "positionMm": {"xMm": 100, "yMm": 200, "zMm": 0},
            "originAlignmentMode": "shared_coords",
            "loaded": False,
            "reloadStatus": "unloaded",
            "expectedTransform": {
                "translationMm": {"xMm": 100, "yMm": 200, "zMm": 0},
                "rotationDeg": 0,
            },
            "actualTransform": {
                "translationMm": {"xMm": 100, "yMm": 206, "zMm": 0},
                "rotationDeg": 0.01,
            },
        },
    }

    findings = linked_model_transform_diagnostics_v1(elements)
    rules = [f.rule_id for f in findings]
    drift_rows = [f for f in findings if f.rule_id == "site_link_transform_drift"]

    assert "site_link_source_stale_or_unloaded" in rules
    assert len(drift_rows) == 2
    assert {f.field for f in drift_rows} == {"translationMm.yMm", "rotationDeg"}
    assert all(f.severity == "error" for f in drift_rows)


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


def test_import_diagnostic_contract_preserves_unsupported_mapping_evidence() -> None:
    report = import_diagnostic_report_v1(
        [
            {
                "code": "ifc.mapping.unsupported",
                "category": "category_mapping_fallback",
                "severity": "error",
                "message": "IfcVirtualElement mapped to generic import proxy.",
                "sourceCategory": "IfcVirtualElement",
                "mappedCategory": "import_proxy",
                "mappingSupported": False,
                "fallbackCategory": "unsupported_product",
                "elementIds": ["ifc-13"],
            }
        ],
        operation_id="import-unsupported-mapping",
        source_name="coordination.ifc",
    )

    diagnostic = report["diagnostics"][0]

    assert report["ok"] is False
    assert diagnostic["category"] == "category_mapping_fallback"
    assert diagnostic["blocking"] is True
    assert diagnostic["mapping"] == {
        "sourceCategory": "IfcVirtualElement",
        "mappedCategory": "import_proxy",
        "mappingSupported": False,
        "fallbackCategory": "unsupported_product",
    }
    assert diagnostic["trackerItems"] == ["BIR-S03"]


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
    assert all(row["trackerItems"] == ["BIR-S04"] for row in report["drifts"])
    assert all(row["discipline"] == "site" for row in report["drifts"])


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


def test_invalid_site_toposolid_relationships_are_blocking() -> None:
    elements = {
        **_base_elements(),
        "site": {
            "kind": "site",
            "id": "site",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
                {"xMm": 0, "yMm": 1000},
            ],
        },
        "topo-bad-host": {
            "kind": "toposolid",
            "id": "topo-bad-host",
            "siteId": "missing-site",
            "boundaryMm": [
                {"xMm": 2000, "yMm": 2000},
                {"xMm": 3000, "yMm": 2000},
                {"xMm": 3000, "yMm": 3000},
            ],
        },
        "topo-degenerate": {
            "kind": "toposolid",
            "id": "topo-degenerate",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 100, "yMm": 0},
            ],
        },
        "floor-bad-host": {
            "kind": "floor",
            "id": "floor-bad-host",
            "siteHostId": "missing-topo",
            "boundaryMm": [
                {"xMm": 100, "yMm": 100},
                {"xMm": 200, "yMm": 100},
                {"xMm": 200, "yMm": 200},
            ],
        },
    }

    findings = site_relationship_diagnostics_v1(elements)
    rules = {f.rule_id: f for f in findings}

    assert rules["site_relationship_toposolid_invalid_site_host"].severity == "error"
    assert rules["site_relationship_toposolid_degenerate_boundary"].severity == "error"
    assert rules["site_relationship_building_invalid_toposolid_host"].severity == "error"
    assert "site_relationship_toposolid_outside_site" in rules


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
