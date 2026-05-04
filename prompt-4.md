# Prompt 4 — Sheet Print Raster Contract V3 Slice

You are a future implementation agent working in `/Users/jhoetter/repos/bim-ai`.

## Operating Rules

- Start from the current `main` branch state.
- Create and work on a dedicated branch for this prompt.
- Commit your finished changes and push the branch.
- Do not create a pull request.
- Keep the implementation narrowly scoped to this prompt.
- Update `spec/revit-production-parity-workpackage-tracker.md`, including both:
  - `Current Workpackages`
  - `Recent Sprint Ledger`
- Preserve unrelated working tree changes if present. Do not revert or rewrite user changes.
- If you encounter conflicts or nearby edits, inspect them and make the smallest compatible change. If the conflict changes the intended design materially, stop and report the blocker instead of broadening scope.

## Goal

Implement one deterministic, browser-free raster/print-contract improvement over the existing `sheetPrintRasterPrintSurrogate_v2` slice.

The current v2 behavior provides a deterministic PNG print surrogate for sheet evidence, but it is still a surrogate rather than a true SVG-to-pixels or PDF-to-pixels raster. This prompt should advance the contract without requiring Playwright, external binaries, network services, or a production print service.

For this slice, implement **Sheet Print Raster Contract V3** as a server-side metadata validation and correlation contract:

- Introduce a `sheetPrintRasterPrintContract_v3` evidence payload or closely equivalent field name consistent with existing naming.
- Keep PNG generation deterministic and browser-free.
- Correlate each generated `sheet-print-raster.png` surrogate with the sheet SVG/PDF print segments that already exist or are produced nearby.
- Add richer, machine-checkable metadata for paper, titleblock, viewport bands, image dimensions, and deterministic hashes.
- Add server-side validation that the raster metadata matches the emitted artifact headers/bytes and the related SVG/PDF segment metadata.

Do not attempt a full real rasterizer. The deliverable is a stronger print contract, not production print fidelity.

## Target Workpackages

Update the tracker rows and ledger for these workpackages:

- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export
- `WP-A02` Evidence package API
- `WP-A03` Playwright evidence baselines
- Light `WP-F02` Agent review UI only if display changes are needed

The tracker should make clear what V3 proves and what still remains blocked. In particular, call out that true SVG/PDF pixel rasterization remains out of scope unless a future browser-free raster backend exists.

## Suggested Files

Prefer these files and avoid broadening unless the codebase requires a small adjacent helper:

- `app/bim_ai/sheet_preview_svg.py`
- `app/bim_ai/routes_api.py`
- `app/bim_ai/evidence_manifest.py`
- `app/tests/test_sheet_print_raster_placeholder.py`
- `app/tests/test_plan_projection_and_evidence_slices.py`
- `packages/web/e2e/evidence-baselines.spec.ts`
- `packages/web/src/workspace/AgentReviewPane.tsx` only if the evidence display needs a small V3 row or label
- `spec/revit-production-parity-workpackage-tracker.md`

Do not perform broad SheetCanvas authoring changes.

## Non-Goals

Do not implement or refactor:

- Schedules
- IFC replay
- Geometry kernels
- Room legends
- Broad SheetCanvas editing or authoring behavior
- Browser-driven rasterization
- External raster binaries, hosted print services, or network-dependent validation
- A real pixel diff engine

## Implementation Shape

First inspect the current v2 implementation:

- Find `sheetPrintRasterPrintSurrogate_v2`.
- Find `sheet_print_raster_print_surrogate_png_bytes_v2`.
- Find the `sheet-print-raster.png` API route and response headers.
- Find how `deterministicSheetEvidence`, evidence manifests, ingest fields, and Playwright mock baselines expose the raster artifact.
- Find existing SVG/PDF segment helpers such as `planPrim[...]`, `secDoc[...]`, `format_sheet_plan_viewport_projection_segment`, or nearby naming.

Then implement V3 with the smallest coherent contract. A good concrete shape is:

1. Keep the existing v2 PNG bytes stable unless tests need an intentional V3 path.
2. Add a deterministic V3 metadata object, for example `sheetPrintRasterPrintContract_v3`.
3. Include fields equivalent to:
   - `artifactName`: `sheet-print-raster.png`
   - `surrogateVersion`: `sheetPrintRasterPrintSurrogate_v2` or `sheetPrintRasterPrintSurrogate_v3` if you create a new byte format
   - `widthPx`, `heightPx`, `colorMode`
   - `paperWidthMm`, `paperHeightMm`, `paperName` or existing paper identifier
   - titleblock identity and normalized titleblock parameter digest
   - viewport/layout band descriptors
   - SVG segment digest or ordered segment digests
   - PDF segment digest or ordered segment digests where available
   - PNG byte SHA-256 digest
   - validation status, such as `valid: true`, plus explicit check names
