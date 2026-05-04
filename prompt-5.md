# Agent Prompt 5: Scale And Collaboration Confidence

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Raise confidence that the documentation spine survives larger models and basic collaboration semantics: performance budgets, larger fixtures, UI timing smoke, scoped undo/conflict notes, and collaboration-adjacent validation. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-P01` Browser performance budget
- `WP-P02` Collaboration model
- Related `WP-A04` CI verification gates, only if adding focused performance/collaboration smoke checks
- Related `WP-X01`, only if command replay scale fixtures are needed

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/scale-collaboration
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/tests/test_derived_performance_budget.py`
   - `app/bim_ai/routes_api.py`
   - `app/bim_ai/model_summary.py`
   - `app/bim_ai/engine.py`
   - `packages/web/e2e/cockpit-smoke.spec.ts`
   - `packages/web/e2e/evidence-baselines.spec.ts`
   - `packages/web/src/state/store.ts`
   - `packages/web/src/Workspace.tsx`

## Allowed Scope

Prefer changes in:

- `app/tests/test_derived_performance_budget.py`
- new focused backend scale fixtures/tests under `app/tests/`
- `app/bim_ai/model_summary.py`
- `app/bim_ai/routes_api.py`, only if exposing measured metadata or fixture summaries
- `app/bim_ai/engine.py`, only if command replay/undo semantics need narrow fixes
- `packages/web/e2e/cockpit-smoke.spec.ts`
- `packages/web/e2e/evidence-baselines.spec.ts`, only if adding non-visual timing/visibility checks
- `packages/web/src/state/store.ts`, only collaboration/undo/presence paths
- `packages/web/src/Workspace.tsx`, only to surface existing scale/collab state
- `.github/workflows/ci.yml`, only for a bounded non-flaky smoke check
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement full multiplayer backend persistence.
- Do not change feature authoring semantics for views, schedules, rooms, sheets, geometry, or OpenBIM.
- Do not update visual baselines unless you intentionally add a stable e2e surface.
- Do not change evidence package contract.
- Do not open a PR.

## Implementation Checklist

- Add one or two larger fixtures or synthetic documents that exercise projection, schedules, evidence, or command replay under load.
- Add measured budget tests or smoke assertions with stable thresholds.
- Improve scoped undo/conflict notes only where existing model/store semantics already exist.
- If adding browser checks, prefer deterministic timing/visibility assertions over screenshot baselines.
- Keep changes narrow and clearly performance/collaboration oriented.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_derived_performance_budget.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/cockpit-smoke.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-P01`, `WP-P02`, maybe `WP-A04` or `WP-X01`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Include concrete thresholds, fixture sizes, and test names.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
test(scale): add documentation spine confidence checks

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, fixture/budget coverage, tracker rows updated, validation results, and any flake/performance risks.
