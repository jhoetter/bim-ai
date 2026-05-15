# WP-E — Export Pipeline & Interoperability

## Context

You are an orchestrating engineer on the bim-ai repository (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

Repo layout (critical paths):
- `packages/web/src/` — main web app
- `packages/core/src/` — shared types (Element, XY, Level, Material, etc.) — study these thoroughly; export code must handle these types
- `packages/web/src/schedules/SchedulePanel.tsx` — schedule view (add CSV export button here)
- `packages/web/src/workspace/sheets/SheetCanvas.tsx` — sheet canvas (add PDF export trigger here)
- `packages/web/src/commandQueue.ts` — command dispatch
- `packages/web/src/jobs/` — check what exists for background jobs/export tasks

There is currently NO export directory. You will create:
- `packages/web/src/export/` — new directory for all export logic

Architecture patterns:
- Exports are triggered from the UI, processed in a Web Worker (to avoid blocking the main thread), and result in a file download via `URL.createObjectURL`.
- The project model is accessed via a Zustand store — read the existing store pattern (check `packages/web/src/state/` or wherever the project model lives) to understand how to read elements.
- Use established npm packages where available: `ifc.js` / `web-ifc` for IFC, `dxf-writer` for DXF, browser's native `Blob` for CSV/PDF.
- Prettier runs automatically. Tests: `pnpm test --filter @bim-ai/web`.

## Safe Parallel Work Rules

1. `git pull --rebase origin main` before starting each sub-task.
2. Commit + push after every completed sub-feature.
3. `git pull --rebase origin main && git push origin main` after each push.
4. The export directory is new — no conflicts with other WPs expected. `toolRegistry.ts` is not touched by this WP.
5. Do NOT touch: stair/ramp files, annotation tools, phase dialogs, structural, massing, view/sheet rendering. Those belong to other WPs.

## Your Mission

Implement the full export and interoperability pipeline. This covers tracker Chapter 12 items and parts of Chapter 13. These are P1 gaps that block professional handoff workflows. Dispatch sub-agents for independent export formats.

---

### Sub-task E1: IFC 2x3 Export

IFC (Industry Foundation Classes) is the standard open BIM exchange format. This is a critical professional feature.

Package recommendation: `web-ifc` (npm: `web-ifc`) or `@thatopen/ifc-fragment` — evaluate and pick the one best suited for write-only use in a browser.

Create `packages/web/src/export/ifcExporter.ts`:

Map bim-ai element types to IFC entities:
- `wall` → `IfcWall` + `IfcWallStandardCase` (use IfcWallStandardCase for layered walls)
- `door` → `IfcDoor`
- `window` → `IfcWindow`
- `floor` → `IfcSlab` (PredefinedType=FLOOR)
- `roof` → `IfcRoof` / `IfcSlab` (PredefinedType=ROOF)
- `stair` → `IfcStair`
- `railing` → `IfcRailing`
- `column` → `IfcColumn`
- `beam` → `IfcBeam`
- `ceiling` → `IfcSlab` (PredefinedType=CEILING)
- `room` → `IfcSpace`
- Level → `IfcBuildingStorey`
- Project → `IfcProject` + `IfcBuilding` + `IfcSite`

Geometry export:
- Walls: export as `IfcExtrudedAreaSolid` (rectangle profile extruded to wall height). Layer boundaries exported as `IfcMaterialLayerSetUsage`.
- Openings (doors/windows): export as `IfcOpeningElement` with `IfcRelVoidsElement` relationship to host wall.
- Floors/roofs: export as `IfcFacetedBrep` from the Three.js mesh geometry (triangle soup).
- Rooms: export as `IfcSpace` with floor area property.

Properties:
- Each element gets an `IfcPropertySet` "Pset_WallCommon" / "Pset_DoorCommon" etc. with standard IFC properties.
- Custom bim-ai properties go in a "Pset_BimAiCustom" property set.

UI integration:
- File menu "Export" → "IFC 2x3…" opens a dialog with options: include structure, include MEP, coordinate system (local/WGS84).
- Export runs in a Web Worker. Progress shown in a small toast.
- Result: browser download of `ProjectName.ifc`.

Tests:
- `ifcExporter.test.ts`: export a simple model with 2 walls + 1 door, verify the output string contains `IFCWALL`, `IFCDOOR`, `IFCOPENINGELEMENT`.
- Verify the exported IFC can be parsed back by web-ifc (round-trip parse check).

### Sub-task E2: DWG / DXF Export

DWG/DXF export for handing off to AutoCAD users.

Package: `dxf-writer` (npm) — outputs DXF format which can be opened by most CAD tools and saved-as DWG by AutoCAD.

Create `packages/web/src/export/dxfExporter.ts`:

Layer mapping (Revit-compatible layer names):
- Walls → layer `A-WALL`
- Doors → `A-DOOR`
- Windows → `A-GLAZ`
- Columns → `A-COLS`
- Stairs → `A-STRS`
- Annotations → `A-ANNO`
- Dimensions → `A-ANNO-DIMS`
- Rooms → `A-AREA`
- Levels (as horizontal lines) → `A-FLOR-LEVL`
- Grid lines → `S-GRID`
- Reference planes → `A-REFP`

For each plan view being exported:
- Walls: export as pairs of parallel polylines (inner face + outer face) or as a closed hatched polyline for layered walls.
- Doors: export as arc (door swing) + line (door leaf).
- Windows: export as 3 lines (frame outline, glass line).
- Rooms: export as a closed polyline (room boundary) on the A-AREA layer.
- Dimensions: export as DXF DIMENSION entities.
- Grids: CIRCLE + LINE entities.
- Text annotations: TEXT entities.

UI:
- File menu "Export" → "DXF/DWG…" → dialog: pick views to export (one DXF per view, or all in one file using blocks per view), units (mm/m), layer naming (Revit-compatible or custom).
- Download as `ProjectName_Grundriss_EG.dxf` (one per exported view).

Tests:
- `dxfExporter.test.ts`: export a plan with 4 walls, verify the DXF string contains `POLYLINE` entities on layer `A-WALL`.
- Test layer assignment for door and window elements.

### Sub-task E3: CSV Export from Schedule Views

Each schedule view in `schedules/SchedulePanel.tsx` should be downloadable as a CSV.

- Add a "Download CSV" button to `SchedulePanel.tsx` (and `ScheduleView.tsx`).
- Create `packages/web/src/export/csvExporter.ts`: takes a schedule definition (columns + rows from the schedule renderer) and produces a UTF-8 CSV string.
- The CSV respects column order, column header names, and numeric formatting (units).
- Trigger: button click → `csvExporter.exportSchedule(scheduleData)` → `URL.createObjectURL(new Blob([csv]))` → `<a download>` click.
- Also support "Copy to Clipboard" (navigator.clipboard.writeText) as an alternative.
- All existing schedule types should export: room finish schedules, stair schedules, opening schedules, level datum schedules.

Tests:
- `csvExporter.test.ts`: pass a mock schedule with 3 columns and 5 rows, verify output has correct header row and 5 data rows.

### Sub-task E4: PDF Export from Sheets (polished)

PDF export of sheet views should be production-quality.

Approach:
- Use `jspdf` (npm: `jspdf`) + `html2canvas` or direct canvas capture.
- `packages/web/src/export/pdfExporter.ts`:
  - Takes a sheet ID. Renders the sheet canvas to an off-screen canvas at high resolution (≥300 DPI equivalent for print quality).
  - Adds the rendered canvas as an image page in a jsPDF document.
  - Supports multi-sheet export: "Export All Sheets" creates a multi-page PDF.
- Sheet size: read from the sheet's paper size property (A4, A3, A2, A1, A0 — store as sheet property).
- UI: "Print/Export PDF" in the sheet canvas toolbar → opens a dialog: single sheet or all sheets, paper size confirmation, DPI setting (72/150/300).
- Output: browser download of `ProjectName_Sheets.pdf`.

Tests:
- `pdfExporter.test.ts`: mock a sheet canvas, verify the PDF blob has non-zero size and the correct page count.

### Sub-task E5: Linked Model (Basic Read-Only)

A "linked model" lets one bim-ai project reference another as a background underlay — useful for coordination between architects and structural/MEP consultants.

This is a simplified implementation (read-only):

Data model:
- `linked_model` element: `{ id, projectUrl: string, insertionXMm, insertionYMm, rotationDeg, isVisible, isGhosted }`
- The `projectUrl` is a URL to another bim-ai project (same cloud backend).

UI:
- "Insert → Link bim-ai Model": opens a project picker showing other projects the user has access to.
- Inserted as a `linked_model` element.
- In plan view: linked model elements render ghosted (grey, low opacity) — reuse `linkedGhosting.ts` which already exists.
- In 3D: same ghosted treatment.
- Inspector: linked model shows URL, offset, rotation, visibility toggle, "Unload" (hides it temporarily) and "Remove" buttons.
- The linked model is NOT editable — elements inside it cannot be selected or modified.

Tests:
- `linkedModelGhosting.test.ts`: verify linked elements render with ghost opacity.

### Sub-task E6: DXF Underlay Completion Pass

The existing `dxfUnderlay.ts` partially implements DXF import. Complete it:

- Currently only basic line entities are imported. Add support for: ARC, CIRCLE, POLYLINE, LWPOLYLINE, TEXT, MTEXT, INSERT (block references), HATCH (convert to polygon).
- Layer visibility: each DXF layer can be toggled visible/hidden from a panel.
- Layer colours: respect DXF layer colours.
- Underlay opacity control: slider in the inspector for the underlay element.
- "Snap to Underlay": a toggle that makes snap engine snap to underlay geometry (endpoint/midpoint of underlay lines).
- Tests: `dxfUnderlay.arc.test.ts` — verify ARC entities are parsed and rendered as canvas arcs.

---

## Definition of Done

For each sub-task:
- TypeScript compiles without errors
- ≥2 unit tests per new module
- Export functions produce correct output (validated by parsing or content checks)
- UI trigger present and functional
- No regressions in existing schedule/sheet tests
- Tracker entries updated in `spec/revit-parity/revit2026-parity-tracker.md`
