/**
 * EDT-01 — universal grip protocol.
 *
 * Pure data-shape module. Element kinds opt in to in-place editing by
 * supplying an `ElementGripProvider`; the plan canvas raycasts the
 * grips before element pick so they take hover priority. This file
 * ships the wall provider as the load-bearing slice — door, window,
 * floor, column, beam, section grips are deferred (each is roughly
 * 0.5d of follow-up using this protocol).
 */
import type { Element, XY } from '@bim-ai/core';

/** A draft mutation produced by a grip during drag — used by the
 *  plan canvas to render a live preview before the command commits.
 *  Today only `wall` is wired; `unknown` lets future kinds slot in
 *  without a protocol change. */
export type DraftMutation =
  | {
      kind: 'wall';
      id: string;
      start: XY;
      end: XY;
      thicknessMm: number;
    }
  | { kind: 'unknown'; id: string };

/** Engine command shape — matches the JSON the
 *  `onSemanticCommand(cmd: Record<string, unknown>)` callback expects. */
export type GripCommand = Record<string, unknown>;

export interface GripDescriptor {
  id: string;
  positionMm: XY;
  shape: 'square' | 'circle' | 'arrow';
  axis: 'x' | 'y' | 'free' | 'normal_to_element';
  hint?: string;
  /** Live-preview mutation while dragging. Returns a draft element so
   *  the canvas can paint the in-flight geometry without committing. */
  onDrag: (deltaMm: XY) => DraftMutation;
  /** Commit-on-release. Returns the engine command. */
  onCommit: (deltaMm: XY) => GripCommand;
  /** Numeric override during drag. The interpretation of `absoluteMm`
   *  is grip-specific (e.g. wall length for an endpoint grip; new
   *  thickness for a thickness grip). */
  onNumericOverride: (absoluteMm: number) => GripCommand;
}

/** Per-element-kind context the provider may need (placeholder shape
 *  so each kind can extend without a protocol bump). */
export interface PlanContext {
  /** Currently-active level — drives whether off-level neighbours are
   *  considered for the grip-set. */
  activeLevelId?: string;
  /** Element lookup so kinds that depend on a host (e.g. a door's wall)
   *  can resolve it without the canvas wiring extra props. */
  elementsById?: Record<string, Element>;
}

export interface ElementGripProvider<E extends Element> {
  grips(element: E, context: PlanContext): GripDescriptor[];
}

/* ─── Wall provider ────────────────────────────────────────────────── */

export type Wall = Extract<Element, { kind: 'wall' }>;

function midpoint(a: XY, b: XY): XY {
  return { xMm: (a.xMm + b.xMm) / 2, yMm: (a.yMm + b.yMm) / 2 };
}

function lengthMm(a: XY, b: XY): number {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  return Math.hypot(dx, dy);
}

function unitNormal(a: XY, b: XY): XY {
  const dx = b.xMm - a.xMm;
  const dy = b.yMm - a.yMm;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { xMm: 0, yMm: 1 };
  // Rotate (dx, dy) by 90° CCW.
  return { xMm: -dy / len, yMm: dx / len };
}

/** Project (deltaX, deltaY) onto the unit normal `n`, returning the
 *  signed scalar magnitude. */
function projectOntoNormal(delta: XY, n: XY): number {
  return delta.xMm * n.xMm + delta.yMm * n.yMm;
}

