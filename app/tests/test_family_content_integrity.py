from __future__ import annotations

from bim_ai.model_integrity import (
    check_model_integrity_invariants,
    family_type_content_integrity_v1,
)


def _rules(findings):
    return {finding.rule_id for finding in findings}


def test_family_type_content_integrity_accepts_complete_schema_and_placements() -> None:
    subject = {
        "elements": {
            "lvl-1": {"kind": "level", "id": "lvl-1"},
            "floor-1": {
                "kind": "floor",
                "id": "floor-1",
                "levelId": "lvl-1",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            },
            "wall-1": {
                "kind": "wall",
                "id": "wall-1",
                "levelId": "lvl-1",
                "start": {"xMm": 1000, "yMm": 1000},
                "end": {"xMm": 4000, "yMm": 1000},
                "heightMm": 2800,
            },
            "ft-casework": {
                "kind": "family_type",
                "id": "ft-casework",
                "name": "Wall cabinet",
                "familySchemaVersion": "family-content-v1",
                "parameters": {"widthMm": 900, "heightMm": 720, "materialKey": "oak"},
                "parameterSchema": [
                    {
                        "key": "widthMm",
                        "kind": "mm",
                        "min": 300,
                        "max": 1200,
                        "instanceOverridable": True,
                        "required": True,
                    },
                    {
                        "key": "heightMm",
                        "kind": "mm",
                        "min": 300,
                        "max": 900,
                        "instanceOverridable": True,
                        "required": True,
                    },
                    {"key": "materialKey", "kind": "material", "instanceOverridable": True},
                ],
                "requiredDimensions": ["widthMm", "heightMm"],
                "hostSupport": "wall_hosted",
                "materialSlots": {"case": "oak"},
                "scheduleFields": ["widthMm", "heightMm", "materialKey"],
                "ifcMapping": {"class": "IfcFurnishingElement"},
                "gltfMapping": {"nodeKind": "family_instance"},
                "renderSupport": {"geometry": True},
                "exportSupport": {"ifc": True, "gltf": True},
                "planSymbol": {"kind": "casework"},
                "visualGeometry": {"kind": "box"},
            },
            "cabinet-1": {
                "kind": "family_instance",
                "id": "cabinet-1",
                "familyTypeId": "ft-casework",
                "levelId": "lvl-1",
                "hostElementId": "wall-1",
                "positionMm": {"xMm": 1500, "yMm": 1000},
                "paramValues": {"widthMm": 1000},
            },
            "asset-chair": {
                "kind": "asset_library_entry",
                "id": "asset-chair",
                "assetKind": "block_2d",
                "name": "Chair",
                "category": "furniture",
                "widthMm": 500,
                "depthMm": 500,
                "heightMm": 800,
                "clearanceMm": 600,
                "maintenanceZoneMm": {"front": 600},
                "materialSlots": ["frame"],
                "renderSupport": {"proxy": "chair"},
                "scheduleFields": ["widthMm", "depthMm"],
                "exportMetadata": {"ifcClass": "IfcFurniture"},
                "placementSupport": "freestanding",
                "paramSchema": [{"key": "widthMm", "kind": "mm", "default": 500, "min": 300}],
            },
            "chair-1": {
                "kind": "placed_asset",
                "id": "chair-1",
                "name": "Chair",
                "assetId": "asset-chair",
                "levelId": "lvl-1",
                "positionMm": {"xMm": 2500, "yMm": 2500},
            },
        }
    }

    report = family_type_content_integrity_v1(subject)

    assert report["format"] == "familyTypeContentIntegrity_v1"
    assert report["ok"] is True
    assert report["findingCount"] == 0
    assert len(report["digestSha256"]) == 64


def test_family_type_content_integrity_reports_invalid_overrides_assets_and_parity() -> None:
    subject = {
        "elements": {
            "lvl-1": {"kind": "level", "id": "lvl-1"},
            "floor-1": {
                "kind": "floor",
                "id": "floor-1",
                "levelId": "lvl-1",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            },
            "wall-1": {
                "kind": "wall",
                "id": "wall-1",
                "levelId": "lvl-1",
                "start": {"xMm": 500, "yMm": 500},
                "end": {"xMm": 1500, "yMm": 500},
                "heightMm": 900,
            },
            "ft-invalid": {
                "kind": "family_type",
                "id": "ft-invalid",
                "strictFamilySchema": True,
                "parameters": {"widthMm": 600, "heightMm": 700},
                "parameterSchema": [
                    {
                        "key": "widthMm",
                        "kind": "mm",
                        "min": 300,
                        "max": 900,
                        "instanceOverridable": True,
                    },
                    {
                        "key": "heightMm",
                        "kind": "mm",
                        "min": 300,
                        "max": 800,
                        "instanceOverridable": False,
                    },
                ],
                "requiredDimensions": ["widthMm", "heightMm"],
                "hostSupport": "wall_hosted",
                "scheduleFields": ["heightMm"],
                "renderSupport": {"geometry": True},
                "exportSupport": {"ifc": True, "gltf": False},
            },
            "family-1": {
                "kind": "family_instance",
                "id": "family-1",
                "familyTypeId": "ft-invalid",
                "levelId": "lvl-1",
                "hostElementId": "wall-1",
                "positionMm": {"xMm": 700, "yMm": 500},
                "paramValues": {"widthMm": 1500, "heightMm": 850, "bogus": 1},
            },
            "asset-bad": {
                "kind": "asset_library_entry",
                "id": "asset-bad",
                "assetKind": "block_2d",
                "name": "Bad asset",
                "category": "furniture",
                "paramSchema": [{"key": "widthMm", "kind": "mm", "default": -1, "min": 1}],
            },
            "asset-floating": {
                "kind": "placed_asset",
                "id": "asset-floating",
                "name": "Floating",
                "assetId": "asset-bad",
                "levelId": "lvl-1",
                "positionMm": {"xMm": 5000, "yMm": 5000},
            },
            "asset-embedded": {
                "kind": "placed_asset",
                "id": "asset-embedded",
                "name": "Embedded",
                "assetId": "asset-bad",
                "levelId": "lvl-1",
                "positionMm": {"xMm": 1000, "yMm": 500},
            },
        }
    }

    findings = check_model_integrity_invariants(subject)
    rule_ids = _rules(findings)
    report = family_type_content_integrity_v1(subject)
    report_rule_ids = {finding["ruleId"] for finding in report["findings"]}

    assert "model_integrity_family_type_schema_incomplete" in rule_ids
    assert "model_integrity_family_render_export_parity_gap" in rule_ids
    assert "model_integrity_family_instance_override_unknown" in rule_ids
    assert "model_integrity_family_instance_override_not_allowed" in rule_ids
    assert "model_integrity_family_instance_override_invalid" in rule_ids
    assert "model_integrity_family_instance_override_unscheduled" in rule_ids
    assert "model_integrity_family_instance_host_constraint_violation" in rule_ids
    assert "model_integrity_asset_catalog_metadata_incomplete" in rule_ids
    assert "model_integrity_asset_catalog_param_schema_invalid" in rule_ids
    assert "model_integrity_asset_placement_floating" in rule_ids
    assert "model_integrity_asset_placement_embedded_without_intent" in rule_ids
    assert report["ok"] is False
    assert report_rule_ids.issuperset(rule_ids & report_rule_ids)
    assert "BIR-V05" in report["trackedItems"]
