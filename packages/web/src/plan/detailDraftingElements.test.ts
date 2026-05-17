/**
 * §6.4.2 — Detail view 2D drafting elements: detail_line, detail_arc, detail_filled_region.
 *
 * Tests cover the grammar reducers for DetailLine and DetailFilledRegion.
 */
import { describe, it, expect } from 'vitest';
import {
  initialDetailLineState,
  reduceDetailLine,
  initialDetailFilledRegionState,
  reduceDetailFilledRegion,
} from '../tools/toolGrammar';

const pt = (xMm: number, yMm: number) => ({ xMm, yMm });

describe('reduceDetailLine — §6.4.2', () => {
  it('starts in idle', () => {
    const state = initialDetailLineState();
    expect(state.phase).toBe('idle');
  });

  it('activate moves to drawing', () => {
    const state = initialDetailLineState();
    const { state: next } = reduceDetailLine(state, { kind: 'activate' });
    expect(next.phase).toBe('drawing');
    if (next.phase === 'drawing') {
      expect(next.points).toHaveLength(0);
    }
  });

  it('click appends points', () => {
    const { state: drawing } = reduceDetailLine(initialDetailLineState(), { kind: 'activate' });
    const { state: s1 } = reduceDetailLine(drawing, { kind: 'click', pointMm: pt(100, 200) });
    expect(s1.phase).toBe('drawing');
    if (s1.phase === 'drawing') {
      expect(s1.points).toHaveLength(1);
      expect(s1.points[0]).toEqual({ xMm: 100, yMm: 200 });
    }

    const { state: s2 } = reduceDetailLine(s1, { kind: 'click', pointMm: pt(300, 400) });
    if (s2.phase === 'drawing') {
      expect(s2.points).toHaveLength(2);
    }
  });

  it('Enter with 2+ points emits createDetailLine', () => {
    let state = initialDetailLineState();
    ({ state } = reduceDetailLine(state, { kind: 'activate' }));
    ({ state } = reduceDetailLine(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceDetailLine(state, { kind: 'click', pointMm: pt(1000, 0) }));

    const { state: final, effect } = reduceDetailLine(state, { kind: 'commit' });
    expect(final.phase).toBe('idle');
    expect(effect).toBeDefined();
    expect(effect?.kind).toBe('createDetailLine');
    expect(effect?.pointsMm).toHaveLength(2);
    expect(effect?.lineStyle).toBe('solid');
  });

  it('Enter with 1 point does nothing (returns to idle, no effect)', () => {
    let state = initialDetailLineState();
    ({ state } = reduceDetailLine(state, { kind: 'activate' }));
    ({ state } = reduceDetailLine(state, { kind: 'click', pointMm: pt(0, 0) }));

    const { state: final, effect } = reduceDetailLine(state, { kind: 'commit' });
    expect(final.phase).toBe('idle');
    expect(effect).toBeUndefined();
  });

  it('Escape returns to idle', () => {
    let state = initialDetailLineState();
    ({ state } = reduceDetailLine(state, { kind: 'activate' }));
    ({ state } = reduceDetailLine(state, { kind: 'click', pointMm: pt(0, 0) }));

    const { state: final } = reduceDetailLine(state, { kind: 'cancel' });
    expect(final.phase).toBe('idle');
  });
});

describe('reduceDetailFilledRegion — §6.4.2', () => {
  it('starts in idle', () => {
    const state = initialDetailFilledRegionState();
    expect(state.phase).toBe('idle');
  });

  it('sketching phase accumulates points', () => {
    let state = initialDetailFilledRegionState();
    ({ state } = reduceDetailFilledRegion(state, { kind: 'activate' }));
    expect(state.phase).toBe('sketching');

    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(1000, 0) }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(1000, 1000) }));

    if (state.phase === 'sketching') {
      expect(state.points).toHaveLength(3);
    }
  });

  it('Enter with 3+ points emits createDetailFilledRegion', () => {
    let state = initialDetailFilledRegionState();
    ({ state } = reduceDetailFilledRegion(state, { kind: 'activate' }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(1000, 0) }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(1000, 1000) }));

    const { state: final, effect } = reduceDetailFilledRegion(state, { kind: 'commit' });
    expect(final.phase).toBe('idle');
    expect(effect).toBeDefined();
    expect(effect?.kind).toBe('createDetailFilledRegion');
    expect(effect?.perimeterMm).toHaveLength(3);
    expect(effect?.fillPattern).toBe('solid');
  });

  it('Enter with fewer than 3 points does not emit (returns to idle)', () => {
    let state = initialDetailFilledRegionState();
    ({ state } = reduceDetailFilledRegion(state, { kind: 'activate' }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(0, 0) }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(1000, 0) }));

    const { state: final, effect } = reduceDetailFilledRegion(state, { kind: 'commit' });
    expect(final.phase).toBe('idle');
    expect(effect).toBeUndefined();
  });

  it('Escape returns to idle', () => {
    let state = initialDetailFilledRegionState();
    ({ state } = reduceDetailFilledRegion(state, { kind: 'activate' }));
    ({ state } = reduceDetailFilledRegion(state, { kind: 'click', pointMm: pt(0, 0) }));

    const { state: final } = reduceDetailFilledRegion(state, { kind: 'cancel' });
    expect(final.phase).toBe('idle');
  });
});
