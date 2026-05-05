# Prompt 3 - Schedule Definition Coverage And Category Parity V1

## Mission

Deepen schedule definitions so that every current schedule category (walls, doors, windows, floors, roofs, stairs, rooms) has stable JSON+CSV export coverage with deterministic field registries, and type/material propagation flows through to schedule rows.

## Target Workpackages

- WP-D01 (Server-derived schedules) — currently partial ~72%
- WP-D02 (Schedule CSV/API/CLI export) — currently partial ~67%
- WP-D04 (Family/type registry and propagation) — currently partial ~51%

## Scope

### Backend (`app/bim_ai/`)

1. **Schedule field registry completeness** — extend `schedule_field_registry.py`:
   - Audit every schedule category and ensure all current element properties are registered as schedule fields.
   - Add missing field entries for: floor `floorTypeId`/`thicknessMm`, roof `roofTypeId`/`pitchDeg`, stair `riserCount`/`treadCount`/`riserHeightMm`/`treadDepthMm`.
   - `scheduleFieldRegistryCoverageEvidence_v1()` → per-category dict of registered vs available fields with coverage percentage.

2. **Type/material propagation into schedule rows** — extend `schedule_derivation.py`:
   - Wall/floor/roof schedule rows include resolved `typeName`, `materialAssemblyLayers` (count), `totalThicknessMm` from `material_assembly_resolve.py`.
   - Door/window rows include `hostWallTypeName` resolved from `hostWallTypeId`.

3. **CSV export determinism hardening** — extend `schedule_csv.py`:
   - Ensure every schedule category produces identical CSV output for the same document state (field ordering, numeric formatting, null handling).
   - `scheduleCsvExportParityEvidence_v1(doc)` → per-category row/column counts + content digest.

4. **JSON export parity** — ensure `GET .../schedules/{id}/table` JSON matches CSV field-for-field for all categories.

### Tests

5. `test_schedule_category_field_coverage.py`:
   - For each category, verify field registry covers all element properties that appear in schedule rows.
   - Verify type/material columns resolve for wall, floor, roof rows.
   - Verify CSV and JSON export produce matching field sets.
   - Verify `scheduleCsvExportParityEvidence_v1` digest stability.

## Non-goals

- Schedule UI improvements (covered separately).
- New schedule categories beyond existing ones.
- Calculated/formula fields.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_schedule_category_field_coverage.py tests/test_schedule_field_registry.py tests/test_schedule_derivation.py tests/test_kernel_schedule_exports.py tests/test_material_assembly_schedule.py -x -v
cd packages/web && pnpm typecheck
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-D01, WP-D02, WP-D04 rows.
- Create branch `prompt-3-schedule-category-field-coverage` from `main`.
- Commit and push. Do not open a pull request.
