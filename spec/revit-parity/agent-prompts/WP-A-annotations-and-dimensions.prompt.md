# WP-A — Annotation Tools & Dimensions

## Context

You are an orchestrating engineer on the bim-ai repository (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

Repo layout (critical paths):
- `packages/web/src/plan/` — 2D plan canvas (React + Canvas 2D), all annotation rendering
- `packages/web/src/viewport/` — Three.js 3D scene
- `packages/web/src/tools/toolRegistry.ts` — defines `ToolId` union + TOOL_REGISTRY array
- `packages/web/src/tools/toolGrammar.ts` — per-tool grammar (options bar, modifier behaviour)
- `packages/web/src/cmd/cheatsheetData.ts` — keyboard shortcuts reference
- `packages/web/src/plan/autoDimension.ts` — existing auto-dimension chain logic (study this)
- `packages/web/src/plan/tempDimensions.ts` — existing temporary dimension logic (study this)
- `packages/web/src/plan/AnnotateRibbon.tsx` — annotate toolbar in plan view
- `packages/web/src/plan/manualTags.ts` — manual tag placement
- `packages/web/src/plan/autoTags.ts` — auto-tag by category
- `packages/web/src/plan/symbology.ts` — line styles, text styles, hatch patterns
- `packages/core/src/` — shared TypeScript types (Element, XY, etc.)

Architecture patterns:
- Semantic commands: actions are objects `{ type: 'createDimension', ... }` dispatched via `onSemanticCommand` callback. Study autoDimension.ts for the exact command shape.
- Plan rendering: geometry is drawn on a Canvas 2D context in `PlanCanvas.tsx`. New annotation renderers should be added as separate render passes called from there.
- Tools follow the pattern in `toolRegistry.ts`: add a `ToolId`, add a `ToolDefinition` to `TOOL_REGISTRY`, implement grammar in `tools/<toolId>.ts`, add rendering in `plan/<toolId>PlanRendering.ts`.
- Prettier runs automatically after every Edit/Write via a git hook. Do not run it manually.
- Tests live co-located as `*.test.ts`. Run `pnpm test --filter @bim-ai/web` to verify.

## Safe Parallel Work Rules

1. `git pull --rebase origin main` before you start each major sub-feature.
2. Commit after every completed sub-feature with a descriptive message.
3. `git pull --rebase origin main && git push origin main` after each commit.
4. The only file that might conflict with other WPs is `tools/toolRegistry.ts` — always rebase before touching it.
5. Do NOT touch: stair files, roof files, export files, phases files, groups/group-related files, structural files. Those belong to other WPs.

## Your Mission

Implement the full set of annotation and dimension features listed in the Revit 2026 parity tracker at `spec/revit-parity/revit2026-parity-tracker.md`. These cover Chapters 4, parts of 5, and parts of 6. Work through every item below, dispatching sub-agents as needed for parallel sub-tasks (e.g. one sub-agent per annotation type).

---

### Sub-task A1: Free Text Tool (`text` tool)

Implement a free-standing text annotation tool for plan views.

New ToolId: `'text'`

Deliverables:
- Add `'text'` to the `ToolId` union in `toolRegistry.ts`
- Add a `ToolDefinition` for `text` with hotkey `TX` and icon `text`
- Grammar in `tools/text.ts`: click to place, type text content, Enter to confirm, Escape to cancel. Text size comes from the active text style. Optional leader line: if user clicks a second point before typing, draw a leader from that point to the text box.
- Persistent annotation element type `text_annotation` stored in the model: `{ type: 'text_annotation', xMm, yMm, content, textStyleId, leaderXMm?, leaderYMm?, rotationDeg? }`
- Plan renderer: `plan/textAnnotationRender.ts` — draws the text on Canvas 2D, with leader line if present. Respect current detail level and view scale.
- Grip providers: text can be moved by dragging the text box; grip handles also allow rotation.
- Inspector: shows `content` (editable), `textStyleId` (dropdown), `rotationDeg`.
- Tests: at least one unit test for the renderer round-trip and one for the grammar state machine.

### Sub-task A2: Leader Text / Callout Text

Extend the text tool with a dedicated leader-text variant. When placed, it always has a leader from an arrowhead (pointing at an element) to a text block.

- Add `'leader-text'` ToolId
- Grammar: first click = arrowhead anchor (snaps to element), second click = elbow point (optional), third click = text block placement, then type.
- Element type: `leader_annotation` with `anchorXMm, anchorYMm, elbowXMm?, elbowYMm?, textXMm, textYMm, content, arrowStyle`
- Renderer: `plan/leaderAnnotationRender.ts`

### Sub-task A3: Aligned Permanent Dimension — completeness pass

The existing autoDimension produces temporary/auto chains. This task completes permanent user-placed aligned dimensions:

- When the `dimension` tool is active (already in toolRegistry), each click adds a witness line reference (snap to wall face, grid, reference plane, window edge). Double-click or Enter finalises the chain.
- The resulting element type is `permanent_dimension` (extend/confirm the existing `createDimension` command shape from autoDimension.ts — check what it already produces and make it permanent rather than `autoGenerated`).
- Dimension text is draggable (separate grip on label position).
- EQ constraint button: when a permanent dimension chain is selected, a small "EQ" chip appears. Clicking it sets `eqConstrained: true` on the element and drives all segment lengths to be equal by adjusting the referenced elements proportionally. Emit a batch of move commands for the inner reference elements to enforce equal spacing.
- Bemaßungsstil (dimension style): add a `DimensionStyle` type with `textSizeMm`, `witnessLineGapMm`, `arrowStyle: 'tick' | 'dot' | 'arrow'`, `textPosition: 'above' | 'inline'`. Store one active style per view. Expose via a small style picker in the annotate ribbon.

### Sub-task A4: Angular Dimension

New ToolId: `'angular-dimension'`

- Click wall/line 1, click wall/line 2, click to place label arc. Displays angle between the two lines.
- Element type: `angular_dimension` with `refLine1Start/End`, `refLine2Start/End`, `labelXMm, labelYMm, angleDeg`
- Renderer: `plan/angularDimensionRender.ts` — draws two radial lines from the intersection and an arc. Label shows degrees.
- Tests required.

### Sub-task A5: Radial and Diameter Dimensions

New ToolIds: `'radial-dimension'`, `'diameter-dimension'`

- Snap to arc/circle edge to get centre + radius. Display "R 2450" or "⌀ 4900".
- Renderer: `plan/radialDimensionRender.ts`

### Sub-task A6: Arc Length Dimension

New ToolId: `'arc-length-dimension'`

- Click arc/circle edge, place label. Displays arc length.
- Renderer: `plan/arcLengthDimensionRender.ts`

### Sub-task A7: Spot Elevation Annotation

New ToolId: `'spot-elevation'`

This is one of the most important missing annotations. Spot elevation places a symbol showing the Z-height of a point on a floor, slab, terrain, or landing.

- Click a floor/slab face in plan view. The system reads the elevation of the clicked element (levelElevationMm + any thickness/offset).
- Element type: `spot_elevation` with `xMm, yMm, elevationMm, format: 'absolute' | 'relative'`
- Renderer: `plan/spotElevationRender.ts` — a small triangle or tick pointing down with a leader + text showing the elevation value (e.g. `+2.70`).
- In the 3D view add a text label at the corresponding world position using `viewport/text3dGeometry.ts`.
- Inspector: elevation value (read-only computed), display format, prefix/suffix.

### Sub-task A8: Spot Coordinate Annotation

New ToolId: `'spot-coordinate'`

- Click any point in plan. Shows X/Y (and optionally Z) world coordinates.
- Element type: `spot_coordinate` with `xMm, yMm, worldXMm, worldYMm, showZ`
- Renderer: `plan/spotCoordinateRender.ts`

### Sub-task A9: Slope Annotation / Grade Arrow

New ToolId: `'slope-annotation'`

- Click two points on a sloped element (ramp, sloped floor). Displays rise/run ratio and percentage.
- Element type: `slope_annotation` with `startXMm, startYMm, endXMm, endYMm, riseMm, runMm`
- Renderer: `plan/slopeAnnotationRender.ts` — arrow pointing downhill, text showing e.g. "1:20 (5%)"

### Sub-task A10: Material Tag

New ToolId: `'material-tag'`

- Click a wall face in plan or section. Reads the material name of the clicked layer.
- Element type: `material_tag` with `hostElementId, layerIndex, xMm, yMm, leaderXMm, leaderYMm`
- Renderer: `plan/materialTagRender.ts`

### Sub-task A11: Dimension Text Override (prefix / suffix)

On any permanent dimension element, add `textPrefix`, `textSuffix`, `textOverride` instance properties in the inspector. When `textOverride` is set, display it instead of the computed measurement. When prefix/suffix are set, prepend/append them.

### Sub-task A12: North Arrow Annotation on Sheets

North arrow is a placeable annotation symbol on sheets.

- Element type: `north_arrow` with `xMm, yMm, truNorthAngleDeg, scale`
- `plan/northArrowRender.ts` for plan views, `workspace/sheets/northArrowSheetRender.ts` for sheet canvas.
- The `truNorthAngleDeg` is read from the project's georeference (osm/project.ts georef data).
- Grip for rotation + scale.

---

## Definition of Done

For each sub-task:
- TypeScript compiles without errors (`pnpm tsc --noEmit --filter @bim-ai/web`)
- At least 2 unit tests per new module
- The new tool appears in the tool palette in plan mode
- The annotation renders correctly on the Canvas 2D
- Grips allow moving/editing the annotation
- Inspector shows relevant properties
- Tracker entry status updated to `Done` or `Partial` as appropriate

Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete each item.
