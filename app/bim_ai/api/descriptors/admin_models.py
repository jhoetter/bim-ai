"""Admin-grade model lifecycle: cascade delete by slug pattern.

Phase A.1 of mcp-native-bim-agent-tracker — replaces the agent's
direct asyncpg purge in `bim-agent/scripts/testhouse_purge.py` with
an MCP-callable REST endpoint.
"""
from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

register(
    ToolDescriptor(
        name="delete-models",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteModelsInput",
            "type": "object",
            "required": ["slug_like"],
            "properties": {
                "slug_like": {
                    "type": "string",
                    "description": "SQL LIKE pattern matching `bim_models.slug` (use `%` wildcards).",
                    "minLength": 1,
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "If true, report targets without touching the DB.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteModelsResult",
            "type": "object",
            "required": ["ok", "target_count", "removed", "remaining"],
            "properties": {
                "ok": {"type": "boolean"},
                "dry_run": {"type": "boolean"},
                "target_count": {"type": "integer"},
                "removed": {"type": "integer"},
                "remaining": {"type": "integer"},
                "step_counts": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=200, meaning="Cascade complete."),
            "missing_input": ExitCode(code=422, meaning="slug_like is required."),
        },
        cliExample=(
            "curl -X POST http://127.0.0.1:28500/api/v3/models/delete "
            "-H 'content-type: application/json' "
            "-d '{\"slug_like\": \"house-21%\", \"dry_run\": true}'"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/delete"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "DESTRUCTIVE. Cascade-deletes every bim_models row whose slug matches the LIKE pattern, "
            "plus all dependent rows (commits, snapshots, undo/redo, comments, activity, milestones, "
            "role_assignments, public_links). Always run with dry_run=true first to confirm the target "
            "set. The agent typically uses this between iters to start from a clean slate."
        ),
        stableId="delete-models",
        mutability="write",
        requiredPermissions=["admin"],
        implementationStatus="implemented",
    )
)
