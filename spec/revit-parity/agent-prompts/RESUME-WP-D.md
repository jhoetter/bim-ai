# WP-D Resume — Views, Sheets, RCP & Project Browser

You are resuming a crashed agent session on the **bim-ai** repo
(`/Users/jhoetter/repos/bim-ai`). bim-ai is a browser-based BIM authoring
tool (React + TypeScript + Three.js, Vite, Vitest). This prompt is
self-contained.

---

## Repo orientation (WP-D relevant paths)

```
packages/web/src/workspace/project/ProjectBrowser.tsx         — project browser panel
packages/web/src/workspace/project/ProjectBrowser.test.tsx    — browser tests
packages/web/src/plan/PlanCanvas.tsx                          — plan view canvas
packages/web/src/plan/planProjection.ts                       — element → 2D geometry
packages/web/src/plan/PlanViewHeader.tsx                      — plan header bar
packages/web/src/plan/ViewRangeDialog.tsx                     — view range dialog (DONE)
packages/web/src/plan/viewRange.test.ts                       — view range tests (DONE)
packages/web/src/plan/ceilingPlanViewHeader.test.tsx          — RCP header test (exists)
packages/web/src/plan/planProjection.ceilingPlan.test.ts      — RCP projection test (exists)
packages/web/src/plan/CalloutMarker.tsx                       — callout marker
packages/web/src/plan/DetailRegionTool.tsx                    — detail region placement
packages/web/src/plan/DetailRegionRenderer.tsx                — detail region rendering
packages/web/src/plan/detailCallout.test.ts                   — detail callout test (untracked stub)
packages/web/src/plan/ColorSchemeDialog.tsx                   — color fill scheme dialog (exists)
packages/web/src/plan/colorFillLegend.ts                      — color fill legend (exists)
packages/web/src/workspace/sheets/SheetCanvas.tsx             — sheet canvas
packages/web/src/OrbitViewpointPersistedHud.tsx               — orbit viewpoint UI
packages/core/src/index.ts                                    — Element types
```

Architecture patterns:
- Views are model elements with a `kind` discriminator (`'plan_view'`,
  `'section_view'`, etc.) stored in the project model.
- The workspace `tabsModel.ts` controls which views are open/active.
- Semantic commands: `{ type: 'createView', ... }`, `{ type: 'updateViewCrop', ... }`.
- Plan projection: `planProjection.ts` produces 2D line geometry from model
  elements + view settings. Study this before touching RCP.
- Tests: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically.

---

## What was done before the crash

| Sub-task | Status | Files |
|---|---|---|
| D3 View Range Dialog | **Done** | `plan/ViewRangeDialog.tsx` + `viewRange.test.ts`, `resolveViewRange` helper, `isAboveCutPlane`, `viewDepth` field |
| D7 Project Browser (partial) | **Partial — unstaged** | `ProjectBrowser.tsx` + `ProjectBrowser.test.tsx` have ceiling plan section added but NOT committed |
| D8 Color Fill Scheme | **Partial** | `plan/ColorSchemeDialog.tsx` + `colorFillLegend.ts` exist — verify completeness |

Test stubs created but not yet integrated: `plan/ceilingPlanViewHeader.test.tsx`,
`plan/planProjection.ceilingPlan.test.ts`, `plan/detailCallout.test.ts`.

---

## Step 0 — commit the unstaged work FIRST

```bash
git pull --rebase origin main
pnpm test --filter @bim-ai/web -- ProjectBrowser
git add packages/web/src/workspace/project/ProjectBrowser.tsx \
        packages/web/src/workspace/project/ProjectBrowser.test.tsx
git commit -m "feat(views): add Deckenansichten section to project browser (D7 partial)"
git push origin main
```

Then read `plan/detailCallout.test.ts` (untracked) and `plan/ColorSchemeDialog.tsx`
to understand their state before starting work.

---

## What still needs to be done

### D7 — Finish Project Browser tree enhancements

The ceiling plan section was added in the unstaged changes. Complete the rest:
- **Renaming**: double-click a view name in the browser to edit it inline.
  Dispatch `{ type: 'renameView', viewId, newName }`.
- **Context menu** on each view: Duplicate, Delete, Properties. The
  `onPropertiesView` prop was just added — wire it to open the view's inspector.
- **Active view highlighting**: the currently open view should be visually
  highlighted in the browser list.
- **Groups subtree**: once WP-B lands, add a "Gruppen" section listing group
  definitions + instance counts. For now, leave a TODO comment in the right
  place.

