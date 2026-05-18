# Wave 18 — WP-J: Shaft Opening Workflow Improvements (§2.5.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — shaft element type
packages/web/src/plan/stairShaft.ts                 — shaft auto-creation (wave 13)
packages/web/src/tools/toolRegistry.ts              — 'shaft' tool
packages/web/src/tools/toolGrammar.ts               — shaft grammar
packages/web/src/plan/PlanCanvas.tsx                — plan canvas
packages/web/src/viewport/meshBuilders.ts           — shaft 3D mesh
packages/web/src/workspace/inspector/InspectorContent.tsx — shaft inspector
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Search for `shaft`, `ShaftState`, `reduceShaft`, `shaft_void`, `stairShaft`, `ShaftOpening` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `shaft` or `shaft_void` element kind — read ALL fields. If not found, read what `stairShaft.ts` creates.
2. `stairShaft.ts`: read FULLY — how does it compute and create the shaft boundary from a stair?
3. `toolGrammar.ts`: find shaft grammar — `ShaftState`, `reduceShaft` — read fully.
4. `toolRegistry.ts`: find `'shaft'` tool — read it.
5. `meshBuilders.ts`: find `case 'shaft':` or equivalent — read the shaft 3D mesh builder.
6. `InspectorContent.tsx` `case 'shaft':`: read the inspector.

---

## Tasks

The goal is to improve the shaft opening workflow:

1. Add multi-level shaft support (shaft cuts through multiple floors between two levels)
2. Add shaft auto-sizing button in inspector
3. Add visual indicator showing which levels the shaft cuts through

### A — Shaft element additional fields in `core/index.ts`

Ensure the shaft/shaft_void element has (add if missing):

```ts
/** Level at the bottom of the shaft (base level). */
baseLevelId?: string | null;
/** Level at the top of the shaft. Shaft cuts all floors between base and top. */
topLevelId?: string | null;
/** Whether the shaft visually highlights the cut floors in the plan view. */
showCutLevels?: boolean;
/** The element IDs of floors that this shaft cuts through (auto-computed). */
cutFloorIds?: string[];
```

Add command type if not present:

```ts
| { type: 'updateShaftLevels'; shaftId: string; baseLevelId: string | null; topLevelId: string | null }
| { type: 'recomputeShaftCuts'; shaftId: string }
```

---

### B — `shaftCutFloors.ts`

Create `packages/web/src/plan/shaftCutFloors.ts`:

```ts
import type { Element } from '@bim-ai/core';

type PointMm = { xMm: number; yMm: number };
type ShaftEl = Extract<Element, { kind: 'shaft' }> | any; // use actual shaft kind

/**
 * Returns the IDs of floor elements that fall within the shaft's vertical extent
 * (between baseLevelId and topLevelId elevation) and overlap the shaft perimeter.
 */
export function computeShaftCutFloors(
  shaft: ShaftEl,
  elementsById: Record<string, Element | undefined>,
): string[] {
  const levels = Object.values(elementsById).filter((e) => e?.kind === 'level') as any[];
  const baseLevel = levels.find((l) => l.id === shaft.baseLevelId);
  const topLevel = levels.find((l) => l.id === shaft.topLevelId);

  const baseElev = baseLevel?.elevationMm ?? 0;
  const topElev = topLevel?.elevationMm ?? Infinity;

  const shaftPerim: PointMm[] = shaft.perimeterMm ?? [];
  if (shaftPerim.length < 3) return [];

  return Object.values(elementsById)
    .filter((el) => {
      if (!el || el.kind !== 'floor') return false;
      const floor = el as any;
      const floorLevel = levels.find((l) => l.id === floor.levelId);
      const floorElev = floorLevel?.elevationMm ?? 0;
      // Floor must be within the shaft's vertical extent
      if (floorElev < baseElev || floorElev > topElev) return false;
      // Check if floor boundary overlaps shaft perimeter (simple centroid check)
      const floorPerim: PointMm[] = floor.perimeterMm ?? [];
      if (floorPerim.length === 0) return false;
      const cx = floorPerim.reduce((s, p) => s + p.xMm, 0) / floorPerim.length;
      const cy = floorPerim.reduce((s, p) => s + p.yMm, 0) / floorPerim.length;
      return pointInPolygon({ xMm: cx, yMm: cy }, shaftPerim);
    })
    .map((el) => el!.id);
}

function pointInPolygon(pt: PointMm, polygon: PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].xMm,
      yi = polygon[i].yMm;
    const xj = polygon[j].xMm,
      yj = polygon[j].yMm;
    const intersect =
      yi > pt.yMm !== yj > pt.yMm && pt.xMm < ((xj - xi) * (pt.yMm - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
```

