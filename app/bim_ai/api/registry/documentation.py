"""Documentation, sheet-pack, export, and tool-pref descriptors.

Extracted from registry.py (BRT-25).
"""

from __future__ import annotations

from typing import Any

from bim_ai.api.registry._shared import (
    _POINT_2_SCHEMA,
    _SHEET_VIEWPORT_SCHEMA,
)
from bim_ai.api.registry_core import (
    ExitCode,
    RestEndpoint,
    ToolDescriptor,
    register,
)

register(
    ToolDescriptor(
        name="document.create_drawing_set",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateDrawingSetInput",
            "type": "object",
            "required": ["modelId", "sheet"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "parentRevision": {
                    "type": "integer",
                    "description": "Optimistic-concurrency lock passed into the cmd-v3 bundle.",
                },
                "sheet": {
                    "type": "object",
                    "required": ["id", "name"],
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "titleBlock": {"type": "string"},
                        "paperWidthMm": {"type": "number"},
                        "paperHeightMm": {"type": "number"},
                        "titleblockParameters": {
                            "type": "object",
                            "additionalProperties": {"type": "string"},
                        },
                    },
                    "additionalProperties": False,
                },
                "viewportsMm": {
                    "type": "array",
                    "items": _SHEET_VIEWPORT_SCHEMA,
                    "description": "Sheet viewport placements written by upsertSheetViewports.",
                },
                "schedules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "name"],
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "sheetId": {"type": "string"},
                            "filters": {"type": "object"},
                            "grouping": {"type": "object"},
                        },
                        "additionalProperties": False,
                    },
                },
                "tags": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["hostElementId", "hostViewId", "positionMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "hostElementId": {"type": "string"},
                            "hostViewId": {"type": "string"},
                            "positionMm": _POINT_2_SCHEMA,
                            "tagDefinitionId": {"type": "string"},
                            "textOverride": {"type": "string"},
                        },
                        "additionalProperties": False,
                    },
                },
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["levelId", "aMm", "bMm", "offsetMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "levelId": {"type": "string"},
                            "aMm": _POINT_2_SCHEMA,
                            "bMm": _POINT_2_SCHEMA,
                            "offsetMm": _POINT_2_SCHEMA,
                            "anchorA": {"type": "object"},
                            "anchorB": {"type": "object"},
                            "refElementIdA": {"type": "string"},
                            "refElementIdB": {"type": "string"},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DrawingSetBundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "elements": {"type": "object"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "artifactOutputs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["kind", "route"],
                        "properties": {
                            "kind": {"type": "string", "enum": ["pdf", "ifc", "gltf", "glb"]},
                            "route": {"type": "string"},
                            "contentType": {"type": "string"},
                        },
                    },
                    "description": "Follow-up export routes available after commit.",
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Drawing set bundle committed or dry-run validated"),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "invalid_bundle": ExitCode(code=1, meaning="Generated documentation bundle invalid"),
        },
        cliExample=(
            "bim-ai documentation pack --sheet-id A101 --sheet-name 'GA Plan' "
            '--viewports \'[{"viewportId":"vp-plan","viewRef":"plan:plan-gf","xMm":20,"yMm":20,"widthMm":160,"heightMm":110}]\' '
            "--schedule-id sch-rooms --schedule-category room --place-schedule --dry-run"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Creates/replaces documentation elements through cmd-v3 commands: upsertSheet, "
            "upsertSheetViewports, upsertSchedule, placeTag, and createDimension. "
            "Use dry_run before commit. Exports are separate read-only routes; this tool mutates only "
            "model documentation state and does not write external files by itself."
        ),
        schemaRefs=["input:CreateDrawingSetInput", "output:DrawingSetBundleResult"],
        exampleRefs=["cli:documentation:pack"],
        kernelCommands=[
            "upsertSheet",
            "upsertSheetViewports",
            "upsertSchedule",
            "placeTag",
            "createDimension",
        ],
        resourceGroups=["document", "sheet", "viewport", "schedule", "tag", "dimension"],
        uiFeatures=[
            "group:sheet",
            "group:schedule",
            "group:documentation",
            "export:pdf",
        ],
    )
)

