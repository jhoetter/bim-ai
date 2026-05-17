# Wave 15 — WP-J: Browser Print + Physical Printer Output (§6.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/workspace/sheets/PrintPlotDialog.tsx       — existing print/PDF dialog (read first)
packages/web/src/workspace/sheets/PrintPlotDialog.test.tsx  — existing tests
packages/web/src/workspace/sheets/SheetCanvas.tsx           — sheet canvas component
packages/web/src/plan/PlanCanvas.tsx                        — plan canvas (for "Print Current View")
packages/web/src/index.css (or global.css)                  — add @media print styles here
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. **`PrintPlotDialog.tsx`**: reads `sheets[]`, shows paper size/orientation selectors, has "Print All Sheets" button (PDF export). Read the full component before writing anything.
2. **`SheetCanvas.tsx`**: renders a sheet as HTML. This is what the browser will print.
3. `exportSheetsToPdf`: used for PDF export. The browser print path is separate — it uses `window.print()`.

---

## Tasks

### A — "Print via Browser" button in `PrintPlotDialog.tsx`

Add a second button "Print (Browser)…" next to the existing PDF buttons:

```tsx
<button
  type="button"
  data-testid="print-browser-btn"
  disabled={exporting}
  onClick={() => {
    // Open a new window with just the sheet content and trigger print.
    handleBrowserPrint();
  }}
  className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong disabled:opacity-60"
>
  Print (Browser)…
</button>
```

Implement `handleBrowserPrint`:
```ts
function handleBrowserPrint() {
  // Get the first non-null sheet canvas element.
  const sheetEl = sheets.find((s) => s.element !== null)?.element;
  if (!sheetEl) return;

  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) { alert('Allow popups to use browser print.'); return; }

  // Clone the sheet HTML into the new window.
  const clone = sheetEl.cloneNode(true) as HTMLElement;
  const styles = Array.from(document.styleSheets)
    .map((ss) => {
      try { return Array.from(ss.cssRules).map((r) => r.cssText).join('\n'); } catch { return ''; }
    })
    .join('\n');

  win.document.write(`<!DOCTYPE html><html><head>
    <style>${styles}
    @media print { body { margin: 0; } }
    </style>
  </head><body>${clone.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}
```

---

### B — CSS `@media print` rules

Find the global CSS file (likely `packages/web/src/index.css` or `global.css`). Add:

```css
@media print {
  /* Hide all UI chrome */
  .workspace-sidebar,
  .workspace-toolbar,
  .plan-view-header,
  .tool-palette,
  .inspector-panel,
  .status-bar,
  .project-browser,
  [data-testid="options-bar"],
  [data-testid="print-plot-dialog"],
  nav,
  header {
    display: none !important;
  }

  /* Show only the sheet canvas */
  .sheet-canvas-wrapper,
  [data-testid="sheet-canvas"] {
    display: block !important;
    page-break-inside: avoid;
  }

  body {
    background: white;
    margin: 0;
  }
}
```

(Adjust class names to match what actually exists in the codebase — search for the relevant class names.)

---

### C — "Print Current View" palette command

In `defaultCommands.ts`, add:

```ts
{
  id: 'file.print-current-view',
  label: 'Print Current View…',
  keywords: ['print', 'plot', 'browser print'],
  category: 'command',
  invoke: (ctx) => { ctx.openPrintDialog?.(); },
}
```

Wire `openPrintDialog` into `PaletteContext` if not already there, connected to the existing print dialog open state in `Workspace.tsx`.

---

### D — "Print All Views" button

Add a "Print All Open Views" button to the PrintPlotDialog that iterates over all sheet elements and calls `handleBrowserPrint` for each in sequence (or opens each in a separate tab):

```tsx
<button
  type="button"
  data-testid="print-all-views-browser-btn"
  onClick={() => {
    sheets.forEach((s) => {
      if (s.element) {
        // Trigger print for each sheet with 500ms delay between
      }
    });
  }}
>
  Print All Views (Browser)
</button>
```

A simpler implementation: combine all sheets into one `window.open` popup with all clones concatenated, with `@page { size: A4 landscape; }` and `break-after: page` between sheets.

---

### E — Tests

`packages/web/src/workspace/sheets/PrintPlotDialog.browser.test.tsx`:
```ts
describe('PrintPlotDialog browser print — §6.5', () => {
  it('renders print-browser-btn', () => { ... });
  it('renders print-all-views-browser-btn', () => { ... });
  it('print-browser-btn is disabled when exporting=true', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/J): browser print dialog + CSS media print + palette command (§6.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new browser print tests.
