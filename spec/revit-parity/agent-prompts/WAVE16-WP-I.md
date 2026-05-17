# Wave 16 — WP-I: Terrain from DXF Contour Lines (§12.2.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — toposolid element type + HeightSample
packages/web/src/tools/massGenerateBim.ts           — mass generation pattern (use as code style ref)
packages/web/src/workspace/Workspace.tsx             — file import handlers
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/commandCapabilities.ts   — capability graph
```

Search for `toposolid`, `terrain`, `HeightSample`, `dxf`, `DXF`, `contour` in the codebase first.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `toposolid` element kind. Read its fields — especially `heightSamples` (`{ xMm: number; yMm: number; zMm: number }[]`), `perimeterMm`, `levelId`.
2. Search for `dxf` in the codebase — find any DXF parser or importer. Read it fully.
3. Search `defaultCommands.ts` for `terrain` or `import` — read what's present.
4. Read the IFC importer (if it exists from WP-A) to understand the file-import pattern.

---

## Tasks

### A — DXF contour line parser in `dxfContourImport.ts`

Create `packages/web/src/tools/dxfContourImport.ts`:

```ts
/**
 * Minimal DXF parser targeting only POLYLINE/LWPOLYLINE/LINE entities.
 * Returns an array of polylines, each with elevation (Z) and a list of 2D points.
 */
export type DxfPolyline = {
  elevationMm: number;  // Z from the entity, scaled ×1000 if DXF is in metres
  points: { xMm: number; yMm: number }[];
};

export function parseDxfContours(dxfText: string): DxfPolyline[] {
  // DXF is a plain-text line-pair format: groups of (code\nvalue\n)
  // Strategy:
  // 1. Split into tokens: array of { code: number, value: string }
  // 2. Find each ENTITIES section
  // 3. For LWPOLYLINE: read group 10 (X), 20 (Y), 38 (elevation), 210 (Z extrusion — ignore)
  // 4. For POLYLINE + VERTEX: read group 10 (X), 20 (Y), 30 (Z per vertex or entity elevation)
  // 5. For LINE: treat as a 2-point degenerate polyline
  // 6. Convert units: if all coordinates < 1000, assume metres and multiply ×1000
  // 7. Return DxfPolyline[]
}

/**
 * Converts parsed DXF contour polylines into HeightSamples for a toposolid.
 * Each polyline vertex becomes a height sample using its elevation.
 */
export function dxfContoursToHeightSamples(
  polylines: DxfPolyline[]
): { xMm: number; yMm: number; zMm: number }[] {
  return polylines.flatMap(pl =>
    pl.points.map(pt => ({ xMm: pt.xMm, yMm: pt.yMm, zMm: pl.elevationMm }))
  );
}

/**
 * High-level: parse DXF text → create or update a toposolid element.
 */
export function createToposolidFromDxf(
  dxfText: string,
  levelId: string | null
): Extract<Element, { kind: 'toposolid' }> {
  const polylines = parseDxfContours(dxfText);
  const heightSamples = dxfContoursToHeightSamples(polylines);

  // Compute perimeter from the bounding box of all points
  const xs = heightSamples.map(s => s.xMm);
  const ys = heightSamples.map(s => s.yMm);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  return {
    kind: 'toposolid',
    id: crypto.randomUUID(),
    levelId: levelId ?? null,
    heightSamples,
    perimeterMm: [
      { xMm: minX, yMm: minY },
      { xMm: maxX, yMm: minY },
      { xMm: maxX, yMm: maxY },
      { xMm: minX, yMm: maxY },
    ],
  };
}
```

If the `toposolid` type fields in `core/index.ts` don't match exactly, adapt to what's there. Do not rename existing fields.

---

### B — `DxfImportDialog.tsx`

Create `packages/web/src/workspace/DxfImportDialog.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { parseDxfContours } from '../tools/dxfContourImport';

interface Props {
  onImport: (dxfText: string) => void;
  onClose: () => void;
}

export function DxfImportDialog({ onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [contourCount, setContourCount] = useState<number>(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const contours = parseDxfContours(text);
    setContourCount(contours.length);
    setPreview(text);
  };

  return (
    <div data-testid="dxf-import-dialog" style={{ padding: 16 }}>
      <h3>Import Terrain from DXF</h3>
      <input
        ref={fileRef}
        type="file"
        accept=".dxf"
        data-testid="dxf-file-input"
        onChange={handleFile}
      />
      {preview && (
        <p data-testid="dxf-contour-count">
          {contourCount} contour line{contourCount !== 1 ? 's' : ''} found
        </p>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          data-testid="dxf-import-btn"
          disabled={!preview}
          onClick={() => preview && onImport(preview)}
        >
          Import
        </button>
        <button data-testid="dxf-cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

---

### C — Palette command + Workspace handler

In `defaultCommands.ts`:
```ts
{
  id: 'file.import-dxf-terrain',
  label: 'Import Terrain from DXF…',
  keywords: ['import', 'dxf', 'terrain', 'topo', 'contour'],
  category: 'command',
  invoke: (ctx) => ctx.openDxfImport?.(),
},
```

In `Workspace.tsx`, add handler (alongside existing `file.import-ifc` or similar):
```ts
openDxfImport: () => setDxfImportOpen(true),
```

Add state `const [dxfImportOpen, setDxfImportOpen] = useState(false)` and render:
```tsx
{dxfImportOpen && (
  <DxfImportDialog
    onImport={(text) => {
      const topo = createToposolidFromDxf(text, activeLevelId ?? null);
      void onSemanticCommand({ type: 'createElement', element: topo });
      setDxfImportOpen(false);
    }}
    onClose={() => setDxfImportOpen(false)}
  />
)}
```

---

### D — Capability graph

In `commandCapabilities.ts`:
```ts
{ id: 'file.import-dxf-terrain', scope: 'document', intendedModes: ['plan', '3d'], precondition: null },
```

---

### E — Tests

`packages/web/src/tools/dxfContourImport.test.ts`:
```ts
describe('parseDxfContours — §12.2.2', () => {
  it('returns empty array for empty DXF', () => { ... });
  it('parses LWPOLYLINE with elevation group 38', () => {
    const dxf = `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n38\n5000\n10\n0\n20\n0\n10\n1000\n20\n0\n0\nENDSEC\n0\nEOF\n`;
    const result = parseDxfContours(dxf);
    expect(result).toHaveLength(1);
    expect(result[0].elevationMm).toBe(5000);
    expect(result[0].points).toHaveLength(2);
  });
  it('converts metre-scale DXF by multiplying ×1000', () => { ... });
});

describe('dxfContoursToHeightSamples — §12.2.2', () => {
  it('flattens polylines to height samples', () => { ... });
  it('each sample has zMm equal to polyline elevationMm', () => { ... });
});

describe('createToposolidFromDxf — §12.2.2', () => {
  it('returns element with kind === "toposolid"', () => { ... });
  it('heightSamples length equals total vertex count', () => { ... });
  it('perimeterMm forms bounding box of all samples', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/I): terrain from DXF contour lines — parser + toposolid creator (§12.2.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new DXF terrain import tests.
