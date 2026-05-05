import { describe, expect, it } from 'vitest';
import {
  centroidMm,
  computeStairRun,
  cycleWallLocationLine,
  DIMENSION_HOTKEYS,
  DOOR_DEFAULTS,
  flipDoorHand,
  flipDoorSwing,
  flipSectionDepth,
  initialDimensionState,
  initialFloorState,
  initialRoofState,
  initialSectionDraft,
  initialWallChainState,
  RAILING_DEFAULTS,
  reduceWallChain,
  setDimensionKind,
  STAIR_RISER_MM_DEFAULT,
  TAG_FAMILIES,
  toggleEdgeSlope,
  toggleFloorMode,
  WALL_LOCATION_LINE_ORDER,
  WINDOW_DEFAULTS,
} from './toolGrammar';

/* ────────────────────────────────────────────────────────────────────── */
/* C02 Wall                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

describe('Wall — §16.4.1', () => {
  it('exposes the 6 location-line cycle order', () => {
    expect(WALL_LOCATION_LINE_ORDER).toHaveLength(6);
  });
  it('Tab cycles through location lines and wraps', () => {
    let current = WALL_LOCATION_LINE_ORDER[0]!;
    for (let i = 0; i < WALL_LOCATION_LINE_ORDER.length; i++) {
      current = cycleWallLocationLine(current);
    }
    expect(current).toBe(WALL_LOCATION_LINE_ORDER[0]);
  });
  it('reduceWallChain commits a segment on the second click and stays in chain mode', () => {
    let state = initialWallChainState();
    state = reduceWallChain(state, { kind: 'tool-activated' }).state;
    const first = reduceWallChain(state, {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    });
    expect(first.effect.commitSegment).toBeUndefined();
    state = first.state;
    const second = reduceWallChain(state, {
      kind: 'click',
      pointMm: { xMm: 1000, yMm: 0 },
    });
    expect(second.effect.commitSegment).toBeDefined();
    expect(second.effect.stillActive).toBe(true);
    state = second.state;
    const third = reduceWallChain(state, {
      kind: 'click',
      pointMm: { xMm: 1000, yMm: 1000 },
    });
    expect(third.effect.commitSegment?.startMm).toEqual({ xMm: 1000, yMm: 0 });
  });
  it('Esc breaks the chain but keeps the tool active', () => {
    let state = initialWallChainState();
    state = reduceWallChain(state, { kind: 'tool-activated' }).state;
    state = reduceWallChain(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceWallChain(state, { kind: 'click', pointMm: { xMm: 100, yMm: 0 } }).state;
    const cancel = reduceWallChain(state, { kind: 'cancel' });
    expect(cancel.effect.chainBroken).toBe(true);
    expect(cancel.effect.stillActive).toBe(true);
    expect(cancel.state.chainAnchorMm).toBeNull();
  });
  it('Enter exits the tool', () => {
    let state = initialWallChainState();
    state = reduceWallChain(state, { kind: 'tool-activated' }).state;
    const out = reduceWallChain(state, { kind: 'enter-finish' });
    expect(out.effect.stillActive).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C03 Door / C04 Window                                                    */
/* ────────────────────────────────────────────────────────────────────── */

