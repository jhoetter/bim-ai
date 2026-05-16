# Wave 14 — WP-G: Named Perspective Camera Views (§14.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — element union type, CameraPathElem (walkthrough, NOT this)
packages/web/src/workspace/ProjectBrowser.tsx       — project browser sidebar
packages/web/src/viewport/Viewport.tsx              — 3D viewport, camera state
packages/web/src/state/store.ts                     — store state + actions
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/Workspace.tsx            — command handlers
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — find `CameraPathElem` (this is walkthrough paths — DO NOT use this type). Find `Saved3dViewElement` (`kind: 'saved_3d_view'`) — this stores named locked 3D views. Read its fields (cameraMm, targetMm, upVector, locked, sectionBox). You may reuse `Saved3dViewElement` for named camera views instead of creating a new type — check if it already stores fovDeg or perspective projection info.
- `ProjectBrowser.tsx` — find the "3D Views" section (renders `saved_3d_view` elements). Understand how double-click restores a view. Read the right-click context menu pattern.
- `Viewport.tsx` — find how the camera position/target is read. Find how `restore_3d_view` command changes the camera. Find how to switch between perspective and orthographic modes.
- `Workspace.tsx` — find handler for `save_3d_view` and `restore_3d_view` commands. Read the pattern.
- `store.ts` — find `viewerCameraPosition`, `viewerCameraTarget`, `viewerFov` or equivalent camera state.

---

## Tasks

### A — Named camera view element type

Check if `Saved3dViewElement` in `core/index.ts` already has a `perspective?: boolean` field and `fovDeg?: number` field. If NOT, add them:

```ts
perspective?: boolean | null;  // true = perspective camera, false = orthographic
fovDeg?: number | null;        // perspective field of view (degrees), default 60
```

If `Saved3dViewElement` is the right type to reuse, use it. Do NOT create a new `kind: 'camera_view'` type unless `Saved3dViewElement` is fundamentally incompatible.

### B — "Save Camera View" palette command

In `defaultCommands.ts`, register:

```ts
registerCommand({
  id: 'view.save-camera-view',
  label: 'Save Current Camera as Named View',
  keywords: ['camera', 'view', 'save', 'named', 'perspective'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatch?.({ type: 'save_camera_view', name: `Camera ${Date.now()}` });
  },
});
```

In `Workspace.tsx`, handle `'save_camera_view'`:

1. Read the current camera position, target, and up vector from Viewport state (via a store getter or ref).
2. Read `perspective` and `fovDeg` from the current viewport mode.
3. Create a `saved_3d_view` element with `perspective: true`, `fovDeg`, `cameraMm`, `targetMm`, `upVector`, `locked: false`.
4. Add it to `elementsById`.

### C — ProjectBrowser: show perspective camera views separately

In `ProjectBrowser.tsx`, in the "3D Views" section (where `saved_3d_view` elements are listed), split the list:

- **Orthographic/standard views**: `saved_3d_view` where `perspective !== true` (existing behaviour)
- **Camera Views** (new subsection): `saved_3d_view` where `perspective === true`

Add a "Camera Views" collapsible group below the existing 3D Views group:

```tsx
<div data-testid="browser-camera-views-group">
  <button>Camera Views ({count})</button>
  {perspectiveViews.map(view => (
    <div key={view.id} data-testid={`browser-camera-view-${view.id}`}
      onDoubleClick={() => onRestoreView(view.id)}
      onContextMenu={...}
    >
      📷 {view.name}
    </div>
  ))}
  <button data-testid="browser-save-camera-view" onClick={() => onSaveCameraView()}>
    Save current camera
  </button>
</div>
```

Right-click context menu: Restore, Rename (inline), Delete.

### D — Restore perspective camera view

In `Workspace.tsx` (or Viewport.tsx), when `restore_3d_view` is called for a `saved_3d_view` with `perspective: true`:

- Set the camera to perspective mode (fovDeg).
- Set camera position to `cameraMm`, look-at to `targetMm`.

Read how the existing orthographic restore works and extend it to handle perspective. The camera switch (ortho ↔ perspective) is likely a store toggle — find it.

### E — Tests

`packages/web/src/workspace/savedCameraViews.test.ts`:
```ts
describe('named perspective camera views — §14.5', () => {
  it('save_camera_view creates saved_3d_view element with perspective=true', () => { ... });
  it('restore sets perspective mode and camera position', () => { ... });
  it('camera views are separated from orthographic views in browser', () => { ... });
  it('perspective view has fovDeg field set', () => { ... });
});
```

`packages/web/src/workspace/projectBrowserCameraViews.test.tsx`:
```ts
describe('project browser camera views section — §14.5', () => {
  it('renders browser-camera-views-group', () => { ... });
  it('renders save-camera-view button', () => { ... });
  it('lists perspective saved_3d_view elements', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/G): named perspective camera views in project browser (§14.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