register(
    ToolDescriptor(
        name="presentation-documentation-pack",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationDocumentationPackInput",
            "type": "object",
            "required": ["modelId", "sheetId", "canvasId", "viewId"],
            "properties": {
                "modelId": {"type": "string"},
                "sheetId": {"type": "string"},
                "canvasId": {"type": "string"},
                "viewId": {"type": "string"},
                "brandTemplateId": {"type": "string", "default": "bt-client-pack"},
                "scheduleId": {"type": "string", "default": "sch-client-pack"},
                "scheduleCategory": {"type": "string", "default": "room"},
                "frames": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Optional create_frame payload fragments for deck slides.",
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationDocumentationPackResult",
            "type": "object",
            "required": ["ok", "revision"],
            "properties": {
                "ok": {"type": "boolean"},
                "revision": {"type": "integer"},
                "appliedCommands": {"type": "array", "items": {"type": "object"}},
                "evidenceRoutes": {
                    "type": "object",
                    "properties": {
                        "presentation": {"type": "string"},
                        "brandedPdf": {"type": "string"},
                        "renderBundle": {"type": "string"},
                    },
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(
                code=0,
                meaning="Presentation/documentation pack committed or dry-run validated",
            ),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "invalid_bundle": ExitCode(code=1, meaning="Generated presentation pack invalid"),
        },
        cliExample=(
            "bim-ai documentation presentation-pack --sheet-id A101 --canvas-id deck-client "
            "--view-id plan-gf --brand-template-id bt-client --schedule-id sch-rooms --dry-run"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Creates a client-facing pack through typed commands: create_brand_template, "
            "upsertViewTemplate, applyPlanViewTemplate, upsertSheet, upsertSchedule, "
            "create_schedule_view, upsertSheetViewports, createRevisionCloud, "
            "create_presentation_canvas, and create_frame. Follow with read-only "
            "presentation, branded PDF, render bundle, and documentation evidence exports."
        ),
        schemaRefs=[
            "input:PresentationDocumentationPackInput",
            "output:PresentationDocumentationPackResult",
        ],
        exampleRefs=["cli:documentation:presentation-pack"],
        kernelCommands=[
            "create_brand_template",
            "upsertViewTemplate",
            "applyPlanViewTemplate",
            "upsertSheet",
            "upsertSchedule",
            "create_schedule_view",
            "upsertSheetViewports",
            "createRevisionCloud",
            "create_presentation_canvas",
            "create_frame",
        ],
        resourceGroups=[
            "presentation",
            "export",
            "documentation",
            "sheet",
            "schedule",
            "revision",
            "render",
        ],
        uiFeatures=[
            "group:presentation",
            "group:documentation",
            "group:schedule",
            "export:branded-pdf",
            "export:render-bundle",
        ],
    )
)

_EXPORT_BINARY_RESPONSE_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ExportArtifactResponse",
    "type": "object",
    "required": ["artifact", "evidence", "limitations"],
    "properties": {
        "artifact": {
            "type": "object",
            "required": ["contentType", "filename", "route"],
            "properties": {
                "contentType": {"type": "string"},
                "filename": {"type": "string"},
                "route": {"type": "string"},
            },
        },
        "evidence": {
            "type": "object",
            "properties": {
                "manifestRoute": {"type": "string"},
                "determinism": {"type": "string"},
                "correlation": {"type": "string"},
            },
        },
        "limitations": {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": True,
}

register(
    ToolDescriptor(
        name="export.pdf",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportPdfInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "sheetId": {
                    "type": "string",
                    "description": "Optional sheet id; first sheet is used if omitted.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="PDF bytes returned"),
            "not_found": ExitCode(code=1, meaning="Model or sheet not found"),
        },
        cliExample="bim-ai export pdf --sheet-id A101 --out A101.pdf",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/exports/sheet-preview.pdf"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only sheet PDF artifact. The PDF is a server-side sheet preview/export listing path; "
            "full browser print raster is separately exposed as sheet-print-raster.png with contract headers."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportPdfInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:pdf"],
        resourceGroups=["export", "document", "sheet", "pdf"],
        uiFeatures=["project.export-pdf", "group:sheet"],
    )
)

register(
    ToolDescriptor(
        name="export.ifc",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportIfcInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="IFC STEP bytes returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai export ifc --out model.ifc",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/exports/model.ifc"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only IFC STEP export. Use /exports/ifc-manifest for exchange evidence and coverage; "
            "geometry/material coverage is limited to kernel elements currently supported by export_ifc_model_step."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportIfcInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:ifc", "route:export:ifc-manifest"],
        resourceGroups=["export", "ifc"],
        uiFeatures=["project.export-ifc"],
    )
)

register(
    ToolDescriptor(
        name="export.gltf",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportGltfInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="glTF JSON returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai export gltf --out model.gltf",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/exports/model.gltf"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only glTF JSON export. Use /exports/gltf-manifest for visual/export evidence and "
            "material diagnostics; binary GLB is available via export.glb."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportGltfInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:gltf", "route:export:gltf-manifest"],
        resourceGroups=["export", "gltf", "visual"],
        uiFeatures=["project.export-gltf"],
    )
)

register(
    ToolDescriptor(
        name="export.glb",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportGlbInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Binary GLB bytes returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai export glb --out model.glb",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/exports/model.glb"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only binary glTF export. Evidence and limitations are reported by "
            "/exports/gltf-manifest before or after downloading the binary artifact."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportGlbInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:glb", "route:export:gltf-manifest"],
        resourceGroups=["export", "gltf", "visual"],
        uiFeatures=["project.export-gltf"],
    )
)

register(
    ToolDescriptor(
        name="set-tool-pref",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetToolPrefInput",
            "type": "object",
            "required": ["tool", "pref_key", "pref_value"],
            "properties": {
                "tool": {
                    "type": "string",
                    "description": "Authoring tool name (e.g. 'wall', 'door', 'window').",
                },
                "pref_key": {
                    "type": "string",
                    "description": "Modifier key (e.g. 'alignment', 'swingSide', 'multipleMode').",
                },
                "pref_value": {
                    "type": "string",
                    "description": "Serialised value (booleans as 'true'/'false').",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetToolPrefOutput",
            "type": "object",
            "required": ["ok", "revision"],
            "properties": {
                "ok": {"type": "boolean"},
                "revision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Pref stored; revision incremented"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai tool-pref set --tool wall --pref alignment --value center",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/commands"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "CHR-V3-08: stores a sticky modifier preference on the document. "
            "The command type discriminator is 'setToolPref'. "
            "pref_value must be a string; booleans serialised as 'true'/'false'."
        ),
    )
)
