# Wave 3 — WP-E: Column-at-Grids Options Bar + Named Camera Views (§9.1.2 + §14.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — Element union + ElemKind
packages/web/src/plan/PlanCanvas.tsx                    — plan pointer handlers
packages/web/src/plan/columnAtGrids.ts                  — grid intersection helper (5 tests pass)
packages/web/src/tools/toolRegistry.ts                  — ToolId union + TOOL_REGISTRY
packages/web/src/workspace/WorkspaceLeftRail.tsx         — left-rail (camera views section)
packages/web/src/state/store.ts                         — Zustand store root
packages/web/src/state/storeTypes.ts                    — store type declarations
packages/web/src/plan/symbology.ts                      — plan symbol renderers
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What wave 1 + 2 already built — DO NOT rebuild these

**§9.1.2 Column at grids:**
- `'column-at-grids'` ToolId in `toolRegistry.ts` (hotkey CAG, plan-only)
- `ColumnAtGridsState` state machine in `toolGrammar.ts`: idle → toggleGrid click → confirm (Enter)
- PlanCanvas wires click → `toggleGrid` + Enter → `columnPositionsAtGridIntersections` → N `createColumn` commands
- `columnAtGrids.ts` helper: `gridLineIntersection()` + `columnPositionsAtGridIntersections()` (5 tests)
- Missing: options bar UI showing selected grid count, visual highlight of toggled grid lines

**§14.5 Named camera views:**
- `SavedViewElem` in `core/index.ts` with `kind: 'saved_view'`, `cameraState`, `name`
- `saved_view` rows listed under "Saved Views" in `WorkspaceLeftRail.tsx`
- Orbit viewpoints persisted via `update_saved_view` / `create_saved_view` commands
- Missing: perspective camera views are NOT distinguished from orthographic saved views;
  no separate "Camera Views" section in the left-rail browser

---

## Tasks — §9.1.2 Column at Grids

### A — Options bar display

In `PlanCanvas.tsx`, when the active tool is `'column-at-grids'`, render an options bar element
(study how other tools show an OptionsBar — look for `OptionsBar` component usage or a
`toolOptionsBarContent` prop pattern). Show:

```
Column at Grid Intersections   Grids selected: 2   [Place Columns]   [Clear]
```

- **Grids selected: N** — read from `ColumnAtGridsState.selectedGridIds.length` (or equivalent
  field in the grammar state; study `toolGrammar.ts` for the exact shape)
- **Place Columns** button — triggers Enter key equivalent (the commit action)
- **Clear** button — triggers Escape (resets selected grids)

If `OptionsBar` is not a reusable component, render a simple `<div>` with `data-testid="col-at-grids-optionsbar"` positioned at the top of the plan canvas area.

---

### B — Visual highlight of selected grid lines

In `symbology.ts` or the grid rendering code (find where `grid_line` elements are drawn in plan),
when the `column-at-grids` tool is active and a grid line is in `selectedGridIds`:
- Render that grid line in **orange** (`#f97316`) instead of the default colour
- Increase line width to 2px (or dashed highlight — match the style of other selection highlights)

The active tool and selected grid ids must be derivable from plan canvas state. Pass them through
the render options if needed (study how `viewPhaseId` or similar view options are passed to
`rebuildPlanMeshes`).

---

## Tasks — §14.5 Named Camera Views

### C — Distinguish perspective (camera) saved views

In `core/index.ts`, add an optional field to `SavedViewElem`:
```ts
viewType?: 'orthographic' | 'perspective';
```

When a saved view is created from a perspective camera (3D viewport with perspective projection),
set `viewType: 'perspective'`.

Study `create_saved_view` command and the existing orbit camera state to determine where to set
this. If `orbitCameraPoseMm` is always perspective, tag all 3D saved views as `'perspective'`.

---

### D — Separate "Camera Views" section in WorkspaceLeftRail

In `WorkspaceLeftRail.tsx`, currently saved_view elements appear in a single "Saved Views" section.
Split them into two sections:
- **Saved Views** — saved views where `viewType !== 'perspective'` (or viewType is undefined)
- **Camera Views** — saved views where `viewType === 'perspective'`

Each section follows the same LeftRail section pattern. "Camera Views" should only appear when
there is at least one perspective view.

data-testid for the Camera Views section header: `"left-rail-camera-views-header"`.

---

## Tests

Add to `packages/web/src/plan/columnAtGrids.test.ts` (extend existing):
1. Options bar shows "Grids selected: 2" after 2 grid toggles
2. Clear button resets selectedGridIds to empty

Add to `packages/web/src/workspace/WorkspaceLeftRail.test.tsx` (or equivalent):
3. A saved_view with `viewType: 'perspective'` appears under "Camera Views" section
4. A saved_view with `viewType: 'orthographic'` appears under "Saved Views" section
5. "Camera Views" section absent when no perspective views exist

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §9.1.2 description — append:
```
Options bar added: shows selected grid count, Place Columns button, Clear button
(data-testid="col-at-grids-optionsbar"). Selected grid lines highlighted in orange in plan view.
2 new tests.
```
Change §9.1.2 status to `Done — P1`.

Update §14.5 description — append:
```
`viewType: 'perspective' | 'orthographic'` field added to SavedViewElem. WorkspaceLeftRail splits
saved views into "Saved Views" (orthographic) and "Camera Views" (perspective) sections.
3 new tests.
```
Change §14.5 status to `Done — P1`.

Update summary table rows for Chapters 9 and 14.
