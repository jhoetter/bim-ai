"""API-V3-01 — Tool registry.

Every kernel verb registers a ToolDescriptor here at boot.  The registry is
in-memory and populated by calling `register()` at module import time (or from
each theme WP's own module when it lands).
"""

from __future__ import annotations

from importlib import import_module
from typing import Any

from bim_ai.api.registry_core import (
    ExitCode,
    RestEndpoint,
    ToolCatalog,
    ToolDescriptor,
    get_catalog,
    get_descriptor,
    register,
)

__all__ = [
    "ExitCode",
    "RestEndpoint",
    "ToolCatalog",
    "ToolDescriptor",
    "get_catalog",
    "get_descriptor",
    "register",
]


def _load_descriptor_module(name: str) -> None:
    import_module(name)


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
                        "stableId",
                        "category",
                        "inputSchema",
                        "outputSchema",
                        "exitCodes",
                        "cliExample",
                        "restEndpoint",
                        "sideEffects",
                        "mutability",
                        "requiredPermissions",
                        "transport",
                        "implementationStatus",
                        "schemaRefs",
                        "exampleRefs",
                        "kernelCommands",
                        "resourceGroups",
                    ],
                    "properties": {
                        "name": {"type": "string"},
                        "stableId": {"type": "string"},
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
                        "mutability": {
                            "type": "string",
                            "enum": ["read", "write", "job", "transform"],
                        },
                        "requiredPermissions": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "transport": {
                            "type": "string",
                            "enum": ["http", "websocket"],
                        },
                        "implementationStatus": {
                            "type": "string",
                            "enum": ["implemented", "todo", "unsupported", "deprecated"],
                        },
                        "unsupportedReason": {"type": "string"},
                        "deprecatedReplacement": {"type": "string"},
                        "requiresBrowser": {"type": "boolean"},
                        "createsExternalAssets": {"type": "boolean"},
                        "exportsData": {"type": "boolean"},
                        "schemaRefs": {"type": "array", "items": {"type": "string"}},
                        "exampleRefs": {"type": "array", "items": {"type": "string"}},
                        "kernelCommands": {"type": "array", "items": {"type": "string"}},
                        "resourceGroups": {"type": "array", "items": {"type": "string"}},
                        "uiFeatures": {"type": "array", "items": {"type": "string"}},
                        "surfaceMetadata": {"type": "object"},
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
            "title": "CommandBundleRequest",
            "type": "object",
            "required": ["bundle"],
            "properties": {
                "bundle": {
                    "type": "object",
                    "required": ["schemaVersion", "commands", "assumptions", "parentRevision"],
                    "properties": {
                        "schemaVersion": {
                            "type": "string",
                            "enum": ["cmd-v3.0"],
                            "description": "Must be 'cmd-v3.0'.",
                        },
                        "commands": {
                            "type": "array",
                            "items": {"type": "object"},
                            "description": "Array of kernel commands to apply atomically.",
                        },
                        "assumptions": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                                "type": "object",
                                "required": ["key", "value", "confidence", "source"],
                                "properties": {
                                    "key": {"type": "string", "minLength": 1},
                                    "value": {},
                                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                                    "source": {"type": "string"},
                                    "contestable": {"type": "boolean", "default": True},
                                    "evidence": {"type": "string"},
                                },
                            },
                            "description": "CMD-V3-02 contract — non-empty assumption log.",
                        },
                        "parentRevision": {
                            "type": "integer",
                            "description": "Optimistic-concurrency lock: must match current model revision.",
                        },
                        "targetOptionId": {
                            "type": "string",
                            "description": "OPT-V3-01: design option target. Absent = current model state.",
                        },
                        "tolerances": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["advisoryClass", "reason"],
                                "properties": {
                                    "advisoryClass": {"type": "string"},
                                    "reason": {"type": "string"},
                                },
                            },
                            "description": "Explicit overrides; recorded in audit log (T3 activity stream).",
                        },
                    },
                    "additionalProperties": False,
                },
                "mode": {
                    "type": "string",
                    "enum": ["dry_run", "commit"],
                    "default": "dry_run",
                    "description": "dry_run: validate only; commit: apply if no blocking advisories.",
                },
                "userId": {
                    "type": "string",
                    "description": "User identity for undo-stack attribution.",
                },
                "actorKind": {
                    "type": "string",
                    "enum": ["human", "agent", "mcp-client", "ci"],
                    "default": "human",
                    "description": "Transaction safety actor class; agent/MCP commits require matching dry-run evidence.",
                },
                "dryRunEvidence": {
                    "type": "object",
                    "description": "dryRunEvidence_v1 replay proof required for agent/MCP commit mode.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "optionId": {"type": "string"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "checkpointSnapshotId": {
                    "type": "string",
                    "description": "SHA-256 of post-bundle element state; hand-off to VG-V3-01.",
                },
                "elements": {
                    "type": "object",
                    "description": "Post-commit element map. Each element may carry agentTrace when CMD-V3-02 is active.",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "agentTrace": {
                                "type": "object",
                                "description": "CMD-V3-02: provenance trace linking element to its originating bundle.",
                                "properties": {
                                    "bundleId": {"type": "string"},
                                    "assumptionKeys": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "appliedAt": {"type": "string", "format": "date-time"},
                                },
                                "required": ["bundleId", "assumptionKeys", "appliedAt"],
                            }
                        },
                    },
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle applied (commit) or validated (dry-run)"),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "assumption_log_required": ExitCode(
                code=3, meaning="assumptions field missing or malformed"
            ),
            "assumption_log_malformed": ExitCode(
                code=4, meaning="assumption entry is missing required field or has invalid value"
            ),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            "bim-ai apply-bundle bundle.json --base 1 --dry-run\n"
            "bim-ai apply-bundle bundle.json --base 1 --commit\n"
            "bim-ai apply-bundle bundle.json --base 1 --commit --tolerate constraint_error"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Default mode is --dry-run; always validate first. "
            "parentRevision must equal current model revision or the call is rejected with revision_conflict (HTTP 409). "
            "assumptions is required and non-empty (CMD-V3-02 contract). "
            "targetOptionId 'main' is permanently forbidden. "
            "Same bundle + same parentRevision -> same BundleResult (deterministic)."
        ),
    )
)

register(
    ToolDescriptor(
        name="collab-ws",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CollabWsInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CollabWsOutput",
            "description": "WebSocket endpoint — no HTTP response body. Speaks the yjs Y-WebSocket protocol.",
            "type": "object",
            "properties": {},
        },
        exitCodes={
            "ok": ExitCode(
                code=0, meaning="Connection accepted; yjs sync + awareness relay active"
            ),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="# connect via any yjs WebsocketProvider: ws://<host>/api/models/<id>/collab",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/collab"),
        sideEffects="none",
        agentSafetyNotes=(
            "WebSocket endpoint only. Relays raw yjs bytes; does not mutate kernel state. "
            "Commits still go through POST /api/models/{model_id}/bundles (CMD-V3-01)."
        ),
    )
)

