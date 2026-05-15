# WP-C — Vertical Circulation, Ramp, Multi-Storey Stair & Level Management

## Context

You are an orchestrating engineer on the bim-ai repository (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

Repo layout (critical paths):
- `packages/web/src/plan/StairBySketchCanvas.tsx` — existing stair-by-sketch UI
- `packages/web/src/plan/StairSketchEditor.tsx` — stair sketch editor
- `packages/web/src/plan/stairAutobalance.ts` — auto-balance stair run widths
- `packages/web/src/plan/stairPlanSymbol.ts` — stair plan symbol rendering
- `packages/web/src/viewport/meshBuilders.multiRunStair.ts` — 3D stair mesh
- `packages/web/src/viewport/meshBuilders.ts` — central 3D mesh dispatcher
- `packages/web/src/levels/LevelStack.tsx` — level management UI
- `packages/web/src/tools/toolRegistry.ts` — ToolId union + TOOL_REGISTRY array
- `packages/web/src/tools/toolGrammar.ts` — tool grammar
- `packages/core/src/` — shared Element types

Architecture patterns:
- Element data: elements stored as plain objects in the project model with a `type` discriminator (e.g. `'stair'`, `'wall'`, `'level'`).
- Semantic commands dispatch mutations: `{ type: 'createStair', ... }`, `{ type: 'createLevel', ... }`, etc.
- 3D meshes: `viewport/meshBuilders.ts` dispatches to sub-builders by element type. Study `meshBuilders.multiRunStair.ts` and `meshBuilders.hipRoof.ts` for the builder interface.
- Plan symbols: `plan/stairPlanSymbol.ts` is the pattern for plan-view 2D representations.
- Prettier runs automatically after every Edit/Write.
- Tests: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.

## Safe Parallel Work Rules

1. `git pull --rebase origin main` before starting each sub-task.
2. Commit + push after every completed sub-feature.
3. `git pull --rebase origin main && git push origin main` before each push.
4. Do NOT touch: annotation/dimension files, export files, phase dialogs, groups, structural beam/brace files, massing. Those belong to other WPs.
5. `toolRegistry.ts` is shared — always rebase before adding entries.

## Your Mission

Implement all vertical circulation and level-management features listed in the parity tracker. Chapters 8 (stairs/ramp/levels) and parts of Chapter 2 and 3. Dispatch sub-agents for parallel independent sub-tasks.

---

### Sub-task C1: Ramp Tool

This is a P0 gap. Ramps are sloped floor surfaces with an automatic railing on each open edge.

New ToolId: `'ramp'` (hotkey: `RA`)

Data model:
```
{
  type: 'ramp',
  id: string,
  levelId: string,           // base level
  topLevelId: string,        // top level (sets rise)
  widthMm: number,           // ramp width
  runMm: number,             // horizontal run length
  runAngleDeg: number,       // direction angle in plan
  insertionXMm: number,
  insertionYMm: number,
  hasRailingLeft: boolean,
  hasRailingRight: boolean,
  slopePercent: number,      // computed = rise/run * 100
  material: string,
}
```

Grammar (two modes, switch via options bar):
- "By Length": click insertion point, click endpoint. Ramp runs between those two points horizontally. Rise = topLevel.elevationMm - baseLevel.elevationMm.
- "By Sketch": draw a boundary (closed polygon) and a run line inside it (like the sketch-based stair).

3D mesh (`viewport/meshBuilders.ramp.ts`):
- A sloped flat surface (quad mesh) connecting base to top elevation over the run length.
- Side faces (vertical walls on the sides of the ramp surface).
- Railing along each open edge: reuse the existing railing mesh builder logic from `viewport/meshBuilders.ts` (railings are already implemented for stairs).
- Apply the ramp material to the top surface.

Plan symbol (`plan/rampPlanSymbol.ts`):
- Rectangle showing the plan footprint.
- Diagonal arrow lines pointing uphill (same convention as stair arrow).
- Text label showing slope percentage.

Inspector: widthMm, runMm, slopePercent (read-only computed), material, hasRailingLeft/Right, topLevelId.

Advisor integration: if slopePercent > 8.33 (1:12 accessibility max), emit a warning advisory.

Tests:
- `rampPlanSymbol.test.ts` — verify plan symbol geometry for a standard ramp
- `meshBuilders.ramp.test.ts` — verify 3D vertices include correct Z at top and bottom

### Sub-task C2: Multi-Storey Stair as a Single Element

Currently stairs are placed per-floor. Revit supports a stair that spans N levels as a single connected element.

Changes:
- Add `topLevelId: string` and `multiStorey: true` fields to the stair element.
- When `multiStorey` is true, the stair element is visually repeated on every intermediate level (run + landing) up to `topLevelId`.
- Grammar: after completing the first-floor stair sketch, prompt "Extend to level?" in the options bar. The user can pick a top level.
- 3D mesh: `meshBuilders.multiRunStair.ts` must accept the level count and stack run+landing geometry for each floor height.
- Plan symbol: on each level's plan view, show the stair symbol for that run segment (already partially done — ensure the plan projection clips the symbol to the view level).
- Schedule: the stair schedule (`schedules/stairScheduleEvidenceReadout.ts`) must list multi-storey stairs with their full height.

Tests: create a 3-storey stair, verify 3D mesh vertex count matches 3 × single-storey, verify plan symbol appears on each intermediate level.

### Sub-task C3: Complex Stair Completion (L-shape, U-shape, all configurations)

The existing `StairBySketchCanvas.tsx` and `stairAutobalance.ts` handle some configurations but not all. Audit and fix:

- L-shape (2 runs + 90° landing): ensure the sketch editor accepts an L-shaped boundary and generates correct geometry. Verify the 3D mesh builder handles non-rectangular landings.
- U-shape (3 runs + 2 landings): same audit.
- Winder stairs (triangular treads at the corner instead of a landing): add `winderAtCorner: boolean` option.
- Spiral stair (circular plan, constant rotation per tread): new stair type `'stair_spiral'` with `centrePtXMm, centrePtYMm, innerRadiusMm, outerRadiusMm, totalAngleDeg, treadCount`.

For the spiral stair:
- Plan symbol: concentric arcs + radial lines for each tread.
- 3D mesh: `meshBuilders.spiralStair.ts` — rotate each tread platform by `totalAngleDeg / treadCount` around the centre, with appropriate Z increment.

Tests for each configuration: verify no geometry gaps (normals correct, no open edges in the mesh).

### Sub-task C4: Attach Top/Base of Walls to Roof or Floor

Revit's "Attach Top/Base" command trims a wall so its top (or base) exactly follows the underside (or top) of a roof or floor.

- Add a selection action "Attach Top" (shown when ≥1 wall selected). Step 1: select walls. Step 2: click the roof or floor to attach to.
- Semantic command: `{ type: 'attachWallTop', wallId, roofId | floorId }`. The handler sets `topConstraint: { hostId, hostFace: 'bottom' }` on the wall element.
- The CSG/mesh system already handles wall trimming to roof geometry (`csgWallBaseGeometry.ts`, `wallCsgEligibility.ts`). The new command just sets the constraint relationship.
- "Detach Top/Base": clears the constraint.
- Visual: in the 3D view the wall silhouette follows the roof slope. In plan, the wall top line is shown as a dashed line at the cut height.

Tests: attach a gable-end wall to a hip roof, verify the wall mesh top vertices lie on the roof surface.

### Sub-task C5: Add Multiple Levels with Array (Level Array)

Currently levels are added one at a time. Implement a "Add N Levels" command.

- In `levels/LevelStack.tsx` add an "Add Multiple…" button (or right-click context on an existing level: "Add N Levels Above").
- Opens a small dialog: count (default 3), spacing (default 3000mm), name prefix (default "Ebene").
- Dispatches N `createLevel` commands sequentially: `{ type: 'createLevel', name: 'Ebene 3', elevationMm: baseElevation + spacing * i }`.
- Tests: add 4 levels at 2800mm spacing from EG, verify all 4 are created at correct elevations.

### Sub-task C6: Copy Elements to Clipboard + Paste Aligned to Selected Levels

Note: WP-B (B3) implements the actual `copyToLevels` command. This sub-task implements the clipboard capture side.

- `packages/web/src/clipboard/` — check what exists and extend it.
- Keyboard shortcut `Ctrl+C` on a selection: stores element IDs + their current level in the clipboard store.
- `Ctrl+V`: pastes at cursor (already exists or partially exists — verify and complete).
- "Paste Aligned to Selected Levels": opens a level picker, then dispatches `copyToLevels` (from WP-B). If WP-B is not yet merged, implement `copyToLevels` here.

### Sub-task C7: Stair Railing Completeness Pass

Ensure railings always auto-generate on stair sides and are correctly parented:

- When a stair is created, a `railing` element is auto-created for each open side (left, right) and its `hostStairId` is set.
- If the stair is moved/deleted, the railing moves/deletes with it.
- Railing can be independently modified (height, profile type) without breaking the stair link.
- Inspector on railing: `hostStairId` (read-only), `railingHeight`, `topRailProfile`, `balustradeSpacingMm`.
- Tests: create stair, verify railings are auto-created; delete stair, verify railings are also removed.

---

## Definition of Done

For each sub-task:
- TypeScript compiles without errors
- ≥2 unit tests per new module
- Feature visible in plan view and 3D view
- No regressions in existing stair/railing/level tests
- Tracker entry updated in `spec/revit-parity/revit2026-parity-tracker.md`
