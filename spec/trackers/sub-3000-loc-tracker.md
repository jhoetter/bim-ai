# BIM AI - Sub-3000 LOC God File Tracker

Last updated: 2026-05-22

Purpose: take the remaining hand-written source files below **3,000 LOC**
(ideally well under). The predecessor `spec/archive/god-file-reduction-tracker.md`
closed at a 4,000 LOC A-territory bar; this tracker raises the standard.

This tracker is the active successor for ongoing god-file reduction. The main
`spec/archive/code-quality-tracker.md` remains at B / 8.0 with all CQ rows Done.

Source-of-truth size query:

```bash
node scripts/code-quality-report.mjs --json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f'{r[\"lines\"]:>5}  {r[\"path\"]}') for r in d['maintainability']['largestFiles'][:25]]"
```

## Current Baseline (2026-05-22)

The generated scorecard now flags a regression:

```
largest source file app/bim_ai/routes_api.py has 4745 lines and exceeds the 3950 line growth cap
```

This was caused by ~20 recent reverse-BIM commits adding routes to
`routes_api.py` directly instead of extending the extracted
`routes_query_resolve.py` / `routes_presentation.py` pattern.

Files at or above 3,000 LOC at tracker start:

| Rank | File                                                         | Lines | Notes                                                                            |
| ---: | :----------------------------------------------------------- | ----: | :------------------------------------------------------------------------------- |
|    1 | `app/bim_ai/routes_api.py`                                   | 4,745 | Reverse-BIM/source/QA cluster grew this back from 3,753.                         |
|    2 | `packages/web/src/Viewport.tsx`                              | 3,830 | 3D viewport shell.                                                               |
|    3 | `packages/web/src/plan/PlanCanvas.tsx`                       | 3,798 | Plan interaction shell.                                                          |
|    4 | `packages/web/src/viewport/meshBuilders.ts`                  | 3,777 | Mesh builder collection.                                                         |
|    5 | `packages/cli/cli.mjs`                                       | 3,723 | CLI dispatch entrypoint.                                                         |
|    6 | `app/bim_ai/elements.py`                                     | 3,715 | Element model aggregator.                                                        |
|    7 | `packages/web/src/workspace/inspector/InspectorContent.tsx`  | 3,679 | Inspector switchboard.                                                           |
|    8 | `scripts/audit-ui-mcp-parity.mjs`                            | 3,623 | Audit orchestration.                                                             |
|    9 | `packages/web/src/cmdPalette/defaultCommands.ts`             | 3,621 | Default command catalogue (registry).                                            |
|   10 | `packages/web/src/tools/toolGrammar.ts`                      | 3,603 | Tool grammar reducer module.                                                     |
|   11 | `packages/web/src/workspace/commandCapabilities.ts`          | 3,560 | Workspace command capability map (registry).                                     |
|   12 | `packages/web/src/workspace/project/ProjectBrowser.tsx`      | 3,546 | Project browser shell.                                                           |
|   13 | `app/bim_ai/commands.py`                                     | 3,510 | Command schema aggregator.                                                       |
|   14 | `packages/core/src/index.ts`                                 | 3,387 | Public barrel (re-export facade).                                                |
|   15 | `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`    | 3,341 | Family editor shell.                                                             |
|   16 | `packages/web/src/workspace/Workspace.tsx`                   | 3,293 | Workspace shell.                                                                 |
|   17 | `app/bim_ai/api/registry.py`                                 | 3,268 | API descriptor registry.                                                         |
|   18 | `app/bim_ai/model_integrity.py`                              | 3,149 | Model integrity validation.                                                      |
|   19 | `packages/web/src/workspace/WorkspaceRightRail.tsx`          | 3,015 | Workspace side rail.                                                             |

Watch zone (2,500-3,000 LOC) so they do not cross 3,000:

- `packages/cli/lib/sketch-initiation.mjs` 2,926
- `app/bim_ai/folder_output.py` 2,821
- `packages/web/src/plan/symbology.ts` 2,721
- `packages/web/src/plan/planElementMeshBuilders.ts` 2,563
- `app/bim_ai/export_gltf.py` 2,503

## Operating Rules

- One file at a time. Narrow, focused extractions.
- Before staging, check `git status` and only add the files you touched; never
  `git add -A` or `git add .` (parallel agents may have unrelated changes).
