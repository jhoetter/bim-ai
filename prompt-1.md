# Agent Prompt 1: Sheet Viewport Authoring And Titleblock Placement

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Close the next sheet-authoring gap: users and agents need replayable placement of plan, section, and schedule viewports on sheets, with deterministic titleblock evidence. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export
- `WP-X01` JSON snapshot and command replay
- Light `WP-A03` Playwright evidence baselines, only if stable sheet evidence changes

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/sheet-viewport-authoring
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/workspace/SheetCanvas.tsx`
   - `packages/web/src/workspace/sectionViewportSvg.tsx`
   - `packages/web/e2e/golden-bundle-plan.spec.ts`
   - `packages/web/e2e/evidence-baselines.spec.ts`

## Allowed Scope

Prefer changes in:

- sheet and viewport element/command shapes in `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, and `app/bim_ai/engine.py`
- TypeScript schema/hydration in `packages/core/src/index.ts`
- sheet placement UI/state in `packages/web/src/workspace/SheetCanvas.tsx`
- focused tests under `app/tests/test_*sheet*`, `app/tests/test_golden_exchange_fixture.py`, and `packages/web/src/workspace/*.test.ts`
- Playwright sheet assertions only when the visual behavior is stable
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not redesign plan or section projection primitives.
- Do not change schedule derivation semantics.
- Do not build a full print service or PDF renderer unless a tiny evidence wiring fix is required.
- Do not change Agent Review evidence-package semantics.
- Do not open a PR.

## Implementation Checklist

- Add a narrow authoring path for sheet viewport placement, such as drag/drop, form-based placement, or a replayable command that positions an existing view reference on a sheet.
- Preserve deterministic viewport ids and `viewpoint:` / plan / section / schedule refs.
- Ensure snapshots or command replay preserve `viewportsMm` and titleblock metadata.
- Add at least one backend replay test and one web unit or Playwright assertion.
- Keep visual baseline churn minimal and intentional.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_golden_exchange_fixture.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/golden-bundle-plan.spec.ts e2e/evidence-baselines.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-E05`, `WP-E06`, `WP-X01`, and maybe `WP-A03`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Include exact tests and evidence paths.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sheets): add replayable viewport placement slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, viewport authoring behavior added, tracker rows updated, validation results, and any shared-file merge risks.
