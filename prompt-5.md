# Agent Prompt 5: BCF Issues, Agent Assumptions, And Evidence Loop Actions

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Build the collaboration/evidence loop around production review: BCF-like issue topics, links to viewpoints/elements/evidence rows, agent assumption/deviation records, and actionable Agent Review guidance. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-X04` BCF/issues and review loops
- `WP-F01` Agent review and evidence packs
- `WP-F02` Assumption/deviation tracking
- `WP-F03` Planner/executor feedback loop
- light `WP-A02` Semantic command model

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/bcf-assumptions-evidence-loop
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/evidence_manifest.py`
   - `app/bim_ai/agent_review.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/Workspace.tsx`
   - `packages/web/src/evidence/*`
   - existing agent review / evidence / collaboration tests

## Allowed Scope

Prefer changes in:

- semantic issue/topic/assumption/deviation elements or command payloads
- evidence manifest generation and Agent Review summaries
- web panels that already render review, evidence, or diagnostics
- tests for issue creation, evidence links, and action guidance
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not integrate an external BCF server.
- Do not implement auth, comments, or notification infrastructure.
- Do not change geometry, sheets, schedules, or IFC behavior except to link existing evidence rows.
- Do not open a PR.

## Implementation Checklist

- Add a small BCF-like issue/topic model with stable IDs and links to elements, viewpoints, or evidence artifacts.
- Add assumption/deviation records that can be created or summarized from command/evidence context.
- Surface at least one Agent Review action that points to a specific issue, assumption, deviation, or evidence row.
- Keep outputs deterministic and suitable for snapshots or manifest assertions.
- Add backend tests and, where practical, a web test for rendered review guidance.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_evidence* tests/test_agent* tests/test_engine*
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-X04`, `WP-F01`, `WP-F02`, `WP-F03`, and maybe `WP-A02`. Mention issue schema, links, Agent Review actions, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(review): add bcf issue and assumption evidence loop

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, issue/evidence loop behavior added, tracker rows updated, validation results, and any shared-file merge risks.
