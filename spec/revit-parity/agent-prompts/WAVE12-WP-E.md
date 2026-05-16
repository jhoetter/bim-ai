# Wave 12 — WP-E: Ceiling Auto-Boundary from Walls + Plan Grid Hatch (§8.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — ceiling element type
packages/web/src/tools/toolRegistry.ts                   — 'ceiling' tool
packages/web/src/tools/toolGrammar.ts                    — ceiling tool grammar
packages/web/src/plan/PlanCanvas.tsx                     — ceiling placement
packages/web/src/plan/planElementMeshBuilders.ts         — ceiling plan symbol
packages/web/src/plan/roomArea.ts                        — room boundary polygon helpers
packages/web/src/cmdPalette/defaultCommands.ts           — palette entries
packages/web/src/workspace/inspector/InspectorContent.tsx — ceiling inspector
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `ceiling` element in `core/index.ts` — find all fields: `boundaryPointsMm`, `levelId`, `heightMm`, `thicknessMm`, `ceilingTypeId`. Also check if a `gridPatternMm` or `tileSpacingMm` field exists.
- `ceiling` tool in `toolRegistry.ts` — check what mode, hotkey, and grammar already exist.
- `toolGrammar.ts` — find any existing `CeilingState`/`reduceCeiling`. Read it fully.
- `PlanCanvas.tsx` — find the ceiling tool click handler. Understand how the boundary is currently set (manual sketch vs auto from room).
- `planElementMeshBuilders.ts` — find the ceiling plan symbol renderer. What does it currently draw?
- `roomArea.ts` — find functions that compute room boundary polygons from wall geometry. These will be reused for auto-boundary.

---

## Tasks

### A — Core type: ceiling fields

In `core/index.ts`, add to `ceiling` element if missing:
```ts
/** Grid pattern tile size. When set, plan view shows a hatch grid. */
gridPatternMm?: number | null;    // e.g. 600 for 600×600mm ceiling tiles
gridOffsetMm?: { xMm: number; yMm: number } | null; // origin offset for grid alignment
gridAngleDeg?: number | null;     // rotation of grid lines, default 0
```

### B — Auto-boundary: detect enclosing walls

Create `packages/web/src/plan/ceilingAutoDetect.ts`:

```ts
/** Compute ceiling boundary from the walls on the same level that enclose a point. */
export function detectCeilingBoundary(
  clickMm: { xMm: number; yMm: number },
  walls: Array<Extract<Element, { kind: 'wall' }>>,
  levelId: string,
): { xMm: number; yMm: number }[] | null
```

Implementation:
1. Filter `walls` by `levelId`
2. Build a polygon set from wall center lines (treat each wall as a line segment from startMm to endMm)
3. Find the smallest polygon that encloses `clickMm` using a simple flood-fill or polygon winding test
4. Return the polygon vertices, or `null` if no enclosing region found

You may reuse `roomArea.ts` logic if it computes equivalent polygons — read it first. If `roomArea.ts` already has a function that does this, call it instead.

**Keep it simple**: if the full polygon detection is complex, return a rectangular bounding box of the walls on that level as a fallback so the tool is always usable.

### C — Ceiling tool: auto-boundary placement

In `PlanCanvas.tsx`, in the ceiling tool click handler:

When the user clicks with the ceiling tool active:
1. Call `detectCeilingBoundary(clickPoint, walls, activeLevelId)`
2. If a boundary is found: immediately create the ceiling with that boundary (single-click placement, like room tool)
3. If no boundary found: fall back to sketch mode (existing multi-click polygon drawing)

Also support a **sketch mode fallback**: if the user holds Shift while clicking, enter the manual sketch boundary mode regardless.

### D — Plan: ceiling grid hatch

In `planElementMeshBuilders.ts`, in the ceiling plan symbol renderer:

When `ceiling.gridPatternMm != null`:
- Draw a grid of thin lines (hatch pattern) within the ceiling boundary polygon
- Line spacing = `gridPatternMm` (e.g. 600 mm → lines every 600 mm)
- Line angle = `gridAngleDeg ?? 0`
- Grid origin offset from `gridOffsetMm`
- Use `THREE.LineSegments` with a light grey 0.5 px line material
- Clip lines to the ceiling boundary polygon (or simply draw from bounding box edge to edge and let the plan boundary clip visually)
- Tag with `userData.ceilingGrid = true`

When `gridPatternMm` is null: draw existing ceiling plan symbol (cross-hatched or solid fill — whatever currently exists).

### E — Inspector: ceiling grid controls

In `InspectorContent.tsx`, for `el.kind === 'ceiling'`:

- **Grid pattern (mm)** (`data-testid="inspector-ceiling-grid-size"`): number input, e.g. 600. Empty = no grid. Dispatches `update_element_property` for `gridPatternMm`.
- **Grid angle (°)** (`data-testid="inspector-ceiling-grid-angle"`): number input 0–90. Dispatches for `gridAngleDeg`.
- **Height (mm)** (`data-testid="inspector-ceiling-height"`): existing or add; dispatches for `heightMm`.

### F — Tests

Write `packages/web/src/plan/ceilingAutoDetect.test.ts`:
```ts
describe('ceilingAutoDetect — §8.2', () => {
  it('returns null when no walls enclose the click point', () => { ... });
  it('returns a boundary polygon when walls enclose the click point', () => { ... });
  it('filters walls by levelId', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/ceilingInspector.test.tsx`:
```ts
describe('ceiling inspector — §8.2', () => {
  it('renders inspector-ceiling-grid-size input', () => { ... });
  it('renders inspector-ceiling-grid-angle input', () => { ... });
  it('grid size change dispatches update_element_property for gridPatternMm', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave12/E): ceiling auto-boundary from walls + grid hatch in plan (§8.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
