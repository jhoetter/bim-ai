from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# AST-V3-04 — Parametric kitchen kit
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="place-kitchen-kit",
        category="mutation",
        inputSchema={
            "type": "object",
            "required": ["id", "hostWallId", "startMm", "endMm"],
            "properties": {
                "id": {"type": "string"},
                "kitId": {
                    "type": "string",
                    "enum": ["kitchen_modular"],
                    "default": "kitchen_modular",
                },
                "hostWallId": {"type": "string"},
                "startMm": {"type": "number"},
                "endMm": {"type": "number"},
                "components": {"type": "array", "items": {"type": "object"}},
                "countertopDepthMm": {"type": "number", "default": 600},
                "countertopMaterialId": {"type": "string"},
            },
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes={
            "ok": ExitCode(code=0, meaning="Kitchen kit placed"),
            "not_found": ExitCode(code=1, meaning="hostWallId not found"),
        },
        cliExample="bim-ai place-kitchen-kit --id kit-1 --hostWallId wall-1 --startMm 0 --endMm 4200",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Places a FamilyKitInstanceElem. Call catalog-query with kind=door/window first "
            "to resolve materialId. startMm/endMm are along-wall positions in mm."
        ),
    )
)

# ---------------------------------------------------------------------------
# M4-D — Families, assets, materials, decals typed parity aliases
# ---------------------------------------------------------------------------

_M4D_MUTATION_CODES = {
    "ok": ExitCode(code=0, meaning="Bundle applied or validated"),
    "not_found": ExitCode(code=1, meaning="Referenced model element not found"),
    "error": ExitCode(code=1, meaning="Unexpected error"),
}

register(
    ToolDescriptor(
        name="family.upsert_type",
        category="mutation",
        inputSchema={
            "title": "FamilyUpsertTypeInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "familyId": {"type": "string"},
                "discipline": {"type": "string", "enum": ["door", "window", "generic"]},
                "parameters": {"type": "object", "additionalProperties": True},
                "catalogSource": {
                    "type": "object",
                    "required": ["catalogId", "familyId", "version"],
                    "properties": {
                        "catalogId": {"type": "string"},
                        "familyId": {"type": "string"},
                        "version": {"type": "string"},
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample=(
            "bim-ai family upsert-type --id ft-chair --name Chair "
            "--parameters '{\"widthMm\":500}' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates an upsertFamilyType command. Use catalog-query or family catalog routes "
            "first when the type is sourced from a catalog."
        ),
    )
)

register(
    ToolDescriptor(
        name="family.place_instance",
        category="mutation",
        inputSchema={
            "title": "FamilyPlaceInstanceInput",
            "type": "object",
            "required": ["familyTypeId", "positionMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "familyTypeId": {"type": "string"},
                "levelId": {"type": "string"},
                "hostViewId": {"type": "string"},
                "positionMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
                },
                "rotationDeg": {"type": "number"},
                "paramValues": {"type": "object", "additionalProperties": True},
                "hostElementId": {"type": "string"},
                "hostAlongT": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample=(
            "bim-ai family place-instance --family-type ft-chair --level lvl-0 "
            "--pos 1200,900 --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Places a FamilyInstanceElem from an existing family_type. Hosted wall placement "
            "may also create a wall_opening when hostAlongT is provided."
        ),
    )
)

register(
    ToolDescriptor(
        name="asset.query",
        category="query",
        inputSchema={
            "title": "AssetQueryInput",
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "category": {"type": "string"},
                "disciplineTag": {"type": "string", "enum": ["arch", "struct", "mep"]},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"results": {"type": "array"}}},
        exitCodes={"ok": ExitCode(code=0, meaning="Results returned")},
        cliExample="bim-ai catalog query --kind sofa --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/catalog"),
        sideEffects="none",
        agentSafetyNotes="Read-only catalog/library query. Empty result sets are valid evidence.",
    )
)

register(
    ToolDescriptor(
        name="asset.place",
        category="mutation",
        inputSchema={
            "title": "AssetPlaceInput",
            "type": "object",
            "required": ["assetId", "levelId", "positionMm"],
            "properties": {
                "id": {"type": "string"},
                "assetId": {"type": "string"},
                "levelId": {"type": "string"},
                "positionMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
                },
                "rotationDeg": {"type": "number"},
                "paramValues": {"type": "object", "additionalProperties": True},
                "hostElementId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai asset place --asset sofa-2400 --level lvl-0 --pos 2500,1400,0 --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Places an existing AssetLibraryEntry as a PlacedAssetElem.",
    )
)

register(
    ToolDescriptor(
        name="material.query",
        category="query",
        inputSchema={
            "title": "MaterialQueryInput",
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "text": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"materials": {"type": "array"}}},
        exitCodes={"ok": ExitCode(code=0, meaning="Material catalog returned")},
        cliExample="bim-ai query types --category material --text brick",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/registry/type-material"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only access to builtin and document material/type registry evidence; "
            "agents should resolve a material key before assignment."
        ),
    )
)

register(
    ToolDescriptor(
        name="material.upsert_pbr",
        category="mutation",
        inputSchema={
            "title": "MaterialUpsertPbrInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "albedoColor": {"type": "string"},
                "albedoMapId": {"type": "string"},
                "normalMapId": {"type": "string"},
                "roughnessMapId": {"type": "string"},
                "metallicMapId": {"type": "string"},
                "heightMapId": {"type": "string"},
                "uvScaleMm": {"type": "object"},
                "uvRotationDeg": {"type": "number"},
                "hatchPatternId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai material update-pbr --id mat-oak --albedo-map img-oak --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Patches PBR/map fields on an existing MaterialElem through update_material_pbr. "
            "It does not upload image bytes."
        ),
    )
)

register(
    ToolDescriptor(
        name="material.assign",
        category="mutation",
        inputSchema={
            "title": "MaterialAssignInput",
            "type": "object",
            "required": ["elementId", "materialKey"],
            "properties": {
                "elementId": {"type": "string"},
                "materialKey": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"elementId": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai material assign --element wall-1 --material brick_red --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Sets materialKey on element kinds that support the property, currently including walls.",
    )
)

register(
    ToolDescriptor(
        name="material.paint_face",
        category="mutation",
        inputSchema={
            "title": "MaterialPaintFaceInput",
            "type": "object",
            "required": ["elementId", "faceKind", "materialKey"],
            "properties": {
                "elementId": {"type": "string"},
                "faceKind": {"type": "string"},
                "materialKey": {"type": "string"},
                "generatedFaceId": {"type": "string"},
                "uvScaleMm": {"type": "object"},
                "uvRotationDeg": {"type": "number"},
                "uvOffsetMm": {"type": "object"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"elementId": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai material paint-face --element wall-1 --face exterior --material brick_red --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Writes faceMaterialOverrides via set_element_prop. Unsupported element kinds are rejected by the kernel."
        ),
    )
)

register(
    ToolDescriptor(
        name="decal.create",
        category="mutation",
        inputSchema={
            "title": "DecalCreateInput",
            "type": "object",
            "required": ["parentElementId", "parentSurface", "imageAssetId", "uvRect"],
            "properties": {
                "id": {"type": "string"},
                "parentElementId": {"type": "string"},
                "parentSurface": {
                    "type": "string",
                    "enum": ["front", "back", "top", "left", "right", "bottom"],
                },
                "imageAssetId": {"type": "string"},
                "uvRect": {"type": "object"},
                "opacity": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai decal create --parent wall-1 --surface front --image-asset logo-img --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Creates a DecalElem hosted on an existing parent element surface.",
    )
)
