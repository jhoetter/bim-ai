# Wave 25 — WP-A: Floor Edge Profile 3D Mesh (§2.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§2.4.2 "Alternative Deckenkonstruktion" is Partial. Floor placement is done, floor type selector works. What's missing is the **floor edge profile (Deckenrand)** — the cross-sectional shape at the perimeter of the floor slab (e.g., a thickened drop panel, overhanging lip, or stepped edge beam).

The floor element already has `edgeProfileMm?: {xMm: number; yMm: number}[]` (added in wave 19 WP-D) and an inspector collapsible "Edge Profile" section to add/remove cross-section points. What's missing is **3D visualization** of the edge profile: extruding the edge profile polygon around the floor perimeter in `makeFloorSlabMesh`.

---

## Repo orientation

```
packages/core/src/index.ts                         — find floor element (kind: 'floor'), confirm edgeProfileMm field exists
packages/web/src/viewport/meshBuilders.ts           — find makeFloorSlabMesh (search for 'makeFloorSlabMesh'), current implementation
packages/web/src/viewport/meshBuilders.test.ts      — existing tests for mesh builders
```

Run before editing:

- `grep -n "edgeProfileMm" packages/core/src/index.ts | head -5`
- `grep -n "edgeProfileMm" packages/web/src/viewport/meshBuilders.ts | head -5`
- Read `makeFloorSlabMesh` in `meshBuilders.ts` from its start to its end — understand how the floor slab ExtrudeGeometry is built

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Understand the edge profile structure

Run:

```
grep -n "edgeProfileMm" packages/core/src/index.ts
```

Confirm that `edgeProfileMm?: {xMm: number; yMm: number}[]` exists on the floor element. These points define the cross-section profile of the edge — in local edge coordinates where Y=0 is the outer face of the slab and Z=0 is the top face.

### B — Create buildFloorEdgeProfileMesh utility

Create `packages/web/src/viewport/buildFloorEdgeProfile.ts`:

```ts
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type Pt2D = { xMm: number; yMm: number };

/**
 * §2.4.2: builds a profiled edge skirt around the floor slab perimeter.
 * The edgeProfileMm points define the cross-section in (outward, downward) space:
 *   x=0 is at the slab face, x>0 protrudes outward
 *   y=0 is at slab top, y>0 goes downward
 *
 * Returns null if edgeProfileMm has fewer than 2 points.
 */
export function buildFloorEdgeProfileMesh(
  floor: Extract<Element, { kind: 'floor' }>,
  thicknessMm: number,
  posY: number,
): THREE.Mesh | null {
  const profile = (floor as any).edgeProfileMm as Pt2D[] | undefined;
  if (!profile || profile.length < 2) return null;

  const boundary = floor.boundaryMm ?? [];
  if (boundary.length < 3) return null;

  // Build the 2D cross-section shape in (outward, downward) coordinates
  const shape = new THREE.Shape(profile.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000)));

  // Walk the floor perimeter boundary (closed polygon) and extrude the profile along each edge
  const group = new THREE.Group();
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    const dx = (b.xMm - a.xMm) / 1000;
    const dz = (b.yMm - a.yMm) / 1000;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 1e-6) continue;

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: segLen,
      bevelEnabled: false,
    });

    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.8 }),
    );

    // Position: start at segment A, rotate to align with segment direction
    const angle = Math.atan2(dz, dx);
    mesh.rotation.y = -angle;
    mesh.position.set(a.xMm / 1000, posY, a.yMm / 1000);
    group.add(mesh);
  }

  if (group.children.length === 0) return null;

  // Merge into a single mesh for performance
  const mergedMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.8 }),
  );
  mergedMesh.userData.bimPickId = floor.id;
  mergedMesh.userData.isEdgeProfile = true;
  group.children.forEach((child) => mergedMesh.add(child));

  return mergedMesh as any;
}
```

**Note**: Read the existing `makeFloorSlabMesh` carefully before implementing. The coordinate system uses Three.js where plan-X=world-X, plan-Y=world-Z (negated). Adapt the edge profile geometry to the same coordinate conventions. If the implementation is simpler by returning a `THREE.Group` instead of a single mesh, do that instead — but update the return type accordingly.

### C — Wire into makeFloorSlabMesh in packages/web/src/viewport/meshBuilders.ts

At the end of `makeFloorSlabMesh`, after `addEdges(mesh, 20)` and before `return mesh`:

```ts
// §2.4.2: edge profile skirt
const edgeProfileMesh = buildFloorEdgeProfileMesh(floor, effectiveThicknessMm, posY);
if (edgeProfileMesh) {
  mesh.add(edgeProfileMesh);
}
```

Import `buildFloorEdgeProfileMesh` from `'./buildFloorEdgeProfile'` at the top of the file.

### D — commandCapabilities.ts entry

Add to `packages/web/src/workspace/commandCapabilities.ts`:

```ts
{
  id: 'modify.floor-edge-profile',
  label: 'Floor Edge Profile',
  owner: 'workspace/inspector',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan', '3d'],
  surfaces: ['inspector'],
  executionSurface: 'store',
  preconditions: ['selected-floor'],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§2.4.2: 3D edge profile skirt extruded around floor perimeter from edgeProfileMm cross-section points.',
},
```

### E — Tests

Create `packages/web/src/viewport/buildFloorEdgeProfile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildFloorEdgeProfileMesh } from './buildFloorEdgeProfile';
import type { Element } from '@bim-ai/core';

function makeFloor(
  edgeProfileMm?: { xMm: number; yMm: number }[],
): Extract<Element, { kind: 'floor' }> {
  return {
    kind: 'floor',
    id: 'f1',
    levelId: 'l1',
    thicknessMm: 250,
    boundaryMm: [
      { xMm: 0, yMm: 0 },
      { xMm: 5000, yMm: 0 },
      { xMm: 5000, yMm: 4000 },
      { xMm: 0, yMm: 4000 },
    ],
    edgeProfileMm,
  } as unknown as Extract<Element, { kind: 'floor' }>;
}

describe('buildFloorEdgeProfileMesh — §2.4.2', () => {
  it('returns null when edgeProfileMm is undefined', () => {
    const floor = makeFloor(undefined);
    expect(buildFloorEdgeProfileMesh(floor, 250, 0)).toBeNull();
  });

  it('returns null when edgeProfileMm has fewer than 2 points', () => {
    const floor = makeFloor([{ xMm: 0, yMm: 0 }]);
    expect(buildFloorEdgeProfileMesh(floor, 250, 0)).toBeNull();
  });

  it('returns a mesh when edgeProfileMm has 2+ points', () => {
    const floor = makeFloor([
      { xMm: 0, yMm: 0 },
      { xMm: 100, yMm: 0 },
      { xMm: 100, yMm: 250 },
      { xMm: 0, yMm: 250 },
    ]);
    const result = buildFloorEdgeProfileMesh(floor, 250, 0);
    expect(result).not.toBeNull();
  });

  it('returns null when boundary has fewer than 3 points', () => {
    const floor = {
      kind: 'floor',
      id: 'f1',
      levelId: 'l1',
      thicknessMm: 250,
      boundaryMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
      ],
      edgeProfileMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 100, yMm: 250 },
      ],
    } as unknown as Extract<Element, { kind: 'floor' }>;
    expect(buildFloorEdgeProfileMesh(floor, 250, 0)).toBeNull();
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave25/A): floor edge profile 3D mesh — buildFloorEdgeProfileMesh extruded along perimeter + wired into makeFloorSlabMesh (§2.4.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
