# Wave 13 — WP-G: Model Lines Tool in Project Environment (§7.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — element union, ElemKind
packages/web/src/tools/toolRegistry.ts                   — ToolId union + registry
packages/web/src/tools/authoringCommandContract.ts       — tool contracts
packages/web/src/tools/toolGrammar.ts                    — grammar state machines
packages/web/src/plan/PlanCanvas.tsx                     — click/double-click/escape handlers
packages/web/src/plan/planElementMeshBuilders.ts         — plan symbol renderer
packages/web/src/viewport/meshBuilders.ts                — 3D mesh builder
packages/web/src/cmdPalette/defaultCommands.ts           — palette tool commands
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — search for `'model_line'` or `model_line`. If a `model_line` kind already exists, read it and do NOT add it again. Also check if `'model-line'` is in the `ToolId` union.
- `toolRegistry.ts` — search for `'model-line'`. If it exists, read its entry. If not, add it.
- `detail_line` element in `core/index.ts` — read its full type (`pointsMm`, `strokeMm`, `colour`, `hostViewId`). `model_line` is the project-environment equivalent — visible in all plan views, not restricted to one `hostViewId`.
- `toolGrammar.ts` — find how `reduceDetailLine` (or similar polyline-sketch grammar) is implemented. The `ModelLineState` grammar should be identical in structure — reuse the same pattern (idle → first-click starts line, subsequent clicks extend, Enter or double-click commits).
- `PlanCanvas.tsx` — find the `detail-line` tool click handler. Read it end-to-end. The `model-line` handler follows the same structure.
- `planElementMeshBuilders.ts` — find the `detail_line` plan renderer. The `model_line` renderer uses the same approach.

**4-place rule**: `model-line` must be added in ALL four files: `toolRegistry.ts`, `authoringCommandContract.ts`, `defaultCommands.ts`, `toolGrammar.ts`.

---

## Tasks

### A — Core type: model_line element

In `core/index.ts`, add (only if NOT present):

```ts
export type ModelLineElement = {
  kind: 'model_line';
  id: string;
  name?: string;
  /** Polyline vertices in plan millimetres (world coords — not view-local). */
  pointsMm: { xMm: number; yMm: number }[];
  levelId: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | null;
  colourHex?: string | null;
  strokeMm?: number | null;
};
```

Add `'model_line'` to the `Element` union and to `ElemKind`.

Add command type:

```ts
export type CreateModelLineCmd = {
  type: 'create_model_line';
  id: string;
  levelId: string;
  pointsMm: { xMm: number; yMm: number }[];
  lineStyle?: 'solid' | 'dashed' | 'dotted' | null;
  colourHex?: string | null;
};
```

### B — Tool registration (4 places)

**`toolRegistry.ts`** — add `'model-line'` to `ToolId` union and to the registry object:

```ts
'model-line': {
  id: 'model-line',
  label: 'Model Line',
  hotkey: 'ML',
  mode: 'plan',
  category: 'annotate',
},
```

**`authoringCommandContract.ts`** — add:

```ts
'model-line': { kind: 'create', completionBehavior: 'stay-active' },
```

**`defaultCommands.ts`** — add:

```ts
registerCommand({
  id: 'tool.model-line',
  label: 'Model Line',
  keywords: ['model line', 'construction line', 'sketch', 'ML'],
  category: 'tool',
  invoke: (ctx) => ctx.setActiveTool?.('model-line'),
});
```

**`toolGrammar.ts`** — add `ModelLineState`, `reduceModelLine`, `initialModelLineState` following the exact same structure as the `detail_line` (or similar polyline tool). Events: `activate`, `deactivate`, `click` (appends point), `double-click` or `enter` (commits with `commitModelLine` effect), `escape` (cancels). The state tracks `pointsMm: { xMm; yMm }[]`.

### C — PlanCanvas wiring

In `PlanCanvas.tsx`, wire the `model-line` tool:

1. Add `modelLineStateRef = useRef(initialModelLineState)`
2. In the click handler block, add a `model-line` case that dispatches `{ type: 'click', point }` to `reduceModelLine`, mutates `modelLineStateRef.current`, and handles `commitModelLine` effect by dispatching `create_model_line`.
3. In the double-click / Enter key handler: trigger commit for `model-line`.
4. In the Escape handler: reset `modelLineStateRef.current = initialModelLineState`.
5. Add a `model-line-preview` polyline overlay showing the in-progress line (current points + cursor position) — use the same mechanism as `detail-line` preview if it exists.

Read the `detail-line` wiring in `PlanCanvas.tsx` carefully and copy the exact structure.

### D — Plan renderer

In `planElementMeshBuilders.ts`, add a renderer for `model_line`:

```ts
export function modelLinePlanThree(el: Extract<Element, { kind: 'model_line' }>): THREE.Object3D;
```

- Build a `THREE.LineSegments` from consecutive pairs of `pointsMm` (or a `THREE.Line` from the full array)
- Line color: `el.colourHex ?? '#333333'`
- Line style: `solid` (default) / `dashed` / `dotted` — use `THREE.LineDashedMaterial` for dashed/dotted
- Tag with `userData.elementId = el.id` and `userData.kind = 'model_line'`

Register in whichever switch/map dispatches plan mesh building by element kind.

### E — 3D renderer

In `meshBuilders.ts` (3D), add a builder for `model_line`:

```ts
export function modelLineThree(
  el: Extract<Element, { kind: 'model_line' }>,
  levelElevationMm: number,
): THREE.Object3D;
```

Build a `THREE.LineSegments` placed at Y = `levelElevationMm / PLAN_SCALE` (the level elevation in 3D world space). Each point: `{ x: xMm / PLAN_SCALE, y: levelElevationMm / PLAN_SCALE, z: -yMm / PLAN_SCALE }` (standard bim-ai coordinate transform — verify against how other 3D elements are positioned).

### F — Tests

Write `packages/web/src/tools/modelLine.test.ts`:

```ts
describe('model line grammar — §7.1.1', () => {
  it('idle state, click starts line at first point', () => { ... });
  it('second click extends line to two points', () => { ... });
  it('enter fires commitModelLine effect with collected points', () => { ... });
  it('escape resets to idle', () => { ... });
  it('commitModelLine includes all clicked points', () => { ... });
});
```

Write `packages/web/src/plan/modelLinePlan.test.ts`:

```ts
describe('modelLinePlanThree — §7.1.1', () => {
  it('returns a THREE.Object3D', () => { ... });
  it('has userData.kind = model_line', () => { ... });
  it('uses custom colourHex when set', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave13/G): model lines tool in project environment (§7.1.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
