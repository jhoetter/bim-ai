"""API-V3-01 — Tool registry.

Every kernel verb registers a ToolDescriptor here at boot.  The registry is
in-memory and populated by calling `register()` at module import time (or from
each theme WP's own module when it lands).
"""

from __future__ import annotations

from importlib import import_module

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
# Per-group descriptor modules (BRT-25) — loaded here so their register()
# calls fire in original source order. Do NOT reorder these calls; the
# OpenAPI snapshot and MCP catalog depend on insertion order.
# ---------------------------------------------------------------------------

_load_descriptor_module("bim_ai.api.registry.geometry")
_load_descriptor_module("bim_ai.api.registry.mep")
_load_descriptor_module("bim_ai.api.registry.documentation")

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


_load_descriptor_module("bim_ai.api.registry.presentations")
_load_descriptor_module("bim_ai.api.registry.schedule")
_load_descriptor_module("bim_ai.api.registry.site")

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
