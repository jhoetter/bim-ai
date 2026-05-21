"""Output and export descriptor registrations.

Covers OUT-V3-02 (presentation canvas), OUT-V3-03 (brand templates), and
EXP-V3-01 (render pipeline export). Extracted from registry.py.
"""

from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# OUT-V3-02 — Presentation canvas, frames, saved views
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-frame",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateFrameInput",
            "type": "object",
            "required": ["id", "presentationCanvasId", "viewId", "positionMm", "sizeMm"],
            "properties": {
                "id": {"type": "string", "description": "Unique frame element ID."},
                "presentationCanvasId": {
                    "type": "string",
                    "description": "ID of the parent PresentationCanvasElem.",
                },
                "viewId": {
                    "type": "string",
                    "description": "ID of the view (plan_view, section_cut, etc.) to crop.",
                },
                "positionMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {
                        "xMm": {"type": "number"},
                        "yMm": {"type": "number"},
                    },
                },
                "sizeMm": {
                    "type": "object",
                    "required": ["widthMm", "heightMm"],
                    "properties": {
                        "widthMm": {"type": "number"},
                        "heightMm": {"type": "number"},
                    },
                },
                "caption": {"type": "string", "description": "Optional slide caption."},
                "brandTemplateId": {"type": "string"},
                "sortOrder": {"type": "integer", "default": 0},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "type": "object",
            "properties": {
                "accepted": {"type": "boolean"},
                "revision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Frame created"),
            "duplicate_id": ExitCode(code=1, meaning="Frame ID already exists"),
            "canvas_not_found": ExitCode(code=1, meaning="presentationCanvasId not found"),
        },
        cliExample='bim-ai create-frame --id frame-01 --presentationCanvasId canvas-01 --viewId plan-gf --positionMm \'{"xMm":0,"yMm":0}\' --sizeMm \'{"widthMm":210,"heightMm":148}\'',
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Requires a valid presentationCanvasId; canvas must exist before adding frames.",
    )
)

register(
    ToolDescriptor(
        name="export-presentation",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportPresentationInput",
            "type": "object",
            "required": ["modelId", "canvasId"],
            "properties": {
                "modelId": {"type": "string"},
                "canvasId": {"type": "string"},
                "format": {
                    "type": "string",
                    "enum": ["pptx-bundle"],
                    "default": "pptx-bundle",
                    "description": "Only 'pptx-bundle' (structured JSON) is supported in v3.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PptxBundle",
            "type": "object",
            "required": ["schemaVersion", "title", "slides"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "title": {"type": "string"},
                "slides": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["viewId", "positionMm", "sizeMm", "sortOrder"],
                        "properties": {
                            "viewId": {"type": "string"},
                            "caption": {"type": ["string", "null"]},
                            "positionMm": {"type": "object"},
                            "sizeMm": {"type": "object"},
                            "sortOrder": {"type": "integer"},
                        },
                    },
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle returned"),
            "not_found": ExitCode(code=1, meaning="Canvas not found"),
            "bad_format": ExitCode(code=1, meaning="Unsupported format parameter"),
        },
        cliExample="bim-ai export-presentation --modelId <uuid> --canvasId canvas-01 --format pptx-bundle",
        restEndpoint=RestEndpoint(
            method="GET",
            path="/api/v3/models/{modelId}/presentation-canvases/{canvasId}/export",
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only export; safe to call at any time. Returns JSON bundle, not a binary .pptx file.",
    )
)

# ---------------------------------------------------------------------------
# OUT-V3-03 — BrandTemplate CRUD + branded PDF export
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-brand-template",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateBrandTemplateInput",
            "type": "object",
            "required": ["id", "name", "accentHex", "accentForegroundHex"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "accentHex": {
                    "type": "string",
                    "pattern": "^#[0-9a-fA-F]{6}$",
                    "description": "CSS hex colour for brand accent, e.g. '#2563eb'",
                },
                "accentForegroundHex": {
                    "type": "string",
                    "pattern": "^#[0-9a-fA-F]{6}$",
                    "description": "Foreground colour on the accent surface, e.g. '#ffffff'",
                },
                "typeface": {
                    "type": "string",
                    "default": "Inter",
                    "description": "CSS font-family for brand text",
                },
                "logoMarkSvgUri": {
                    "type": "string",
                    "description": "data: URI or remote URL for the logo SVG mark",
                },
                "cssOverrideSnippet": {
                    "type": "string",
                    "description": "Raw CSS injected as Layer C overrides (opaque; no validation)",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateBrandTemplateOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Brand template created"),
            "invalid_hex": ExitCode(code=1, meaning="accentHex or accentForegroundHex not #RRGGBB"),
            "duplicate_id": ExitCode(code=1, meaning="Element with that id already exists"),
        },
        cliExample="bim-ai create-brand-template --id bt-1 --name Acme --accentHex '#2563eb' --accentForegroundHex '#ffffff'",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Wrap in a CommandBundle with type='create_brand_template'.",
    )
)

register(
    ToolDescriptor(
        name="export-branded-pdf",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportBrandedPdfInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "description": "UUID of the model"},
                "brandTemplateId": {
                    "type": "string",
                    "description": "Optional id of a brand_template element; omit for unbranded export",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BrandedExportBundle",
            "type": "object",
            "required": ["schemaVersion", "format", "sheets", "invariantCheck"],
            "properties": {
                "schemaVersion": {"type": "string", "enum": ["out-v3.0"]},
                "format": {"type": "string", "enum": ["pdf", "pptx"]},
                "brandTemplateId": {"type": "string"},
                "brandLayer": {
                    "type": "object",
                    "properties": {
                        "accentHex": {"type": "string"},
                        "accentForegroundHex": {"type": "string"},
                        "typeface": {"type": "string"},
                        "logoMarkSvgUri": {"type": "string"},
                        "cssOverrideSnippet": {"type": "string"},
                    },
                },
                "sheets": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "sheetId": {"type": "string"},
                            "name": {"type": "string"},
                        },
                    },
                },
                "invariantCheck": {"type": "string", "enum": ["layer-c-only"]},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Export bundle returned"),
            "not_found": ExitCode(code=1, meaning="Model or brandTemplateId not found"),
        },
        cliExample="bim-ai export-branded-pdf --modelId <uuid> --brandTemplateId bt-1",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/models/{modelId}/export/pdf"),
        sideEffects="none",
        agentSafetyNotes="Read-only; safe to call freely.",
    )
)

