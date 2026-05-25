"""View-capture descriptor — Phase A.1 of mcp-native-bim-agent-tracker.

Registers ``view-capture-run`` in the ToolDescriptor catalog so the bim-ai
MCP server auto-exposes it to external agents (e.g. bim-agent's grading
loop). The handler lives in ``bim_ai.routes.v3_capture`` and shells out to
``packages/web/scripts/view-capture-run.mjs`` to drive Playwright.

Output is **inline base64-encoded PNGs** (tracker E.2 Option β) — no
filesystem coupling crosses the MCP boundary.
"""

from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

register(
    ToolDescriptor(
        name="view-capture-run",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ViewCaptureRunInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {
                    "type": "string",
                    "format": "uuid",
                    "description": "bim_models.id to render.",
                },
                "views": {
                    "type": "array",
                    "description": (
                        "Optional list of view tokens '<direction>-<style>' where "
                        "direction ∈ {north, south, east, west} and "
                        "style ∈ {shaded, wireframe}. Defaults to all 8."
                    ),
                    "items": {
                        "type": "string",
                        "enum": [
                            "north-shaded",
                            "north-wireframe",
                            "south-shaded",
                            "south-wireframe",
                            "east-shaded",
                            "east-wireframe",
                            "west-shaded",
                            "west-wireframe",
                        ],
                    },
                    "minItems": 1,
                    "uniqueItems": True,
                },
                "width": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 8192,
                    "default": 1024,
                    "description": "Viewport width in pixels.",
                },
                "height": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 8192,
                    "default": 768,
                    "description": "Viewport height in pixels.",
                },
                "webBaseUrl": {
                    "type": "string",
                    "format": "uri",
                    "description": (
                        "Override the web origin Playwright opens. Defaults to "
                        "$BIM_AI_WEB_BASE_URL or http://127.0.0.1:2000."
                    ),
                },
                "timeoutMs": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 300000,
                    "default": 60000,
                    "description": "Per-page Playwright timeout in milliseconds.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ViewCaptureRunResult",
            "type": "object",
            "required": ["ok", "modelId", "captures"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "width": {"type": "integer"},
                "height": {"type": "integer"},
                "captureCount": {"type": "integer"},
                "captures": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["view", "encoding", "data"],
                        "properties": {
                            "view": {"type": "string"},
                            "encoding": {"type": "string", "const": "base64-png"},
                            "data": {
                                "type": "string",
                                "description": "Base64-encoded PNG bytes.",
                            },
                            "bytes": {"type": "integer"},
                        },
                    },
                },
                "bboxMm": {
                    "type": "object",
                    "description": "Model bounding box used to position cardinal cameras.",
                },
                "scriptErrors": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=200, meaning="Captures returned inline."),
            "bad_input": ExitCode(code=422, meaning="View token / dimensions invalid."),
            "spawn_failed": ExitCode(code=504, meaning="Capture process timed out."),
            "script_failed": ExitCode(code=502, meaning="Capture script returned non-zero."),
        },
        cliExample=(
            "curl -X POST http://127.0.0.1:28500/api/v3/models/<uuid>/capture-views "
            "-H 'content-type: application/json' "
            '-d \'{"views": ["north-shaded", "north-wireframe"]}\''
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{model_id}/capture-views"),
        sideEffects="none",
        agentSafetyNotes=(
            "Spawns a headless Chromium via Playwright to render the live viewer for the "
            "given model and screenshots cardinal (N/S/E/W) elevations in both shaded and "
            "wireframe styles. Returns inline base64 PNGs — no filesystem coupling. Use "
            "this for visual grading (defect spotting that element counts miss: stacked "
            "roofs, floating dormers, etc.). Synchronous; ~5–30 seconds per model."
        ),
        stableId="view-capture-run.v1",
        mutability="read",
        requiredPermissions=["read"],
        implementationStatus="implemented",
    )
)
