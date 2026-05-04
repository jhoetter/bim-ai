# Agent Prompt 5: Performance, Collaboration, And Regeneration Diagnostics

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Raise confidence that larger models and command-driven collaboration stay predictable: regeneration/stale diagnostics, larger deterministic fixtures, command ordering, scoped undo/conflict evidence, and non-flaky browser timing smoke. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-P01` Browser performance budget
- `WP-P02` Collaboration model
- `WP-X01` JSON snapshot and command replay
- Light `WP-A04` CI verification gates, only if adding bounded non-flaky checks

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/perf-collab-regeneration
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/model_summary.py`
   - `app/bim_ai/routes_api.py`
   - `app/tests/test_derived_performance_budget.py`
   - `app/tests/test_undo_replay_constraint.py`
   - `packages/web/src/Workspace.tsx`
   - `packages/web/src/state/store.ts`
   - `packages/web/e2e/cockpit-smoke.spec.ts`

## Allowed Scope

Prefer changes in:

- command replay and diagnostic metadata in `app/bim_ai/engine.py`
- model rollups in `app/bim_ai/model_summary.py`
- API status/error shaping in `app/bim_ai/routes_api.py`
- focused performance fixtures/tests in `app/tests/test_derived_performance_budget.py`
- undo/conflict tests in `app/tests/test_undo_replay_constraint.py`
- browser status/timing assertions in `packages/web/e2e/cockpit-smoke.spec.ts`
- `packages/web/src/Workspace.tsx` and `packages/web/src/state/store.ts`, only for existing status/undo/collaboration paths
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement full multiplayer persistence.
- Do not redesign plan, sheet, schedule, room, geometry, or OpenBIM feature semantics.
- Do not update visual baselines for performance checks.
- Do not add flaky timing thresholds without local and CI-safe margins.
- Do not open a PR.

## Implementation Checklist

- Add one narrow confidence feature, such as stale regeneration diagnostics, larger replay fixture budgets, command ordering metadata, scoped undo conflict evidence, or a deterministic browser timing/status smoke.
- Prefer measurable budget tests with explicit fixture sizes and conservative thresholds.
- Keep web checks non-visual where possible.
- Add focused backend tests and web/e2e tests only when stable.
- Document remaining collaboration and regeneration blockers in the tracker.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_derived_performance_budget.py tests/test_undo_replay_constraint.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/cockpit-smoke.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-P01`, `WP-P02`, `WP-X01`, and maybe `WP-A04`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Include fixture sizes, thresholds, diagnostics, and flake risks.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
test(perf): add regeneration collaboration diagnostics

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, diagnostics or budget coverage added, tracker rows updated, validation results, and any flake/collaboration risks.
