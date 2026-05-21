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

import { createElement, type ReactElement } from 'react';

import type { HatchPatternDef } from '@bim-ai/core';

/**
 * Built-in hatch pattern definitions that are always available regardless
 * of what hatch_pattern_def elements exist in the model. These serve as
 * defaults for categories that need a hatch but the model has no explicit def.
 */
const BUILT_IN_HATCH_DEFS: Record<string, HatchPatternDef> = {
  herringbone: {
    kind: 'hatch_pattern_def',
    id: 'herringbone',
    name: 'Herringbone',
    patternKind: 'crosshatch',
    paperMmRepeat: 5,
    rotationDeg: 45,
    strokeWidthMm: 0.18,
  },
};

const SCREEN_DPI = 96;
const MM_PER_INCH = 25.4;
const BASE_PIXELS_PER_MM = SCREEN_DPI / MM_PER_INCH;
const SAFE_SVG_TAGS = new Set([
  'circle',
  'ellipse',
  'g',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
]);
const SAFE_SVG_ATTRS: Record<string, string> = {
  cx: 'cx',
  cy: 'cy',
  d: 'd',
  fill: 'fill',
  'fill-opacity': 'fillOpacity',
  height: 'height',
  opacity: 'opacity',
  points: 'points',
  r: 'r',
  rx: 'rx',
  ry: 'ry',
  stroke: 'stroke',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth',
  transform: 'transform',
  'vector-effect': 'vectorEffect',
  width: 'width',
  x: 'x',
  x1: 'x1',
  x2: 'x2',
  y: 'y',
  y1: 'y1',
  y2: 'y2',
};

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
  floor: 'herringbone', // was: 'concrete'
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

function isUnsafeSvgAttributeValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('javascript:') || normalized.includes('<') || normalized.includes('url(')
  );
}

function safeSvgAttrProps(el: globalThis.Element): Record<string, string> | null {
  const props: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('on')) return null;
    const propName = SAFE_SVG_ATTRS[attr.name];
    if (!propName || isUnsafeSvgAttributeValue(attr.value)) return null;
    props[propName] = attr.value;
  }
  return props;
}

function safeSvgElementFromDom(el: globalThis.Element, key: string): ReactElement | null {
  const tagName = el.tagName.toLowerCase();
  if (!SAFE_SVG_TAGS.has(tagName)) return null;
  const props = safeSvgAttrProps(el);
  if (!props) return null;
  const children = Array.from(el.children)
    .map((child, index) => safeSvgElementFromDom(child, `${key}-${index}`))
    .filter((child): child is ReactElement => child !== null);
  return createElement(tagName, { ...props, key }, ...children);
}

function safeSvgSourceElements(svgSource: string): ReactElement[] | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(`<svg>${svgSource}</svg>`, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  const root = doc.documentElement;
  const children = Array.from(root.children)
    .map((child, index) => safeSvgElementFromDom(child, `svg-source-${index}`))
    .filter((child): child is ReactElement => child !== null);
  return children.length > 0 ? children : null;
}

/**
 * Build an SVG `<pattern>` definition as React nodes for browser render paths.
 */
export function buildSvgHatchPatternElement(
  hatch: HatchPatternDef,
  screenRepeat: number,
  strokeColour: string,
  patternId = `hatch-${hatch.id}`,
): ReactElement | null {
  const sw = Math.max(0.3, hatch.strokeWidthMm * BASE_PIXELS_PER_MM);
  const r = screenRepeat;
  const rot = hatch.rotationDeg;
  const patternProps = {
    id: patternId,
    patternUnits: 'userSpaceOnUse',
    width: r,
    height: r,
    ...(rot !== 0 ? { patternTransform: `rotate(${rot})` } : {}),
  };

  switch (hatch.patternKind) {
    case 'lines':
      return createElement(
        'pattern',
        patternProps,
        createElement('line', {
          key: 'line-vertical',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: r,
          stroke: strokeColour,
          strokeWidth: sw,
        }),
      );

    case 'crosshatch':
      return createElement(
        'pattern',
        patternProps,
        createElement('line', {
          key: 'line-vertical',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: r,
          stroke: strokeColour,
          strokeWidth: sw,
        }),
        createElement('line', {
          key: 'line-horizontal',
          x1: 0,
          y1: 0,
          x2: r,
          y2: 0,
          stroke: strokeColour,
          strokeWidth: sw,
        }),
      );

    case 'dots': {
      const radius = Math.max(0.4, sw / 2);
      const half = r / 2;
      return createElement(
        'pattern',
        patternProps,
        createElement('circle', {
          key: 'dot',
          cx: half,
          cy: half,
          r: radius,
          fill: strokeColour,
        }),
      );
    }

    case 'curve': {
      const amp = r * 0.3;
      const mid = r / 2;
      return createElement(
        'pattern',
        patternProps,
        createElement('path', {
          key: 'wave',
          d: `M0 ${mid} C${r * 0.25} ${mid - amp},${r * 0.75} ${mid + amp},${r} ${mid}`,
          fill: 'none',
          stroke: strokeColour,
          strokeWidth: sw,
        }),
      );
    }

    case 'svg': {
      if (!hatch.svgSource) return null;
      const svgChildren = safeSvgSourceElements(hatch.svgSource);
      return svgChildren ? createElement('pattern', patternProps, ...svgChildren) : null;
    }

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
  const allHatches = { ...BUILT_IN_HATCH_DEFS, ...hatchesById };
  for (const id of usedHatchIds) {
    const hatch = allHatches[id];
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
