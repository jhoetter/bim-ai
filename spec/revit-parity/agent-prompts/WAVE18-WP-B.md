# Wave 18 — WP-B: Stair by Component — Individual Run/Landing Assembly (§8.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                            — stair element type (read it fully)
packages/web/src/tools/toolGrammar.ts                 — stair grammar (StairState, reduceStair)
packages/web/src/tools/toolRegistry.ts                — ToolId union
packages/web/src/plan/PlanCanvas.tsx                  — click/keyboard dispatch
packages/web/src/viewport/meshBuilders.multiRunStair.ts — stair 3D mesh
packages/web/src/workspace/inspector/InspectorContent.tsx — stair inspector
```

Search for `stair`, `StairState`, `reduceStair`, `stair_run`, `stair_landing`, `StairByComponent` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: read the full `stair` element type — all fields, `runs[]`, `riserCount`, `runWidthMm`, `landingDepthMm`, `multiStorey`.
2. `toolGrammar.ts`: find all stair grammars — read them in full.
3. `toolRegistry.ts`: find `'stair'` and any `'stair-run'` or `'stair-landing'` entries.
4. `meshBuilders.multiRunStair.ts`: read fully — how are `runs[]` used to build the 3D mesh?
5. `InspectorContent.tsx` case `'stair':`: read all inspector fields.

---

## Tasks

The goal is to promote stair-by-component from Partial to Done:
- Users can add individual run segments and landings to an existing stair
- Each run has independent start/end position, riser count, and run width
- Landings connect runs

### A — `stair_run` and `stair_landing` element types in `core/index.ts`

Add if not present:

```ts
| {
    kind: 'stair_run';
    id: string;
    /** Parent stair this run belongs to. */
    stairId: string;
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
    runWidthMm: number;
    riserCount: number;
    /** Run index in stair (0-based). */
    runIndex: number;
  }
| {
    kind: 'stair_landing';
    id: string;
    /** Parent stair this landing belongs to. */
    stairId: string;
    /** Polygon corners of the landing slab. */
    perimeterMm: { xMm: number; yMm: number }[];
    /** Absolute elevation of the landing top surface. */
    elevationMm: number;
    /** Landing index (0-based). */
    landingIndex: number;
  }
```

Add command types:
```ts
| { type: 'addStairRun'; run: Extract<Element, { kind: 'stair_run' }> }
| { type: 'addStairLanding'; landing: Extract<Element, { kind: 'stair_landing' }> }
| { type: 'removeStairComponent'; componentId: string }
```

---

### B — Tool registration

In `toolRegistry.ts`, add:
```ts
{ id: 'stair-run', hotkey: 'SR', label: 'Add Stair Run', mode: 'plan' }
{ id: 'stair-landing', hotkey: 'SL', label: 'Add Stair Landing', mode: 'plan' }
```
Add both to `PALETTE_ORDER` near the stair tool.

---

### C — `reduceStairRun` grammar in `toolGrammar.ts`

```ts
type StairRunState =
  | { phase: 'idle' }
  | { phase: 'pick-stair' }
  | { phase: 'place-start'; stairId: string }
  | { phase: 'place-end'; stairId: string; startMm: { xMm: number; yMm: number } };

type StairRunEffect =
  | { kind: 'addStairRun'; run: { stairId: string; startMm: { xMm: number; yMm: number }; endMm: { xMm: number; yMm: number }; runWidthMm: number; riserCount: number; runIndex: number } };

export function initialStairRunState(): StairRunState { return { phase: 'idle' }; }

export function reduceStairRun(
  state: StairRunState,
  event: ToolEvent,
): { state: StairRunState; effect?: StairRunEffect } {
  // activate → pick-stair
  // click (pick-stair) → place-start with stairId from picked element
  // click (place-start) → place-end with startMm
  // click (place-end) → emit addStairRun effect, return to idle
  // Escape → idle
}
```

`StairRunState`, `reduceStairRun`, `initialStairRunState` must be exported.

---

### D — `reduceStairLanding` grammar in `toolGrammar.ts`

```ts
type StairLandingState =
  | { phase: 'idle' }
  | { phase: 'pick-stair' }
  | { phase: 'sketching'; stairId: string; points: { xMm: number; yMm: number }[] };

type StairLandingEffect =
  | { kind: 'addStairLanding'; landing: { stairId: string; perimeterMm: { xMm: number; yMm: number }[]; elevationMm: number; landingIndex: number } };
```

- Click adds points to perimeter
- Enter with ≥3 points → emit addStairLanding
- Escape → idle

`StairLandingState`, `reduceStairLanding`, `initialStairLandingState` must be exported.

---

### E — `PlanCanvas.tsx` wiring

Wire both grammars following existing tool patterns. On `addStairRun` effect, dispatch `onSemanticCommand({ type: 'addStairRun', run: { ...effect.run, id: crypto.randomUUID(), kind: 'stair_run' } })`. On `addStairLanding` effect, dispatch `onSemanticCommand({ type: 'addStairLanding', landing: { ...effect.landing, id: crypto.randomUUID(), kind: 'stair_landing' } })`.

---

### F — `Workspace.tsx` handlers

Handle `addStairRun` and `addStairLanding`:
```ts
case 'addStairRun':
  elementsById[cmd.run.id] = cmd.run;
  break;
case 'addStairLanding':
  elementsById[cmd.landing.id] = cmd.landing;
  break;
case 'removeStairComponent':
  delete elementsById[cmd.componentId];
  break;
```

---

### G — Inspector panels

In `InspectorContent.tsx`:

`case 'stair_run':`:
```tsx
<div>
  <span data-testid="inspector-stair-run-count">Risers: {el.riserCount}</span>
  <input type="number" data-testid="inspector-stair-run-width"
    value={el.runWidthMm}
    onChange={e => onPropertyChange('runWidthMm', +e.target.value)} />
  <input type="number" data-testid="inspector-stair-run-risers"
    value={el.riserCount}
    onChange={e => onPropertyChange('riserCount', +e.target.value)} />
</div>
```

`case 'stair_landing':`:
```tsx
<div>
  <span data-testid="inspector-stair-landing-elevation">Elevation: {el.elevationMm} mm</span>
  <span data-testid="inspector-stair-landing-points">{el.perimeterMm.length} points</span>
</div>
```

---

### H — Palette commands + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'tool.stair-run', label: 'Add Stair Run', keywords: ['stair', 'run', 'component'], category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'stair-run') }
{ id: 'tool.stair-landing', label: 'Add Stair Landing', keywords: ['stair', 'landing', 'component'], category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'stair-landing') }
```

In `commandCapabilities.ts`:
```ts
{ id: 'tool.stair-run', scope: 'document', intendedModes: ['plan'], precondition: null },
{ id: 'tool.stair-landing', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### I — Tests

`packages/web/src/plan/stairByComponent.test.ts`:

```ts
describe('reduceStairRun — §8.6.2', () => {
  it('starts in idle state', () => { ... });
  it('activate moves to pick-stair', () => { ... });
  it('two clicks after picking stair emit addStairRun', () => { ... });
  it('Escape from place-start returns to idle', () => { ... });
});

describe('reduceStairLanding — §8.6.2', () => {
  it('starts in idle state', () => { ... });
  it('sketching accumulates points', () => { ... });
  it('Enter with 3+ points emits addStairLanding', () => { ... });
  it('Enter with fewer than 3 points does nothing', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/B): stair by component — stair_run + stair_landing element types + grammars (§8.6.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new stair-by-component tests.
