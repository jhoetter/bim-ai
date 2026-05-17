# Wave 20 — WP-C: Options Bar — Roof, Ramp, Railing Tool Options (§1.6.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

`packages/web/src/workspace/authoring/OptionsBar.tsx` renders a per-tool options bar below the ribbon. It already has options for: wall (location line, chain, offset, radius), floor (type, level, offset), stair (base/top level, width), column (level, height), ramp-start, mirror, copy, and others.

**Missing:** options bar content for `roof`, `ramp`, and `railing` tools.

---

## Repo orientation

```
packages/web/src/workspace/authoring/OptionsBar.tsx   — main file to extend
packages/web/src/workspace/authoring/OptionsBar.test.tsx  — existing tests (if any)
packages/web/src/plan/PlanCanvas.tsx                  — reads module-level vars from OptionsBar
```

Read `OptionsBar.tsx` fully. Understand the pattern:
- `activeTool` from `useBimStore`
- Module-level `export let` variables (e.g. `mirrorCopyEnabled`, `pendingComponentRotationDeg`)
- `<div className={BAR_CLASS}>` sections gated on `activeTool === 'wall'` etc.
- PlanCanvas reads module-level vars at click-time — no Zustand needed for tool options

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Module-level option variables

Add at module level (near other `export let` declarations):

```ts
/** Roof options */
export let roofBaseOffsetMm = 0;
export function setRoofBaseOffsetMm(v: number): void { roofBaseOffsetMm = v; }

export let roofSlopeAngleDeg = 30;
export function setRoofSlopeAngleDeg(v: number): void { roofSlopeAngleDeg = v; }

/** Ramp options */
export let rampWidthMm = 1200;
export function setRampWidthMm(v: number): void { rampWidthMm = v; }

export let rampSlopePercent = 8.33;
export function setRampSlopePercent(v: number): void { rampSlopePercent = v; }

/** Railing options */
export let railingHeightMm = 900;
export function setRailingHeightMm(v: number): void { railingHeightMm = v; }

export let railingFollowSlope = true;
export function setRailingFollowSlope(v: boolean): void { railingFollowSlope = v; }
```

### B — Roof options bar section

In the `OptionsBar` component render, add a section gated on `activeTool === 'roof'` or `activeTool === 'roof-footprint'` or `activeTool === 'roof-extrusion'` (check which ToolIds exist in toolRegistry.ts):

```tsx
{(activeTool === 'roof' || activeTool === 'roof-footprint' || activeTool === 'roof-by-footprint') && (
  <div className={BAR_CLASS}>
    <label>Base Offset (mm)
      <input type="number"
        data-testid="options-roof-base-offset"
        defaultValue={roofBaseOffsetMm}
        onChange={e => setRoofBaseOffsetMm(+e.target.value)}
        style={{ width: 70 }}
      />
    </label>
    <label>Slope (°)
      <input type="number"
        data-testid="options-roof-slope"
        defaultValue={roofSlopeAngleDeg}
        min={0} max={89}
        onChange={e => setRoofSlopeAngleDeg(+e.target.value)}
        style={{ width: 60 }}
      />
    </label>
  </div>
)}
```

### C — Ramp options bar section

```tsx
{activeTool === 'ramp' && (
  <div className={BAR_CLASS}>
    <label>Width (mm)
      <input type="number"
        data-testid="options-ramp-width"
        defaultValue={rampWidthMm}
        min={600}
        onChange={e => setRampWidthMm(+e.target.value)}
        style={{ width: 70 }}
      />
    </label>
    <label>Slope (%)
      <input type="number"
        data-testid="options-ramp-slope"
        defaultValue={rampSlopePercent}
        min={0} max={50} step={0.01}
        onChange={e => setRampSlopePercent(+e.target.value)}
        style={{ width: 60 }}
      />
    </label>
  </div>
)}
```

### D — Railing options bar section

```tsx
{activeTool === 'railing' && (
  <div className={BAR_CLASS}>
    <label>Height (mm)
      <input type="number"
        data-testid="options-railing-height"
        defaultValue={railingHeightMm}
        min={600} max={1200}
        onChange={e => setRailingHeightMm(+e.target.value)}
        style={{ width: 70 }}
      />
    </label>
    <label>
      <input type="checkbox"
        data-testid="options-railing-follow-slope"
        defaultChecked={railingFollowSlope}
        onChange={e => setRailingFollowSlope(e.target.checked)}
      />
      Follow Slope
    </label>
  </div>
)}
```

### E — Tests

`packages/web/src/workspace/authoring/optionsBarRoofRampRailing.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { OptionsBar } from './OptionsBar'; // adjust import path
// mock useBimStore to return activeTool

describe('OptionsBar roof/ramp/railing options — §1.6.6', () => {
  it('renders roof base offset and slope inputs when roof tool active', () => { ... });
  it('renders ramp width and slope inputs when ramp tool active', () => { ... });
  it('renders railing height and follow-slope checkbox when railing tool active', () => { ... });
  it('does not render roof options when wall tool active', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave20/C): options bar — roof base-offset/slope + ramp width/slope + railing height/follow-slope (§1.6.6)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
