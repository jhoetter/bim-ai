# Agent Prompt 3: First-Class Room Legend Placement And Department Schemes

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Promote room legend evidence into a first-class authoring workflow: replayable room legend placement, department/programme scheme configuration, or sheet-linked legend rows that remain aligned with schedules and plan color legends. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B06` Rooms and room separation
- `WP-C04` Room color schemes and legends
- `WP-D01` Server-derived schedules
- `WP-D03` Schedule UI
- `WP-E05` Sheet canvas and titleblock
- light `WP-X01` JSON snapshot and command replay

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/room-legend-placement-department-schemes
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `app/bim_ai/sheet_preview_svg.py`
   - `packages/web/src/plan/planProjectionWire.ts`
   - `packages/web/src/plan/roomSchemeColor.ts`
   - existing room legend/schedule/sheet tests

## File Ownership Rules

Own room legend/scheme authoring only. Avoid room boundary algorithm rewrites, sheet raster service, schedule filter engine, OpenBIM replay, and geometry kernels.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/elements.py`, `commands.py`, `engine.py` for a narrow legend/scheme command if needed
- `app/bim_ai/plan_projection_wire.py`
- `app/bim_ai/sheet_preview_svg.py`, only for room legend sheet/export evidence
- `app/bim_ai/schedule_derivation.py`, only for room programme alignment
- focused room/schedule/sheet tests
- small web extract/readout helpers
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not solve curved/non-axis room derivation.
- Do not redesign SchedulePanel globally.
- Do not touch print raster internals, IFC, or hosted-opening geometry.
- Do not open a PR.

## Implementation Checklist

- Add one replayable room legend placement or department/programme scheme authoring path.
- Keep legend rows, schedule rows, and plan projection evidence deterministic.
- Preserve `roomProgrammeLegendEvidence_v0` digest semantics or version it deliberately.
- Add tests for replay, sheet/plan evidence, and schedule alignment.
- Update tracker rows with exact element/command/evidence keys and remaining blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_room* tests/test_plan_projection* tests/test_sheet* tests/test_schedule*
cd packages/web && pnpm exec vitest run src/plan src/schedules src/workspace
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B06`, `WP-C04`, `WP-D01`, `WP-D03`, `WP-E05`, and any narrow `WP-X01` evidence. Add a Recent Sprint Ledger entry describing the room legend placement/scheme slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(rooms): add room legend placement scheme slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, room legend behavior added, tracker rows updated, validation results, and shared-file merge risks.
