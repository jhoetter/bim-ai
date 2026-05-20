from __future__ import annotations

from typing import Any

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# TOP-V3-01 — Toposolid tool descriptors
# ---------------------------------------------------------------------------

_TOPOSOLID_BOUNDARY_SCHEMA: dict[str, Any] = {
    "type": "array",
    "minItems": 3,
    "items": {
        "type": "object",
        "required": ["xMm", "yMm"],
        "properties": {
            "xMm": {"type": "number"},
            "yMm": {"type": "number"},
        },
    },
}

register(
    ToolDescriptor(
        name="toposolid-create",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId", "boundaryMm"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
                "name": {"type": "string"},
                "boundaryMm": _TOPOSOLID_BOUNDARY_SCHEMA,
                "heightSamples": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["xMm", "yMm", "zMm"],
                        "properties": {
                            "xMm": {"type": "number"},
                            "yMm": {"type": "number"},
                            "zMm": {"type": "number"},
                        },
                    },
                },
                "heightmapGridMm": {
                    "type": "object",
                    "required": ["stepMm", "rows", "cols", "values"],
                    "properties": {
                        "stepMm": {"type": "number"},
                        "rows": {"type": "integer"},
                        "cols": {"type": "integer"},
                        "values": {"type": "array", "items": {"type": "number"}},
                    },
                },
                "thicknessMm": {"type": "number", "default": 1500},
                "baseElevationMm": {"type": "number"},
                "defaultMaterialKey": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid created"),
            "error": ExitCode(code=1, meaning="Validation error or duplicate id"),
        },
        cliExample=(
            "bim-ai toposolid create "
            '--boundary \'[{"xMm":0,"yMm":0},{"xMm":10000,"yMm":0},{"xMm":10000,"yMm":10000},{"xMm":0,"yMm":10000}]\' '
            "--thickness 1500"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "TOP-V3-01: supply either heightSamples (sparse) or heightmapGridMm (grid), not both. "
            "Omitting both creates a flat-starter terrain at baseElevationMm."
        ),
    )
)

register(
    ToolDescriptor(
        name="toposolid-update",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
                "name": {"type": "string"},
                "thicknessMm": {"type": "number"},
                "baseElevationMm": {"type": "number"},
                "defaultMaterialKey": {"type": "string"},
                "pinned": {"type": "boolean"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid updated"),
            "not_found": ExitCode(code=1, meaning="toposolidId not found"),
        },
        cliExample="bim-ai toposolid update topo-1 --thickness 2000",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
    )
)

register(
    ToolDescriptor(
        name="toposolid-delete",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid deleted"),
            "not_found": ExitCode(code=1, meaning="toposolidId not found"),
        },
        cliExample="bim-ai toposolid delete topo-1",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Emits a warning advisory (not an error) if floor elements reference "
            "this toposolid as their host before deletion."
        ),
    )
)
