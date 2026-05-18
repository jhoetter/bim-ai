# Wave 9 — WP-F: Column-at-Grids Options Bar + Grid Highlight (§9.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — grid element, column element
packages/web/src/tools/toolGrammar.ts                    — ColumnAtGridsState, reduceColumnAtGrids (already exists)
packages/web/src/plan/columnAtGrids.ts                   — columnPositionsAtGridIntersections helper
packages/web/src/plan/PlanCanvas.tsx                     — column-at-grids tool wiring (find 'column-at-grids' branch)
packages/web/src/plan/symbology.ts                       — grid rendering loop
packages/web/src/workspace/inspector/OptionsBar.tsx      — per-tool options bar
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `ColumnAtGridsState` and `reduceColumnAtGrids` in `toolGrammar.ts` — read the full state machine. It tracks `selectedGridIds: Set<string>`. Find what events it accepts.
- `columnAtGrids.ts` — `columnPositionsAtGridIntersections` computes intersection points from selected grid ids. Read it.
- `PlanCanvas.tsx` `'column-at-grids'` branch — find where click events toggle grid selections and Enter commits. Read all the existing logic.
- `OptionsBar.tsx` — read its props/interface. Understand how to add a new tool-specific section. Check if `column-at-grids` already has options bar wiring — it likely doesn't.
- `grid` element in `core/index.ts` — has `startMm`, `endMm`, `labelText`, `id`. Plan symbol already renders grids.
- `column` element in `core/index.ts` — has `typeId`, `levelId`, `heightMm`. The `typeId` is what the options bar will control.

---

## Tasks

### A — Options bar: column type + level

In `OptionsBar.tsx` (or wherever per-tool options are shown), add a `column-at-grids` section:

- **Column type** (`data-testid="options-bar-cat-column-type"`): `<select>` listing all `column_type` or `wall_type` elements with `kind === 'column_type'` (or however column types are stored — check core/index.ts). Fallback to a text input if no column type elements exist.
- **Level** (`data-testid="options-bar-cat-level"`): `<select>` listing all levels from `elementsById` sorted by elevation. Default = `activeLevelId`.
- **Count preview** (`data-testid="options-bar-cat-count"`): read-only: `"${selectedGridIds.size} grids selected → ${intersectionCount} columns"` — compute `columnPositionsAtGridIntersections` and show the count.

Wire these values into the `commit` effect dispatch: the created columns should use the selected type and level.

### B — Grid highlight in plan

In `PlanCanvas.tsx`, when `planTool === 'column-at-grids'`:

- Track which grid elements are in `selectedGridIds` from the grammar state
- For each selected grid: render a highlight overlay — thicker line (linewidth 3), color `#0055cc` (blue)
- For hovered grid (under cursor but not yet selected): render a lighter preview highlight (`#88aaff`)
- Clean up highlights on tool deactivate

Implementation: add a `THREE.Group` named `columnAtGridsHighlight` that is rebuilt on each state change. Place it just above the grid lines in Z order (`PLAN_Y + 0.01`).

### C — Intersection preview dots

When ≥2 grids are selected, show small filled circles at each computed intersection point:

- Circle radius: 200 mm
- Color: `#0055cc`
- Update on each grid toggle

This gives the architect visual feedback of where columns will be placed before committing.

### D — "Select All Grids" button

In `OptionsBar.tsx` (column-at-grids section), add:

- **"Select All"** button (`data-testid="options-bar-cat-select-all"`): dispatches a `selectAllGrids` event to the grammar, which adds all grid ids in `elementsById` to `selectedGridIds`

Add the `selectAllGrids` event to `ColumnAtGridsState` / `reduceColumnAtGrids` in `toolGrammar.ts`:

```ts
| { kind: 'selectAllGrids'; gridIds: string[] }
```

→ sets `selectedGridIds` to all provided ids.

### E — Tests

Write `packages/web/src/tools/columnAtGridsTool.test.ts` (or extend existing):

```ts
describe('column-at-grids grammar — §9.1.2', () => {
  it('toggleGrid adds a new grid to selectedGridIds', () => { ... });
  it('toggleGrid removes an already-selected grid', () => { ... });
  it('selectAllGrids selects all provided grid ids', () => { ... });
  it('commit emits createColumns effect with grid intersections', () => { ... });
  it('cancel returns to idle and clears selectedGridIds', () => { ... });
});
```

Write `packages/web/src/plan/columnAtGrids.optionsbar.test.tsx`:

```ts
describe('column-at-grids options bar — §9.1.2', () => {
  it('renders options-bar-cat-column-type select', () => { ... });
  it('renders options-bar-cat-level select', () => { ... });
  it('renders options-bar-cat-count with intersection count', () => { ... });
  it('renders options-bar-cat-select-all button', () => { ... });
});
```

---

## Commit and push

After all tasks are done and tests pass (`pnpm test --filter @bim-ai/web`), commit:

```
git add -p
git commit -m "feat(wave9/F): column-at-grids options bar + grid highlight + intersection preview (§9.1.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
