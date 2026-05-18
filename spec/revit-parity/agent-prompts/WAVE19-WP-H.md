# Wave 19 — WP-H: Shaft Workflow — Inspector Level Selectors + Cut Floor Display (§2.5.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-J created:

- `packages/web/src/plan/shaftCutFloors.ts` — `computeShaftCutFloors()`, `pointInPolygon()`
- Test file `packages/web/src/plan/shaftCutFloors.test.ts` — 7 tests (all pass)

**Still missing:**

- Shaft inspector: base level / top level dropdowns (currently Partial)
- Inspector readout showing how many floors the shaft cuts through
- "Apply Shaft Cut" button in inspector that dispatches the shaft cut as floor void data
- Workspace handler wiring that calls `computeShaftCutFloors` on shaft changes
- Palette command `modify.shaft-apply-cut` + capability graph entry

---

## Repo orientation

```
packages/core/src/index.ts                          — shaft element type (read existing fields)
packages/web/src/plan/shaftCutFloors.ts            — computeShaftCutFloors (already exists)
packages/web/src/workspace/Workspace.tsx
packages/web/src/workspace/inspector/InspectorContent.tsx  — case 'shaft':
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `InspectorContent.tsx` for the existing `case 'shaft':` block. Read `core/index.ts` for the `shaft` element type — note what fields exist (`baseLevelId`, `topLevelId`, `boundaryMm`). Read `shaftCutFloors.ts` to understand what inputs it needs.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Shaft element additions in `core/index.ts`

Add if not present on the `shaft` element:

```ts
cutFloorIds?: string[];  // populated by Workspace after computeShaftCutFloors
```

Add command type:

```ts
| { type: 'applyShaftCut'; shaftId: string; cutFloorIds: string[] }
```

---

### B — `Workspace.tsx` handler

```ts
case 'applyShaftCut': {
  const shaft = elementsById[cmd.shaftId];
  if (shaft?.kind === 'shaft') {
    (shaft as any).cutFloorIds = cmd.cutFloorIds;
  }
  break;
}
```

Also, after any `updateElementProperty` or `createElement` for a shaft element, recompute the shaft cut:

```ts
// After element update, if it's a shaft, recompute cut floors:
if (updatedElement?.kind === 'shaft') {
  const cutFloorIds = computeShaftCutFloors(updatedElement as any, elementsById);
  (updatedElement as any).cutFloorIds = cutFloorIds;
}
```

Import `computeShaftCutFloors` at the top of `Workspace.tsx`.

---

### C — Inspector additions in `InspectorContent.tsx`

In `case 'shaft':`, enhance the inspector with:

1. **Base level dropdown** — if not already present:

```tsx
<label>
  Base Level
  <select
    data-testid="inspector-shaft-base-level"
    value={(el as any).baseLevelId ?? ''}
    onChange={(e) => onPropertyChange('baseLevelId', e.target.value || null)}
  >
    <option value="">None</option>
    {levels.map((lv) => (
      <option key={lv.id} value={lv.id}>
        {lv.name}
      </option>
    ))}
  </select>
</label>
```

2. **Top level dropdown** — if not already present:

```tsx
<label>
  Top Level
  <select
    data-testid="inspector-shaft-top-level"
    value={(el as any).topLevelId ?? ''}
    onChange={(e) => onPropertyChange('topLevelId', e.target.value || null)}
  >
    <option value="">None</option>
    {levels.map((lv) => (
      <option key={lv.id} value={lv.id}>
        {lv.name}
      </option>
    ))}
  </select>
</label>
```

Where `levels = Object.values(elementsById).filter(e => e?.kind === 'level')` — use the same pattern as other inspector dropdowns.

3. **Cut floor count readout**:

```tsx
<span data-testid="inspector-shaft-cut-floor-count">
  Cuts {((el as any).cutFloorIds ?? []).length} floor(s)
</span>
```

4. **Apply Shaft Cut button**:

```tsx
<button
  data-testid="inspector-shaft-apply-cut"
  onClick={() =>
    void onSemanticCommand?.({
      type: 'applyShaftCut',
      shaftId: el.id,
      cutFloorIds: [], // will be recomputed by Workspace
    })
  }
>
  Apply Shaft Cut
</button>
```

---

### D — Palette command + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'modify.shaft-apply-cut', label: 'Apply Shaft Cut',
  keywords: ['shaft', 'opening', 'void', 'floor', 'cut', 'stair'],
  category: 'command', invoke: (ctx) => {
    const shaft = ctx.selectedElements?.find(e => e.kind === 'shaft');
    if (shaft) void ctx.onSemanticCommand?.({ type: 'applyShaftCut', shaftId: shaft.id, cutFloorIds: [] });
  } }
```

In `commandCapabilities.ts`:

```ts
{ id: 'modify.shaft-apply-cut', scope: 'selection', intendedModes: ['plan', '3d'], precondition: 'selected-shaft' },
```

---

### E — Tests

`packages/web/src/workspace/inspector/shaftInspector.test.tsx`:

```tsx
describe('shaft inspector — §2.5.1', () => {
  it('renders base level dropdown', () => { ... });
  it('renders top level dropdown', () => { ... });
  it('shows cut floor count', () => { ... });
  it('shows 0 cut floors when cutFloorIds is empty', () => { ... });
  it('renders Apply Shaft Cut button', () => { ... });
});

describe('computeShaftCutFloors wiring — §2.5.1', () => {
  it('returns empty array for shaft with no boundary', () => {
    // import computeShaftCutFloors from '../plan/shaftCutFloors'
    // call with shaft that has empty boundaryMm
    // expect []
  });

  it('finds floors within vertical extent', () => {
    // create shaft with baseLevelId/topLevelId covering a floor
    // expect [floorId]
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/H): shaft workflow — base/top level selectors + cut floor readout + applyShaftCut handler (§2.5.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
