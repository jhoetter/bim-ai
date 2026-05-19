from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, WallElem
from bim_ai.model_integrity import (
    check_model_integrity_invariants,
    model_integrity_invariant_contract_v1,
    model_integrity_smoke_command_evidence_v1,
    model_integrity_smoke_v1,
    model_integrity_units_coordinate_normalization_v1,
    resolve_type_instance_inheritance_v1,
    schema_migration_compatibility_v1,
)


def _rules(findings):
    return {finding.rule_id for finding in findings}


def test_valid_minimal_document_has_no_integrity_findings() -> None:
    doc = Document(
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground"),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                levelId="lvl-1",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
            ),
            "door-1": DoorElem(kind="door", id="door-1", wallId="wall-1", alongT=0.5),
        }
    )

    assert check_model_integrity_invariants(doc) == []


def test_unresolved_and_wrong_kind_references_are_reported() -> None:
    findings = check_model_integrity_invariants(
        {
            "elements": {
                "lvl-1": {"kind": "level", "id": "lvl-1"},
                "not-a-wall": {"kind": "level", "id": "not-a-wall"},
                "door-missing": {
                    "kind": "door",
                    "id": "door-missing",
                    "wallId": "missing-wall",
                    "alongT": 0.5,
                },
                "door-wrong-kind": {
                    "kind": "door",
                    "id": "door-wrong-kind",
                    "wallId": "not-a-wall",
                    "alongT": 0.5,
                },
            }
        }
    )

    assert "model_integrity_unresolved_reference" in _rules(findings)
    assert "model_integrity_reference_wrong_kind" in _rules(findings)
    missing = next(
        finding
        for finding in findings
        if finding.rule_id == "model_integrity_unresolved_reference"
    )
    assert missing.field == "wallId"
    assert missing.element_ids == ("door-missing",)


