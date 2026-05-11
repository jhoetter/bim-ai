/**
 * EDT-03 — 3D direct-manipulation handles (load-bearing slice).
 *
 * Same protocol as the plan-canvas grip system (EDT-01) but in the 3D
 * viewport. A grip provider, registered per element kind, returns the
 * grip descriptors for a given element. The viewport raycasts grips
 * before elements so they take precedence on hover.
 *
 * This module is the pure data layer (no Three.js imports), so it is
 * unit-testable without the renderer. The Viewport React component
 * imports the registry to drive its raycast layer; the engine writes
 * back via the `onCommit` payload's command type.
 *
 * Slice scope:
 *   - Wall: top + bottom edge handles → topConstraintOffsetMm /
 *     baseConstraintOffsetMm (the load-bearing case from the seeded
 *     SSW viewpoint demo).
 *
 * Roof, floor, column / beam, and door / window grips are deferred to
 * follow-ups; the registration protocol below is forward-compatible
 * (any kind can opt-in by calling `register3dGripProvider`).
 */

export type Grip3dAxis = 'x' | 'y' | 'z' | 'xy' | 'xyz';

/** Where the grip is meant to render. Defaults to 'all' if unset. */
export type Grip3dVisibility = 'orbit' | 'elevation' | 'all';

export type Grip3dDescriptor = {
  /** Identifier unique within the parent element. */
  id: string;
  /**
   * Which property the grip mutates. Used by the renderer to pick a
   * glow colour and by the engine to dispatch the right command.
   */
  role: string;
  /** World-space anchor (millimetres). */
  position: { xMm: number; yMm: number; zMm: number };
  /** Drag axis in world space. */
  axis: Grip3dAxis;
  /** Inclusive drag range in millimetres relative to start position. */
  rangeMm: { minMm: number; maxMm: number };
  /** Optional render-context filter; renderers default to 'all'. */
  visibleIn?: Grip3dVisibility;
  /**
   * Pure mapping: live drag-distance → property delta payload that the
   * Viewport overlay uses to render the live preview.
   */
  onDrag: (deltaMm: number) => Grip3dDragPayload;
  /**
   * Pure mapping: final drag-distance → engine-command spec. The
   * Viewport hands this to the dispatcher; the engine validates and
   * either commits or rejects (constraints — EDT-02).
   */
  onCommit: (deltaMm: number) => Grip3dCommitSpec | null;
};

export type Grip3dDragPayload = {
  elementId: string;
  property: string;
  valueMm: number;
};

export type Grip3dCommitSpec = {
  type: string;
  payload: Record<string, unknown>;
};

export type Grip3dProvider<E = Record<string, unknown>> = (element: E) => Grip3dDescriptor[];

export type Grip3dProjectionInput = {
  axis: Grip3dAxis;
  startMm: { xMm: number; yMm: number; zMm: number };
  currentMm: { xMm: number; yMm: number; zMm: number };
  initialDeltaPx?: { x: number; y: number };
  shiftKey?: boolean;
};

export type Grip3dProjectionState = {
  dominantAxis?: 'x' | 'y' | 'z';
};

export type Grip3dProjectionResult = {
  deltaMm: { xMm: number; yMm: number; zMm: number };
  state: Grip3dProjectionState;
};

const REGISTRY = new Map<string, Grip3dProvider>();

export function register3dGripProvider<E = Record<string, unknown>>(
  kind: string,
  provider: Grip3dProvider<E>,
): void {
  REGISTRY.set(kind, provider as Grip3dProvider);
}

export function unregister3dGripProvider(kind: string): void {
  REGISTRY.delete(kind);
}

export function gripsFor(element: { kind?: string }): Grip3dDescriptor[] {
  if (!element || !element.kind) return [];
  const provider = REGISTRY.get(element.kind);
  if (!provider) return [];
  return provider(element as Record<string, unknown>);
}

export function clear3dGripProviders(): void {
  REGISTRY.clear();
}

function dominantAxisFromDelta(delta: { xMm: number; yMm: number; zMm: number }): 'x' | 'y' | 'z' {
  const ax = Math.abs(delta.xMm);
  const ay = Math.abs(delta.yMm);
  const az = Math.abs(delta.zMm);
  if (az >= ax && az >= ay) return 'z';
  return ax >= ay ? 'x' : 'y';
}

function pixelDeadzonePassed(deltaPx: { x: number; y: number } | undefined): boolean {
  if (!deltaPx) return true;
  return Math.hypot(deltaPx.x, deltaPx.y) >= 8;
}

/**
 * EDT-V3-08 — project a 3D grip ray intersection into a stable drag delta.
 *
 * `xy` keeps horizontal-plane movement only. `xyz` chooses a dominant axis
 * once the pointer moves past an 8px deadzone, then stays locked until the
 * caller resets `state`; Shift bypasses that lock for true free 3D motion.
 */
