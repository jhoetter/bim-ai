# WP-EDT-03 — 3D Viewport Grip Hookup (closeout)

## Branch

`feat/wave-04-edt-03-viewport`

## Goal

Render the 3D grips registered in `packages/web/src/viewport/grip3d.ts`, dispatch their `onCommit` payloads through the engine, and ship providers for the kinds the load-bearing slice deferred (floor, roof, column, beam, door, window). Plus the wall-face radial menu (Insert Door / Window / Opening). Today the registry + wall provider exist; nothing renders or routes pointer events to it.

## Done rule

(a) Selecting a wall in 3D shows top + base handles at the wall's plan-midpoint at the appropriate elevations; dragging the top handle shows a glowing Z-axis indicator and live preview; release commits `updateElementProperty` for `topConstraintOffsetMm`.
(b) Floor, roof, column, beam, door, window grip providers ship and pass their own vitest suites.
(c) Right-clicking a wall face opens a small radial menu offering Insert Door / Insert Window / Insert Opening; selecting one places the hosted element at the click point.
(d) Tracker row for EDT-03 flips from `partial` → `done`.

---

## File 1 — `packages/web/src/viewport/grip3dRenderer.ts` (new)

Pure scene-helper module (no React). Exports:

```ts
export function buildGripMeshes(
  scene: THREE.Scene,
  grips: Grip3dDescriptor[],
): { dispose(): void; pickables: THREE.Object3D[] };

export function buildAxisIndicator(
  scene: THREE.Scene,
  origin: { xMm; yMm; zMm },
  axis: 'x' | 'y' | 'z',
  lengthMm: number,
): { update(deltaMm: number): void; dispose(): void };
```

`buildGripMeshes` creates a small Sphere + Sprite per descriptor at the descriptor's position; userData stores the descriptor so raycast hits map back. `buildAxisIndicator` creates an emissive LineSegments coloured red/green/blue per axis.

Test: `viewport/grip3dRenderer.test.ts` — assert the right number of pickables, raycast against them, descriptor-via-userData round-trip.

## File 2 — `packages/web/src/Viewport.tsx`

Add a grip pre-pass to the existing pointer handlers around line ~498 (the existing `raycaster.setFromCamera` block). Logic:

1. Resolve grips from the currently selected element via `gripsFor`.
2. Raycast against grip pickables first; if hit, set hover state, render the axis indicator on pointer-down, run `descriptor.onDrag(deltaMm)` on pointer-move (project pointer ray onto descriptor.axis line through descriptor.position), commit `descriptor.onCommit(finalDelta)` on pointer-up, dispatch through the existing engine command bus.
3. Only fall through to existing element-pick raycast when no grip is hit.

Keep the changes isolated behind a `gripPreRaycast` helper so the existing pick logic stays readable.

## File 3 — `packages/web/src/viewport/grip3dProviders.ts` (new)

Per-kind providers. Each provider is registered via `register3dGripProvider(kind, provider)` at module load.

| Kind | Grips | Roles |
| --- | --- | --- |
| floor | one per polygon vertex (xy drag), one corner-extrusion (xy drag both adjacent edges), one thickness handle on cut edge (z drag) | `boundaryMm[i]`, `boundaryMm[corner]`, `thicknessMm` |
| roof | ridge (z drag), eave (z drag), gable-end (xy drag) | `ridgeHeightMm`, `eaveHeightMm`, `gableOverhangMm` |
| column | top + bottom (z drag) | `topConstraintOffsetMm`, `baseConstraintOffsetMm` |
| beam | start + end endpoints (xyz drag, snapped to host workplane) | `start`, `end` |
| door | width + height handles (only visible in elevation view) | `widthMm`, `heightMm` |
| window | width + height + sill handles (only in elevation) | `widthMm`, `heightMm`, `sillHeightMm` |

Each provider is a pure function from element → `Grip3dDescriptor[]`, mirroring the wall provider's shape. `onCommit` returns `{ type: 'updateElementProperty', payload: {...} }` or — for vertex moves — `{ type: 'moveElementVertex', payload: { elementId, vertexIndex, ...newXY } }` (use existing kernel commands; do not invent).

Test file per provider OR a single `viewport/grip3dProviders.test.ts` exercising all six.

## File 4 — `packages/web/src/viewport/wallFaceRadialMenu.tsx` (new)

React component. Right-clicking a wall face in 3D fires `onOpen({ elementId: wallId, hitPoint, normal })`; the menu renders three buttons (Insert Door / Insert Window / Insert Opening). Selecting one closes the menu and dispatches the appropriate engine command (`insertDoorOnWall` / `insertWindowOnWall` / `createWallOpening`) with `hostElementId = wallId` and `centerOffsetMm` derived from `hitPoint` + the wall's start/end.

Wire the right-click handler into `Viewport.tsx` alongside the grip pre-pass.

Test: `viewport/wallFaceRadialMenu.test.tsx` — render menu, click Insert Door, assert dispatched command.

## Tests (vitest)

```bash
pnpm exec vitest run \
  src/viewport/grip3d.test.ts \
  src/viewport/grip3dRenderer.test.ts \
  src/viewport/grip3dProviders.test.ts \
  src/viewport/wallFaceRadialMenu.test.tsx
```

## Validation

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/viewport
```

## Tracker

Flip EDT-03 row from `partial` → `done`. Replace deferred-scope text with as-shipped: grip pre-pass in `Viewport.tsx`, six new providers, axis indicator, wall-face radial menu.

## Non-goals

- No section-box corner handles (already mostly there via `SectionBox.tsx`; out of scope here).
- No grips for sketch elements (`mass`, `reference_plane`, `dimension`) — defer to a follow-up.
- No keyboard nudge for grips — pointer-only is enough for closeout.
