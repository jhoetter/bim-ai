# Wave 3 Prompt 3 - Schedule Sheet Placement And Export Listing Cross-Format Parity V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

Schedules already have `schedulePaginationPlacementEvidence_v0`, CSV/JSON `…/table` output, and on-sheet placement. What is still missing is a deterministic cross-format parity layer proving that the sheet `schedule:` viewport, the JSON `…/table` output, the CSV export, and the SVG/PDF sheet listing segments all agree on row count, segment digest, and pagination placement for the same schedule.

The end state should let users and tests answer, for any schedule on any sheet:

- Whether row counts and pagination segments agree across CSV, JSON `…/table`, SVG/PDF listing, and the sheet `schedule:` viewport.
- Which export format diverges if any, and how.
- Which advisory rules fire when cross-format parity is broken.

## Target Workpackages

- WP-A02 Evidence package
- WP-D03 Schedules
- WP-E05 Sheet authoring and export
- WP-E06 Sheet print/export evidence
- WP-V01 Validation/advisor expansion

## Scope

Backend behavior:

- Add `scheduleSheetExportParityEvidence_v1` per schedule that has both a sheet placement and a derived table: includes `scheduleId`, `sheetId`, `viewportId`, `csvRowCount`, `jsonRowCount`, `svgListingRowCount`, `paginationSegmentCount`, `crossFormatParityToken` (`aligned`, `csv_diverges`, `json_diverges`, `listing_diverges`, `placement_missing`), and a deterministic digest `scheduleSheetExportParityDigestSha256`.
- Reuse existing schedule pagination/placement helpers and sheet listing helpers. Do not introduce new export pipelines.
- Add advisory rules: `schedule_sheet_export_parity_csv_diverges`, `schedule_sheet_export_parity_json_diverges`, `schedule_sheet_export_parity_listing_diverges`. Findings must identify the schedule, sheet, viewport, and divergent format.
- Embed the new evidence on the deterministic sheet evidence manifest and on the schedule `…/table` payload (digest-excluded only where existing patterns prescribe).

Web behavior:

- Extend `SchedulePanel` with a focused parity readout `data-testid="schedule-sheet-export-parity-readout"` showing per-schedule rows and the parity token.
- Surface advisory rules in the existing advisor UI patterns.
- Tests for readout rows, parity tokens, and advisory display.

Keep it bounded:

- Reuse `derive_schedule_table`, `schedule_csv`, `sheet_preview_svg`, `evidence_manifest`, and existing web schedule readouts.
- Do not change CSV column order or JSON shape.
- Do not introduce new schedule kinds.

## Non-goals

- No printable PDF pagination engine.
- No spreadsheet rasterization.
- No new schedule filtering or grouping rules.
- No schema migrations.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "schedule or kernel_schedule_exports or deterministic_sheet_evidence or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/schedules src/workspace/sheetDocumentationManifest.test.ts
```

Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-3-schedule-sheet-export-parity`.
- Commit your changes and push the branch.
- Do not open a pull request.
