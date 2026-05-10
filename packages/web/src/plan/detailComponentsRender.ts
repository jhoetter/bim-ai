/**
 * ANN-01 — pure rendering helpers for detail components.
 *
 * The plan canvas hosts three view-local 2D element kinds:
 *
 *   - `detail_line`    — open polyline (solid / dashed / dotted)
 *   - `detail_region`  — filled polygon with optional hatch pattern
 *   - `text_note`      — point-anchored label
 *
 * These elements are not visible in 3D. This module returns the
 * rendering primitives needed by the host renderer (three.js for the
 * plan canvas, SVG for the sheet preview). Each helper is pure and
 * easily unit-tested; the host wires them into a holder group.
 */
import type { Element, XY } from '@bim-ai/core';

export type DetailLinePrimitive = {
  kind: 'detail_line';
  id: string;
  pointsMm: XY[];
  strokeMm: number;
  colour: string;
  style: 'solid' | 'dashed' | 'dotted';
};

export type DetailRegionPrimitive = {
  kind: 'detail_region';
  id: string;
  boundaryMm: XY[];
  fillColour: string;
  fillPattern: 'solid' | 'hatch_45' | 'hatch_90' | 'crosshatch' | 'dots';
  strokeMm: number;
  strokeColour: string;
};

export type TextNotePrimitive = {
  kind: 'text_note';
  id: string;
  positionMm: XY;
  text: string;
  fontSizeMm: number;
  anchor: 'tl' | 'tc' | 'tr' | 'cl' | 'c' | 'cr' | 'bl' | 'bc' | 'br';
  rotationDeg: number;
  colour: string;
};

export type SpotElevationPrimitive = {
  kind: 'spot_elevation';
  id: string;
  positionMm: XY;
  elevationMm: number;
  prefix: string;
  suffix: string;
  colour: string;
};

export type RevisionCloudPrimitive = {
  kind: 'revision_cloud';
  id: string;
  boundaryMm: XY[];
  colour: string;
  strokeMm: number;
};

export type AngularDimensionPrimitive = {
  kind: 'angular_dimension';
  id: string;
  hostViewId: string;
  vertexMm: XY;
  rayAMm: XY;
  rayBMm: XY;
  arcRadiusMm: number;
  colour: string;
};

export type DetailComponentPrimitive =
  | DetailLinePrimitive
  | DetailRegionPrimitive
  | TextNotePrimitive
  | SpotElevationPrimitive
  | RevisionCloudPrimitive
  | AngularDimensionPrimitive;

/**
 * Walks `elementsById` and returns rendering primitives for every
 * detail-component element hosted on `viewId`. Elements hosted on a
 * different view are excluded so each plan view shows only its own
 * annotations.
 */
