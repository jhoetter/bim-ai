# Wave 19 — WP-A: Stair by Component — Wire Element Types + Inspector + Workspace (§8.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-B added grammar functions to `toolGrammar.ts`:

- `StairRunState`, `reduceStairRun`, `initialStairRunState`
- `StairLandingState`, `reduceStairLanding`, `initialStairLandingState`
- Test file `packages/web/src/plan/stairByComponent.test.ts` (8 tests — all pass)

**Still missing:**

- `stair_run` and `stair_landing` element types in `core/index.ts`
- Command types for `addStairRun`, `addStairLanding`, `removeStairComponent`
- `Workspace.tsx` handlers for these commands
- Inspector panels for `stair_run` and `stair_landing`
- Tool registration in `toolRegistry.ts` and `defaultCommands.ts` + `commandCapabilities.ts`
- `PlanCanvas.tsx` wiring for `stair-run` and `stair-landing` tools

---

## Repo orientation

```
packages/core/src/index.ts
packages/web/src/tools/toolRegistry.ts
packages/web/src/tools/toolGrammar.ts        — StairRunState, reduceStairRun already here
packages/web/src/plan/PlanCanvas.tsx
packages/web/src/workspace/Workspace.tsx
packages/web/src/workspace/inspector/InspectorContent.tsx
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `toolGrammar.ts` near the end for the existing grammar types. Read `PlanCanvas.tsx` for how an existing tool (e.g., `ramp`) is wired — follow that exact pattern.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Element types in `core/index.ts`

Add if not present:

```ts
| {
    kind: 'stair_run';
    id: string;
    stairId: string;
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
    runWidthMm: number;
    riserCount: number;
    runIndex: number;
    levelId?: string | null;
  }
| {
    kind: 'stair_landing';
    id: string;
    stairId: string;
    perimeterMm: { xMm: number; yMm: number }[];
    elevationMm: number;
    landingIndex: number;
    levelId?: string | null;
  }
```

Add command types:

```ts
| { type: 'addStairRun'; run: Extract<Element, { kind: 'stair_run' }> }
| { type: 'addStairLanding'; landing: Extract<Element, { kind: 'stair_landing' }> }
| { type: 'removeStairComponent'; componentId: string }
```

---

### B — Tool registration in `toolRegistry.ts`

Add if not present:

```ts
{ id: 'stair-run', hotkey: 'SR', label: 'Add Stair Run', mode: 'plan' }
{ id: 'stair-landing', hotkey: 'SL2', label: 'Add Stair Landing', mode: 'plan' }
```

(Use `SL2` to avoid collision with existing `SL` hotkey if needed.)
Add both to `PALETTE_ORDER` near the stair tool.

---

### C — `PlanCanvas.tsx` wiring

Follow the pattern of an existing two-point tool (e.g., the ramp or beam tool). For `stair-run`:

```ts
// In the tool-specific click handler switch/if:
case 'stair-run': {
  const { state: next, effect } = reduceStairRun(stairRunState, { kind: 'click', pointMm: planMm, elementId: hoveredId });
  setStairRunState(next);
  if (effect?.kind === 'addStairRun') {
    void onSemanticCommand({ type: 'addStairRun', run: { ...effect.run, id: crypto.randomUUID(), kind: 'stair_run' } });
  }
  break;
}
```

For `stair-landing` (polygon sketch):

```ts
case 'stair-landing': {
  const { state: next, effect } = reduceStairLanding(stairLandingState, { kind: 'click', pointMm: planMm, elementId: hoveredId });
  setStairLandingState(next);
  if (effect?.kind === 'addStairLanding') {
    void onSemanticCommand({ type: 'addStairLanding', landing: { ...effect.landing, id: crypto.randomUUID(), kind: 'stair_landing' } });
  }
  break;
}
```

Wire `Enter` key → `{ kind: 'enter' }` for stair-landing.
Wire `Escape` → `{ kind: 'escape' }` for both tools.
Wire `activate`/`deactivate` on tool change.

---

### D — `Workspace.tsx` handlers

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

### E — Inspector panels in `InspectorContent.tsx`

`case 'stair_run':`:

```tsx
case 'stair_run': {
  const el = selectedElement as Extract<Element, { kind: 'stair_run' }>;
  return (
    <div>
      <label>Run Width (mm)
        <input type="number" data-testid="inspector-stair-run-width"
          value={el.runWidthMm}
          onChange={e => onPropertyChange('runWidthMm', +e.target.value)} />
      </label>
      <label>Riser Count
        <input type="number" data-testid="inspector-stair-run-risers"
          value={el.riserCount}
          onChange={e => onPropertyChange('riserCount', +e.target.value)} />
      </label>
      <span data-testid="inspector-stair-run-index">Run {el.runIndex + 1}</span>
    </div>
  );
}
```

`case 'stair_landing':`:

```tsx
case 'stair_landing': {
  const el = selectedElement as Extract<Element, { kind: 'stair_landing' }>;
  return (
    <div>
      <label>Elevation (mm)
        <input type="number" data-testid="inspector-stair-landing-elevation"
          value={el.elevationMm}
          onChange={e => onPropertyChange('elevationMm', +e.target.value)} />
      </label>
      <span data-testid="inspector-stair-landing-points">{el.perimeterMm.length} boundary points</span>
    </div>
  );
}
```

---

### F — Palette commands + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'tool.stair-run', label: 'Add Stair Run',
  keywords: ['stair', 'run', 'component', 'step'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'stair-run') }
{ id: 'tool.stair-landing', label: 'Add Stair Landing',
  keywords: ['stair', 'landing', 'component', 'platform'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'stair-landing') }
```

In `commandCapabilities.ts`:

```ts
{ id: 'tool.stair-run', scope: 'document', intendedModes: ['plan'], precondition: null },
{ id: 'tool.stair-landing', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### G — Tests

`packages/web/src/workspace/inspector/stairComponentInspector.test.tsx`:

```tsx
describe('stair_run inspector — §8.6.2', () => {
  it('renders run width input', () => { ... });
  it('renders riser count input', () => { ... });
  it('run index label is shown', () => { ... });
});

describe('stair_landing inspector — §8.6.2', () => {
  it('renders elevation input', () => { ... });
  it('renders boundary points count', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/A): stair by component — element types + Workspace handlers + inspector + PlanCanvas wiring (§8.6.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
