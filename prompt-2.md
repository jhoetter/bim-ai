# Agent Prompt 2: Schedule UI Filter/Group Export Parity

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Deepen schedule definitions where the server already has sorting/grouping and QTO fields, but UI/export parity remains shallow: persisted filter/group controls, visible totals/readouts, and CSV/JSON coverage for more schedule categories. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-D01` Server-derived schedules
- `WP-D02` Schedule CSV/API/CLI export
- `WP-D03` Schedule UI
- `WP-X01` JSON snapshot and command replay
- light `WP-D05` Materials/layer catalogs

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/schedule-filter-group-export-parity
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `packages/web/src/schedules/SchedulePanel.tsx`
   - schedule UI tests under `packages/web/src/schedules/`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/schedule_csv.py`
   - `app/bim_ai/schedule_field_registry.py`
   - existing schedule export and schedule derivation tests

## File Ownership Rules

Own schedule UI/export depth only. Avoid room derivation internals, IFC, geometry kernels, and Agent Review. If `schedule_derivation.py` is touched, keep it to stable fields/totals required by the UI/export slice.

## Allowed Scope

Prefer changes in:

- `packages/web/src/schedules/SchedulePanel.tsx`
- schedule UI tests
- `app/bim_ai/schedule_derivation.py`, only for missing stable fields/totals
- `app/bim_ai/schedule_csv.py`
- `app/bim_ai/schedule_field_registry.py`
- focused API/CLI/export tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not alter room boundary derivation.
- Do not change IFC or glTF behavior.
- Do not add a general query language.
- Do not redesign the full schedule panel.
- Do not open a PR.

## Implementation Checklist

- Add one production-grade filter/group/export improvement that persists or replays deterministically.
- Surface totals/readouts for the chosen schedule categories in the UI or export payload.
- Expand CSV/JSON tests for the selected schedule categories.
- Preserve existing numeric sort and grouping behavior.
- Update tracker rows with exact UI/export behavior and remaining schedule blockers.

## Validation

Run focused checks:

```bash
cd packages/web && pnpm exec vitest run src/schedules
cd app && ruff check bim_ai tests && pytest tests/test_schedule* tests/test_kernel_schedule_exports.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-D01`, `WP-D02`, `WP-D03`, `WP-X01`, and any narrow `WP-D05` evidence. Add a Recent Sprint Ledger entry describing the filter/group/export parity slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(schedules): add filter group export parity

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, schedule UI/export behavior added, tracker rows updated, validation results, and shared-file merge risks.
