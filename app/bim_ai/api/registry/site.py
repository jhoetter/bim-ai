"""Site/terrain graded-region descriptors.

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
# VG-V3-01 — Visual comparison tool
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-graded-region",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateGradedRegionInput",
            "type": "object",
            "required": ["modelId", "hostToposolidId", "boundaryMm", "targetMode"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "id": {"type": "string"},
                "hostToposolidId": {
                    "type": "string",
                    "description": "Id of the host toposolid element",
                },
                "boundaryMm": {
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
                    "description": "Closed boundary polygon (≥ 3 vertices) in plan mm",
                },
                "targetMode": {
                    "type": "string",
                    "enum": ["flat", "slope"],
                    "description": "'flat' levels the region to targetZMm; 'slope' grades along slopeAxisDeg at slopeDegPercent",
                },
                "targetZMm": {
                    "type": "number",
                    "description": "Target elevation in mm; required for flat mode",
                },
                "slopeAxisDeg": {
                    "type": "number",
                    "description": "Slope axis direction in degrees; required for slope mode",
                },
                "slopeDegPercent": {
                    "type": "number",
                    "description": "Slope gradient in percent; required for slope mode",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateGradedRegionOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Graded region created"),
            "error": ExitCode(code=1, meaning="Validation error or host toposolid not found"),
        },
        cliExample=(
            "bim-ai create-graded-region "
            "--hostToposolidId topo-1 "
            '--boundary \'[{"xMm":0,"yMm":0},{"xMm":5000,"yMm":0},{"xMm":5000,"yMm":5000}]\' '
            "--targetMode flat --targetZMm 0"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "TOP-V3-04: supply targetZMm for flat mode, or slopeAxisDeg + slopeDegPercent for slope mode. "
            "hostToposolidId must reference an existing toposolid."
        ),
    )
)
