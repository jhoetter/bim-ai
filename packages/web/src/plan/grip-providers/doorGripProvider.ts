/**
 * EDT-01 — door grip provider.
 *
 * A door rides its host wall at parameter `alongT ∈ [0, 1]`. The grip
 * sits at the door's current point on the wall; dragging projects the
 * cursor delta onto the wall's direction and converts that to a delta
 * in `alongT`. The numeric override interprets the typed value as a
 * distance (mm) from the wall's start.
 *
 * Both the drag-commit and the numeric-override emit
 * `updateElementProperty` on `alongT` so the engine path stays narrow
 * (no new command type required).
 */
import type { Element, XY } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type Door = Extract<Element, { kind: 'door' }>;
export type Wall = Extract<Element, { kind: 'wall' }>;

function findWall(door: Door, ctx: PlanContext): Wall | null {
  const host = ctx.elementsById?.[door.wallId];
  return host && host.kind === 'wall' ? host : null;
}

function pointOnWall(wall: Wall, t: number): XY {
  const clampedT = Math.min(1, Math.max(0, t));
  return {
    xMm: wall.start.xMm + (wall.end.xMm - wall.start.xMm) * clampedT,
    yMm: wall.start.yMm + (wall.end.yMm - wall.start.yMm) * clampedT,
  };
}

function wallLengthMm(wall: Wall): number {
  return Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
}

function deltaTFromDelta(wall: Wall, delta: XY): number {
  const len = wallLengthMm(wall);
  if (len === 0) return 0;
  const ux = (wall.end.xMm - wall.start.xMm) / len;
  const uy = (wall.end.yMm - wall.start.yMm) / len;
  return (delta.xMm * ux + delta.yMm * uy) / len;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export const doorGripProvider: ElementGripProvider<Door> = {
  grips(door: Door, context: PlanContext): GripDescriptor[] {
    const wall = findWall(door, context);
    if (!wall) return [];
    const len = wallLengthMm(wall);
    const slideGrip: GripDescriptor = {
      id: `${door.id}:alongT`,
      positionMm: pointOnWall(wall, door.alongT),
      shape: 'circle',
      axis: 'free',
      hint: 'Drag to slide along host wall',
      onDrag: () => ({ kind: 'unknown', id: door.id }),
      onCommit: (delta): GripCommand => {
        const nextT = clamp01(door.alongT + deltaTFromDelta(wall, delta));
        return {
          type: 'updateElementProperty',
          elementId: door.id,
          key: 'alongT',
          value: nextT,
        };
      },
      onNumericOverride: (absoluteMm): GripCommand => {
        const t = len > 0 ? clamp01(absoluteMm / len) : 0;
        return {
          type: 'updateElementProperty',
          elementId: door.id,
          key: 'alongT',
          value: t,
        };
      },
    };
    return [slideGrip];
  },
};
