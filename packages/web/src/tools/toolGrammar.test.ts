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
  initialAlignState,
  initialAreaBoundaryState,
  initialDimensionState,
  initialFloorState,
  initialRoofState,
  initialSectionDraft,
  initialShaftState,
  initialColumnState,
  reduceColumn,
  initialBeamState,
  reduceBeam,
  initialCeilingState,
  reduceCeiling,
  initialSplitState,
  initialTrimState,
  initialWallChainState,
  initialWallJoinState,
  initialWallOpeningState,
  RAILING_DEFAULTS,
  reduceAlign,
  reduceAreaBoundary,
  reduceShaft,
  reduceSplit,
  reduceTrim,
  reduceWallChain,
  reduceWallJoin,
  reduceWallOpening,
  setDimensionKind,
  STAIR_RISER_MM_DEFAULT,
  TAG_FAMILIES,
  toggleEdgeSlope,
  toggleFloorMode,
  WALL_LOCATION_LINE_ORDER,
  WINDOW_DEFAULTS,
  areaBoundaryRectangleFromDiagonal,
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

describe('Area boundary — F-095', () => {
  it('clicks accumulate arbitrary vertices and click-near-first closes the loop', () => {
    let state = initialAreaBoundaryState();
    for (const pointMm of [
      { xMm: 0, yMm: 0 },
      { xMm: 4000, yMm: 0 },
      { xMm: 3500, yMm: 1800 },
      { xMm: 1200, yMm: 2600 },
    ]) {
      const out = reduceAreaBoundary(state, { kind: 'click', pointMm });
      state = out.state;
      expect(out.effect.commitBoundaryMm).toBeUndefined();
    }
    const closed = reduceAreaBoundary(state, {
      kind: 'click',
      pointMm: { xMm: 120, yMm: 80 },
      closeToleranceMm: 250,
    });
    expect(closed.effect.commitBoundaryMm).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 4000, yMm: 0 },
      { xMm: 3500, yMm: 1800 },
      { xMm: 1200, yMm: 2600 },
    ]);
    expect(closed.state.verticesMm).toEqual([]);
  });

  it('Enter commits only loops with at least three vertices', () => {
    let state = initialAreaBoundaryState();
    state = reduceAreaBoundary(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceAreaBoundary(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 0 } }).state;
    expect(reduceAreaBoundary(state, { kind: 'commit' }).effect.commitBoundaryMm).toBeUndefined();
    state = reduceAreaBoundary(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 1000 } }).state;
    expect(reduceAreaBoundary(state, { kind: 'commit' }).effect.commitBoundaryMm).toHaveLength(3);
  });

  it('retains the rectangle diagonal helper for the two-click area flow', () => {
    expect(areaBoundaryRectangleFromDiagonal({ xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 0 })).toEqual(
      [
        { xMm: 0, yMm: 0 },
        { xMm: 4000, yMm: 0 },
        { xMm: 4000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
    );
    expect(
      areaBoundaryRectangleFromDiagonal({ xMm: 0, yMm: 0 }, { xMm: 100, yMm: 3000 }),
    ).toBeNull();
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

/* ────────────────────────────────────────────────────────────────────── */
/* Align reducer                                                             */
/* ────────────────────────────────────────────────────────────────────── */

describe('Align reducer', () => {
  it('transitions pick-reference → pick-element on first click', () => {
    let state = initialAlignState();
    state = reduceAlign(state, { kind: 'activate' }).state;
    const result = reduceAlign(state, { kind: 'click', pointMm: { xMm: 100, yMm: 200 } });
    expect(result.state.phase).toBe('pick-element');
    expect(result.state.referenceMm).toEqual({ xMm: 100, yMm: 200 });
    expect(result.effect.commitAlign).toBeUndefined();
    expect(result.effect.stillActive).toBe(true);
  });

  it('emits commitAlign on second click and returns to pick-reference', () => {
    let state = initialAlignState();
    state = reduceAlign(state, { kind: 'activate' }).state;
    state = reduceAlign(state, { kind: 'click', pointMm: { xMm: 100, yMm: 200 } }).state;
    const result = reduceAlign(state, { kind: 'click', pointMm: { xMm: 300, yMm: 400 } });
    expect(result.effect.commitAlign).toEqual({
      referenceMm: { xMm: 100, yMm: 200 },
      targetMm: { xMm: 300, yMm: 400 },
    });
    expect(result.state.phase).toBe('pick-reference');
    expect(result.state.referenceMm).toBeNull();
    expect(result.effect.stillActive).toBe(true);
  });

  it('resets to pick-reference on cancel', () => {
    let state = initialAlignState();
    state = reduceAlign(state, { kind: 'activate' }).state;
    state = reduceAlign(state, { kind: 'click', pointMm: { xMm: 100, yMm: 0 } }).state;
    expect(state.phase).toBe('pick-element');
    const result = reduceAlign(state, { kind: 'cancel' });
    expect(result.state.phase).toBe('pick-reference');
    expect(result.state.referenceMm).toBeNull();
    expect(result.effect.stillActive).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* Split reducer                                                             */
/* ────────────────────────────────────────────────────────────────────── */

describe('Split reducer', () => {
  it('emits commitSplit on click while active', () => {
    let state = initialSplitState();
    state = reduceSplit(state, { kind: 'activate' }).state;
    const result = reduceSplit(state, { kind: 'click', pointMm: { xMm: 500, yMm: 300 } });
    expect(result.effect.commitSplit).toEqual({ pointMm: { xMm: 500, yMm: 300 } });
    expect(result.effect.stillActive).toBe(true);
  });

  it('stays active after a split', () => {
    let state = initialSplitState();
    state = reduceSplit(state, { kind: 'activate' }).state;
    const after = reduceSplit(state, {
      kind: 'click',
      pointMm: { xMm: 100, yMm: 100 },
    }).state;
    expect(after.active).toBe(true);
  });

  it('does not emit commitSplit when inactive', () => {
    const state = initialSplitState();
    const result = reduceSplit(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } });
    expect(result.effect.commitSplit).toBeUndefined();
    expect(result.effect.stillActive).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* Trim reducer                                                              */
/* ────────────────────────────────────────────────────────────────────── */

describe('Trim reducer', () => {
  it('stores referenceId on click-reference', () => {
    let state = initialTrimState();
    state = reduceTrim(state, { kind: 'activate' }).state;
    const result = reduceTrim(state, { kind: 'click-reference', elementId: 'wall-1' });
    expect(result.state.phase).toBe('pick-target');
    expect(result.state.referenceId).toBe('wall-1');
    expect(result.effect.commitTrim).toBeUndefined();
    expect(result.effect.stillActive).toBe(true);
  });

  it('emits commitTrim on click-target and returns to pick-reference', () => {
    let state = initialTrimState();
    state = reduceTrim(state, { kind: 'activate' }).state;
    state = reduceTrim(state, { kind: 'click-reference', elementId: 'wall-1' }).state;
    const result = reduceTrim(state, {
      kind: 'click-target',
      elementId: 'wall-2',
      endHint: 'start',
    });
    expect(result.effect.commitTrim).toEqual({
      referenceId: 'wall-1',
      targetId: 'wall-2',
      endHint: 'start',
    });
    expect(result.state.phase).toBe('pick-reference');
    expect(result.state.referenceId).toBeNull();
    expect(result.effect.stillActive).toBe(true);
  });

  it('resets on cancel', () => {
    let state = initialTrimState();
    state = reduceTrim(state, { kind: 'activate' }).state;
    state = reduceTrim(state, { kind: 'click-reference', elementId: 'wall-1' }).state;
    const result = reduceTrim(state, { kind: 'cancel' });
    expect(result.state.phase).toBe('pick-reference');
    expect(result.state.referenceId).toBeNull();
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* WallJoin reducer                                                         */
/* ────────────────────────────────────────────────────────────────────── */

describe('WallJoin reducer', () => {
  it('starts in idle phase', () => {
    const state = initialWallJoinState();
    expect(state.phase).toBe('idle');
    expect(state.wallIds).toHaveLength(0);
    expect(state.joinVariant).toBe('miter');
  });

  it('transitions to selected on click-corner', () => {
    let state = initialWallJoinState();
    state = reduceWallJoin(state, { kind: 'activate' }).state;
    const corner = { xMm: 1000, yMm: 2000 };
    const { state: next, effect } = reduceWallJoin(state, {
      kind: 'click-corner',
      cornerMm: corner,
      wallIds: ['w1', 'w2'],
    });
    expect(next.phase).toBe('selected');
    expect(next.cornerMm).toEqual(corner);
    expect(next.wallIds).toEqual(['w1', 'w2']);
    expect(next.joinVariant).toBe('miter');
    expect(effect.stillActive).toBe(true);
    expect(effect.commitJoin).toBeUndefined();
  });

  it('cycles miter → butt → square → miter on cycle events', () => {
    let state = initialWallJoinState();
    state = reduceWallJoin(state, {
      kind: 'click-corner',
      cornerMm: { xMm: 0, yMm: 0 },
      wallIds: ['w1'],
    }).state;
    expect(state.joinVariant).toBe('miter');
    state = reduceWallJoin(state, { kind: 'cycle' }).state;
    expect(state.joinVariant).toBe('butt');
    state = reduceWallJoin(state, { kind: 'cycle' }).state;
    expect(state.joinVariant).toBe('square');
    state = reduceWallJoin(state, { kind: 'cycle' }).state;
    expect(state.joinVariant).toBe('miter');
  });

  it('emits commitJoin on accept and returns to idle', () => {
    let state = initialWallJoinState();
    state = reduceWallJoin(state, {
      kind: 'click-corner',
      cornerMm: { xMm: 0, yMm: 0 },
      wallIds: ['w1', 'w2'],
    }).state;
    state = reduceWallJoin(state, { kind: 'cycle' }).state; // butt
    const { state: next, effect } = reduceWallJoin(state, { kind: 'accept' });
    expect(effect.commitJoin).toEqual({ wallIds: ['w1', 'w2'], variant: 'butt' });
    expect(effect.stillActive).toBe(true);
    expect(next.phase).toBe('idle');
  });

  it('returns to idle on cancel, stillActive stays true', () => {
    let state = initialWallJoinState();
    state = reduceWallJoin(state, {
      kind: 'click-corner',
      cornerMm: { xMm: 0, yMm: 0 },
      wallIds: ['w1'],
    }).state;
    const { state: next, effect } = reduceWallJoin(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
    expect(effect.stillActive).toBe(true);
    expect(effect.commitJoin).toBeUndefined();
  });

  it('deactivate returns to idle with stillActive false', () => {
    let state = initialWallJoinState();
    state = reduceWallJoin(state, {
      kind: 'click-corner',
      cornerMm: { xMm: 0, yMm: 0 },
      wallIds: ['w1'],
    }).state;
    const { state: next, effect } = reduceWallJoin(state, { kind: 'deactivate' });
    expect(next.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });

  it('cycle is a no-op while in idle phase', () => {
    const state = initialWallJoinState();
    const { state: next } = reduceWallJoin(state, { kind: 'cycle' });
    expect(next.phase).toBe('idle');
    expect(next.joinVariant).toBe('miter');
  });
});

describe('WallOpening reducer', () => {
  it('transitions pick-wall → define-rect on click-wall', () => {
    const s0 = initialWallOpeningState();
    const { state } = reduceWallOpening(s0, {
      kind: 'click-wall',
      wallId: 'w1',
      pointMm: { xMm: 100, yMm: 200 },
    });
    expect(state.phase).toBe('define-rect');
    expect(state.hostWallId).toBe('w1');
    expect(state.anchorMm).toEqual({ xMm: 100, yMm: 200 });
  });
  it('emits commitWallOpening on drag-end and returns to pick-wall', () => {
    let state = initialWallOpeningState();
    state = reduceWallOpening(state, {
      kind: 'click-wall',
      wallId: 'w1',
      pointMm: { xMm: 0, yMm: 0 },
    }).state;
    const { state: next, effect } = reduceWallOpening(state, {
      kind: 'drag-end',
      cornerMm: { xMm: 500, yMm: 500 },
    });
    expect(effect.commitWallOpening).toEqual({
      hostWallId: 'w1',
      anchorMm: { xMm: 0, yMm: 0 },
      cornerMm: { xMm: 500, yMm: 500 },
    });
    expect(next.phase).toBe('pick-wall');
    expect(effect.stillActive).toBe(true);
  });
  it('resets to pick-wall on cancel', () => {
    let state = initialWallOpeningState();
    state = reduceWallOpening(state, {
      kind: 'click-wall',
      wallId: 'w1',
      pointMm: { xMm: 0, yMm: 0 },
    }).state;
    const { state: next } = reduceWallOpening(state, { kind: 'cancel' });
    expect(next.phase).toBe('pick-wall');
  });
});

describe('Shaft reducer', () => {
  it('transitions to sketch on first click', () => {
    const s0 = initialShaftState();
    const { state } = reduceShaft(s0, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } });
    expect(state.phase).toBe('sketch');
    expect(state.verticesMm).toHaveLength(1);
  });
  it('accumulates vertices on subsequent clicks', () => {
    let state = initialShaftState();
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 0 } }).state;
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 1000 } }).state;
    expect(state.verticesMm).toHaveLength(3);
  });
  it('emits commitShaft with ≥3 vertices on close-loop', () => {
    let state = initialShaftState();
    const pts = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
    ];
    for (const p of pts) state = reduceShaft(state, { kind: 'click', pointMm: p }).state;
    const { effect } = reduceShaft(state, { kind: 'close-loop' });
    expect(effect.commitShaft?.verticesMm).toHaveLength(3);
    expect(effect.stillActive).toBe(true);
  });
  it('does not emit on close-loop with fewer than 3 vertices', () => {
    let state = initialShaftState();
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { effect } = reduceShaft(state, { kind: 'close-loop' });
    expect(effect.commitShaft).toBeUndefined();
  });
});

describe('Column reducer', () => {
  it('emits commitColumn on click', () => {
    const s0 = initialColumnState();
    const { effect } = reduceColumn(s0, { kind: 'click', pointMm: { xMm: 1000, yMm: 2000 } });
    expect(effect.commitColumn?.positionMm).toEqual({ xMm: 1000, yMm: 2000 });
    expect(effect.stillActive).toBe(true);
  });
  it('stays idle after cancel', () => {
    const { state, effect } = reduceColumn(initialColumnState(), { kind: 'cancel' });
    expect(state.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });
});

describe('Beam reducer', () => {
  it('transitions to first-point on first click', () => {
    const { state } = reduceBeam(initialBeamState(), {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    });
    expect(state.phase).toBe('first-point');
  });
  it('emits commitBeam on second click', () => {
    let state = initialBeamState();
    state = reduceBeam(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { effect } = reduceBeam(state, { kind: 'click', pointMm: { xMm: 5000, yMm: 0 } });
    expect(effect.commitBeam?.startMm).toEqual({ xMm: 0, yMm: 0 });
    expect(effect.commitBeam?.endMm).toEqual({ xMm: 5000, yMm: 0 });
    expect(effect.stillActive).toBe(true);
  });
  it('resets to idle after cancel', () => {
    let state = initialBeamState();
    state = reduceBeam(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { state: next } = reduceBeam(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
  });
});

describe('Ceiling reducer', () => {
  it('starts in idle phase', () => {
    expect(initialCeilingState().phase).toBe('idle');
  });
  it('transitions to sketch on first click', () => {
    const { state } = reduceCeiling(initialCeilingState(), {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    });
    expect(state.phase).toBe('sketch');
  });
  it('accumulates vertices in sketch phase', () => {
    let state = initialCeilingState();
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 5000, yMm: 0 } }).state;
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 5000, yMm: 4000 } }).state;
    expect(state.phase).toBe('sketch');
    if (state.phase === 'sketch') expect(state.verticesMm).toHaveLength(3);
  });
  it('commits polygon when closing back to first vertex (≥3 verts)', () => {
    let state = initialCeilingState();
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 5000, yMm: 0 } }).state;
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 5000, yMm: 4000 } }).state;
    const { effect } = reduceCeiling(state, { kind: 'close-loop' });
    expect(effect.commitCeiling).toBeDefined();
    expect(effect.commitCeiling?.verticesMm).toHaveLength(3);
    expect(effect.stillActive).toBe(true);
  });
  it('resets to idle on cancel', () => {
    let state = initialCeilingState();
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { state: next } = reduceCeiling(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
  });
});
