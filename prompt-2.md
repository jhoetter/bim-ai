# Agent Prompt 2: Section Documentation Graphics And Detail Callout Slice

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Deepen section/elevation documentation beyond current marker/tag/proxy slices with deterministic cut hatches or material hints, detail/callout reference evidence, and SVG/PDF listing coverage. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E04` Section/elevation views
- `WP-C02` Plan projection engine
- `WP-C03` Plan symbology and graphics
- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/section-documentation-callouts
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/sheet_preview_svg.py`
   - sheet PDF/export listing helpers
   - `packages/web/src/workspace/SectionViewportSvg.tsx`
   - `packages/web/src/workspace/sectionViewportDoc.ts`
   - existing section, sheet export, and section viewport tests

## File Ownership Rules

Own section/detail documentation evidence only. Avoid plan-view template/editor files, room derivation, schedules, IFC, and performance diagnostics. Keep any export-listing change limited to section/detail evidence strings.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/sheet_preview_svg.py`
- sheet PDF/listing helpers only for section/detail evidence
- `packages/web/src/workspace/SectionViewportSvg.tsx`
- section viewport helper/test files
- focused section/export pytest and Vitest
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change plan crop or viewport crop semantics.
- Do not add a full annotation authoring system.
- Do not change room derivation or IFC replay.
- Do not regenerate broad visual baselines unless a focused section baseline already exists and must change.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic section documentation improvement, such as cut hatch/material hints or detail/callout reference evidence.
- Surface the same evidence in server export/listing and, where relevant, web section viewport rendering.
- Preserve current level marker, tag, and `secDoc[...]` behavior.
- Add tests proving deterministic section evidence and export listing output.
- Update tracker rows with exact section/detail behavior and remaining documentation blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_section* tests/test_sheet*
cd packages/web && pnpm exec vitest run src/workspace
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-E04`, `WP-C02`, `WP-C03`, `WP-E05`, and `WP-E06`. Add a Recent Sprint Ledger entry describing the documentation graphics or detail/callout slice and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sections): add documentation graphics callout slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, section/detail behavior added, tracker rows updated, validation results, and shared-file merge risks.
