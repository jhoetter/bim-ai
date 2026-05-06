# WP-V2-01a — Options Bar context strip

**Branch:** `feat/wp-v2-01a-options-bar`
**Wave:** 1, Batch A (parallel with WP-V2-14)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-01a → `done` when merged.

---

## Context

BIM AI is a browser-first BIM authoring tool. The stack is React 19 + Vite + TypeScript, Tailwind, Zustand, Three.js. The repo is a pnpm workspace; the web package lives at `packages/web/`.

Revit has a context-sensitive "options bar" — a narrow strip below the ribbon that shows tool-relevant controls. When the Wall tool is active it shows the Location Line picker. When Floor is active it shows an offset input. When no drawing tool is active it is empty (zero height, invisible).

BIM AI's equivalent of the ribbon is the `ToolPalette.tsx` (floating top-center tool strip). The current shell (`AppShell.tsx`) has: TopBar → TabBar → [canvas area + left/right rails]. The Options Bar needs to live **between the TabBar and the canvas**, appearing only when a drawing tool is active.

---

## What already exists

- `packages/web/src/tools/toolGrammar.ts` — defines `WallLocationLine` type, `WALL_LOCATION_LINE_ORDER`, and `cycleWallLocationLine()`. The `WallChainState` carries `locationLine`.
- `packages/web/src/tools/toolRegistry.ts` — `ToolId` union, `getToolRegistry()` with hotkeys and icons.
- `packages/web/src/state/store.ts` — Zustand store; `activeTool` is already there (or equivalent). Check the exact field name before modifying.
- `packages/web/src/workspace/AppShell.tsx` — CSS grid layout; currently has rows for topbar, tabbar, and canvas.
- `packages/web/src/workspace/AppShell.test.tsx` — existing tests; do not break them.
- Design tokens: `packages/design-tokens/src/tokens-default.css`. Use `var(--color-surface)`, `var(--color-border)`, `var(--color-foreground)` etc. Never hardcode hex colors in chrome.
- Lucide icons via `@bim-ai/ui` — `import { Icons } from '@bim-ai/ui'`.

---

## What to build

### 1. `OptionsBar.tsx` — new file

**Path:** `packages/web/src/workspace/OptionsBar.tsx`

The component reads the active tool from the Zustand store and renders a narrow bar (~32 px tall, `py-1 px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]`) with tool-specific controls. When no drawing tool is active, render `null` (zero height, not just invisible).

**Wall tool** — show a Location Line row:

- Label: "Location Line:" (small, muted text)
- Segmented control or dropdown with all six options from `WALL_LOCATION_LINE_ORDER`:
  - `wall-centerline` → "Wall Centerline"
  - `finish-face-exterior` → "Finish Face: Exterior"
  - `finish-face-interior` → "Finish Face: Interior"
  - `core-centerline` → "Core Centerline"
  - `core-face-exterior` → "Core Face: Exterior"
  - `core-face-interior` → "Core Face: Interior"
- Clicking a value dispatches a Zustand action to update `wallLocationLine` in the store. The wall tool already reads this via `WallChainState` — wire the store value to the chain state's `locationLine`.
- Add keyboard shortcut hint: "Tab to cycle" in a muted caption.

**Floor tool** — show an Offset row:

- Label: "Boundary Offset:" with a number input (mm, default 0). Store as `floorBoundaryOffsetMm` in the tool slice of the store (or a local state if simpler). The plan canvas reads this when committing a floor boundary.

**Door / Window tools** — show nothing (return `null`; the tools work from a single click on a wall and don't need options bar controls at this point).

**All other tools** — return `null`.

### 2. `AppShell.tsx` — insert OptionsBar row

Add the `<OptionsBar />` between the TabBar and the canvas/rail split. The grid should expand the options-bar row only when the component renders (the `null` case should not add height).

Suggested CSS grid change: add `auto` for the options-bar row. When `OptionsBar` returns `null`, React renders nothing and the row collapses.

### 3. `store.ts` — add wallLocationLine field

If `wallLocationLine` is not already in the store, add:

```ts
wallLocationLine: WallLocationLine;   // default: 'wall-centerline'
setWallLocationLine: (loc: WallLocationLine) => void;
```

Import `WallLocationLine` from `tools/toolGrammar.ts`.

Verify that `PlanCanvas.tsx` or the wall draw handler reads this field and passes it to the `WallChainState`. If the field name is different in the store, use the existing one.

---

## Tests

Create `packages/web/src/workspace/OptionsBar.test.tsx` with vitest + `@testing-library/react`:

1. When `activeTool === 'select'`, renders nothing (null).
2. When `activeTool === 'wall'`, renders a control containing "Wall Centerline".
3. Clicking "Finish Face: Exterior" calls `setWallLocationLine('finish-face-exterior')`.
4. When `activeTool === 'floor'`, renders "Boundary Offset:".

Mock the Zustand store with `vi.mock` or use the real store with `act()`.

---

## Constraints

- Tokens only in chrome — no hardcoded hex colours.
- Lucide icons only — no custom SVGs in the bar.
- Motion budget: no animations on the bar itself (it appears/disappears instantly). The spec §21 motion budget applies to modals and drawers, not utility bars.
- Do not break existing `AppShell.test.tsx` or `ToolPalette.test.tsx`.
- `make verify` must pass before committing.

---

## Commit format

```
feat(ui): WP-V2-01a — Options Bar context strip per active tool

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
