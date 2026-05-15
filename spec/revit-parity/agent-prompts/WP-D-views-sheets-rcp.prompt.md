# WP-D — Views, Sheets, RCP & Project Browser

## Context

You are an orchestrating engineer on the bim-ai repository (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

Repo layout (critical paths):
- `packages/web/src/workspace/` — workspace shell, tabs, pane layout
- `packages/web/src/workspace/sheets/` — sheet canvas, section placeholder, sheet-related views
- `packages/web/src/workspace/viewport/` — 3D viewport mount within workspace
- `packages/web/src/plan/PlanCanvas.tsx` — plan view canvas (main 2D authoring surface)
- `packages/web/src/plan/planProjection.ts` — how model elements project to plan
- `packages/web/src/plan/PlanViewHeader.tsx` — plan view header bar
- `packages/web/src/plan/PhaseDropdown.tsx` — phase selector in plan
- `packages/web/src/plan/cropRegionDrag.test.tsx` — crop region drag tests
- `packages/web/src/plan/cropRegionDragHandles.ts` — crop region handle logic
- `packages/web/src/plan/sectionProjectionWire.ts` — section projection in plan
- `packages/web/src/plan/elevationMarker.test.ts` — elevation marker
- `packages/web/src/plan/CalloutMarker.tsx` — callout marker
- `packages/web/src/plan/DetailRegionTool.tsx` — detail region tool
- `packages/web/src/plan/DetailRegionRenderer.tsx` — detail region renderer
- `packages/web/src/schedules/SchedulePanel.tsx` — schedule view
- `packages/web/src/viewport/sectionBox.ts` — section box in 3D
- `packages/web/src/viewport/ViewCube.tsx` — ViewCube
- `packages/web/src/OrbitViewpointPersistedHud.tsx` — orbit viewpoint persistence
- `packages/core/src/` — shared types

Architecture patterns:
- Views are model elements themselves: `{ type: 'plan_view', id, levelId, name, cropMinMm, cropMaxMm, viewRange: {...} }`
- Each view type renders via a dedicated canvas/surface component.
- The workspace `tabsModel.ts` controls which views are open and active.
- Semantic commands mutate views: `{ type: 'createView', ... }`, `{ type: 'updateViewCrop', ... }`, etc.
- Plan projection: `planProjection.ts` takes model elements + view settings and produces 2D line geometry. Study this extensively before implementing RCP.
- Sheet canvas: sheets hold placed viewports (`{ type: 'placed_viewport', sheetId, viewId, xMm, yMm, scaleFactor }`)
- Prettier runs automatically. Tests: `pnpm test --filter @bim-ai/web`.

## Safe Parallel Work Rules

1. `git pull --rebase origin main` before starting each sub-task.
2. Commit + push after every completed sub-feature.
3. `git pull --rebase origin main && git push origin main` after each commit.
4. Do NOT touch: stair/ramp files, annotation tools, export pipeline, phase creation dialogs, structural files, massing. Those belong to other WPs.
5. `toolRegistry.ts` is shared — always rebase before editing.

## Your Mission

Implement all view, sheet, and project-browser improvements listed in the parity tracker. Covers Chapters 6, parts of 1 (project browser), and parts of 3 (3D view improvements). Dispatch sub-agents for parallel independent sub-tasks.

---

### Sub-task D1: Reflected Ceiling Plan (RCP) View Type

A Reflected Ceiling Plan looks upward and shows the ceiling structure: ceiling elements, light fixtures, HVAC grilles, sprinklers, overhead structure.

New view type `ceiling_plan`:
- Add view type `'ceiling_plan'` alongside `'floor_plan'` in the model.
- RCP projects geometry as if looking upward: X-axis is mirrored (left-right flip vs a plan from above).
- Elements visible in RCP: ceilings, light fixtures (MEP terminals on ceiling face), structural beams at the ceiling height, overhead doors.
- Elements hidden in RCP: floors, terrain, roof (unless show-roof is toggled), standard furniture.
- Plan projection: add a `viewType: 'ceiling_plan'` parameter to `planProjection.ts`. When active, the cut plane reads from `topOfLevel - ceilingCutHeight` (default 100mm below the ceiling) instead of the floor plan cut height.
- Ceiling plan symbol in PlanViewHeader: a distinctive header label "RCP - Ebene 0".
- Creating a ceiling plan: in the view creation menu, add "Reflected Ceiling Plan" option. Auto-create one per level.

Plan rendering specifics:
- Ceiling element boundary: rendered as a solid polygon fill + outline.
- Grid pattern on ceilings (when ceiling has a tile pattern material): render the tile grid lines.
- Light fixture symbols: a circle with an X (standard luminaire symbol) at the fixture insertion point.

Tests:
- `planProjection.ceilingPlan.test.ts` — verify ceiling elements appear and floor elements don't
- `ceilingPlanViewHeader.test.tsx` — verify header label

### Sub-task D2: Interior Elevation Placement (4-Direction Marker)

Revit's interior elevation workflow: place a 4-headed arrow marker inside a room; this auto-creates up to 4 named elevation views looking at each wall face.

Tool: extend the existing `'elevation'` tool with an "Interior" mode in the options bar.

Grammar in Interior mode:
- Click inside a room (the tool snaps to the room centroid or any point the user clicks).
- A 4-directional marker appears, initially showing all 4 arrows.
- Each arrow can be toggled on/off by clicking it (disables that elevation view).
- Press Enter to confirm.

Created elements:
- 1 `interior_elevation_marker` element at the clicked point, containing 4 `viewIds` (one per direction that was enabled).
- 4 `elevation_view` elements, each with: `viewingDirection: 0 | 90 | 180 | 270`, `fovMm` (field of view width — auto-computed as the room width perpendicular to the view direction), `cropMinMm, cropMaxMm`.

Rendering:
- The 4-direction marker renders in plan as a square with 4 outward arrows, each arrow styled enabled (filled) or disabled (hollow).
- Interior elevation views open in the workspace as section-like views using the existing elevation projection infrastructure.
- Elevation views are listed in the project browser under a "Sections/Elevations" subtree.

Tests: place an interior elevation marker in a room, verify 4 views are created with correct viewing directions.

### Sub-task D3: View Range Dialog

Revit's View Range controls what is visible in a plan view: Primary Range (top cut plane height, cut plane height, bottom clip), View Depth (additional elements below the bottom), and Far Clip offset.

Currently bim-ai uses implicit defaults. Implement an explicit View Range dialog:

Data added to `plan_view` element:
```ts
viewRange: {
  topOffset: number,      // mm above level base — default 3000mm (top of view range)
  cutPlaneOffset: number, // mm above level base — default 1200mm (where walls/doors are cut)
  bottomOffset: number,   // mm above level base — default 0mm
  viewDepth: number,      // mm below level base — default 0mm
}
```

UI:
- A "View Range…" button in `PlanViewHeader.tsx` opens a dialog (or inspector panel) showing the four numeric fields.
- Live preview: changing the cut plane height immediately updates the plan projection (walls cut higher/lower show different doors/windows).

Plan projection update:
- `planProjection.ts` already has a cut plane concept. Thread the `viewRange.cutPlaneOffset` through as the explicit cut height so it replaces the current hardcoded default.
- Elements below `viewRange.bottomOffset` are hidden.
- Elements in the "view depth" zone (between bottomOffset and -viewDepth) render as hidden lines (dashed).

Tests: set cut plane to 900mm, verify a high window (sill at 1000mm) does not appear in the plan cut.

### Sub-task D4: Detail Callout — Enlarged View Workflow

Currently `CalloutMarker.tsx` draws a callout bubble but the corresponding enlarged view is not automatically created.

Complete the workflow:
- When a callout marker is placed (DetailRegionTool), immediately create a new `detail_view` element: `{ type: 'detail_view', sourceCalloutId, cropMinMm, cropMaxMm, scaleFactor: 5 }` (scale defaults to 5x = 1:20 if parent is 1:100).
- The detail view opens as a new tab in the workspace (like a plan view but zoomed to the callout region).
- Elements render the same as in the parent plan, but at the larger scale: thin lines become visible, detail components (insulation, fill patterns) are shown.
- In the parent plan, the callout bubble shows the sheet/view reference: "See 1/A-201" (where A-201 is the sheet the detail view is placed on).
- In the project browser, the detail view is listed under its parent plan view as a child node.

Tests: create a callout on a plan, verify a detail_view is created, verify the detail view crop matches the callout boundary.

### Sub-task D5: Named Locked 3D Views

Revit supports saving named 3D views (camera position + orientation + section box) that can be placed on sheets.

- Extend the existing `OrbitViewpointPersistedHud.tsx` mechanism.
- "Save 3D View As…": prompts for a name and saves current camera matrix + section box state as a `saved_3d_view` element.
- Saved 3D views appear in the project browser under "3D-Ansichten".
- A saved 3D view can be opened (restores camera), duplicated, renamed, or deleted.
- It can be placed on a sheet as a viewport (same as plan views).
- "Lock" toggle: when locked, the camera cannot be accidentally orbited (shows a locked padlock icon in the 3D view header).

### Sub-task D6: Sheet Revision Management

Revit tracks revisions (Änderungen) per sheet: date, issued by, issued to, revision description. These appear in the sheet title block as a revision table.

Data model:
- `revision` element at the project level: `{ id, number, date, description, issuedBy, issuedTo }`
- `sheet_revision` link: `{ sheetId, revisionId }` — which revisions apply to which sheet.
- `revision_cloud` annotation: `{ type: 'revision_cloud', viewId, revisionId, boundaryPoints: XY[] }` — a cloud-shaped highlight area marking what changed.

UI:
- "Manage Revisions" button in the sheet properties panel. Opens a table of project revisions (add/edit/delete).
- On a sheet: "Revisions on Sheet" section in the sheet inspector lets you add/remove applicable revisions.
- In sheet title block area (bottom right): revision table rendered with columns: Rev#, Date, Description.
- Revision cloud tool (`'revision-cloud'` ToolId): draw a closed boundary in any view; the cloud renders as a bumpy/scalloped closed curve (the classic revision cloud style).

Tests: create a revision, apply it to a sheet, verify revision table renders in the sheet footer.

### Sub-task D7: Project Browser Tree Enhancements

Revit's project browser is a full hierarchical tree. Improve bim-ai's view/sheet navigation to match:

- Add a collapsible sidebar panel "Projektbrowser" with sections:
  - Ansichten (alle) — lists all views grouped by type (Grundrisse, Deckenansichten, 3D-Ansichten, Schnitte, Ansichten)
  - Legenden — list of legend views
  - Bauteilisten/Mengen — list of schedules
  - Pläne — list of sheets organised by sheet number
  - Familien — grouped by category (Wände, Türen, Fenster, etc.)
  - Gruppen — list of model groups (from WP-B)
- Each item is double-clickable to open that view.
- Views can be renamed (double-click name field in the browser).
- Context menu on each view: Duplicate, Delete, Properties.
- The active view is highlighted in the browser.

### Sub-task D8: Color Fill Scheme Dialog

Currently `roomSchemeColor.ts` has backend logic. Expose it through a proper UI:

- "Color Scheme…" button in the plan view header or annotate ribbon.
- Opens a dialog: pick scheme category (e.g. "By Department", "By Area", "By Name", "By Occupancy").
- For each unique value in that category, assign a fill color (color picker per row).
- On Apply: dispatch `{ type: 'applyColorScheme', viewId, schemeCategory, colorMap: { [value: string]: hexColor } }`.
- Plan renderer: fills each room polygon with the assigned color at ~30% opacity.
- Color fill legend: a draggable legend element on the plan view (or placeable on a sheet) showing the color → label mapping. `plan/colorFillLegend.ts` for the element, rendered as a small table of colored swatches + text.

Tests: apply a "By Name" color scheme to 3 rooms, verify each room polygon receives its assigned color.

---

## Definition of Done

For each sub-task:
- TypeScript compiles without errors
- ≥2 unit tests per new module
- Feature visible and functional in plan/sheet/3D views
- No regressions in existing view/sheet/plan tests
- Tracker entry updated in `spec/revit-parity/revit2026-parity-tracker.md`