---

### C — `Workspace.tsx` handler updates

Handle `recomputeShaftCuts`:

```ts
case 'recomputeShaftCuts': {
  const shaft = elementsById[cmd.shaftId];
  if (!shaft || (shaft.kind !== 'shaft' && shaft.kind !== 'shaft_void')) break;
  const cutFloorIds = computeShaftCutFloors(shaft as any, elementsById);
  (shaft as any).cutFloorIds = cutFloorIds;
  break;
}
```

Handle `updateShaftLevels`:

```ts
case 'updateShaftLevels': {
  const shaft = elementsById[cmd.shaftId];
  if (shaft && (shaft.kind === 'shaft' || shaft.kind === 'shaft_void')) {
    (shaft as any).baseLevelId = cmd.baseLevelId;
    (shaft as any).topLevelId = cmd.topLevelId;
    // Recompute cuts
    const cutFloorIds = computeShaftCutFloors(shaft as any, elementsById);
    (shaft as any).cutFloorIds = cutFloorIds;
  }
  break;
}
```

---

### D — Inspector improvements

In `InspectorContent.tsx`, `case 'shaft':` (or whatever kind the shaft is), add:

```tsx
<label>Base Level
  <select data-testid="inspector-shaft-base-level"
    value={(el as any).baseLevelId ?? ''}
    onChange={e => onPropertyChange('baseLevelId', e.target.value || null)}>
    <option value="">— none —</option>
    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
  </select>
</label>
<label>Top Level
  <select data-testid="inspector-shaft-top-level"
    value={(el as any).topLevelId ?? ''}
    onChange={e => onPropertyChange('topLevelId', e.target.value || null)}>
    <option value="">— none —</option>
    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
  </select>
</label>
<button data-testid="inspector-shaft-recompute"
  onClick={() => onSemanticCommand({ type: 'recomputeShaftCuts', shaftId: el.id })}>
  Recompute Cuts
</button>
{(el as any).cutFloorIds && (
  <span data-testid="inspector-shaft-cut-floor-count">
    Cuts {(el as any).cutFloorIds.length} floor(s)
  </span>
)}
```

---

### E — Plan symbol: show cut levels

In `symbology.ts`, when rendering a shaft element with `cutFloorIds`, draw a hatched pattern inside the shaft perimeter for each cut floor (at the floor's elevation — shown as dashed concentric outline in the plan view at the shaft's level).

Add a simple dashed outline at z = 0.005 inside the shaft polygon:

```ts
// In the shaft rendering block:
if (shaft.showCutLevels && shaft.cutFloorIds?.length > 0) {
  // Draw a dashed inner line offset from the perimeter
  const innerPts = shaftPerimPts.map((p) => p.clone().multiplyScalar(0.97)); // 3% inward
  const geo = new THREE.BufferGeometry().setFromPoints([...innerPts, innerPts[0]]);
  const mat = new THREE.LineDashedMaterial({ color: '#ff6600', dashSize: 0.1, gapSize: 0.05 });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  line.position.z = 0.008;
  line.userData.shaftCutIndicator = true;
  scene.add(line);
}
```

---

### F — Palette command + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'modify.recompute-shaft-cuts', label: 'Recompute Shaft Floor Cuts',
  keywords: ['shaft', 'cut', 'floor', 'opening'],
  category: 'command', invoke: (ctx) => {
    const shaft = ctx.selectedElements?.find(e => e.kind === 'shaft' || e.kind === 'shaft_void');
    if (shaft) void ctx.onSemanticCommand?.({ type: 'recomputeShaftCuts', shaftId: shaft.id });
  } }
```

In `commandCapabilities.ts`:

```ts
{ id: 'modify.recompute-shaft-cuts', scope: 'selection', intendedModes: ['plan'], precondition: 'selected-shaft' },
```

---

### G — Tests

`packages/web/src/plan/shaftCutFloors.test.ts`:

```ts
describe('computeShaftCutFloors — §2.5.1', () => {
  it('returns empty array when no floors exist', () => { ... });
  it('returns floor IDs that are within vertical extent', () => { ... });
  it('excludes floors outside vertical extent', () => { ... });
  it('excludes floors whose centroid is outside the shaft perimeter', () => { ... });
  it('returns empty array for shaft with no perimeter', () => { ... });
});

describe('pointInPolygon — §2.5.1', () => {
  it('returns true for point inside square', () => { ... });
  it('returns false for point outside square', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/J): shaft opening workflow — multi-level cut detection + inspector base/top level selectors (§2.5.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new shaft cut floor tests.