- For each slice:
  1. Identify a cohesive, stable cluster (route group, reducer family,
     inspector branch, render pass, etc.).
  2. Extract to a new sibling module.
  3. Preserve the original public surface via re-exports where downstream
     callers might depend on the original location.
  4. Run focused tests for the affected area.
  5. Commit specific file paths.
- Preserve existing public API paths exactly (URLs, function names,
  type exports). Internal refactors only.
- Update the tracker work-package status as each slice lands.

## Targets

Slice-level exit signal: file below **3,000 LOC**.

A-territory bar after the sweep:

- no hand-written source file above **3,000 LOC** (any kind).
- watch-zone files do not grow above 3,000 LOC.
- after the sweep, tighten `sourceGrowthBudget.maxLargestSourceLines` in
  `spec/governance/code-quality-budgets.json` to `2,950`.

## Work Packages

| ID            | Priority | Status  | File                                                         | Target slice                                                          | Exit signal                                                |
| :------------ | :------- | :------ | :----------------------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------- |
| SLC-2026-01   | P0       | Done    | `app/bim_ai/routes_api.py`                                   | Extract reverse-BIM + source + reverse-BIM-QA routes                  | Routes API below 3,500 LOC.                                |
| SLC-2026-02   | P0       | Done    | `app/bim_ai/routes_api.py`                                   | Extract IFC/DXF, sharing, and v3-meta routes                          | Routes API below 3,000 LOC.                                |
| SLC-2026-03   | P1       | Done    | `packages/web/src/Viewport.tsx`                              | Extract 3D direct-authoring tool helpers + click dispatcher           | Viewport below 3,000 LOC.                                  |
| SLC-2026-04   | P1       | Done    | `packages/web/src/plan/PlanCanvas.tsx`                       | Extract the giant `onClick` tool-click dispatcher                     | PlanCanvas below 3,000 LOC.                                |
| SLC-2026-05   | P1       | Done    | `packages/web/src/viewport/meshBuilders.ts`                  | Extract roof-geometry builder helpers                                 | meshBuilders below 3,000 LOC.                              |
| SLC-2026-06   | P1       | Done    | `packages/cli/cli.mjs`                                       | Extract agent-api + initiation/export CLI commands                    | cli.mjs below 3,000 LOC.                                   |
| SLC-2026-07   | P1       | Done    | `app/bim_ai/elements.py`                                     | Extract annotations, constructability, links                          | elements.py below 3,000 LOC.                               |
| SLC-2026-08   | P1       | Done    | `packages/web/src/workspace/inspector/InspectorContent.tsx`  | Extract column / beam / stair inspector sections                      | InspectorContent below 3,000 LOC.                          |
| SLC-2026-09   | P2       | Done    | `scripts/audit-ui-mcp-parity.mjs`                            | Extract M3/M4 workstream builders                                     | Audit script below 3,000 LOC.                              |
| SLC-2026-10   | P1       | Done    | `packages/web/src/cmdPalette/defaultCommands.ts`             | Split Display/extras palette commands                                 | defaultCommands below 3,000 LOC.                           |
| SLC-2026-11   | P1       | Done    | `packages/web/src/tools/toolGrammar.ts`                      | Extract annotation reducer cluster                                    | toolGrammar below 3,000 LOC.                               |
| SLC-2026-12   | P1       | Done    | `packages/web/src/workspace/commandCapabilities.ts`          | Split NAVIGATION + SYSTEM capability arrays                           | commandCapabilities below 3,000 LOC.                       |
| SLC-2026-13   | P1       | Done    | `packages/web/src/workspace/project/ProjectBrowser.tsx`      | Extract ProjectBrowserV3 to its own module                            | ProjectBrowser below 3,000 LOC.                            |
| SLC-2026-14   | P1       | Done    | `app/bim_ai/commands.py`                                     | Extract annotation + late command schemas                             | commands.py below 3,000 LOC.                               |
| SLC-2026-15   | P2       | Done    | `packages/core/src/index.ts`                                 | Extract MEP / structural / annotation element variants                | core/index below 3,000 LOC.                                |
| SLC-2026-16   | P1       | Done    | `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`    | Extract aligned-dimensions + parameters editor sections               | Workbench below 3,000 LOC.                                 |
| SLC-2026-17   | P1       | Done    | `packages/web/src/workspace/Workspace.tsx`                   | Extract hotkeys / default-tab / undo-redo / array-formula helpers     | Workspace below 3,000 LOC.                                 |
| SLC-2026-18   | P1       | Done    | `app/bim_ai/api/registry.py`                                 | Extract OUT-V3-02/03 + EXP-V3-01 descriptor group                     | registry.py below 3,000 LOC.                               |
| SLC-2026-19   | P1       | Done    | `app/bim_ai/model_integrity.py`                              | Extract v1 contract/evidence emitters                                 | model_integrity below 3,000 LOC.                           |
| SLC-2026-20   | P2       | Done    | `packages/web/src/workspace/WorkspaceRightRail.tsx`          | Extract wall command helpers                                          | WorkspaceRightRail below 3,000 LOC.                        |
| SLC-2026-21   | P3       | Done    | `spec/governance/code-quality-budgets.json`                             | Tighten `maxLargestSourceLines` from 3,950 to 3,000                   | Budget config enforces the new sub-3000 bar (2,950 deferred — would block commands.py at 2,996). |

