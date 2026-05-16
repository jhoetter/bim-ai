# Wave 8 — WP-E: Family Sweep + Blend Geometry (§15.1.3 + §15.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — FamilyExtrusion, FamilyRevolve, FamilyVoid types (lines ~4067+)
packages/web/src/familyEditor/                           — family editor canvas, toolbar, renderer files
packages/web/src/viewport/meshBuilders.ts               — find familyExtrusion/familyRevolve mesh builders
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `FamilyExtrusion` in `core/index.ts` (line ~4067): `{ kind: 'family_extrusion', id, profilePoints: {x,y}[], depthMm }`. Profile is a 2D polygon extruded along Z.
- `FamilyRevolve` in `core/index.ts` (line ~4075): `{ kind: 'family_revolve', id, profilePoints: {x,y}[], axisMm: {x,z}, angleDeg }`.
- `FamilyVoid` in `core/index.ts` (line ~4084): `{ kind: 'family_void', id, profilePoints: {x,y}[], depthMm }`.
- Family editor canvas and toolbar in `packages/web/src/familyEditor/` — read the directory listing and read all files to understand the existing pattern before adding new geometry.
- Mesh builders for family extrusion/revolve — find them in `meshBuilders.ts` or nearby files.

---

## Tasks

### A — FamilySweep data type

Add to `core/index.ts`:
```ts
/** §15.1.3: family sweep — profile extruded along a path curve. */
export type FamilySweep = {
  kind: 'family_sweep';
  id: string;
  /** 2D profile polygon (mm) — cross-section shape. */
  profilePoints: { x: number; y: number }[];
  /** Path control points (mm) in 3D — the sweep spine. */
  pathPoints: { x: number; y: number; z: number }[];
};
```

### B — FamilyBlend data type

Add to `core/index.ts`:
```ts
/** §15.1.4: family blend — transition between two 2D profiles at different elevations. */
export type FamilyBlend = {
  kind: 'family_blend';
  id: string;
  /** Bottom profile polygon (mm). */
  bottomProfilePoints: { x: number; y: number }[];
  /** Top profile polygon (mm). */
  topProfilePoints: { x: number; y: number }[];
  /** Blend height in mm. */
  heightMm: number;
};
```

Include both in the family workbench element union if one exists in core (search for `FamilyExtrusion | FamilyRevolve`).

### C — Sweep mesh builder

Create `packages/web/src/familyEditor/meshBuilders.familySweep.ts`:

```ts
export function familySweepMesh(form: FamilySweep): THREE.Mesh
```

- Build a `THREE.TubeGeometry` along `pathPoints` (convert mm → world units by /1000)
- Cross-section: use `THREE.Shape` from `profilePoints` as the tube's profile
- Use `THREE.ExtrudeGeometry` with a custom path (`THREE.CatmullRomCurve3`) rather than TubeGeometry if the profile is non-circular
- Material: `MeshStandardMaterial({ color: '#c8a882', side: THREE.DoubleSide })`
- Return empty `THREE.Mesh` if `pathPoints.length < 2` or `profilePoints.length < 3`

### D — Blend mesh builder

Create `packages/web/src/familyEditor/meshBuilders.familyBlend.ts`:

```ts
export function familyBlendMesh(form: FamilyBlend): THREE.Mesh
```

- Bottom and top profiles may have different vertex counts — interpolate by mapping each bottom vertex to the corresponding top vertex using index modulo
- Build a `BufferGeometry` with triangulated side faces connecting bottom to top ring
- Add top and bottom cap faces (ShapeGeometry)
- Material: same as sweep
- Return empty Mesh if either profile has <3 points or `heightMm <= 0`

### E — Wire into family editor

In the family editor (find the main canvas/renderer file in `packages/web/src/familyEditor/`):
- Add `family_sweep` and `family_blend` to the render loop alongside `family_extrusion`
- Add toolbar buttons "Sweep" and "Blend" that create a default FamilySweep / FamilyBlend with example points

### F — Tests

Write `packages/web/src/familyEditor/familySweepMesh.test.ts`:
```ts
describe('familySweepMesh — §15.1.3', () => {
  it('returns empty Mesh when pathPoints has fewer than 2 points', () => { ... });
  it('returns empty Mesh when profilePoints has fewer than 3 points', () => { ... });
  it('returns a Mesh with geometry for valid sweep', () => { ... });
  it('mesh userData contains kind=family_sweep', () => { ... });
});
```

Write `packages/web/src/familyEditor/familyBlendMesh.test.ts`:
```ts
describe('familyBlendMesh — §15.1.4', () => {
  it('returns empty Mesh for heightMm <= 0', () => { ... });
  it('returns empty Mesh when bottom profile has fewer than 3 points', () => { ... });
  it('returns a Mesh with geometry for valid blend', () => { ... });
  it('top cap vertices are at heightMm above bottom cap', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
