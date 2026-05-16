# Wave 5 — WP-D: Walkthrough Smooth RAF Playback + Path Export (§14.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                   — CameraPathElem + WalkthroughKeyframe
packages/web/src/viewport/WalkthroughPlaybackPanel.tsx       — playback UI panel
packages/web/src/state/store.ts                              — cameraPaths, selectedCameraPathId
packages/web/src/state/storeViewportRuntimeSlice.ts          — cameraPaths store slice
packages/web/src/state/storeTypes.ts                         — StoreState interface
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `CameraPathElem` + `WalkthroughKeyframe` types in `core/index.ts` — read them
- `cameraPaths: CameraPathElem[]`, `selectedCameraPathId`, `addCameraPath`,
  `setSelectedCameraPathId`, `renameCameraPath`, `removeCameraPath` — all in the store
- `WalkthroughPlaybackPanel.tsx` — read the FULL file; it may already have partial RAF logic

---

## Tasks

### A — RAF-interpolated playback loop

In `WalkthroughPlaybackPanel.tsx`, implement smooth camera animation between keyframes:

1. Add `isPlaying: boolean` state + Play/Pause button (`data-testid="walkthrough-play-pause"`)
2. When `isPlaying`, start a `requestAnimationFrame` loop:
   - Track elapsed time via `performance.now()`
   - Given elapsed time `t`, find the two surrounding keyframes `kf[i]` and `kf[i+1]` where
     `kf[i].timeSec <= t < kf[i+1].timeSec`
   - Compute `alpha = (t - kf[i].timeSec) / (kf[i+1].timeSec - kf[i].timeSec)`
   - Lerp `position`, `target`, `up` (use `THREE.Vector3.lerpVectors`)
   - Call `useBimStore.getState().setOrbitCameraFromViewpointMm({ position, target, up })`
3. When time reaches the last keyframe's `timeSec`, stop or loop (add `data-testid="walkthrough-loop"` checkbox)
4. Pause on unmount / path change (cleanup RAF in `useEffect` return)

### B — Scrubber / progress indicator

Add a `<input type="range">` scrubber (`data-testid="walkthrough-scrubber"`) that:
- `min=0`, `max={lastKeyframe.timeSec}`, `step=0.1`
- Shows current playback position
- Allows manual seek (sets elapsed time offset, calls `setOrbitCameraFromViewpointMm` for that
  timestamp immediately)

### C — Export path as JSON

Add an "Export Path" button (`data-testid="walkthrough-export-path"`) that triggers:
```ts
const json = JSON.stringify(selectedPath, null, 2);
// download as {selectedPath.name}.json
```

### D — Tests

Write `packages/web/src/viewport/walkthroughPlayback.test.ts`:

```ts
describe('walkthrough RAF playback — §14.6', () => {
  it('lerps position between two keyframes at alpha=0.5', () => { ... });
  it('lerps correctly at alpha=0 (first keyframe exact)', () => { ... });
  it('lerps correctly at alpha=1 (second keyframe exact)', () => { ... });
  it('clamps to last keyframe when time exceeds path duration', () => { ... });
  it('export produces valid JSON with all keyframes', () => { ... });
});
```

Test the lerp math directly — extract a pure `interpolateKeyframes(keyframes, timeSec)` function
from the panel and test it in isolation (no RAF/DOM needed).

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
