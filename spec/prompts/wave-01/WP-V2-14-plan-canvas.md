# WP-V2-14 — Plan Canvas: wire B01 / B02 / B03

**Branch:** `feat/wp-v2-14-plan-canvas`
**Wave:** 1, Batch A (parallel with WP-V2-01a)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-14 → `done` when merged.

---

## Context

The plan canvas (`packages/web/src/plan/PlanCanvas.tsx`, ~830 lines) is a Three.js orthographic renderer for 2D plan views. It has its own camera, zoom/pan, pointer handling, and grid drawing. Three spec gaps remain open (WP-UI-B01, B02, B03):

**B01 — Scale-dependent drafting visuals:** `planCanvasState.ts` exports `draftingPaintFor(plotScale)` which returns line widths and visible hatches keyed to the current drawing scale. PlanCanvas does NOT call this function — it renders everything at a fixed weight regardless of zoom level.

**B02 — Pointer classification + snap feedback:** `planCanvasState.ts` exports `classifyPointerStart()` and the `SnapEngine` class. PlanCanvas has inline pointer classification and does NOT use either. No snap indicator is shown on canvas.

**B03 — Camera bounds:** The orthographic camera's `half` value (half of world-space height in metres) is clamped to `[minZoomRef.current, 420]`. The spec requires strict 1:5–1:5000 plan scale bounds. At 1:5 the world half is ≈0.5 m; at 1:5000 it is ≈500 m. The anchor-toward-cursor zoom is already correctly implemented (lines 784–787 and 799–801 both adjust `camX`/`camZ` by `ndcX * asp * dH`).

---

## Key file locations

| Path | Role |
|---|---|
| `packages/web/src/plan/PlanCanvas.tsx` | Main file to modify |
| `packages/web/src/plan/planCanvasState.ts` | `draftingPaintFor`, `SnapEngine`, `classifyPointerStart` — already defined, not yet wired |
| `packages/web/src/plan/draftingStandards.ts` | `CATEGORY_LINE_RULES`, `lineWidthPxFor`, `hatchVisibleAt`, `HATCH_SPECS` |
| `packages/web/src/plan/planCanvasState.test.ts` | Existing tests — do not break |
| `packages/web/src/plan/snapEngine.test.ts` | Existing snap tests |

---

## B01 — Wire `draftingPaintFor`

### What to do

1. **Compute `plotScale`** from the current camera state. `plotScale` is the ratio of world-space half-height (in mm) to a reference canvas half-height (500 mm = 50 cm = a comfortable A1 half-height). Concretely:
   ```ts
   // camRef.current.half is in world metres
   const worldHalfMm = camRef.current.half * 1000;
   const plotScale = worldHalfMm / 500; // e.g. half=10m → plotScale=20 → "1:20"
   ```

2. **Call `draftingPaintFor(plotScale)`** inside the render/rebuild effect (the `useEffect` that calls `rebuildPlanMeshes`). Store the result in a ref so it's available to mesh builders without causing extra re-renders:
   ```ts
   const draftingRef = useRef<ReturnType<typeof draftingPaintFor> | null>(null);
   // inside the effect, before rebuildPlanMeshes:
   draftingRef.current = draftingPaintFor(plotScale);
   ```

3. **Apply line widths** to the grid line material. The grid currently uses a fixed `LineBasicMaterial`. After computing `draftingRef.current`, set the material's linewidth (note: WebGL linewidth > 1 only works on some platforms, so this primarily affects the visual weight token for the grid). More impactfully: pass `draftingRef.current` to `rebuildPlanMeshes` or a new `rebuildHatches` helper so that element outlines use `draftingRef.current.lineWidthPx('wall')` etc.

   Check what `rebuildPlanMeshes` already accepts for line weight — if it takes `planGraphicHints`, you can extend those hints with the scale-derived line widths rather than a separate argument.

4. **Apply hatch visibility.** `draftingPaintFor` returns `visibleHatches: HatchSpec[]`. After `rebuildPlanMeshes`, iterate the hatch mesh children (tagged `userData.hatchKind`) in the scene group and set `visible = visibleHatches.some(h => h.kind === child.userData.hatchKind)`. If hatch meshes don't exist yet, this step is a no-op — note it in a comment and move on; the hatch rendering is a separate future WP.

5. **Re-run on zoom:** The zoom effect (wheel handler) already calls `resizeCam()`. After `resizeCam()` runs, trigger a re-render of the meshes if the plotScale has changed by more than 20% (avoid re-building on every pixel of scroll). Use a ref to track `lastPlotScale` and only call `rebuildPlanMeshes` when `Math.abs(newScale - lastScale) / lastScale > 0.2`.

