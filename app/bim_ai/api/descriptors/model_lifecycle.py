"""ToolDescriptors for model lifecycle endpoints.

These REST handlers already existed in `routes/api.py` but were never
registered as ToolDescriptors. Phase A.1 of the mcp-native tracker adds
them so the MCP server's auto-adapter picks them up.
"""
from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

register(
    ToolDescriptor(
        name="bootstrap",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BootstrapInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BootstrapResult",
            "type": "object",
            "required": ["projects"],
            "properties": {
                "projects": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "slug", "models"],
                        "properties": {
                            "id": {"type": "string"},
                            "slug": {"type": "string"},
                            "label": {"type": ["string", "null"]},
                            "models": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "slug": {"type": ["string", "null"]},
                                        "label": {"type": ["string", "null"]},
                                        "latestRevision": {"type": ["integer", "null"]},
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=200, meaning="Catalog returned successfully."),
        },
        cliExample="curl http://127.0.0.1:28500/api/bootstrap",
        restEndpoint=RestEndpoint(method="GET", path="/api/bootstrap"),
        sideEffects="none",
        agentSafetyNotes=(
            "List all projects and their models. Read-only enumeration; safe to call any time. "
            "Use this as the first call to discover existing model_ids before applying bundles."
        ),
        stableId="bootstrap",
        mutability="read",
        implementationStatus="implemented",
    )
)

register(
    ToolDescriptor(
        name="create-model",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateModelInput",
            "type": "object",
            "required": ["project_id", "slug"],
            "properties": {
                "project_id": {"type": "string", "format": "uuid"},
                "slug": {"type": "string", "minLength": 1},
                "label": {"type": ["string", "null"]},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateModelResult",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string"},
                "slug": {"type": "string"},
                "project_id": {"type": "string"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=200, meaning="Model created."),
            "conflict": ExitCode(code=409, meaning="Slug already in use under this project."),
        },
        cliExample=(
            "curl -X POST http://127.0.0.1:28500/api/projects/<pid>/models "
            "-H 'content-type: application/json' -d '{\"slug\": \"my-house\"}'"
        ),
        restEndpoint=RestEndpoint(
            method="POST", path="/api/projects/{project_id}/models"
        ),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Create a new empty BIM model under the given project. Idempotent on slug — re-use the slug to "
            "find an existing model id via bootstrap instead of calling this twice."
        ),
        stableId="create-model",
        mutability="write",
        implementationStatus="implemented",
    )
)

register(
    ToolDescriptor(
        name="get-model-snapshot",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "GetModelSnapshotInput",
            "type": "object",
            "required": ["model_id"],
            "properties": {
                "model_id": {"type": "string", "format": "uuid"},
                "include_bundle_hashes": {"type": "boolean", "default": False},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSnapshot",
            "type": "object",
            "required": ["revision"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "elements": {"type": "object"},
                "violations": {"type": "array"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=200, meaning="Snapshot returned."),
            "not_found": ExitCode(code=404, meaning="Model not found."),
        },
        cliExample="curl http://127.0.0.1:28500/api/models/<id>/snapshot",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/snapshot"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Fetch the current state of a model (elements + revision + active violations). "
            "Read-only. Use before applying a bundle to compute the correct parentRevision."
        ),
        stableId="get-model-snapshot",
        mutability="read",
        implementationStatus="implemented",
    )
)
