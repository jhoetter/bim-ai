# Wave 22 — WP-B: Cut Geometry Command (§3.3.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.3.4 "Gruppe Geometrie" is Partial — "Cut Geometry: Partial (shaft openings, wall voids via CSG)". Revit's Cut Geometry command lets you pick a cutter solid (e.g. a column void family) and a host element (e.g. a wall) to remove the cutter's volume from the host. This task adds:
- `cutBy?: string[]` field on wall/floor/column elements to track what has been cut from them
- `cut-geometry` tool (hotkey CG) with 2-step grammar: pick cutter → pick host
- `modify.cut-geometry` and `modify.uncut-geometry` palette commands
- Inspector "Cut From" section showing applied cuts with "Remove Cut" buttons

---

## Repo orientation

```
packages/core/src/index.ts                      — find wall, floor, column element types
packages/web/src/tools/toolRegistry.ts          — tool registration pattern
packages/web/src/tools/toolGrammar.ts           — grammar state machine pattern
packages/web/src/plan/PlanCanvas.tsx            — click handler for tools
packages/web/src/cmdPalette/defaultCommands.ts  — palette command registration
packages/web/src/workspace/Workspace.tsx        — semantic command handlers
packages/web/src/workspace/commandCapabilities.ts — capability entries
```

Run:
- `grep -n "kind: 'wall'" packages/core/src/index.ts | head -5` to find wall type
- `grep -n "ToolId\|'join-geometry'" packages/web/src/tools/toolRegistry.ts | head -10`
- `grep -n "reduceJoin\|JoinState" packages/web/src/tools/toolGrammar.ts | head -10`

Read the join-geometry grammar as a pattern for cut-geometry.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — `cutBy` field on host elements in packages/core/src/index.ts

Find the wall element type (search for `WallElem` or `kind: 'wall'`). Add:
```ts
cutBy?: string[]; // IDs of elements that cut voids into this element
```

Add the same optional `cutBy?: string[]` field to the `FloorElem` and the column element types.

Add command types:
```ts
| { type: 'applyCutGeometry'; cutterId: string; hostId: string }
| { type: 'removeCutGeometry'; cutterId: string; hostId: string }
```

### B — CutGeometryState grammar in toolGrammar.ts

Find where `JoinGeometryState` or similar 2-pick grammar is defined. Add after it:

```ts
export type CutGeometryState =
  | { phase: 'idle' }
  | { phase: 'picking-host'; cutterId: string };

export type CutGeometryEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'pick'; elementId: string }
  | { kind: 'cancel' };

export type CutGeometryEffect =
  | { kind: 'commitCutGeometry'; cutterId: string; hostId: string };

export function reduceCutGeometry(
  state: CutGeometryState,
  event: CutGeometryEvent,
): { next: CutGeometryState; effect?: CutGeometryEffect } {
  switch (state.phase) {
    case 'idle':
      if (event.kind === 'activate') return { next: { phase: 'idle' } };
      if (event.kind === 'pick')
        return { next: { phase: 'picking-host', cutterId: event.elementId } };
      return { next: state };
    case 'picking-host':
      if (event.kind === 'cancel' || event.kind === 'deactivate')
        return { next: { phase: 'idle' } };
      if (event.kind === 'pick')
        return {
          next: { phase: 'idle' },
          effect: { kind: 'commitCutGeometry', cutterId: state.cutterId, hostId: event.elementId },
        };
      return { next: state };
  }
}
```

### C — Tool registration in toolRegistry.ts

Add `'cut-geometry'` to the `ToolId` type union (find where other tool IDs are defined).

Register in the tools array:
```ts
{
  id: 'cut-geometry',
  label: 'Cut Geometry',
  hotkey: 'CG',
  modes: ['plan'],
  group: 'modify',
},
```

### D — Workspace.tsx handlers

In `Workspace.tsx`, add handlers:

```ts
if (cmd.type === 'applyCutGeometry') {
  const { elementsById: cur } = useBimStore.getState();
  const host = cur[cmd.hostId] as any;
  if (host) {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [host.id]: {
          ...host,
          cutBy: [...new Set([...(host.cutBy ?? []), cmd.cutterId])],
        },
      },
    });
  }
  return;
}
if (cmd.type === 'removeCutGeometry') {
  const { elementsById: cur } = useBimStore.getState();
  const host = cur[cmd.hostId] as any;
  if (host) {
    useBimStore.setState({
      elementsById: {
        ...cur,
        [host.id]: {
          ...host,
          cutBy: (host.cutBy ?? []).filter((id: string) => id !== cmd.cutterId),
        },
      },
    });
  }
  return;
}
```

### E — Palette commands in defaultCommands.ts

```ts
registerCommand({
  id: 'modify.cut-geometry',
  label: 'Cut Geometry',
  keywords: ['cut', 'void', 'subtract', 'geometry', 'csg'],
  category: 'command',
  isAvailable: (ctx) => (ctx.selectedElements?.length ?? 0) >= 1,
  invoke: (ctx) => { ctx.activateTool?.('cut-geometry'); },
});

registerCommand({
  id: 'modify.uncut-geometry',
  label: 'Uncut Geometry',
  keywords: ['uncut', 'remove cut', 'void', 'geometry'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some((e) => (e as any).cutBy?.length > 0) ?? false,
  invoke: (ctx) => {
    const el = ctx.selectedElements?.find((e) => (e as any).cutBy?.length > 0) as any;
    if (el?.cutBy?.[0]) {
      ctx.dispatchCommand?.({ type: 'removeCutGeometry', cutterId: el.cutBy[0], hostId: el.id });
    }
  },
});
```

