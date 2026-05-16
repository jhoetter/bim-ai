# Wave 5 — WP-G: Sloped Columns + Family Editor Void Cut (§9.1.4 + §15.1.x)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — ColumnElem, FamilyExtrusion, FamilyRevolve
packages/web/src/viewport/meshBuilders.ts               — makeColumnMesh, buildFamilyExtrusionMesh
packages/web/src/plan/planElementMeshBuilders.ts        — planColumnMesh
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `ColumnElem` in `core/index.ts` — read its exact shape; has `positionMm`, `bMm`, `hMm`, `heightMm`
- `makeColumnMesh` in `meshBuilders.ts` — renders a vertical BoxGeometry column; read it first
- `planColumnMesh` in `planElementMeshBuilders.ts` — reads column position
- `FamilyExtrusion` + `FamilyRevolve` in `core/index.ts` — added in wave 4
- `buildFamilyExtrusionMesh` + `buildFamilyRevolveMesh` in `meshBuilders.ts` — added in wave 4

---

## Tasks

### A — Sloped columns: data model (§9.1.4)

Add to `ColumnElem` in `core/index.ts`:
```ts
/** Top of column offset in mm — creates a sloped/inclined column */
topOffsetXMm?: number;
topOffsetYMm?: number;  // Y here is the plan north-south axis (world Z)
```

### B — Sloped columns: 3D mesh

In `makeColumnMesh`, when `col.topOffsetXMm || col.topOffsetYMm`:
- Build a custom `BufferGeometry` trapezoidal prism instead of BoxGeometry:
  - Bottom 4 corners at `(±bMm/2, 0, ±hMm/2)` in local space
  - Top 4 corners at `(±bMm/2 + topOffsetXMm, heightMm, ±hMm/2 + topOffsetYMm)`
  - 6 faces (bottom, top, 4 sides)
  - Compute vertex normals
- Return `THREE.Mesh` with this geometry

### C — Sloped columns: plan symbol

In `planColumnMesh`, when column is sloped (has non-zero top offset):
- Add a dashed rectangle overlay showing the projected top footprint
  (`data-testid` pattern: `userData.columnTopFootprint = true`)
- The dashed rect dimensions same as column base but offset in plan by
  `(topOffsetXMm, topOffsetYMm)` / 1000 m in world space

### D — Inspector: sloped column inputs

In `InspectorContent.tsx`, for `el.kind === 'column'`, add:
- `data-testid="inspector-column-top-offset-x"` — number input for `topOffsetXMm`
- `data-testid="inspector-column-top-offset-y"` — number input for `topOffsetYMm`
On change dispatch `update_element_property` for each field.

### E — Family editor: void cut (§15.1.x)

Add a `FamilyVoid` type to `core/index.ts`:
```ts
export type FamilyVoid = {
  kind: 'family_void';
  id: string;
  profilePoints: { x: number; y: number }[];
  depthMm: number;
};
```

Add `buildFamilyVoidMesh(form: FamilyVoid): THREE.Mesh` to `meshBuilders.ts`:
- Same as `buildFamilyExtrusionMesh` but return a mesh with wireframe material
  (`wireframe: true`, color `#ff4444`) to indicate a void/cut

### F — Tests

Write `packages/web/src/viewport/slopedColumn.test.ts`:
```ts
describe('sloped column mesh — §9.1.4', () => {
  it('vertical column (no offset): top vertices align with bottom X extent', () => { ... });
  it('topOffsetXMm=500: top vertices are offset by 0.5 m in X', () => { ... });
  it('topOffsetYMm=300: top vertices are offset by 0.3 m in Z', () => { ... });
  it('sloped column has 8 vertices (4 bottom + 4 top)', () => { ... });
});
```

Write `packages/web/src/familyEditor/familyVoidMesh.test.ts`:
```ts
describe('buildFamilyVoidMesh — §15.1.x', () => {
  it('returns a THREE.Mesh instance', () => { ... });
  it('uses wireframe material', () => { ... });
  it('depthMm 0 returns mesh without crashing', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