export function projectGripDelta(
  input: Grip3dProjectionInput,
  prev: Grip3dProjectionState = {},
): Grip3dProjectionResult {
  const raw = {
    xMm: input.currentMm.xMm - input.startMm.xMm,
    yMm: input.currentMm.yMm - input.startMm.yMm,
    zMm: input.currentMm.zMm - input.startMm.zMm,
  };

  switch (input.axis) {
    case 'x':
      return { deltaMm: { xMm: raw.xMm, yMm: 0, zMm: 0 }, state: prev };
    case 'y':
      return { deltaMm: { xMm: 0, yMm: raw.yMm, zMm: 0 }, state: prev };
    case 'z':
      return { deltaMm: { xMm: 0, yMm: 0, zMm: raw.zMm }, state: prev };
    case 'xy':
      return { deltaMm: { xMm: raw.xMm, yMm: raw.yMm, zMm: 0 }, state: prev };
    case 'xyz': {
      if (input.shiftKey) return { deltaMm: raw, state: prev };
      const dominant =
        prev.dominantAxis ??
        (pixelDeadzonePassed(input.initialDeltaPx) ? dominantAxisFromDelta(raw) : undefined);
      if (!dominant) return { deltaMm: { xMm: 0, yMm: 0, zMm: 0 }, state: prev };
      return {
        deltaMm: {
          xMm: dominant === 'x' ? raw.xMm : 0,
          yMm: dominant === 'y' ? raw.yMm : 0,
          zMm: dominant === 'z' ? raw.zMm : 0,
        },
        state: { dominantAxis: dominant },
      };
    }
  }
}

/**
 * Numerical helper used by every provider — clamp a drag delta to the
 * descriptor's allowed range. Pure so it is independently testable.
 */
export function clampDragDelta(deltaMm: number, range: { minMm: number; maxMm: number }): number {
  if (Number.isNaN(deltaMm)) return 0;
  if (deltaMm < range.minMm) return range.minMm;
  if (deltaMm > range.maxMm) return range.maxMm;
  return deltaMm;
}

// ---------- Wall provider (load-bearing slice) ------------------------------

type WallElementShape = {
  id: string;
  kind: 'wall';
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  heightMm: number;
  baseElevationMm?: number;
  baseConstraintOffsetMm?: number;
  topConstraintOffsetMm?: number;
};

const MIN_WALL_HEIGHT_MM = 100;
const MAX_WALL_HEIGHT_MM = 30_000;

/**
 * Anchor 3D handles at the wall's plan midpoint (so the grip is
 * visible on the cleanest face). Vertical offsets land at the current
 * top / base elevations of the wall.
 */
export function wallGripProvider(wall: WallElementShape): Grip3dDescriptor[] {
  const midX = (wall.start.xMm + wall.end.xMm) / 2;
  const midY = (wall.start.yMm + wall.end.yMm) / 2;
  const baseElevation = wall.baseElevationMm ?? 0;
  const baseOffset = wall.baseConstraintOffsetMm ?? 0;
  const topOffset = wall.topConstraintOffsetMm ?? 0;
  const baseZ = baseElevation + baseOffset;
  const topZ = baseElevation + wall.heightMm + topOffset;

  const topRange = {
    minMm: -(wall.heightMm - MIN_WALL_HEIGHT_MM),
    maxMm: MAX_WALL_HEIGHT_MM - wall.heightMm,
  };
  const baseRange = {
    minMm: -wall.heightMm + MIN_WALL_HEIGHT_MM,
    maxMm: wall.heightMm - MIN_WALL_HEIGHT_MM,
  };

  const topDescriptor: Grip3dDescriptor = {
    id: `${wall.id}/top`,
    role: 'topConstraintOffsetMm',
    position: { xMm: midX, yMm: midY, zMm: topZ },
    axis: 'z',
    rangeMm: topRange,
    onDrag: (delta) => ({
      elementId: wall.id,
      property: 'topConstraintOffsetMm',
      valueMm: topOffset + clampDragDelta(delta, topRange),
    }),
    onCommit: (delta) => {
      const clamped = clampDragDelta(delta, topRange);
      if (clamped === 0) return null;
      return {
        type: 'updateElementProperty',
        payload: {
          elementId: wall.id,
          property: 'topConstraintOffsetMm',
          valueMm: topOffset + clamped,
        },
      };
    },
  };

  const baseDescriptor: Grip3dDescriptor = {
    id: `${wall.id}/base`,
    role: 'baseConstraintOffsetMm',
    position: { xMm: midX, yMm: midY, zMm: baseZ },
    axis: 'z',
    rangeMm: baseRange,
    onDrag: (delta) => ({
      elementId: wall.id,
      property: 'baseConstraintOffsetMm',
      valueMm: baseOffset + clampDragDelta(delta, baseRange),
    }),
    onCommit: (delta) => {
      const clamped = clampDragDelta(delta, baseRange);
      if (clamped === 0) return null;
      return {
        type: 'updateElementProperty',
        payload: {
          elementId: wall.id,
          property: 'baseConstraintOffsetMm',
          valueMm: baseOffset + clamped,
        },
      };
    },
  };

  return [topDescriptor, baseDescriptor];
}

register3dGripProvider('wall', wallGripProvider as Grip3dProvider);
