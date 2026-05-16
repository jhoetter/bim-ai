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

export type AnnotationSymbolPrimitive = {
  kind: 'annotation_symbol';
  id: string;
  positionMm: XY;
  symbolType: 'north_arrow' | 'stair_up' | 'stair_down' | 'centerline';
  rotationDeg: number;
  scale: number;
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

export type RadialDimensionPrimitive = {
  kind: 'radial_dimension';
  id: string;
  centerMm: XY;
  arcPointMm: XY;
  colour: string;
};

export type DiameterDimensionPrimitive = {
  kind: 'diameter_dimension';
  id: string;
  centerMm: XY;
  arcPointMm: XY;
  colour: string;
};

export type ArcLengthDimensionPrimitive = {
  kind: 'arc_length_dimension';
  id: string;
  centerMm: XY;
  radiusMm: number;
  startAngleDeg: number;
  endAngleDeg: number;
  colour: string;
};

export type SpotCoordinatePrimitive = {
  kind: 'spot_coordinate';
  id: string;
  positionMm: XY;
  northMm: number;
  eastMm: number;
  colour: string;
};

export type SpotSlopePrimitive = {
  kind: 'spot_slope';
  id: string;
  positionMm: XY;
  slopePct: number;
  slopeFormat: 'percent' | 'ratio' | 'degree';
  colour: string;
};

export type InsulationAnnotationPrimitive = {
  kind: 'insulation_annotation';
  id: string;
  startMm: XY;
  endMm: XY;
  widthMm: number;
  colour: string;
};

export type MaterialTagPrimitive = {
  kind: 'material_tag';
  id: string;
  positionMm: XY;
  hostElementId: string;
  layerIndex: number;
  textOverride: string | null;
  colour: string;
};

export type MultiCategoryTagPrimitive = {
  kind: 'multi_category_tag';
  id: string;
  positionMm: XY;
  hostElementId: string;
  parameterName: string;
  textOverride: string | null;
  colour: string;
};

export type TreadNumberPrimitive = {
  kind: 'tread_number';
  id: string;
  stairElementId: string;
  startNumber: number;
  colour: string;
};

export type KeynotePrimitive = {
  kind: 'keynote';
  id: string;
  positionMm: XY;
  keynoteKey: string;
  keynoteText: string;
  target: 'element' | 'material' | 'user';
  hostElementId: string | null;
  colour: string;
};

export type SpanDirectionPrimitive = {
  kind: 'span_direction';
  id: string;
  positionMm: XY;
  directionDeg: number;
  lengthMm: number;
  colour: string;
};

export type PipeLegendPrimitive = {
  kind: 'pipe_legend';
  id: string;
  positionMm: XY;
  title: string;
  entries: { systemType: string; label: string; colour: string }[];
};

export type DuctLegendPrimitive = {
  kind: 'duct_legend';
  id: string;
  positionMm: XY;
  title: string;
  entries: { systemType: string; label: string; colour: string }[];
};

export type PlacedDetailComponentPrimitive = {
  kind: 'detail_component';
  id: string;
  positionMm: XY;
  componentShape: string;
  rotationDeg: number;
  scale: number;
  colour: string;
};

export type RepeatingDetailPrimitive = {
  kind: 'repeating_detail';
  id: string;
  startMm: XY;
  endMm: XY;
  componentShape: string;
  spacingMm: number;
  colour: string;
};

export type DetailGroupPrimitive = {
  kind: 'detail_group';
  id: string;
  name: string;
  memberIds: string[];
};

export type ColorFillLegendPrimitive = {
  kind: 'color_fill_legend';
  id: string;
  positionMm: XY;
  schemeParameter: string;
  title: string;
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

export type LeaderTextPrimitive = {
  kind: 'leader_text';
  id: string;
  anchorMm: XY;
  elbowMm: XY | null;
  textMm: XY;
  content: string;
  arrowStyle: 'arrow' | 'dot' | 'none';
  colour: string;
};

export type DetailComponentPrimitive =
  | DetailLinePrimitive
  | DetailRegionPrimitive
  | TextNotePrimitive
  | AnnotationSymbolPrimitive
  | SpotElevationPrimitive
  | RadialDimensionPrimitive
  | DiameterDimensionPrimitive
  | ArcLengthDimensionPrimitive
  | MaterialTagPrimitive
  | MultiCategoryTagPrimitive
  | TreadNumberPrimitive
  | KeynotePrimitive
  | SpanDirectionPrimitive
  | PipeLegendPrimitive
  | DuctLegendPrimitive
  | PlacedDetailComponentPrimitive
  | RepeatingDetailPrimitive
  | DetailGroupPrimitive
  | ColorFillLegendPrimitive
  | SpotCoordinatePrimitive
  | SpotSlopePrimitive
  | InsulationAnnotationPrimitive
  | RevisionCloudPrimitive
  | AngularDimensionPrimitive
  | LeaderTextPrimitive;

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
    } else if (el.kind === 'annotation_symbol' && el.hostViewId === viewId) {
      out.push({
        kind: 'annotation_symbol',
        id: el.id,
        positionMm: el.positionMm,
        symbolType: el.symbolType,
        rotationDeg: el.rotationDeg ?? 0,
        scale: el.scale ?? 1,
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
    } else if (el.kind === 'radial_dimension' && el.hostViewId === viewId) {
      out.push({
        kind: 'radial_dimension',
        id: el.id,
        centerMm: el.centerMm,
        arcPointMm: el.arcPointMm,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'diameter_dimension' && el.hostViewId === viewId) {
      out.push({
        kind: 'diameter_dimension',
        id: el.id,
        centerMm: el.centerMm,
        arcPointMm: el.arcPointMm,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'arc_length_dimension' && el.hostViewId === viewId) {
      out.push({
        kind: 'arc_length_dimension',
        id: el.id,
        centerMm: el.centerMm,
        radiusMm: el.radiusMm,
        startAngleDeg: el.startAngleDeg,
        endAngleDeg: el.endAngleDeg,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'material_tag' && el.hostViewId === viewId) {
      out.push({
        kind: 'material_tag',
        id: el.id,
        positionMm: el.positionMm,
        hostElementId: el.hostElementId,
        layerIndex: el.layerIndex ?? 0,
        textOverride: el.textOverride ?? null,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'multi_category_tag' && el.hostViewId === viewId) {
      out.push({
        kind: 'multi_category_tag',
        id: el.id,
        positionMm: el.positionMm,
        hostElementId: el.hostElementId,
        parameterName: el.parameterName ?? 'Type Mark',
        textOverride: el.textOverride ?? null,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'tread_number' && el.hostViewId === viewId) {
      out.push({
        kind: 'tread_number',
        id: el.id,
        stairElementId: el.stairElementId,
        startNumber: el.startNumber ?? 1,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'keynote' && el.hostViewId === viewId) {
      out.push({
        kind: 'keynote',
        id: el.id,
        positionMm: el.positionMm,
        keynoteKey: el.keynoteKey,
        keynoteText: el.keynoteText ?? '',
        target: el.target ?? 'user',
        hostElementId: el.hostElementId ?? null,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'span_direction' && el.hostViewId === viewId) {
      out.push({
        kind: 'span_direction',
        id: el.id,
        positionMm: el.positionMm,
        directionDeg: el.directionDeg ?? 0,
        lengthMm: el.lengthMm ?? 800,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'pipe_legend' && el.hostViewId === viewId) {
      out.push({
        kind: 'pipe_legend',
        id: el.id,
        positionMm: el.positionMm,
        title: el.title ?? 'Pipe Legend',
        entries: el.entries ?? [],
      });
    } else if (el.kind === 'duct_legend' && el.hostViewId === viewId) {
      out.push({
        kind: 'duct_legend',
        id: el.id,
        positionMm: el.positionMm,
        title: el.title ?? 'Duct Legend',
        entries: el.entries ?? [],
      });
    } else if (el.kind === 'detail_component' && el.hostViewId === viewId) {
      out.push({
        kind: 'detail_component',
        id: el.id,
        positionMm: el.positionMm,
        componentShape: el.componentShape,
        rotationDeg: el.rotationDeg ?? 0,
        scale: el.scale ?? 1,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'repeating_detail' && el.hostViewId === viewId) {
      out.push({
        kind: 'repeating_detail',
        id: el.id,
        startMm: el.startMm,
        endMm: el.endMm,
        componentShape: el.componentShape,
        spacingMm: el.spacingMm ?? 200,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'detail_group' && el.hostViewId === viewId) {
      out.push({
        kind: 'detail_group',
        id: el.id,
        name: el.name ?? 'Group',
        memberIds: el.memberIds ?? [],
      });
    } else if (el.kind === 'color_fill_legend' && el.hostViewId === viewId) {
      out.push({
        kind: 'color_fill_legend',
        id: el.id,
        positionMm: el.positionMm,
        schemeParameter: el.schemeParameter ?? 'Name',
        title: el.title ?? 'Color Fill Legend',
      });
    } else if (el.kind === 'spot_coordinate' && el.hostViewId === viewId) {
      out.push({
        kind: 'spot_coordinate',
        id: el.id,
        positionMm: el.positionMm,
        northMm: el.northMm,
        eastMm: el.eastMm,
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'spot_slope' && el.hostViewId === viewId) {
      out.push({
        kind: 'spot_slope',
        id: el.id,
        positionMm: el.positionMm,
        slopePct: el.slopePct,
        slopeFormat: el.slopeFormat ?? 'percent',
        colour: el.colour ?? '#202020',
      });
    } else if (el.kind === 'insulation_annotation' && el.hostViewId === viewId) {
      out.push({
        kind: 'insulation_annotation',
        id: el.id,
        startMm: el.startMm,
        endMm: el.endMm,
        widthMm: el.widthMm ?? 200.0,
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
    } else if (el.kind === 'leader_text' && el.hostViewId === viewId) {
      out.push({
        kind: 'leader_text',
        id: el.id,
        anchorMm: el.anchorMm,
        elbowMm: el.elbowMm ?? null,
        textMm: el.textMm,
        content: el.content,
        arrowStyle: el.arrowStyle ?? 'arrow',
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
