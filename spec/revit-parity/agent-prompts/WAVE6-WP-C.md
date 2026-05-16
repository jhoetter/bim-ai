# Wave 6 — WP-C: Ceiling Grid Pattern Plan Overlay (§8.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — CeilingElem (kind: 'ceiling')
packages/web/src/plan/symbology.ts                       — ceiling rendering loop (search "cl.kind !== 'ceiling'")
packages/web/src/plan/planElementMeshBuilders.ts        — plan mesh helpers
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `ceiling` element type in `core/index.ts` with `boundaryMm: XY[]`, `heightOffsetMm`, `thicknessMm`, `ceilingTypeId?`
- Ceiling rendering in `symbology.ts` — calls `horizontalOutlineMesh(cl.boundaryMm, ...)` to draw the boundary outline. Read the ceiling loop carefully before editing.
- `horizontalOutlineMesh` in `planElementMeshBuilders.ts` — reuse for drawing grid lines

---

## Tasks

### A — Data model: gridPatternMm (§8.2)

Add to the `ceiling` element type in `core/index.ts`:
```ts
/** Grid tile size in mm — when set, draws a ceiling grid pattern in plan. 600 = 600×600 tile. */
gridPatternMm?: number | null;
```

### B — Ceiling grid plan renderer

Create `packages/web/src/plan/ceilingGridPlanThree.ts`:

```ts
export function ceilingGridPlanThree(
  ceiling: Extract<Element, { kind: 'ceiling' }>,
): THREE.Group
```

Implementation:
- Return an empty Group if `!ceiling.gridPatternMm` or `ceiling.gridPatternMm <= 0`
- Compute AABB of `ceiling.boundaryMm` (minX, maxX, minY, maxY)
- Draw vertical lines every `gridPatternMm` across the AABB, clipped to boundary polygon using
  a point-in-polygon test (check if midpoint of segment is inside — simple approach is fine)
- Draw horizontal lines every `gridPatternMm` across the AABB, same clipping
- Use `THREE.LineSegments` with `THREE.LineBasicMaterial({ color: '#999999', opacity: 0.6, transparent: true })`
- Convert mm to world units: x_world = xMm / 1000, z_world = yMm / 1000 (plan is XZ plane at y = PLAN_Y + 0.002)
- `userData.bimPickId = ceiling.id`

For the point-in-polygon clip: for each candidate grid line segment, test if its midpoint falls
inside `ceiling.boundaryMm`. Use the ray-casting algorithm (count crossings).

Wire into `symbology.ts` ceiling loop: after `holder.add(horizontalOutlineMesh(...))`, also do:
```ts
holder.add(ceilingGridPlanThree(cl));
```

### C — Inspector input

In `InspectorContent.tsx`, detect `el.kind === 'ceiling'` and add:
- `data-testid="inspector-ceiling-grid-size"` — number input (mm), step 100, min 0, max 3000.
  Label: "Grid tile (mm)". Value = `el.gridPatternMm ?? 0`. On change dispatch
  `update_element_property` for `gridPatternMm` (0 = no grid).

### D — Tests

Write `packages/web/src/plan/ceilingGridPattern.test.ts`:
```ts
describe('ceilingGridPlanThree — §8.2', () => {
  it('returns empty Group when gridPatternMm is undefined', () => { ... });
  it('returns empty Group when gridPatternMm is 0', () => { ... });
  it('returns Group with LineSegments when gridPatternMm=600 and square boundary', () => { ... });
  it('all LineSegments have midpoints inside the boundary', () => { ... });
  it('grid lines are at multiples of gridPatternMm within AABB', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/ceilingInspector.test.tsx`:
```ts
describe('ceiling inspector grid size — §8.2', () => {
  it('renders inspector-ceiling-grid-size input', () => { ... });
  it('changing value dispatches update_element_property for gridPatternMm', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