## Progress Log

- 2026-05-22: tracker created. The committed baseline shows 19 hand-written
  files at or above 3,000 LOC, with `app/bim_ai/routes_api.py` at 4,745 LOC
  exceeding the existing 3,950 LOC growth cap and triggering a
  blockersToNextGrade entry in the generated scorecard.
- 2026-05-22: `SLC-2026-01` moved to Partial. The first slice extracted the
  source ingestion (`/api/v3/source/*`) and the non-hybrid-execute reverse-BIM
  (`/api/v3/reverse-bim/*`, `/api/v3/qa/*`) routes into
  `app/bim_ai/routes_reverse_bim.py`. Unused imports left over from the moved
  routes were trimmed in `routes_api.py`. Local `wc -l` reports
  `routes_api.py` at `3,915` lines, down from `4,745`. Python compile, ruff,
  and the focused `test_reverse_bim_source_ingestion`,
  `test_reverse_bim_acceptance_evidence`, `test_source_coordinate_frames`, and
  `test_hybrid_reverse_bim` suites all pass. The hybrid-slice-execute and
  hybrid-run-execute routes remain in `routes_api.py` because they call into
  the bundle apply path defined later in the same file; they will move when
  the bundle apply path is itself extracted.
- 2026-05-22: `SLC-2026-01` and `SLC-2026-02` are Done. Three more route
  modules were extracted from `routes_api.py`:
  - `routes_imports.py` owns IFC/DXF/DWG import + upload + material-asset
    validation (~496 lines moved).
  - `routes_sharing.py` owns role management, public-link, and shared-token
    routes (~352 lines moved); the cross-module helpers `resolve_caller_role`
    and `resolve_token_role` migrated to `routes_deps.py`.
  - `routes_v3_meta.py` owns v3 visual compare, SKB checkpoint, tool registry,
    advisor rules, command schema, and version routes (~120 lines moved).
  Local `wc -l` reports `routes_api.py` at `2,909` lines, below the 3,000
  ceiling. Python compile and ruff are clean across all touched modules.
  Focused tests pass for `test_ifc_shadow_import`,
  `test_material_image_assets`, `test_permissions`, `test_out_v3_01`,
  `test_public_links_route`, `test_api_v3_registry` (the descriptor parity
  failure for `reverse_bim.exterior_view_create` and three siblings is
  pre-existing parallel-agent work — those descriptors were declared without
  matching routes before this slice), `test_command_schemas`, and
  `test_vg_v3_01`.
