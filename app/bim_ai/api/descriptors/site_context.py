from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# OSM-V3-01 — neighborhood massing import
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="import-neighborhood",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportNeighborhoodInput",
            "type": "object",
            "required": ["lat", "lon"],
            "properties": {
                "lat": {"type": "number", "description": "Origin latitude (WGS-84)"},
                "lon": {"type": "number", "description": "Origin longitude (WGS-84)"},
                "radiusM": {
                    "type": "number",
                    "default": 200.0,
                    "description": "Search radius in metres around the origin.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportNeighborhoodOutput",
            "type": "object",
            "required": ["imported", "masses"],
            "properties": {
                "imported": {"type": "integer"},
                "masses": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Import succeeded"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
            "error": ExitCode(code=1, meaning="Overpass API error or parse failure"),
        },
        cliExample="bim-ai import-neighborhood --lat 48.137 --lon 11.575 --radius-m 200 --model-id m-1",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/v3/models/{modelId}/neighborhood-import"
        ),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Replaces all existing OSM neighborhood_mass elements. "
            "Re-import with the same bbox is idempotent. "
            "Does NOT mutate authored walls, floors, or roofs."
        ),
    )
)

# ---------------------------------------------------------------------------
# TOP-V3-02 — Toposolid subdivision
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-toposolid-subdivision",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidSubdivisionInput",
            "type": "object",
            "required": [
                "modelId",
                "id",
                "hostToposolidId",
                "boundaryMm",
                "finishCategory",
                "materialKey",
            ],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "id": {"type": "string"},
                "hostToposolidId": {"type": "string", "description": "ID of the parent toposolid"},
                "boundaryMm": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["xMm", "yMm"],
                        "properties": {
                            "xMm": {"type": "number"},
                            "yMm": {"type": "number"},
                        },
                    },
                    "minItems": 3,
                    "description": "Closed polygon defining the subdivision region",
                },
                "finishCategory": {
                    "type": "string",
                    "enum": ["paving", "lawn", "road", "planting", "other"],
                },
                "materialKey": {"type": "string"},
                "name": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidSubdivisionOutput",
            "type": "object",
            "properties": {
                "ok": {"type": "boolean"},
                "revision": {"type": "integer"},
                "id": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Subdivision created"),
            "not_found": ExitCode(code=1, meaning="Host toposolid not found"),
            "conflict": ExitCode(code=2, meaning="Element id already exists"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains create_toposolid_subdivision",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Host toposolid must exist. Boundary outside host footprint triggers a warning "
            "agent_deviation (not a 400). finishCategory must be one of: paving, lawn, road, "
            "planting, other."
        ),
    )
)
