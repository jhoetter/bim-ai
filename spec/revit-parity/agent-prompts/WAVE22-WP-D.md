# Wave 22 — WP-D: Shaft Side Wall Auto-Generator (§2.5.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§2.5.1 "Vorbereitung der Treppenseitenwand" is Partial — shaft openings exist and stair side wall preparation is only partially supported. When an architect places a stair in a shaft void, they typically need to add enclosing side walls (Treppenseitenwände) that bound the stairwell. This task adds:
- `buildShaftSideWalls(shaft, stairs, levelId)` utility that generates 2 wall elements flanking the shaft
- An inspector "Add Side Walls" button on shaft elements
- Tests covering the wall generation geometry

---

## Repo orientation

```
packages/core/src/index.ts                             — find shaft element type (ShaftElem or similar)
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'shaft':
packages/web/src/workspace/Workspace.tsx              — find shaft-related handlers
```

Run:
- `grep -n "kind: 'shaft'\|ShaftElem\|shaft" packages/core/src/index.ts | head -15`
- `grep -n "case 'shaft'" packages/web/src/workspace/inspector/InspectorContent.tsx`
- `grep -n "shaft\|createShaft" packages/web/src/workspace/Workspace.tsx | head -10`

Read the shaft element type definition carefully — understand its `perimeterMm`, `baseLevelId`, `topLevelId` fields before implementing.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — buildShaftSideWalls.ts

Create `packages/web/src/plan/buildShaftSideWalls.ts`:

```ts
import type { Element } from '@bim-ai/core';

interface PointMm { xMm: number; yMm: number }

/**
 * Generates two wall elements flanking the shaft opening on its longest axis.
 * The walls run the full depth of the shaft perimeter bounding box.
 * Returns an empty array if the shaft has fewer than 3 perimeter points.
 */
export function buildShaftSideWalls(
  shaft: Extract<Element, { kind: 'shaft' }>,
  levelId: string,
  wallThicknessMm = 200,
): Array<Extract<Element, { kind: 'wall' }>> {
  const pts: PointMm[] = (shaft as any).perimeterMm ?? [];
  if (pts.length < 3) return [];

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.xMm);
    maxX = Math.max(maxX, p.xMm);
    minY = Math.min(minY, p.yMm);
    maxY = Math.max(maxY, p.yMm);
  }

  const width = maxX - minX;
  const depth = maxY - minY;

  // Generate walls along the longer dimension
  const isWide = width >= depth;

  if (isWide) {
    // Two walls along the Y sides (top and bottom)
    return [
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        levelId,
        startMm: { xMm: minX, yMm: minY - wallThicknessMm / 2 },
        endMm: { xMm: maxX, yMm: minY - wallThicknessMm / 2 },
        thicknessMm: wallThicknessMm,
      } as unknown as Extract<Element, { kind: 'wall' }>,
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        levelId,
        startMm: { xMm: minX, yMm: maxY + wallThicknessMm / 2 },
        endMm: { xMm: maxX, yMm: maxY + wallThicknessMm / 2 },
        thicknessMm: wallThicknessMm,
      } as unknown as Extract<Element, { kind: 'wall' }>,
    ];
  } else {
    // Two walls along the X sides (left and right)
    return [
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        levelId,
        startMm: { xMm: minX - wallThicknessMm / 2, yMm: minY },
        endMm: { xMm: minX - wallThicknessMm / 2, yMm: maxY },
        thicknessMm: wallThicknessMm,
      } as unknown as Extract<Element, { kind: 'wall' }>,
      {
        id: crypto.randomUUID(),
        kind: 'wall',
        levelId,
        startMm: { xMm: maxX + wallThicknessMm / 2, yMm: minY },
        endMm: { xMm: maxX + wallThicknessMm / 2, yMm: maxY },
        thicknessMm: wallThicknessMm,
      } as unknown as Extract<Element, { kind: 'wall' }>,
    ];
  }
}
```

Note: Adjust field names to match the actual wall element type from `packages/core/src/index.ts`. Read the type definition first.

### B — Inspector "Add Side Walls" button

In `InspectorContent.tsx`, find `case 'shaft':`. After existing shaft inspector content (level selectors, cut floor readout), add:

