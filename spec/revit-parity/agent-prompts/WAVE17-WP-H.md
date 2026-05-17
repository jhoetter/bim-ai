# Wave 17 — WP-H: Stair by Sketch Improvements (§8.6.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/StairBySketchCanvas.tsx      — stair by sketch canvas (may exist)
packages/web/src/tools/toolGrammar.ts              — stair tool grammar
packages/web/src/plan/stairMultiRunDetector.ts     — multi-run shape detection (wave 16 WP-F, may exist)
packages/core/src/index.ts                          — stair element type
packages/web/src/viewport/meshBuilders.multiRunStair.ts — stair mesh builder
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector
```

Search for `StairBySketch`, `stairBySketch`, `stair.*sketch`, `stairSketch`, `multi.*run.*stair`, `stairMultiRun` in the codebase first. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `StairBySketchCanvas.tsx` (if exists): read fully — what grammar/modes does it support?
2. `toolGrammar.ts`: find all stair-related grammars. Read them fully.
3. `stairMultiRunDetector.ts` (if exists from wave 16 WP-F): read fully — how does it detect L/U shape?
4. `core/index.ts`: read the full stair element type — all fields, especially `runs`, `runWidthMm`, `landingDepthMm`, `riserCount`.
5. `meshBuilders.multiRunStair.ts` (if exists): read fully — how does it build multi-run stairs?

---

## Tasks

The goal is to push stair-by-sketch from "Partial" to "Done" by covering the 3 main configurations: straight, L-shape, and U-shape.

### A — Stair sketch grammar (in `toolGrammar.ts` or `StairBySketchCanvas.tsx`)

Ensure the stair-by-sketch grammar supports all 3 sketch modes:

**Straight stair (2-point: start + end)**:
- User clicks start point, then end point
- Direction = angle from start to end
- `riserCount` = auto-computed from `totalHeightMm` / `riserHeightMm` (default: level height / 175)

**L-shape stair (3-point: start, corner, end)**:
- User clicks start, then an intermediate corner, then end
- Angle between segments ≈ 90° → creates `runs: [run1, run2]` with a landing at the corner
- If angle < 45° or > 135°, treat as straight (connect collinearly)

**U-shape stair (3-point: start, midpoint, end)**:
- User clicks start, mid, end where mid is ~perpendicular to the start-end axis
- The two runs are parallel, with a landing connecting them at the top of the first run

Implementation approach — add to grammar:

```ts
type StairSketchState =
  | { phase: 'idle' }
  | { phase: 'placing-start' }
  | { phase: 'placing-corner'; startMm: { xMm: number; yMm: number } }
  | { phase: 'placing-end';
      startMm: { xMm: number; yMm: number };
      cornerMm: { xMm: number; yMm: number } };

// On second click (cornerMm): determine if this is 2-point-done or 3-point mode
// by checking if user pressed Shift (L-shape intent) or we wait for a 3rd click.
// Default: wait for 3rd click with a 5s timeout, then commit as straight on timeout.

type StairSketchEffect =
  | { kind: 'createStair'; stair: Extract<Element, { kind: 'stair' }> }
```

---

### B — `classifyStairShape` in `stairMultiRunDetector.ts`

Ensure `stairMultiRunDetector.ts` has (create or extend):

```ts
export type StairShape = 'straight' | 'l_shape' | 'u_shape';

export function classifyStairShape(
  startMm: { xMm: number; yMm: number },
  cornerMm: { xMm: number; yMm: number },
  endMm: { xMm: number; yMm: number }
): StairShape {
  // Angle at the corner between the two segments
  const v1 = { xMm: startMm.xMm - cornerMm.xMm, yMm: startMm.yMm - cornerMm.yMm };
  const v2 = { xMm: endMm.xMm - cornerMm.xMm, yMm: endMm.yMm - cornerMm.yMm };
  const dot = v1.xMm * v2.xMm + v1.yMm * v2.yMm;
  const mag = Math.hypot(v1.xMm, v1.yMm) * Math.hypot(v2.xMm, v2.yMm);
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot / (mag || 1)))) * (180 / Math.PI);

  // U-shape: angle ~180° (runs back parallel) — actually means turn ~180° at corner
  if (angleDeg > 150) return 'u_shape';
  // L-shape: angle ~90° (turn 90° at corner)
  if (angleDeg > 45) return 'l_shape';
  // Straight: nearly collinear
  return 'straight';
}

