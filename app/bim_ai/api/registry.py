"""API-V3-01 — Tool registry.

Every kernel verb registers a ToolDescriptor here at boot.  The registry is
in-memory and populated by calling `register()` at module import time (or from
each theme WP's own module when it lands).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True)
class RestEndpoint:
    method: Literal["GET", "POST"]
    path: str


@dataclass(frozen=True)
class ExitCode:
    code: int
    meaning: str


@dataclass
class ToolDescriptor:
    name: str
    category: Literal["query", "mutation", "transform", "job", "introspection"]
    inputSchema: dict[str, Any]
    outputSchema: dict[str, Any]
    exitCodes: dict[str, ExitCode]
    cliExample: str
    restEndpoint: RestEndpoint
    sideEffects: Literal["none", "mutates-kernel", "enqueues-job", "writes-audit"]
    agentSafetyNotes: str | None = None


@dataclass
class ToolCatalog:
    schemaVersion: str
    tools: list[ToolDescriptor]


_registry: dict[str, ToolDescriptor] = {}


def register(descriptor: ToolDescriptor) -> None:
    _registry[descriptor.name] = descriptor


def get_catalog() -> ToolCatalog:
    return ToolCatalog(
        schemaVersion="api-v3.0",
        tools=list(_registry.values()),
    )


def get_descriptor(name: str) -> ToolDescriptor | None:
    return _registry.get(name)


# ---------------------------------------------------------------------------
# Seed: introspection tools (registered at import time)
# ---------------------------------------------------------------------------

_COMMON_ERROR_CODES: dict[str, ExitCode] = {
    "ok": ExitCode(code=0, meaning="Success"),
    "not_found": ExitCode(code=1, meaning="Tool name not found in registry"),
    "error": ExitCode(code=1, meaning="Unexpected error"),
}

register(
    ToolDescriptor(
        name="api-list-tools",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiListToolsInput",
            "type": "object",
            "properties": {
                "output": {
                    "type": "string",
                    "enum": ["json", "text"],
                    "default": "json",
                    "description": "Output format.",
                }
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ToolCatalog",
            "type": "object",
            "required": ["schemaVersion", "tools"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "tools": {
                    "type": "array",
                    "items": {"$ref": "#/definitions/ToolDescriptor"},
                },
            },
            "definitions": {
                "ToolDescriptor": {
                    "type": "object",
                    "required": [
                        "name",
                        "category",
                        "inputSchema",
                        "outputSchema",
                        "exitCodes",
                        "cliExample",
                        "restEndpoint",
                        "sideEffects",
                    ],
                    "properties": {
                        "name": {"type": "string"},
                        "category": {
                            "type": "string",
                            "enum": ["query", "mutation", "transform", "job", "introspection"],
                        },
                        "inputSchema": {"type": "object"},
                        "outputSchema": {"type": "object"},
                        "exitCodes": {"type": "object"},
                        "cliExample": {"type": "string"},
                        "restEndpoint": {
                            "type": "object",
                            "required": ["method", "path"],
                            "properties": {
                                "method": {"type": "string", "enum": ["GET", "POST"]},
                                "path": {"type": "string"},
                            },
                        },
                        "sideEffects": {
                            "type": "string",
                            "enum": ["none", "mutates-kernel", "enqueues-job", "writes-audit"],
                        },
                        "agentSafetyNotes": {"type": "string"},
                    },
                }
            },
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Success")},
        cliExample="bim-ai api list-tools --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/tools"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; read-only, no kernel side-effects.",
    )
)

register(
    ToolDescriptor(
        name="api-inspect",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiInspectInput",
            "type": "object",
            "required": ["name"],
            "properties": {
                "name": {"type": "string", "description": "Tool name to inspect."},
                "output": {
                    "type": "string",
                    "enum": ["json", "text"],
                    "default": "json",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ToolDescriptor",
            "$ref": "#/definitions/ToolDescriptor",
            "definitions": {
                "ToolDescriptor": {
                    "type": "object",
                    "required": ["name", "category"],
                    "properties": {
                        "name": {"type": "string"},
                        "category": {"type": "string"},
                    },
                }
            },
        },
        exitCodes=_COMMON_ERROR_CODES,
        cliExample="bim-ai api inspect api-list-tools --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/tools/{name}"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; read-only, no kernel side-effects.",
    )
)

register(
    ToolDescriptor(
        name="api-version",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiVersionInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiVersionOutput",
            "type": "object",
            "required": ["schemaVersion", "buildRef"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "buildRef": {"type": "string"},
            },
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Success")},
        cliExample="bim-ai api version",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/version"),
        sideEffects="none",
    )
)

# ---------------------------------------------------------------------------
# Stubs: apply-bundle + model-show (CMD-V3-01 / query stubs)
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="apply-bundle",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApplyBundleInput",
            "type": "object",
            "required": ["commands"],
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Array of kernel commands to apply atomically.",
                },
                "baseRevision": {
                    "type": "integer",
                    "description": "Parent revision this bundle was authored against.",
                },
                "dryRun": {
                    "type": "boolean",
                    "default": False,
                    "description": "Validate only; do not commit.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["ok", "revision"],
            "properties": {
                "ok": {"type": "boolean"},
                "revision": {"type": "integer"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "dryRun": {"type": "boolean"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle applied or dry-run passed"),
            "conflict": ExitCode(code=2, meaning="Base revision conflict"),
            "validation_error": ExitCode(code=3, meaning="Command validation failed"),
        },
        cliExample="bim-ai apply-bundle bundle.json --base 42",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/commands/bundle"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use --dry-run first to validate.  "
            "baseRevision must match current model revision or the call is rejected."
        ),
    )
)

register(
    ToolDescriptor(
        name="model-show",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelShowInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSnapshot",
            "type": "object",
            "required": ["modelId", "revision", "elements"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "elements": {"type": "object"},
                "violations": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai snapshot  # (BIM_AI_MODEL_ID must be set)",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/snapshot"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; read-only snapshot.",
    )
)
