# Agent Prompt 4: Schedule Multi-Operator Filters And Safe Calculated Fields

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Extend schedule parity beyond the current `gt` filter rule by adding one safe multi-operator filter or constrained calculated-field slice that is replayable, exported, and minimally authorable in the web schedule UI. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-D01` Server-derived schedules
- `WP-D02` Schedule CSV/API/CLI export
- `WP-D03` Schedule UI
- `WP-D04` Family/type registry and propagation
- `WP-X01` JSON snapshot and command replay

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/schedule-multi-operator-calculated-fields
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/schedule_field_registry.py`
   - `app/bim_ai/schedule_csv.py`
   - `app/tests/test_schedule_row_filters.py`
   - `packages/web/src/schedules/SchedulePanel.tsx`
   - `packages/web/src/schedules/scheduleFilterWidthRules.ts`
   - existing schedule tests

## File Ownership Rules

Own schedule definition/filter/calculated-field behavior only. Avoid room legend placement, sheet raster, OpenBIM replay, geometry kernels, and validation bundles.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/schedule_field_registry.py`
- `app/bim_ai/schedule_csv.py`
- `app/bim_ai/commands.py` / `engine.py` only if replay schema changes are required
- `packages/web/src/schedules/SchedulePanel.tsx`
- schedule helper/test files
- focused backend schedule tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement arbitrary formulas or unsafe string evaluation.
- Do not redesign SchedulePanel.
- Do not touch room/IFC/sheet-raster/geometry files.
- Do not open a PR.

## Implementation Checklist

- Add one safe filter operator (`lt`, `contains`, `isBlank`) or one constrained calculated field using structured config.
- Persist and echo the definition through replay/schedule payloads.
- Ensure JSON and CSV exports remain deterministic.
- Add minimal web UI/readout for the new behavior.
- Add backend and web tests.
- Update tracker rows with exact operators/fields, tests, and remaining schedule blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_schedule* tests/test_kernel_schedule_exports.py tests/test_upsert_schedule_filters_grouping.py
cd packages/web && pnpm exec vitest run src/schedules
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-D01`, `WP-D02`, `WP-D03`, `WP-D04`, and `WP-X01`. Add a Recent Sprint Ledger entry describing the schedule operator/calculated-field slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(schedules): add multi operator calculated field slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, schedule behavior added, tracker rows updated, validation results, and shared-file merge risks.
