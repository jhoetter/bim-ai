# Wave 9 — WP-C: Material Layer Priority (§2.4.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — WallTypeLayer type, wall_type / floor_type elements
packages/web/src/families/wallTypeCatalog.ts             — WallTypeLayer reference (read for existing shape)
packages/web/src/workspace/families/WallTypeLayerEditor.tsx — layer editor dialog (wave 7 WP-A)
packages/web/src/viewport/effectiveHostMaterials.ts      — join resolution logic
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `WallTypeLayer` in `core/index.ts` — current shape: `{ thicknessMm, function, materialKey?, wrapsAtEnds?, wrapsAtInserts? }`. You will add `priority`.
- `WallTypeLayerEditor.tsx` (wave 7) — the dialog for editing wall type layers. Read its full UI structure before adding the priority input column.
- `effectiveHostMaterials.ts` — read how materials are resolved at wall joins. Find where layers from joining walls are merged — that's where priority ordering applies.
- `wallTypeCatalog.ts` — read for any existing priority references.

---

## Tasks

### A — Data model: priority on WallTypeLayer

In `core/index.ts`, add to `WallTypeLayer`:

```ts
/** Revit-style layer priority (1 = highest, 5 = lowest). Controls which layer dominates at wall joins. Default: 3. */
priority?: number | null;
```

### B — WallTypeLayerEditor: priority column

In `WallTypeLayerEditor.tsx`, add a "Priority" column to the layer table:

- `<select>` with options 1–5 (default 3 when null)
- `data-testid="layer-priority-{i}"` for row i
- On change: update the draft layer's `priority`

### C — Join resolution: sort by priority

In `effectiveHostMaterials.ts`, when merging layers from two joining walls:

- Read `layer.priority ?? 3` for each layer
- Lower priority number = higher precedence (dominates at the join)
- Sort the merged layer list by priority ascending before applying material decisions
- If priorities are equal, existing behaviour is preserved

### D — Inspector: floor type layer priority

In `InspectorContent.tsx`, in the "New Floor Type" inline form (or wherever floor type layers are shown), if floor type layers are displayed, add the same priority `<select>` (1–5) with `data-testid="floor-layer-priority-{i}"`.

If floor type layers are not yet displayed in the inspector (check first), skip this sub-task.

### E — Tests

Write `packages/web/src/families/wallTypeLayerPriority.test.ts`:

```ts
describe('WallTypeLayer priority — §2.4.4', () => {
  it('priority defaults to 3 when null or undefined', () => { ... });
  it('layer with priority 1 dominates layer with priority 5 at join', () => { ... });
  it('equal priorities preserve existing order', () => { ... });
  it('effectiveHostMaterials sorts layers by priority ascending', () => { ... });
});
```

Write `packages/web/src/workspace/families/wallTypeLayerEditor.priority.test.tsx`:

```ts
describe('WallTypeLayerEditor priority column — §2.4.4', () => {
  it('renders layer-priority-0 select for first layer', () => { ... });
  it('priority select has options 1 through 5', () => { ... });
  it('changing priority updates draft layer', () => { ... });
});
```

---

## Commit and push

After all tasks are done and tests pass (`pnpm test --filter @bim-ai/web`), commit:

```
git add -p
git commit -m "feat(wave9/C): material layer priority (1-5) on WallTypeLayer + join resolution (§2.4.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
