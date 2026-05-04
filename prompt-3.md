# Agent Prompt 3: Room Programme Authoring, Area Targets, And Finish Schedules

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Turn room data into a production authoring slice: programme/department/finish fields, area targets, schedule rows, and advisor feedback. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B06` Rooms, areas, and zones
- `WP-C04` Tags and annotations
- `WP-D01` Schedules and quantities
- `WP-D05` Material takeoff and finish data
- `WP-V01` Validation advisor

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/room-programme-finish-schedules
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/room_derivation.py`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/constraints.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/Workspace.tsx`
   - schedule and room tests

## Allowed Scope

Prefer changes in:

- `RoomElem` / area programme fields and command-backed updates
- schedule derivation for room finish and area target rows
- validation/advisor checks for missing programme/department/finish or target-area deviations
- frontend table/property surfaces that already show room/schedule/advisor data
- focused backend and web tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not rewrite room boundary derivation.
- Do not implement full Revit area plans.
- Do not change sheet viewport or export flows.
- Do not change IFC import/export except if a small manifest hint is already directly wired from room fields.
- Do not open a PR.

## Implementation Checklist

- Add first-class authoring or editing for room programme, department, target area, and at least one finish field.
- Reflect those fields in derived room schedules or finish schedules.
- Add validation/advisor feedback for one meaningful room data gap or target miss.
- Preserve existing room separation and plan-label behavior.
- Add tests proving command replay, schedule derivation, and advisor output.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_room* tests/test_schedule* tests/test_constraints*
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-B06`, `WP-C04`, `WP-D01`, `WP-D05`, and `WP-V01`. Mention exact room fields, schedule columns, advisor checks, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(rooms): add programme fields and finish schedule evidence

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, room fields added, schedule/advisor behavior, tracker rows updated, validation results, and any shared-file merge risks.
