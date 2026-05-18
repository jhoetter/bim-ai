# Wave 15 — WP-A: Special Roof Shapes — Conical + Dome + Spire (§10.3.1-3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — element types union
packages/web/src/tools/toolRegistry.ts              — tool registration (ToolId union)
packages/web/src/plan/toolGrammar.ts                — tool state machines
packages/web/src/plan/PlanCanvas.tsx                — click/keyboard dispatch
packages/web/src/plan/symbology.ts                  — plan mesh builder loop
packages/web/src/viewport/meshBuilders.ts           — 3D mesh builders
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

- `meshBuilders.massRevolution.ts` — LatheGeometry pattern for revolution meshes (reuse for cone/dome).
- `core/index.ts` — existing roof element types. Look for `'roof'` kind. Add new kinds nearby.
- `toolGrammar.ts` — excavation grammar is a good model for a 2-click (center → radius) tool.

---

## Tasks

### A — Element types in `core/index.ts`

Add three new element kinds after the existing roof element type:

```ts
| {
    kind: 'conical_roof';
    id: string;
    name: string;
    levelId: string;
    baseRadiusMm: number;      // default 5000
    heightMm: number;          // default 4000
    centerMm: { xMm: number; yMm: number };
    baseElevationMm: number;   // default 0
    materialId?: string | null;
  }
| {
    kind: 'dome_roof';
    id: string;
    name: string;
    levelId: string;
    baseRadiusMm: number;      // default 5000
    riseRatio: number;         // height = riseRatio * baseRadius; default 0.5
    centerMm: { xMm: number; yMm: number };
    baseElevationMm: number;
    materialId?: string | null;
  }
| {
    kind: 'spire_roof';
    id: string;
    name: string;
    levelId: string;
    baseRadiusMm: number;      // default 1500
    heightMm: number;          // default 10000
    centerMm: { xMm: number; yMm: number };
    baseElevationMm: number;
    materialId?: string | null;
  }
```

Add corresponding `CreateConicalRoofCmd`, `CreateDomeRoofCmd`, `CreateSpireRoofCmd` command types.

---

### B — Mesh builders in new files

Create `packages/web/src/viewport/meshBuilders.coneRoof.ts`:

```ts
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type ConicalRoofEl = Extract<Element, { kind: 'conical_roof' }>;
type DomeRoofEl = Extract<Element, { kind: 'dome_roof' }>;
type SpireRoofEl = Extract<Element, { kind: 'spire_roof' }>;

/** Builds a LatheGeometry cone with an open bottom. */
export function buildConicalRoofMesh(el: ConicalRoofEl): THREE.Mesh {
  const rM = el.baseRadiusMm / 1000;
  const hM = el.heightMm / 1000;
  const baseM = el.baseElevationMm / 1000;
  const points = [new THREE.Vector2(rM, 0), new THREE.Vector2(0, hM)];
  const geo = new THREE.LatheGeometry(points, 32);
  const mat = new THREE.MeshStandardMaterial({ color: '#8b6363', roughness: 0.7, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(el.centerMm.xMm / 1000, baseM, -el.centerMm.yMm / 1000);
  mesh.userData.bimPickId = el.id;
  return mesh;
}

/** Builds a partial sphere (SphereGeometry sliced at equator). */
export function buildDomeRoofMesh(el: DomeRoofEl): THREE.Mesh {
  const rM = el.baseRadiusMm / 1000;
  const rise = Math.max(0.1, Math.min(1.0, el.riseRatio));
  const hM = rM * rise;
  const points: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2) * rise;
    points.push(new THREE.Vector2(Math.cos(t) * rM, Math.sin(t) * rM));
  }
  const geo = new THREE.LatheGeometry(points, 32);
  const mat = new THREE.MeshStandardMaterial({ color: '#7a8ea0', roughness: 0.5, metalness: 0.2 });
  const baseM = el.baseElevationMm / 1000;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(el.centerMm.xMm / 1000, baseM, -el.centerMm.yMm / 1000);
  mesh.userData.bimPickId = el.id;
  return mesh;
}

/** Very tall narrow cone. */
export function buildSpireRoofMesh(el: SpireRoofEl): THREE.Mesh {
  const rM = el.baseRadiusMm / 1000;
  const hM = el.heightMm / 1000;
  const baseM = el.baseElevationMm / 1000;
  const points = [
    new THREE.Vector2(rM, 0),
    new THREE.Vector2(0.01, hM * 0.85),
    new THREE.Vector2(0, hM),
  ];
  const geo = new THREE.LatheGeometry(points, 16);
  const mat = new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.5, metalness: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(el.centerMm.xMm / 1000, baseM, -el.centerMm.yMm / 1000);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
```

