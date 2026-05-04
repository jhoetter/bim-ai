# Agent Prompt 1: Datum Chain And Level Constraint Parity Slice

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Move datum/level behavior beyond editable elevations by adding one deterministic datum-chain or level-dependency slice: dependent offsets, level-hosted element impact evidence, and validation/advisor feedback when a datum edit would create inconsistent host relationships. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B01` Level/datum model
- `WP-V01` Validation/advisor expansion
- `WP-X01` JSON snapshot and command replay
- light `WP-P01` Browser performance budget

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/datum-chain-level-constraints
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/constraints.py`
   - existing level, update-property, validation, and replay tests

## File Ownership Rules

Own level/datum data, command replay, and validation only. Avoid schedule, sheet export, OpenBIM, room derivation, and geometry-kernel edits. If a UI readout is needed, keep it tiny and isolated to existing level/property inspection paths.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/elements.py`
- `app/bim_ai/commands.py`
- `app/bim_ai/engine.py`
- `app/bim_ai/constraints.py`
- focused tests under `app/tests/`
- optional small web state/type hydration only if backend schema changes require it
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not redesign all level editing UI.
- Do not implement full Revit datum propagation.
- Do not touch schedule filters, sheet raster/export, IFC replay, room legends, or stair/roof geometry.
- Do not introduce broad defensive compatibility shims for unshipped branch behavior.
- Do not open a PR.

## Implementation Checklist

- Add one narrow dependent datum/level property or command behavior, such as a dependent offset, story constraint, or hosted-element impact summary.
- Ensure the behavior survives JSON command replay and snapshot hydration.
- Add deterministic validation/advisor rules for one inconsistent datum/host case.
- Keep diagnostic IDs/messages stable and sorted.
- Add focused tests for successful replay and one validation failure/advisory case.
- Update tracker rows with exact fields, commands, tests, and remaining level/datum blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_*level* tests/test_update_element_property* tests/test_constraints*
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B01`, `WP-V01`, `WP-X01`, and any narrow `WP-P01` evidence. Add a Recent Sprint Ledger entry describing the datum-chain/level-constraint slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(levels): add datum chain constraint slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, datum behavior added, tracker rows updated, validation results, and shared-file merge risks.
