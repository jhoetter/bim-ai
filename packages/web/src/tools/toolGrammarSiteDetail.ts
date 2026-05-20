/* ────────────────────────────────────────────────────────────────────── */
/* Ramp — §8.7                                                               */
/* ────────────────────────────────────────────────────────────────────── */

export type RampState =
  | { phase: 'idle' }
  | { phase: 'placing-start' }
  | { phase: 'placing-end'; startMm: { xMm: number; yMm: number } };

export type RampEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface RampEffect {
  createRamp?: {
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
    widthMm: number;
    slopeRatio: number;
  };
  stillActive: boolean;
}

export const RAMP_DEFAULT_WIDTH_MM = 1200;
export const RAMP_DEFAULT_SLOPE_RATIO = 1 / 12;

export function initialRampState(): RampState {
  return { phase: 'idle' };
}

export function reduceRamp(
  state: RampState,
  event: RampEvent,
): { state: RampState; effect: RampEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialRampState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return { state: { phase: 'placing-start' }, effect: { stillActive: true } };
  }
  if (event.kind === 'cancel') {
    return { state: initialRampState(), effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    if (state.phase === 'placing-start' || state.phase === 'idle') {
      return {
        state: { phase: 'placing-end', startMm: event.pointMm },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'placing-end') {
      return {
        state: initialRampState(),
        effect: {
          createRamp: {
            startMm: state.startMm,
            endMm: event.pointMm,
            widthMm: RAMP_DEFAULT_WIDTH_MM,
            slopeRatio: RAMP_DEFAULT_SLOPE_RATIO,
          },
          stillActive: true,
        },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Graded Region — §5.1.6                                                  */
/* ────────────────────────────────────────────────────────────────────── */

export type GradedRegionState =
  | { phase: 'idle' }
  | { phase: 'sketching'; points: { xMm: number; yMm: number }[] };

export type GradedRegionEvent =
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface GradedRegionEffect {
  createGradedRegion?: {
    perimeterMm: { xMm: number; yMm: number }[];
    lowerElevationMm: number;
    upperElevationMm: number;
  };
  stillActive: boolean;
}

const GRADED_REGION_DEFAULT_LOWER_MM = 0;
const GRADED_REGION_DEFAULT_UPPER_MM = 500;

export function initialGradedRegionState(): GradedRegionState {
  return { phase: 'idle' };
}

export function reduceGradedRegion(
  state: GradedRegionState,
  event: GradedRegionEvent,
): { state: GradedRegionState; effect: GradedRegionEffect } {
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'click') {
    const points =
      state.phase === 'sketching'
        ? [...state.points, { xMm: event.xMm, yMm: event.yMm }]
        : [{ xMm: event.xMm, yMm: event.yMm }];
    return {
      state: { phase: 'sketching', points },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'commit') {
    if (state.phase !== 'sketching' || state.points.length < 3) {
      return { state, effect: { stillActive: true } };
    }
    return {
      state: { phase: 'idle' },
      effect: {
        createGradedRegion: {
          perimeterMm: state.points,
          lowerElevationMm: GRADED_REGION_DEFAULT_LOWER_MM,
          upperElevationMm: GRADED_REGION_DEFAULT_UPPER_MM,
        },
        stillActive: false,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Terrain Split — §5.1.6                                                  */
/* ────────────────────────────────────────────────────────────────────── */

export type TerrainSplitState =
  | { phase: 'idle' }
  | { phase: 'splitting'; toposolidId: string; points: { xMm: number; yMm: number }[] };

export type TerrainSplitEvent =
  | { kind: 'activate'; toposolidId: string }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface TerrainSplitEffect {
  splitTerrain?: {
    toposolidId: string;
    splitLineMm: { xMm: number; yMm: number }[];
  };
  stillActive: boolean;
}

export function initialTerrainSplitState(): TerrainSplitState {
  return { phase: 'idle' };
}

export function reduceTerrainSplit(
  state: TerrainSplitState,
  event: TerrainSplitEvent,
): { state: TerrainSplitState; effect: TerrainSplitEffect } {
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return {
      state: { phase: 'splitting', toposolidId: event.toposolidId, points: [] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'click') {
    if (state.phase !== 'splitting') {
      return { state, effect: { stillActive: false } };
    }
    return {
      state: { ...state, points: [...state.points, { xMm: event.xMm, yMm: event.yMm }] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'commit') {
    if (state.phase !== 'splitting' || state.points.length < 2) {
      return { state, effect: { stillActive: true } };
    }
    return {
      state: { phase: 'idle' },
      effect: {
        splitTerrain: {
          toposolidId: state.toposolidId,
          splitLineMm: state.points,
        },
        stillActive: false,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

// ---------------------------------------------------------------------------
// §8.6.3 — Stair by sketch grammar
// ---------------------------------------------------------------------------

export type StairSketchPhase = 'idle' | 'placing-start' | 'placing-corner' | 'placing-end';

export interface StairSketchState {
  phase: StairSketchPhase;
  startMm?: { xMm: number; yMm: number };
  cornerMm?: { xMm: number; yMm: number };
}

export type StairSketchEvent =
  | { kind: 'activate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'escape' };

export type StairSketchEffect =
  | {
      kind: 'createStair';
      startMm: { xMm: number; yMm: number };
      cornerMm: { xMm: number; yMm: number };
      endMm: { xMm: number; yMm: number };
    }
  | { kind: 'reset' };

export interface StairSketchResult {
  next: StairSketchState;
  effect?: StairSketchEffect;
}

export function initialStairSketchPhase(): StairSketchState {
  return { phase: 'idle' };
}

export function stairSketchReducer(
  state: StairSketchState,
  event: StairSketchEvent,
): StairSketchResult {
  if (event.kind === 'escape') {
    return { next: { phase: 'idle' }, effect: { kind: 'reset' } };
  }

  if (event.kind === 'activate') {
    return { next: { phase: 'placing-start' } };
  }

  if (event.kind === 'click') {
    if (state.phase === 'placing-start') {
      return { next: { phase: 'placing-corner', startMm: event.pointMm } };
    }
    if (state.phase === 'placing-corner') {
      return {
        next: { phase: 'placing-end', startMm: state.startMm, cornerMm: event.pointMm },
      };
    }
    if (state.phase === 'placing-end' && state.startMm && state.cornerMm) {
      return {
        next: { phase: 'idle' },
        effect: {
          kind: 'createStair',
          startMm: state.startMm,
          cornerMm: state.cornerMm,
          endMm: event.pointMm,
        },
      };
    }
  }

  return { next: state };
}

// ---------------------------------------------------------------------------
// §3.5.5 — Edit Wall Profile grammar
// ---------------------------------------------------------------------------

export type WallProfileState =
  | { phase: 'idle' }
  | { phase: 'editing'; wallId: string; points: { xPct: number; yPct: number }[] };

export type WallProfileEffect = {
  kind: 'commitWallProfile';
  wallId: string;
  points: { xPct: number; yPct: number }[];
};

export function initialWallProfileState(): WallProfileState {
  return { phase: 'idle' };
}

export function reduceWallProfile(
  state: WallProfileState,
  event: { type: string; [key: string]: unknown },
): { state: WallProfileState; effect?: WallProfileEffect } {
  switch (event.type) {
    case 'activate': {
      // Needs wallId from context
      const wallId = event.wallId as string | undefined;
      if (!wallId) return { state };
      return { state: { phase: 'editing', wallId, points: [] } };
    }
    case 'click': {
      if (state.phase !== 'editing') return { state };
      // Clamp to [0,1] range
      const xPct = Math.max(0, Math.min(1, (event.xPct as number | undefined) ?? 0.5));
      const yPct = Math.max(0, Math.min(1, (event.yPct as number | undefined) ?? 0.5));
      return { state: { ...state, points: [...state.points, { xPct, yPct }] } };
    }
    case 'confirm':
    case 'Enter': {
      if (state.phase !== 'editing' || state.points.length < 3) return { state };
      return {
        state: { phase: 'idle' },
        effect: { kind: 'commitWallProfile', wallId: state.wallId, points: state.points },
      };
    }
    case 'Escape':
    case 'deactivate':
      return { state: { phase: 'idle' } };
    default:
      return { state };
  }
}

// ---------------------------------------------------------------------------
// §8.6.2 — Stair by Component grammars
// ---------------------------------------------------------------------------

export type StairRunState =
  | { phase: 'idle' }
  | { phase: 'pick-stair' }
  | { phase: 'place-start'; stairId: string }
  | { phase: 'place-end'; stairId: string; startMm: { xMm: number; yMm: number } };

export type StairRunEffect = {
  kind: 'addStairRun';
  run: {
    stairId: string;
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
    runWidthMm: number;
    riserCount: number;
    runIndex: number;
  };
};

export function initialStairRunState(): StairRunState {
  return { phase: 'idle' };
}

export function reduceStairRun(
  state: StairRunState,
  event: { kind: string; [key: string]: unknown },
): { state: StairRunState; effect?: StairRunEffect } {
  switch (event.kind) {
    case 'activate':
      return { state: { phase: 'pick-stair' } };
    case 'click': {
      const pointMm = event.pointMm as { xMm: number; yMm: number };
      const elementId = event.elementId as string | undefined;
      if (state.phase === 'pick-stair') {
        if (!elementId) return { state };
        return { state: { phase: 'place-start', stairId: elementId } };
      }
      if (state.phase === 'place-start') {
        return { state: { phase: 'place-end', stairId: state.stairId, startMm: pointMm } };
      }
      if (state.phase === 'place-end') {
        return {
          state: { phase: 'idle' },
          effect: {
            kind: 'addStairRun',
            run: {
              stairId: state.stairId,
              startMm: state.startMm,
              endMm: pointMm,
              runWidthMm: 1200,
              riserCount: 10,
              runIndex: 0,
            },
          },
        };
      }
      return { state };
    }
    case 'escape':
    case 'deactivate':
      return { state: { phase: 'idle' } };
    default:
      return { state };
  }
}

export type StairLandingState =
  | { phase: 'idle' }
  | { phase: 'pick-stair' }
  | { phase: 'sketching'; stairId: string; points: { xMm: number; yMm: number }[] };

export type StairLandingEffect = {
  kind: 'addStairLanding';
  landing: {
    stairId: string;
    perimeterMm: { xMm: number; yMm: number }[];
    elevationMm: number;
    landingIndex: number;
  };
};

export function initialStairLandingState(): StairLandingState {
  return { phase: 'idle' };
}

export function reduceStairLanding(
  state: StairLandingState,
  event: { kind: string; [key: string]: unknown },
): { state: StairLandingState; effect?: StairLandingEffect } {
  switch (event.kind) {
    case 'activate':
      return { state: { phase: 'pick-stair' } };
    case 'click': {
      const pointMm = event.pointMm as { xMm: number; yMm: number };
      const elementId = event.elementId as string | undefined;
      if (state.phase === 'pick-stair') {
        if (!elementId) return { state };
        return { state: { phase: 'sketching', stairId: elementId, points: [] } };
      }
      if (state.phase === 'sketching') {
        return { state: { ...state, points: [...state.points, pointMm] } };
      }
      return { state };
    }
    case 'enter': {
      if (state.phase !== 'sketching' || state.points.length < 3) return { state };
      return {
        state: { phase: 'idle' },
        effect: {
          kind: 'addStairLanding',
          landing: {
            stairId: state.stairId,
            perimeterMm: state.points,
            elevationMm: 0,
            landingIndex: 0,
          },
        },
      };
    }
    case 'escape':
    case 'deactivate':
      return { state: { phase: 'idle' } };
    default:
      return { state };
  }
}

// ---------------------------------------------------------------------------
// §6.4.2 — Detail drafting grammars
// ---------------------------------------------------------------------------

export type DetailLineState =
  | { phase: 'idle' }
  | { phase: 'drawing'; points: { xMm: number; yMm: number }[] };

export type DetailLineEffect = {
  kind: 'createDetailLine';
  pointsMm: { xMm: number; yMm: number }[];
  lineStyle: 'solid';
};

export function initialDetailLineState(): DetailLineState {
  return { phase: 'idle' };
}

export function reduceDetailLine(
  state: DetailLineState,
  event: { kind: string; [key: string]: unknown },
): { state: DetailLineState; effect?: DetailLineEffect } {
  switch (event.kind) {
    case 'activate':
      return { state: { phase: 'drawing', points: [] } };
    case 'click': {
      if (state.phase !== 'drawing') return { state };
      const pointMm = event.pointMm as { xMm: number; yMm: number };
      return { state: { ...state, points: [...state.points, pointMm] } };
    }
    case 'commit': {
      if (state.phase !== 'drawing') return { state: { phase: 'idle' } };
      if (state.points.length < 2) return { state: { phase: 'idle' } };
      return {
        state: { phase: 'idle' },
        effect: { kind: 'createDetailLine', pointsMm: state.points, lineStyle: 'solid' },
      };
    }
    case 'cancel':
    case 'escape':
    case 'deactivate':
      return { state: { phase: 'idle' } };
    default:
      return { state };
  }
}

export type DetailFilledRegionState =
  | { phase: 'idle' }
  | { phase: 'sketching'; points: { xMm: number; yMm: number }[] };

export type DetailFilledRegionEffect = {
  kind: 'createDetailFilledRegion';
  perimeterMm: { xMm: number; yMm: number }[];
  fillPattern: 'solid';
};

export function initialDetailFilledRegionState(): DetailFilledRegionState {
  return { phase: 'idle' };
}

export function reduceDetailFilledRegion(
  state: DetailFilledRegionState,
  event: { kind: string; [key: string]: unknown },
): { state: DetailFilledRegionState; effect?: DetailFilledRegionEffect } {
  switch (event.kind) {
    case 'activate':
      return { state: { phase: 'sketching', points: [] } };
    case 'click': {
      if (state.phase !== 'sketching') return { state };
      const pointMm = event.pointMm as { xMm: number; yMm: number };
      return { state: { ...state, points: [...state.points, pointMm] } };
    }
    case 'commit': {
      if (state.phase !== 'sketching') return { state: { phase: 'idle' } };
      if (state.points.length < 3) return { state: { phase: 'idle' } };
      return {
        state: { phase: 'idle' },
        effect: {
          kind: 'createDetailFilledRegion',
          perimeterMm: state.points,
          fillPattern: 'solid',
        },
      };
    }
    case 'cancel':
    case 'escape':
    case 'deactivate':
      return { state: { phase: 'idle' } };
    default:
      return { state };
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/* Family Swept Blend — §15.1.2                                           */
/* ────────────────────────────────────────────────────────────────────── */

export type FamilySweptBlendState =
  | { phase: 'idle' }
  | { phase: 'recording-path'; points: Array<{ xMm: number; yMm: number }> };

export type FamilySweptBlendEvent =
  | { kind: 'activate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'confirm' }
  | { kind: 'cancel' };

export type FamilySweptBlendEffect = {
  kind: 'createFamilySweptBlend';
  pathMm: Array<{ xMm: number; yMm: number }>;
};

export function reduceFamilySweptBlend(
  state: FamilySweptBlendState,
  event: FamilySweptBlendEvent,
): { next: FamilySweptBlendState; effect?: FamilySweptBlendEffect } {
  switch (state.phase) {
    case 'idle':
      if (event.kind === 'activate') return { next: { phase: 'idle' } };
      if (event.kind === 'click')
        return {
          next: { phase: 'recording-path', points: [{ xMm: event.xMm, yMm: event.yMm }] },
        };
      return { next: state };
    case 'recording-path':
      if (event.kind === 'cancel') return { next: { phase: 'idle' } };
      if (event.kind === 'click')
        return {
          next: { ...state, points: [...state.points, { xMm: event.xMm, yMm: event.yMm }] },
        };
      if (event.kind === 'confirm' && state.points.length >= 2)
        return {
          next: { phase: 'idle' },
          effect: { kind: 'createFamilySweptBlend', pathMm: state.points },
        };
      return { next: state };
  }
}

// ---------------------------------------------------------------------------
// §3.3.4 — Cut Geometry 2-step grammar (pick cutter → pick host)
// ---------------------------------------------------------------------------

export type CutGeometryState = { phase: 'idle' } | { phase: 'picking-host'; cutterId: string };

export type CutGeometryEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'pick'; elementId: string }
  | { kind: 'cancel' };

export type CutGeometryEffect = { kind: 'commitCutGeometry'; cutterId: string; hostId: string };

export function reduceCutGeometry(
  state: CutGeometryState,
  event: CutGeometryEvent,
): { next: CutGeometryState; effect?: CutGeometryEffect } {
  switch (state.phase) {
    case 'idle':
      if (event.kind === 'activate') return { next: { phase: 'idle' } };
      if (event.kind === 'pick')
        return { next: { phase: 'picking-host', cutterId: event.elementId } };
      return { next: state };
    case 'picking-host':
      if (event.kind === 'cancel' || event.kind === 'deactivate')
        return { next: { phase: 'idle' } };
      if (event.kind === 'pick')
        return {
          next: { phase: 'idle' },
          effect: { kind: 'commitCutGeometry', cutterId: state.cutterId, hostId: event.elementId },
        };
      return { next: state };
  }
}
