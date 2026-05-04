# BIM AI (v1)

Browser-first BIM coordination: semantic walls/doors/rooms, realtime WebSocket snapshots, constraint checks, issues, AI propose flow.

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

See `spec/prd.md` for product scope.

## Makefile

| Target    | Meaning                              |
| --------- | ------------------------------------ |
| `install` | JS + Python venv + deps              |
| `dev`     | compose up + API + web               |
| `verify`  | Format, lint, arch, TC, tests, build |
| `seed`    | Populate demo model idempotently     |
