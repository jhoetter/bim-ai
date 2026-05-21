/**
 * Per-tool grammar — spec §16.4 / §16.5.
 *
 * Each tool's interaction model is captured here as plain data so the
 * tool can be unit-tested without DOM. The shape is consistent across
 * tools so the canvas can switch on `kind` and dispatch input.
 */

export type { WallLocationLine } from '@bim-ai/core';
import type { WallLocationLine, HeightSample, XY } from '@bim-ai/core';

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
  'project-base-point': {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
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
  | 'wall-join'
  | 'decal';

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
  | { kind: 'selectAllGrids'; gridIds: string[] }
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
  if (event.kind === 'selectAllGrids') {
    return {
      state: { phase: 'selecting', selectedGridIds: event.gridIds },
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

type AttachState = { phase: 'idle' } | { phase: 'picking-target'; wallId: string };

type AttachEvent =
  | { kind: 'click'; elementId: string; elementKind: string }
  | { kind: 'cancel' }
  | { kind: 'deactivate' };

interface AttachEffect {
  stillActive: boolean;
  attachWallTop?: { wallId: string; targetId: string };
}

export function initialAttachState(): AttachState {
  return { phase: 'idle' };
}

export function reduceAttach(
  state: AttachState,
  event: AttachEvent,
): { state: AttachState; effect: AttachEffect } {
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (state.phase === 'idle' && event.kind === 'click') {
    if (event.elementKind === 'wall') {
      return {
        state: { phase: 'picking-target', wallId: event.elementId },
        effect: { stillActive: true },
      };
    }
    return { state, effect: { stillActive: true } };
  }
  if (state.phase === 'picking-target' && event.kind === 'click') {
    const attachableKinds = ['roof', 'floor', 'ceiling'];
    if (attachableKinds.includes(event.elementKind)) {
      return {
        state: { phase: 'idle' },
        effect: {
          stillActive: true,
          attachWallTop: { wallId: state.wallId, targetId: event.elementId },
        },
      };
    }
    return { state, effect: { stillActive: true } };
  }
  return { state, effect: { stillActive: true } };
}

type DetachState = { phase: 'idle' };

type DetachEvent = { kind: 'click'; elementId: string; elementKind: string } | { kind: 'cancel' };

interface DetachEffect {
  stillActive: boolean;
  detachWallTop?: { wallId: string };
}

export function initialDetachState(): DetachState {
  return { phase: 'idle' };
}

export function reduceDetach(
  state: DetachState,
  event: DetachEvent,
): { state: DetachState; effect: DetachEffect } {
  if (event.kind === 'cancel') {
    return { state, effect: { stillActive: false } };
  }
  if (event.kind === 'click' && event.elementKind === 'wall') {
    return { state, effect: { stillActive: true, detachWallTop: { wallId: event.elementId } } };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Place Group Tool — WP-B                                                 */
/* Single-click places a group instance at the cursor position.           */
/* ────────────────────────────────────────────────────────────────────── */

export interface PlaceGroupState {
  phase: 'idle';
  selectedDefinitionId: string | null;
}

export type PlaceGroupEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'select-definition'; definitionId: string }
  | { kind: 'click'; positionMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface PlaceGroupEffect {
  commitPlaceGroup?: { definitionId: string; positionMm: { xMm: number; yMm: number } };
  stillActive: boolean;
}

export function initialPlaceGroupState(): PlaceGroupState {
  return { phase: 'idle', selectedDefinitionId: null };
}

export function reducePlaceGroup(
  state: PlaceGroupState,
  event: PlaceGroupEvent,
): { state: PlaceGroupState; effect: PlaceGroupEffect } {
  if (event.kind === 'activate') {
    return { state: initialPlaceGroupState(), effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate' || event.kind === 'cancel') {
    return { state: initialPlaceGroupState(), effect: { stillActive: false } };
  }
  if (event.kind === 'select-definition') {
    return {
      state: { ...state, selectedDefinitionId: event.definitionId },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'click') {
    if (!state.selectedDefinitionId) {
      return { state, effect: { stillActive: true } };
    }
    return {
      state,
      effect: {
        commitPlaceGroup: {
          definitionId: state.selectedDefinitionId,
          positionMm: event.positionMm,
        },
        stillActive: true,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Walkthrough Tool — WP-D3                                               */
/* Clicks capture keyframes; Enter/double-click commits path.             */
/* ────────────────────────────────────────────────────────────────────── */

export interface WalkthroughKeyframeCapture {
  positionMm: { x: number; y: number; z: number };
  targetMm: { x: number; y: number; z: number };
  fovDeg: number;
  timeSec: number;
}

export interface WalkthroughState {
  keyframes: WalkthroughKeyframeCapture[];
}

export type WalkthroughEvent =
  | { kind: 'capture-keyframe'; keyframe: WalkthroughKeyframeCapture }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface WalkthroughEffect {
  createCameraPath?: { name: string; keyframes: WalkthroughKeyframeCapture[] };
  stillActive: boolean;
}

export function initialWalkthroughState(): WalkthroughState {
  return { keyframes: [] };
}

export function reduceWalkthrough(
  state: WalkthroughState,
  event: WalkthroughEvent,
): { state: WalkthroughState; effect: WalkthroughEffect } {
  if (event.kind === 'capture-keyframe') {
    const next = { keyframes: [...state.keyframes, event.keyframe] };
    return { state: next, effect: { stillActive: true } };
  }
  if (event.kind === 'commit') {
    if (state.keyframes.length < 2) {
      return { state: initialWalkthroughState(), effect: { stillActive: false } };
    }
    return {
      state: initialWalkthroughState(),
      effect: {
        createCameraPath: {
          name: `Walkthrough ${new Date().toLocaleTimeString()}`,
          keyframes: state.keyframes,
        },
        stillActive: false,
      },
    };
  }
  return { state: initialWalkthroughState(), effect: { stillActive: false } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Steel Connection Tool — §9.5.1                                         */
/* Two-click: pick host element, then optional target element.            */
/* ────────────────────────────────────────────────────────────────────── */

export type SteelConnectionState =
  | { phase: 'idle' }
  | { phase: 'pick-host'; connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab' }
  | {
      phase: 'pick-target';
      hostElementId: string;
      connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab';
    };

export type SteelConnectionEvent =
  | { kind: 'activate'; connectionType?: 'end_plate' | 'bolted_flange' | 'shear_tab' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pickedElementId: string }
  | { kind: 'cancel' };

export interface SteelConnectionEffect {
  createSteelConnection?: {
    hostElementId: string;
    targetElementId?: string;
    connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab';
    positionT: number;
  };
  stillActive: boolean;
}

export function initialSteelConnectionState(): SteelConnectionState {
  return { phase: 'idle' };
}

export function reduceSteelConnection(
  state: SteelConnectionState,
  event: SteelConnectionEvent,
): { state: SteelConnectionState; effect: SteelConnectionEffect } {
  if (event.kind === 'deactivate' || event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return {
      state: { phase: 'pick-host', connectionType: event.connectionType ?? 'end_plate' },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'click') {
    if (state.phase === 'pick-host') {
      return {
        state: {
          phase: 'pick-target',
          hostElementId: event.pickedElementId,
          connectionType: state.connectionType,
        },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'pick-target') {
      return {
        state: { phase: 'idle' },
        effect: {
          createSteelConnection: {
            hostElementId: state.hostElementId,
            targetElementId: event.pickedElementId,
            connectionType: state.connectionType,
            positionT: 1.0,
          },
          stillActive: true,
        },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Excavation — §5.1.5 polygon-sketch grammar                              */
/* idle → click (add vertex) → close-loop / cancel                        */
/* ────────────────────────────────────────────────────────────────────── */

export type ExcavationPhase = 'idle' | 'sketch';

export interface ExcavationState {
  phase: ExcavationPhase;
  verticesMm: { xMm: number; yMm: number }[];
}

export type ExcavationEvent =
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'close-loop' }
  | { kind: 'cancel' };

export interface ExcavationEffect {
  createExcavationEffect?: { boundaryMm: { xMm: number; yMm: number }[]; depthMm: number };
  stillActive: boolean;
}

export function initialExcavationState(): ExcavationState {
  return { phase: 'idle', verticesMm: [] };
}

export function reduceExcavation(
  state: ExcavationState,
  event: ExcavationEvent,
): { state: ExcavationState; effect: ExcavationEffect } {
  if (event.kind === 'cancel') {
    return { state: initialExcavationState(), effect: { stillActive: true } };
  }
  if (event.kind === 'close-loop') {
    if (state.verticesMm.length >= 3) {
      return {
        state: initialExcavationState(),
        effect: {
          createExcavationEffect: { boundaryMm: [...state.verticesMm], depthMm: 1500 },
          stillActive: true,
        },
      };
    }
    return { state: initialExcavationState(), effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    return {
      state: { phase: 'sketch', verticesMm: [...state.verticesMm, event.pointMm] },
      effect: { stillActive: true },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Terrain Height Point — §5.1.1 + §5.1.2                                */
/* ────────────────────────────────────────────────────────────────────── */

export type TerrainPointState =
  | { phase: 'idle' }
  | { phase: 'active'; toposolidId: string; pendingSamples: HeightSample[] };

export type TerrainPointEvent =
  | { kind: 'activate'; toposolidId: string }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'commit' }
  | { kind: 'cancel' }
  | { kind: 'deactivate' };

export interface TerrainPointEffect {
  previewTerrainPoints?: HeightSample[];
  addTerrainPoints?: { toposolidId: string; samples: HeightSample[] };
  stillActive: boolean;
}

export function initialTerrainPointState(): TerrainPointState {
  return { phase: 'idle' };
}

export function reduceTerrainPoint(
  state: TerrainPointState,
  event: TerrainPointEvent,
): { state: TerrainPointState; effect: TerrainPointEffect } {
  if (event.kind === 'deactivate' || event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return {
      state: { phase: 'active', toposolidId: event.toposolidId, pendingSamples: [] },
      effect: { stillActive: true },
    };
  }
  if (state.phase !== 'active') {
    return { state, effect: { stillActive: false } };
  }
  if (event.kind === 'click') {
    const newSample: HeightSample = { xMm: event.xMm, yMm: event.yMm, zMm: 0 };
    const pendingSamples = [...state.pendingSamples, newSample];
    return {
      state: { ...state, pendingSamples },
      effect: { previewTerrainPoints: pendingSamples, stillActive: true },
    };
  }
  if (event.kind === 'commit') {
    return {
      state: { phase: 'idle' },
      effect: {
        addTerrainPoints: { toposolidId: state.toposolidId, samples: state.pendingSamples },
        stillActive: false,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Terrain Pad — §5.1.4                                                   */
/* ────────────────────────────────────────────────────────────────────── */

export type TerrainPadState =
  | { phase: 'idle' }
  | {
      phase: 'sketching';
      toposolidId: string;
      points: { xMm: number; yMm: number }[];
      elevationMm: number;
    };

export type TerrainPadEvent =
  | { kind: 'activate'; toposolidId: string; elevationMm: number }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface TerrainPadEffect {
  createTerrainPad?: {
    toposolidId: string;
    boundaryMm: { xMm: number; yMm: number }[];
    elevationMm: number;
  };
  stillActive: boolean;
}

export function initialTerrainPadState(): TerrainPadState {
  return { phase: 'idle' };
}

export function reduceTerrainPad(
  state: TerrainPadState,
  event: TerrainPadEvent,
): { state: TerrainPadState; effect: TerrainPadEffect } {
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return {
      state: {
        phase: 'sketching',
        toposolidId: event.toposolidId,
        points: [],
        elevationMm: event.elevationMm,
      },
      effect: { stillActive: true },
    };
  }
  if (state.phase !== 'sketching') {
    return { state, effect: { stillActive: false } };
  }
  if (event.kind === 'click') {
    return {
      state: { ...state, points: [...state.points, { xMm: event.xMm, yMm: event.yMm }] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'commit') {
    if (state.points.length < 3) {
      return { state, effect: { stillActive: true } };
    }
    return {
      state: { phase: 'idle' },
      effect: {
        createTerrainPad: {
          toposolidId: state.toposolidId,
          boundaryMm: state.points,
          elevationMm: state.elevationMm,
        },
        stillActive: false,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Permanent Dimension Chain — §4.2.1                                      */
/* ────────────────────────────────────────────────────────────────────── */

export type PermanentDimState =
  | { phase: 'idle' }
  | { phase: 'picking'; levelId: string; points: XY[]; cursorMm: XY | null };

export type PermanentDimEvent =
  | { kind: 'activate'; levelId: string }
  | { kind: 'moveMouse'; xMm: number; yMm: number }
  | { kind: 'click'; xMm: number; yMm: number }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface PermanentDimEffect {
  previewDim?: { points: XY[]; cursorMm: XY | null };
  createPermanentDim?: { levelId: string; witnessPointsMm: XY[]; offsetMm: XY };
  stillActive: boolean;
}

export function initialPermanentDimState(): PermanentDimState {
  return { phase: 'idle' };
}

export function reducePermanentDim(
  state: PermanentDimState,
  event: PermanentDimEvent,
): { state: PermanentDimState; effect: PermanentDimEffect } {
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'activate') {
    return {
      state: { phase: 'picking', levelId: event.levelId, points: [], cursorMm: null },
      effect: { stillActive: true },
    };
  }
  if (state.phase !== 'picking') {
    return { state, effect: { stillActive: false } };
  }
  if (event.kind === 'moveMouse') {
    const cursorMm: XY = { xMm: event.xMm, yMm: event.yMm };
    const next: PermanentDimState = { ...state, cursorMm };
    return {
      state: next,
      effect: { previewDim: { points: state.points, cursorMm }, stillActive: true },
    };
  }
  if (event.kind === 'click') {
    const points = [...state.points, { xMm: event.xMm, yMm: event.yMm }];
    return {
      state: { ...state, points },
      effect: { previewDim: { points, cursorMm: state.cursorMm }, stillActive: true },
    };
  }
  if (event.kind === 'commit') {
    if (state.points.length < 2) {
      return { state, effect: { stillActive: true } };
    }
    return {
      state: { phase: 'idle' },
      effect: {
        createPermanentDim: {
          levelId: state.levelId,
          witnessPointsMm: state.points,
          offsetMm: { xMm: 0, yMm: -1000 },
        },
        stillActive: false,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Paint — §3.3.4                                                           */
/* ────────────────────────────────────────────────────────────────────── */

export type PaintState =
  | { status: 'idle' }
  | {
      status: 'active';
      hoveredFaceId: string | null;
      hoveredElementId: string | null;
    };

export type PaintEvent =
  | { kind: 'activate' }
  | { kind: 'hover'; faceId: string; elementId: string }
  | { kind: 'click'; faceId: string; elementId: string; materialId: string | null }
  | { kind: 'cancel' };

export interface PaintEffect {
  paintFace?: { elementId: string; faceId: string; materialId: string | null };
  stillActive: boolean;
}

export function initialPaintState(): PaintState {
  return { status: 'idle' };
}

export function reducePaint(
  state: PaintState,
  event: PaintEvent,
): { state: PaintState; effect: PaintEffect } {
  if (event.kind === 'activate') {
    return {
      state: { status: 'active', hoveredFaceId: null, hoveredElementId: null },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'cancel') {
    return { state: { status: 'idle' }, effect: { stillActive: false } };
  }
  if (state.status !== 'active') {
    return { state, effect: { stillActive: false } };
  }
  if (event.kind === 'hover') {
    return {
      state: { status: 'active', hoveredFaceId: event.faceId, hoveredElementId: event.elementId },
      effect: { stillActive: true },
    };
  }
  // click — emit paint_face, stay active for repeated painting
  return {
    state: { ...state },
    effect: {
      paintFace: { elementId: event.elementId, faceId: event.faceId, materialId: event.materialId },
      stillActive: true,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Linework Override — §3.3.7                                               */
/* ────────────────────────────────────────────────────────────────────── */

export type LineworkState = { status: 'idle' } | { status: 'active' };

export type LineworkEvent =
  | { kind: 'activate' }
  | {
      kind: 'click';
      elementId: string;
      colorHex: string;
      lineWeightPx: number;
      lineDash?: number[];
    }
  | { kind: 'cancel' };

export interface LineworkEffect {
  applyLineworkOverride?: {
    elementId: string;
    colorHex: string;
    lineWeightPx: number;
    lineDash?: number[];
  };
  stillActive: boolean;
}

export function initialLineworkState(): LineworkState {
  return { status: 'idle' };
}

export function reduceLinework(
  state: LineworkState,
  event: LineworkEvent,
): { state: LineworkState; effect: LineworkEffect } {
  if (event.kind === 'activate') {
    return { state: { status: 'active' }, effect: { stillActive: true } };
  }
  if (event.kind === 'cancel') {
    return { state: { status: 'idle' }, effect: { stillActive: false } };
  }
  if (state.status !== 'active') {
    return { state, effect: { stillActive: false } };
  }
  return {
    state: { ...state },
    effect: {
      applyLineworkOverride: {
        elementId: event.elementId,
        colorHex: event.colorHex,
        lineWeightPx: event.lineWeightPx,
        lineDash: event.lineDash,
      },
      stillActive: true,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Split Wall — §3.3.6                                                     */
/* ────────────────────────────────────────────────────────────────────── */

export type SplitWallState =
  | { phase: 'idle' }
  | {
      phase: 'active';
      hoverWallId: string | null;
      hoverPointMm: { xMm: number; yMm: number } | null;
    };

export type SplitWallEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'cancel' }
  | { kind: 'hoverWall'; wallId: string; pointMm: { xMm: number; yMm: number } }
  | { kind: 'hoverClear' }
  | { kind: 'click'; wallId: string; pointMm: { xMm: number; yMm: number } };

export interface SplitWallEffect {
  splitWall?: { wallId: string; splitPointMm: { xMm: number; yMm: number } };
  previewSplitPoint?: { wallId: string; pointMm: { xMm: number; yMm: number } } | null;
  stillActive: boolean;
}

export function initialSplitWallState(): SplitWallState {
  return { phase: 'idle' };
}

export function reduceSplitWall(
  state: SplitWallState,
  event: SplitWallEvent,
): { state: SplitWallState; effect: SplitWallEffect } {
  if (event.kind === 'activate') {
    return {
      state: { phase: 'active', hoverWallId: null, hoverPointMm: null },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (state.phase !== 'active') {
    return { state, effect: { stillActive: false } };
  }
  if (event.kind === 'hoverWall') {
    return {
      state: { phase: 'active', hoverWallId: event.wallId, hoverPointMm: event.pointMm },
      effect: {
        previewSplitPoint: { wallId: event.wallId, pointMm: event.pointMm },
        stillActive: true,
      },
    };
  }
  if (event.kind === 'hoverClear') {
    return {
      state: { phase: 'active', hoverWallId: null, hoverPointMm: null },
      effect: { previewSplitPoint: null, stillActive: true },
    };
  }
  // click in active phase → emit split, stay active for repeated splits
  return {
    state: { phase: 'active', hoverWallId: event.wallId, hoverPointMm: event.pointMm },
    effect: {
      splitWall: { wallId: event.wallId, splitPointMm: event.pointMm },
      stillActive: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Measure Angle — 3-click: vertex → first ray → second ray → angleDeg
// ---------------------------------------------------------------------------

export type MeasureAngleStatus = 'idle' | 'picked-vertex' | 'picked-first-ray' | 'complete';

export interface MeasureAngleState {
  status: MeasureAngleStatus;
  vertexMm: { xMm: number; yMm: number } | null;
  firstRayMm: { xMm: number; yMm: number } | null;
  secondRayMm: { xMm: number; yMm: number } | null;
  angleDeg: number | null;
}

export type MeasureAngleEvent =
  | { type: 'activate' }
  | { type: 'click'; positionMm: { xMm: number; yMm: number } }
  | { type: 'cancel' };

export function initialMeasureAngleState(): MeasureAngleState {
  return { status: 'idle', vertexMm: null, firstRayMm: null, secondRayMm: null, angleDeg: null };
}

function _angleBetween(
  vertex: { xMm: number; yMm: number },
  a: { xMm: number; yMm: number },
  b: { xMm: number; yMm: number },
): number {
  const va = { xMm: a.xMm - vertex.xMm, yMm: a.yMm - vertex.yMm };
  const vb = { xMm: b.xMm - vertex.xMm, yMm: b.yMm - vertex.yMm };
  const dot = va.xMm * vb.xMm + va.yMm * vb.yMm;
  const magA = Math.hypot(va.xMm, va.yMm);
  const magB = Math.hypot(vb.xMm, vb.yMm);
  if (magA === 0 || magB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function reduceMeasureAngle(
  state: MeasureAngleState,
  event: MeasureAngleEvent,
): MeasureAngleState {
  if (event.type === 'activate') return initialMeasureAngleState();
  if (event.type === 'cancel') return initialMeasureAngleState();
  if (event.type === 'click') {
    if (state.status === 'idle') {
      return { ...state, status: 'picked-vertex', vertexMm: event.positionMm };
    }
    if (state.status === 'picked-vertex') {
      return { ...state, status: 'picked-first-ray', firstRayMm: event.positionMm };
    }
    if (state.status === 'picked-first-ray') {
      const angleDeg = _angleBetween(state.vertexMm!, state.firstRayMm!, event.positionMm);
      return {
        ...state,
        status: 'complete',
        secondRayMm: event.positionMm,
        angleDeg,
      };
    }
    // complete → reset and start new measurement
    return {
      status: 'picked-vertex',
      vertexMm: event.positionMm,
      firstRayMm: null,
      secondRayMm: null,
      angleDeg: null,
    };
  }
  return state;
}

// ---------------------------------------------------------------------------
// Measure Arc — 3-click: start → end → pass-through → arcLength + radius
// ---------------------------------------------------------------------------

export type MeasureArcStatus = 'idle' | 'picked-start' | 'picked-end' | 'complete';

export interface MeasureArcState {
  status: MeasureArcStatus;
  startMm: { xMm: number; yMm: number } | null;
  endMm: { xMm: number; yMm: number } | null;
  throughMm: { xMm: number; yMm: number } | null;
  arcLengthMm: number | null;
  radiusMm: number | null;
}

export type MeasureArcEvent =
  | { type: 'activate' }
  | { type: 'click'; positionMm: { xMm: number; yMm: number } }
  | { type: 'cancel' };

export function initialMeasureArcState(): MeasureArcState {
  return {
    status: 'idle',
    startMm: null,
    endMm: null,
    throughMm: null,
    arcLengthMm: null,
    radiusMm: null,
  };
}

function _fitCircle3(
  p1: { xMm: number; yMm: number },
  p2: { xMm: number; yMm: number },
  p3: { xMm: number; yMm: number },
): { cx: number; cy: number; r: number } | null {
  const ax = p1.xMm,
    ay = p1.yMm;
  const bx = p2.xMm,
    by = p2.yMm;
  const cx = p3.xMm,
    cy = p3.yMm;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;
  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;
  return { cx: ux, cy: uy, r: Math.hypot(ax - ux, ay - uy) };
}

function _arcLength3(
  p1: { xMm: number; yMm: number },
  p2: { xMm: number; yMm: number },
  p3: { xMm: number; yMm: number },
): { arcLengthMm: number; radiusMm: number } | null {
  const c = _fitCircle3(p1, p2, p3);
  if (!c) return null;
  const a1 = Math.atan2(p1.yMm - c.cy, p1.xMm - c.cx);
  const a2 = Math.atan2(p2.yMm - c.cy, p2.xMm - c.cx);
  const a3 = Math.atan2(p3.yMm - c.cy, p3.xMm - c.cx);
  let sweep = a2 - a1;
  while (sweep > Math.PI * 2) sweep -= Math.PI * 2;
  while (sweep < -Math.PI * 2) sweep += Math.PI * 2;
  let a3Rel = a3 - a1;
  while (a3Rel < 0) a3Rel += Math.PI * 2;
  while (a3Rel > Math.PI * 2) a3Rel -= Math.PI * 2;
  const sweepPos = sweep < 0 ? sweep + Math.PI * 2 : sweep;
  if (a3Rel > sweepPos) {
    sweep = sweep > 0 ? sweep - Math.PI * 2 : sweep + Math.PI * 2;
  }
  return { arcLengthMm: Math.abs(sweep) * c.r, radiusMm: c.r };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Model Line — §7.1.1 project-environment polyline grammar               */
/* idle → click(start) → click*(extend) → enter/double-click(commit)      */
/* ────────────────────────────────────────────────────────────────────── */

export interface ModelLineState {
  pointsMm: { xMm: number; yMm: number }[];
}

export function initialModelLineState(): ModelLineState {
  return { pointsMm: [] };
}

export type ModelLineEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'commit' }
  | { kind: 'cancel' };

export interface ModelLineEffect {
  commitModelLine?: { pointsMm: { xMm: number; yMm: number }[] };
}

export function reduceModelLine(
  state: ModelLineState,
  event: ModelLineEvent,
): { state: ModelLineState; effect: ModelLineEffect } {
  if (event.kind === 'activate' || event.kind === 'deactivate' || event.kind === 'cancel') {
    return { state: initialModelLineState(), effect: {} };
  }
  if (event.kind === 'commit') {
    if (state.pointsMm.length >= 2) {
      return {
        state: initialModelLineState(),
        effect: { commitModelLine: { pointsMm: [...state.pointsMm] } },
      };
    }
    return { state: initialModelLineState(), effect: {} };
  }
  const last = state.pointsMm[state.pointsMm.length - 1];
  if (last && Math.hypot(event.pointMm.xMm - last.xMm, event.pointMm.yMm - last.yMm) < 1) {
    return { state, effect: {} };
  }
  return { state: { pointsMm: [...state.pointsMm, event.pointMm] }, effect: {} };
}

export function reduceMeasureArc(state: MeasureArcState, event: MeasureArcEvent): MeasureArcState {
  if (event.type === 'activate') return initialMeasureArcState();
  if (event.type === 'cancel') return initialMeasureArcState();
  if (event.type === 'click') {
    if (state.status === 'idle') {
      return { ...state, status: 'picked-start', startMm: event.positionMm };
    }
    if (state.status === 'picked-start') {
      return { ...state, status: 'picked-end', endMm: event.positionMm };
    }
    if (state.status === 'picked-end') {
      const result = _arcLength3(state.startMm!, state.endMm!, event.positionMm);
      return {
        ...state,
        status: 'complete',
        throughMm: event.positionMm,
        arcLengthMm: result?.arcLengthMm ?? null,
        radiusMm: result?.radiusMm ?? null,
      };
    }
    // complete → restart
    return {
      status: 'picked-start',
      startMm: event.positionMm,
      endMm: null,
      throughMm: null,
      arcLengthMm: null,
      radiusMm: null,
    };
  }
  return state;
}

// ---------------------------------------------------------------------------
// §2.1.3 — Project Base Point grammar (single-click placement)
// ---------------------------------------------------------------------------

export interface ProjectBasePointGrammarState {
  phase: 'listening' | 'idle';
}

export type ProjectBasePointGrammarEvent =
  | { kind: 'activate' }
  | { kind: 'click'; positionMm: { xMm: number; yMm: number } }
  | { kind: 'escape' };

export interface ProjectBasePointGrammarEffect {
  /** Emit this command when a click is registered. */
  createProjectBasePoint?: { positionMm: { xMm: number; yMm: number } };
}

export function initialProjectBasePointState(): ProjectBasePointGrammarState {
  return { phase: 'idle' };
}

export function reduceProjectBasePoint(
  state: ProjectBasePointGrammarState,
  event: ProjectBasePointGrammarEvent,
): { state: ProjectBasePointGrammarState; effect: ProjectBasePointGrammarEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'listening' }, effect: {} };
  }
  if (event.kind === 'escape') {
    return { state: { phase: 'idle' }, effect: {} };
  }
  if (event.kind === 'click' && state.phase === 'listening') {
    return {
      state: { phase: 'listening' },
      effect: { createProjectBasePoint: { positionMm: event.positionMm } },
    };
  }
  return { state, effect: {} };
}

// ---------------------------------------------------------------------------
// §5.4.1 — North Arrow grammar (single-click placement)
// ---------------------------------------------------------------------------

export interface NorthArrowGrammarState {
  phase: 'listening' | 'idle';
}

export type NorthArrowGrammarEvent =
  | { kind: 'activate' }
  | { kind: 'click'; positionMm: { xMm: number; yMm: number }; rotationDeg?: number }
  | { kind: 'escape' };

export interface NorthArrowGrammarEffect {
  /** Emit this command when a click is registered. */
  createNorthArrow?: { positionMm: { xMm: number; yMm: number }; rotationDeg: number };
}

export function initialNorthArrowState(): NorthArrowGrammarState {
  return { phase: 'idle' };
}

export function reduceNorthArrow(
  state: NorthArrowGrammarState,
  event: NorthArrowGrammarEvent,
): { state: NorthArrowGrammarState; effect: NorthArrowGrammarEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'listening' }, effect: {} };
  }
  if (event.kind === 'escape') {
    return { state: { phase: 'idle' }, effect: {} };
  }
  if (event.kind === 'click' && state.phase === 'listening') {
    return {
      state: { phase: 'listening' },
      effect: {
        createNorthArrow: {
          positionMm: event.positionMm,
          rotationDeg: event.rotationDeg ?? 0,
        },
      },
    };
  }
  return { state, effect: {} };
}

// ---------------------------------------------------------------------------
// §10.3.1 — Conical Roof grammar (2-click: center → radius point)
// ---------------------------------------------------------------------------

export type ConicalRoofState =
  | { phase: 'idle' }
  | { phase: 'first-point'; centerMm: { xMm: number; yMm: number } };

export type ConicalRoofEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface ConicalRoofEffect {
  createConicalRoof?: { centerMm: { xMm: number; yMm: number }; baseRadiusMm: number };
  stillActive: boolean;
}

export function initialConicalRoofState(): ConicalRoofState {
  return { phase: 'idle' };
}

export function reduceConicalRoof(
  state: ConicalRoofState,
  event: ConicalRoofEvent,
): { state: ConicalRoofState; effect: ConicalRoofEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialConicalRoofState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate' || event.kind === 'cancel') {
    return { state: initialConicalRoofState(), effect: { stillActive: event.kind === 'activate' } };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: { phase: 'first-point', centerMm: event.pointMm },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'first-point') {
      const dx = event.pointMm.xMm - state.centerMm.xMm;
      const dy = event.pointMm.yMm - state.centerMm.yMm;
      const baseRadiusMm = Math.max(100, Math.sqrt(dx * dx + dy * dy));
      return {
        state: initialConicalRoofState(),
        effect: {
          createConicalRoof: { centerMm: state.centerMm, baseRadiusMm },
          stillActive: true,
        },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

// ---------------------------------------------------------------------------
// §10.3.2 — Dome Roof grammar (2-click: center → radius point)
// ---------------------------------------------------------------------------

export type DomeRoofState =
  | { phase: 'idle' }
  | { phase: 'first-point'; centerMm: { xMm: number; yMm: number } };

export type DomeRoofEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface DomeRoofEffect {
  createDomeRoof?: { centerMm: { xMm: number; yMm: number }; baseRadiusMm: number };
  stillActive: boolean;
}

export function initialDomeRoofState(): DomeRoofState {
  return { phase: 'idle' };
}

export function reduceDomeRoof(
  state: DomeRoofState,
  event: DomeRoofEvent,
): { state: DomeRoofState; effect: DomeRoofEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialDomeRoofState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate' || event.kind === 'cancel') {
    return { state: initialDomeRoofState(), effect: { stillActive: event.kind === 'activate' } };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: { phase: 'first-point', centerMm: event.pointMm },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'first-point') {
      const dx = event.pointMm.xMm - state.centerMm.xMm;
      const dy = event.pointMm.yMm - state.centerMm.yMm;
      const baseRadiusMm = Math.max(100, Math.sqrt(dx * dx + dy * dy));
      return {
        state: initialDomeRoofState(),
        effect: { createDomeRoof: { centerMm: state.centerMm, baseRadiusMm }, stillActive: true },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

// ---------------------------------------------------------------------------
// §10.3.3 — Spire Roof grammar (2-click: center → radius point)
// ---------------------------------------------------------------------------

export type SpireRoofState =
  | { phase: 'idle' }
  | { phase: 'first-point'; centerMm: { xMm: number; yMm: number } };

export type SpireRoofEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface SpireRoofEffect {
  createSpireRoof?: { centerMm: { xMm: number; yMm: number }; baseRadiusMm: number };
  stillActive: boolean;
}

export function initialSpireRoofState(): SpireRoofState {
  return { phase: 'idle' };
}

export function reduceSpireRoof(
  state: SpireRoofState,
  event: SpireRoofEvent,
): { state: SpireRoofState; effect: SpireRoofEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialSpireRoofState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate' || event.kind === 'cancel') {
    return { state: initialSpireRoofState(), effect: { stillActive: event.kind === 'activate' } };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: { phase: 'first-point', centerMm: event.pointMm },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'first-point') {
      const dx = event.pointMm.xMm - state.centerMm.xMm;
      const dy = event.pointMm.yMm - state.centerMm.yMm;
      const baseRadiusMm = Math.max(100, Math.sqrt(dx * dx + dy * dy));
      return {
        state: initialSpireRoofState(),
        effect: { createSpireRoof: { centerMm: state.centerMm, baseRadiusMm }, stillActive: true },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}

export * from './toolGrammarFamily';
export * from './toolGrammarSiteDetail';


// Re-export annotation/array/scale/roof/cloud/decal reducers extracted to toolGrammarAnnotation.
export * from "./toolGrammarAnnotation";
