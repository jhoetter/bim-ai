# Wave 12 — WP-D: Angular + Radial/Diameter Dimension Inspector Polish (§4.4 + §4.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — angular_dimension, radial_dimension, diameter_dimension element types
packages/web/src/plan/planElementMeshBuilders.ts         — angular + radial renderers
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/plan/grip-providers/                    — grip providers for dimensions
packages/web/src/tools/toolGrammar.ts                    — grammar state machines
packages/web/src/tools/toolRegistry.ts                   — tool registrations
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `angular_dimension` in `core/index.ts` — find all fields: `vertexMm`, `firstRayMm`, `secondRayMm`, `offsetMm`, `textOverride`, `textPrefix`, `textSuffix`. Read the full type.
- `radial_dimension` and `diameter_dimension` in `core/index.ts` — find `centerMm`, `arcPointMm`, `radiusMm`, `textOverride`.
- `planElementMeshBuilders.ts` — find the angular dimension renderer and radial renderer. Read each end-to-end to understand what is rendered and what is not yet wired.
- `InspectorContent.tsx` — find the `angular_dimension` inspector section (if it exists) and `radial_dimension` section. Assess what is missing.
- Grip providers in `grip-providers/` — search for `angularDim` or `radialDim` grip provider files. Read them if they exist.
- Existing `permanent_dimension` inspector as the reference pattern for text prefix/suffix, flip, offset readout.

---

## Tasks

### A — Angular dimension inspector

In `InspectorContent.tsx`, for `el.kind === 'angular_dimension'`, ensure the inspector has:

- **Angle** (`data-testid="inspector-angular-dim-angle"`): read-only display of the computed angle in degrees. Compute as `angleBetweenVectors(firstRay−vertex, secondRay−vertex)` using the existing `measureGeometry.ts` helper. Show e.g. `"47.3°"`.
- **Text prefix** (`data-testid="inspector-angular-dim-prefix"`): editable text input. Dispatches `update_element_property` for `textPrefix`.
- **Text suffix** (`data-testid="inspector-angular-dim-suffix"`): editable text input. Dispatches for `textSuffix`.
- **Text override** (`data-testid="inspector-angular-dim-override"`): editable text input. When set, replaces the computed angle label. Dispatches for `textOverride`.
- **Offset** (`data-testid="inspector-angular-dim-offset"`): read-only display of `Math.hypot(el.offsetMm.x, el.offsetMm.y).toFixed(0) mm`.
- **Flip** button (`data-testid="inspector-angular-dim-flip"`): negates `offsetMm.y`, dispatches for `offsetMm`.

If any of these already exist in the inspector, do NOT add them again — just verify they work.

### B — Radial + diameter dimension inspector

In `InspectorContent.tsx`, for `el.kind === 'radial_dimension'` and `'diameter_dimension'`:

- **Radius / Diameter** (`data-testid="inspector-radial-dim-value"` / `"inspector-diameter-dim-value"`): read-only computed value. For radial: `el.radiusMm.toFixed(0) mm`; for diameter: `(el.radiusMm * 2).toFixed(0) mm`.
- **Text prefix** (`data-testid="inspector-radial-dim-prefix"`): e.g. "R" for radius (default). Editable.
- **Text override** (`data-testid="inspector-radial-dim-override"`): overrides the label. Editable.
- **Flip** button (`data-testid="inspector-radial-dim-flip"`): toggles which side of the arc the leader line extends to. Add `flipped?: boolean | null` to `radial_dimension` in `core/index.ts` if not present.

### C — Angular dimension renderer: arc label

In `planElementMeshBuilders.ts`, in the angular dimension renderer, verify that:

- The angle label (text sprite or CSS2D) correctly shows the angle value (respects `textOverride`, `textPrefix`, `textSuffix`)
- The arc indicator between the two rays is drawn at `offsetMm` distance from the vertex
- If any of these is broken/missing, fix it

### D — Angular dimension grip: arc offset drag

In `grip-providers/` (find the angular dim grip provider, or create `angularDimGripProvider.ts` if it does not exist):

```ts
export function angularDimGripProvider(
  dim: Extract<Element, { kind: 'angular_dimension' }>,
): GripProvider;
```

Grips:

1. **Arc offset grip** (`id: 'arc-offset'`): at `vertex + normalize(bisector) * offsetMm`. Dragging updates `offsetMm`. On commit: dispatch `update_element_property` for `offsetMm`.
2. **Vertex grip** (`id: 'vertex'`): at `vertexMm`. Dragging updates `vertexMm`.

Register in `gripProviderForElement.ts` (or equivalent) if not already registered.

### E — Tests

Write `packages/web/src/workspace/inspector/angularDimInspector.test.tsx`:

```ts
describe('angular dimension inspector — §4.4', () => {
  it('renders inspector-angular-dim-angle with computed degrees', () => { ... });
  it('renders inspector-angular-dim-prefix input', () => { ... });
  it('renders inspector-angular-dim-override input', () => { ... });
  it('flip button dispatches update_element_property for offsetMm', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/radialDimInspector.test.tsx`:

```ts
describe('radial dimension inspector — §4.5', () => {
  it('renders inspector-radial-dim-value with radius in mm', () => { ... });
  it('renders inspector-diameter-dim-value with diameter (2×radius)', () => { ... });
  it('renders inspector-radial-dim-prefix input', () => { ... });
  it('flip dispatches update_element_property for flipped', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave12/D): angular + radial/diameter dimension inspector polish (§4.4 + §4.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
