# Wave 28 — WP-D: Interior Elevation Material Hatches + Done (§6.1.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§6.1.5 "Innenansichten" is Partial P2. Interior elevation placement and projection are already implemented:

- `interior_elevation_marker` element type in `@bim-ai/core`
- `interiorElevationProjection.ts` builds 2D wall/floor/opening projections
- `InteriorElevationViewport.tsx` renders as SVG

What's still missing:

1. Material hatch patterns in interior elevation SVG (walls show as blank fills, not hatched)
2. A height dimension annotation showing storey height in the elevation
3. Section bubble symbol at the marker reference

This task adds material hatches (borrowing `hatchPatternForMaterial` from `materialHatchPatterns.ts`) and a height ruler/annotation to `InteriorElevationViewport.tsx`, bringing §6.1.5 to Done.

---

## Repo orientation

```
packages/web/src/viewport/InteriorElevationViewport.tsx  — find SVG rendering, wall fill
packages/web/src/plan/materialHatchPatterns.ts           — find hatchPatternForMaterial, svgHatchDef
packages/web/src/plan/interiorElevationProjection.ts     — find buildElevationLines() structure
```

Run before editing:

- `grep -n "hatchPatternForMaterial\|svgHatchDef\|materialKey" packages/web/src/viewport/InteriorElevationViewport.tsx | head -10`
- `grep -n "export.*hatch\|svgHatchDef\|hatchPatternFor" packages/web/src/plan/materialHatchPatterns.ts | head -10`
- `grep -rn "InteriorElevationViewport\|interior.*elevation.*svg" packages/web/src/ | head -10`
- `grep -n "fill\|stroke\|rect\|polygon" packages/web/src/viewport/InteriorElevationViewport.tsx | head -15`

Read `InteriorElevationViewport.tsx` and `materialHatchPatterns.ts` carefully before editing.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Import hatch utilities in InteriorElevationViewport.tsx

At the top of `InteriorElevationViewport.tsx`, add:

```ts
import { hatchPatternForMaterial, svgHatchDef } from '../plan/materialHatchPatterns';
```

**Important**: Check the actual import path. If the file is in `packages/web/src/viewport/`, the path to `materialHatchPatterns.ts` might be `'../plan/materialHatchPatterns'`. Verify with the actual directory structure.

### B — Add SVG hatch pattern defs to the elevation SVG

In the SVG output of `InteriorElevationViewport.tsx`, add a `<defs>` block before the first SVG element that renders walls:

```tsx
// Collect unique material keys from walls in this elevation
const materialKeys = [...new Set(
  projectedWalls.map((w) => (w as any).materialKey ?? 'concrete')
)];

// In the SVG return:
<svg ...>
  <defs>
    {materialKeys.map((mk) => {
      const pattern = hatchPatternForMaterial(mk as string);
      return svgHatchDef(pattern, `hatch-iel-${mk}`, 1);
    })}
  </defs>
  ...existing content...
</svg>
```

**Important**: Read the actual component structure. The variable names for projected walls may differ. Adapt to what's actually in the file.

### C — Apply hatch fills to wall polygons

For wall polygons/rects in the SVG, change the fill from a solid color to the hatch pattern:

```tsx
// Instead of: fill="rgba(200,200,200,0.4)"
// Use:
fill={`url(#hatch-iel-${wall.materialKey ?? 'concrete'})`}
stroke="#333"
strokeWidth={1}
```

**Important**: Read the actual SVG rendering code carefully. Find where wall polygons/rectangles are drawn and update their fill attribute.

### D — Add storey height ruler annotation

At the right edge of the elevation SVG, add a vertical dimension line showing the storey height:

```tsx
{
  /* §6.1.5: storey height ruler */
}
{
  storeyHeightMm > 0 && (
    <g data-testid="iel-height-ruler">
      {/* Vertical line */}
      <line
        x1={svgWidth - 20}
        y1={svgHeight - margin}
        x2={svgWidth - 20}
        y2={margin}
        stroke="#555"
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      {/* Arrow heads and label */}
      <text
        x={svgWidth - 8}
        y={svgHeight / 2}
        fontSize={9}
        fill="#555"
        textAnchor="middle"
        transform={`rotate(-90, ${svgWidth - 8}, ${svgHeight / 2})`}
      >
        {Math.round(storeyHeightMm)} mm
      </text>
    </g>
  );
}
```

**Important**: Read the component to understand `svgWidth`, `svgHeight`, `margin`, and `storeyHeightMm` (or their equivalents). Adapt to the actual dimensions.

### E — commandCapabilities.ts entry

```ts
{
  id: 'view.interior-elevation-hatch',
  label: 'Interior Elevation Material Hatches',
  owner: 'viewport/InteriorElevationViewport',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['elevation-viewport', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§6.1.5: material hatch patterns from materialHatchPatterns.ts applied to wall fills in interior elevation SVG; storey height ruler annotation.',
},
```

Add a matching `registerCommand` for `view.interior-elevation-hatch` in `defaultCommands.ts`.

### F — Tests

Create `packages/web/src/viewport/interiorElevationHatch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hatchPatternForMaterial, svgHatchDef } from '../plan/materialHatchPatterns';

describe('Interior elevation hatch — §6.1.5', () => {
  it('hatchPatternForMaterial returns a pattern for concrete', () => {
    const pattern = hatchPatternForMaterial('concrete');
    expect(pattern).toBeDefined();
  });

  it('hatchPatternForMaterial returns a pattern for brick', () => {
    const pattern = hatchPatternForMaterial('brick');
    expect(pattern).toBeDefined();
  });

  it('svgHatchDef returns SVG string with pattern id', () => {
    const pattern = hatchPatternForMaterial('concrete');
    const def = svgHatchDef(pattern, 'hatch-iel-concrete', 1);
    expect(def).toBeTruthy();
  });

  it('url reference uses correct pattern id', () => {
    const materialKey = 'brick';
    const patternId = `hatch-iel-${materialKey}`;
    const fill = `url(#${patternId})`;
    expect(fill).toBe('url(#hatch-iel-brick)');
  });

  it('storey height label formats mm correctly', () => {
    const storeyHeightMm = 3000;
    const label = `${Math.round(storeyHeightMm)} mm`;
    expect(label).toBe('3000 mm');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave28/D): interior elevation material hatches — hatchPatternForMaterial in InteriorElevationViewport SVG + storey height ruler annotation (§6.1.5)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
