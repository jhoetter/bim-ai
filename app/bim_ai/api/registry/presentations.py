"""Presentation share-link descriptors (create / revoke / list).

Extracted from registry.py (BRT-25).
"""

from __future__ import annotations

from bim_ai.api.registry_core import (
    ExitCode,
    RestEndpoint,
    ToolDescriptor,
    register,
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
