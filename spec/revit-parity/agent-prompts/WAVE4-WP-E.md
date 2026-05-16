# Wave 4 — WP-E: Raster + PDF Export (§6.5 + §12.4.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/Viewport.tsx                              — Three.js renderer + canvas
packages/web/src/plan/PlanCanvas.tsx                       — plan 2D canvas
packages/web/src/workspace/sheets/SheetCanvas.tsx          — SVG sheet canvas
packages/web/src/export/pdfExporter.ts                     — existing PDF export (check status)
packages/web/src/workspace/shell/RibbonBar.tsx             — ribbon bar actions
packages/web/src/workspace/ModeShells.tsx                  — file-menu / export menu
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `pdfExporter.ts` — read this file in full before proceeding; it may already handle some export
  cases. Do not duplicate existing logic.
- `SheetCanvas.tsx` renders SVG — SVG → PDF via `window.print()` may already be partially wired
- Three.js renderer has `renderer.domElement` (a `<canvas>`) — `toDataURL()` works for PNG/JPEG

---

## Tasks

### A — 3D viewport: PNG / JPEG export

Add a `captureViewport3D(format: 'png' | 'jpeg', qualityJpeg?: number): string` function in a new
file `packages/web/src/export/viewportCapture.ts`:

```ts
export function captureViewport3D(
  renderer: THREE.WebGLRenderer,
  format: 'png' | 'jpeg',
  qualityJpeg = 0.92,
): string {
  // Three.js preserveDrawingBuffer must be true — check renderer init; enable if needed.
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return renderer.domElement.toDataURL(mime, qualityJpeg);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
```

Wire into `Viewport.tsx`:
- Export a `captureRef = useImperativeHandle / useRef` handle that callers can invoke, OR
- Read `renderer` from a ref already on `Viewport.tsx` (study the existing renderer ref pattern)

Add `preserveDrawingBuffer: true` to `THREE.WebGLRenderer` init in `Viewport.tsx` if not already
set (needed for `toDataURL` to work; adds slight memory cost).

---

### B — Plan canvas: PNG export

In `PlanCanvas.tsx`, the plan is rendered on a Three.js WebGLRenderer too. Add the same
`captureViewport3D` call for the plan renderer.

Alternatively, if plan canvas uses an SVG or a different canvas, use `canvas.toDataURL('image/png')`.

Study the actual canvas element type in `PlanCanvas.tsx` before implementing.

---

### C — Export menu entries

In `ModeShells.tsx` (or the file-menu dropdown — find where "Export" actions live), add:

- **Export 3D View as PNG** (data-testid: `"menu-export-3d-png"`)
  — calls `captureViewport3D(renderer, 'png')` → `downloadDataUrl(url, 'view-3d.png')`
- **Export 3D View as JPEG** (data-testid: `"menu-export-3d-jpeg"`)
  — calls `captureViewport3D(renderer, 'jpeg')` → `downloadDataUrl(url, 'view-3d.jpg')`
- **Export Plan as PNG** (data-testid: `"menu-export-plan-png"`)
  — captures plan canvas

The renderer reference must flow from `Viewport.tsx` to the menu. Use a React ref forwarded via
context or a store field `viewportRendererRef`. Study the existing `captureRef` or renderer
access pattern already in the codebase.

---

### D — Sheet PDF export polish

Read `pdfExporter.ts` in full. If sheet PDF export already works:
- Ensure the export correctly embeds revision table (SheetRevisionTableSvg) in the PDF output
- Ensure the sheet title block renders at the correct paper size (A1/A0 — check `paperSizeMm`)
- Add a "Print sheet as PDF" action to the sheet context menu or the Sheets ribbon tab
  (data-testid: `"sheet-export-pdf"`)

If `pdfExporter.ts` is a stub, implement minimal sheet export:
1. Collect the SheetCanvas SVG DOM node (`svgRef.current`)
2. Convert to a Blob: `new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })`
3. Download as `.svg` (data-testid: `"sheet-export-svg"`). True PDF conversion via headless browser
   is out of scope — SVG download is an acceptable deliverable.

---

## Tests

Add to `packages/web/src/export/viewportCapture.test.ts` (new file):
1. `captureViewport3D` with a mock canvas whose `toDataURL` returns a string → function returns
   that string
2. `downloadDataUrl` creates an `<a>` element with correct `href` and `download` attributes
3. JPEG quality parameter is forwarded to `toDataURL`

Add to export menu tests (new or extend `pdfExporter.test.ts`):
4. Export 3D PNG menu item is present (data-testid `menu-export-3d-png`)
5. Sheet export PDF/SVG button is present (data-testid `sheet-export-pdf` or `sheet-export-svg`)

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §6.5 description — append:
```
`captureViewport3D()` in `viewportCapture.ts` captures Three.js canvas as PNG/JPEG via
`toDataURL`. Export 3D PNG/JPEG and Plan PNG actions wired in export menu
(data-testids: menu-export-3d-png, menu-export-3d-jpeg, menu-export-plan-png). Sheet PDF/SVG
export action added (data-testid: sheet-export-pdf). 5 tests.
```
Change status to `Done — P1`.

Also update §12.4.5 (PDF export) status to reflect sheet SVG/PDF export is now wired.

Update summary table rows for Chapters 6 and 12.
