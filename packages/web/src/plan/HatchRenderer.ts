/**
 * CAN-V3-02 — Hatch pattern renderer for the plan SVG layer.
 *
 * Design invariant:
 *   screenRepeat = paperMmRepeat / plotScaleDenominator * pixelsPerMm
 *
 * Viewport zoom is navigation only; it does NOT change the plot scale denominator.
 * Changing the plot scale (1:50 → 1:100) halves the screen density at the same
 * physical brick rhythm.
 */

import type { HatchPatternDef } from '@bim-ai/core';

const SCREEN_DPI = 96;
const MM_PER_INCH = 25.4;
const BASE_PIXELS_PER_MM = SCREEN_DPI / MM_PER_INCH;

/**
 * Category-based fallback hatch pattern IDs for elements that have no explicit
 * material hatch assignment. Keys are element `kind` strings (as used in plan
 * element iteration). Values are `HatchPatternDef` ids from the core registry.
 *
 * railing, door, and window are intentionally excluded — small profiles do not
 * need a hatch fill.
 */
const CATEGORY_DEFAULT_HATCH: Partial<Record<string, string>> = {
  wall: 'brick',
  floor: 'concrete',
  roof: 'tile',
  stair: 'concrete',
  slab_edge: 'concrete',
};

/**
 * Resolve the hatch pattern id for a given element.
 *
 * Resolution order:
 *  1. Explicit `hatchPatternId` from the element's material — returned as-is.
 *  2. Category fallback from `CATEGORY_DEFAULT_HATCH` — applied when the
 *     element has no material hatch but belongs to a standard category.
 *  3. `null` — no hatch rendered (small profiles, unknown categories, etc.).
 *
 * @param hatchPatternId - explicit pattern id from the material (may be null/undefined)
 * @param category       - element category/kind string (e.g. 'wall', 'floor')
 */
export function resolveHatchPatternId(
  hatchPatternId: string | null | undefined,
  category?: string,
): string | null {
  if (hatchPatternId) return hatchPatternId;
  if (category && CATEGORY_DEFAULT_HATCH[category]) {
    return CATEGORY_DEFAULT_HATCH[category]!;
  }
  return null;
}

/**
 * Compute the screen repeat distance (px) for a hatch pattern at the given
 * plot scale and viewport zoom.
 *
 * @param paperMmRepeat  - pattern tile size in paper-mm
 * @param plotScaleDenominator - drawing scale denominator (50 for 1:50, 100 for 1:100)
 * @param viewportZoom   - canvas zoom factor (1.0 = 100%, 2.0 = 200%)
 */
export function computeHatchScreenRepeat(
  paperMmRepeat: number,
  plotScaleDenominator: number,
  viewportZoom: number,
): number {
  const pixelsPerMm = viewportZoom * BASE_PIXELS_PER_MM;
  return (paperMmRepeat / plotScaleDenominator) * pixelsPerMm;
}

/**
 * Build an SVG `<pattern>` definition string for a hatch pattern at the
 * given screen repeat size and stroke colour token.
 *
 * Returns `null` for unknown pattern kinds so callers can fall back to
 * a solid fill.
 *
 * Stroke colour must be a CSS variable reference (`var(--draft-cut)` etc.)
 * — never an inline hex literal.
 */
export function buildSvgHatchPatternDef(
  hatch: HatchPatternDef,
  screenRepeat: number,
  strokeColour: string,
): string | null {
  const id = `hatch-${hatch.id}`;
  const sw = Math.max(0.3, hatch.strokeWidthMm * BASE_PIXELS_PER_MM);
  const r = screenRepeat;
  const rot = hatch.rotationDeg;
  const transform = rot !== 0 ? ` patternTransform="rotate(${rot})"` : '';

  switch (hatch.patternKind) {
    case 'lines':
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${r}" height="${r}"${transform}>` +
        `<line x1="0" y1="0" x2="0" y2="${r}" stroke="${strokeColour}" stroke-width="${sw}"/>` +
        `</pattern>`
      );

    case 'crosshatch':
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${r}" height="${r}"${transform}>` +
        `<line x1="0" y1="0" x2="0" y2="${r}" stroke="${strokeColour}" stroke-width="${sw}"/>` +
        `<line x1="0" y1="0" x2="${r}" y2="0" stroke="${strokeColour}" stroke-width="${sw}"/>` +
        `</pattern>`
      );

    case 'dots': {
      const radius = Math.max(0.4, sw / 2);
      const half = r / 2;
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${r}" height="${r}"${transform}>` +
        `<circle cx="${half}" cy="${half}" r="${radius}" fill="${strokeColour}"/>` +
        `</pattern>`
      );
    }

    case 'curve': {
      // Sinusoidal wave — insulation symbol
      const amp = r * 0.3;
      const mid = r / 2;
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${r}" height="${r}"${transform}>` +
        `<path d="M0 ${mid} C${r * 0.25} ${mid - amp},${r * 0.75} ${mid + amp},${r} ${mid}" ` +
        `fill="none" stroke="${strokeColour}" stroke-width="${sw}"/>` +
        `</pattern>`
      );
    }

    case 'svg':
      if (!hatch.svgSource) return null;
      return (
        `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${r}" height="${r}"${transform}>` +
        hatch.svgSource +
        `</pattern>`
      );

    default:
      return null;
  }
}

/**
 * Resolve all hatch patterns referenced by elements in a view into a map of
 * `patternId → SVG <pattern> string` ready to be injected into a `<defs>`
 * block.
 *
 * Only hatches actually used in the view are emitted; unused entries are
 * skipped to keep the SVG payload small.
 */
export function buildHatchDefsForView(
  usedHatchIds: string[],
  hatchesById: Record<string, HatchPatternDef>,
  plotScaleDenominator: number,
  viewportZoom: number,
  strokeColour = 'var(--draft-cut)',
): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of usedHatchIds) {
    const hatch = hatchesById[id];
    if (!hatch) continue;
    const screenRepeat = computeHatchScreenRepeat(
      hatch.paperMmRepeat,
      plotScaleDenominator,
      viewportZoom,
    );
    const def = buildSvgHatchPatternDef(hatch, screenRepeat, strokeColour);
    if (def) result.set(id, def);
  }
  return result;
}

/**
 * Extract hatch pattern elements from a snapshot elements map.
 */
export function extractHatchPatterns(
  elementsById: Record<string, { kind: string }>,
): Record<string, HatchPatternDef> {
  const result: Record<string, HatchPatternDef> = {};
  for (const [id, el] of Object.entries(elementsById)) {
    if (el.kind === 'hatch_pattern_def') {
      result[id] = el as HatchPatternDef;
    }
  }
  return result;
}

/**
 * Look up the hatch id for a material key from the materials map.
 * Returns null when the material has no hatch assigned.
 */
export function materialToHatchId(
  materialKey: string | null | undefined,
  materialsById: Record<string, { hatchPatternId?: string | null }>,
): string | null {
  if (!materialKey) return null;
  return materialsById[materialKey]?.hatchPatternId ?? null;
}