- 2026-05-22: ten files now sit below the 3,000 LOC ceiling:
  - `routes_api.py` (2,909), `api/registry.py` (2,946), `commands.py` (2,989),
    `elements.py` (2,931), `model_integrity.py` (2,893): backend extractions
    via new sibling modules (`routes_imports`, `routes_sharing`,
    `routes_v3_meta`, `routes_reverse_bim`; `commands_annotations`,
    `commands_late`; `elements_annotations`, `elements_constructability`,
    `elements_links`; `model_integrity_v1_reports`; descriptors/output_export).
    All re-exports are kept for legacy callers; focused Python tests pass.
  - `cli.mjs` (2,833): agent-api + initiation/export extracted to
    `lib/agent-api-commands.mjs` and `lib/initiation-export-commands.mjs`.
  - `defaultCommands.ts` (2,079): Display-settings-onwards palette
    registrations moved to `defaultCommandsDisplayAndExtras.ts`. Helpers
    `is3dContext`, `hasSelection`, `hasActivePlanView`, etc. now exported
    from `defaultCommands.ts`.
  - `toolGrammar.ts` (2,648): annotation/array/scale/roof-by-extrusion/
    revision-cloud/decal reducers moved to `toolGrammarAnnotation.ts` with
    a side-effect `export *` re-export.
  - `commandCapabilities.ts` (2,647): `NAVIGATION_CAPABILITIES` and
    `SYSTEM_CAPABILITIES` drafts moved to
    `commandCapabilitiesNavSystem.ts`. The private
    `CommandCapabilityDraft` type is now exported.
  - `WorkspaceRightRail.tsx` (2,944): five wall command builders moved to
    `workspaceRightRailWallCommands.ts`.
- 2026-05-22: nine files still above 3,000 LOC at session end. They need
  more careful hook/component extractions and are deferred to a follow-up
  pass:
  - `Viewport.tsx` (3,829), `PlanCanvas.tsx` (3,797), `meshBuilders.ts`
    (3,776), `ProjectBrowser.tsx` (3,769 — grew during this session via
    parallel agents), `InspectorContent.tsx` (3,678),
    `audit-ui-mcp-parity.mjs` (3,622), `core/src/index.ts` (3,386),
    `FamilyEditorWorkbench.tsx` (3,340), `Workspace.tsx` (3,292).
  - These remaining files mostly have inline closure functions that capture
    component-local state (Workspace.tsx, FamilyEditorWorkbench.tsx,
    PlanCanvas.tsx, Viewport.tsx, InspectorContent.tsx,
    ProjectBrowser.tsx) — extracting them safely requires defining the
    captured-state surface explicitly, which is a longer task.
  - `meshBuilders.ts` and `core/src/index.ts` are mostly contiguous type
    or geometry definitions that need split-by-domain extractions (similar
    to the elements.py work). `audit-ui-mcp-parity.mjs` has many
    cross-function helper references.
- 2026-05-22: scorecard regression cleared. `app/bim_ai/routes_api.py` was
  the only file flagged in `blockersToNextGrade` (over the 3,950 growth
  cap). It is now at 2,909 LOC, so `pnpm quality:report` no longer
  reports a growth-cap blocker.
- 2026-05-22: end of follow-up sweep. Of the nine files flagged above
  3,000 LOC at tracker start, **seven are now under 3,000 LOC**
  (every P1 except `Viewport.tsx` and `PlanCanvas.tsx`). The two
  remaining files share the same shape — one ~2,650-3,000 line
  `useEffect` body holding the entire authoring state machine with
  closure-captured mutable locals (drag state, polygon draft, RAF
  flags, etc.). Surface-level extraction does not help here; the
  fix is a `useEffect` split (event listeners vs. scene mount vs.
  animation loop) or a reducer/state-machine extraction. Tracked
  as `SLC-2026-03` and `SLC-2026-04` for a later session.
- 2026-05-22: `SLC-2026-16` Done. `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`
  cut from 3,340 to 2,991 LOC by extracting two cohesive JSX sections
  out of the monolithic component into sibling files:
  - `FamilyEditorAlignedDimensionsSection.tsx` — the §13.x aligned
    dimensions panel (SVG canvas + dimension creation form + EQ
    constraint toolbar). Takes all needed state and handlers as
    props.
  - `FamilyEditorParametersSection.tsx` — the parameters editor
    table (Key / Label / Type / Default / Scope / Formula rows) plus
    the "+ Add parameter" button.
  `pnpm typecheck` is clean across all packages.
- 2026-05-22: late session re-shrink. Two files crept back over 3,000 LOC
  after parallel-agent landings of the TH-X-F006 source-view-evidence
  feature. Re-extracted to put them back under the bar:
  - `packages/core/src/index.ts`: 3,030 → 2,982 LOC. New
    `SourceViewEvidenceElement` (plus three pre-existing inline
    opening variants) moved to `elements/sourceViewEvidence.ts` and
    `elements/openings.ts`.
  - `app/bim_ai/commands.py`: 3,029 → 2,995 LOC. New
    `UpsertSourceViewEvidenceCmd` moved to `commands_late.py` and
    re-imported / re-exported by `commands.py`.
