# Prompt 4 - Section Graphics Material Hints And Viewport Scale V1

## Mission

Advance section views from projection boxes toward production documentation by adding material-aware cut hatches, section tag/dimension stubs, and viewport scale behavior on sheets.

## Target Workpackages

- WP-E04 (Section/elevation views) — currently partial ~75%
- WP-C03 (Plan symbology and graphics) — currently partial ~59%

## Scope

### Backend (`app/bim_ai/`)

1. **Section cut material hatching** — extend `section_projection_primitives.py`:
   - When a wall/floor/roof is cut by the section plane, emit `materialHatchPattern` token per cut face derived from the element's material assembly.
   - `sectionCutMaterialHints_v1` on section wire primitives: list of `{elementId, materialId, hatchPatternToken, cutFaceMm2}`.
   - Extend `secDoc[…]` segment in SVG/PDF export with `mh=N` (material hatch count) when present.

2. **Section viewport scale** — extend `sheet_preview_svg.py`:
   - When a section viewport is placed on a sheet, derive `viewportScaleFactor` from the viewport extent vs the section's model-space extent.
   - Persist `scaleFactor` on the sheet viewport element.
   - `sectionViewportScaleEvidence_v1` on sheet evidence: per-viewport `{sectionId, scaleFactor, sheetId}`.

3. **Section tag stubs** — extend `section_projection_primitives.py`:
   - `sectionAnnotationStubs_v1`: emit stub annotation tokens for level lines, grid intersections, and section marks that appear in the section view.
   - These are metadata tokens (not rendered geometry), documenting what annotations would appear in a production section.

4. **Plan symbology cross-reference** — extend `plan_category_graphics.py`:
   - When plan graphics reference a section mark symbol, include `sectionMarkRef` token linking to the section view ID.
   - Evidence: `planSectionMarkRefEvidence_v1` listing plan-to-section cross-references.

### Tests

5. `test_section_material_hatch_and_scale_evidence.py`:
   - Create section cutting through walls with known materials → verify `sectionCutMaterialHints_v1` tokens.
   - Place section viewport on sheet → verify `scaleFactor` derivation.
   - Verify `secDoc[…]` segment includes `mh=` count.
   - Verify annotation stubs emit for levels/grids in section view.

## Non-goals

- Actual hatch pattern rendering (geometry generation).
- Dimension placement or editing.
- Detail components or detail lines.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_section_material_hatch_and_scale_evidence.py tests/test_section_on_sheet_integration_evidence.py tests/test_section_sheet_callouts_evidence.py -x -v
cd packages/web && pnpm typecheck
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-E04, WP-C03 rows.
- Create branch `prompt-4-section-material-hatch-scale` from `main`.
- Commit and push. Do not open a pull request.
