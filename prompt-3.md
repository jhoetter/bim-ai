# Agent Prompt 3: Saved View Template Editor And Plan Graphics Matrix

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Return to the deferred plan/view lane now that sheet crop projection has landed. Add a narrow production-grade editor or matrix for saved view/template graphics, tag/style overrides, and Project Browser evidence. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-C01` Plan/section/elevation view generation and view templates
- `WP-C02` Annotation/tagging/dimensions
- `WP-C03` Sheets/titleblocks/viewport management
- `WP-C05` Project Browser/view organization
- light `WP-E02` Core interaction model

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/saved-view-template-editor
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `packages/web/src/Workspace.tsx`
   - `packages/web/src/workspace/ProjectBrowser.tsx`
   - `packages/web/src/plan/planProjection.ts`
   - `packages/web/src/plan/planProjection.test.ts`
   - `packages/web/src/symbology.ts`
   - relevant Playwright evidence specs

## File Ownership Rules

Keep `Workspace.tsx` changes tightly scoped and prefer isolated child components or helper modules. Avoid changing sheet crop semantics, schedule derivation, IFC behavior, or raster artifact contracts.

## Allowed Scope

Prefer changes in:

- `packages/web/src/workspace/ProjectBrowser.tsx`
- a new isolated component under `packages/web/src/workspace/`, if useful
- `packages/web/src/plan/planProjection.ts`
- focused plan/project browser tests
- backend `updateElementProperty` tests only if existing fields need replay coverage
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change the crop-to-projection behavior from the prior sheet crop work.
- Do not add new backend schemas unless absolutely required by an existing gap.
- Do not redesign the Workspace shell.
- Do not touch IFC or schedule pipelines.
- Do not open a PR.

## Implementation Checklist

- Add a saved view/template editor or compact matrix for plan graphics settings that already exist in the model.
- Surface tag/style override state clearly enough for production-style review.
- Add Project Browser evidence for saved views/templates and view organization.
- Ensure changes can be replayed through existing element property update flows when applicable.
- Add focused tests for inheritance/readout/editor behavior and Project Browser display.
- Update tracker rows with implemented UI evidence, tests, and remaining annotation/template blockers.

## Validation

Run focused checks:

```bash
pnpm exec vitest run src/plan src/workspace
pnpm exec tsc -p packages/web/tsconfig.json --noEmit
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-C01`, `WP-C02`, `WP-C03`, `WP-C05`, and any affected `WP-E02` status. Add a Recent Sprint Ledger entry if your implementation materially closes a tracked plan/view documentation gap.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(web): add saved view template graphics editor

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, UI/editor behavior added, tracker rows updated, validation results, and shared-file merge risks.
