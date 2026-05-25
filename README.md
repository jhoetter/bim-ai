# BIM AI

**Browser-first BIM authoring engine.** Semantic walls / doors / rooms / roofs
on a continuous server-authoritative model — no central file to synchronize.
Realtime WebSocket snapshots, constraint checks, issue threads, an `apply_bundle`
MCP entry point that takes a CMD-V3 bundle and commits it transactionally.

This repo is **only** the modeling software. It owns: the geometry kernel,
the CMD-V3 schema + executor, the viewer, IFC export, materials, constraint
preflight, the Postgres-backed `bim_models` store, and the WebSocket sync.

Everything that **decides what to model** — reading source PDFs, classifying
pages, constructing IRs, building CMD-V3 bundles from semantic intent, running
graders — lives in the sibling [`bim-agent`](https://github.com/jhoetter/bim-agent)
repo and talks to bim-ai over its REST + MCP surface.

Collaboration model: [`docs/collaboration-model.md`](./docs/collaboration-model.md).

## Quickstart

```bash
make install
make dev              # default ports
make dev-forwarded    # forwarded port range (sandboxed / remote-shell setups)
```

Ports, infra, and all dev targets are defined in the [`Makefile`](./Makefile);
`make help` lists them. Stack details live in
[`package.json`](./package.json) and [`app/pyproject.toml`](./app/pyproject.toml).

## Verify

```bash
pnpm verify:strict
make verify
```

`make verify` is the full local merge gate and mirrors CI.
[`AGENTS.md`](./AGENTS.md) lists the exact CI commands and pinned tool
versions (Node, pnpm, Python, `uv`).

## MCP server

bim-ai ships a stdio MCP server at [`mcp_server.py`](./mcp_server.py). At
startup it enumerates the full ToolDescriptor catalog (~141 entries —
`apply-bundle`, `compare-snapshots`, `author.stair_by_runs`, and the rest
of the registry defined under `app/bim_ai/api/`) and registers one MCP
tool per descriptor. Each invocation proxies to the matching REST
endpoint on bim-ai's `:28500` surface, so the MCP server is a transport
shim and not a re-implementation — the REST API stays canonical and any
new descriptor automatically shows up as an MCP tool.

The server requires bim-ai's REST stack to be running. Start it with
`make dev-forwarded` (API on `:28500`) before connecting any MCP client.

To register in Claude Code, add to the MCP config:

```json
{
  "mcpServers": {
    "bim-ai": {
      "command": "uv",
      "args": ["run", "--project", "/home/jhoetter/repos/bim-ai/app", "python", "/home/jhoetter/repos/bim-ai/mcp_server.py"]
    }
  }
}
```

Useful env vars: `BIM_AI_URL` overrides the proxy target (default
`http://127.0.0.1:28500`); `BIM_AI_MCP_TIMEOUT` sets the per-request
httpx timeout in seconds (default `600`).

For standalone debugging the [`Makefile`](./Makefile) exposes a `make
mcp` target that runs the server over stdio against the same `uv`
project, useful for piping `tools/list` / `tools/call` JSON-RPC frames
by hand.

## Where to look

- [`AGENTS.md`](./AGENTS.md) — operational guide for any agent or contributor.
- [`CLAUDE.md`](./CLAUDE.md) — instructions Claude Code reads in this repo.
- [`claude-skills/`](./claude-skills) — recurring complex-task playbooks
  (each skill carries its own `SKILL.md`).
- [`spec/`](./spec) — active product, methodology, and parity trackers
  (closeout snapshots in [`spec/archive/`](./spec/archive)).
- [`docs/icon-library.md`](./docs/icon-library.md) — icon catalog (source at
  [github.com/jhoetter/bim-icons](https://github.com/jhoetter/bim-icons)).
