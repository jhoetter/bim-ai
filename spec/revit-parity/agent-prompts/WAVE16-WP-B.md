# Wave 16 — WP-B: Family Editor Blend + Sweep Forms (§15.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                          — Element union (FamilyExtrusion, FamilyRevolve, FamilyVoid already exist)
packages/web/src/viewport/meshBuilders.ts                           — main mesh builder switch
packages/web/src/viewport/meshBuilders.familyExtrusion.ts           — (may exist) extrusion mesh; use as pattern
packages/web/src/tools/toolRegistry.ts                              — ToolId union
packages/web/src/tools/toolGrammar.ts                               — tool state machines
packages/web/src/workspace/inspector/InspectorContent.tsx           — inspector panels
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `FamilyExtrusion`, `FamilyRevolve`, `FamilyVoid` types. Read their fields carefully — use the same conventions.
2. `meshBuilders.ts`: find the `case 'family_extrusion'` / `case 'family_revolve'` entries. Read how they delegate to sub-files.
3. Search for `buildFamilyExtrusionMesh` — read the implementation pattern.
4. `toolRegistry.ts`: find `family-extrusion` ToolId — note the naming convention.

---

## Tasks

### A — Element types in `core/index.ts`

Add two new element kinds to the `Element` union:

```ts
| {
    kind: 'family_blend';
    id: string;
    /** Bottom profile polygon (closed, in mm from family origin). */
    bottomProfileMm: { xMm: number; yMm: number }[];
    /** Top profile polygon (closed, in mm from family origin). */
    topProfileMm: { xMm: number; yMm: number }[];
    /** Height of the blend (mm). */
    heightMm: number;
    /** Bottom elevation (mm). */
    baseElevationMm: number;
    materialId?: string | null;
  }
| {
    kind: 'family_sweep';
    id: string;
    /** 2D profile polygon (in mm, local to path start). */
    profileMm: { xMm: number; yMm: number }[];
    /** Sweep path — list of 3D points (mm). */
    pathMm: { xMm: number; yMm: number; zMm: number }[];
    materialId?: string | null;
  }
```

Add `CreateFamilyBlendCmd` and `CreateFamilySweepCmd` command types.

---

### B — Mesh builders

Create `packages/web/src/viewport/meshBuilders.familyBlend.ts`:

```ts
import * as THREE from 'three';
type FamilyBlendEl = Extract<Element, { kind: 'family_blend' }>;

export function buildFamilyBlendMesh(el: FamilyBlendEl): THREE.Mesh {
  // Build a lofted solid by linearly interpolating between bottomProfile and topProfile.
  // Use THREE.BufferGeometry built from triangle strips connecting matching vertices.
  // Simple approach: if both profiles have the same vertex count N, build N quads
  // (2 triangles each) between bottom[i]→top[i]→top[i+1]→bottom[i+1].
  // Add top and bottom cap polygons using THREE.ShapeGeometry.
  const mat = new THREE.MeshStandardMaterial({ color: '#b08860', roughness: 0.6 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
```

Create `packages/web/src/viewport/meshBuilders.familySweep.ts`:

```ts
export function buildFamilySweepMesh(el: FamilySweepEl): THREE.Mesh {
  // Use THREE.TubeGeometry if profile is circular, otherwise use ExtrudeGeometry
  // along a CatmullRomCurve3 built from pathMm points.
  // Simple approach: build a THREE.Shape from profileMm, then extrude along each
  // path segment (piecewise linear extrusion).
  // For simplicity: extrude the profile along the total path length as a single
  // ExtrudeGeometry with depth = total path length and rotate to align with first segment.
  const mat = new THREE.MeshStandardMaterial({ color: '#7a9a7a', roughness: 0.6 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
```

Wire both into `meshBuilders.ts` in the element switch (follow the same pattern as `family_extrusion`).

---

### C — Tool registration

In `toolRegistry.ts`, add `'family-blend'` and `'family-sweep'` to ToolId union. Register:
- `{ id: 'family-blend', hotkey: 'FB', label: 'Family Blend', mode: 'plan' }`
- `{ id: 'family-sweep', hotkey: 'FS', label: 'Family Sweep', mode: 'plan' }`

In `toolGrammar.ts`:

**FamilyBlend grammar** (polygon sketch × 2):
- idle → sketching-bottom (click to add bottom profile points) → Enter → sketching-top (click to add top profile points) → Enter → emit `createFamilyBlend`
- Minimum 3 points per profile before Enter is accepted
- Escape returns to idle from any state

**FamilySweep grammar** (profile points then path points):
- idle → sketching-profile (click to add 2D profile points) → Enter → sketching-path (click 3D path points) → Enter → emit `createFamilySweep`
- Minimum 3 profile points, minimum 2 path points

In `defaultCommands.ts`:
```ts
{ id: 'tool.family-blend', label: 'Family Blend', category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'family-blend') }
{ id: 'tool.family-sweep', label: 'Family Sweep', category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'family-sweep') }
```

---

### D — Inspector panels

In `InspectorContent.tsx`, add cases for `kind === 'family_blend'` and `kind === 'family_sweep'`:

Family blend:
- Height input: `data-testid="inspector-family-blend-height"`
- Base elevation input: `data-testid="inspector-family-blend-base-elevation"`
- Bottom profile point count (read-only): `data-testid="inspector-family-blend-bottom-pts"`
- Top profile point count (read-only): `data-testid="inspector-family-blend-top-pts"`

Family sweep:
- Profile point count (read-only): `data-testid="inspector-family-sweep-profile-pts"`
- Path point count (read-only): `data-testid="inspector-family-sweep-path-pts"`
- Total path length (read-only, mm): `data-testid="inspector-family-sweep-path-length"`

---

### E — Tests

`packages/web/src/viewport/meshBuilders.familyBlend.test.ts`:
```ts
describe('family blend mesh — §15.1.2', () => {
  it('returns a Mesh with bimPickId userData', () => { ... });
  it('builds geometry from bottom and top profiles', () => { ... });
  it('handles triangular profiles (3 vertices)', () => { ... });
});
```

`packages/web/src/viewport/meshBuilders.familySweep.test.ts`:
```ts
describe('family sweep mesh — §15.1.2', () => {
  it('returns a Mesh with bimPickId userData', () => { ... });
  it('builds geometry from profile and path', () => { ... });
});
```

`packages/web/src/plan/familyBlendGrammar.test.ts`:
```ts
describe('family blend grammar — §15.1.2', () => {
  it('starts in idle state', () => { ... });
  it('click adds bottom profile points', () => { ... });
  it('Enter with ≥3 bottom points transitions to sketching-top', () => { ... });
  it('Enter with ≥3 top points emits createFamilyBlend', () => { ... });
  it('Escape resets to idle', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/B): family editor blend + sweep forms (§15.1.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new family blend/sweep tests.
