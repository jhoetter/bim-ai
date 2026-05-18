# Wave 17 — WP-G: Terrain Split / Graded Region (§5.1.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — toposolid element type
packages/web/src/tools/toolRegistry.ts              — ToolId union
packages/web/src/tools/toolGrammar.ts               — tool state machines
packages/web/src/plan/PlanCanvas.tsx                — click/keyboard dispatch
packages/web/src/plan/symbology.ts                  — plan symbols
packages/web/src/viewport/meshBuilders.ts           — mesh builder switch
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/commandCapabilities.ts   — capability graph
```

Search for `toposolid`, `terrain`, `graded`, `split.*terrain`, `terrainSplit` in the codebase first.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `toposolid` element — read ALL fields (`heightSamples`, `perimeterMm`, `levelId`, `thicknessMm`).
2. Search for `graded_region` — does it already exist as an element kind? If so, read it.
3. `toolRegistry.ts`: search for `'terrain-split'` or `'graded-region'` — if they exist, read them.
4. Look at `meshBuilders.ts` for `case 'toposolid':` — read how the terrain mesh is built.

---

## Tasks

### A — Element type: `graded_region` in `core/index.ts`

Add a new element kind (if not present):

```ts
| {
    kind: 'graded_region';
    id: string;
    /** Perimeter polygon of the graded region (closed, in mm). */
    perimeterMm: { xMm: number; yMm: number }[];
    /** Elevation at the lower boundary (mm). */
    lowerElevationMm: number;
    /** Elevation at the upper boundary (mm). */
    upperElevationMm: number;
    /** The toposolid this graded region belongs to. */
    hostToposolidId: string | null;
    levelId?: string | null;
  }
```

Add command type:

```ts
| { type: 'createGradedRegion'; element: Extract<Element, { kind: 'graded_region' }> }
```

---

### B — Terrain split utility in `terrainSplit.ts`

Create `packages/web/src/plan/terrainSplit.ts`:

```ts
import type { Element } from '@bim-ai/core';

type ToposolidEl = Extract<Element, { kind: 'toposolid' }>;
type PointMm = { xMm: number; yMm: number };

/**
 * Splits a toposolid into two separate toposolid elements by a polyline.
 * The split line is defined by a sequence of 2D points.
 * Returns two new toposolid elements (the original should be deleted by the caller).
 */
export function splitToposolid(
  topo: ToposolidEl,
  splitLineMm: PointMm[],
): [ToposolidEl, ToposolidEl] {
  // Simplified: partition heightSamples into left/right of the split line.
  // Use cross product to determine side for each sample.
  const left: typeof topo.heightSamples = [];
  const right: typeof topo.heightSamples = [];

  for (const sample of topo.heightSamples ?? []) {
    const side = sideOfPolyline(splitLineMm, { xMm: sample.xMm, yMm: sample.yMm });
    if (side >= 0) left.push(sample);
    else right.push(sample);
  }

  // Compute bounding boxes for perimeters
  const leftPerim = boundingBoxPerimeter(left.map((s) => ({ xMm: s.xMm, yMm: s.yMm })));
  const rightPerim = boundingBoxPerimeter(right.map((s) => ({ xMm: s.xMm, yMm: s.yMm })));

  return [
    { ...topo, id: crypto.randomUUID(), heightSamples: left, perimeterMm: leftPerim },
    { ...topo, id: crypto.randomUUID(), heightSamples: right, perimeterMm: rightPerim },
  ];
}

function sideOfPolyline(line: PointMm[], pt: PointMm): number {
  // Cross product with first segment of split line
  if (line.length < 2) return 1;
  const dx = line[1].xMm - line[0].xMm;
  const dy = line[1].yMm - line[0].yMm;
  return dx * (pt.yMm - line[0].yMm) - dy * (pt.xMm - line[0].xMm);
}

function boundingBoxPerimeter(pts: PointMm[]): PointMm[] {
  if (pts.length === 0) return [];
  const xs = pts.map((p) => p.xMm),
    ys = pts.map((p) => p.yMm);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  return [
    { xMm: minX, yMm: minY },
    { xMm: maxX, yMm: minY },
    { xMm: maxX, yMm: maxY },
    { xMm: minX, yMm: maxY },
  ];
}
```

---

### C — Tool registration

In `toolRegistry.ts`:

- Add `'graded-region'` to ToolId union: `{ id: 'graded-region', hotkey: 'GR', label: 'Graded Region', mode: 'plan' }`
- Add `'terrain-split'` to ToolId union: `{ id: 'terrain-split', hotkey: 'TS', label: 'Split Terrain', mode: 'plan' }`
- Add both to `PALETTE_ORDER` near other terrain tools.

---

### D — Grammars in `toolGrammar.ts`

**GradedRegion grammar** (polygon sketch):

- `idle → sketching (click adds points) → Enter (≥3 pts) → emit createGradedRegion`
- Escape → idle

```ts
type GradedRegionState =
  | { phase: 'idle' }
  | { phase: 'sketching'; points: { xMm: number; yMm: number }[] };

