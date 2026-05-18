# Wave 15 — WP-G: Elevation View Geometry Projection (§6.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/sectionProjectionWire.ts          — existing section wireframe projection (read this as model)
packages/web/src/plan/elevationMarker.test.ts           — elevation marker tests
packages/web/src/plan/interiorElevationMarker.test.ts   — interior elevation marker tests
packages/web/src/workspace/Workspace.tsx                — tab rendering
packages/web/src/plan/PlanCanvas.tsx                    — elevation view tab (or sectionViewportSvg)
packages/core/src/index.ts                              — elevation_view + interior_elevation_marker element types
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. **`sectionProjectionWire.ts`**: reads walls, floors, roofs from `elementsById`; applies a projection transform to produce 2D SVG paths. Read this fully — the elevation projection uses the same approach but from a different direction.

2. **`core/index.ts`**: find `elevation_view` element type. It likely has: `direction: 'N' | 'S' | 'E' | 'W'`, `positionMm`, `levelId`, `depthMm`, `cropMinMm`, `cropMaxMm`. Also find `interior_elevation_marker`.

3. Look for how elevation views are rendered today. Search for `elevation_view` in `Workspace.tsx` and `PlanCanvas.tsx`. There may already be a partial renderer — extend it rather than replacing.

4. Look for `sectionViewportSvg.tsx` or a similar file for section SVG rendering. If it exists, the elevation renderer should follow the same pattern.

---

## Tasks

### A — Elevation projection math

Create `packages/web/src/plan/elevationProjection.ts`:

```ts
import type { Element } from '@bim-ai/core';

type ElevationViewEl = Extract<Element, { kind: 'elevation_view' }>;

interface ElevationLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lineWeight?: number;
  dash?: boolean;
}

/**
 * Projects wall/door/window/floor outlines into 2D elevation space.
 * direction: 'N' looks south (camera at +Y looking -Y), etc.
 *
 * Returns a set of 2D SVG lines where:
 *   x-axis = horizontal (left-right along wall face)
 *   y-axis = vertical (elevation, 0 = project base)
 */
export function buildElevationLines(
  view: ElevationViewEl,
  elementsById: Record<string, Element | undefined>,
): ElevationLine[] {
  const lines: ElevationLine[] = [];
  const dir = view.direction ?? 'N';

  // Project transform: based on direction, swap axes
  // N (looking south): x = element.xMm, y = element.elevationMm, depth = element.yMm
  // S (looking north): x = -element.xMm, y = element.elevationMm, depth = -element.yMm
  // E (looking west):  x = element.yMm,  y = element.elevationMm, depth = element.xMm
  // W (looking east):  x = -element.yMm, y = element.elevationMm, depth = -element.xMm

  const project = (xMm: number, yMm: number): { x: number; y: number } => {
    switch (dir) {
      case 'N':
        return { x: xMm, y: yMm };
      case 'S':
        return { x: -xMm, y: yMm };
      case 'E':
        return { x: yMm, y: yMm };
      case 'W':
        return { x: -yMm, y: yMm };
    }
  };

  // For each wall in elementsById: project its plan footprint as a vertical rectangle
  for (const el of Object.values(elementsById)) {
    if (!el) continue;
    if (el.kind === 'wall') {
      // Project start/end into elevation space
      const s = project(el.startMm?.xMm ?? 0, el.startMm?.yMm ?? 0);
      const e = project(el.endMm?.xMm ?? 0, el.endMm?.yMm ?? 0);
      const baseElev = el.baseElevationMm ?? 0;
      const topElev = baseElev + (el.heightMm ?? 3000);
      // Horizontal line at top + bottom, vertical lines at ends
      lines.push({ x1: s.x, y1: baseElev, x2: e.x, y2: baseElev });
      lines.push({ x1: s.x, y1: topElev, x2: e.x, y2: topElev });
      lines.push({ x1: s.x, y1: baseElev, x2: s.x, y2: topElev });
      lines.push({ x1: e.x, y1: baseElev, x2: e.x, y2: topElev });
    }
    if (el.kind === 'floor') {
      // Project floor outline as horizontal line at baseElevationMm
      if (el.boundaryMm && el.boundaryMm.length >= 2) {
        const baseElev = el.baseElevationMm ?? 0;
        for (let i = 0; i < el.boundaryMm.length; i++) {
          const a = el.boundaryMm[i]!;
          const b = el.boundaryMm[(i + 1) % el.boundaryMm.length]!;
          const pa = project(a.xMm, a.yMm);
          const pb = project(b.xMm, b.yMm);
          lines.push({ x1: pa.x, y1: baseElev, x2: pb.x, y2: baseElev });
        }
      }
    }
  }

  return lines;
}
```

Adjust field names (`startMm`, `endMm`, `baseElevationMm`, `heightMm`, `boundaryMm`) to match what actually exists in core/index.ts for those element types — read the actual types before finalizing.

---

### B — Elevation view SVG renderer component

Create `packages/web/src/plan/ElevationViewport.tsx`:

```tsx
interface Props {
  view: Extract<Element, { kind: 'elevation_view' }>;
  elementsById: Record<string, Element | undefined>;
  widthPx: number;
  heightPx: number;
}

export function ElevationViewport({ view, elementsById, widthPx, heightPx }: Props) {
  const lines = useMemo(() => buildElevationLines(view, elementsById), [view, elementsById]);

  if (lines.length === 0) {
    return (
      <div
        data-testid="elevation-viewport-empty"
        style={{
          width: widthPx,
          height: heightPx,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-muted)',
          fontSize: 12,
        }}
      >
        No geometry to display
      </div>
    );
  }

  // Compute SVG bounding box from lines
  const allX = lines.flatMap((l) => [l.x1, l.x2]);
  const allY = lines.flatMap((l) => [l.y1, l.y2]);
  const minX = Math.min(...allX) - 500;
  const maxX = Math.max(...allX) + 500;
  const minY = Math.min(...allY) - 500;
  const maxY = Math.max(...allY) + 500;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <svg
      data-testid="elevation-viewport-svg"
      width={widthPx}
      height={heightPx}
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      style={{ transform: 'scaleY(-1)' }} /* flip Y so elevation 0 is at bottom */
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="#222"
          strokeWidth={l.lineWeight ?? 300}
          strokeDasharray={l.dash ? '500 300' : undefined}
        />
      ))}
    </svg>
  );
}
```

---

### C — Wire into Workspace or tab renderer

Find where elevation view tabs are rendered (search for `elevation_view` in `Workspace.tsx` or `tabFromElement`). When the active tab is an elevation view, render `<ElevationViewport view={el} elementsById={...} />` instead of the current placeholder.

---

### D — Tests

`packages/web/src/plan/elevationProjection.test.ts`:

```ts
describe('elevation projection — §6.1.4', () => {
  it('builds lines for a single wall in N direction', () => { ... });
  it('wall facing N produces 4 lines (top/bottom/left/right)', () => { ... });
  it('S direction mirrors X axis', () => { ... });
  it('floor boundary produces horizontal lines at base elevation', () => { ... });
  it('returns empty array when no elements', () => { ... });
});
```

`packages/web/src/plan/ElevationViewport.test.tsx`:

```ts
describe('ElevationViewport — §6.1.4', () => {
  it('renders elevation-viewport-empty when no lines', () => { ... });
  it('renders elevation-viewport-svg when lines present', () => { ... });
  it('SVG contains <line> elements for each projected line', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/G): elevation view geometry projection + SVG renderer (§6.1.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new elevation projection tests.