export type MultiRunStairConfig = {
  shape: StairShape;
  runs: { startMm: { xMm: number; yMm: number }; endMm: { xMm: number; yMm: number }; riserCount: number }[];
  landingMm?: { xMm: number; yMm: number }[];
};

export function buildMultiRunStairConfig(
  startMm: { xMm: number; yMm: number },
  cornerMm: { xMm: number; yMm: number },
  endMm: { xMm: number; yMm: number },
  totalRiserCount: number
): MultiRunStairConfig {
  const shape = classifyStairShape(startMm, cornerMm, endMm);
  const half = Math.floor(totalRiserCount / 2);

  if (shape === 'straight') {
    return { shape, runs: [{ startMm, endMm, riserCount: totalRiserCount }] };
  }

  return {
    shape,
    runs: [
      { startMm, endMm: cornerMm, riserCount: half },
      { startMm: cornerMm, endMm, riserCount: totalRiserCount - half },
    ],
    landingMm: [cornerMm], // landing polygon centred at corner
  };
}
```

---

### C — Stair element `runs` field

Ensure the `stair` element type in `core/index.ts` has a `runs` field (add if missing):

```ts
runs?: Array<{
  direction?: 'north' | 'south' | 'east' | 'west' | 'custom';
  riserCount: number;
  startMm?: { xMm: number; yMm: number };
  endMm?: { xMm: number; yMm: number };
}>;
```

---

### D — `StairBySketchCanvas.tsx` wiring

If `StairBySketchCanvas.tsx` exists, update it to use `buildMultiRunStairConfig` when 3 points are placed.

If it doesn't exist, or if stair sketch is handled in `toolGrammar.ts` + `PlanCanvas.tsx`, ensure the 3-point sketch path is wired:
- 1st click: `startMm`
- 2nd click: `cornerMm` (show a preview run to corner)
- 3rd click: `endMm` → call `buildMultiRunStairConfig`, emit `createStair` with `runs` field set

---

### E — Preview rendering

In the plan canvas, while in `placing-end` phase, draw a preview:
- Dashed line from `startMm` to `cornerMm` to current cursor
- Small rectangle at `cornerMm` to indicate landing

---

### F — Inspector improvements

Ensure the stair inspector (in `InspectorContent.tsx`, `case 'stair':`) shows:

```tsx
{/* Show multi-run shape if runs are defined */}
{el.runs && el.runs.length > 1 && (
  <div data-testid="inspector-stair-shape">
    {el.runs.length === 2 ? 'L-shape / U-shape' : `${el.runs.length}-run`} stair
  </div>
)}
{/* Show run count */}
<span data-testid="inspector-stair-run-count">{el.runs?.length ?? 1} run(s)</span>
```

---

### G — Tests

`packages/web/src/plan/stairMultiRunDetector.test.ts` (create or extend):
```ts
describe('classifyStairShape — §8.6.3', () => {
  it('classifies collinear 3 points as straight', () => { ... });
  it('classifies 90° turn as l_shape', () => { ... });
  it('classifies 180° turn as u_shape', () => { ... });
});

describe('buildMultiRunStairConfig — §8.6.3', () => {
  it('straight shape has one run', () => { ... });
  it('l_shape has two runs with landing at corner', () => { ... });
  it('u_shape has two runs', () => { ... });
  it('total riser count is distributed across runs', () => { ... });
});
```

`packages/web/src/plan/stairBySketch.test.ts`:
```ts
describe('stair by sketch grammar — §8.6.3', () => {
  it('two clicks creates straight stair', () => { ... });
  it('three clicks with 90° turn creates l_shape stair', () => { ... });
  it('Escape resets to idle', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/H): stair by sketch — straight/L/U shape detection + multi-run config (§8.6.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new stair by sketch tests.