export function extractDetailComponentPrimitives(
  elementsById: Record<string, Element>,
  viewId: string | undefined,
): DetailComponentPrimitive[] {
  if (!viewId) return [];
  const out: DetailComponentPrimitive[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.kind === 'detail_line' && el.hostViewId === viewId) {
      out.push({
        kind: 'detail_line',
        id: el.id,
        pointsMm: el.pointsMm,
        strokeMm: el.strokeMm ?? 1.0,
        colour: el.colour ?? '#202020',
        style: el.style ?? 'solid',
      });
    } else if (el.kind === 'detail_region' && el.hostViewId === viewId) {
      out.push({
        kind: 'detail_region',
        id: el.id,
        boundaryMm: el.boundaryMm ?? [],
        fillColour: el.fillColour ?? '#cccccc',
        fillPattern: el.fillPattern ?? 'solid',
        strokeMm: el.strokeMm ?? 0.5,
        strokeColour: el.strokeColour ?? '#202020',
      });
    } else if (el.kind === 'text_note' && el.hostViewId === viewId) {
      out.push({
        kind: 'text_note',
        id: el.id,
        positionMm: el.positionMm,
        text: el.text,
        fontSizeMm: el.fontSizeMm,
        anchor: el.anchor ?? 'tl',
        rotationDeg: el.rotationDeg ?? 0,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'spot_elevation' && el.hostViewId === viewId) {
      out.push({
        kind: 'spot_elevation',
        id: el.id,
        positionMm: el.positionMm,
        elevationMm: el.elevationMm,
        prefix: el.prefix ?? '',
        suffix: el.suffix ?? '',
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'revision_cloud' && el.hostViewId === viewId) {
      out.push({
        kind: 'revision_cloud',
        id: el.id,
        boundaryMm: el.boundaryMm,
        colour: el.colour ?? '#e05000',
        strokeMm: el.strokeMm ?? 1.0,
      });
    } else if (el.kind === 'angular_dimension' && el.hostViewId === viewId) {
      out.push({
        kind: 'angular_dimension',
        id: el.id,
        hostViewId: el.hostViewId,
        vertexMm: el.vertexMm,
        rayAMm: el.rayAMm,
        rayBMm: el.rayBMm,
        arcRadiusMm: el.arcRadiusMm ?? 500,
        colour: el.colour ?? '#202020',
      });
    }
  }
  return out;
}

/**
 * Maps a `text_note.anchor` to the SVG `text-anchor` and `dominant-
 * baseline` attributes used by the sheet renderer. Pure — exposed so
 * downstream renderers can stay declarative.
 */
export function svgTextAnchorAttrs(anchor: TextNotePrimitive['anchor']): {
  textAnchor: 'start' | 'middle' | 'end';
  dominantBaseline: 'hanging' | 'middle' | 'baseline';
} {
  const horizontal = anchor[1];
  const vertical = anchor[0];
  const textAnchor = horizontal === 'l' ? 'start' : horizontal === 'r' ? 'end' : 'middle';
  const dominantBaseline = vertical === 't' ? 'hanging' : vertical === 'b' ? 'baseline' : 'middle';
  return { textAnchor, dominantBaseline };
}

/**
 * Returns the SVG `pattern` definition fragment for a detail-region
 * fill pattern at the supplied colour. Returns `null` for `'solid'`
 * because solid fills don't need a pattern element. The returned
 * fragment is pure data so callers can inline it into their SVG tree.
 */
export function svgFillPatternDef(
  pattern: DetailRegionPrimitive['fillPattern'],
  colour: string,
): { id: string; svg: string } | null {
  if (pattern === 'solid') return null;
  const id = `detail-pattern-${pattern}-${colour.replace('#', '')}`;
  if (pattern === 'hatch_45') {
    return {
      id,
      svg: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${colour}" stroke-width="1"/></pattern>`,
    };
  }
  if (pattern === 'hatch_90') {
    return {
      id,
      svg: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6"><line x1="0" y1="0" x2="0" y2="6" stroke="${colour}" stroke-width="1"/></pattern>`,
    };
  }
  if (pattern === 'crosshatch') {
    return {
      id,
      svg: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="M0 0L8 8M8 0L0 8" stroke="${colour}" stroke-width="0.8"/></pattern>`,
    };
  }
  // dots
  return {
    id,
    svg: `<pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6"><circle cx="3" cy="3" r="0.9" fill="${colour}"/></pattern>`,
  };
}

/**
 * Computes a 2D pixel offset from a (positionMm, anchor) pair given a
 * bounding rectangle (textWidthMm × textHeightMm). The returned offset
 * is what `text-anchor` / `dominant-baseline` cannot express in three.js
 * (which has no built-in text alignment).
 */
export function textNoteAnchorOffsetMm(
  anchor: TextNotePrimitive['anchor'],
  textWidthMm: number,
  textHeightMm: number,
): { dxMm: number; dyMm: number } {
  const horizontal = anchor[1];
  const vertical = anchor[0];
  const dxMm = horizontal === 'l' ? 0 : horizontal === 'r' ? -textWidthMm : -textWidthMm / 2;
  const dyMm = vertical === 't' ? -textHeightMm : vertical === 'b' ? 0 : -textHeightMm / 2;
  return { dxMm, dyMm };
}
