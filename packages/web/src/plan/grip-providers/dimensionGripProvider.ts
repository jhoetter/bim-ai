/**
 * EDT-01 — dimension grip provider.
 *
 * Two grips: an anchor on the dimensioned start point (`aMm`) and an
 * offset grip that moves the dim line perpendicular to the
 * measurement axis. The offset grip projects drag deltas onto the
 * unit normal of (a → b) so the user can only push the dimension
 * up / down (away from the measured edge), never along it.
 */
import type { Element, XY } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type Dimension = Extract<Element, { kind: 'dimension' }>;

function unitNormal(a: XY, b: XY): { nx: number; ny: number } {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { nx: 0, ny: 1 };
  return { nx: -dy / len, ny: dx / len };
}

export const dimensionGripProvider: ElementGripProvider<Dimension> = {
  grips(dim: Dimension, _context: PlanContext): GripDescriptor[] {
    const { nx, ny } = unitNormal(dim.aMm, dim.bMm);

    const anchorGrip: GripDescriptor = {
      id: `${dim.id}:anchor`,
      positionMm: dim.aMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag dimension start',
      onDrag: () => ({ kind: 'unknown', id: dim.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: dim.id,
        key: 'aMm',
        value: JSON.stringify({
          xMm: dim.aMm.xMm + delta.xMm,
          yMm: dim.aMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => {
        // Numeric override = X coordinate; Y left unchanged. Same
        // grammar as the column position grip.
        return {
          type: 'updateElementProperty',
          elementId: dim.id,
          key: 'aMm',
          value: JSON.stringify({ xMm: absoluteMm, yMm: dim.aMm.yMm }),
        };
      },
    };

    const offsetGrip: GripDescriptor = {
      id: `${dim.id}:offset`,
      positionMm: {
        xMm: (dim.aMm.xMm + dim.bMm.xMm) / 2 + dim.offsetMm.xMm,
        yMm: (dim.aMm.yMm + dim.bMm.yMm) / 2 + dim.offsetMm.yMm,
      },
      shape: 'arrow',
      axis: 'normal_to_element',
      hint: 'Drag perpendicular to move dim line',
      onDrag: () => ({ kind: 'unknown', id: dim.id }),
      onCommit: (delta): GripCommand => {
        const projected = delta.xMm * nx + delta.yMm * ny;
        return {
          type: 'updateElementProperty',
          elementId: dim.id,
          key: 'offsetMm',
          value: JSON.stringify({
            xMm: dim.offsetMm.xMm + nx * projected,
            yMm: dim.offsetMm.yMm + ny * projected,
          }),
        };
      },
      onNumericOverride: (absoluteMm): GripCommand => ({
        // Numeric override = perpendicular distance from the measured
        // segment (signed along the unit normal).
        type: 'updateElementProperty',
        elementId: dim.id,
        key: 'offsetMm',
        value: JSON.stringify({
          xMm: nx * absoluteMm,
          yMm: ny * absoluteMm,
        }),
      }),
    };

    return [anchorGrip, offsetGrip];
  },
};
