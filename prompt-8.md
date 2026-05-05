# Prompt 8 - Sheet Viewport Production And Export Hardening V1

## Mission

Harden sheet viewport authoring and export so that placed viewports carry production-grade metadata, export segments are complete and deterministic, and the evidence baseline covers the full sheet production surface.

## Target Workpackages

- WP-E05 (Sheet canvas and titleblock) — currently partial ~75%
- WP-E06 (SVG/PNG/PDF export) — currently partial ~73%
- WP-A02 (Evidence package API) — currently partial ~82%

## Scope

### Backend (`app/bim_ai/`)

1. **Viewport production metadata** — extend `sheet_preview_svg.py`:
   - Each placed viewport emits `viewportProductionMetadata_v1`: `{viewportId, viewType, viewName, scaleFactor, cropBoundsMm, isClipped, sheetId}`.
   - `sheetViewportProductionManifest_v1(doc, sheetId)` → ordered list of all viewport metadata for a sheet with a manifest digest.

2. **Export segment completeness** — extend `sheet_preview_svg.py` and `sheet_preview_pdf.py`:
   - Ensure every viewport type (plan, section, schedule, 3D) emits its type-specific export segment token in SVG/PDF.
   - `sheetExportSegmentCompleteness_v1(doc, sheetId)` → per-viewport `{viewportId, segmentTokens[], missingTokens[]}`.
   - Missing segment tokens generate info-level advisor entries.

3. **Titleblock field completeness** — extend `sheet_titleblock_revision_issue_v1.py`:
   - `titleblockFieldCompleteness_v1(doc, sheetId)` → list of expected vs populated titleblock fields with coverage percentage.
   - Fields: project name, project number, sheet name, sheet number, drawn by, checked by, date, revision.

4. **Evidence baseline sheet coverage** — extend `evidence_manifest.py`:
   - `sheetProductionEvidenceBaseline_v1(doc)` → per-sheet summary: viewport count, segment completeness %, titleblock coverage %, revision/issue count, manifest digest.
   - Include in `GET .../evidence` response under `sheetProductionBaseline_v1`.

### Tests

5. `test_sheet_viewport_production_hardening.py`:
   - Create sheet with plan + section + schedule viewports → verify `viewportProductionMetadata_v1` for each.
   - Export SVG → verify segment tokens present for each viewport type.
   - Verify titleblock field completeness with partial/full titleblock data.
   - Verify `sheetProductionEvidenceBaseline_v1` digest stability.
   - Verify missing segments generate advisor entries.

## Non-goals

- Full raster rendering service (remains deferred).
- Sheet printing to physical printers.
- Multi-sheet batch export optimization.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_sheet_viewport_production_hardening.py tests/test_sheet_export.py tests/test_deterministic_sheet_evidence.py tests/test_sheet_print_raster_export_closure.py -x -v
cd packages/web && pnpm typecheck
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-E05, WP-E06, WP-A02 rows.
- Create branch `prompt-8-sheet-viewport-production-hardening` from `main`.
- Commit and push. Do not open a pull request.
