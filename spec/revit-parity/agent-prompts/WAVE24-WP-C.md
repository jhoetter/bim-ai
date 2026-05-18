# Wave 24 — WP-C: Crop Region Interactive Editing in PlanCanvas (§1.6.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.10 "Ansichtssteuerung" is Partial. The view controls (detail level, visual style, sun/shadow, thin-lines, per-view VG overrides, crop region enable/disable) are all done. What's missing is **interactive drag editing of the crop region boundary**. The crop region can be toggled on/off, but users can't drag its edges to resize it.

The utility functions already exist:
- `getCropRegionGrips(crop)` in `packages/web/src/plan/cropRegionGrips.ts` — returns 4 or 8 edge/corner grips
- `applyCropGripDrag(crop, gripId, deltaMm)` in the same file — computes the new crop bounds after dragging a grip
- `cropRegionDragHandles.ts` is imported in PlanCanvas (for `pointInsideCrop`), but `cropRegionGrips.ts` is NOT wired into PlanCanvas pointer events

This task wires the existing crop region grips into PlanCanvas's mousedown/mousemove/mouseup flow.

---

## Repo orientation

```
packages/web/src/plan/cropRegionGrips.ts           — getCropRegionGrips, applyCropGripDrag, CropRegionGrip type
packages/web/src/plan/PlanCanvas.tsx               — main plan canvas; find activeDrag/gripDrag handling pattern
packages/web/src/plan/cropRegionDragHandles.ts     — already imported in PlanCanvas (see line 204)
```

Run before editing:
- `cat packages/web/src/plan/cropRegionGrips.ts` — read the full file to understand CropRegionGrip shape and function signatures
- `grep -n "cropRegionGrips\|getCropRegionGrips\|applyCropGripDrag" packages/web/src/plan/PlanCanvas.tsx`
- `grep -n "activeDrag\|gripDrag\|DRAG_STATE\|dragState\|mousedown\|pointerdown" packages/web/src/plan/PlanCanvas.tsx | head -20`
- `grep -n "updateCropRegion\|cropRegionMm\|setCropRegion" packages/web/src/workspace/Workspace.tsx | head -10`

Read the existing grip drag pattern in PlanCanvas carefully before adding crop grip drag.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Understand the crop region type

Run:
```
grep -n "cropRegionMm\|CropRegionMm\|cropMin\|cropMax" packages/web/src/plan/cropRegionGrips.ts | head -15
grep -n "updateCropRegion\|setCropBounds\|cropRegion" packages/core/src/index.ts | head -10
```

Find how the crop region bounds are stored on the plan_view element and how to dispatch an update command.

### B — Add updateCropRegion command if missing

Check if a `updateCropRegion` or `setCropRegion` command type exists in `packages/core/src/index.ts`:
```
grep -n "updateCropRegion\|setCropBounds\|CropBounds" packages/core/src/index.ts | head -5
```

If it doesn't exist, add:
```ts
export type UpdateCropRegionCmd = {
  type: 'updateCropRegion';
  planViewId: string;
  cropRegionMm: { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number };
};
```
Add to SemanticCommand union and export.

Also add a Workspace handler in `Workspace.tsx`:
```ts
if (cmd.type === 'updateCropRegion') {
  const { elementsById: cur } = useBimStore.getState();
  const pv = cur[cmd.planViewId as string];
  if (pv?.kind === 'plan_view') {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [pv.id]: { ...pv, cropRegionMm: cmd.cropRegionMm as any },
      },
    });
  }
  return;
}
```

### C — Wire crop region grips into PlanCanvas

In `packages/web/src/plan/PlanCanvas.tsx`:

1. Import `getCropRegionGrips` and `applyCropGripDrag` from `'./cropRegionGrips'`

2. Find the section in the pointer-down handler where element grips are checked. Add crop region grip hit-testing **before** element grips (crop grips take priority when the crop region is active):

```ts
// §1.6.10: crop region grip hit-test
if (activeCropState?.cropRegionMm && (activeCropState.cropRegionVisible || activeCropState.cropEnabled)) {
  const cropGrips = getCropRegionGrips(activeCropState.cropRegionMm);
  const HIT_RADIUS_MM = 80 / zoom; // screen pixels → mm
  const hit = cropGrips.find(
    (g) => Math.hypot(g.positionMm.xMm - planPt.xMm, g.positionMm.yMm - planPt.yMm) < HIT_RADIUS_MM,
  );
  if (hit) {
    // start crop grip drag
    setCropGripDrag({ gripId: hit.id, startPlanPt: planPt, cropAtStart: activeCropState.cropRegionMm });
    e.stopPropagation();
    return;
  }
}
```

