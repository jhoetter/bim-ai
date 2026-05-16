/**
 * §4.2.5 — grip providers for permanent_dimension elements.
 *
 * Text-offset grip: drags the whole dim line by updating offsetMm.
 * Witness point grips: one per witness point, drag moves that point.
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type PermanentDimension = Extract<Element, { kind: 'permanent_dimension' }>;

function centroid(pts: { xMm: number; yMm: number }[]): { xMm: number; yMm: number } {
  const sum = pts.reduce((acc, p) => ({ xMm: acc.xMm + p.xMm, yMm: acc.yMm + p.yMm }), {
    xMm: 0,
    yMm: 0,
  });
  return { xMm: sum.xMm / pts.length, yMm: sum.yMm / pts.length };
}

export const permanentDimGripProvider: ElementGripProvider<PermanentDimension> = {
  grips(dim: PermanentDimension, _ctx: PlanContext): GripDescriptor[] {
    const c = centroid(dim.witnessPointsMm);

    const offsetGrip: GripDescriptor = {
      id: `${dim.id}:dim-offset`,
      positionMm: {
        xMm: c.xMm + dim.offsetMm.xMm,
        yMm: c.yMm + dim.offsetMm.yMm,
      },
      shape: 'square',
      axis: 'free',
      hint: 'Drag to move dimension line',
      onDrag: () => ({ kind: 'unknown', id: dim.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: dim.id,
        key: 'offsetMm',
        value: JSON.stringify({
          xMm: dim.offsetMm.xMm + delta.xMm,
          yMm: dim.offsetMm.yMm + delta.yMm,
        }),
      }),
      onNumericOverride: (absoluteMm): GripCommand => ({
        type: 'updateElementProperty',
        elementId: dim.id,
        key: 'offsetMm',
        value: JSON.stringify({ xMm: absoluteMm, yMm: dim.offsetMm.yMm }),
      }),
    };

    const witnessGrips: GripDescriptor[] = dim.witnessPointsMm.map((pt, i) => ({
      id: `${dim.id}:dim-witness-${i}`,
      positionMm: pt,
      shape: 'square',
      axis: 'free',
      hint: `Drag witness point ${i}`,
      onDrag: () => ({ kind: 'unknown', id: dim.id }),
      onCommit: (delta): GripCommand => ({
        type: 'updateElementProperty',
        elementId: dim.id,
        key: 'witnessPointsMm',
        value: JSON.stringify(
          dim.witnessPointsMm.map((p, j) =>
            j === i ? { xMm: p.xMm + delta.xMm, yMm: p.yMm + delta.yMm } : p,
          ),
        ),
      }),
      onNumericOverride: (absoluteMm): GripCommand => ({
        type: 'updateElementProperty',
        elementId: dim.id,
        key: 'witnessPointsMm',
        value: JSON.stringify(
          dim.witnessPointsMm.map((p, j) => (j === i ? { xMm: absoluteMm, yMm: p.yMm } : p)),
        ),
      }),
    }));

    return [offsetGrip, ...witnessGrips];
  },
};
