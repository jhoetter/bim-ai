# Wave 20 — WP-B: PDF Export — Extended Paper Sizes + Margin Control (§12.4.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

`packages/web/src/workspace/sheets/PrintPlotDialog.tsx` and `packages/web/src/export/pdfExporter.ts` handle PDF export. Currently only A4 and A3 paper sizes are available.

**Missing:** A0, A1, A2, Letter, Tabloid paper sizes + margin control input.

---

## Repo orientation

```
packages/web/src/export/pdfExporter.ts               — PaperSize type + exportSheetsToPdf
packages/web/src/workspace/sheets/PrintPlotDialog.tsx — UI (paper size dropdown, orientation)
packages/web/src/workspace/sheets/PrintPlotDialog.test.tsx — existing tests
packages/web/src/export/pdfExporterOptions.test.ts   — existing tests
```

Read both files fully before editing. Understand:
- `PaperSize` type in `pdfExporter.ts`
- `exportSheetsToPdf(sheets, { paperSize, orientation })` signature
- How `@page { size: ... }` CSS is generated for each paper size

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Extend `PaperSize` type in `pdfExporter.ts`

Find the `PaperSize` type definition. Extend it:

```ts
export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'Letter' | 'Tabloid';
```

### B — Add CSS dimensions for new sizes

Find where the `@page { size: ... }` CSS string is built (likely a mapping object or switch). Add entries for A0, A1, A2, Letter, Tabloid:

```ts
const PAPER_CSS: Record<PaperSize, string> = {
  A0: '841mm 1189mm',
  A1: '594mm 841mm',
  A2: '420mm 594mm',
  A3: '297mm 420mm',
  A4: '210mm 297mm',
  Letter: '216mm 279mm',
  Tabloid: '279mm 432mm',
};
```

Use `PAPER_CSS[paperSize]` when building the `@page` rule. If orientation is `'landscape'`, swap the two dimensions.

### C — Add `marginMm` option

In `pdfExporter.ts`, extend the options type to include:
```ts
marginMm?: number; // default 10
```

Apply it via `@page { margin: ${marginMm}mm }` in the CSS block.

Pass it through from `PrintPlotDialog.tsx` → `exportSheetsToPdf`.

### D — Update `PrintPlotDialog.tsx`

1. Add the new sizes to the paper size dropdown:
```tsx
<option value="A0">A0 (841×1189mm)</option>
<option value="A1">A1 (594×841mm)</option>
<option value="A2">A2 (420×594mm)</option>
<option value="A3">A3 (297×420mm)</option>
<option value="A4">A4 (210×297mm)</option>
<option value="Letter">Letter (216×279mm)</option>
<option value="Tabloid">Tabloid (279×432mm)</option>
```

2. Add a margin input (after orientation selector):
```tsx
const [marginMm, setMarginMm] = useState(10);

<label>
  Margin (mm)
  <input
    type="number"
    data-testid="print-margin-mm"
    value={marginMm}
    min={0}
    max={50}
    onChange={e => setMarginMm(+e.target.value)}
  />
</label>
```

3. Pass `marginMm` to all `exportSheetsToPdf` calls.

### E — Tests

In `packages/web/src/export/pdfExporterOptions.test.ts` (or a new file `pdfExporterPaperSizes.test.ts`), add:

```ts
describe('PDF paper sizes — §12.4.5', () => {
  it('PaperSize includes A0', () => {
    // import { type PaperSize } from './pdfExporter'
    // Check the type by testing the CSS mapping
    // or just call exportSheetsToPdf with A0 and check the CSS output
    const sizes: PaperSize[] = ['A0', 'A1', 'A2', 'A3', 'A4', 'Letter', 'Tabloid'];
    expect(sizes).toHaveLength(7);
  });

  it('PAPER_CSS maps A0 to 841mm 1189mm', () => { ... });
  it('PAPER_CSS maps Letter to 216mm 279mm', () => { ... });
  it('landscape swaps dimensions', () => { ... });
});
```

In `packages/web/src/workspace/sheets/PrintPlotDialog.test.tsx`, add:

```tsx
describe('PrintPlotDialog paper sizes — §12.4.5', () => {
  it('renders margin input', () => {
    // render PrintPlotDialog, expect getByTestId('print-margin-mm')
  });
  it('renders A0 option', () => {
    // render PrintPlotDialog, expect option with value A0
  });
  it('renders Letter option', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave20/B): PDF export — A0/A1/A2/Letter/Tabloid paper sizes + marginMm control (§12.4.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
