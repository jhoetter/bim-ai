/**
 * Per-tool grammar — spec §16.4 / §16.5.
 *
 * Each tool's interaction model is captured here as plain data so the
 * tool can be unit-tested without DOM. The shape is consistent across
 * tools so the canvas can switch on `kind` and dispatch input.
 */

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
  | 'trim';

export type WallLocationLine =
  | 'wall-centerline'
  | 'finish-face-exterior'
  | 'finish-face-interior'
  | 'core-centerline'
  | 'core-face-exterior'
  | 'core-face-interior';

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
