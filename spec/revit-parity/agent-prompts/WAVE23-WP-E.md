# Wave 23 — WP-E: Wall Join Tool Workspace Wiring (§3.5.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.5.5 "Wände fixieren, Profil anpassen und Verbinden-Werkzeug" is Partial. The wall-join tool (`wall-join`, hotkey WJ) exists in the registry with a grammar (`WallJoinState`, `reduceWallJoin`, `WallJoinVariant`) in `toolGrammar.ts`. The grammar supports idle → selected → accept/cycle phases. However, the `commitJoin` effect from the grammar is not wired to a Workspace handler — nothing persists the join variant. This task completes the wiring:

1. Add `joinOverrides?: Record<string, WallJoinVariant>` to the wall element in `packages/core/src/index.ts`
2. Add a `SetWallJoinCmd` command type to core
3. Add a Workspace handler that stores the join override on the wall endpoint
4. Add a utility `findWallsAtCorner` to find which walls share a corner point
5. Add tests for the grammar and the utility

---

## Repo orientation

```
packages/core/src/index.ts              — find wall element type (kind: 'wall')
packages/web/src/tools/toolGrammar.ts  — find WallJoinState, reduceWallJoin, WallJoinVariant (around line 939)
packages/web/src/workspace/Workspace.tsx — find 'modify.join-geometry' handler as pattern
packages/web/src/viewport/wallJoinDisplay.ts — find existing wall join display code
```

Run:

- `grep -n "WallJoinState\|WallJoinVariant\|reduceWallJoin\|WallJoinEffect\|joinVariant" packages/web/src/tools/toolGrammar.ts | head -15`
- `grep -n "kind: 'wall'\b" packages/core/src/index.ts | head -5` then read the wall type to understand its fields
- `grep -n "joinOverride\|wall-join\|WJ\b" packages/web/src/workspace/Workspace.tsx | head -10`

Read `toolGrammar.ts` lines 939–1013 for the full wall-join grammar before implementing. Read `wallJoinDisplay.ts` for context on how join display works.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add joinOverrides to wall element in packages/core/src/index.ts

Find the wall element union member (search for `kind: 'wall';`). After the existing optional fields (pinned, cutBy, etc.), add:

```ts
/** §3.5.5: per-endpoint join variant overrides. Key = adjacent wall ID, value = join variant. */
joinOverrides?: Record<string, 'miter' | 'butt' | 'square'> | null;
```

### B — Add SetWallJoinCmd in packages/core/src/index.ts

Find where other modify command types are defined (near `JoinGeometryCmd` or wall-related commands). Add:

```ts
export type SetWallJoinCmd = {
  type: 'setWallJoin';
  /** IDs of the two walls whose join is being overridden */
  wallIds: [string, string];
  variant: 'miter' | 'butt' | 'square';
};
```

Add `| SetWallJoinCmd` to the `SemanticCommand` union and export it.

### C — findWallsAtCorner utility

Create `packages/web/src/plan/findWallsAtCorner.ts`:

```ts
import type { Element } from '@bim-ai/core';

interface PointMm {
  xMm: number;
  yMm: number;
}

/**
 * Finds all wall element IDs whose endpoints are within `toleranceMm` of `cornerMm`.
 * Returns an array of wall IDs (empty if none found).
 */
export function findWallsAtCorner(
  cornerMm: PointMm,
  elementsById: Record<string, Element>,
  toleranceMm = 100,
): string[] {
  const result: string[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'wall') continue;
    const wall = el as Extract<Element, { kind: 'wall' }>;
    const startDist = Math.hypot(
      (wall as any).startMm.xMm - cornerMm.xMm,
      (wall as any).startMm.yMm - cornerMm.yMm,
    );
    const endDist = Math.hypot(
      (wall as any).endMm.xMm - cornerMm.xMm,
      (wall as any).endMm.yMm - cornerMm.yMm,
    );
    if (startDist <= toleranceMm || endDist <= toleranceMm) {
      result.push(wall.id);
    }
  }
  return result;
}
```

Note: Read the actual wall element type to confirm field names (`startMm`, `endMm` on the wall). If different, adapt.

### D — Workspace handler in packages/web/src/workspace/Workspace.tsx

Find where `'modify.join-geometry'` or similar modify commands are handled. Add a handler for `'setWallJoin'`:

```ts
if (cmd.type === 'setWallJoin') {
  const [wallIdA, wallIdB] = cmd.wallIds;
  const wallA = draft.elementsById[wallIdA];
  const wallB = draft.elementsById[wallIdB];
  if (wallA && wallA.kind === 'wall') {
    (wallA as any).joinOverrides = {
      ...((wallA as any).joinOverrides ?? {}),
      [wallIdB]: cmd.variant,
    };
  }
  if (wallB && wallB.kind === 'wall') {
    (wallB as any).joinOverrides = {
      ...((wallB as any).joinOverrides ?? {}),
      [wallIdA]: cmd.variant,
    };
  }
}
```

### E — Palette command entry

In `packages/web/src/cmdPalette/defaultCommands.ts`, add or update an entry for the wall-join command:

```ts
registerCommand({
  id: 'modify.wall-join',
  label: 'Wall Join Type',
  keywords: ['wall', 'join', 'miter', 'butt', 'square', 'Wandverbindung'],
  category: 'command',
  isAvailable: (ctx) => {
    const walls = ctx.selectedElements?.filter((e) => e.kind === 'wall') ?? [];
    return walls.length === 2;
  },
  invoke: (_ctx) => {
    // Activates the wall-join tool to pick a join corner
  },
});
```

### F — commandCapabilities.ts entry

```ts
{
  id: 'modify.wall-join',
  label: 'Wall Join Type',
  owner: 'cmdPalette/defaultCommands',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['cmd-k', 'inspector'],
  executionSurface: 'store',
  preconditions: ['two-walls-selected'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§3.5.5: stores miter/butt/square join variant on wall endpoint pair.',
},
```

### G — Tests

Create `packages/web/src/plan/findWallsAtCorner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findWallsAtCorner } from './findWallsAtCorner';

const elementsById: any = {
  w1: { id: 'w1', kind: 'wall', startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 5000, yMm: 0 } },
  w2: { id: 'w2', kind: 'wall', startMm: { xMm: 5000, yMm: 0 }, endMm: { xMm: 5000, yMm: 3000 } },
  w3: { id: 'w3', kind: 'wall', startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 0, yMm: 3000 } },
  f1: { id: 'f1', kind: 'floor', boundaryMm: [] },
};

describe('findWallsAtCorner — §3.5.5', () => {
  it('finds walls at the origin corner', () => {
    const ids = findWallsAtCorner({ xMm: 0, yMm: 0 }, elementsById);
    expect(ids).toContain('w1');
    expect(ids).toContain('w3');
  });

  it('finds walls at a non-origin corner', () => {
    const ids = findWallsAtCorner({ xMm: 5000, yMm: 0 }, elementsById);
    expect(ids).toContain('w1');
    expect(ids).toContain('w2');
  });

  it('excludes non-wall elements', () => {
    const ids = findWallsAtCorner({ xMm: 0, yMm: 0 }, elementsById);
    expect(ids).not.toContain('f1');
  });

  it('returns empty array when no walls at corner', () => {
    const ids = findWallsAtCorner({ xMm: 9999, yMm: 9999 }, elementsById);
    expect(ids).toHaveLength(0);
  });

  it('respects toleranceMm parameter', () => {
    // Point 50mm away from corner — within default 100mm tolerance
    const ids = findWallsAtCorner({ xMm: 50, yMm: 0 }, elementsById);
    expect(ids).toContain('w1');
  });

  it('excludes wall just outside tolerance', () => {
    // Point 200mm away from w2's start — outside default 100mm tolerance
    const ids = findWallsAtCorner({ xMm: 5200, yMm: 0 }, elementsById, 100);
    expect(ids).not.toContain('w2');
  });
});
```

Also create `packages/web/src/plan/wallJoinCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('SetWallJoinCmd — §3.5.5', () => {
  it('has correct shape', () => {
    const cmd = {
      type: 'setWallJoin' as const,
      wallIds: ['w1', 'w2'] as [string, string],
      variant: 'miter' as const,
    };
    expect(cmd.type).toBe('setWallJoin');
    expect(cmd.wallIds).toHaveLength(2);
    expect(cmd.variant).toBe('miter');
  });

  it('accepts butt variant', () => {
    const cmd = {
      type: 'setWallJoin' as const,
      wallIds: ['w1', 'w2'] as [string, string],
      variant: 'butt' as const,
    };
    expect(cmd.variant).toBe('butt');
  });

  it('accepts square variant', () => {
    const cmd = {
      type: 'setWallJoin' as const,
      wallIds: ['w1', 'w2'] as [string, string],
      variant: 'square' as const,
    };
    expect(cmd.variant).toBe('square');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave23/E): wall join tool wiring — joinOverrides on wall + SetWallJoinCmd + findWallsAtCorner + Workspace handler (§3.5.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