### F — Inspector section in InspectorContent.tsx

In the `case 'wall':` (and similar for floor/column) inspector section, add after existing fields:

```tsx
{/* Cut geometry readout */}
{(el as any).cutBy?.length > 0 && (
  <details style={{ marginTop: 8 }}>
    <summary data-testid="inspector-cut-by-summary" style={{ cursor: 'pointer', fontSize: 12 }}>
      Cut By ({(el as any).cutBy.length})
    </summary>
    <div style={{ marginTop: 4 }}>
      {(el as any).cutBy.map((cutterId: string, i: number) => (
        <div key={cutterId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 2 }}>
          <span data-testid={`inspector-cut-by-id-${i}`} style={{ color: '#aaa' }}>{cutterId.slice(-8)}</span>
          <button
            data-testid={`inspector-cut-by-remove-${i}`}
            onClick={() => onSemanticCommand?.({ type: 'removeCutGeometry', cutterId, hostId: el.id })}
            style={{ color: '#f87171', fontSize: 11 }}>
            Remove Cut
          </button>
        </div>
      ))}
    </div>
  </details>
)}
```

Add this block inside the `case 'wall':` JSX (near other optional sections). Also add the same inside `case 'floor':` and `case 'column':`.

### G — commandCapabilities.ts

```ts
{
  id: 'modify.cut-geometry',
  label: 'Cut Geometry',
  owner: 'cmdPalette/defaultCommands',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['cmd-k'],
  executionSurface: 'canvas',
  preconditions: ['selection-non-empty'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§3.3.4: 2-step grammar — pick cutter element then pick host element to apply void cut.',
},
{
  id: 'modify.uncut-geometry',
  label: 'Uncut Geometry',
  owner: 'cmdPalette/defaultCommands',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['cmd-k'],
  executionSurface: 'store',
  preconditions: ['selected-element-has-cuts'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§3.3.4: removes first cut from selected element.',
},
```

### H — Tests

Create `packages/web/src/tools/cutGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reduceCutGeometry } from '../tools/toolGrammar';

describe('reduceCutGeometry — §3.3.4', () => {
  it('starts idle', () => {
    const { next } = reduceCutGeometry({ phase: 'idle' }, { kind: 'activate' });
    expect(next.phase).toBe('idle');
  });

  it('transitions to picking-host on first pick', () => {
    const { next } = reduceCutGeometry({ phase: 'idle' }, { kind: 'pick', elementId: 'col1' });
    expect(next.phase).toBe('picking-host');
    expect((next as any).cutterId).toBe('col1');
  });

  it('emits commitCutGeometry on second pick', () => {
    const { next, effect } = reduceCutGeometry(
      { phase: 'picking-host', cutterId: 'col1' },
      { kind: 'pick', elementId: 'wall1' },
    );
    expect(next.phase).toBe('idle');
    expect(effect?.kind).toBe('commitCutGeometry');
    expect(effect?.cutterId).toBe('col1');
    expect(effect?.hostId).toBe('wall1');
  });

  it('cancels back to idle on cancel', () => {
    const { next } = reduceCutGeometry({ phase: 'picking-host', cutterId: 'col1' }, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
  });
});
```

Create `packages/web/src/workspace/cutGeometryCommands.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useBimStore } from '../state/store';

beforeEach(() => {
  useBimStore.setState({
    elementsById: {
      'w1': { id: 'w1', kind: 'wall', levelId: 'L1', startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 5000, yMm: 0 }, thicknessMm: 200 },
    },
  });
});

describe('cut geometry commands — §3.3.4', () => {
  it('applyCutGeometry adds cutterId to host cutBy', () => {
    useBimStore.getState().onSemanticCommand?.({ type: 'applyCutGeometry', cutterId: 'col1', hostId: 'w1' });
    const wall = useBimStore.getState().elementsById['w1'] as any;
    expect(wall.cutBy).toContain('col1');
  });

  it('applyCutGeometry deduplicates cutter IDs', () => {
    useBimStore.getState().onSemanticCommand?.({ type: 'applyCutGeometry', cutterId: 'col1', hostId: 'w1' });
    useBimStore.getState().onSemanticCommand?.({ type: 'applyCutGeometry', cutterId: 'col1', hostId: 'w1' });
    const wall = useBimStore.getState().elementsById['w1'] as any;
    expect(wall.cutBy.filter((id: string) => id === 'col1')).toHaveLength(1);
  });

  it('removeCutGeometry removes cutterId from host', () => {
    useBimStore.setState({ elementsById: { 'w1': { ...useBimStore.getState().elementsById['w1'], cutBy: ['col1'] } as any } });
    useBimStore.getState().onSemanticCommand?.({ type: 'removeCutGeometry', cutterId: 'col1', hostId: 'w1' });
    const wall = useBimStore.getState().elementsById['w1'] as any;
    expect(wall.cutBy ?? []).not.toContain('col1');
  });
});
```

Note: If `onSemanticCommand` is not exposed on the store, adapt the test to dispatch commands through `Workspace.tsx`'s `handleSemanticCommand` directly (grep for how other similar tests call commands in the project).

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave22/B): cut geometry command — cutBy field + 2-step grammar + palette commands + inspector readout (§3.3.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
