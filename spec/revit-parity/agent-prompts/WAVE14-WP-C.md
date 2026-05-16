# Wave 14 — WP-C: Roof Slope Arrow (§10.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — roof element type
packages/web/src/plan/PlanCanvas.tsx                    — roof-sketch mode canvas interactions
packages/web/src/workspace/inspector/InspectorContent.tsx — roof inspector case
packages/web/src/plan/planElementMeshBuilders.ts        — plan symbol builders
packages/web/src/viewport/meshBuilders.ts               — 3D roof mesh builder
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — find the `roof` element type. Look for fields like `slopeAngleDeg`, `edges`, `boundaryMm`, `slopeArrow`. Note exactly what exists. If a `slopeArrow` field exists, do NOT add it again.
- `PlanCanvas.tsx` — find how `roof-sketch` mode works. Find the sketch canvas (may be `RoofByFootprintSketchCanvas.tsx` or inline). Find where slope-arrow exists for floors (look for `SlopeArrow` or `slope_arrow` references). Read the pattern carefully.
- `InspectorContent.tsx` — find `case 'roof':`. Read what already exists for slope controls. Note if there is already a "Slope Arrow" section.
- `planElementMeshBuilders.ts` — find roof plan symbol rendering. Look for slope arrow rendering patterns (used for floors).

---

## Tasks

### A — Extend roof element type in `core/index.ts`

If the `roof` element does NOT already have a `slopeArrow` field, add:

```ts
slopeArrow?: {
  /** Tail of the arrow (low point) in plan mm. */
  tailMm: { xMm: number; yMm: number };
  /** Head of the arrow (high point) in plan mm. */
  headMm: { xMm: number; yMm: number };
  /** Slope expressed as rise/run (e.g. 0.25 = 25% = 14.04°). */
  slopeRatio: number;
} | null;
```

Also add: `useSlopeArrow?: boolean | null` to indicate "this roof uses slope arrow instead of per-edge slopes".

### B — Roof sketch canvas: slope arrow tool

In `PlanCanvas.tsx` (or the roof sketch canvas component), when the active tool is `'roof'` and the sketch is in **slope-arrow mode** (a toggle you will add):

1. First click: record `tailMm` (the low end of the slope arrow).
2. Second click: record `headMm` (the high end). Compute direction and default slopeRatio = 0.25.
3. Commit: set `slopeArrow = { tailMm, headMm, slopeRatio }` and `useSlopeArrow = true` on the roof element via `updateElementProperty`.

Add a toggle button in the roof sketch toolbar or OptionsBar: **"Slope Arrow"** mode vs **"Per-Edge Slope"** mode. Only show when a roof is being sketched or an existing roof is selected in sketch mode.

### C — Plan canvas: render slope arrow

In `planElementMeshBuilders.ts` (or the appropriate plan renderer for roofs), when `roof.useSlopeArrow && roof.slopeArrow`:

Draw:
- A solid arrow line from `tailMm` to `headMm` with an arrowhead at `headMm`.
- A text label at the midpoint showing the slope as percentage: `"${(slopeRatio * 100).toFixed(0)}%"`.
- Tag with `userData.roofSlopeArrow = true`.

Use `THREE.ArrowHelper` or manual `THREE.LineSegments` + a small triangle mesh at the head.

### D — Inspector

In `InspectorContent.tsx`, in `case 'roof':`, add a **"Slope Arrow"** collapsible section:

```tsx
<label data-testid="inspector-roof-use-slope-arrow">
  <input type="checkbox" checked={el.useSlopeArrow ?? false}
    onChange={(e) => onPropertyChange?.('useSlopeArrow', e.currentTarget.checked)} />
  Use Slope Arrow
</label>
```

When `useSlopeArrow` is true and `slopeArrow` exists, show:
- Slope %: `data-testid="inspector-roof-slope-pct"` — editable number input (slopeRatio × 100)
- On blur: `onPropertyChange?.('slopeArrow', { ...el.slopeArrow, slopeRatio: pct / 100 })`

### E — 3D mesh: apply slope arrow to roof geometry

In `meshBuilders.ts`, when building a roof mesh and `useSlopeArrow` is true:

Compute the roof slope from the `slopeArrow.slopeRatio` and `tailMm`/`headMm` direction vector:
- Project the roof boundary onto a tilted plane using the arrow direction and ratio.
- The tail edge of the roof is at the base elevation; the head edge is elevated by `distance × slopeRatio`.

This is a simplified linear slope applied to the entire roof. If the current mesh builder already handles per-edge slopes, adapt it to use a single uniform slope when `useSlopeArrow = true`.

### F — Tests

`packages/web/src/plan/roofSlopeArrow.test.ts`:
```ts
describe('roof slope arrow — §10.1.3', () => {
  it('renders slope arrow plan symbol when useSlopeArrow is true', () => { ... });
  it('does not render slope arrow when useSlopeArrow is false', () => { ... });
  it('slope label shows correct percentage', () => { ... });
  it('slopeRatio 0.25 shows 25%', () => { ... });
});
```

`packages/web/src/workspace/inspector/roofSlopeArrowInspector.test.tsx`:
```ts
describe('roof slope arrow inspector — §10.1.3', () => {
  it('renders use-slope-arrow checkbox', () => { ... });
  it('shows slope pct input when useSlopeArrow is true', () => { ... });
  it('does not show slope pct when useSlopeArrow is false', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/C): roof slope arrow — plan symbol + inspector + 3D mesh (§10.1.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
