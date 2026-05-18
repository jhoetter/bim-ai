# Wave 19 — WP-F: Crop Region Clipping Planes — Viewport Wiring + PlanViewHeader Toggle (§1.6.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-F created:

- `packages/web/src/plan/cropRegionGrips.ts` — `getCropRegionGrips()`, `applyCropGripDrag()`, `CropRegionMm`, `CropEdge`, `CropRegionGrip` types

**Still missing:**

- `cropRegionMm` + `cropRegionEnabled` fields on `plan_view` element in `core/index.ts`
- Three.js clipping planes applied in `Viewport.tsx` (or `symbology.ts`) based on the plan view's `cropRegionMm`
- `PlanViewHeader.tsx` — crop region on/off toggle button
- Palette command `view.toggle-crop-region` + capability graph entry

---

## Repo orientation

```
packages/core/src/index.ts
packages/web/src/plan/cropRegionGrips.ts           — utilities (already exist)
packages/web/src/plan/PlanCanvas.tsx               — plan canvas / symbology
packages/web/src/plan/PlanViewHeader.tsx           — view header
packages/web/src/viewport/Viewport.tsx             — 3D viewport (read how linked ghost clipping works)
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `PlanViewHeader.tsx` fully — understand existing badge layout. Read `PlanCanvas.tsx` or `symbology.ts` for how plan meshes are built — find where `rebuildPlanMeshes` is called.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — `plan_view` additional fields in `core/index.ts`

Add if not present on the `plan_view` element:

```ts
cropRegionMm?: { xMm: number; yMm: number; widthMm: number; heightMm: number } | null;
cropRegionEnabled?: boolean;
```

---

### B — Clipping planes in `PlanCanvas.tsx`

In `PlanCanvas.tsx`, find the Three.js renderer and scene. When the active plan view has `cropRegionEnabled: true` and `cropRegionMm` set, add four `THREE.Plane` objects as renderer clipping planes:

```ts
import * as THREE from 'three';
import { CropRegionMm } from '../plan/cropRegionGrips';

// Inside the useEffect or render loop that runs when activePlanView changes:
function applyPlanCropClipping(
  renderer: THREE.WebGLRenderer,
  crop: CropRegionMm | null | undefined,
  enabled: boolean,
) {
  if (!enabled || !crop) {
    renderer.clippingPlanes = [];
    renderer.localClippingEnabled = false;
    return;
  }
  const s = 1 / 1000; // mm → metres
  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -crop.xMm * s), // left
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), (crop.xMm + crop.widthMm) * s), // right
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -crop.yMm * s), // bottom
    new THREE.Plane(new THREE.Vector3(0, -1, 0), (crop.yMm + crop.heightMm) * s), // top
  ];
}
```

Call `applyPlanCropClipping(renderer, activePlanView?.cropRegionMm, activePlanView?.cropRegionEnabled ?? false)` in the appropriate `useEffect` (keyed on `activePlanView?.id`, `activePlanView?.cropRegionMm`, `activePlanView?.cropRegionEnabled`).

If the plan canvas uses a `<canvas>` ref and a Three.js `WebGLRenderer`, find it and apply clipping planes there. If the renderer is managed differently (e.g. in a separate hook), follow the same pattern adapted to that structure.

Clean up clipping planes on unmount:

```ts
return () => {
  renderer.clippingPlanes = [];
  renderer.localClippingEnabled = false;
};
```

---

### C — PlanViewHeader toggle button

In `PlanViewHeader.tsx`, add a crop region toggle button alongside the existing badges:

```tsx
import { getCropRegionGrips } from '../plan/cropRegionGrips';

// In the PlanViewHeader render:
{
  activeView?.cropRegionMm && (
    <button
      data-testid="plan-header-crop-region-toggle"
      style={{ fontSize: 11, padding: '1px 6px', opacity: activeView.cropRegionEnabled ? 1 : 0.5 }}
      onClick={() => onPropertyChange?.('cropRegionEnabled', !activeView.cropRegionEnabled)}
      title={
        activeView.cropRegionEnabled
          ? 'Crop region ON — click to disable'
          : 'Crop region OFF — click to enable'
      }
    >
      {activeView.cropRegionEnabled ? '⬜ Crop ON' : '⬜ Crop OFF'}
    </button>
  );
}
```

---

### D — Palette command + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'view.toggle-crop-region', label: 'Toggle Crop Region',
  keywords: ['crop', 'region', 'boundary', 'clip', 'view', 'frame'],
  category: 'command', invoke: (ctx) => {
    const view = ctx.activePlanView;
    if (view) void ctx.onPropertyChange?.(view.id, 'cropRegionEnabled', !view.cropRegionEnabled);
  } }
```

In `commandCapabilities.ts`:

```ts
{ id: 'view.toggle-crop-region', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### E — Tests

`packages/web/src/plan/cropRegionClipping.test.ts`:

```ts
import { getCropRegionGrips, applyCropGripDrag } from './cropRegionGrips';
import type { CropRegionMm } from './cropRegionGrips';

describe('crop region clipping — §1.6.10', () => {
  const crop: CropRegionMm = { xMm: 0, yMm: 0, widthMm: 10000, heightMm: 8000 };

  it('getCropRegionGrips returns 4 grips', () => {
    const grips = getCropRegionGrips(crop);
    expect(grips).toHaveLength(4);
  });

  it('grip edges are left, right, top, bottom', () => {
    const grips = getCropRegionGrips(crop);
    const edges = grips.map((g) => g.edge).sort();
    expect(edges).toEqual(['bottom', 'left', 'right', 'top']);
  });

  it('applyCropGripDrag right edge increases width', () => {
    const result = applyCropGripDrag(crop, 'right', { xMm: 500, yMm: 0 });
    expect(result.widthMm).toBe(10500);
  });

  it('applyCropGripDrag left edge shifts x and reduces width', () => {
    const result = applyCropGripDrag(crop, 'left', { xMm: 1000, yMm: 0 });
    expect(result.xMm).toBe(1000);
    expect(result.widthMm).toBe(9000);
  });

  it('applyCropGripDrag enforces minimum size', () => {
    const result = applyCropGripDrag(crop, 'right', { xMm: -15000, yMm: 0 }, 500);
    expect(result.widthMm).toBeGreaterThanOrEqual(500);
  });

  it('applyCropGripDrag top edge increases height', () => {
    const result = applyCropGripDrag(crop, 'top', { xMm: 0, yMm: 1000 });
    expect(result.heightMm).toBe(9000);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/F): crop region clipping planes — THREE.js clip planes wiring + PlanViewHeader toggle (§1.6.10)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
