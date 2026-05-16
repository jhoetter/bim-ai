# Wave 14 — WP-A: Selection Improvements — TAB Cycle + Crossing Window (§1.8.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/PlanCanvas.tsx        — click/keyboard handlers, element picking
packages/web/src/state/store.ts             — selectedElementIds, hoveredElementId
packages/web/src/state/storeTypes.ts        — store state types
packages/web/src/plan/createSimilar.ts      — createSimilarPayload helper
packages/web/src/cmdPalette/defaultCommands.ts — palette commands
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `PlanCanvas.tsx` — find the click handler (left-click on plan canvas). Find how elements are picked (raycaster or bounding box). Find how `selectedElementIds` is set. Find how keyboard events are handled (`useEffect` on `keydown`). Find how drag / box-select is handled today (if any).
- `store.ts` — find `selectedElementIds`, `hoveredElementId`. Find `setSelectedElementIds` action.
- `createSimilar.ts` — find `createSimilarPayload`. Find if there is already a keyboard handler for 'cs' or similar. If found, do not duplicate.
- `defaultCommands.ts` — check for any existing `selection.*` commands.

---

## Tasks

### A — TAB cycle through overlapping elements

In `PlanCanvas.tsx`, add a `keydown` listener for the `Tab` key (when no tool is active — select mode only):

1. On `Tab`, find all elements whose bounding box / plan symbol overlaps the current mouse position in plan space. Use the same picking approach already used for single click. Collect candidates sorted by element kind (walls first, then floors, then doors/windows, etc. — or just by `id` for determinism).
2. If `selectedElementIds` is empty, select the first candidate.
3. If exactly one element is selected, advance to the next candidate in the sorted list (wrapping).
4. Prevent the browser's default tab-focus behavior (`e.preventDefault()`).

Extract the logic into a pure helper: `nextTabSelection(hoveredIds: string[], currentSelectedId: string | null): string | null` in a new file `packages/web/src/plan/tabCycleSelection.ts`.

### B — Crossing window selection (right-to-left drag)

bim-ai currently supports window selection (left-to-right drag selects elements fully inside the rectangle). Add **crossing selection**: when the drag direction is right-to-left (startX > endX), select all elements that **intersect** the rectangle, not just those fully contained.

Read how the existing drag-select box is drawn and how elements are tested in `PlanCanvas.tsx`. Then:

1. After drag ends, compute `leftToRight = startX < endX`.
2. If `leftToRight`: existing behaviour — select fully contained elements.
3. If `!leftToRight` (crossing): select elements whose bounding box intersects the rectangle (partial overlap counts).
4. Render the crossing-selection box with a **dashed** stroke (`.setLineDash([4,4])` or SVG `stroke-dasharray`); the existing window-select box uses a solid stroke. Tag with `data-testid="crossing-selection-box"`.

Extract a pure helper: `elementsInCrossingBox(elements: Element[], rect: {x1,y1,x2,y2}, crossing: boolean): string[]` in `packages/web/src/plan/crossingSelection.ts`.

### C — "Select All Instances" from context menu

The palette command `selection.select-all-instances` already exists. Wire it into the element right-click context menu (wherever the context menu is defined — look for `ElementContextMenu` or similar component):

Add a menu item "Select All Instances" visible when exactly one element is selected. On click, invoke the palette command's `invoke` function (or dispatch the equivalent store action) to select all elements of the same `kind` in the model.

### D — Tests

`packages/web/src/plan/tabCycleSelection.test.ts`:
```ts
describe('TAB cycle selection — §1.8.1', () => {
  it('returns first candidate when nothing selected', () => { ... });
  it('advances to next candidate on repeated calls', () => { ... });
  it('wraps around to first candidate after last', () => { ... });
  it('returns null when no candidates', () => { ... });
});
```

`packages/web/src/plan/crossingSelection.test.ts`:
```ts
describe('crossing window selection — §1.8.1', () => {
  it('window select returns only fully contained elements', () => { ... });
  it('crossing select returns elements that partially overlap', () => { ... });
  it('crossing select includes fully contained elements too', () => { ... });
  it('returns empty array when nothing overlaps', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/A): TAB cycle + crossing window selection (§1.8.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