```tsx
<button
  data-testid="inspector-shaft-add-side-walls"
  onClick={() => {
    const walls = buildShaftSideWalls(el as any, (el as any).baseLevelId ?? 'L1');
    for (const wall of walls) {
      onSemanticCommand?.({ type: 'createElement', element: wall });
    }
  }}
  style={{ marginTop: 8, fontSize: 12 }}>
  Add Side Walls
</button>
{sideWallsAdded && (
  <p data-testid="inspector-shaft-side-walls-added" style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>
    {sideWallsAdded} side walls added
  </p>
)}
```

Use a local `useState` for `sideWallsAdded`. Import `buildShaftSideWalls` from `'../../plan/buildShaftSideWalls'` (adjust path).

Check what commands are available for creating elements — look for `createElement` or similar in the command types. If there's no `createElement` command, use `useBimStore.setState` directly in the Workspace handler pattern for shaft — OR just dispatch individual wall create commands using the existing `createWall` command shape if it exists. Adapt to the real codebase.

### C — Palette command

In `defaultCommands.ts`:

```ts
registerCommand({
  id: 'modify.add-shaft-side-walls',
  label: 'Add Shaft Side Walls',
  keywords: ['shaft', 'side wall', 'stair', 'enclosure', 'Treppenseitenwand'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some(e => e.kind === 'shaft') ?? false,
  invoke: (ctx) => {
    const shaft = ctx.selectedElements?.find(e => e.kind === 'shaft') as any;
    if (!shaft) return;
    const walls = buildShaftSideWalls(shaft, shaft.baseLevelId ?? 'L1');
    for (const wall of walls) {
      ctx.dispatchCommand?.({ type: 'createElement', element: wall });
    }
  },
});
```

Import `buildShaftSideWalls` at the top.

### D — commandCapabilities.ts

```ts
{
  id: 'modify.add-shaft-side-walls',
  label: 'Add Shaft Side Walls',
  owner: 'cmdPalette/defaultCommands',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['cmd-k'],
  executionSurface: 'store',
  preconditions: ['selected-shaft'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§2.5.1: auto-generates 2 enclosing wall elements from shaft bounding box.',
},
```

### E — Tests

Create `packages/web/src/plan/buildShaftSideWalls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildShaftSideWalls } from './buildShaftSideWalls';

const wideShaft: any = {
  id: 's1', kind: 'shaft', baseLevelId: 'L1', topLevelId: 'L2',
  perimeterMm: [
    { xMm: 0, yMm: 0 }, { xMm: 6000, yMm: 0 },
    { xMm: 6000, yMm: 2000 }, { xMm: 0, yMm: 2000 },
  ],
};

const tallShaft: any = {
  id: 's2', kind: 'shaft', baseLevelId: 'L1', topLevelId: 'L2',
  perimeterMm: [
    { xMm: 0, yMm: 0 }, { xMm: 2000, yMm: 0 },
    { xMm: 2000, yMm: 6000 }, { xMm: 0, yMm: 6000 },
  ],
};

describe('buildShaftSideWalls — §2.5.1', () => {
  it('returns empty array for shaft with no perimeter', () => {
    const shaft: any = { id: 's0', kind: 'shaft', perimeterMm: [] };
    expect(buildShaftSideWalls(shaft, 'L1')).toHaveLength(0);
  });

  it('generates 2 walls for a valid shaft', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1');
    expect(walls).toHaveLength(2);
  });

  it('generated walls have kind wall', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1');
    expect(walls.every(w => w.kind === 'wall')).toBe(true);
  });

  it('walls use the provided levelId', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L2');
    expect(walls.every(w => (w as any).levelId === 'L2')).toBe(true);
  });

  it('wide shaft generates walls along Y axis (top/bottom sides)', () => {
    const walls = buildShaftSideWalls(wideShaft, 'L1');
    // Both walls should span x from 0 to 6000
    expect(walls.some(w => (w as any).startMm?.xMm === 0 && (w as any).endMm?.xMm === 6000)).toBe(true);
  });

  it('tall shaft generates walls along X axis (left/right sides)', () => {
    const walls = buildShaftSideWalls(tallShaft, 'L1');
    // Both walls should span y from 0 to 6000
    expect(walls.some(w => (w as any).startMm?.yMm === 0 && (w as any).endMm?.yMm === 6000)).toBe(true);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave22/D): shaft side wall generator — buildShaftSideWalls + inspector button + palette command (§2.5.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
