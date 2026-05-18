# Wave 32 — WP-D: Join Geometry Visual Merge (§2.4.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§2.4.3 "Pin vs Join" is Partial P1. Element pinning is done. Join Geometry palette commands exist (`modify.join-geometry` / `modify.unjoin-geometry`). What's missing: when two elements are joined, the visual should reflect it — in Revit, joined walls/floors suppress the interior line at their intersection and merge material boundaries. True CSG boolean geometry is complex; instead implement a **visual join flag**: store joined element pairs in the store, and render joined elements without the separator line in the plan view (suppressed interior edge).

This task adds:

1. `joinedPairs: string[][]` field in the Zustand store (each inner array is a sorted pair of element IDs)
2. `JoinGeometryCmd` / `UnjoinGeometryCmd` in core (they may already exist — check first)
3. Workspace handlers that update `joinedPairs`
4. Plan symbology: suppressed separator line between joined elements (skip rendering the shared edge)
5. `modify.join-geometry` capability (may already exist — check, upgrade if partial)
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                     — find existing JoinGeometryCmd / UnjoinGeometryCmd
packages/web/src/workspace/Workspace.tsx       — find existing join-geometry handlers
packages/web/src/state/storeViewportRuntimeSlice.ts  — find store for joinedPairs
packages/web/src/plan/symbology.ts             — find where wall plan lines are rendered
```

Run before editing:

- `grep -n "JoinGeometry\|joinGeometry\|join-geometry\|unjoin\|joinedPairs\|joinOverrides" packages/core/src/index.ts | head -15`
- `grep -n "join.*geometry\|joinGeometry\|joinedPairs" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "joinedPairs\|joinedWith\|join" packages/web/src/state/storeViewportRuntimeSlice.ts | head -10`
- `grep -n "modify.join-geometry\|join-geometry" packages/web/src/workspace/commandCapabilities.ts | head -5`

Read results carefully — if `JoinGeometryCmd`/`UnjoinGeometryCmd` already exist, just wire the store update. If the capability already exists, upgrade it instead of adding a duplicate.

---

## Tasks

### A — JoinGeometryCmd / UnjoinGeometryCmd in core

Check if they already exist. If not, add:

```ts
export type JoinGeometryCmd = {
  type: 'joinGeometry';
  elementIdA: string;
  elementIdB: string;
};

export type UnjoinGeometryCmd = {
  type: 'unjoinGeometry';
  elementIdA: string;
  elementIdB: string;
};
```

Add to `SemanticCommand` only if not already present. Export them.

### B — joinedPairs in store

In `packages/web/src/state/storeViewportRuntimeSlice.ts`, add:

```ts
/** §2.4.3: pairs of joined element IDs (sorted). Each pair is [idA, idB] where idA < idB lexicographically. */
joinedPairs: [string, string][];
```

Initial value: `[]`.

Read the file carefully before editing to match the existing store pattern.

### C — Workspace handlers

In `packages/web/src/workspace/Workspace.tsx`, find where join-geometry is handled (if it exists). Add or update:

```ts
if (cmd.type === 'joinGeometry') {
  const pair: [string, string] = [cmd.elementIdA, cmd.elementIdB].sort() as [string, string];
  useBimStore.setState((s: any) => {
    const existing: [string, string][] = s.joinedPairs ?? [];
    const alreadyJoined = existing.some(([a, b]) => a === pair[0] && b === pair[1]);
    if (alreadyJoined) return s;
    return { joinedPairs: [...existing, pair] };
  });
  return;
}

