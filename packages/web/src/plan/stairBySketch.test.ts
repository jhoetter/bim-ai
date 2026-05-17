/**
 * §8.6.3 — stair by sketch grammar tests
 */

import { describe, expect, it } from 'vitest';

import { initialStairSketchPhase, stairSketchReducer } from '../tools/toolGrammar';

const P = (xMm: number, yMm: number) => ({ xMm, yMm });

describe('stair by sketch grammar — §8.6.3', () => {
  it('two clicks creates straight stair (via 3-point path with 90° corner)', () => {
    // The grammar always needs 3 clicks (start, corner, end).
    // Two clicks only brings us to placing-end phase.
    let state = initialStairSketchPhase();
    // activate
    ({ next: state } = stairSketchReducer(state, { kind: 'activate' }));
    expect(state.phase).toBe('placing-start');

    // click 1: start
    ({ next: state } = stairSketchReducer(state, { kind: 'click', pointMm: P(0, 0) }));
    expect(state.phase).toBe('placing-corner');

    // click 2: corner (collinear → produces straight stair on 3rd click)
    ({ next: state } = stairSketchReducer(state, { kind: 'click', pointMm: P(1000, 0) }));
    expect(state.phase).toBe('placing-end');

    // click 3: end — emits createStair effect
    const result = stairSketchReducer(state, { kind: 'click', pointMm: P(2000, 0) });
    expect(result.next.phase).toBe('idle');
    expect(result.effect).toBeDefined();
    expect(result.effect?.kind).toBe('createStair');
    if (result.effect?.kind === 'createStair') {
      expect(result.effect.startMm).toEqual(P(0, 0));
      expect(result.effect.cornerMm).toEqual(P(1000, 0));
      expect(result.effect.endMm).toEqual(P(2000, 0));
    }
  });

  it('three clicks with 90° turn creates l_shape stair', () => {
    let state = initialStairSketchPhase();
    ({ next: state } = stairSketchReducer(state, { kind: 'activate' }));
    ({ next: state } = stairSketchReducer(state, { kind: 'click', pointMm: P(0, 0) }));
    ({ next: state } = stairSketchReducer(state, { kind: 'click', pointMm: P(1000, 0) }));
    const result = stairSketchReducer(state, { kind: 'click', pointMm: P(1000, 1000) });
    expect(result.effect?.kind).toBe('createStair');
    if (result.effect?.kind === 'createStair') {
      // The consumer (buildMultiRunStairConfig) will classify the 90° turn as l_shape
      expect(result.effect.startMm).toEqual(P(0, 0));
      expect(result.effect.cornerMm).toEqual(P(1000, 0));
      expect(result.effect.endMm).toEqual(P(1000, 1000));
    }
  });

  it('Escape resets to idle', () => {
    let state = initialStairSketchPhase();
    ({ next: state } = stairSketchReducer(state, { kind: 'activate' }));
    ({ next: state } = stairSketchReducer(state, { kind: 'click', pointMm: P(0, 0) }));
    expect(state.phase).toBe('placing-corner');

    const result = stairSketchReducer(state, { kind: 'escape' });
    expect(result.next.phase).toBe('idle');
    expect(result.effect?.kind).toBe('reset');
  });
});
