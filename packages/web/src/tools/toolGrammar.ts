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
  wall: { chainable: true, multipleable: false, tagOnPlace: true, numericInput: true },
  door: { chainable: false, multipleable: true, tagOnPlace: true, numericInput: false },
  window: { chainable: false, multipleable: true, tagOnPlace: true, numericInput: false },
  beam: { chainable: false, multipleable: false, tagOnPlace: false, numericInput: true },
  column: { chainable: false, multipleable: true, tagOnPlace: false, numericInput: false },
  ceiling: { chainable: false, multipleable: false, tagOnPlace: false, numericInput: false },
  shaft: { chainable: false, multipleable: false, tagOnPlace: false, numericInput: false },
  align: { chainable: false, multipleable: false, tagOnPlace: false, numericInput: false },
  split: { chainable: false, multipleable: true, tagOnPlace: false, numericInput: false },
  trim: { chainable: false, multipleable: true, tagOnPlace: false, numericInput: false },
  'wall-join': { chainable: false, multipleable: false, tagOnPlace: false, numericInput: false },
  'wall-opening': {
    chainable: false,
    multipleable: false,
    tagOnPlace: false,
    numericInput: false,
  },
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
      state: { ...state, locationLine: cycleWallLocationLine(state.locationLine) },
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

export function centroidMm(outline: { xMm: number; yMm: number }[]): { xMm: number; yMm: number } {
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
  | { kind: 'click'; pointMm: { xMm: number; yMm: number }; closeToleranceMm?: number }
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
    return { state: { phase: 'pick-reference', referenceMm: null }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return {
      state: { phase: 'pick-reference', referenceMm: null },
      effect: { stillActive: false },
    };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'pick-reference', referenceMm: null }, effect: { stillActive: true } };
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
  commitTrim?: { referenceId: string; targetId: string; endHint: 'start' | 'end' };
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
  | { kind: 'click-corner'; cornerMm: { xMm: number; yMm: number }; wallIds: string[] }
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
    return { state: { ...state, joinVariant: next }, effect: { stillActive: true } };
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
  | { kind: 'click-wall'; wallId: string; pointMm: { xMm: number; yMm: number } }
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
      state: { phase: 'define-rect', hostWallId: event.wallId, anchorMm: event.pointMm },
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
      state: { phase: 'sketch', verticesMm: [...state.verticesMm, event.pointMm] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'close-loop' && state.verticesMm.length >= 3) {
    return {
      state: initialShaftState(),
      effect: { commitShaft: { verticesMm: state.verticesMm }, stillActive: true },
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
    return { state: initialColumnState(), effect: { stillActive: event.kind === 'activate' } };
  }
  if (event.kind === 'click') {
    return {
      state: initialColumnState(),
      effect: { commitColumn: { positionMm: event.pointMm }, stillActive: true },
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
  commitBeam?: { startMm: { xMm: number; yMm: number }; endMm: { xMm: number; yMm: number } };
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
    return { state: initialBeamState(), effect: { stillActive: event.kind === 'activate' } };
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
