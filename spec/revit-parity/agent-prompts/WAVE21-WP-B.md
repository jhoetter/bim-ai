# Wave 21 — WP-B: Floor Drainage Slope Points — Sub-Element Slope Editing (§3.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.4.2 "Bodenplatte im Keller bearbeiten" is Partial — sub-floor drainage slope editing is Not Started. Revit allows placing individual control points on a floor slab at different elevations to model drainage slopes ("sub-element editing"). This task adds `slopePoints` to the floor element and an inspector UI to manage them.

---

## Repo orientation

```
packages/core/src/index.ts                              — add FloorSlopePoint + slopePoints to floor element
packages/web/src/workspace/inspector/InspectorContent.tsx — add inspector section for floor slope points
packages/web/src/plan/floorSlopePlanThree.ts            — extend to render slope point symbols
packages/web/src/plan/symbology.ts                      — call slope point renderer
```

Read `packages/core/src/index.ts` — search for `FloorElem` to see the floor element type definition.
Read `packages/web/src/plan/floorSlopePlanThree.ts` to understand the existing slope arrow renderer.
Read `packages/web/src/workspace/inspector/InspectorContent.tsx` — search for `case 'floor':` for the floor inspector section.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — FloorSlopePoint type in packages/core/src/index.ts

Find `FloorElem` (search for `kind: 'floor'`). Add a `FloorSlopePoint` interface and the optional array to `FloorElem`:

```ts
export interface FloorSlopePoint {
  id: string;
  xMm: number;
  yMm: number;
  elevationOffsetMm: number; // offset from floor base elevation (positive = raised, negative = lower)
}
```

On the `FloorElem` type, add:

```ts
slopePoints?: FloorSlopePoint[];
```

Add command types to the command union (search for existing `create_floor` or `update_floor` to find the pattern):

```ts
| { type: 'addFloorSlopePoint'; floorId: string; point: FloorSlopePoint }
| { type: 'removeFloorSlopePoint'; floorId: string; pointId: string }
| { type: 'updateFloorSlopePoint'; floorId: string; pointId: string; elevationOffsetMm: number }
```

### B — Workspace.tsx handlers

In `packages/web/src/workspace/Workspace.tsx`, find the semantic command dispatch section (search for `case 'addStairRun'` for a nearby pattern). Add handlers:

```ts
if (cmd.type === 'addFloorSlopePoint') {
  const { elementsById: cur } = useBimStore.getState();
  const floor = cur[cmd.floorId];
  if (floor?.kind === 'floor') {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [floor.id]: { ...floor, slopePoints: [...(floor.slopePoints ?? []), cmd.point] },
      },
    });
  }
  return;
}
if (cmd.type === 'removeFloorSlopePoint') {
  const { elementsById: cur } = useBimStore.getState();
  const floor = cur[cmd.floorId];
  if (floor?.kind === 'floor') {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [floor.id]: {
          ...floor,
          slopePoints: (floor.slopePoints ?? []).filter((p) => p.id !== cmd.pointId),
        },
      },
    });
  }
  return;
}
if (cmd.type === 'updateFloorSlopePoint') {
  const { elementsById: cur } = useBimStore.getState();
  const floor = cur[cmd.floorId];
  if (floor?.kind === 'floor') {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [floor.id]: {
          ...floor,
          slopePoints: (floor.slopePoints ?? []).map((p) =>
            p.id === cmd.pointId ? { ...p, elevationOffsetMm: cmd.elevationOffsetMm } : p,
          ),
        },
      },
    });
  }
  return;
}
```

### C — Inspector section in InspectorContent.tsx

Find `case 'floor':` in `InspectorContent.tsx`. Add a "Drainage Slope Points" collapsible section after the existing floor properties:

```tsx
{
  /* Drainage Slope Points */
}
<details style={{ marginTop: 8 }}>
  <summary
    data-testid="inspector-floor-slope-points-summary"
    style={{ cursor: 'pointer', fontWeight: 600 }}
  >
    Drainage Slope Points ({(el as any).slopePoints?.length ?? 0})
  </summary>
  <div style={{ marginTop: 6 }}>
    {((el as any).slopePoints ?? []).map((pt: any, idx: number) => (
      <div key={pt.id} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#aaa', minWidth: 60 }}>
          Pt {idx + 1}: ({pt.xMm.toFixed(0)}, {pt.yMm.toFixed(0)})
        </span>
        <input
          type="number"
          data-testid={`inspector-floor-slope-pt-elevation-${idx}`}
          value={pt.elevationOffsetMm}
          style={{ width: 70 }}
          onChange={(e) =>
            onSemanticCommand?.({
              type: 'updateFloorSlopePoint',
              floorId: el.id,
              pointId: pt.id,
              elevationOffsetMm: +e.target.value,
            })
          }
        />
        <span style={{ fontSize: 11 }}>mm offset</span>
        <button
          data-testid={`inspector-floor-slope-pt-remove-${idx}`}
          onClick={() =>
            onSemanticCommand?.({ type: 'removeFloorSlopePoint', floorId: el.id, pointId: pt.id })
          }
          style={{ color: '#f87171', fontSize: 11 }}
        >
          ✕
        </button>
      </div>
    ))}
    <button
      data-testid="inspector-floor-add-slope-point"
      onClick={() =>
        onSemanticCommand?.({
          type: 'addFloorSlopePoint',
          floorId: el.id,
          point: {
            id: crypto.randomUUID(),
            xMm: 0,
            yMm: 0,
            elevationOffsetMm: -50,
          },
        })
      }
      style={{ fontSize: 12, marginTop: 4 }}
    >
      + Add Slope Point
    </button>
  </div>
</details>;
```

