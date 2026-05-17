# Wave 23 — WP-B: Section View Level Lines (§6.1.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§6.1.6 "Schnittansicht" is Partial. Section views exist with material hatch patterns (wave 15) and section bubbles (wave 16). What's still missing is level datum lines — horizontal dashed lines at each floor level elevation shown inside the section SVG, with level name labels. In Revit, section views show dotted horizontal datum lines labeled with the level name (e.g., "EG +0.00", "OG1 +3.20") which help readers understand the vertical position of floors and ceilings.

This task adds:
- A `showLevelLines?: boolean` field on `section_cut` elements
- `sectionViewportSvg.tsx` updated to draw horizontal dashed level lines + name labels
- Inspector toggle
- Tests

---

## Repo orientation

```
packages/core/src/index.ts                    — find section_cut element type (kind: 'section_cut')
packages/web/src/workspace/sheets/sectionViewportSvg.tsx — the SVG section renderer
packages/web/src/workspace/sheets/sectionViewportSvg.test.ts — existing tests
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'section_cut':
```

Run:
- `grep -n "section_cut\|cropDepthMm\|lineStartMm" packages/core/src/index.ts | head -10`
- Read `packages/web/src/workspace/sheets/sectionViewportSvg.tsx` to understand the SVG rendering approach, particularly how walls and other elements are projected into the section plane.
- `grep -n "level\|levelId\|elevationMm" packages/core/src/index.ts | grep "kind: 'level'" | head -5`

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add showLevelLines to section_cut in packages/core/src/index.ts

Find the `section_cut` union member (search for `kind: 'section_cut';`). Add:

```ts
/** §6.1.6: when true, draws horizontal level datum lines in the section SVG. */
showLevelLines?: boolean;
```

### B — sectionLevelLines.ts utility

Create `packages/web/src/workspace/sheets/sectionLevelLines.ts`:

```ts
import type { Element } from '@bim-ai/core';

export interface LevelDatum {
  name: string;
  elevationMm: number;
}

/**
 * Extracts level datum lines from the elements collection.
 * Returns all level elements sorted by elevation ascending.
 */
export function extractLevelData(elementsById: Record<string, Element>): LevelDatum[] {
  const levels: LevelDatum[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'level') {
      levels.push({
        name: (el as any).name ?? (el as any).id,
        elevationMm: (el as any).elevationMm ?? 0,
      });
    }
  }
  return levels.sort((a, b) => a.elevationMm - b.elevationMm);
}

/**
 * Builds SVG elements for level datum lines in a section view.
 * @param levels - sorted level datums
 * @param svgWidthPx - total SVG width in pixels
 * @param sectionHeightMm - total vertical range of section (maxElevMm - minElevMm)
 * @param minElevMm - elevation at bottom of section view
 * @param svgHeightPx - total SVG height in pixels
 * @param scale - mm to px scale factor
 */
export function buildLevelLineSvg(
  levels: LevelDatum[],
  svgWidthPx: number,
  minElevMm: number,
  svgHeightPx: number,
  scale: number,
): string {
  return levels
    .map((lev) => {
      const y = svgHeightPx - (lev.elevationMm - minElevMm) * scale;
      const labelText = `${lev.name} ${lev.elevationMm >= 0 ? '+' : ''}${(lev.elevationMm / 1000).toFixed(2)}`;
      return [
        `<line x1="0" y1="${y.toFixed(1)}" x2="${svgWidthPx}" y2="${y.toFixed(1)}" `,
        `stroke="#2563eb" stroke-width="0.5" stroke-dasharray="8,4" opacity="0.7" />`,
        `<text x="4" y="${(y - 2).toFixed(1)}" font-size="9" fill="#2563eb" opacity="0.9">${labelText}</text>`,
      ].join('');
    })
    .join('\n');
}
```

### C — Wire level lines into sectionViewportSvg.tsx

Read `sectionViewportSvg.tsx` carefully before editing. Find the main SVG string builder / render function. After the existing hatch patterns and wall outlines are added to the SVG output, add the level lines when `section.showLevelLines` is true (default: false — do not show unless explicitly enabled, but make the test use `showLevelLines: true`).

