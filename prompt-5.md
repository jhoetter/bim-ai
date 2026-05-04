# Agent Prompt 5: Section Documentation Dimensions Hatches And Material Hints

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Advance section/elevation views from projection boxes toward production documentation by adding one deterministic cut hatch, material hint, or dimension/tag evidence slice that flows into sheet viewport rendering/export. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E04` Section/elevation views
- `WP-C03` Plan symbology and graphics
- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export
- light `WP-D05` Materials/layer catalogs

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/section-doc-dimensions-hatches
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/sheet_preview_svg.py`
   - `packages/web/src/workspace/SectionViewportSvg.tsx`
   - `packages/web/src/workspace/sectionViewportDoc.ts`
   - `packages/web/src/plan/symbology.ts`
   - existing section primitive, sheet export, and SectionViewportSvg tests

## File Ownership Rules

Own section documentation primitives and rendering/export labels only. Avoid plan projection, room derivation, schedule filters, OpenBIM replay, sheet raster service, and roof/stair geometry kernels unless a read-only material hint is necessary.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/sheet_preview_svg.py`, only for section export/documentation tokens
- `packages/web/src/workspace/SectionViewportSvg.tsx`
- `packages/web/src/workspace/sectionViewportDoc.ts`
- `packages/web/src/plan/symbology.ts`
- focused section/sheet tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not build full Revit dimension-chain editing.
- Do not change plan view behavior.
- Do not touch schedule or OpenBIM code.
- Do not redesign SheetCanvas.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic section documentation feature: cut hatch classification, material/layer hint labels, dimension bracket/token, or door/window/level tag evidence.
- Ensure server primitives and web SVG rendering use the same stable source data.
- Add deterministic export token(s) to SVG/PDF listing if the feature is export-visible.
- Add pytest and Vitest coverage for primitive generation and rendering/export.
- Keep visual output stable and low-noise.
- Update tracker rows with exact primitive fields, rendering path, tests, and remaining section blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_section* tests/test_sheet_svg* tests/test_sheet_pdf*
cd packages/web && pnpm exec vitest run src/workspace src/plan
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-E04`, `WP-C03`, `WP-E05`, `WP-E06`, and any narrow `WP-D05` evidence. Add a Recent Sprint Ledger entry describing the section documentation slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sections): add documentation hatch dimension slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, section documentation behavior added, tracker rows updated, validation results, and shared-file merge risks.
