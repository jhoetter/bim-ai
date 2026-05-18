# Wave 22 — WP-E: Family Swept Blend Form (§15.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§15.1.2 "Die Multifunktionsleiste Erstellen" is Partial. Wave 16 WP-B added `family_blend` and `family_sweep`. What's still missing is "swept blend" — a solid that sweeps along a path while interpolating between two profiles (the profile morphs from start to end along the path). This task adds `family_swept_blend` element type + mesh builder + grammar + inspector.

---

## Repo orientation

```
packages/core/src/index.ts                      — find family_blend, family_sweep types + element union
packages/web/src/meshBuilders/familyBlend.ts    — pattern for lofted mesh builder
packages/web/src/meshBuilders/familySweep.ts    — pattern for path-extruded mesh builder
packages/web/src/tools/toolRegistry.ts          — tool registration
packages/web/src/tools/toolGrammar.ts           — existing family tool grammar patterns
packages/web/src/familyEditor/FamilyEditorWorkbench.tsx — where to add "Add Swept Blend" button
packages/web/src/workspace/inspector/InspectorContent.tsx — add inspector case
```

Run:

- `grep -n "family_blend\|family_sweep\|FamilyBlend\|FamilySweep" packages/core/src/index.ts | head -15`
- `find packages/web/src -name "familyBlend*" -o -name "familySweep*"` to find mesh builder files
- `grep -n "family-blend\|family-sweep" packages/web/src/tools/toolRegistry.ts | head -10`

Read `packages/core/src/index.ts` for `FamilyBlend` and `FamilySweep` type shapes before adding the new type. Read `meshBuilders/familyBlend.ts` for the loft-geometry pattern.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — FamilySweptBlend type in packages/core/src/index.ts

Find `FamilyBlend` and `FamilySweep` type definitions. Add after them:

```ts
export interface FamilySweptBlend {
  id: string;
  kind: 'family_swept_blend';
  /** Start profile polygon in local XY plane */
  startProfileMm: Array<{ xMm: number; yMm: number }>;
  /** End profile polygon in local XY plane (may have different shape/size) */
  endProfileMm: Array<{ xMm: number; yMm: number }>;
  /** Path points that the cross-section is swept along */
  pathMm: Array<{ xMm: number; yMm: number; zMm?: number }>;
  baseElevationMm?: number;
  materialKey?: string;
}
```

Add `FamilySweptBlend` to the `Element` type union (find `| FamilySweep` and add `| FamilySweptBlend` beside it).

Also export a type alias: `export type { FamilySweptBlend };`

### B — meshBuilders.familySweptBlend.ts

Create `packages/web/src/meshBuilders/meshBuilders.familySweptBlend.ts`:

```ts
import * as THREE from 'three';
import type { FamilySweptBlend } from '@bim-ai/core';

/**
 * Builds a swept-blend mesh by interpolating between startProfile and endProfile
 * at each path segment, creating N-1 lofted quad strips connecting consecutive profile slices.
 */
export function buildFamilySweptBlendMesh(form: FamilySweptBlend): THREE.Mesh | null {
  const { startProfileMm, endProfileMm, pathMm } = form;
  if (!pathMm || pathMm.length < 2) return null;
  if (!startProfileMm || startProfileMm.length < 3) return null;
  if (!endProfileMm || endProfileMm.length < 3) return null;

  const N = pathMm.length;
  const positions: number[] = [];
  const indices: number[] = [];

  // Build one "slice" of profile per path point by lerping between start and end profiles
  // Use the vertex count of startProfile (simplify: match counts)
  const vCount = Math.min(startProfileMm.length, endProfileMm.length);
  const SCALE = 0.001; // mm → m

  for (let pathIdx = 0; pathIdx < N; pathIdx++) {
    const t = pathIdx / (N - 1);
    const pathPt = pathMm[pathIdx];

    for (let vi = 0; vi < vCount; vi++) {
      const sp = startProfileMm[vi % startProfileMm.length];
      const ep = endProfileMm[vi % endProfileMm.length];
      const lx = sp.xMm + (ep.xMm - sp.xMm) * t;
      const ly = sp.yMm + (ep.yMm - sp.yMm) * t;
      positions.push(
        (pathPt.xMm + lx) * SCALE,
        (pathPt.yMm + ly) * SCALE,
        (pathPt.zMm ?? 0) * SCALE,
      );
    }
  }

  // Quad strips between consecutive slices
  for (let si = 0; si < N - 1; si++) {
    for (let vi = 0; vi < vCount; vi++) {
      const a = si * vCount + vi;
      const b = si * vCount + ((vi + 1) % vCount);
      const c = (si + 1) * vCount + ((vi + 1) % vCount);
      const d = (si + 1) * vCount + vi;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: '#b0c4de', side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}
```

