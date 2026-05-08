/**
 * EDT-01 — temporary dimension protocol.
 *
 * For a selected element, emit dimension hints to the nearest
 * neighbour in each cardinal direction. The plan canvas paints the
 * targets as faint blue lines with a small lock icon. Clicking a
 * target persists the temp dim as a real `dimension` element. The
 * lock icon's toggle handler renders, but commits a no-op until
 * EDT-02 lands the constraint engine — see the `onLockToggle`
 * comment.
 */
import type { Element, XY } from '@bim-ai/core';

import { type GripCommand } from './gripProtocol';

export type Wall = Extract<Element, { kind: 'wall' }>;

export type TempDimDirection = 'x' | 'y';

export interface TempDimTarget {
  id: string;
  /** EDT-02 — the two wall ids this temp-dim measures between. The
   *  padlock handler authors a `createConstraint` between these. */
  aId: string;
  bId: string;
  fromMm: XY;
  toMm: XY;
  direction: TempDimDirection;
  /** Distance the dim measures (for the readout label). */
  distanceMm: number;
  /** Click → persist as a real dimension element. */
  onClick: () => GripCommand;
  /** Lock icon click. EDT-02 territory: renders the icon now but
   *  emits a no-op marker so callers can toast "Constraint locks land
   *  in EDT-02" rather than silently swallow the click. */
  onLockToggle: () => GripCommand;
}

function midpoint(a: XY, b: XY): XY {
  return { xMm: (a.xMm + b.xMm) / 2, yMm: (a.yMm + b.yMm) / 2 };
}

function isWall(el: Element): el is Wall {
  return el.kind === 'wall';
}

interface NeighbourSearchOpts {
  /** Active level — neighbours on other levels are excluded. */
  levelId?: string;
  /** Maximum search radius before we stop emitting a dim target. */
  maxDistanceMm?: number;
}

/** Find the nearest wall mid-point in each cardinal direction relative
 *  to the source wall's mid-point. Returns up to four candidates
 *  (left / right / above / below); directions with no neighbour are
 *  silently dropped. */
export function wallNeighbours(
  source: Wall,
  elements: Record<string, Element>,
  opts: NeighbourSearchOpts = {},
): {
  left?: { wall: Wall; distanceMm: number };
  right?: { wall: Wall; distanceMm: number };
  above?: { wall: Wall; distanceMm: number };
  below?: { wall: Wall; distanceMm: number };
} {
  const ref = midpoint(source.start, source.end);
  const max = opts.maxDistanceMm ?? Number.POSITIVE_INFINITY;
  let left: { wall: Wall; distanceMm: number } | undefined;
  let right: { wall: Wall; distanceMm: number } | undefined;
  let above: { wall: Wall; distanceMm: number } | undefined;
  let below: { wall: Wall; distanceMm: number } | undefined;
  for (const el of Object.values(elements)) {
    if (!isWall(el)) continue;
    if (el.id === source.id) continue;
    if (opts.levelId && el.levelId !== opts.levelId) continue;
    const m = midpoint(el.start, el.end);
    const dx = m.xMm - ref.xMm;
    const dy = m.yMm - ref.yMm;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Predominantly horizontal offset — left or right neighbour.
      const distance = Math.abs(dx);
      if (distance > max) continue;
      if (dx < 0) {
        if (!left || distance < left.distanceMm) left = { wall: el, distanceMm: distance };
      } else if (dx > 0) {
        if (!right || distance < right.distanceMm) right = { wall: el, distanceMm: distance };
      }
    } else if (Math.abs(dy) > 0) {
      const distance = Math.abs(dy);
      if (distance > max) continue;
      if (dy < 0) {
        if (!above || distance < above.distanceMm) above = { wall: el, distanceMm: distance };
      } else if (dy > 0) {
        if (!below || distance < below.distanceMm) below = { wall: el, distanceMm: distance };
      }
    }
  }
  return { left, right, above, below };
}

/** Build the full set of temp-dim targets for a selected wall. The
 *  click handlers commit `createDimension` against the active level;
 *  the lock handler emits an EDT-02 placeholder advisory. */
export function wallTempDimensions(
  source: Wall,
  elements: Record<string, Element>,
  opts: NeighbourSearchOpts = {},
): TempDimTarget[] {
  const neighbours = wallNeighbours(source, elements, opts);
  const ref = midpoint(source.start, source.end);
  const lvlId = source.levelId;
  const targets: TempDimTarget[] = [];

  const push = (
    direction: TempDimDirection,
    suffix: string,
    other: XY,
    distanceMm: number,
    bId: string,
  ) => {
    const fromMm = { xMm: ref.xMm, yMm: ref.yMm };
    const toMm = { xMm: other.xMm, yMm: other.yMm };
    targets.push({
      id: `${source.id}:tempdim:${suffix}`,
      aId: source.id,
      bId,
      fromMm,
      toMm,
      direction,
      distanceMm,
      onClick: () => ({
        type: 'createDimension',
        levelId: lvlId,
        aMm: fromMm,
        bMm: toMm,
        offsetMm: { xMm: 0, yMm: 0 },
      }),
      onLockToggle: () => ({
        // EDT-02 territory — render the icon but emit a no-op so the
        // canvas can show a tooltip instead of silently swallowing the
        // click. Workspace consumers should match `type` to skip dispatch.
        type: 'tempDimLockToggleNoop',
        elementId: source.id,
        suffix,
        message: 'Constraint locks land in EDT-02',
      }),
    });
  };

  if (neighbours.left) {
    const m = midpoint(neighbours.left.wall.start, neighbours.left.wall.end);
    push('x', 'left', m, neighbours.left.distanceMm, neighbours.left.wall.id);
  }
  if (neighbours.right) {
    const m = midpoint(neighbours.right.wall.start, neighbours.right.wall.end);
    push('x', 'right', m, neighbours.right.distanceMm, neighbours.right.wall.id);
  }
  if (neighbours.above) {
    const m = midpoint(neighbours.above.wall.start, neighbours.above.wall.end);
    push('y', 'above', m, neighbours.above.distanceMm, neighbours.above.wall.id);
  }
  if (neighbours.below) {
    const m = midpoint(neighbours.below.wall.start, neighbours.below.wall.end);
    push('y', 'below', m, neighbours.below.distanceMm, neighbours.below.wall.id);
  }

  return targets;
}

/** Convenience entry point — returns dim targets for the given
 *  element kind, falling back to an empty list for kinds not yet
 *  wired by EDT-01. */
export function tempDimensionsFor(
  element: Element,
  elements: Record<string, Element>,
  opts: NeighbourSearchOpts = {},
): TempDimTarget[] {
  if (element.kind === 'wall')
    return wallTempDimensions(element, elements, { levelId: element.levelId, ...opts });
  return [];
}
