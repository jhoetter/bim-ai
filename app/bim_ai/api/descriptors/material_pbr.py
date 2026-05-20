from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# MAT-V3-01 — Material PBR map slots
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="update-material-pbr",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateMaterialPbrInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string", "description": "ID of the MaterialElem to update."},
                "albedoMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the albedo (diffuse) map.",
                },
                "normalMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the normal map.",
                },
                "roughnessMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the roughness map.",
                },
                "metalnessMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the metalness map.",
                },
                "aoMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the ambient-occlusion map.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateMaterialPbrOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Material PBR maps updated"),
            "not_found": ExitCode(code=1, meaning="materialId not found in document"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains update_material_pbr",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "MAT-V3-01: patches PBR map slot IDs on an existing MaterialElem. "
            "Only provided fields are updated; omitted fields are left unchanged. "
            "Image asset IDs are opaque strings — they are not validated against an asset registry."
        ),
    )
)
