# Wave 6 — WP-A: Print/Plot Dialog (§6.5 + §12.4.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/export/pdfExporter.ts                    — exportSheetToPdf, exportSheetsToPdf, paperSizeMm
packages/web/src/workspace/sheets/SheetCanvas.tsx         — existing PDF button (line 529/542)
packages/web/src/workspace/Workspace.tsx                  — project-level handlers, ProjectMenu wiring
packages/web/src/workspace/ProjectMenu.tsx                — file menu (has export-ifc, export-dxf entries)
packages/web/src/cmdPalette/defaultCommands.ts            — palette command registration
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `exportSheetToPdf(element, opts)` and `exportSheetsToPdf(sheetCanvases, opts)` in `pdfExporter.ts`
  — fully functional jsPDF-based export. `PaperSize = 'A4'|'A3'|'A2'|'A1'|'A0'` and
  `paperSizeMm(size)` helper already exist.
- SheetCanvas.tsx already has a basic "Export PDF" button at lines ~529 and ~542 that calls
  `exportSheetToPdf` hardcoded to A4 landscape — this still works, do NOT remove it.
- ProjectMenu.tsx has "Export IFC" and "Export DXF" entries — use the same pattern for Print/Plot.

---

## Tasks

### A — PrintPlotDialog component

Create `packages/web/src/workspace/sheets/PrintPlotDialog.tsx`:

```tsx
interface PrintPlotDialogProps {
  open: boolean;
  onClose: () => void;
  sheets: Array<{ id: string; name: string; element: HTMLElement | HTMLCanvasElement | null }>;
}
export function PrintPlotDialog({ open, onClose, sheets }: PrintPlotDialogProps): JSX.Element
```

The dialog:
- `data-testid="print-plot-dialog"` on the container
- Paper size select (`data-testid="print-paper-size"`): A4, A3, A2, A1, A0
- Orientation radio/select (`data-testid="print-orientation"`): Portrait / Landscape (default Landscape)
- Sheet selector: either "Current Sheet" or "All Sheets" radio (`data-testid="print-scope"`)
- "Print / Export PDF" button (`data-testid="print-export-pdf"`) — calls `exportSheetToPdf` (single)
  or `exportSheetsToPdf` (all). Filter out sheets where `element === null`.
- Filename pattern: `{sheetName}.pdf` for single, `sheets-export.pdf` for all.

### B — Wire into Workspace.tsx + ProjectMenu.tsx

In `Workspace.tsx`:
- Add `printPlotOpen` state boolean
- Pass open/onClose + the list of rendered sheet elements to `PrintPlotDialog`
- Sheet canvas elements must come from refs — add a ref-collection pattern similar to how
  SheetCanvas already has `ref={sheetRef}` (check the existing ref usage). Pass a
  `sheets` array built from the current `elementsById` sheet elements filtered to kind==='sheet'.

In `ProjectMenu.tsx`, add a "Print / Plot…" item:
- `data-testid="project-menu-print-plot"`
- Calls `onPrintPlot?.()` prop (add prop to ProjectMenu)
- Wire `onPrintPlot` from Workspace.tsx → `() => setPrintPlotOpen(true)`

### C — Palette command

In `defaultCommands.ts`, register:
```ts
registerCommand({
  id: 'file.print-plot',
  label: 'Print / Plot…',
  keywords: ['print', 'plot', 'pdf', 'export', 'sheets'],
  category: 'command',
  invoke: (ctx) => ctx.openPrintPlot?.(),
});
```

Add `openPrintPlot?: () => void` to `PaletteContext` in `registry.ts`.
Add `file.print-plot` to `commandCapabilities.ts` with `surfaces: ['cmd-k', 'ribbon']`,
`executionSurface: 'ribbon'`.

### D — Tests

Write `packages/web/src/workspace/sheets/PrintPlotDialog.test.tsx`:
```ts
describe('PrintPlotDialog — §6.5 + §12.4.5', () => {
  it('renders print-plot-dialog when open=true', () => { ... });
  it('does not render when open=false', () => { ... });
  it('paper size select has A4, A3, A2, A1, A0 options', () => { ... });
  it('orientation select has portrait and landscape options', () => { ... });
  it('export pdf button exists', () => { ... });
});
```

Write `packages/web/src/export/pdfExporter.test.ts` additions (or new file
`packages/web/src/export/pdfExporterOptions.test.ts`):
```ts
describe('paperSizeMm — §12.4.5', () => {
  it('A4 returns 210x297', () => { ... });
  it('A0 returns 841x1189', () => { ... });
  it('landscape swaps dimensions', () => { ... }); // test via paperSizeMm + swap logic
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
