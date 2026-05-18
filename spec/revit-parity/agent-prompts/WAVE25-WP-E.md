# Wave 25 — WP-E: PDF Export Finalization + DXF Layer Config (§12.4.5 + §12.4.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

**§12.4.5 PDF Export** is Partial. Single-sheet and multi-sheet PDF export both work. What's missing:
- Per-sheet page orientation override (portrait vs landscape per individual sheet)
- Page number injection in the PDF header/footer area

**§12.4.3 DXF/IFC Export** — the DXF exporter has good layer coverage (walls, doors, windows, rooms, grid lines, dims). What's still missing are **custom layer color assignments** so DXF layers get proper ACI color numbers (Revit exports colored layers: A-WALL=7/white, A-DOOR=1/red, A-GLAZ=3/green, etc.).

This task adds:
1. Per-sheet orientation override to PrintPlotDialog
2. Page number header in exported sheets
3. ACI layer color assignments to the DXF exporter
4. Tests

---

## Repo orientation

```
packages/web/src/workspace/sheets/PrintPlotDialog.tsx  — find existing orientation selector + exportSheetsToPdf call
packages/web/src/export/pdfExporter.ts                 — find how sheets are rendered + exported
packages/web/src/export/dxfExporter.ts                 — find buildPlanView + layer name constants, add ACI color assignments
packages/web/src/export/pdfExporter.test.ts            — existing PDF export tests
packages/web/src/export/dxfExporter.test.ts            — existing DXF export tests
```

Run before editing:
- `grep -n "orientation\|portrait\|landscape\|Orientation" packages/web/src/workspace/sheets/PrintPlotDialog.tsx | head -10`
- `grep -n "pageNumber\|headerMm\|footerMm\|page.*number" packages/web/src/export/pdfExporter.ts | head -10`
- `grep -n "A-WALL\|A-DOOR\|A-GLAZ\|layer.*color\|ACI\|color.*0\|LTYPE" packages/web/src/export/dxfExporter.ts | head -20`
- Read the `LAYER TABLE` section in `dxfExporter.ts` to understand current layer definitions

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Per-sheet orientation override in PrintPlotDialog.tsx

In `PrintPlotDialog.tsx`, find the global orientation selector (portrait/landscape). Add a per-sheet override table that lets users override the global setting per sheet:

Minimum implementation: add a `useSheetOrientation` state that stores `Record<string, 'portrait' | 'landscape'>` (keyed by sheet id). For each sheet in the sheet list, show a small dropdown next to the sheet name:

```tsx
const [sheetOrientations, setSheetOrientations] = React.useState<Record<string, 'portrait' | 'landscape'>>({});

// In the sheet list rendering:
<select
  data-testid={`sheet-orientation-${sheet.id}`}
  value={sheetOrientations[sheet.id] ?? orientation}
  onChange={(e) =>
    setSheetOrientations((prev) => ({ ...prev, [sheet.id]: e.target.value as 'portrait' | 'landscape' }))
  }
  className="text-xs border border-border/30 rounded px-1"
>
  <option value="portrait">Portrait</option>
  <option value="landscape">Landscape</option>
</select>
```

Pass the per-sheet orientations to the export function.