type GradedRegionEffect = {
  kind: 'createGradedRegion';
  perimeterMm: { xMm: number; yMm: number }[];
  lowerElevationMm: number;
  upperElevationMm: number;
};
```

**TerrainSplit grammar** (polyline):

- `idle → splitting (click adds points) → Enter (≥2 pts) → emit splitTerrain`

```ts
type TerrainSplitEffect = {
  kind: 'splitTerrain';
  toposolidId: string;
  splitLineMm: { xMm: number; yMm: number }[];
};
```

---

### E — PlanCanvas wiring

Wire both grammars into `PlanCanvas.tsx` following existing tool patterns.

For `graded-region`: emit `createElement` for the `graded_region` element.
For `terrain-split`: get the selected toposolid ID, emit a `splitTerrain` semantic command.

In `Workspace.tsx`, handle `splitTerrain`:

```ts
if (cmd.type === 'splitTerrain') {
  const topo = elementsById[cmd.toposolidId];
  if (!topo || topo.kind !== 'toposolid') return;
  const [left, right] = splitToposolid(topo as any, cmd.splitLineMm);
  void onSemanticCommand({ type: 'createElement', element: left });
  void onSemanticCommand({ type: 'createElement', element: right });
  void onSemanticCommand({ type: 'deleteElement', elementId: cmd.toposolidId });
}
```

---

### F — Graded region 3D mesh

Create `packages/web/src/viewport/meshBuilders.gradedRegion.ts`:

```ts
export function buildGradedRegionMesh(el: Extract<Element, { kind: 'graded_region' }>): THREE.Mesh {
  // Build a sloped surface: lower perimeter side at lowerElevationMm,
  // upper perimeter side at upperElevationMm.
  // Simple approach: use THREE.Shape from perimeterMm, extrude with a slope transform.
  // Even simpler: render as a flat plane at avg elevation with a colour gradient material.

  const avgElev = ((el.lowerElevationMm ?? 0) + (el.upperElevationMm ?? 500)) / 2;
  const shape = new THREE.Shape();
  const pts = el.perimeterMm ?? [];
  if (pts.length === 0) return new THREE.Mesh();

  shape.moveTo(pts[0].xMm / 1000, pts[0].yMm / 1000);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].xMm / 1000, pts[i].yMm / 1000);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshStandardMaterial({
    color: '#8fbc8f',
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = avgElev / 1000;
  mesh.userData.bimPickId = el.id;
  return mesh;
}
```

Wire into `meshBuilders.ts` with `case 'graded_region':`.

---

### G — Graded region plan symbol

In `symbology.ts`, add a plan symbol for `graded_region`: hatched polygon with diagonal lines at 45°, colour `#8fbc8f`.

---

### H — Inspector panel

In `InspectorContent.tsx`, add `case 'graded_region':`:

```tsx
<div>
  <label>
    Lower Elevation (mm)
    <input
      type="number"
      data-testid="inspector-graded-region-lower"
      value={el.lowerElevationMm ?? 0}
      onChange={(e) => onPropertyChange('lowerElevationMm', +e.target.value)}
    />
  </label>
  <label>
    Upper Elevation (mm)
    <input
      type="number"
      data-testid="inspector-graded-region-upper"
      value={el.upperElevationMm ?? 500}
      onChange={(e) => onPropertyChange('upperElevationMm', +e.target.value)}
    />
  </label>
</div>
```

---

### I — Palette commands + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'tool.graded-region', label: 'Graded Region', keywords: ['graded', 'terrain', 'slope', 'region'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'graded-region') }
{ id: 'tool.terrain-split', label: 'Split Terrain Surface', keywords: ['terrain', 'split', 'surface'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'terrain-split') }
```

In `commandCapabilities.ts`:

```ts
{ id: 'tool.graded-region', scope: 'document', intendedModes: ['plan'], precondition: null },
{ id: 'tool.terrain-split', scope: 'selection', intendedModes: ['plan'], precondition: 'selected-toposolid' },
```

---

### J — Tests

`packages/web/src/plan/terrainSplit.test.ts`:

```ts
describe('splitToposolid — §5.1.6', () => {
  it('returns two toposolids', () => { ... });
  it('combined sample count equals original', () => { ... });
  it('each result has a new unique ID', () => { ... });
  it('samples are partitioned by split line', () => { ... });
});
```

`packages/web/src/plan/gradedRegion.test.ts`:

```ts
describe('graded region grammar — §5.1.6', () => {
  it('starts in idle state', () => { ... });
  it('clicks add points to sketching state', () => { ... });
  it('Enter with ≥3 points emits createGradedRegion', () => { ... });
  it('Escape resets to idle', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/G): terrain split + graded region tool (§5.1.6)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new terrain tools tests.
