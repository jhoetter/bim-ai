# BIM AI

Browser-first BIM authoring with continuous server-authoritative collaboration —
no central file to synchronize. Semantic walls / doors / rooms, realtime
WebSocket snapshots, constraint checks, issues, AI propose flow.

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

## Where to look

- [`AGENTS.md`](./AGENTS.md) — operational guide for any agent or contributor.
- [`CLAUDE.md`](./CLAUDE.md) — instructions Claude Code reads in this repo.
- [`claude-skills/`](./claude-skills) — recurring complex-task playbooks
  (each skill carries its own `SKILL.md`).
- [`spec/`](./spec) — active product, methodology, and parity trackers
  (closeout snapshots in [`spec/archive/`](./spec/archive)).
- [`docs/icon-library.md`](./docs/icon-library.md) — icon catalog (source at
  [github.com/jhoetter/bim-icons](https://github.com/jhoetter/bim-icons)).
