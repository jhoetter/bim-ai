"""Geometry, structure/construction, stair, opening, and railing descriptors.

Extracted from the monolithic registry.py (BRT-25). Imported at registry
package init time so the register() side-effects fire in their original
sequence.
"""

from __future__ import annotations

from typing import Any

from bim_ai.api.registry._shared import (
    _CMD_V3_BUNDLE_OUTPUT_SCHEMA,
    _POINT_2_SCHEMA,
)
from bim_ai.api.registry_core import (
    ExitCode,
    RestEndpoint,
    ToolDescriptor,
    register,
)

_SLAB_OPENING_INPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SlabOpeningInput",
    "type": "object",
    "required": ["hostFloorId", "boundaryMm"],
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "hostFloorId": {"type": "string"},
        "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
        "isShaft": {"type": "boolean", "default": False},
    },
    "additionalProperties": False,
}

_STRUCTURE_CONSTRUCTION_SCHEMAS: dict[str, dict[str, Any]] = {
    "structure.column": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureColumnInput",
        "type": "object",
        "required": ["levelId", "positionMm"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "levelId": {"type": "string"},
            "positionMm": _POINT_2_SCHEMA,
            "bMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
            "hMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
            "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 2800},
            "rotationDeg": {"type": "number", "default": 0},
            "materialKey": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "structure.beam": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureBeamInput",
        "type": "object",
        "required": ["levelId", "startMm", "endMm"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "levelId": {"type": "string"},
            "startMm": _POINT_2_SCHEMA,
            "endMm": _POINT_2_SCHEMA,
            "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 200},
            "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 400},
            "materialKey": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "structure.column_update": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureColumnUpdateInput",
        "type": "object",
        "required": ["id"],
        "properties": {
            "id": {"type": "string"},
            "bMm": {"type": "number", "exclusiveMinimum": 0},
            "hMm": {"type": "number", "exclusiveMinimum": 0},
        },
        "additionalProperties": False,
    },
    "structure.constraint": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureConstraintInput",
        "type": "object",
        "required": ["rule", "refsA", "refsB"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "rule": {
                "type": "string",
                "enum": [
                    "equal_distance",
                    "equal_length",
                    "parallel",
                    "perpendicular",
                    "collinear",
                ],
            },
            "refsA": {"type": "array", "minItems": 1, "items": {"type": "object"}},
            "refsB": {"type": "array", "minItems": 1, "items": {"type": "object"}},
            "lockedValueMm": {"type": "number"},
            "severity": {"type": "string", "enum": ["warning", "error"], "default": "error"},
        },
        "additionalProperties": False,
    },
    "construction.package": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionPackageInput",
        "type": "object",
        "required": ["name"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "code": {"type": "string"},
            "phaseId": {"type": "string"},
            "plannedStart": {"type": "string"},
            "plannedEnd": {"type": "string"},
            "actualStart": {"type": "string"},
            "actualEnd": {"type": "string"},
            "responsibleCompany": {"type": "string"},
            "dependencies": {"type": "array", "items": {"type": "string"}},
        },
        "additionalProperties": False,
    },
    "construction.logistics": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionLogisticsInput",
        "type": "object",
        "required": ["name", "logisticsKind"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "logisticsKind": {"type": "string"},
            "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
            "pathMm": {"type": "array", "minItems": 2, "items": _POINT_2_SCHEMA},
            "phaseId": {"type": "string"},
            "constructionPackageId": {"type": "string"},
            "plannedStart": {"type": "string"},
            "plannedEnd": {"type": "string"},
            "progressStatus": {"type": "string"},
            "responsibleCompany": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "construction.qa_checklist": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionQaChecklistInput",
        "type": "object",
        "required": ["name"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "targetElementIds": {"type": "array", "items": {"type": "string"}},
            "constructionPackageId": {"type": "string"},
            "phaseId": {"type": "string"},
            "responsibleCompany": {"type": "string"},
            "progressStatus": {"type": "string"},
            "checklist": {"type": "array", "items": {"type": "object"}},
        },
        "additionalProperties": False,
    },
}

