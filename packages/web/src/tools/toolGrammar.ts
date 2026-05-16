/**
 * Per-tool grammar — spec §16.4 / §16.5.
 *
 * Each tool's interaction model is captured here as plain data so the
 * tool can be unit-tested without DOM. The shape is consistent across
 * tools so the canvas can switch on `kind` and dispatch input.
 */

export type { WallLocationLine } from '@bim-ai/core';
import type { WallLocationLine } from '@bim-ai/core';

/* ────────────────────────────────────────────────────────────────────── */
/* EDT-06 — Tool grammar polish (Chain / Multiple / Tag-on-Place /        */
/*           Numeric input). The canvas wires the per-tool reducers in    */
/*           this file plus a top-level `ToolGrammarModifiers` block      */
/*           that feeds the Options Bar.                                  */
/* ────────────────────────────────────────────────────────────────────── */

/** Modifiers that the canvas Options Bar exposes to the user. */
export interface ToolGrammarModifiers {
  /** Place Wall continues from the last endpoint until Esc / different tool. */
  chainable: boolean;
  /** Insert Door / Window stays in tool until Esc; otherwise exits after first placement. */
  multipleable: boolean;
  /** During wall / door / window placement, auto-place a tag of the configured family. */
  tagOnPlace: { enabled: boolean; tagFamilyId?: string };
  /** Numeric input mode: typing a digit while drawing pops a numeric input field. */
  numericInputActive: boolean;
  /**
   * Wall draw offset — when non-zero, the wall baseline is drawn offset from
   * the cursor by this many mm (positive = left side of draw direction).
   * F-042 parity. Default 0.
   */
  wallDrawOffsetMm: number;
  /**
   * Wall draw radius — when non-null, consecutive wall segments get a curved
   * corner fillet of this radius (mm). F-043 parity. Default null (sharp corners).
   */
  wallDrawRadiusMm: number | null;
}

export function defaultToolGrammarModifiers(): ToolGrammarModifiers {
  return {
    chainable: true,
    multipleable: false,
    tagOnPlace: { enabled: false },
    numericInputActive: false,
    wallDrawOffsetMm: 0,
    wallDrawRadiusMm: null,
  };
}

/** A tool's static capability set — drives which Options Bar toggles appear. */
export interface ToolCapabilities {
  chainable: boolean;
  multipleable: boolean;
  tagOnPlace: boolean;
  /** Whether the tool supports typing a numeric distance while drawing. */
  numericInput: boolean;
}

