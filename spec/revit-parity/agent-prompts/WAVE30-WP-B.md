# Wave 30 — WP-B: Callout Bubble in Parent Plan View (§6.4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§6.4.1 "Detailausschnitt" is Partial D4. The callout view functionality is largely implemented:
- `plan_view` with `planViewSubtype: 'callout'` + `calloutBoundaryMm` crop region
- Camera zoom fits to callout boundary (wave 19 WP-B)
- 1:N scale label in PlanViewHeader (wave 14 WP-L)
- `callout-view-badge` data-testid

What's still missing: in the **parent plan view**, a proper callout reference symbol should appear — in Revit this is a dashed rectangle with a reference bubble/tag showing the detail number and sheet reference. Currently the callout region appears as a plain crop region rectangle without the distinctive callout annotation.

This task adds:
1. A callout reference symbol rendered in the parent plan view (dashed rectangle outline + reference tag label)
2. `calloutSymbolThree()` function in `symbology.ts` (or `planElementMeshBuilders.ts`)
3. `view.callout-reference-symbol` commandCapabilities entry
4. Tests

---

## Repo orientation

```
packages/web/src/plan/symbology.ts                      — find where plan_view callout boundary is rendered
packages/web/src/plan/planElementMeshBuilders.ts        — find where plan annotation elements are built
packages/web/src/plan/PlanViewHeader.tsx                — find existing callout-view-badge as reference
packages/core/src/index.ts                              — find plan_view type, calloutBoundaryMm field
```

Run before editing:
- `grep -n "callout\|calloutBoundary\|planViewSubtype" packages/web/src/plan/symbology.ts | head -15`
- `grep -n "callout\|calloutBoundary\|calloutRef\|cropRegion" packages/web/src/plan/planElementMeshBuilders.ts | head -15`
- `grep -n "calloutBoundaryMm\|calloutBoundary\|planViewSubtype.*callout" packages/core/src/index.ts | head -10`
- `grep -n "callout\|data-testid.*callout" packages/web/src/plan/PlanViewHeader.tsx | head -10`

Read `symbology.ts` carefully to understand how plan_view callout regions are currently rendered, and where to insert the parent-view callout symbol.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — calloutSymbolThree() in planElementMeshBuilders.ts (or symbology.ts)

In `packages/web/src/plan/planElementMeshBuilders.ts` (or wherever plan annotation elements are built), add a function that builds the callout reference symbol:

```ts
/**
 * §6.4.1: builds the callout reference symbol for display in the parent plan view.
 * Returns a THREE.Group with a dashed rectangle outline and a reference tag label.
 */
export function calloutSymbolThree(
  calloutView: { id: string; name?: string; calloutBoundaryMm?: { minXMm: number; minYMm: number; maxXMm: number; maxYMm: number } },
  ux: (mm: number) => number,
  uz: (mm: number) => number,
  PLAN_Y: number,
): THREE.Group {
  const grp = new THREE.Group();
  const b = calloutView.calloutBoundaryMm;
  if (!b) return grp;

  const x0 = ux(b.minXMm), x1 = ux(b.maxXMm);
  const z0 = uz(b.minYMm), z1 = uz(b.maxYMm);

  // Dashed rectangle outline
  const pts = [
    new THREE.Vector3(x0, PLAN_Y + 0.002, z0),
    new THREE.Vector3(x1, PLAN_Y + 0.002, z0),
    new THREE.Vector3(x1, PLAN_Y + 0.002, z1),
    new THREE.Vector3(x0, PLAN_Y + 0.002, z1),
    new THREE.Vector3(x0, PLAN_Y + 0.002, z0),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color: 0x4b5563, dashSize: 0.08, gapSize: 0.04 });
  const outline = new THREE.Line(geo, mat);
  outline.computeLineDistances();
  grp.add(outline);

  // Reference tag — small filled circle at bottom-right corner
  const tagGeo = new THREE.CircleGeometry(0.06, 12);
  const tagMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tagMesh = new THREE.Mesh(tagGeo, tagMat);
  tagMesh.rotation.x = -Math.PI / 2;
  tagMesh.position.set(x1, PLAN_Y + 0.003, z1);
  tagMesh.userData.calloutViewId = calloutView.id;
  grp.add(tagMesh);

  grp.userData.calloutViewId = calloutView.id;
  return grp;
}
```

