# Agent Prompt 3: Room Legend Elements And Programme Workflow Slice

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Promote room programme data from schedule/readout into a small first-class workflow: room legend elements on sheets or a deterministic programme/department color-scheme authoring slice, with evidence that links rooms, schedules, and legends. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B06` Rooms and room separation
- `WP-C04` Room color schemes and legends
- `WP-D01` Server-derived schedules
- `WP-D03` Schedule UI
- light `WP-E05` Sheet canvas and titleblock

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/room-legend-programme-workflow
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/room_derivation.py`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `packages/web/src/plan/roomSchemeColor.ts`
   - `packages/web/src/schedules/SchedulePanel.tsx`
   - existing room, schedule, plan, and sheet tests

## File Ownership Rules

Own room programme/legend behavior only. Avoid broad room derivation algorithm rewrites, non-room validation bundles, OpenBIM replay, sheet raster service, and schedule engine refactors. Keep any sheet work limited to room legend placement/evidence.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/elements.py` and `commands.py` only if a room legend element/command is needed
- `app/bim_ai/engine.py`
- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/plan_projection_wire.py`
- `packages/web/src/plan/roomSchemeColor.ts`
- small isolated web component/test for room legend/programme readout
- focused tests under `app/tests/` and `packages/web/src/`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement arbitrary curved room boundaries.
- Do not redesign SchedulePanel globally.
- Do not touch IFC, print raster export, level constraints, or stair/roof geometry.
- Do not turn room derivation into a full computational geometry project.
- Do not open a PR.

## Implementation Checklist

- Add one replayable room legend/programme workflow: e.g. `room_legend` element, sheet placement, deterministic legend rows, or editable programme/department scheme mapping.
- Link legend output to existing room schedule/programme fields and deterministic color hashing.
- Add evidence that distinguishes real legend/programme output from preview-only room warnings.
- Preserve existing room target/area schedule behavior.
- Add tests for replay, deterministic legend rows/colors, and one sheet or UI readout if touched.
- Update tracker rows with exact fields/evidence and remaining room legend blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_room* tests/test_schedule* tests/test_plan_projection*
cd packages/web && pnpm exec vitest run src/plan src/schedules src/workspace
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B06`, `WP-C04`, `WP-D01`, `WP-D03`, and any narrow `WP-E05` evidence. Add a Recent Sprint Ledger entry describing the room legend/programme workflow.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(rooms): add room legend programme workflow

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, room legend/programme behavior added, tracker rows updated, validation results, and shared-file merge risks.