### C — Tool registration in toolRegistry.ts

Add `'family-swept-blend'` to the `ToolId` type union and register:

```ts
{
  id: 'family-swept-blend',
  label: 'Swept Blend',
  hotkey: 'FSB',
  modes: ['plan'],
  group: 'family',
},
```

### D — Grammar in toolGrammar.ts

Find `reduceFamilySweep` or `reduceFamilyBlend` as a pattern. Add a minimal grammar:

```ts
export type FamilySweptBlendState =
  | { phase: 'idle' }
  | { phase: 'recording-path'; points: Array<{ xMm: number; yMm: number }> };

export type FamilySweptBlendEvent =
  | { kind: 'activate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'confirm' }
  | { kind: 'cancel' };

export type FamilySweptBlendEffect = {
  kind: 'createFamilySweptBlend';
  pathMm: Array<{ xMm: number; yMm: number }>;
};

export function reduceFamilySweptBlend(
  state: FamilySweptBlendState,
  event: FamilySweptBlendEvent,
): { next: FamilySweptBlendState; effect?: FamilySweptBlendEffect } {
  switch (state.phase) {
    case 'idle':
      if (event.kind === 'activate') return { next: { phase: 'idle' } };
      if (event.kind === 'click')
        return { next: { phase: 'recording-path', points: [{ xMm: event.xMm, yMm: event.yMm }] } };
      return { next: state };
    case 'recording-path':
      if (event.kind === 'cancel') return { next: { phase: 'idle' } };
      if (event.kind === 'click')
        return {
          next: { ...state, points: [...state.points, { xMm: event.xMm, yMm: event.yMm }] },
        };
      if (event.kind === 'confirm' && state.points.length >= 2)
        return {
          next: { phase: 'idle' },
          effect: { kind: 'createFamilySweptBlend', pathMm: state.points },
        };
      return { next: state };
  }
}
```

### E — Inspector case in InspectorContent.tsx

Add `case 'family_swept_blend':` after `case 'family_sweep':`:

```tsx
case 'family_swept_blend': {
  const fsb = el as FamilySweptBlend;
  return (
    <div data-testid="inspector-family-swept-blend" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Path Points</span>
        <span data-testid="inspector-fsb-path-count" className="text-sm">
          {fsb.pathMm?.length ?? 0}
        </span>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">Start Profile</span>
        <span data-testid="inspector-fsb-start-count" className="text-sm">
          {fsb.startProfileMm?.length ?? 0} pts
        </span>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-xs text-muted w-28 shrink-0">End Profile</span>
        <span data-testid="inspector-fsb-end-count" className="text-sm">
          {fsb.endProfileMm?.length ?? 0} pts
        </span>
      </div>
    </div>
  );
}
```

Import `FamilySweptBlend` from `'@bim-ai/core'`.

### F — FamilyEditorWorkbench "Add Swept Blend" button

In `FamilyEditorWorkbench.tsx`, find the "Add Swept Blend" or similar section (near `family-editor-add-frame-btn`). Add:

```tsx
<button
  data-testid="family-editor-add-swept-blend-btn"
  onClick={() => {
    // Creates a default swept blend with a 4-pt square start, hexagonal end, straight path
    onLoadIntoProject?.({
      // Adapt to actual onLoadIntoProject signature — or call onSemanticCommand pattern
    });
  }}
  className="text-xs"
>
  Add Swept Blend
</button>
```

Note: Read the actual workbench code before editing. If `onLoadIntoProject` is not the right way to add elements, look for how other "Add X" buttons work in the file and follow the same pattern. The key requirement is that `data-testid="family-editor-add-swept-blend-btn"` exists in the rendered output.

