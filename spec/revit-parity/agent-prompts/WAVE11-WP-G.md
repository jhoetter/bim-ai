# Wave 11 — WP-G: Status Bar with Per-Tool Instruction Hints (§1.6.9)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/workspace/Workspace.tsx                 — main layout, active tool state
packages/web/src/state/store.ts                          — planTool, activeToolPhase, grammar state
packages/web/src/tools/toolGrammar.ts                    — grammar state machines (all tools)
packages/web/src/tools/toolRegistry.ts                   — tool labels
packages/web/src/workspace/authoring/OptionsBar.tsx      — existing options bar (above canvas)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `Workspace.tsx` — find if a status bar already exists at the bottom of the canvas. Search for `data-testid="status-bar"` or `StatusBar`. If it exists, extend it. If it does not, add it.
- `store.ts` — find `planTool` and any `toolPhase` / grammar-state field. Also find how `selectedElementIds` is stored. The status bar reads from these.
- `toolGrammar.ts` — read the `status` field on all key state machines: `WallState`, `FloorState`, `ColumnState`, `StairState`, `PermanentDimState`, `MeasureState`. The `status` value maps to a specific hint string.
- `OptionsBar.tsx` — understand the layout (it sits at the top of the canvas area). The status bar sits at the **bottom** in the same container.

---

## Tasks

### A — StatusBar component

Create `packages/web/src/workspace/StatusBar.tsx`:

```tsx
interface StatusBarProps {
  planTool: string | null;
  toolPhase: string | null;         // the grammar 'status' field for the current tool
  selectedCount: number;
  hoveredElementKind: string | null;
}

export function StatusBar(props: StatusBarProps): JSX.Element
```

- `data-testid="status-bar"` on container
- Fixed height ~24 px, sits at the very bottom of the canvas area
- Background: `var(--color-surface)`, border-top: `1px solid var(--color-border)`
- Left section (`data-testid="status-bar-hint"`): the instruction hint string (see task B)
- Right section (`data-testid="status-bar-selection"`): when `selectedCount > 0`, shows e.g. `"1 element selected"` or `"3 elements selected"`
- Font: small (11–12 px), muted color

### B — Hint string table

In `StatusBar.tsx` (or a co-located `statusBarHints.ts`), define a pure function:

```ts
export function getStatusHint(planTool: string | null, toolPhase: string | null): string
```

Hint strings per tool + phase:

| Tool | Phase | Hint |
|------|-------|------|
| `null` (select) | — | `"Click to select · Drag to pan · Scroll to zoom"` |
| `wall` | `idle` | `"Click to start wall"` |
| `wall` | `drawing` | `"Click next point · Double-click or Enter to finish · Esc to cancel"` |
| `floor` | `idle` | `"Click points to define floor boundary"` |
| `floor` | `drawing` | `"Click to add point · Enter to finish · Esc to cancel"` |
| `column` | `idle` | `"Click to place column"` |
| `stair` | `idle` | `"Click to place stair run start"` |
| `stair` | `drawing` | `"Click to set stair end point"` |
| `room` | `idle` | `"Click inside a bounded area to place room"` |
| `door` | `idle` | `"Click on a wall to place door"` |
| `window` | `idle` | `"Click on a wall to place window"` |
| `measure` | `idle` | `"Click first point to measure"` |
| `measure` | `picking` | `"Click second point · Esc to cancel"` |
| `measure-angle` | `idle` | `"Click vertex point"` |
| `measure-angle` | `picked-vertex` | `"Click first ray point"` |
| `measure-angle` | `picked-first-ray` | `"Click second ray point"` |
| `paint` | `idle` | `"Click a face to apply material"` |
| `permanent-dimension` | `idle` | `"Click first witness point"` |
| `permanent-dimension` | `picking` | `"Click next point · Enter to finish"` |
| `split-wall` | `idle` | `"Hover a wall and click to split"` |
| Any tool | any phase | `"Press Esc to cancel · Press Enter to finish"` (fallback) |

Implement `getStatusHint` as a plain `switch`/`if` chain — no dynamic lookup needed.

### C — Wire into Workspace

In `Workspace.tsx`:

- Import and render `<StatusBar>` at the bottom of the canvas container (inside the same flex column that holds OptionsBar at the top and the canvas in the middle)
- Pass `planTool` from store
- Pass `toolPhase`: derive from the active grammar state (e.g. `wallGrammarState.status`). If you need to track this in store, add a `activeToolPhase: string | null` field and update it whenever grammar state changes.
- Pass `selectedCount = selectedElementIds.length`
- Pass `hoveredElementKind` if available from store (may be null if not tracked)

### D — Hovered element kind

In `store.ts`, add if not already present:
```ts
hoveredElementKind: string | null;
setHoveredElementKind: (kind: string | null) => void;
```

In `PlanCanvas.tsx`, in the `onPointerMove` handler, after raycasting: when a `bimPickId` hit is found, call `setHoveredElementKind(el.kind)`; when no hit, call `setHoveredElementKind(null)`.

When `hoveredElementKind` is set and no tool is active, the StatusBar left section shows: e.g. `"Wall (click to select)"`.

### E — Tests

Write `packages/web/src/workspace/StatusBar.test.tsx`:
```ts
describe('StatusBar — §1.6.9', () => {
  it('renders status-bar element', () => { ... });
  it('shows click-to-select hint when no tool active', () => { ... });
  it('shows wall drawing hint when planTool=wall phase=drawing', () => { ... });
  it('shows "1 element selected" when selectedCount=1', () => { ... });
  it('shows "3 elements selected" when selectedCount=3', () => { ... });
});
```

Write `packages/web/src/workspace/statusBarHints.test.ts`:
```ts
describe('getStatusHint — §1.6.9', () => {
  it('returns select hint when tool is null', () => { ... });
  it('returns wall idle hint', () => { ... });
  it('returns wall drawing hint', () => { ... });
  it('returns column idle hint', () => { ... });
  it('returns measure picking hint', () => { ... });
  it('returns fallback for unknown tool', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave11/G): status bar with per-tool instruction hints (§1.6.9)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