register(
    ToolDescriptor(
        name="model.dry_run",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelDryRunInput",
            "type": "object",
            "required": ["modelId", "commands"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "commands": {
                    "type": "array",
                    "minItems": 1,
                    "items": {"type": "object"},
                    "description": "Kernel commands to validate through the authoritative bundle pipeline.",
                },
                "userId": {
                    "type": "string",
                    "default": "local-dev",
                    "description": "User identity for diagnostics attribution.",
                },
                "clientOpId": {
                    "type": "string",
                    "description": "Optional idempotency/correlation id supplied by the caller.",
                },
                "actorKind": {
                    "type": "string",
                    "enum": ["human", "agent", "mcp-client", "ci"],
                    "default": "human",
                    "description": "Actor class recorded in transaction safety/audit evidence.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelDryRunResult",
            "type": "object",
            "required": ["ok", "modelId", "reason", "violations", "summaryBefore"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "reason": {"type": "string"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "summaryBefore": {"type": "object"},
                "summaryAfter": {"type": ["object", "null"]},
                "wouldRevision": {"type": ["integer", "null"]},
                "appliedCommandsPreview": {"type": "array", "items": {"type": "object"}},
                "replayDiagnostics": {"type": "object"},
                "agentBriefCommandProtocol_v1": {"type": "object"},
                "agentGeneratedBundleQaChecklist_v1": {"type": "object"},
                "agentBriefAcceptanceReadout_v1": {"type": "object"},
                "agentReviewReadoutConsistencyClosure_v1": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle validated without mutating the model"),
            "invalid_bundle": ExitCode(code=1, meaning="Bundle payload could not be validated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai apply-bundle bundle.json --base 1 --dry-run",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/commands/bundle/dry-run"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Validation only: this route computes would-apply summaries and diagnostics without persisting. "
            "It delegates to try_commit_bundle, the same deterministic kernel boundary used by commits."
        ),
        schemaRefs=["input:BundleEnvelope", "output:ModelDryRunResult"],
        exampleRefs=["cli:apply-bundle:dry-run"],
        kernelCommands=["*"],
        resourceGroups=["model", "transaction", "kernel-command"],
        uiFeatures=["transaction:dry-run", "group:model", "group:transaction"],
    )
)

register(
    ToolDescriptor(
        name="model.commit_bundle",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelCommitBundleInput",
            "type": "object",
            "required": ["modelId", "bundle"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "bundle": {
                    "type": "object",
                    "required": ["schemaVersion", "commands", "assumptions"],
                    "properties": {
                        "schemaVersion": {"type": "string", "enum": ["cmd-v3.0"]},
                        "commands": {
                            "type": "array",
                            "minItems": 1,
                            "items": {"type": "object"},
                        },
                        "assumptions": {
                            "type": "array",
                            "minItems": 1,
                            "items": {"type": "object"},
                            "description": "CMD-V3-02 non-empty assumption log.",
                        },
                        "parentRevision": {
                            "type": "integer",
                            "description": "Optimistic-concurrency lock for the authoritative commit route.",
                        },
                        "targetOptionId": {"type": "string"},
                        "tolerances": {"type": "array", "items": {"type": "object"}},
                    },
                    "additionalProperties": False,
                },
                "mode": {
                    "type": "string",
                    "const": "commit",
                    "default": "commit",
                    "description": "Typed MCP surface for committing; dry-runs use model.dry_run.",
                },
                "userId": {"type": "string", "default": "local-dev"},
                "submitter": {"type": "string", "default": "agent"},
                "actorKind": {
                    "type": "string",
                    "enum": ["human", "agent", "mcp-client", "ci"],
                    "default": "agent",
                    "description": "Transaction safety actor class; agent/MCP commits require dryRunEvidence.",
                },
                "dryRunEvidence": {
                    "type": "object",
                    "description": "dryRunEvidence_v1 produced by model.dry_run for the same parentRevision and command digest.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "optionId": {"type": "string"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "checkpointSnapshotId": {"type": "string"},
                "elements": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle committed through CMD-V3-01"),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "assumption_log_required": ExitCode(
                code=3, meaning="assumptions field missing or malformed"
            ),
            "assumption_log_malformed": ExitCode(
                code=4, meaning="assumption entry is missing required field or has invalid value"
            ),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json --base 1 --commit",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Commits only through the existing CMD-V3-01 apply-bundle route; use model.dry_run first. "
            "parentRevision and CMD-V3-02 assumptions are enforced by the authoritative route."
        ),
        schemaRefs=["input:CommandBundleRequest", "output:BundleResult"],
        exampleRefs=["cli:apply-bundle:commit"],
        kernelCommands=["*"],
        resourceGroups=["model", "transaction", "kernel-command"],
        uiFeatures=["transaction:commit", "group:model", "group:transaction"],
    )
)

# ---------------------------------------------------------------------------
# M3-B — Documentation/export product pack
# ---------------------------------------------------------------------------

_POINT_2_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["xMm", "yMm"],
    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
    "additionalProperties": False,
}

_SHEET_VIEWPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["viewportId", "viewRef", "xMm", "yMm", "widthMm", "heightMm"],
    "properties": {
        "viewportId": {"type": "string"},
        "viewRef": {
            "type": "string",
            "description": "Stable reference such as plan:<id>, section:<id>, elevation:<id>, schedule:<id>.",
        },
        "label": {"type": "string"},
        "xMm": {"type": "number"},
        "yMm": {"type": "number"},
        "widthMm": {"type": "number", "exclusiveMinimum": 0},
        "heightMm": {"type": "number", "exclusiveMinimum": 0},
        "cropMinMm": _POINT_2_SCHEMA,
        "cropMaxMm": _POINT_2_SCHEMA,
    },
    "additionalProperties": True,
}

_CMD_V3_BUNDLE_OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SemanticAuthoringBundle",
    "type": "object",
    "required": ["operation", "commands", "metadata"],
    "properties": {
        "operation": {"type": "string"},
        "commands": {"type": "array", "items": {"type": "object"}},
        "todo": {"type": "array", "items": {"type": "object"}},
        "metadata": {"type": "object"},
    },
}

_SLAB_OPENING_INPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SlabOpeningInput",
    "type": "object",
    "required": ["hostFloorId", "boundaryMm"],
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "hostFloorId": {"type": "string"},
        "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
        "isShaft": {"type": "boolean", "default": False},
    },
    "additionalProperties": False,
}


