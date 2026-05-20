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
| 1    | `packages/web/src/plan/PlanCanvas.tsx`                      | 8,468 | frontend-plan      | Input, preview, selection, render orchestration |
| 2    | `packages/cli/cli.mjs`                                      | 6,735 | cli-contracts      | CLI command dispatch and evidence workflows     |
| 3    | `app/bim_ai/api/registry.py`                                | 6,249 | backend-api        | API descriptor registry                         |
| 4    | `packages/web/src/workspace/inspector/InspectorContent.tsx` | 5,740 | frontend-inspector | Element-kind switchboard and editors            |
| 5    | `packages/web/src/workspace/Workspace.tsx`                  | 5,987 | frontend-workspace | Shell, tabs, dialogs, command routing           |
| 6    | `packages/web/src/Viewport.tsx`                             | 5,287 | frontend-viewport  | Scene lifecycle, picking, overlays              |
| 7    | `packages/core/src/index.ts`                                | 5,301 | core-contracts     | Public type and command barrel                  |
| 8    | `scripts/audit-ui-mcp-parity.mjs`                           | 4,663 | quality-tooling    | Audit orchestration                             |
| 9    | `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`   | 4,313 | frontend-family    | Family editor shell and state orchestration     |

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

| ID          | Priority | Status | File                                                        | Target slice                                                       | Exit signal                                                 |
| ----------- | -------- | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| GFR-2026-01 | P0       | Done   | `packages/web/src/workspace/inspector/InspectorContent.tsx` | Continue extracting self-contained element-kind inspector sections | Inspector below `6,000` LOC with focused tests passing.     |
| GFR-2026-02 | P0       | Done   | `packages/web/src/plan/PlanCanvas.tsx`                      | Extract pointer/keyboard or overlay controllers                    | PlanCanvas below `8,500` LOC with plan tests passing.       |
| GFR-2026-03 | P1       | Done   | `packages/web/src/workspace/Workspace.tsx`                  | Extract dialog/modal and command-routing controllers               | Workspace below `6,000` LOC with workspace tests passing.   |
| GFR-2026-04 | P1       | Done   | `packages/cli/cli.mjs`                                      | Extract command groups and report writers                          | CLI below `6,000` LOC with CLI smoke/tests passing.         |
| GFR-2026-05 | P1       | Done   | `packages/web/src/Viewport.tsx`                             | Extract scene lifecycle, HUD, and picking hooks                    | Viewport below `5,500` LOC with viewport tests passing.     |
| GFR-2026-06 | P1       | Done   | `app/bim_ai/api/registry.py`                                | Split descriptor groups without changing public registry output    | Registry below `5,500` LOC with descriptor tests passing.   |
| GFR-2026-07 | P2       | Done   | `scripts/audit-ui-mcp-parity.mjs`                           | Extract report formatting and audit collectors                     | Audit script below `5,000` LOC with syntax checks green.    |
| GFR-2026-08 | P2       | Done   | `packages/core/src/index.ts`                                | Move remaining thematic type clusters behind public re-exports     | Core barrel below `5,000` LOC with typecheck passing.       |
| GFR-2026-09 | P2       | Done   | `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`   | Extract self-contained family editor panels                        | Workbench below `4,500` LOC with focused tests passing.     |
| GFR-2026-10 | P2       | Done   | `packages/web/src/tools/toolGrammar.ts`                     | Extract late-stage reducer groups                                  | Tool grammar below `4,000` LOC with focused tests passing.  |
| GFR-2026-11 | P2       | Done   | `packages/web/src/viewport/meshBuilders.ts`                 | Extract family/detail mesh helpers                                 | Mesh builders below `4,000` LOC with focused tests passing. |
| GFR-2026-12 | P0       | Done   | `packages/web/src/plan/PlanCanvas.tsx`                      | Continue extracting presentational overlays and controllers        | PlanCanvas below `8,000` LOC with plan tests passing.       |
| GFR-2026-13 | P0       | Done   | `packages/web/src/plan/PlanCanvas.tsx`                      | Continue extracting wall/context HUD and query overlays            | PlanCanvas below `7,500` LOC with plan tests passing.       |
| GFR-2026-14 | P1       | Done   | `packages/web/src/plan/PlanCanvas.tsx`                      | Extract projection sync, camera, and interaction controller hooks  | PlanCanvas below `7,000` LOC with plan tests passing.       |
| GFR-2026-15 | P1       | Done   | `packages/web/src/plan/PlanCanvas.tsx`                      | Continue extracting annotation render passes                       | PlanCanvas below `6,600` LOC with plan tests passing.       |
| GFR-2026-16 | P1       | Done   | `packages/web/src/plan/PlanCanvas.tsx`                      | Extract crop and column-at-grids render passes                     | PlanCanvas below `6,500` LOC with focused plan tests green. |

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
- 2026-05-20: `GFR-2026-03` is Done. Local `wc -l` reports
  `Workspace.tsx` at `5,992` lines, below the `6,000` target. The slice moved
  the dialog/modal stack into `packages/web/src/workspace/WorkspaceOverlays.tsx`
  and the shell header/canvas/footer slots into
  `packages/web/src/workspace/WorkspaceAppShellSlots.tsx`.
  `pnpm --filter @bim-ai/web typecheck` passes; focused workspace tests are
  tracked in the verification notes for the commit.