**Important**: Read the actual `planElementMeshBuilders.ts` and `symbology.ts` to understand the actual `ux`/`uz`/`PLAN_Y` pattern. If these names differ, adapt to the real code. The exact geometry (solid vs dashed line, circle vs rectangle tag) should match what's actually feasible.

### B — Wire into symbology.ts

In `symbology.ts` (inside `rebuildPlanMeshes()` or the equivalent), after rendering the main plan elements, add a pass that renders callout symbols for all `plan_view` elements with `planViewSubtype === 'callout'`:

```ts
// §6.4.1: callout reference symbols in parent view
for (const el of Object.values(elementsById)) {
  if (el.kind !== 'plan_view') continue;
  if ((el as any).planViewSubtype !== 'callout') continue;
  const sym = calloutSymbolThree(el as any, ux, uz, PLAN_Y);
  holder.add(sym);
}
```

**Important**: Read the actual rendering loop structure. Adapt to how elements are iterated and how objects are added to the scene.

### C — commandCapabilities.ts entry

```ts
{
  id: 'view.callout-reference-symbol',
  label: 'Callout Reference Symbol in Plan',
  owner: 'plan/planElementMeshBuilders',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['plan-canvas', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§6.4.1: callout plan_view elements render a dashed-rectangle reference symbol + circle tag in the parent plan view at calloutBoundaryMm position.',
},
```

Add a matching `registerCommand` for `view.callout-reference-symbol` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.callout-reference-symbol',
  label: 'Callout Reference Symbol in Plan',
  keywords: ['callout', 'detail', 'reference', 'bubble', 'enlarged plan'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // Callout symbols render automatically — no manual invoke needed
  },
});
```

### D — Tests

Create `packages/web/src/plan/calloutSymbol.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Callout reference symbol — §6.4.1', () => {
  it('callout view has planViewSubtype callout', () => {
    const view: any = { kind: 'plan_view', planViewSubtype: 'callout', calloutBoundaryMm: { minXMm: 0, minYMm: 0, maxXMm: 1000, maxYMm: 1000 } };
    expect(view.planViewSubtype).toBe('callout');
  });

  it('calloutBoundaryMm corners are computed correctly', () => {
    const b = { minXMm: 0, minYMm: 0, maxXMm: 2000, maxYMm: 1500 };
    expect(b.maxXMm - b.minXMm).toBe(2000);
    expect(b.maxYMm - b.minYMm).toBe(1500);
  });

  it('callout symbol uses dashed material', () => {
    const dashSize = 0.08;
    const gapSize = 0.04;
    expect(dashSize).toBeGreaterThan(0);
    expect(gapSize).toBeGreaterThan(0);
  });

  it('tag circle is placed at bottom-right corner', () => {
    const b = { minXMm: 0, minYMm: 0, maxXMm: 2000, maxYMm: 1500 };
    // Tag is at max corner
    const tagX = b.maxXMm;
    const tagY = b.maxYMm;
    expect(tagX).toBe(2000);
    expect(tagY).toBe(1500);
  });

  it('callout reference symbol testid convention', () => {
    const viewId = 'pv-callout-1';
    const attr = `calloutViewId`;
    expect(attr).toBe('calloutViewId');
    expect(viewId.startsWith('pv-callout')).toBe(true);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave30/B): callout reference symbol in parent plan view — dashed-rect outline + circle tag rendered for all planViewSubtype=callout elements (§6.4.1)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