- 2026-05-22: `SLC-2026-13` Done. `packages/web/src/workspace/project/ProjectBrowser.tsx`
  cut from 3,811 to 2,496 LOC by extracting the `ProjectBrowserV3`
  component (and its private `CtxMenu` / `disciplineLabel` /
  `groupByDiscipline` helpers) into a new sibling
  `ProjectBrowserV3.tsx`. `ProjectBrowserSheetsGroup`,
  `ProjectBrowserLinksGroup`, and `ProjectBrowserLinkedIfcGroup` —
  shared by the legacy `ProjectBrowser` — are now exported so the V3
  module can import them. `ProjectBrowser.tsx` ends with
  `export { ProjectBrowserV3 } from './ProjectBrowserV3';` so every
  existing `from './ProjectBrowser'` import keeps working.
- 2026-05-22: `SLC-2026-08` Done. `packages/web/src/workspace/inspector/InspectorContent.tsx`
  cut from 3,678 to 2,932 LOC by extracting three element-inspector
  switch-cases out of the giant `InspectorPropertiesFor` function:
  - `ColumnInspectorSection` and `BeamInspectorSection` in a new
    `structuralInspectorSections.tsx` (combined: column + beam inline
    JSX, ~480 lines).
  - `StairInspectorSection` in a new `stairInspectorSection.tsx`
    (the multi-run stair inline JSX, ~310 lines).
  Each switch-case in `InspectorContent.tsx` becomes a single
  `<ColumnInspectorSection ... />` / `<BeamInspectorSection ... />` /
  `<StairInspectorSection ... />` render. `pnpm typecheck` is clean.
- 2026-05-22: `SLC-2026-17` Done. `packages/web/src/workspace/Workspace.tsx`
  cut from 3,292 to 2,973 LOC by extracting four cohesive helpers out of
  the monolithic component into sibling files:
  - `useWorkspaceHotkeys` — the global keyboard hotkey wiring (1–7 modes,
    V/W/D, ?, Cmd/Ctrl+K, Alt+2, Cmd/Ctrl+H/W/Z plus the 400 ms
    tool-hotkey + two-char chord palette). The `pendingChordRef` /
    `pendingChordTimerRef` refs moved inside the hook.
  - `useWorkspaceDefaultTab` — the after-hydrate prune + sensible-default
    tab effect, keyed by model id.
  - `updateArrayFormula` helper — the SCH-V3-01 catalog-array formula
    update path; only a thin `useCallback` wrapper remains in
    `Workspace.tsx`.
  - `runUndoRedo` helper — the active-model undo/redo apply + activity
    refresh + 409-conflict surface.
  Now-unused `modeForHotkey` and `cycleActive` imports are dropped.
  `pnpm typecheck` is clean across all packages.
- 2026-05-22: `SLC-2026-09` Done. `scripts/audit-ui-mcp-parity.mjs` cut from
  3,622 to 2,306 LOC by extracting the entire M3/M4 workstream-builder
  cluster (`buildM3Wave2`, `buildM3Wave3`, `buildM4Wave1`, plus the
  ~30 supporting workstream/gate helpers) into a new sibling
  `audit-ui-mcp-parity.workstreams.mjs`. The new module follows the
  existing config/evidence/readiness/reports split convention. Small
  shared utilities (`read`, `normalizedId`, `countBy`) are inlined to
  keep the new module self-contained. End-to-end smoke check confirms
  the produced audit JSON is byte-identical (modulo `generatedAt`
  timestamp) to the pre-refactor output.
- 2026-05-22: `SLC-2026-05` Done. `packages/web/src/viewport/meshBuilders.ts`
  cut from 3,776 to 2,854 LOC by extracting the entire roof-geometry
  builder cluster (`_buildGableGeometry`, `_buildAsymmetricGableGeometry`,
  `_buildHipGeometry`, `_buildHipPolygonGeometry`, `_buildLShapeGeometry`,
  `_buildAsymmetricGableGeometryWithRoofOpenings`, plus `_polygonAreaMm2`,
  `_convexHullAreaMm2`, `_compactnessRatio`) into a new sibling
  `viewport/roofGeometry.ts`. A local `_xzBoundsMm` mirrors the small
  bounds helper to avoid a circular import. `pnpm typecheck` and the
  roof-related vitest suites (`hipRoof`, `lShapeRoof`, `asymmetricRoof`,
  `coneRoof`) all pass.
