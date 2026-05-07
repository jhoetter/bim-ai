/**
 * EDT-01 — floor grip provider.
 *
 * One vertex grip per `boundaryMm` corner. Drag commits an
 * `updateElementProperty` on `boundaryMm`, replacing the dragged
 * vertex immutably. Numeric override moves the vertex to an
 * absolute distance along the dragged axis from the polygon's
 * centroid; this is rarely used but keeps the provider consistent
 * with the wall protocol.
 */
import type { Element, XY } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type Floor = Extract<Element, { kind: 'floor' }>;

function replaceVertex(boundary: XY[], index: number, next: XY): XY[] {
  return boundary.map((v, i) => (i === index ? next : v));
}

function centroid(points: XY[]): XY {
  if (points.length === 0) return { xMm: 0, yMm: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.xMm;
    sy += p.yMm;
  }
  return { xMm: sx / points.length, yMm: sy / points.length };
}

export const floorGripProvider: ElementGripProvider<Floor> = {
  grips(floor: Floor, _context: PlanContext): GripDescriptor[] {
    return floor.boundaryMm.map((vertex, i) => {
      const grip: GripDescriptor = {
        id: `${floor.id}:vertex:${i}`,
        positionMm: vertex,
        shape: 'square',
        axis: 'free',
        hint: 'Drag floor vertex',
        onDrag: () => ({ kind: 'unknown', id: floor.id }),
        onCommit: (delta): GripCommand => {
          const next: XY = {
            xMm: vertex.xMm + delta.xMm,
            yMm: vertex.yMm + delta.yMm,
          };
          return {
            type: 'updateElementProperty',
            elementId: floor.id,
            key: 'boundaryMm',
            value: JSON.stringify(replaceVertex(floor.boundaryMm, i, next)),
          };
        },
        onNumericOverride: (absoluteMm): GripCommand => {
          // Numeric override = distance from centroid along the
          // vertex's outward radial direction. Keeps a single typed
          // value meaningful for a 2D vertex.
          const c = centroid(floor.boundaryMm);
          const dx = vertex.xMm - c.xMm;
          const dy = vertex.yMm - c.yMm;
          const len = Math.hypot(dx, dy) || 1;
          const next: XY = {
            xMm: c.xMm + (dx / len) * absoluteMm,
            yMm: c.yMm + (dy / len) * absoluteMm,
          };
          return {
            type: 'updateElementProperty',
            elementId: floor.id,
            key: 'boundaryMm',
            value: JSON.stringify(replaceVertex(floor.boundaryMm, i, next)),
          };
        },
      };
      return grip;
    });
  },
};