- 2026-05-20: `GFR-2026-05` is Done. Local `wc -l` reports
  `Viewport.tsx` at `5,470` lines, below the `5,500` target. The slice moved
  the ViewCube, walk hints, section-box badge, sky/render buttons, saved-view
  lock badges, and transient 3D authoring cursor overlays into
  `packages/web/src/viewport/ViewportOverlays.tsx`.
- 2026-05-20: follow-up `GFR-2026-05` reduction moved viewer runtime helpers,
  section-box handle placement, disposal, and CSG wall footprint helpers into
  `packages/web/src/viewport/ViewportRuntimeHelpers.ts`. Local `wc -l` now
  reports `Viewport.tsx` at `5,287` lines. `pnpm --filter @bim-ai/web
typecheck` and focused viewport tests pass.
- 2026-05-20: `GFR-2026-07` is Done. Local `wc -l` reports
  `scripts/audit-ui-mcp-parity.mjs` at `4,663` lines, below the `5,000`
  target. The slice moved constants to
  `scripts/audit-ui-mcp-parity.config.mjs`, SKB readiness collection to
  `scripts/audit-ui-mcp-parity.readiness.mjs`, and JSON/Markdown report
  writing to `scripts/audit-ui-mcp-parity.reports.mjs`. `node --check` passes
  for all four modules. The full generator currently reaches audit validation
  and then fails on existing M3 route-mismatch gates for
  `author.stair_between_levels`, `opening.shaft_opening`, and
  `opening.slab_opening`, so the tracker records the narrower syntax gate for
  this mechanical split.
- 2026-05-20: `GFR-2026-09` is Done. Local `wc -l` reports
  `FamilyEditorWorkbench.tsx` at `4,313` lines, below the `4,500` slice target.
  The family types dialog, material default editor, array draft panel, and sweep
  sketch panels now live in
  `packages/web/src/familyEditor/FamilyEditorWorkbenchPanels.tsx`.
  `pnpm --filter @bim-ai/web typecheck` and focused family editor Vitest
  coverage pass.
- 2026-05-20: `GFR-2026-10` is Done. Local `wc -l` reports
  `packages/web/src/tools/toolGrammar.ts` at `3,785` lines, below the `4,000`
  A-territory threshold. Ramp, graded-region, terrain-split, stair
  sketch/component, wall-profile, detail drafting, family swept-blend, and cut
  geometry reducers now live in
  `packages/web/src/tools/toolGrammarSiteDetail.ts` and are re-exported through
  `toolGrammar.ts`. `pnpm --filter @bim-ai/web typecheck` and focused reducer
  tests pass.
- 2026-05-20: `GFR-2026-11` is Done. Local `wc -l` reports
  `packages/web/src/viewport/meshBuilders.ts` at `3,949` lines, below the
  `4,000` A-territory threshold. Excavation, family extrusion/revolve/void,
  spot-elevation label, and model-line helpers now live in
  `packages/web/src/viewport/meshBuilders.familyDetail.ts` and are re-exported
  through `meshBuilders.ts`. `pnpm --filter @bim-ai/web typecheck` and focused
  mesh tests pass.
