# Wave 19 — WP-I: Auto-Dimension — Workspace Wiring + Plan Canvas Rendering (§4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-H created:

- `packages/web/src/plan/autoDimensionWalls.ts` — `autoDimensionWalls()` — generates `permanent_dimension` elements from wall sets

**Still missing:**

- `autoDimension` command type in `core/index.ts`
- `Workspace.tsx` handler that calls `autoDimensionWalls` and dispatches `createElement` for each returned dim
- Palette command `annotate.auto-dimension-walls` properly dispatching the command
- Plan canvas rendering: `permanent_dimension` elements already render — verify wiring
- Tests for the wiring

---

## Repo orientation

```
packages/core/src/index.ts
packages/web/src/plan/autoDimensionWalls.ts        — autoDimensionWalls (already exists)
packages/web/src/workspace/Workspace.tsx
packages/web/src/plan/symbology.ts                 — rebuildPlanMeshes (check permanent_dimension rendering)
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `autoDimensionWalls.ts` top-to-bottom — understand the function signature and what it returns. Read `Workspace.tsx` to find where `autoDimension` or `tag-all-rooms` palette commands are handled — look for the existing `autoDimension` case. Read `symbology.ts` to verify `permanent_dimension` elements are rendered in the plan canvas elements loop.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Command type in `core/index.ts`

Add if not present:

```ts
| { type: 'autoDimensionWalls'; levelId: string | null; offsetMm?: number }
```

---

### B — `Workspace.tsx` handler

Import `autoDimensionWalls`:

```ts
import { autoDimensionWalls } from '../plan/autoDimensionWalls';
```

In the semantic command handler switch:

```ts
case 'autoDimensionWalls': {
  const walls = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'wall' }> =>
      e?.kind === 'wall' && (cmd.levelId === null || (e as any).levelId === cmd.levelId),
  );
  const dims = autoDimensionWalls(walls, cmd.offsetMm ?? 1000);
  for (const dim of dims) {
    elementsById[dim.id] = dim;
  }
  break;
}
```

---

### C — Palette command update in `defaultCommands.ts`

Find the existing `annotate.auto-dimension-walls` command (or `modify.auto-dimension` — check what exists). If it calls something other than the new `autoDimensionWalls` command, update it:

```ts
{ id: 'annotate.auto-dimension-walls', label: 'Auto-Dimension Walls',
  keywords: ['auto', 'dimension', 'walls', 'annotate', 'automatic'],
  category: 'command', invoke: (ctx) => {
    const levelId = ctx.activePlanView?.levelId ?? null;
    void ctx.onSemanticCommand?.({ type: 'autoDimensionWalls', levelId });
  } }
```

If the command already exists with that ID, update the `invoke` to dispatch `{ type: 'autoDimensionWalls', levelId }`.

In `commandCapabilities.ts`, add or confirm:

```ts
{ id: 'annotate.auto-dimension-walls', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### D — Verify `permanent_dimension` rendering in `symbology.ts`

Read the `rebuildPlanMeshes` elements loop. Check that `case 'permanent_dimension':` exists. If it does not, add a minimal version:

```ts
case 'permanent_dimension': {
  // permanent_dimension is rendered by planElementMeshBuilders.ts — import and call it
  // or build a simple line+label mesh
  // If planElementMeshBuilders already handles it, just ensure it's wired in the loop
  break;
}
```

If `permanentDimensionThree` or similar already exists and is called elsewhere, trace how it's included and ensure it also runs for auto-generated dimensions.

---

### E — Tests

`packages/web/src/plan/autoDimensionWiring.test.ts`:

```ts
import { autoDimensionWalls } from './autoDimensionWalls';

describe('autoDimensionWalls wiring — §4.1', () => {
  it('returns empty array for no walls', () => {
    const result = autoDimensionWalls([]);
    expect(result).toHaveLength(0);
  });

  it('generates a dimension for one horizontal wall', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w1',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
    };
    const dims = autoDimensionWalls([wall]);
    expect(dims.length).toBeGreaterThan(0);
    expect(dims[0]!.kind).toBe('permanent_dimension');
  });

  it('generates a dimension for one vertical wall', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w2',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 0, yMm: 4000 },
    };
    const dims = autoDimensionWalls([wall]);
    expect(dims.length).toBeGreaterThan(0);
  });

  it('uses offsetMm parameter', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w3',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
    };
    const dims = autoDimensionWalls([wall], 2000);
    expect(dims[0]!.offsetMm.yMm).toBe(-2000);
  });

  it('generated dimensions have valid witnessPointsMm', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w4',
      levelId: 'L1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
    };
    const dims = autoDimensionWalls([wall]);
    for (const dim of dims) {
      expect(dim.witnessPointsMm.length).toBeGreaterThanOrEqual(2);
    }
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/I): auto-dimension walls — autoDimensionWalls command type + Workspace handler + palette wiring (§4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
