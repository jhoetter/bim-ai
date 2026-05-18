# Wave 24 — WP-B: Stair Flip Command (§8.6.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§8.6.4 "Standard-Treppe umbauen" is Partial. Stair editing grips exist (riser-count drag, run-width drag) and inspector inputs for `riserCount`/`runWidthMm`/`landingDepthMm` exist. What's missing is the ability to **mirror/flip a stair** horizontally or vertically — a common edit action in Revit's stair editor. This task adds a `FlipStairCmd` command type, a Workspace handler that mirrors the stair's `runs` geometry, and inspector "Flip H / Flip V" buttons.

---

## Repo orientation

```
packages/core/src/index.ts                — find stair element type (kind: 'stair') and its runs[] field
packages/web/src/workspace/Workspace.tsx  — find 'enterStairEditMode' or stair handlers as pattern (~line 2700+)
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'stair': for inspector additions
```

Run before editing:
- `grep -n "kind: 'stair'" packages/core/src/index.ts | head -5`
- Read the stair type carefully to understand the `runs` field structure (startMm, endMm, etc.)
- `grep -n "stair\|Stair" packages/web/src/workspace/Workspace.tsx | grep "if.*cmd.type\|enterStair\|exitStair" | head -10`
- `grep -n "case 'stair'" packages/web/src/workspace/inspector/InspectorContent.tsx | head -5`

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add FlipStairCmd to packages/core/src/index.ts

Find where stair commands are defined (search for `enterStairEditMode` or `'stair'` commands). Add:

```ts
export type FlipStairCmd = {
  type: 'flipStair';
  stairId: string;
  /** 'horizontal' mirrors along the vertical axis (left↔right), 'vertical' mirrors top↔bottom */
  axis: 'horizontal' | 'vertical';
};
```

Add `| FlipStairCmd` to the `SemanticCommand` union and export it.

### B — Workspace handler in packages/web/src/workspace/Workspace.tsx

Find stair-related command handlers. Add a handler for `'flipStair'`:

The handler should:
1. Get the stair element from `elementsById`
2. Compute the bounding box of all run start/end points
3. Mirror each run's `startMm`/`endMm` about the bounding box center

```ts
if (cmd.type === 'flipStair') {
  const { elementsById: cur } = useBimStore.getState();
  const stair = cur[cmd.stairId as string];
  if (!stair || stair.kind !== 'stair') return;
  const runs = (stair as any).runs ?? [];
  if (runs.length === 0) return;

  // Compute bounding box center
  const allX = runs.flatMap((r: any) => [r.startMm?.xMm ?? 0, r.endMm?.xMm ?? 0]);
  const allY = runs.flatMap((r: any) => [r.startMm?.yMm ?? 0, r.endMm?.yMm ?? 0]);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const flipPt = (pt: { xMm: number; yMm: number }) =>
    cmd.axis === 'horizontal'
      ? { xMm: 2 * cx - pt.xMm, yMm: pt.yMm }
      : { xMm: pt.xMm, yMm: 2 * cy - pt.yMm };

  const flippedRuns = runs.map((r: any) => ({
    ...r,
    startMm: r.startMm ? flipPt(r.startMm) : r.startMm,
    endMm: r.endMm ? flipPt(r.endMm) : r.endMm,
  }));

  useBimStore.setState({
    elementsById: {
      ...cur,
      [stair.id]: { ...stair, runs: flippedRuns } as any,
    },
  });
  return;
}
```

**Note**: Read the actual stair element type to confirm field names. The stair's run points might be stored differently — adapt to the actual structure.

### C — Inspector buttons in packages/web/src/workspace/inspector/InspectorContent.tsx

Find `case 'stair':` in the inspector. Add "Flip H" and "Flip V" buttons near the existing stair inspector controls:

```tsx
{/* §8.6.4: flip stair buttons */}
<div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
  <button
    data-testid="inspector-stair-flip-h"
    style={{ fontSize: 12 }}
    onClick={() =>
      onDispatchCommand?.({ type: 'flipStair', stairId: el.id, axis: 'horizontal' })
    }
  >
    ⇔ Flip H
  </button>
  <button
    data-testid="inspector-stair-flip-v"
    style={{ fontSize: 12 }}
    onClick={() =>
      onDispatchCommand?.({ type: 'flipStair', stairId: el.id, axis: 'vertical' })
    }
  >
    ⇕ Flip V
  </button>
</div>
```

### D — commandCapabilities.ts entry

Add to `packages/web/src/workspace/commandCapabilities.ts`:

```ts
{
  id: 'modify.flip-stair',
  label: 'Flip Stair',
  owner: 'workspace/inspector',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['inspector'],
  executionSurface: 'store',
  preconditions: ['selected-stair'],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§8.6.4: mirrors stair run geometry horizontally or vertically about its bounding box center.',
},
```

### E — Tests

Create `packages/web/src/plan/flipStair.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

// Pure geometry helper — mirrors a point about a center
function flipPt(
  pt: { xMm: number; yMm: number },
  cx: number,
  cy: number,
  axis: 'horizontal' | 'vertical',
): { xMm: number; yMm: number } {
  return axis === 'horizontal'
    ? { xMm: 2 * cx - pt.xMm, yMm: pt.yMm }
    : { xMm: pt.xMm, yMm: 2 * cy - pt.yMm };
}

describe('flipStair geometry — §8.6.4', () => {
  it('horizontal flip mirrors xMm about center', () => {
    const pt = { xMm: 100, yMm: 50 };
    const flipped = flipPt(pt, 200, 0, 'horizontal');
    expect(flipped.xMm).toBe(300);
    expect(flipped.yMm).toBe(50);
  });

  it('vertical flip mirrors yMm about center', () => {
    const pt = { xMm: 50, yMm: 100 };
    const flipped = flipPt(pt, 0, 200, 'vertical');
    expect(flipped.xMm).toBe(50);
    expect(flipped.yMm).toBe(300);
  });

  it('double flip restores original', () => {
    const pt = { xMm: 300, yMm: 150 };
    const once = flipPt(pt, 200, 200, 'horizontal');
    const twice = flipPt(once, 200, 200, 'horizontal');
    expect(twice.xMm).toBeCloseTo(pt.xMm);
    expect(twice.yMm).toBeCloseTo(pt.yMm);
  });

  it('FlipStairCmd has correct shape', () => {
    const cmd = { type: 'flipStair' as const, stairId: 's1', axis: 'horizontal' as const };
    expect(cmd.type).toBe('flipStair');
    expect(cmd.axis).toBe('horizontal');
  });

  it('accepts vertical axis', () => {
    const cmd = { type: 'flipStair' as const, stairId: 's1', axis: 'vertical' as const };
    expect(cmd.axis).toBe('vertical');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave24/B): stair flip command — FlipStairCmd + Workspace handler + inspector Flip H/V buttons (§8.6.4)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
