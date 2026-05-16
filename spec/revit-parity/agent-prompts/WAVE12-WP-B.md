# Wave 12 — WP-B: Wall Parts Inspector + Material Picker (§8.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — wall element (parts field), WallPart type
packages/web/src/workspace/inspector/InspectorContent.tsx — wall inspector section
packages/web/src/viewport/meshBuilders.ts                — 3D wall part rendering (wall-part-{id} children)
packages/web/src/plan/planElementMeshBuilders.ts         — plan wall part rendering
packages/web/src/plan/PlanCanvas.tsx                     — wall parts click selection
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `wall` element `parts` field in `core/index.ts` — find `parts?: Array<{ id, startT, endT, materialId? }>`. Read the full WallPart type.
- `InspectorContent.tsx` — find the wall inspector section. Look for any existing `parts` display. If nothing exists for parts, you will add it.
- `meshBuilders.ts` — find `makeWallMesh` and how `wall-part-{id}` children are built with BoxGeometry. Understand startT/endT (0–1 parametric position along wall length).
- `planElementMeshBuilders.ts` — find the plan wall part overlay rendering (`userData.partId`).
- `wallParts.test.ts` — read the 4 existing tests for `buildEqualParts`. Do NOT modify these tests.
- How `update_element_property` is dispatched for nested array fields — find an example in InspectorContent.tsx (e.g. stair components, curtain grid) and follow the same pattern.

---

## Tasks

### A — Core type: WallPart (verify + extend if needed)

In `core/index.ts`, verify the `WallPart` type has at minimum:
```ts
interface WallPart {
  id: string;
  startT: number;        // 0–1 parametric start along wall length
  endT: number;          // 0–1 parametric end
  materialId?: string | null;
  label?: string | null; // user-set part label (e.g. "Left panel")
}
```

Add `label` if it is missing. Do NOT re-add fields that already exist.

### B — Inspector: wall parts panel

In `InspectorContent.tsx`, in the wall inspector section, add a **"Parts"** sub-panel that appears when `wall.parts && wall.parts.length > 0`:

For each part, show a row:
- **Part label** (`data-testid="inspector-part-label-{i}"`): editable text input showing `part.label ?? 'Part ${i+1}'`. On change: dispatch `update_element_property` for `parts` array with updated label.
- **Material** (`data-testid="inspector-part-material-{i}"`): `<select>` listing all `material` elements sorted by name + "— (none) —". Current value = `part.materialId`. On change: dispatch `update_element_property` for `parts` array with updated materialId.
- **Length** (`data-testid="inspector-part-length-{i}"`): read-only display of `((endT - startT) * wall.lengthMm).toFixed(0) mm`.
- **Remove part** button (`data-testid="inspector-part-remove-{i}"`): removes this part from the array (merges it back into unsplit wall — simplest: set `parts: parts.filter(p => p.id !== part.id)`; if parts becomes empty, set `parts: null`).

At the bottom of the Parts panel:
- **"Create N Equal Parts"** (`data-testid="inspector-parts-create"`): number input + button. Clicking calls `buildEqualParts(n)` from the existing helper and dispatches `update_element_property` for `parts`.

Read how the wall inspector currently handles complex nested fields (e.g. curtain wall grid or top constraint) and use the same dispatch pattern.

### C — 3D: per-part material

In `meshBuilders.ts`, in `makeWallMesh` (or wherever the wall-part children are built), when a part has `materialId` set:
- Resolve the material from `elementsById[part.materialId]`
- Apply `part.materialId`'s color (if available) as the part child's `MeshStandardMaterial` color
- Fall back to the wall type's layer material if `materialId` is null

Read the existing material resolution pattern (e.g. how `effectiveHostMaterials.ts` resolves colors) and use the same approach. Do NOT rewrite the material system.

### D — Plan: per-part color overlay

In `planElementMeshBuilders.ts`, in the plan wall part overlay renderer, apply the part's resolved material color (same lookup as task C) to the filled rect overlay. Currently they may all use the same color — make each part use its own.

### E — Tests

Write `packages/web/src/workspace/inspector/wallPartsInspector.test.tsx`:
```ts
describe('wall parts inspector — §8.1.3', () => {
  it('renders inspector-part-label-0 for first part', () => { ... });
  it('renders inspector-part-material-0 select for first part', () => { ... });
  it('renders inspector-part-length-0 read-only display', () => { ... });
  it('material change dispatches update_element_property for parts array', () => { ... });
  it('inspector-parts-create button calls buildEqualParts and dispatches', () => { ... });
  it('remove button removes part from array', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave12/B): wall parts inspector with per-part material picker (§8.1.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
