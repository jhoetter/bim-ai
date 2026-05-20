# BIM AI - God File Reduction Tracker

Last updated: 2026-05-20

Purpose: keep the largest source files shrinking in small, safe slices after the
main code-quality tracker reached B territory. The goal is not to move lines for
its own sake; each extraction should remove a cohesive responsibility from a
high-churn file and leave a smaller public surface behind.

This tracker is intentionally automation-first. Current file sizes come from:

```bash
pnpm quality:report -- --json
```

The release scorecard remains the source of truth for grade, budgets, waivers,
and largest-file ordering.

## Current Baseline

Scorecard snapshot on 2026-05-20:

- code quality grade: `B`, `7.5/10`
- tracker rows: `20/20` done in `spec/code-quality-tracker.md`
- over-budget source files: `71`
- blocking over-budget files without owner/tracker disposition: `0`
- unowned over-budget files: `4`

Largest files at tracker start:

| Rank | File                                                        | Lines | Owner area         | Main risk                                       |
| ---- | ----------------------------------------------------------- | ----: | ------------------ | ----------------------------------------------- |
| 1    | `packages/web/src/plan/PlanCanvas.tsx`                      | 8,974 | frontend-plan      | Input, preview, selection, render orchestration |
| 2    | `packages/cli/cli.mjs`                                      | 6,785 | cli-contracts      | CLI command dispatch and evidence workflows     |
| 3    | `packages/web/src/workspace/inspector/InspectorContent.tsx` | 6,586 | frontend-inspector | Element-kind switchboard and editors            |
| 4    | `packages/web/src/workspace/Workspace.tsx`                  | 6,560 | frontend-workspace | Shell, tabs, dialogs, command routing           |
| 5    | `app/bim_ai/api/registry.py`                                | 6,320 | backend-api        | API descriptor registry                         |
| 6    | `packages/web/src/Viewport.tsx`                             | 6,207 | frontend-viewport  | Scene lifecycle, picking, overlays              |
| 7    | `scripts/audit-ui-mcp-parity.mjs`                           | 5,962 | quality-tooling    | Audit orchestration and report formatting       |
| 8    | `packages/core/src/index.ts`                                | 5,356 | core-contracts     | Public type and command barrel                  |

## Operating Rules

- Work in narrow slices that can be committed and pushed independently.
- Before staging, verify `git diff --cached --name-only` does not include
  unrelated parallel-agent files.
- Prefer extracting stable, cohesive branches or pure helpers before moving
  volatile callback logic.
- Add or run focused tests for the extracted behavior. If a slice is only a
  mechanical UI delegation with existing tests, run those tests explicitly.
- Update this tracker and, when frontend monolith ownership changes, update
  `spec/frontend-monolith-extraction-map.md`.
- Do not mark a giant file "handled" because it has an owner. The live target is
  continuous reduction until the largest files are materially smaller.

## Targets

Near-term target for B+ maintainability:

- top file below `8,000` LOC
- at least three of the top eight files reduced by `10%` from this baseline
- no net LOC growth in any top-eight file without a matching extraction note

A-territory target:

- no hand-written frontend TSX file above `4,000` LOC
- no hand-written TS/MJS/Python module above `4,000` LOC unless generated or
  explicitly accepted as a registry/barrel with tests
- all top-eight files either below `4,000` LOC or split into domain-owned
  controllers/renderers with separate tests

## Work Packages

| ID          | Priority | Status | File                                                        | Target slice                                                       | Exit signal                                               |
| ----------- | -------- | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| GFR-2026-01 | P0       | Done   | `packages/web/src/workspace/inspector/InspectorContent.tsx` | Continue extracting self-contained element-kind inspector sections | Inspector below `6,000` LOC with focused tests passing.   |
| GFR-2026-02 | P0       | Done   | `packages/web/src/plan/PlanCanvas.tsx`                      | Extract pointer/keyboard or overlay controllers                    | PlanCanvas below `8,500` LOC with plan tests passing.     |
| GFR-2026-03 | P1       | Open   | `packages/web/src/workspace/Workspace.tsx`                  | Extract dialog/modal and command-routing controllers               | Workspace below `6,000` LOC with workspace tests passing. |
| GFR-2026-04 | P1       | Open   | `packages/cli/cli.mjs`                                      | Extract command groups and report writers                          | CLI below `6,000` LOC with CLI smoke/tests passing.       |
| GFR-2026-05 | P1       | Open   | `packages/web/src/Viewport.tsx`                             | Extract scene lifecycle, HUD, and picking hooks                    | Viewport below `5,500` LOC with viewport tests passing.   |
| GFR-2026-06 | P1       | Open   | `app/bim_ai/api/registry.py`                                | Split descriptor groups without changing public registry output    | Registry below `5,500` LOC with descriptor tests passing. |
| GFR-2026-07 | P2       | Open   | `scripts/audit-ui-mcp-parity.mjs`                           | Extract report formatting and audit collectors                     | Audit script below `5,000` LOC with quality tests green.  |
| GFR-2026-08 | P2       | Open   | `packages/core/src/index.ts`                                | Move remaining thematic type clusters behind public re-exports     | Core barrel below `5,000` LOC with typecheck passing.     |

