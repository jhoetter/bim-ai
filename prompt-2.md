# Agent Prompt 2: Production Section Graphics And Annotation

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Move section/elevation output closer to production documentation: richer cut graphics, material hints, datum/level markers, lightweight tags/dimensions, and scale-aware section SVG behavior. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E04` Section/elevation views
- `WP-C03` Plan symbology and graphics, only shared graphics constants
- `WP-E05` Sheet canvas and titleblock, only section viewport rendering
- `WP-E06` SVG/PNG/PDF export, only if section SVG evidence changes

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/section-documentation
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `packages/web/src/plan/sectionProjectionWire.ts`
   - `packages/web/src/workspace/sectionViewportSvg.tsx`
   - `packages/web/src/workspace/SheetCanvas.tsx`
   - `packages/web/e2e/golden-bundle-plan.spec.ts`
   - `packages/web/e2e/evidence-baselines.spec.ts`

## Allowed Scope

Prefer changes in:

- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/plan_projection_wire.py`, section projection path only
- `packages/web/src/workspace/sectionViewportSvg.tsx`
- `packages/web/src/workspace/SheetCanvas.tsx`, only to pass section viewport props
- `packages/web/src/plan/sectionProjectionWire.ts`
- focused tests in `app/tests/test_plan_projection_and_evidence_slices.py`
- focused web tests under `packages/web/src/workspace/*section*` if needed
- Playwright section/sheet assertions and baselines only when visual changes are intentional
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change sheet viewport command replay.
- Do not change schedule engine, CSV, or schedule UI.
- Do not change room programme validation.
- Do not change IFC/glTF exporters or cut-solid kernel.
- Do not change Agent Review/evidence package semantics.
- Do not open a PR.

## Implementation Checklist

- Improve section primitives or SVG rendering for at least one production feature: cut hatches, level/datum labels, material bands, opening tags, simple dimensions, crop/depth warning, or scale-aware stroke/text.
- Keep `sectionProjectionPrimitives_v1` backwards compatible unless tests and consumers are updated together.
- Ensure sheet viewport rendering still works for section refs.
- Add focused backend and/or Playwright evidence for the section output.
- Avoid broad layout churn in screenshots.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/golden-bundle-plan.spec.ts e2e/evidence-baselines.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-E04`, `WP-C03`, `WP-E05`, and maybe `WP-E06`. Keep `State` as `partial` unless the Done Rule is fully satisfied. If screenshots change, mention exact baseline/evidence paths.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sections): improve production section graphics

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, visual behavior added, tracker rows updated, validation results, and screenshot baseline notes.
