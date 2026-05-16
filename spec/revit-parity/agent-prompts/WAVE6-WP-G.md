# Wave 6 — WP-G: Beam Section Profiles + Multi-Storey Stair Editing (§9.2 + §8.6.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — BeamElem (kind: 'beam')
packages/web/src/viewport/meshBuilders.ts               — makeBeamMesh (existing beam mesh builder)
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/plan/planElementMeshBuilders.ts        — beam plan symbol (search 'beam')
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read these files before writing anything:
- `beam` element type in `core/index.ts` — has `startMm`, `endMm`, `widthMm`, `heightMm`, `materialKey?`, `structuralRole?`, `structuralMaterial?`, etc.
- `makeBeamMesh` in `meshBuilders.ts` — builds a rectangular box geometry. Read its exact signature.
- The beam plan symbol renderer in `planElementMeshBuilders.ts` or `symbology.ts`.

---

## Tasks

### A — Beam section profile data model (§9.2)

Add to the `beam` element type in `core/index.ts`:
```ts
/** Structural section profile type — affects 3D cross-section shape. */
sectionProfile?: 'rectangular' | 'I' | 'H' | 'C' | 'L' | 'T' | 'HSS' | null;
/** Flange width in mm (for I/H/C sections). */
flangeWidthMm?: number | null;
/** Web thickness in mm (for I/H sections). */
webThicknessMm?: number | null;
/** Flange thickness in mm (for I/H sections). */
flangeThicknessMm?: number | null;
```

### B — Section profile 3D mesh

Create `packages/web/src/viewport/beamSectionProfile.ts`:

```ts
export function buildBeamSectionGeometry(
  sectionProfile: string | null | undefined,
  widthMm: number,
  heightMm: number,
  flangeWidthMm?: number | null,
  webThicknessMm?: number | null,
  flangeThicknessMm?: number | null,
): THREE.BufferGeometry
```

Profiles (all cross-sections in local YZ plane, beam runs along X axis):
- `'rectangular'` (default/null): simple box — same as current behaviour; return `BoxGeometry(lengthM, heightM, widthM)` — actually this is a cross-section shape, so it will be used with ExtrudeGeometry; a rectangle shape
- `'I'`: TWO flanges (top + bottom, `flangeWidthMm × flangeThicknessMm`) + web (`webThicknessMm × (heightMm - 2*flangeThicknessMm)`). Build as THREE.Shape with path.
- `'H'`: Same as I-beam but typically wider flanges (use same Shape logic as I)
- `'C'`: C-channel — top + bottom flange on one side only; shape is ⊏
- `'L'`: L-angle — two legs; shape is ⌐
- `'T'`: T-section — one flange + web
- `'HSS'`: hollow square section — outer rect minus inner rect (use holes in THREE.Shape)

Return the cross-section as `THREE.Shape` (not yet extruded), so `makeBeamMesh` can extrude it.

In `makeBeamMesh` (modify the existing function in meshBuilders.ts):
- When `beam.sectionProfile && beam.sectionProfile !== 'rectangular'`:
  - Get the cross-section shape from `buildBeamSectionGeometry`
  - Use `THREE.ExtrudeGeometry({ shape, depth: lengthM, bevelEnabled: false })` and rotate appropriately
- Otherwise keep existing BoxGeometry path

### C — Inspector inputs

In `InspectorContent.tsx`, detect `el.kind === 'beam'` and add after existing inputs:
- `data-testid="inspector-beam-section-profile"` — `<select>` with options: Rectangular, I-Beam, H-Beam, C-Channel, L-Angle, T-Section, HSS. Maps to values `rectangular|I|H|C|L|T|HSS`. On change dispatch `update_element_property` for `sectionProfile`.
- `data-testid="inspector-beam-flange-width"` — number input (mm) for `flangeWidthMm`. Only shown when `sectionProfile` is I/H/C.
- `data-testid="inspector-beam-web-thickness"` — number input (mm) for `webThicknessMm`. Only shown when `sectionProfile` is I/H.
- `data-testid="inspector-beam-flange-thickness"` — number input (mm) for `flangeThicknessMm`. Only shown when `sectionProfile` is I/H.

### D — Stair editing: basic inspector grips (§8.6.4)

In the `stair` element in `core/index.ts` — read the existing type. Add (if not present):
```ts
/** Number of risers per run — editable for existing stairs. */
riserCount?: number | null;
/** Tread depth in mm. */
treadDepthMm?: number | null;
```

In `InspectorContent.tsx`, for `el.kind === 'stair'`, add:
- `data-testid="inspector-stair-riser-count"` — number input (integer, 2–50) for `riserCount`. On change dispatch `update_element_property`.
- `data-testid="inspector-stair-tread-depth"` — number input (mm, 200–450) for `treadDepthMm`. On change dispatch `update_element_property`.

These are simple data-driven edits that update the stair's shape when re-rendered — the mesh
builder already reads `riserCount`/`treadDepthMm` if they exist (check meshBuilders first; if not,
the inspector still surfaces the fields for future use).

### E — Tests

Write `packages/web/src/viewport/beamSectionProfile.test.ts`:
```ts
describe('buildBeamSectionGeometry — §9.2', () => {
  it('null profile returns a rectangular shape (4 points)', () => { ... });
  it('I profile returns a shape with correct flange structure', () => { ... });
  it('HSS profile has a hole (inner rect)', () => { ... });
  it('C profile has 6 corners', () => { ... });
  it('T profile has top flange + web', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/beamInspector.test.tsx`:
```ts
describe('beam inspector — §9.2', () => {
  it('renders section profile select', () => { ... });
  it('flange-width input shown for I profile', () => { ... });
  it('flange-width input hidden for rectangular profile', () => { ... });
  it('changing profile dispatches update_element_property', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/stairInspector.test.tsx`:
```ts
describe('stair inspector — §8.6.4', () => {
  it('renders inspector-stair-riser-count input', () => { ... });
  it('renders inspector-stair-tread-depth input', () => { ... });
  it('changing riser-count dispatches update_element_property', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
