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
