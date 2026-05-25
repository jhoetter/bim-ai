#!/usr/bin/env python3
"""bim-ai MCP server — generic adapter over the existing ToolDescriptor catalog.

bim-ai's REST surface is already typed end-to-end as a `ToolDescriptor`
registry of ~141 entries (see `app/bim_ai/api/registry_core.py` and
`app/bim_ai/api/{descriptors,registry}/*.py`). Each entry carries:

  - name (e.g. "apply-bundle", "compare-snapshots", "author.stair_by_runs")
  - category (query | mutation | transform | job | introspection)
  - inputSchema  (full JSON Schema)
  - outputSchema (full JSON Schema)
  - restEndpoint (method + path on bim-ai's :28500 surface)
  - agentSafetyNotes, sideEffects, mutability, requiredPermissions

This server enumerates the catalog at startup and registers one tool per
descriptor on the low-level MCP server (`Server.list_tools` /
`Server.call_tool` handlers). The handler proxies to bim-ai's REST API
(httpx to `http://127.0.0.1:28500`) — so the MCP server is a transport
shim, not a re-implementation. If `BIM_AI_URL` env is set, that base URL
is used instead.

We bypass `FastMCP`'s function-signature introspection because each
descriptor has its own JSON Schema and we don't want to generate ~141
explicit handler functions. The low-level `Server` API lets us register
all tools with their raw inputSchemas and a single generic dispatcher.

Configure in Claude Desktop / Claude Code MCP config:
{
  "mcpServers": {
    "bim-ai": {
      "command": "uv",
      "args": ["run", "--project", "<bim-ai>/app", "python", "<bim-ai>/mcp_server.py"]
    }
  }
}

Phase A of `bim-agent/spec/trackers/mcp-native-bim-agent-tracker.md`.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import httpx
import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from bim_ai.api.registry import get_catalog, get_descriptor  # noqa: E402

BIM_AI_URL = os.environ.get("BIM_AI_URL", "http://127.0.0.1:28500").rstrip("/")
REQUEST_TIMEOUT = float(os.environ.get("BIM_AI_MCP_TIMEOUT", "600"))


def _mcp_name(descriptor_name: str) -> str:
    """ToolDescriptor names can contain '.' (e.g. 'commands.schema.catalog')
    and '-' (e.g. 'apply-bundle'); MCP tool names are conventionally
    snake-case identifiers. Normalize: replace any non-[A-Za-z0-9_] with '_'.
    """
    return re.sub(r"[^A-Za-z0-9_]", "_", descriptor_name)


def _path_params(path: str) -> list[str]:
    """Extract `{name}` placeholders from a REST path."""
    return re.findall(r"\{([^/{}]+)\}", path)


def _render_path(path: str, params: dict) -> tuple[str, dict]:
    """Substitute `{name}` in path from params, return (rendered_path, remaining_params)."""
    remaining = dict(params)
    rendered = path
    for placeholder in _path_params(path):
        if placeholder in remaining:
            rendered = rendered.replace(
                "{" + placeholder + "}", str(remaining.pop(placeholder))
            )
    return rendered, remaining


async def _proxy(descriptor_name: str, params: dict) -> object:
    """Proxy an MCP tool invocation to bim-ai's REST endpoint."""
    desc = get_descriptor(descriptor_name)
    if desc is None:
        return {"error": f"unknown tool: {descriptor_name}"}
    endpoint = desc.restEndpoint
    if endpoint is None:
        return {"error": f"tool {descriptor_name} has no REST endpoint binding"}

    rendered_path, body_or_query = _render_path(endpoint.path, dict(params or {}))
    url = f"{BIM_AI_URL}{rendered_path}"
    method = endpoint.method.upper()

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        if method == "GET":
            resp = await client.get(url, params=body_or_query or None)
        else:
            resp = await client.request(method, url, json=body_or_query or None)
    try:
        return resp.json()
    except json.JSONDecodeError:
        return {"status_code": resp.status_code, "text": resp.text}


# Map MCP-normalized name → descriptor name for the call dispatcher.
_NAME_MAP: dict[str, str] = {}


def _build_tool_list() -> list[types.Tool]:
    """Enumerate ToolDescriptors and return one MCP Tool per descriptor.

    Each descriptor's inputSchema describes the REST body — but our generic
    proxy also uses the same args dict for URL path-parameter substitution
    (e.g. `{model_id}` in `/api/models/{model_id}/bundles`). So before
    exposing the schema as an MCP tool inputSchema, we:

      1. Add each `{param}` from `restEndpoint.path` to `properties` as a
         required string field (if not already declared).
      2. Strip `additionalProperties: False` so per-tool extras (e.g.
         legacy fields the REST route accepts but the descriptor doesn't
         enumerate) pass MCP validation.
    """
    catalog = get_catalog()
    tools: list[types.Tool] = []
    for desc in catalog.tools:
        mcp_name = _mcp_name(desc.name)
        _NAME_MAP[mcp_name] = desc.name
        description = (desc.agentSafetyNotes or "").strip()
        if not description:
            try:
                description = desc.inputSchema.get("description") or desc.inputSchema.get("title") or desc.name
            except AttributeError:
                description = desc.name
        description = (
            f"{description}\n\n"
            f"category: {desc.category} | mutability: {desc.mutability or 'unspecified'} | "
            f"side_effects: {desc.sideEffects} | REST: {desc.restEndpoint.method} {desc.restEndpoint.path}"
        )
        schema = dict(desc.inputSchema or {"type": "object", "properties": {}})
        if "type" not in schema:
            schema["type"] = "object"
        # Merge path params into the schema as string properties.
        path_params = _path_params(desc.restEndpoint.path)
        if path_params:
            props = dict(schema.get("properties") or {})
            for p in path_params:
                if p not in props:
                    props[p] = {"type": "string", "description": f"Path parameter (URL `{{{p}}}`)."}
            schema["properties"] = props
        # Drop strict-extras flag so the proxy can pass through path params
        # + occasional legacy body fields without MCP-layer validation errors.
        schema.pop("additionalProperties", None)
        tools.append(types.Tool(name=mcp_name, description=description, inputSchema=schema))
    return tools


async def main() -> None:
    server: Server = Server("bim-ai")
    tools = _build_tool_list()
    print(f"[bim-ai mcp] enumerated {len(tools)} tools from ToolDescriptor catalog", file=sys.stderr)
    print(f"[bim-ai mcp] proxying to {BIM_AI_URL}", file=sys.stderr)

    @server.list_tools()
    async def _list_tools() -> list[types.Tool]:
        return tools

    @server.call_tool()
    async def _call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
        descriptor_name = _NAME_MAP.get(name)
        if descriptor_name is None:
            payload = {"error": f"unknown tool: {name}"}
        else:
            payload = await _proxy(descriptor_name, arguments or {})
        return [types.TextContent(type="text", text=json.dumps(payload))]

    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
