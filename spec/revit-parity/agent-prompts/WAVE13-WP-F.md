# Wave 13 — WP-F: Auto-Create Shaft Void When Placing Stair (§2.5.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — stair element type, shaft element type, CreateShaftCmd
packages/web/src/tools/toolGrammar.ts                    — stair grammar (commitStair effect)
packages/web/src/plan/PlanCanvas.tsx                     — stair commit handler
packages/web/src/workspace/Workspace.tsx                 — command handlers (createStair, create_shaft)
packages/web/src/workspace/inspector/InspectorContent.tsx — stair inspector
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `shaft` element in `core/index.ts` — read all fields: `boundaryMm`, `baseLevelId`, `topLevelId`, `id`, `name`. Read `CreateShaftCmd` type.
- `stair` element in `core/index.ts` — find all fields: footprint/boundary, `levelId`, `topLevelId`, `widthMm`, `runWidthMm`, `riserCount`, etc. Find if `linkedShaftId` or `autoShaft` field exists.
- `toolGrammar.ts` — find the stair grammar (`StairState`, `reduceStair`). Read how it fires the `commitStair` effect and what data is included in the effect payload.
- `PlanCanvas.tsx` — find the `commitStair` handler. Read exactly how it dispatches `createStair`. This is where you will add the secondary `create_shaft` dispatch.
- `Workspace.tsx` — find the `create_shaft` handler. Read how it applies the shaft to `elementsById`.
- `InspectorContent.tsx` → `case 'stair'` — read the current stair inspector. Do NOT duplicate existing fields.

---

## Tasks

### A — Core type: stair auto-shaft flag

In `core/index.ts`, add to the `stair` element type if NOT already present:
```ts
/** When true, a shaft void was auto-created at stair placement time. */
linkedShaftId?: string | null;
```

### B — Auto-create shaft on stair commit

In `PlanCanvas.tsx`, in the `commitStair` handler (the place where `createStair` is dispatched):

After dispatching `createStair`, compute the stair's bounding box in plan:
```ts
// stairBoundaryMm is the polygon boundary from the commit payload
const xs = stairBoundaryMm.map((p) => p.xMm);
const ys = stairBoundaryMm.map((p) => p.yMm);
const shaftBoundary = [
  { xMm: Math.min(...xs), yMm: Math.min(...ys) },
  { xMm: Math.max(...xs), yMm: Math.min(...ys) },
  { xMm: Math.max(...xs), yMm: Math.max(...ys) },
  { xMm: Math.min(...xs), yMm: Math.max(...ys) },
];
```

**Only do this if the user did NOT hold `Shift` during the final stair click** (check `shiftKey` on the triggering event).

Dispatch `create_shaft`:
```ts
const shaftId = crypto.randomUUID();
dispatch({
  type: 'create_shaft',
  id: shaftId,
  name: 'Stair Opening',
  boundaryMm: shaftBoundary,
  baseLevelId: stairLevelId,
  topLevelId: stairTopLevelId ?? stairLevelId,
});
```

Then dispatch an `update_element_property` to set `linkedShaftId: shaftId` on the newly created stair element.

If `commitStair` does not include boundary or level data in its payload, read how the stair grammar builds the boundary (look for `StairBySketchCanvas` or the stair bounding box logic) and pass the needed data through.

### C — Inspector: auto-shaft status

In `InspectorContent.tsx`, inside `case 'stair'`, add (after existing fields):

```tsx
<div className="border-t border-border pt-1.5">
  <div className="mb-1 text-xs text-muted">Shaft Opening</div>
  {el.linkedShaftId ? (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-foreground">Auto-created shaft</span>
      <span className="font-mono text-[10px] text-muted">{el.linkedShaftId.slice(0, 8)}</span>
    </div>
  ) : (
    <button
      type="button"
      data-testid="inspector-stair-create-shaft"
      className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
      onClick={() =>
        onDispatchCommand?.({ type: 'inspector_create_shaft_for_stair', stairId: el.id })
      }
    >
      Create Shaft Opening
    </button>
  )}
</div>
```

The `inspector_create_shaft_for_stair` command handler in `Workspace.tsx` should compute the shaft boundary from the stair element's boundary and dispatch `create_shaft` + update `linkedShaftId`.

### D — Helper function (pure, testable)

Create `packages/web/src/plan/stairShaft.ts`:

```ts
import type { Element } from '@bim-ai/core';

/** Compute the bounding-box shaft boundary from a stair's footprint boundary. */
export function shaftBoundaryFromStair(
  stair: Extract<Element, { kind: 'stair' }>,
): { xMm: number; yMm: number }[] | null
```

Implementation: find the stair's boundary polygon (look at what fields the stair element has for its footprint), compute min/max X and Y, return a 4-point rectangle. Return null if no boundary data is available.

### E — Tests

Write `packages/web/src/plan/stairShaft.test.ts`:
```ts
describe('stairShaft — §2.5.3', () => {
  it('shaftBoundaryFromStair returns a 4-point rectangle', () => { ... });
  it('returns null when stair has no boundary data', () => { ... });
  it('rectangle encloses all stair boundary points', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/stairShaftInspector.test.tsx`:
```ts
describe('stair shaft inspector — §2.5.3', () => {
  it('renders inspector-stair-create-shaft button when linkedShaftId is null', () => { ... });
  it('does not render create-shaft button when linkedShaftId is set', () => { ... });
  it('create-shaft button dispatches inspector_create_shaft_for_stair', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave13/F): auto-create shaft void when placing stair (§2.5.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