_MEP_SYSTEM_ENUM = [
    "hvac_supply",
    "hvac_return",
    "heating",
    "cooling",
    "domestic_water",
    "wastewater",
    "electrical",
    "data",
    "fire_protection",
    "other",
]

_MEP_FLOW_ENUM = ["supply", "return", "exhaust", "bidirectional", "none", "unknown"]

_MEP_ROUTE_BASE_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["levelId", "startMm", "endMm"],
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "levelId": {"type": "string"},
        "startMm": _POINT_2_SCHEMA,
        "endMm": _POINT_2_SCHEMA,
        "elevationMm": {"type": "number", "default": 0},
        "systemType": {"type": "string"},
        "systemName": {"type": "string"},
        "flowDirection": {"type": "string", "enum": _MEP_FLOW_ENUM, "default": "unknown"},
        "serviceLevel": {"type": "string"},
        "clearanceZone": {"type": "object"},
        "maintainAccessZone": {"type": "object"},
        "connectors": {"type": "array", "items": {"type": "object"}},
        "colour": {"type": "string"},
    },
    "additionalProperties": False,
}


def _mep_route_schema(title: str, extra_properties: dict[str, Any]) -> dict[str, Any]:
    return {
        **_MEP_ROUTE_BASE_SCHEMA,
        "title": title,
        "properties": {**_MEP_ROUTE_BASE_SCHEMA["properties"], **extra_properties},
    }


_MEP_PLACED_BASE_PROPERTIES: dict[str, Any] = {
    "id": {"type": "string"},
    "name": {"type": "string"},
    "levelId": {"type": "string"},
    "positionMm": _POINT_2_SCHEMA,
    "systemType": {"type": "string", "enum": _MEP_SYSTEM_ENUM},
    "systemName": {"type": "string"},
    "connectors": {"type": "array", "items": {"type": "object"}},
}


def _mep_placed_schema(title: str, extra_properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": title,
        "type": "object",
        "required": ["levelId", "positionMm"],
        "properties": {**_MEP_PLACED_BASE_PROPERTIES, **extra_properties},
        "additionalProperties": False,
    }


_STRUCTURE_CONSTRUCTION_SCHEMAS: dict[str, dict[str, Any]] = {
    "structure.column": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureColumnInput",
        "type": "object",
        "required": ["levelId", "positionMm"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "levelId": {"type": "string"},
            "positionMm": _POINT_2_SCHEMA,
            "bMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
            "hMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
            "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 2800},
            "rotationDeg": {"type": "number", "default": 0},
            "materialKey": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "structure.beam": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureBeamInput",
        "type": "object",
        "required": ["levelId", "startMm", "endMm"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "levelId": {"type": "string"},
            "startMm": _POINT_2_SCHEMA,
            "endMm": _POINT_2_SCHEMA,
            "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 200},
            "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 400},
            "materialKey": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "structure.column_update": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureColumnUpdateInput",
        "type": "object",
        "required": ["id"],
        "properties": {
            "id": {"type": "string"},
            "bMm": {"type": "number", "exclusiveMinimum": 0},
            "hMm": {"type": "number", "exclusiveMinimum": 0},
        },
        "additionalProperties": False,
    },
    "structure.constraint": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureConstraintInput",
        "type": "object",
        "required": ["rule", "refsA", "refsB"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "rule": {
                "type": "string",
                "enum": [
                    "equal_distance",
                    "equal_length",
                    "parallel",
                    "perpendicular",
                    "collinear",
                ],
            },
            "refsA": {"type": "array", "minItems": 1, "items": {"type": "object"}},
            "refsB": {"type": "array", "minItems": 1, "items": {"type": "object"}},
            "lockedValueMm": {"type": "number"},
            "severity": {"type": "string", "enum": ["warning", "error"], "default": "error"},
        },
        "additionalProperties": False,
    },
    "construction.package": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionPackageInput",
        "type": "object",
        "required": ["name"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "code": {"type": "string"},
            "phaseId": {"type": "string"},
            "plannedStart": {"type": "string"},
            "plannedEnd": {"type": "string"},
            "actualStart": {"type": "string"},
            "actualEnd": {"type": "string"},
            "responsibleCompany": {"type": "string"},
            "dependencies": {"type": "array", "items": {"type": "string"}},
        },
        "additionalProperties": False,
    },
    "construction.logistics": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionLogisticsInput",
        "type": "object",
        "required": ["name", "logisticsKind"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "logisticsKind": {"type": "string"},
            "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
            "pathMm": {"type": "array", "minItems": 2, "items": _POINT_2_SCHEMA},
            "phaseId": {"type": "string"},
            "constructionPackageId": {"type": "string"},
            "plannedStart": {"type": "string"},
            "plannedEnd": {"type": "string"},
            "progressStatus": {"type": "string"},
            "responsibleCompany": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "construction.qa_checklist": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionQaChecklistInput",
        "type": "object",
        "required": ["name"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "targetElementIds": {"type": "array", "items": {"type": "string"}},
            "constructionPackageId": {"type": "string"},
            "phaseId": {"type": "string"},
            "responsibleCompany": {"type": "string"},
            "progressStatus": {"type": "string"},
            "checklist": {"type": "array", "items": {"type": "object"}},
        },
        "additionalProperties": False,
    },
}

for _tool_name, _schema in _STRUCTURE_CONSTRUCTION_SCHEMAS.items():
    _group = "structure" if _tool_name.startswith("structure.") else "construction"
    register(
        ToolDescriptor(
            name=_tool_name,
            category="mutation",
            inputSchema=_schema,
            outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Typed semantic authoring bundle generated"),
                "invalid": ExitCode(code=422, meaning="Invalid semantic authoring payload"),
            },
            cliExample=f"bim-ai {_group} {_tool_name.split('.', 1)[1].replace('_', '-')} --json",
            restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
            sideEffects="mutates-kernel",
            agentSafetyNotes=(
                "Generates typed kernel commands only; submit through model.dry_run or "
                "model.commit_bundle for revision, permission, and advisor checks."
            ),
            schemaRefs=[f"input:{_schema['title']}", "output:SemanticAuthoringBundle"],
            exampleRefs=[f"cli:{_group}:{_tool_name.split('.', 1)[1]}"],
            resourceGroups=["semantic-authoring", _group, "kernel-command"],
            uiFeatures=(
                ["tool:structure", "cmd-k:structure-lens"]
                if _group == "structure"
                else ["lens:construction", "cmd-k:construction-lens"]
            ),
        )
    )

