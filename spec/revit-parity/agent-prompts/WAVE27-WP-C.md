# Wave 27 — WP-C: Stacked Dimension Strings + Reference Plane Dim Target (§4.2.6 + §4.2.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

**§4.2.6** is Partial P2. Multiple parallel dimension chains can be placed. Auto-stacking (automatically distributing parallel dim strings at equal spacing offsets) is Not Started.

**§4.2.7** is Partial P2. Reference planes exist. Snapping dimensions to reference planes as reference targets is Partial.

This task adds:
1. `stackDimensions` utility — takes N parallel `permanent_dimension` elements sharing the same axis and redistributes their `offsetMm` (perpendicular offset) so they are stacked at even 7mm spacing
2. `StackDimensionsCmd` command type
3. Workspace handler
4. `modify.stack-dimensions` palette command
5. Reference plane as a dimension witness point target (add `reference_plane` to allowed `referencedElementId` types)
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                    — find permanent_dimension element, DimWitnessPoint, offsetMm
packages/web/src/workspace/Workspace.tsx      — find permanent_dimension handler as pattern
packages/web/src/cmdPalette/defaultCommands.ts — find 'annotate.' commands as pattern
```

Run before editing:
- `grep -n "permanent_dimension\|offsetMm\|DimWitness\|witness" packages/core/src/index.ts | head -15`
- `grep -n "permanent_dimension\|stackDim" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "reference_plane\|referencedElement" packages/core/src/index.ts | head -10`

Read the `permanent_dimension` element type carefully to understand `offsetMm`, `startMm`, `endMm`, `isVertical`/`axisDeg`.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Confirm permanent_dimension has offsetMm

Check that `permanent_dimension` in `packages/core/src/index.ts` has `offsetMm?: number` (the perpendicular distance from the measured line to the dim line). If missing, add it.

Also check if `DimWitnessPoint` type exists. If `referencedElementId?` is on it, that's where reference planes can be added.

### B — Create stackDimensions utility

Create `packages/web/src/plan/stackDimensions.ts`:

```ts
import type { Element } from '@bim-ai/core';

type PermanentDimension = Extract<Element, { kind: 'permanent_dimension' }>;

/**
 * §4.2.6: groups parallel permanent_dimension elements and redistributes
 * their offsetMm so they stack at even 7mm spacing (innermost at 7mm, next at 14mm, etc.)
 *
 * Two dims are "parallel" if they share the same axis (both vertical, or both
 * within 5° of each other). Returns a map of elementId → new offsetMm.
 */
export function stackDimensions(
  dims: PermanentDimension[],
  spacingMm = 7,
): Map<string, number> {
  const result = new Map<string, number>();
  if (dims.length === 0) return result;

  // Group by axis: vertical (isVertical) vs horizontal
  const verticals = dims.filter((d) => (d as any).isVertical);
  const horizontals = dims.filter((d) => !(d as any).isVertical);

  const assignOffsets = (group: PermanentDimension[]) => {
    // Sort by current offsetMm ascending (innermost first)
    const sorted = [...group].sort(
      (a, b) => ((a as any).offsetMm ?? spacingMm) - ((b as any).offsetMm ?? spacingMm),
    );
    sorted.forEach((dim, i) => {
      result.set(dim.id, spacingMm * (i + 1));
    });
  };

  assignOffsets(verticals);
  assignOffsets(horizontals);
  return result;
}
```

### C — Add StackDimensionsCmd

Find where `permanent_dimension`-related commands are defined. Add:

```ts
export type StackDimensionsCmd = {
  type: 'stackDimensions';
  /** IDs of the permanent_dimension elements to stack. If empty, stacks all in active view. */
  dimensionIds?: string[];
  /** Spacing between stacked dim lines in mm. Default 7. */
  spacingMm?: number;
};
```

Add `| StackDimensionsCmd` to `SemanticCommand` and export it.

### D — Workspace handler

Find where dimension commands are handled. Add:

```ts
if (cmd.type === 'stackDimensions') {
  const { elementsById: cur } = useBimStore.getState();
  const allDims = Object.values(cur).filter((el) => el.kind === 'permanent_dimension') as any[];
  const targetDims = (cmd.dimensionIds as string[] | undefined)?.length
    ? allDims.filter((d) => (cmd.dimensionIds as string[]).includes(d.id))
    : allDims;
  const offsets = stackDimensions(targetDims, (cmd.spacingMm as number | undefined) ?? 7);
  const updates: Record<string, any> = { ...cur };
  for (const [id, offsetMm] of offsets) {
    updates[id] = { ...cur[id], offsetMm };
  }
  useBimStore.setState({ elementsById: updates });
  return;
}
```

Import `stackDimensions` from `'../plan/stackDimensions'` (adjust path).

### E — palette command

In `defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'modify.stack-dimensions',
  label: 'Stack Dimensions',
  keywords: ['stack', 'dimensions', 'align', 'spacing', 'EQ'],
  category: 'modify',
  isAvailable: () => true,
  invoke: (ctx) => {
    ctx.onSemanticCommand?.({ type: 'stackDimensions' });
  },
});
```

### F — commandCapabilities.ts entry

```ts
{
  id: 'modify.stack-dimensions',
  label: 'Stack Dimensions',
  owner: 'plan/stackDimensions',
  group: 'modify',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§4.2.6: redistributes parallel permanent_dimension elements at even 7mm stacking offsets; §4.2.7: reference planes usable as dim witness point targets.',
},
```

### G — Tests

Create `packages/web/src/plan/stackDimensions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stackDimensions } from './stackDimensions';

function makeDim(id: string, isVertical: boolean, offsetMm: number): any {
  return { kind: 'permanent_dimension', id, isVertical, offsetMm };
}

describe('stackDimensions — §4.2.6', () => {
  it('returns empty map for empty input', () => {
    expect(stackDimensions([])).toEqual(new Map());
  });

  it('assigns first dim to spacing offset', () => {
    const dims = [makeDim('d1', false, 10)];
    const result = stackDimensions(dims, 7);
    expect(result.get('d1')).toBe(7);
  });

  it('assigns two dims at 7mm and 14mm', () => {
    const dims = [makeDim('d1', false, 5), makeDim('d2', false, 15)];
    const result = stackDimensions(dims, 7);
    const offsets = [...result.values()].sort((a, b) => a - b);
    expect(offsets).toEqual([7, 14]);
  });

  it('stacks vertical and horizontal dims independently', () => {
    const dims = [
      makeDim('v1', true, 5),
      makeDim('v2', true, 10),
      makeDim('h1', false, 5),
    ];
    const result = stackDimensions(dims, 7);
    const vertOffsets = [result.get('v1'), result.get('v2')].sort((a, b) => a! - b!);
    expect(vertOffsets).toEqual([7, 14]);
    expect(result.get('h1')).toBe(7);
  });

  it('uses custom spacing', () => {
    const dims = [makeDim('d1', false, 5), makeDim('d2', false, 8)];
    const result = stackDimensions(dims, 10);
    const offsets = [...result.values()].sort((a, b) => a - b);
    expect(offsets).toEqual([10, 20]);
  });

  it('StackDimensionsCmd has correct shape', () => {
    const cmd = { type: 'stackDimensions' as const, spacingMm: 8 };
    expect(cmd.type).toBe('stackDimensions');
    expect(cmd.spacingMm).toBe(8);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave27/C): stacked dimension strings — stackDimensions() utility + StackDimensionsCmd + Workspace handler + modify.stack-dimensions palette command (§4.2.6 §4.2.7)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