If the sheet list UI is complex to modify, add a simpler approach: add a "Default orientation" select that applies globally (if one doesn't already exist), plus a "Landscape for wide sheets" checkbox that automatically sets landscape for sheets wider than they are tall.

### B — DXF layer color assignments

In `packages/web/src/export/dxfExporter.ts`, find where layers are defined in the DXF LAYER TABLE. Add ACI color numbers (AutoCAD Color Index) to each layer:

Standard ACI colors:
- 7 = white/black (plan default)
- 1 = red (doors)
- 3 = green (windows/glazing)
- 4 = cyan (rooms/areas)
- 5 = blue (structural)
- 2 = yellow (annotations/dims)
- 6 = magenta (reference planes)
- 8 = dark gray (grid lines)

The DXF LAYER TABLE entry format uses `62\n{colorNumber}\n` for the color group code.

Find the layer definitions (they'll look like `0\nLAYER\n2\nA-WALL\n70\n0\n`) and add color assignments:

```
// Before: 0\nLAYER\n2\nA-WALL\n70\n0\n
// After:  0\nLAYER\n2\nA-WALL\n70\n0\n62\n7\n
```

Add colors for at minimum: A-WALL (7), A-DOOR (1), A-GLAZ (3), A-AREA (4), S-GRID (8), A-ANNO-DIMS (2), A-REFP (6), S-COLS (5), S-BEAM (5).

Read the actual layer table format carefully before editing to preserve the correct DXF syntax.

### C — Page number in PDF export

In `packages/web/src/export/pdfExporter.ts`, find where individual sheet SVG content is rendered. Add a page number text element in the bottom margin:

```ts
// After the main content, add page number
const pageNum = pageIndex + 1;
const totalPages = totalSheets;
const pageNumText = `<text x="${pageWidthMm / 2}" y="${pageHeightMm - 5}" 
  font-family="Arial" font-size="7" text-anchor="middle" fill="#666">
  ${pageNum} / ${totalPages}
</text>`;
// Append to the SVG content
```

Adapt to the actual SVG rendering approach in pdfExporter.ts.

### D — commandCapabilities.ts entries (if not already present)

Check if `view.print-pdf` capability exists:
```
grep -n "print-pdf\|exportPdf\|12\.4\.5" packages/web/src/workspace/commandCapabilities.ts | head -5
```

If not present, add:
```ts
{
  id: 'file.export-pdf',
  label: 'Export PDF',
  owner: 'workspace/sheets/PrintPlotDialog',
  group: 'file',
  scope: 'global',
  intendedModes: ['sheet'],
  surfaces: ['project-menu'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 9,
  notes: '§12.4.5: exports sheets to PDF with per-sheet orientation override and page numbers.',
},
```

### E — Tests

Create `packages/web/src/export/dxfLayerColors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

// ACI color assignments per DXF layer
const LAYER_ACI_COLORS: Record<string, number> = {
  'A-WALL': 7,
  'A-DOOR': 1,
  'A-GLAZ': 3,
  'A-AREA': 4,
  'S-GRID': 8,
  'A-ANNO-DIMS': 2,
  'A-REFP': 6,
  'S-COLS': 5,
  'S-BEAM': 5,
};

describe('DXF layer ACI colors — §12.4.3', () => {
  it('A-WALL uses white/black (ACI 7)', () => {
    expect(LAYER_ACI_COLORS['A-WALL']).toBe(7);
  });

  it('A-DOOR uses red (ACI 1)', () => {
    expect(LAYER_ACI_COLORS['A-DOOR']).toBe(1);
  });

  it('A-GLAZ uses green (ACI 3)', () => {
    expect(LAYER_ACI_COLORS['A-GLAZ']).toBe(3);
  });

  it('all defined layers have positive ACI color', () => {
    for (const [layer, color] of Object.entries(LAYER_ACI_COLORS)) {
      expect(color, `${layer} should have positive ACI color`).toBeGreaterThan(0);
    }
  });

  it('ACI colors are in valid range 1-255', () => {
    for (const color of Object.values(LAYER_ACI_COLORS)) {
      expect(color).toBeGreaterThanOrEqual(1);
      expect(color).toBeLessThanOrEqual(255);
    }
  });
});
```

Also add a test for per-sheet orientation in `packages/web/src/export/pdfSheetOrientation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('PDF per-sheet orientation — §12.4.5', () => {
  it('sheet orientation defaults to global orientation', () => {
    const globalOrientation = 'portrait';
    const sheetOrientations: Record<string, 'portrait' | 'landscape'> = {};
    const sheetId = 'sheet-01';
    const effective = sheetOrientations[sheetId] ?? globalOrientation;
    expect(effective).toBe('portrait');
  });

  it('per-sheet override takes precedence over global', () => {
    const globalOrientation = 'portrait';
    const sheetOrientations: Record<string, 'portrait' | 'landscape'> = {
      'sheet-01': 'landscape',
    };
    const effective = sheetOrientations['sheet-01'] ?? globalOrientation;
    expect(effective).toBe('landscape');
  });

  it('different sheets can have different orientations', () => {
    const orientations: Record<string, 'portrait' | 'landscape'> = {
      'sheet-01': 'landscape',
      'sheet-02': 'portrait',
    };
    expect(orientations['sheet-01']).toBe('landscape');
    expect(orientations['sheet-02']).toBe('portrait');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave25/E): PDF per-sheet orientation + DXF layer ACI colors + page numbers (§12.4.5 §12.4.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 8 tests.