3. Add `cropGripDrag` state variable:
```ts
const [cropGripDrag, setCropGripDrag] = React.useState<{
  gripId: string;
  startPlanPt: { xMm: number; yMm: number };
  cropAtStart: any;
} | null>(null);
```

4. In the pointer-move handler, when `cropGripDrag` is set:
```ts
if (cropGripDrag) {
  const deltaMm = {
    xMm: planPt.xMm - cropGripDrag.startPlanPt.xMm,
    yMm: planPt.yMm - cropGripDrag.startPlanPt.yMm,
  };
  const newCrop = applyCropGripDrag(cropGripDrag.cropAtStart, cropGripDrag.gripId, deltaMm);
  // dispatch preview update (optimistic)
  onSemanticCommand?.({
    type: 'updateCropRegion',
    planViewId: activePlanViewId,
    cropRegionMm: newCrop,
  });
}
```

5. In the pointer-up handler, clear `cropGripDrag`:
```ts
if (cropGripDrag) {
  setCropGripDrag(null);
  return;
}
```

**Important**: Read the actual PlanCanvas pointer event handlers carefully before inserting. The exact variable names and hook structure may differ. Adapt to what's actually in the file. Don't break existing grip drag or selection behavior.

### D — Render crop region grip handles as visual squares

The crop region dashed rectangle is already rendered (it's the existing crop box). To make grips visually discoverable, add small squares at grip positions in the plan overlay:

Find where the crop region rectangle is drawn in PlanCanvas (look for `cropRegionMm` in the Three.js scene building code). Add a `buildCropRegionGripHandles(cropRegionMm, zoom)` call that creates `THREE.Mesh` objects (small grey squares, 8×8 screen px in mm-space) at each of the 4 midpoints. Use `userData.isCropGrip = true` so they can be detected.

If this is complex, skip the visual handles — the functional drag wiring (parts B+C) is the key deliverable.

### E — commandCapabilities.ts entry

Add to `packages/web/src/workspace/commandCapabilities.ts`:

```ts
{
  id: 'view.update-crop-region',
  label: 'Resize Crop Region',
  owner: 'plan/PlanCanvas',
  group: 'view',
  scope: 'view',
  intendedModes: ['plan'],
  surfaces: ['canvas'],
  executionSurface: 'store',
  preconditions: ['crop-region-enabled'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.10: drag crop region boundary handles to resize the view crop.',
},
```

### F — Tests

Create `packages/web/src/plan/cropRegionGripWiring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getCropRegionGrips, applyCropGripDrag } from './cropRegionGrips';

const baseCrop = { minXMm: 0, minYMm: 0, maxXMm: 10000, maxYMm: 8000 };

describe('cropRegionGrips — §1.6.10', () => {
  it('getCropRegionGrips returns 4 or 8 grips', () => {
    const grips = getCropRegionGrips(baseCrop);
    expect(grips.length).toBeGreaterThanOrEqual(4);
  });

  it('each grip has positionMm and id', () => {
    const grips = getCropRegionGrips(baseCrop);
    for (const g of grips) {
      expect(typeof g.id).toBe('string');
      expect(typeof g.positionMm.xMm).toBe('number');
      expect(typeof g.positionMm.yMm).toBe('number');
    }
  });

  it('applyCropGripDrag updates the crop region', () => {
    const grips = getCropRegionGrips(baseCrop);
    const firstGrip = grips[0];
    const result = applyCropGripDrag(baseCrop, firstGrip.id, { xMm: 100, yMm: 0 });
    // At least one bound should change
    const changed =
      result.minXMm !== baseCrop.minXMm ||
      result.maxXMm !== baseCrop.maxXMm ||
      result.minYMm !== baseCrop.minYMm ||
      result.maxYMm !== baseCrop.maxYMm;
    expect(changed).toBe(true);
  });

  it('applyCropGripDrag preserves min < max invariant', () => {
    const grips = getCropRegionGrips(baseCrop);
    for (const g of grips) {
      const result = applyCropGripDrag(baseCrop, g.id, { xMm: 100, yMm: 100 });
      expect(result.minXMm).toBeLessThan(result.maxXMm);
      expect(result.minYMm).toBeLessThan(result.maxYMm);
    }
  });

  it('UpdateCropRegionCmd has correct shape', () => {
    const cmd = {
      type: 'updateCropRegion' as const,
      planViewId: 'pv1',
      cropRegionMm: { minXMm: 100, minYMm: 100, maxXMm: 5000, maxYMm: 4000 },
    };
    expect(cmd.type).toBe('updateCropRegion');
    expect(cmd.cropRegionMm.minXMm).toBe(100);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave24/C): crop region interactive editing — wire getCropRegionGrips/applyCropGripDrag into PlanCanvas + updateCropRegion command (§1.6.10)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
