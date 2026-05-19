from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, WallElem
from bim_ai.model_integrity import (
    check_model_integrity_invariants,
    model_integrity_invariant_contract_v1,
    model_integrity_smoke_v1,
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


def test_smoke_payload_and_contract_are_machine_readable() -> None:
    smoke = model_integrity_smoke_v1(
        {"elements": {"wall-1": {"kind": "wall", "id": "wall-1"}}}
    )
    contract = model_integrity_invariant_contract_v1()

    assert smoke["format"] == "modelIntegritySmoke_v1"
    assert smoke["ok"] is False
    assert smoke["countsBySeverity"]["error"] >= 1
    assert smoke["findings"][0]["ruleId"].startswith("model_integrity_")
    assert contract["format"] == "modelIntegrityInvariantContract_v1"
    assert "BIR-P01" in contract["trackedItems"]
    assert contract["roleByKind"]["wall"] == "physical"
