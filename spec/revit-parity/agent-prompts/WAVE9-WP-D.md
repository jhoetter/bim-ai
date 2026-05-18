# Wave 9 — WP-D: Floor Slope Arrow (§3.4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — floor element type
packages/web/src/viewport/meshBuilders.ts               — makeFloorMesh (find the floor 3D mesh builder)
packages/web/src/plan/planElementMeshBuilders.ts        — floor plan symbol
packages/web/src/plan/symbology.ts                       — floor rendering loop
packages/web/src/workspace/inspector/InspectorContent.tsx — floor inspector (has "Edit Boundary" button, slope arrow already partial)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `floor` element in `core/index.ts` — read ALL existing fields. Check if `slopeArrow*` fields already exist; if so, just complete the rendering. If not, add them.
- `InspectorContent.tsx` for `el.kind === 'floor'` — find the existing slope arrow inputs. DO NOT remove them; if they exist but have no effect, wire them up.
- `makeFloorMesh` in `meshBuilders.ts` — read it completely. Currently it builds a flat slab at `baseElevationMm`. Adding slope means one end is lower and one end is higher.
- `planElementMeshBuilders.ts` — find how the floor plan symbol is drawn. The slope arrow annotation goes here.

---

## Tasks

### A — Data model: slope arrow fields

In `core/index.ts`, add to the `floor` element (only if not already present):

```ts
/** Slope arrow start point in plan (mm). The low end of the slope. */
slopeArrowTailMm?: { xMm: number; yMm: number } | null;
/** Slope arrow head point in plan (mm). The high end of the slope. */
slopeArrowHeadMm?: { xMm: number; yMm: number } | null;
/** Slope as rise/run (e.g. 0.02 = 2%). Positive = head is higher than tail. */
slopePercent?: number | null;
```

### B — Sloped floor 3D mesh

In `makeFloorMesh` (find the floor mesh builder):

When `floor.slopeArrowTailMm` and `floor.slopeArrowHeadMm` and `floor.slopePercent` are all set:

- Compute the slope direction vector (head − tail), normalised
- Compute the elevation rise per mm along this direction: `risePerMm = slopePercent / 100`
- For each vertex of the floor boundary polygon, compute elevation offset:
  `zOffset = dot(vertex - tail, slopeDir) * risePerMm`
- Shift each top-face vertex Y (in Three.js world space) by `zOffset / 1000`
- Bottom face stays flat (no offset — the slab hangs down from the sloped top)

Return the sloped mesh. No-op if slope fields are null.

### C — Slope arrow plan annotation

In `planElementMeshBuilders.ts` (or a new file `floorSlopePlanThree.ts`), add:

```ts
export function floorSlopeArrowPlanThree(
  floor: Extract<Element, { kind: 'floor' }>,
): THREE.Group | null;
```

- Return null if no slope arrow is defined
- Draw an arrow from `slopeArrowTailMm` to `slopeArrowHeadMm`:
  - A dashed line from tail to head at `PLAN_Y + 0.005`
  - An arrowhead triangle at the head point pointing in the slope direction
  - A label near the midpoint: `"${(slopePercent * 100).toFixed(1)}%"` or `"${slopePercent}:1"`
- Material: `LineBasicMaterial({ color: '#0055cc' })` (blue for slope annotation)
- `userData.bimPickId = floor.id`

Wire into the `symbology.ts` floor loop.

### D — Inspector: slope arrow inputs

In `InspectorContent.tsx`, for `el.kind === 'floor'`, ensure these inputs exist and are wired:

- `data-testid="inspector-floor-slope-percent"` — number input (%), step 0.1, min 0, max 100. Value = `el.slopePercent ?? 0`. On change: dispatch `update_element_property` for `slopePercent`.
- `data-testid="inspector-floor-slope-direction"` — read-only text showing direction as angle (degrees from North) computed from `slopeArrowTailMm`/`slopeArrowHeadMm`. Or omit if complex.
- "Set slope from canvas" note — inform the user to drag the slope arrow in plan. (Simple text label; no action needed.)

### E — Tests

Write `packages/web/src/viewport/floorSlopeMesh.test.ts`:

```ts
describe('sloped floor mesh — §3.4.1', () => {
  it('flat floor (no slope) has uniform top face elevation', () => { ... });
  it('sloped floor: tail vertex is at base elevation, head vertex is raised', () => { ... });
  it('slope of 10% raises head end by 10mm per 100mm horizontal', () => { ... });
  it('bottom face vertices are unchanged by slope', () => { ... });
});
```

Write `packages/web/src/plan/floorSlopePlan.test.ts`:

```ts
describe('floorSlopeArrowPlanThree — §3.4.1', () => {
  it('returns null when no slope arrow is set', () => { ... });
  it('returns a Group with line + label for a sloped floor', () => { ... });
  it('userData.bimPickId is set to floor id', () => { ... });
});
```

---

## Commit and push

After all tasks are done and tests pass (`pnpm test --filter @bim-ai/web`), commit:

```
git add -p
git commit -m "feat(wave9/D): floor slope arrow — data model + 3D mesh + plan annotation (§3.4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
