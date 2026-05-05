# Wave 3 Prompt 3 (Re-run) - Schedule Sheet Placement And Export Listing Cross-Format Parity V1

## Why this re-run exists

A previous agent assigned to wave-3 prompt-3 instead implemented `Prompt-3 export closure V3 — CI baseline gate and fallback token closure` (commit `904421e1` on `main`). That commit is a **wave-2 closeout** of the sheet-print-raster Prompt-3, not the wave-3 prompt-3 spec. As a result, this prompt's prescribed surface — `scheduleSheetExportParityEvidence_v1` — is still unimplemented (`git grep` returns 0 hits on `origin/main`).

Do **not** revert, replicate, or extend `904421e1`. It is correct work for a different prompt and is staying on `main` as-is. Your job is the original wave-3 prompt-3 surface only: **schedule sheet placement / export listing cross-format parity**.

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

Schedules already have `schedulePaginationPlacementEvidence_v0`, CSV/JSON `…/table` output, and on-sheet placement. What is still missing is a deterministic cross-format parity layer proving that the sheet `schedule:` viewport, the JSON `…/table` output, the CSV export, and the SVG/PDF sheet listing segments all agree on row count, segment digest, and pagination placement for the same schedule.

This prompt is **not** about sheet print raster, CI baseline gates, fallback tokens, or `ciBaselineCorrelation`. Anything you add must live next to schedule code paths and the `schedule:` viewport listing — not next to `sheetExportArtifactManifest_v1`.

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

- Add `scheduleSheetExportParityEvidence_v1` per schedule that has both a sheet placement (`schedule:` viewport on a sheet) and a derived table. Each row must include:
  - `scheduleId`, `sheetId`, `viewportId`
  - `csvRowCount` (from existing `schedule_csv` helpers)
  - `jsonRowCount` (from `derive_schedule_table` payload)
  - `svgListingRowCount` (from existing sheet viewport export listing helpers in `sheet_preview_svg`)
  - `paginationSegmentCount` (from existing `schedulePaginationPlacementEvidence_v0`)
  - `crossFormatParityToken` ∈ { `aligned`, `csv_diverges`, `json_diverges`, `listing_diverges`, `placement_missing` }
- Add a deterministic `scheduleSheetExportParityDigestSha256` summarizing all rows.
- Reuse existing schedule pagination/placement helpers (`schedulePaginationPlacementEvidence_v0`) and existing sheet listing helpers. Do **not** introduce a new export pipeline, a new HTTP endpoint, or a new pagination engine.
- Add advisory rules:
  - `schedule_sheet_export_parity_csv_diverges`
  - `schedule_sheet_export_parity_json_diverges`
  - `schedule_sheet_export_parity_listing_diverges`
  Each finding must identify the affected `scheduleId`, `sheetId`, `viewportId`, and the divergent format.
- Embed `scheduleSheetExportParityEvidence_v1` on:
  - the deterministic sheet evidence manifest (next to existing schedule-related manifest rows), and
  - the schedule `…/table` payload as a top-level field (digest-excluded only where existing schedule-table precedent prescribes).

Web behavior:

- Extend `SchedulePanel` (not `SheetDocumentationManifest`) with a focused readout `data-testid="schedule-sheet-export-parity-readout"` showing per-schedule rows: scheduleId, sheetId, viewportId, parity token, and the four row counts.
- Surface the new advisory rules in the existing advisor UI patterns (`src/advisor` if available).
- Add tests for readout rows, parity tokens, sort order, and advisory display.

Keep it bounded:

- Reuse `derive_schedule_table`, `schedule_csv`, `sheet_preview_svg`, `evidence_manifest`, `constraints`, and existing web schedule/advisor readouts.
- Do not change CSV column order, JSON shape, or pagination row count rules.
- Do not introduce new schedule kinds.
- Do not modify `SheetDocumentationManifest.tsx` (it's already crowded — keep this prompt's surface inside the schedule-focused files).
- Do not touch `sheetExportArtifactManifest_v1`, `ciBaselineCorrelation`, `sheetPrintRasterPrintContract_v3`, or any sheet-print-raster surface — those belong to wave-2 Prompt-3 V3.

## Non-goals

- No printable PDF pagination engine.
- No spreadsheet rasterization.
- No new schedule filtering or grouping rules.
- No schema migrations.
- No CI baseline gate or fallback token work — that already shipped via `904421e1`.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "schedule or kernel_schedule_exports or deterministic_sheet_evidence or schedule_pagination or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/schedules src/workspace/sheetDocumentationManifest.test.ts src/advisor
```

Verify the prescribed symbol lands by running:

```bash
git grep "scheduleSheetExportParityEvidence_v1" -- 'app/' 'packages/web/src/'
```

It must return matches in at least: a backend module under `app/bim_ai/` (e.g. a new `schedule_sheet_export_parity.py` or extension of `schedule_derivation.py`), backend tests, a web parser/readout under `packages/web/src/schedules/`, and web tests.

If repository scripts differ, use the nearest existing equivalents. Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row labelled `Wave-3 Prompt-3 (re-run) schedule sheet export parity V1` and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, named exactly `wave-3-prompt-3-schedule-sheet-export-parity` (note: `wave-3-` prefix, not `prompt-3-`, to disambiguate from the wave-2 Prompt-3 V3 branch lineage).
- Commit your changes with a subject line that begins with `feat(schedule): wave-3 prompt-3 schedule sheet export parity V1` so it is unmistakable in `git log`.
- Push the branch.
- Do not open a pull request.
- Do not amend, revert, or rebase across `904421e1`. Build on top of current `main`.
