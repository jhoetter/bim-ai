# Wave 3 Prompt 5 - glTF Export Manifest Cross-Extension Digest Stability V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

The glTF export already emits `BIM_AI_exportManifest_v0` enriched with multiple deterministic extensions: `+bim_ai_wall_corner_join_summary_v1`, `+bim_ai_roof_layered_prism_witness_v1`, `+bim_ai_roof_unsupported_shape_summary_v0`, `+bim_ai_saved_3d_view_clip_v1`, `+bim_ai_section_projection_primitives`, etc. What is missing is a single deterministic cross-extension closure proving the extensions are stable in count, ordering, and digest across permutations and that no extension is silently dropped.

The end state should let users and tests answer, for any glTF export:

- Which extensions are present, with their order and a per-extension digest.
- Whether the cross-extension digest is stable under input element re-orderings that should not affect output.
- Which advisory rules fire when an expected extension is missing for an eligible model.

## Target Workpackages

- WP-E03 Section/elevation views
- WP-E04 Sectioned production views
- WP-X02 glTF export
- WP-A02 Evidence package
- WP-V01 Validation/advisor expansion

## Scope

Backend behavior:

- Add `gltfExportManifestClosure_v1` to the glTF manifest payload: ordered list of extension tokens, per-extension `digestSha256`, total `gltfExportManifestClosureDigestSha256`, and an `extensionPresenceMatrix` recording whether each known extension was emitted, suppressed (with reason code), or skipped because input was ineligible.
- Add focused tests asserting digest stability under deterministic input permutations (e.g., element id ordering shifts that should not change output).
- Add advisory rules: `gltf_export_manifest_expected_extension_missing` (with reason code) and `gltf_export_manifest_extension_order_drift`. Findings must identify the extension token.
- Reuse existing `export_gltf` helpers and the existing extension emit functions. Do not introduce new extensions.

Web behavior:

- Add a small Workspace readout `data-testid="gltf-export-manifest-closure-readout"` enumerating extension tokens with presence/digest summary.
- Tests for ordering, presence matrix, and digest stability summary.

Keep it bounded:

- Reuse `export_gltf`, `evidence_manifest`, and existing extension helpers.
- Do not change which extensions exist.
- Do not change mesh encoding tokens.

## Non-goals

- No new glTF extensions.
- No mesh encoding changes.
- No renderer/rasterizer work.
- No schema migrations.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "export_gltf or saved_3d_view or roof_pitch or wall_corner_join or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace
```

Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-5-gltf-manifest-closure`.
- Commit your changes and push the branch.
- Do not open a pull request.
