# Wave 13 — WP-C: Column at Grids — Options Bar + Visual Highlight (§9.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — column element type, column_type
packages/web/src/tools/toolRegistry.ts                   — 'column-at-grids' tool (hotkey CAG)
packages/web/src/tools/toolGrammar.ts                    — ColumnAtGridsState, reduceColumnAtGrids
packages/web/src/plan/PlanCanvas.tsx                     — column-at-grids click handler, grid hover
packages/web/src/plan/columnAtGrids.ts                   — columnPositionsAtGridIntersections helper
packages/web/src/workspace/OptionsBar.tsx                — options bar sections per tool
packages/web/src/cmdPalette/defaultCommands.ts           — palette commands
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `columnAtGrids.ts` — read `columnPositionsAtGridIntersections` and `gridLineIntersection`. Understand what `selectedGridIds` is. Do NOT rewrite the intersection math.
- `toolGrammar.ts` — find `ColumnAtGridsState` and `reduceColumnAtGrids`. Read the full state machine. Understand how `selectedGridIds` is tracked and how `confirmColumnAtGrids` effect is fired.
- `PlanCanvas.tsx` — find the `column-at-grids` click handler. Find where `confirmColumnAtGrids` is handled (dispatching `createColumn` commands per intersection). Read how grid elements are rendered/picked.
- `OptionsBar.tsx` — find existing options bar sections (e.g. for `wall`, `floor`, `stair`, `room`). Read the pattern — a `case 'column-at-grids':` or similar. Add the new section using the same pattern.
- `toolRegistry.ts` — find the `column-at-grids` tool entry. Do NOT modify it unless wiring the options bar.

---

## Tasks

### A — Options bar section for column-at-grids

In `OptionsBar.tsx`, add a section for the `column-at-grids` tool. It should show:

1. **Column type** (`data-testid="options-column-at-grids-type"`): a `<select>` listing all `column_type` elements from `elementsById`, sorted by name. Selecting a type sets a ref/state used when `confirmColumnAtGrids` fires.

2. **Level** (`data-testid="options-column-at-grids-level"`): a `<select>` listing all `level` elements sorted by elevation. Defaults to the active plan view's level.

3. **Count badge** (`data-testid="options-column-at-grids-count"`): a read-only span showing `"{n} intersections selected"` where `n` = the number of intersections that will be created (read from `ColumnAtGridsState.selectedGridIds` length — you may need to expose this via a ref or store atom from PlanCanvas).

Wire the selected column type and level into the `confirmColumnAtGrids` dispatch so the created columns use the correct type and level.

### B — Visual highlight of selected grids

In `PlanCanvas.tsx`, when the `column-at-grids` tool is active:

- Each grid line that has been toggled into `selectedGridIds` should be drawn with a highlight overlay: a thicker semi-transparent blue line on top of the normal grid rendering.
- Grid bubbles (the circular end labels) of selected grids should get a filled blue circle indicator.
- Use `THREE.LineSegments` or a direct SVG overlay — match whatever the existing grid rendering uses.
- Tag highlighted meshes with `userData.columnAtGridsHighlight = true`.

When the tool is deactivated or `confirmColumnAtGrids` fires, remove all highlight meshes.

### C — Intersection preview dots

When the tool is active and `selectedGridIds.length >= 2`, draw small circles (radius ~150mm in plan units) at each computed intersection point (`columnPositionsAtGridIntersections(selectedGridIds, gridElements)`).

Tag with `userData.columnAtGridsPreview = true`. Remove on deactivate/confirm.

### D — Tests

Write `packages/web/src/plan/columnAtGridsHighlight.test.ts`:
```ts
describe('column at grids — §9.1.2', () => {
  it('columnPositionsAtGridIntersections returns intersection for two perpendicular grids', () => { ... });
  it('returns empty array when only one grid selected', () => { ... });
  it('returns multiple intersections for 3+ grids', () => { ... });
});
```

(These tests cover `columnAtGrids.ts` logic. If `columnAtGrids.test.ts` already has these cases, skip and note "covered".)

Write `packages/web/src/workspace/optionsBarColumnAtGrids.test.tsx`:
```ts
describe('options bar — column at grids — §9.1.2', () => {
  it('renders options-column-at-grids-type select with column types', () => { ... });
  it('renders options-column-at-grids-level select with levels', () => { ... });
  it('renders options-column-at-grids-count showing 0 when no grids selected', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave13/C): column-at-grids options bar + visual highlight (§9.1.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
