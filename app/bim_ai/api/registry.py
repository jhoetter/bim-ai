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

register(
    ToolDescriptor(
        name="fire-safety-lens-review-status",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "FireSafetyLensReviewStatusInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "FireSafetyLensReviewStatus",
            "type": "object",
            "required": [
                "modelId",
                "format",
                "lensId",
                "scheduleDefaults",
                "viewDefaults",
                "sheetDefaults",
                "counts",
                "schedules",
            ],
            "properties": {
                "modelId": {"type": "string"},
                "format": {"const": "fireSafetyLensReviewStatus_v1"},
                "lensId": {"const": "fire-safety"},
                "germanName": {"const": "Brandschutz"},
                "scheduleDefaults": {"type": "array", "items": {"type": "object"}},
                "viewDefaults": {"type": "array", "items": {"type": "object"}},
                "sheetDefaults": {"type": "array", "items": {"type": "object"}},
                "nonGoals": {"type": "array", "items": {"type": "string"}},
                "counts": {"type": "object"},
                "schedules": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Fire Safety Lens readout generated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai fire-safety-lens-review-status --model-id <id>",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/fire-safety-lens"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Brandschutz review payload. It exposes consultant-review "
            "schedules and statuses, but does not claim jurisdictional fire-code approval."
        ),
    )
)

register(
    ToolDescriptor(
        name="cost-quantity-lens-review-status",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CostQuantityLensReviewStatusInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CostQuantityLensReviewStatus",
            "type": "object",
            "required": [
                "modelId",
                "format",
                "lensId",
                "scheduleDefaults",
                "viewDefaults",
                "sheetDefaults",
                "counts",
                "totals",
                "schedules",
            ],
            "properties": {
                "modelId": {"type": "string"},
                "format": {"const": "costQuantityLensReviewStatus_v1"},
                "lensId": {"const": "cost-quantity"},
                "englishName": {"const": "Cost and Quantity"},
                "germanName": {"const": "Kosten und Mengen"},
                "scheduleDefaults": {"type": "array", "items": {"type": "object"}},
                "viewDefaults": {"type": "array", "items": {"type": "object"}},
                "sheetDefaults": {"type": "array", "items": {"type": "object"}},
                "nonGoals": {"type": "array", "items": {"type": "string"}},
                "counts": {"type": "object"},
                "totals": {"type": "object"},
                "schedules": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Cost and Quantity Lens readout generated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai cost-quantity-lens-review-status --model-id <id>",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/cost-quantity-lens"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Kosten und Mengen payload. Unit rates without source references "
            "are surfaced for review but excluded from cost totals."
        ),
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
            '--boundary \'[{"xMm":0,"yMm":0},{"xMm":10000,"yMm":0},{"xMm":10000,"yMm":10000},{"xMm":0,"yMm":10000}]\' '
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
            "required": [
                "schemaVersion",
                "imageMetadata",
                "rooms",
                "walls",
                "openings",
                "ocrLabels",
                "advisories",
            ],
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
            "no_walls_detected": ExitCode(
                code=1, meaning="No wall segments found; image may not be a floor plan"
            ),
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
                "hostToposolidId": {"type": "string", "description": "Id of the host toposolid element"},
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
            "--boundary '[{\"xMm\":0,\"yMm\":0},{\"xMm\":5000,\"yMm\":0},{\"xMm\":5000,\"yMm\":5000}]' "
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

register(
    ToolDescriptor(
        name="compare-snapshots",
        category="query",
        inputSchema={
            "type": "object",
            "required": ["snapshotA", "snapshotB"],
            "properties": {
                "snapshotA": {"type": "object", "description": "First model snapshot"},
                "snapshotB": {"type": "object", "description": "Second model snapshot"},
                "metric": {
                    "type": "string",
                    "enum": ["ssim", "mse", "pixel-diff"],
                    "default": "ssim",
                },
                "threshold": {"type": "number", "description": "Pass/fail threshold"},
                "region": {"type": "string", "description": "Named region mask"},
            },
        },
        outputSchema={
            "type": "object",
            "properties": {
                "schemaVersion": {"type": "string"},
                "metric": {"type": "string"},
                "score": {"type": "number"},
                "thresholdPassed": {"type": "boolean"},
                "perRegionScores": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Comparison complete; score returned"),
            "threshold_fail": ExitCode(code=1, meaning="Score below threshold"),
        },
        cliExample="bim-ai compare pre.json post.json --metric ssim --threshold 0.7",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/compare"),
        sideEffects="none",
        agentSafetyNotes="Safe to call any number of times. Same inputs → byte-identical output.",
    )
)

# ---------------------------------------------------------------------------
# CTL-V3-01 — Catalog query
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="catalog-query",
        category="query",
        inputSchema={
            "type": "object",
            "properties": {
                "kind": {"type": "string", "description": "Element kind to filter (e.g. 'door', 'window', 'sofa')"},
                "maxWidthMm": {"type": "number"},
                "minWidthMm": {"type": "number"},
                "tag": {"type": "string"},
                "style": {"type": "string"},
                "page": {"type": "integer", "default": 0},
                "pageSize": {"type": "integer", "default": 50},
            },
        },
        outputSchema={
            "type": "object",
            "properties": {
                "schemaVersion": {"type": "string"},
                "items": {"type": "array"},
                "total": {"type": "integer"},
                "page": {"type": "integer"},
                "pageSize": {"type": "integer"},
            },
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Query successful")},
        cliExample="bim-ai catalog query --kind door --max-width 900 --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/catalog"),
        sideEffects="none",
        agentSafetyNotes=(
            "Safe to call any number of times. Deterministic — same query → identical result. "
            "Use to discover catalog keys before emitting bundles."
        ),
    )
)

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
            "required": ["modelId", "id", "hostToposolidId", "boundaryMm", "finishCategory", "materialKey"],
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
            "ok": ExitCode(code=0, meaning="Seed transitioned to 'committed'; T9 may now consume it"),
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
        restEndpoint=RestEndpoint(
            method="GET", path="/api/v3/models/{modelId}/concept-seeds"
        ),
        sideEffects="none",
        agentSafetyNotes="Safe read-only query. T9 polls this endpoint to discover seeds ready for ingestion.",
    )
)

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
        restEndpoint=RestEndpoint(
            method="GET", path="/api/v3/models/{modelId}/export/pdf"
        ),
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

# ---------------------------------------------------------------------------
# AGT-V3-06 — External model-call audit export
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="external-model-call-audit-export",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExternalModelCallAuditExportInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExternalModelCallAuditCsv",
            "type": "string",
            "description": "CSV with jobId, modelId, modelVersion, trainOnInputFlag, timestamp, agentIdentifier.",
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="External model-call audit CSV returned"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="curl /api/v3/ai/audit-log.csv",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/ai/audit-log.csv"),
        sideEffects="none",
        agentSafetyNotes=(
            "AGT-V3-06: v3 has no external AI calls, so this export is header-only. "
            "Future integrations must validate calls through bim_ai.ai_boundary with "
            "trainOnInputFlag=false."
        ),
    )
)