### Test

Add cases to `packages/web/src/plan/planCanvasState.test.ts` (or a new `PlanCanvas.render.test.tsx`) that:
- `draftingPaintFor(20)` returns line widths ≥ those at `draftingPaintFor(200)` (heavier at closer zoom).
- `draftingPaintFor(500).visibleHatches` is a subset of `draftingPaintFor(50).visibleHatches` (fewer hatches at small scale).

---

## B02 — Wire `classifyPointerStart` + snap pill

### What to do

1. **Replace inline pointer classification** in `PlanCanvas.tsx`. Currently the pointer-down handler has inline `if (spaceDownRef.current || ev.button === 1)` logic to decide between pan, drag-move, and draw. Replace this with a call to `classifyPointerStart` from `planCanvasState.ts`:
   ```ts
   import { classifyPointerStart, SnapEngine } from './planCanvasState';
   // inside pointer-down handler:
   const intent = classifyPointerStart({
     button: ev.button,
     spacePressed: spaceDownRef.current,
     shiftKey: ev.shiftKey,
     altKey: ev.altKey,
     activeTool: planTool ?? undefined,
     dragDirection: null, // filled later on pointer-up for marquee
   });
   ```
   Then switch on `intent` instead of the inline conditionals. Preserve all existing behaviour — the function already maps to the same intents the canvas currently handles.

2. **Instantiate SnapEngine in a ref:**
   ```ts
   const snapEngineRef = useRef(new SnapEngine());
   ```
   The SnapEngine is stateful (which modes are on) but can be reset on tool change if needed.

3. **Generate snap candidates** during pointer-move while a drawing tool is active. Walk `elementsById` to find wall endpoints and midpoints within screen-pixel radius 12 of the current cursor world position. This does not need to be exhaustive — 12 px at typical zoom ≈ a few hundred mm tolerance. Push candidates as `SnapCandidate[]` and resolve via `snapEngineRef.current.resolve(candidates)`.

4. **Show a snap indicator.** When a snap candidate resolves, render a small Three.js `Mesh` (a 6 px ring — `TorusGeometry(0.05, 0.01, 8, 16)`) at the snap position, tagged `userData.snapIndicator = true`. Remove it on pointer-up or when no snap is active. Also call `snapEngineRef.current.pillLabel(candidate)` and display the result in the StatusBar or as a canvas overlay label (a simple `<div>` positioned over the canvas via `getBoundingClientRect`).

### Test

Add to `planCanvasState.test.ts`:
- `classifyPointerStart({ button: 1 })` → `'pan'`
- `classifyPointerStart({ button: 0, spacePressed: true })` → `'pan'`
- `classifyPointerStart({ button: 0, activeTool: 'wall' })` → `'draw'`
- `SnapEngine.resolve([{ mode: 'endpoint', xMm: 0, yMm: 0 }, { mode: 'midpoint', xMm: 1, yMm: 1 }])` → endpoint wins (higher priority).

---

## B03 — Camera scale bounds

### What to do

The wheel handler at `PlanCanvas.tsx:765` currently clamps `half` to `[minZoomRef.current, 420]`. Replace these constants with the spec bounds:

```ts
const PLAN_SCALE_MIN = 5;    // 1:5 — very close zoom
const PLAN_SCALE_MAX = 5000; // 1:5000 — very far zoom
// half = plotScale * 500mm / 1000 (to metres)
const HALF_MIN = (PLAN_SCALE_MIN * 500) / 1000;   // = 2.5 m
const HALF_MAX = (PLAN_SCALE_MAX * 500) / 1000;   // = 2500 m
```

Replace both occurrences of `THREE.MathUtils.clamp(…, minZoomRef.current, 420)` with `THREE.MathUtils.clamp(…, HALF_MIN, HALF_MAX)`. Also update `handleFitToView` similarly.

Remove `minZoomRef` if it is now unused.

### Test

Add a test asserting that at HALF_MIN the zoom cannot decrease further (calling the internal zoom function with a large delta still clamps at HALF_MIN).

---

## Constraints

- Do not change the Three.js camera type (OrthographicCamera).
- Do not change how `rebuildPlanMeshes` is called — only extend what's passed to it.
- Do not break existing `planCanvasState.test.ts`, `snapEngine.test.ts`, or `draftingStandards.test.ts`.
- `make verify` must pass.

---

## Commit format

```
feat(plan): WP-V2-14 — wire draftingPaintFor, classifyPointerStart, snap pill, camera bounds

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
