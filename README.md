# BIM AI (v1)

Browser-first BIM coordination: semantic walls/doors/rooms, realtime WebSocket snapshots, constraint checks, issues, AI propose flow.

> BIM AI is the first BIM authoring environment with continuous server-authoritative collaboration; there is no central file to synchronize. See [`docs/collaboration-model.md`](./docs/collaboration-model.md).

## Quickstart

```bash
make install
make dev          # infra + API :8500 + web :2000
```

Health: http://127.0.0.1:8500/api/health

Ports follow the sibling “suite” spacing; see `Makefile` comments.

## Stack

- **Frontend**: PNPM workspaces, Turborepo, Vite 6 + React 19 + TypeScript + Tailwind (`packages/web`).
- **Backend**: FastAPI + SQLAlchemy 2 async + Postgres (`app/`).
- **Infra**: Docker Compose Postgres (5545 host), Redis (6392), MinIO (9120/9121) — placeholders for uploads v2.

Icon library: [`docs/icon-library.md`](./docs/icon-library.md) — source lives in [github.com/jhoetter/bim-icons](https://github.com/jhoetter/bim-icons).

See `spec/prd.md` for product scope.
Active UI to-do list: [`OPEN_TASKS.md`](./OPEN_TASKS.md).
Onboarding for the next agent (or human): [`HANDOVER.md`](./HANDOVER.md).

Revit parity tracker: 120 ✅ fully available / 0 🟡 partial / 0 ❌ not available — see `spec/revit-parity/`.

## Makefile

| Target    | Meaning                                     |
| --------- | ------------------------------------------- |
| `install` | JS + Python venv + deps                     |
| `dev`     | compose up + API + web                      |
| `verify`  | Format, Python lint, arch, TC, tests, build |
| `seed`    | Populate demo model idempotently            |

## Quality Gates

The canonical merge gate is automated and is the same gate used by CI:

```bash
pnpm verify:strict
make verify
```

`pnpm verify` is the lighter JavaScript workspace check: formatting,
architecture, and tests. `pnpm verify:strict` adds TypeScript typecheck and
build. `make verify` is the full local monorepo gate and adds Python ruff,
Python tests, and the Python lockfile check.

Backend test commands are split by intent:

```bash
make test-py
make test-py-focused PYTEST_ARGS="tests/api/test_activity_route.py"
```

`make test-py` is the full coverage-enforced backend gate used by `make verify`.
`make test-py-focused` disables coverage for narrow development runs so the
command answers whether the selected tests passed.

JavaScript lint is intentionally exposed as `pnpm lint` / `make lint-js`, but
is not yet part of the canonical merge gate because the existing frontend lint
backlog is tracked separately in the code-quality tracker.

## V1 Release

The v1 release is governed by a deterministic evidence package, a full CI gate suite, and five
interlocking manifests that prove coherent app behavior, replay determinism, PRD/tracker alignment,
explicit limitations, and cross-surface evidence coverage. The complete operator procedure —
pre-flight checks, CI gate invocation, evidence regeneration, fixture replay, manifest
interpretation, and acceptance verdict — is documented in
[spec/release-runbook-v1.md](spec/release-runbook-v1.md).
