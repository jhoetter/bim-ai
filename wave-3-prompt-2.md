# Wave 3 Prompt 2 - Section/Elevation Viewport To Sheet Documentation Integration V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

Close the integration gap between section/elevation viewports and the sheet documentation manifest so that, for any section or elevation placed on a sheet, the section primitives, the sheet viewport, the titleblock revision/issue manifest, and the exported listing segments form a single coherent evidence chain. Section primitives, callouts, and revision/issue manifests already exist; what is missing is a deterministic per-section-on-sheet integration row that ties them together.

The end state should let users and tests answer, for any section/elevation viewport on any sheet:

- Which sheet, viewport, and source section view are correlated.
- Whether the cut line, profile token, and listing segments agree.
- Which revision/issue context applies (sheetRevIssDoc cross-reference).
- Which advisory rules fire when section-on-sheet evidence is incomplete or inconsistent.

## Target Workpackages

- WP-E03 Section/elevation views
- WP-E04 Sectioned production views
- WP-E05 Sheet authoring and export
- WP-E06 Sheet print/export evidence
- WP-V01 Validation/advisor expansion

## Scope

Backend behavior:

- Add `sectionOnSheetIntegrationEvidence_v1` per `section:` viewport on each sheet: sheet id, viewport id, section view id, cut line digest (from existing section primitives), profile token (reusing `sectionProfileToken_v0`), listing segment digest (from existing sheet listing helpers), and a cross-reference to `sheetTitleblockRevisionIssueManifest_v1` (the resolved revisionId/issueCode applicable to that sheet).
- Add a deterministic `sectionOnSheetIntegrationDigestSha256` summarizing all rows for the sheet.
- Add validation/advisor rules: `section_on_sheet_cut_line_missing`, `section_on_sheet_profile_token_missing`, `section_on_sheet_revision_issue_unresolved`. Findings must identify sheet/viewport/section view.
- Embed the new evidence on the deterministic sheet evidence manifest. Reuse existing helpers in `section_projection_primitives`, `sheet_preview_svg`, and `evidence_manifest`.

Web behavior:

- Add a Sheet Documentation Manifest readout `data-testid="sheet-manifest-section-on-sheet-integration-readout"` showing one row per section-on-sheet placement.
- Surface advisory rules in the existing advisor UI patterns.
- Tests for readout rows, sort order, and advisory display.

Keep it bounded:

- Reuse the section projection primitives, sheet documentation, titleblock revision/issue, and existing constraint infrastructure.
- Do not duplicate the section profile computation — reference its token only.
- Do not generalize callouts here; that is owned by other prompts.

## Non-goals

- No new section rendering or new cut-line geometry.
- No printable PDF rasterization.
- No automatic revision-issue assignment workflow.
- No schema migrations.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "section or sheet_export or deterministic_sheet_evidence or sheet_titleblock or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace/sheetDocumentationManifest.test.ts src/workspace/sectionViewportSvg.test.ts src/workspace
```

Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-2-section-on-sheet-integration`.
- Commit your changes and push the branch.
- Do not open a pull request.
