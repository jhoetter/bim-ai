# Wave 22 — WP-A: Permanent Dimension — Snap to Element References (§4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§4.1 "Die Bemaßungsbefehle" is Partial. Permanent aligned dimensions exist (wave 8 WP-A, §4.2.1). What's missing is the ability to snap the dimension witness points to specific BIM element references (wall faces, column edges) rather than only to free-click positions. This task adds:

- `referencedElementId?: string` to each witness point in `permanent_dimension`
- A `dim-reference` snap mode in the dimension tool that highlights snappable element edges
- An inspector readout showing which elements each witness point references
- `resolveDimReferences()` utility to re-compute witness point positions if referenced elements move

---

## Repo orientation

```
packages/core/src/index.ts                       — find PermanentDimensionElem, witnessPointsMm
packages/web/src/tools/toolGrammar.ts            — find PermanentDimState / reducePermanentDim
packages/web/src/plan/PlanCanvas.tsx             — find case 'permanent-dimension' click handler
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'permanent_dimension':
```

Run:

- `grep -n "PermanentDim\|permanent_dimension\|witnessPoints" packages/core/src/index.ts | head -20`
- `grep -n "PermanentDim\|witnessPoints" packages/web/src/tools/toolGrammar.ts | head -20`
- `grep -n "case 'permanent_dimension'" packages/web/src/workspace/inspector/InspectorContent.tsx`

Read each file section before editing.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add witnessPointRef type in packages/core/src/index.ts

Find `PermanentDimensionElem` (search for `kind: 'permanent_dimension'`). Currently `witnessPointsMm` is likely `{ xMm: number; yMm: number }[]`. Add:

```ts
export interface DimWitnessPoint {
  xMm: number;
  yMm: number;
  referencedElementId?: string; // element whose face/edge this snaps to
  referenceEdge?: 'start' | 'end' | 'face1' | 'face2'; // which edge of the element
}
```

Change `witnessPointsMm` from `{ xMm, yMm }[]` to `DimWitnessPoint[]` on `PermanentDimensionElem`. Keep backward compatibility — old-format points without `referencedElementId` still work.

### B — resolveDimReferences utility

Create `packages/web/src/plan/resolveDimReferences.ts`:

```ts
import type { DimWitnessPoint, Element } from '@bim-ai/core';

/**
 * For any witness point that has a referencedElementId, re-compute its position
 * from the referenced element's current geometry. Returns updated witness points.
 */
export function resolveDimReferences(
  witnessPoints: DimWitnessPoint[],
  elementsById: Record<string, Element>,
): DimWitnessPoint[] {
  return witnessPoints.map((pt) => {
    if (!pt.referencedElementId) return pt;
    const el = elementsById[pt.referencedElementId] as any;
    if (!el) return pt;

    // For walls: use startMm or endMm depending on referenceEdge
    if (el.kind === 'wall') {
      if (pt.referenceEdge === 'start') {
        return { ...pt, xMm: el.startMm?.xMm ?? pt.xMm, yMm: el.startMm?.yMm ?? pt.yMm };
      }
      if (pt.referenceEdge === 'end') {
        return { ...pt, xMm: el.endMm?.xMm ?? pt.xMm, yMm: el.endMm?.yMm ?? pt.yMm };
      }
    }

    // For columns: use positionMm
    if (el.kind === 'column' && el.positionMm) {
      return { ...pt, xMm: el.positionMm.xMm ?? pt.xMm, yMm: el.positionMm.yMm ?? pt.yMm };
    }

    return pt;
  });
}
```

### C — Inspector section for dimension references

In `InspectorContent.tsx`, find `case 'permanent_dimension':`. After the existing witness-point count or EQ toggle, add a "References" readout:

```tsx
{
  /* Dimension element references */
}
{
  (el as any).witnessPointsMm?.some((pt: any) => pt.referencedElementId) && (
    <details style={{ marginTop: 8 }}>
      <summary
        data-testid="inspector-dim-references-summary"
        style={{ cursor: 'pointer', fontSize: 12 }}
      >
        Element References (
        {(el as any).witnessPointsMm.filter((pt: any) => pt.referencedElementId).length})
      </summary>
      <div style={{ marginTop: 4 }}>
        {(el as any).witnessPointsMm
          .filter((pt: any) => pt.referencedElementId)
          .map((pt: any, i: number) => (
            <div
              key={i}
              data-testid={`inspector-dim-ref-${i}`}
              style={{ fontSize: 11, color: '#aaa', padding: '2px 0' }}
            >
              Pt {i + 1}: {pt.referencedElementId?.slice(-8)} ({pt.referenceEdge ?? 'auto'})
            </div>
          ))}
      </div>
    </details>
  );
}
```

### D — Tests

Create `packages/web/src/plan/resolveDimReferences.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveDimReferences } from './resolveDimReferences';
import type { DimWitnessPoint } from '@bim-ai/core';

const wallElem: any = {
  id: 'w1',
  kind: 'wall',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 5000, yMm: 0 },
};
const colElem: any = {
  id: 'c1',
  kind: 'column',
  positionMm: { xMm: 2500, yMm: 1000 },
};

const elementsById: any = { w1: wallElem, c1: colElem };

describe('resolveDimReferences — §4.1', () => {
  it('returns unmodified point when no referencedElementId', () => {
    const pts: DimWitnessPoint[] = [{ xMm: 100, yMm: 200 }];
    expect(resolveDimReferences(pts, elementsById)).toEqual(pts);
  });

  it('snaps to wall start when referenceEdge is start', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 100,
        yMm: 100,
        referencedElementId: 'w1',
        referenceEdge: 'start',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(0);
    expect(result[0].yMm).toBe(0);
  });

  it('snaps to wall end when referenceEdge is end', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 100,
        yMm: 100,
        referencedElementId: 'w1',
        referenceEdge: 'end',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(5000);
  });

  it('snaps to column position', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 0,
        yMm: 0,
        referencedElementId: 'c1',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(2500);
    expect(result[0].yMm).toBe(1000);
  });

  it('returns original coords when referenced element not found', () => {
    const pts: DimWitnessPoint[] = [
      {
        xMm: 999,
        yMm: 888,
        referencedElementId: 'nonexistent',
      },
    ];
    const result = resolveDimReferences(pts, elementsById);
    expect(result[0].xMm).toBe(999);
    expect(result[0].yMm).toBe(888);
  });
});
```

Also create `packages/web/src/plan/dimWitnessPoint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DimWitnessPoint } from '@bim-ai/core';

describe('DimWitnessPoint type — §4.1', () => {
  it('accepts point without referencedElementId', () => {
    const pt: DimWitnessPoint = { xMm: 0, yMm: 0 };
    expect(pt.xMm).toBe(0);
  });

  it('accepts point with referencedElementId', () => {
    const pt: DimWitnessPoint = {
      xMm: 100,
      yMm: 200,
      referencedElementId: 'w1',
      referenceEdge: 'start',
    };
    expect(pt.referencedElementId).toBe('w1');
    expect(pt.referenceEdge).toBe('start');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave22/A): permanent dimension witness point references — DimWitnessPoint type + resolveDimReferences + inspector readout (§4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
