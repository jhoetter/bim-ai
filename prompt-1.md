# Agent Prompt 1: Saved Views And Project Browser

## Mission

You are Agent 1 of 5 parallel BIM AI parity agents. Advance saved plan views, saved 3D viewpoints, view templates, and Project Browser hierarchy while staying isolated from sheet viewport authoring, schedules, evidence-digest work, and OpenBIM exporters.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-C01` First-class plan views
- `WP-C02` Plan projection engine, only where view settings need projection support
- `WP-C05` Project browser hierarchy
- Light `WP-E02` 3D clipping / cutaways, only for saved viewpoint reopen behavior

The product invariant is: browser, CLI, and API mutate one canonical command-driven semantic model. Views are editable definitions and projections of that model, not separate drawing state.

## Start Procedure

1. Start from a clean and current `main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/saved-views
   ```

2. Before editing, inspect:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/state/store.ts`
   - `packages/web/src/workspace/ProjectBrowser.tsx`
   - `packages/web/src/Workspace.tsx`

3. Keep a short local note of which tracker rows you intend to update.

## Allowed Scope

Prefer changes in these files:

- `app/bim_ai/elements.py`
- `app/bim_ai/commands.py`
- `app/bim_ai/engine.py`
- `app/tests/*plan*`, `app/tests/*view*`, and focused command/engine tests
- `packages/core/src/index.ts`
- `packages/web/src/state/store.ts`
- `packages/web/src/workspace/ProjectBrowser.tsx`
- `packages/web/src/Workspace.tsx`, only for view activation/opening paths
- `packages/web/src/plan/planProjection.ts` and `packages/web/src/plan/PlanCanvas.tsx`, only if projection must honor the new view settings
- `packages/web/e2e/golden-bundle-plan.spec.ts`, only for saved view/browser behavior

## Non-Goals And Hard Boundaries

Do not edit these areas unless a test proves a tiny compatibility change is unavoidable:

- `packages/web/src/workspace/sheetViewportAuthoring.tsx`
- `packages/web/src/workspace/SheetCanvas.tsx`
- `packages/web/src/schedules/SchedulePanel.tsx`
- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/evidence_manifest.py`
- `app/bim_ai/export_ifc.py`
- `app/bim_ai/export_gltf.py`
- `.github/workflows/ci.yml`
- Playwright screenshot baselines, unless your view/browser behavior intentionally changes a tested screenshot

If you must touch a shared file, keep the diff restricted to the saved-view/browser path and explain why in the commit message or final report.

## Implementation Goals

Deliver a narrow but real production-authoring slice:

1. Make plan view definitions more editable and replayable:
   - crop/range or visible-category metadata;
   - scale/detail/discipline/template metadata where already modeled or easy to add;
   - deterministic duplicate/edit/reopen behavior.
2. Improve Project Browser hierarchy:
   - group floor plans, 3D views, schedules, sheets, and section cuts in stable sections;
   - make saved plan views and saved viewpoints clearly reopenable;
   - avoid broad drag/drop or sheet placement behavior.
3. Keep state hydration compatible:
   - TypeScript element unions and store coercion must accept any new fields;
   - existing snapshots and seed fixtures must continue to load.
4. Add focused evidence:
   - backend unit tests for commands/engine where model fields change;
   - web tests or Playwright coverage for browser activation/duplicate/reopen when practical.

## Validation Commands

Run focused validation first:

```bash
cd app && ruff check bim_ai tests && pytest
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/golden-bundle-plan.spec.ts
```

Then, if time allows before committing:

```bash
pnpm verify
```

If a command cannot be run, document why and what risk remains.

## Tracker Update Rules

Update `spec/revit-production-parity-workpackage-tracker.md` before committing:

- Update only rows you materially affected: likely `WP-C01`, `WP-C02`, `WP-C05`, and possibly `WP-E02`.
- Add concrete evidence paths in the `Implemented / evidence` column.
- Update `Recent sprint delta` and `Remaining parity blockers`.
- Adjust `Maturity` and `Progress` conservatively.
- Do not mark a row `done` unless it satisfies the tracker Done Rule: command/schema, engine/API, snapshot/export where relevant, web hydration/rendering, schedule/validation awareness where relevant, CLI/test fixture coverage, and golden/e2e/unit evidence.

## Commit And Push

Commit only your focused branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(views): improve saved view authoring and browser hierarchy

EOF
)"
git push -u origin agent/saved-views
```

Do not push to `main`.

## Final Report

Return:

- Branch name and commit SHA.
- Summary of behavior added.
- Tracker rows updated and why they are still `partial` or now eligible for a higher maturity.
- Validation commands run and results.
- Any shared-file edits and merge risks for the other four agents.