### G — Tests

Create `packages/web/src/meshBuilders/meshBuilders.familySweptBlend.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildFamilySweptBlendMesh } from './meshBuilders.familySweptBlend';

const squareProfile = [
  { xMm: -500, yMm: -500 },
  { xMm: 500, yMm: -500 },
  { xMm: 500, yMm: 500 },
  { xMm: -500, yMm: 500 },
];
const smallSquare = [
  { xMm: -200, yMm: -200 },
  { xMm: 200, yMm: -200 },
  { xMm: 200, yMm: 200 },
  { xMm: -200, yMm: 200 },
];
const path = [
  { xMm: 0, yMm: 0 },
  { xMm: 0, yMm: 2000 },
  { xMm: 0, yMm: 4000 },
];

describe('buildFamilySweptBlendMesh — §15.1.2', () => {
  it('returns null for path with fewer than 2 points', () => {
    expect(
      buildFamilySweptBlendMesh({
        id: 'f1',
        kind: 'family_swept_blend',
        startProfileMm: squareProfile,
        endProfileMm: smallSquare,
        pathMm: [{ xMm: 0, yMm: 0 }],
      }),
    ).toBeNull();
  });

  it('returns null for start profile with fewer than 3 points', () => {
    expect(
      buildFamilySweptBlendMesh({
        id: 'f1',
        kind: 'family_swept_blend',
        startProfileMm: [
          { xMm: 0, yMm: 0 },
          { xMm: 100, yMm: 0 },
        ],
        endProfileMm: smallSquare,
        pathMm: path,
      }),
    ).toBeNull();
  });

  it('returns a THREE.Mesh for valid input', () => {
    const mesh = buildFamilySweptBlendMesh({
      id: 'f1',
      kind: 'family_swept_blend',
      startProfileMm: squareProfile,
      endProfileMm: smallSquare,
      pathMm: path,
    });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it('mesh has geometry with vertices', () => {
    const mesh = buildFamilySweptBlendMesh({
      id: 'f1',
      kind: 'family_swept_blend',
      startProfileMm: squareProfile,
      endProfileMm: smallSquare,
      pathMm: path,
    });
    expect(mesh?.geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it('mesh has indices', () => {
    const mesh = buildFamilySweptBlendMesh({
      id: 'f1',
      kind: 'family_swept_blend',
      startProfileMm: squareProfile,
      endProfileMm: smallSquare,
      pathMm: path,
    });
    expect(mesh?.geometry.index?.count).toBeGreaterThan(0);
  });
});
```

Also create `packages/web/src/tools/familySweptBlendGrammar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reduceFamilySweptBlend } from '../tools/toolGrammar';

describe('reduceFamilySweptBlend grammar — §15.1.2', () => {
  it('starts idle', () => {
    const { next } = reduceFamilySweptBlend({ phase: 'idle' }, { kind: 'activate' });
    expect(next.phase).toBe('idle');
  });

  it('transitions to recording-path on first click', () => {
    const { next } = reduceFamilySweptBlend({ phase: 'idle' }, { kind: 'click', xMm: 0, yMm: 0 });
    expect(next.phase).toBe('recording-path');
  });

  it('accumulates path points on click', () => {
    let { next } = reduceFamilySweptBlend({ phase: 'idle' }, { kind: 'click', xMm: 0, yMm: 0 });
    ({ next } = reduceFamilySweptBlend(next, { kind: 'click', xMm: 100, yMm: 0 }));
    expect((next as any).points).toHaveLength(2);
  });

  it('emits effect on confirm with 2+ points', () => {
    const state: any = {
      phase: 'recording-path',
      points: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 0 },
      ],
    };
    const { effect } = reduceFamilySweptBlend(state, { kind: 'confirm' });
    expect(effect?.kind).toBe('createFamilySweptBlend');
  });

  it('cancels back to idle', () => {
    const state: any = { phase: 'recording-path', points: [] };
    const { next } = reduceFamilySweptBlend(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave22/E): family swept blend — FamilySweptBlend type + lofted mesh builder + grammar + inspector (§15.1.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
