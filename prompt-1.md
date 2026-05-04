# Agent Prompt 1: Room Boundary Authoritative Derivation And Programme Closure

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Move rooms beyond preview/proxy behavior by making one authoritative room derivation slice from bounded walls and room separation lines. Include unbounded-room diagnostics, programme/area schedule parity, and minimal evidence that the derived boundary can be inspected. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B06` Rooms and room separation
- `WP-C04` Room color schemes and legends
- `WP-D01` Server-derived schedules
- `WP-D03` Schedule UI
- light `WP-V01` Validation/advisor expansion

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/room-boundary-authoritative-derivation
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - room derivation helpers under `app/bim_ai/`
   - `app/bim_ai/plan_projection_wire.py`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/constraints.py`
   - existing room derivation, schedule, plan projection, and validation tests

## File Ownership Rules

Own room derivation and room-specific evidence only. Avoid broad `Workspace.tsx` edits and avoid changing non-room validation classes. Coordinate mentally with the validation prompt by keeping any `constraints.py` edits scoped to room boundary diagnostics.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/room_derivation.py` or existing room derivation helpers
- `app/bim_ai/plan_projection_wire.py`, only for room boundary evidence
- `app/bim_ai/schedule_derivation.py`, only for room programme/area deltas
- `app/bim_ai/constraints.py`, only for room-boundary diagnostics
- focused room derivation, schedule, and validation tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not redesign all room schedule columns.
- Do not introduce broad UI panels.
- Do not add non-room validation bundles.
- Do not touch IFC replay, section graphics, or performance diagnostics.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic authoritative room derivation path from bounded walls and/or room separation lines.
- Expose enough evidence to distinguish authoritative derived rooms from preview-only warnings.
- Add unbounded or ambiguous room diagnostics with deterministic IDs/messages.
- Preserve existing target area, finish, programme, and room schedule behavior.
- Add tests for one successful derivation case and one unbounded/ambiguous case.
- Update tracker rows with exact scope, tests, and remaining room parity blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_room* tests/test_plan_projection* tests/test_constraints_room_programme_consistency.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B06`, `WP-C04`, `WP-D01`, `WP-D03`, and any narrow `WP-V01` evidence. Add a Recent Sprint Ledger entry describing the authoritative derivation slice and remaining room derivation gaps.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(rooms): add authoritative boundary derivation slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, derivation behavior added, tracker rows updated, validation results, and shared-file merge risks.
