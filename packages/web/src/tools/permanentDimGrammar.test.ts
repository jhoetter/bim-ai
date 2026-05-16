import { describe, it, expect } from 'vitest';
import {
  initialPermanentDimState,
  reducePermanentDim,
  type PermanentDimState,
} from './toolGrammar';

describe('permanent dimension chain grammar — §4.2.1', () => {
  it('activate moves to picking phase', () => {
    const state = initialPermanentDimState();
    const { state: next } = reducePermanentDim(state, { kind: 'activate', levelId: 'lvl-1' });
    expect(next.phase).toBe('picking');
    if (next.phase === 'picking') {
      expect(next.levelId).toBe('lvl-1');
      expect(next.points).toHaveLength(0);
      expect(next.cursorMm).toBeNull();
    }
  });

  it('click appends witness points', () => {
    let state: PermanentDimState = initialPermanentDimState();
    ({ state } = reducePermanentDim(state, { kind: 'activate', levelId: 'lvl-1' }));
    ({ state } = reducePermanentDim(state, { kind: 'click', xMm: 100, yMm: 200 }));
    expect(state.phase).toBe('picking');
    if (state.phase === 'picking') {
      expect(state.points).toHaveLength(1);
      expect(state.points[0]).toEqual({ xMm: 100, yMm: 200 });
    }
    ({ state } = reducePermanentDim(state, { kind: 'click', xMm: 300, yMm: 400 }));
    if (state.phase === 'picking') {
      expect(state.points).toHaveLength(2);
      expect(state.points[1]).toEqual({ xMm: 300, yMm: 400 });
    }
  });

  it('commit with 2+ points emits createPermanentDim', () => {
    let state: PermanentDimState = initialPermanentDimState();
    ({ state } = reducePermanentDim(state, { kind: 'activate', levelId: 'lvl-2' }));
    ({ state } = reducePermanentDim(state, { kind: 'click', xMm: 0, yMm: 0 }));
    ({ state } = reducePermanentDim(state, { kind: 'click', xMm: 1000, yMm: 0 }));
    const { state: final, effect } = reducePermanentDim(state, { kind: 'commit' });
    expect(final.phase).toBe('idle');
    expect(effect.createPermanentDim).toBeDefined();
    expect(effect.createPermanentDim?.levelId).toBe('lvl-2');
    expect(effect.createPermanentDim?.witnessPointsMm).toHaveLength(2);
    expect(effect.createPermanentDim?.witnessPointsMm[0]).toEqual({ xMm: 0, yMm: 0 });
    expect(effect.createPermanentDim?.witnessPointsMm[1]).toEqual({ xMm: 1000, yMm: 0 });
    expect(effect.createPermanentDim?.offsetMm).toEqual({ xMm: 0, yMm: -1000 });
  });

  it('commit with <2 points does nothing', () => {
    let state: PermanentDimState = initialPermanentDimState();
    ({ state } = reducePermanentDim(state, { kind: 'activate', levelId: 'lvl-1' }));
    ({ state } = reducePermanentDim(state, { kind: 'click', xMm: 0, yMm: 0 }));
    const { state: after, effect } = reducePermanentDim(state, { kind: 'commit' });
    expect(after.phase).toBe('picking');
    expect(effect.createPermanentDim).toBeUndefined();
  });

  it('cancel returns to idle from picking', () => {
    let state: PermanentDimState = initialPermanentDimState();
    ({ state } = reducePermanentDim(state, { kind: 'activate', levelId: 'lvl-1' }));
    ({ state } = reducePermanentDim(state, { kind: 'click', xMm: 100, yMm: 200 }));
    const { state: after } = reducePermanentDim(state, { kind: 'cancel' });
    expect(after.phase).toBe('idle');
  });

  it('moveMouse updates cursorMm', () => {
    let state: PermanentDimState = initialPermanentDimState();
    ({ state } = reducePermanentDim(state, { kind: 'activate', levelId: 'lvl-1' }));
    const { state: after, effect } = reducePermanentDim(state, {
      kind: 'moveMouse',
      xMm: 500,
      yMm: 600,
    });
    expect(after.phase).toBe('picking');
    if (after.phase === 'picking') {
      expect(after.cursorMm).toEqual({ xMm: 500, yMm: 600 });
    }
    expect(effect.previewDim?.cursorMm).toEqual({ xMm: 500, yMm: 600 });
  });
});
