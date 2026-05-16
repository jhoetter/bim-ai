# Wave 7 — WP-F: Terrain Contour Lines Plan Overlay (§5.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — toposolid element, plan_view element
packages/web/src/viewport/meshBuilders.ts               — makeToposolidMesh, toposolidHeightMmAtPoint
packages/web/src/plan/symbology.ts                       — plan rendering loops (find toposolid loop)
packages/web/src/plan/planElementMeshBuilders.ts        — plan symbol helpers
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `toposolid` element in `core/index.ts`: `{ boundaryMm: BoundaryPoint[], heightSamples?: HeightSample[], heightmapGridMm?, thicknessMm, baseElevationMm? }`
- `HeightSample = { xMm, yMm, zMm }` — the existing control points
- `toposolidHeightMmAtPoint(topo, point)` in `meshBuilders.ts` does nearest-neighbour interpolation from heightSamples
- `plan_view` element already has `viewRangeTopMm`, `viewRangeBottomMm` — you'll store `contourIntervalMm` here
- The toposolid plan rendering loop in `symbology.ts` — find it (search for `toposolid`) and add the contour overlay after the existing boundary outline

---

## Tasks

### A — Data model: contourIntervalMm

Add `contourIntervalMm?: number | null` to the `toposolid` element in `core/index.ts`:
```ts
/** Contour line interval in mm for plan view display. 0 or null = no contours. */
contourIntervalMm?: number | null;
```

### B — Contour line generator

Create `packages/web/src/plan/terrainContourLines.ts`:

```ts
export function terrainContourLinesMm(
  heightSamples: Array<{ xMm: number; yMm: number; zMm: number }>,
  boundary: Array<{ xMm: number; yMm: number }>,
  contourIntervalMm: number,
): Array<Array<{ xMm: number; yMm: number }>>
```

Algorithm (marching squares approximation over the sample grid):
1. Compute AABB of `boundary`
2. Build a regular sampling grid: step = `Math.max(500, contourIntervalMm / 2)` mm across the AABB
3. For each grid cell (4 corners): sample the height at each corner using the nearest-neighbour interpolation from `heightSamples` (same logic as `toposolidHeightMmAtPoint`)
4. For each elevation level `z` at multiples of `contourIntervalMm` (from `min(zMm)` to `max(zMm)`): use linear interpolation along each cell edge where the height crosses `z` to find intersection points; connect intersections into polylines
5. Filter out points outside `boundary` polygon (point-in-polygon check)
6. Return array of polylines (each is `{ xMm, yMm }[]`)

Keep it simple: if `heightSamples` is empty or fewer than 3, return `[]`.

### C — Plan renderer

Create `packages/web/src/plan/terrainContourPlanThree.ts`:

```ts
export function terrainContourPlanThree(
  topo: Extract<Element, { kind: 'toposolid' }>,
): THREE.Group
```

- Return empty Group if `!topo.contourIntervalMm || topo.contourIntervalMm <= 0`
- Call `terrainContourLinesMm(topo.heightSamples ?? [], topo.boundaryMm, topo.contourIntervalMm)` to get polylines
- For each polyline: render as `THREE.Line` with `BufferGeometry` — vertices at `(xMm/1000, PLAN_Y + 0.004, yMm/1000)`
- Material: `LineBasicMaterial({ color: '#6b5c3e', opacity: 0.8, transparent: true })`
- Every 5th contour line (major contour): use a slightly thicker/darker line
- `userData.bimPickId = topo.id`

Wire into `symbology.ts` toposolid loop: after existing toposolid boundary outline, add `holder.add(terrainContourPlanThree(topo))`.

### D — Inspector input

In `InspectorContent.tsx`, for `el.kind === 'toposolid'`, add:
- `data-testid="inspector-topo-contour-interval"` — number input (mm), step 250, min 0, max 10000. Label: "Contour interval (mm)". Value = `el.contourIntervalMm ?? 0`. On change dispatch `update_element_property` for `contourIntervalMm`.

### E — Tests

Write `packages/web/src/plan/terrainContourLines.test.ts`:
```ts
describe('terrainContourLinesMm — §5.1.3', () => {
  it('returns empty array when no height samples', () => { ... });
  it('returns empty array when contourIntervalMm <= 0', () => { ... });
  it('returns at least one polyline for a sloped surface with 4 corner samples', () => { ... });
  it('all returned points are within boundary AABB', () => { ... });
  it('flat surface (all samples at same z) returns no contour lines', () => { ... });
});
```

Write `packages/web/src/plan/terrainContourPlanThree.test.ts`:
```ts
describe('terrainContourPlanThree — §5.1.3', () => {
  it('returns empty Group when contourIntervalMm=0', () => { ... });
  it('returns empty Group when contourIntervalMm is undefined', () => { ... });
  it('returns Group with Line children for a sloped toposolid', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
