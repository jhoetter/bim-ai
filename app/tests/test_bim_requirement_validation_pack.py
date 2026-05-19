from __future__ import annotations

from bim_ai.bim_requirement_validation_pack import (
    BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
    BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION,
    build_document_bim_requirement_validation_payload,
    compile_bim_requirement_validation_pack,
    validate_bim_requirement_validation_pack,
)
from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    RoomElem,
    ScheduleElem,
    ValidationRuleElem,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
)


def _requirements() -> dict[str, object]:
    return {
        "qualityTarget": "project_initiation_bim",
        "informationRequirements": {
            "exportRequirements": {"outputs": ["IFC", "GLB"]},
            "rooms": [
                {
                    "number": "G-101",
                    "name": "Living",
                    "level": "ground",
                    "function": "living",
                    "targetAreaM2": 20,
                    "boundingStatus": "bounded",
                }
            ],
            "elementSemanticRequirements": [
                {
                    "category": "wall",
                    "expectedBimCategory": "wall",
                    "ifcEntityIntent": "IfcWall",
                }
            ],
            "dataQualityChecks": ["rooms_spaces_bounded_accessible_schedulable"],
        },
    }


def test_backend_compiles_bir_requirement_pack_with_cli_schema_version() -> None:
    pack = compile_bim_requirement_validation_pack(_requirements(), pack_id="ids-rule")

    assert pack["schemaVersion"] == BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION
    assert pack["packId"] == "ids-rule"
    assert pack["summary"]["checkCount"] >= 5
    assert [check["id"] for check in pack["checks"]] == sorted(
        check["id"] for check in pack["checks"]
    )
    assert "bir_semantic_wall_ifcwall" in {check["id"] for check in pack["checks"]}


def test_backend_requirement_pack_validates_against_document_counts() -> None:
    pack = compile_bim_requirement_validation_pack(_requirements())
    doc = Document(
        revision=3,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "room-1": RoomElem(
                kind="room",
                id="room-1",
                name="Living",
                levelId="lvl",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                targetAreaM2=20,
                props={
                    "number": "G-101",
                    "function": "living",
                    "boundingStatus": "bounded",
                },
            ),
        },
    )

    report = validate_bim_requirement_validation_pack(pack, doc=doc)

    assert report["schemaVersion"] == BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION
    assert report["summary"]["errorCount"] == 0


def test_backend_requirement_pack_evaluates_cli_parity_predicates_from_document_evidence() -> None:
    requirements = {
        "qualityTarget": "project_initiation_bim",
        "informationRequirements": {
            "exportRequirements": {"outputs": ["IFC", "GLB", "room schedule"]},
            "rooms": [
                {
                    "number": "G-101",
                    "name": "Living",
                    "level": "ground",
                    "function": "living",
                    "targetAreaM2": 20,
                    "boundingStatus": "bounded",
                }
            ],
            "elementSemanticRequirements": [
                {
                    "category": "wall",
                    "expectedBimCategory": "wall",
                    "ifcEntityIntent": "IfcWall",
                }
            ],
            "materialLayerSetRequirements": [
                {
                    "id": "wall_type_shell",
                    "layerSetName": "Partition shell",
                    "appliesToCategories": ["wall"],
                }
            ],
            "schedules": [
                {
                    "id": "room-schedule",
                    "requiredColumns": ["number", "name", "level", "targetAreaM2", "function"],
                }
            ],
            "classificationRequirements": {"system": "IDS placeholder"},
            "dataQualityChecks": ["rooms_spaces_bounded_accessible_schedulable"],
        },
    }
    pack = compile_bim_requirement_validation_pack(requirements)
    doc = Document(
        revision=5,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wall_type_shell",
                name="Partition shell",
                layers=[WallTypeLayer(thicknessMm=200, function="structure")],
            ),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                wallTypeId="wall_type_shell",
            ),
            "room-1": RoomElem(
                kind="room",
                id="room-1",
                name="Living",
                levelId="lvl",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                targetAreaM2=20,
                props={
                    "number": "G-101",
                    "function": "living",
                    "boundingStatus": "bounded",
                },
            ),
            "room-schedule": ScheduleElem(
                kind="schedule",
                id="room-schedule",
                name="Room Schedule",
                columns=[
                    {"key": "number"},
                    {"key": "name"},
                    {"key": "level"},
                    {"key": "targetAreaM2"},
                    {"key": "function"},
                ],
            ),
        },
    )

    report = validate_bim_requirement_validation_pack(pack, doc=doc)

    assert report["ok"] is True, report["blockers"]
    assert report["summary"]["errorCount"] == 0
    statuses = {row["checkId"]: row["status"] for row in report["checks"]}
    assert statuses["bir_export_output_room-schedule"] == "pass"
    assert statuses["bir_layer_set_wall-type-shell"] == "pass"
    assert statuses["bir_schedule_room-schedule_columns"] == "pass"
    assert statuses["bir_classification_placeholders_present"] == "pass"
    assert statuses["bir_data_quality_rooms-spaces-bounded-accessible-schedulable"] == "pass"


def test_document_payload_exposes_validation_rule_pack_and_report_for_api_parity() -> None:
    doc = Document(
        revision=4,
        elements={
            "ids": ValidationRuleElem(
                kind="validation_rule",
                id="ids",
                name="IDS-like requirements",
                ruleJson=_requirements(),
            )
        },
    )

    payload = build_document_bim_requirement_validation_payload("model-1", doc)

    assert payload["format"] == "bimRequirementValidationApiParity_v1"
    assert payload["validationRuleCount"] == 1
    assert payload["packs"][0]["schemaVersion"] == BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION
    assert payload["reports"][0]["schemaVersion"] == BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION
    assert payload["summary"]["blockerCount"] > 0
