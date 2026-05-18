# Wave 13 — WP-A: Hide / Isolate Elements in Plan View (§1.6.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — plan_view element type (hiddenElementIds field)
packages/web/src/workspace/Workspace.tsx                 — command handlers, active plan view
packages/web/src/plan/PlanCanvas.tsx                     — element rendering + selection
packages/web/src/cmdPalette/defaultCommands.ts           — palette commands
packages/web/src/state/store.ts                          — selectedElementIds, activePlanViewId
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — find `plan_view` element. Confirm `hiddenElementIds?: string[]` already exists on the type. Do NOT add it again.
- `Workspace.tsx` — find the pattern for commands that update `plan_view` properties (e.g. how `update_plan_view_crop` or similar commands patch the active plan view element in `elementsById`). Use the same pattern.
- `PlanCanvas.tsx` — find where elements are iterated for plan rendering (the main element loop). Find where click/selection happens. Find any existing reference to `hiddenElementIds`.
- `defaultCommands.ts` — check for any existing `view.hide-selected` / `view.isolate-selected` / `view.reset-hidden`. If any exist, do NOT duplicate.
- `store.ts` — find `selectedElementIds` type and how it is read.

---

## Tasks

### A — Commands

In `Workspace.tsx`, add handlers for three new commands:

**`hide_in_view`** `{ type: 'hide_in_view'; viewId: string; elementIds: string[] }`:

- Find the `plan_view` element with `id === viewId`
- Set `hiddenElementIds` to `[...(existing ?? []), ...elementIds]` (deduplicated with `Set`)
- Write the updated element back to `elementsById`

**`isolate_in_view`** `{ type: 'isolate_in_view'; viewId: string; elementIds: string[] }`:

- Set `hiddenElementIds` on the plan_view to all element IDs currently in elementsById that are NOT in `elementIds` and are not `plan_view`/`level`/`grid` kind
- This means everything else is hidden; the given elements are visible

**`reset_hidden_in_view`** `{ type: 'reset_hidden_in_view'; viewId: string }`:

- Set `hiddenElementIds` to `[]` on the matching plan_view

### B — Palette commands

In `defaultCommands.ts`, register (only if not already present):

```ts
registerCommand({
  id: 'view.hide-selected',
  label: 'Hide Selected Elements in View',
  keywords: ['hide', 'element', 'view'],
  category: 'command',
  invoke: (ctx) => {
    const sel = ctx.selectedElementIds ?? [];
    if (sel.length > 0 && ctx.activePlanViewId) {
      ctx.dispatch?.({ type: 'hide_in_view', viewId: ctx.activePlanViewId, elementIds: sel });
    }
  },
});

registerCommand({
  id: 'view.isolate-selected',
  label: 'Isolate Selected Elements in View',
  keywords: ['isolate', 'element', 'view'],
  category: 'command',
  invoke: (ctx) => {
    const sel = ctx.selectedElementIds ?? [];
    if (sel.length > 0 && ctx.activePlanViewId) {
      ctx.dispatch?.({ type: 'isolate_in_view', viewId: ctx.activePlanViewId, elementIds: sel });
    }
  },
});

registerCommand({
  id: 'view.reset-hidden',
  label: 'Reset Hidden Elements in View',
  keywords: ['reset', 'hidden', 'show all', 'unhide'],
  category: 'command',
  invoke: (ctx) => {
    if (ctx.activePlanViewId) {
      ctx.dispatch?.({ type: 'reset_hidden_in_view', viewId: ctx.activePlanViewId });
    }
  },
});
```

Add `selectedElementIds?: string[]; activePlanViewId?: string | null; dispatch?: (cmd: Record<string, unknown>) => void` to `PaletteContext` if not already present.

### C — Plan canvas: filter hidden elements

In `PlanCanvas.tsx`, find the element rendering loop and the click/selection handler.

In the rendering loop: skip any element whose `id` is in the active plan view's `hiddenElementIds` array.

In the click handler: do NOT select an element if its `id` is in `hiddenElementIds`.

Read how the active plan view is accessed in PlanCanvas — use the same mechanism (probably via a prop or store selector).

### D — "Elements hidden" badge

In `PlanCanvas.tsx` (or wherever the plan view overlays are rendered), when the active `plan_view` has `hiddenElementIds?.length > 0`, show a small badge overlay:

```tsx
<div
  data-testid="view-hidden-elements-badge"
  className="absolute bottom-8 left-2 flex items-center gap-1 rounded bg-warning/90 px-2 py-0.5 text-xs text-warning-foreground shadow"
>
  <span>{hiddenCount} hidden</span>
  <button
    type="button"
    data-testid="view-reset-hidden-btn"
    className="underline"
    onClick={() => dispatch({ type: 'reset_hidden_in_view', viewId: activePlanViewId })}
  >
    Reset
  </button>
</div>
```

Use existing Tailwind colour tokens (`warning`, `warning-foreground`) or `bg-amber-500/90 text-white` if warning tokens are absent.

### E — Tests

Write `packages/web/src/workspace/hideInView.test.ts`:

```ts
describe('hide / isolate / reset in view — §1.6.10', () => {
  it('hide_in_view appends element IDs to hiddenElementIds', () => { ... });
  it('hide_in_view deduplicates if element already hidden', () => { ... });
  it('isolate_in_view hides all elements not in the given set', () => { ... });
  it('reset_hidden_in_view clears hiddenElementIds to empty array', () => { ... });
});
```

Test the pure command handler logic (not the React component). Extract the handler logic into a pure function `applyHideInView`, `applyIsolateInView`, `applyResetHiddenInView` in `packages/web/src/workspace/hideInView.ts` so the tests can import them directly without mounting the component.

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave13/A): hide/isolate elements in plan view (§1.6.10)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
