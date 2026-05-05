# Wave 3 Prompt 1 - Plan View To Sheet Viewport Export Listing Parity V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

Close the integration gap between plan view geometry and the sheet viewport export listing so that, for any plan view placed on a sheet, the deterministic plan crop, the sheet viewport box, and the exported listing/printed segments tell the same story. Today plan views can be placed on sheets, schedules and sections have rich placement evidence, but plan-on-sheet still leaves gaps between the in-canvas plan crop, the sheet viewport mm box, and what shows up in the export listing/print contract.

The end state should let users and tests answer, for any plan view on any sheet:

- Whether the plan view crop and the sheet viewport mm box agree, with a deterministic clamp/intersect token.
- Which plan primitives are inside vs outside the sheet viewport, summarized by category.
- Which exported listing segments correspond to that plan-on-sheet placement.
- Which advisory rules fire when the plan view crop is missing/zero/inverted relative to the sheet viewport.

## Target Workpackages

- WP-C01 First-class plan views
- WP-C02 Plan projection engine
- WP-C05 Project browser hierarchy
- WP-E05 Sheet authoring and export
- WP-V01 Validation/advisor expansion

## Scope

Backend behavior:

- Add a deterministic `planSheetViewportPlacementEvidence_v1` payload that, per `plan:` viewport on each sheet, exposes the plan view id, the sheet viewport mm box, the resolved plan crop mm box, an intersect/clamp token (e.g. `inside`, `clamped`, `crop_missing`, `viewport_zero_extent`, `crop_inverted`), and a per-category primitive count (in_box vs clipped) drawn from the existing plan projection wire.
- Surface a stable `planOnSheetSegmentDigestSha256` covering the exported listing segments produced for that placement, derived from existing sheet listing helpers; do not add new export pipelines.
- Reuse existing plan projection / sheet viewport / export listing helpers — do not introduce a parallel rendering path.
- Add validation/advisor coverage for `plan_view_sheet_viewport_crop_missing`, `plan_view_sheet_viewport_zero_extent`, and `plan_view_sheet_viewport_crop_inverted`. Each finding must identify the affected sheet, viewport, and plan view.
- Embed `planSheetViewportPlacementEvidence_v1` on the deterministic sheet evidence manifest alongside existing sheet manifests. Keep it digest-excluded only where existing precedent exists.

Web behavior:

- Add a focused readout in the Sheet Documentation Manifest UI showing per-plan-on-sheet rows: sheet, viewport, plan view, intersect/clamp token, and primitive counts.
- Surface the new advisory rules in the existing advisor UI patterns.
- Add focused tests for the readout, sort order, and advisory display.

Keep it bounded:

- Reuse `plan_projection_wire`, `sheet_preview_svg`, `evidence_manifest`, `constraints`, and existing web sheet/plan readouts.
- Do not invent a new viewport intersection algorithm — reuse existing clamp helpers.
- Do not add new IDs unless reusing existing ones forces ambiguity.

## Non-goals

- No real raster of plan-on-sheet output.
- No new sheet rendering surface.
- No schedule or section integration in this prompt.
- No schema migration or backwards-compatibility shim.
- No unrelated refactors or formatting sweeps.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "plan_projection or deterministic_sheet_evidence or sheet_export or constraints or plan_template_tag"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace/sheetDocumentationManifest.test.ts src/plan src/workspace
```

If repository scripts differ, use the nearest existing equivalents. Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-1-plan-on-sheet-viewport-listing-parity`.
- Commit your changes and push the branch.
- Do not open a pull request.