def test_broad_reference_fields_and_nested_refs_are_checked() -> None:
    subject = {
        "designOptionSets": [{"id": "set-a", "options": [{"id": "opt-a"}]}],
        "elements": {
            "lvl-1": {"kind": "level", "id": "lvl-1"},
            "mat-1": {"kind": "material", "id": "mat-1"},
            "phase-1": {"kind": "phase", "id": "phase-1"},
            "link-real": {"kind": "link_model", "id": "link-real"},
            "pv-1": {"kind": "plan_view", "id": "pv-1", "levelId": "lvl-1"},
            "sheet-1": {
                "kind": "sheet",
                "id": "sheet-1",
                "viewPlacements": [{"viewId": "missing-view"}],
            },
            "schedule-1": {"kind": "schedule", "id": "schedule-1", "sheetId": "pv-1"},
            "wall-type-1": {
                "kind": "wall_type",
                "id": "wall-type-1",
                "layers": [
                    {
                        "thicknessMm": 100,
                        "function": "structure",
                        "materialKey": "missing-layer-material",
                    }
                ],
            },
            "wall-1": {
                "kind": "wall",
                "id": "wall-1",
                "levelId": "lvl-1",
                "wallTypeId": "wall-type-1",
                "materialKey": "missing-material",
                "phaseCreated": "missing-phase",
                "optionSetId": "set-a",
                "optionId": "missing-option",
                "linkId": "missing-link",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
        },
    }

    findings = check_model_integrity_invariants(subject)
    fields = {finding.field for finding in findings}

    assert "model_integrity_unresolved_reference" in _rules(findings)
    assert "model_integrity_reference_wrong_kind" in _rules(findings)
    assert "materialKey" in fields
    assert "phaseCreated" in fields
    assert "optionId" in fields
    assert "linkId" in fields
    assert "viewPlacements[0].viewId" in fields
    assert "layers[0].materialKey" in fields
    assert "sheetId" in fields


def test_valid_reference_surface_passes_with_materials_views_options_and_links() -> None:
    subject = {
        "designOptionSets": [{"id": "set-a", "options": [{"id": "opt-a"}]}],
        "elements": {
            "lvl-1": {"kind": "level", "id": "lvl-1", "elevationMm": 0},
            "mat-1": {"kind": "material", "id": "mat-1"},
            "phase-1": {"kind": "phase", "id": "phase-1"},
            "link-1": {"kind": "link_model", "id": "link-1"},
            "pv-1": {
                "kind": "plan_view",
                "id": "pv-1",
                "levelId": "lvl-1",
                "phaseId": "phase-1",
                "optionLocks": {"set-a": "opt-a"},
            },
            "sheet-1": {
                "kind": "sheet",
                "id": "sheet-1",
                "viewPlacements": [{"viewId": "pv-1"}],
            },
            "schedule-1": {"kind": "schedule", "id": "schedule-1", "sheetId": "sheet-1"},
            "wall-type-1": {
                "kind": "wall_type",
                "id": "wall-type-1",
                "layers": [
                    {"thicknessMm": 100, "function": "structure", "materialKey": "mat-1"}
                ],
            },
            "wall-1": {
                "kind": "wall",
                "id": "wall-1",
                "levelId": "lvl-1",
                "wallTypeId": "wall-type-1",
                "materialKey": "mat-1",
                "phaseCreated": "phase-1",
                "optionSetId": "set-a",
                "optionId": "opt-a",
                "linkId": "link-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
        },
    }

    assert check_model_integrity_invariants(subject) == []


def test_physical_level_semantics_are_checked() -> None:
    findings = check_model_integrity_invariants(
        {
            "lvl-1": {"kind": "level", "id": "lvl-1"},
            "sheet-1": {"kind": "sheet", "id": "sheet-1"},
            "wall-missing-level": {
                "kind": "wall",
                "id": "wall-missing-level",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
            "wall-wrong-level": {
                "kind": "wall",
                "id": "wall-wrong-level",
                "levelId": "sheet-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
        }
    )

    assert "model_integrity_physical_level_missing" in _rules(findings)
    assert "model_integrity_reference_wrong_kind" in _rules(findings)
    assert "model_integrity_physical_level_invalid" in _rules(findings)


def test_storey_spans_parent_levels_and_host_level_mismatch_are_checked() -> None:
    findings = check_model_integrity_invariants(
        {
            "lvl-1": {"kind": "level", "id": "lvl-1", "elevationMm": 0},
            "lvl-2": {"kind": "level", "id": "lvl-2", "elevationMm": 3000},
            "lvl-child": {
                "kind": "level",
                "id": "lvl-child",
                "parentLevelId": "lvl-1",
                "offsetFromParentMm": 1500,
                "elevationMm": 1200,
            },
            "wall-bad-span": {
                "kind": "wall",
                "id": "wall-bad-span",
                "levelId": "lvl-2",
                "topConstraintLevelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
                "heightMm": 0,
            },
            "stair-bad-span": {
                "kind": "stair",
                "id": "stair-bad-span",
                "baseLevelId": "lvl-2",
                "topLevelId": "lvl-1",
            },
            "wall-host": {
                "kind": "wall",
                "id": "wall-host",
                "levelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
            "opening-mismatch": {
                "kind": "wall_opening",
                "id": "opening-mismatch",
                "hostWallId": "wall-host",
                "levelId": "lvl-2",
            },
        }
    )

    assert "model_integrity_level_parent_elevation_mismatch" in _rules(findings)
    assert "model_integrity_level_span_order_invalid" in _rules(findings)
    assert "model_integrity_physical_height_invalid" in _rules(findings)
    assert "model_integrity_host_level_mismatch" in _rules(findings)


def test_valid_storey_spans_and_analytical_room_level_pass() -> None:
    subject = {
        "lvl-1": {"kind": "level", "id": "lvl-1", "elevationMm": 0},
        "lvl-2": {"kind": "level", "id": "lvl-2", "elevationMm": 3000},
        "lvl-child": {
            "kind": "level",
            "id": "lvl-child",
            "parentLevelId": "lvl-1",
            "offsetFromParentMm": 1500,
            "elevationMm": 1500,
        },
        "wall-1": {
            "kind": "wall",
            "id": "wall-1",
            "levelId": "lvl-1",
            "topConstraintLevelId": "lvl-2",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 1000, "yMm": 0},
            "heightMm": 2800,
        },
        "room-1": {
            "kind": "room",
            "id": "room-1",
            "levelId": "lvl-1",
            "upperLimitLevelId": "lvl-2",
            "outlineMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
            ],
        },
    }

    assert check_model_integrity_invariants(subject) == []


def test_physical_helper_role_mismatch_and_missing_explicit_role_are_reported() -> None:
    findings = check_model_integrity_invariants(
        {
            "lvl-1": {"kind": "level", "id": "lvl-1"},
            "wall-helper": {
                "kind": "wall",
                "id": "wall-helper",
                "levelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
                "props": {"modelRole": "helper"},
            },
            "wall-no-explicit-role": {
                "kind": "wall",
                "id": "wall-no-explicit-role",
                "levelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
            "sep-physical": {
                "kind": "room_separation",
                "id": "sep-physical",
                "levelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
                "modelRole": "physical",
            },
        },
        require_explicit_roles=True,
    )

    assert "model_integrity_role_kind_mismatch" in _rules(findings)
    assert "model_integrity_missing_explicit_model_role" in _rules(findings)


def test_generic_document_invariants_catch_bad_shape_and_key_mismatch() -> None:
    bad_shape = check_model_integrity_invariants(["not", "a", "document"])
    assert bad_shape[0].rule_id == "model_integrity_invalid_document_shape"

    findings = check_model_integrity_invariants(
        {
            "map-id": {"kind": "level", "id": "element-id"},
            "missing-kind": {"id": "missing-kind"},
            "unknown-kind": {"kind": "made_up", "id": "unknown-kind"},
        }
    )

    assert "model_integrity_element_key_mismatch" in _rules(findings)
    assert "model_integrity_missing_kind" in _rules(findings)
    assert "model_integrity_unclassified_kind" in _rules(findings)


def test_units_and_coordinate_normalization_findings_are_deterministic() -> None:
    findings = check_model_integrity_invariants(
        {
            "elements": {
                "settings": {
                    "kind": "project_settings",
                    "id": "settings",
                    "lengthUnit": "feet",
                },
                "lvl-1": {"kind": "level", "id": "lvl-1", "elevationMm": 0},
                "wall-legacy": {
                    "kind": "wall",
                    "id": "wall-legacy",
                    "levelId": "lvl-1",
                    "start": {"x": 0, "y": 0},
                    "end": {"xMm": 1000, "yMm": 0},
                    "heightMm": float("inf"),
                },
            }
        }
    )

    assert "model_integrity_unsupported_length_unit" in _rules(findings)
    assert "model_integrity_coordinate_not_normalized" in _rules(findings)
    assert "model_integrity_unit_value_non_finite" in _rules(findings)

    units = model_integrity_units_coordinate_normalization_v1(
        {
            "elements": {
                "lvl-1": {"kind": "level", "id": "lvl-1", "elevationMm": 0},
                "wall-1": {
                    "kind": "wall",
                    "id": "wall-1",
                    "levelId": "lvl-1",
                    "start": {"xMm": 0, "yMm": 0},
                    "end": {"xMm": 1000, "yMm": 0},
                },
            }
        }
    )
    assert units["format"] == "modelIntegrityUnitsCoordinateNormalization_v1"
    assert units["canonicalLengthUnit"] == "millimeter"
    assert units["ok"] is True


def test_type_instance_inheritance_helper_and_findings() -> None:
    subject = {
        "elements": {
            "lvl-1": {"kind": "level", "id": "lvl-1"},
            "wall-type-1": {
                "kind": "wall_type",
                "id": "wall-type-1",
                "name": "Layered wall",
                "layers": [
                    {"thicknessMm": 140, "function": "structure", "materialKey": "block"},
                    {"thicknessMm": 60, "function": "finish", "materialKey": "plaster"},
                ],
            },
            "wall-1": {
                "kind": "wall",
                "id": "wall-1",
                "levelId": "lvl-1",
                "wallTypeId": "wall-type-1",
                "thicknessMm": 250,
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
            "family-type-1": {
                "kind": "family_type",
                "id": "family-type-1",
                "name": "Table",
                "parameters": {"widthMm": 900, "heightMm": 740},
            },
            "family-1": {
                "kind": "family_instance",
                "id": "family-1",
                "familyTypeId": "family-type-1",
                "levelId": "lvl-1",
                "positionMm": {"xMm": 500, "yMm": 500},
                "paramValues": {"widthMm": 1200},
            },
            "family-missing-type": {
                "kind": "family_instance",
                "id": "family-missing-type",
                "levelId": "lvl-1",
                "positionMm": {"xMm": 600, "yMm": 500},
            },
        }
    }

    inheritance = resolve_type_instance_inheritance_v1(subject)
    assert inheritance["format"] == "modelIntegrityTypeInstanceInheritance_v1"
    assert inheritance["resolvedCount"] == 2
    wall_row = next(row for row in inheritance["rows"] if row["elementId"] == "wall-1")
    family_row = next(row for row in inheritance["rows"] if row["elementId"] == "family-1")
    assert wall_row["resolved"]["assemblyThicknessMm"] == 200
    assert wall_row["overrideKeys"] == ["thicknessMm"]
    assert family_row["resolved"]["parameters"] == {"heightMm": 740, "widthMm": 1200}
    assert len(inheritance["digestSha256"]) == 64

    findings = check_model_integrity_invariants(subject)
    assert "model_integrity_type_reference_missing" in _rules(findings)


def test_type_instance_wrong_kind_and_type_layer_shape_are_reported() -> None:
    findings = check_model_integrity_invariants(
        {
            "elements": {
                "lvl-1": {"kind": "level", "id": "lvl-1"},
                "wrong-type": {"kind": "floor_type", "id": "wrong-type", "layers": []},
                "bad-wall-type": {
                    "kind": "wall_type",
                    "id": "bad-wall-type",
                    "layers": [{"thicknessMm": -1}],
                },
                "wall-1": {
                    "kind": "wall",
                    "id": "wall-1",
                    "levelId": "lvl-1",
                    "wallTypeId": "wrong-type",
                    "start": {"xMm": 0, "yMm": 0},
                    "end": {"xMm": 1000, "yMm": 0},
                },
            }
        }
    )

    assert "model_integrity_type_reference_wrong_kind" in _rules(findings)
    assert "model_integrity_type_layer_thickness_invalid" in _rules(findings)
    assert "model_integrity_type_layer_function_missing" in _rules(findings)


def test_schema_migration_compatibility_rejects_unsupported_versions() -> None:
    compatible = schema_migration_compatibility_v1(
        {"schemaVersion": "cmd-v3.0", "commands": [], "assumptions": []}
    )
    incompatible = schema_migration_compatibility_v1({"schemaVersion": "cmd-v2.0"})

    assert compatible["ok"] is True
    assert incompatible["ok"] is False
    assert incompatible["findings"][0]["ruleId"] == "model_integrity_schema_version_unsupported"


def test_smoke_payload_and_contract_are_machine_readable() -> None:
    smoke = model_integrity_smoke_v1(
        {"elements": {"wall-1": {"kind": "wall", "id": "wall-1"}}}
    )
    contract = model_integrity_invariant_contract_v1()
    evidence = model_integrity_smoke_command_evidence_v1(
        {"elements": {"wall-1": {"kind": "wall", "id": "wall-1"}}}
    )

    assert smoke["format"] == "modelIntegritySmoke_v1"
    assert smoke["ok"] is False
    assert smoke["countsBySeverity"]["error"] >= 1
    assert smoke["findings"][0]["ruleId"].startswith("model_integrity_")
    assert contract["format"] == "modelIntegrityInvariantContract_v1"
    assert "BIR-P01" in contract["trackedItems"]
    assert "BIR-P03" in contract["trackedItems"]
    assert "BIR-P06" in contract["trackedItems"]
    assert "BIR-P07" in contract["trackedItems"]
    assert contract["roleByKind"]["wall"] == "physical"
    assert contract["roleByKind"]["room"] == "analytical"
    assert "link_external" in contract["importedProxyKinds"]
    assert contract["unitContracts"]["canonicalLengthUnit"] == "millimeter"
    assert contract["typeInstanceRelations"]
    assert "materialKey" in contract["nestedReferenceFieldPolicy"]["checkedFields"]
    assert "levelStoreySemantics" in contract
    assert smoke["roleCounts"]["physical"] == 1
    assert smoke["coverage"]["checkedReferenceFields"]
    assert evidence["format"] == "modelIntegritySmokeCommandEvidence_v1"
    assert evidence["command"]["cli"].startswith("bim-ai invariant smoke")
    assert "strictRoleSmoke" in evidence["artifacts"]
    assert evidence["artifacts"]["strictRoleSmoke"]["coverage"]["requireExplicitRoles"] is True
    assert len(evidence["digestSha256"]) == 64