describe('Door / Window — §16.4.2 / §16.4.3', () => {
  it('door defaults match spec', () => {
    expect(DOOR_DEFAULTS).toEqual({
      widthMm: 900,
      heightMm: 2100,
      swing: 'left',
      hand: 'in',
    });
  });
  it('window defaults match spec', () => {
    expect(WINDOW_DEFAULTS).toEqual({
      widthMm: 1200,
      heightMm: 1500,
      sillHeightMm: 900,
    });
  });
  it('flipDoorSwing toggles', () => {
    expect(flipDoorSwing('left')).toBe('right');
    expect(flipDoorSwing('right')).toBe('left');
  });
  it('flipDoorHand toggles', () => {
    expect(flipDoorHand('in')).toBe('out');
    expect(flipDoorHand('out')).toBe('in');
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C05 Floor                                                                */
/* ────────────────────────────────────────────────────────────────────── */

describe('Floor — §16.4.4', () => {
  it('starts in pick-walls mode', () => {
    expect(initialFloorState().mode).toBe('pick-walls');
  });
  it('toggle flips between pick-walls and sketch', () => {
    expect(toggleFloorMode('pick-walls')).toBe('sketch');
    expect(toggleFloorMode('sketch')).toBe('pick-walls');
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C06 Roof                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

describe('Roof — §16.4.5', () => {
  it('defaults to gable @ 35°', () => {
    const r = initialRoofState();
    expect(r.type).toBe('gable');
    expect(r.slopeDeg).toBe(35);
    expect(r.eaveOverhangMm).toBe(600);
  });
  it('toggleEdgeSlope flips the per-edge override', () => {
    let r = initialRoofState();
    r = toggleEdgeSlope(r, 0);
    expect(r.edgeSlopes[0]).toBe(true);
    r = toggleEdgeSlope(r, 0);
    expect(r.edgeSlopes[0]).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C07 Stair                                                                */
/* ────────────────────────────────────────────────────────────────────── */

describe('Stair — §16.4.6', () => {
  it('computes risers from level delta and target riser mm', () => {
    const out = computeStairRun({ baseLevelElevMm: 0, topLevelElevMm: 3000 });
    expect(out.riserCount).toBeGreaterThan(0);
    expect(out.totalRiseMm).toBe(3000);
    expect(out.riserMm).toBeCloseTo(3000 / out.riserCount, 6);
  });
  it('uses STAIR_RISER_MM_DEFAULT when preferred not specified', () => {
    const out = computeStairRun({ baseLevelElevMm: 0, topLevelElevMm: 1750 });
    expect(out.riserCount).toBe(Math.round(1750 / STAIR_RISER_MM_DEFAULT));
  });
  it('returns 0 risers for non-positive rise', () => {
    const out = computeStairRun({ baseLevelElevMm: 100, topLevelElevMm: 100 });
    expect(out.riserCount).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C08 Railing                                                              */
/* ────────────────────────────────────────────────────────────────────── */

describe('Railing — §16.4.7', () => {
  it('default style matches spec (horizontal bars 5×30)', () => {
    expect(RAILING_DEFAULTS.style).toBe('horizontal-bars-5x30');
    expect(RAILING_DEFAULTS.totalHeightMm).toBe(1100);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C09 Room marker                                                          */
/* ────────────────────────────────────────────────────────────────────── */

describe('Room marker — §16.4.8', () => {
  it('centroid of a unit square is its center', () => {
    const c = centroidMm([
      { xMm: 0, yMm: 0 },
      { xMm: 1, yMm: 0 },
      { xMm: 1, yMm: 1 },
      { xMm: 0, yMm: 1 },
    ]);
    expect(c.xMm).toBeCloseTo(0.5, 6);
    expect(c.yMm).toBeCloseTo(0.5, 6);
  });
  it('handles degenerate (zero-area) outlines', () => {
    const c = centroidMm([
      { xMm: 0, yMm: 0 },
      { xMm: 1, yMm: 0 },
    ]);
    expect(c.xMm).toBeCloseTo(0.5, 6);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C10 Dimension                                                            */
/* ────────────────────────────────────────────────────────────────────── */

describe('Dimension — §16.4.9', () => {
  it('exposes hotkeys for all 5 kinds', () => {
    expect(DIMENSION_HOTKEYS.linear).toBe('L');
    expect(DIMENSION_HOTKEYS.aligned).toBe('A');
    expect(DIMENSION_HOTKEYS.angular).toBe('G');
    expect(DIMENSION_HOTKEYS.radial).toBe('Q');
    expect(DIMENSION_HOTKEYS.diameter).toBe('Shift+Q');
  });
  it('setDimensionKind swaps the active kind', () => {
    const s = initialDimensionState();
    expect(s.kind).toBe('linear');
    expect(setDimensionKind(s, 'angular').kind).toBe('angular');
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C11 Section                                                              */
/* ────────────────────────────────────────────────────────────────────── */

describe('Section — §16.4.10', () => {
  it('initial draft has null endpoints and depth sign +1', () => {
    const s = initialSectionDraft();
    expect(s.startMm).toBeNull();
    expect(s.endMm).toBeNull();
    expect(s.depthSign).toBe(1);
  });
  it('flipSectionDepth toggles the depth sign', () => {
    expect(flipSectionDepth(initialSectionDraft()).depthSign).toBe(-1);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* C12 Tag subdropdown                                                      */
/* ────────────────────────────────────────────────────────────────────── */

describe('Tag families — §16.5', () => {
  it('exposes all 5 tag families', () => {
    expect(TAG_FAMILIES.map((t) => t.id)).toEqual([
      'tag-door',
      'tag-window',
      'tag-wall',
      'tag-room',
      'tag-by-category',
    ]);
  });
});
