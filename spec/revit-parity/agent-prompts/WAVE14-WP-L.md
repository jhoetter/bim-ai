# Wave 14 — WP-L: Detail Callout Enlarged View + PDF/Print Polish (§6.4.1 + §12.4.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — plan_view element type (callout subtype)
packages/web/src/plan/PlanCanvas.tsx                    — plan canvas rendering
packages/web/src/workspace/Workspace.tsx                — tab/view switching
packages/web/src/workspace/ModeShells.tsx               — workspace mode shells
packages/web/src/export/pdfExporter.ts                  — exportSheetToPdf, paperSizeMm
packages/web/src/workspace/sheets/PrintPlotDialog.tsx   — print/plot dialog
packages/web/src/workspace/sheets/SheetCanvas.tsx       — sheet canvas
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — find `plan_view` type. Find `planViewSubtype: 'callout'`. Find what fields store the callout boundary (`calloutBoundary`, `calloutRegion`, or similar). Find `cropRegionMm` or similar crop fields.
- `PlanCanvas.tsx` — find how the active plan_view's crop region is applied (likely a clip or transform). Find `planViewSubtype` usage for callout views.
- `Workspace.tsx` — find `tabFromElement` or how switching to a callout view works. Find how the plan canvas gets its view transform.
- `pdfExporter.ts` — read the full file. Find `exportSheetToPdf`, `exportSheetsToPdf`, `paperSizeMm`. Note what it does and what's working.
- `PrintPlotDialog.tsx` — read the full dialog. Find what paper size options exist. Find if "Print All Sheets" works. Find any known TODOs or incomplete parts.

---

## Tasks

## Part 1: Detail callout enlarged view (§6.4.1)

When a callout plan_view is opened (tab activated), the plan canvas should zoom to the callout boundary region and restrict rendering to that area.

### A — Auto-zoom to callout region on activation

In `PlanCanvas.tsx` (or wherever the plan view transform is computed), detect when the active `plan_view` has `planViewSubtype === 'callout'`:

1. Read the callout boundary polygon from the plan_view element (look for `calloutBoundary`, `calloutRegionMm`, `cropRegionMm`, or similar — read the actual field name from `core/index.ts`).
2. Compute the bounding box of the callout boundary.
3. On plan view activation (effect on `activePlanViewId` change), zoom/pan the plan canvas so the callout region fills the canvas. Use the same "fit to view" mechanism that `Shift+F` uses.
4. Clip rendering to the callout boundary: set a CSS `clip-path` on the plan canvas container, or use the existing crop region rendering if it already clips Three.js objects.

### B — Callout view header badge

In `PlanViewHeader.tsx`, when `activePlanView.planViewSubtype === 'callout'`, show a badge:

```tsx
<span data-testid="callout-view-badge" className="badge badge-info text-xs px-1">
  Detail Callout: {activePlanView.name}
</span>
```

### C — Scale indicator for callout views

In `PlanViewHeader.tsx`, show the callout scale (the ratio of callout region size to canvas size) as a scale label:

```tsx
<span data-testid="callout-view-scale" className="text-xs text-muted">
  1:{Math.round(calloutScale)}
</span>
```

Where `calloutScale = calloutWidthMm / canvasWidthPx * (96 / 25.4)` (approximate screen-to-plan ratio).

---

## Part 2: PDF/Print polish (§12.4.5)

The PDF exporter already exists (`pdfExporter.ts`, `PrintPlotDialog.tsx`). Polish the remaining gaps:

### D — A3 paper size support

In `pdfExporter.ts`, `paperSizeMm` already maps paper sizes. Confirm `'A3'` is included. If not, add it:

```ts
A3: { width: 420, height: 297 },  // landscape
'A3-portrait': { width: 297, height: 420 },
```

In `PrintPlotDialog.tsx`, ensure A3 is selectable in the paper size dropdown. Add `data-testid="print-paper-size-select"` to the select element if not present.

### E — "Print All Sheets" button

In `PrintPlotDialog.tsx` (or `SheetCanvas.tsx` toolbar), add a **"Print All Sheets"** button that calls `exportSheetsToPdf` with all sheet elements:

```tsx
<button data-testid="print-all-sheets-btn" onClick={async () => {
  const allSheetEls = Object.values(elementsById).filter(e => e.kind === 'sheet');
  // gather DOM elements for each sheet... or use existing exportSheetsToPdf logic
  await exportSheetsToPdf(sheetRefs, { paperSize, filename: 'all-sheets.pdf' });
}}>
  Print All Sheets
</button>
```

Read `exportSheetsToPdf` signature in `pdfExporter.ts` and wire correctly.

### F — Tests

`packages/web/src/plan/calloutViewZoom.test.ts`:
```ts
describe('detail callout enlarged view — §6.4.1', () => {
  it('callout view activates with plan_view subtype=callout', () => { ... });
  it('callout-view-badge renders when subtype is callout', () => { ... });
  it('callout-view-scale renders a numeric scale', () => { ... });
});
```

`packages/web/src/export/pdfExporterOptions.test.ts` (add to existing):
```ts
describe('PDF exporter options — §12.4.5', () => {
  it('paperSizeMm includes A3', () => { ... });
  it('paperSizeMm A4 width is 210', () => { ... }); // regression
});
```

`packages/web/src/workspace/sheets/printPlotDialog.test.tsx`:
```ts
describe('print/plot dialog — §12.4.5', () => {
  it('renders print-paper-size-select', () => { ... });
  it('renders print-all-sheets-btn', () => { ... });
  it('paper size select includes A3 option', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/L): detail callout enlarged view + PDF/print polish (§6.4.1 + §12.4.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
