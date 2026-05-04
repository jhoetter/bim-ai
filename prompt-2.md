# Agent Prompt 2: Validation Advisor Breadth And Quick-Fix Bundles

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Broaden PRD section 11 validation with additive blocking classes and quick-fix bundle guidance, staying mostly in advisor logic and tests so this can run safely beside the sheet projection/export work. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-V01` Validation/advisor expansion
- `WP-D03` Schedule UI
- `WP-E05` Sheet canvas and titleblock
- `WP-B06` Rooms and room separation
- light `WP-X01` JSON snapshot and command replay

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/validation-advisor-quickfix-bundles
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/constraints.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - existing room, schedule, sheet, and advisor tests
   - web advisor/filter tests if rendering or grouping changes

## File Ownership Rules

Keep this prompt additive and validation-focused. Avoid new element kinds, command schemas, and broad `engine.py` behavior. Use existing command quick-fix paths where possible. Do not touch sheet crop projection implementation owned by Prompt 1.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/constraints.py`
- focused helper functions under validation/advisor code
- tests for room, schedule, sheet, viewport, or IFC-adjacent advisor classes
- web tests only for existing advisor grouping/filter rendering
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not add new persisted element fields.
- Do not rewrite `constraints.evaluate`.
- Do not implement full PRD section 11 coverage in one pass.
- Do not change sheet projection/export behavior.
- Do not open a PR.

## Implementation Checklist

- Add at least one new PRD section 11 blocking/advisor class or strengthen one shallow existing class.
- Where feasible, return a deterministic quick-fix bundle using existing commands.
- Cover negative and positive cases in pytest.
- Keep advisor severity and reason codes stable and explicit.
- Update the tracker with remaining validation classes and quick-fix gaps.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_constraints* tests/test_schema_advisor.py tests/test_upsert_sheet_viewports.py tests/test_room*
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test -- advisor
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-V01`, `WP-D03`, `WP-E05`, `WP-B06`, and maybe `WP-X01`. Include exact violation/advisor IDs, quick-fix commands, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(validation): add advisor quick-fix bundle coverage

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, advisor classes added, quick-fix behavior, tracker rows updated, validation results, and shared-file merge risks.
