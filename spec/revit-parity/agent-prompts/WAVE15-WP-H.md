# Wave 15 — WP-H: Section View Material Hatch Patterns + Cut Line Weights (§6.1.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/sectionProjectionWire.ts   — section wireframe projection (find + extend)
packages/web/src/plan/symbology.ts               — (may also render section views)
packages/core/src/index.ts                        — section_view + cut_view element types
```

Search for `sectionViewport` in the codebase — there may be a React component that renders section content. Find ALL section-related rendering files before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. **`sectionProjectionWire.ts`**: likely exports a function that takes `elementsById` + a section clip plane and returns SVG-ready geometry. Read it fully.
2. Search for `SectionViewport` or `sectionViewportSvg` components. Locate where section view content is rendered in the UI.
3. `core/index.ts`: find `section_view` kind. It has a cut plane position and direction.

---

## Tasks

### A — Material → hatch pattern mapping

Create `packages/web/src/plan/materialHatchPatterns.ts`:

```ts
export type HatchPattern =
  | 'solid'
  | 'concrete'
  | 'brick'
  | 'wood'
  | 'glass'
  | 'insulation'
  | 'earth'
  | 'metal';

/** Maps a materialKey (e.g. "concrete", "brick", "wood", etc.) to a hatch pattern. */
export function hatchPatternForMaterial(materialKey: string | null | undefined): HatchPattern {
  if (!materialKey) return 'solid';
  const k = materialKey.toLowerCase();
  if (k.includes('concrete') || k.includes('beton')) return 'concrete';
  if (k.includes('brick') || k.includes('ziegel') || k.includes('mauerwerk')) return 'brick';
  if (k.includes('wood') || k.includes('holz') || k.includes('timber')) return 'wood';
  if (k.includes('glass') || k.includes('glas')) return 'glass';
  if (k.includes('insul') || k.includes('dämmung') || k.includes('styro')) return 'insulation';
  if (k.includes('earth') || k.includes('boden') || k.includes('soil')) return 'earth';
  if (k.includes('steel') || k.includes('stahl') || k.includes('metal')) return 'metal';
  return 'solid';
}

/** Returns SVG <pattern> definition for a given hatch type. */
export function svgHatchDef(pattern: HatchPattern, id: string, scale: number = 1): string {
  const s = scale;
  switch (pattern) {
    case 'concrete':
      // Cross-hatch at 45°
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${8 * s}" height="${8 * s}">
        <line x1="0" y1="${8 * s}" x2="${8 * s}" y2="0" stroke="#888" stroke-width="${0.5 * s}"/>
        <line x1="0" y1="0" x2="${8 * s}" y2="${8 * s}" stroke="#888" stroke-width="${0.5 * s}"/>
      </pattern>`;
    case 'brick':
      // Horizontal lines with vertical offsets
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${16 * s}" height="${8 * s}">
        <rect width="${16 * s}" height="${8 * s}" fill="none" stroke="#888" stroke-width="${0.5 * s}"/>
        <line x1="${8 * s}" y1="0" x2="${8 * s}" y2="${4 * s}" stroke="#888" stroke-width="${0.5 * s}"/>
        <line x1="0" y1="${4 * s}" x2="${8 * s}" y2="${4 * s}" stroke="#888" stroke-width="${0.5 * s}"/>
      </pattern>`;
    case 'wood':
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${4 * s}" height="${8 * s}">
        <line x1="0" y1="0" x2="0" y2="${8 * s}" stroke="#a0785a" stroke-width="${0.5 * s}"/>
      </pattern>`;
    case 'glass':
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${4 * s}" height="${4 * s}">
        <circle cx="${2 * s}" cy="${2 * s}" r="${0.5 * s}" fill="#88aacc"/>
      </pattern>`;
    case 'insulation':
      // Zigzag pattern
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${12 * s}" height="${6 * s}">
        <polyline points="0,${3 * s} ${3 * s},0 ${6 * s},${6 * s} ${9 * s},0 ${12 * s},${3 * s}" fill="none" stroke="#e8a020" stroke-width="${0.5 * s}"/>
      </pattern>`;
    case 'earth':
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${8 * s}" height="${4 * s}">
        <line x1="0" y1="${2 * s}" x2="${8 * s}" y2="${2 * s}" stroke="#8b6914" stroke-width="${0.5 * s}"/>
        <circle cx="${4 * s}" cy="${1 * s}" r="${0.5 * s}" fill="#8b6914"/>
      </pattern>`;
    case 'metal':
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${4 * s}" height="${4 * s}">
        <line x1="0" y1="0" x2="${4 * s}" y2="${4 * s}" stroke="#666" stroke-width="${0.5 * s}"/>
      </pattern>`;
    default:
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="1" height="1"><rect width="1" height="1" fill="#ddd"/></pattern>`;
  }
}
```

---

### B — Apply hatches in section view SVG

Find the section view renderer (could be in `sectionProjectionWire.ts` or a component that renders the section SVG). Extend it to:

1. For each **cut element** (wall, floor, ceiling, roof that intersects the cut plane):
   - Look up its primary material from `el.materialId` or `el.wallTypeId → wall type layers`.
   - Call `hatchPatternForMaterial(materialKey)` to get the hatch pattern ID.
   - Render the cut cross-section polygon filled with `url(#hatch-{patternName})`.
   - Add `<defs>` block at the top of the SVG with `svgHatchDef()` for each used pattern.

2. For cut elements, use **thicker stroke** (`stroke-width="2"`) for the cut outline.
   For beyond-cut elements (visible but not cut through), use thin lines (`stroke-width="0.5"`).

3. If the section renderer is a `.ts` file producing SVG string, update the string output. If it's a React component, update the JSX.

---

### C — Tests

`packages/web/src/plan/materialHatchPatterns.test.ts`:

```ts
describe('materialHatchPatterns — §6.1.6', () => {
  it('concrete materialKey returns concrete pattern', () => { ... });
  it('Holz (German wood) maps to wood', () => { ... });
  it('unknown material returns solid', () => { ... });
  it('svgHatchDef returns a string containing the pattern id', () => { ... });
  it('svgHatchDef concrete has two crossing lines', () => { ... });
  it('svgHatchDef insulation has polyline', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/H): section view material hatch patterns + cut line weights (§6.1.6)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new hatch pattern tests.