for _tool_name, _schema in _STRUCTURE_CONSTRUCTION_SCHEMAS.items():
    _group = "structure" if _tool_name.startswith("structure.") else "construction"
    register(
        ToolDescriptor(
            name=_tool_name,
            category="mutation",
            inputSchema=_schema,
            outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Typed semantic authoring bundle generated"),
                "invalid": ExitCode(code=422, meaning="Invalid semantic authoring payload"),
            },
            cliExample=f"bim-ai {_group} {_tool_name.split('.', 1)[1].replace('_', '-')} --json",
            restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
            sideEffects="mutates-kernel",
            agentSafetyNotes=(
                "Generates typed kernel commands only; submit through model.dry_run or "
                "model.commit_bundle for revision, permission, and advisor checks."
            ),
            schemaRefs=[f"input:{_schema['title']}", "output:SemanticAuthoringBundle"],
            exampleRefs=[f"cli:{_group}:{_tool_name.split('.', 1)[1]}"],
            resourceGroups=["semantic-authoring", _group, "kernel-command"],
            uiFeatures=(
                ["tool:structure", "cmd-k:structure-lens"]
                if _group == "structure"
                else ["lens:construction", "cmd-k:construction-lens"]
            ),
        )
    )

register(
    ToolDescriptor(
        name="author.stair_between_levels",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairBetweenLevelsInput",
            "type": "object",
            "required": ["baseLevelId", "topLevelId", "runStartMm", "runEndMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "baseLevelId": {"type": "string"},
                "topLevelId": {"type": "string"},
                "runStartMm": _POINT_2_SCHEMA,
                "runEndMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 1000},
                "riserMm": {"type": "number", "exclusiveMinimum": 0, "default": 175},
                "treadMm": {"type": "number", "exclusiveMinimum": 0, "default": 275},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createStair bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid stair payload"),
        },
        cliExample=(
            "bim-ai author stair-between-levels --base-level lvl-0 --top-level lvl-1 "
            "--run '1000,1000;1000,4200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates createStair only; submit through model.dry_run or model.commit_bundle for "
            "transaction safety and advisor validation."
        ),
        schemaRefs=["input:StairBetweenLevelsInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:author:stair-between-levels"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "kernel-command"],
        uiFeatures=["tool:stair", "cmd-k:tool.stair"],
    )
)

register(
    ToolDescriptor(
        name="author.stair_by_runs",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairByRunsInput",
            "type": "object",
            "required": ["baseLevelId", "topLevelId", "runs"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "baseLevelId": {"type": "string"},
                "topLevelId": {"type": "string"},
                "runStartMm": _POINT_2_SCHEMA,
                "runEndMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 1000},
                "riserMm": {"type": "number", "exclusiveMinimum": 0, "default": 175},
                "treadMm": {"type": "number", "exclusiveMinimum": 0, "default": 275},
                "shape": {
                    "type": "string",
                    "enum": ["straight", "l_shape", "u_shape", "spiral", "sketch"],
                },
                "runs": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "required": ["id", "startMm", "endMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "startMm": _POINT_2_SCHEMA,
                            "endMm": _POINT_2_SCHEMA,
                            "widthMm": {"type": "number", "exclusiveMinimum": 0},
                            "riserCount": {"type": "integer", "minimum": 1},
                            "polylineMm": {"type": "array", "items": _POINT_2_SCHEMA},
                        },
                        "additionalProperties": False,
                    },
                },
                "landings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "boundaryMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "boundaryMm": {
                                "type": "array",
                                "minItems": 3,
                                "items": _POINT_2_SCHEMA,
                            },
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed multi-run createStair bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid stair-by-runs payload"),
        },
        cliExample="bim-ai author stair-by-runs --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates createStair with explicit runs/landings; submit through dry-run and "
            "Advisor before acceptance."
        ),
        schemaRefs=["input:StairByRunsInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["route:author.stair_by_runs"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "kernel-command"],
        uiFeatures=["tool:stair", "cmd-k:tool.stair"],
    )
)

register(
    ToolDescriptor(
        name="author.stair_by_sketch",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairBySketchInput",
            "type": "object",
            "required": [
                "baseLevelId",
                "topLevelId",
                "runStartMm",
                "runEndMm",
                "boundaryMm",
                "treadLines",
                "totalRiseMm",
            ],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "baseLevelId": {"type": "string"},
                "topLevelId": {"type": "string"},
                "runStartMm": _POINT_2_SCHEMA,
                "runEndMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 1000},
                "riserMm": {"type": "number", "exclusiveMinimum": 0, "default": 175},
                "treadMm": {"type": "number", "exclusiveMinimum": 0, "default": 275},
                "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
                "treadLines": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "required": ["fromMm", "toMm"],
                        "properties": {
                            "fromMm": _POINT_2_SCHEMA,
                            "toMm": _POINT_2_SCHEMA,
                            "riserHeightMm": {"type": "number", "exclusiveMinimum": 0},
                            "manualOverride": {"type": "boolean"},
                        },
                        "additionalProperties": False,
                    },
                },
                "totalRiseMm": {"type": "number", "exclusiveMinimum": 0},
                "landings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "boundaryMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "boundaryMm": {
                                "type": "array",
                                "minItems": 3,
                                "items": _POINT_2_SCHEMA,
                            },
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed by-sketch createStair bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid stair-by-sketch payload"),
        },
        cliExample="bim-ai author stair-by-sketch --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates createStair authoringMode=by_sketch from explicit boundary and tread "
            "lines; dry-run and inspect Advisor before commit."
        ),
        schemaRefs=["input:StairBySketchInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["route:author.stair_by_sketch"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "kernel-command"],
        uiFeatures=["tool:stair", "cmd-k:tool.stair"],
    )
)

