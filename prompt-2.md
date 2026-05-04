# Agent Prompt 2: Room Derivation, Separation Lines, And Programme UI

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Promote rooms from authored polygons plus schedules into a stronger production workflow: derived room regions, separation lines, programme metadata, legends, and advisor feedback. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B06` Rooms and room separation
- `WP-C04` Room color schemes and legends
- `WP-V01` Validation/advisor expansion
- Light `WP-D06` Cleanroom metadata and IDS, only for programme/cleanroom fields

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/room-derivation-programme
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/constraints.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `packages/web/src/plan/PlanCanvas.tsx`
   - `packages/web/src/plan/roomSchemeColor.ts`

## Allowed Scope

Prefer changes in:

- room and room-separation element/command schemas in `app/bim_ai/elements.py` and `app/bim_ai/commands.py`
- bounded derivation and preview logic in `app/bim_ai/schedule_derivation.py`, `app/bim_ai/plan_projection_wire.py`, or nearby room helpers
- validation and quick-fix rules in `app/bim_ai/constraints.py`
- web plan/legend rendering in `packages/web/src/plan/*`
- focused tests under `app/tests/test_room_*`, `app/tests/test_constraints_*`, `app/tests/test_plan_projection_and_evidence_slices.py`, and `packages/web/src/plan/*.test.ts`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change sheet viewport authoring.
- Do not change schedule grouping/filtering beyond room metadata needed for this slice.
- Do not change IFC/glTF exporters unless a tiny programme field read-back update is unavoidable.
- Do not attempt a general polygon solver without a bounded fixture.
- Do not open a PR.

## Implementation Checklist

- Add one narrow room production feature, such as room separation lines, derived unbounded-room warnings, authoritative wall-loop area recomputation for a fixture, or programme metadata editing.
- Ensure the room plan legend and schedule/advisor paths stay consistent with the new metadata.
- Add at least one backend test and one web unit or e2e assertion.
- Keep generated room colors deterministic.
- Document remaining blockers for full room derivation.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_room_derivation_preview.py tests/test_constraints_room_programme_consistency.py tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-B06`, `WP-C04`, `WP-V01`, and maybe `WP-D06`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Mention exact derivation limits and test fixtures.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(rooms): deepen derivation and programme slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, room workflow added, tracker rows updated, validation results, and any schedule/legend handoff notes.
