/**
 * F-077 — masking-region boundary edit grips.
 *
 * Revit's Edit Boundary workflow re-enters the placed region outline. In bim-ai
 * the selected masking region exposes one square grip per vertex; dragging a
 * grip commits an updateMaskingRegion with the edited polygon.
 */
import type { Element, XY } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type MaskingRegion = Extract<Element, { kind: 'masking_region' }>;

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

export const maskingRegionGripProvider: ElementGripProvider<MaskingRegion> = {
  grips(region: MaskingRegion, _context: PlanContext): GripDescriptor[] {
    return region.boundaryMm.map((vertex, i) => ({
      id: `${region.id}:mask-boundary:${i}`,
      positionMm: vertex,
      shape: 'square',
      axis: 'free',
      hint: 'Edit masking region boundary',
      onDrag: () => ({ kind: 'unknown', id: region.id }),
      onCommit: (delta): GripCommand => {
        const next: XY = {
          xMm: vertex.xMm + delta.xMm,
          yMm: vertex.yMm + delta.yMm,
        };
        return {
          type: 'updateMaskingRegion',
          maskingRegionId: region.id,
          boundaryMm: replaceVertex(region.boundaryMm, i, next),
        };
      },
      onNumericOverride: (absoluteMm): GripCommand => {
        const c = centroid(region.boundaryMm);
        const dx = vertex.xMm - c.xMm;
        const dy = vertex.yMm - c.yMm;
        const len = Math.hypot(dx, dy) || 1;
        const next: XY = {
          xMm: c.xMm + (dx / len) * absoluteMm,
          yMm: c.yMm + (dy / len) * absoluteMm,
        };
        return {
          type: 'updateMaskingRegion',
          maskingRegionId: region.id,
          boundaryMm: replaceVertex(region.boundaryMm, i, next),
        };
      },
    }));
  },
};
