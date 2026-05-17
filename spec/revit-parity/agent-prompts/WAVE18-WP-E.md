# Wave 18 — WP-E: Auto-Detect Floor Boundary from Walls + Floor Edge Profile (§2.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — floor element type
packages/web/src/plan/PlanCanvas.tsx                — floor tool wiring
packages/web/src/tools/toolGrammar.ts               — floor grammar
packages/web/src/plan/ceilingAutoDetect.ts          — ceiling boundary detection (USE AS PATTERN)
packages/web/src/viewport/meshBuilders.ts           — floor 3D mesh
packages/web/src/workspace/inspector/InspectorContent.tsx — floor inspector
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Search for `floor`, `FloorState`, `reduceFloor`, `floor_sketch`, `ceilingAutoDetect`, `detectCeilingBoundary`, `floorEdge` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: read the `floor` element type — all fields, especially `perimeterMm`, `thicknessMm`, `floorTypeId`.
2. `ceilingAutoDetect.ts`: read FULLY — this is the pattern to follow for auto-detecting the boundary from walls.
3. `toolGrammar.ts`: find `reduceFloor` or `FloorSketchState` — read how floor sketching works.
4. `PlanCanvas.tsx`: find how the floor tool handles clicks — how does it enter sketch mode?
5. `InspectorContent.tsx` `case 'floor':`: read the inspector.

---

## Tasks

### A — Floor element additional fields in `core/index.ts`

Add optional fields to the `floor` element (if not present):

```ts
/** Optional: edge profile points (cross-section of the floor slab edge). */
edgeProfileMm?: { xMm: number; yMm: number }[];
/** When true, auto-detected boundary from enclosing walls was used. */
autoDetectedBoundary?: boolean;
```

---

### B — `detectFloorBoundaryFromWalls.ts`

Create `packages/web/src/plan/detectFloorBoundaryFromWalls.ts` following the same pattern as `ceilingAutoDetect.ts`:

```ts
import type { Element } from '@bim-ai/core';

type PointMm = { xMm: number; yMm: number };

/**
 * Detects the floor boundary by finding wall elements on the active level
 * and computing their inner-face convex hull (or bounding box as fallback).
 *
 * Returns null if no enclosing walls are found.
 */
export function detectFloorBoundaryFromWalls(
  clickMm: PointMm,
  elementsById: Record<string, Element | undefined>,
  activeLevelId: string | null,
): PointMm[] | null {
  const walls = Object.values(elementsById).filter(
    el => el?.kind === 'wall' && (activeLevelId == null || (el as any).levelId === activeLevelId)
  );

  if (walls.length === 0) return null;

  // Collect all wall endpoints
  const pts: PointMm[] = [];
  for (const wall of walls) {
    const w = wall as any;
    if (w.startMm) pts.push(w.startMm);
    if (w.endMm) pts.push(w.endMm);
  }

  if (pts.length < 3) return null;

  // Compute convex hull (simple gift-wrapping)
  return convexHull(pts);
}

function convexHull(pts: PointMm[]): PointMm[] {
  // Sort lexicographically
  const sorted = [...pts].sort((a, b) => a.xMm - b.xMm || a.yMm - b.yMm);
  const cross = (o: PointMm, a: PointMm, b: PointMm) =>
    (a.xMm - o.xMm) * (b.yMm - o.yMm) - (a.yMm - o.yMm) * (b.xMm - o.xMm);

  const lower: PointMm[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: PointMm[] = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  // Remove last point of each half (it's repeated at the start of the other)
  lower.pop(); upper.pop();
  return [...lower, ...upper];
}
```

---

### C — Floor tool integration in `PlanCanvas.tsx` or `toolGrammar.ts`

When the floor tool is active and the user **shift-clicks** (or the grammar supports a `detect` event), call `detectFloorBoundaryFromWalls(clickMm, elementsById, activeLevelId)` and if a boundary is returned, immediately emit `createFloor` with `perimeterMm = boundary, autoDetectedBoundary: true`.

If the grammar has an `auto-detect` event type, add it. If not, handle it as a modifier (shift-click) in the PlanCanvas floor tool handler.

Show a status-bar hint: "Click to place floor manually. Shift+click to auto-detect boundary from walls."

---

### D — Floor edge profile inspector

In `InspectorContent.tsx`, in `case 'floor':`, add an "Edge Profile" collapsible section:

```tsx
<details>
  <summary data-testid="inspector-floor-edge-profile-toggle">Edge Profile</summary>
  <div>
    {(el.edgeProfileMm ?? []).map((pt, i) => (
      <div key={i} data-testid={`inspector-floor-edge-pt-${i}`}>
        <input type="number" value={pt.xMm}
          onChange={e => { ... update edgeProfileMm[i].xMm ... }} />
        <input type="number" value={pt.yMm}
          onChange={e => { ... update edgeProfileMm[i].yMm ... }} />
      </div>
    ))}
    <button data-testid="inspector-floor-edge-add-pt"
      onClick={() => { ... append { xMm: 0, yMm: 0 } ... }}>+ Point</button>
    <button data-testid="inspector-floor-edge-clear"
      onClick={() => onPropertyChange('edgeProfileMm', [])}>Clear</button>
  </div>
</details>
```

---

### E — Palette command + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'tool.floor-auto-detect', label: 'Auto-Detect Floor Boundary',
  keywords: ['floor', 'auto', 'detect', 'boundary', 'wall'],
  category: 'tool', invoke: (ctx) => ctx.setFloorAutoDetect?.() }
```

In `commandCapabilities.ts`:
```ts
{ id: 'tool.floor-auto-detect', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### F — Tests

`packages/web/src/plan/detectFloorBoundaryFromWalls.test.ts`:

```ts
describe('detectFloorBoundaryFromWalls — §2.4.2', () => {
  it('returns null when no walls exist', () => { ... });
  it('returns a polygon for four bounding walls', () => { ... });
  it('returned polygon has at least 3 points', () => { ... });
  it('filters walls by levelId when provided', () => { ... });
  it('returns null when fewer than 3 points collected', () => { ... });
});

describe('convexHull — §2.4.2', () => {
  it('hull of a square is 4 corners', () => { ... });
  it('hull of collinear points degenerates gracefully', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/E): auto-detect floor boundary from walls + floor edge profile inspector (§2.4.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new floor boundary tests.
