import { createElement, type ReactElement } from 'react';

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

/** Returns SVG <pattern> definition nodes for React render paths. */
export function svgHatchPatternElement(
  pattern: HatchPattern,
  id: string,
  scale: number = 1,
): ReactElement {
  const s = scale;
  const baseProps = {
    id,
    patternUnits: 'userSpaceOnUse',
  };

  switch (pattern) {
    case 'concrete':
      return createElement(
        'pattern',
        { ...baseProps, width: 8 * s, height: 8 * s },
        createElement('line', {
          key: 'diagonal-a',
          x1: 0,
          y1: 8 * s,
          x2: 8 * s,
          y2: 0,
          stroke: '#888',
          strokeWidth: 0.5 * s,
        }),
        createElement('line', {
          key: 'diagonal-b',
          x1: 0,
          y1: 0,
          x2: 8 * s,
          y2: 8 * s,
          stroke: '#888',
          strokeWidth: 0.5 * s,
        }),
      );
    case 'brick':
      return createElement(
        'pattern',
        { ...baseProps, width: 16 * s, height: 8 * s },
        createElement('rect', {
          key: 'brick-outline',
          width: 16 * s,
          height: 8 * s,
          fill: 'none',
          stroke: '#888',
          strokeWidth: 0.5 * s,
        }),
        createElement('line', {
          key: 'brick-vertical',
          x1: 8 * s,
          y1: 0,
          x2: 8 * s,
          y2: 4 * s,
          stroke: '#888',
          strokeWidth: 0.5 * s,
        }),
        createElement('line', {
          key: 'brick-horizontal',
          x1: 0,
          y1: 4 * s,
          x2: 8 * s,
          y2: 4 * s,
          stroke: '#888',
          strokeWidth: 0.5 * s,
        }),
      );
    case 'wood':
      return createElement(
        'pattern',
        { ...baseProps, width: 4 * s, height: 8 * s },
        createElement('line', {
          key: 'grain',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 8 * s,
          stroke: '#a0785a',
          strokeWidth: 0.5 * s,
        }),
      );
    case 'glass':
      return createElement(
        'pattern',
        { ...baseProps, width: 4 * s, height: 4 * s },
        createElement('circle', {
          key: 'dot',
          cx: 2 * s,
          cy: 2 * s,
          r: 0.5 * s,
          fill: '#88aacc',
        }),
      );
    case 'insulation':
      return createElement(
        'pattern',
        { ...baseProps, width: 12 * s, height: 6 * s },
        createElement('polyline', {
          key: 'zigzag',
          points: `0,${3 * s} ${3 * s},0 ${6 * s},${6 * s} ${9 * s},0 ${12 * s},${3 * s}`,
          fill: 'none',
          stroke: '#e8a020',
          strokeWidth: 0.5 * s,
        }),
      );
    case 'earth':
      return createElement(
        'pattern',
        { ...baseProps, width: 8 * s, height: 4 * s },
        createElement('line', {
          key: 'strata',
          x1: 0,
          y1: 2 * s,
          x2: 8 * s,
          y2: 2 * s,
          stroke: '#8b6914',
          strokeWidth: 0.5 * s,
        }),
        createElement('circle', {
          key: 'grain',
          cx: 4 * s,
          cy: 1 * s,
          r: 0.5 * s,
          fill: '#8b6914',
        }),
      );
    case 'metal':
      return createElement(
        'pattern',
        { ...baseProps, width: 4 * s, height: 4 * s },
        createElement('line', {
          key: 'diagonal',
          x1: 0,
          y1: 0,
          x2: 4 * s,
          y2: 4 * s,
          stroke: '#666',
          strokeWidth: 0.5 * s,
        }),
      );
    default:
      return createElement(
        'pattern',
        { ...baseProps, width: 1, height: 1 },
        createElement('rect', { key: 'solid', width: 1, height: 1, fill: '#ddd' }),
      );
  }
}