4. Add a server-side validator/helper that deterministically recomputes the metadata checks from the generated artifact and sheet export data. Tests should fail if dimensions, hashes, or segment correlations drift.
5. Surface the V3 contract through the evidence package API and manifest in the same style as existing raster ingest/evidence fields.
6. Update Playwright evidence baseline mocks/assertions only as needed so the frontend baseline knows about the V3 field. If the UI already renders generic evidence fields adequately, avoid changing `AgentReviewPane.tsx`.

Prefer structured data over string parsing where helpers already exist. Where existing export contracts are string-based, use stable, small digest helpers around the canonical strings rather than inventing a large new export model.

## Determinism Requirements

- No timestamps, random IDs, environment-specific paths, locale-dependent formatting, or unordered dict/set serialization in V3 metadata.
- Hash inputs must be canonical and documented by code structure or test expectations.
- If serializing JSON for hashes, sort keys and use compact separators.
- Keep generated PNG dimensions and metadata checks deterministic across repeated test runs.
- Do not require a browser, Playwright, system rasterizer, external binary, or network service for app-level tests.

## Tests

Add or update focused tests that prove the V3 contract.

Required app-level coverage:

- The sheet raster endpoint still returns deterministic PNG bytes and width/height headers.
- V3 metadata reports expected PNG dimensions and digest.
- V3 metadata includes richer paper/titleblock/layout-band information.
- V3 metadata correlates to SVG/PDF segment strings or digests for at least one deterministic sheet fixture.
- The server-side validator passes for the fixture and would fail for an obvious mismatch, such as wrong dimensions or wrong PNG digest.
- Evidence manifest/API output includes the V3 contract field.

Recommended test locations:

- `app/tests/test_sheet_print_raster_placeholder.py`
- `app/tests/test_plan_projection_and_evidence_slices.py`

Frontend baseline:

- Update `packages/web/e2e/evidence-baselines.spec.ts` if mocked evidence package data needs the V3 contract.
- Add a small assertion for the V3 field only if practical and consistent with existing baseline style.

Only touch `packages/web/src/workspace/AgentReviewPane.tsx` if the UI needs an explicit display change for the V3 contract. Keep any UI change light and evidence-focused.

## Validation Commands

Run the most focused useful commands first:

```bash
python -m pytest app/tests/test_sheet_print_raster_placeholder.py app/tests/test_plan_projection_and_evidence_slices.py
```

If practical, run the Playwright evidence baseline:

```bash
pnpm --dir packages/web test:e2e evidence-baselines
```

If practical before committing, run:

```bash
pnpm verify
```

If command names differ in the repo, inspect package scripts and use the closest focused equivalent. In your final response, report exactly what passed and what you could not run.

## Acceptance Criteria

- A dedicated branch exists and is pushed.
- A commit exists on that branch with the implementation and tracker update.
- No PR is created.
- `sheetPrintRasterPrintContract_v3` or an equivalently named V3 contract is exposed in evidence output.
- The V3 contract is deterministic, browser-free, and does not require external binaries or services.
- The contract validates PNG metadata server-side and correlates the raster surrogate to SVG/PDF sheet export segment metadata.
- Paper/titleblock metadata is richer than v2 and covered by tests.
- Focused app tests pass.
- Playwright evidence baseline and `pnpm verify` are run if practical, or skipped with a clear reason.
- `spec/revit-production-parity-workpackage-tracker.md` has an updated `Recent Sprint Ledger` row for this prompt and updated `Current Workpackages` rows for the targeted WPs.

## Conflict-Avoidance Rules

- Do not rename existing v2 fields unless a test-proven compatibility path remains.
- Do not remove `sheetPrintRasterPrintSurrogate_v2` unless the codebase already treats it as internal and all references move cleanly.
- Do not change unrelated evidence package semantics.
- Do not change route URLs unless absolutely necessary; prefer additive metadata.
- Do not expand into unrelated print, canvas, schedule, IFC, room, or geometry work.
- Do not add package dependencies for rasterization.
- Do not make broad frontend layout changes for a backend evidence contract.
- If there is already a V3-like field on the branch, extend or normalize it instead of adding a competing parallel contract.

## Final Response Requirements

When finished, report:

- Branch name.
- Commit SHA.
- Push status.
- Summary of the V3 contract.
- Tests/validation commands run and results.
- Any skipped validation with reason.
- Confirmation that no PR was created.