register(
    ToolDescriptor(
        name="author.stair_existing_condition",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairExistingConditionInput",
            "type": "object",
            "required": ["stairId", "findingCodes", "reason", "sourceFactIds"],
            "properties": {
                "stairId": {"type": "string"},
                "findingCodes": {"type": "array", "minItems": 1, "items": {"type": "string"}},
                "reason": {"type": "string", "minLength": 1},
                "sourceFactIds": {"type": "array", "minItems": 1, "items": {"type": "string"}},
                "reviewer": {"type": "string"},
                "accepted": {"type": "boolean", "default": True},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(
                code=0, meaning="Typed existing-condition stair tolerance bundle generated"
            ),
            "invalid": ExitCode(code=422, meaning="Invalid existing-condition stair payload"),
        },
        cliExample="bim-ai author stair-existing-condition --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use only for source-evidenced existing-building nonconformance. It records "
            "explicit tolerated finding codes on the stair and must be backed by source facts."
        ),
        schemaRefs=["input:StairExistingConditionInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["route:author.stair_existing_condition"],
        resourceGroups=[
            "semantic-authoring",
            "vertical-circulation",
            "reverse-bim",
            "kernel-command",
        ],
        uiFeatures=["advisor-panel", "tool:stair"],
    )
)

register(
    ToolDescriptor(
        name="opening.slab_opening",
        category="mutation",
        inputSchema=_SLAB_OPENING_INPUT_SCHEMA,
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createSlabOpening bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid slab opening payload"),
        },
        cliExample=(
            "bim-ai opening slab-opening --floor floor-1 --boundary "
            "'1000,1000;2200,1000;2200,2200;1000,2200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Host floor id must be resolved before calling; dry-run before commit.",
        schemaRefs=["input:SlabOpeningInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:opening:slab-opening"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "opening", "kernel-command"],
        uiFeatures=["tool:vertical-opening", "cmd-k:tool.floor-opening"],
    )
)

register(
    ToolDescriptor(
        name="opening.shaft_opening",
        category="mutation",
        inputSchema={
            **_SLAB_OPENING_INPUT_SCHEMA,
            "title": "ShaftOpeningInput",
            "properties": {
                **_SLAB_OPENING_INPUT_SCHEMA["properties"],
                "isShaft": {"type": "boolean", "const": True, "default": True},
            },
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed shaft createSlabOpening bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid shaft opening payload"),
        },
        cliExample=(
            "bim-ai opening shaft-opening --floor floor-1 --boundary "
            "'1000,1000;2200,1000;2200,2200;1000,2200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Creates one shaft-marked slab opening on an explicit floor. Multi-floor shaft "
            "propagation still requires one typed opening per host floor."
        ),
        schemaRefs=["input:ShaftOpeningInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:opening:shaft-opening"],
        resourceGroups=[
            "semantic-authoring",
            "vertical-circulation",
            "opening",
            "shaft",
            "kernel-command",
        ],
        uiFeatures=["tool:shaft-opening", "cmd-k:tool.shaft"],
    )
)

register(
    ToolDescriptor(
        name="author.railing",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RailingInput",
            "type": "object",
            "required": ["pathMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "hostedStairId": {"type": "string"},
                "hostFloorId": {"type": "string"},
                "hostWallId": {"type": "string"},
                "hostEdgeId": {"type": "string"},
                "pathMm": {"type": "array", "minItems": 2, "items": _POINT_2_SCHEMA},
                "guardHeightMm": {"type": "number", "exclusiveMinimum": 0},
                "balusterPattern": {"type": "object"},
                "handrailSupports": {"type": "array", "items": {"type": "object"}},
                "materialSlots": {"type": "object"},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createRailing bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid railing payload"),
        },
        cliExample="bim-ai author railing --hosted-stair stair-1 --path '1000,1000;1000,4200' --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Railing path is explicit 2D model geometry. Use hostedStairId when it follows a stair; "
            "dry-run catches invalid baluster/support payloads."
        ),
        schemaRefs=["input:RailingInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:author:railing"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "railing", "kernel-command"],
        uiFeatures=["tool:railing", "cmd-k:tool.railing"],
    )
)
