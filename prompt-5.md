# Agent Prompt 5: Section Dimensions Tags And Material Cut Patterns

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Advance section/elevation documentation by adding one deterministic dimension/tag/material cut-pattern slice that appears in server primitives, sheet export tokens, and `SectionViewportSvg`. Do not open a pull request. Commit and push only your branch.

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
   git switch -c agent/section-dimensions-tags-material-cuts
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/sheet_preview_svg.py`
   - `packages/web/src/workspace/SectionViewportSvg.tsx`
   - `packages/web/src/workspace/sectionViewportDoc.ts`
   - `packages/web/src/plan/symbology.ts`
   - existing section/sheet export/Vitest tests

## File Ownership Rules

Own section documentation primitives/rendering/export tokens only. Avoid plan projection, room legends, schedule filters, OpenBIM, sheet raster internals, and hosted-opening geometry.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/sheet_preview_svg.py`, only for section documentation export tokens
- `packages/web/src/workspace/SectionViewportSvg.tsx`
- `packages/web/src/workspace/sectionViewportDoc.ts`
- `packages/web/src/plan/symbology.ts`
- focused section/sheet tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement editable dimension chains.
- Do not touch schedule, IFC, or room logic.
- Do not redesign SheetCanvas.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic production documentation feature: dimension witness token, material cut pattern hint, elevation tag, or scale-aware annotation.
- Ensure server primitive, web rendering, and export token paths agree.
- Keep rendering deterministic and low-noise.
- Add pytest and Vitest coverage.
- Update tracker rows with exact primitive/export fields and remaining blockers.

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
feat(sections): add dimension tag material cut slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, section documentation behavior added, tracker rows updated, validation results, and shared-file merge risks.
