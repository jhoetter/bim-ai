# Wave 2 — WP-E: IFC/DXF Export Menu + Revision Cloud Tool

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/export/ifcExporter.ts             — complete IFC 2x3 STEP writer (done)
packages/web/src/export/ifcExporter.test.ts        — IFC tests (3 pass)
packages/web/src/export/dxfExporter.ts             — DXF exporter (~297 lines, done)
packages/web/src/export/dxfExporter.test.ts        — DXF tests
packages/web/src/workspace/project/ProjectMenu.tsx  — file menu (Insert+Export items)
packages/web/src/tools/toolRegistry.ts             — ToolId union + TOOL_REGISTRY
packages/web/src/tools/toolGrammar.ts              — per-tool grammar state machines
packages/web/src/plan/PlanCanvas.tsx               — main plan interaction handler
packages/core/src/index.ts                         — Element union + ElemKind
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.

---

## What wave 1 already built — DO NOT rebuild these

- `ifcExporter.ts` — pure-TS STEP writer; call `exportIfc(model)` → string. 3 tests pass.
- `dxfExporter.ts` — exports walls (A-WALL layer), doors, windows per level. Full DXF format.
- `ProjectMenu.tsx` — has "Export → 3D print STL" and "Export → 3D print 3MF" items.
  Has "Insert → Link IFC…" (that is for importing an IFC, not exporting — do not confuse).
- `revision_cloud` element type in `@bim-ai/core`: `{ kind: 'revision_cloud', id, points, viewId }`

---

## Tasks

### E1 — IFC export "Export → IFC 2x3…" menu item

In `ProjectMenu.tsx`, study how the STL export href is wired. Add below it:

```tsx
<MenuItem
  label="Export → IFC 2x3…"
  testId="project-menu-export-ifc"
  onClick={() => {
    const stepString = exportIfc(/* pass project model from store */);
    const blob = new Blob([stepString], { type: 'application/step' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName ?? 'project'}.ifc`;
    a.click();
    URL.revokeObjectURL(url);
  }}
/>
```

Import `exportIfc` from `'../../export/ifcExporter'`. Get the project model and name
from the Zustand store (`useBimStore`). Study existing imports and store access patterns
in ProjectMenu.tsx.

Tests: add a test in `ifcExporter.test.ts` verifying the output string starts with
`ISO-10303-21` (the STEP file header).

Update tracker §12.4.3 IFC export: "Done — Export → IFC 2x3… menu item wired"

---

### E2 — DXF/DWG export menu item

Add "Export → DXF/DWG…" menu item in `ProjectMenu.tsx`:
- Opens a small inline options panel (like the existing DXF import options) with:
  - Level selector (dropdown from project levels)
  - Units dropdown: "mm" / "m"
- "Export" button calls `dxfExporter.ts` with the selected level's elements, produces
  a DXF string, downloads as `<projectName>-<levelName>.dxf`
- Tooltip or footnote: "DWG: open the DXF in any CAD tool (BricsCAD, Teigha) and
  save as DWG — the geometry is identical."

Study the existing DXF import options panel structure in ProjectMenu.tsx (dxfOptionsOpen,
dxfImportOptions state) for the pattern.

Update tracker §12.4.3 DXF export: "Done — level-scoped DXF export with units selector"

---

### E3 — Revision-cloud draw tool

**E3a. ToolId**: Add `'revision-cloud'` to `toolRegistry.ts` (hotkey `RC`, plan mode).

**E3b. Grammar**: Add `RevisionCloudState` / `reduceRevisionCloud` to `toolGrammar.ts`:
```
idle
  → click → first-point recorded (points = [p0])
first-point+
  → click → append point to points[]
  → double-click / Enter → done: emit { kind: 'createRevisionCloud', points, viewId }
  → Escape → cancel
```

**E3c. PlanCanvas wiring**: Add `case 'revision-cloud':` in PlanCanvas.tsx routing events
through `reduceRevisionCloud`. On the `'createRevisionCloud'` effect, dispatch:
`{ type: 'createElement', elem: { kind: 'revision_cloud', id: uuid(), points, viewId } }`

**E3d. Plan rendering**: In `planElementMeshBuilders.ts`, add a case for `revision_cloud`:
render the points as a closed polygon with a wavy/cloud appearance. MVP is acceptable:
draw the polygon as a dashed polyline with slightly rounded corners. A proper cloud (arcs
at each segment) is a bonus.

Tests:
- Grammar: 3 clicks + Enter emits createRevisionCloud with 3 points
- Grammar: Escape in first-point+ state returns to idle with no effect
- Plan renderer: revision_cloud with 4 points produces a closed polygon geometry

Update tracker §6.3: "Done — revision-cloud ToolId + grammar + plan renderer"

---

## Rules

- `git pull --rebase origin main` before editing `toolRegistry.ts`, `toolGrammar.ts`,
  or `PlanCanvas.tsx` — WP-B and WP-C also touch these files
- Commit + push after each completed task (E1, E2, E3 separately)
- DO NOT touch curtain wall files, group renderers, attach grammar, core/index.ts types
  beyond what's needed for revision-cloud (the element type already exists)
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