### D — Plan symbol in floorSlopePlanThree.ts

In `packages/web/src/plan/floorSlopePlanThree.ts`, add a function that renders slope points as small filled circles with elevation labels:

```ts
export function floorSlopePointsPlanThree(floor: FloorElem): THREE.Group | null {
  const pts = floor.slopePoints;
  if (!pts || pts.length === 0) return null;

  const grp = new THREE.Group();
  grp.userData.floorSlopePoints = true;

  for (const pt of pts) {
    // Small orange circle at pt position
    const geo = new THREE.CircleGeometry(100, 12);
    const mat = new THREE.MeshBasicMaterial({ color: '#f97316' });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pt.xMm, pt.yMm, 1);
    mesh.userData.slopePointId = pt.id;
    grp.add(mesh);
  }

  return grp;
}
```

Wire into `packages/web/src/plan/symbology.ts` in the floor rendering loop (find where `floorSlopeArrowPlanThree(f)` is called and add a similar call):

```ts
const slopePts = floorSlopePointsPlanThree(f);
if (slopePts) planGroup.add(slopePts);
```

Make sure to import `floorSlopePointsPlanThree` at the top of symbology.ts.

### E — Tests

Create `packages/web/src/workspace/floorSlopePoints.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useBimStore } from '../state/store';

beforeEach(() => {
  useBimStore.setState({
    elementsById: {
      f1: {
        id: 'f1',
        kind: 'floor',
        levelId: 'L1',
        boundaryMm: [],
        thicknessMm: 200,
      },
    },
  });
});

describe('Floor slope points — §3.4.2', () => {
  it('addFloorSlopePoint adds a point to the floor', () => {
    useBimStore.getState().onSemanticCommand?.({
      type: 'addFloorSlopePoint',
      floorId: 'f1',
      point: { id: 'sp1', xMm: 1000, yMm: 2000, elevationOffsetMm: -50 },
    });
    const floor = useBimStore.getState().elementsById['f1'] as any;
    expect(floor.slopePoints).toHaveLength(1);
    expect(floor.slopePoints[0].id).toBe('sp1');
  });

  it('removeFloorSlopePoint removes by id', () => {
    useBimStore.setState({
      elementsById: {
        f1: {
          id: 'f1',
          kind: 'floor',
          levelId: 'L1',
          boundaryMm: [],
          thicknessMm: 200,
          slopePoints: [{ id: 'sp1', xMm: 0, yMm: 0, elevationOffsetMm: -50 }],
        },
      },
    });
    useBimStore.getState().onSemanticCommand?.({
      type: 'removeFloorSlopePoint',
      floorId: 'f1',
      pointId: 'sp1',
    });
    const floor = useBimStore.getState().elementsById['f1'] as any;
    expect(floor.slopePoints).toHaveLength(0);
  });

  it('updateFloorSlopePoint changes elevationOffsetMm', () => {
    useBimStore.setState({
      elementsById: {
        f1: {
          id: 'f1',
          kind: 'floor',
          levelId: 'L1',
          boundaryMm: [],
          thicknessMm: 200,
          slopePoints: [{ id: 'sp1', xMm: 0, yMm: 0, elevationOffsetMm: -50 }],
        },
      },
    });
    useBimStore.getState().onSemanticCommand?.({
      type: 'updateFloorSlopePoint',
      floorId: 'f1',
      pointId: 'sp1',
      elevationOffsetMm: -100,
    });
    const floor = useBimStore.getState().elementsById['f1'] as any;
    expect(floor.slopePoints[0].elevationOffsetMm).toBe(-100);
  });

  it('floor starts with no slopePoints', () => {
    const floor = useBimStore.getState().elementsById['f1'] as any;
    expect(floor.slopePoints ?? []).toHaveLength(0);
  });

  it('floorSlopePointsPlanThree returns null for floor with no points', async () => {
    const { floorSlopePointsPlanThree } = await import('../plan/floorSlopePlanThree');
    const floor: any = { id: 'f1', kind: 'floor', slopePoints: [] };
    expect(floorSlopePointsPlanThree(floor)).toBeNull();
  });
});
```

Note: The test uses `useBimStore.getState().onSemanticCommand?.()` — check whether the store exposes this or whether you should call the Workspace dispatch directly. Adapt the test pattern to match how other command tests in the project are written (grep for `onSemanticCommand` in test files).

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave21/B): floor sub-element slope points — drainage slope CRUD inspector + plan symbols (§3.4.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
