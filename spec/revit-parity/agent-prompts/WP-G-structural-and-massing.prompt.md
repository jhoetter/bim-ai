# WP-G — Structural Completion & Conceptual Massing

## Context

You are an orchestrating engineer on the bim-ai repository (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

Repo layout (critical paths):
- `packages/web/src/tools/toolRegistry.ts` — ToolId union + TOOL_REGISTRY (add: brace, beam-system, column-at-grids, mass tools)
- `packages/web/src/viewport/meshBuilders.ts` — 3D mesh dispatcher (add entries for new element types)
- `packages/web/src/viewport/meshBuilders.mass.ts` — EXISTING mass mesh builder (study this first)
- `packages/web/src/viewport/meshBuilders.mass.test.ts` — mass tests
- `packages/web/src/plan/planProjection.ts` — 2D projection (add mass footprints, beam system lines)
- `packages/web/src/plan/planElementMeshBuilders.ts` — 2D plan element renderers
- `packages/core/src/` — shared types (Element, XY, etc.)

Architecture patterns:
- All new elements follow the same pattern: define element shape in core types, implement 3D mesh builder in `viewport/meshBuilders.<type>.ts`, implement 2D plan symbol in `plan/<type>PlanSymbol.ts`, add to `meshBuilders.ts` dispatcher and `planProjection.ts`.
- Semantic commands: study `{ type: 'createWall', ... }` and `{ type: 'createRoof', ... }` for command shape conventions.
- Structural elements have `structuralRole: 'structural' | 'non-structural'` on their data.
- Prettier runs automatically. Tests: `pnpm test --filter @bim-ai/web`.

## Safe Parallel Work Rules

1. `git pull --rebase origin main` before starting each sub-task.
2. Commit + push after every completed sub-feature.
3. `git pull --rebase origin main && git push origin main` after each push.
4. Do NOT touch: annotation/dim files, stair/ramp (WP-C), export (WP-E), phase dialogs (WP-F), groups (WP-B), view/sheet rendering (WP-D).
5. `toolRegistry.ts` is shared — always rebase before editing.

## Your Mission

Implement structural completion (beam systems, braces, column grid placement, sloped columns) and the conceptual massing / top-down design workflow. Covers tracker Chapters 9 and 11 entirely, plus parts of 8. Dispatch sub-agents for independent sub-tasks.

---

### Sub-task G1: Brace / Diagonal Structural Member

New ToolId: `'brace'` (hotkey: `BR`)

Braces are diagonal members between a column/wall base point and a column/beam somewhere above.

Data model:
```ts
{
  type: 'brace',
  id: string,
  startXMm, startYMm, startElevationMm: number,   // base anchor
  endXMm, endYMm, endElevationMm: number,          // top anchor
  profileId: string,                               // structural section profile
  materialId: string,
  structuralRole: 'structural',
}
```

Grammar:
- Click base point (snaps to column base, floor, or arbitrary point at the active level elevation).
- Click top point (snaps to column top, beam, or arbitrary point — the elevation is the next level up by default, overridable in options bar).
- Optionally type an explicit angle.

3D mesh (`viewport/meshBuilders.brace.ts`):
- A swept rectangular/circular cross-section along the diagonal line — reuse the beam sweep logic from the existing beam element mesh, since braces are geometrically similar.

Plan symbol (`plan/bracePlanSymbol.ts`):
- A dashed diagonal line with a small "X" symbol mid-span (standard structural bracing symbol in plan).

Inspector: profile, material, start/end anchor levels.
Tests: brace between two column positions, verify 3D diagonal geometry.

### Sub-task G2: Beam System (Auto-Fill Structural Bay)

A beam system fills a rectangular or polygonal bay with evenly spaced beams of the same profile.

New ToolId: `'beam-system'` (hotkey: `BS`)

Data model:
```ts
{
  type: 'beam_system',
  id: string,
  levelId: string,
  boundaryPoints: XY[],          // closed polygon (the bay boundary)
  beamDirection: number,         // angle in degrees (direction of span)
  spacingMm: number,             // centre-to-centre spacing
  profileId: string,
  materialId: string,
  justification: 'centre' | 'bearing_line_1' | 'bearing_line_2',
}
```

Grammar:
- Draw a closed boundary polygon (click points, close with double-click or Enter).
- Options bar: spacing (default 1200mm), direction (default: longest boundary edge), profile.
- On completion: auto-compute the set of beams that fill the boundary at the given spacing.

The element is stored as one `beam_system` entity. The individual beams it generates are computed at render time (not stored separately), based on the spacing and direction.

3D mesh (`viewport/meshBuilders.beamSystem.ts`):
- Compute intersection of each beam line with the boundary polygon to get start/end points.
- Reuse beam profile sweep for each individual beam.

Plan symbol: parallel lines at the beam spacing within the boundary + direction arrow.

Inspector: spacing, direction, profile, boundary editing (show grips on boundary vertices).

Tests: 4m × 6m bay, 1200mm spacing, verify 5 beams are generated; verify beams clip at boundary.

### Sub-task G3: Column at Grid Intersections (Batch Placement)

Revit's "At Grids" button places a column at every intersection of selected grid lines.

- When the `column` tool is active, add an "At Grids" button to the options bar.
- Grammar: click "At Grids" → user selects grid lines by clicking them (multi-select, or box-select). On Enter: columns are placed at every pairwise intersection.
- Compute intersections: for each pair of non-parallel grid lines, solve for intersection point.
- Dispatch N `createColumn` commands for the N intersection points.
- Options bar: column type, base level, top level (same for all).

Tests: 3 horizontal grids × 3 vertical grids → 9 columns placed at correct intersections.

### Sub-task G4: Sloped / Inclined Columns

Currently columns are always vertical. Add support for inclined columns.

Data model addition:
```ts
// existing column fields +
topOffsetXMm: number,   // horizontal offset of the column top from its base plan position
topOffsetYMm: number,
```

When `topOffsetXMm/YMm` are non-zero, the column is tilted.

3D mesh: update `meshBuilders.ts` column case to extrude along the inclined axis instead of vertical.

Plan symbol: show the column base footprint (solid) and the top footprint (dashed, offset) connected by a diagonal line.

Inspector: top offset X/Y fields. Auto-computed angle shown as read-only.

Tests: column with 500mm X offset, verify 3D mesh has correct top/base vertices.

### Sub-task G5: In-Place Mass Volume Creation (Conceptual Design)

This is the core of Chapter 11 — the top-down massing workflow.

Revit's in-place mass lets you model building volumes from primitive shapes and combinations.

New element type family: `mass_*`. Implement these primitive mass forms:

#### G5a: Box Mass
```ts
{ type: 'mass_box', widthMm, depthMm, heightMm, insertionXMm, insertionYMm, baseElevationMm, rotationDeg }
```
- 3D: simple box geometry
- Plan: rectangle footprint + diagonal cross (standard mass convention)
- Grammar: click centre, drag to set width/depth (or type values in options bar)

#### G5b: Extruded Mass
```ts
{ type: 'mass_extrusion', profilePoints: XY[], heightMm, baseElevationMm }
```
- 3D: prism shape (polygon base extruded to height)
- Grammar: sketch a closed polygon on the active work plane, type height in options bar

#### G5c: Revolved Mass
```ts
{ type: 'mass_revolution', profilePoints: XY[], axisPt1: XY, axisPt2: XY, startAngleDeg, endAngleDeg, baseElevationMm }
```
- 3D: surface of revolution around the axis — use THREE.LatheGeometry
- Grammar: draw profile, pick axis line, set angle range

#### G5d: Mass Tool in ToolRegistry
New ToolIds: `'mass-box'`, `'mass-extrusion'`, `'mass-revolution'`

Implement all three in toolRegistry + grammar + meshBuilders.

### Sub-task G6: Roof by Face (Mass → Roof)

When a `mass_*` element exists, the user can select one of its faces and generate a `roof` element from it.

- Selection action on a mass face: "Create Roof by Face" (shown in the selection toolbar when a mass face is selected in 3D).
- The face becomes the boundary/shape of the roof.
- Dispatches `{ type: 'createRoofByFace', massFaceRef: { elementId, faceIndex }, roofTypeId }`.
- The resulting roof element has `massFaceRef` set — it stays parametrically linked to the mass face (if the mass is resized, the roof updates).
- 3D: the roof mesh is built from the mass face geometry.

Tests: create a box mass, create a roof by face on its top surface, verify roof element is created and positioned at correct elevation.

### Sub-task G7: Wall by Face (Mass → Wall)

Same pattern as Roof by Face but for vertical/sloped faces.

- "Create Wall by Face" on a mass vertical face.
- Dispatches `{ type: 'createWallByFace', massFaceRef: { elementId, faceIndex }, wallTypeId }`.
- The wall follows the face boundary, top constraint follows the face top edge elevation.
- Tests: create box mass, create wall on each vertical face, verify 4 walls matching mass footprint.

### Sub-task G8: Floor by Face / Body Levels

Revit's "Floor by Face" creates floor slabs from mass faces at each level intersection.

- "Create Floors by Level" on a selected mass element: for each project level that intersects the mass volume, create a floor element.
- The floor boundary is the horizontal cross-section of the mass at that elevation.
- Dispatches a batch of `createFloor` commands.
- Tests: a 10m tall box mass with 3 levels, verify 3 floor elements are created at correct elevations with the box footprint.

### Sub-task G9: Curtain Wall Authoring UI

The mesh builder for curtain panels exists but there is no user-facing curtain wall authoring workflow. Implement it.

Curtain wall is a special wall type with:
- Grid: horizontal and vertical division lines dividing the wall face into panels
- Panels: infill elements (glass, solid, door) in each grid cell
- Mullions: profile elements at each grid line intersection and border

Data model (extend existing wall):
```ts
// when wall.curtainWall is set:
curtainWall: {
  gridH: { count?: number, spacingMm?: number, offsets?: number[] },  // horizontal grid divisions
  gridV: { count?: number, spacingMm?: number, offsets?: number[] },  // vertical grid divisions
  defaultPanelType: string,          // 'glass' | 'opaque' | 'door' | 'empty'
  mullionType: string,
  panelOverrides: { [cellKey: string]: string }  // e.g. { '2,3': 'door' }
}
```

UI:
- In the wall type picker, add a "Curtain Wall" category with preset types: "Storefront", "Curtain Wall", "Exterior Glazing".
- When a curtain wall is selected, the inspector shows: H grid (count/spacing), V grid (count/spacing), panel type, mullion type.
- "Edit Grid": in plan view, clicking a curtain wall enters a grid-edit mode where the user can click to add/remove grid lines at exact positions.
- "Pin Grid Line" / "Unpin Grid Line": pinned grid lines stay fixed; unpinned lines adjust when the wall is resized.

3D rendering update in `viewport/meshBuilders.ts`: route curtain walls to the curtain panel builder instead of the solid wall builder. The existing `meshBuilders.curtainPanels.test.ts` should guide the implementation.

Plan rendering: curtain walls show as a thin line with short perpendicular tick marks for each grid division.

Tests:
- `meshBuilders.curtainWall.test.ts`: 4m × 3m curtain wall, 3 vertical divisions, 2 horizontal → 6 glass panels rendered
- `curtainWallPlanSymbol.test.ts`: verify plan projection shows the grid tick marks

---

## Definition of Done

For each sub-task:
- TypeScript compiles without errors
- ≥2 unit tests per new module
- 3D mesh visible in viewport, plan symbol visible in plan
- No regressions in existing structural or mass mesh tests
- Tracker entry updated in `spec/revit-parity/revit2026-parity-tracker.md`
