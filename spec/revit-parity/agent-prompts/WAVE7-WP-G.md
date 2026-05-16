# Wave 7 — WP-G: Finish Floor Type Selector + Floor Inspector (§8.3 + §2.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — floor element (has floorTypeId?), floor_type element (layers: WallTypeLayer[])
packages/web/src/workspace/inspector/InspectorContent.tsx — floor inspector panel
packages/web/src/viewport/meshBuilders.ts               — makeFloorMesh (or equivalent — search for floor mesh builder)
packages/web/src/families/wallTypeCatalog.ts             — WallTypeLayer type reference
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `floor` element in `core/index.ts` — has `floorTypeId?: string | null`. Read the full element shape to find all existing fields.
- `floor_type` element in `core/index.ts` — has `{ kind: 'floor_type', id, name, layers: WallTypeLayer[] }`. Same layer shape as wall types.
- `WallTypeLayer = { thicknessMm, function, materialKey?, wrapsAtEnds?, wrapsAtInserts? }` in `core/index.ts`
- `InspectorContent.tsx` — find the section for `el.kind === 'floor'`. Currently it has Edit Boundary button, level select, slope arrow, etc. Add the new inputs AFTER existing inputs without removing anything.
- `update_element_property` command — dispatches property changes on elements.

---

## Tasks

### A — Floor type selector in inspector

In `InspectorContent.tsx`, for `el.kind === 'floor'`, add:

**Floor Type** (`data-testid="inspector-floor-type-select"`):
- `<select>` listing all `floor_type` elements in `elementsById` (sorted by name)
- Plus an "— None —" option (value `""` → dispatches `floorTypeId = null`)
- Current value: `el.floorTypeId ?? ""`
- On change: dispatch `update_element_property` for `floorTypeId`

**Computed thickness** (`data-testid="inspector-floor-type-thickness"`):
- Read-only text: when a `floorTypeId` is set and the floor_type element exists, show sum of all layer `thicknessMm` values: `"${totalMm} mm"`
- When no floor type is set: `"—"`

### B — Floor type thickness helper

Create `packages/web/src/tools/floorTypeThickness.ts`:

```ts
export function computeFloorTypeThicknessMm(
  floorType: Extract<Element, { kind: 'floor_type' }> | undefined | null,
): number
```

Returns sum of `layer.thicknessMm` across all layers, or 0 if undefined.

### C — Create floor_type command

Add to `core/index.ts` (if not present):
```ts
export type CreateFloorTypeCmd = {
  type: 'create_floor_type';
  id: string;
  name: string;
  layers: WallTypeLayer[];
};
```

Add to Command union. Handle in `Workspace.tsx` (same pattern as other create commands).

### D — Floor type creation button in inspector

In `InspectorContent.tsx`, below the floor type selector, add:
- "New Floor Type…" button (`data-testid="inspector-floor-new-type"`)
- On click: prompt via a small inline form (or just dispatch immediately with a generated ID and default name/layers):
  ```ts
  dispatch({ type: 'create_floor_type', id: nanoid(), name: 'New Floor Type', layers: [{ thicknessMm: 200, function: 'structure', materialKey: null }] })
  ```
  Then set `floorTypeId` on the floor to the new type's id.

Keep the inline form minimal — just a text input for the type name with a "Create" confirm button:
- `data-testid="inspector-floor-new-type-name"` — name input
- `data-testid="inspector-floor-new-type-confirm"` — confirm button

### E — Floor mesh thickness update

In the floor mesh builder (`meshBuilders.ts` — find the function that builds the floor 3D mesh), when `floor.floorTypeId` is set and the `floor_type` element exists in `elementsById`:
- Use `computeFloorTypeThicknessMm(floorType)` as the effective thickness instead of the floor's own `thicknessMm` (or in addition to it — check current behaviour first to avoid breaking changes).
- Only override if the result is > 0.

### F — Tests

Write `packages/web/src/tools/floorTypeThickness.test.ts`:
```ts
describe('computeFloorTypeThicknessMm — §8.3', () => {
  it('returns sum of all layer thicknesses', () => { ... });
  it('returns 0 for undefined floor type', () => { ... });
  it('returns 0 for empty layers array', () => { ... });
  it('single layer returns that layer thickness', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/floorTypeInspector.test.tsx`:
```ts
describe('floor type inspector — §8.3', () => {
  it('renders inspector-floor-type-select', () => { ... });
  it('select lists all floor_type elements', () => { ... });
  it('selecting a type dispatches update_element_property for floorTypeId', () => { ... });
  it('shows computed thickness when floor type is selected', () => { ... });
  it('shows "—" when no floor type selected', () => { ... });
  it('new-type button renders inspector-floor-new-type', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