- 2026-05-20: follow-up `GFR-2026-01` reduction moved project settings and plan
  region editors into
  `packages/web/src/workspace/inspector/projectSettingsInspectorSection.tsx`.
  Local `wc -l` now reports `InspectorContent.tsx` at `5,740` lines.
  `pnpm --filter @bim-ai/web typecheck` and
  `InspectorContent.test.tsx` pass.
- 2026-05-20: `GFR-2026-12` started by moving pinned-element glyphs, loop-mode
  cursor chip, boundary validation banner, and component placement preview
  wrapper into `packages/web/src/plan/PlanCanvasStatusOverlays.tsx`. Local
  `wc -l` now reports `PlanCanvas.tsx` at `8,345` lines. `pnpm --filter
@bim-ai/web typecheck` and focused PlanCanvas overlay/readout source tests
  pass.
- 2026-05-20: the next `GFR-2026-12` slice moved measure readout chips and
  multi-selection filter controls into
  `packages/web/src/plan/PlanCanvasWorkflowOverlays.tsx`. Local `wc -l` now
  reports `PlanCanvas.tsx` at `8,202` lines. `pnpm --filter @bim-ai/web
typecheck` and focused workflow/tool/readout PlanCanvas tests pass.
- 2026-05-20: `GFR-2026-12` is Done. The final slice moved reveal-hidden,
  text/leader annotation entry, cut-plane, subdivision palette, and room-colour
  legend overlays into `packages/web/src/plan/PlanCanvasAuthoringOverlays.tsx`
  and `packages/web/src/plan/PlanCanvasRoomColorLegend.tsx`. Local `wc -l`
  reports `PlanCanvas.tsx` at `7,993` lines. `pnpm --filter @bim-ai/web
typecheck` and focused PlanCanvas overlay tests pass.
- 2026-05-20: `GFR-2026-13` started by moving the coordinate HUD, wall pick-line
  preview, wall placement HUD, wall draft notice, and snap label into
  `packages/web/src/plan/PlanCanvasWallDraftOverlays.tsx`. Local `wc -l` now
  reports `PlanCanvas.tsx` at `7,935` lines. `pnpm --filter @bim-ai/web
typecheck` and focused PlanCanvas overlay tests pass.
- 2026-05-20: the next `GFR-2026-13` slice moved wall/canvas/element context
  menus, reveal-hidden actions, imported-CAD query overlays, and wall-join menu
  UI into `packages/web/src/plan/PlanCanvasContextOverlays.tsx`. Local `wc -l`
  now reports `PlanCanvas.tsx` at `7,743` lines. `pnpm --filter @bim-ai/web
typecheck` and focused PlanCanvas context/overlay tests pass.
- 2026-05-20: `GFR-2026-13` is Done. The closeout slice moved plan view
  controls, sketch overlay wiring, view/color-scheme state derivation,
  component preview lookup, empty-state overlay, and selection temp-dim/grip
  derivation into focused plan modules. Local `wc -l` reports
  `PlanCanvas.tsx` at `7,499` lines. `pnpm --filter @bim-ai/web typecheck` and
  focused PlanCanvas tests pass.
- 2026-05-20: `GFR-2026-14` started by moving the server plan-projection wire
  fetch/reset/readout synchronization effect into
  `packages/web/src/plan/usePlanProjectionWireSync.ts`. Local `wc -l` now
  reports `PlanCanvas.tsx` at `7,450` lines. Focused PlanCanvas and wire
  primitive tests pass; `pnpm --filter @bim-ai/web typecheck` passes.
- 2026-05-20: the next `GFR-2026-14` slice moved snap-line syncing, tool-exit
  readout resets, query/wall cleanup, component ghost cleanup, and context-menu
  outside-click effects into
  `packages/web/src/plan/usePlanCanvasToolCleanupEffects.ts`. Local `wc -l` now
  reports `PlanCanvas.tsx` at `7,408` lines. Focused PlanCanvas tests pass;
  `pnpm --filter @bim-ai/web typecheck` passes.