- 2026-05-22: `SLC-2026-04` and `SLC-2026-21` Done. Plan canvas's
  ~1,971-line `onClick` tool-click dispatcher extracted from
  `packages/web/src/plan/PlanCanvas.tsx` into a new sibling
  `plan/planCanvasClickHandler.ts` via the same `args`-based factory
  pattern as `planCanvasKeyboardAuxHandlers.ts`. The new handler
  dispatches across all 64 plan tools (wall, dimension, elevation,
  copy/mirror/rotate/scale/array, paint, split, trim, wall-opening,
  shaft, column, stair, roof variants, etc.); the in-place
  `useEffect` now just calls `createPlanCanvasClickHandler({ ... })`
  with the THREE refs, per-tool state-machine refs, React state
  setters, and the snap/preview/pick helper closures. The behaviour
  is byte-identical to the inline version.
  - `PlanCanvas.tsx`: 3,797 → 1,897 LOC.
  - New `plan/planCanvasClickHandler.ts`: 2,454 LOC.
  - `pnpm --filter @bim-ai/web typecheck` is clean. All 515 plan +
    workspace + viewport vitest suites (3,867 tests) pass after
    updating the source-grep guard in
    `PlanCanvas.toolDestubs.test.ts` to also search the new module.
  - Now-unused imports trimmed from `PlanCanvas.tsx`.
  - `SLC-2026-21`: tightened `maxLargestSourceLines` in
    `spec/governance/code-quality-budgets.json` from `3,950` to `3,000`. The
    final hop to `2,950` is deferred — `app/bim_ai/commands.py` at
    `2,996` and three other watch-zone files would block at that
    cap. They need a follow-up shrink.
- 2026-05-22: `SLC-2026-03` Done. `packages/web/src/Viewport.tsx` cut from
  3,830 to 2,878 LOC by extracting the entire 3D direct-authoring cluster
  out of the giant mount-effect into a new sibling
  `viewport/direct3dToolHelpers.ts` via a session factory. Moved:
  - the click dispatcher `handle3dDirectToolClick` (~650 lines of
    door/window/wall-opening + line/polygon/column/room/component
    branching).
  - the hosted-opening preview math (`hostedPreviewSegment`,
    `clampHostedAlongT`, `hostedOpeningConflictFor`, `hostedToolSpec`).
  - the wall picker `pickWallAtPointer` and the level resolvers
    (`resolveDraftLevelInfo`, `resolveDraftLevels`).
  - the line-preview dispatcher `dispatchLinePreviewPayload`.
  The mutable closure lets (`lineDraftStart`, `polygonDraft`,
  `wallFlipNextSegment`, `hostPreviewLock`, two hosted-placement dedupe
  refs) became a single `Direct3dToolDraftState` object shared with
  the in-place pointer-move/key handlers. `pnpm --filter @bim-ai/web
  typecheck` and the 107 viewport vitest suites all pass. The
  `Viewport.authoringSource.test.ts` source-grep guard was updated to
  search both `Viewport.tsx` and the new helpers file.
- 2026-05-22: `SLC-2026-15` Done. `packages/core/src/index.ts` cut from
  3,386 to 2,997 LOC by extracting three element-variant clusters out of
  the giant `Element` discriminated union:
  - `elements/mep.ts`: `PipeElement`, `DuctElement`, `PipeLegendElement`,
    `DuctLegendElement`, `CableTrayElement`, `MepEquipmentElement`,
    `MepTerminalElement`, `FixtureElement`, `MepOpeningRequestElement`.
  - `elements/structural.ts`: `ColumnElement`, `BeamElement`,
    `SteelConnectionElement`, `BeamSectionProfileElement`,
    `BeamSystemElement`, `BraceElement`.
  - `elements/annotations.ts`: `PlacedTagElement`, `DetailLineElement`,
    `DetailArcElement`, `DetailFilledRegionElement`, `DetailRegionElement`,
    `TextNoteElement`, `AnnotationSymbolElement`, `LeaderTextElement`,
    `ColorFillLegendElement`, `Text3dElement`, `TextTagElement`.
  All new types are re-exported from `index.ts` so external imports remain
  unchanged. `pnpm typecheck` is clean across all packages.
