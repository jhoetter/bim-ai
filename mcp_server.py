#!/usr/bin/env python3
"""bim-ai MCP server — generic adapter over the existing ToolDescriptor catalog.

bim-ai's REST surface is already typed end-to-end as a `ToolDescriptor`
registry of ~140 entries (see `app/bim_ai/api/registry_core.py` and
`app/bim_ai/api/{descriptors,registry}/*.py`). Each entry carries:

  - name (e.g. "apply-bundle", "compare-snapshots", "author.stair_by_runs")
  - category (query | mutation | transform | job | introspection)
  - inputSchema  (full JSON Schema)
  - outputSchema (full JSON Schema)
  - restEndpoint (method + path on bim-ai's :28500 surface)
  - agentSafetyNotes, sideEffects, mutability, requiredPermissions

This server enumerates the catalog at startup and registers one FastMCP
`@mcp.tool()` per descriptor. The handler proxies to bim-ai's REST API
(httpx to `http://127.0.0.1:28500`) — so the MCP server is a transport
shim, not a re-implementation. If `BIM_AI_URL` env is set, that base URL
is used instead.

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

import asyncio
import json
import os
import re
import sys
from dataclasses import asdict
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import httpx
from mcp.server.fastmcp import FastMCP

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


def _render_path(path: str, params: dict[str, object]) -> tuple[str, dict[str, object]]:
    """Substitute `{name}` in path from params, return (rendered_path, remaining_params)."""
    remaining = dict(params)
    rendered = path
    for placeholder in _path_params(path):
        if placeholder in remaining:
            rendered = rendered.replace(
                "{" + placeholder + "}", str(remaining.pop(placeholder))
            )
    return rendered, remaining


async def _proxy(descriptor_name: str, params: dict[str, object]) -> object:
    """Proxy an MCP tool invocation to bim-ai's REST endpoint."""
    desc = get_descriptor(descriptor_name)
    if desc is None:
        raise RuntimeError(f"unknown tool: {descriptor_name}")
    endpoint = desc.restEndpoint
    if endpoint is None:
        raise RuntimeError(f"tool {descriptor_name} has no REST endpoint binding")

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


def _register_all(server: FastMCP) -> int:
    """Iterate the bim-ai ToolDescriptor catalog and register one MCP tool per entry."""
    catalog = get_catalog()
    registered = 0
    for desc in catalog.tools:
        mcp_name = _mcp_name(desc.name)
        description = (desc.agentSafetyNotes or "").strip()
        if not description:
            try:
                description = desc.inputSchema.get("description") or desc.inputSchema.get("title") or desc.name
            except AttributeError:
                description = desc.name
        # Attach descriptor metadata into the description footer so MCP clients
        # see the side-effects / category at a glance.
        description = (
            f"{description}\n\n"
            f"category: {desc.category} | mutability: {desc.mutability or 'unspecified'} | "
            f"side_effects: {desc.sideEffects} | REST: {desc.restEndpoint.method} {desc.restEndpoint.path}"
        )

        # Closure-bind the descriptor name so each tool calls its own endpoint.
        # FastMCP rejects parameters starting with underscore, so we use a default-
        # value trick on a non-underscore-prefixed kwarg.
        def _make_tool(captured_name: str):
            async def tool(arguments: dict | None = None) -> object:
                return await _proxy(captured_name, arguments or {})
            return tool

        server.add_tool(
            fn=_make_tool(desc.name),
            name=mcp_name,
            description=description,
        )
        registered += 1
    return registered


def main() -> None:
    server = FastMCP("bim-ai")
    registered = _register_all(server)
    print(f"[bim-ai mcp] registered {registered} tools from ToolDescriptor catalog", file=sys.stderr)
    print(f"[bim-ai mcp] proxying to {BIM_AI_URL}", file=sys.stderr)
    server.run()


if __name__ == "__main__":
    main()