### D1 — Reflected Ceiling Plan (RCP) view type

Test stubs already exist. Implement to make them pass:

1. Add `'ceiling_plan'` as a `planViewSubtype` value (or a separate view kind).
2. In `planProjection.ts`: when `viewType === 'ceiling_plan'`:
   - X-axis is mirrored (left/right flip vs looking down)
   - Cut plane reads from `topOfLevel − ceilingCutHeight` (default 100mm below ceiling)
   - Visible: ceilings, light fixtures, structural beams at ceiling height
   - Hidden: floors, terrain, standard furniture
3. View creation menu: add "Reflected Ceiling Plan" option; auto-create one per level.
4. Plan header label: "RCP - Ebene 0" (update `PlanViewHeader.tsx`).
5. Make `ceilingPlanViewHeader.test.tsx` and `planProjection.ceilingPlan.test.ts` pass.

### D2 — Interior Elevation Placement (4-Direction Marker)

Not started. Extend the `'elevation'` tool with an "Interior" mode via the
options bar:

1. Grammar (Interior mode):
   - Click inside a room → 4-directional marker appears, all 4 arrows enabled
   - Each arrow can be toggled on/off with a click
   - Enter confirms
2. Creates: 1 `interior_elevation_marker` element + up to 4 `elevation_view`
   elements (one per enabled direction), each with `viewingDirection: 0|90|180|270`,
   auto-computed `fovMm`, `cropMinMm/MaxMm`.
3. Plan rendering: square with 4 outward arrows — filled = enabled, hollow = disabled.
4. Elevation views listed under "Schnitte/Ansichten" in the project browser.

Tests: place marker in a room, verify 4 views created with correct viewing directions.

### D4 — Detail Callout enlarged view workflow

`CalloutMarker.tsx` and `DetailRegionTool.tsx` exist. `detailCallout.test.ts`
is an untracked test stub — read it first to understand what's expected.
Complete:

1. When a callout marker is placed (DetailRegionTool), immediately create a
   `detail_view` element: `{ kind: 'detail_view', sourceCalloutId, cropMinMm, cropMaxMm, scaleFactor: 5 }`
2. The detail view opens as a new workspace tab (same mechanism as plan views).
3. Elements render at the larger scale: thin lines, fill patterns visible.
4. In parent plan: callout bubble shows sheet/view reference ("See 1/A-201").
5. Project browser: detail view listed as child of its parent plan view.

Commit `detailCallout.test.ts` as part of this sub-task after making it pass.

### D5 — Named Locked 3D Views

`OrbitViewpointPersistedHud.tsx` already saves named viewpoints. Extend:

1. "Save 3D View As…" prompts for a name and saves `saved_3d_view` element
   with camera matrix + section box state.
2. Saved views in the project browser under "3D-Ansichten" (can open, duplicate,
   rename, delete).
3. Placeable on a sheet as a viewport (same mechanism as plan views).
4. Lock toggle: padlock icon in the 3D view header prevents accidental orbit.

### D6 — Sheet Revision Management

Not started:

1. Element types in `core/index.ts`:
   - `revision`: `{ id, number, date, description, issuedBy, issuedTo }`
   - `sheet_revision`: `{ sheetId, revisionId }`
   - `revision_cloud`: `{ kind: 'revision_cloud', viewId, revisionId, boundaryPoints: XY[] }`
2. "Manage Revisions" button in sheet properties → table of revisions (add/edit/delete).
3. "Revisions on Sheet" in sheet inspector → add/remove applicable revisions.
4. Revision table in sheet title block (Rev#, Date, Description).
5. `'revision-cloud'` ToolId: draw closed boundary, renders as scalloped/bumpy curve.

Tests: create revision, apply to sheet, verify revision table renders.

### D8 — Verify / complete Color Fill Scheme Dialog

`plan/ColorSchemeDialog.tsx` and `plan/colorFillLegend.ts` exist. Read them:
- If fully wired (dispatch `applyColorScheme`, rooms filled at 30% opacity,
  legend element renders), mark as Done in the tracker.
- If there are missing pieces (e.g. the dialog exists but doesn't dispatch the
  command, or the legend element doesn't render in plan), complete them.

Tests: 3 rooms with "By Name" scheme → verify each room polygon has correct fill.

---

## Rules

- `git pull --rebase origin main` before every major sub-task
- Commit + push after each completed sub-task
- Do NOT touch stair/ramp, annotation tools, export pipeline, phase dialogs,
  structural, or massing files
- `toolRegistry.ts` is shared — always rebase before editing
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
