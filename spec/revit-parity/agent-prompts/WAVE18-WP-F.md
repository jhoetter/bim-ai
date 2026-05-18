# Wave 18 — WP-F: Per-View Crop Region Drag Handles (§1.6.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — plan_view element type (cropRegionMm may exist)
packages/web/src/plan/PlanCanvas.tsx                — plan canvas (camera, mouse events)
packages/web/src/plan/GripLayer.tsx                 — SVG grip overlay in plan view
packages/web/src/plan/PlanViewHeader.tsx            — plan view header
packages/web/src/workspace/Workspace.tsx            — onSemanticCommand dispatch
packages/web/src/workspace/inspector/InspectorContent.tsx
```

Search for `cropRegion`, `crop_region`, `cropRegionMm`, `viewRangeMm`, `ViewRangeDialog`, `fitView`, `cropEnabled` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: read `plan_view` fully — does `cropRegionMm` exist? What fields are there for crop?
2. `PlanCanvas.tsx`: read the camera setup and any existing crop-region rendering or clipping logic.
3. `GripLayer.tsx`: read how grips are rendered in SVG — this is where crop-region handles will live.
4. `PlanViewHeader.tsx`: find the crop region toggle button if it exists.
5. `ViewRangeDialog.tsx` (if exists): read — is crop region separate from view range?

---

## Tasks

### A — `cropRegionMm` on `plan_view` in `core/index.ts`

Ensure `plan_view` has (add if missing):

```ts
/** Crop region bounding box in plan-view space (mm). When set, only geometry inside is shown. */
cropRegionMm?: { xMm: number; yMm: number; widthMm: number; heightMm: number } | null;
/** Whether the crop region is active (visible + clipping enabled). */
cropRegionEnabled?: boolean;
```

---

### B — `cropRegionGrips.ts`

Create `packages/web/src/plan/cropRegionGrips.ts`:

```ts
export type CropRegionMm = { xMm: number; yMm: number; widthMm: number; heightMm: number };
export type CropEdge = 'left' | 'right' | 'top' | 'bottom';

export interface CropRegionGrip {
  edge: CropEdge;
  /** Position of the grip handle in plan space (mm). */
  gripMm: { xMm: number; yMm: number };
}

export function getCropRegionGrips(crop: CropRegionMm): CropRegionGrip[] {
  return [
    { edge: 'left', gripMm: { xMm: crop.xMm, yMm: crop.yMm + crop.heightMm / 2 } },
    { edge: 'right', gripMm: { xMm: crop.xMm + crop.widthMm, yMm: crop.yMm + crop.heightMm / 2 } },
    { edge: 'bottom', gripMm: { xMm: crop.xMm + crop.widthMm / 2, yMm: crop.yMm } },
    { edge: 'top', gripMm: { xMm: crop.xMm + crop.widthMm / 2, yMm: crop.yMm + crop.heightMm } },
  ];
}

/**
 * Applies a drag delta to an edge of the crop region.
 * Returns the updated crop region.
 */
