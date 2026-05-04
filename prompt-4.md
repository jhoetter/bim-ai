# Agent Prompt 4: Advanced Schedule Filters And Calculated Field Slice

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Deepen schedule definitions by adding one narrow advanced filter/calculated-field slice that works server-side, exports through JSON/CSV, and has a minimal UI authoring/readout path. Do not open a pull request. Commit and push only your branch.

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
   git switch -c agent/schedule-advanced-filters-calculated-fields
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/schedule_field_registry.py`
   - `app/bim_ai/schedule_csv.py`
   - `app/bim_ai/commands.py`
   - `packages/web/src/schedules/SchedulePanel.tsx`
   - existing schedule filter, export, and UI tests

## File Ownership Rules

Own schedule definition/filter/calculated-field behavior only. Avoid room derivation, sheet export, OpenBIM replay, level constraints, and geometry-kernel files. Coordinate mentally with room prompt by keeping room-specific schedule changes minimal and generic.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/schedule_field_registry.py`
- `app/bim_ai/schedule_csv.py`
- `app/bim_ai/commands.py` / `engine.py` only for replayable schedule definition fields
- `app/bim_ai/routes_api.py` only if export/query surface changes
- `packages/web/src/schedules/SchedulePanel.tsx`
- focused schedule tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not build a full formula language.
- Do not redesign SchedulePanel layout.
- Do not touch sheet viewport placement, room legend UI, IFC, or geometry.
- Do not add arbitrary eval or unsafe expression parsing.
- Do not open a PR.

## Implementation Checklist

- Add one constrained advanced filter operator (`gt`, `lt`, `contains`, `isBlank`, etc.) or one safe calculated field helper using structured config, not arbitrary code strings.
- Persist it through existing schedule command/replay paths.
- Ensure server-derived JSON and CSV exports produce deterministic rows/totals.
- Add a minimal UI control/readout for the new filter/calculated-field behavior.
- Add tests for replay, derivation, CSV/JSON export, and UI state if touched.
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

Update `WP-D01`, `WP-D02`, `WP-D03`, `WP-D04`, and `WP-X01`. Add a Recent Sprint Ledger entry describing the schedule filter/calculated-field slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(schedules): add advanced filter calculated field slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, schedule behavior added, tracker rows updated, validation results, and shared-file merge risks.
