import { describe, it, expect } from 'vitest';

import {
  initialRampState,
  reduceRamp,
  RAMP_DEFAULT_WIDTH_MM,
  RAMP_DEFAULT_SLOPE_RATIO,
} from '../tools/toolGrammar';

const pt1 = { xMm: 0, yMm: 0 };
const pt2 = { xMm: 4000, yMm: 0 };

describe('ramp tool grammar — §8.7', () => {
  it('starts in idle state', () => {
    const state = initialRampState();
    expect(state.phase).toBe('idle');
  });

  it('activate transitions to placing-start', () => {
    const state = initialRampState();
    const { state: next } = reduceRamp(state, { kind: 'activate' });
    expect(next.phase).toBe('placing-start');
  });

  it('first click transitions to placing-end with startMm set', () => {
    const state = initialRampState();
    const { state: s1 } = reduceRamp(state, { kind: 'activate' });
    const { state: s2 } = reduceRamp(s1, { kind: 'click', pointMm: pt1 });
    expect(s2.phase).toBe('placing-end');
    if (s2.phase === 'placing-end') {
      expect(s2.startMm).toEqual(pt1);
    }
  });

  it('second click emits createRamp effect', () => {
    const state = initialRampState();
    const { state: s1 } = reduceRamp(state, { kind: 'activate' });
    const { state: s2 } = reduceRamp(s1, { kind: 'click', pointMm: pt1 });
    const { effect } = reduceRamp(s2, { kind: 'click', pointMm: pt2 });
    expect(effect.createRamp).toBeDefined();
    expect(effect.createRamp?.startMm).toEqual(pt1);
    expect(effect.createRamp?.endMm).toEqual(pt2);
  });

  it('emitted createRamp has default widthMm 1200 and slopeRatio 1/12', () => {
    const state = initialRampState();
    const { state: s1 } = reduceRamp(state, { kind: 'activate' });
    const { state: s2 } = reduceRamp(s1, { kind: 'click', pointMm: pt1 });
    const { effect } = reduceRamp(s2, { kind: 'click', pointMm: pt2 });
    expect(effect.createRamp?.widthMm).toBe(RAMP_DEFAULT_WIDTH_MM);
    expect(effect.createRamp?.slopeRatio).toBeCloseTo(RAMP_DEFAULT_SLOPE_RATIO, 5);
  });

  it('Escape from placing-start resets to idle', () => {
    const state = initialRampState();
    const { state: s1 } = reduceRamp(state, { kind: 'activate' });
    const { state: s2 } = reduceRamp(s1, { kind: 'cancel' });
    expect(s2.phase).toBe('idle');
  });

  it('Escape from placing-end resets to idle', () => {
    const state = initialRampState();
    const { state: s1 } = reduceRamp(state, { kind: 'activate' });
    const { state: s2 } = reduceRamp(s1, { kind: 'click', pointMm: pt1 });
    const { state: s3 } = reduceRamp(s2, { kind: 'cancel' });
    expect(s3.phase).toBe('idle');
  });

  it('after second click, state resets to idle', () => {
    const state = initialRampState();
    const { state: s1 } = reduceRamp(state, { kind: 'activate' });
    const { state: s2 } = reduceRamp(s1, { kind: 'click', pointMm: pt1 });
    const { state: s3 } = reduceRamp(s2, { kind: 'click', pointMm: pt2 });
    expect(s3.phase).toBe('idle');
  });
});