# ---------------------------------------------------------------------------
# EXP-V3-01 — Render-pipeline export
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="export-render-bundle",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportRenderBundleInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "description": "UUID of the model"},
                "format": {
                    "type": "string",
                    "enum": ["gltf", "gltf-pbr", "ifc-bundle", "metadata-only"],
                    "default": "metadata-only",
                    "description": "Export format. metadata-only returns JSON without a binary asset.",
                },
                "viewId": {
                    "type": "string",
                    "description": "Optional viewpoint/saved_view id to filter cameras to a single view.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RenderExportBundle",
            "type": "object",
            "required": ["schemaVersion", "format", "metadata", "exportTimestamp"],
            "properties": {
                "schemaVersion": {"type": "string", "enum": ["exp-v3.0"]},
                "format": {
                    "type": "string",
                    "enum": ["gltf", "gltf-pbr", "ifc-bundle", "metadata-only"],
                },
                "primaryAsset": {
                    "type": ["object", "null"],
                    "properties": {
                        "kind": {"type": "string"},
                        "pathInArchive": {"type": "string"},
                    },
                },
                "metadata": {
                    "type": "object",
                    "properties": {
                        "cameras": {"type": "array", "items": {"type": "object"}},
                        "sunSettings": {"type": "object"},
                        "materials": {"type": "array", "items": {"type": "object"}},
                        "annotations": {"type": "array", "items": {"type": "object"}},
                    },
                },
                "exportTimestamp": {"type": "string", "format": "date-time"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Export bundle returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
            "invalid_format": ExitCode(code=2, meaning="Unsupported export format"),
        },
        cliExample="bim-ai export gltf-pbr my-model --view front-elev -o front.glb",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/models/{modelId}/export"),
        sideEffects="none",
        agentSafetyNotes=(
            "EXP-V3-01: deterministic — same model state + same parameters → byte-identical bundle. "
            "Use format=metadata-only to inspect cameras, sun settings, and materials without "
            "triggering a binary asset pipeline. "
            "viewId filters cameras to a single viewpoint or saved_view element."
        ),
    )
)

