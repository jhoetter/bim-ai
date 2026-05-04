# Agent Prompt 1: Plan Tags, View Templates, And Annotation Rules

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Deepen production plan documentation: door/window/room tag primitives, view-template inheritance, annotation visibility, and deterministic plan replay. Do not open a pull request. Commit and push only the branch you work on.

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
   git switch -c agent/plan-tags-templates
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/plan/PlanCanvas.tsx`
   - `packages/web/src/plan/planProjection.ts`
   - `packages/web/src/plan/symbology.ts`
   - `packages/web/src/workspace/ProjectBrowser.tsx`

## Allowed Scope

Prefer changes in:

- `PlanViewElem`, `ViewTemplateElem`, or narrow tag/annotation element schemas
- `UpdateElementPropertyCmd` handling for plan/template/tag visibility settings
- `app/bim_ai/plan_projection_wire.py` for annotation/tag primitive metadata
- `packages/core/src/index.ts` for hydration types
- `packages/web/src/plan/*` for tag rendering and visibility
- `packages/web/src/workspace/ProjectBrowser.tsx`, only for template/view grouping
- focused tests under `app/tests/test_*plan*`, `app/tests/test_update_element_property_plan_view.py`, and `packages/web/src/plan/*.test.ts`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change sheet viewport placement or export.
- Do not change schedule derivation semantics.
- Do not change room derivation algorithms.
- Do not change IFC/glTF exporters.
- Do not open a PR.

## Implementation Checklist

- Add one narrow production plan annotation slice, such as D/W tag primitives, room label fields, annotation category visibility, template inheritance for tags, or view-specific annotation style.
- Keep new behavior persisted through commands or semantic elements.
- Ensure server wire output and web rendering agree.
- Add at least one backend test and one web unit or e2e assertion.
- Keep screenshot baseline churn minimal.

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

Update only rows you materially changed, likely `WP-C01`, `WP-C02`, `WP-C03`, and maybe `WP-C05`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Include exact evidence paths and remaining annotation blockers.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(plan): add annotation tag visibility slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, annotation behavior added, tracker rows updated, validation results, and any plan wire merge risks.
