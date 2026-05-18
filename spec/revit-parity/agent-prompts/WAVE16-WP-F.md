# Wave 16 — WP-F: Stair Component Editing + Grips (§8.6.2–8.6.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                          — stair element type
packages/web/src/workspace/inspector/InspectorContent.tsx           — inspector panels
packages/web/src/plan/stairGripProvider.ts (or similar)             — stair grips
packages/web/src/plan/StairBySketchCanvas.tsx (if exists)           — sketch stair
packages/web/src/viewport/meshBuilders.multiRunStair.ts             — 3D mesh builder
```

Search for `stair` in the codebase to find all relevant files before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find the `stair` element kind. Read ALL fields carefully — especially `riserCount`, `runWidthMm`, `landingDepthMm`, `totalHeightMm`, `runs`, etc.
2. `InspectorContent.tsx`: find `case 'stair':` — read what's currently shown.
3. Search for `stairGripProvider` or grip code for stairs — read it fully.
4. `meshBuilders.multiRunStair.ts`: read the mesh builder to understand what fields drive the geometry.

---

## Tasks

### A — Stair inspector polish (§8.6.4)

In `InspectorContent.tsx`, for `kind === 'stair'`, ensure these inputs exist (add any missing ones):

- **Riser count**: `<input type="number" data-testid="inspector-stair-riser-count" value={el.riserCount} onChange={...}>`
- **Run width (mm)**: `<input type="number" data-testid="inspector-stair-run-width" value={el.runWidthMm} onChange={...}>`
- **Landing depth (mm)**: `<input type="number" data-testid="inspector-stair-landing-depth" value={el.landingDepthMm ?? 1200} onChange={...}>` (only show if stair has ≥2 runs)
- **Total height (mm)** read-only: `<span data-testid="inspector-stair-total-height">{el.totalHeightMm ?? el.riserCount * (el.riserHeightMm ?? 175)}</span>`
- **Riser height (mm)** computed or editable: `<input type="number" data-testid="inspector-stair-riser-height" value={...}>`
- **Multi-storey toggle**: `<input type="checkbox" data-testid="inspector-stair-multi-storey" checked={el.multiStorey ?? false} onChange={...}>`

Ensure all inputs call `onPropertyChange(field, newValue)`.

---

### B — Stair grip provider: riser count adjustment (§8.6.4)

Find or create `stairGripProvider.ts`. Add a **riser count grip**:

A drag grip at the top-centre of the stair that, when dragged up/down, adjusts `riserCount` by ±1 per 175mm (one riser height) of drag distance:

```ts
// Grip at top of stair (above the top landing)
{
  id: `${el.id}-riser-grip`,
  positionMm: { xMm: el.positionMm.xMm, yMm: el.positionMm.yMm - el.runDepthMm * el.riserCount },
  cursor: 'ns-resize',
  onDrag: (deltaYMm) => {
    const newCount = Math.max(2, el.riserCount + Math.round(-deltaYMm / 175));
    onPropertyChange('riserCount', newCount);
  }
}
```

Also add a **run width grip** on the right side of the stair:

```ts
{
  id: `${el.id}-width-grip`,
  positionMm: { xMm: el.positionMm.xMm + el.runWidthMm, yMm: el.positionMm.yMm },
  cursor: 'ew-resize',
  onDrag: (deltaXMm) => {
    const newWidth = Math.max(600, el.runWidthMm + deltaXMm);
    onPropertyChange('runWidthMm', newWidth);
  }
}
```

---

### C — Stair by sketch configurations (§8.6.3)

Find `StairBySketchCanvas.tsx` or the stair sketch grammar in `toolGrammar.ts`. Currently it may only handle straight single-run stairs.

Add support for **L-shape stair** (2 runs with 90° turn):

- When user places 3 points (start, corner, end), detect that the angle between segments is ~90° and create a 2-run stair with a landing at the corner.
- Set `runs: [{ direction: 'north', riserCount: n1 }, { direction: 'east', riserCount: n2 }]` (or similar based on what the stair type supports).

Add support for **U-shape stair** (3 points in a U pattern):

- When the 3rd point returns roughly parallel to the 1st segment, create a U-shape stair.

If the stair element type already has `runs[]` support, use it. If not, just ensure the grammar handles multi-run correctly.

---

### D — Tests

`packages/web/src/plan/stairInspector.test.tsx`:

```ts
describe('stair inspector — §8.6.4', () => {
  it('renders inspector-stair-riser-count input', () => { ... });
  it('renders inspector-stair-run-width input', () => { ... });
  it('renders inspector-stair-total-height readout', () => { ... });
  it('changing riser count calls onPropertyChange', () => { ... });
});
```

`packages/web/src/plan/stairGrips.test.ts`:

```ts
describe('stair grip provider — §8.6.4', () => {
  it('provides a riser-count grip at top of stair', () => { ... });
  it('provides a run-width grip on the right side', () => { ... });
  it('dragging riser grip adjusts riserCount by 1 per 175mm', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/F): stair component editing — inspector inputs + drag grips (§8.6.2-8.6.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new stair editing tests.
