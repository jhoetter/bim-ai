# WP-FED-03 — Cross-link Copy/Monitor canvas badge (closeout)

## Branch

`feat/wave-05-fed-03-canvas-badge`

## Sequencing

**Run after FED-04 has merged to main.** FED-04 adds a DXF underlay layer in `PlanCanvas.tsx`; this WP adds an overlay layer in the same file. Sequential avoids a trivial append-style conflict.

## Goal

Ship the only deferred bullet on FED-03: the on-canvas yellow-triangle drift badge. Today (commit `0fe4cfc2`) the structured `monitorSource` pointer, `bumpMonitoredRevisions` + `reconcileMonitoredElement` commands, drift advisory, and Inspector-banner reconcile UI all ship. The on-canvas badge is the last piece — quick visual cue that an element is drifting from its monitored source.

## Done rule

(a) Plan canvas shows a small yellow triangle glyph at the visual centre of any element whose `monitorSource` has drifted (`drifted: true`).
(b) 3D viewport shows the same badge as a billboarded sprite at the element's centroid.
(c) Hovering the badge shows a tooltip: "Monitored source has drifted — N field(s) differ" with a clickable link that opens the Inspector's Reconcile banner pre-focused on the offending element.
(d) Tracker row for FED-03 flips from `partial` → `done`.

---

## File 1 — `packages/web/src/plan/monitorDriftBadge.ts` (new)

Pure renderer + hit-test:

```ts
export function renderMonitorDriftBadge(
  ctx: CanvasRenderingContext2D,
  element: ElementWithMonitorSource,
  worldToScreen: (xy: Vec2Mm) => [number, number],
): { hitRect: Rect } | null;

export function elementHasDrift(elem: { monitorSource?: MonitorSource }): boolean;
```

`elementHasDrift` returns true when `monitorSource?.drifted === true && monitorSource.driftedFields?.length > 0`. `renderMonitorDriftBadge` draws a 16×16 yellow triangle (filled `#FBBF24`, stroked `#92400E`) at the element's plan-centroid. Returns the screen-space hit rect for click handling.

## File 2 — `packages/web/src/plan/PlanCanvas.tsx`

Add a top-level overlay-layer pass **after** the element-render loop (so the badge sits above geometry):

```ts
function renderDriftBadges(ctx) {
  for (const elem of elementsForLevel) {
    if (!elementHasDrift(elem)) continue;
    const hit = renderMonitorDriftBadge(ctx, elem, worldToScreen);
    if (hit) badgeHitRects.push({ elementId: elem.id, hit });
  }
}
```

Track `badgeHitRects` per render so pointer events can map a click to the matching element. On click, dispatch a store action that opens the Inspector for that element with the Reconcile banner pre-focused (the existing FED-03 Reconcile UI).

## File 3 — `packages/web/src/Viewport.tsx`

Add a Three.js Sprite layer for drift badges. For each element with drift, place a 32×32 px Sprite (using a small Canvas-rendered yellow-triangle texture from `monitorDriftBadge.ts` — share the rendering helper) at the element's centroid in world space. Raycast against the Sprite layer in pointer-down, before the existing element-pick raycast. On hit, dispatch the same "open Inspector with reconcile" action.

Cap at one Sprite per drifted element. Update on store changes (mount/unmount as drift state flips).

## File 4 — `packages/web/src/inspector/InspectorReconcileBanner.tsx`

If not already present, add an `autoFocus` prop the canvas-click action passes through; the existing reconcile banner scrolls itself into view + flashes briefly to draw attention. (If already present, just confirm the wiring works from the new entry point.)

## File 5 — `packages/web/src/state/store.ts`

Add an action / signal `focusInspectorOnReconcile(elementId: string)` that:

1. Selects the element.
2. Opens the Inspector to the Monitor section.
3. Sets a transient `reconcileFocusFlash` flag the banner reads (auto-clears after 1.5s).

## Tests

`packages/web/src/plan/monitorDriftBadge.test.ts` (new):

- `test_elementHasDrift_true_for_drifted_pointer`
- `test_elementHasDrift_false_for_no_monitor_source`
- `test_render_emits_yellow_triangle_at_centroid`

`packages/web/src/plan/PlanCanvas.driftBadge.test.tsx` (new): mount canvas with two elements, one drifted, click the badge, assert the focus action dispatches.

`packages/web/src/Viewport.driftBadge.test.tsx` (new): same flow but in 3D — Sprite raycast hit triggers the same dispatch.

## Validation

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/plan/monitorDriftBadge.test.ts src/plan/PlanCanvas.driftBadge.test.tsx src/Viewport.driftBadge.test.tsx
```

## Tracker

Flip FED-03 row from `partial` → `done`. Replace deferred-scope text with as-shipped canvas + 3D drift badge.

## Non-goals

- Element-list panel highlight — Inspector banner remains the primary reconcile entry point.
- Auto-reconcile policies — manual Accept-source / Keep-host stays the model.
- Animated triangles, pulse effects, etc. — static yellow triangle is enough.
