# Wave 17 — WP-I: DXF Export Layer Names (§12.4.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/export/dwgExport.ts               — DXF/DWG exporter (read first)
packages/web/src/export/ifcExporter.ts             — IFC exporter (use as pattern for element iteration)
packages/core/src/index.ts                          — Element union
packages/web/src/cmdPalette/defaultCommands.ts     — palette commands
```

Search for `dwgExport`, `exportDwg`, `dxf`, `DXF`, `dwg` in the codebase first. Read the full `dwgExport.ts` before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `dwgExport.ts`: read the ENTIRE file — understand the current DXF output format, how elements are serialised, and what layer names are currently used.
2. `ifcExporter.ts`: read how it iterates over elements by kind — use as a pattern.
3. The existing `dwgExport.test.ts` (if it exists): read the tests to understand what's currently validated.
4. `core/index.ts`: note the element kinds you need to export (wall, floor, door, window, room, column, beam, stair, ramp, dimension, etc.).

---

## Tasks

The current DXF exporter produces a minimal DXF string. The goal is to extend it with:
1. Proper named layers per element category (German layer names as used in German practice)
2. Correct DXF entity types per element (LWPOLYLINE for walls/floors, INSERT for doors/windows as blocks, LINE for annotations)
3. Dimension entities for permanent dimensions

### A — Layer name mapping in `dwgExport.ts`

Add a layer-name map (and ensure layers are declared in the DXF TABLES section):

```ts
const LAYER_MAP: Record<string, { name: string; color: number }> = {
  wall:      { name: 'A-WAND',      color: 7  },  // white
  floor:     { name: 'A-DECKE',     color: 3  },  // green
  door:      { name: 'A-TUERE',     color: 4  },  // cyan
  window:    { name: 'A-FENSTER',   color: 4  },
  room:      { name: 'A-RAUM',      color: 2  },  // yellow
  column:    { name: 'A-STUETZE',   color: 1  },  // red
  beam:      { name: 'A-BALKEN',    color: 1  },
  stair:     { name: 'A-TREPPE',    color: 5  },  // blue
  ramp:      { name: 'A-RAMPE',     color: 5  },
  roof:      { name: 'A-DACH',      color: 6  },  // magenta
  grid:      { name: 'A-RASTER',    color: 8  },  // grey
  dimension: { name: 'A-BEMASSUNG', color: 3  },
  text_tag:  { name: 'A-BESCHRIFT', color: 7  },
  default:   { name: '0',           color: 7  },
};

