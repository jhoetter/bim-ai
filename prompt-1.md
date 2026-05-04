# Agent Prompt 1: View Template Editor, Properties Palette, And Scope Boxes

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Move plan views from hidden schema fields toward editable production view definitions: view-template editor affordances, active/selected view properties, crop/scope metadata, and inheritance evidence. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-C01` First-class plan views
- `WP-C02` Plan projection engine
- `WP-C03` Plan symbology and graphics
- `WP-C05` Project browser hierarchy

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/view-template-properties
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
   - `packages/web/src/Workspace.tsx`
   - `packages/web/src/workspace/ProjectBrowser.tsx`
   - `packages/web/src/plan/PlanCanvas.tsx`

## Allowed Scope

Prefer changes in:

- `PlanViewElem` / `ViewTemplateElem` fields in `app/bim_ai/elements.py`
- `UpdateElementPropertyCmd` and `upsertPlanView` handling in `app/bim_ai/engine.py`
- `app/bim_ai/plan_projection_wire.py`, only for crop/scope/template metadata already relevant to plan views
- shared types in `packages/core/src/index.ts`
- view selection/property controls in `packages/web/src/Workspace.tsx`, `packages/web/src/state/store.ts`, or `packages/web/src/workspace/ProjectBrowser.tsx`
- focused tests in `app/tests/test_update_element_property_plan_view.py`, `app/tests/test_plan_projection_and_evidence_slices.py`, and web plan/workspace tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change sheet viewport authoring or export.
- Do not change schedule derivation.
- Do not change room derivation algorithms.
- Do not change IFC/glTF exporters.
- Do not open a PR.

## Implementation Checklist

- Add one narrow UI-backed view definition slice, such as editable view-template toggles, active plan view properties, scope/crop metadata controls, or visible inheritance explanation.
- Keep behavior command-backed and replayable.
- Ensure server wire and web fallback behavior agree when a pinned plan view is active.
- Add at least one backend test and one web unit or e2e assertion.
- Keep full template editor / Revit-complete range semantics out of scope unless directly needed.

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

Update only rows you materially changed, likely `WP-C01`, `WP-C02`, `WP-C03`, and maybe `WP-C05`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Include exact fields, UI entry points, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(views): add editable view template properties slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, view/template behavior added, tracker rows updated, validation results, and any shared-file merge risks.
