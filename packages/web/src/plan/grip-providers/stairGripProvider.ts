/**
 * §8.6.4 — stair grip provider.
 *
 * Two grips:
 *   1. Riser-count grip — sits at the top centre of the stair; dragging
 *      up/down adjusts riserCount by ±1 per 175 mm of movement.
 *   2. Run-width grip — sits on the right side of the stair; dragging
 *      left/right adjusts runWidthMm (floor: 600 mm).
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type Stair = Extract<Element, { kind: 'stair' }>;

/** Effective run depth in mm — derived from the legacy runStart/runEnd pair
 *  when the stair has no explicit `runs[]`. */
function runDepthMm(stair: Stair): number {
  const dx = stair.runEndMm.xMm - stair.runStartMm.xMm;
  const dy = stair.runEndMm.yMm - stair.runStartMm.yMm;
  return Math.hypot(dx, dy);
}

/** Effective riser count — falls back to legacy computation if `riserCount`
 *  is not set on the element. */
function effectiveRiserCount(stair: Stair): number {
  if (stair.riserCount != null) return stair.riserCount;
  const depth = runDepthMm(stair);
  const tread = stair.treadMm > 0 ? stair.treadMm : 280;
  return Math.max(2, Math.round(depth / tread));
}

/** Effective run width in mm — prefers `runWidthMm` then `widthMm`. */
function effectiveRunWidth(stair: Stair): number {
  return stair.runWidthMm ?? stair.widthMm;
}

export const stairGripProvider: ElementGripProvider<Stair> = {
  grips(stair: Stair, _context: PlanContext): GripDescriptor[] {
    const riserCount = effectiveRiserCount(stair);
    const runWidth = effectiveRunWidth(stair);
    const depth = runDepthMm(stair);
    const riserHeightMm = stair.riserHeightMm ?? stair.riserMm ?? 175;

    // Top-centre of the stair footprint (above the top landing).
    const riserGripPos = {
      xMm: stair.runStartMm.xMm,
      yMm: stair.runStartMm.yMm - depth,
    };

    const riserCountGrip: GripDescriptor = {
      id: `${stair.id}:riser-grip`,
      positionMm: riserGripPos,
      shape: 'arrow',
      axis: 'y',
      hint: 'Drag to change riser count',
      onDrag: () => ({ kind: 'unknown', id: stair.id }),
      onCommit: (delta): GripCommand => {
        const newCount = Math.max(2, riserCount + Math.round(-delta.yMm / 175));
        return {
          type: 'updateElementProperty',
          elementId: stair.id,
          key: 'riserCount',
          value: newCount,
        };
      },
      onNumericOverride: (absoluteMm): GripCommand => {
        // Typed value is interpreted as total height; back-compute count.
        const newCount = Math.max(2, Math.round(absoluteMm / riserHeightMm));
        return {
          type: 'updateElementProperty',
          elementId: stair.id,
          key: 'riserCount',
          value: newCount,
        };
      },
    };

    // Right-side mid-point of the stair footprint.
    const widthGripPos = {
      xMm: stair.runStartMm.xMm + runWidth,
      yMm: stair.runStartMm.yMm - depth / 2,
    };

    const runWidthGrip: GripDescriptor = {
      id: `${stair.id}:width-grip`,
      positionMm: widthGripPos,
      shape: 'arrow',
      axis: 'x',
      hint: 'Drag to change run width',
      onDrag: () => ({ kind: 'unknown', id: stair.id }),
      onCommit: (delta): GripCommand => {
        const newWidth = Math.max(600, runWidth + delta.xMm);
        return {
          type: 'updateElementProperty',
          elementId: stair.id,
          key: 'runWidthMm',
          value: newWidth,
        };
      },
      onNumericOverride: (absoluteMm): GripCommand => ({
        type: 'updateElementProperty',
        elementId: stair.id,
        key: 'runWidthMm',
        value: Math.max(600, absoluteMm),
      }),
    };

    return [riserCountGrip, runWidthGrip];
  },
};
