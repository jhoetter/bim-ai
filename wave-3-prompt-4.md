# Wave 3 Prompt 4 - IFC Export, Import Preview, And Authoritative Replay Cross-Manifest Closure V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

The IFC exchange manifest already carries `ifcImportPreview_v0`, `ifcUnsupportedMergeMap_v0`, `qtoLinkedProducts`, `propertySetCoverageEvidence_v0`, and `idsAuthoritativeReplayMap_v0` plus `try_apply_kernel_ifc_authoritative_replay_v0`. What is missing is a single deterministic cross-manifest closure that proves these surfaces stay consistent: that authoritative replay maps line up with the import preview's `authoritativeProducts`, that unsupported merge map classes line up with `unsupportedProducts` countsByClass, and that IDS pointer coverage agrees across the round trip.

The end state should let users and tests answer, for any IFC exchange manifest:

- Whether the authoritative replay map covers exactly the import preview's authoritative product slice.
- Whether unsupported product classes match between preview and merge map.
- Whether IDS pointer coverage rows are consistent across preview, merge map, and replay map.
- Which advisory rules fire when these surfaces drift.

## Target Workpackages

- WP-X01 OpenBIM exchange baseline
- WP-X03 IFC import authoritative replay
- WP-X05 IFC unsupported merge map
- WP-V01 Validation/advisor expansion
- WP-A02 Evidence package

## Scope

Backend behavior:

- Add `ifcExchangeManifestClosure_v0` to the IFC exchange manifest payload: `authoritativeProductsAlignmentToken` (`aligned`, `replay_missing_products`, `preview_missing_products`), `unsupportedClassAlignmentToken`, `idsPointerCoverageAlignmentToken`, plus a deterministic `ifcExchangeManifestClosureDigestSha256`.
- Reuse `build_ifc_import_preview_v0`, `build_ifc_unsupported_merge_map_v0`, `idsAuthoritativeReplayMap_v0`, and `ifc_stub` offline helpers — do not call into IfcOpenShell or expand its dependency surface.
- Cover the offline stub paths so the closure surface is always present, including when the kernel slice is not eligible.
- Add advisory rules: `exchange_ifc_manifest_authoritative_alignment_drift`, `exchange_ifc_manifest_unsupported_alignment_drift`, `exchange_ifc_manifest_ids_pointer_alignment_drift`. Findings must identify which alignment lane drifted and why.

Web behavior:

- This prompt is mostly backend-only. Add a small Workspace evidence readout `data-testid="ifc-exchange-manifest-closure-readout"` that renders the three alignment tokens deterministically. No UI restyling.

Keep it bounded:

- Reuse existing IFC export, preview, replay, and constraint infrastructure.
- Do not invent new IFC product classes or new merge constraint codes.
- Do not redesign the exchange manifest envelope.

## Non-goals

- No real IfcOpenShell dependency expansion.
- No destructive merge actions.
- No new authoritative replay command kinds.
- No schema migrations.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "ifc or export_ifc or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace
```

Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-4-ifc-exchange-manifest-closure`.
- Commit your changes and push the branch.
- Do not open a pull request.
