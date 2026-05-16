# Wave 10 — WP-D: Right-Click Context Menu for All Element Types (§1.7.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/workspace/viewport.tsx                  — WallContextMenu (existing — read this first)
packages/web/src/plan/PlanCanvas.tsx                     — context menu trigger (find existing right-click handler)
packages/web/src/workspace/inspector/InspectorContent.tsx — element actions (Mirror, Flip, etc.)
packages/core/src/index.ts                               — element types
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `WallContextMenu` in `viewport.tsx` — the existing wall right-click menu. Read its full implementation: how it's triggered, what commands it shows, how it dispatches. Use this as the exact base pattern.
- `PlanCanvas.tsx` — find the `onContextMenu` handler. Read how `WallContextMenu` is rendered and positioned. You'll add new context menus using the same anchor/position logic.
- `InspectorContent.tsx` — read what actions exist per element kind (Flip, Mirror buttons, etc.) — these should appear in context menus too.

---

## Tasks

### A — Generic context menu component

Create `packages/web/src/workspace/ElementContextMenu.tsx`:

```tsx
interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface ElementContextMenuProps {
  open: boolean;
  anchorX: number; // screen px
  anchorY: number;
  items: ContextMenuItem[];
  onClose: () => void;
  'data-testid'?: string;
}

export function ElementContextMenu(props: ElementContextMenuProps): JSX.Element | null
```

- Renders a positioned `<ul>` at `anchorX, anchorY` with each item as `<li>`
- Item `data-testid="ctx-item-{label-kebab}"` (e.g. `ctx-item-flip-facing`)
- Separator items render `<hr>`
- Closes on Escape key or click-outside
- `data-testid` from props on the container

### B — Per-element context menu builders

Create `packages/web/src/workspace/contextMenuItems.ts`:

```ts
export function contextMenuItemsForElement(
  el: Element,
  dispatch: (cmd: Record<string, unknown>) => void,
  extras: { activeLevelId: string; planTool: string },
): ContextMenuItem[]
```

Per element kind:

**wall**: Flip (flips `locationLine` side), Edit Profile (hint only if not implemented), Split Element (activates split-wall tool with that wall pre-targeted), Mirror (horizontal/vertical)

**floor**: Edit Boundary (enters floor-sketch for that floor), Flip (if applicable), Mirror

**door / window**: Flip Facing (`flipFacing` dispatch or `update_element_property` for `facingFlipped`), Flip Handing (`handingFlipped`), Select Host (selects the host wall)

**column**: Mirror (horizontal), Rotate 90°, Select Similar (select all columns at same level)

**room**: Edit Name (focus inspector name input — dispatch a focus event or open inspector), Select Similar, Show in Schedule

**stair**: Create Floor Opening (same as the inspector button from wave9/E)

**group**: Edit Group (`editGroup` command), Ungroup (`ungroup` command if exists)

**Default fallback** (any element): Delete (`deleteElement`), Properties (opens inspector / selects element)

### C — Wire into PlanCanvas

In `PlanCanvas.tsx`, in the `onContextMenu` handler:
- Raycast to find the hit element
- Build `items = contextMenuItemsForElement(el, dispatch, extras)`
- Render `<ElementContextMenu open anchorX anchorY items onClose />`
- Replace the existing `WallContextMenu` with this unified system (or keep both if refactoring is risky — read what exists first)

The context menu should close when:
- An item is clicked
- Escape is pressed
- The user clicks elsewhere on the canvas

### D — Tests

Write `packages/web/src/workspace/contextMenuItems.test.ts`:
```ts
describe('contextMenuItemsForElement — §1.7.2', () => {
  it('wall returns items including Flip and Split Element', () => { ... });
  it('door returns Flip Facing and Flip Handing items', () => { ... });
  it('floor returns Edit Boundary item', () => { ... });
  it('room returns Edit Name and Select Similar items', () => { ... });
  it('group returns Edit Group item', () => { ... });
  it('any element returns Delete item', () => { ... });
});
```

Write `packages/web/src/workspace/ElementContextMenu.test.tsx`:
```ts
describe('ElementContextMenu — §1.7.2', () => {
  it('renders items with data-testid ctx-item-{label}', () => { ... });
  it('returns null when open=false', () => { ... });
  it('clicking an item calls its onClick and closes', () => { ... });
  it('renders separator as hr element', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave10/D): right-click context menu for all element types (§1.7.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
