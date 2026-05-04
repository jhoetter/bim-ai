# Agent Prompt 3: Schedule Definition Depth And Type Propagation

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Deepen schedules from useful tables into more Revit-like definitions: persisted fields, sort/group/filter behavior, type/material propagation, and stable JSON/CSV/API/CLI evidence. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-D01` Server-derived schedules
- `WP-D02` Schedule CSV/API/CLI export
- `WP-D03` Schedule UI
- `WP-D04` Family/type registry and propagation
- `WP-D05` Materials/layer catalogs
- Light `WP-X01` JSON snapshot and command replay, only for schedule definition replay

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/schedule-definition-depth
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/schedule_csv.py`
   - `app/bim_ai/type_material_registry.py`
   - `app/bim_ai/routes_api.py`
   - `packages/web/src/schedule/SchedulePanel.tsx`

## Allowed Scope

Prefer changes in:

- schedule definition schema and commands in `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, and `app/bim_ai/engine.py`
- derivation/export/API paths in `app/bim_ai/schedule_derivation.py`, `app/bim_ai/schedule_csv.py`, and `app/bim_ai/routes_api.py`
- type/material helpers in `app/bim_ai/type_material_registry.py`
- web schedule controls in `packages/web/src/schedule/SchedulePanel.tsx`
- focused tests under `app/tests/test_schedule_*`, `app/tests/test_kernel_schedule_exports.py`, and schedule web tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change room derivation or room programme validation beyond consuming existing fields.
- Do not change sheet viewport authoring.
- Do not alter IFC/glTF exporters.
- Do not update Playwright screenshot baselines unless schedule UI changes are intentionally visible.
- Do not open a PR.

## Implementation Checklist

- Add one narrow schedule-definition improvement, such as stable sort keys, multiple equality filters, grouped subtotals, persisted field sets, type-parameter propagation, or material display propagation.
- Ensure JSON, CSV, CLI, and web surfaces stay coherent for the chosen slice.
- Add backend tests for schedule derivation/export and a web unit/e2e assertion if UI changes.
- Preserve existing schedule fixtures unless intentionally updated and documented.
- Keep schedule rows deterministic.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_schedule_row_filters.py tests/test_kernel_schedule_exports.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-D01` through `WP-D05` and maybe `WP-X01`. Keep `State` as `partial` unless the Done Rule is fully satisfied. List exact schedule categories and export surfaces proven.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(schedules): deepen definition replay slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, schedule behavior added, tracker rows updated, validation results, and any UI/baseline risks.