In `meshBuilders.ts`, import and call these from the main element dispatch (find where `'roof'` is handled and add cases for the three new kinds).

---

### C — Plan symbols in `symbology.ts`

In the plan mesh builder loop, add cases for the three new kinds. Draw a **circle** plan symbol:

```ts
// conical_roof / dome_roof / spire_roof — plan: filled circle outline
function specialRoofPlanSymbol(el: {
  centerMm: { xMm: number; yMm: number };
  baseRadiusMm: number;
  id: string;
}): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = el.id;
  const r = el.baseRadiusMm / 1000;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    pts.push(
      new THREE.Vector3(
        el.centerMm.xMm / 1000 + Math.cos(a) * r,
        PLAN_Y + 0.002,
        -el.centerMm.yMm / 1000 + Math.sin(a) * r,
      ),
    );
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  grp.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#7a5a3a' })));
  // Cross-hair lines
  grp.add(
    makeLineSegment(
      new THREE.Vector3(el.centerMm.xMm / 1000 - r * 0.15, PLAN_Y + 0.002, -el.centerMm.yMm / 1000),
      new THREE.Vector3(el.centerMm.xMm / 1000 + r * 0.15, PLAN_Y + 0.002, -el.centerMm.yMm / 1000),
      '#7a5a3a',
    ),
  );
  return grp;
}
```

Use a helper `makeLineSegment` already present in symbology.ts (search for it) or create a simple one.

---

### D — Tool registration + grammar

In `toolRegistry.ts`, add three new tool IDs:

```ts
'conical-roof'; // hotkey 'CR', plan mode
'dome-roof'; // hotkey 'DM', plan mode
'spire-roof'; // hotkey 'SP', plan mode — note: 'SP' may conflict; use 'SI' if so
```

In `toolGrammar.ts`, add a shared 2-click grammar for all three (center point → radius drag):

```ts
// idle → pick-center (first click) → confirm (second click or Enter with distance)
// On confirm: emit { kind: 'createConicalRoof' | 'createDomeRoof' | 'createSpireRoof', centerMm, radiusMm }
```

Wire into `PlanCanvas.tsx` just as the excavation or ramp tool is wired.

In `defaultCommands.ts`, register palette commands:

```ts
{ id: 'tool.conical-roof', label: 'Conical Roof', ... }
{ id: 'tool.dome-roof', label: 'Dome Roof', ... }
{ id: 'tool.spire-roof', label: 'Spire Roof', ... }
```

---

### E — Inspector panels

In `InspectorContent.tsx`, add sections for each new kind (search for `kind === 'roof'` and add similar collapsible sections):

- **Conical roof**: name, baseRadiusMm (number input, mm), heightMm (number input), material select
- **Dome roof**: name, baseRadiusMm, riseRatio (0.1–1.0 slider with 2 decimal places), material select
- **Spire roof**: name, baseRadiusMm, heightMm, material select

---

### F — Tests

`packages/web/src/viewport/meshBuilders.coneRoof.test.ts`:

```ts
describe('conical/dome/spire roof mesh builders', () => {
  it('buildConicalRoofMesh returns a Mesh', ...);
  it('conical mesh positioned at centerMm', ...);
  it('buildDomeRoofMesh returns a Mesh', ...);
  it('dome riseRatio clamps to [0.1, 1.0]', ...);
  it('buildSpireRoofMesh returns a Mesh', ...);
  it('spire height encoded in geometry', ...);
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/A): conical + dome + spire roof shapes (§10.3.1-3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the 6 new ones.
