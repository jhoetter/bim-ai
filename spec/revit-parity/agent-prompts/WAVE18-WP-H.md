# Wave 18 — WP-H: Auto-Dimension Walls + Permanent Dimension Improvements (§4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — permanent_dimension element type
packages/web/src/plan/autoDimension.ts              — auto-dimension logic (may exist)
packages/web/src/plan/PlanCanvas.tsx                — plan canvas
packages/web/src/plan/planElementMeshBuilders.ts    — dimension rendering
packages/web/src/tools/toolGrammar.ts               — PermanentDimState (read it)
packages/web/src/workspace/inspector/InspectorContent.tsx — dimension inspector
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Search for `autoDimension`, `auto_dimension`, `permanentDim`, `PermanentDimState`, `reducePermanentDim`, `witnessPoints`, `CreatePermanentDimensionCmd` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: read `permanent_dimension` type — all fields (`witnessPointsMm`, `offsetMm`, `eqEnabled`, `textPrefix`, `textSuffix`, `textOverride`).
2. `autoDimension.ts` (if exists): read FULLY — what does it already do?
3. `toolGrammar.ts`: find `PermanentDimState` / `reducePermanentDim` — read fully.
4. `planElementMeshBuilders.ts`: find `permanentDimensionThree()` — read how dimensions are rendered.
5. `defaultCommands.ts`: search for `annotate.auto-dimension` or `annotate.dim-walls` — does this exist?

---

## Tasks

### A — `autoDimensionWalls.ts`

Create (or extend) `packages/web/src/plan/autoDimensionWalls.ts`:

```ts
import type { Element } from '@bim-ai/core';

type PointMm = { xMm: number; yMm: number };
type PermanentDim = Extract<Element, { kind: 'permanent_dimension' }>;

/**
 * Auto-dimensions a set of walls with aligned dimension chains.
 * For walls aligned along a given axis (horizontal or vertical), generates
 * a permanent_dimension element spanning the endpoints.
 *
 * Returns an array of new permanent_dimension elements to add.
 */
export function autoDimensionWalls(
  walls: Extract<Element, { kind: 'wall' }>[],
  offsetMm = 1000,
): PermanentDim[] {
  const dims: PermanentDim[] = [];

  // Group walls by rough angle (horizontal vs vertical)
  const horizontal = walls.filter((w) => {
    const dx = (w as any).endMm?.xMm - (w as any).startMm?.xMm ?? 0;
    const dy = (w as any).endMm?.yMm - (w as any).startMm?.yMm ?? 0;
    return Math.abs(dx) > Math.abs(dy);
  });
  const vertical = walls.filter((w) => !horizontal.includes(w));

  // Horizontal walls → dimension from leftmost to rightmost endpoint
  if (horizontal.length >= 1) {
    const pts: PointMm[] = [];
    for (const w of horizontal) {
      const s = (w as any).startMm as PointMm | undefined;
      const e = (w as any).endMm as PointMm | undefined;
      if (s) pts.push(s);
      if (e) pts.push(e);
    }
    const sorted = [...pts].sort((a, b) => a.xMm - b.xMm);
    if (sorted.length >= 2) {
      const avgY = sorted.reduce((s, p) => s + p.yMm, 0) / sorted.length;
      dims.push({
        kind: 'permanent_dimension',
        id: crypto.randomUUID(),
        witnessPointsMm: sorted.map((p) => ({ xMm: p.xMm, yMm: avgY })),
        offsetMm: { xMm: 0, yMm: -offsetMm },
        eqEnabled: false,
      } as PermanentDim);
    }
  }

  // Vertical walls → dimension from bottom to top
  if (vertical.length >= 1) {
    const pts: PointMm[] = [];
    for (const w of vertical) {
      const s = (w as any).startMm as PointMm | undefined;
      const e = (w as any).endMm as PointMm | undefined;
      if (s) pts.push(s);
      if (e) pts.push(e);
    }
    const sorted = [...pts].sort((a, b) => a.yMm - b.yMm);
    if (sorted.length >= 2) {
      const avgX = sorted.reduce((s, p) => s + p.xMm, 0) / sorted.length;
      dims.push({
        kind: 'permanent_dimension',
        id: crypto.randomUUID(),
        witnessPointsMm: sorted.map((p) => ({ xMm: avgX, yMm: p.yMm })),
        offsetMm: { xMm: -offsetMm, yMm: 0 },
        eqEnabled: false,
      } as PermanentDim);
    }
  }

  return dims;
}

/**
 * Auto-dimensions selected elements: walls, columns, openings.
 * Returns new permanent_dimension elements to add to the model.
 */
export function autoDimensionElements(elements: Element[], offsetMm = 1000): PermanentDim[] {
  const walls = elements.filter((e): e is Extract<Element, { kind: 'wall' }> => e.kind === 'wall');
  return autoDimensionWalls(walls, offsetMm);
}
```

---

### B — Palette command + `Workspace.tsx` handler

In `defaultCommands.ts`, add (or update if exists):

```ts
{ id: 'annotate.auto-dimension', label: 'Auto-Dimension Walls',
  keywords: ['auto', 'dimension', 'walls', 'annotate'],
  category: 'command',
  invoke: (ctx) => {
    const selected = ctx.selectedElements ?? [];
    const walls = selected.filter(e => e.kind === 'wall');
    const targets = walls.length > 0 ? walls : Object.values(ctx.elementsById ?? {}).filter(e => e?.kind === 'wall') as Element[];
    const dims = autoDimensionElements(targets as Element[]);
    for (const dim of dims) {
      void ctx.onSemanticCommand?.({ type: 'createElement', element: dim });
    }
  }
}
```

In `commandCapabilities.ts`:

```ts
{ id: 'annotate.auto-dimension', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### C — Inspector: dimension offset input

In `InspectorContent.tsx`, `case 'permanent_dimension':`, add:

```tsx
<label>Offset X (mm)
  <input type="number" data-testid="inspector-dim-offset-x"
    value={(el.offsetMm as any)?.xMm ?? 0}
    onChange={e => onPropertyChange('offsetMm', { ...el.offsetMm, xMm: +e.target.value })} />
</label>
<label>Offset Y (mm)
  <input type="number" data-testid="inspector-dim-offset-y"
    value={(el.offsetMm as any)?.yMm ?? -1000}
    onChange={e => onPropertyChange('offsetMm', { ...el.offsetMm, yMm: +e.target.value })} />
</label>
<span data-testid="inspector-dim-witness-count">
  {(el.witnessPointsMm ?? []).length} witness points
</span>
```

---

### D — `cheatsheetData.ts` update

In `cheatsheetData.ts`, ensure `DI` chord maps to "Aligned Dimension" and add `AD` for "Auto-Dimension". If `autoDimension` doesn't have a hotkey, add it as a palette-only command (no chord needed).

---

### E — Tests

`packages/web/src/plan/autoDimensionWalls.test.ts`:

```ts
describe('autoDimensionWalls — §4.1', () => {
  it('returns empty array for empty wall list', () => { ... });
  it('returns one dim chain for horizontal walls', () => { ... });
  it('returns one dim chain for vertical walls', () => { ... });
  it('dim chain has correct number of witness points', () => { ... });
  it('witness points are sorted along the axis', () => { ... });
  it('offsetMm is applied correctly to horizontal dim', () => { ... });
});

describe('autoDimensionElements — §4.1', () => {
  it('delegates to autoDimensionWalls for wall elements', () => { ... });
  it('ignores non-wall elements', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/H): auto-dimension walls — autoDimensionWalls utility + palette command + inspector offset (§4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new auto-dimension tests.
