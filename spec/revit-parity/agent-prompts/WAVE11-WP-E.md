# Wave 11 — WP-E: Material Layer Priority Property Dialog (§2.4.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — WallTypeLayer, FloorTypeLayer, priority field
packages/web/src/workspace/authoring/WallTypeLayerEditor.tsx — existing layer editor (read fully)
packages/web/src/workspace/inspector/InspectorContent.tsx   — wall type inspector section
packages/web/src/plan/hostMaterialLayerTargets.ts           — layer material resolution
packages/web/src/plan/effectiveHostMaterials.ts             — layer join resolution
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `WallTypeLayer` in `core/index.ts` — find the `priority` field (added by wave 9 WP-C). Read the full type. Also check `FloorTypeLayer` for a priority field. Do NOT add duplicate fields.
- `WallTypeLayerEditor.tsx` — read end-to-end. This is the reference pattern for inline layer editing. The layer table already has `thicknessMm`, `function`, `materialKey`. You will add a **Priority** column.
- `effectiveHostMaterials.ts` — read the join resolution logic. It should already use `priority` to determine which layer wins at a junction. If it does not use `priority`, that is a bug to fix.
- `hostMaterialLayerTargets.ts` — read the material resolution chain.

---

## Tasks

### A — Core type: layer priority (verify + add for floors)

In `core/index.ts`:

- **WallTypeLayer**: verify `priority?: number | null` exists (1–5, Revit-style). If it exists, do NOT re-add.
- **FloorTypeLayer**: add `priority?: number | null` if missing. Same range 1–5.

Priority semantics (Revit): 1 = Structure (highest priority, dominates joins), 2 = Substrate, 3 = Thermal/Air, 4 = Finish 1, 5 = Finish 2 (lowest).

### B — WallTypeLayerEditor: priority column

In `WallTypeLayerEditor.tsx`, add a **Priority** column to the layer table:

- Column header: "Priority" (after the function column)
- Per-row: `<select data-testid="layer-priority-{i}">` with options 1–5 labelled:
  - 1 — Structure
  - 2 — Substrate
  - 3 — Thermal/Air layer
  - 4 — Finish 1
  - 5 — Finish 2
- Default: 5 (Finish 2) for new layers; preserve existing value for existing layers
- On change: update the layer's `priority` in local state (same pattern as thicknessMm changes)

Read how the existing `thicknessMm` input is wired (local layer state + dispatch on Save/Blur) and use the same pattern.

### C — FloorTypeLayerEditor (if it exists)

If `FloorTypeLayerEditor.tsx` or equivalent exists (grep for it), add the same priority column.

If it does not exist but floors have layers, add the priority field display to the floor type inspector panel in `InspectorContent.tsx` for `el.kind === 'floor_type'` — a simple table matching the wall layer editor pattern.

### D — Join resolution: use priority

In `effectiveHostMaterials.ts`, verify that when two wall layers overlap at a T-junction or L-junction, the layer with the **lower priority number** (i.e. higher Revit priority) wins and its material fills the junction zone.

If the existing logic uses `priority` correctly, add a comment confirming this and write a test (task E).

If the logic does NOT use `priority`, fix it:

```ts
// Lower number = higher priority (Structure=1 beats Finish=5)
const dominantLayer = layers.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))[0];
```

Apply the dominant layer's material to the junction fill region.

### E — Inspector: priority summary read-out

In `InspectorContent.tsx`, in the `wall_type` inspector section, after the layer list:

- Add a read-only **"Layer Priorities"** summary line: e.g. `"Structure (1) · Substrate (2) · Finish (5)"` — just the sorted unique priorities of all layers.
- `data-testid="inspector-wall-type-priority-summary"`
- Only show if any layer has a non-null priority.

### F — Tests

Write `packages/web/src/workspace/authoring/wallTypeLayerPriority.test.tsx`:

```ts
describe('WallTypeLayerEditor priority column — §2.4.4', () => {
  it('renders layer-priority-0 select for first layer', () => { ... });
  it('priority select has options 1–5', () => { ... });
  it('changing priority select updates layer priority', () => { ... });
  it('default priority for new layer is 5', () => { ... });
});
```

Write `packages/web/src/plan/layerJoinPriority.test.ts`:

```ts
describe('material layer join priority — §2.4.4', () => {
  it('priority 1 layer dominates priority 5 layer at junction', () => { ... });
  it('equal priority layers default to first layer', () => { ... });
  it('null priority treated as 5 (lowest)', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave11/E): material layer priority column + join resolution (§2.4.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
