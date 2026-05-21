// Annotation, array, scale, roof-by-extrusion, revision cloud, and decal reducers
// extracted from toolGrammar.ts.

/* ────────────────────────────────────────────────────────────────────── */
/* Text Annotation — single-click to place, then type text and confirm    */
/* ────────────────────────────────────────────────────────────────────── */

export type TextAnnotationState =
  | { phase: 'idle' }
  | {
      phase: 'typing';
      positionMm: { xMm: number; yMm: number };
      draft: string;
    };

export type TextAnnotationEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'type'; char: string }
  | { kind: 'backspace' }
  | { kind: 'confirm' }
  | { kind: 'cancel' };

export interface TextAnnotationEffect {
  commitText?: { positionMm: { xMm: number; yMm: number }; content: string };
  stillActive: boolean;
}

export function initialTextAnnotationState(): TextAnnotationState {
  return { phase: 'idle' };
}

export function reduceTextAnnotation(
  state: TextAnnotationState,
  event: TextAnnotationEvent,
): { state: TextAnnotationState; effect: TextAnnotationEffect } {
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'click' && state.phase === 'idle') {
    return {
      state: { phase: 'typing', positionMm: event.pointMm, draft: '' },
      effect: { stillActive: true },
    };
  }
  if (state.phase === 'typing') {
    if (event.kind === 'type') {
      return {
        state: { ...state, draft: state.draft + event.char },
        effect: { stillActive: true },
      };
    }
    if (event.kind === 'backspace') {
      return {
        state: { ...state, draft: state.draft.slice(0, -1) },
        effect: { stillActive: true },
      };
    }
    if (event.kind === 'confirm') {
      return {
        state: { phase: 'idle' },
        effect: {
          commitText: { positionMm: state.positionMm, content: state.draft },
          stillActive: true,
        },
      };
    }
  }
  return { state, effect: { stillActive: state.phase !== 'idle' } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Leader Text — 3-click: anchor → elbow → text position, then type       */
/* ────────────────────────────────────────────────────────────────────── */

export type LeaderTextState =
  | { phase: 'idle' }
  | { phase: 'anchor'; anchorMm: { xMm: number; yMm: number } }
  | {
      phase: 'text-pos';
      anchorMm: { xMm: number; yMm: number };
      elbowMm: { xMm: number; yMm: number };
    }
  | {
      phase: 'typing';
      anchorMm: { xMm: number; yMm: number };
      elbowMm: { xMm: number; yMm: number };
      textMm: { xMm: number; yMm: number };
      draft: string;
    };

export type LeaderTextEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'type'; char: string }
  | { kind: 'backspace' }
  | { kind: 'confirm' }
  | { kind: 'cancel' };

export interface LeaderTextEffect {
  commitLeader?: {
    anchorMm: { xMm: number; yMm: number };
    elbowMm: { xMm: number; yMm: number };
    textMm: { xMm: number; yMm: number };
    content: string;
  };
  stillActive: boolean;
}

export function initialLeaderTextState(): LeaderTextState {
  return { phase: 'idle' };
}

export function reduceLeaderText(
  state: LeaderTextState,
  event: LeaderTextEvent,
): { state: LeaderTextState; effect: LeaderTextEffect } {
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: { phase: 'anchor', anchorMm: event.pointMm },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'anchor') {
      return {
        state: {
          phase: 'text-pos',
          anchorMm: state.anchorMm,
          elbowMm: event.pointMm,
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'text-pos') {
      return {
        state: {
          phase: 'typing',
          anchorMm: state.anchorMm,
          elbowMm: state.elbowMm,
          textMm: event.pointMm,
          draft: '',
        },
        effect: { stillActive: true },
      };
    }
  }
  if (state.phase === 'typing') {
    if (event.kind === 'type') {
      return {
        state: { ...state, draft: state.draft + event.char },
        effect: { stillActive: true },
      };
    }
    if (event.kind === 'backspace') {
      return {
        state: { ...state, draft: state.draft.slice(0, -1) },
        effect: { stillActive: true },
      };
    }
    if (event.kind === 'confirm') {
      return {
        state: { phase: 'idle' },
        effect: {
          commitLeader: {
            anchorMm: state.anchorMm,
            elbowMm: state.elbowMm,
            textMm: state.textMm,
            content: state.draft,
          },
          stillActive: true,
        },
      };
    }
  }
  return { state, effect: { stillActive: state.phase !== 'idle' } };
}