register(
    ToolDescriptor(
        name="author.stair_between_levels",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairBetweenLevelsInput",
            "type": "object",
            "required": ["baseLevelId", "topLevelId", "runStartMm", "runEndMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "baseLevelId": {"type": "string"},
                "topLevelId": {"type": "string"},
                "runStartMm": _POINT_2_SCHEMA,
                "runEndMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 1000},
                "riserMm": {"type": "number", "exclusiveMinimum": 0, "default": 175},
                "treadMm": {"type": "number", "exclusiveMinimum": 0, "default": 275},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createStair bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid stair payload"),
        },
        cliExample=(
            "bim-ai author stair-between-levels --base-level lvl-0 --top-level lvl-1 "
            "--run '1000,1000;1000,4200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates createStair only; submit through model.dry_run or model.commit_bundle for "
            "transaction safety and advisor validation."
        ),
        schemaRefs=["input:StairBetweenLevelsInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:author:stair-between-levels"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "kernel-command"],
        uiFeatures=["tool:stair", "cmd-k:tool.stair"],
    )
)

register(
    ToolDescriptor(
        name="author.stair_by_runs",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairByRunsInput",
            "type": "object",
            "required": ["baseLevelId", "topLevelId", "runs"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "baseLevelId": {"type": "string"},
                "topLevelId": {"type": "string"},
                "runStartMm": _POINT_2_SCHEMA,
                "runEndMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 1000},
                "riserMm": {"type": "number", "exclusiveMinimum": 0, "default": 175},
                "treadMm": {"type": "number", "exclusiveMinimum": 0, "default": 275},
                "shape": {
                    "type": "string",
                    "enum": ["straight", "l_shape", "u_shape", "spiral", "sketch"],
                },
                "runs": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "required": ["id", "startMm", "endMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "startMm": _POINT_2_SCHEMA,
                            "endMm": _POINT_2_SCHEMA,
                            "widthMm": {"type": "number", "exclusiveMinimum": 0},
                            "riserCount": {"type": "integer", "minimum": 1},
                            "polylineMm": {"type": "array", "items": _POINT_2_SCHEMA},
                        },
                        "additionalProperties": False,
                    },
                },
                "landings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "boundaryMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "boundaryMm": {
                                "type": "array",
                                "minItems": 3,
                                "items": _POINT_2_SCHEMA,
                            },
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed multi-run createStair bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid stair-by-runs payload"),
        },
        cliExample="bim-ai author stair-by-runs --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates createStair with explicit runs/landings; submit through dry-run and "
            "Advisor before acceptance."
        ),
        schemaRefs=["input:StairByRunsInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["route:author.stair_by_runs"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "kernel-command"],
        uiFeatures=["tool:stair", "cmd-k:tool.stair"],
    )
)

register(
    ToolDescriptor(
        name="author.stair_by_sketch",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairBySketchInput",
            "type": "object",
            "required": [
                "baseLevelId",
                "topLevelId",
                "runStartMm",
                "runEndMm",
                "boundaryMm",
                "treadLines",
                "totalRiseMm",
            ],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "baseLevelId": {"type": "string"},
                "topLevelId": {"type": "string"},
                "runStartMm": _POINT_2_SCHEMA,
                "runEndMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 1000},
                "riserMm": {"type": "number", "exclusiveMinimum": 0, "default": 175},
                "treadMm": {"type": "number", "exclusiveMinimum": 0, "default": 275},
                "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
                "treadLines": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "required": ["fromMm", "toMm"],
                        "properties": {
                            "fromMm": _POINT_2_SCHEMA,
                            "toMm": _POINT_2_SCHEMA,
                            "riserHeightMm": {"type": "number", "exclusiveMinimum": 0},
                            "manualOverride": {"type": "boolean"},
                        },
                        "additionalProperties": False,
                    },
                },
                "totalRiseMm": {"type": "number", "exclusiveMinimum": 0},
                "landings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "boundaryMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "boundaryMm": {
                                "type": "array",
                                "minItems": 3,
                                "items": _POINT_2_SCHEMA,
                            },
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed by-sketch createStair bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid stair-by-sketch payload"),
        },
        cliExample="bim-ai author stair-by-sketch --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates createStair authoringMode=by_sketch from explicit boundary and tread "
            "lines; dry-run and inspect Advisor before commit."
        ),
        schemaRefs=["input:StairBySketchInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["route:author.stair_by_sketch"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "kernel-command"],
        uiFeatures=["tool:stair", "cmd-k:tool.stair"],
    )
)

register(
    ToolDescriptor(
        name="author.stair_existing_condition",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairExistingConditionInput",
            "type": "object",
            "required": ["stairId", "findingCodes", "reason", "sourceFactIds"],
            "properties": {
                "stairId": {"type": "string"},
                "findingCodes": {"type": "array", "minItems": 1, "items": {"type": "string"}},
                "reason": {"type": "string", "minLength": 1},
                "sourceFactIds": {"type": "array", "minItems": 1, "items": {"type": "string"}},
                "reviewer": {"type": "string"},
                "accepted": {"type": "boolean", "default": True},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(
                code=0, meaning="Typed existing-condition stair tolerance bundle generated"
            ),
            "invalid": ExitCode(code=422, meaning="Invalid existing-condition stair payload"),
        },
        cliExample="bim-ai author stair-existing-condition --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use only for source-evidenced existing-building nonconformance. It records "
            "explicit tolerated finding codes on the stair and must be backed by source facts."
        ),
        schemaRefs=["input:StairExistingConditionInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["route:author.stair_existing_condition"],
        resourceGroups=[
            "semantic-authoring",
            "vertical-circulation",
            "reverse-bim",
            "kernel-command",
        ],
        uiFeatures=["advisor-panel", "tool:stair"],
    )
)

register(
    ToolDescriptor(
        name="opening.slab_opening",
        category="mutation",
        inputSchema=_SLAB_OPENING_INPUT_SCHEMA,
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createSlabOpening bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid slab opening payload"),
        },
        cliExample=(
            "bim-ai opening slab-opening --floor floor-1 --boundary "
            "'1000,1000;2200,1000;2200,2200;1000,2200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Host floor id must be resolved before calling; dry-run before commit.",
        schemaRefs=["input:SlabOpeningInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:opening:slab-opening"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "opening", "kernel-command"],
        uiFeatures=["tool:vertical-opening", "cmd-k:tool.floor-opening"],
    )
)

