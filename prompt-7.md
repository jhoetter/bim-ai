# Prompt 7 - Validation Advisor PRD Blocking Expansion V1

## Mission

Expand the validation/advisor framework with broader PRD §11 blocking classes, schedule/sheet linkage checks, and quick-fix bundle coverage so that the advisor surface covers the major production validation scenarios.

## Target Workpackages

- WP-V01 (Validation/advisor expansion) — currently partial ~60%

## Scope

### Backend (`app/bim_ai/`)

1. **Blocking class taxonomy** — extend `constraints.py`:
   - Define `AdvisorBlockingClass` enum: `geometry`, `exchange`, `documentation`, `schedule`, `sheet`, `evidence`.
   - Tag every existing advisor rule with its blocking class.
   - `advisorBlockingClassSummary_v1(doc)` → per-class count of violations at each severity.

2. **Schedule/sheet linkage validation** — extend `constraints.py`:
   - `schedule_not_placed_on_sheet`: warns when a schedule definition exists but has no sheet viewport.
   - `sheet_viewport_schedule_stale`: warns when a schedule viewport's row count differs from current derivation.
   - `schedule_field_registry_gap`: info when a schedule category has unregistered element properties.

3. **Quick-fix bundle expansion** — extend existing quick-fix infrastructure:
   - `fix_schedule_sheet_placement`: creates a sheet viewport for an unplaced schedule on the first available sheet.
   - `fix_sheet_viewport_refresh`: triggers schedule re-derivation for stale viewports.
   - Each quick-fix returns a `quickFixResult_v1` with `{applied, skipped, reason}`.

4. **PRD blocking advisor matrix integration** — extend `prd_blocking_advisor_matrix.py`:
   - Include the new rules in the PRD §11-§15 matrix.
   - `prdBlockingAdvisorMatrixExpansion_v1` evidence: complete rule inventory with blocking class, severity, quick-fix availability.

5. **Advisor severity summary on evidence API** — extend `routes_api.py`:
   - `GET .../evidence` response includes `advisorSeveritySummary_v1`: `{error: N, warning: N, info: N}` counts.

### Tests

6. `test_advisor_blocking_class_expansion.py`:
   - Verify all existing rules have a blocking class tag.
   - Create doc with unplaced schedule → verify `schedule_not_placed_on_sheet` fires.
   - Apply `fix_schedule_sheet_placement` → verify viewport created.
   - Verify `advisorBlockingClassSummary_v1` counts.
   - Verify PRD matrix includes new rules.

## Non-goals

- User-configurable advisor severity overrides.
- Advisor suppression/acknowledgment workflow.
- Real-time advisor push notifications.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_advisor_blocking_class_expansion.py tests/test_constraints.py tests/test_prd_blocking_advisor_matrix.py tests/test_constraints_schedule_sheet_link.py -x -v
cd packages/web && pnpm typecheck
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-V01 row.
- Create branch `prompt-7-advisor-blocking-class-expansion` from `main`.
- Commit and push. Do not open a pull request.
