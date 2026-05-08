/**
 * ANN-V3-01 — rendering helpers for committed detail_region elements.
 *
 * Polyline (closed=false): open stroke annotation.
 * Closed region (closed=true): stroke + repeating 45° hatch fill.
 * Phase-demolished: dashed at 50% opacity using var(--draft-witness).
 *
 * CAN-V3-02 will replace the hatch stub with the full hatch library.
 */
import type { BimElem } from '@bim-ai/core';

export type DetailRegionPrimitive = {
  kind: 'detail_region';
  id: string;
  vertices: Array<{ x: number; y: number }>;
  closed: boolean;
  hatchId: string | null;
  lineweightOverride: number | null;
  phaseDemolished: string | null;
};

export function extractDetailRegionPrimitives(
  elementsById: Record<string, BimElem>,
  viewId: string | undefined,
): DetailRegionPrimitive[] {
  if (!viewId) return [];
  const out: DetailRegionPrimitive[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'detail_region') continue;
    const elViewId = el.viewId ?? el.hostViewId;
    if (elViewId !== viewId) continue;
    if (!el.vertices || el.vertices.length < 2) continue;
    out.push({
      kind: 'detail_region',
      id: el.id,
      vertices: el.vertices as Array<{ x: number; y: number }>,
      closed: el.closed ?? false,
      hatchId: el.hatchId ?? null,
      lineweightOverride: el.lineweightOverride ?? null,
      phaseDemolished: el.phaseDemolished ?? null,
    });
  }
  return out;
}

/**
 * Compute the SVG path `d` attribute for a detail region primitive.
 * Coordinates are in mm; caller applies the mm→px transform.
 */
export function detailRegionSvgPath(prim: DetailRegionPrimitive): string {
  if (prim.vertices.length === 0) return '';
  const [first, ...rest] = prim.vertices;
  let d = `M ${first.x} ${first.y}`;
  for (const v of rest) {
    d += ` L ${v.x} ${v.y}`;
  }
  if (prim.closed) d += ' Z';
  return d;
}

/**
 * Build a repeating-line SVG hatch pattern element string for closed regions.
 * Spacing is paper-mm-correct: 73 / (scale / 100) screen px at the given view scale.
 * CAN-V3-02 will replace this stub with the full hatch library.
 */
export function hatchPatternSvg(patternId: string, viewScale: number): string {
  const spacing = 73 / (viewScale / 100);
  return `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${spacing}" height="${spacing}" patternTransform="rotate(45)">
  <line x1="0" y1="0" x2="0" y2="${spacing}" stroke="currentColor" stroke-width="0.5"/>
</pattern>`;
}
