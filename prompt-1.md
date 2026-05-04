# Agent Prompt 1: View Template Tag Style Catalog And Graphic Overrides

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Deepen saved view/template parity by adding one compact tag-style or graphic-override catalog slice that is editable, replayable, and visible in deterministic plan/browser readouts. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-C01` First-class plan views
- `WP-C02` Plan projection engine
- `WP-C03` Plan symbology and graphics
- `WP-C05` Project browser hierarchy
- light `WP-X01` JSON snapshot and command replay

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/view-template-tag-style-catalog
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/engine.py`
   - `app/tests/test_update_element_property_plan_view.py`
   - `packages/web/src/plan/planProjection.ts`
   - `packages/web/src/workspace/savedViewTagGraphicsAuthoring.tsx`
   - `packages/web/src/workspace/ProjectBrowser.tsx`
   - existing plan/workspace Vitest tests

## File Ownership Rules

Own saved view/template tag-style or graphic-override catalog behavior only. Avoid sheet export, schedule engine, room derivation, OpenBIM, geometry kernels, and broad `Workspace.tsx` rewrites.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/elements.py`, `commands.py`, `engine.py` only for replayable view/template fields
- `app/tests/test_update_element_property_plan_view.py`
- `packages/web/src/plan/planProjection.ts`
- `packages/web/src/workspace/savedViewTagGraphicsAuthoring.tsx`
- `packages/web/src/workspace/PlanViewGraphicsMatrix.tsx`
- `packages/web/src/workspace/ProjectBrowser.tsx`
- focused plan/workspace tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not build the full Revit visibility/graphics dialog.
- Do not change crop/range semantics.
- Do not touch schedule, sheet raster, IFC, room, or geometry code.
- Do not open a PR.

## Implementation Checklist

- Add one replayable catalog/config surface for tag style or plan graphic overrides.
- Make plan views inherit/override the catalog deterministically from view templates.
- Add browser/inspector/readout evidence that shows stored vs effective values.
- Add tests for replay and web readout behavior.
- Update tracker rows with exact fields, tests, and remaining template/tag blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_update_element_property_plan_view.py
cd packages/web && pnpm exec vitest run src/plan src/workspace
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-C01`, `WP-C02`, `WP-C03`, `WP-C05`, and any narrow `WP-X01` evidence. Add a Recent Sprint Ledger entry describing the template/tag-style catalog slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(web): add view template tag style catalog

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, catalog behavior added, tracker rows updated, validation results, and shared-file merge risks.
