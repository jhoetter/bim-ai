# bim-ai — AGENTS.md

Canonical instructions for **any** AI coding agent working in this repo —
Claude Code, Codex / GPT-5, or similar. (`CLAUDE.md` is a thin pointer to this
file so every harness reads the same content.)

## Scope: this is the modeling software, period

bim-ai is the engine — MCP surface, geometry kernel, viewer, IFC, constraint
checks, the Postgres `bim_models` store. **Reverse-BIM ingestion, reader
subagents, IR construction, bundle building from semantic intent, grading
loops, testhouse driver scripts — none of that lives here anymore.** It all
moved to [`bim-agent`](https://github.com/jhoetter/bim-agent) in the 2026-05-25
clean-separation work (see
`bim-agent/spec/trackers/bim-ai-bim-agent-clean-separation-tracker.md`).

If a task involves reading a house's PDFs, computing source facts, choosing
which CMD-V3 commands to emit, or scoring a rendered model against source
elevations — you're in the wrong repo. Switch your session to bim-agent.

## NON-NEGOTIABLE: open the screenshots before you grade

After every iter / build that produces ortho captures, you MUST open the actual
PNGs and look at them (use your harness's native image-read capability — the
Read tool in Claude Code, an image input in an OpenAI/GPT-5 harness), not just
the structured element counts. Pattern-matching "looks like a house" from the
silhouette has repeatedly missed real defects (duplicate stacked roofs, dormers
in wrong location, sub-grade walls, materials swapped per level, etc.).

Minimum eye-pass per house:
- North + south + east + west cardinal shaded captures (4 PNGs).
- At least one wireframe (`-wireframe.png`) for a view where the shaded version
  looks "off" — wireframe exposes interior geometry the shaded view hides.
- For multi-level houses: confirm exactly ONE main roof. Element-count `roofs=2`
  is always a bug.

If a defect is visible in the screenshot but not in the element counts, file it
as a `from: bim-agent` GH issue and embed the screenshot via a
`raw.githubusercontent.com/jhoetter/bim-ai/main/evidence/...` URL.

## Reading drawings: vision-LLM, never legacy OCR/CV

Any capability that reads or interprets a drawing must be **vision-LLM based**
(a vision-capable model such as Claude or GPT-5/GPT-4V-class), never legacy
OCR/CV (Tesseract, pytesseract, thresholding-as-the-reader). Classic CV is
acceptable only as preprocessing or a positional prior / cross-check — never as
the authoritative reader. The agent *is* the vision-LLM; MCP tools gather and
prepare context and write back structured results, they do not call an external
LLM API with their own key by default. The full rationale (and the
context-gatherer vs reader/judge split) lives in `bim-agent/AGENTS.md`, which
governs the agent side.

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

## Formatting

Prettier runs automatically after every Edit/Write via the Claude Code
PostToolUse hook — no manual `pnpm format` needed in that harness. In any other
harness, run `pnpm format` before committing. The git pre-commit hook also
re-formats staged files as a safety net; CI fails on `pnpm format:check`, so both
layers must stay in place.

## Skills (claude-skills/)

Project-level skills live at `claude-skills/<name>/SKILL.md`. Read the skill's
frontmatter `description:` field to decide whether it applies. In Claude Code
they are invoked via the Skill tool; in any other harness, read the SKILL.md and
follow it directly.

**Currently shipped:**

- **`claude-skills/watch-yt/SKILL.md`** — load this skill whenever the user
  shares a YouTube URL and asks you to watch, summarise, or reason about the
  video content. Run `python3 claude-skills/watch-yt/watch_yt.py "<URL>"` from
  the repo root; Gemini watches the full video and returns a granular
  timestamped log you can reason over.

The previous `sketch-to-bim` and `hybrid-reverse-bim` skills were
methodology-heavy (architect's workflow, multi-pass reverse-BIM ingestion) and
moved to bim-agent in the 2026-05-25 clean-separation work.
