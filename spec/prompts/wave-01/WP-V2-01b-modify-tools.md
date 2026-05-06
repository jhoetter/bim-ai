# WP-V2-01b — Modify Tools + Selection Direction

**Branch:** `feat/wp-v2-01b-modify-tools`
**Wave:** 1, Batch B — start ONLY after WP-V2-01a (`feat/wp-v2-01a-options-bar`) is merged to main.
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-01b → `done` when merged.

---

## Context

BIM AI is a browser-first BIM authoring tool. Stack: React 19 + Vite + TypeScript, Tailwind, Zustand, Three.js. Repo is a pnpm workspace; web package is `packages/web/`.

This workpackage pulls `main` first (which contains the WP-V2-01a Options Bar). It then adds three Revit-standard modify tools and wires crossing-selection direction.

The tool system:
- `packages/web/src/tools/toolRegistry.ts` — `ToolId` type union + `getToolRegistry()` map.
- `packages/web/src/tools/toolGrammar.ts` — per-tool grammar types + pure reducer functions.
- `packages/web/src/tools/toolGrammar.test.ts` — existing tests; extend, don't break.
- `packages/web/src/plan/PlanCanvas.tsx` — dispatches tool events; handles pointer events.
- `packages/web/src/plan/planCanvasState.ts` — `classifyPointerStart`, `PointerIntent` (already includes `'marquee-window'` and `'marquee-crossing'`).

---

## What to build

### 1. Three new tools in `toolRegistry.ts`

Add three entries to the `ToolId` union and the `getToolRegistry` map:

```ts
'align' | 'split' | 'trim'
```

For each:

| ToolId | Label | Icon | Hotkey | Modes |
|---|---|---|---|---|
| `align` | Align | `align` (lucide) | `AL` (two-key sequence: A then L) | `plan` only |
| `split` | Split Element | `scissors` | `SD` (two-key: S then D) | `plan` only |
| `trim` | Trim / Extend | `trim` or `git-merge` | `TR` (two-key: T then R) | `plan` only |

Two-key hotkeys: Revit uses two-letter shortcuts (AL, SD, TR). Implement as a sequential key listener: first keypress sets a pending prefix; second keypress within 1500 ms completes the hotkey. If it exists, add the two-key handler to `packages/web/src/state/modeController.ts` or wherever global hotkeys live. If that adds significant complexity, implement as single-key `A` (align), `S` (split), `T` (trim) for now and note the two-key improvement as a follow-up.

Add the tools to the **Modify section** of the ToolPalette — they should appear as a group after a separator, below the drawing tools (Wall/Door/Window/etc). Look at `ToolPalette.tsx` to see how to add a section separator.

### 2. Grammar types + reducers in `toolGrammar.ts`

#### Align tool

Revit: click reference edge → click element to move → element snaps to reference.

```ts
export interface AlignState {
  phase: 'pick-reference' | 'pick-element';
  referenceMm: { xMm: number; yMm: number } | null;
}

export type AlignEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface AlignEffect {
  commitAlign?: {
    referenceMm: { xMm: number; yMm: number };
    targetMm: { xMm: number; yMm: number };
  };
  stillActive: boolean;
}

export function reduceAlign(state: AlignState, event: AlignEvent): { state: AlignState; effect: AlignEffect }
```

Phase logic:
- `pick-reference` + `click` → store point, transition to `pick-element`.
- `pick-element` + `click` → emit `commitAlign` effect, return to `pick-reference` (stays active, ready for next pair).
- Any `cancel` → return to `pick-reference`, clear reference.

The canvas handles `commitAlign` by finding the nearest element endpoint/edge to `targetMm` and snapping it to `referenceMm` via an `updateElementProperty` API call. (Stub the API call with a `console.log` if the command doesn't exist yet; the grammar reducer is the deliverable.)

#### Split tool

Revit: click on a wall to split it at the cursor position into two walls.

```ts
export interface SplitState { active: boolean }

export type SplitEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface SplitEffect {
  commitSplit?: { pointMm: { xMm: number; yMm: number } };
  stillActive: boolean;
}

export function reduceSplit(state: SplitState, event: SplitEvent): { state: SplitState; effect: SplitEffect }
```

The canvas handles `commitSplit` by finding the wall closest to `pointMm`, computing the parameter `t` along that wall, and firing a `splitWall` command (stub if not yet in the backend). The tool remains active after each click (Revit split stays in Split mode until Esc).

#### Trim/Extend tool

Revit: click a reference line → click a segment to trim/extend it to meet the reference.

```ts
export interface TrimState {
  phase: 'pick-reference' | 'pick-target';
  referenceId: string | null;
}

export type TrimEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click-reference'; elementId: string }
  | { kind: 'click-target'; elementId: string; endHint: 'start' | 'end' }
  | { kind: 'cancel' };

export interface TrimEffect {
  commitTrim?: { referenceId: string; targetId: string; endHint: 'start' | 'end' };
  stillActive: boolean;
}

export function reduceTrim(state: TrimState, event: TrimEvent): { state: TrimState; effect: TrimEffect }
```

The canvas sends `click-reference` on the first click (stores the element ID), and `click-target` on the second click with an `endHint` derived from which endpoint is closer to the cursor. The effect is handled by extending the target wall's endpoint to the intersection with the reference (stub API call if needed).

### 3. `PlanCanvas.tsx` — dispatch new tools + crossing selection

#### Dispatch Align / Split / Trim events

In the pointer-down / pointer-up / click handler, add cases for the three new `planTool` values. For each:
- Align: on click, call `reduceAlign` and handle the effect.
- Split: on click, call `reduceSplit` and handle the effect.
- Trim: on first click, resolve the hovered element → send `click-reference`; on second click → send `click-target`.

Use `elementsById` already in scope to find the nearest element.

#### Crossing vs window selection

`classifyPointerStart` already returns `'marquee-window'` or `'marquee-crossing'` based on `dragDirection`. The PlanCanvas marquee logic currently always selects enclosed elements. After this WP:

- On pointer-down with `activeTool === 'select'` and `intent === undefined` (not yet dragging), start tracking drag direction.
- On pointer-move: compute `dragDirection = startX < currentX ? 'left-to-right' : 'right-to-left'`.
- On pointer-up: if `dragDirection === 'left-to-right'` → window selection (enclosed only); if `'right-to-left'` → crossing selection (any element whose bounding box intersects the marquee rect).
- The marquee box should visually differ: solid border for window, dashed border for crossing. Use a Three.js `LineLoop` with `LineDashedMaterial` for crossing.

---

## Tests

Extend `packages/web/src/tools/toolGrammar.test.ts`:

```ts
describe('Align reducer', () => {
  it('transitions pick-reference → pick-element on first click', ...)
  it('emits commitAlign on second click', ...)
  it('resets to pick-reference on cancel', ...)
})

describe('Split reducer', () => {
  it('emits commitSplit on click while active', ...)
  it('stays active after a split', ...)
})

describe('Trim reducer', () => {
  it('stores referenceId on click-reference', ...)
  it('emits commitTrim on click-target', ...)
})
```

---

## Constraints

- Do not add tools to modes other than `plan` (no 3D or section mode).
- Do not change the ToolId ordering in `getToolRegistry` — append at end.
- Stub API calls for `splitWall`, `alignElement`, `trimElement` if backend commands don't exist — log a `console.warn('stub: command not implemented')` with the payload.
- Tokens only for colours.
- `make verify` must pass.

---

## Commit format

```
feat(tools): WP-V2-01b — Align / Split / Trim tools + crossing selection marquee

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