export type AngularDimensionState =
  | { phase: 'idle' }
  | { phase: 'first-ray'; p1xMm: number; p1yMm: number }
  | { phase: 'second-ray'; p1xMm: number; p1yMm: number; p2xMm: number; p2yMm: number };
export type AngularDimensionEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'cancel' };
export interface AngularDimensionEffect {
  commitAngular?: {
    p1xMm: number;
    p1yMm: number;
    p2xMm: number;
    p2yMm: number;
    labelXMm: number;
    labelYMm: number;
  };
  stillActive: boolean;
}
export function initialAngularDimensionState(): AngularDimensionState {
  return { phase: 'idle' };
}
export function reduceAngularDimension(
  state: AngularDimensionState,
  event: AngularDimensionEvent,
): { state: AngularDimensionState; effect: AngularDimensionEffect } {
  if (event.kind === 'activate' || event.kind === 'deactivate' || event.kind === 'cancel')
    return { state: { phase: 'idle' }, effect: { stillActive: event.kind !== 'deactivate' } };
  if (event.kind === 'click') {
    if (state.phase === 'idle')
      return {
        state: { phase: 'first-ray', p1xMm: event.xMm, p1yMm: event.yMm },
        effect: { stillActive: true },
      };
    if (state.phase === 'first-ray')
      return {
        state: {
          phase: 'second-ray',
          p1xMm: state.p1xMm,
          p1yMm: state.p1yMm,
          p2xMm: event.xMm,
          p2yMm: event.yMm,
        },
        effect: { stillActive: true },
      };
    if (state.phase === 'second-ray')
      return {
        state: { phase: 'idle' },
        effect: {
          commitAngular: {
            p1xMm: state.p1xMm,
            p1yMm: state.p1yMm,
            p2xMm: state.p2xMm,
            p2yMm: state.p2yMm,
            labelXMm: event.xMm,
            labelYMm: event.yMm,
          },
          stillActive: true,
        },
      };
  }
  return { state, effect: { stillActive: true } };
}

export type RadialDimensionState =
  | { phase: 'idle' }
  | { phase: 'arc-point'; arcXMm: number; arcYMm: number };
export type RadialDimensionEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'cancel' };
export interface RadialDimensionEffect {
  commitRadial?: { arcXMm: number; arcYMm: number; labelXMm: number; labelYMm: number };
  stillActive: boolean;
}
export function initialRadialDimensionState(): RadialDimensionState {
  return { phase: 'idle' };
}
export function reduceRadialDimension(
  state: RadialDimensionState,
  event: RadialDimensionEvent,
): { state: RadialDimensionState; effect: RadialDimensionEffect } {
  if (event.kind === 'activate' || event.kind === 'deactivate' || event.kind === 'cancel')
    return { state: { phase: 'idle' }, effect: { stillActive: event.kind !== 'deactivate' } };
  if (event.kind === 'click') {
    if (state.phase === 'idle')
      return {
        state: { phase: 'arc-point', arcXMm: event.xMm, arcYMm: event.yMm },
        effect: { stillActive: true },
      };
    if (state.phase === 'arc-point')
      return {
        state: { phase: 'idle' },
        effect: {
          commitRadial: {
            arcXMm: state.arcXMm,
            arcYMm: state.arcYMm,
            labelXMm: event.xMm,
            labelYMm: event.yMm,
          },
          stillActive: true,
        },
      };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Spot Coordinate Grammar — §4.8                                          */
/* idle → placing (each click emits createSpotCoordinate, Escape → idle)  */
/* ────────────────────────────────────────────────────────────────────── */

export type SpotCoordinateState = { phase: 'idle' } | { phase: 'placing' };
export type SpotCoordinateEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'cancel' };
export interface SpotCoordinateEffect {
  /** Set when a click commits a new spot coordinate annotation. */
  commitPoint?: { xMm: number; yMm: number };
  stillActive: boolean;
}
export function initialSpotCoordinateState(): SpotCoordinateState {
  return { phase: 'idle' };
}
export function reduceSpotCoordinate(
  state: SpotCoordinateState,
  event: SpotCoordinateEvent,
): { state: SpotCoordinateState; effect: SpotCoordinateEffect } {
  if (event.kind === 'deactivate')
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  if (event.kind === 'cancel' || event.kind === 'activate')
    return { state: { phase: 'idle' }, effect: { stillActive: event.kind !== 'cancel' } };
  if (event.kind === 'click')
    return {
      state: { phase: 'placing' },
      effect: { commitPoint: { xMm: event.xMm, yMm: event.yMm }, stillActive: true },
    };
  return { state, effect: { stillActive: true } };
}

export type SingleClickAnnotationState = { phase: 'idle' };
export type SingleClickAnnotationEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'cancel' };
export interface SingleClickAnnotationEffect {
  commitPoint?: { xMm: number; yMm: number };
  stillActive: boolean;
}
export function initialSingleClickAnnotationState(): SingleClickAnnotationState {
  return { phase: 'idle' };
}
export function reduceSingleClickAnnotation(
  state: SingleClickAnnotationState,
  event: SingleClickAnnotationEvent,
): { state: SingleClickAnnotationState; effect: SingleClickAnnotationEffect } {
  if (event.kind === 'deactivate')
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  if (event.kind === 'click')
    return {
      state: { phase: 'idle' },
      effect: { commitPoint: { xMm: event.xMm, yMm: event.yMm }, stillActive: true },
    };
  return { state: { phase: 'idle' }, effect: { stillActive: true } };
}

