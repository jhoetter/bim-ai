# Wave 11 — WP-C: Measure Angle + Arc Tools (§3.3.8)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — element types
packages/web/src/tools/toolRegistry.ts                   — ToolId union + registry
packages/web/src/tools/authoringCommandContract.ts       — AUTHORING_COMMAND_CONTRACTS
packages/web/src/cmdPalette/defaultCommands.ts           — palette entries
packages/web/src/tools/toolGrammar.ts                    — state machines
packages/web/src/plan/PlanCanvas.tsx                     — canvas click/hover handlers
packages/web/src/plan/planElementMeshBuilders.ts         — annotation renderers
packages/web/src/workspace/Workspace.tsx                 — HUD/readout display
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- Existing `measure` tool in `toolRegistry.ts` — find `'measure'` (hotkey MD, category query). Read its full registry entry. Also check `toolGrammar.ts` for an existing `MeasureState`/`reduceMeasure`.
- `angular_dimension` and `radial_dimension` — check if these element types in `core/index.ts` can be reused, or if measure results are purely ephemeral (HUD only, not persisted as elements).
- `PlanCanvas.tsx` — find the `'measure'` tool click handler. Understand how the distance result is currently displayed. Use the SAME HUD/readout pattern for angle/arc.
- Existing spot-elevation renderer or dimension renderer in `planElementMeshBuilders.ts` — angle/arc labels should use the same sprite/mesh approach.

---

## Tasks

### A — Tool registration (4-place rule)

Check `toolRegistry.ts` — `'measure-angle'` and `'measure-arc'` may not exist yet.

**toolRegistry.ts** — add if missing:
```ts
'measure-angle': {
  hotkey: 'MA',
  label: 'Measure Angle',
  mode: 'plan',
  category: 'query',
  surfaces: ['ribbon', 'cmd-k'],
},
'measure-arc': {
  hotkey: 'MR',
  label: 'Measure Arc',
  mode: 'plan',
  category: 'query',
  surfaces: ['ribbon', 'cmd-k'],
},
```

**authoringCommandContract.ts** — add both:
```ts
'measure-angle': { kind: 'sketch', completionBehavior: 'explicit-finish' },
'measure-arc':   { kind: 'sketch', completionBehavior: 'explicit-finish' },
```

**defaultCommands.ts** — add both:
```ts
registerCommand({ id: 'tool.measure-angle', label: 'Measure Angle', keywords: ['angle', 'measure', 'degrees'], category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'measure-angle') });
registerCommand({ id: 'tool.measure-arc',   label: 'Measure Arc',   keywords: ['arc', 'measure', 'radius', 'arc length'], category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'measure-arc') });
```

**toolGrammar.ts** — add two state machines:

```ts
// Measure Angle: 3-click (vertex + two ray ends), shows angle in degrees
type MeasureAngleStatus = 'idle' | 'picked-vertex' | 'picked-first-ray' | 'complete';
interface MeasureAngleState {
  status: MeasureAngleStatus;
  vertexMm: XY | null;
  firstRayMm: XY | null;
  secondRayMm: XY | null;
  angleDeg: number | null;
}
// Events: 'activate', 'click' ({positionMm}), 'cancel'
// On third click: compute angle between vectors (vertex→firstRay, vertex→secondRay), set angleDeg, status='complete'

// Measure Arc: 3-click (start point + end point + arc pass-through point), shows arc length + radius
type MeasureArcStatus = 'idle' | 'picked-start' | 'picked-end' | 'complete';
interface MeasureArcState {
  status: MeasureArcStatus;
  startMm: XY | null;
  endMm: XY | null;
  throughMm: XY | null;
  arcLengthMm: number | null;
  radiusMm: number | null;
}
// On third click: fit circle through 3 points, compute radius and arc length
```

### B — HUD readout

In `PlanCanvas.tsx` (or wherever the measure tool distance is shown), extend the readout:

- **Measure Angle**: when `status === 'complete'`, show `"∠ {angleDeg.toFixed(1)}°"` in the HUD/status overlay (`data-testid="measure-angle-readout"`)
- **Measure Arc**: when `status === 'complete'`, show `"Arc: {(arcLengthMm/1000).toFixed(3)} m  R: {(radiusMm/1000).toFixed(3)} m"` (`data-testid="measure-arc-readout"`)

For intermediate states, show a preview:
- Angle tool after second click: draw a preview arc between the two rays using `THREE.Line` (thin dashed arc)
- Arc tool after second click: draw a line between start and end

Read how the existing distance measure tool draws its preview line and use the same approach.

### C — Canvas wiring

In `PlanCanvas.tsx`, in the tool click handler switch:

```ts
case 'measure-angle':
  setMeasureAngleState(prev => reduceMeasureAngle(prev, { type: 'click', positionMm: snappedMm }));
  break;
case 'measure-arc':
  setMeasureArcState(prev => reduceMeasureArc(prev, { type: 'click', positionMm: snappedMm }));
  break;
```

Escape key → dispatch `'cancel'` event to the active measure state (same as existing measure tool).

### D — Pure math helpers

Create `packages/web/src/plan/measureGeometry.ts`:

```ts
/** Angle in degrees between two vectors from origin. Always 0–180. */
export function angleBetweenVectors(a: XY, b: XY): number

/** Fit a circle through three points; returns { centerMm, radiusMm } or null if collinear. */
export function fitCircleThrough3(p1: XY, p2: XY, p3: XY): { centerMm: XY; radiusMm: number } | null

/** Arc length along the fitted circle from p1 to p2 passing through p3. */
export function arcLengthThrough3(p1: XY, p2: XY, p3: XY): number | null
```

### E — Tests

Write `packages/web/src/plan/measureGeometry.test.ts`:
```ts
describe('measureGeometry — §3.3.8', () => {
  it('angleBetweenVectors returns 90° for perpendicular vectors', () => { ... });
  it('angleBetweenVectors returns 0° for parallel vectors', () => { ... });
  it('angleBetweenVectors returns 180° for antiparallel vectors', () => { ... });
  it('fitCircleThrough3 returns correct radius for known circle', () => { ... });
  it('fitCircleThrough3 returns null for collinear points', () => { ... });
  it('arcLengthThrough3 returns correct arc length for semicircle', () => { ... });
});
```

Write `packages/web/src/tools/measureAngle.test.ts`:
```ts
describe('measure angle grammar — §3.3.8', () => {
  it('activate transitions to idle', () => { ... });
  it('first click sets vertexMm and status=picked-vertex', () => { ... });
  it('second click sets firstRayMm and status=picked-first-ray', () => { ... });
  it('third click computes angleDeg and status=complete', () => { ... });
  it('cancel resets to idle', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave11/C): measure angle + arc tools with geometry helpers (§3.3.8)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
