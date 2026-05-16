# Wave 9 — WP-E: Stair Floor Opening Auto-Coordination (§2.5.1 + §2.5.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — stair element, shaft element, Command union
packages/web/src/workspace/inspector/InspectorContent.tsx — stair inspector panel
packages/web/src/viewport/meshBuilders.ts               — makeShaftMesh (check if exists)
packages/web/src/plan/planElementMeshBuilders.ts        — shaft plan symbol (check if exists)
packages/web/src/workspace/Workspace.tsx                 — command dispatch
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `stair` element in `core/index.ts` — read ALL fields: `startMm`, `endMm`, `widthMm`, `runMm`, `baseLevelId`, `topLevelId`, etc. The stair AABB in plan is what the shaft will cover.
- `shaft` element / tool in `core/index.ts` — find if `shaft` element type exists. If it does, check its shape (`boundaryMm`, `baseLevelId`, `topLevelId`, etc.). DO NOT rebuild if it exists.
- `InspectorContent.tsx` — find the stair inspector section. Read all existing inputs before adding new ones.
- `create_shaft` command — check if it already exists in `core/index.ts`. If not, add it following the same pattern as other create commands.

---

## Tasks

### A — Shaft element and command (if not present)

Check `core/index.ts` for a `shaft` element kind. If it exists, skip to task B.

If absent, add:
```ts
export type ShaftElement = {
  kind: 'shaft';
  id: string;
  /** Boundary polygon in plan (mm). */
  boundaryMm: BoundaryPoint[];
  /** Level where the shaft starts (cuts floors from this level up). */
  baseLevelId: string;
  /** Level where the shaft ends. */
  topLevelId: string;
};

export type CreateShaftCmd = {
  type: 'create_shaft';
  id: string;
  boundaryMm: BoundaryPoint[];
  baseLevelId: string;
  topLevelId: string;
};
```

Add to Element union and Command union. Handle `create_shaft` in `Workspace.tsx`.

### B — Stair bounding box helper

Create `packages/web/src/plan/stairBoundingBox.ts`:
```ts
/** Returns the axis-aligned bounding polygon (4-corner rect) of a stair in plan (mm). */
export function stairBoundaryMm(
  stair: Extract<Element, { kind: 'stair' }>,
): BoundaryPoint[]
```

- The stair runs from `startMm` to `endMm` in plan; it has `widthMm`
- Build a rectangle: expand the start→end segment by `widthMm/2` on each side perpendicular to the run direction
- Return 4 corners as `BoundaryPoint[]`

### C — Inspector: "Create Floor Opening" button

In `InspectorContent.tsx`, for `el.kind === 'stair'`, add:

**"Create Floor Opening" button** (`data-testid="inspector-stair-create-opening"`):
- On click:
  1. Compute `stairBoundaryMm(el)` to get the shaft boundary
  2. The shaft base level = `el.baseLevelId`
  3. The shaft top level = `el.topLevelId` (or the level above base if topLevelId is missing — look up the next level by elevation)
  4. Dispatch `{ type: 'create_shaft', id: nanoid(), boundaryMm, baseLevelId, topLevelId }`

Add a small helper text below the button: "Creates a shaft opening through the floor(s) above this stair."

### D — Shaft plan symbol

Check if a shaft plan symbol exists in `planElementMeshBuilders.ts` or `symbology.ts`. If not:

Create `packages/web/src/plan/shaftPlanThree.ts`:
```ts
export function shaftPlanThree(
  shaft: Extract<Element, { kind: 'shaft' }>,
): THREE.Group
```

- Draw the boundary as a dashed closed polygon at `PLAN_Y + 0.002`
- Fill with a semi-transparent grey (`#888888`, opacity 0.3)
- Draw two diagonal cross lines inside (X pattern indicating a void/cut)
- `userData.bimPickId = shaft.id`

Wire into `symbology.ts` if a shaft loop doesn't exist.

### E — Tests

Write `packages/web/src/plan/stairBoundingBox.test.ts`:
```ts
describe('stairBoundaryMm — §2.5.1 + §2.5.3', () => {
  it('returns 4 corners for a horizontal stair run', () => { ... });
  it('corners are exactly widthMm apart perpendicular to run direction', () => { ... });
  it('works for a diagonal stair run', () => { ... });
  it('returns 4 points', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/stairOpeningInspector.test.tsx`:
```ts
describe('stair floor opening inspector — §2.5.3', () => {
  it('renders inspector-stair-create-opening button', () => { ... });
  it('clicking button dispatches create_shaft with correct boundary', () => { ... });
  it('shaft baseLevelId matches stair baseLevelId', () => { ... });
});
```

Write `packages/web/src/plan/shaftPlan.test.ts`:
```ts
describe('shaftPlanThree — §2.5.1', () => {
  it('returns Group with children for a valid shaft', () => { ... });
  it('userData.bimPickId is set to shaft.id', () => { ... });
});
```

---

## Commit and push

After all tasks are done and tests pass (`pnpm test --filter @bim-ai/web`), commit:
```
git add -p
git commit -m "feat(wave9/E): stair floor opening auto-coordination + shaft plan symbol (§2.5.1 + §2.5.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
