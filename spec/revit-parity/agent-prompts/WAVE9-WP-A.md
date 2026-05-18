# Wave 9 — WP-A: Box / Crossing Selection in Plan (§1.8.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/PlanCanvas.tsx                     — main plan canvas (mouse event handlers)
packages/web/src/state/store.ts                          — useBimStore, selectedElementIds
packages/web/src/plan/planGeometryUtils.ts               — or similar — plan mm ↔ world coordinate helpers
packages/web/src/plan/symbology.ts                       — element rendering loop (find bounding boxes)
packages/core/src/index.ts                               — element types (wall, floor, column, room etc.)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `PlanCanvas.tsx` — find the `onPointerDown` / `onPointerMove` / `onPointerUp` handlers in the `select` tool branch. Understand the current click-to-select flow. Box selection will extend this.
- `useBimStore.getState().selectedElementIds` — how the store holds selection. Find the action that sets it (likely `setSelectedElementIds` or similar).
- `elementsById` — the full element map. You'll iterate it to find elements inside the selection box.
- Element bounding box helpers: check if `planElementBoundingBoxMm` or similar exists. If not, create a simple one.

---

## Tasks

### A — Box selection geometry helper

Create `packages/web/src/plan/boxSelection.ts`:

```ts
/** Returns whether element el is inside or crossing the selection rectangle. */
export function elementInSelectionBoxMm(
  el: Element,
  boxMinMm: { xMm: number; yMm: number },
  boxMaxMm: { xMm: number; yMm: number },
  mode: 'window' | 'crossing',
): boolean;
```

- `window` (left-to-right drag): only elements **fully inside** the box
- `crossing` (right-to-left drag): elements that **intersect** the box at all
- For walls: use `startMm` and `endMm` endpoints
- For floors/rooms/areas: use the `boundaryMm` or `outlineMm` polygon AABB
- For columns: use `xMm`, `yMm`, and `widthMm`/`depthMm` footprint
- For all others: use whatever positional fields exist; skip elements with no plan position

### B — Box selection in PlanCanvas

In `PlanCanvas.tsx`, in the `select` tool branch:

**Pointer down**: record `dragStartMm` (convert canvas event to plan mm using existing coordinate helper)

**Pointer move** (while button held): if dragged more than ~5 px from start, enter box-select mode:

- Track `dragCurrentMm`
- Render a selection rectangle overlay:
  - Left-to-right drag (dragCurrentMm.x > dragStartMm.x): solid blue border, semi-transparent blue fill — "window" mode
  - Right-to-left drag: dashed blue border, semi-transparent green fill — "crossing" mode
- Render as an SVG `<rect>` overlay on the canvas div, or as a `THREE.Mesh` plane, whichever is simpler given the existing canvas structure

**Pointer up** (after drag):

- Compute `boxMin`/`boxMax` from start and current mm
- Determine mode (window vs crossing based on drag direction)
- Call `elementInSelectionBoxMm` for every element in `elementsById`
- Call `setSelectedElementIds` with all matching element ids
- Clear the drag state

**Click (no drag)**: existing click-to-select behaviour unchanged.

### C — Keyboard shortcut: Select All

In `PlanCanvas.tsx`, add keyboard handler: when `planTool === 'select'` and `Ctrl+A` is pressed:

- Select all elements in the active level (elements whose `levelId` matches `activeLevelId`)
- Dispatch `setSelectedElementIds(matchingIds)`

### D — Tests

Create `packages/web/src/plan/boxSelection.test.ts`:

```ts
describe('elementInSelectionBoxMm — §1.8.1', () => {
  it('wall fully inside box: window mode returns true', () => { ... });
  it('wall fully outside box: both modes return false', () => { ... });
  it('wall crossing box edge: crossing mode returns true, window mode false', () => { ... });
  it('column footprint inside box: window mode returns true', () => { ... });
  it('room AABB crossing box: crossing mode returns true', () => { ... });
  it('left-to-right drag is window, right-to-left is crossing', () => { ... });
});
```

---

## Commit and push

After all tasks are done and tests pass (`pnpm test --filter @bim-ai/web`), commit:

```
git add -p   # stage only your changes
git commit -m "feat(wave9/A): box/crossing selection in plan (§1.8.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
