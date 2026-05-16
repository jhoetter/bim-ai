# Wave 7 — WP-B: Top Constraint Level Inspector (§2.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — WallElem (topConstraintLevelId, topConstraintOffsetMm), ColumnElem, BeamElem
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels for wall/column/beam
packages/web/src/workspace/Workspace.tsx                 — command dispatch
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read these before writing anything:

- `wall` element in `core/index.ts` already has `topConstraintLevelId?: string | null` and `topConstraintOffsetMm?: number`. The fields exist but there is no inspector UI for them.
- `column` element has similar constraint fields — check the exact field names.
- `InspectorContent.tsx` renders inspector panels for each element kind. Find the wall inspector section and add the new inputs after existing inputs. Do NOT rewrite the full inspector.
- `elementsById` is available in the inspector — use it to filter levels for the dropdown.
- `update_element_property` command already exists for dispatching property changes.

---

## Tasks

### A — Wall top constraint inspector inputs

In `InspectorContent.tsx`, in the wall inspector section (`el.kind === 'wall'`), add:

**Top Constraint Level** (`data-testid="inspector-wall-top-level"`):
- `<select>` with options:
  - "Unconnected" (value `""`) → dispatches `topConstraintLevelId = null`
  - One `<option>` per level element in `elementsById`, sorted by `elevationMm` ascending, showing level name
- Current value: `el.topConstraintLevelId ?? ""`
- On change: dispatch `update_element_property` with key `topConstraintLevelId`, value = selected level id or null

**Top Offset** (`data-testid="inspector-wall-top-offset"`):
- Number input (mm), step 1, range -10000 to 10000
- Current value: `el.topConstraintOffsetMm ?? 0`
- On change: dispatch `update_element_property` with key `topConstraintOffsetMm`
- Only shown when `topConstraintLevelId` is set (not "Unconnected")

### B — Column top constraint inspector inputs

In `InspectorContent.tsx`, in the column inspector section (`el.kind === 'column'`), add the same two inputs:
- `data-testid="inspector-column-top-level"` — level select
- `data-testid="inspector-column-top-offset"` — offset number input

Check the column element's exact field names in `core/index.ts` first — they may differ from walls.

### C — 3D visual effect

In `Workspace.tsx` (or wherever wall height is computed for the mesh builder), when `topConstraintLevelId` is set:
- Resolve the target level elevation: `elementsById[topConstraintLevelId]?.elevationMm ?? null`
- If resolved: pass the effective top elevation to `makeWallMesh` as `heightM` override:
  `(targetElevMm + (topConstraintOffsetMm ?? 0) - wall.baseMm) / 1000`
- Only apply when the resolved elevation is above the wall base and within a reasonable range (0–50 m).
- If the level is not found or the result is <= 0, fall back to the wall's own `heightMm`.

This is a read-path change — it should not require new commands.

### D — Tests

Write `packages/web/src/workspace/inspector/topConstraintInspector.test.tsx`:
```ts
describe('top constraint level inspector — §2.6.2', () => {
  it('renders inspector-wall-top-level select for wall elements', () => { ... });
  it('select shows all levels from elementsById', () => { ... });
  it('selecting a level dispatches update_element_property for topConstraintLevelId', () => { ... });
  it('offset input is hidden when topConstraintLevelId is null', () => { ... });
  it('offset input shown when topConstraintLevelId is set', () => { ... });
  it('changing offset dispatches update_element_property for topConstraintOffsetMm', () => { ... });
  it('renders inspector-column-top-level select for column elements', () => { ... });
});
```

Write `packages/web/src/viewport/topConstraintMesh.test.ts`:
```ts
describe('top constraint height resolution — §2.6.2', () => {
  it('wall with topConstraintLevelId uses level elevation as mesh height', () => { ... });
  it('wall with topConstraintOffsetMm adds offset to level elevation', () => { ... });
  it('topConstraintLevelId=null falls back to wall heightMm', () => { ... });
  it('level below wall base is ignored (fallback to heightMm)', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