- 2026-05-20: the next `GFR-2026-14` slice moved camera resize/fit snapshot
  handling into `packages/web/src/plan/usePlanCanvasCameraControls.ts` and
  Three renderer/scene setup into
  `packages/web/src/plan/usePlanCanvasSceneLifecycle.ts`. Local `wc -l` now
  reports `PlanCanvas.tsx` at `7,320` lines. Focused PlanCanvas tests pass;
  `pnpm --filter @bim-ai/web typecheck` passes.
- 2026-05-20: `GFR-2026-14` is Done. The closeout slice moved the neighborhood
  mass, drafting grid, DXF underlay, masking region, plan-region, and area-plan
  render passes into `packages/web/src/plan/planCanvasRenderPasses.ts`; the
  camera hook now also owns world-mm to screen-px projection. Local `wc -l`
  reports `PlanCanvas.tsx` at `6,996` lines. Focused PlanCanvas tests pass;
  `pnpm --filter @bim-ai/web typecheck` passes.
- 2026-05-20: `GFR-2026-15` is Done. The slice moved detail-component and
  placed-tag annotation render passes into
  `packages/web/src/plan/planCanvasRenderPasses.ts`. Local `wc -l` reports
  `PlanCanvas.tsx` at `6,597` lines. Focused PlanCanvas tests pass;
  `pnpm --filter @bim-ai/web typecheck` passes.
- 2026-05-20: after `GFR-2026-04`, the remaining open rows
  (`GFR-2026-06` and `GFR-2026-08`) both touched files with unrelated
  uncommitted parallel-agent changes (`app/bim_ai/api/registry.py` and
  `packages/core/src/index.ts`). Continue those rows carefully so tracker
  commits do not accidentally include unrelated work.
- 2026-05-20: `GFR-2026-04` is Done. The slice moved sketch phase apply/run,
  evidence collection, initiation-run evidence packaging, bundle application,
  and JSON artifact helpers into
  `packages/cli/lib/sketch-phase-workflows.mjs`. Current worktree `wc -l`
  reports `packages/cli/cli.mjs` at `5,539` lines; the staged commit preserves
  the unrelated pre-existing trace-command deletion outside this commit, so the
  committed CLI remains below the `6,000` LOC target. `node --check` passes for
  the CLI entrypoint and extracted workflow module. Focused CLI initiation/link
  tests pass. The full `@bim-ai/cli` test suite still fails on pre-existing
  missing `seed-artifacts/target-house-1` fixtures.
- 2026-05-20: `GFR-2026-08` is Done. The slice moved job/comment/markup,
  activity, asset-library, kitchen-kit, material, image asset, and decal public
  types into `packages/core/src/resources.ts` while preserving re-exports from
  `packages/core/src/index.ts`. Current worktree `wc -l` reports
  `index.ts` at `4,936` lines; the staged commit preserves the unrelated
  pre-existing `StructuredLayout` removal outside this commit, so the committed
  barrel remains below the `5,000` LOC target. `pnpm --filter @bim-ai/core
typecheck` and `pnpm --filter @bim-ai/web typecheck` pass.
- 2026-05-20: `GFR-2026-06` is Done. The slice moved the toposolid, site,
  comparison/catalog, family/assets/materials, site context, material PBR, and
  sketch descriptor groups into `app/bim_ai/api/descriptors/*`, preserving the
  existing registration order through imported descriptor modules. The exact
  staged registry file for this commit is `4,723` lines and imports `127` tools;
  the dirty worktree still reports `5,481` lines because unrelated
  parallel-agent registry additions are intentionally left unstaged. Ruff
  format/check passes for the registry and descriptor modules; the focused
  descriptor suite passes with the coverage gate disabled (`116 passed`). The
  same focused tests without `--no-cov` executed all `116` tests successfully
  but failed the repository-wide coverage threshold, so the no-cov run is the
  slice-level signal.
- 2026-05-20: `GFR-2026-16` is Done. The slice moved crop-region overlay
  drawing, crop visibility filtering, and column-at-grids highlight/intersection
  drawing into `packages/web/src/plan/planCanvasRenderPasses.ts`. Local `wc -l`
  reports `packages/web/src/plan/PlanCanvas.tsx` at `6,448` lines. Focused
  crop/column/PlanCanvas tool tests pass (`60 passed`), and
  `pnpm --filter @bim-ai/web typecheck` passes.
