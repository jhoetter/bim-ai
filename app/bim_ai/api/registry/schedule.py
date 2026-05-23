"""Schedule view and element-property descriptors.

Extracted from registry.py (BRT-25).
"""

from __future__ import annotations

from bim_ai.api.registry_core import (
    ExitCode,
    RestEndpoint,
    ToolDescriptor,
    register,
)

# ---------------------------------------------------------------------------
# SCH-V3-01 — Custom-properties + schedule view
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-schedule-view",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateScheduleViewInput",
            "type": "object",
            "required": ["id", "name", "category"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "category": {"type": "string"},
                "columns": {"type": "array", "items": {"type": "object"}},
                "filterExpr": {"type": "string"},
                "sortKey": {"type": "string"},
                "sortDir": {"type": "string", "enum": ["asc", "desc"]},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateScheduleViewOutput",
            "type": "object",
            "properties": {
                "scheduleId": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Schedule view created"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai create-schedule-view --id sv-1 --name 'Wall Schedule' --category wall",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
    )
)

register(
    ToolDescriptor(
        name="set-element-prop",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetElementPropInput",
            "type": "object",
            "required": ["elementId", "key", "value"],
            "properties": {
                "elementId": {"type": "string"},
                "key": {"type": "string"},
                "value": {},
            },
        },
        outputSchema={"type": "object"},
        exitCodes={
            "ok": ExitCode(code=0, meaning="Custom property set on element"),
            "not_found": ExitCode(code=1, meaning="elementId not found in document"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains set_element_prop command",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Merges into element.props dict. Element must exist; unknown elementId raises 400.",
    )
)
