# Agent evidence loop (CLI + UI)

Agents and humans can produce a repeatable **evidence artifact** without mutating the model:

1. **`bim-ai evidence`** (`packages/cli/cli.mjs`) — `GET` snapshot + validate, emits JSON with `countsByKind`, `revision`, and the full validate payload (violations + summary + checks).

2. **Browser** — Workspace layout **Agent review** exposes the same checklist; **Fetch browser evidence bundle** mirrors the CLI shape via `/api/models/:id/snapshot` + `/validate`.

3. **Dry-run** — `bim-ai apply-bundle --dry-run <bundle.json>` previews commits; pair with evidence before and after when debugging agent regressions.

4. **Golden bundle** — `bim-ai plan-house …` emits the shared one-family fixture; assumptions are documented inline in Agent review and CLI bundle `meta.note`.
