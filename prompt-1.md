# Agent Prompt 1: Saved View Definitions And Tag-Style Authoring

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Move beyond readout/matrix into a small editable saved-view/template definition workflow: tag style choices, per-view graphics presets, and replay evidence without changing sheet crop or schedule behavior. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-C01` First-class plan views
- `WP-C02` Plan projection engine
- `WP-C03` Plan symbology and graphics
- `WP-C05` Project browser hierarchy
- light `WP-E02` 3D clipping / cutaways

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/saved-view-tag-style-authoring
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `packages/web/src/workspace/ProjectBrowser.tsx`
   - `packages/web/src/Workspace.tsx`
   - `packages/web/src/plan/planProjection.ts`
   - `packages/web/src/workspace/PlanViewGraphicsMatrix.tsx`
   - backend `updateElementProperty` tests for plan/view_template fields
   - existing plan and workspace Vitest tests

## File Ownership Rules

Own saved-view/template authoring UI and deterministic readout only. Avoid broad `Workspace.tsx` rewrites; keep any edit localized to mounting an isolated component. Do not touch sheet crop, schedule behavior, IFC, evidence loops, or geometry kernels.

## Allowed Scope

Prefer changes in:

- `packages/web/src/workspace/ProjectBrowser.tsx`
- isolated child components under `packages/web/src/workspace/`
- `packages/web/src/plan/planProjection.ts`, only for deterministic UI readout helpers
- focused plan/workspace tests
- backend `updateElementProperty` tests only for existing fields
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not redesign the Workspace shell.
- Do not add broad backend schemas unless existing fields are insufficient and replay-tested.
- Do not change sheet crop/projection semantics.
- Do not touch schedules, IFC, or Agent Review.
- Do not open a PR.

## Implementation Checklist

- Add one narrow editable saved-view/template definition workflow for tag styles or graphics presets.
- Ensure edits persist through existing element property or command paths.
- Keep Project Browser evidence and Inspector readouts deterministic.
- Add tests for UI/readout behavior and any backend replay path used.
- Update tracker rows with exact fields, UI path, tests, and remaining template/tag-style blockers.

## Validation

Run focused checks:

```bash
cd packages/web && pnpm exec vitest run src/plan src/workspace
cd app && ruff check bim_ai tests && pytest tests/test_update_element_property_plan_view.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-C01`, `WP-C02`, `WP-C03`, `WP-C05`, and any narrow `WP-E02` evidence. Add a Recent Sprint Ledger entry describing the saved-view/template authoring slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(web): add saved view tag style authoring

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, authoring workflow added, tracker rows updated, validation results, and shared-file merge risks.
