# Wave 19 — WP-B: Detail Callout Camera Zoom + Rendering Wire-up (§6.4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-C created:

- `packages/web/src/plan/calloutViewGeometryFilter.ts` — `elementOverlapsBoundary()` + `computeCalloutScale()`
- `packages/web/src/plan/calloutViewGeometryFilter.test.ts` — 6 tests (all pass)

**Still missing:**

- Camera zoom in `PlanCanvas.tsx` to fit `calloutBoundaryMm` on mount
- Geometry filtering in `symbology.ts` / `rebuildPlanMeshes` to only render elements within boundary
- Scale label in `PlanViewHeader.tsx` using `computeCalloutScale`

---

## Repo orientation

```
packages/core/src/index.ts                           — plan_view element (read calloutBoundaryMm field)
packages/web/src/plan/PlanCanvas.tsx                 — camera setup, fit-to-view logic
packages/web/src/plan/symbology.ts                   — rebuildPlanMeshes
packages/web/src/plan/PlanViewHeader.tsx             — view header
packages/web/src/plan/calloutViewGeometryFilter.ts   — elementOverlapsBoundary (already exists)
```

Read `PlanCanvas.tsx` carefully for the camera type (orthographic), how it is initialised, and where camera position is set. Read `symbology.ts` for the elements loop in `rebuildPlanMeshes`. Read `PlanViewHeader.tsx` for how badges/labels are rendered.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Ensure `calloutBoundaryMm` exists on `plan_view` in `core/index.ts`

Add if not present:

```ts
calloutBoundaryMm?: { xMm: number; yMm: number; widthMm: number; heightMm: number } | null;
calloutScaleOverride?: number | null;
calloutHostViewId?: string | null;
```

---

### B — Camera fit in `PlanCanvas.tsx`

Find the camera initialisation `useEffect` (or wherever the plan canvas sets up its Three.js orthographic camera). Add logic: when the active view is a callout view (`planViewSubtype === 'callout'`) and `calloutBoundaryMm` is defined, set the camera frustum to exactly frame the boundary.

Look for the THREE.js camera (`OrthographicCamera`) and its `left`, `right`, `top`, `bottom` properties. The plan canvas coordinate system likely maps mm to metres (÷1000) or keeps raw mm — read the existing camera setup to determine the scale factor.

```ts
useEffect(() => {
  if (!activePlanView) return;
  if (activePlanView.planViewSubtype === 'callout' && activePlanView.calloutBoundaryMm) {
    const b = activePlanView.calloutBoundaryMm;
    const s = 1 / 1000; // mm → metres, adjust if different
    const cx = (b.xMm + b.widthMm / 2) * s;
    const cy = (b.yMm + b.heightMm / 2) * s;
    const hw = (b.widthMm / 2) * s * 1.1;
    const hh = (b.heightMm / 2) * s * 1.1;
    camera.left = cx - hw;
    camera.right = cx + hw;
    camera.top = cy + hh;
    camera.bottom = cy - hh;
    camera.updateProjectionMatrix();
    // Also set controls target if orbit controls exist
  }
}, [activePlanView?.id, activePlanView?.calloutBoundaryMm]);
```

---

### C — Geometry filter in `symbology.ts`

In `rebuildPlanMeshes`, find the main elements loop. When the active view has `planViewSubtype === 'callout'` and `calloutBoundaryMm` is set, skip elements that don't overlap the boundary:

```ts
import { elementOverlapsBoundary } from '../plan/calloutViewGeometryFilter';

// Inside the element loop, before building the mesh:
if (opts?.view?.planViewSubtype === 'callout' && opts?.view?.calloutBoundaryMm) {
  if (!elementOverlapsBoundary(el, opts.view.calloutBoundaryMm)) continue;
}
```

The exact parameter name for the active view in `rebuildPlanMeshes` may differ — read the function signature.

---

### D — Scale label in `PlanViewHeader.tsx`

Import `computeCalloutScale` from `calloutViewGeometryFilter`. Add a scale display when the active view is a callout:

```tsx
import { computeCalloutScale } from '../plan/calloutViewGeometryFilter';

// In the PlanViewHeader render, alongside existing badges:
{
  activeView?.planViewSubtype === 'callout' && activeView.calloutBoundaryMm && (
    <span data-testid="callout-computed-scale" style={{ fontSize: 11, opacity: 0.7 }}>
      1:{computeCalloutScale(activeView.calloutBoundaryMm, 800)}
    </span>
  );
}
```

(Use a fixed `canvasWidthPx = 800` as a reasonable default since exact canvas width isn't readily available in the header.)

---

### E — Tests

`packages/web/src/plan/calloutViewRender.test.ts`:

```ts
import { elementOverlapsBoundary, computeCalloutScale } from './calloutViewGeometryFilter';

describe('callout view rendering — §6.4.1', () => {
  it('elementOverlapsBoundary includes element with positionMm inside boundary', () => { ... });
  it('elementOverlapsBoundary excludes element outside boundary', () => { ... });
  it('computeCalloutScale returns a number', () => { ... });
  it('computeCalloutScale returns one of the standard scale values', () => {
    const result = computeCalloutScale({ xMm: 0, yMm: 0, widthMm: 5000, heightMm: 5000 }, 800);
    expect([5, 10, 20, 25, 50, 100, 200, 500, 1000]).toContain(result);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/B): detail callout camera zoom + geometry filter + scale label (§6.4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
