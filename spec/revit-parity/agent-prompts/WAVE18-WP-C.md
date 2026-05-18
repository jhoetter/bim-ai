# Wave 18 — WP-C: Detail Callout Full Rendering — Zoomed Geometry (§6.4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — plan_view element type (planViewSubtype, calloutBoundaryMm)
packages/web/src/plan/PlanCanvas.tsx                — plan canvas with camera and scene
packages/web/src/plan/symbology.ts                  — rebuildPlanMeshes (read it)
packages/web/src/workspace/Workspace.tsx            — view tab routing
packages/web/src/workspace/sheets/DetailCallout.tsx — (may exist) callout marker
packages/web/src/plan/PlanViewHeader.tsx            — view header with scale + badge
```

Search for `callout`, `planViewSubtype`, `callout_view`, `DetailRegion`, `calloutBoundary`, `calloutViewZoom` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `plan_view` element — read ALL fields, especially `planViewSubtype`, `calloutBoundaryMm`, `calloutScale`, `calloutHostViewId`.
2. `PlanCanvas.tsx`: read how the camera is set up — find `cameraOrtho`, `fitView`, or any zoom/camera initialisation logic.
3. `symbology.ts`: find `rebuildPlanMeshes` — read how `planViewSubtype` currently affects rendering.
4. `calloutViewZoom.test.tsx` (if exists): read — what is currently tested?
5. `PlanViewHeader.tsx`: read how scale and badge are shown.
6. `Workspace.tsx`: find how callout views are routed to the plan canvas — what data is passed as the active view.

---

## Tasks

### A — `calloutBoundaryMm` on `plan_view` in `core/index.ts`

Ensure `plan_view` has (add if missing):

```ts
/** For callout views: the rectangle in parent-view space that this callout zooms into. */
calloutBoundaryMm?: { xMm: number; yMm: number; widthMm: number; heightMm: number };
/** Explicit display scale denominator for callout (e.g. 20 means 1:20). Overrides auto-fit. */
calloutScaleOverride?: number;
/** The plan_view id this callout is scoped to (same level + filter settings). */
calloutHostViewId?: string | null;
```

---

### B — `calloutViewGeometryFilter.ts`

Create `packages/web/src/plan/calloutViewGeometryFilter.ts`:

```ts
import type { Element } from '@bim-ai/core';

type BoundaryMm = { xMm: number; yMm: number; widthMm: number; heightMm: number };

/**
 * Returns true if the element's centroid or any key point is inside (or overlaps) the callout boundary.
 * Used to filter elements rendered in a callout view.
 */
export function elementOverlapsBoundary(el: Element, boundary: BoundaryMm): boolean {
  const pts = getElementKeyPoints(el);
  if (pts.length === 0) return true; // include if no spatial info
  return pts.some(
    (p) =>
      p.xMm >= boundary.xMm &&
      p.xMm <= boundary.xMm + boundary.widthMm &&
      p.yMm >= boundary.yMm &&
      p.yMm <= boundary.yMm + boundary.heightMm,
  );
}

function getElementKeyPoints(el: Element): { xMm: number; yMm: number }[] {
  const e = el as any;
  const pts: { xMm: number; yMm: number }[] = [];
  if (e.startMm) pts.push(e.startMm);
  if (e.endMm) pts.push(e.endMm);
  if (e.positionMm) pts.push(e.positionMm);
  if (e.perimeterMm) pts.push(...e.perimeterMm);
  return pts;
}

/**
 * Computes the display scale denominator for a callout boundary in a given canvas width (px).
 * Returns e.g. 20 for 1:20 scale.
 */
export function computeCalloutScale(boundary: BoundaryMm, canvasWidthPx: number): number {
  // boundary is in mm; canvas is in px
  // 1 px ≈ 0.264 mm at 96dpi (but we work in abstract units)
  // Scale = boundaryWidthMm / (canvasWidthPx * 0.264)
  const scale = boundary.widthMm / (canvasWidthPx * 0.264);
  // Round to nearest standard scale
  const standards = [5, 10, 20, 25, 50, 100, 200, 500, 1000];
  return standards.reduce((prev, curr) =>
    Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev,
  );
}
```

---

### C — Camera zoom in `PlanCanvas.tsx`

When the active plan view has `planViewSubtype === 'callout'` and `calloutBoundaryMm` is defined, zoom/fit the camera to the callout boundary immediately on mount and when the view changes.

Find where the camera is initialised or fit-to-bounds is applied. Add logic:

```ts
// Inside the effect that initialises or resets the camera for the active view:
if (activePlanView?.planViewSubtype === 'callout' && activePlanView.calloutBoundaryMm) {
  const b = activePlanView.calloutBoundaryMm;
  // Set orthographic camera to exactly frame the callout boundary
  const cx = (b.xMm + b.widthMm / 2) / 1000; // convert mm → metres (or whatever unit Three.js uses)
  const cy = (b.yMm + b.heightMm / 2) / 1000;
  const hw = (b.widthMm / 1000 / 2) * 1.05; // 5% margin
  const hh = (b.heightMm / 1000 / 2) * 1.05;
  camera.left = cx - hw;
  camera.right = cx + hw;
  camera.top = cy + hh;
  camera.bottom = cy - hh;
  camera.position.set(cx, cy, 50);
  camera.lookAt(cx, cy, 0);
  camera.updateProjectionMatrix();
}
```

(Adjust coordinates to match your Three.js plan canvas coordinate system — the key idea is to fit the ortho frustum to the callout boundary.)

---

### D — Geometry filtering in `symbology.ts`

In `rebuildPlanMeshes`, when `activePlanView.planViewSubtype === 'callout'` and `calloutBoundaryMm` is defined, filter elements through `elementOverlapsBoundary` before adding their meshes to the scene. This ensures only elements within the callout area are rendered.

```ts
import { elementOverlapsBoundary } from '../plan/calloutViewGeometryFilter';

// In the elements loop:
if (view.planViewSubtype === 'callout' && view.calloutBoundaryMm) {
  if (!elementOverlapsBoundary(el, view.calloutBoundaryMm)) continue;
}
```

---

### E — Scale label in `PlanViewHeader.tsx`

When the active view is a callout view, show `computeCalloutScale(boundary, canvasWidth)` as `1:N` in the header:

```tsx
{
  activeView?.planViewSubtype === 'callout' && activeView.calloutBoundaryMm && (
    <span data-testid="callout-view-computed-scale">
      1:{computeCalloutScale(activeView.calloutBoundaryMm, canvasWidthPx)}
    </span>
  );
}
```

---

### F — Tests

`packages/web/src/plan/calloutViewGeometryFilter.test.ts`:

```ts
describe('elementOverlapsBoundary — §6.4.1', () => {
  it('element with positionMm inside boundary returns true', () => { ... });
  it('element with positionMm outside boundary returns false', () => { ... });
  it('wall with startMm inside and endMm outside returns true', () => { ... });
  it('element with no spatial info returns true (inclusive)', () => { ... });
});

describe('computeCalloutScale — §6.4.1', () => {
  it('returns a standard scale value', () => { ... });
  it('small boundary returns small scale (e.g. 20)', () => { ... });
  it('large boundary returns large scale (e.g. 200)', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/C): detail callout full rendering — geometry filter + camera zoom + scale label (§6.4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new callout view tests.
