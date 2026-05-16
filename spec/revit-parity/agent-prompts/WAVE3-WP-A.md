# Wave 3 — WP-A: Walkthrough RAF Playback Wiring (§14.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                            — Element union + ElemKind
packages/web/src/Viewport.tsx                         — 3D viewport + pointer/key handlers
packages/web/src/viewport/WalkthroughPlaybackPanel.tsx — RAF loop component (ALREADY EXISTS)
packages/web/src/workspace/WorkspaceLeftRail.tsx      — production left-rail (not ProjectBrowserV3)
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/state/store.ts                       — Zustand store root
packages/web/src/state/storeTypes.ts                  — store type declarations
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What wave 1 + 2 already built — DO NOT rebuild these

- `CameraPathElem` + `WalkthroughKeyframe` types in `core/index.ts`
- `reduceWalkthrough` + `WalkthroughState` + `initialWalkthroughState` in `toolGrammar.ts`
- Keyframe capture in `Viewport.tsx`: left-click while tool='walkthrough' → captures pose
- Enter key commit in `Viewport.tsx` → `addCameraPath()` to Zustand store
- `cameraPaths: CameraPathElem[]` + `addCameraPath` in Zustand store (storeTypes.ts + storeViewportRuntimeSlice.ts)
- `WalkthroughPlaybackPanel.tsx` at `packages/web/src/viewport/WalkthroughPlaybackPanel.tsx`:
  - exports `interpolateWalkthrough(keyframes, timeSec)` — linear lerp between keyframes
  - exports `WalkthroughPlaybackPanel` component — RAF loop, Play/Pause/Reset, 0.5×/1×/2× speed,
    loop toggle, `onFrame(pos, target)` callback
  - 11 tests in `walkthroughD3.test.ts` all passing
- WorkspaceLeftRail.tsx: lists "Walkthroughs" section showing `cameraPaths` rows (step-playback on
  click — fires one `setTimeout` per keyframe, 2 s apart)

**The only missing piece**: `WalkthroughPlaybackPanel` is never mounted anywhere in the real UI.
The step-playback in WorkspaceLeftRail is sequential/coarse; the smooth RAF version is built but
not wired.

---

## Tasks

### A — Wire WalkthroughPlaybackPanel into Viewport.tsx

When a camera-path row is selected in WorkspaceLeftRail, the panel should appear inside the 3D
viewport as an overlay (bottom-centre, above the walk-mode toggle) and drive the camera via the
`onFrame` callback.

**A1. Selection signal**: WorkspaceLeftRail already calls `activateRow(id)` on click. Add a
separate signal for "selection without playback trigger": when the user clicks a camera-path row,
store the selected path id in a small piece of local React state or a new Zustand field
`selectedCameraPathId: string | null`. Do NOT remove the step-playback — replace it with the
proper RAF panel (the step-playback was a placeholder).

**A2. Viewport overlay**: In `Viewport.tsx`, read `selectedCameraPathId` from the store and the
matching `CameraPathElem` from `cameraPaths`. When a path is selected, render
`<WalkthroughPlaybackPanel>` as an absolutely-positioned overlay inside the viewport div.

Wire `onFrame`:
```ts
onFrame={(pos, target) => {
  setOrbitCameraFromViewpointMm({
    position: { xMm: pos.x, yMm: pos.y, zMm: pos.z },
    target: { xMm: target.x, yMm: target.y, zMm: target.z },
    up: { xMm: 0, yMm: 0, zMm: 1 },
  });
}}
```

`setOrbitCameraFromViewpointMm` is already imported in Viewport.tsx from the store.

**A3. Deselect on Escape**: pressing Escape while the playback panel is visible stops playback and
clears `selectedCameraPathId`.

---

### B — Camera path inspector

When a `camera_path` element is selected (i.e. `selectedCameraPathId !== null`), show an
inspector panel in `InspectorContent.tsx`.

Add a `case 'camera_path':` block (study how `saved_view` or `interior_elevation_marker` inspector
panels are structured). Show:
- **Name** — editable text input; dispatches a local rename action (store: add
  `renameCameraPath(id, name)` that patches the name field on the matching `CameraPathElem`)
- **Keyframes** — read-only count (e.g. "5 keyframes")
- **Duration** — read-only computed: `last keyframe timeSec` seconds (e.g. "12.0 s")
- **Delete path** — button that calls `removeCameraPath(id)` from the store; also clears
  `selectedCameraPathId`

Add `renameCameraPath(id: string, name: string)` and `removeCameraPath(id: string)` to
`storeTypes.ts` + `storeViewportRuntimeSlice.ts`.

---

### C — Store: selectedCameraPathId

In `storeTypes.ts` add:
```ts
selectedCameraPathId: string | null;
setSelectedCameraPathId: (id: string | null) => void;
renameCameraPath: (id: string, name: string) => void;
removeCameraPath: (id: string) => void;
```

Implement all four in `storeViewportRuntimeSlice.ts`.

In `WorkspaceLeftRail.tsx`, replace the step-playback code in `activateRow` (the `cameraPaths`
branch) with:
```ts
useBimStore.getState().setSelectedCameraPathId(id);
```

---

### D — Remove stale step-playback

Remove the `cp.keyframes.forEach((kf, i) => setTimeout(...))` block from WorkspaceLeftRail.
The RAF panel now handles playback. Keep the row click wiring — it just sets the selected path id.

---

## Tests

Add to a new file `packages/web/src/viewport/walkthroughPanelWiring.test.tsx`:
1. Store initialises with `selectedCameraPathId: null`
2. `setSelectedCameraPathId('cp-1')` sets the field; calling with null clears it
3. `renameCameraPath` patches the name on the matching path; no-op for unknown id
4. `removeCameraPath` removes the matching path and clears `selectedCameraPathId` if it was selected

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §14.6 status block:
```
**Status: Done — P1**
[keep existing description, append:]
`WalkthroughPlaybackPanel` wired into `Viewport.tsx` as a bottom-centre overlay — replaces the
placeholder step-playback. `onFrame` drives `setOrbitCameraFromViewpointMm`. Camera path inspector
in `InspectorContent.tsx` shows name (editable), keyframe count, duration, delete. Store fields:
`selectedCameraPathId`, `setSelectedCameraPathId`, `renameCameraPath`, `removeCameraPath`.
4 wiring tests in `walkthroughPanelWiring.test.tsx`.
```

Remove this line from the P1 gap list (around line 1147):
```
- **Walkthrough smooth RAF playback** (Ch. 14.6) — ...
```

Update the summary table row for Chapter 14 to `Done/Partial` (walkthroughs now done; sun
animation and photorealistic rendering are separate items still Partial).
