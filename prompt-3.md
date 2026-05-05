# Prompt 3 - Sheet Print Raster Contract And SVG PNG Export Closure V1

## Mission

Close the remaining browser-free sheet print raster and export evidence gap for Revit Production Parity v1, wave 2 of 4.

This is an implementation task for the next agent. The current tracker indicates that sheet-print-raster surrogate evidence and print contract evidence already exist, but true browser-free full SVG-to-pixels raster/export closure remains out. Your job is to tighten the deterministic contract around sheet canvas export artifacts, print/export evidence, baseline correlation, and explicit fallback behavior without expanding the project into a full print-rendering engine.

The expected result is a bounded, deterministic closure of the sheet print raster/export contract: SVG/PDF listing parity, PNG surrogate or renderer contract, stable artifact names and digests, CI baseline manifest correlation, and clear unsupported/full-raster fallback tokens where a true external renderer is unavailable.

## Target Workpackages

- WP-E05 Sheet canvas and titleblock
- WP-E06 SVG/PNG/PDF export
- WP-A02 Evidence package API
- WP-A03 Playwright evidence baselines
- WP-A04 CI verification gates

## Scope

Implement the smallest coherent change set that makes the sheet print raster/export contract deterministic and verifiable across backend evidence generation, frontend sheet canvas/export behavior if needed, evidence baselines, and CI gates.

Focus the work on these outcomes:

- Ensure sheet export evidence records SVG and PDF listings with parity checks where both formats are produced or declared.
- Define and enforce a PNG export contract that is deterministic even when a true browser-free SVG-to-pixels renderer is unavailable.
- If a renderer is available locally in the existing stack, wire it through the existing export/evidence path using stable inputs and outputs.
- If no suitable renderer is already available, keep the existing PNG surrogate path but make the surrogate contract explicit, named, digestible, and test-covered.
- Emit explicit fallback tokens for unsupported or unavailable full-raster export paths, such as `unsupported_full_raster_renderer_unavailable` or an equivalent established project token.
- Preserve artifact names, relative paths, MIME/type metadata, and digests in evidence manifests so generated evidence can be correlated by CI and baseline tests.
- Correlate sheet export artifacts with the CI baseline manifest, including artifact name, digest, format, and source sheet identity.
- Keep sheet canvas and titleblock changes limited to what is required for export contract correctness and manifest correlation.
- Add or update deterministic tests around sheet evidence generation, sheet export manifests, evidence package API responses, and CI baseline validation.
- Update Playwright or fixture baselines only when contract changes require fixture updates, and keep the snapshot churn minimal and explainable.

The implementation should follow existing project patterns. Prefer local helpers and existing evidence/export abstractions over introducing new framework-level concepts. Keep imports at the top of files and preserve TypeScript exhaustive handling patterns for unions or enums.

## Non-goals

- Do not build or require a full external renderer if the project does not already have a suitable dependency or integration path.
- Do not attempt pixel-perfect Revit print engine parity.
- Do not introduce a large rendering subsystem, headless browser dependency, or external service just to rasterize SVG.
- Do not churn snapshots, baselines, or generated fixtures unless tests require a fixture update for the new contract.
- Do not broaden the v1 scope beyond deterministic sheet print raster/export evidence closure.
- Do not change unrelated workpackages or refactor unrelated sheet/export/evidence code.
- Do not open a pull request.

## Validation

Run focused validation first, then broader checks if touched files justify them.

Backend validation should include ruff and pytest coverage for deterministic sheet evidence, sheet export, evidence closure, manifest correlation, and fallback token behavior. Use the repository’s existing command names and test selectors where available, for example:

```bash
ruff check .
pytest -q
pytest -q path/to/relevant/sheet_evidence_tests.py path/to/relevant/sheet_export_tests.py path/to/relevant/evidence_package_tests.py
```

If UI, sheet canvas, export manifest UI, or frontend evidence-baseline code changes are made, also run the web checks:

```bash
npm run typecheck
npm run test -- --run
```

If the tracker or markdown fixtures are changed, run the repository’s prettier check for the tracker:

```bash
npm run prettier:check -- spec/revit-production-parity-workpackage-tracker.md
```

If command names differ, inspect the repo scripts and use the closest existing equivalents. Record any command that cannot be run and why.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-3-sheet-print-raster-export-closure`.
- Commit your changes and push the branch.
- Do not open a pull request.