register(
    ToolDescriptor(
        name="opening.shaft_opening",
        category="mutation",
        inputSchema={
            **_SLAB_OPENING_INPUT_SCHEMA,
            "title": "ShaftOpeningInput",
            "properties": {
                **_SLAB_OPENING_INPUT_SCHEMA["properties"],
                "isShaft": {"type": "boolean", "const": True, "default": True},
            },
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed shaft createSlabOpening bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid shaft opening payload"),
        },
        cliExample=(
            "bim-ai opening shaft-opening --floor floor-1 --boundary "
            "'1000,1000;2200,1000;2200,2200;1000,2200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Creates one shaft-marked slab opening on an explicit floor. Multi-floor shaft "
            "propagation still requires one typed opening per host floor."
        ),
        schemaRefs=["input:ShaftOpeningInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:opening:shaft-opening"],
        resourceGroups=[
            "semantic-authoring",
            "vertical-circulation",
            "opening",
            "shaft",
            "kernel-command",
        ],
        uiFeatures=["tool:shaft-opening", "cmd-k:tool.shaft"],
    )
)

register(
    ToolDescriptor(
        name="author.railing",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RailingInput",
            "type": "object",
            "required": ["pathMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "hostedStairId": {"type": "string"},
                "hostFloorId": {"type": "string"},
                "hostWallId": {"type": "string"},
                "hostEdgeId": {"type": "string"},
                "pathMm": {"type": "array", "minItems": 2, "items": _POINT_2_SCHEMA},
                "guardHeightMm": {"type": "number", "exclusiveMinimum": 0},
                "balusterPattern": {"type": "object"},
                "handrailSupports": {"type": "array", "items": {"type": "object"}},
                "materialSlots": {"type": "object"},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createRailing bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid railing payload"),
        },
        cliExample="bim-ai author railing --hosted-stair stair-1 --path '1000,1000;1000,4200' --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Railing path is explicit 2D model geometry. Use hostedStairId when it follows a stair; "
            "dry-run catches invalid baluster/support payloads."
        ),
        schemaRefs=["input:RailingInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:author:railing"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "railing", "kernel-command"],
        uiFeatures=["tool:railing", "cmd-k:tool.railing"],
    )
)

_MEP_TYPED_SURFACES: tuple[dict[str, Any], ...] = (
    {
        "name": "mep.pipe_route",
        "title": "MepPipeRouteInput",
        "inputSchema": _mep_route_schema(
            "MepPipeRouteInput",
            {
                "diameterMm": {"type": "number", "exclusiveMinimum": 0, "default": 25},
                "insulation": {"type": "string"},
                "materialKey": {"type": "string"},
            },
        ),
        "ok": "Typed createPipe bundle generated",
        "cli": (
            "bim-ai mep pipe-route --level lvl-1 --line '0,100;3000,100' "
            "--elevation 2600 --system domestic_water --service-level 'Level 1 ceiling' --json"
        ),
        "schemaRef": "input:MepPipeRouteInput",
        "groups": ["semantic-authoring", "mep", "route", "pipe", "kernel-command"],
        "ui": ["tool:mep.pipe-route", "cmd-k:mep.pipe-route"],
        "notes": "Creates a straight pipe route with explicit level, route geometry, elevation, system, and service metadata.",
    },
    {
        "name": "mep.duct_route",
        "title": "MepDuctRouteInput",
        "inputSchema": _mep_route_schema(
            "MepDuctRouteInput",
            {
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
                "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 200},
                "shape": {"type": "string", "enum": ["rectangular", "round", "oval"]},
                "insulation": {"type": "string"},
            },
        ),
        "ok": "Typed createDuct bundle generated",
        "cli": (
            "bim-ai mep duct-route --level lvl-1 --line '0,800;3000,800' "
            "--elevation 2800 --system hvac_supply --width 500 --height 250 --json"
        ),
        "schemaRef": "input:MepDuctRouteInput",
        "groups": ["semantic-authoring", "mep", "route", "duct", "kernel-command"],
        "ui": ["tool:mep.duct-route", "cmd-k:mep.duct-route"],
        "notes": "Creates a straight duct route with route geometry, elevation, shape, system, flow, and service metadata.",
    },
    {
        "name": "mep.cable_tray",
        "title": "MepCableTrayInput",
        "inputSchema": _mep_route_schema(
            "MepCableTrayInput",
            {
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 200},
                "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 60},
            },
        ),
        "ok": "Typed createCableTray bundle generated",
        "cli": (
            "bim-ai mep cable-tray --level lvl-1 --line '0,1200;3000,1200' "
            "--elevation 2700 --system electrical --service-level overhead --json"
        ),
        "schemaRef": "input:MepCableTrayInput",
        "groups": ["semantic-authoring", "mep", "route", "cable-tray", "kernel-command"],
        "ui": ["tool:mep.cable-tray", "cmd-k:mep.cable-tray"],
        "notes": "Creates an electrical/data tray route with explicit geometry, elevation, system, and service metadata.",
    },
    {
        "name": "mep.equipment",
        "inputSchema": _mep_placed_schema(
            "MepEquipmentInput",
            {
                "elevationMm": {"type": "number", "default": 0},
                "equipmentType": {"type": "string"},
                "familyTypeId": {"type": "string"},
                "serviceLevel": {"type": "string"},
                "clearanceZone": {"type": "object"},
                "maintainAccessZone": {"type": "object"},
                "electricalLoadW": {"type": "number", "minimum": 0},
            },
        ),
        "ok": "Typed createMepEquipment bundle generated",
        "cli": (
            "bim-ai mep equipment --level lvl-1 --position 500,500 --system hvac_supply "
            "--equipment-type AHU --elevation 0 --json"
        ),
        "schemaRef": "input:MepEquipmentInput",
        "groups": ["semantic-authoring", "mep", "equipment", "kernel-command"],
        "ui": ["tool:mep.equipment", "cmd-k:mep.equipment"],
        "notes": "Places MEP equipment with level, position, elevation, system, service, connector, and access metadata.",
    },
    {
        "name": "mep.fixture",
        "inputSchema": _mep_placed_schema(
            "MepFixtureInput",
            {
                "roomId": {"type": "string"},
                "fixtureType": {"type": "string"},
                "electricalLoadW": {"type": "number", "minimum": 0},
            },
        ),
        "ok": "Typed createFixture bundle generated",
        "cli": (
            "bim-ai mep fixture --level lvl-1 --position 1200,900 --room room-1 "
            "--fixture-type sink --system domestic_water --json"
        ),
        "schemaRef": "input:MepFixtureInput",
        "groups": ["semantic-authoring", "mep", "fixture", "kernel-command"],
        "ui": ["tool:mep.fixture", "cmd-k:mep.fixture"],
        "notes": "Places a fixture with room/level position, system, connector, and load metadata.",
    },
    {
        "name": "mep.terminal",
        "inputSchema": _mep_placed_schema(
            "MepTerminalInput",
            {
                "terminalKind": {
                    "type": "string",
                    "enum": ["diffuser", "terminal", "sprinkler", "device"],
                },
                "roomId": {"type": "string"},
                "flowDirection": {"type": "string", "enum": _MEP_FLOW_ENUM},
                "serviceLevel": {"type": "string"},
            },
        ),
        "ok": "Typed createMepTerminal bundle generated",
        "cli": (
            "bim-ai mep terminal --level lvl-1 --position 1800,900 --room room-1 "
            "--terminal-kind diffuser --system hvac_supply --service-level ceiling --json"
        ),
        "schemaRef": "input:MepTerminalInput",
        "groups": ["semantic-authoring", "mep", "terminal", "kernel-command"],
        "ui": ["tool:mep.terminal", "cmd-k:mep.terminal"],
        "notes": "Places a terminal/diffuser/device with system, service level, flow, and connector metadata.",
    },
    {
        "name": "mep.opening_request",
        "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "MepOpeningRequestInput",
            "type": "object",
            "required": ["hostElementId"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "hostElementId": {"type": "string"},
                "levelId": {"type": "string"},
                "requesterElementIds": {"type": "array", "items": {"type": "string"}},
                "openingKind": {"type": "string", "enum": ["wall", "slab", "roof", "shaft"]},
                "positionMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0},
                "heightMm": {"type": "number", "exclusiveMinimum": 0},
                "diameterMm": {"type": "number", "exclusiveMinimum": 0},
                "clearanceMm": {"type": "number", "minimum": 0, "default": 50},
                "systemType": {"type": "string", "enum": _MEP_SYSTEM_ENUM},
                "systemName": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "ok": "Typed createMepOpeningRequest bundle generated",
        "cli": (
            "bim-ai mep opening-request --host wall-1 --level lvl-1 --requester duct-1 "
            "--opening-kind wall --position 1500,800 --width 600 --height 320 --system hvac_supply --json"
        ),
        "schemaRef": "input:MepOpeningRequestInput",
        "groups": [
            "semantic-authoring",
            "mep",
            "opening-request",
            "coordination",
            "kernel-command",
        ],
        "ui": ["tool:mep.opening-request", "cmd-k:mep.opening-request"],
        "notes": "Creates a traceable MEP penetration request against an explicit host and requester elements.",
    },
)