export type SlopeAnnotationState =
  | { phase: 'idle' }
  | { phase: 'end-point'; startXMm: number; startYMm: number };
export type SlopeAnnotationEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'cancel' };
export interface SlopeAnnotationEffect {
  commitSlope?: { startXMm: number; startYMm: number; endXMm: number; endYMm: number };
  stillActive: boolean;
}
export function initialSlopeAnnotationState(): SlopeAnnotationState {
  return { phase: 'idle' };
}
export function reduceSlopeAnnotation(
  state: SlopeAnnotationState,
  event: SlopeAnnotationEvent,
): { state: SlopeAnnotationState; effect: SlopeAnnotationEffect } {
  if (event.kind === 'activate' || event.kind === 'deactivate' || event.kind === 'cancel')
    return { state: { phase: 'idle' }, effect: { stillActive: event.kind !== 'deactivate' } };
  if (event.kind === 'click') {
    if (state.phase === 'idle')
      return {
        state: { phase: 'end-point', startXMm: event.xMm, startYMm: event.yMm },
        effect: { stillActive: true },
      };
    if (state.phase === 'end-point')
      return {
        state: { phase: 'idle' },
        effect: {
          commitSlope: {
            startXMm: state.startXMm,
            startYMm: state.startYMm,
            endXMm: event.xMm,
            endYMm: event.yMm,
          },
          stillActive: true,
        },
      };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Array Tool — B5 (linear and radial array)                              */
/* ────────────────────────────────────────────────────────────────────── */

export type ArrayToolMode = 'linear' | 'radial';

export type ArrayState =
  | { phase: 'idle'; mode: ArrayToolMode; moveToLast: boolean }
  | { phase: 'pick-start'; mode: 'linear'; moveToLast: boolean }
  | {
      phase: 'pick-end';
      mode: 'linear';
      moveToLast: boolean;
      startMm: { xMm: number; yMm: number };
    }
  | {
      phase: 'confirm-linear';
      moveToLast: boolean;
      startMm: { xMm: number; yMm: number };
      endMm: { xMm: number; yMm: number };
      count: number;
    }
  | { phase: 'pick-center'; mode: 'radial' }
  | {
      phase: 'confirm-radial';
      centerMm: { xMm: number; yMm: number };
      angleDeg: number;
      count: number;
    };

export type ArrayEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'cancel' }
  | { kind: 'set-mode'; mode: ArrayToolMode }
  | { kind: 'toggle-move-to-last' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'set-count'; count: number }
  | { kind: 'set-angle'; angleDeg: number }
  | { kind: 'confirm' };

export interface ArrayEffect {
  commitLinear?: {
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
    count: number;
    moveToLast: boolean;
  };
  commitRadial?: {
    centerMm: { xMm: number; yMm: number };
    angleDeg: number;
    count: number;
  };
  stillActive: boolean;
}

export function initialArrayState(): ArrayState {
  return { phase: 'idle', mode: 'linear', moveToLast: true };
}

export function reduceArray(
  state: ArrayState,
  event: ArrayEvent,
): { state: ArrayState; effect: ArrayEffect } {
  const idleState = (mode: ArrayToolMode = 'linear', moveToLast = true): ArrayState => ({
    phase: 'idle',
    mode,
    moveToLast,
  });

  if (event.kind === 'activate') {
    return { state: initialArrayState(), effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: initialArrayState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    const mode: ArrayToolMode = state.phase === 'idle' ? state.mode : 'linear';
    const mtl = state.phase === 'idle' ? state.moveToLast : true;
    return { state: idleState(mode, mtl), effect: { stillActive: true } };
  }
  if (event.kind === 'set-mode') {
    const mtl = state.phase === 'idle' ? state.moveToLast : true;
    return { state: idleState(event.mode, mtl), effect: { stillActive: true } };
  }
  if (event.kind === 'toggle-move-to-last') {
    const mtl =
      state.phase === 'idle'
        ? state.moveToLast
        : state.phase === 'pick-start' || state.phase === 'pick-end'
          ? state.moveToLast
          : state.phase === 'confirm-linear'
            ? state.moveToLast
            : true;
    return { state: { ...state, moveToLast: !mtl } as ArrayState, effect: { stillActive: true } };
  }

  if (event.kind === 'click') {
    if (state.phase === 'idle' && state.mode === 'linear') {
      return {
        state: { phase: 'pick-start', mode: 'linear', moveToLast: state.moveToLast },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'pick-start') {
      return {
        state: {
          phase: 'pick-end',
          mode: 'linear',
          moveToLast: state.moveToLast,
          startMm: { xMm: event.xMm, yMm: event.yMm },
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'pick-end') {
      return {
        state: {
          phase: 'confirm-linear',
          moveToLast: state.moveToLast,
          startMm: state.startMm,
          endMm: { xMm: event.xMm, yMm: event.yMm },
          count: 3,
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'idle' && state.mode === 'radial') {
      return {
        state: { phase: 'pick-center', mode: 'radial' },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'pick-center') {
      return {
        state: {
          phase: 'confirm-radial',
          centerMm: { xMm: event.xMm, yMm: event.yMm },
          angleDeg: 360,
          count: 3,
        },
        effect: { stillActive: true },
      };
    }
  }

  if (event.kind === 'set-count') {
    if (state.phase === 'confirm-linear') {
      return { state: { ...state, count: event.count }, effect: { stillActive: true } };
    }
    if (state.phase === 'confirm-radial') {
      return { state: { ...state, count: event.count }, effect: { stillActive: true } };
    }
  }

  if (event.kind === 'set-angle' && state.phase === 'confirm-radial') {
    return { state: { ...state, angleDeg: event.angleDeg }, effect: { stillActive: true } };
  }

  if (event.kind === 'confirm') {
    if (state.phase === 'confirm-linear') {
      return {
        state: idleState('linear', state.moveToLast),
        effect: {
          commitLinear: {
            startMm: state.startMm,
            endMm: state.endMm,
            count: state.count,
            moveToLast: state.moveToLast,
          },
          stillActive: true,
        },
      };
    }
    if (state.phase === 'confirm-radial') {
      return {
        state: idleState('radial'),
        effect: {
          commitRadial: {
            centerMm: state.centerMm,
            angleDeg: state.angleDeg,
            count: state.count,
          },
          stillActive: true,
        },
      };
    }
  }

  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Scale Tool — B1                                                         */
/* Phase 1: pick origin point                                              */
/* Phase 2a: type numeric factor + Enter  (keyboard mode)                 */
/* Phase 2b: pick reference point → pick destination point (graphical)    */
/* ────────────────────────────────────────────────────────────────────── */

export type ScaleInputMode = 'numeric' | 'graphical';

export type ScaleState =
  | { phase: 'idle' }
  | { phase: 'pick-origin' }
  | {
      phase: 'enter-factor';
      originMm: { xMm: number; yMm: number };
      inputValue: string;
    }
  | {
      phase: 'pick-reference';
      originMm: { xMm: number; yMm: number };
    }
  | {
      phase: 'pick-destination';
      originMm: { xMm: number; yMm: number };
      referenceMm: { xMm: number; yMm: number };
    };

export type ScaleEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'cancel' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'set-input'; value: string }
  | { kind: 'confirm' };

export interface ScaleEffect {
  commitScale?: {
    originMm: { xMm: number; yMm: number };
    factor: number;
  };
  commitGraphicalScale?: {
    originMm: { xMm: number; yMm: number };
    referenceMm: { xMm: number; yMm: number };
    destinationMm: { xMm: number; yMm: number };
  };
  stillActive: boolean;
}

export function initialScaleState(): ScaleState {
  return { phase: 'idle' };
}

export function reduceScale(
  state: ScaleState,
  event: ScaleEvent,
): { state: ScaleState; effect: ScaleEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'pick-origin' }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: initialScaleState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'pick-origin' }, effect: { stillActive: true } };
  }

  if (event.kind === 'click') {
    if (state.phase === 'pick-origin') {
      return {
        state: {
          phase: 'enter-factor',
          originMm: { xMm: event.xMm, yMm: event.yMm },
          inputValue: '',
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'enter-factor') {
      // Clicking while in enter-factor switches to graphical mode: this click is the reference point
      return {
        state: {
          phase: 'pick-reference',
          originMm: state.originMm,
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'pick-reference') {
      return {
        state: {
          phase: 'pick-destination',
          originMm: state.originMm,
          referenceMm: { xMm: event.xMm, yMm: event.yMm },
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'pick-destination') {
      return {
        state: { phase: 'pick-origin' },
        effect: {
          commitGraphicalScale: {
            originMm: state.originMm,
            referenceMm: state.referenceMm,
            destinationMm: { xMm: event.xMm, yMm: event.yMm },
          },
          stillActive: true,
        },
      };
    }
  }

  if (event.kind === 'set-input' && state.phase === 'enter-factor') {
    return { state: { ...state, inputValue: event.value }, effect: { stillActive: true } };
  }

  if (event.kind === 'confirm' && state.phase === 'enter-factor') {
    const factor = parseFloat(state.inputValue.trim());
    if (!Number.isFinite(factor) || factor <= 0) {
      return { state, effect: { stillActive: true } };
    }
    return {
      state: { phase: 'pick-origin' },
      effect: {
        commitScale: { originMm: state.originMm, factor },
        stillActive: true,
      },
    };
  }

  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Roof-by-Extrusion Tool — G2 (Ch. 10.2)                                  */
/* idle → activate → recording → double-click/Enter → confirm-depth        */
/* confirm-depth → set-depth + enter → createRoofByExtrusion effect         */
/* ────────────────────────────────────────────────────────────────────── */

export type RoofByExtrusionState =
  | { phase: 'idle' }
  | { phase: 'recording'; points: { xMm: number; yMm: number }[] }
  | {
      phase: 'confirm-depth';
      points: { xMm: number; yMm: number }[];
      depthInput: string;
    };

export type RoofByExtrusionEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'double-click'; xMm: number; yMm: number }
  | { kind: 'enter' }
  | { kind: 'escape' }
  | { kind: 'set-depth'; value: string };

export interface RoofByExtrusionEffect {
  createRoofByExtrusion?: {
    profilePoints: { xMm: number; yMm: number }[];
    depthMm: number;
    levelId: string;
    slopeAngleDeg: number;
  };
  stillActive: boolean;
}

export function initialRoofByExtrusionState(): RoofByExtrusionState {
  return { phase: 'idle' };
}

export function reduceRoofByExtrusion(
  state: RoofByExtrusionState,
  event: RoofByExtrusionEvent,
  levelId: string,
): { state: RoofByExtrusionState; effect: RoofByExtrusionEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'recording', points: [] }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }

  if (state.phase === 'recording') {
    if (event.kind === 'click') {
      return {
        state: {
          phase: 'recording',
          points: [...state.points, { xMm: event.xMm, yMm: event.yMm }],
        },
        effect: { stillActive: true },
      };
    }
    if (event.kind === 'double-click' || event.kind === 'enter') {
      if (state.points.length < 2) {
        return { state, effect: { stillActive: true } };
      }
      return {
        state: { phase: 'confirm-depth', points: state.points, depthInput: '' },
        effect: { stillActive: true },
      };
    }
    if (event.kind === 'escape') {
      return { state: { phase: 'idle' }, effect: { stillActive: false } };
    }
  }

  if (state.phase === 'confirm-depth') {
    if (event.kind === 'set-depth') {
      return { state: { ...state, depthInput: event.value }, effect: { stillActive: true } };
    }
    if (event.kind === 'enter') {
      const depthMm = parseFloat(state.depthInput.trim());
      if (!Number.isFinite(depthMm) || depthMm <= 0) {
        return { state, effect: { stillActive: true } };
      }
      return {
        state: { phase: 'idle' },
        effect: {
          createRoofByExtrusion: {
            profilePoints: state.points,
            depthMm,
            levelId,
            slopeAngleDeg: 0,
          },
          stillActive: false,
        },
      };
    }
    if (event.kind === 'escape') {
      return { state: { phase: 'idle' }, effect: { stillActive: false } };
    }
  }

  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Revision Cloud — E3b                                                    */
/* Click to add polygon vertices; Enter or double-click to commit.        */
/* ────────────────────────────────────────────────────────────────────── */

export interface RevisionCloudState {
  pointsMm: { xMm: number; yMm: number }[];
}

export function initialRevisionCloudState(): RevisionCloudState {
  return { pointsMm: [] };
}

export type RevisionCloudEvent =
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface RevisionCloudEffect {
  commitPointsMm?: { xMm: number; yMm: number }[];
}

export function reduceRevisionCloud(
  state: RevisionCloudState,
  event: RevisionCloudEvent,
): { state: RevisionCloudState; effect: RevisionCloudEffect } {
  if (event.kind === 'cancel') {
    return { state: initialRevisionCloudState(), effect: {} };
  }
  if (event.kind === 'commit') {
    if (state.pointsMm.length >= 2) {
      return {
        state: initialRevisionCloudState(),
        effect: { commitPointsMm: [...state.pointsMm] },
      };
    }
    return { state: initialRevisionCloudState(), effect: {} };
  }
  const last = state.pointsMm[state.pointsMm.length - 1];
  if (last && Math.hypot(event.pointMm.xMm - last.xMm, event.pointMm.yMm - last.yMm) < 1) {
    return { state, effect: {} };
  }
  return { state: { pointsMm: [...state.pointsMm, event.pointMm] }, effect: {} };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Decal — 3D surface image placement                                      */
/* Click a 3D face → prompt for image → commit createDecal effect.        */
/* ────────────────────────────────────────────────────────────────────── */

export type DecalState =
  | { phase: 'idle'; positionMm: null; normalVec: null }
  | {
      phase: 'picking-image';
      positionMm: { xMm: number; yMm: number; zMm: number };
      normalVec: { x: number; y: number; z: number };
    };

export type DecalEvent =
  | {
      kind: 'face-click';
      positionMm: { xMm: number; yMm: number; zMm: number };
      normalVec: { x: number; y: number; z: number };
    }
  | { kind: 'image-chosen'; imageSrc: string }
  | { kind: 'cancel' }
  | { kind: 'deactivate' };

export interface DecalEffect {
  stillActive: boolean;
  createDecal?: {
    positionMm: { xMm: number; yMm: number; zMm: number };
    normalVec: { x: number; y: number; z: number };
    imageSrc: string;
    widthMm: number;
    heightMm: number;
  };
}

export function initialDecalState(): DecalState {
  return { phase: 'idle', positionMm: null, normalVec: null };
}

export function reduceDecal(
  state: DecalState,
  event: DecalEvent,
): { state: DecalState; effect: DecalEffect } {
  if (event.kind === 'deactivate' || event.kind === 'cancel') {
    return { state: initialDecalState(), effect: { stillActive: false } };
  }
  if (state.phase === 'idle') {
    if (event.kind === 'face-click') {
      return {
        state: { phase: 'picking-image', positionMm: event.positionMm, normalVec: event.normalVec },
        effect: { stillActive: true },
      };
    }
  }
  if (state.phase === 'picking-image') {
    if (event.kind === 'image-chosen') {
      return {
        state: initialDecalState(),
        effect: {
          stillActive: true,
          createDecal: {
            positionMm: state.positionMm,
            normalVec: state.normalVec,
            imageSrc: event.imageSrc,
            widthMm: 1000,
            heightMm: 1000,
          },
        },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Attach / Detach — WP-C C1a                                              */
/* Attach: click wall → pick roof/floor/ceiling target → emit effect.     */
/* Detach: click a wall to detach its top host.                            */
