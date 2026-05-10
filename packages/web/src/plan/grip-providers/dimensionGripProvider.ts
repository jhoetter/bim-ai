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

function unitAxis(a: XY, b: XY): { ux: number; uy: number } {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { ux: 1, uy: 0 };
  return { ux: dx / len, uy: dy / len };
}

export const dimensionGripProvider: ElementGripProvider<Dimension> = {
  grips(dim: Dimension, _context: PlanContext): GripDescriptor[] {
    const { nx, ny } = unitNormal(dim.aMm, dim.bMm);
    const { ux, uy } = unitAxis(dim.aMm, dim.bMm);

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

    // F-088 — text-label drag grip. Positioned at the current text label
    // centre (midpoint of aMm→bMm + offsetMm + textOffsetMm). Drag commits
    // are constrained to the dimension line axis so labels stay aligned with
    // the measured span.
    const textMidXMm = (dim.aMm.xMm + dim.bMm.xMm) / 2 + dim.offsetMm.xMm;
    const textMidYMm = (dim.aMm.yMm + dim.bMm.yMm) / 2 + dim.offsetMm.yMm;
    const currentTextOffsetX = dim.textOffsetMm?.xMm ?? 0;
    const currentTextOffsetY = dim.textOffsetMm?.yMm ?? 0;
    const textGrip: GripDescriptor = {
      id: `${dim.id}:text`,
      positionMm: {
        xMm: textMidXMm + currentTextOffsetX,
        yMm: textMidYMm + currentTextOffsetY,
      },
      shape: 'circle',
      axis: 'x',
      hint: 'Drag along dimension line to reposition text label',
      onDrag: () => ({ kind: 'unknown', id: dim.id }),
      onCommit: (delta): GripCommand => {
        const currentAlong = currentTextOffsetX * ux + currentTextOffsetY * uy;
        const draggedAlong = delta.xMm * ux + delta.yMm * uy;
        const nextAlong = currentAlong + draggedAlong;
        return {
          type: 'updateElementProperty',
          elementId: dim.id,
          key: 'textOffsetMm',
          value: JSON.stringify({
            xMm: ux * nextAlong,
            yMm: uy * nextAlong,
          }),
        };
      },
      onNumericOverride: (): GripCommand => ({
        // Numeric override not meaningful for a free-axis text grip;
        // return a no-op unknown command so the drag still cancels cleanly.
        type: 'updateElementProperty',
        elementId: dim.id,
        key: 'textOffsetMm',
        value: JSON.stringify({
          xMm: currentTextOffsetX,
          yMm: currentTextOffsetY,
        }),
      }),
    };

    return [anchorGrip, offsetGrip, textGrip];
  },
};
