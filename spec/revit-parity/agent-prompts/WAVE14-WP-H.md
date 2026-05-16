# Wave 14 — WP-H: ViewCube Right-Click → Orient to View (§3.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/viewport/ViewCube.tsx               — ViewCube component
packages/web/src/viewport/Viewport.tsx               — 3D viewport, camera control
packages/web/src/state/store.ts                      — elementsById, plan_view / saved_3d_view
packages/web/src/viewport/viewCubeAlignment.ts       — ViewCube face → camera orientation math
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `ViewCube.tsx` — read the entire component. Find how left-click on cube faces works (setting camera orientation). Find any existing right-click handling (may be absent). Understand how `onFaceClick` / `onOrbit` props are passed.
- `viewCubeAlignment.ts` — find `faceToCamera` or equivalent — how a face name maps to (camera position, target, up). Understand the coordinate system used.
- `Viewport.tsx` — find how the camera is moved programmatically (e.g. the `setCameraOrientation` or camera animation that `ViewCube` triggers). Find how `plan_view` level elevation is accessed.
- `store.ts` — find how `elementsById` is accessed. Find `plan_view` and `saved_3d_view` elements.

---

## Tasks

### A — Right-click context menu on ViewCube

In `ViewCube.tsx`, add a right-click (`onContextMenu`) handler on the cube element. On right-click:

1. Show a small dropdown menu anchored near the cube:
```tsx
<div data-testid="viewcube-context-menu" className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded shadow-md py-1 min-w-[160px]">
  <div className="px-2 py-1 text-xs text-muted font-medium">Orient to View</div>
  <button data-testid="viewcube-orient-top" onClick={() => orientToTop()}>Top (Plan)</button>
  <button data-testid="viewcube-orient-front" onClick={() => orientToFront()}>Front</button>
  <button data-testid="viewcube-orient-back" onClick={() => orientToBack()}>Back</button>
  <button data-testid="viewcube-orient-left" onClick={() => orientToLeft()}>Left</button>
  <button data-testid="viewcube-orient-right" onClick={() => orientToRight()}>Right</button>
  {savedViews.length > 0 && <hr className="my-1 border-border" />}
  {savedViews.map(v => (
    <button key={v.id} data-testid={`viewcube-orient-saved-${v.id}`} onClick={() => orientToSaved(v)}>
      {v.name}
    </button>
  ))}
</div>
```

2. Dismiss on click outside (useEffect + document click listener).

### B — Orient to standard orientations

Implement functions that animate the camera to standard orientations by calling the same mechanism that `ViewCube` face-clicks use:

- `orientToTop()`: camera directly above model, looking down. This is the plan-view orientation. Position: `{x: cx, y: cy, z: maxZ + 5000}`, target: `{x: cx, y: cy, z: 0}`, up: `{x: 0, y: 1, z: 0}`.
- `orientToFront()`: camera in front (+Y direction), looking at model centre.
- `orientToBack()`, `orientToLeft()`, `orientToRight()`: equivalent cardinal orientations.

Use the same camera animation that clicking a ViewCube face triggers.

### C — Orient to saved view

`orientToSaved(view: Saved3dViewElement)`: call `restore_3d_view` dispatch with the view's `id`, or directly call the camera-animation function with `view.cameraMm`, `view.targetMm`, `view.upVector`. Use the same mechanism that ProjectBrowser uses for double-click restore.

The `savedViews` list in the menu should come from `elementsById` filtered to `kind === 'saved_3d_view'`, sorted by `name`. Pass these as a prop from Viewport.tsx or read from the Zustand store.

### D — "Orient to View" palette command

In `defaultCommands.ts`, register:

```ts
registerCommand({
  id: 'view.orient-top',
  label: 'Orient 3D View to Top (Plan)',
  keywords: ['orient', 'top', 'plan', '3d', 'view'],
  category: 'command',
  invoke: (ctx) => { ctx.dispatch?.({ type: 'orient_3d_view', orientation: 'top' }); },
});
```

Handle `'orient_3d_view'` in `Viewport.tsx` or `Workspace.tsx`.

### E — Tests

`packages/web/src/viewport/viewCubeOrient.test.tsx`:
```ts
describe('ViewCube orient to view — §3.2', () => {
  it('renders viewcube-context-menu on right click', () => { ... });
  it('context menu shows orient-top and orient-front buttons', () => { ... });
  it('context menu shows saved view entries', () => { ... });
  it('context menu dismisses on outside click', () => { ... });
  it('does not show saved views section when none exist', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/H): ViewCube right-click orient to view (§3.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