## Progress Log

- 2026-05-20: tracker created from the generated scorecard baseline after the
  code-quality tracker reached B. The immediate focus is `GFR-2026-01` because
  `InspectorContent.tsx` has many self-contained renderer branches with existing
  focused tests, making it the lowest-risk way to keep shrinking a top-three
  god file while preserving behavior.
- 2026-05-20: `GFR-2026-01` moved to Partial. The site terrain inspector slice
  moves `toposolid`, `graded_region`, `toposolid_excavation`, and
  `toposolid_pad` rows into
  `packages/web/src/workspace/inspector/siteTerrainInspectorSections.tsx` with
  focused coverage in `siteTerrainInspector.test.tsx`, reducing
  `InspectorContent.tsx` to about `6,428` scorecard-counted lines.
- 2026-05-20: the next `GFR-2026-01` slice moved placed tag, room tag, and
  material tag inspector rows into
  `packages/web/src/workspace/inspector/annotationTagInspectorSections.tsx`.
  Existing tag inspector tests continue to cover placed and room tags, and
  `materialTagInspector.test.tsx` covers the material tag branch. The scorecard
  now counts `InspectorContent.tsx` at about `6,309` lines, and this slice also
  reduced non-test frontend type-escape matches from `106` to `103`.
- 2026-05-20: the next `GFR-2026-01` slice moved spot elevation, spot
  coordinate, spot slope, and slope annotation rows into
  `packages/web/src/workspace/inspector/spotAnnotationInspectorSections.tsx`.
  Existing spot elevation tests continue to cover the main editor controls, and
  `spotAnnotationInspector.test.tsx` covers coordinate and slope annotation
  delegation. Local `wc -l` now reports `InspectorContent.tsx` at `6,133`
  lines; scorecard confirmation is blocked until the unrelated parallel deletion
  of `packages/web/src/plan/ImageTraceDropZone.tsx` is resolved.
- 2026-05-20: the next `GFR-2026-01` slice moved the interior elevation marker
  inspector branch into
  `packages/web/src/workspace/inspector/interiorElevationMarkerInspectorSection.tsx`.
  Existing `interiorElevationInspector.test.tsx` coverage protects the extracted
  level, radius, and quadrant controls.
- 2026-05-20: the next `GFR-2026-01` slice moved mass generation actions and
  detail-group edit rows into
  `packages/web/src/workspace/inspector/modelingActionInspectorSections.tsx`.
  Existing group edit coverage protects the detail-group branch, and
  `massInspector.test.tsx` covers the mass action buttons.
- 2026-05-20: the same closeout pass moved viewpoint, elevation view, and
  callout read-only rows into
  `packages/web/src/workspace/inspector/viewReferenceInspectorSections.tsx` so
  `InspectorContent.tsx` can cross the below-6k target.
- 2026-05-20: `GFR-2026-01` is Done. Local `wc -l` reports
  `InspectorContent.tsx` at `5,996` lines, and focused inspector tests plus
  `pnpm --filter @bim-ai/web typecheck` pass. The generated scorecard can be
  rerun after the unrelated parallel deletion of
  `packages/web/src/plan/ImageTraceDropZone.tsx` is resolved.
- 2026-05-20: `GFR-2026-02` moved to Partial. The first PlanCanvas slice moved
  transient tool chips, guide SVGs, numeric input, snap override, and scale
  instruction overlays into `packages/web/src/plan/PlanCanvasToolOverlays.tsx`
  with focused component coverage in `PlanCanvasToolOverlays.test.tsx`.
- 2026-05-20: `GFR-2026-02` is Done. Local `wc -l` reports
  `PlanCanvas.tsx` at `8,468` lines, below the `8,500` target. The focused
  overlay test and `pnpm --filter @bim-ai/web typecheck` pass.
