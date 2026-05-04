# Agent Prompt 1: Reveal-Aware Schedule Quantities And Material Takeoff Closure

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Close the tracker gap where geometry now respects `revealInteriorMm`, but schedule quantities still use nominal `widthMm`. Align rough opening quantities, totals, CSV/JSON export, and material takeoff notes with the reveal-expanded rough opening model. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-D01` Server-derived schedules
- `WP-D02` Schedule CSV/API/CLI export
- `WP-D05` Materials/layer catalogs
- light `WP-B02` Walls, doors, windows, hosted openings

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/reveal-aware-schedule-quantities
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/schedule_field_registry.py`
   - `app/bim_ai/schedule_csv.py`
   - `app/bim_ai/opening_cut_primitives.py`
   - `app/tests/test_schedule_opening_computed_fields.py`
   - `app/tests/test_kernel_schedule_exports.py`
   - `app/tests/test_material_assembly_schedule.py`

## File Ownership Rules

Avoid new element fields or command schemas. Use existing `revealInteriorMm` data and the same effective rough span semantics used by geometry helpers. Do not touch IFC import/replay, plan/view template UI, or evidence artifact pipeline files.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/schedule_field_registry.py`, only for labels/help text
- `app/bim_ai/schedule_csv.py`, only if export behavior changes
- focused schedule and material assembly tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not add new persisted element fields.
- Do not redesign schedule filtering/grouping.
- Do not change geometry kernels except by reusing existing helper semantics.
- Do not change UI unless a small label/export assertion requires it.
- Do not open a PR.

## Implementation Checklist

- Align `roughOpeningAreaM2` and related totals with reveal-expanded rough opening width when `revealInteriorMm` is present.
- Keep nominal behavior unchanged for openings without reveal metadata.
- Ensure CSV/JSON export stays deterministic and includes the corrected values.
- Add tests that compare nominal vs reveal-aware schedule quantities.
- Update tracker rows with exact formulas, tests, and any remaining material takeoff gaps.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_schedule_opening_computed_fields.py tests/test_kernel_schedule_exports.py tests/test_material_assembly_schedule.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-D01`, `WP-D02`, `WP-D05`, and maybe `WP-B02`. Include formula changes, export behavior, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(schedules): align rough opening quantities with reveals

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, schedule quantity behavior added, tracker rows updated, validation results, and shared-file merge risks.