export function applyCropGripDrag(
  crop: CropRegionMm,
  edge: CropEdge,
  deltaMm: { xMm: number; yMm: number },
  minSizeMm = 500,
): CropRegionMm {
  const c = { ...crop };
  switch (edge) {
    case 'left': {
      const newX = Math.min(c.xMm + deltaMm.xMm, c.xMm + c.widthMm - minSizeMm);
      c.widthMm += c.xMm - newX;
      c.xMm = newX;
      break;
    }
    case 'right': {
      c.widthMm = Math.max(minSizeMm, c.widthMm + deltaMm.xMm);
      break;
    }
    case 'bottom': {
      const newY = Math.min(c.yMm + deltaMm.yMm, c.yMm + c.heightMm - minSizeMm);
      c.heightMm += c.yMm - newY;
      c.yMm = newY;
      break;
    }
    case 'top': {
      c.heightMm = Math.max(minSizeMm, c.heightMm + deltaMm.yMm);
      break;
    }
  }
  return c;
}
```

---

### C — Crop region overlay in `GripLayer.tsx` (or `PlanCanvas.tsx`)

When the active plan view has `cropRegionEnabled: true` and `cropRegionMm` is set, render:

1. A dashed blue rectangle SVG outline at the crop boundary
2. Four square grip handles (10×10 px) at the midpoint of each edge
3. Drag behaviour: on mousedown on a grip, track mouse delta in plan-space mm, call `applyCropGripDrag`, dispatch `updateElementProperty` to update `cropRegionMm` on the active plan_view

Use SVG positioned absolutely over the plan canvas. The SVG overlay should use `data-testid="crop-region-overlay"` and each grip `data-testid="crop-grip-{edge}"` (left/right/top/bottom).

---

### D — Crop clipping in plan rendering

In `PlanCanvas.tsx` or `symbology.ts`, when `cropRegionEnabled` is true and `cropRegionMm` is set, add Three.js clipping planes to `renderer.clippingPlanes` to clip the rendered scene to the crop boundary:

```ts
if (view.cropRegionEnabled && view.cropRegionMm) {
  const c = view.cropRegionMm;
  const s = 1 / 1000; // mm → units
  renderer.clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -c.xMm * s), // left
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), (c.xMm + c.widthMm) * s), // right
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -c.yMm * s), // bottom
    new THREE.Plane(new THREE.Vector3(0, -1, 0), (c.yMm + c.heightMm) * s), // top
  ];
  renderer.localClippingEnabled = true;
} else {
  renderer.clippingPlanes = [];
  renderer.localClippingEnabled = false;
}
```

---

### E — Crop region toggle in `PlanViewHeader.tsx`

Add a crop region toggle button:

```tsx
<button
  data-testid="plan-view-crop-toggle"
  onClick={() => onPropertyChange('cropRegionEnabled', !activeView.cropRegionEnabled)}
  title="Toggle crop region"
  style={{ fontWeight: activeView?.cropRegionEnabled ? 'bold' : 'normal' }}
>
  ⌗
</button>
```

Also add a "Reset Crop" button that sets `cropRegionMm: null` (`data-testid="plan-view-crop-reset"`).

---

### F — Inspector for crop region

In `InspectorContent.tsx` `case 'plan_view':`, add a "Crop Region" section:

```tsx
<label>
  Crop Enabled
  <input
    type="checkbox"
    data-testid="inspector-crop-enabled"
    checked={el.cropRegionEnabled ?? false}
    onChange={(e) => onPropertyChange('cropRegionEnabled', e.target.checked)}
  />
</label>;
{
  el.cropRegionMm && (
    <div>
      <span data-testid="inspector-crop-x">X: {el.cropRegionMm.xMm} mm</span>
      <span data-testid="inspector-crop-y">Y: {el.cropRegionMm.yMm} mm</span>
      <span data-testid="inspector-crop-w">W: {el.cropRegionMm.widthMm} mm</span>
      <span data-testid="inspector-crop-h">H: {el.cropRegionMm.heightMm} mm</span>
    </div>
  );
}
```

---

### G — Tests

`packages/web/src/plan/cropRegionGrips.test.ts`:

```ts
describe('getCropRegionGrips — §1.6.10', () => {
  it('returns 4 grips for a valid crop region', () => { ... });
  it('left grip is at left edge midpoint', () => { ... });
  it('right grip is at right edge midpoint', () => { ... });
  it('top grip is at top edge midpoint', () => { ... });
  it('bottom grip is at bottom edge midpoint', () => { ... });
});

describe('applyCropGripDrag — §1.6.10', () => {
  it('dragging right edge increases width', () => { ... });
  it('dragging left edge past minimum is clamped', () => { ... });
  it('dragging top edge increases height', () => { ... });
  it('does not mutate original crop region', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/F): per-view crop region drag handles — grips + clipping planes + toggle button (§1.6.10)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new crop region grip tests.
