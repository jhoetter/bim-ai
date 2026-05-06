# WP-V2-04 — Wall Opening + Shaft Opening Tools

**Branch:** `feat/wp-v2-04-openings`
**Wave:** 2, Batch B (parallel with WP-V2-03b; start after Batch A is merged)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-04 → `done` when merged.

---

## Context

BIM AI is a browser-first BIM authoring tool. Stack: React 19 + Vite + TypeScript, Tailwind, Zustand, Three.js. pnpm workspace; web package is `packages/web/`.

**R2-01 (CSG cuts) is already implemented.** `packages/web/src/viewport/csgWorker.ts` handles door/window subtractions via `three-bvh-csg` in a Web Worker. `CSG_ENABLED` defaults to `true`. This WP adds only the authoring tools for explicit wall openings and shaft openings — not the rendering.

---

## What to build

### 1. `wall-opening` tool in `toolRegistry.ts`

Add `'wall-opening'` to the `ToolId` union. In `getToolRegistry`:

```ts
'wall-opening': {
  id: 'wall-opening',
  label: t('tool.wallOpening'),
  icon: 'square-dashed',   // lucide icon
  hotkey: 'WO',
  modes: ['plan'],
},
```

Add to `PALETTE_ORDER` in the Draw section (after `'window'`, before the Modify separator).

### 2. `shaft` tool in `toolRegistry.ts`

```ts
'shaft': {
  id: 'shaft',
  label: t('tool.shaft'),
  icon: 'layers',
  hotkey: 'SH',
  modes: ['plan'],
},
```

Add to `PALETTE_ORDER` after `'wall-opening'`.

### 3. Grammar types and reducers in `toolGrammar.ts`

#### Wall Opening

```ts
export interface WallOpeningState {
  phase: 'pick-wall' | 'define-rect';
  hostWallId: string | null;
  anchorMm: { xMm: number; yMm: number } | null;
}

export type WallOpeningEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click-wall'; wallId: string; pointMm: { xMm: number; yMm: number } }
  | { kind: 'drag-end'; cornerMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface WallOpeningEffect {
  commitWallOpening?: {
    hostWallId: string;
    anchorMm: { xMm: number; yMm: number };
    cornerMm: { xMm: number; yMm: number };
  };
  stillActive: boolean;
}

export function initialWallOpeningState(): WallOpeningState {
  return { phase: 'pick-wall', hostWallId: null, anchorMm: null };
}

export function reduceWallOpening(
  state: WallOpeningState,
  event: WallOpeningEvent,
): { state: WallOpeningState; effect: WallOpeningEffect };
```

Phase logic:
- `pick-wall` + `click-wall` → store `hostWallId` + `anchorMm`, transition to `define-rect`.
- `define-rect` + `drag-end` → emit `commitWallOpening` effect with both corners, return to `pick-wall` (tool stays active — ready for next opening).
- `cancel` or `deactivate` → return to `pick-wall`, clear state.

#### Shaft Opening

```ts
export interface ShaftState {
  phase: 'sketch' | 'idle';
  verticesMm: Array<{ xMm: number; yMm: number }>;
}

export type ShaftEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'close-loop' }    // double-click or click near first vertex
  | { kind: 'cancel' };

export interface ShaftEffect {
  commitShaft?: {
    verticesMm: Array<{ xMm: number; yMm: number }>;
  };
  stillActive: boolean;
}

export function initialShaftState(): ShaftState {
  return { phase: 'idle', verticesMm: [] };
}

export function reduceShaft(
  state: ShaftState,
  event: ShaftEvent,
): { state: ShaftState; effect: ShaftEffect };
```

Phase logic:
- `idle` + `click` → add first vertex, transition to `sketch`.
- `sketch` + `click` → add vertex (must have ≥ 3 vertices before allowing close).
- `sketch` + `close-loop` (when ≥ 3 vertices) → emit `commitShaft`, return to `idle`.
- `cancel` → return to `idle`, clear vertices.

---

## 4. `PlanCanvas.tsx` — dispatch new tools

### Wall Opening tool

In the pointer-down handler, add a case for `planTool === 'wall-opening'`:

- In `pick-wall` phase: on click, find the nearest wall within 12 px screen-space using `elementsById`. If found, call `reduceWallOpening({ kind: 'click-wall', wallId, pointMm })` and store state in a ref.
- In `define-rect` phase: on pointer-up (after a drag), call `reduceWallOpening({ kind: 'drag-end', cornerMm })`.

Draw a dashed rectangle preview during drag using a `THREE.LineLoop` in the plan group (similar to how the marquee selection rect works).

Handle `commitWallOpening` effect:
```ts
console.warn('stub: wall-opening command not implemented', effect.commitWallOpening);
```

### Shaft tool

In the pointer-down handler, add a case for `planTool === 'shaft'`:

- Each click adds a vertex: call `reduceShaft({ kind: 'click', pointMm })`.
- Double-click (or click within 12 px of the first vertex when ≥ 3 vertices): call `reduceShaft({ kind: 'close-loop' })`.
- While sketching, draw the in-progress polygon using a `THREE.Line` that follows the cursor.

Handle `commitShaft` effect:
```ts
console.warn('stub: shaft command not implemented', effect.commitShaft);
```

---

## 5. i18n

Add to `packages/web/src/i18n.ts` (in the same namespace as other tool labels):
```ts
'tool.wallOpening': 'Wall Opening',
'tool.shaft': 'Shaft',
```

---

## Key file locations

| Path | Role |
|---|---|
| `packages/web/src/tools/toolRegistry.ts` | Add `'wall-opening'`, `'shaft'` |
| `packages/web/src/tools/toolGrammar.ts` | `WallOpeningState`, `ShaftState`, reducers |
| `packages/web/src/plan/PlanCanvas.tsx` | Dispatch events + canvas sketching |
| `packages/web/src/tools/toolGrammar.test.ts` | Add reducer tests |

---

## Tests

Extend `packages/web/src/tools/toolGrammar.test.ts`:

```ts
describe('WallOpening reducer', () => {
  it('transitions to define-rect on click-wall', ...)
  it('emits commitWallOpening on drag-end', ...)
  it('returns to pick-wall after commit (tool stays active)', ...)
  it('resets to pick-wall on cancel', ...)
})

describe('Shaft reducer', () => {
  it('transitions to sketch on first click', ...)
  it('accumulates vertices on subsequent clicks', ...)
  it('emits commitShaft with ≥3 vertices on close-loop', ...)
  it('does not close with fewer than 3 vertices', ...)
})
```

---

## Constraints

- Do not add these tools to 3D or section modes.
- Stub all backend calls with `console.warn('stub: ... not implemented', payload)`.
- Do not change existing tool grammar reducers.
- `make verify` must pass.

---

## Commit format

```
feat(tools): WP-V2-04 — Wall Opening + Shaft tools

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