function layerFor(kind: string): { name: string; color: number } {
  return LAYER_MAP[kind] ?? LAYER_MAP.default!;
}
```

In the DXF TABLES section, declare all layers:
```ts
function dxfLayerTable(layers: typeof LAYER_MAP): string {
  const entries = Object.values(layers).map(l => `
  0\nLAYER\n5\n${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()}\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nContinuous`).join('');
  return `0\nTABLE\n2\nLAYER\n5\n2\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTable\n70\n${Object.keys(layers).length}${entries}\n0\nENDTAB\n`;
}
```

---

### B — Wall export as LWPOLYLINE

For each wall element, output a closed LWPOLYLINE in the `A-WAND` layer representing the wall outline:

```ts
function wallToLwPolyline(el: Extract<Element, { kind: 'wall' }>, scale = 1): string {
  // Compute 4 corners of the wall rectangle
  // startMm/endMm define the centreline; thickness from wallThicknessMm
  const halfT = ((el as any).wallThicknessMm ?? 200) / 2;
  const dx = ((el as any).endMm?.xMm ?? 0) - ((el as any).startMm?.xMm ?? 0);
  const dy = ((el as any).endMm?.yMm ?? 0) - ((el as any).startMm?.yMm ?? 0);
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // normal

  const s = (el as any).startMm ?? { xMm: 0, yMm: 0 };
  const e = (el as any).endMm ?? { xMm: 1000, yMm: 0 };

  const corners = [
    { x: (s.xMm + nx * halfT) * scale, y: (s.yMm + ny * halfT) * scale },
    { x: (e.xMm + nx * halfT) * scale, y: (e.yMm + ny * halfT) * scale },
    { x: (e.xMm - nx * halfT) * scale, y: (e.yMm - ny * halfT) * scale },
    { x: (s.xMm - nx * halfT) * scale, y: (s.yMm - ny * halfT) * scale },
  ];

  const layer = layerFor('wall').name;
  const verts = corners.map(c => `10\n${c.x.toFixed(1)}\n20\n${c.y.toFixed(1)}`).join('\n');
  return `0\nLWPOLYLINE\n8\n${layer}\n70\n1\n90\n${corners.length}\n${verts}\n`;
}
```

---

### C — Door/window as simple LINE entities

For each door/window, output a simple LINE entity at the opening position:

```ts
function doorToLines(el: Extract<Element, { kind: 'door' }>, scale = 1): string {
  const pos = (el as any).positionMm ?? { xMm: 0, yMm: 0 };
  const w = ((el as any).widthMm ?? 900) / 2;
  const layer = layerFor('door').name;
  // Draw a simple 2-line symbol (two lines forming a door arc approximation)
  return [
    `0\nLINE\n8\n${layer}\n10\n${((pos.xMm - w) * scale).toFixed(1)}\n20\n${(pos.yMm * scale).toFixed(1)}\n11\n${((pos.xMm + w) * scale).toFixed(1)}\n21\n${(pos.yMm * scale).toFixed(1)}`,
    `0\nLINE\n8\n${layer}\n10\n${(pos.xMm * scale).toFixed(1)}\n20\n${((pos.yMm - w) * scale).toFixed(1)}\n11\n${(pos.xMm * scale).toFixed(1)}\n21\n${((pos.yMm + w) * scale).toFixed(1)}`,
  ].join('\n') + '\n';
}
```

---

### D — Floor as LWPOLYLINE

For each floor element with `perimeterMm`, output a closed LWPOLYLINE:

```ts
function floorToLwPolyline(el: Extract<Element, { kind: 'floor' }>, scale = 1): string {
  const pts = (el as any).perimeterMm ?? [];
  if (pts.length < 3) return '';
  const layer = layerFor('floor').name;
  const verts = pts.map((p: any) => `10\n${(p.xMm * scale).toFixed(1)}\n20\n${(p.yMm * scale).toFixed(1)}`).join('\n');
  return `0\nLWPOLYLINE\n8\n${layer}\n70\n1\n90\n${pts.length}\n${verts}\n`;
}
```

---

### E — Text entities for room names

For each room element, output a TEXT entity at the room centroid:

```ts
function roomToText(el: Extract<Element, { kind: 'room' }>, scale = 1): string {
  const pos = (el as any).positionMm ?? { xMm: 0, yMm: 0 };
  const label = (el as any).name ?? 'Raum';
  const layer = layerFor('room').name;
  return `0\nTEXT\n8\n${layer}\n10\n${(pos.xMm * scale).toFixed(1)}\n20\n${(pos.yMm * scale).toFixed(1)}\n40\n300\n1\n${label}\n`;
}
```

---

### F — Update `exportSceneToDwg`

Update the main export function to use all the above:

```ts
export function exportSceneToDwg(elementsById: Record<string, Element | undefined>): string {
  const scale = 0.001; // mm → metres for DXF units (or keep as mm if unitless)
  const entities: string[] = [];

  for (const el of Object.values(elementsById)) {
    if (!el) continue;
    switch (el.kind) {
      case 'wall': entities.push(wallToLwPolyline(el as any, scale)); break;
      case 'door': entities.push(doorToLines(el as any, scale)); break;
      case 'window': entities.push(doorToLines(el as any, scale)); break;  // same symbol
      case 'floor': entities.push(floorToLwPolyline(el as any, scale)); break;
      case 'room': entities.push(roomToText(el as any, scale)); break;
      // TODO: column, beam, stair, dimension
    }
  }

  return [
    `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`,
    `0\nSECTION\n2\nTABLES\n`,
    dxfLayerTable(LAYER_MAP),
    `0\nENDSEC\n`,
    `0\nSECTION\n2\nENTITIES\n`,
    ...entities,
    `0\nENDSEC\n`,
    `0\nEOF\n`,
  ].join('');
}
```

---

### G — Tests

Extend `packages/web/src/export/dwgExport.test.ts` (or create it):

```ts
describe('exportSceneToDwg — §12.4.3', () => {
  it('output contains DXF header AC1015', () => { ... });
  it('output contains LAYER table with A-WAND', () => { ... });
  it('output contains LAYER table with A-TUERE', () => { ... });
  it('wall element produces LWPOLYLINE entity on A-WAND layer', () => { ... });
  it('door element produces LINE entity on A-TUERE layer', () => { ... });
  it('floor element with perimeterMm produces LWPOLYLINE on A-DECKE', () => { ... });
  it('room element produces TEXT entity on A-RAUM layer', () => { ... });
  it('output is valid DXF (contains ENDSEC and EOF)', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/I): DXF export — named layers per category + LWPOLYLINE + TEXT entities (§12.4.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new DXF export tests.
