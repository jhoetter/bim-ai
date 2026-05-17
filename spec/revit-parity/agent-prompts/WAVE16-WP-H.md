# Wave 16 — WP-H: Interior Elevation Rendering (§6.1.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/elevationProjection.ts              — buildElevationLines (may exist)
packages/web/src/plan/ElevationViewport.tsx               — SVG elevation renderer (may exist)
packages/web/src/workspace/sheets/sectionViewportSvg.tsx  — section view SVG (use as pattern)
packages/core/src/index.ts                                — interior_elevation_marker element
packages/web/src/plan/symbology.ts                        — plan symbols
```

Search for `interior_elevation`, `elevation_marker`, `buildElevationLines`, `ElevationViewport` in the codebase first.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `interior_elevation_marker` element kind. Read its fields — especially `viewDirections` (array of N/S/E/W), `roomId`, `positionMm`, `radiusMm`.
2. Search for `ElevationViewport` component — if it exists, read it fully.
3. Search for `buildElevationLines` — if it exists, read it fully.
4. Read `sectionViewportSvg.tsx` fully — use its SVG rendering pattern for the elevation viewport.
5. Search `symbology.ts` for `interior_elevation` — read the plan symbol.

---

## Tasks

### A — `buildElevationLines` in `elevationProjection.ts`

Create or extend `packages/web/src/plan/elevationProjection.ts`:

```ts
export type ElevationLine = {
  x1: number; y1: number; x2: number; y2: number;
  strokeWidth: number;
  kind: 'wall' | 'floor' | 'opening' | 'silhouette';
};

/**
 * Projects elements visible from `marker` in one view direction into 2D screen space.
 * direction: 'N' | 'S' | 'E' | 'W' — the camera looks in this direction.
 * viewWidthMm: horizontal extent of the view (e.g. 6000mm)
 * viewHeightMm: vertical extent (e.g. 3000mm)
 */
export function buildElevationLines(
  marker: Extract<Element, { kind: 'interior_elevation_marker' }>,
  direction: 'N' | 'S' | 'E' | 'W',
  elementsById: Record<string, Element | undefined>,
  viewWidthMm?: number,
  viewHeightMm?: number
): ElevationLine[] {
  // 1. Determine view frustum based on direction + marker position + radius
  //    - If direction='N': camera faces north (negative Y), view is centred at marker.positionMm
  //    - Project walls/floors/doors/windows within the frustum
  // 2. For each wall within the frustum:
  //    - Compute projected 2D coords (horizontal = along-view axis, vertical = Z)
  //    - strokeWidth: 2 for walls in cut plane, 1 for walls beyond cut plane
  //    - kind: 'wall'
  // 3. For each opening (door/window) within view:
  //    - Project door/window openings as rectangles
  //    - kind: 'opening', strokeWidth: 1
  // 4. For floors visible in the view:
  //    - Project as horizontal lines at base elevation
  //    - kind: 'floor', strokeWidth: 1.5
  // 5. Return all ElevationLine[]
}
```

---

### B — `InteriorElevationViewport.tsx`

Create `packages/web/src/plan/InteriorElevationViewport.tsx`:

```tsx
import React from 'react';
import { buildElevationLines } from './elevationProjection';
import type { Element } from '@bim-ai/core';

interface Props {
  marker: Extract<Element, { kind: 'interior_elevation_marker' }>;
  direction: 'N' | 'S' | 'E' | 'W';
  elementsById: Record<string, Element | undefined>;
  widthPx?: number;
  heightPx?: number;
}

export function InteriorElevationViewport({ marker, direction, elementsById, widthPx = 400, heightPx = 300 }: Props) {
  const viewWidthMm = (marker.radiusMm ?? 3000) * 2;
  const viewHeightMm = 3000;
  const lines = buildElevationLines(marker, direction, elementsById, viewWidthMm, viewHeightMm);

  const scaleX = widthPx / viewWidthMm;
  const scaleY = heightPx / viewHeightMm;

  return (
    <svg
      width={widthPx}
      height={heightPx + 36}
      data-testid={`interior-elevation-viewport-${direction}`}
      style={{ border: '1px solid #ccc', background: '#fff' }}
    >
      {/* Clip rect */}
      <rect x={0} y={0} width={widthPx} height={heightPx} fill="white" />

      {/* Elevation lines */}
      {lines.map((ln, i) => (
        <line
          key={i}
          x1={ln.x1 * scaleX}
          y1={heightPx - ln.y1 * scaleY}
          x2={ln.x2 * scaleX}
          y2={heightPx - ln.y2 * scaleY}
          stroke="#222"
          strokeWidth={ln.strokeWidth}
        />
      ))}

      {/* View title */}
      <g transform={`translate(0, ${heightPx + 6})`}>
        <line x1="0" y1="0" x2={widthPx * 0.5} y2="0" stroke="#222" strokeWidth="1" />
        <text
          x="4" y="14"
          fontSize="10"
          fontFamily="sans-serif"
          fill="#222"
          data-testid={`interior-elevation-title-${direction}`}
        >
          {`Interior Elevation — ${direction}`}
        </text>
      </g>
    </svg>
  );
}
```

---

### C — Interior elevation marker plan symbol (`symbology.ts`)

Find the interior elevation marker plan symbol in `symbology.ts`. If it just renders a circle, extend it to show direction arrows:

For each direction in `el.viewDirections` (e.g. `['N', 'E']`):
- Draw an arrow from the marker centre toward that direction (length = `el.radiusMm * 0.6`)
- Arrow tip gets a small filled triangle

```ts
// Direction vectors
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
for (const dir of el.viewDirections ?? ['N']) {
  const [dx, dz] = DIRS[dir];
  const arrowLen = (el.radiusMm ?? 1500) * 0.6 / 1000; // convert mm to metres
  // draw line from centre to tip
  // draw small arrowhead at tip
}
```

Add `userData.interiorElevDir = dir` to each arrow mesh.

---

### D — Integrate in sheets panel

In the sheets panel or wherever `sectionViewportSvg` is rendered, also render `InteriorElevationViewport` for `interior_elevation_marker` elements on the active sheet. If there is no existing sheet-viewport loop, skip this step and just ensure the component is importable.

---

### E — Tests

`packages/web/src/plan/interiorElevation.test.ts`:
```ts
describe('buildElevationLines — §6.1.5', () => {
  it('returns empty array when no elements in view', () => { ... });
  it('projects a wall within the frustum as an ElevationLine', () => { ... });
  it('wall ElevationLine has kind === "wall"', () => { ... });
  it('does not include walls outside the view frustum', () => { ... });
});
```

`packages/web/src/plan/InteriorElevationViewport.test.tsx`:
```ts
describe('InteriorElevationViewport — §6.1.5', () => {
  it('renders svg with data-testid interior-elevation-viewport-N', () => { ... });
  it('renders title text interior-elevation-title-N', () => { ... });
  it('renders one line element per ElevationLine', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/H): interior elevation rendering — projection + SVG viewport (§6.1.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new interior elevation tests.
