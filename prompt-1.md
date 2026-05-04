# Agent Prompt 1: View Templates, Tags, And Graphic Overrides

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Deepen production plan views after the previous saved-view/browser slice: view templates, category graphics, basic tags, and deterministic plan-view replay. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-C01` First-class plan views
- `WP-C02` Plan projection engine
- `WP-C03` Plan symbology and graphics
- `WP-C05` Project browser hierarchy, only where template grouping is needed
- Light `WP-E02` 3D clipping / cutaways, only if saved view template metadata must stay compatible

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/view-templates-graphics
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/state/store.ts`
   - `packages/web/src/plan/PlanCanvas.tsx`
   - `packages/web/src/plan/symbology.ts`
   - `packages/web/src/workspace/ProjectBrowser.tsx`

## Allowed Scope

Prefer changes in:

- `PlanViewElem` / view-template shapes in `app/bim_ai/elements.py`
- `UpdateElementPropertyCmd` handling in `app/bim_ai/engine.py`
- `app/bim_ai/plan_projection_wire.py`, only for view/template-driven primitive metadata
- `packages/core/src/index.ts`
- `packages/web/src/state/store.ts`
- `packages/web/src/plan/PlanCanvas.tsx`
- `packages/web/src/plan/symbology.ts`
- `packages/web/src/workspace/ProjectBrowser.tsx`, only for template/view grouping
- focused tests under `app/tests/test_*plan*`, `app/tests/test_update_element_property_plan_view.py`, and `packages/web/src/plan/*.test.ts`
- `packages/web/e2e/golden-bundle-plan.spec.ts`, only if browser/view behavior needs e2e proof
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not work on sheet viewport placement or `SheetCanvas`.
- Do not change schedule filtering/grouping/CSV semantics.
- Do not change room programme validation.
- Do not change IFC/glTF exporters.
- Do not change evidence package digests or CI artifact flow.
- Do not open a PR.

## Implementation Checklist

- Add a narrow view-template or per-view graphics override slice: category visibility, line/fill hints, detail level, tag visibility, or a similar production-view setting.
- Ensure the server projection emits enough metadata for the web renderer to honor the setting.
- Ensure TypeScript hydration accepts the new fields.
- Add at least one focused backend test and one web unit or e2e assertion.
- Keep all new behavior replayable through commands or persisted semantic elements.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_update_element_property_plan_view.py tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-C01`, `WP-C02`, `WP-C03`, and maybe `WP-C05`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Add evidence paths and keep remaining blockers strict.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(views): add view template graphics slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, tracker rows updated, validation results, and any shared-file merge risks.
