# Agent Prompt 4: Validation Advisor Breadth And Quick-Fix Bundles

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Broaden PRD section 11 validation with additional blocking classes and bundled quick-fix recommendations while staying advisor-focused, deterministic, and mergeable. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-V01` Validation/advisor expansion
- `WP-D03` Schedule UI
- `WP-E05` Sheet canvas and titleblock
- `WP-X01` JSON snapshot and command replay
- light `WP-B06` Rooms and room separation

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/validation-advisor-bundles
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/constraints.py`
   - `app/bim_ai/commands.py`
   - existing validation tests for schedules, sheets, rooms, IFC, and replay
   - web advisor grouping/filter tests if UI display changes

## File Ownership Rules

Own advisor logic and quick-fix bundle metadata. Coordinate with the room prompt by keeping room validation narrow and not changing room derivation internals. Avoid IFC replay, section graphics, geometry kernels, and performance diagnostics.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/constraints.py`
- existing command quick-fix payloads in `app/bim_ai/commands.py`, only if needed
- focused validation tests for sheet/schedule/viewport/reference consistency
- one room-related advisor class if it does not alter derivation
- optional web advisor grouping/filter tests only if existing UI behavior needs coverage
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement a full validation framework rewrite.
- Do not change room boundary derivation internals.
- Do not touch IFC command replay.
- Do not add broad UI panels.
- Do not open a PR.

## Implementation Checklist

- Add at least one new deterministic blocking/advisory class from PRD section 11.
- Add quick-fix bundle metadata where an existing command can safely fix the issue.
- Ensure issue IDs, ordering, severity, and quick-fix payloads are stable.
- Add tests for positive, negative, and deterministic ordering cases.
- Update tracker rows with exact advisor classes and remaining validation blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_constraints* tests/test_undo_replay_constraint.py
cd packages/web && pnpm exec vitest run src/advisor src/workspace
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-V01`, `WP-D03`, `WP-E05`, `WP-X01`, and any narrow `WP-B06` evidence. Add a Recent Sprint Ledger entry with exact advisor IDs and quick-fix bundle behavior.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(validation): add advisor quick-fix bundles

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, advisor classes added, quick-fix behavior, tracker rows updated, validation results, and shared-file merge risks.
