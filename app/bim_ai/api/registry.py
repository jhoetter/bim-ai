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
            "revision_conflict": ExitCode(code=2, meaning="parentRevision does not match current revision"),
            "assumption_log_required": ExitCode(code=3, meaning="assumptions field missing or malformed"),
            "assumption_log_malformed": ExitCode(code=4, meaning="assumption entry is missing required field or has invalid value"),
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
            "ok": ExitCode(code=0, meaning="Connection accepted; yjs sync + awareness relay active"),
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

# ---------------------------------------------------------------------------
# TOP-V3-01 — Toposolid tool descriptors
# ---------------------------------------------------------------------------

_TOPOSOLID_BOUNDARY_SCHEMA: dict[str, Any] = {
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
}

register(
    ToolDescriptor(
        name="toposolid-create",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId", "boundaryMm"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
                "name": {"type": "string"},
                "boundaryMm": _TOPOSOLID_BOUNDARY_SCHEMA,
                "heightSamples": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["xMm", "yMm", "zMm"],
                        "properties": {
                            "xMm": {"type": "number"},
                            "yMm": {"type": "number"},
                            "zMm": {"type": "number"},
                        },
                    },
                },
                "heightmapGridMm": {
                    "type": "object",
                    "required": ["stepMm", "rows", "cols", "values"],
                    "properties": {
                        "stepMm": {"type": "number"},
                        "rows": {"type": "integer"},
                        "cols": {"type": "integer"},
                        "values": {"type": "array", "items": {"type": "number"}},
                    },
                },
                "thicknessMm": {"type": "number", "default": 1500},
                "baseElevationMm": {"type": "number"},
                "defaultMaterialKey": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid created"),
            "error": ExitCode(code=1, meaning="Validation error or duplicate id"),
        },
        cliExample=(
            "bim-ai toposolid create "
            "--boundary '[{\"xMm\":0,\"yMm\":0},{\"xMm\":10000,\"yMm\":0},{\"xMm\":10000,\"yMm\":10000},{\"xMm\":0,\"yMm\":10000}]' "
            "--thickness 1500"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "TOP-V3-01: supply either heightSamples (sparse) or heightmapGridMm (grid), not both. "
            "Omitting both creates a flat-starter terrain at baseElevationMm."
        ),
    )
)

register(
    ToolDescriptor(
        name="toposolid-update",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
                "name": {"type": "string"},
                "thicknessMm": {"type": "number"},
                "baseElevationMm": {"type": "number"},
                "defaultMaterialKey": {"type": "string"},
                "pinned": {"type": "boolean"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid updated"),
            "not_found": ExitCode(code=1, meaning="toposolidId not found"),
        },
        cliExample="bim-ai toposolid update topo-1 --thickness 2000",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
    )
)

register(
    ToolDescriptor(
        name="toposolid-delete",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid deleted"),
            "not_found": ExitCode(code=1, meaning="toposolidId not found"),
        },
        cliExample="bim-ai toposolid delete topo-1",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Emits a warning advisory (not an error) if floor elements reference "
            "this toposolid as their host before deletion."
        ),
    )
)
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
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/presentations/{link_id}/revoke"),
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
# IMG-V3-01 — Image-to-layout trace
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="img-trace",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImgTraceInput",
            "type": "object",
            "required": ["image"],
            "properties": {
                "image": {
                    "type": "string",
                    "format": "binary",
                    "description": "Image file (multipart/form-data field 'image'). JPEG or PNG.",
                },
                "archetypeHint": {
                    "type": "string",
                    "description": "Optional layout archetype hint (e.g. 'residential_apartment').",
                },
                "brief": {
                    "type": "string",
                    "description": "Optional free-text design brief (multipart field 'brief').",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StructuredLayout",
            "type": "object",
            "required": ["schemaVersion", "imageMetadata", "rooms", "walls", "openings", "ocrLabels", "advisories"],
            "properties": {
                "schemaVersion": {"type": "string", "enum": ["img-v3.0"]},
                "imageMetadata": {
                    "type": "object",
                    "required": ["widthPx", "heightPx"],
                    "properties": {
                        "widthPx": {"type": "integer"},
                        "heightPx": {"type": "integer"},
                        "calibrationMmPerPx": {"type": "number"},
                    },
                },
                "rooms": {"type": "array", "items": {"type": "object"}},
                "walls": {"type": "array", "items": {"type": "object"}},
                "openings": {"type": "array", "items": {"type": "object"}},
                "ocrLabels": {"type": "array", "items": {"type": "object"}},
                "advisories": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["code"],
                        "properties": {
                            "code": {"type": "string"},
                            "message": {"type": "string"},
                        },
                    },
                },
                "jobId": {
                    "type": "string",
                    "description": "Present instead of layout fields when image >2MB was enqueued.",
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Layout extracted successfully"),
            "no_walls_detected": ExitCode(code=1, meaning="No wall segments found; image may not be a floor plan"),
        },
        cliExample="bim-ai trace --image plan.png --archetype-hint residential_apartment -o layout.json",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/trace"),
        sideEffects="none",
        agentSafetyNotes=(
            "Deterministic: same image bytes → byte-identical StructuredLayout JSON. "
            "Images >2MB are enqueued as image_trace jobs; response contains {jobId}. "
            "Check advisories[].code for 'no_walls_detected', 'low_contrast_image', "
            "'opencv_unavailable', 'tesseract_unavailable'. "
            "Exit code 1 (no_walls_detected) means the image is likely not a floor plan."
        ),
    )
)
