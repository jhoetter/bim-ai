# Render ownership for the three monolith panes

PERF-K04 acceptance: "Each large pane documents which state it owns, which
selectors it consumes, and its expected render frequency."

This doc captures the current render-ownership boundary across `Workspace`,
`PlanCanvas`, and `Viewport`. It is the contract every PERF-G\* /
PERF-K\* migration should preserve or improve.

## Workspace.tsx (`packages/web/src/workspace/Workspace.tsx`)

- **State it owns:** mode/tab routing (`viewerMode`, `paneLayout.root`,
  `activeLevelId`, `activePlanViewId`), command palette open/close,
  dialog flags (`familyLibraryOpen`, `printPlotOpen`,
  `templatesOpen`, etc.), `selectedId` / `selectedIds`, the
  `onSemanticCommand` dispatcher, `pendingCommandCount` for the status bar.
- **Store reads it depends on today:**
  - `s.elementsById` (line 199) — **too broad**; the highest-leverage
    PERF-G03 target. Replacing with narrow selectors / `modelIndices`
    is on the immediate work plan.
  - `s.modelIndices.projectSettings` (via `useBimStore.getState()` inside
    command handlers — wired by PERF-G03 partial).
  - `s.activeLevelId`, `s.activePlanViewId`, `s.viewerMode`,
    `s.planTool` (each a narrow individual subscription — good).
  - `s.viewLocked`, `s.violations`, `s.groupRegistry`,
    `s.commandCapabilities` (narrow each, fine).
- **Expected render frequency:**
  - Today: every delta apply (because `elementsById` reference changes).
    That can easily exceed 1 render / second under authoring activity.
  - Target: at most once per *navigation* or *tool change* — the body
    derives from narrow selectors / `modelIndices` which only churn for
    the slices the workspace actually reads (e.g. `levels`, `sheets`,
    `planViews`).
- **Render-count probe:** `useRenderCount('Workspace')` (PERF-G07).
  Inspect via `window.__BIM_AI_RENDER_COUNTS__.Workspace` in dev.

## PlanCanvas.tsx (`packages/web/src/plan/PlanCanvas.tsx`)

- **State it owns:** Three.js renderer/scene/camera lifecycle for the 2D
  plan, pointer/drag/marquee state, current draft preview, crop drag
  state, snap settings.
- **Store reads it depends on today (heavy spots):**
  - `s.elementsById` is consumed transitively through
    `planCanvasClickHandler.ts` and the sibling hover/render-pass modules.
    Multiple `Object.values(elementsById)` scans remain on the hot click
    path (10+ sites; PERF-G04 target).
  - Narrow subscriptions: `s.selectedId`, `s.selectedIds`,
    `s.activePlanViewId`, `s.planTool`, `s.viewLocked`,
    `s.activeLevelId`.
- **Expected render frequency:**
  - Renderer mount: once per route mount.
  - React re-renders: should be once per *projection update* or *tool
    change* — pointer/drag motion is intentionally NOT triggering React
    renders (handled directly via Three.js refs).
- **Render-count probe:** `useRenderCount('PlanCanvas')` (PERF-G07).

## Viewport.tsx (`packages/web/src/Viewport.tsx`)

- **State it owns:** Three.js renderer/scene/camera lifecycle for the
  3D viewport, orbit/inertia/walk state, draft authoring overlay,
  sky background, render-quality settings.
- **Store reads it depends on today:**
  - `s.elementsById` (line 341, with a `ref` copy at line 344 so the
    mount-effect closure stays current without rebinding listeners).
    The ref-copy pattern is intentional — it lets the camera/pointer
    code read fresh element state without re-subscribing.
  - `s.modelIndices.projectSettings`, `s.modelIndices.levels` —
    narrowed via PERF-G05 (4 full-model `Object.values` scans removed).
  - Narrow: `s.selectedId`, `s.selectedIds`, `s.viewLocked`,
    `s.activeLevelId`, `s.planTool`, `s.splitViewEnabled`,
    `s.activeViewpointId`.
- **Render frequency contract:**
  - Renderer mount: once per route mount.
  - React re-renders: once per *level change*, *project_settings
    georeference change*, *selection change*, or *split-view toggle* —
    NOT per delta apply (that's why most lookups go through
    `useBimStore.getState()` inside the mount-effect closures).
  - Three.js render loop: demand-driven (PERF-I02). `tick()` re-arms
    `scheduleViewportRender` only while `shouldAnimateViewport()` is
    true (walk / drag / inertia). At idle, no frames are produced.
- **Render-count probe:** `useRenderCount('Viewport')` (PERF-G07).

## Why this contract matters

`elementsById` is the most-subscribed store slice in the codebase
(~1,358 `useBimStore` call sites today, of which the three monoliths
collectively dominate render time). Every broad subscription to
`elementsById` cascades to the entire pane on every authoring delta,
even single-element changes. The PERF-G02 `modelIndices` selectors
exist so consumers can read pre-built `levels`, `wallsByLevel`,
`openingsByWall`, `planViews`, `schedules`, `sheets`, `projectSettings`,
`roomsByLevel`, `selectableIds` slices that are reference-stable per
delta, and only churn when the relevant kind actually changes.

Adoption is incremental:

1. **PERF-G03**: Workspace migrates off broad `elementsById` toward
   `modelIndices.{levels,sheets,schedules,projectSettings,planViews}`.
2. **PERF-G04**: PlanCanvas + `planCanvasClickHandler.ts` migrate hot
   pointer paths to `modelIndices.{wallsByLevel,openingsByWall}` plus
   precomputed arrays for snapping/picking.
3. **PERF-G05**: Viewport hosted-opening conflict + ref-snap migrate
   to indices (georeference/levels already shipped).
4. **PERF-G06**: `useShallowSelector` is the canonical primitive for
   grouped selectors that return objects/tuples whose contents are
   reference-stable per delta.

Once those four land, this doc should evolve to assert explicit
per-pane render-count budgets (PERF-M04 layered on `useRenderCount`).