if (cmd.type === 'unjoinGeometry') {
  const pair = [cmd.elementIdA, cmd.elementIdB].sort();
  useBimStore.setState((s: any) => ({
    joinedPairs: (s.joinedPairs ?? []).filter(
      ([a, b]: [string, string]) => !(a === pair[0] && b === pair[1]),
    ),
  }));
  return;
}
```

### D — Plan symbology: joined element indicator

In `packages/web/src/plan/symbology.ts` (or `planElementMeshBuilders.ts`), find where wall plan outlines are rendered. After the existing rendering loop, add a pass that renders a small "join indicator" diamond at the midpoint between joined wall pairs:

```ts
// §2.4.3: join indicator between joined element pairs
const joinedPairs: [string, string][] = (useBimStore.getState() as any).joinedPairs ?? [];
for (const [idA, idB] of joinedPairs) {
  const elA = elementsById[idA];
  const elB = elementsById[idB];
  if (!elA || !elB) continue;
  // Simple indicator: a small circle at the midpoint between the two elements' positions
  const posA = (elA as any).startMm ?? (elA as any).positionMm ?? { xMm: 0, yMm: 0 };
  const posB = (elB as any).startMm ?? (elB as any).positionMm ?? { xMm: 0, yMm: 0 };
  const midX = ux(((posA.xMm ?? 0) + (posB.xMm ?? 0)) / 2);
  const midZ = uz(((posA.yMm ?? 0) + (posB.yMm ?? 0)) / 2);
  const geo = new THREE.CircleGeometry(0.04, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(midX, PLAN_Y + 0.005, midZ);
  mesh.userData.joinIndicator = true;
  holder.add(mesh);
}
```

**Important**: Read the actual symbology file to understand how `ux`, `uz`, `PLAN_Y`, `holder`, and `elementsById` are accessed. The exact variable names may differ. If `useBimStore.getState()` is not available in that context, read `joinedPairs` from the function parameter instead. Adapt accordingly — the key requirement is that joined pairs get a visual indicator.

### E — commandCapabilities.ts

Check if `modify.join-geometry` already exists. If it does, find it and update `status` to `'implemented'` and add any missing notes about `joinedPairs`. If it doesn't exist, add:

```ts
{
  id: 'modify.join-geometry',
  label: 'Join / Unjoin Geometry',
  owner: 'workspace/Workspace',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan', '3d'],
  surfaces: ['inspector', 'cmd-k'],
  executionSurface: 'store',
  preconditions: ['two-solid-elements-selected'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§2.4.3: JoinGeometryCmd/UnjoinGeometryCmd store sorted element ID pairs in joinedPairs[]; plan symbology renders a join indicator circle at the midpoint between joined elements.',
},
```

Ensure a matching `registerCommand` for `modify.join-geometry` exists in `defaultCommands.ts`. If it already exists, verify it has the correct `isAvailable` and `invoke`.

### F — Tests

Create `packages/web/src/plan/joinGeometryVisual.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Join geometry visual merge — §2.4.3', () => {
  it('joinedPairs stores sorted element ID pairs', () => {
    const pair = ['elem-b', 'elem-a'].sort() as [string, string];
    expect(pair).toEqual(['elem-a', 'elem-b']);
  });

  it('JoinGeometryCmd has correct shape', () => {
    const cmd = { type: 'joinGeometry' as const, elementIdA: 'w1', elementIdB: 'w2' };
    expect(cmd.type).toBe('joinGeometry');
  });

  it('UnjoinGeometryCmd has correct shape', () => {
    const cmd = { type: 'unjoinGeometry' as const, elementIdA: 'w1', elementIdB: 'w2' };
    expect(cmd.type).toBe('unjoinGeometry');
  });

  it('joining two elements deduplicates if already joined', () => {
    const existing: [string, string][] = [['w1', 'w2']];
    const newPair: [string, string] = ['w1', 'w2'];
    const alreadyJoined = existing.some(([a, b]) => a === newPair[0] && b === newPair[1]);
    const result = alreadyJoined ? existing : [...existing, newPair];
    expect(result.length).toBe(1);
  });

  it('unjoining removes the pair', () => {
    const existing: [string, string][] = [
      ['w1', 'w2'],
      ['w3', 'w4'],
    ];
    const pair = ['w1', 'w2'];
    const result = existing.filter(([a, b]) => !(a === pair[0] && b === pair[1]));
    expect(result).toEqual([['w3', 'w4']]);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave32/D): join geometry visual — joinedPairs store + JoinGeometryCmd/UnjoinGeometryCmd handlers + join indicator in plan symbology + modify.join-geometry capability (§2.4.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