for _surface in _MEP_TYPED_SURFACES:
    register(
        ToolDescriptor(
            name=_surface["name"],
            category="mutation",
            inputSchema=_surface["inputSchema"],
            outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning=_surface["ok"]),
                "invalid": ExitCode(code=422, meaning=f"Invalid {_surface['name']} payload"),
            },
            cliExample=_surface["cli"],
            restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
            sideEffects="mutates-kernel",
            agentSafetyNotes=(
                f"{_surface['notes']} Submit through model.dry_run or model.commit_bundle "
                "for transaction safety and advisor validation."
            ),
            schemaRefs=[_surface["schemaRef"], "output:SemanticAuthoringBundle"],
            exampleRefs=[f"cli:{_surface['name']}"],
            resourceGroups=_surface["groups"],
            uiFeatures=_surface["ui"],
        )
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

_load_descriptor_module("bim_ai.api.descriptors.qa_model_resources")

_load_descriptor_module("bim_ai.api.descriptors.toposolid")

# DSC-V3-01 — set-element-discipline
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="set-element-discipline",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetElementDisciplineInput",
            "type": "object",
            "required": ["elementIds", "discipline"],
            "properties": {
                "elementIds": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "description": "IDs of elements whose discipline tag should be set.",
                },
                "discipline": {
                    "type": ["string", "null"],
                    "enum": ["arch", "struct", "mep", "site", "gen", None],
                    "description": (
                        "Discipline tag to assign. null resets the element to its "
                        "DEFAULT_DISCIPLINE_BY_KIND value."
                    ),
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "violations": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Discipline tag updated on all specified elements"),
            "not_found": ExitCode(code=1, meaning="One or more elementIds not found in model"),
            "unsupported_kind": ExitCode(
                code=2,
                meaning="Element kind does not support the discipline field",
            ),
            "invalid_discipline": ExitCode(
                code=3, meaning="discipline value is not a recognised tag"
            ),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            "# Set a wall to structural discipline\n"
            'bim-ai apply-bundle \'{"commands":[{"type":"setElementDiscipline",'
            '"elementIds":["wall-id"],"discipline":"struct"}],...}\'\n'
            "# Reset to kind default\n"
            'bim-ai apply-bundle \'{"commands":[{"type":"setElementDiscipline",'
            '"elementIds":["col-id"],"discipline":null}],...}\''
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Wrap in a CommandBundle via apply-bundle (POST /api/models/{model_id}/bundles). "
            "discipline=null resets the element to DEFAULT_DISCIPLINE_BY_KIND for its kind. "
            "Structural kinds (column, beam, brace, foundation) default to 'struct'; "
            "MEP kinds (duct, pipe, fixture) default to 'mep'; all others default to 'arch'. "
            "Command is undoable via bundle replay at an earlier parentRevision."
        ),
    )
)

# ---------------------------------------------------------------------------
# DSC-V3-02 — set-view-lens
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="set-view-lens",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetViewLensInput",
            "type": "object",
            "required": ["model_id", "view_id", "lens"],
            "properties": {
                "model_id": {"type": "string"},
                "view_id": {"type": "string"},
                "lens": {
                    "type": "string",
                    "enum": [
                        "show_arch",
                        "show_struct",
                        "show_mep",
                        "show_fire_safety",
                        "show_all",
                    ],
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "violations": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Discipline lens set on the target view"),
            "not_found": ExitCode(code=1, meaning="viewId not found in model"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            "# Set a plan view to show only structural elements foreground\n"
            "bim-ai view-set-lens --model-id <id> --view-id <viewId> --lens show_struct\n"
            "# Reset to show all disciplines at full opacity\n"
            "bim-ai view-set-lens --model-id <id> --view-id <viewId> --lens show_all"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Wrap in a CommandBundle via apply-bundle. "
            "lens must be one of: show_arch, show_struct, show_mep, "
            "show_fire_safety, show_all. "
            "show_all renders all elements at full opacity (default). "
            "Does not mutate element discipline fields — view-only modifier."
        ),
    )
)

