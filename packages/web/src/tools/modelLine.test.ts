import { describe, it, expect } from 'vitest';
import { initialModelLineState, reduceModelLine } from './toolGrammar';

const PT = (x: number, y: number) => ({ xMm: x, yMm: y });

describe('model line grammar — §7.1.1', () => {
  it('idle state, click starts line at first point', () => {
    const s0 = initialModelLineState();
    const { state } = reduceModelLine(s0, { kind: 'click', pointMm: PT(0, 0) });
    expect(state.pointsMm).toHaveLength(1);
    expect(state.pointsMm[0]).toEqual(PT(0, 0));
  });

  it('second click extends line to two points', () => {
    let s = initialModelLineState();
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(1000, 0) }));
    expect(s.pointsMm).toHaveLength(2);
    expect(s.pointsMm[1]).toEqual(PT(1000, 0));
  });

  it('enter fires commitModelLine effect with collected points', () => {
    let s = initialModelLineState();
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(2000, 0) }));
    const { state: final, effect } = reduceModelLine(s, { kind: 'commit' });
    expect(effect.commitModelLine).toBeDefined();
    expect(effect.commitModelLine!.pointsMm).toHaveLength(2);
    expect(final.pointsMm).toHaveLength(0);
  });

  it('escape resets to idle', () => {
    let s = initialModelLineState();
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(500, 0) }));
    const { state: final, effect } = reduceModelLine(s, { kind: 'cancel' });
    expect(final.pointsMm).toHaveLength(0);
    expect(effect.commitModelLine).toBeUndefined();
  });

  it('commitModelLine includes all clicked points', () => {
    let s = initialModelLineState();
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(1000, 0) }));
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(1000, 1000) }));
    const { effect } = reduceModelLine(s, { kind: 'commit' });
    expect(effect.commitModelLine!.pointsMm).toHaveLength(3);
    expect(effect.commitModelLine!.pointsMm[2]).toEqual(PT(1000, 1000));
  });

  it('commit with fewer than 2 points produces no effect', () => {
    let s = initialModelLineState();
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(0, 0) }));
    const { effect } = reduceModelLine(s, { kind: 'commit' });
    expect(effect.commitModelLine).toBeUndefined();
  });

  it('duplicate click within 1mm is ignored', () => {
    let s = initialModelLineState();
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(0, 0) }));
    ({ state: s } = reduceModelLine(s, { kind: 'click', pointMm: PT(0.5, 0.5) }));
    expect(s.pointsMm).toHaveLength(1);
  });
});
