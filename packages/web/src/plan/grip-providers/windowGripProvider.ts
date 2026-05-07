/**
 * EDT-01 — window grip provider.
 *
 * Mirrors the door provider: an alongT slide grip on the host wall.
 * Sill-height belongs in elevation view (EDT-03 territory) and is not
 * surfaced here.
 */
import type { Element, XY } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type Window = Extract<Element, { kind: 'window' }>;
export type Wall = Extract<Element, { kind: 'wall' }>;

function findWall(win: Window, ctx: PlanContext): Wall | null {
  const host = ctx.elementsById?.[win.wallId];
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

export const windowGripProvider: ElementGripProvider<Window> = {
  grips(win: Window, context: PlanContext): GripDescriptor[] {
    const wall = findWall(win, context);
    if (!wall) return [];
    const len = wallLengthMm(wall);
    const slideGrip: GripDescriptor = {
      id: `${win.id}:alongT`,
      positionMm: pointOnWall(wall, win.alongT),
      shape: 'circle',
      axis: 'free',
      hint: 'Drag to slide along host wall',
      onDrag: () => ({ kind: 'unknown', id: win.id }),
      onCommit: (delta): GripCommand => {
        const nextT = clamp01(win.alongT + deltaTFromDelta(wall, delta));
        return {
          type: 'updateElementProperty',
          elementId: win.id,
          key: 'alongT',
          value: nextT,
        };
      },
      onNumericOverride: (absoluteMm): GripCommand => {
        const t = len > 0 ? clamp01(absoluteMm / len) : 0;
        return {
          type: 'updateElementProperty',
          elementId: win.id,
          key: 'alongT',
          value: t,
        };
      },
    };
    return [slideGrip];
  },
};