export const TOOL_CAPABILITIES: Record<string, ToolCapabilities> = {
  wall: {
    chainable: true,
    multipleable: false,
    tagOnPlace: true,
    numericInput: true,
  },
  door: {
    chainable: false,
    multipleable: true,
    tagOnPlace: true,
    numericInput: false,
  },
  window: {
    chainable: false,
    multipleable: true,
    tagOnPlace: true,
    numericInput: false,
  },
  beam: {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: true,
  },
  column: {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  ceiling: {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
  shaft: {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
  align: {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
  split: {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  trim: {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  offset: {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
  'wall-join': {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
  'wall-opening': {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
  text: { chainable: false, multipleable: true, tagOnPlace: false, numericInput: false },
  'leader-text': { chainable: false, multipleable: true, tagOnPlace: false, numericInput: false },
  'angular-dimension': {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  'radial-dimension': {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  'diameter-dimension': {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  'arc-length-dimension': {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  'spot-elevation': {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  'spot-coordinate': {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  'slope-annotation': {
    chainable: false,
    multipleable: true,
    tagOnPlace: false,
    numericInput: false,
  },
  'material-tag': { chainable: false, multipleable: true, tagOnPlace: false, numericInput: false },
  'north-arrow': { chainable: false, multipleable: false, tagOnPlace: false, numericInput: false },
  ramp: { chainable: false, multipleable: false, tagOnPlace: false, numericInput: true },
};

/**
 * Numeric-input field state — appears at the cursor while a numeric-capable
 * tool is mid-draw and the user types a digit. `axis` toggles on Tab so a
 * second number can drive the perpendicular direction.
 */
export interface NumericInputState {
  active: boolean;
  value: string;
  axis: 'primary' | 'perpendicular';
}

export function initialNumericInputState(): NumericInputState {
  return { active: false, value: '', axis: 'primary' };
}

export type NumericInputEvent =
  | { kind: 'start'; firstDigit: string }
  | { kind: 'append'; digit: string }
  | { kind: 'backspace' }
  | { kind: 'tab-axis' }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export function reduceNumericInput(
  state: NumericInputState,
  event: NumericInputEvent,
): NumericInputState {
  switch (event.kind) {
    case 'start':
      return { active: true, value: event.firstDigit, axis: 'primary' };
    case 'append':
      if (!state.active) return state;
      return { ...state, value: state.value + event.digit };
    case 'backspace':
      if (!state.active) return state;
      return { ...state, value: state.value.slice(0, -1) };
    case 'tab-axis':
      if (!state.active) return state;
      return {
        ...state,
        axis: state.axis === 'primary' ? 'perpendicular' : 'primary',
      };
    case 'commit':
    case 'cancel':
      return initialNumericInputState();
  }
}

export type ToolGrammarKind =
  | 'wall'
  | 'door'
  | 'window'
  | 'floor'
  | 'roof'
  | 'stair'
  | 'railing'
  | 'room'
  | 'dimension'
  | 'section'
  | 'tag'
  | 'align'
  | 'split'
  | 'trim'
  | 'offset'
  | 'wall-join';

export const WALL_LOCATION_LINE_ORDER: WallLocationLine[] = [
  'wall-centerline',
  'finish-face-exterior',
  'finish-face-interior',
  'core-centerline',
  'core-face-exterior',
  'core-face-interior',
];

/** Cycle through the §16.4.1 location-line set on `Tab`. */
export function cycleWallLocationLine(current: WallLocationLine): WallLocationLine {
  const idx = WALL_LOCATION_LINE_ORDER.indexOf(current);
  if (idx < 0) return WALL_LOCATION_LINE_ORDER[0]!;
  return WALL_LOCATION_LINE_ORDER[(idx + 1) % WALL_LOCATION_LINE_ORDER.length]!;
}

/** Wall tool state machine — minimum necessary to drive a chain mode
 * without leaking pointer details into the controller. */
export interface WallChainState {
  active: boolean;
  startMm: { xMm: number; yMm: number } | null;
  /** Locked endpoint after a click; chain mode begins from here. */
  chainAnchorMm: { xMm: number; yMm: number } | null;
  locationLine: WallLocationLine;
}

export function initialWallChainState(): WallChainState {
  return {
    active: false,
    startMm: null,
    chainAnchorMm: null,
    locationLine: 'wall-centerline',
  };
}

export type WallChainEvent =
  | { kind: 'tool-activated' }
  | { kind: 'tool-deactivated' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' }
  | { kind: 'tab-cycle-location' }
  | { kind: 'enter-finish' };

export interface WallChainEffect {
  /** Wall span to commit, when a 2nd click closes a segment. */
  commitSegment?: {
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
    locationLine: WallLocationLine;
  };
  /** True when the tool stays active after the event. */
  stillActive: boolean;
  /** True when this event broke the chain (Esc). */
  chainBroken?: boolean;
}

export function reduceWallChain(
  state: WallChainState,
  event: WallChainEvent,
): { state: WallChainState; effect: WallChainEffect } {
  if (event.kind === 'tool-activated') {
    return {
      state: { ...state, active: true, startMm: null, chainAnchorMm: null },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'tool-deactivated') {
    return {
      state: { ...initialWallChainState() },
      effect: { stillActive: false },
    };
  }
  if (!state.active) {
    return { state, effect: { stillActive: false } };
  }
  if (event.kind === 'tab-cycle-location') {
    return {
      state: {
        ...state,
        locationLine: cycleWallLocationLine(state.locationLine),
      },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'cancel') {
    return {
      state: { ...state, startMm: null, chainAnchorMm: null },
      effect: { stillActive: true, chainBroken: true },
    };
  }
  if (event.kind === 'enter-finish') {
    return {
      state: { ...initialWallChainState() },
      effect: { stillActive: false },
    };
  }
  // click
  const start = state.chainAnchorMm ?? state.startMm;
  if (!start) {
    return {
      state: { ...state, startMm: event.pointMm, chainAnchorMm: null },
      effect: { stillActive: true },
    };
  }
  const segment = {
    startMm: start,
    endMm: event.pointMm,
    locationLine: state.locationLine,
  };
  return {
    state: { ...state, startMm: null, chainAnchorMm: event.pointMm },
    effect: { commitSegment: segment, stillActive: true },
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Door / Window — §16.4.2 / §16.4.3                                       */
/* ────────────────────────────────────────────────────────────────────── */

export interface HostedOpeningDefaults {
  widthMm: number;
  heightMm: number;
  sillHeightMm?: number;
}

export type DoorSwing = 'left' | 'right';
export type DoorHand = 'in' | 'out';

export interface DoorPlacement {
  wallId: string;
  alongT: number;
  widthMm: number;
  heightMm: number;
  swing: DoorSwing;
  hand: DoorHand;
}

export const DOOR_DEFAULTS: HostedOpeningDefaults & {
  swing: DoorSwing;
  hand: DoorHand;
} = {
  widthMm: 900,
  heightMm: 2100,
  swing: 'left',
  hand: 'in',
};

/** Spacebar flips swing side; Tab flips hand. */
export function flipDoorSwing(swing: DoorSwing): DoorSwing {
  return swing === 'left' ? 'right' : 'left';
}

export function flipDoorHand(hand: DoorHand): DoorHand {
  return hand === 'in' ? 'out' : 'in';
}

export const WINDOW_DEFAULTS: HostedOpeningDefaults = {
  widthMm: 1200,
  heightMm: 1500,
  sillHeightMm: 900,
};

/* ────────────────────────────────────────────────────────────────────── */
/* Floor — §16.4.4                                                          */
/* ────────────────────────────────────────────────────────────────────── */

export type FloorMode = 'pick-walls' | 'sketch';

export interface FloorState {
  mode: FloorMode;
  sketchPolygonMm: { xMm: number; yMm: number }[];
  pickedWallIds: string[];
  thicknessMm: number;
}

export function initialFloorState(): FloorState {
  return {
    mode: 'pick-walls',
    sketchPolygonMm: [],
    pickedWallIds: [],
    thicknessMm: 220,
  };
}

export function toggleFloorMode(mode: FloorMode): FloorMode {
  return mode === 'pick-walls' ? 'sketch' : 'pick-walls';
}

/* ────────────────────────────────────────────────────────────────────── */
/* Roof — §16.4.5                                                           */
/* ────────────────────────────────────────────────────────────────────── */

export type RoofType = 'gable' | 'hip' | 'flat' | 'shed';

export interface RoofState {
  type: RoofType;
  slopeDeg: number;
  /** Per-edge slope override; key is edge index. */
  edgeSlopes: Record<number, boolean>;
  eaveOverhangMm: number;
}

export function initialRoofState(): RoofState {
  return {
    type: 'gable',
    slopeDeg: 35,
    edgeSlopes: {},
    eaveOverhangMm: 600,
  };
}

export function toggleEdgeSlope(state: RoofState, edgeIdx: number): RoofState {
  const next = { ...state.edgeSlopes };
  next[edgeIdx] = !state.edgeSlopes[edgeIdx];
  return { ...state, edgeSlopes: next };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Stair — §16.4.6                                                          */
/* ────────────────────────────────────────────────────────────────────── */

export type StairType = 'straight' | 'l-shape' | 'u-shape' | 'spiral';

export interface StairCalcInput {
  baseLevelElevMm: number;
  topLevelElevMm: number;
  preferredRiserMm?: number;
  preferredTreadMm?: number;
}

export interface StairCalcOutput {
  riserMm: number;
  treadMm: number;
  riserCount: number;
  treadCount: number;
  totalRiseMm: number;
}

export const STAIR_RISER_MM_DEFAULT = 175;
export const STAIR_TREAD_MM_DEFAULT = 280;

/** Auto-compute risers/treads for a straight run between two levels. */
export function computeStairRun(input: StairCalcInput): StairCalcOutput {
  const totalRise = input.topLevelElevMm - input.baseLevelElevMm;
  if (totalRise <= 0) {
    return {
      riserMm: STAIR_RISER_MM_DEFAULT,
      treadMm: STAIR_TREAD_MM_DEFAULT,
      riserCount: 0,
      treadCount: 0,
      totalRiseMm: 0,
    };
  }
  const desired = input.preferredRiserMm ?? STAIR_RISER_MM_DEFAULT;
  const riserCount = Math.max(2, Math.round(totalRise / desired));
  const riserMm = totalRise / riserCount;
  const treadMm = input.preferredTreadMm ?? STAIR_TREAD_MM_DEFAULT;
  return {
    riserMm,
    treadMm,
    riserCount,
    treadCount: riserCount - 1,
    totalRiseMm: totalRise,
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Railing — §16.4.7                                                        */
/* ────────────────────────────────────────────────────────────────────── */

export type RailingHostKind = 'stair' | 'slab-edge' | 'sketch-path';

export interface RailingDefaults {
  style: 'horizontal-bars-5x30';
  totalHeightMm: number;
  baluster: {
    spacingMm: number;
    diameterMm: number;
  };
}

export const RAILING_DEFAULTS: RailingDefaults = {
  style: 'horizontal-bars-5x30',
  totalHeightMm: 1100,
  baluster: { spacingMm: 100, diameterMm: 30 },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Room marker — §16.4.8                                                    */
/* ────────────────────────────────────────────────────────────────────── */

export interface RoomMarkerInput {
  /** Closed boundary forming the room — typically the auto-detected
   * polygon under the cursor. */
  outlineMm: { xMm: number; yMm: number }[];
}

export function centroidMm(outline: { xMm: number; yMm: number }[]): {
  xMm: number;
  yMm: number;
} {
  if (outline.length === 0) return { xMm: 0, yMm: 0 };
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const cross = a.xMm * b.yMm - b.xMm * a.yMm;
    area += cross;
    cx += (a.xMm + b.xMm) * cross;
    cy += (a.yMm + b.yMm) * cross;
  }
  if (area === 0) {
    const sum = outline.reduce((acc, p) => ({ xMm: acc.xMm + p.xMm, yMm: acc.yMm + p.yMm }), {
      xMm: 0,
      yMm: 0,
    });
    return { xMm: sum.xMm / outline.length, yMm: sum.yMm / outline.length };
  }
  area /= 2;
  return { xMm: cx / (6 * area), yMm: cy / (6 * area) };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Area boundary — F-095                                                    */
/* ────────────────────────────────────────────────────────────────────── */

export const AREA_BOUNDARY_CLOSE_TOLERANCE_MM = 520;

export interface AreaBoundaryState {
  verticesMm: { xMm: number; yMm: number }[];
}

export function initialAreaBoundaryState(): AreaBoundaryState {
  return { verticesMm: [] };
}

export type AreaBoundaryEvent =
  | {
      kind: 'click';
      pointMm: { xMm: number; yMm: number };
      closeToleranceMm?: number;
    }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface AreaBoundaryEffect {
  commitBoundaryMm?: { xMm: number; yMm: number }[];
}

function sameAreaBoundaryPoint(
  a: { xMm: number; yMm: number },
  b: { xMm: number; yMm: number },
): boolean {
  return Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm) < 1;
}

export function areaBoundaryCanClose(
  verticesMm: { xMm: number; yMm: number }[],
  pointMm: { xMm: number; yMm: number },
  closeToleranceMm = AREA_BOUNDARY_CLOSE_TOLERANCE_MM,
): boolean {
  const first = verticesMm[0];
  return (
    verticesMm.length >= 3 &&
    first !== undefined &&
    Math.hypot(pointMm.xMm - first.xMm, pointMm.yMm - first.yMm) <= closeToleranceMm
  );
}

export function areaBoundaryRectangleFromDiagonal(
  startMm: { xMm: number; yMm: number },
  endMm: { xMm: number; yMm: number },
  minEdgeMm = 200,
): { xMm: number; yMm: number }[] | null {
  const widthMm = Math.abs(endMm.xMm - startMm.xMm);
  const depthMm = Math.abs(endMm.yMm - startMm.yMm);
  if (widthMm < minEdgeMm || depthMm < minEdgeMm) return null;
  const x0 = Math.min(startMm.xMm, endMm.xMm);
  const x1 = Math.max(startMm.xMm, endMm.xMm);
  const y0 = Math.min(startMm.yMm, endMm.yMm);
  const y1 = Math.max(startMm.yMm, endMm.yMm);
  return [
    { xMm: x0, yMm: y0 },
    { xMm: x1, yMm: y0 },
    { xMm: x1, yMm: y1 },
    { xMm: x0, yMm: y1 },
  ];
}

export function reduceAreaBoundary(
  state: AreaBoundaryState,
  event: AreaBoundaryEvent,
): { state: AreaBoundaryState; effect: AreaBoundaryEffect } {
  if (event.kind === 'cancel') {
    return { state: initialAreaBoundaryState(), effect: {} };
  }
  if (event.kind === 'commit') {
    if (state.verticesMm.length >= 3) {
      return {
        state: initialAreaBoundaryState(),
        effect: { commitBoundaryMm: [...state.verticesMm] },
      };
    }
    return { state: initialAreaBoundaryState(), effect: {} };
  }

  const point = event.pointMm;
  if (areaBoundaryCanClose(state.verticesMm, point, event.closeToleranceMm)) {
    return {
      state: initialAreaBoundaryState(),
      effect: { commitBoundaryMm: [...state.verticesMm] },
    };
  }
  const last = state.verticesMm[state.verticesMm.length - 1];
  if (last && sameAreaBoundaryPoint(last, point)) {
    return { state, effect: {} };
  }
  return {
    state: { verticesMm: [...state.verticesMm, point] },
    effect: {},
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Dimension — §16.4.9                                                      */
/* ────────────────────────────────────────────────────────────────────── */

export type DimensionKind = 'linear' | 'aligned' | 'angular' | 'radial' | 'diameter';

export const DIMENSION_HOTKEYS: Record<DimensionKind, string> = {
  linear: 'L',
  aligned: 'A',
  angular: 'G',
  radial: 'Q',
  diameter: 'Shift+Q',
};

export interface DimensionState {
  kind: DimensionKind;
  firstWitnessMm: { xMm: number; yMm: number } | null;
  secondWitnessMm: { xMm: number; yMm: number } | null;
}

export function initialDimensionState(): DimensionState {
  return { kind: 'linear', firstWitnessMm: null, secondWitnessMm: null };
}

export function setDimensionKind(state: DimensionState, kind: DimensionKind): DimensionState {
  return { ...state, kind };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Section — §16.4.10                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export interface SectionDraftState {
  startMm: { xMm: number; yMm: number } | null;
  endMm: { xMm: number; yMm: number } | null;
  /** +1 means depth axis is to the right of the line direction. */
  depthSign: 1 | -1;
}

export function initialSectionDraft(): SectionDraftState {
  return { startMm: null, endMm: null, depthSign: 1 };
}

export function flipSectionDepth(state: SectionDraftState): SectionDraftState {
  return { ...state, depthSign: state.depthSign === 1 ? -1 : 1 };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Tag subdropdown — §16.5                                                  */
/* ────────────────────────────────────────────────────────────────────── */

export type TagFamily = 'tag-door' | 'tag-window' | 'tag-wall' | 'tag-room' | 'tag-by-category';

export const TAG_FAMILIES: { id: TagFamily; label: string }[] = [
  { id: 'tag-door', label: 'Tag Door' },
  { id: 'tag-window', label: 'Tag Window' },
  { id: 'tag-wall', label: 'Tag Wall' },
  { id: 'tag-room', label: 'Tag Room' },
  { id: 'tag-by-category', label: 'Tag by Category' },
];

/* ────────────────────────────────────────────────────────────────────── */
/* Align — §16 Modify                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export interface AlignState {
  phase: 'pick-reference' | 'pick-element';
  referenceMm: { xMm: number; yMm: number } | null;
}

export type AlignEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface AlignEffect {
  commitAlign?: {
    referenceMm: { xMm: number; yMm: number };
    targetMm: { xMm: number; yMm: number };
  };
  stillActive: boolean;
}

export function initialAlignState(): AlignState {
  return { phase: 'pick-reference', referenceMm: null };
}

export function reduceAlign(
  state: AlignState,
  event: AlignEvent,
): { state: AlignState; effect: AlignEffect } {
  if (event.kind === 'activate') {
    return {
      state: { phase: 'pick-reference', referenceMm: null },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'deactivate') {
    return {
      state: { phase: 'pick-reference', referenceMm: null },
      effect: { stillActive: false },
    };
  }
  if (event.kind === 'cancel') {
    return {
      state: { phase: 'pick-reference', referenceMm: null },
      effect: { stillActive: true },
    };
  }
  // click
  if (state.phase === 'pick-reference') {
    return {
      state: { phase: 'pick-element', referenceMm: event.pointMm },
      effect: { stillActive: true },
    };
  }
  // pick-element + click → commit and return to pick-reference for next pair
  return {
    state: { phase: 'pick-reference', referenceMm: null },
    effect: {
      commitAlign: { referenceMm: state.referenceMm!, targetMm: event.pointMm },
      stillActive: true,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Split — §16 Modify                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export interface SplitState {
  active: boolean;
}

export type SplitEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface SplitEffect {
  commitSplit?: { pointMm: { xMm: number; yMm: number } };
  stillActive: boolean;
}

export function initialSplitState(): SplitState {
  return { active: false };
}

export function reduceSplit(
  state: SplitState,
  event: SplitEvent,
): { state: SplitState; effect: SplitEffect } {
  if (event.kind === 'activate') {
    return { state: { active: true }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: { active: false }, effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state, effect: { stillActive: true } };
  }
  if (!state.active) {
    return { state, effect: { stillActive: false } };
  }
  // click while active → emit split, stay active (Revit stays in Split mode)
  return {
    state,
    effect: { commitSplit: { pointMm: event.pointMm }, stillActive: true },
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Trim / Extend — §16 Modify                                               */
/* ────────────────────────────────────────────────────────────────────── */

export interface TrimState {
  phase: 'pick-reference' | 'pick-target';
  referenceId: string | null;
}

export type TrimEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click-reference'; elementId: string }
  | { kind: 'click-target'; elementId: string; endHint: 'start' | 'end' }
  | { kind: 'cancel' };

export interface TrimEffect {
  commitTrim?: {
    referenceId: string;
    targetId: string;
    endHint: 'start' | 'end';
  };
  stillActive: boolean;
}

export function initialTrimState(): TrimState {
  return { phase: 'pick-reference', referenceId: null };
}

export function reduceTrim(
  state: TrimState,
  event: TrimEvent,
): { state: TrimState; effect: TrimEffect } {
  if (event.kind === 'activate') {
    return {
      state: { phase: 'pick-reference', referenceId: null },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'deactivate') {
    return {
      state: { phase: 'pick-reference', referenceId: null },
      effect: { stillActive: false },
    };
  }
  if (event.kind === 'cancel') {
    return {
      state: { phase: 'pick-reference', referenceId: null },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'click-reference') {
    return {
      state: { phase: 'pick-target', referenceId: event.elementId },
      effect: { stillActive: true },
    };
  }
  // click-target
  if (state.phase !== 'pick-target' || !state.referenceId) {
    return { state, effect: { stillActive: true } };
  }
  return {
    state: { phase: 'pick-reference', referenceId: null },
    effect: {
      commitTrim: {
        referenceId: state.referenceId,
        targetId: event.elementId,
        endHint: event.endHint,
      },
      stillActive: true,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Wall Join — §16 Modify                                                   */
/* ────────────────────────────────────────────────────────────────────── */

export type WallJoinVariant = 'miter' | 'butt' | 'square';

const WALL_JOIN_VARIANTS: WallJoinVariant[] = ['miter', 'butt', 'square'];

export interface WallJoinState {
  phase: 'idle' | 'selected';
  cornerMm: { xMm: number; yMm: number } | null;
  wallIds: string[];
  joinVariant: WallJoinVariant;
}

export type WallJoinEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | {
      kind: 'click-corner';
      cornerMm: { xMm: number; yMm: number };
      wallIds: string[];
    }
  | { kind: 'cycle' }
  | { kind: 'accept' }
  | { kind: 'cancel' };

export interface WallJoinEffect {
  commitJoin?: { wallIds: string[]; variant: WallJoinVariant };
  stillActive: boolean;
}

export function initialWallJoinState(): WallJoinState {
  return { phase: 'idle', cornerMm: null, wallIds: [], joinVariant: 'miter' };
}

export function reduceWallJoin(
  state: WallJoinState,
  event: WallJoinEvent,
): { state: WallJoinState; effect: WallJoinEffect } {
  if (event.kind === 'activate') {
    return { state: initialWallJoinState(), effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: initialWallJoinState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: initialWallJoinState(), effect: { stillActive: true } };
  }
  if (event.kind === 'click-corner') {
    return {
      state: {
        phase: 'selected',
        cornerMm: event.cornerMm,
        wallIds: event.wallIds,
        joinVariant: 'miter',
      },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'cycle' && state.phase === 'selected') {
    const idx = WALL_JOIN_VARIANTS.indexOf(state.joinVariant);
    const next = WALL_JOIN_VARIANTS[(idx + 1) % WALL_JOIN_VARIANTS.length]!;
    return {
      state: { ...state, joinVariant: next },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'accept' && state.phase === 'selected') {
    return {
      state: initialWallJoinState(),
      effect: {
        commitJoin: { wallIds: state.wallIds, variant: state.joinVariant },
        stillActive: true,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Wall Opening — §16 Openings                                            */
/* ────────────────────────────────────────────────────────────────────── */

export interface WallOpeningState {
  phase: 'pick-wall' | 'define-rect';
  hostWallId: string | null;
  anchorMm: { xMm: number; yMm: number } | null;
}

export type WallOpeningEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | {
      kind: 'click-wall';
      wallId: string;
      pointMm: { xMm: number; yMm: number };
    }
  | { kind: 'drag-end'; cornerMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface WallOpeningEffect {
  commitWallOpening?: {
    hostWallId: string;
    anchorMm: { xMm: number; yMm: number };
    cornerMm: { xMm: number; yMm: number };
  };
  stillActive: boolean;
}

export function initialWallOpeningState(): WallOpeningState {
  return { phase: 'pick-wall', hostWallId: null, anchorMm: null };
}

export function reduceWallOpening(
  state: WallOpeningState,
  event: WallOpeningEvent,
): { state: WallOpeningState; effect: WallOpeningEffect } {
  if (event.kind === 'activate') {
    return { state: initialWallOpeningState(), effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: initialWallOpeningState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: initialWallOpeningState(), effect: { stillActive: true } };
  }
  if (event.kind === 'click-wall' && state.phase === 'pick-wall') {
    return {
      state: {
        phase: 'define-rect',
        hostWallId: event.wallId,
        anchorMm: event.pointMm,
      },
      effect: { stillActive: true },
    };
  }
  if (
    event.kind === 'drag-end' &&
    state.phase === 'define-rect' &&
    state.hostWallId &&
    state.anchorMm
  ) {
    return {
      state: initialWallOpeningState(),
      effect: {
        commitWallOpening: {
          hostWallId: state.hostWallId,
          anchorMm: state.anchorMm,
          cornerMm: event.cornerMm,
        },
        stillActive: true,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Shaft — §16 Openings                                                   */
/* ────────────────────────────────────────────────────────────────────── */

export interface ShaftState {
  phase: 'idle' | 'sketch';
  verticesMm: Array<{ xMm: number; yMm: number }>;
}

export type ShaftEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'close-loop' }
  | { kind: 'cancel' };

export interface ShaftEffect {
  commitShaft?: { verticesMm: Array<{ xMm: number; yMm: number }> };
  stillActive: boolean;
}

export function initialShaftState(): ShaftState {
  return { phase: 'idle', verticesMm: [] };
}

export function reduceShaft(
  state: ShaftState,
  event: ShaftEvent,
): { state: ShaftState; effect: ShaftEffect } {
  if (event.kind === 'activate') {
    return { state: initialShaftState(), effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: initialShaftState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: initialShaftState(), effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    return {
      state: {
        phase: 'sketch',
        verticesMm: [...state.verticesMm, event.pointMm],
      },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'close-loop' && state.verticesMm.length >= 3) {
    return {
      state: initialShaftState(),
      effect: {
        commitShaft: { verticesMm: state.verticesMm },
        stillActive: true,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* C16 Column — single-click placement                                      */
/* ────────────────────────────────────────────────────────────────────── */

export type ColumnState = { phase: 'idle' };

export type ColumnEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface ColumnEffect {
  commitColumn?: { positionMm: { xMm: number; yMm: number } };
  stillActive: boolean;
}

export function initialColumnState(): ColumnState {
  return { phase: 'idle' };
}

export function reduceColumn(
  state: ColumnState,
  event: ColumnEvent,
): { state: ColumnState; effect: ColumnEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialColumnState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate' || event.kind === 'cancel') {
    return {
      state: initialColumnState(),
      effect: { stillActive: event.kind === 'activate' },
    };
  }
  if (event.kind === 'click') {
    return {
      state: initialColumnState(),
      effect: {
        commitColumn: { positionMm: event.pointMm },
        stillActive: true,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* C17 Beam — two-click line placement                                      */
/* ────────────────────────────────────────────────────────────────────── */

export type BeamState =
  | { phase: 'idle' }
  | { phase: 'first-point'; startMm: { xMm: number; yMm: number } };

export type BeamEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface BeamEffect {
  commitBeam?: {
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
  };
  stillActive: boolean;
}

export function initialBeamState(): BeamState {
  return { phase: 'idle' };
}

export function reduceBeam(
  state: BeamState,
  event: BeamEvent,
): { state: BeamState; effect: BeamEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialBeamState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate' || event.kind === 'cancel') {
    return {
      state: initialBeamState(),
      effect: { stillActive: event.kind === 'activate' },
    };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: { phase: 'first-point', startMm: event.pointMm },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'first-point') {
      return {
        state: initialBeamState(),
        effect: {
          commitBeam: { startMm: state.startMm, endMm: event.pointMm },
          stillActive: true,
        },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* C18 Ceiling — sketch polygon (same grammar as Shaft)                     */
/* ────────────────────────────────────────────────────────────────────── */

export type CeilingState =
  | { phase: 'idle' }
  | { phase: 'sketch'; verticesMm: Array<{ xMm: number; yMm: number }> };

export type CeilingEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'close-loop' }
  | { kind: 'cancel' };

export interface CeilingEffect {
  commitCeiling?: { verticesMm: Array<{ xMm: number; yMm: number }> };
  stillActive: boolean;
}

export function initialCeilingState(): CeilingState {
  return { phase: 'idle' } as CeilingState;
}

export function reduceCeiling(
  state: CeilingState,
  event: CeilingEvent,
): { state: CeilingState; effect: CeilingEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    const prev = state.phase === 'sketch' ? state.verticesMm : [];
    return {
      state: { phase: 'sketch', verticesMm: [...prev, event.pointMm] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'close-loop') {
    const verts = state.phase === 'sketch' ? state.verticesMm : [];
    if (verts.length >= 3) {
      return {
        state: { phase: 'idle' },
        effect: { commitCeiling: { verticesMm: verts }, stillActive: true },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Column-at-Grids — click grid lines to select, Enter to place columns   */
/* ────────────────────────────────────────────────────────────────────── */

export type ColumnAtGridsState =
  | { phase: 'idle' }
  | { phase: 'selecting'; selectedGridIds: string[] };

export type ColumnAtGridsEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'toggleGrid'; gridId: string }
  | { kind: 'confirm' }
  | { kind: 'cancel' };

export interface ColumnAtGridsEffect {
  commitAtGrids?: { selectedGridIds: string[] };
  stillActive: boolean;
}

export function initialColumnAtGridsState(): ColumnAtGridsState {
  return { phase: 'idle' };
}

export function reduceColumnAtGrids(
  state: ColumnAtGridsState,
  event: ColumnAtGridsEvent,
): { state: ColumnAtGridsState; effect: ColumnAtGridsEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'selecting', selectedGridIds: [] }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate' || event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: event.kind !== 'deactivate' } };
  }
  if (event.kind === 'toggleGrid') {
    const ids = state.phase === 'selecting' ? state.selectedGridIds : [];
    const next = ids.includes(event.gridId)
      ? ids.filter((id) => id !== event.gridId)
      : [...ids, event.gridId];
    return {
      state: { phase: 'selecting', selectedGridIds: next },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'confirm') {
    const ids = state.phase === 'selecting' ? state.selectedGridIds : [];
    if (ids.length >= 2) {
      return {
        state: { phase: 'idle' },
        effect: { commitAtGrids: { selectedGridIds: ids }, stillActive: true },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Beam System — sketch closed boundary, then fill with parallel beams    */
/* ────────────────────────────────────────────────────────────────────── */

export type BeamSystemState =
  | { phase: 'idle' }
  | { phase: 'sketch'; verticesMm: Array<{ xMm: number; yMm: number }> };

export type BeamSystemEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'close-loop' }
  | { kind: 'cancel' };

export interface BeamSystemEffect {
  commitBeamSystem?: { verticesMm: Array<{ xMm: number; yMm: number }> };
  stillActive: boolean;
}

export function initialBeamSystemState(): BeamSystemState {
  return { phase: 'idle' };
}

export function reduceBeamSystem(
  state: BeamSystemState,
  event: BeamSystemEvent,
): { state: BeamSystemState; effect: BeamSystemEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    const prev = state.phase === 'sketch' ? state.verticesMm : [];
    return {
      state: { phase: 'sketch', verticesMm: [...prev, event.pointMm] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'close-loop') {
    const verts = state.phase === 'sketch' ? state.verticesMm : [];
    if (verts.length >= 3) {
      return {
        state: { phase: 'idle' },
        effect: { commitBeamSystem: { verticesMm: verts }, stillActive: true },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

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