export const wallGripProvider: ElementGripProvider<Wall> = {
  grips(wall: Wall): GripDescriptor[] {
    const start = wall.start;
    const end = wall.end;
    const mid = midpoint(start, end);
    const n = unitNormal(start, end);
    const halfT = wall.thicknessMm / 2;
    const thicknessHandlePos: XY = {
      xMm: mid.xMm + n.xMm * halfT,
      yMm: mid.yMm + n.yMm * halfT,
    };

    const startGrip: GripDescriptor = {
      id: `${wall.id}:start`,
      positionMm: start,
      shape: 'square',
      axis: 'free',
      hint: 'Drag start endpoint',
      onDrag: (delta) => ({
        kind: 'wall',
        id: wall.id,
        start: { xMm: start.xMm + delta.xMm, yMm: start.yMm + delta.yMm },
        end,
        thicknessMm: wall.thicknessMm,
      }),
      onCommit: (delta) => ({
        type: 'moveWallEndpoints',
        wallId: wall.id,
        start: { xMm: start.xMm + delta.xMm, yMm: start.yMm + delta.yMm },
        end: { xMm: end.xMm, yMm: end.yMm },
      }),
      onNumericOverride: (absoluteMm) => {
        // Interpret typed value as wall length anchored at `end`,
        // direction from `end` toward original `start`.
        const dirX = start.xMm - end.xMm;
        const dirY = start.yMm - end.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return {
          type: 'moveWallEndpoints',
          wallId: wall.id,
          start: {
            xMm: end.xMm + (dirX / len) * absoluteMm,
            yMm: end.yMm + (dirY / len) * absoluteMm,
          },
          end: { xMm: end.xMm, yMm: end.yMm },
        };
      },
    };

    const endGrip: GripDescriptor = {
      id: `${wall.id}:end`,
      positionMm: end,
      shape: 'square',
      axis: 'free',
      hint: 'Drag end endpoint',
      onDrag: (delta) => ({
        kind: 'wall',
        id: wall.id,
        start,
        end: { xMm: end.xMm + delta.xMm, yMm: end.yMm + delta.yMm },
        thicknessMm: wall.thicknessMm,
      }),
      onCommit: (delta) => ({
        type: 'moveWallEndpoints',
        wallId: wall.id,
        start: { xMm: start.xMm, yMm: start.yMm },
        end: { xMm: end.xMm + delta.xMm, yMm: end.yMm + delta.yMm },
      }),
      onNumericOverride: (absoluteMm) => {
        // Wall length anchored at `start`, direction toward original `end`.
        const dirX = end.xMm - start.xMm;
        const dirY = end.yMm - start.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return {
          type: 'moveWallEndpoints',
          wallId: wall.id,
          start: { xMm: start.xMm, yMm: start.yMm },
          end: {
            xMm: start.xMm + (dirX / len) * absoluteMm,
            yMm: start.yMm + (dirY / len) * absoluteMm,
          },
        };
      },
    };

    const moveGrip: GripDescriptor = {
      id: `${wall.id}:move`,
      positionMm: mid,
      shape: 'circle',
      axis: 'free',
      hint: 'Drag to move wall',
      onDrag: (delta) => ({
        kind: 'wall',
        id: wall.id,
        start: { xMm: start.xMm + delta.xMm, yMm: start.yMm + delta.yMm },
        end: { xMm: end.xMm + delta.xMm, yMm: end.yMm + delta.yMm },
        thicknessMm: wall.thicknessMm,
      }),
      onCommit: (delta) => ({
        type: 'moveWallDelta',
        wallId: wall.id,
        dxMm: delta.xMm,
        dyMm: delta.yMm,
      }),
      onNumericOverride: (absoluteMm) => {
        // Translate the wall by `absoluteMm` along its normal — the
        // canonical use of a midpoint grip with a typed override.
        return {
          type: 'moveWallDelta',
          wallId: wall.id,
          dxMm: n.xMm * absoluteMm,
          dyMm: n.yMm * absoluteMm,
        };
      },
    };

    const thicknessGrip: GripDescriptor = {
      id: `${wall.id}:thickness`,
      positionMm: thicknessHandlePos,
      shape: 'arrow',
      axis: 'normal_to_element',
      hint: 'Drag to change thickness',
      onDrag: (delta) => {
        const projected = projectOntoNormal(delta, n);
        const nextThickness = Math.max(20, wall.thicknessMm + 2 * projected);
        return {
          kind: 'wall',
          id: wall.id,
          start,
          end,
          thicknessMm: nextThickness,
        };
      },
      onCommit: (delta) => {
        const projected = projectOntoNormal(delta, n);
        const nextThickness = Math.max(20, wall.thicknessMm + 2 * projected);
        return {
          type: 'updateElementProperty',
          elementId: wall.id,
          key: 'thicknessMm',
          value: nextThickness,
        };
      },
      onNumericOverride: (absoluteMm) => ({
        type: 'updateElementProperty',
        elementId: wall.id,
        key: 'thicknessMm',
        value: Math.max(20, absoluteMm),
      }),
    };

    return [startGrip, endGrip, moveGrip, thicknessGrip];
  },
};

/** Convenience — single entry point used by PlanCanvas to look up the
 *  provider for a given element kind. Walls are wired here; other
 *  kinds are dispatched via `grip-providers/index.ts:gripsFor` so the
 *  per-kind providers can live in their own files without forcing this
 *  module to import every one. */
export function gripsFor(element: Element, context: PlanContext = {}): GripDescriptor[] {
  if (element.kind === 'wall') return wallGripProvider.grips(element, context);
  return [];
}

export { lengthMm, midpoint, unitNormal };
