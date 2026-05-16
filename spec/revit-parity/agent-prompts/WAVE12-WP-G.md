# Wave 12 — WP-G: Named + Locked 3D Views + Section Box from Plan (§6.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — saved_3d_view element type (if exists), plan_view
packages/web/src/workspace/Workspace.tsx                 — 3D view tab, view navigation
packages/web/src/workspace/project/ProjectBrowser.tsx    — project browser (3D views group)
packages/web/src/viewport/Viewport3D.tsx                 — 3D viewport, camera, section box
packages/web/src/state/store.ts                          — cameraState, viewerSectionBoxExtent
packages/web/src/cmdPalette/defaultCommands.ts           — palette commands
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `store.ts` — find `viewerSectionBoxExtent` (from wave 3 or earlier). Find `cameraState` or camera position/target. Find any `savedViews` or `saved3dViews` state.
- `Viewport3D.tsx` — find how the camera is positioned and how the section box is applied. Find any existing "Save View" button or camera state persistence.
- `ProjectBrowser.tsx` — find the "3D Views" group. Read what entries it currently shows.
- `Workspace.tsx` — find how 3D view tabs are opened and how camera state is restored when switching tabs.
- The section box handle interaction (from prior waves) — find `userData.sectionBoxHandle` and drag logic.
- `core/index.ts` — check if a `saved_3d_view` element kind already exists.

---

## Tasks

### A — Core type: saved 3D view element

In `core/index.ts`, add (if not present):

```ts
export interface Saved3dViewElement {
  kind: 'saved_3d_view';
  id: string;
  name: string;
  /** Camera position in 3D world units (mm). */
  cameraMm: { x: number; y: number; z: number };
  /** Camera target/look-at point (mm). */
  targetMm: { x: number; y: number; z: number };
  /** Camera up vector. Default [0,1,0]. */
  upVector?: { x: number; y: number; z: number } | null;
  /** Whether the view is locked (camera cannot be rotated/panned). */
  locked?: boolean | null;
  /** Section box extent when this view was saved. */
  sectionBox?: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  } | null;
}
```

Add command types:
```ts
export type SaveCurrentViewCmd = { type: 'save_3d_view'; name: string };
export type DeleteSavedViewCmd = { type: 'delete_3d_view'; viewId: string };
export type RestoreSavedViewCmd = { type: 'restore_3d_view'; viewId: string };
```

### B — Save/restore view commands

In `Workspace.tsx`, add handlers:

**`save_3d_view`**: read current camera position + target from the store or from a `Viewport3D` ref. Create a new `saved_3d_view` element and add it to `elementsById`. If `viewerSectionBoxExtent` is set, save it in `sectionBox`.

**`restore_3d_view`**: find the `saved_3d_view` element by id. Dispatch camera teleport to its `cameraMm`/`targetMm`. If `sectionBox` is set, restore `viewerSectionBoxExtent`. If `locked`, set a flag that prevents camera interaction.

**`delete_3d_view`**: remove the `saved_3d_view` from `elementsById`.

Expose camera position to Workspace via a ref or callback — read how `Viewport3D` communicates camera state to its parent and use that channel.

### C — Project browser: 3D Views group

In `ProjectBrowser.tsx`, in the "3D Views" (or equivalent) group:
- List all `saved_3d_view` elements sorted by name
- Each row: view name, lock icon (if locked), double-click → restore view
- Right-click context menu (use the `ElementContextMenu` from wave 10): "Restore", "Rename" (inline), "Delete", "Lock/Unlock"
- **"Save current view"** button (`data-testid="browser-save-3d-view"`) at the top of the group → prompts for a name (inline input), dispatches `save_3d_view`

### D — Section box from plan view

In `Workspace.tsx` or `Viewport3D.tsx`, add a **"Section Box from Plan"** command:

When the active plan view has a `cropRegion` or bounding box:
- Compute the section box extent from the plan view's crop region (xMin, xMax in plan coords → world coords)
- Set `viewerSectionBoxExtent` to those bounds
- Switch to 3D tab to show the result

Palette command:
```ts
registerCommand({
  id: 'view.section-box-from-plan',
  label: 'Section Box from Active Plan View',
  keywords: ['section box', 'crop', 'plan', '3D'],
  category: 'command',
  invoke: (ctx) => ctx.sectionBoxFromPlan?.(),
});
```

Add `sectionBoxFromPlan?: () => void` to `PaletteContext`.

### E — Locked view: prevent camera interaction

In `store.ts`, add:
```ts
viewLocked: boolean;
setViewLocked: (v: boolean) => void;
```

In `Viewport3D.tsx`, when `viewLocked` is true: disable orbit controls (set `controls.enabled = false`). Show a **"View Locked"** badge (`data-testid="view-locked-badge"`) as an overlay.

A **"Unlock View"** button on the badge dispatches `setViewLocked(false)`.

### F — Tests

Write `packages/web/src/workspace/saved3dViews.test.ts`:
```ts
describe('saved 3D views — §6.1.3', () => {
  it('save_3d_view adds a saved_3d_view element to elementsById', () => { ... });
  it('restore_3d_view dispatches camera teleport', () => { ... });
  it('delete_3d_view removes the element', () => { ... });
  it('save includes sectionBox when viewerSectionBoxExtent is set', () => { ... });
});
```

Write `packages/web/src/workspace/project/projectBrowserSaved3dViews.test.tsx`:
```ts
describe('project browser 3D views — §6.1.3', () => {
  it('renders browser-save-3d-view button', () => { ... });
  it('lists saved_3d_view elements by name', () => { ... });
  it('shows lock icon on locked views', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave12/G): named/locked 3D views + section box from plan (§6.1.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