# ---------------------------------------------------------------------------
# Construction lens — Bauausfuehrung workflow layer
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="construction-lens-report",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ConstructionLensReportInput",
            "type": "object",
            "required": ["model_id"],
            "properties": {"model_id": {"type": "string"}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ConstructionLensReport",
            "type": "object",
            "required": ["modelId", "revision", "lens", "summary"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "lens": {"type": "object"},
                "phases": {"type": "array", "items": {"type": "object"}},
                "packages": {"type": "array", "items": {"type": "object"}},
                "progress": {"type": "array", "items": {"type": "object"}},
                "logistics": {"type": "array", "items": {"type": "object"}},
                "qaChecklists": {"type": "array", "items": {"type": "object"}},
                "issues": {"type": "array", "items": {"type": "object"}},
                "summary": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Construction lens report returned"),
            "not_found": ExitCode(code=1, meaning="modelId not found"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="curl /api/models/<model-id>/construction-lens",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/construction-lens"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only field-app payload exposing construction package membership, progress, "
            "phase data, issue references, evidence references, logistics, and QA checklists."
        ),
    )
)

register(
    ToolDescriptor(
        name="set-element-construction",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetElementConstructionInput",
            "type": "object",
            "required": ["model_id", "element_id", "metadata"],
            "properties": {
                "model_id": {"type": "string"},
                "element_id": {"type": "string"},
                "phaseCreatedId": {"type": "string"},
                "phaseDemolishedId": {"type": "string"},
                "clearDemolished": {"type": "boolean"},
                "metadata": {
                    "type": "object",
                    "properties": {
                        "constructionPackageId": {"type": "string"},
                        "plannedStart": {"type": "string"},
                        "plannedEnd": {"type": "string"},
                        "actualStart": {"type": "string"},
                        "actualEnd": {"type": "string"},
                        "installationSequence": {"type": "integer"},
                        "dependencies": {"type": "array", "items": {"type": "string"}},
                        "progressStatus": {
                            "type": "string",
                            "enum": [
                                "not_started",
                                "in_progress",
                                "installed",
                                "inspected",
                                "accepted",
                            ],
                        },
                        "responsibleCompany": {"type": "string"},
                        "evidenceRefs": {"type": "array", "items": {"type": "object"}},
                        "issueIds": {"type": "array", "items": {"type": "string"}},
                        "punchItemIds": {"type": "array", "items": {"type": "string"}},
                        "inspectionChecklist": {"type": "array", "items": {"type": "object"}},
                    },
                    "additionalProperties": False,
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Construction metadata attached"),
            "not_found": ExitCode(code=1, meaning="elementId/modelId not found"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            'bim-ai apply-bundle \'{"commands":[{"type":"setElementConstruction",'
            '"elementId":"wall-1","metadata":{"progressStatus":"installed"}}],...}\''
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Mutates only construction metadata under element props plus optional phaseCreated/"
            "phaseDemolished ids. It does not reclassify design elements as temporary works."
        ),
    )
)

# ---------------------------------------------------------------------------
# OUT-V3-01 — Live presentation URL tools
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="presentation-create",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationCreateInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "pageScopeIds": {"type": "array", "items": {"type": "string"}, "default": []},
                "allowMeasurement": {"type": "boolean", "default": False},
                "allowComment": {"type": "boolean", "default": False},
                "expiresAt": {"type": "integer", "description": "Unix ms timestamp; null = never"},
                "displayName": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationCreateOutput",
            "type": "object",
            "required": ["id", "token", "url"],
            "properties": {
                "id": {"type": "string"},
                "token": {"type": "string"},
                "url": {"type": "string"},
                "isRevoked": {"type": "boolean"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai publish --link --model <id> [--allow-measurement] [--allow-comment]",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/presentations"),
        sideEffects="writes-audit",
        agentSafetyNotes="Creates a public shareable link. Use pageScopeIds to restrict visible pages.",
    )
)

register(
    ToolDescriptor(
        name="presentation-revoke",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationRevokeInput",
            "type": "object",
            "required": ["modelId", "linkId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "linkId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationRevokeOutput",
            "type": "object",
            "required": ["revokedAt"],
            "properties": {
                "revokedAt": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Presentation link not found"),
        },
        cliExample="bim-ai publish --revoke <link-id> --model <id>",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/presentations/{link_id}/revoke"
        ),
        sideEffects="writes-audit",
        agentSafetyNotes="Immediately invalidates the link and pushes {type: revoked} to all active WS viewers.",
    )
)

register(
    ToolDescriptor(
        name="presentation-list",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationListInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationListOutput",
            "type": "object",
            "required": ["presentations"],
            "properties": {
                "presentations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "token", "isRevoked"],
                        "properties": {
                            "id": {"type": "string"},
                            "token": {"type": "string"},
                            "isRevoked": {"type": "boolean"},
                            "allowMeasurement": {"type": "boolean"},
                            "allowComment": {"type": "boolean"},
                        },
                    },
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai publish --list --model <id>",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/presentations"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; lists non-revoked presentation links only.",
    )
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

_load_descriptor_module("bim_ai.api.descriptors.site")

_load_descriptor_module("bim_ai.api.descriptors.comparison_catalog")

# ---------------------------------------------------------------------------
# EDT-V3-09 — Stair tread auto-balance
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="update-stair-treads",
        category="mutation",
        inputSchema={
            "type": "object",
            "required": ["id", "treadLines"],
            "properties": {
                "id": {"type": "string"},
                "treadLines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "fromMm": {"type": "object"},
                            "toMm": {"type": "object"},
                            "riserHeightMm": {"type": "number"},
                            "manualOverride": {"type": "boolean"},
                        },
                    },
                },
            },
        },
        outputSchema={"type": "object"},
        exitCodes={
            "ok": ExitCode(code=0, meaning="Tread lines updated"),
            "not_found": ExitCode(code=1, meaning="Stair not found"),
        },
        cliExample="bim-ai update-stair-treads --id stair-1 --treadLines '[...]'",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
    )
)

_load_descriptor_module("bim_ai.api.descriptors.family_assets_materials")

_load_descriptor_module("bim_ai.api.descriptors.site_context")