Look for the SVG construction pattern in the file — find where the function returns or builds the `<svg>...</svg>` string. The level lines should be inserted before the closing `</svg>` tag.

The key challenge: you need to know the elevation range of the section view. The section_cut element has `lineStartMm` and `lineEndMm` in plan (XY), but the vertical range is defined by the levels in the project. Use all levels from `elementsById` to define the min/max elevation range for the section.

Add:
```ts
import { extractLevelData, buildLevelLineSvg } from './sectionLevelLines';
```

In the SVG build, after the element outlines, add level lines when enabled:
```ts
let levelLinesSvg = '';
if ((sectionCut as any).showLevelLines !== false) {
  // Default to showing level lines (omission = show)
  // Actually only show when showLevelLines is explicitly true
}
// Or: add level lines when showLevelLines is true (opt-in)
```

Make level lines **opt-in** (`showLevelLines: true` required). This avoids changing existing snapshot tests.

### D — Inspector toggle in InspectorContent.tsx

Find `case 'section_cut':` in `InspectorContent.tsx`. Add a checkbox:

```tsx
<div className="flex items-center gap-2 py-0.5">
  <span className="text-xs text-muted w-28 shrink-0">Level Lines</span>
  <input
    data-testid="inspector-section-cut-show-level-lines"
    type="checkbox"
    checked={(el as any).showLevelLines ?? false}
    onChange={(e) =>
      onSemanticCommand?.({
        type: 'updateSectionCut',
        id: el.id,
        changes: { showLevelLines: e.target.checked },
      })
    }
  />
</div>
```

Note: Check whether an `updateSectionCut` command already exists. If not, look for how other properties on section_cut are updated (maybe via a generic `updateElement` command or specific `setSectionCutProperty` command). Adapt to the real codebase.

### E — Tests

Create `packages/web/src/workspace/sheets/sectionLevelLines.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractLevelData, buildLevelLineSvg } from './sectionLevelLines';

const elementsById: any = {
  'l1': { id: 'l1', kind: 'level', name: 'EG', elevationMm: 0 },
  'l2': { id: 'l2', kind: 'level', name: 'OG1', elevationMm: 3200 },
  'l3': { id: 'l3', kind: 'level', name: 'OG2', elevationMm: 6400 },
  'w1': { id: 'w1', kind: 'wall', levelId: 'l1' },
};

describe('sectionLevelLines — §6.1.6', () => {
  it('extracts levels from elementsById sorted by elevation', () => {
    const levels = extractLevelData(elementsById);
    expect(levels).toHaveLength(3);
    expect(levels[0].name).toBe('EG');
    expect(levels[2].elevationMm).toBe(6400);
  });

  it('excludes non-level elements', () => {
    const levels = extractLevelData(elementsById);
    expect(levels.every(l => typeof l.elevationMm === 'number')).toBe(true);
  });

  it('returns empty array for no levels', () => {
    const levels = extractLevelData({ 'w1': { id: 'w1', kind: 'wall' } as any });
    expect(levels).toHaveLength(0);
  });

  it('buildLevelLineSvg produces line and text elements', () => {
    const levels = [{ name: 'EG', elevationMm: 0 }, { name: 'OG1', elevationMm: 3200 }];
    const svg = buildLevelLineSvg(levels, 800, 0, 600, 0.1);
    expect(svg).toContain('<line');
    expect(svg).toContain('<text');
    expect(svg).toContain('EG');
    expect(svg).toContain('OG1');
  });

  it('buildLevelLineSvg uses dashed stroke', () => {
    const levels = [{ name: 'EG', elevationMm: 0 }];
    const svg = buildLevelLineSvg(levels, 800, 0, 600, 0.1);
    expect(svg).toContain('stroke-dasharray');
  });

  it('labels include elevation in meters', () => {
    const levels = [{ name: 'OG1', elevationMm: 3200 }];
    const svg = buildLevelLineSvg(levels, 800, 0, 600, 0.1);
    expect(svg).toContain('+3.20');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave23/B): section view level lines — extractLevelData + buildLevelLineSvg + showLevelLines field + inspector toggle (§6.1.6)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
