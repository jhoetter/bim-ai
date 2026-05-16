# WP-E Resume — Export Pipeline & Interoperability

You are resuming a crashed agent session on the **bim-ai** repo
(`/Users/jhoetter/repos/bim-ai`). bim-ai is a browser-based BIM authoring
tool (React + TypeScript + Three.js, Vite, Vitest). This prompt is
self-contained.

---

## Repo orientation (WP-E relevant paths)

```
packages/web/src/export/ifcExporter.ts            — IFC 2x3 exporter (done)
packages/web/src/export/ifcExporter.test.ts        — IFC tests (done)
packages/web/src/export/dxfExporter.ts             — DXF exporter (~300 lines, real impl)
packages/web/src/export/dxfExporter.test.ts        — DXF tests
packages/web/src/export/csvExporter.ts             — CSV exporter (done)
packages/web/src/export/pdfExporter.ts             — PDF exporter (done)
packages/web/src/export/linkedModelGhosting.test.ts — linked model ghosting tests (done)
packages/web/src/viewport/linkedGhosting.ts         — 3D ghosting logic (done)
packages/web/src/workspace/project/ManageLinksDialog.tsx — linked model UI (done)
packages/web/src/schedules/SchedulePanel.tsx        — schedule view (E3 CSV button done)
packages/web/src/workspace/sheets/SheetCanvas.tsx   — sheet canvas (PDF trigger)
packages/core/src/index.ts                          — shared Element types
```

Architecture:
- Exports triggered from UI, processed in a Web Worker or directly, result
  in `URL.createObjectURL` → `<a download>` click.
- Project model accessed via `useBimStore` (Zustand).
- Tests: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically.

---

## What was done before the crash

| Sub-task | Status | Notes |
|---|---|---|
| E1 IFC 2x3 | **Partial** | Pure-TypeScript STEP writer at `export/ifcExporter.ts`. Exports project hierarchy + walls/doors/windows/slabs/spaces. Missing: material layer sets, some Psets. 3 tests pass. |
| E2 DXF Export | **Partial** | `export/dxfExporter.ts` (~297 lines) handles walls (A-WALL), doors, windows per level. May be missing rooms, annotations, grids. Check tests for what passes. |
| E3 CSV | **Done** | `export/csvExporter.ts` + Copy button in SchedulePanel |
| E4 PDF | **Done** | `export/pdfExporter.ts` — tracker marks §12.4.5 Done |
| E5 Linked Model | **Done** | `ManageLinksDialog.tsx` has full UI (add/delete/align/pin); `linkedGhosting.ts` ghosts with blue tint at 0.6 opacity; wired into Workspace; tests pass |
| E6 DXF Underlay | **Done** | Circle, text, hatch entities added to `dxfUnderlay.ts` |

There are **no uncommitted WP-E changes** — all prior work was committed.

---

## What still needs to be done

### Step 0 — audit what E1 and E2 actually cover

Before writing new code, run the tests and read the files:
```bash
pnpm test --filter @bim-ai/web -- ifcExporter
pnpm test --filter @bim-ai/web -- dxfExporter
```

Read `export/ifcExporter.ts` and `export/dxfExporter.ts` end-to-end to
understand what is and isn't exported. Then pick up from the gaps.

### E1 — complete IFC 2x3 gaps

Read `ifcExporter.ts` and identify what's missing. Common gaps:
1. **IfcMaterialLayerSetUsage** for layered walls — each layer in the wall
   type's layer stack should be an `IfcMaterialLayer` in the STEP file
2. **Standard Psets** per element type: `Pset_WallCommon`, `Pset_DoorCommon`,
   `Pset_WindowCommon`, `Pset_SlabCommon` — each contains standardised IFC
   properties (IsExternal, Combustible, etc.)
3. **Rooms as IfcSpace** with FloorArea property (check if `room` elements
   are exported or skipped)
4. **Round-trip check**: after exporting, parse the resulting STEP string back
   with a minimal parser to verify it is valid ISO 10303-21

Update tests to cover these cases.

### E2 — complete DXF export gaps

Read `dxfExporter.ts` to see which element kinds are handled. Add missing:
1. **Rooms** — closed polyline on layer `A-AREA`
2. **Grid lines** — `CIRCLE` + `LINE` entities on layer `S-GRID`
3. **Reference planes** — `LINE` entities on layer `A-REFP`
4. **Text annotations** (if any `text_annotation` elements exist) — `TEXT`
   entities on layer `A-ANNO`
5. **Dimensions** — DXF `DIMENSION` entities on layer `A-ANNO-DIMS`
6. **Multi-sheet export**: "Export All Sheets" creates one DXF per level;
   current code likely exports one level at a time — verify and add a
   bulk export path
7. **UI trigger**: check that "Export → DXF/DWG…" exists in the file menu
   with a dialog for: view selection, units (mm/m), layer naming preset

Run `pnpm test --filter @bim-ai/web -- dxfExporter` and add tests for any
new entity types.

### E5 — verify linked model is complete

The tracker says E5 is Partial but the UI seems done. Verify:
- Open `ManageLinksDialog.tsx` — does it have Insert, Unload, Remove, align?
- Are linked model elements truly non-selectable/non-editable in plan + 3D?
- Does the `link_model` element type have `isVisible` + `isGhosted` toggles?

If everything is wired, update the tracker entry to Done.

---

## Rules

- `git pull --rebase origin main` before every sub-task
- Commit + push after each completed sub-task
- Do NOT touch stair/ramp, annotation tools, phase dialogs, structural, massing,
  or view/sheet rendering systems
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