# ---------------------------------------------------------------------------
# IMP-V3-01 — Image-as-underlay import
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="import-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportImageUnderlayInput",
            "type": "object",
            "required": ["id", "src", "rectMm"],
            "properties": {
                "id": {"type": "string", "description": "Element id for the new underlay."},
                "src": {
                    "type": "string",
                    "description": (
                        "Base64 data URI: data:image/png, data:image/jpeg, or "
                        "data:application/pdf. Maximum 50 MB."
                    ),
                },
                "rectMm": {
                    "type": "object",
                    "required": ["xMm", "yMm", "widthMm", "heightMm"],
                    "properties": {
                        "xMm": {"type": "number"},
                        "yMm": {"type": "number"},
                        "widthMm": {"type": "number"},
                        "heightMm": {"type": "number"},
                    },
                },
                "rotationDeg": {"type": "number", "default": 0.0},
                "opacity": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.4},
                "lockedScale": {"type": "boolean", "default": False},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay imported and element created"),
            "invalid_format": ExitCode(
                code=1,
                meaning="src is not a supported data URI (PNG, JPEG or PDF only)",
            ),
            "src_too_large": ExitCode(code=2, meaning="src exceeds 50 MB limit"),
            "duplicate_id": ExitCode(code=3, meaning="Element id already exists in model"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains import_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "IMP-V3-01: src must be a data URI with prefix data:image/png, "
            "data:image/jpeg, or data:application/pdf. "
            "Maximum base64-encoded payload size is 50 MB. "
            "Use move_image_underlay / scale_image_underlay / rotate_image_underlay "
            "to adjust the underlay after import. "
            "delete_image_underlay removes the element entirely."
        ),
    )
)

register(
    ToolDescriptor(
        name="move-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "MoveImageUnderlayInput",
            "type": "object",
            "required": ["id", "rectMm"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
                "rectMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {
                        "xMm": {"type": "number"},
                        "yMm": {"type": "number"},
                        "widthMm": {
                            "type": "number",
                            "description": "Ignored by the kernel; existing width is preserved.",
                        },
                        "heightMm": {
                            "type": "number",
                            "description": "Ignored by the kernel; existing height is preserved.",
                        },
                    },
                    "additionalProperties": False,
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "MoveImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay moved through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains move_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use the standard bundle dry-run path first. Move updates xMm/yMm only; "
            "scale-image-underlay owns width/height changes."
        ),
    )
)

register(
    ToolDescriptor(
        name="scale-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ScaleImageUnderlayInput",
            "type": "object",
            "required": ["id", "widthMm", "heightMm"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
                "widthMm": {"type": "number", "exclusiveMinimum": 0},
                "heightMm": {"type": "number", "exclusiveMinimum": 0},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ScaleImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay scaled through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains scale_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use the standard bundle dry-run path first. Scale preserves xMm/yMm and "
            "only changes widthMm/heightMm."
        ),
    )
)

register(
    ToolDescriptor(
        name="rotate-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RotateImageUnderlayInput",
            "type": "object",
            "required": ["id", "rotationDeg"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
                "rotationDeg": {"type": "number"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RotateImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay rotated through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains rotate_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Use the standard bundle dry-run path first. Rotation is stored in degrees.",
    )
)

register(
    ToolDescriptor(
        name="delete-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteImageUnderlayInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay deleted through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains delete_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use the standard bundle dry-run path first. Deleting the underlay removes "
            "the calibration/reference image from the model."
        ),
    )
)

# ---------------------------------------------------------------------------
# CON-V3-02 — Concept seed handoff tools
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="commit-concept-seed",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommitConceptSeedInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {
                    "type": "string",
                    "description": "ID of the ConceptSeedElem to commit (must be in 'draft' state).",
                },
                "envelopeTokens": {
                    "type": "array",
                    "description": "Additional envelope tokens to merge into the seed.",
                    "items": {
                        "type": "object",
                        "required": ["hostId", "t", "deltaMm", "scaleFactor", "rho"],
                        "properties": {
                            "hostId": {"type": "string"},
                            "t": {"type": "number"},
                            "deltaMm": {"type": "number"},
                            "scaleFactor": {"type": "number"},
                            "rho": {"type": "number"},
                        },
                    },
                },
                "kernelElementDrafts": {
                    "type": "array",
                    "description": "Additional kernel element drafts to merge.",
                    "items": {"type": "object"},
                },
                "assumptionsLog": {
                    "type": "array",
                    "description": "Additional assumption log entries to merge.",
                    "items": {
                        "type": "object",
                        "required": ["assumption", "confidence", "source"],
                        "properties": {
                            "assumption": {"type": "string"},
                            "confidence": {"type": "number"},
                            "source": {"type": "string"},
                        },
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommitConceptSeedOutput",
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "status": {"type": "string", "enum": ["committed"]},
                "committedAt": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(
                code=0, meaning="Seed transitioned to 'committed'; T9 may now consume it"
            ),
            "not_found": ExitCode(code=1, meaning="No ConceptSeedElem found with the given id"),
            "invalid_state": ExitCode(code=2, meaning="Seed is not in 'draft' state"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains commit_concept_seed command",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Idempotent within the T6 session: committing a draft seed is a one-way state "
            "transition. Do NOT call twice; the second call raises 400."
        ),
    )
)

register(
    ToolDescriptor(
        name="list-concept-seeds",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ListConceptSeedsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "description": "Target model UUID."},
                "status": {
                    "type": "string",
                    "enum": ["draft", "committed", "consumed"],
                    "description": "Filter by lifecycle status. Omit to return all seeds.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "type": "array",
            "items": {"type": "object"},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Seed list returned (may be empty)"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai api concept-seeds --model <id> --status committed",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/models/{modelId}/concept-seeds"),
        sideEffects="none",
        agentSafetyNotes="Safe read-only query. T9 polls this endpoint to discover seeds ready for ingestion.",
    )
)

# ---------------------------------------------------------------------------
# ANN-V3-01 — Detail-region drawing-mode
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="draw-detail-region",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DrawDetailRegionInput",
            "type": "object",
            "required": ["id", "viewId", "vertices"],
            "properties": {
                "id": {"type": "string"},
                "viewId": {"type": "string"},
                "vertices": {
                    "type": "array",
                    "minItems": 2,
                    "items": {
                        "type": "object",
                        "required": ["x", "y"],
                        "properties": {
                            "x": {"type": "number"},
                            "y": {"type": "number"},
                        },
                    },
                },
                "closed": {"type": "boolean", "default": False},
                "hatchId": {"type": "string"},
                "lineweightOverride": {"type": "number"},
                "phaseCreated": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DrawDetailRegionOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Detail region created"),
            "not_found": ExitCode(code=1, meaning="viewId not found in document"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains create_detail_region",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "ANN-V3-01: creates a DetailRegionElem on the target view. "
            "vertices is a list of {x, y} plan-mm points. "
            "closed=true fills the region with the optional hatch pattern."
        ),
    )
)

_load_descriptor_module("bim_ai.api.descriptors.material_pbr")

_load_descriptor_module("bim_ai.api.descriptors.sketch")

_load_descriptor_module("bim_ai.api.descriptors.source_reverse_bim")

_load_descriptor_module("bim_ai.api.descriptors.output_export")
