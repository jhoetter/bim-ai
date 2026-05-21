# Agent Instructions

## CI-parity checks

Before pushing code, run the checks that match the files you changed. Prefer the
exact CI commands below over approximate local substitutes.

### Tool versions

- JavaScript CI uses Node 20 with `pnpm@9.15.4`.
- Python CI uses Python 3.12 and `uv`; the backend lockfile must stay current.
- Do not upgrade pnpm implicitly. Newer pnpm releases may require newer Node
  versions than the JavaScript CI lane uses.

### Python changes

Run from the repo root unless a command says otherwise:

```sh
cd app && uv lock --check
cd app && uv sync --frozen --extra dev --extra ifc
cd app && PYTHONPATH=. uv run python -c "from bim_ai.main import app"
cd app && uv run ruff check bim_ai tests
cd app && uv run pytest
make verify-refinement-reliability
```

For changes touching database-backed real-path behavior, also run:

```sh
make db-up
BIM_AI_RUN_DB_REAL_PATH=1 DATABASE_URL=postgresql+asyncpg://bimai:bimai@127.0.0.1:5545/bimai make test-py-real-path
```

### JavaScript, TypeScript, UI, and package changes

Run:

```sh
pnpm install
pnpm verify:strict
cd packages/web && pnpm exec playwright install chromium --with-deps
cd packages/web && CI=true pnpm run test:e2e:ci
```

### Governance and dependency-sensitive changes

For scripts, specs, quality gates, package manifests, lockfiles, or security
policy changes, run the governance lane locally:

```sh
node scripts/governance-drift-gates.mjs
pnpm --silent quality:report -- --out-json spec/generated/code-quality-report.json --out-md spec/generated/code-quality-report.md --fail-below B-
pnpm --silent security:hygiene -- --json
pnpm --silent ui:quality-budgets -- --json --skip-dist
pnpm audit --audit-level=high
cd app && uv export --frozen --all-extras --no-hashes --no-emit-project --format requirements-txt > /tmp/bim-ai-requirements.txt
uvx pip-audit -r /tmp/bim-ai-requirements.txt --strict
```

### Small, targeted fixes

For narrow fixes, run the smallest relevant slice first, then run the broader
lane before pushing if the change can affect shared behavior. Examples:

- Python import, lint, or typing-only fix: `cd app && uv run ruff check bim_ai tests`
- Backend behavior fix: `cd app && uv run ruff check bim_ai tests && uv run pytest`
- Frontend-only fix: `pnpm verify:strict`
- Workflow/setup fix: inspect `.github/workflows/ci.yml` and run the matching
  local commands with the pinned versions above.

If a local gate cannot be run because a service or tool is unavailable, mention
that explicitly in the final handoff and include the narrower checks that did
run.
